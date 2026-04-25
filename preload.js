const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('nexusApi', {
  openLogDialog: () => ipcRenderer.invoke('logs:open-dialog'),
  pathsFromDroppedFiles: (files) => Array.from(files || []).map((file) => webUtils.getPathForFile(file)).filter(Boolean),
  parseLogs: (filePaths) => ipcRenderer.invoke('logs:parse', filePaths),
  cancelParse: () => ipcRenderer.invoke('logs:cancel-parse'),
  onParseEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('logs:parse-event', listener);
    return () => ipcRenderer.removeListener('logs:parse-event', listener);
  },

  saveExport: (payload) => ipcRenderer.invoke('export:save', payload),
  getReadme: () => ipcRenderer.invoke('app:read-readme'),
  getUserGuide: () => ipcRenderer.invoke('app:read-user-guide'),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),

  getAiConfig: () => ipcRenderer.invoke('ai:get-config'),
  saveAiConfig: (config) => ipcRenderer.invoke('ai:save-config', config),
  analyzeWithAi: (payload) => ipcRenderer.invoke('ai:analyze', payload),
  chatWithAi: (payload) => ipcRenderer.invoke('ai:chat', payload),
  naturalSearch: (payload) => ipcRenderer.invoke('ai:natural-search', payload),
  sequenceDiagram: (payload) => ipcRenderer.invoke('ai:sequence', payload),
  reproductionScript: (payload) => ipcRenderer.invoke('ai:script', payload),

  getDocsStatus: () => ipcRenderer.invoke('docs:status'),
  openDocsDialog: () => ipcRenderer.invoke('docs:open-dialog'),
  ingestDocs: (paths) => ipcRenderer.invoke('docs:ingest', paths)
});
