'use strict';

/**
 * 0.5.3 更新安全回归：
 * 1. 下载前先备份，备份失败不得调用 downloadUpdate；
 * 2. 安装前再次备份；
 * 3. before-update / before-install 的本地 JSON 写盘失败时返回 null；
 * 4. 备份文件名带原因、中文原因映射正确。
 *
 * 不启动 Electron，只从 index.html 抽出对应方法做行为测试。
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// 两个“写盘失败”用例会故意打印错误；其余错误仍原样输出。
const originalConsoleError = console.error;
console.error = (...args) => {
  if (String(args[0]).startsWith('Desktop backup failed:')) return;
  originalConsoleError(...args);
};

function extractMethod(signature) {
  const start = html.indexOf(signature);
  if (start < 0) throw new Error('找不到方法：' + signature);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        const text = html.slice(start, i + 1);
        return new Function('return ({' + text + '});')();
      }
    }
  }
  throw new Error('方法括号不完整：' + signature);
}

const methods = extractMethod('            async handleUpdateAction(action, silent = false) {');
Object.assign(methods, extractMethod('            async createBackup(reason = \'manual\') {'));
Object.assign(methods, extractMethod('            backupFileName(date = new Date(), reason = \'\') {'));
Object.assign(methods, extractMethod('            backupReasonLabel(reason) {'));

function makeBackupHost() {
  return {
    words: [{ id: 1, word: 'crowd' }],
    progress: new Map([['1', { stage: 2 }]]),
    backups: [],
    lastBackupAt: 0,
    buildExportData: () => ({ app: '智能单词本', words: [{ id: 1, word: 'crowd' }], progress: [{ key: '1' }] }),
    db: {
      saveBackup: async () => {},
      getBackupMetas: async () => [],
      getBackups: async () => [],
      deleteBackup: async () => {},
    },
    backupFileName: methods.backupFileName,
    backupReasonLabel: methods.backupReasonLabel,
    showToast: () => {},
  };
}

(async () => {
  // 文件名与原因
  assert.equal(
    methods.backupFileName.call({}, new Date(2026, 9, 27, 12, 34, 56), 'before-update'),
    'wordbook-backup-2026-10-27-123456-before-update.json'
  );
  assert.equal(methods.backupReasonLabel.call({}, 'before-update'), '更新前备份');
  assert.equal(methods.backupReasonLabel.call({}, 'before-install'), '安装前备份');
  assert.equal(methods.backupReasonLabel.call({}, 'auto'), '自动备份');

  // 下载前先备份，再下载
  {
    const order = [];
    const host = {
      words: [{}], _updateBackupAt: 0, updateState: {},
      showToast: () => {},
      refreshUpdateSection: () => {},
      createBackup: async reason => { order.push('backup:' + reason); return { createdAt: 123 }; },
    };
    global.window = { desktop: { downloadUpdate: async () => { order.push('download'); return { status: 'downloading' }; } } };
    await methods.handleUpdateAction.call(host, 'download');
    assert.deepEqual(order, ['backup:before-update', 'download']);
    assert.equal(host._updateBackupAt, 123);
  }

  // 安装前再次备份
  {
    const order = [];
    const host = {
      words: [{}], _updateBackupAt: 0, updateState: {},
      showToast: () => {},
      refreshUpdateSection: () => {},
      createBackup: async reason => { order.push('backup:' + reason); return { createdAt: 456 }; },
    };
    global.window = { desktop: { installUpdate: async () => { order.push('install'); return { status: 'downloaded' }; } } };
    await methods.handleUpdateAction.call(host, 'install');
    assert.deepEqual(order, ['backup:before-install', 'install']);
  }

  // 备份失败必须中止下载
  {
    const order = [];
    const host = {
      words: [{}], _updateBackupAt: 0, updateState: {},
      showToast: (message) => { if (String(message).includes('已取消更新')) order.push('abort'); },
      refreshUpdateSection: () => {},
      createBackup: async () => null,
    };
    global.window = { desktop: { downloadUpdate: async () => { order.push('download'); return {}; } } };
    await methods.handleUpdateAction.call(host, 'download');
    assert.ok(order.includes('abort'));
    assert.ok(!order.includes('download'));
  }

  // 本地 JSON 写盘失败：更新前备份返回 null
  {
    const host = makeBackupHost();
    global.window = { desktop: { saveBackup: async () => ({ ok: false, error: 'disk full' }) } };
    const result = await methods.createBackup.call(host, 'before-update');
    assert.equal(result, null);
  }

  // 本地 JSON 写盘失败：安装前备份同样返回 null
  {
    const host = makeBackupHost();
    global.window = { desktop: { saveBackup: async () => { throw new Error('denied'); } } };
    const result = await methods.createBackup.call(host, 'before-install');
    assert.equal(result, null);
  }

  // 正常写盘：返回快照，文件名带原因
  {
    const host = makeBackupHost();
    const files = [];
    global.window = { desktop: { saveBackup: async (_content, filename) => { files.push(filename); return { ok: true }; } } };
    const result = await methods.createBackup.call(host, 'before-update');
    assert.ok(result && result.reason === 'before-update');
    assert.equal(files.length, 1);
    assert.match(files[0], /-before-update\.json$/);
  }

  console.log('update safety tests: OK');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
