# 从网页版到应用软件：0.x → 1.0 路线图

> 目标：保留现在这套「核心感觉 + 词根演变 + 近义辨析」的学习方式，把单文件网页版逐步变成可安装、可备份、可更新的桌面/手机应用；不重写 UI，不把数据锁死在浏览器里。

## 1. 现状与约束

- 当前 0.1 是单个 `index.html`，无构建依赖。
- 数据存在浏览器 IndexedDB（`SmartVocabDB_v9`）。
- 已有 JSON / CSV / Markdown / TXT 导入导出。
- 已托管在 GitHub，可用 GitHub Pages 做网页版。
- 当前代码 5000 行左右，继续加功能会越来越难维护。

关键判断：

- **不要直接把现在的单文件塞进 Electron 就宣布完成。** 能跑，但数据仍在 WebView 的 IndexedDB 里，备份、迁移、同步都麻烦。
- **先做数据层，再做壳。** 应用软件的核心不是窗口，而是“数据存在哪里、怎么备份、怎么升级”。
- **不要现在用 Flutter / React Native 重写。** 现有 HTML/JS 是资产，重写成本远大于收益。

## 2. 可选的应用形态

| 方案 | 安装包体积 | 上手难度 | 手机 | 自动更新 | 适合场景 |
|---|---:|---|---|---|---|
| PWA | 0（浏览器安装） | 最低 | 支持 | 自动 | 先让电脑/手机都能“像 App 一样”打开 |
| Electron | 80–150 MB | 低 | 不支持（可配 Capacitor） | 成熟 | 最快拿到 Windows `.exe` |
| Tauri 2 | 5–15 MB | 中高（Rust + VS Build Tools） | Tauri 2 支持 | 成熟 | 长期产品、追求小体积 |
| Capacitor | 原生壳 + Web | 中 | iOS/Android | 插件 | 要上手机应用商店 |
| Flutter / RN | 原生 | 高 | 支持 | 成熟 | 完全重写，不建议现在做 |

### 我的建议

- **第一步：PWA。** 几天内就能在 Windows/Android 上“安装”成一个独立窗口，离线可用，更新即时，不用签名、不用装 Rust。
- **第二步：Electron 桌面版。** 对编程小白最友好：Node 已装，GitHub Actions 可以直接构建 `.exe`，自动更新成熟；缺点是体积大。
- **长期可选：Tauri。** 如果 1.0 后在意安装包大小/内存，再评估迁移；不要一开始就为此卡住。
- **手机：先 PWA。** 真要上架 App Store / Google Play，再用 Capacitor 包一层；iOS 需要 Mac 和 Apple 开发者账号。

## 3. 推荐阶段

### 0.2 学习内核（先做产品，不急着打包）

- 词根库、近义场、易混词对。
- 核心回忆 / 词根拆解 / 义项链 / 近义辨析。
- 义项级复习进度、每日队列、错题本。
- 这一步决定“这个 App 值不值得装”，优先级最高。

### 0.3 数据层与备份（打包前必须做）

- 把 `VocabDB` 抽成 `DataStore` 接口：
  - `IndexedDBStore`（Web/PWA）
  - `SQLiteStore`（桌面/手机）
  - `MemoryStore`（测试）
- 数据模型加 `schemaVersion`、`updatedAt`、`deletedAt`。
- 如果计划多设备同步，现在就把 ID 改成 UUID；否则以后迁移很痛。
- 自动备份：每天/每次退出前导出 JSON 或复制 SQLite；保留最近 7 份。
- 导入导出继续保留，作为跨设备迁移的“最小可用方案”。

### 0.4 PWA（最低成本的“应用化”）

- `manifest.webmanifest` + 192/512 图标 + `service worker`。
- Windows/Android 可“安装”，独立窗口、离线打开。
- GitHub Pages 自动部署。
- 仍用 IndexedDB；加“备份提醒”，避免清缓存丢数据。
- 这一步不解决“真正安装包”，但能让日常使用脱离浏览器标签页。

### 0.5 桌面版（Electron 优先）

- Electron 主进程加载构建后的静态文件。
- `preload` 暴露安全 API：文件选择、备份、导入、导出、打开数据目录。
- SQLite 存到 `%APPDATA%/SmartVocab/wordbook.db`。
- 首次启动：引导从网页版导出的 JSON 导入。
- Windows 安装包：NSIS `.exe`；便携版 `.zip`。
- 自动更新：GitHub Releases + `electron-updater`。
- 代码签名后补；未签名时 SmartScreen 会提示“更多信息 → 仍要运行”。
- GitHub Actions 在 `windows-latest` 上构建并上传 Release，不依赖你本机装打包工具。

### 0.6 手机版（按需）

