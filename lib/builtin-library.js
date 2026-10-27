// 内置 CET-6 标准词库：读取随包携带的 gzip JSON，并在空库/演示词库时写入 SQLite。
// 独立成模块，便于不启动 Electron 也能做导入测试。
const crypto = require('node:crypto');
const fsSync = require('node:fs');
const zlib = require('node:zlib');

const DEMO_WORDS = new Set(['abide', 'reverse', 'tolerate', 'endure', 'obey', 'follow']);

function createBuiltinLibrary(options) {
  const {
    dataFile,
    manifestFile,
    markerFile,
    ensureStorageDirs,
    getAppDb,
    dbCounts,
    dbReadAll,
    dbImportAll,
    log = () => {},
  } = options;

  function readMarker() {
    try {
      if (!fsSync.existsSync(markerFile)) return null;
      return JSON.parse(fsSync.readFileSync(markerFile, 'utf8'));
    } catch {
      return null;
    }
  }

  function readManifest() {
    try {
      if (!manifestFile || !fsSync.existsSync(manifestFile)) return null;
      return JSON.parse(fsSync.readFileSync(manifestFile, 'utf8'));
    } catch {
      return null;
    }
  }

  function writeMarker(info) {
    ensureStorageDirs();
    fsSync.writeFileSync(markerFile, JSON.stringify({
      ...info,
      seededAt: new Date().toISOString(),
    }, null, 2), 'utf8');
  }

  function sha256File(file) {
    return crypto.createHash('sha256').update(fsSync.readFileSync(file)).digest('hex');
  }

  function verifyData() {
    const manifest = readManifest();
    if (!manifest) {
      return { ok: false, manifest: null, sha256: '', error: '内置词库清单缺失' };
    }
    if (typeof manifest.libraryVersion !== 'string' || !manifest.libraryVersion) {
      return { ok: false, manifest, sha256: '', error: '内置词库清单缺少版本号' };
    }
    if (!/^[a-f0-9]{64}$/i.test(String(manifest.sha256 || ''))) {
      return { ok: false, manifest, sha256: '', error: '内置词库清单缺少有效校验和' };
    }
    if (!fsSync.existsSync(dataFile)) {
      return { ok: false, manifest, sha256: '', error: '内置词库文件缺失：' + dataFile };
    }
    try {
      const actual = sha256File(dataFile);
      if (actual !== manifest.sha256.toLowerCase()) {
        return {
          ok: false,
          manifest,
          sha256: actual,
          error: '内置词库校验失败：文件与清单不一致',
        };
      }
      return { ok: true, manifest, sha256: actual, error: '' };
    } catch (error) {
      return { ok: false, manifest, sha256: '', error: error.message || String(error) };
    }
  }

  function libraryInfo(check, marker) {
    const manifest = check.manifest || {};
    return {
      ok: !!check.ok,
      verified: !!check.ok,
      libraryVersion: manifest.libraryVersion || '',
      schemaVersion: manifest.schemaVersion || 0,
      wordCount: manifest.wordCount || 0,
      senseCount: manifest.senseCount || 0,
      deckName: manifest.deckName || '',
      generatedAt: manifest.generatedAt || '',
      source: manifest.source || '',
      license: manifest.license || '',
      expectedSha256: manifest.sha256 || '',
      actualSha256: check.sha256 || '',
      marker: marker || null,
      error: check.error || '',
    };
  }

  function getInfo() {
    return libraryInfo(verifyData(), readMarker());
  }

  function loadData(check) {
    const verified = check || verifyData();
    if (!verified.ok) throw new Error(verified.error || '内置词库校验失败');
    const raw = zlib.gunzipSync(fsSync.readFileSync(dataFile));
    const data = JSON.parse(raw.toString('utf8'));
    if (!data || !Array.isArray(data.words) || data.words.length < 4000) {
      throw new Error('内置词库格式不正确');
    }
    const senseCount = data.words.reduce((sum, word) => sum + (Array.isArray(word.senses) ? word.senses.length : 0), 0);
    if (verified.manifest.wordCount && data.words.length !== verified.manifest.wordCount) {
      throw new Error(`内置词库词数不符：${data.words.length} / ${verified.manifest.wordCount}`);
    }
    if (verified.manifest.senseCount && senseCount !== verified.manifest.senseCount) {
      throw new Error(`内置词库义项数不符：${senseCount} / ${verified.manifest.senseCount}`);
    }
    if (!Array.isArray(data.deckWords) || data.deckWords.length === 0) {
      const deckId = data.decks?.[0]?.id || 'cet6-4036-full';
      data.deckWords = data.words.map(word => ({
        key: deckId + ':' + word.id,
        deckId,
        wordId: word.id,
      }));
    }
    return data;
  }

  function isDemoWordbook(words) {
    if (!Array.isArray(words) || words.length === 0 || words.length > DEMO_WORDS.size) return false;
    return words.every(word => DEMO_WORDS.has(String(word.word || '').toLowerCase()));
  }

  function ensure(force = false) {
    const check = verifyData();
    try {
      const db = getAppDb();
      const counts = dbCounts(db);
      let seed = false;
      if (counts.words === 0) {
        // 用户主动清空过词库时不再自动灌入；由空状态里的“恢复内置词库”触发。
        seed = !!force || !readMarker();
      } else if (!force && counts.words <= DEMO_WORDS.size) {
        seed = isDemoWordbook(dbReadAll(db, 'words'));
      }
      if (!seed) {
        return {
          ok: true,
          seeded: false,
          empty: counts.words === 0,
          wordCount: counts.words,
          library: libraryInfo(check, readMarker()),
        };
      }
      if (!check.ok) throw new Error(check.error);

      const data = loadData(check);
      dbImportAll(db, {
        words: data.words,
        extras: [
          { key: 'rootFamilies', value: Array.isArray(data.rootFamilies) ? data.rootFamilies : [] },
          { key: 'synonymGroups', value: Array.isArray(data.synonymGroups) ? data.synonymGroups : [] },
          { key: 'confusionPairs', value: Array.isArray(data.confusionPairs) ? data.confusionPairs : [] },
        ],
        progress: Array.isArray(data.progress) ? data.progress : [],
        decks: Array.isArray(data.decks) ? data.decks : [],
        deckWords: data.deckWords,
        backups: [],
      });
      const marker = {
        schemaVersion: data.schemaVersion || 3,
        dataVersion: data.appVersion || '',
        libraryVersion: check.manifest.libraryVersion,
        sha256: check.sha256,
        wordCount: data.words.length,
        senseCount: data.words.reduce((sum, word) => sum + (Array.isArray(word.senses) ? word.senses.length : 0), 0),
        deckName: data.decks?.[0]?.name || '',
        verified: true,
      };
      writeMarker(marker);
      log('builtin wordbook seeded', marker);
      return {
        ok: true,
        seeded: true,
        empty: false,
        wordCount: data.words.length,
        deckName: marker.deckName,
        library: libraryInfo(check, marker),
      };
    } catch (error) {
      log('builtin wordbook seed failed', error);
      return {
        ok: false,
        seeded: false,
        error: error.message || String(error),
        library: libraryInfo(check, readMarker()),
      };
    }
  }

  return { ensure, loadData, isDemoWordbook, readMarker, getInfo };
}

module.exports = { createBuiltinLibrary, DEMO_WORDS };
