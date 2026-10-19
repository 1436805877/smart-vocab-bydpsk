#!/usr/bin/env node
/**
 * v1 单词数据 → v2 结构（启发式转换）
 *
 * 用法：
 *   node scripts/convert-v1-to-v2.mjs <input.json> [output.json]
 *
 * 输入：旧版导出的 { words: [...] }（可带 categories，转换时忽略）
 * 输出：{ schemaVersion: 2, words, rootFamilies, synonymGroups, confusionPairs, conversion }
 *
 * 设计原则：
 * - 不丢旧内容：wordNotes 原样保留；旧 senses 字段全部保留。
 * - 只提取明确写出来的内容；抽不到就留空，不编造。
 * - 这是一个“可用的初稿”，高质量词根/近义数据仍建议后续 AI 重构 + 人工抽检。
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (!args[0]) {
  console.error('用法: node scripts/convert-v1-to-v2.mjs <input.json> [output.json]');
  process.exit(1);
}
const inputPath = path.resolve(args[0]);
const outputPath = path.resolve(args[1] || inputPath.replace(/\.json$/i, '') + '.v2.json');
const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const words = Array.isArray(raw.words) ? raw.words : [];
if (words.length === 0) {
  console.error('输入文件没有 words 数组或为空');
  process.exit(1);
}

const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clean = (s) => String(s || '').replace(/\r/g, '').trim();
const findNote = (notes, marker) => (notes || []).find(n => String(n).includes(marker)) || '';
const stripTitle = (text) => {
  const s = clean(text);
  const i = s.search(/[：:]/);
  return i >= 0 ? s.slice(i + 1).trim() : s;
};

function extractCore(notes) {
  const note = findNote(notes, '📖');
  const core = { feeling: '', image: '', keywords: [], chain: [] };
  if (!note) return core;

  const feeling = note.match(/核心感觉[：:]\s*([^。\n]+)/);
  if (feeling) core.feeling = clean(feeling[1]).replace(/^[“"']|[”"']$/g, '').replace(/[。；;]$/, '');

  const image = note.match(/(?:核心画面|画面)[：:]\s*([^。\n]+)/);
  if (image) core.image = clean(image[1]);

  const keywords = note.match(/关键词[：:]\s*([^。\n]+)/);
  if (keywords) core.keywords = clean(keywords[1]).split(/[、,，/]/).map(s => s.trim()).filter(Boolean);

  // 注意：标题里也可能出现“逻辑链：”，取最后一个冒号后的内容，避免抓到标题
  const chainIdx = Math.max(note.lastIndexOf('逻辑链：'), note.lastIndexOf('逻辑链:'));
  if (chainIdx >= 0) {
    const after = note.slice(chainIdx + 4).split(/\n/)[0];
    const parts = clean(after).replace(/[。；;]$/, '').split(/→|->/).map(s => s.trim()).filter(Boolean);
    core.chain = parts.map((label, i) => ({
      stage: i === 0 ? '本义' : '引申',
      label: label.replace(/[。；;]$/, ''),
      bridge: '',
    }));
  }
  return core;
}

function extractMorphology(notes) {
  const note = findNote(notes, '🔥');
  const result = { parts: [], literal: '', rootFamilyId: null };
  if (!note) return result;

  const text = stripTitle(note);
  const literal = text.match(/本义(?:为)?[：:\s]*[“"]([^”"]+)[”"]/) ||
    text.match(/本义(?:为)?[：:]\s*([^，。\n]+)/) ||
    text.match(/路径[：:]\s*[“"]([^”"]+)[”"]/);
  if (literal) result.literal = clean(literal[1]);

  // 优先只从“由 A（x）+ B（y）构成”里取词素，避免把词源语言词误当词根
  const composition = text.match(/由\s*([^。\n]+?)\s*构成/);
  if (composition) {
    const partRe = /([A-Za-z][A-Za-z-]{1,})\s*[（(]([^）)]{1,40})[）)]/g;
    let m;
    while ((m = partRe.exec(composition[1])) && result.parts.length < 8) {
      result.parts.push({
        type: m[1].endsWith('-') ? 'prefix' : 'root',
        form: m[1],
        meaning: clean(m[2]),
      });
    }
  }
  return result;
}

function extractRootFamily(notes, morphology) {
  const note = findNote(notes, '🔥');
  if (!note || morphology.parts.length === 0) return null;
  const text = stripTitle(note);
  const blockMatch = text.match(/同根词家族[：:]\s*([\s\S]*)$/);
  if (!blockMatch) return null;
  const block = blockMatch[1];
  const members = [];
  const seen = new Set();
  const memberRe = /([A-Za-z][A-Za-z-]{1,})\s*[（(]([^）)]{1,60})[）)]/g;
  let m;
  while ((m = memberRe.exec(block)) && members.length < 20) {
    const word = m[1];
    if (seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    members.push({ word, meaning: clean(m[2]) });
  }
  if (members.length === 0) return null;
  const root = morphology.parts.find(p => /fund|gust|cap|duc|spec|port|tract/i.test(p.form)) || morphology.parts[0];
  return {
    id: 'root-' + slug(root.form),
    root: root.form,
    meaning: root.meaning,
    origin: '',
    members,
    mnemonic: '',
  };
}

function extractSynonymGroup(notes, word) {
  const note = findNote(notes, '⚔️');
  if (!note) return null;
  const text = stripTitle(note);
  const members = [];
  const seen = new Set();
  // 兼容两种排版：每行一个词，或 "Word（...）| Word（...）" 一行
  const memberRe = /([A-Za-z][A-Za-z' -]{1,40})\s*[（(]([^）)]{1,120})[）)]/g;
  let m;
  while ((m = memberRe.exec(text)) && members.length < 12) {
    const w = m[1].trim();
    if (seen.has(w.toLowerCase())) continue;
    seen.add(w.toLowerCase());
    members.push({ word: w, nuance: clean(m[2]) });
  }
  if (members.length === 0) return null;
  const mnemonic = text.match(/口诀[：:]\s*([^\n]+)/);
  return {
    id: 'syn-' + slug(word),
    name: `${word} 近义辨析`,
    dimensions: ['强度', '语体', '搭配'],
    members,
    contrasts: [],
    mnemonic: mnemonic ? clean(mnemonic[1]) : '',
  };
}

const rootFamilies = new Map();
const synonymGroups = [];
const converted = [];
const report = {
  sourceWordCount: words.length,
  convertedWordCount: 0,
  coreExtracted: 0,
  chainExtracted: 0,
  etymologyExtracted: 0,
  morphologyExtracted: 0,
  rootFamilies: 0,
  synonymGroups: 0,
  skipped: 0,
};

for (const old of words) {
  if (!old || typeof old.word !== 'string' || !old.word.trim()) {
    report.skipped++;
    continue;
  }
  const notes = Array.isArray(old.wordNotes) ? old.wordNotes : [];
  const core = extractCore(notes);
  const morphology = extractMorphology(notes);
  const etymologyNote = findNote(notes, '🔥');
  const etymology = etymologyNote ? {
    type: 'legacy',
    path: [],
    story: stripTitle(etymologyNote).split(/\n\s*🧬/)[0].trim(),
    confidence: 'medium',
  } : { type: 'legacy', path: [], story: '', confidence: 'low' };

  const senses = (Array.isArray(old.senses) ? old.senses : []).map((s, i) => ({
    ...s,
    order: i + 1,
    isCore: i === 0,
    stage: i === 0 ? '本义' : '引申',
    coreLink: core.chain[i] ? core.chain[i].label : '',
    defZh: s.definition || '',
    defEn: s.defEn || '',
    register: s.register || s.formality || '',
    notes: Array.isArray(s.notes) ? s.notes : (s.note ? [s.note] : ['']),
  }));
  core.chain.forEach((node, i) => {
    if (senses[i]) node.senseId = senses[i].id;
  });

  let rootFamily = extractRootFamily(notes, morphology);
  if (rootFamily) {
    if (rootFamilies.has(rootFamily.id)) {
      const existing = rootFamilies.get(rootFamily.id);
      rootFamily.members.forEach(m => {
        if (!existing.members.some(x => String(x.word).toLowerCase() === String(m.word).toLowerCase())) {
          existing.members.push(m);
        }
      });
    } else {
      rootFamilies.set(rootFamily.id, rootFamily);
    }
    morphology.rootFamilyId = rootFamily.id;
  }

  const synGroup = extractSynonymGroup(notes, old.word);
  if (synGroup) synonymGroups.push(synGroup);

  const word = {
    ...old,
    word: old.word.trim(),
    senses,
    core,
    morphology,
    etymology,
    synonymGroupIds: synGroup ? [synGroup.id] : (old.synonymGroupIds || []),
    confusableWith: old.confusableWith || [],
    wordNotes: notes,
    meta: {
      convertedAt: new Date().toISOString(),
      sourceFormat: 'v1',
      converter: 'convert-v1-to-v2.mjs',
      quality: 'heuristic',
    },
  };
  delete word.definition;
  delete word.example;
  delete word.aiText;

  converted.push(word);
  report.convertedWordCount++;
  if (core.feeling) report.coreExtracted++;
  if (core.chain.length) report.chainExtracted++;
  if (etymology.story) report.etymologyExtracted++;
  if (morphology.parts.length) report.morphologyExtracted++;
}

report.rootFamilies = rootFamilies.size;
report.synonymGroups = synonymGroups.length;

const output = {
  app: '智能单词本',
  appVersion: '0.1',
  schemaVersion: 2,
  exportedAt: new Date().toISOString(),
  source: {
    format: 'v1',
    file: path.basename(inputPath),
    wordCount: words.length,
    categoriesDropped: Array.isArray(raw.categories) ? raw.categories.length : 0,
  },
  wordCount: converted.length,
  words: converted,
  rootFamilies: [...rootFamilies.values()],
  synonymGroups,
  confusionPairs: [],
  conversion: report,
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`✅ 转换完成: ${outputPath}`);
console.log(JSON.stringify(report, null, 2));
console.log('提示：这是启发式初稿；建议再用 AI 按 v2 schema 重构缺失字段，并人工抽检词源/近义辨析。');
