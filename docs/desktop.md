# Windows 桌面版（Electron）

0.1 开始提供 Windows 桌面壳，复用 `index.html` 的全部界面，并增加：

- 原生窗口、单实例、应用菜单；
- 导出时使用 Windows 保存对话框；
- “文件 → 打开数据目录”；
- 安装包 / 便携版；
- GitHub Actions 自动构建 Windows 安装包。

## 本地运行

```bash
npm install
npm start
```

如果 `npm install` 因网络/权限无法下载 Electron，可改用 GitHub Actions 构建：

> Actions → **Build Windows app** → Run workflow

构建完成后，在运行记录的 **Artifacts** 下载 `smart-vocab-windows`。

## 构建安装包

```bash
npm run dist
```

输出：

- `release/SmartVocab-0.1.0-x64.exe`（NSIS 安装包）
- `release/SmartVocab-0.1.0-portable.exe`（便携版）

> 未签名的安装包会触发 Windows SmartScreen；点“更多信息 → 仍要运行”。正式版再考虑代码签名证书。

## 数据位置

桌面版的数据仍暂时存在 Electron 的 IndexedDB 中，位于应用数据目录：

```text
%APPDATA%\智能单词本
```

通过菜单 **文件 → 打开数据目录** 可以直接打开。

0.3 会把存储迁到 SQLite，并提供自动备份；在那之前，请定期用「导出 → JSON」备份。

## 安全设置

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- 外部链接交给系统浏览器打开
- 导出/保存通过 preload 暴露的最小 IPC 接口

## 后续

- 0.3：SQLite + 自动备份 + 旧数据导入。
- 0.4：自动更新（`electron-updater`）+ 签名。
- 0.5：Capacitor 手机端。
