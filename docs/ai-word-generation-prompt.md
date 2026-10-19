# AI 单词生成提示词

> 目标：让其他 AI 直接产出**可导入智能单词本**的高质量词库。
> 配套格式：`docs/word-import-format.md`、`docs/word-import.schema.json`
> 示例：`数据与资料/单词模板_示例.json`

---

## 1. System Prompt（直接复制）

```text
你是一位资深双语词典编纂者、词源研究者和英语教师，服务对象是中文母语的英语学习者。
你的任务不是“翻译单词”，而是帮助学习者建立“核心感觉 + 词根演变 + 近义辨析”的深度理解。

必须遵守：
1. 只输出合法 JSON，不要 Markdown 代码围栏，不要解释，不要前后缀。
2. 严格遵循用户提供的 JSON Schema 和字段说明；缺字段用空字符串/空数组，不要省略结构。
3. 核心感觉（core.feeling）必须是画面、动作、感觉或意象，不能是词典释义，不能以词性开头，不超过 60 个汉字。
4. 中文释义要准确、简洁、符合中文词典习惯；英文解释要自然、学习者能懂，不能只给一个同义词。
5. 每个义项必须有英文例句和中文翻译；例句要自然、能体现该义项，不要编造不存在的搭配。
6. 词根/词源只在有把握时填写；不确定就留空或 confidence 标 low。禁止民间词源、禁止把拼写相似当成词源。
7. 近义组必须写清 nuance（细微差别）、strength（程度）、register（语体）和至少一条对比；不要只列同义词。
8. 文化与彩蛋必须是真实存在的历史、文学、影视、习语、词源梗或语用现象；不确定就不要写，禁止编造。
9. 保留用户提供的旧笔记、旧义项、旧 ID；升级时只补充/修正，不删除用户内容。
10. 一次只处理用户给出的单词列表，不要自行扩展；不要输出未要求的单词。
11. ID 必须唯一：word.id、sense.id 不能重复；chain[].senseId 必须指向本词真实义项。
12. 输出前自检：JSON 可解析、必填字段齐全、没有重复 ID、没有空核心感觉、没有把释义当核心感觉、没有假词源。
```

---

## 2. User Prompt 模板

```text
请为下面这批单词生成/升级智能单词本 v3 数据。

【词库信息】
- 词库名称：{DECK_NAME}
- 词库 ID：{DECK_ID}
- 词库类型：{user 或 standard}
- 版本：{VERSION}
- 来源/版权：{SOURCE}

【单词列表】
{WORD_LIST}

【已有旧数据（可选）】
{OLD_WORDS_JSON}

【生成要求】
- 输出一个 JSON 对象，顶层字段：app、appVersion、schemaVersion、exportedAt、wordCount、deck、decks、deckWords、words、rootFamilies、synonymGroups、confusionPairs、progress。
- app 固定为 "智能单词本"；schemaVersion 固定为 3；progress 输出空数组。
- 为每个单词建立至少一个 sense；多义词按词性/含义拆开。
- 每个 sense 必须有：
  definition（合并展示）、defZh（准确中文）、defEn（清楚英文解释）、
  example（自然英文例句）、exampleZh（中文翻译）、pos、level、collocations、pitfall、coreLink。
- core 必须有 feeling / image / keywords；多义词加 chain。
- 有把握时填 morphology / etymology；没有把握留空。
- 有真实文化/彩蛋时填 culture；没有就留空对象。
- 近义词有区分价值时建立 synonymGroups，并给 word.synonymGroupIds。
- 有同根家族时建立 rootFamilies，并给 word.morphology.rootFamilyId。
- 有易混词时建立 confusionPairs。
- 旧数据存在时：保留旧 wordNotes、旧 notes、旧 ID；不要删除用户内容；只在原字段上补充/修正。
- 输出 JSON 必须能通过 docs/word-import.schema.json。
- 不要输出 Markdown 围栏，不要输出解释文字。

【质量门槛】
1. core.feeling 不超过 60 字，不能是释义，不能以 n./v./adj. 开头。
2. defZh 不夹英文解释；defEn 不能只写一个同义词。
3. 例句和翻译必须一一对应；例句要能独立看懂。
4. 词源不确定时宁可留空，不要编。
5. 近义组至少 2 个成员，至少有 1 条 contrasts。
6. 文化与彩蛋没有可靠内容就留空。
7. 输出前检查：JSON 可解析、ID 唯一、chain.senseId 有效、rootFamilyId/synonymGroupIds 有效。
```

---

## 3. 批量策略

不要一次生成 4036 个词。建议：

- 每批 **20–50 个词**；
- 先跑 20 个做人工抽检；
- 通过后再扩到 50 个/批；
- 每批单独文件，例如 `cet6_batch_001.json`；
- 最后用脚本按 `word` 合并、去重、校验。

### 推荐批次顺序

1. 高频核心词（动词/形容词/抽象名词）；
2. 多义词（优先补 `core.chain`）；
3. 有明确词根的词（补 morphology/rootFamilies）；
4. 易混/近义词（补 synonymGroups/confusionPairs）；
5. 文化/彩蛋丰富的词（补 culture）。

---

## 4. 旧数据升级提示词

```text
下面是一批旧版单词数据。请在不删除旧内容的前提下，升级为智能单词本 v3：

- 保留 wordNotes、sense.notes、旧 ID、旧例句；
- 把混在 definition 里的中英文拆成 defZh / defEn；
- 如果旧 core.feeling 实际上是释义，移到 core.legacyFeeling，并把 feeling 改为真正的核心感觉；
- 补 exampleZh；
- 只补充有把握的词根/词源/近义/文化；
- 输出完整 v3 JSON，不要只输出 diff。
```

---

## 5. 单词语义质量示例

### 差的写法

```json
"core": { "feeling": "adj. 深刻的；深远的" }
```

问题：这是释义，不是核心感觉。

### 好的写法

```json
"core": {
  "feeling": "从表面一路探到底",
  "image": "潜进一口深井，光越来越暗，底下还有空间",
  "keywords": ["depth", "beyond surface", "intense"]
}
```

### 差的英文解释

```json
"defEn": "deep"
```

问题：只给同义词，没有解释。

### 好的英文解释

```json
"defEn": "Very deep physically, or having a far-reaching influence that goes far beyond the surface."
```

---

## 6. 输出前自检（让 AI 自己跑）

- [ ] JSON 能被解析。
- [ ] 顶层字段齐全。
- [ ] words 数量与给定列表一致。
- [ ] 每个 word.id 唯一。
- [ ] 每个 sense.id 唯一。
- [ ] 每个 sense 有 defZh / defEn / example / exampleZh。
- [ ] 没有 core.feeling 以词性开头。
- [ ] 没有 core.feeling 与 defZh 完全相同。
- [ ] chain.senseId 都能找到。
- [ ] rootFamilyId 都能找到。
- [ ] synonymGroupIds 都能找到。
- [ ] 没有假词源/假文化。
- [ ] 旧笔记没有丢失。
```
