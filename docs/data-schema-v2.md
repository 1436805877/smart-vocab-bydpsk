# 单词数据 Schema v2（草案）

0.1 开始支持，但只有 `core` / `morphology` / `etymology` / `senses[].coreLink` 会在详情页展示。
`rootFamilies`、`synonymGroups`、`confusionPairs` 是 0.2 的目标，当前版本可先保留在 JSON 中，导入时会原样保留在单词对象之外的位置前先不落库。

## 设计原则

1. 中文释义不是主字段，`core.feeling` 才是。
2. 每个义项都要能回答“它如何从核心感觉延伸出来”，即 `core.chain[].bridge` / `sense.coreLink`。
3. 词根与词源单独成结构，不塞进一条自由文本。
4. 近义辨析用「维度 + 例句 + 差异」表达，不用逗号分隔的近义词字符串。
5. 允许缺失：没有可靠词根的单词标记为空，不强行编造。

## 单词对象

```json
{
  "id": 30011,
  "word": "profound",
  "phonetic": "/prəˈfaʊnd/",
  "core": {
    "feeling": "从表面一直向下探到底，深到根基",
    "image": "钻头穿过土层，直到井底",
    "keywords": ["深", "彻底", "根基", "深远"],
    "antonym": "superficial",
    "chain": [
      {
        "stage": "本义",
        "label": "物理上的深",
        "bridge": "空间上从表面到底部",
        "senseId": 300111
      }
    ]
  },
  "morphology": {
    "parts": [
      { "type": "prefix", "form": "pro-", "meaning": "向前" },
      { "type": "root", "form": "fund", "meaning": "底部", "origin": "Latin fundus" }
    ],
    "literal": "向前到底部",
    "rootFamilyId": "fund"
  },
  "etymology": {
    "type": "scholarly",
    "path": [
      { "form": "fundus", "language": "Latin", "meaning": "底部" },
      { "form": "profundus", "language": "Latin", "meaning": "深的" },
      { "form": "profound", "language": "English", "meaning": "深刻的" }
    ],
    "story": "拉丁语 profundus = pro + fundus，本义“向前到底”。",
    "confidence": "high"
  },
  "synonymGroupIds": ["depth-intensity"],
  "confusableWith": [
    { "word": "superficial", "dimension": "反义/深度" }
  ],
  "senses": [
    {
      "id": 300111,
      "order": 1,
      "isCore": true,
      "stage": "本义",
      "coreLink": "核心感觉的直接体现：从表面向下到底",
      "defZh": "深刻的；深远的",
      "defEn": "very great or intense; far-reaching",
      "example": "The industrial revolution had a profound impact on social structures.",
      "exampleZh": "工业革命对社会结构产生了深远影响。",
      "collocations": ["profound impact", "profound effect"],
      "synonyms": ["deep", "far-reaching"],
      "antonyms": ["superficial"],
      "pos": "adj.",
      "topic": "society",
      "register": "formal",
      "notes": ["写作高频词"]
    }
  ],
  "legacyNotes": ["迁移期保留旧版 8 条笔记"],
  "meta": { "structuredAt": "2026-10-19", "contentVersion": 2 }
}
```

## 共享库（0.2）

### rootFamilies

```json
{
  "id": "fund",
  "root": "fund/found",
  "meaning": "底部、基础",
  "origin": "Latin fundus",
  "members": [
    { "word": "profound", "derivation": "pro + fund", "meaning": "深刻的" },
    { "word": "foundation", "derivation": "fund + ation", "meaning": "基础" }
  ],
  "mnemonic": "fund 是底部：打到底就是基础，向前到底就是深刻"
}
```

### synonymGroups

```json
{
  "id": "depth-intensity",
  "name": "深度与强度",
  "dimensions": ["强度", "语体", "搭配"],
  "members": [
    {
      "word": "profound",
      "strength": 5,
      "register": "formal",
      "collocations": ["profound impact"],
      "nuance": "强调影响/思想深远"
    },
    {
      "word": "deep",
      "strength": 3,
      "register": "neutral",
      "collocations": ["deep water"],
      "nuance": "物理/情感深度"
    }
  ],
  "contrasts": [
    {
      "a": "profound",
      "b": "deep",
      "dimension": "强度/语体",
      "difference": "profound 更正式、强调影响深远；deep 更通用"
    }
  ],
  "mnemonic": "影响深远用 profound，物理深度用 deep"
}
```

### confusionPairs

```json
{
  "a": "affect",
  "b": "effect",
  "dimension": "词性/拼写",
  "difference": "affect 是动词“影响”；effect 是名词“效果”",
  "examples": ["The weather affects my mood.", "The effect was immediate."]
}
```

## 迁移规则

- 旧版 `definition` / `example` / `synonyms` 等继续保留，`migrateWord()` 会合并成 `senses`。
- 旧版 `wordNotes` 原样保存到 `legacyNotes`。
- 新字段缺失时，详情页回退到旧字段和原始笔记。
- 0.1 导入 v2 JSON 时，单词对象的额外字段会随 `structuredClone` 一起保存；共享库的持久化在 0.2 实现。
