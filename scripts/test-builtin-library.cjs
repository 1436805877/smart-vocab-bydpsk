// 内置词库导入/校验回归：不启动 Electron，用临时 SQLite 跑真实数据。
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { createBuiltinLibrary } = require('../lib/builtin-library');

const root = path.resolve(__dirname, '..');
const dataFile = path.join(root, 'data-cet6.json.gz');
const manifestFile = path.join(root, 'data-cet6.manifest.json');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'smartvocab-builtin-test-'));
const dbFile = path.join(temp, 'wordbook.db');
const markerFile = path.join(temp, 'builtin-library.json');
const db = new DatabaseSync(dbFile);

db.exec(`
  CREATE TABLE objects (
    store TEXT NOT NULL,
    key TEXT NOT NULL,
    json TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (store, key)
  );
`);

const stores = ['words', 'extras', 'progress', 'decks', 'deckWords', 'backups'];
function dbCounts(database) {
  return Object.fromEntries(stores.map(store => [store,
    database.prepare('SELECT COUNT(*) AS n FROM objects WHERE store = ?').get(store).n]));
}
function dbReadAll(database, store) {
  return database.prepare('SELECT json FROM objects WHERE store = ? ORDER BY key').all(store)
    .map(row => JSON.parse(row.json));
}
function rowKey(store, row) {
  return (store === 'words' || store === 'decks' || store === 'backups') ? String(row.id) : String(row.key);
}
function dbImportAll(database, payload) {
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const store of stores) {
      database.prepare('DELETE FROM objects WHERE store = ?').run(store);
      const stmt = database.prepare('INSERT INTO objects (store, key, json, updated_at) VALUES (?, ?, ?, ?)');
      for (const row of payload[store] || []) {
        stmt.run(store, rowKey(store, row), JSON.stringify(row), Date.now());
      }
    }
    database.exec('COMMIT');
  } catch (error) {
    try { database.exec('ROLLBACK'); } catch { /* ignore */ }
    throw error;
  }
}

function makeLibrary(options = {}) {
  return createBuiltinLibrary({
    dataFile: options.dataFile || dataFile,
    manifestFile: options.manifestFile || manifestFile,
    markerFile: options.markerFile || markerFile,
    ensureStorageDirs: () => fs.mkdirSync(temp, { recursive: true }),
    getAppDb: () => db,
    dbCounts,
    dbReadAll,
    dbImportAll,
    log: () => {},
  });
}

try {
  fs.rmSync(markerFile, { force: true });
  const library = makeLibrary();
  const info = library.getInfo();
  assert.strictEqual(info.ok, true, 'manifest/hash should verify');
  assert.strictEqual(info.libraryVersion, '2026.10.1');
  assert.strictEqual(info.wordCount, 4036);
  assert.strictEqual(info.senseCount, 8009);

  let result = library.ensure();
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.seeded, true);
  assert.strictEqual(result.library.ok, true);
  assert.strictEqual(result.library.verified, true);
  assert.strictEqual(result.library.libraryVersion, '2026.10.1');
  assert.strictEqual(result.library.wordCount, 4036);
  assert.strictEqual(result.library.senseCount, 8009);
  assert.strictEqual(dbCounts(db).words, 4036);
  assert.strictEqual(dbCounts(db).deckWords, 4036);
  assert.strictEqual(dbCounts(db).extras, 3);
  assert.ok(fs.existsSync(markerFile), 'marker should be written');
  const marker = JSON.parse(fs.readFileSync(markerFile, 'utf8'));
  assert.strictEqual(marker.libraryVersion, '2026.10.1');
  assert.strictEqual(marker.sha256, info.expectedSha256);

  result = library.ensure();
  assert.strictEqual(result.seeded, false, 'second ensure should be a no-op');
  assert.strictEqual(dbCounts(db).words, 4036);

  // 损坏文件必须拒绝导入，且不能清空已有数据。
  const badData = path.join(temp, 'bad.json.gz');
  const bytes = fs.readFileSync(dataFile);
  bytes[Math.floor(bytes.length / 2)] ^= 0xff;
  fs.writeFileSync(badData, bytes);
  const badLib = makeLibrary({ dataFile: badData, markerFile: path.join(temp, 'bad-marker.json') });
  const badInfo = badLib.getInfo();
  assert.strictEqual(badInfo.ok, false);
  assert.match(badInfo.error, /校验失败/);
  db.exec("DELETE FROM objects WHERE store = 'words'");
  fs.rmSync(path.join(temp, 'bad-marker.json'), { force: true });
  result = badLib.ensure();
  assert.strictEqual(result.ok, false);
  assert.strictEqual(dbCounts(db).words, 0, 'corrupt library must not seed');

  // 用户主动清空后，即使有旧 marker 也不自动灌入；force 才恢复。
  fs.writeFileSync(markerFile, JSON.stringify({ schemaVersion: 3 }), 'utf8');
  result = library.ensure();
  assert.strictEqual(result.seeded, false);
  assert.strictEqual(dbCounts(db).words, 0);
  result = library.ensure(true);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.seeded, true);
  assert.strictEqual(dbCounts(db).words, 4036);

  const hash = crypto.createHash('sha256').update(fs.readFileSync(dataFile)).digest('hex');
  assert.strictEqual(hash, info.expectedSha256);
  console.log('test-builtin-library: PASS', JSON.stringify({
    version: info.libraryVersion,
    words: info.wordCount,
    senses: info.senseCount,
    sha256: info.expectedSha256,
  }));
} finally {
  try { db.close(); } catch { /* ignore */ }
  fs.rmSync(temp, { recursive: true, force: true });
}
