# 智能单词本 0.1 beta

一个单文件、离线优先的单词学习应用，按「核心感觉 + 词根演变 + 近义辨析」组织单词，而不是把单词等同于一条中文翻译。

> 0.1 是重构测试版；在正式版之前不会使用 1.0 版本号。

## 运行

直接双击 `index.html`，或在本目录启动静态服务器：

```bash
python -m http.server 8080
# 打开 http://127.0.0.1:8080
```

数据保存在浏览器 IndexedDB（`SmartVocabDB_v9`）。换浏览器或清理缓存前，请先用「导出 → JSON」备份。

## 0.1 的范围

- 删除「所属分类」功能，减少旧版遗留的概念和数据。
- 复习模式从 8 个收缩到 6 个：翻卡牌、核心回忆、拼写挑战、单词射手、消消乐、创意造句。
- 删除重复度较高的单词接龙、限时挑战、单词迷宫。
- 顶部按钮改为单行排列；窄屏时横向滚动。
- 导出支持 JSON / CSV / Markdown / TXT。
- 导入支持一次选择多个 JSON / CSV / TXT 文件，并聚合冲突处理。
- 单词数据开始支持 v2 字段：`core`、`morphology`、`etymology`、`senses[].coreLink`。旧数据自动保留原文，详情页优先展示结构化内容。
- 新增「核心回忆」复习模式：看单词先回忆核心感觉，再揭示答案并自评。

## 数据格式

导出的 JSON 是 v2 备份格式：

```json
{
  "app": "智能单词本",
  "appVersion": "0.1",
  "schemaVersion": 2,
  "exportedAt": "2026-10-19T00:00:00.000Z",
  "wordCount": 1,
  "words": []
}
```

单词对象支持以下新增字段（均可选，缺失时回退到旧字段）：

- `core.feeling / image / keywords / chain[]`
- `morphology.parts[] / literal / rootFamilyId`
- `etymology.path[] / story / type / confidence`
- `senses[].coreLink / stage / isCore`

完整的示例见 `data/example-v2.json`，schema 说明见 `docs/data-schema-v2.md`。

## 路线图

- `0.1.x`：数据层与详情页、导入导出、基础清理。
- `0.2`：词根库、近义场、核心回忆/词根拆解/义项链/近义辨析等复习题型。
- `0.3`：义项级 SRS、每日队列、错题本。
- 后续：PWA / 手机端、备份、可选同步。

## GitHub Pages

本目录已经是一个本地 Git 仓库，`main` 分支上有初始提交。推送到 GitHub 后，在 **Settings → Pages** 选择 `main` 分支根目录即可，`index.html` 会被直接托管。

```bash
git remote add origin https://github.com/<你的账号>/<仓库名>.git
git push -u origin main
```

如果需要我继续在本地提交，只需保持这个目录不变；远端推送需要你先在本机完成 GitHub 登录（Git Credential Manager）或提供已配置好的远端地址。

## 开发说明

- 单文件应用，无构建依赖。
- 主要逻辑在 `index.html` 的 `<script>` 中。
- 0.1 只做最小可用重构；旧版遗留的未使用 CSS 会在后续清理。
