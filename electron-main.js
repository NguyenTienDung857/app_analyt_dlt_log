const { app, BrowserWindow, clipboard, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

const { AiClient, hasUsableAiConfig } = require('./src/services/aiClient');
const { buildAnalysisPayload, buildChatPayload, buildNaturalSearchPayload, buildSequencePayload, buildScriptPayload } = require('./src/services/contextBuilder');
const { RagStore } = require('./src/services/ragStore');
const { writeExportFile } = require('./src/services/exporter');

const APP_ROOT = __dirname;
const UPDATE_CHECK_DELAY_MS = 5000;
const DEFAULT_AI_CONFIG = {
  baseUrl: 'https://rsqd56n.9router.com/v1',
  model: 'cx/gpt-5.5',
  apiKey: 'sk-b089739d3e949acd-ztg3i5-13a62048',
  headers: {},
  contextWindowMs: 500,
  maxLogLines: 1400,
  autoScan: false
};

let mainWindow = null;
let parseWorker = null;
let ragStore = null;
let autoUpdaterStarted = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#08110f',
    title: 'BLTN-Analysis Log',
    icon: path.join(APP_ROOT, 'YuRa-256.png'),
    webPreferences: {
      preload: path.join(APP_ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.setAutoHideMenuBar(true);
  mainWindow.loadFile(path.join(APP_ROOT, 'index.html'));
}

function sendUpdateStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:update-status', status);
  }
}

function setupAutoUpdater() {
  if (autoUpdaterStarted || !app.isPackaged) return;
  autoUpdaterStarted = true;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => sendUpdateStatus({ state: 'checking' }));
  autoUpdater.on('update-available', (info) => sendUpdateStatus({ state: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => sendUpdateStatus({ state: 'not-available' }));
  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus({
      state: 'downloading',
      percent: Math.round(progress.percent || 0),
      transferred: progress.transferred || 0,
      total: progress.total || 0,
      bytesPerSecond: progress.bytesPerSecond || 0
    });
  });
  autoUpdater.on('error', (error) => {
    sendUpdateStatus({ state: 'error', error: error.message });
  });
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus({ state: 'downloaded', version: info.version });
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      sendUpdateStatus({ state: 'error', error: error.message });
    });
  }, UPDATE_CHECK_DELAY_MS);
}

function getConfigPath() {
  return path.join(app.getPath('userData'), 'ai-config.json');
}

function readConfigInternal() {
  const envConfig = {};
  if (process.env.DLT_AI_API_KEY) envConfig.apiKey = process.env.DLT_AI_API_KEY;
  if (process.env.DLT_AI_BASE_URL) envConfig.baseUrl = process.env.DLT_AI_BASE_URL;
  if (process.env.DLT_AI_MODEL) envConfig.model = process.env.DLT_AI_MODEL;

  try {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
      return normalizeAiConfig({ ...DEFAULT_AI_CONFIG, ...envConfig });
    }
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return normalizeAiConfig({
      ...DEFAULT_AI_CONFIG,
      ...envConfig,
      ...parsed,
      apiKey: parsed.apiKey || envConfig.apiKey || DEFAULT_AI_CONFIG.apiKey,
      baseUrl: parsed.baseUrl || envConfig.baseUrl || DEFAULT_AI_CONFIG.baseUrl,
      model: parsed.model || envConfig.model || DEFAULT_AI_CONFIG.model,
      headers: parsed.headers && typeof parsed.headers === 'object' ? parsed.headers : {}
    });
  } catch (error) {
    return normalizeAiConfig({ ...DEFAULT_AI_CONFIG, ...envConfig, configError: error.message });
  }
}

function redactConfig(config) {
  return {
    ...config,
    apiKey: '',
    apiKeySet: Boolean(config.apiKey),
    apiKeyPreview: config.apiKey ? `${config.apiKey.slice(0, 5)}...${config.apiKey.slice(-4)}` : ''
  };
}

