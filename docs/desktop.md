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

如果 Electron 下载很慢，可以用国内镜像：

```powershell
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
$env:ELECTRON_BUILDER_BINARIES_MIRROR = 'https://npmmirror.com/mirrors/electron-builder-binaries/'
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

- `release/SmartVocab-0.4.16-x64.exe`（NSIS 安装包）
- `release/SmartVocab-0.4.16-portable.exe`（便携版）

如果 `electron-builder` 在本机被权限/网络卡住，可以先生成免安装便携版：

```bash
npm run portable
# 输出 release/portable/SmartVocab.exe
```

> 未签名的安装包会触发 Windows SmartScreen；点“更多信息 → 仍要运行”。正式版再考虑代码签名证书。

## 打不开时怎么排查

1. **不要直接在压缩包里双击 exe。** 先右键 zip → **全部解压**。
2. 建议解压到 **不含中文/空格的路径**，例如 `C:\SmartVocab`。
   > 实测：在中文路径下曾出现 Electron 启动后立即退出；解压到 `C:\SmartVocab-0.1.0` 后正常。
3. 先运行 `启动诊断.bat`，它会把启动日志写到同目录的 `startup.log`，并在窗口里显示退出码。
4. 如果仍然失败，再试 `启动诊断_无沙箱.bat`（仅用于排查，不要长期使用）。
5. 把 `startup.log` 和窗口里的退出码发给我。

常见原因：

- 只解压了 exe，没有解压 `resources` 和 DLL；
- 从压缩包临时目录运行，找不到 `resources`；
- 路径含中文/特殊字符；
- 杀毒软件/公司策略拦截未签名 exe。

安装包默认安装目录已改为 `%LOCALAPPDATA%\SmartVocab`，避免中文路径。

> 0.1 排查阶段暂时关闭了单实例锁和硬件加速；确认稳定后会改用 Windows 命名互斥体重新实现单实例。

## 数据位置

桌面版的数据仍暂时存在 Electron 的 IndexedDB 中，位于应用数据目录：

```text
%APPDATA%\smart-vocab
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
