'use strict';

/**
 * 桌面版更新模块。
 *
 * 安装版（NSIS）：electron-updater 读取 resources/app-update.yml，
 * 从 GitHub Release 的 latest.yml 检查、下载并静默安装增量包。
 * 便携版：不能覆盖正在运行的 exe，只做版本检查并打开发布页。
 * 开发模式：不联网检查，避免开发时误触发更新。
 */

const fs = require('node:fs');
const path = require('node:path');
const { app, ipcMain, net, shell } = require('electron');

let autoUpdater = null;
let updaterLoadError = null;
try {
  ({ autoUpdater } = require('electron-updater'));
} catch (err) {
  updaterLoadError = err;
}

const OWNER = '1436805877';
const REPO = 'smart-vocab-bydpsk';
const RELEASE_PAGE = `https://github.com/${OWNER}/${REPO}/releases/latest`;
const RELEASES_API = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;

let getWindow = () => null;
let log = () => {};
let initialized = false;
let checking = false;

const state = {
  status: 'idle',
  currentVersion: '',
  latestVersion: '',
  message: '',
  progress: 0,
  releaseNotes: '',
  releaseDate: '',
  releaseUrl: RELEASE_PAGE,
  portable: false,
  packaged: false,
  canCheck: false,
  lastCheckedAt: 0,
};

function hasUpdaterConfig() {
  try {
    return fs.existsSync(path.join(process.resourcesPath, 'app-update.yml'));
  } catch (err) {
    return false;
  }
}

function isPortable() {
  // electron-builder 便携版会注入 PORTABLE_EXECUTABLE_*；
  // 手工解压的免安装目录没有 app-update.yml，也按便携版处理。
  return !!(process.env.PORTABLE_EXECUTABLE_FILE || process.env.PORTABLE_EXECUTABLE_DIR) || !hasUpdaterConfig();
}

function sendState() {
  const win = getWindow();
  if (!win || win.isDestroyed()) return;
  try {
    win.webContents.send('update:state', { ...state });
  } catch (e) {
    log('update state send failed', e);
  }
}

function setState(patch) {
  Object.assign(state, patch);
  sendState();
  return { ...state };
}

function friendlyError(err) {
  const raw = String((err && (err.message || err.stack)) || err || '未知错误');
  if (/app-update\.yml.*(not found|ENOENT)/i.test(raw)) {
    return '当前安装包没有更新配置，请重新下载 0.5.2 或更高版本的安装包。';
  }
  if (/net::|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN/i.test(raw)) {
    return '网络连接失败，请检查网络或代理后重试。';
  }
  if (/404/i.test(raw)) {
    return '没有找到可用的更新版本，请稍后再试。';
  }
  if (raw.length > 240) return raw.slice(0, 240) + '…';
  return raw;
}

function parseVersion(value) {
  return String(value || '')
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .slice(0, 3)
    .map(part => {
      const n = parseInt(part, 10);
      return Number.isFinite(n) ? n : 0;
    });
}

function isNewerVersion(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] || 0;
    const bv = b[i] || 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

function normalizeNotes(notes) {
  if (!notes) return '';
  if (Array.isArray(notes)) {
    return notes.map(item => String((item && item.note) || '')).filter(Boolean).join('\n').slice(0, 2000);
  }
  return String(notes).replace(/<[^>]*>/g, '').slice(0, 2000);
}

function markChecking() {
  return setState({
    status: 'checking',
    message: '正在连接 GitHub 检查新版本…',
    progress: 0,
    latestVersion: '',
    lastCheckedAt: Date.now(),
  });
}