- 先 PWA；需要应用商店时用 Capacitor。
- Android：Android Studio / GitHub Actions 出 APK。
- iOS：需要 Mac + Xcode + Apple 开发者账号（$99/年）。
- 手机 UI 需要单独适配：底部导航、全屏详情、触控友好的复习按钮。

### 1.0 稳定版

- 数据迁移经过多个版本验证。
- 自动备份/恢复可用。
- 安装包有签名、自动更新可用。
- 文档、隐私说明、许可证齐全。
- 此时再考虑云同步、账号体系、AI 功能。

## 4. 目标架构

```text
smart-vocab/
  src/
    core/          # schema、搜索、SRS、复习引擎（纯逻辑，可测试）
    data/          # DataStore 接口 + IndexedDB/SQLite 实现
    ui/            # 列表、详情、复习界面
    games/         # 各复习模式
    platform/      # 文件、备份、更新、通知
  apps/
    web/           # PWA
    desktop/       # Electron 或 Tauri
    mobile/        # Capacitor（按需）
  tests/
  docs/
```

原则：

- **一套 UI，多种壳。** Web、PWA、Electron 共用同一份 `dist/web`。
- **核心逻辑不碰 DOM。** SRS、搜索、导入导出可以单独测试。
- **数据适配器隔离平台。** 业务代码只调用 `data.words.list()` 这类方法，不直接碰 IndexedDB/SQLite。
- **先模块化，不急着上 React。** 现有 DOM 代码可以拆成模块；等界面复杂到一定程度再评估框架。

## 5. 数据设计（桌面/手机）

SQLite 表建议：

```sql
words(id, uid, word, phonetic, core_json, morphology_json,
      etymology_json, mastery, added_at, last_review_at,
      review_count, correct_count, deleted_at, updated_at);

senses(id, uid, word_id, definition, core_link, example,
       collocations, synonyms, antonyms, pos, topic,
       register, stage, is_core, updated_at);

root_families(id, uid, root, meaning, origin, members_json, mnemonic);
synonym_groups(id, uid, name, dimensions_json, members_json, contrasts_json, mnemonic);
confusion_pairs(id, uid, a, b, dimension, difference, examples_json);

review_events(id, at, word_id, sense_id, facet, item_type,
              correct, response_ms, error_type);

facet_progress(key, word_id, sense_id, facet, due_at,
               interval, ease, reps, lapses, last_grade);
```

- 内容字段用 JSON 存，避免为每个新题型改表结构。
- 复习事件单独存，方便统计、遗忘曲线、错题本。
- 同步需要 `uid` / `updated_at` / `deleted_at`；不同步可以暂缓。
- 备份：SQLite 文件 + JSON 导出双保险；迁移前先备份。

## 6. 分发与更新

- **网页/PWA**：GitHub Pages。
- **Windows**：GitHub Releases 提供 `.exe` 安装包 + 便携版。
- **自动更新**：Electron `electron-updater` 或 Tauri updater，读取 GitHub Releases。
- **签名**：正式版建议买 Windows 代码签名证书；没有签名也能用，但会有 SmartScreen 警告。
- **手机**：先 PWA；上架再走 Google Play（$25 一次性）和 Apple（$99/年）。
- **CI**：GitHub Actions 构建安装包、跑测试、发布 Release；你只下载成品。

## 7. 主要风险

1. **打包太早**：学习模型和数据表还在变，安装包会反复重装、迁移。
2. **继续用 IndexedDB 当唯一存储**：清缓存/换电脑就丢；桌面端应切 SQLite。
3. **没有备份**：任何一次迁移失败都可能丢 4000 词。
4. **同步太早**：没有 UUID/更新时间/冲突策略，后面会返工。
5. **手机 UI 直接复用桌面双栏**：体验会很差，需要单独适配。
6. **代码签名/商店审核**：比写代码更耗时，放到 1.0 前处理。

## 8. 需要你决定的事

1. **主平台**：Windows 桌面优先，还是手机优先，还是两者都要？
2. **工具链**：愿意在本机装 Node/Rust/VS Build Tools/Android Studio，还是希望全部用 GitHub Actions 构建、自己只下载安装包？
3. **分发**：只自己用 + GitHub 下载，还是要上应用商店？
4. **数据**：单机 + 手动备份就够，还是必须多设备同步？
5. **外观**：保留现在这套界面，还是桌面版重新设计一套更“应用化”的布局？

我的默认建议：

> **0.2 学习内核 → 0.3 SQLite/备份 → 0.4 PWA → 0.5 Electron 桌面版 → 0.6 手机按需 → 1.0。**
> 先让你在 Windows 上双击安装、离线使用；手机先用 PWA，不急着上架。