function saveConfig(input) {
  const current = readConfigInternal();
  const next = {
    ...current,
    baseUrl: String(input.baseUrl || current.baseUrl).trim(),
    model: String(input.model || current.model).trim(),
    headers: input.headers && typeof input.headers === 'object' ? input.headers : {},
    contextWindowMs: Number(input.contextWindowMs || current.contextWindowMs || 500),
    maxLogLines: Number(input.maxLogLines || current.maxLogLines || 1400),
    autoScan: Boolean(input.autoScan)
  };

  if (Object.prototype.hasOwnProperty.call(input, 'apiKey')) {
    const apiKey = String(input.apiKey || '').trim();
    if (apiKey) {
      next.apiKey = apiKey;
    }
  }

  const normalized = normalizeAiConfig(next);
  fs.mkdirSync(path.dirname(getConfigPath()), { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

function normalizeAiConfig(config) {
  const next = { ...config };
  const baseUrl = String(next.baseUrl || '');
  const model = String(next.model || '').trim();
  if (baseUrl.includes('9router.com') && model && !model.includes('/')) {
    next.model = `cx/${model}`;
  }
  return next;
}

function defaultDocumentPaths() {
  const systemSpaceTxt = path.join(APP_ROOT, 'system_space.txt');
  const systemSpaceDocx = path.join(APP_ROOT, 'system_space.docx');
  const systemSpaceLegacy = path.join(APP_ROOT, 'system_space');
  const systemSpace = [systemSpaceTxt, systemSpaceDocx, systemSpaceLegacy].find((itemPath) => fs.existsSync(itemPath));
  const candidates = [
    systemSpace,
    path.join(APP_ROOT, '01_System_Spec_BLTN_CAM_v2_2(20250602).docx')
  ].filter(Boolean);
  return candidates.filter((itemPath) => fs.existsSync(itemPath));
}

async function rebuildDefaultRag() {
  ragStore = new RagStore();
  await ragStore.rebuildFromPaths(defaultDocumentPaths());
}

function sendParseEvent(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('logs:parse-event', payload);
  }
}

function stopParseWorker() {
  if (parseWorker) {
    parseWorker.terminate();
    parseWorker = null;
  }
}

app.whenReady().then(async () => {
  await rebuildDefaultRag();
  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      setupAutoUpdater();
    }
  });
});

app.on('window-all-closed', () => {
  stopParseWorker();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('app:get-version', () => app.getVersion());
ipcMain.handle('app:install-update', () => autoUpdater.quitAndInstall(true, true));
ipcMain.handle('app:download-update', () => autoUpdater.downloadUpdate().catch((error) => {
  sendUpdateStatus({ state: 'error', error: error.message });
}));
ipcMain.handle('app:check-update', () => {
  if (!app.isPackaged) {
    sendUpdateStatus({ state: 'error', error: 'Chỉ hoạt động khi app đã được cài đặt (không phải chế độ dev).' });
    return;
  }
  sendUpdateStatus({ state: 'checking' });
  autoUpdater.checkForUpdates().catch((error) => {
    sendUpdateStatus({ state: 'error', error: error.message });
  });
});

ipcMain.handle('logs:open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open DLT / log files',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'DLT and logs', extensions: ['dlt', 'log', 'bin', 'txt'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('logs:parse', async (_event, filePaths) => {
  stopParseWorker();
  const files = (filePaths || []).filter((filePath) => fs.existsSync(filePath));
  if (!files.length) {
    return { ok: false, error: 'No readable file selected.' };
  }

  parseWorker = new Worker(path.join(APP_ROOT, 'src', 'workers', 'parseWorker.js'));
  parseWorker.on('message', (payload) => sendParseEvent(payload));
  parseWorker.on('error', (error) => sendParseEvent({ type: 'error', error: error.message }));
  parseWorker.on('exit', (code) => {
    if (code !== 0) {
      sendParseEvent({ type: 'error', error: `Parse worker exited with code ${code}.` });
    }
    parseWorker = null;
  });
  parseWorker.postMessage({ type: 'start', files });
  return { ok: true };
});

ipcMain.handle('logs:cancel-parse', async () => {
  stopParseWorker();
  return { ok: true };
});

ipcMain.handle('export:save', async (_event, payload) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: payload.title || 'Export logs',
    defaultPath: payload.defaultPath || 'dlt-export.txt',
    filters: payload.filters || [{ name: 'All files', extensions: ['*'] }]
  });
  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }
  await writeExportFile(result.filePath, payload.content || '');
  return { ok: true, filePath: result.filePath };
});

ipcMain.handle('app:read-readme', async () => {
  const candidates = ['README.md', 'Readme.md', 'readme.md'].map((fileName) => path.join(APP_ROOT, fileName));
  const readmePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!readmePath) {
    return { ok: false, error: 'README.md was not found in the project folder.' };
  }
  return {
    ok: true,
    fileName: path.basename(readmePath),
    content: fs.readFileSync(readmePath, 'utf8')
  };
});

