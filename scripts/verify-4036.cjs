const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const dbPath = path.join(process.env.APPDATA, 'smart-vocab', 'wordbook.db');
const start = Date.now();
const db = new DatabaseSync(dbPath, { readOnly: true });
const stores = db.prepare("select store, count(*) as c from objects group by store").all();
const words = db.prepare("select json from objects where store='words'").all().map(r => JSON.parse(r.json));
const decks = db.prepare("select json from objects where store='decks'").all().map(r => JSON.parse(r.json));
const deckWords = db.prepare("select json from objects where store='deckWords'").all().map(r => JSON.parse(r.json));
const extras = db.prepare("select key, json from objects where store='extras'").all();
const readMs = Date.now() - start;
const searchStart = Date.now();
const q = 'profound';
const hits = words.filter(w => JSON.stringify(w).toLowerCase().includes(q)).length;
const searchMs = Date.now() - searchStart;
const target = decks[0];
const report = {
  checkedAt: new Date().toISOString(),
  dbPath,
  stores,
  words: words.length,
  decks: decks.length,
  deck: target ? { id: target.id, name: target.name, readOnly: target.readOnly } : null,
  deckWords: deckWords.length,
  deckWordIds: [...new Set(deckWords.map(x => String(x.deckId)))],
  extras: extras.map(x => x.key),
  readMs,
  searchMs,
  searchHits: hits,
  databaseSizeMB: Math.round(fs.statSync(dbPath).size / 1024 / 1024 * 100) / 100
};
db.close();
console.log(JSON.stringify(report, null, 2));
const out = path.join('数据与资料', '4036_实测报告_2026-10-21.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
console.log('report:', out);
