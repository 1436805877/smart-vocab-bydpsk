# 旧数据转换：v1 → v2

> 目标：把旧版 `{ words, categories }` 导出无损迁移到 0.1 的 v2 结构，同时从已有的 8 条 `wordNotes` 里尽量提取「核心感觉 / 逻辑链 / 词源 / 同根词 / 近义组」。

## 1. 先备份

在做任何转换之前：

1. 打开旧版单词本（v2.3.1 或 0.1）；
2. 点「导出」→ **JSON**；
3. 把 JSON 复制到一个安全位置；
4. 再运行转换脚本。

转换脚本不会修改输入文件。

## 2. 输入格式

旧版导出的 JSON 大致是：

```json
{
  "version": "1.0",
  "exportedAt": "...",
  "wordCount": 20,
  "categoryCount": 2,
  "words": [
    {
      "id": 30306,
      "word": "disgust",
      "phonetic": "/dɪsˈɡʌst/",
      "wordNotes": ["📖 ...", "🔥 ...", "⚔️ ...", "..."],
      "senses": [{ "id": 303061, "definition": "...", "example": "..." }],
      "mastery": "learning",
      "addedDate": 1725696000000,
      "lastReviewDate": 1725696000000,
      "deleted": false
    }
  ],
  "categories": []
}
```

`categories` 会被忽略（0.1 已移除所属分类）。

## 3. 运行转换

在仓库根目录：

```bash
node scripts/convert-v1-to-v2.mjs 旧数据.json 新数据.v2.json
```

不写第二个参数时，默认输出 `旧数据.v2.json`。

脚本会输出一份报告：

```json
{
  "sourceWordCount": 20,
  "convertedWordCount": 20,
  "coreExtracted": 20,
  "chainExtracted": 20,
  "etymologyExtracted": 20,
  "morphologyExtracted": 5,
  "rootFamilies": 5,
  "synonymGroups": 20,
  "skipped": 0
}
```

## 4. 转换做了什么

### 保留

- `word`、`phonetic`、`senses`、`mastery`、`addedDate`、`lastReviewDate`、`deleted`
- 所有旧 `wordNotes`（原样保留，仍然可以在详情页阅读）
- 每个 sense 的旧字段（definition、example、synonyms、collocations、pitfall、tags、notes）

### 新增

- `core.feeling`：从第 1 条笔记的「核心感觉：」提取
- `core.chain`：从第 1 条笔记最后一个「逻辑链：」提取，按 `→` 拆分，并尝试映射到义项
- `etymology.story`：第 2 条笔记去掉标题后的词源说明
- `morphology.parts`：只从「由 A（x）+ B（y）构成」这类明确句子里提取
- `morphology.literal`：从「本义“...”」提取
- `rootFamilies`：从第 2 条笔记的「同根词家族」提取成员，按词根合并
- `synonymGroups`：从第 3 条笔记的「Word（nuance）」提取，生成每个词自己的近义辨析组
- `senses[].coreLink`：尝试用逻辑链节点回填
- `meta`：`sourceFormat: "v1"`、`converter`、`quality: "heuristic"`

### 不保证

- 不是每个词都能抽出词根；没有「由……构成」的就不硬编。
- 近义组目前是**按词生成**的，方便单词组卷；全量词库后续需要按共享成员合并去重。
- 词源类型标记为 `legacy`，没有区分“学术词源”和“记忆联想”；AI 重构时再标注 `scholarly` / `mnemonic`。
- 抽不出的 `core.image`、`core.keywords`、`core.chain[].bridge` 会留空，不编造。

## 5. 导入 0.1

1. 打开 `智能单词本-0.1/index.html`；
2. 点「导入」，选择 `新数据.v2.json`；
3. 如果当前已有同名单词，会弹出冲突处理；
4. 导入后抽查：
   - 详情页是否显示「核心感觉」「词根与词源」；
   - 「核心回忆」是否能显示内容；
   - 搜索、导出是否正常；
5. 确认无误后再清理旧数据。

## 6. 推荐的三阶段转换

### 阶段 A：无损迁移（先做）

- 直接运行脚本；
- 所有旧词、旧笔记、旧义项都保留；
- 新字段能抽多少算多少；
- 这一步用于“先让 0.1 能读到全部旧数据”。

### 阶段 B：规则补全（脚本迭代）

- 继续完善 `wordNotes` 的解析规则；
- 增加更多模式（例如“核心画面”“关键词”“易混词对”）；
- 适合批量、低成本、可重复。

### 阶段 C：AI 重构（质量提升）

- 每批 20–50 个词；
- 把该词的 `wordNotes`、`senses`、`phonetic` 一起交给 AI；
- 要求按 v2 schema 输出 `core`、`morphology`、`etymology`、`senses[].coreLink`、`rootFamily`、`synonymGroup`；
- 关键约束：
  - 不许丢掉原笔记中的信息；
  - 词源必须标 `scholarly` 或 `mnemonic`，不确定就标 `confidence: low`；
  - 近义辨析必须有“维度 + 例句 + 差异”，不能只写“意思相近”；
  - 输出必须是纯 JSON，并带 `schemaVersion: 2`；
- 脚本校验字段完整性，再合并到主数据；
- 人工抽检 10% 左右，重点看词源真实性和近义差异。

## 7. 全量 4036 词的建议顺序

1. 先转换 20 个词，导入 0.1，人工看一遍详情页；
2. 调整脚本/AI prompt；
3. 每批 50 个词转换、校验、抽检；
4. 合并 `rootFamilies` / `synonymGroups`；
5. 全部导入后导出一次 v2 JSON 作为基线备份；
6. 再开始做 SRS 和每日队列。

## 8. 数据安全

- 转换脚本只读输入、写新文件，不覆盖旧 JSON。
- 导入前先导出 0.1 当前数据。
- 大批量导入前，先在 0.1 里用 20 个词试一遍。
- 个人词库导出文件不要提交到 GitHub；仓库 `.gitignore` 已忽略 `单词本备份_*.json` 等导出文件。
