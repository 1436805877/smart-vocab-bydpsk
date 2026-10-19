# 智能单词本导入格式（v3）

> 适用：AI 生成词库、第三方词库、手工整理词库。
> 机器校验：`docs/word-import.schema.json`
> AI 提示词：`docs/ai-word-generation-prompt.md`
> 可导入示例：`数据与资料/单词模板_示例.json`

## 1. 设计原则

1. **核心感觉不是释义**：核心感觉回答“这个词在脑子里是什么画面/动作”，不要再写一遍词典释义。
2. **中文准确、英文清楚**：`defZh` 用准确中文；`defEn` 用学习者能懂的英文解释，不是逐字翻译。
3. **义项先拆开**：不同词性、不同含义拆成独立 `senses`，不要用一长串分号糊在一起。
4. **不编造词源**：不确定的词根/词源留空，或标 `confidence: "low"`；不要写民间词源。
5. **文化/彩蛋必须有出处意识**：真实存在的历史、文学、影视、习语、词源梗才写；推测要标注。
6. **保持旧内容**：升级旧词时保留 `wordNotes`、原笔记、用户进度，不覆盖用户数据。
7. **稳定 ID**：同一批数据里 `word.id`、`sense.id` 唯一；升级时尽量沿用旧 ID。
8. **批量生成**：一次 20–50 个词，不要一次让 AI 输出 4036 个。

## 2. 顶层结构

```json
{
  "app": "智能单词本",
  "appVersion": "0.5.0",
  "schemaVersion": 3,
  "exportedAt": "2026-10-20T00:00:00.000Z",
  "wordCount": 3,
  "deck": {
    "id": "sample-ai-words",
    "name": "AI 高质量示例词库",
    "kind": "standard",
    "version": "1.0.0",
    "readOnly": true,
    "description": "演示核心感觉、词根、文化彩蛋的写法"
  },
  "decks": [
    {
      "id": "sample-ai-words",
      "name": "AI 高质量示例词库",
      "kind": "standard",
      "readOnly": true
    }
  ],
  "deckWords": [
    { "key": "sample-ai-words:9001", "deckId": "sample-ai-words", "wordId": 9001 }
  ],
  "words": [],
  "rootFamilies": [],
  "synonymGroups": [],
  "confusionPairs": [],
  "progress": []
}
```

- `deck`：这个词库的元信息。
- `decks` / `deckWords`：给当前 App 的导入器用；普通导入会按这些关系建词库。
- `words`：单词数组，核心。
- `rootFamilies` / `synonymGroups` / `confusionPairs`：共享库。
- `progress`：可选；AI 生成新词时留空。

## 3. 单词字段

```json
{
  "id": 9001,
  "word": "profound",
  "phonetic": "/prəˈfaʊnd/",
  "wordNotes": ["旧版/人工补充的全局笔记，可保留多段"],
  "core": {},
  "morphology": {},
  "etymology": {},
  "culture": {},
  "senses": [],
  "synonymGroupIds": ["syn-deep"],
  "mastery": "unknown",
  "addedDate": 1760000000000,
  "lastReviewDate": 1760000000000,
  "reviewCount": 0,
  "correctCount": 0,
  "deleted": false,
  "quality": "ai-enriched"
}
```

### core

```json
{
  "feeling": "从表面一路探到底",
  "image": "潜进一口深井，光越来越暗，底下还有空间",
  "keywords": ["depth", "beyond surface", "intense"],
  "chain": [
    { "label": "物理的深", "bridge": "向下到底", "senseId": 90011 },
    { "label": "抽象的深", "bridge": "深入本质", "senseId": 90012 },
    { "label": "强烈的程度", "bridge": "深到骨子里", "senseId": 90013 }
  ],
  "quality": "ok"
}
```

要求：

- `feeling` 1–60 字，必须是画面/动作/感觉，不能是“n. 深刻的”这种释义。
- `image` 具体、可想象，不要空泛。
- `keywords` 3–6 个，英文或中英混合都可。
- `chain` 用于多义词：`label` 是词义阶段，`bridge` 是从上一层到这一层的逻辑，`senseId` 必须指向真实义项。

### morphology / etymology

```json
"morphology": {
  "parts": [
    { "type": "prefix", "form": "pro-", "meaning": "向前", "origin": "Latin" },
    { "type": "root", "form": "fund", "meaning": "底部", "origin": "Latin fundus" }
  ],
  "literal": "向前到底部",
  "rootFamilyId": "fund"
},
"etymology": {
  "type": "latin",
  "path": [
    { "form": "pro-", "language": "Latin", "meaning": "forward" },
    { "form": "fundus", "language": "Latin", "meaning": "bottom" }
  ],
  "story": "pro- + fundus：一路向底部；由空间深度引申为程度、影响和洞察的深。",
  "confidence": "high"
}
```

- `parts[].type`：`prefix` / `root` / `suffix` / `infix` / `combining`。
- 只写确实能拆的部分；`profound` 不要硬拆成 `pro + found`。
- `confidence`：`high` / `medium` / `low`。

### culture

