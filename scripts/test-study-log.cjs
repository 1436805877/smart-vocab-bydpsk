#!/usr/bin/env node
/* 0.5.5 学习记录 / 筛选回归：直接从 index.html 抽取真实方法执行。 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

function extract(name) {
    const marker = `\n            ${name}(`;
    const start = script.indexOf(marker);
    if (start < 0) throw new Error(`找不到方法 ${name}`);
    const bodyStart = start + marker.length - 1;
    const end = script.indexOf('\n            },', bodyStart);
    if (end < 0) throw new Error(`找不到方法 ${name} 的结尾`);
    return script.slice(start + 1, end + 14);
}

const names = [
    'localDateKey', 'sanitizeStudyLog', 'recordStudyActivity', 'getStudyStreak',
    'wordHasProgress', 'wordHasWrong', 'wordHasCulture', 'listFilterName',
    'matchListFilter', 'getFilteredWords', 'renderStats'
];
const methods = names.map(extract).join(',\n');
const factory = new Function(`return ({ ${methods},
    senseKey(w, s) { return w + ':' + s; },
    deckKey(d, w) { return d + ':' + w; },
    getDisplayWords() { return this.words || []; },
    searchIndex: { search() { return null; } },
    currentMode: 'dictionary',
    escapeHtml(v) { return String(v); }
});`);

const App = factory();
App.words = [];
App.decks = [];
App.deckWords = new Set();
App.progress = new Map();
App.studyLog = {};
App.activeDeckId = 'all';
App.listFilter = 'all';
App.searchQuery = '';
App._filterCache = null;
App._displayCache = null;
App._statsCache = { key: 'x', html: 'x' };
let saved = 0;
App.scheduleSettingsSave = () => { saved += 1; };
App.saveSettings = () => { saved += 1; };

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

const clean = App.sanitizeStudyLog({
    '2026-10-27': { reviews: '3', correct: 2, newSenses: 1, byDeck: { all: '3', d1: 2 } },
    bad: { reviews: 9 },
    '2026-10-26': { reviews: -1, byDeck: { all: -2, d1: 1 } }
});
assert(clean['2026-10-27'].reviews === 3, 'reviews 解析');
assert(clean['2026-10-27'].correct === 2, 'correct 解析');
assert(clean['2026-10-27'].byDeck.d1 === 2, 'byDeck 解析');
assert(!clean.bad, '非法日期丢弃');
assert(clean['2026-10-26'].reviews === 0 && !clean['2026-10-26'].byDeck.all, '负数归零');

const now = Date.now();
const today = App.localDateKey(now);
const yesterday = App.localDateKey(now - 86400000);
App.studyLog = {
    [today]: { reviews: 2, correct: 2, newSenses: 1, byDeck: { all: 2 } },
    [yesterday]: { reviews: 3, correct: 2, newSenses: 0, byDeck: { all: 3 } }
};
assert(App.getStudyStreak() === 2, '连续天数');

App.studyLog = {};
App.words = [{ id: 1, word: 'alpha', senses: [{ id: 11 }], mastery: 'learning' }];
App.decks = [{ id: 'd1', name: '核心' }];
App.deckWords = new Set(['d1:1', 'all:1']);
App.activeDeckId = 'd1';
App.recordStudyActivity(true, true, App.words[0]);
const log = App.studyLog[today];
assert(log && log.reviews === 1 && log.correct === 1 && log.newSenses === 1, '学习记录基础字段');
assert(log.byDeck.d1 === 1, '累计具体词库');
App.studyLog = {};
App.activeDeckId = 'all';
App.recordStudyActivity(false, false, App.words[0]);
assert(App.studyLog[today].byDeck.all === 1 && App.studyLog[today].byDeck.d1 === 1, '全部词库计入全部与具体词库');
assert(App._statsCache === null, '记录后清统计缓存');
assert(saved >= 1, '触发设置保存');

App.progress.set('1:11', { key: '1:11', wrongActive: true });
App.listFilter = 'wrong';
assert(App.matchListFilter(App.words[0]), '错题筛选');
App.listFilter = 'learning';
assert(App.matchListFilter(App.words[0]), '学习中筛选（掌握度）');
App.listFilter = 'unlearned';
App.words[0].mastery = 'unknown';
App.progress.clear();
assert(App.matchListFilter(App.words[0]), '未学筛选');
App.words[0].mastery = 'mastered';
assert(!App.matchListFilter(App.words[0]), '已掌握不算未学');

App.listFilter = 'all';
App.searchQuery = 'alpha';
App.searchIndex = { search: q => (q === 'alpha' ? new Set([1]) : new Set()) };
const filtered = App.getFilteredWords();
assert(filtered.length === 1 && filtered[0].id === 1, '搜索过滤');

// 仪表盘：用真实 renderStats 生成一次 HTML，检查关键区块与“未定义”泄漏。
App.words = [{ id: 1, word: 'alpha', senses: [{ id: 11 }], mastery: 'learning', reviewCount: 2, correctCount: 1, core: { feeling: '核心', quality: 'ok' } }];
App.decks = [{ id: 'd1', name: '核心词库', readOnly: true }];
App.deckWords = new Set(['d1:1']);
App.activeDeckId = 'd1';
App.progress = new Map([['1:11', { key: '1:11', dueAt: now - 1000, wrongActive: false }]]);
App.studyLog = { [today]: { reviews: 1, correct: 1, newSenses: 0, byDeck: { d1: 1 } } };
App.extras = { synonymGroups: [], rootFamilies: [] };
App.wordInActiveDeck = w => App.deckWords.has('d1:' + w.id);
App.bindDashboardActions = () => {};
App.dataRevision = 2;
App._statsCache = null;
App.escapeHtml = v => String(v);
const container = { innerHTML: '' };
App.renderStats(container);
assert(container.innerHTML.includes('学习仪表盘'), '仪表盘标题');
assert(container.innerHTML.includes('核心词库'), '当前词库卡');
assert(container.innerHTML.includes('今日复习'), '今日指标');
assert(/近7天 1 次/.test(container.innerHTML), '词库近7天统计');
assert(!container.innerHTML.includes('undefined'), '无 undefined 泄漏');

console.log('PASS study-log/filter/dashboard regression');