async function checkPortable() {
  markChecking();
  const response = await net.fetch(RELEASES_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `SmartVocab/${app.getVersion()}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`GitHub Releases 返回 HTTP ${response.status}`);
  }
  const release = await response.json();
  const latest = String(release.tag_name || release.name || '').replace(/^v/i, '');
  const current = app.getVersion();
  if (!latest) throw new Error('GitHub Release 没有版本号');
  if (isNewerVersion(latest, current)) {
    return setState({
      status: 'available',
      latestVersion: latest,
      releaseNotes: normalizeNotes(release.body),
      releaseDate: release.published_at || '',
      releaseUrl: release.html_url || RELEASE_PAGE,
      message: `发现新版本 v${latest}。便携版请打开发布页下载新版；安装版可直接下载更新。`,
      canCheck: true,
    });
  }
  return setState({
    status: 'not-available',
    latestVersion: latest,
    releaseNotes: normalizeNotes(release.body),
    releaseDate: release.published_at || '',
    releaseUrl: release.html_url || RELEASE_PAGE,
    message: `当前已是最新版本（v${current}）。`,
    canCheck: true,
  });
}

async function checkForUpdates() {
  if (checking) return { ...state };
  if (!app.isPackaged) {
    return setState({
      status: 'dev',
      currentVersion: app.getVersion(),
      message: '开发模式不检查更新。打包安装后会自动启用。',
      canCheck: false,
    });
  }
  if (isPortable()) {
    checking = true;
    try {
      return await checkPortable();
    } catch (err) {
      log('portable update check failed', err);
      return setState({
        status: 'error',
        message: friendlyError(err),
        canCheck: true,
      });
    } finally {
      checking = false;
    }
  }
  if (!autoUpdater) {
    return setState({
      status: 'error',
      message: '更新组件加载失败，请重新下载完整安装包。',
      canCheck: false,
    });
  }
  checking = true;
  markChecking();
  try {
    const result = await autoUpdater.checkForUpdates();
    // 正常情况下 update-available / update-not-available 事件会更新状态；
    // 某些网络/代理环境只返回结果不触发事件，这里兜底。
    if (state.status === 'checking') {
      const latest = String((result && result.updateInfo && result.updateInfo.version) || '').replace(/^v/i, '');
      if (latest && isNewerVersion(latest, app.getVersion())) {
        setState({
          status: 'available',
          latestVersion: latest,
          message: `发现新版本 v${latest}，可以下载更新。`,
          canCheck: true,
        });
      } else if (latest) {
        setState({
          status: 'not-available',
          latestVersion: latest,
          message: `当前已是最新版本（v${app.getVersion()}）。`,
          canCheck: true,
        });
      } else {
        setState({
          status: 'error',
          message: '检查更新没有返回版本信息，请稍后重试。',
          canCheck: true,
        });
      }
    }
    return { ...state };
  } catch (err) {
    log('update check failed', err);
    return setState({
      status: 'error',
      message: friendlyError(err),
      canCheck: true,
    });
  } finally {
    checking = false;
  }
}

async function downloadUpdate() {
  if (state.status !== 'available') {
    return setState({ message: '当前没有可下载的新版本，请先检查更新。' });
  }
  if (isPortable()) {
    try {
      await shell.openExternal(state.releaseUrl || RELEASE_PAGE);
    } catch (err) {
      log('open release page failed', err);
    }
    return { ...state };
  }
  if (!autoUpdater) {
    return setState({
      status: 'error',
      message: '更新组件加载失败，请重新下载完整安装包。',
      canCheck: false,
    });
  }
  try {
    setState({
      status: 'downloading',
      progress: 0,
      message: `正在下载 v${state.latestVersion}…`,
    });
    await autoUpdater.downloadUpdate();
    return { ...state };
  } catch (err) {
    log('update download failed', err);
    return setState({
      status: 'error',
      message: '下载更新失败：' + friendlyError(err),
      canCheck: true,
    });
  }
}

function installUpdate() {
  if (state.status !== 'downloaded') {
    return { ...state, message: '更新还没有下载完成。' };
  }
  if (!autoUpdater) {
    return setState({
      status: 'error',
      message: '更新组件加载失败，请重新下载完整安装包。',
      canCheck: false,
    });
  }
  log('quitAndInstall requested');
  setImmediate(() => {
    try {
      autoUpdater.quitAndInstall(false, true);
    } catch (err) {
      log('quitAndInstall failed', err);
      setState({ status: 'error', message: '启动安装失败：' + friendlyError(err) });
    }
  });
  return { ...state, message: '正在重启并安装更新…' };
}

function setup(options = {}) {
  if (initialized) return;
  initialized = true;
  getWindow = options.getWindow || (() => null);
  log = options.log || (() => {});

  state.currentVersion = app.getVersion();
  state.packaged = app.isPackaged;
  state.portable = app.isPackaged && isPortable();
  state.canCheck = app.isPackaged;
  if (!app.isPackaged) {
    state.status = 'dev';
    state.message = '开发模式不检查更新，打包安装后自动启用。';
  }

  if (autoUpdater) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = false;
    autoUpdater.logger = {
      info: (...args) => log('[updater]', ...args),
      warn: (...args) => log('[updater]', ...args),
      error: (...args) => log('[updater]', ...args),
      debug: (...args) => log('[updater]', ...args),
    };

    autoUpdater.on('checking-for-update', () => {
      if (state.status !== 'checking') {
        setState({ status: 'checking', message: '正在检查更新…' });
      }
    });
    autoUpdater.on('update-available', info => {
      const latest = String((info && info.version) || '').replace(/^v/i, '');
      setState({
        status: 'available',
        latestVersion: latest,
        releaseDate: (info && info.releaseDate) || '',
        releaseNotes: normalizeNotes(info && info.releaseNotes),
        message: `发现新版本 v${latest}，可以下载更新。`,
        canCheck: true,
      });
    });
    autoUpdater.on('update-not-available', info => {
      const latest = String((info && info.version) || app.getVersion()).replace(/^v/i, '');
      setState({
        status: 'not-available',
        latestVersion: latest,
        releaseDate: (info && info.releaseDate) || '',
        message: `当前已是最新版本（v${app.getVersion()}）。`,
        canCheck: true,
      });
    });
    autoUpdater.on('download-progress', progress => {
      setState({
        status: 'downloading',
        progress: Math.max(0, Math.min(100, Number(progress && progress.percent) || 0)),
        message: `正在下载 v${state.latestVersion}…`,
      });
    });
    autoUpdater.on('update-downloaded', info => {
      const latest = String((info && info.version) || state.latestVersion).replace(/^v/i, '');
      setState({
        status: 'downloaded',
        latestVersion: latest,
        progress: 100,
        message: `v${latest} 已下载完成，重启应用即可安装。`,
        canCheck: true,
      });
    });
    autoUpdater.on('error', err => {
      log('autoUpdater error', err);
      setState({
        status: 'error',
        message: friendlyError(err),
        canCheck: app.isPackaged,
      });
    });
  } else {
    log('electron-updater unavailable', updaterLoadError);
    state.status = 'error';
    state.message = '更新组件加载失败，请重新下载完整安装包。';
  }

  ipcMain.handle('update:getState', () => ({ ...state }));
  ipcMain.handle('update:check', () => checkForUpdates());
  ipcMain.handle('update:download', () => downloadUpdate());
  ipcMain.handle('update:install', () => installUpdate());
  ipcMain.handle('update:openRelease', async () => {
    try {
      await shell.openExternal(state.releaseUrl || RELEASE_PAGE);
      return true;
    } catch (err) {
      log('open release page failed', err);
      return false;
    }
  });

  setState({});
  log('updater ready', {
    currentVersion: state.currentVersion,
    packaged: state.packaged,
    portable: state.portable,
  });
}

module.exports = { setup, checkForUpdates };