```json
"culture": {
  "background": "profound 来自拉丁 pro- + fundus；fundus 与 foundation/fundamental 同源。",
  "usage": "正式/书面语；日常‘很深’多用 deep，profound 更常修饰影响、意义、沉默、变化。",
  "easterEggs": [
    "医学里 profound deafness 指极重度耳聋，不是‘深刻的耳聋’。",
    "profound 和 deep 并非总能互换：profound knowledge 可以，profound hole 很怪。"
  ]
}
```

- `background`：历史/文化/词源背景。
- `usage`：语用、语体、常见误用。
- `easterEggs`：真实有趣的彩蛋、双关、影视/文学/历史梗；不要编造。
- 没有内容就留空对象，不要硬凑。

## 4. 义项字段

```json
{
  "id": 90011,
  "definition": "adj. 深的；深处的",
  "defZh": "adj. 深的；深处的",
  "defEn": "Very deep physically; extending far down.",
  "example": "The submarine sank into profound waters.",
  "exampleZh": "潜艇沉入深水。",
  "pos": "adj.",
  "level": "CET-6",
  "topic": "space",
  "tone": "neutral",
  "origin": "Latin",
  "formality": "formal",
  "grammar": "adj.",
  "synonyms": "deep",
  "collocations": "profound depths",
  "pitfall": "物理深度日常更常用 deep；profound 更书面、更抽象。",
  "coreLink": "物理的深",
  "notes": ["旧版笔记可保留在这里"]
}
```

要求：

- `definition` 是合并展示用，建议等于 `defZh` + `defEn` 的简洁合并。
- `defZh` 中文准确，不要夹英文释义。
- `defEn` 英文解释要完整、自然，不能只写一个同义词。
- `example` 英文例句；`exampleZh` 对应中文翻译。
- `coreLink` 对应 `core.chain[].label`。
- 一个词有几个义项就写几个 sense，不要把所有词性塞进一个 `definition`。

## 5. 共享库

### rootFamilies

```json
{
  "id": "fund",
  "root": "fund",
  "meaning": "底部",
  "origin": "Latin fundus",
  "members": [
    { "word": "profound", "meaning": "深的", "relation": "pro + fund" },
    { "word": "foundation", "meaning": "基础", "relation": "fund 底部 → 基础" }
  ],
  "mnemonic": "fund 的词根义是‘底’，不是‘基金’。"
}
```

### synonymGroups

```json
{
  "id": "syn-deep",
  "name": "deep / profound / abysmal",
  "dimensions": ["程度", "语体", "褒贬"],
  "members": [
    { "word": "deep", "nuance": "最通用，物理/抽象都可", "strength": "中", "register": "中性" },
    { "word": "profound", "nuance": "强调影响、洞察、程度深", "strength": "强", "register": "正式" },
    { "word": "abysmal", "nuance": "贬义，差到极点；也可指深渊", "strength": "极强", "register": "负面" }
  ],
  "contrasts": [
    { "a": "deep", "b": "profound", "dimension": "语体", "difference": "deep 日常；profound 正式/抽象。" }
  ],
  "mnemonic": "deep 是尺子，profound 是重量。"
}
```

### confusionPairs

```json
{
  "id": "cp-disaster-catastrophe",
  "a": "disaster",
  "b": "catastrophe",
  "dimension": "程度",
  "difference": "disaster 可大可小；catastrophe 更强调毁灭性、全局性。",
  "examples": ["The party was a disaster.", "The war was a catastrophe."]
}
```

## 6. 导入规则

- 普通导入：读取 `decks` / `deckWords`，按词库归属导入。
- 导入为新词库：忽略文件里的归属，全部进入一个新词库。
- 导入到已有词库：全部进入选定词库。
- 同名单词会进入冲突弹窗，可覆盖或跳过。
- 支持一次多个文件；AI 生成建议一次一个文件、20–50 词。
- 大文件（4036 词）导入前先备份。

## 7. 最小可接受版本 vs 高质量版本

**最小可接受**：

- 单词、至少一个义项、`definition` / `defZh`。
- 能导入、能显示中文释义。

**高质量（AI 生成目标）**：

- 核心感觉 + 画面 + 关键词 + 词义链；
- 每个义项中英文释义、例句、翻译、搭配、易错；
- 词根/词源（有把握才写）；
- 文化与彩蛋；
- 近义组/同根家族/易混词对；
- 旧笔记保留。

## 8. 校验清单

- [ ] `schemaVersion` 是 3。
- [ ] `words` 非空，`word` 不重复。
- [ ] 每个 word 至少一个 sense。
- [ ] 每个 sense 有 `definition` / `defZh` / `defEn` / `example` / `exampleZh`。
- [ ] `core.feeling` 不是释义、不超过 60 字。
- [ ] `chain[].senseId` 都能在 senses 里找到。
- [ ] `morphology.parts` 没有硬拆/民间词源。
- [ ] `rootFamilyId` 都能在 `rootFamilies` 里找到。
- [ ] `synonymGroupIds` 都能在 `synonymGroups` 里找到。
- [ ] 文化与彩蛋没有编造。
- [ ] JSON 能被 `docs/word-import.schema.json` 校验。
