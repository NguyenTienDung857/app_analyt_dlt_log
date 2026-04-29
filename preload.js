const { contextBridge, ipcRenderer, webUtils } = require('electron');

function pathFromDroppedFile(file) {
  try {
    return webUtils.getPathForFile(file);
  } catch (_error) {
    return file && typeof file.path === 'string' ? file.path : '';
  }
}

function droppedFilePaths(files) {
  const result = [];
  const length = Number(files?.length || 0);
  for (let index = 0; index < length; index += 1) {
    const file = typeof files.item === 'function' ? files.item(index) : files[index];
    const filePath = pathFromDroppedFile(file);
    if (filePath) result.push(filePath);
  }
  return result;
}

function isFileDrag(event) {
  const types = Array.from(event?.dataTransfer?.types || []);
  return types.includes('Files');
}

contextBridge.exposeInMainWorld('nexusApi', {
  openLogDialog: () => ipcRenderer.invoke('logs:open-dialog'),
  pathFromDroppedFile: (file) => pathFromDroppedFile(file),
  pathsFromDroppedFiles: (files) => droppedFilePaths(files),
  onDroppedFiles: (callback) => {
    const onDragOver = (event) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const onDrop = (event) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      event.stopPropagation();
      const paths = droppedFilePaths(event.dataTransfer?.files);
      if (paths.length) callback(paths);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  },
  parseLogs: (filePaths) => ipcRenderer.invoke('logs:parse', filePaths),
  cancelParse: () => ipcRenderer.invoke('logs:cancel-parse'),
  onParseEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('logs:parse-event', listener);
    return () => ipcRenderer.removeListener('logs:parse-event', listener);
  },
  onUpdateStatus: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('app:update-status', listener);
    return () => ipcRenderer.removeListener('app:update-status', listener);
  },

  saveExport: (payload) => ipcRenderer.invoke('export:save', payload),
  getReadme: () => ipcRenderer.invoke('app:read-readme'),
  getUserGuide: () => ipcRenderer.invoke('app:read-user-guide'),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),

  getAiConfig: () => ipcRenderer.invoke('ai:get-config'),
  saveAiConfig: (config) => ipcRenderer.invoke('ai:save-config', config),
  listAiModels: (config) => ipcRenderer.invoke('ai:list-models', config),
  analyzeWithAi: (payload) => ipcRenderer.invoke('ai:analyze', payload),
  chatWithAi: (payload) => ipcRenderer.invoke('ai:chat', payload),
  naturalSearch: (payload) => ipcRenderer.invoke('ai:natural-search', payload),
  sequenceDiagram: (payload) => ipcRenderer.invoke('ai:sequence', payload),
  reproductionScript: (payload) => ipcRenderer.invoke('ai:script', payload),

  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  installUpdate: () => ipcRenderer.invoke('app:install-update'),
  downloadUpdate: () => ipcRenderer.invoke('app:download-update'),
  checkUpdate: () => ipcRenderer.invoke('app:check-update'),

  getDocsStatus: () => ipcRenderer.invoke('docs:status'),
  openDocsDialog: () => ipcRenderer.invoke('docs:open-dialog'),
  ingestDocs: (paths) => ipcRenderer.invoke('docs:ingest', paths)
});