ipcMain.handle('app:read-user-guide', async () => {
  const candidates = [
    'USER_GUIDE_EN.md',
    'USER_GUIDE.md',
    'UserGuide.md'
  ].map((fileName) => path.join(APP_ROOT, fileName));
  const guidePath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!guidePath) {
    return { ok: false, error: 'USER_GUIDE_EN.md was not found in the project folder.' };
  }
  return {
    ok: true,
    fileName: path.basename(guidePath),
    content: fs.readFileSync(guidePath, 'utf8')
  };
});

ipcMain.handle('clipboard:write', async (_event, text) => {
  clipboard.writeText(String(text || ''));
  return { ok: true };
});

ipcMain.handle('ai:get-config', async () => {
  return redactConfig(readConfigInternal());
});

ipcMain.handle('ai:save-config', async (_event, input) => {
  return redactConfig(saveConfig(input || {}));
});

ipcMain.handle('ai:analyze', async (_event, request) => {
  const config = readConfigInternal();
  if (!hasUsableAiConfig(config)) {
    return { ok: false, error: 'AI config is missing base URL, model, or API key.' };
  }

  const ragDocs = ragStore ? ragStore.search(request.query || request.title || '', 6) : [];
  const payload = buildAnalysisPayload(request, ragDocs, config);
  const result = await new AiClient(config).diagnose(payload);
  return { ok: true, result, ragDocs, promptStats: payload.promptStats };
});

ipcMain.handle('ai:chat', async (_event, request) => {
  const config = readConfigInternal();
  const effectiveConfig = normalizeAiConfig({
    ...config,
    model: String(request.model || '').trim() || config.model
  });
  if (!hasUsableAiConfig(effectiveConfig)) {
    return { ok: false, error: 'AI config is missing base URL, model, or API key.' };
  }

  const query = [
    request.question || '',
    ...(Array.isArray(request.messages) ? request.messages.slice(0, 80).map((message) => message.payload || '') : [])
  ].join(' ');
  const ragDocs = ragStore ? ragStore.search(query, 8) : [];
  const payload = buildChatPayload(request, ragDocs, effectiveConfig);
  const result = await new AiClient(effectiveConfig).chat(payload);
  return { ok: true, result, ragDocs, promptStats: payload.promptStats };
});

ipcMain.handle('ai:natural-search', async (_event, request) => {
  const config = readConfigInternal();
  if (!hasUsableAiConfig(config)) {
    return { ok: false, error: 'AI config is missing base URL, model, or API key.' };
  }

  const ragDocs = ragStore ? ragStore.search(request.query || '', 4) : [];
  const payload = buildNaturalSearchPayload(request, ragDocs);
  const result = await new AiClient(config).naturalSearch(payload);
  return { ok: true, result, ragDocs };
});

ipcMain.handle('ai:sequence', async (_event, request) => {
  const config = readConfigInternal();
  if (!hasUsableAiConfig(config)) {
    return { ok: false, error: 'AI config is missing base URL, model, or API key.' };
  }

  const ragDocs = ragStore ? ragStore.search(request.query || 'sequence communication timeout', 4) : [];
  const payload = buildSequencePayload(request, ragDocs, config);
  const result = await new AiClient(config).sequenceDiagram(payload);
  return { ok: true, result, ragDocs };
});

ipcMain.handle('ai:script', async (_event, request) => {
  const config = readConfigInternal();
  if (!hasUsableAiConfig(config)) {
    return { ok: false, error: 'AI config is missing base URL, model, or API key.' };
  }

  const ragDocs = ragStore ? ragStore.search(request.query || 'reproduce diagnostic fault', 4) : [];
  const payload = buildScriptPayload(request, ragDocs, config);
  const result = await new AiClient(config).reproductionScript(payload);
  return { ok: true, result, ragDocs };
});

ipcMain.handle('docs:status', async () => {
  return ragStore ? ragStore.stats() : { chunks: 0, sources: [] };
});

ipcMain.handle('docs:open-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Add ECU documents',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'ECU docs', extensions: ['txt', 'log', 'md', 'xml', 'arxml', 'fibex', 'docx'] },
      { name: 'All files', extensions: ['*'] }
    ]
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('docs:ingest', async (_event, pathsToAdd) => {
  ragStore = new RagStore();
  const paths = [...defaultDocumentPaths(), ...(pathsToAdd || [])];
  await ragStore.rebuildFromPaths(paths);
  return ragStore.stats();
});
