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

## Windows 桌面版

0.1 已加入 Electron 桌面壳：

```bash
npm install
npm start        # 开发运行
npm run dist     # 生成 Windows 安装包 + 便携版
```

详细说明见 [docs/desktop.md](docs/desktop.md)。如果本机无法下载 Electron，可在 GitHub Actions 里手动运行 **Build Windows app**，从 Artifacts 下载安装包。

Release 页面（安装包构建完成后）：

https://github.com/1436805877/smart-vocab-bydpsk/releases

本机已生成免安装便携版：

```text
release/SmartVocab-0.1.0-portable.zip
```

解压后双击 `SmartVocab.exe` 即可运行。首次启动会使用独立的桌面数据目录，需要把网页版导出的 JSON 导入一次。

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

旧版 v1 数据转换见 [docs/data-conversion.md](docs/data-conversion.md)，脚本：

```bash
node scripts/convert-v1-to-v2.mjs 旧数据.json 新数据.v2.json
```

## 路线图

完整的应用化规划见 [docs/app-roadmap.md](docs/app-roadmap.md)。

- `0.1.x`：数据层与详情页、导入导出、基础清理。
- `0.2`：词根库、近义场、核心回忆/词根拆解/义项链/近义辨析、义项级 SRS、每日队列、错题本。
- `0.3`：数据层抽象、SQLite、自动备份与迁移。
- `0.4`：PWA，可安装到 Windows/手机。
- `0.5`：Electron 桌面版，Windows 安装包与自动更新。
- `1.0`：稳定数据迁移、签名、备份恢复。

## GitHub / Pages

仓库：[1436805877/smart-vocab-bydpsk](https://github.com/1436805877/smart-vocab-bydpsk)

在仓库 **Settings → Pages** 选择 `main` 分支根目录即可托管网页版：

```text
https://1436805877.github.io/smart-vocab-bydpsk/
```

本地仓库已配置专用 Deploy Key，当前可以直接 `git push` / `git pull`。

## 开发说明

- 单文件应用，无构建依赖。
- 主要逻辑在 `index.html` 的 `<script>` 中。
- 0.1 只做最小可用重构；旧版遗留的未使用 CSS 会在后续清理。
