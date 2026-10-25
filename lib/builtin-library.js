// 内置 CET-6 标准词库：读取随包携带的 gzip JSON，并在空库/演示词库时写入 SQLite。
// 独立成模块，便于不启动 Electron 也能做导入测试。
const fsSync = require('node:fs');
const zlib = require('node:zlib');

const DEMO_WORDS = new Set(['abide', 'reverse', 'tolerate', 'endure', 'obey', 'follow']);

function createBuiltinLibrary(options) {
  const {
    dataFile,
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

  function writeMarker(info) {
    ensureStorageDirs();
    fsSync.writeFileSync(markerFile, JSON.stringify({
      ...info,
      seededAt: new Date().toISOString(),
    }, null, 2), 'utf8');
  }

  function loadData() {
    if (!fsSync.existsSync(dataFile)) throw new Error('内置词库文件缺失：' + dataFile);
    const raw = zlib.gunzipSync(fsSync.readFileSync(dataFile));
    const data = JSON.parse(raw.toString('utf8'));
    if (!data || !Array.isArray(data.words) || data.words.length < 4000) {
      throw new Error('内置词库格式不正确');
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
        return { ok: true, seeded: false, empty: counts.words === 0, wordCount: counts.words };
      }

      const data = loadData();
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
        wordCount: data.words.length,
        deckName: data.decks?.[0]?.name || '',
      };
      writeMarker(marker);
      log('builtin wordbook seeded', marker);
      return { ok: true, seeded: true, empty: false, wordCount: data.words.length, deckName: marker.deckName };
    } catch (error) {
      log('builtin wordbook seed failed', error);
      return { ok: false, seeded: false, error: error.message || String(error) };
    }
  }

  return { ensure, loadData, isDemoWordbook, readMarker };
}

module.exports = { createBuiltinLibrary, DEMO_WORDS };
