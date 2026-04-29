const api = window.nexusApi;

const LEVELS = ['Fatal', 'Error', 'Warn', 'Info', 'Debug', 'Verbose', 'Trace', 'Control', 'Unknown'];
const MIN_ROW_HEIGHT = 34;
const ROW_LINE_HEIGHT = 18;
const ROW_VERTICAL_PADDING = 16;
const MAX_RENDER_ROWS = 120;
const MIN_LOG_SCROLL_THUMB_HEIGHT = 30;
const VIRTUAL_SCROLL_END_PADDING = MIN_ROW_HEIGHT * 2;
const ESTIMATED_MONO_CHAR_WIDTH = 7.8;
const DAY_MS = 24 * 60 * 60 * 1000;
const SYNTHETIC_RANGE_STEP_MS = 1000;
const DEFAULT_LOG_COLUMNS = [66, 108, 76, 640];
const MIN_LOG_COLUMNS = [42, 72, 52, 180];
const DEFAULT_RUNTIME_MODEL = 'gpt-5.3-codex-xhigh';
const DEFAULT_QUICK_AI_MODEL = DEFAULT_RUNTIME_MODEL;
const DEFAULT_AI_CHAT_MODE = 'filtered';
const DEFAULT_AI_MAX_LOG_LINES = 27000;
const AI_CONTEXT_SUSPICIOUS_KEYWORDS = [
  'error',
  'fail',
  'failed',
  'failure',
  'fatal',
  'fault',
  'timeout',
  'timed out',
  'exception',
  'reset',
  'dtc',
  'uds',
  'negative response',
  'nrc',
  'overheat',
  'thermal',
  'voltage',
  'fps',
  'drop',
  'lost',
  'disconnect'
];
const LEGACY_QUICK_AI_MODELS = new Set([
  'gpt-5.1-codex-mini',
  'cx/gpt-5.1-codex-mini',
  'gpt-5-codex-mini',
  'cx/gpt-5-codex-mini'
]);
const PREVIOUS_DEFAULT_STRONG_AI_MODELS = new Set([
  'gpt-5.1-codex-max',
  'cx/gpt-5.1-codex-max',
  'gpt-5.2',
  'cx/gpt-5.2',
  'gpt-5.5',
  'cx/gpt-5.5'
]);
const DEFAULT_QUICK_AI_PROMPT = '';

const state = {
  messages: [],
  filtered: [],
  files: [],
  aiHighlights: new Set(),
  selectedId: null,
  firstTimeMs: null,
  lastTimeMs: null,
  currentPage: 1,
  pageSize: 'all',
  levelFilter: null,
  naturalFilter: null,
  parseDone: false,
  aiConfig: null,
  aiConfigUnlocked: false,
  aiChatMode: DEFAULT_AI_CHAT_MODE,
  aiSending: false,
  quickAiPendingId: null,
  naturalSearching: false,
  aiGuidance: loadTextSetting('bltn-ai-guidance'),
  aiRange: {
    unit: 'time',
    min: null,
    max: null,
    from: null,
    to: null,
    dirty: false
  },
  filterRange: {
    unit: 'time',
    min: null,
    max: null,
    from: null,
    to: null,
    dirty: false
  },
  showFullLogTime: false,
  logColumnWidths: loadLogColumnWidths(),
  renderQueued: false,
  virtualRenderQueued: false,
  virtualMetrics: null,
  lastVirtualStart: -1,
  lastVirtualEnd: -1,
  lastVirtualCount: -1,
  dropDepth: 0,
  lastDropSignature: '',
  lastDropAt: 0
};

const el = {
  app: document.getElementById('app'),
  dropZone: document.getElementById('drop-zone'),
  starsCanvas: document.getElementById('stars-canvas'),
  brandVersion: document.getElementById('brand-version'),
  workspace: document.getElementById('workspace'),
  btnOpen: document.getElementById('btn-open'),
  btnOpenEmpty: document.getElementById('btn-open-empty'),
  btnHelp: document.getElementById('btn-help'),
  helpMenu: document.getElementById('help-menu'),
  btnDocs: document.getElementById('btn-docs'),
  btnGuide: document.getElementById('btn-guide'),
  btnAiFocus: document.getElementById('btn-ai-focus'),
  btnTheme: document.getElementById('btn-theme'),
  btnClear: document.getElementById('btn-clear'),
  searchPanel: document.getElementById('search-panel'),
  fileList: document.getElementById('file-list'),
  parseStatus: document.getElementById('parse-status'),
  parseProgress: document.getElementById('parse-progress'),
  statTotal: document.getElementById('stat-total'),
  statFiltered: document.getElementById('stat-filtered'),
  statErrors: document.getElementById('stat-errors'),
  statWarns: document.getElementById('stat-warns'),
  statEcu: document.getElementById('stat-ecu'),
  statSpan: document.getElementById('stat-span'),
  docsStatus: document.getElementById('docs-status'),
  searchInput: document.getElementById('search-input'),
  searchField: document.getElementById('search-field'),
  caseSensitive: document.getElementById('case-sensitive'),
  regexSearch: document.getElementById('regex-search'),
  naturalQuery: document.getElementById('natural-query'),
  btnNatural: document.getElementById('btn-natural'),
  pageSize: document.getElementById('page-size'),
  btnPrev: document.getElementById('btn-prev'),
  btnNext: document.getElementById('btn-next'),
  pageInfo: document.getElementById('page-info'),
  timeFrom: document.getElementById('time-from'),
  timeTo: document.getElementById('time-to'),
  filterRangePanel: document.getElementById('filter-time-range-panel'),
  filterRangeTitle: document.getElementById('filter-range-title'),
  btnFilterRangeUnit: document.getElementById('btn-filter-range-unit'),
  filterRangeStart: document.getElementById('filter-range-start'),
  filterRangeEnd: document.getElementById('filter-range-end'),
  filterRangeSelection: document.getElementById('filter-range-selection'),
  filterRangeFromLabel: document.getElementById('filter-range-from-label'),
  filterRangeToLabel: document.getElementById('filter-range-to-label'),
  filterRangeLimits: document.getElementById('filter-range-limits'),
  btnFilterRangeClear: document.getElementById('btn-filter-range-clear'),
  btnResetFilter: document.getElementById('btn-reset-filter'),
  btnExportCsv: document.getElementById('btn-export-csv'),
  timeline: document.getElementById('timeline'),
  timelineLabel: document.getElementById('timeline-label'),
  logHeader: document.querySelector('.log-header'),
  showFullTime: document.getElementById('show-full-time'),
  focusSearchStrip: document.getElementById('focus-search-strip'),
  btnFocusSearch: document.getElementById('btn-focus-search'),
  focusSearchInput: document.getElementById('focus-search-input'),
  btnFocusSearchClose: document.getElementById('btn-focus-search-close'),
  virtualScroll: document.getElementById('virtual-scroll'),
  virtualSpacer: document.getElementById('virtual-spacer'),
  rowsLayer: document.getElementById('rows-layer'),
  logScrollbar: document.getElementById('log-scrollbar'),
  logScrollbarThumb: document.getElementById('log-scrollbar-thumb'),
  minimap: document.getElementById('minimap'),
  detailEmpty: document.getElementById('detail-empty'),
  detailPanel: document.getElementById('detail-panel'),
  aiStatus: document.getElementById('ai-status'),
  aiReport: document.getElementById('ai-report'),
  aiConfigPanel: document.getElementById('ai-config-panel'),
  btnAiConfigUnlock: document.getElementById('btn-ai-config-unlock'),
  aiConfigPasswordRow: document.getElementById('ai-config-password-row'),
  aiConfigPassword: document.getElementById('ai-config-password'),
  btnAiConfigPasswordSubmit: document.getElementById('btn-ai-config-password-submit'),
  aiConfigBody: document.getElementById('ai-config-body'),
  aiConfigLockState: document.getElementById('ai-config-lock-state'),
  aiBaseUrl: document.getElementById('ai-base-url'),
  aiModel: document.getElementById('ai-model'),
  aiKey: document.getElementById('ai-key'),
  quickAiBaseUrl: document.getElementById('quick-ai-base-url'),
  quickAiModel: document.getElementById('quick-ai-model'),
  quickAiKey: document.getElementById('quick-ai-key'),
  quickAiPrompt: document.getElementById('quick-ai-prompt'),
  aiHeaders: document.getElementById('ai-headers'),
  aiAutoScan: document.getElementById('ai-auto-scan'),
  aiWindow: document.getElementById('ai-window'),
  aiMaxLogLines: document.getElementById('ai-max-log-lines'),
  btnSaveAi: document.getElementById('btn-save-ai'),
  aiChatLog: document.getElementById('ai-report'),
  aiChatInput: document.getElementById('ai-chat-input'),
  btnAiChatSend: document.getElementById('btn-ai-chat-send'),
  aiChatModeSelect: document.getElementById('ai-chat-mode-select'),
  aiRuntimeModel: document.getElementById('ai-runtime-model'),
  btnAiPrompt: document.getElementById('btn-ai-prompt'),
  aiPromptPanel: document.getElementById('ai-prompt-panel'),
  aiGuidanceInput: document.getElementById('ai-guidance-input'),
  aiChatRangePanel: document.getElementById('ai-chat-range-panel'),
  aiChatUseRange: document.getElementById('ai-chat-use-range'),
  aiChatFrom: document.getElementById('ai-chat-from'),
  aiChatTo: document.getElementById('ai-chat-to'),
  btnAiChatRangeClear: document.getElementById('btn-ai-chat-range-clear'),
  aiChatRangeInfo: document.getElementById('ai-chat-range-info'),
  aiRangeTitle: document.getElementById('ai-range-title'),
  btnAiRangeUnit: document.getElementById('btn-ai-range-unit'),
  aiRangeStart: document.getElementById('ai-range-start'),
  aiRangeEnd: document.getElementById('ai-range-end'),
  aiRangeFromLabel: document.getElementById('ai-range-from-label'),
  aiRangeToLabel: document.getElementById('ai-range-to-label'),
  aiRangeLimits: document.getElementById('ai-range-limits'),
  aiRangeSelection: document.getElementById('ai-range-selection'),
  btnCheckUpdate: document.getElementById('btn-check-update'),
  updateBar: document.getElementById('update-bar'),
  updateBarMsg: document.getElementById('update-bar-msg'),
  updateBarIcon: document.getElementById('update-bar-icon'),
  btnUpdateDismiss: document.getElementById('btn-update-dismiss'),
  updateModalOverlay: document.getElementById('update-modal-overlay'),
  updateModal: document.getElementById('update-modal'),
  updateModalVersion: document.getElementById('update-modal-version'),
  updatePhaseAsk: document.querySelector('.update-phase-ask'),
  updatePhaseDownloading: document.querySelector('.update-phase-downloading'),
  updatePhaseDone: document.querySelector('.update-phase-done'),
  updatePhaseError: document.querySelector('.update-phase-error'),
  updateDlFill: document.getElementById('update-dl-fill'),
  updateDlPct: document.getElementById('update-dl-pct'),
  updateDlSize: document.getElementById('update-dl-size'),
  updateDlSpeed: document.getElementById('update-dl-speed'),
  updateDonVersion: document.getElementById('update-done-version'),
  updateErrorMsg: document.getElementById('update-error-msg'),
  btnUpdateYes: document.getElementById('btn-update-yes'),
  btnUpdateNo: document.getElementById('btn-update-no'),
  btnUpdateInstall: document.getElementById('btn-update-install'),
  btnUpdateLater: document.getElementById('btn-update-later'),
  btnUpdateErrorClose: document.getElementById('btn-update-error-close')
};

init();

function init() {
  wireEvents();
  initLogColumnResize();
  applyLogColumnTemplate();
  api.onParseEvent(handleParseEvent);
  if (api.onUpdateStatus) {
    api.onUpdateStatus(handleUpdateStatus);
  }
  loadAiConfig();
  refreshDocsStatus();
  resetWorkspace();
  initStarsCanvas();
  loadAppVersion();
}

function wireEvents() {
  el.btnOpen.addEventListener('click', openFromDialog);
  el.btnOpenEmpty.addEventListener('click', openFromDialog);
  if (el.btnClear) el.btnClear.addEventListener('click', resetWorkspace);
  if (el.btnTheme) el.btnTheme.addEventListener('click', toggleTheme);
  el.btnAiFocus.addEventListener('click', toggleAiFocus);

  if (el.btnHelp && el.helpMenu) {
    el.btnHelp.addEventListener('click', (e) => {
      e.stopPropagation();
      el.helpMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', () => el.helpMenu.classList.add('hidden'));
    el.helpMenu.addEventListener('click', (e) => e.stopPropagation());
  }

  if (el.btnDocs) el.btnDocs.addEventListener('click', () => { el.helpMenu.classList.add('hidden'); addDocs(); });
  if (el.btnGuide) el.btnGuide.addEventListener('click', () => { el.helpMenu.classList.add('hidden'); downloadUserGuide(); });

  if (el.btnCheckUpdate) {
    el.btnCheckUpdate.addEventListener('click', () => {
      el.helpMenu.classList.add('hidden');
      if (api.checkUpdate) {
        el.btnCheckUpdate.classList.add('checking');
        api.checkUpdate();
        setTimeout(() => el.btnCheckUpdate.classList.remove('checking'), 8000);
      }
    });
  }
  if (el.btnUpdateDismiss) {
    el.btnUpdateDismiss.addEventListener('click', () => el.updateBar.classList.add('hidden'));
  }
  if (el.btnUpdateYes) {
    el.btnUpdateYes.addEventListener('click', () => {
      showUpdatePhase('downloading');
      if (api.downloadUpdate) api.downloadUpdate();
    });
  }
  if (el.btnUpdateNo) {
    el.btnUpdateNo.addEventListener('click', () => el.updateModalOverlay.classList.add('hidden'));
  }
  if (el.btnUpdateInstall) {
    el.btnUpdateInstall.addEventListener('click', () => {
      if (api.installUpdate) api.installUpdate();
    });
  }
  if (el.btnUpdateErrorClose) {
    el.btnUpdateErrorClose.addEventListener('click', () => el.updateModalOverlay.classList.add('hidden'));
  }

  window.addEventListener('dragenter', handleFileDragEnter);
  window.addEventListener('dragover', handleFileDragOver);
  window.addEventListener('dragleave', handleFileDragLeave);
  window.addEventListener('drop', handleFileDropEnd);
  if (api.onDroppedFiles) {
    api.onDroppedFiles(handleDroppedPaths);
  }

  el.dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.stopPropagation();
    el.dropZone.classList.add('dragover');
  });
  el.dropZone.addEventListener('dragleave', () => {
    if (!state.dropDepth) el.dropZone.classList.remove('dragover');
  });
  el.dropZone.addEventListener('drop', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    el.dropZone.classList.remove('dragover');
    const paths = droppedPathsFromEvent(event);
    await handleDroppedPaths(paths);
  });

  for (const item of [el.searchInput, el.timeFrom, el.timeTo].filter(Boolean)) {
    item.addEventListener('input', () => {
      state.currentPage = 1;
      state.levelFilter = null;
      state.naturalFilter = null;
      applyFilters();
    });
    item.addEventListener('change', () => {
      state.currentPage = 1;
      applyFilters();
    });
  }

  if (el.pageSize) {
    el.pageSize.addEventListener('change', () => {
      state.pageSize = 'all';
      state.currentPage = 1;
      renderAll();
    });
  }
  if (el.btnPrev) {
    el.btnPrev.addEventListener('click', () => {
      state.currentPage = Math.max(1, state.currentPage - 1);
      renderAll();
    });
  }
  if (el.btnNext) {
    el.btnNext.addEventListener('click', () => {
      state.currentPage = Math.min(getTotalPages(), state.currentPage + 1);
      renderAll();
    });
  }

  if (el.btnResetFilter) el.btnResetFilter.addEventListener('click', resetFilters);
  el.btnExportCsv.addEventListener('click', () => exportFiltered('csv'));
  el.btnAiConfigUnlock.addEventListener('click', unlockAiConfig);
  el.btnAiConfigPasswordSubmit.addEventListener('click', submitAiConfigPassword);
  el.aiConfigPassword.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitAiConfigPassword();
    }
  });
  el.btnSaveAi.addEventListener('click', saveAiConfig);
  if (api.listAiModels) {
    el.aiBaseUrl.addEventListener('change', () => refreshAiModelOptions({ model: DEFAULT_RUNTIME_MODEL, runtimeModel: el.aiRuntimeModel.value }));
    el.aiKey.addEventListener('change', () => refreshAiModelOptions({ model: el.aiModel.value || DEFAULT_RUNTIME_MODEL, runtimeModel: el.aiRuntimeModel.value }));
    el.quickAiBaseUrl.addEventListener('change', () => refreshAiModelOptions({ quickModel: DEFAULT_QUICK_AI_MODEL }));
    el.quickAiKey.addEventListener('change', () => refreshAiModelOptions({ quickModel: el.quickAiModel.value || DEFAULT_QUICK_AI_MODEL }));
  }
  el.btnNatural.addEventListener('click', runNaturalSearch);

  el.virtualScroll.addEventListener('scroll', handleVirtualScroll);
  el.rowsLayer.addEventListener('click', handleRowClick);
  el.timeline.addEventListener('click', handleTimelineClick);
  el.minimap.addEventListener('click', handleMinimapClick);
  el.btnFocusSearch.addEventListener('click', openFocusSearch);
  el.btnFocusSearchClose.addEventListener('click', closeFocusSearch);
  el.logScrollbar.addEventListener('pointerdown', handleLogScrollbarPointerDown);
  el.focusSearchInput.addEventListener('input', () => {
    el.searchInput.value = el.focusSearchInput.value;
    state.currentPage = 1;
    state.levelFilter = null;
    state.naturalFilter = null;
    applyFilters();
  });
  el.showFullTime.addEventListener('change', () => {
    state.showFullLogTime = el.showFullTime.checked;
    scheduleVirtualRows();
  });
  el.filterRangeStart.addEventListener('input', (event) => handleFilterRangeInput(event, 'from'));
  el.filterRangeEnd.addEventListener('input', (event) => handleFilterRangeInput(event, 'to'));
  el.btnFilterRangeClear.addEventListener('click', () => resetFilterRange(true));
  el.btnFilterRangeUnit.addEventListener('click', toggleFilterRangeUnit);

  el.btnAiChatSend.addEventListener('click', () => sendAiChat(state.aiChatMode));
  el.aiChatModeSelect.addEventListener('change', () => setAiChatMode(el.aiChatModeSelect.value));
  el.btnAiPrompt.addEventListener('click', toggleAiPromptPanel);
  el.aiGuidanceInput.value = state.aiGuidance;
  el.aiGuidanceInput.addEventListener('input', () => {
    state.aiGuidance = el.aiGuidanceInput.value.trim();
    saveTextSetting('bltn-ai-guidance', state.aiGuidance);
  });
  el.btnAiChatRangeClear.addEventListener('click', resetAiRangeToFull);
  el.btnAiRangeUnit.addEventListener('click', toggleAiRangeUnit);
  el.aiRangeStart.addEventListener('input', (event) => handleAiRangeInput(event, 'from'));
  el.aiRangeEnd.addEventListener('input', (event) => handleAiRangeInput(event, 'to'));
  el.aiChatInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      sendAiChat(state.aiChatMode);
    }
  });

  window.addEventListener('resize', () => scheduleRender());
  document.addEventListener('keydown', handleKeyboard);
}

async function openFromDialog() {
  const paths = await api.openLogDialog();
  if (paths.length) {
    await openFiles(paths);
  }
}

function isFileDragEvent(event) {
  return Array.from(event?.dataTransfer?.types || []).includes('Files');
}

function handleFileDragEnter(event) {
  if (!isFileDragEvent(event)) return;
  event.preventDefault();
  state.dropDepth += 1;
  el.dropZone.classList.add('dragover');
}

function handleFileDragOver(event) {
  if (!isFileDragEvent(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  el.dropZone.classList.add('dragover');
}

function handleFileDragLeave(event) {
  if (!isFileDragEvent(event)) return;
  state.dropDepth = Math.max(0, state.dropDepth - 1);
  if (!state.dropDepth) el.dropZone.classList.remove('dragover');
}

async function handleFileDropEnd(event) {
  if (!isFileDragEvent(event)) return;
  event.preventDefault();
  state.dropDepth = 0;
  el.dropZone.classList.remove('dragover');
  const paths = droppedPathsFromEvent(event);
  await handleDroppedPaths(paths);
}

function droppedPathsFromEvent(event) {
  const files = Array.from(event?.dataTransfer?.files || []);
  const itemFiles = Array.from(event?.dataTransfer?.items || [])
    .filter((item) => item.kind === 'file' && typeof item.getAsFile === 'function')
    .map((item) => item.getAsFile())
    .filter(Boolean);
  const allFiles = files.length ? files : itemFiles;

  let paths = [];
  if (api.pathsFromDroppedFiles && event?.dataTransfer?.files) {
    paths = api.pathsFromDroppedFiles(event.dataTransfer.files);
  }
  if (!paths.length && api.pathFromDroppedFile) {
    paths = allFiles.map((file) => api.pathFromDroppedFile(file)).filter(Boolean);
  }
  return paths;
}

async function handleDroppedPaths(paths) {
  const safePaths = Array.from(new Set((paths || []).filter(Boolean)));
  if (!safePaths.length) {
    el.parseStatus.textContent = 'Drop detected, but file paths were empty. Use Open DLT if this was not a local file.';
    return;
  }
  const signature = safePaths.join('\n');
  const now = Date.now();
  if (signature === state.lastDropSignature && now - state.lastDropAt < 1000) {
    return;
  }
  state.lastDropSignature = signature;
  state.lastDropAt = now;
  await openFiles(safePaths);
}

async function openFiles(paths) {
  clearData();
  el.dropZone.classList.add('hidden');
  el.workspace.classList.remove('hidden');
  el.parseStatus.textContent = 'Starting parser worker...';
  el.fileList.innerHTML = paths.map((filePath) => `<div class="file-item">${escapeHtml(shortPath(filePath))}</div>`).join('');
  const result = await api.parseLogs(paths);
  if (!result.ok) {
    el.parseStatus.textContent = result.error || 'Could not start the parser.';
  }
}

function toggleAiFocus() {
  el.workspace.classList.toggle('log-ai-focus');
  syncLayoutButtons();
  scheduleRender();
}

function syncLayoutButtons() {
  el.btnAiFocus.classList.toggle('active', el.workspace.classList.contains('log-ai-focus'));
}

function openFocusSearch() {
  el.focusSearchInput.classList.remove('hidden');
  el.btnFocusSearchClose.classList.remove('hidden');
  el.focusSearchInput.value = el.searchInput.value;
  requestAnimationFrame(() => el.focusSearchInput.focus());
}

function closeFocusSearch() {
  el.focusSearchInput.value = '';
  el.searchInput.value = '';
  el.focusSearchInput.classList.add('hidden');
  el.btnFocusSearchClose.classList.add('hidden');
  state.currentPage = 1;
  state.levelFilter = null;
  state.naturalFilter = null;
  applyFilters();
}

function handleVirtualScroll() {
  scheduleVirtualRows();
  updateLogScrollbar();
}

function handleLogScrollbarPointerDown(event) {
  if (!state.filtered.length) return;
  event.preventDefault();

  const geometry = getLogScrollbarGeometry();
  const thumbHeight = el.logScrollbarThumb.getBoundingClientRect().height || MIN_LOG_SCROLL_THUMB_HEIGHT;
  const scrollable = getLogScrollRange(geometry.trackHeight).scrollable;
  const railScrollable = Math.max(1, geometry.trackHeight - thumbHeight);
  if (!scrollable) return;

  const pointerOffset = event.target === el.logScrollbarThumb
    ? event.clientY - el.logScrollbarThumb.getBoundingClientRect().top
    : thumbHeight / 2;

  const moveTo = (clientY) => {
    const top = clampNumber(clientY - geometry.trackTop - pointerOffset, 0, railScrollable);
    el.virtualScroll.scrollTop = (top / railScrollable) * scrollable;
    scheduleVirtualRows();
    updateLogScrollbar();
  };

  if (event.target !== el.logScrollbarThumb) {
    moveTo(event.clientY);
  }

  const handleMove = (moveEvent) => moveTo(moveEvent.clientY);
  const handleUp = () => {
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', handleUp);
  };

  window.addEventListener('pointermove', handleMove);
  window.addEventListener('pointerup', handleUp, { once: true });
}

function getLogScrollbarGeometry() {
  const railRect = el.logScrollbar.getBoundingClientRect();
  const scrollRect = el.virtualScroll.getBoundingClientRect();
  const panelRect = el.logScrollbar.closest('.log-panel')?.getBoundingClientRect();
  const trackTop = Math.max(
    railRect.top,
    scrollRect.top,
    panelRect ? panelRect.top : railRect.top
  );
  const trackBottom = Math.min(
    railRect.bottom,
    scrollRect.bottom,
    panelRect ? panelRect.bottom : railRect.bottom
  );
  const trackHeight = Math.max(1, trackBottom - trackTop);
  return {
    railTop: railRect.top,
    trackTop,
    trackHeight,
    trackOffsetTop: Math.max(0, trackTop - railRect.top)
  };
}

function getLogScrollRange(visibleHeight) {
  const pageIndices = getCurrentPageIndices();
  const metrics = buildVirtualMetrics(pageIndices);
  const fallbackHeight = Math.max(1, Number(visibleHeight) || 1);
  const viewportHeight = Math.max(1, el.virtualScroll.clientHeight || fallbackHeight);
  const endPadding = pageIndices.length ? VIRTUAL_SCROLL_END_PADDING : 0;
  const totalHeight = Math.max((metrics.totalHeight || 0) + endPadding, viewportHeight);
  return {
    scrollHeight: totalHeight,
    clientHeight: viewportHeight,
    scrollable: Math.max(0, totalHeight - viewportHeight)
  };
}

function toggleAiPromptPanel() {
  const willOpen = el.aiPromptPanel.classList.contains('hidden');
  el.aiPromptPanel.classList.toggle('hidden', !willOpen);
  el.btnAiPrompt.classList.toggle('active', willOpen);
  if (willOpen) requestAnimationFrame(() => el.aiGuidanceInput.focus());
}

function unlockAiConfig() {
  if (state.aiConfigUnlocked) {
    el.aiConfigBody.classList.toggle('hidden');
    return;
  }

  el.aiConfigPasswordRow.classList.remove('hidden');
  el.aiConfigLockState.textContent = 'Enter password';
  requestAnimationFrame(() => el.aiConfigPassword.focus());
}

function submitAiConfigPassword() {
  if (state.aiConfigUnlocked) return;
  const password = el.aiConfigPassword.value;
  if (password !== 'bltnteam') {
    el.aiConfigPassword.value = '';
    setAiStatus('AI / RAG config password is incorrect.', true);
    requestAnimationFrame(() => el.aiConfigPassword.focus());
    return;
  }

  state.aiConfigUnlocked = true;
  el.aiConfigPanel.classList.remove('locked');
  el.aiConfigPasswordRow.classList.add('hidden');
  el.aiConfigBody.classList.remove('hidden');
  el.aiConfigPassword.value = '';
  el.aiConfigLockState.textContent = 'Unlocked';
  setAiStatus('AI / RAG config unlocked.', false);
}

function handleParseEvent(event) {
  if (event.type === 'start') {
    el.parseStatus.textContent = `Parsing ${event.files.length} file(s)...`;
    el.parseProgress.style.width = '0%';
    return;
  }

  if (event.type === 'file-start') {
    state.files[event.fileIndex] = {
      fileName: event.fileName,
      filePath: event.filePath,
      size: event.size,
      messages: 0,
      parseMs: 0
    };
    renderFileList();
    return;
  }

  if (event.type === 'chunk') {
    appendMessages(event.messages || []);
    scheduleRender();
    return;
  }

  if (event.type === 'progress') {
    const pct = event.totalBytes ? Math.min(100, Math.round((event.loadedBytes / event.totalBytes) * 100)) : 0;
    el.parseProgress.style.width = `${pct}%`;
    el.parseStatus.textContent = `${event.fileName}: ${pct}% (${formatNumber(event.parsed)} messages)`;
    return;
  }

  if (event.type === 'file-done') {
    state.files[event.fileIndex] = event.summary;
    renderFileList();
    return;
  }

  if (event.type === 'done') {
    state.parseDone = true;
    el.parseProgress.style.width = '100%';
    el.parseStatus.textContent = `Loaded ${formatNumber(event.totalMessages)} messages in ${formatDuration(event.parseMs)}.`;
    applyFilters();
    maybeRunConfiguredAutoScan();
    return;
  }

  if (event.type === 'error') {
    el.parseStatus.textContent = `Parse error: ${event.error}`;
  }
}

function showUpdatePhase(phase) {
  [
    ['ask', el.updatePhaseAsk],
    ['downloading', el.updatePhaseDownloading],
    ['done', el.updatePhaseDone],
    ['error', el.updatePhaseError]
  ].forEach(([key, node]) => node && node.classList.toggle('hidden', key !== phase));
}

function handleUpdateStatus(status) {
  if (!status) return;
  const { state, version, percent, error } = status;

  if (el.btnCheckUpdate) el.btnCheckUpdate.classList.remove('checking');

  if (state === 'checking') {
    if (el.updateBar) {
      el.updateBar.classList.remove('hidden');
      el.updateBar.dataset.state = 'checking';
      if (el.updateBarIcon) el.updateBarIcon.textContent = '↻';
      if (el.updateBarMsg) el.updateBarMsg.textContent = 'Checking for updates...';
    }
    return;
  }

  if (el.updateBar) el.updateBar.classList.add('hidden');

  if (state === 'not-available') return;

  if (state === 'available') {
    if (el.updateModalVersion) {
      el.updateModalVersion.textContent = version ? `New version: v${version}` : 'A new version is available';
    }
    showUpdatePhase('ask');
    if (el.updateModalOverlay) el.updateModalOverlay.classList.remove('hidden');
    return;
  }

  if (state === 'downloading') {
    const pct = Math.round(percent || 0);
    showUpdatePhase('downloading');
    if (el.updateModalOverlay) el.updateModalOverlay.classList.remove('hidden');
    if (el.updateDlFill) el.updateDlFill.style.width = `${pct}%`;
    if (el.updateDlPct) el.updateDlPct.textContent = `${pct}%`;
    if (el.updateDlSize) {
      const xferred = status.transferred || 0;
      const total = status.total || 0;
      el.updateDlSize.textContent = total > 0
        ? `${formatBytes(xferred)} / ${formatBytes(total)}`
        : formatBytes(xferred);
    }
    if (el.updateDlSpeed && status.bytesPerSecond > 0) {
      el.updateDlSpeed.textContent = `${formatBytes(status.bytesPerSecond)}/s`;
    }
    return;
  }

  if (state === 'downloaded') {
    if (el.updateDonVersion) {
      el.updateDonVersion.textContent = version ? `v${version} is ready` : 'Ready to install';
    }
    showUpdatePhase('done');
    if (el.updateModalOverlay) el.updateModalOverlay.classList.remove('hidden');
    return;
  }

  if (state === 'error') {
    const isModalOpen = el.updateModalOverlay && !el.updateModalOverlay.classList.contains('hidden');
    if (isModalOpen) {
      if (el.updateErrorMsg) el.updateErrorMsg.textContent = error || 'Unknown error';
      showUpdatePhase('error');
    } else {
      if (el.updateBar) {
        el.updateBar.classList.remove('hidden');
        el.updateBar.dataset.state = 'error';
        if (el.updateBarIcon) el.updateBarIcon.textContent = '!';
        if (el.updateBarMsg) el.updateBarMsg.textContent = `Update error: ${error || 'unknown'}`;
      }
    }
  }
}

function appendMessages(messages) {
  for (const message of messages) {
    if (Number.isFinite(message.timeMs)) {
      state.firstTimeMs = state.firstTimeMs === null ? message.timeMs : Math.min(state.firstTimeMs, message.timeMs);
      state.lastTimeMs = state.lastTimeMs === null ? message.timeMs : Math.max(state.lastTimeMs, message.timeMs);
      message.relTimeMs = message.timeMs - state.firstTimeMs;
    } else {
      message.relTimeMs = message.id;
    }
    message.searchBlob = buildSearchBlob(message);
    state.messages.push(message);
  }
  updateRelativeTimes();
  if (!hasActiveFilters()) {
    for (let index = state.filtered.length; index < state.messages.length; index += 1) {
      state.filtered.push(index);
    }
  } else {
    applyFilters(false);
  }
}

function updateRelativeTimes() {
  const rangeAxis = buildRangeTimeAxisValues();
  for (let index = 0; index < state.messages.length; index += 1) {
    const message = state.messages[index];
    message.rangeTimeMs = rangeAxis[index] ?? index * SYNTHETIC_RANGE_STEP_MS;
    message.relTimeMs = Number.isFinite(message.timeMs) && Number.isFinite(state.firstTimeMs)
      ? message.timeMs - state.firstTimeMs
      : message.id;
  }
}

function buildRangeTimeAxisValues() {
  const clockAxis = buildClockTimeAxisValues();
  if (hasUsableAxisSpan(clockAxis)) return fillAxisGaps(clockAxis);

  return state.messages.map((_, index) => index * SYNTHETIC_RANGE_STEP_MS);
}

function buildClockTimeAxisValues() {
  let dayOffset = 0;
  let previous = null;
  return state.messages.map((message) => {
    const clockMs = parseClockTimeOfDayMs(message.time);
    if (!Number.isFinite(clockMs)) return NaN;

    let value = clockMs + dayOffset;
    while (previous !== null && value < previous) {
      dayOffset += DAY_MS;
      value = clockMs + dayOffset;
    }
    previous = value;
    return value;
  });
}

function hasUsableAxisSpan(values) {
  const finite = values.filter(Number.isFinite);
  if (finite.length < 2) return false;
  return Math.max(...finite) > Math.min(...finite);
}

function fillAxisGaps(values) {
  const result = values.slice();
  const finiteIndexes = result
    .map((value, index) => (Number.isFinite(value) ? index : -1))
    .filter((index) => index >= 0);
  if (!finiteIndexes.length) {
    return state.messages.map((_, index) => index * SYNTHETIC_RANGE_STEP_MS);
  }

  const firstIndex = finiteIndexes[0];
  for (let index = firstIndex - 1; index >= 0; index -= 1) {
    result[index] = result[index + 1] - SYNTHETIC_RANGE_STEP_MS;
  }

  for (let finiteIndex = 0; finiteIndex < finiteIndexes.length - 1; finiteIndex += 1) {
    const startIndex = finiteIndexes[finiteIndex];
    const endIndex = finiteIndexes[finiteIndex + 1];
    const startValue = result[startIndex];
    const endValue = result[endIndex];
    const gap = endIndex - startIndex;
    for (let index = startIndex + 1; index < endIndex; index += 1) {
      result[index] = startValue + ((endValue - startValue) * (index - startIndex)) / gap;
    }
  }

  const lastIndex = finiteIndexes[finiteIndexes.length - 1];
  for (let index = lastIndex + 1; index < result.length; index += 1) {
    result[index] = result[index - 1] + SYNTHETIC_RANGE_STEP_MS;
  }

  return result;
}

function applyFilters(render = true) {
  const matcher = buildTextMatcher();
  const activeRange = getActiveFilterRange();
  const levelFilter = state.levelFilter;
  const naturalFilter = state.naturalFilter;

  state.filtered = [];
  for (let index = 0; index < state.messages.length; index += 1) {
    const message = state.messages[index];
    if (levelFilter && levelFilter.size && !levelFilter.has(message.level)) continue;
    if (naturalFilter && !messageMatchesNaturalFilter(message, naturalFilter)) continue;
    if (activeRange && !messageWithinFilterRange(message, activeRange)) continue;
    if (matcher && !matcher(message)) continue;
    state.filtered.push(index);
  }

  state.currentPage = Math.min(state.currentPage, getTotalPages());
  if (render) renderAll();
}

function buildTextMatcher() {
  if (state.naturalFilter) {
    return null;
  }
  const query = el.searchInput.value.trim();
  if (!query) {
    return null;
  }

  const needle = normalizeSearchText(query);
  const compactNeedle = compactSearchText(query);

  return (message) => {
    return buildSearchTargets(message).some((value) => {
      const haystack = normalizeSearchText(value);
      if (needle && haystack.includes(needle)) return true;
      return Boolean(compactNeedle && compactSearchText(value).includes(compactNeedle));
    });
  };
}

function buildSearchTargets(message) {
  return [
    message.id,
    message.messageId,
    message.time,
    formatLogTime(message),
    formatDelta(message.deltaMs),
    message.length,
    message.payload,
    message.payloadAscii
  ].map((value) => String(value ?? '')).filter(Boolean);
}

function compactSearchText(value) {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, '');
}

function getActiveFilterRange() {
  if (!state.filterRange.dirty) return null;
  const from = Number(state.filterRange.from);
  const to = Number(state.filterRange.to);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return {
    unit: state.filterRange.unit || 'time',
    from: Math.min(from, to),
    to: Math.max(from, to)
  };
}

function messageWithinFilterRange(message, range) {
  if (range.unit === 'id') {
    return Number(message.id) >= range.from && Number(message.id) <= range.to;
  }
  const value = getMessageRangeTimeMs(message);
  if (!Number.isFinite(value)) return true;
  return value >= range.from && value <= range.to;
}

function buildSearchBlob(message) {
  return [
    message.payload,
    message.level,
    message.type,
    message.subtype,
    message.ecu,
    message.apid,
    message.ctid,
    message.fileName,
    message.messageId,
    message.time
  ].join(' ');
}

function hasActiveFilters() {
  return Boolean(
    el.searchInput.value.trim() ||
    state.filterRange.dirty ||
    (state.levelFilter && state.levelFilter.size) ||
    Boolean(state.naturalFilter)
  );
}

function resetFilters() {
  el.searchInput.value = '';
  if (el.focusSearchInput) el.focusSearchInput.value = '';
  if (el.naturalQuery) el.naturalQuery.value = '';
  resetFilterRange(false);
  if (el.caseSensitive) el.caseSensitive.checked = false;
  if (el.regexSearch) el.regexSearch.checked = false;
  if (el.searchField) el.searchField.value = 'payload-time';
  state.levelFilter = null;
  state.naturalFilter = null;
  state.currentPage = 1;
  applyFilters();
}

function scheduleRender() {
  if (state.renderQueued) return;
  state.renderQueued = true;
  requestAnimationFrame(() => {
    state.renderQueued = false;
    renderAll();
  });
}

function renderAll() {
  applyLogColumnTemplate();
  renderStats();
  renderPagination();
  renderVirtualRows();
  renderTimeline();
  renderMinimap();
  renderDetail(getSelectedMessage());
  syncFilterRangeControls();
  syncAiRangeControls();
  updateAiModeUi();
  updateChatRangeInfo();
}

function renderStats() {
  const messages = state.messages;
  const filteredMessages = state.filtered.map((index) => messages[index]);
  const errors = messages.filter((message) => message.level === 'Error' || message.level === 'Fatal').length;
  const warns = messages.filter((message) => message.level === 'Warn').length;
  const ecuCount = new Set(messages.map((message) => message.ecu).filter(Boolean)).size;
  const spanMs = state.firstTimeMs !== null && state.lastTimeMs !== null ? state.lastTimeMs - state.firstTimeMs : 0;

  el.statTotal.textContent = formatNumber(messages.length);
  el.statFiltered.textContent = formatNumber(filteredMessages.length);
  el.statErrors.textContent = formatNumber(errors);
  el.statWarns.textContent = formatNumber(warns);
  el.statEcu.textContent = formatNumber(ecuCount);
  el.statSpan.textContent = spanMs ? formatDuration(spanMs) : '-';
}

function renderPagination() {
  const totalPages = getTotalPages();
  state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);
  if (!el.pageInfo) return;
  el.pageInfo.textContent = `Page ${state.currentPage}/${totalPages}`;
  if (el.btnPrev) el.btnPrev.disabled = state.currentPage <= 1;
  if (el.btnNext) el.btnNext.disabled = state.currentPage >= totalPages;
}

function renderVirtualRows() {
  const pageIndices = getCurrentPageIndices();
  const count = pageIndices.length;
  const viewportHeight = el.virtualScroll.clientHeight || 1;
  const scrollTop = el.virtualScroll.scrollTop;
  const metrics = buildVirtualMetrics(pageIndices);
  const start = Math.max(0, findRowByOffset(metrics.offsets, scrollTop) - 8);
  const visibleBottom = scrollTop + viewportHeight + 420;
  let end = start;
  while (end < count && metrics.offsets[end] < visibleBottom && end - start < MAX_RENDER_ROWS) {
    end += 1;
  }
  end = Math.min(count, Math.max(end, start + 1));

  el.virtualSpacer.style.height = `${metrics.totalHeight + (count ? VIRTUAL_SCROLL_END_PADDING : 0)}px`;
  el.rowsLayer.style.transform = `translateY(${metrics.offsets[start] || 0}px)`;

  const rows = [];
  for (let localIndex = start; localIndex < end; localIndex += 1) {
    const message = state.messages[pageIndices[localIndex]];
    rows.push(renderRow(message, localIndex, metrics.heights[localIndex]));
  }
  el.rowsLayer.innerHTML = rows.join('');
  state.lastVirtualStart = start;
  state.lastVirtualEnd = end;
  state.lastVirtualCount = count;
  updateLogScrollbar();
}

function buildVirtualMetrics(pageIndices) {
  const payloadWidth = getPayloadColumnWidth();
  const cache = state.virtualMetrics;
  if (
    cache &&
    cache.indices === pageIndices &&
    cache.payloadWidth === payloadWidth &&
    cache.count === pageIndices.length
  ) {
    return cache;
  }

  const heights = new Array(pageIndices.length);
  const offsets = new Array(pageIndices.length + 1);
  offsets[0] = 0;
  for (let index = 0; index < pageIndices.length; index += 1) {
    const message = state.messages[pageIndices[index]];
    const height = estimateRowHeight(message, payloadWidth);
    heights[index] = height;
    offsets[index + 1] = offsets[index] + height;
  }

  state.virtualMetrics = {
    indices: pageIndices,
    payloadWidth,
    count: pageIndices.length,
    heights,
    offsets,
    totalHeight: offsets[pageIndices.length] || 0
  };
  return state.virtualMetrics;
}

function estimateRowHeight(message, payloadWidth) {
  const payload = String(message?.payload || '');
  if (!payload) return MIN_ROW_HEIGHT;
  const charsPerLine = Math.max(24, Math.floor((payloadWidth - 24) / ESTIMATED_MONO_CHAR_WIDTH));
  const lines = payload.split(/\r?\n/).reduce((total, line) => {
    return total + Math.max(1, Math.ceil(line.length / charsPerLine));
  }, 0);
  return Math.max(MIN_ROW_HEIGHT, Math.ceil(lines * ROW_LINE_HEIGHT + ROW_VERTICAL_PADDING));
}

function getPayloadColumnWidth() {
  if (el.virtualScroll && el.virtualScroll.clientWidth > 0) {
    const widths = state.logColumnWidths.map((w, i) => Math.max(MIN_LOG_COLUMNS[i], Number(w) || DEFAULT_LOG_COLUMNS[i]));
    const fixed = widths[0] + widths[1] + widths[2];
    return Math.max(MIN_LOG_COLUMNS[3], el.virtualScroll.clientWidth - fixed);
  }
  return Math.max(MIN_LOG_COLUMNS[3], Number(state.logColumnWidths[3]) || DEFAULT_LOG_COLUMNS[3]);
}

function findRowByOffset(offsets, value) {
  let low = 0;
  let high = Math.max(0, offsets.length - 2);
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (offsets[mid + 1] <= value) {
      low = mid + 1;
    } else if (offsets[mid] > value) {
      high = mid - 1;
    } else {
      return mid;
    }
  }
  return Math.max(0, Math.min(offsets.length - 2, low));
}

function scheduleVirtualRows() {
  if (state.virtualRenderQueued) return;
  state.virtualRenderQueued = true;
  requestAnimationFrame(() => {
    state.virtualRenderQueued = false;
    renderVirtualRows();
  });
}

function renderRow(message, localIndex, rowHeight) {
  const selected = state.selectedId === message.id;
  const aiHit = state.aiHighlights.has(message.id);
  const quickPending = state.quickAiPendingId === message.id;
  const quickDisabled = state.aiSending ? 'disabled' : '';
  const quickLabel = quickPending ? '...' : 'AI';
  return `
    <div class="log-row log-grid ${selected ? 'selected' : ''} ${aiHit ? 'ai-hit' : ''} ${quickPending ? 'quick-ai-pending' : ''}" data-id="${message.id}" data-local-index="${localIndex}" style="height:${rowHeight}px">
      <div>${highlightSearch(message.id)}</div>
      <div title="${escapeHtml(message.time)}">${highlightSearch(formatLogTime(message))}</div>
      <div>${highlightSearch(formatDelta(message.deltaMs))}</div>
      <div class="payload-cell" title="${escapeHtml(message.payload || '')}">${highlightSearch(message.payload || '')}</div>
      <button type="button" class="quick-ai-row-btn" data-id="${message.id}" ${quickDisabled} title="Explain this message with AI">${quickLabel}</button>
    </div>
  `;
}

function updateLogScrollbar() {
  if (!el.logScrollbar || !el.logScrollbarThumb) return;
  const geometry = getLogScrollbarGeometry();
  const railHeight = geometry.trackHeight;
  const { scrollHeight, clientHeight, scrollable } = getLogScrollRange(railHeight);

  if (!scrollable || !state.filtered.length) {
    el.logScrollbar.classList.add('disabled');
    el.logScrollbarThumb.style.height = `${Math.max(MIN_LOG_SCROLL_THUMB_HEIGHT, railHeight)}px`;
    el.logScrollbarThumb.style.transform = `translateY(${geometry.trackOffsetTop}px)`;
    return;
  }

  el.logScrollbar.classList.remove('disabled');
  const thumbHeight = clampNumber((clientHeight / scrollHeight) * railHeight, MIN_LOG_SCROLL_THUMB_HEIGHT, railHeight);
  const safeScrollTop = clampNumber(el.virtualScroll.scrollTop, 0, scrollable);
  const top = geometry.trackOffsetTop + (safeScrollTop / scrollable) * Math.max(0, railHeight - thumbHeight);
  el.logScrollbarThumb.style.height = `${thumbHeight}px`;
  el.logScrollbarThumb.style.transform = `translateY(${top}px)`;
}

function formatLogTime(message) {
  const full = String(message?.time || (Number.isFinite(message?.timeMs) ? formatTimeLabel(message.timeMs) : ''));
  if (state.showFullLogTime) return full || '-';
  const match = full.match(/\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/);
  if (match) return match[0];
  if (Number.isFinite(message?.timeMs)) return formatHourMinuteSecond(message.timeMs);
  return full || '-';
}

function initLogColumnResize() {
  if (!el.logHeader) return;
  const cells = Array.from(el.logHeader.children);
  cells.forEach((cell, index) => {
    cell.classList.add('log-header-cell');
    if (index >= cells.length - 1) return;
    const handle = document.createElement('span');
    handle.className = 'log-col-resizer';
    handle.title = 'Drag to resize column';
    handle.addEventListener('pointerdown', (event) => startLogColumnResize(event, index));
    cell.appendChild(handle);
  });
}

function startLogColumnResize(event, columnIndex) {
  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const startWidth = state.logColumnWidths[columnIndex] || DEFAULT_LOG_COLUMNS[columnIndex];
  document.body.classList.add('resizing-log-column');

  const handleMove = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    state.logColumnWidths[columnIndex] = clampNumber(startWidth + delta, MIN_LOG_COLUMNS[columnIndex], 1200);
    saveLogColumnWidths();
    applyLogColumnTemplate();
    state.virtualMetrics = null;
    scheduleVirtualRows();
  };
  const handleUp = () => {
    document.body.classList.remove('resizing-log-column');
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', handleUp);
  };

  window.addEventListener('pointermove', handleMove);
  window.addEventListener('pointerup', handleUp, { once: true });
}

function applyLogColumnTemplate() {
  const widths = state.logColumnWidths.map((width, index) => Math.max(MIN_LOG_COLUMNS[index], Number(width) || DEFAULT_LOG_COLUMNS[index]));
  const template = `${widths[0]}px ${widths[1]}px ${widths[2]}px minmax(0, 1fr)`;
  document.documentElement.style.setProperty('--log-grid-columns', template);
}

function loadLogColumnWidths() {
  try {
    const parsed = JSON.parse(localStorage.getItem('bltn-log-column-widths') || '[]');
    if (Array.isArray(parsed)) {
      const migrated = parsed.length >= 6
        ? [parsed[1], parsed[2], parsed[3], parsed[4]]
        : parsed.slice(0, DEFAULT_LOG_COLUMNS.length);
      if (migrated.length === DEFAULT_LOG_COLUMNS.length) {
        return migrated.map((value, index) => clampNumber(value, MIN_LOG_COLUMNS[index], 1200));
      }
    }
  } catch (_error) {
    // Ignore invalid saved UI state.
  }
  return DEFAULT_LOG_COLUMNS.slice();
}

function saveLogColumnWidths() {
  try {
    localStorage.setItem('bltn-log-column-widths', JSON.stringify(state.logColumnWidths));
  } catch (_error) {
    // Local storage can be unavailable in restricted contexts.
  }
}

function handleRowClick(event) {
  const quickAiButton = event.target.closest('.quick-ai-row-btn');
  if (quickAiButton) {
    event.preventDefault();
    event.stopPropagation();
    runQuickRowAi(Number(quickAiButton.dataset.id));
    return;
  }

  const row = event.target.closest('.log-row');
  if (!row) return;
  const id = Number(row.dataset.id);
  selectMessage(id, false);
}

function selectMessage(id, ensureVisible) {
  if (!Number.isFinite(id)) return;
  state.selectedId = id;
  if (ensureVisible) {
    scrollToMessage(id);
  }
  renderVirtualRows();
  renderDetail(getSelectedMessage());
  updateChatRangeInfo();
}

function scrollToMessage(id) {
  const pageIndices = getCurrentPageIndices();
  const messageIndex = state.messages.findIndex((message) => message.id === id);
  const localIndex = pageIndices.indexOf(messageIndex);
  if (localIndex >= 0) {
    const metrics = buildVirtualMetrics(pageIndices);
    const viewportHeight = el.virtualScroll.clientHeight || 0;
    const currentScroll = el.virtualScroll.scrollTop;
    const rowTop = metrics.offsets[localIndex] || 0;
    const rowBottom = metrics.offsets[localIndex + 1] || rowTop + MIN_ROW_HEIGHT;
    const visibleTop = currentScroll + MIN_ROW_HEIGHT;
    const visibleBottom = currentScroll + viewportHeight - MIN_ROW_HEIGHT;
    const maxScroll = Math.max(0, metrics.totalHeight + VIRTUAL_SCROLL_END_PADDING - viewportHeight);
    if (rowTop < visibleTop) {
      el.virtualScroll.scrollTop = clampNumber(rowTop - MIN_ROW_HEIGHT, 0, maxScroll);
    } else if (rowBottom > visibleBottom) {
      el.virtualScroll.scrollTop = clampNumber(rowBottom - viewportHeight + MIN_ROW_HEIGHT, 0, maxScroll);
    }
    return;
  }

  const filteredPosition = state.filtered.indexOf(messageIndex);
  if (filteredPosition >= 0 && state.pageSize !== 'all') {
    state.currentPage = Math.floor(filteredPosition / Number(state.pageSize)) + 1;
    renderPagination();
    const metrics = buildVirtualMetrics(getCurrentPageIndices());
    el.virtualScroll.scrollTop = metrics.offsets[filteredPosition % Number(state.pageSize)] || 0;
  }
}

function renderTimeline() {
  const canvas = el.timeline;
  const ctx = setupCanvas(canvas);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  ctx.fillRect(0, 0, width, height);

  const messages = state.filtered.map((index) => state.messages[index]).filter((message) => Number.isFinite(message.timeMs));
  if (!messages.length) {
    el.timelineLabel.textContent = '';
    return;
  }

  const min = Math.min(...messages.map((message) => message.timeMs));
  const max = Math.max(...messages.map((message) => message.timeMs));
  const span = Math.max(1, max - min);
  const bins = Array.from({ length: Math.max(20, Math.floor(width / 5)) }, () => ({ normal: 0, warn: 0, error: 0, ai: 0 }));
  const top = 16;
  const bottom = height - 24;
  const plotHeight = Math.max(20, bottom - top);

  for (const message of messages) {
    const bin = Math.min(bins.length - 1, Math.floor(((message.timeMs - min) / span) * bins.length));
    if (state.aiHighlights.has(message.id)) bins[bin].ai += 1;
    else if (message.level === 'Fatal' || message.level === 'Error') bins[bin].error += 1;
    else if (message.level === 'Warn') bins[bin].warn += 1;
    else bins[bin].normal += 1;
  }

  const maxCount = Math.max(1, ...bins.map((bin) => bin.normal + bin.warn + bin.error + bin.ai));
  const barWidth = width / bins.length;
  drawMinuteTicks(ctx, min, max, width, height, top, bottom);
  bins.forEach((bin, index) => {
    let y = bottom;
    drawStack(ctx, index * barWidth, y, barWidth, bin.normal, maxCount, '#65b5ff', plotHeight);
    y -= (bin.normal / maxCount) * plotHeight;
    drawStack(ctx, index * barWidth, y, barWidth, bin.warn, maxCount, '#f7c948', plotHeight);
    y -= (bin.warn / maxCount) * plotHeight;
    drawStack(ctx, index * barWidth, y, barWidth, bin.error, maxCount, '#ff5c6c', plotHeight);
    y -= (bin.error / maxCount) * plotHeight;
    drawStack(ctx, index * barWidth, y, barWidth, bin.ai, maxCount, '#00b8a9', plotHeight);
  });

  el.timelineLabel.textContent = '';
}

function drawStack(ctx, x, yBottom, barWidth, count, maxCount, color, plotHeight) {
  if (!count) return;
  const barHeight = Math.max(1, (count / maxCount) * plotHeight);
  ctx.fillStyle = color;
  ctx.fillRect(x, yBottom - barHeight, Math.max(1, barWidth - 1), barHeight);
}

function drawMinuteTicks(ctx, min, max, width, height, top, bottom) {
  const minuteMs = 60 * 1000;
  const firstMinute = Math.ceil(min / minuteMs) * minuteMs;
  if (!Number.isFinite(firstMinute)) return;
  if (firstMinute > max) {
    ctx.save();
    ctx.font = '10px Cascadia Code, Consolas, monospace';
    ctx.fillStyle = 'rgba(237,247,242,0.56)';
    ctx.fillText(formatMinuteTick(min), 8, height - 7);
    ctx.restore();
    return;
  }

  const minuteCount = Math.max(1, Math.floor((max - firstMinute) / minuteMs) + 1);
  const labelEvery = Math.max(1, Math.ceil(minuteCount / Math.max(1, Math.floor(width / 58))));
  ctx.save();
  ctx.font = '10px Cascadia Code, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.strokeStyle = 'rgba(237,247,242,0.11)';
  ctx.fillStyle = 'rgba(237,247,242,0.56)';

  let index = 0;
  for (let tick = firstMinute; tick <= max; tick += minuteMs) {
    const x = ((tick - min) / Math.max(1, max - min)) * width;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    if (index % labelEvery === 0) {
      ctx.fillText(formatMinuteTick(tick), Math.min(width - 46, x + 3), height - 7);
    }
    index += 1;
  }
  ctx.restore();
}

function renderMinimap() {
  const canvas = el.minimap;
  const ctx = setupCanvas(canvas);
  const width = canvas.clientWidth || 18;
  const height = canvas.clientHeight || 1;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(0, 0, width, height);

  if (!state.messages.length) return;
  for (const message of state.messages) {
    const y = Math.min(height - 1, Math.floor((message.id / Math.max(1, state.messages.length - 1)) * height));
    if (state.aiHighlights.has(message.id)) ctx.fillStyle = '#00b8a9';
    else if (message.level === 'Fatal' || message.level === 'Error') ctx.fillStyle = '#ff5c6c';
    else if (message.level === 'Warn') ctx.fillStyle = '#f7c948';
    else continue;
    ctx.fillRect(0, y, width, 2);
  }
}

function renderDetail(message) {
  if (!message) {
    el.detailEmpty.classList.remove('hidden');
    el.detailPanel.classList.add('hidden');
    return;
  }

  el.detailEmpty.classList.add('hidden');
  el.detailPanel.classList.remove('hidden');
  el.detailPanel.innerHTML = `
    ${kv('File', message.fileName)}
    ${kv('Timestamp', message.time)}
    <div class="raw-box">Payload\n${escapeHtml(message.payload || '')}</div>
  `;
}

function kv(label, value) {
  return `<div class="detail-kv"><span>${escapeHtml(label)}</span><span>${escapeHtml(String(value ?? ''))}</span></div>`;
}

function renderFileList() {
  el.fileList.innerHTML = state.files.filter(Boolean).map((file) => `
    <div class="file-item">
      <strong>${escapeHtml(file.fileName)}</strong><br>
      ${formatBytes(file.size || 0)} | ${formatNumber(file.messages || 0)} msg | ${file.parser || 'pending'} | ${file.parseMs ? formatDuration(file.parseMs) : ''}
    </div>
  `).join('');
}

async function loadAiConfig() {
  state.aiConfig = await api.getAiConfig();
  el.aiBaseUrl.value = state.aiConfig.baseUrl || '';
  const quickAi = state.aiConfig.quickAi || {};
  el.quickAiBaseUrl.value = quickAi.baseUrl || state.aiConfig.baseUrl || '';
  el.quickAiPrompt.value = quickAi.prompt || '';
  el.aiHeaders.value = JSON.stringify(state.aiConfig.headers || {}, null, 2);
  el.aiAutoScan.checked = Boolean(state.aiConfig.autoScan);
  el.aiWindow.value = state.aiConfig.contextWindowMs || 500;
  if (el.aiMaxLogLines) {
    el.aiMaxLogLines.value = state.aiConfig.maxLogLines || DEFAULT_AI_MAX_LOG_LINES;
  }
  el.aiKey.placeholder = state.aiConfig.apiKeySet ? `Saved ${state.aiConfig.apiKeyPreview}` : 'Paste API key';
  el.quickAiKey.placeholder = quickAi.apiKeySet
    ? `Saved ${quickAi.apiKeyPreview}`
    : (state.aiConfig.apiKeySet ? 'Uses main AI key' : 'Paste API key');
  await refreshAiModelOptions({
    model: state.aiConfig.model || DEFAULT_RUNTIME_MODEL,
    runtimeModel: el.aiRuntimeModel?.value || '',
    quickModel: quickAi.model || DEFAULT_QUICK_AI_MODEL
  });
}

function setConfiguredModelSelection(model) {
  if (!el.aiModel) return;
  const baseUrl = el.aiBaseUrl?.value || state.aiConfig?.baseUrl || '';
  el.aiModel.value = resolveConfiguredModelSelection(el.aiModel, model, baseUrl);
}

function setRuntimeModelSelection(model) {
  if (!el.aiRuntimeModel) return;
  if (!model) {
    el.aiRuntimeModel.value = '';
    return;
  }
  const baseUrl = el.aiBaseUrl?.value || state.aiConfig?.baseUrl || '';
  el.aiRuntimeModel.value = resolveRuntimeModelSelection(el.aiRuntimeModel, model, baseUrl);
}

function setQuickAiModelSelection(model) {
  if (!el.quickAiModel) return;
  const baseUrl = el.quickAiBaseUrl?.value || state.aiConfig?.quickAi?.baseUrl || state.aiConfig?.baseUrl || '';
  el.quickAiModel.value = resolveQuickModelSelection(el.quickAiModel, model, baseUrl);
}

async function refreshAiModelOptions(selection = {}) {
  const modelSelection = selection.model || el.aiModel?.value || state.aiConfig?.model || DEFAULT_RUNTIME_MODEL;
  const runtimeSelection = Object.prototype.hasOwnProperty.call(selection, 'runtimeModel')
    ? selection.runtimeModel
    : (el.aiRuntimeModel?.value || '');
  const quickSelection = selection.quickModel || el.quickAiModel?.value || state.aiConfig?.quickAi?.model || DEFAULT_QUICK_AI_MODEL;
  const headers = readAiHeadersForLookup();
  const mainBaseUrl = el.aiBaseUrl?.value || state.aiConfig?.baseUrl || '';
  const quickBaseUrl = el.quickAiBaseUrl?.value || state.aiConfig?.quickAi?.baseUrl || mainBaseUrl;

  const [mainModels, quickModels] = await Promise.all([
    fetchAiModelOptions(mainBaseUrl, el.aiKey?.value || '', headers, [modelSelection, runtimeSelection, DEFAULT_RUNTIME_MODEL]),
    fetchAiModelOptions(quickBaseUrl, el.quickAiKey?.value || '', headers, [quickSelection, DEFAULT_QUICK_AI_MODEL])
  ]);

  setModelSelectOptions(el.aiModel, mainModels);
  setModelSelectOptions(el.aiRuntimeModel, mainModels, { includeConfigDefault: true });
  setModelSelectOptions(el.quickAiModel, quickModels);
  setConfiguredModelSelection(modelSelection);
  setRuntimeModelSelection(runtimeSelection);
  setQuickAiModelSelection(quickSelection);
}

async function fetchAiModelOptions(baseUrl, apiKey, headers, fallbackModels = []) {
  const fallback = fallbackModelOptions(baseUrl, fallbackModels);
  if (!api.listAiModels || !String(baseUrl || '').trim()) {
    return fallback;
  }

  try {
    const response = await api.listAiModels({ baseUrl, apiKey, headers });
    if (response.ok && Array.isArray(response.models) && response.models.length) {
      return normalizeUiModelOptions([...fallback, ...response.models]);
    }
  } catch (_error) {
    // Fallback keeps the UI usable when a provider does not expose /models.
  }
  return fallback;
}

function setModelSelectOptions(select, models, options = {}) {
  if (!select) return;
  const fragment = document.createDocumentFragment();
  if (options.includeConfigDefault) {
    fragment.appendChild(new Option('Config Default', ''));
  }
  for (const model of normalizeUiModelOptions(models)) {
    const label = model.label && model.label !== model.id
      ? `${model.label} (${model.id})`
      : model.id;
    fragment.appendChild(new Option(label, model.id));
  }
  select.replaceChildren(fragment);
}

function fallbackModelOptions(baseUrl, preferredModels = []) {
  const isRouter = String(baseUrl || '').includes('9router.com');
  const ids = isRouter
    ? ['cx/gpt-5.3-codex-xhigh', 'cx/gpt-5.1-codex-max', 'cx/gpt-5.2', 'cx/gpt-5.4', 'cx/gpt-5.5', 'cx/gpt-5.1-codex-mini', 'cx/gpt-5-codex-mini']
    : ['gpt-5.3-codex-xhigh', 'gpt-5.1-codex-max', 'gpt-5.2', 'gpt-5.4', 'gpt-5.5', 'gpt-5.1-codex-mini', 'gpt-5-codex-mini'];
  const preferred = preferredModels
    .map((model) => normalizeUiModelForBaseUrl(baseUrl, model))
    .filter(Boolean);
  return normalizeUiModelOptions([...preferred, ...ids]);
}

function normalizeUiModelOptions(models) {
  const normalized = [];
  const seen = new Set();
  for (const item of models || []) {
    const id = typeof item === 'string'
      ? item
      : item?.id || item?.model || item?.name || item?.value;
    const value = String(id || '').trim();
    if (!value) continue;

    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const label = typeof item === 'string'
      ? value
      : String(item?.label || item?.display_name || item?.name || value).trim() || value;
    normalized.push({ id: value, label });
  }
  return normalized;
}

function resolveConfiguredModelSelection(select, model, baseUrl) {
  const values = Array.from(select.options || []).map((option) => option.value);
  const candidates = [
    ...(isPreviousDefaultStrongAiModel(model) ? [] : modelValueCandidates(model, baseUrl)),
    ...modelValueCandidates(DEFAULT_RUNTIME_MODEL, baseUrl)
  ];

  for (const candidate of candidates) {
    if (values.includes(candidate)) return candidate;
  }

  return values.find((value) => value) || '';
}

function resolveRuntimeModelSelection(select, model, baseUrl) {
  const values = Array.from(select.options || []).map((option) => option.value);
  const candidates = [
    ...(isPreviousDefaultStrongAiModel(model) ? [] : modelValueCandidates(model, baseUrl)),
    ...modelValueCandidates(DEFAULT_RUNTIME_MODEL, baseUrl)
  ];

  for (const candidate of candidates) {
    if (values.includes(candidate)) return candidate;
  }

  return strongestModelValue(values) || values.find((value) => value) || '';
}

function resolveQuickModelSelection(select, model, baseUrl) {
  const values = Array.from(select.options || []).map((option) => option.value);
  const candidates = [
    ...(isLegacyQuickAiModel(model) || isPreviousDefaultStrongAiModel(model) ? [] : modelValueCandidates(model, baseUrl)),
    ...modelValueCandidates(DEFAULT_QUICK_AI_MODEL, baseUrl)
  ];

  for (const candidate of candidates) {
    if (values.includes(candidate)) return candidate;
  }

  return strongestModelValue(values) || values.find((value) => value) || '';
}

function modelValueCandidates(model, baseUrl) {
  const value = String(model || '').trim();
  if (!value) return [];
  const leaf = modelLeaf(value);
  const candidates = [
    value,
    normalizeUiModelForBaseUrl(baseUrl, value),
    leaf
  ];
  if (String(baseUrl || '').includes('9router.com')) {
    candidates.push(`cx/${leaf}`);
  }
  return Array.from(new Set(candidates.filter(Boolean)));
}

function modelLeaf(model) {
  const value = String(model || '').trim();
  return value.includes('/') ? value.split('/').pop() : value;
}

function isLegacyQuickAiModel(model) {
  const value = String(model || '').trim().toLowerCase();
  const leaf = modelLeaf(value);
  return LEGACY_QUICK_AI_MODELS.has(value) || LEGACY_QUICK_AI_MODELS.has(leaf);
}

function isPreviousDefaultStrongAiModel(model) {
  const value = String(model || '').trim().toLowerCase();
  const leaf = modelLeaf(value);
  return PREVIOUS_DEFAULT_STRONG_AI_MODELS.has(value) || PREVIOUS_DEFAULT_STRONG_AI_MODELS.has(leaf);
}

function strongestModelValue(values) {
  return values
    .filter(Boolean)
    .slice()
    .sort((a, b) => modelStrengthScore(b) - modelStrengthScore(a))[0] || '';
}

function modelStrengthScore(model) {
  const leaf = modelLeaf(model).toLowerCase();
  let score = modelVersionScore(leaf) * 100;
  if (leaf.includes('nano')) score -= 40;
  if (leaf.includes('mini')) score -= 25;
  if (leaf.includes('low')) score -= 10;
  if (leaf.includes('none')) score -= 8;
  if (leaf.includes('high')) score += 8;
  if (leaf.includes('xhigh') || leaf.includes('max')) score += 12;
  return score;
}

function modelVersionScore(model) {
  const match = String(model || '').match(/gpt-(\d+(?:\.\d+)?)/i);
  if (!match) return 0;
  const [major, minor = '0'] = match[1].split('.');
  return Number(major || 0) * 100 + Number(minor || 0);
}

function normalizeUiModelForBaseUrl(baseUrl, model) {
  const value = String(model || '').trim();
  if (String(baseUrl || '').includes('9router.com') && value && !value.includes('/')) {
    return `cx/${value}`;
  }
  return value;
}

function readAiHeadersForLookup() {
  try {
    const parsed = JSON.parse(el.aiHeaders?.value || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (_error) {
    return state.aiConfig?.headers || {};
  }
}

async function saveAiConfig() {
  let headers = {};
  try {
    headers = JSON.parse(el.aiHeaders.value || '{}');
  } catch (error) {
    setAiStatus(`Invalid headers JSON: ${error.message}`, true);
    return;
  }

  const runtimeModel = el.aiRuntimeModel?.value || '';
  state.aiConfig = await api.saveAiConfig({
    baseUrl: el.aiBaseUrl.value,
    model: el.aiModel.value,
    apiKey: el.aiKey.value,
    quickAi: {
      baseUrl: el.quickAiBaseUrl.value,
      model: el.quickAiModel.value,
      apiKey: el.quickAiKey.value,
      prompt: el.quickAiPrompt.value
    },
    headers,
    autoScan: el.aiAutoScan.checked,
    contextWindowMs: Number(el.aiWindow.value || 500),
    maxLogLines: Number(el.aiMaxLogLines?.value || DEFAULT_AI_MAX_LOG_LINES)
  });
  el.aiKey.value = '';
  el.quickAiKey.value = '';
  el.aiKey.placeholder = state.aiConfig.apiKeySet ? `Saved ${state.aiConfig.apiKeyPreview}` : 'Paste API key';
  const quickAi = state.aiConfig.quickAi || {};
  el.quickAiKey.placeholder = quickAi.apiKeySet
    ? `Saved ${quickAi.apiKeyPreview}`
    : (state.aiConfig.apiKeySet ? 'Uses main AI key' : 'Paste API key');
  el.quickAiPrompt.value = quickAi.prompt || '';
  el.quickAiBaseUrl.value = quickAi.baseUrl || state.aiConfig.baseUrl || '';
  await refreshAiModelOptions({
    runtimeModel,
    quickModel: quickAi.model || DEFAULT_QUICK_AI_MODEL
  });
  setAiStatus('AI config saved.', false);
}

async function refreshDocsStatus() {
  const status = await api.getDocsStatus();
  el.docsStatus.textContent = `Docs: ${status.chunks || 0} chunks, ${status.terms || 0} terms`;
  if (status.sources?.length) {
    el.docsStatus.title = status.sources.map((source) => `${source.fileName}: ${source.chunks} chunks${source.error ? ` (${source.error})` : ''}`).join('\n');
  }
}

async function addDocs() {
  const paths = await api.openDocsDialog();
  if (!paths.length) return;
  const status = await api.ingestDocs(paths);
  el.docsStatus.textContent = `Docs: ${status.chunks || 0} chunks, ${status.terms || 0} terms`;
}

async function downloadUserGuide() {
  const guide = await api.getUserGuide();
  if (!guide.ok) {
    el.parseStatus.textContent = guide.error || 'USER_GUIDE_EN.md was not found.';
    return;
  }
  const result = await api.saveExport({
    title: 'Download User Guide',
    defaultPath: guide.fileName || 'USER_GUIDE_EN.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
    content: guide.content || ''
  });
  if (result.ok) {
    el.parseStatus.textContent = `Saved guide: ${result.filePath}`;
  }
}

function buildUserGuideContent() {
  return [
    '# BLTN-Analysis Log User Guide',
    '',
    '## 1. Open and read logs',
    '- Click `Open DLT` or drop `.dlt`, `.log`, or `.bin` files into the app.',
    '- Large logs are parsed in the background and rendered with virtual scrolling.',
    '- Use `Log AI Focus` to split the screen: logs on the left, AI Diagnostic Report on the right.',
    '',
    '## 2. Log table',
    '- `#`: message order.',
    '- `Time`: shows `HH:mm:ss` by default; tick the checkbox beside `Time` to show the full date-time.',
    '- `Delta`: time gap from the previous message.',
    '- `Payload`: message content. In `Log AI Focus`, hover a long payload to inspect more content.',
    '- Drag the header separators to resize columns.',
    '',
    '## 3. Search and filter',
    '- The left panel has `Search / Filter` for payload/time search, Time Range, and AI Search.',
    '- In `Log AI Focus`, click the small `Search` button above the table for quick search.',
    '- `AI Search` converts a natural-language query into a local filter.',
    '',
    '## 4. AI Diagnostic Report',
    '- Choose a mode beside `Send`: `Current line`, `Range`, `All current line`, or `Bug`.',
    '- `Range` shows a two-handle time slider for the log window sent to AI.',
    '- `Potential Bug` sends the full log up to `Max AI messages`.',
    '- When `Send` is pressed, the button stays locked until AI returns a response or an error.',
    '- The app sends only message id, payload, and `system_space` documentation to reduce tokens.',
    '- The default AI context limit is 27,000 messages. Change `Max AI messages` in `AI / RAG Config` if a provider needs a lower cap.',
    '',
    '## 5. AI prompt guidance',
    '- Click `Prompt` next to `AI Diagnostic Report` to enter response guidance.',
    '- If the guidance is empty, only your chat question and the selected log context are sent.',
    '- The row AI button only explains the clicked message unless you enter optional Row AI Prompt text.',
    '',
    '## 6. ECU docs / RAG',
    '- Click `Add ECU Docs` to load ECU/FIBEX/ARXML/TXT/DOCX documentation.',
    '- AI may use several snippets from one document, for example `8 snippets / 1 ECU document`.',
    '- `AI / RAG Config` is locked by default. Enter the team password to edit advanced settings.',
    '- `Default AI Model` is saved and reused when the app opens again.',
    '',
    '## 7. Export data',
    '- Use `Export CSV` in Search / Filter to save currently filtered rows.',
    '- Click a row to inspect its payload in Message Detail.',
    '',
    '## 8. Notes',
    '- Non-verbose DLT requires FIBEX/ARXML mapping for complete payload decoding.',
    '- If whole-log AI analysis is too slow, switch to `Time Range` to reduce context.'
  ].join('\n');
}

async function maybeRunConfiguredAutoScan() {
  const config = await api.getAiConfig();
  state.aiConfig = config;
  if (config.autoScan && config.apiKeySet) {
    setAiChatMode(DEFAULT_AI_CHAT_MODE);
    setAiStatus('All current line mode is selected. AI will run only when you press Send.', false);
  }
}

async function runAutoAiScan() {
  if (!state.messages.length) {
    setAiStatus('No logs are available for auto-scan. Open a DLT/log file first.', true);
    renderAiObject('Auto Scan', {
      summary: 'No log data is available.',
      recommended_action: 'Open a log file first, then run AI Auto Scan.'
    });
    return;
  }

  const clusters = buildFaultClusters();
  const contextMessages = [];
  const seen = new Set();
  const targets = clusters.length ? clusters : buildSuspiciousAutoScanTargets();

  if (!targets.length) {
    const fallback = buildBroadAutoScanTarget();
    if (fallback) {
      targets.push(fallback);
    }
  }

  if (!targets.length) {
    setAiStatus('Auto-scan did not find enough candidate messages to analyze.', true);
    renderAiObject('Auto Scan', {
      summary: 'No Error/Fatal/Warn or suspicious keywords were found in the log.',
      recommended_action: 'Use Search or manually select a time/ID range.'
    });
    return;
  }

  setAiStatus(`Auto-scan is analyzing ${targets.length} suspicious cluster(s)...`, false);
  for (const cluster of targets.slice(0, 10)) {
    for (const message of buildLocalContext(cluster.fromMs, cluster.toMs, Number(el.aiWindow.value || 500), 220)) {
      if (!seen.has(message.id)) {
        contextMessages.push(message);
        seen.add(message.id);
      }
    }
  }

  await runAiAnalysis({
    title: 'Overall diagnostic report from Auto-scan',
    mode: 'auto-scan',
    query: clusters.length
      ? 'Analyze all Error/Fatal clusters and find the most likely root cause for the Built-in Cam ECU. Answer in the same language as the user question.'
      : 'The log has no clear Error/Fatal rows. Analyze Warn/suspicious keywords and find potential anomalies in the Built-in Cam ECU. Answer in the same language as the user question.',
    messages: contextMessages,
    stats: collectStats(),
    selectedIds: targets.flatMap((cluster) => cluster.ids)
  });
}

async function analyzeSelected() {
  const message = getSelectedMessage();
  if (!message) return;
  const context = buildLocalContext(message.timeMs, message.timeMs, Number(el.aiWindow.value || 500), 700);
  await runAiAnalysis({
    title: `Analyze message ${message.id}`,
    mode: 'selected-message',
    query: `Analyze selected message #${message.id} and attached payload context. Find the fault, root cause, and fault analysis.`,
    messages: context,
    selectedIds: [message.id],
    fromMs: message.timeMs,
    toMs: message.timeMs,
    stats: collectStats()
  });
}

async function sendAiChat(mode) {
  if (state.aiSending) return;
  mode = mode === 'auto' ? state.aiChatMode : (mode || state.aiChatMode);
  const typedQuestion = el.aiChatInput.value.trim();
  const question = typedQuestion || defaultChatQuestion(mode);
  if (!question) {
    setAiStatus('Enter a question for AI or choose a mode.', true);
    return;
  }

  const rawContextMessages = buildChatContextMessages(mode);
  if (!rawContextMessages.length) {
    setAiStatus('No log context is available. Open a log file first.', true);
    return;
  }
  const selectedContextId = mode === 'selection' ? state.selectedId : null;
  const maxLogLines = getAiChatMaxLogLines(mode, rawContextMessages.length);
  const rawMessagesForAi = limitAiContextMessagesSequential(rawContextMessages, maxLogLines);
  const contextMessages = rawMessagesForAi.map((message) => (
    selectedContextId !== null ? toCurrentLineAiMessage(message, selectedContextId) : toAiMessage(message)
  ));
  const aiQuestion = withHiddenAiInstructions(question, mode);
  const estimatedContextMessages = contextMessages.length;

  appendChatBubble('user', question, estimatedContextMessages);
  const pendingBubble = appendChatBubble('assistant', 'AI is analyzing the context and waiting for the full response...', estimatedContextMessages, null, null, { pending: true });
  el.aiChatInput.value = '';
  setAiSending(true);
  setAiStatus(`AI is processing up to ${formatNumber(estimatedContextMessages)} context messages...`, false);

  try {
    const response = await api.chatWithAi({
      question: aiQuestion,
      mode,
      model: el.aiRuntimeModel.value || '',
      messages: contextMessages,
      includeSystemSpaceDocs: true,
      selectedIds: selectedContextId !== null ? [selectedContextId] : [],
      stats: collectAiStats(mode, rawMessagesForAi),
      maxLogLines
    });
    if (!response.ok) {
      updateChatBubble(pendingBubble, 'assistant', `AI error: ${response.error || 'AI call failed.'}`, null, null, null, { scroll: 'top' });
      setAiStatus(response.error || 'AI chat failed.', true);
      return;
    }

    const resultText = String(response.result || '').trim();
    if (!resultText) {
      throw new Error('AI returned an empty response. The chat is not complete; try again or reduce the range if the model is overloaded.');
    }

    const responseMeta = {
      contextMessages: response.promptStats?.contextMessages || contextMessages.length,
      docs: response.promptStats?.docs || 0,
      docSources: response.promptStats?.docSources || 0
    };
    updateChatBubble(pendingBubble, 'assistant', resultText, responseMeta.contextMessages, responseMeta.docs, responseMeta.docSources, { scroll: 'top' });
    setAiStatus(`AI chat complete. Sent ${formatNumber(responseMeta.contextMessages)} messages and ${formatAiDocUsage(responseMeta)}.`, false);
  } catch (error) {
    updateChatBubble(pendingBubble, 'assistant', `AI error: ${error.message}`, null, null, null, { scroll: 'top' });
    setAiStatus(`AI chat error: ${error.message}`, true);
  } finally {
    setAiSending(false);
  }
}

async function runQuickRowAi(messageId) {
  if (state.aiSending) return;
  const target = state.messages.find((message) => message.id === messageId);
  if (!target) return;

  selectMessage(target.id, false);
  const rawContextMessages = buildQuickAiContextMessages(target);
  if (!rawContextMessages.length) {
    setAiStatus('No nearby log context is available for this message.', true);
    return;
  }

  const contextMessages = rawContextMessages.map((message) => toQuickAiMessage(message, target.id));
  const prompt = getQuickAiPrompt();
  const question = buildQuickAiQuestion(target, prompt);
  const maxLogLines = contextMessages.length;

  appendChatBubble('user', `Explain message #${target.id}\n${String(target.payload || '').slice(0, 260)}`, contextMessages.length);
  const pendingBubble = appendChatBubble('assistant', `AI is explaining message #${target.id}...`, contextMessages.length, null, null, { pending: true });

  state.quickAiPendingId = target.id;
  setAiSending(true);
  setAiStatus(`AI is explaining message #${target.id} with nearby context...`, false);

  try {
    const response = await api.chatWithAi({
      profile: 'quick-row',
      question,
      mode: 'quick-row',
      model: el.quickAiModel?.value || '',
      messages: contextMessages,
      includeSystemSpaceDocs: true,
      selectedIds: [target.id],
      stats: collectAiStats('quick-row', rawContextMessages),
      maxLogLines
    });
    if (!response.ok) {
      updateChatBubble(pendingBubble, 'assistant', `AI error: ${response.error || 'AI call failed.'}`, null, null, null, { scroll: 'top' });
      setAiStatus(response.error || 'Quick row AI failed.', true);
      return;
    }

    const resultText = String(response.result || '').trim();
    if (!resultText) {
      throw new Error('AI returned an empty response.');
    }

    const responseMeta = {
      contextMessages: response.promptStats?.contextMessages || contextMessages.length,
      docs: response.promptStats?.docs || 0,
      docSources: response.promptStats?.docSources || 0
    };
    updateChatBubble(pendingBubble, 'assistant', resultText, responseMeta.contextMessages, responseMeta.docs, responseMeta.docSources, { scroll: 'top' });
    setAiStatus(`AI explained message #${target.id}. Sent ${formatNumber(responseMeta.contextMessages)} nearby messages and ${formatAiDocUsage(responseMeta)}.`, false);
  } catch (error) {
    updateChatBubble(pendingBubble, 'assistant', `AI error: ${error.message}`, null, null, null, { scroll: 'top' });
    setAiStatus(`Quick row AI error: ${error.message}`, true);
  } finally {
    state.quickAiPendingId = null;
    setAiSending(false);
  }
}

function buildQuickAiContextMessages(target) {
  return target ? [target] : [];
}

function getQuickAiPrompt() {
  return String(el.quickAiPrompt?.value || state.aiConfig?.quickAi?.prompt || '').trim();
}

function buildQuickAiQuestion(target, prompt) {
  return [
    'Explain only what this single DLT log message means. Do not diagnose a fault, root cause, impact, or reproduction unless the optional user prompt explicitly asks for it.',
    `Target message id: ${target.id}`,
    `Target payload: ${target.payload || ''}`,
    prompt ? `Optional user prompt:\n${prompt}` : ''
  ].filter(Boolean).join('\n');
}

function toQuickAiMessage(message, targetId) {
  return {
    id: message.id,
    payload: message.payload || ''
  };
}

function getAiChatMaxLogLines(mode, contextCount) {
  const configuredLimit = Math.max(1, Number(state.aiConfig?.maxLogLines || DEFAULT_AI_MAX_LOG_LINES));
  if (mode === 'errors' || mode === 'filtered') {
    return Math.min(Math.max(1, Number(contextCount || 0)), configuredLimit);
  }
  return configuredLimit;
}

function limitAiContextMessagesSequential(messages, limit) {
  if (!Array.isArray(messages)) return [];
  const normalizedLimit = Math.max(1, Number(limit || DEFAULT_AI_MAX_LOG_LINES));
  return messages.length > normalizedLimit ? messages.slice(0, normalizedLimit) : messages;
}

function reduceAiContextForSend(messages, limit, selectedId = null) {
  if (!Array.isArray(messages) || messages.length <= limit) return messages || [];

  const selected = new Map();
  const byIndex = new Map();
  messages.forEach((message, index) => {
    byIndex.set(message.id, index);
  });

  function addMessage(message) {
    if (message && Number.isFinite(Number(message.id)) && selected.size < limit) {
      selected.set(message.id, message);
    }
  }

  function addWindow(centerIndex, beforeCount = 2, afterCount = 2) {
    const start = Math.max(0, centerIndex - beforeCount);
    const end = Math.min(messages.length - 1, centerIndex + afterCount);
    for (let index = start; index <= end && selected.size < limit; index += 1) {
      addMessage(messages[index]);
    }
  }

  if (Number.isFinite(Number(selectedId)) && byIndex.has(selectedId)) {
    addWindow(byIndex.get(selectedId), 12, 12);
  }

  const priorityIndexes = [];
  for (let index = 0; index < messages.length; index += 1) {
    if (isPriorityAiContextMessage(messages[index])) priorityIndexes.push(index);
  }

  const priorityBudget = Math.max(1, Math.floor(limit * 0.75));
  const priorityStep = Math.max(1, Math.floor(priorityIndexes.length / Math.max(1, Math.floor(priorityBudget / 5))));
  for (let index = 0; index < priorityIndexes.length && selected.size < priorityBudget; index += priorityStep) {
    addWindow(priorityIndexes[index], 2, 2);
  }

  const remaining = Math.max(0, limit - selected.size);
  if (remaining > 0) {
    const step = Math.max(1, Math.floor(messages.length / remaining));
    for (let index = 0; index < messages.length && selected.size < limit; index += step) {
      addMessage(messages[index]);
    }
  }

  return Array.from(selected.values()).sort((a, b) => a.id - b.id).slice(0, limit);
}

function isPriorityAiContextMessage(message) {
  if (!message) return false;
  if (message.level === 'Fatal' || message.level === 'Error' || message.level === 'Warn') return true;
  if (state.aiHighlights.has(message.id)) return true;
  const payload = String(message.payload || '').toLowerCase();
  return AI_CONTEXT_SUSPICIOUS_KEYWORDS.some((keyword) => payload.includes(keyword));
}

function resolveChatRange() {
  if (state.aiChatMode !== 'range') return null;
  const from = Number(state.aiRange.from ?? el.aiRangeStart.value);
  const to = Number(state.aiRange.to ?? el.aiRangeEnd.value);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  const unit = state.aiRange.unit || 'time';
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  if (unit === 'id') {
    return { unit, fromId: start, toId: end };
  }
  return { unit, fromMs: start, toMs: end };
}

function updateChatRangeInfo() {
  if (!el.aiChatRangeInfo) return;
  if (!state.messages.length) {
    el.aiChatRangeInfo.textContent = '0 message';
    return;
  }
  if (state.aiChatMode === 'selection') {
    const selected = getSelectedMessage();
    el.aiChatRangeInfo.textContent = selected
      ? `Row #${selected.id} with nearby messages`
      : 'No row selected';
    return;
  }
  if (state.aiChatMode === 'errors') {
    const limit = getAiChatMaxLogLines('errors', state.messages.length);
    el.aiChatRangeInfo.textContent = limit < state.messages.length
      ? `${formatNumber(state.messages.length)} full-log messages; AI sends ${formatNumber(limit)} selected payloads`
      : `${formatNumber(state.messages.length)} full-log messages`;
    return;
  }
  if (state.aiChatMode === 'filtered') {
    const limit = getAiChatMaxLogLines('filtered', state.filtered.length);
    el.aiChatRangeInfo.textContent = limit < state.filtered.length
      ? `${formatNumber(state.filtered.length)} filtered messages; AI sends ${formatNumber(limit)} selected payloads`
      : `${formatNumber(state.filtered.length)} messages after current filters`;
    return;
  }
  const range = resolveChatRange();
  if (!range) {
    el.aiChatRangeInfo.textContent = 'No range selected';
    return;
  }
  const count = range.unit === 'id'
    ? countMessagesInIdRange(range.fromId, range.toId)
    : countMessagesInRange(range.fromMs, range.toMs);
  el.aiChatRangeInfo.textContent = `${formatNumber(count)} messages in selected range`;
}

function buildChatContextMessages(mode) {
  if (!state.messages.length) return [];
  mode = mode || state.aiChatMode;

  if (mode === 'range') {
    const chatRange = resolveChatRange();
    if (chatRange) {
      return chatRange.unit === 'id'
        ? messagesInIdRange(chatRange.fromId, chatRange.toId)
        : messagesInRange(chatRange.fromMs, chatRange.toMs);
    }
    return [];
  }

  if (mode === 'selection') {
    const selected = getSelectedMessage();
    if (selected) {
      return buildCurrentLineContext(selected);
    }
  }

  if (mode === 'errors') {
    return state.messages.slice();
  }

  if (mode === 'filtered') {
    return state.filtered.map((index) => state.messages[index]).filter(Boolean);
  }

  return state.messages.slice(0, Math.min(1200, state.messages.length));
}

function buildCurrentLineContext(selected) {
  return buildNeighborContextByIndex(selected.id, 40, 40);
}

function buildNeighborContextByIndex(targetId, beforeCount, afterCount) {
  const targetIndex = state.messages.findIndex((message) => message.id === targetId);
  if (targetIndex < 0) return [];
  const start = Math.max(0, targetIndex - beforeCount);
  const end = Math.min(state.messages.length, targetIndex + afterCount + 1);
  return state.messages.slice(start, end);
}

function mergeMessageContext(primary, secondary, limit) {
  const selected = new Map();
  for (const message of [...(primary || []), ...(secondary || [])]) {
    if (message && Number.isFinite(Number(message.id))) {
      selected.set(message.id, message);
    }
  }
  return Array.from(selected.values()).sort((a, b) => a.id - b.id).slice(0, limit);
}

function buildFilteredContextMessages(limit) {
  const filteredMessages = state.filtered.map((index) => state.messages[index]).filter(Boolean);
  if (filteredMessages.length <= limit) return filteredMessages;

  const important = filteredMessages.filter((message) => (
    message.level === 'Fatal' ||
    message.level === 'Error' ||
    message.level === 'Warn' ||
    state.aiHighlights.has(message.id)
  ));
  const selected = new Map(important.map((message) => [message.id, message]));
  const remaining = Math.max(0, limit - selected.size);
  const step = Math.max(1, Math.floor(filteredMessages.length / Math.max(1, remaining)));
  for (let index = 0; index < filteredMessages.length && selected.size < limit; index += step) {
    selected.set(filteredMessages[index].id, filteredMessages[index]);
  }
  return Array.from(selected.values()).sort((a, b) => a.id - b.id).slice(0, limit);
}

function defaultChatQuestion(mode) {
  return '';
}

function withHiddenAiInstructions(question, mode) {
  const guidance = String(state.aiGuidance || '').trim();
  return [
    question,
    guidance ? `\nUser prompt:\n${guidance}` : ''
  ].filter(Boolean).join('\n');
}

function setAiChatMode(mode) {
  state.aiChatMode = mode || DEFAULT_AI_CHAT_MODE;
  if (el.aiChatUseRange) {
    el.aiChatUseRange.checked = state.aiChatMode === 'range';
  }
  if (state.aiChatMode === 'range' && !Number.isFinite(state.aiRange.from)) {
    resetAiRangeToFull(false);
  }
  updateAiModeUi();
  updateChatRangeInfo();
  el.aiChatInput.focus();
}

function updateAiModeUi() {
  if (el.aiChatModeSelect) {
    el.aiChatModeSelect.value = state.aiChatMode;
  }
  if (el.aiChatRangePanel) {
    el.aiChatRangePanel.classList.toggle('active', state.aiChatMode === 'range');
  }
  const rangeDisabled = !state.messages.length;
  for (const input of [el.aiRangeStart, el.aiRangeEnd]) {
    if (input) input.disabled = rangeDisabled;
  }
}

function syncFilterRangeControls() {
  syncRangeControls('filter');
}

function handleFilterRangeInput(_event, edge) {
  state.filterRange.dirty = true;
  let from = Number(el.filterRangeStart.value);
  let to = Number(el.filterRangeEnd.value);
  if (edge === 'from' && from > to) to = from;
  if (edge === 'to' && to < from) from = to;
  setFilterRange(from, to, true);
  state.currentPage = 1;
  applyFilters();
}

function resetFilterRange(render = true) {
  resetRangeToFull('filter');
  if (render) {
    state.currentPage = 1;
    applyFilters();
  }
}

function setFilterRange(from, to, dirty) {
  setRangeValues('filter', from, to, dirty);
}

function applyFilterRangeValues() {
  applyRangeValues('filter');
}

function syncFilterRangeFromHiddenInputs() {
  const fromMs = resolveTimeInput(el.timeFrom.value, false);
  const toMs = resolveTimeInput(el.timeTo.value, false);
  if (Number.isFinite(fromMs) || Number.isFinite(toMs)) {
    state.filterRange.unit = 'time';
    clearRangeBounds('filter');
    const bounds = getRangeBounds('time');
    const fallbackFrom = bounds ? bounds.min : fromMs;
    const fallbackTo = bounds ? bounds.max : toMs;
    setFilterRange(
      Number.isFinite(fromMs) ? fromMs : fallbackFrom,
      Number.isFinite(toMs) ? toMs : fallbackTo,
      true
    );
  } else if (!el.timeFrom.value && !el.timeTo.value) {
    resetFilterRange(false);
  }
}

function toggleFilterRangeUnit() {
  toggleRangeUnit('filter');
  state.currentPage = 1;
  applyFilters();
}

function syncAiRangeControls() {
  syncRangeControls('ai');
}

function handleAiRangeInput(_event, edge) {
  state.aiRange.dirty = true;
  let from = Number(el.aiRangeStart.value);
  let to = Number(el.aiRangeEnd.value);
  if (edge === 'from' && from > to) to = from;
  if (edge === 'to' && to < from) from = to;
  setAiRange(from, to, true);
  setAiChatMode('range');
}

function resetAiRangeToFull(focus = true) {
  if (!resetRangeToFull('ai')) return;
  setAiChatMode('range');
  if (focus) el.aiChatInput.focus();
}

function selectRangeForAi() {
  const range = selectedTimeRange();
  if (!range) {
    setAiStatus('No row is selected for AI range.', true);
    return;
  }
  state.aiRange.unit = 'time';
  clearRangeBounds('ai');
  setAiRange(range.fromMs, range.toMs, true);
  setAiChatMode('range');
}

function prepareRangePrompt(prompt) {
  selectRangeForAi();
  if (prompt && !el.aiChatInput.value.trim()) {
    el.aiChatInput.value = prompt;
  }
}

function setAiRange(from, to, dirty) {
  setRangeValues('ai', from, to, dirty);
  updateChatRangeInfo();
}

function applyAiRangeValues() {
  applyRangeValues('ai');
}

function toggleAiRangeUnit() {
  toggleRangeUnit('ai');
  setAiChatMode('range');
}

function syncRangeControls(kind) {
  const range = getRangeState(kind);
  const controls = getRangeControls(kind);
  if (!range || !controls.start || !controls.end) return;

  range.unit = 'time';
  const bounds = getRangeBounds('time');
  syncRangeModeUi(kind);
  if (!bounds) {
    controls.start.disabled = true;
    controls.end.disabled = true;
    controls.start.value = '0';
    controls.end.value = '0';
    controls.fromLabel.textContent = '-';
    controls.toLabel.textContent = '-';
    controls.selection.style.left = '0%';
    controls.selection.style.width = '0%';
    controls.limits.textContent = 'No logs loaded';
    if (kind === 'filter') {
      el.timeFrom.value = '';
      el.timeTo.value = '';
    }
    return;
  }

  const boundsChanged = range.min !== bounds.min || range.max !== bounds.max;
  range.min = bounds.min;
  range.max = bounds.max;
  if (boundsChanged || !range.dirty || !Number.isFinite(range.from) || !Number.isFinite(range.to)) {
    range.from = bounds.min;
    range.to = bounds.max;
  }

  const step = getRangeStep(range.unit, bounds.max - bounds.min);
  for (const input of [controls.start, controls.end]) {
    input.min = String(bounds.min);
    input.max = String(bounds.max);
    input.step = String(step);
    input.disabled = false;
  }
  normalizeRangeValues(range);
  applyRangeValues(kind);
}

function resetRangeToFull(kind) {
  const range = getRangeState(kind);
  if (!range) return false;
  range.dirty = false;
  range.unit = 'time';
  const bounds = getRangeBounds('time');
  if (!bounds) {
    range.from = null;
    range.to = null;
    applyRangeValues(kind);
    return false;
  }
  setRangeValues(kind, bounds.min, bounds.max, false);
  return true;
}

function setRangeValues(kind, from, to, dirty) {
  const range = getRangeState(kind);
  if (!range || !Number.isFinite(from) || !Number.isFinite(to)) return;
  range.unit = 'time';
  const bounds = getRangeBounds(range.unit) || {
    min: Math.min(from, to),
    max: Math.max(from, to)
  };
  range.min = bounds.min;
  range.max = bounds.max;
  range.from = clampNumber(Math.min(from, to), bounds.min, bounds.max);
  range.to = clampNumber(Math.max(from, to), bounds.min, bounds.max);
  range.dirty = Boolean(dirty);
  normalizeRangeValues(range);
  applyRangeValues(kind);
}

function applyRangeValues(kind) {
  const range = getRangeState(kind);
  const controls = getRangeControls(kind);
  if (!range || !controls.start || !controls.end) return;

  syncRangeModeUi(kind);
  const from = Number.isFinite(range.from) ? range.from : 0;
  const to = Number.isFinite(range.to) ? range.to : from;
  controls.start.value = String(from);
  controls.end.value = String(to);
  controls.fromLabel.textContent = Number.isFinite(range.from) ? formatRangeValue(range.unit, from) : '-';
  controls.toLabel.textContent = Number.isFinite(range.to) ? formatRangeValue(range.unit, to) : '-';

  if (kind === 'filter') {
    el.timeFrom.value = range.dirty && range.unit === 'time' ? String(from) : '';
    el.timeTo.value = range.dirty && range.unit === 'time' ? String(to) : '';
  } else {
    el.aiChatFrom.value = String(from);
    el.aiChatTo.value = String(to);
  }

  if (Number.isFinite(range.min) && Number.isFinite(range.max)) {
    const span = Math.max(1, range.max - range.min);
    const left = ((Math.min(from, to) - range.min) / span) * 100;
    const width = ((Math.max(from, to) - Math.min(from, to)) / span) * 100;
    controls.selection.style.left = `${clampNumber(left, 0, 100)}%`;
    controls.selection.style.width = `${clampNumber(width, 0, 100)}%`;
    controls.limits.textContent = kind === 'filter'
      ? (range.dirty ? `${formatRangeShortValue(range.unit, from)} -> ${formatRangeShortValue(range.unit, to)}` : 'Full log')
      : `${formatRangeShortValue(range.unit, range.min)} -> ${formatRangeShortValue(range.unit, range.max)}`;
  }
}

function toggleRangeUnit(kind) {
  const range = getRangeState(kind);
  if (!range) return;
  range.unit = 'time';
  syncRangeControls(kind);
}

function clearRangeBounds(kind) {
  const range = getRangeState(kind);
  if (!range) return;
  range.min = null;
  range.max = null;
}

function normalizeRangeValues(range) {
  if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) return;
  range.from = clampNumber(range.from, range.min, range.max);
  range.to = clampNumber(range.to, range.min, range.max);
  if (range.from > range.to) {
    const tmp = range.from;
    range.from = range.to;
    range.to = tmp;
  }
}

function convertRangeValues(fromUnit, toUnit, from, to, fallbackBounds) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return fallbackBounds;
  const start = Math.min(from, to);
  const end = Math.max(from, to);

  if (fromUnit === 'time' && toUnit === 'id') {
    const selected = state.messages.filter((message) => (
      Number.isFinite(getMessageRangeTimeMs(message)) &&
      getMessageRangeTimeMs(message) >= start &&
      getMessageRangeTimeMs(message) <= end
    ));
    if (selected.length) {
      return {
        from: selected[0].id,
        to: selected[selected.length - 1].id
      };
    }
  }

  if (fromUnit === 'id' && toUnit === 'time') {
    const selected = state.messages.filter((message) => (
      Number(message.id) >= start &&
      Number(message.id) <= end &&
      Number.isFinite(getMessageRangeTimeMs(message))
    ));
    if (selected.length) {
      return {
        from: getMessageRangeTimeMs(selected[0]),
        to: getMessageRangeTimeMs(selected[selected.length - 1])
      };
    }
  }

  return fallbackBounds;
}

function getRangeState(kind) {
  return kind === 'filter' ? state.filterRange : state.aiRange;
}

function getRangeControls(kind) {
  if (kind === 'filter') {
    return {
      title: el.filterRangeTitle,
      button: el.btnFilterRangeUnit,
      start: el.filterRangeStart,
      end: el.filterRangeEnd,
      selection: el.filterRangeSelection,
      fromLabel: el.filterRangeFromLabel,
      toLabel: el.filterRangeToLabel,
      limits: el.filterRangeLimits
    };
  }
  return {
    title: el.aiRangeTitle,
    button: el.btnAiRangeUnit,
    start: el.aiRangeStart,
    end: el.aiRangeEnd,
    selection: el.aiRangeSelection,
    fromLabel: el.aiRangeFromLabel,
    toLabel: el.aiRangeToLabel,
    limits: el.aiRangeLimits
  };
}

function getRangeBounds(unit) {
  if (!state.messages.length) return null;
  if (unit === 'id') {
    let min = Infinity;
    let max = -Infinity;
    for (const message of state.messages) {
      const id = Number(message.id);
      if (!Number.isFinite(id)) continue;
      min = Math.min(min, id);
      max = Math.max(max, id);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return { min, max };
  }
  const values = state.messages.map(getMessageRangeTimeMs).filter(Number.isFinite);
  if (!values.length) return null;
  const min = Math.min(...values);
  let max = Math.max(...values);
  if (max <= min) max = min + SYNTHETIC_RANGE_STEP_MS;
  return { min, max };
}

function syncRangeModeUi(kind) {
  const range = getRangeState(kind);
  const controls = getRangeControls(kind);
  if (!range || !controls.title || !controls.button) return;
  const unit = range.unit || 'time';
  controls.title.textContent = kind === 'filter'
    ? 'Time Range'
    : 'AI time range';
  controls.button.textContent = 'Time';
  controls.button.classList.add('hidden');
  controls.button.classList.remove('active');
}

function formatRangeValue(unit, value) {
  if (!Number.isFinite(value)) return '-';
  return unit === 'id' ? `#${Math.round(value)}` : formatRangeClockLabel(value);
}

function formatRangeShortValue(unit, value) {
  if (!Number.isFinite(value)) return '-';
  return unit === 'id' ? `#${Math.round(value)}` : formatRangeClockLabel(value);
}

function getRangeStep(unit, span) {
  if (unit === 'id') return 1;
  return getTimeRangeStep(span);
}

function getTimeRangeStep(spanMs) {
  if (spanMs > 24 * 60 * 60 * 1000) return 60 * 1000;
  if (spanMs > 60 * 60 * 1000) return 1000;
  if (spanMs > 60 * 1000) return 100;
  return 1;
}

function messagesInRange(fromMs, toMs) {
  const start = Math.min(fromMs, toMs);
  const end = Math.max(fromMs, toMs);
  return state.messages.filter((message) => {
    const value = getMessageRangeTimeMs(message);
    return Number.isFinite(value) && value >= start && value <= end;
  });
}

function messagesInIdRange(fromId, toId) {
  const start = Math.min(fromId, toId);
  const end = Math.max(fromId, toId);
  return state.messages.filter((message) => Number(message.id) >= start && Number(message.id) <= end);
}

function countMessagesInRange(fromMs, toMs) {
  let count = 0;
  const start = Math.min(fromMs, toMs);
  const end = Math.max(fromMs, toMs);
  for (const message of state.messages) {
    const value = getMessageRangeTimeMs(message);
    if (Number.isFinite(value) && value >= start && value <= end) count += 1;
  }
  return count;
}

function countMessagesInIdRange(fromId, toId) {
  let count = 0;
  const start = Math.min(fromId, toId);
  const end = Math.max(fromId, toId);
  for (const message of state.messages) {
    if (Number(message.id) >= start && Number(message.id) <= end) count += 1;
  }
  return count;
}

function toAiMessage(message) {
  return {
    id: message.id,
    payload: message.payload || ''
  };
}

function toCurrentLineAiMessage(message, selectedId) {
  return {
    id: message.id,
    payload: message.payload || ''
  };
}

function formatAiClockTime(message) {
  const raw = String(message?.time || '');
  const match = raw.match(/\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/);
  if (match) return match[0].split('.')[0];
  if (Number.isFinite(message?.timeMs)) return formatHourMinuteSecond(message.timeMs);
  return raw || '-';
}

function appendChatBubble(role, text, contextCount = null, docCount = null, docSourceCount = null, options = {}) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  updateChatBubble(bubble, role, text, contextCount, docCount, docSourceCount, { ...options, scroll: 'none' });
  el.aiChatLog.appendChild(bubble);
  if (options.scroll === 'top') {
    scrollChatBubbleToTop(bubble);
  } else if (options.scroll !== 'none') {
    el.aiChatLog.scrollTop = el.aiChatLog.scrollHeight;
  }
  return bubble;
}

function updateChatBubble(bubble, role, text, contextCount = null, docCount = null, docSourceCount = null, options = {}) {
  if (!bubble) return;
  bubble.className = `chat-bubble ${role}${options.pending ? ' pending' : ''}`;
  const meta = [];
  if (contextCount !== null) meta.push(`${formatNumber(contextCount)} log messages`);
  if (docCount !== null) meta.push(formatAiDocUsage({ docs: docCount, docSources: docSourceCount }));
  const body = options.pending
    ? `<p class="typing-indicator" aria-label="${escapeHtml(String(text || 'AI is thinking'))}"><span></span><span></span><span></span></p>`
    : `<p>${escapeHtml(String(text || '')).replace(/\n/g, '<br>')}</p>`;
  bubble.innerHTML = `
    <strong>${role === 'user' ? 'You' : 'AI'}</strong>
    ${meta.length ? `<span class="chat-meta">${escapeHtml(meta.join(' | '))}</span>` : ''}
    ${body}
  `;
  if (options.scroll === 'top') {
    requestAnimationFrame(() => scrollChatBubbleToTop(bubble));
  } else if (options.scroll === 'bottom') {
    el.aiChatLog.scrollTop = el.aiChatLog.scrollHeight;
  }
}

function scrollChatBubbleToTop(bubble) {
  if (!bubble || !el.aiChatLog) return;
  const top = Math.max(0, bubble.offsetTop - el.aiChatLog.offsetTop - 6);
  el.aiChatLog.scrollTop = top;
}

function formatAiDocUsage(meta = {}) {
  const docs = Number(meta.docs || 0);
  const sources = Number(meta.docSources || 0);
  if (!docs) return '0 ECU snippets';
  return sources
    ? `${formatNumber(docs)} snippets / ${formatNumber(sources)} ECU document(s)`
    : `${formatNumber(docs)} ECU snippets`;
}

function setAiSending(isSending) {
  state.aiSending = Boolean(isSending);
  el.btnAiChatSend.disabled = isSending;
  el.aiChatModeSelect.disabled = isSending;
  el.aiRuntimeModel.disabled = isSending;
  el.btnAiChatSend.textContent = isSending ? 'Waiting...' : 'Send';
  scheduleVirtualRows();
}

async function runAiAnalysis(payload) {
  setAiStatus('AI is analyzing...', false);
  try {
    const response = await api.analyzeWithAi(payload);
    if (!response.ok) {
      setAiStatus(response.error || 'AI analysis failed.', true);
      return;
    }
    const enrichedResult = enrichAiResult(response.result, payload);
    applyAiResult(enrichedResult);
    setAiStatus(`AI analysis complete. Context: ${response.promptStats.contextMessages} messages, docs: ${response.promptStats.docs}.`, false);
  } catch (error) {
    setAiStatus(`AI error: ${error.message}`, true);
  }
}

function enrichAiResult(result, requestPayload) {
  const next = { ...(result || {}) };
  const ids = Array.isArray(next.suspicious_message_ids) && next.suspicious_message_ids.length
    ? next.suspicious_message_ids.map(Number).filter(Number.isFinite)
    : Array.isArray(requestPayload.selectedIds)
      ? requestPayload.selectedIds.map(Number).filter(Number.isFinite).slice(0, 20)
      : [];
  const contextMessages = Array.isArray(requestPayload.messages) ? requestPayload.messages : [];
  const suspiciousMessages = contextMessages.filter((message) => ids.includes(message.id));
  const first = suspiciousMessages[0] || contextMessages.find((message) => message.level === 'Fatal' || message.level === 'Error' || message.level === 'Warn') || contextMessages[0];

  next.suspicious_message_ids = ids;

  if ((!next.evidence || !next.evidence.length) && suspiciousMessages.length) {
    next.evidence = suspiciousMessages.slice(0, 12).map((message) => ({
      message_id: message.id,
      reason: `${message.level || 'Unknown'} ${message.ecu || '-'}/${message.apid || '-'}/${message.ctid || '-'}: ${(message.payload || '').slice(0, 180)}`
    }));
  }

  if (isSparseFallbackField(next.summary, 'summary') && first) {
    next.summary = `AI marked ${ids.length || 1} suspicious message(s) in the log window. Notable message: #${first.id} ${first.level || 'Unknown'} ${first.ecu || '-'}/${first.apid || '-'}/${first.ctid || '-'} at ${first.time || '-'} with payload: ${(first.payload || '').slice(0, 220)}.`;
  }

  if (isSparseFallbackField(next.error_verification, 'verification') && first) {
    next.error_verification = `There is a possible issue around message #${first.id} at ${first.time || '-'}, but more adjacent log evidence and documentation are needed for confirmation.`;
  }

  if (isSparseFallbackField(next.root_cause, 'root cause') && first) {
    next.root_cause = `There is not enough evidence for a final conclusion, but the main suspicion is in ${first.ecu || '-'}/${first.apid || '-'}/${first.ctid || '-'} around message #${first.id}. Compare preceding/following messages, camera/storage/network state, and non-verbose mapping if available.`;
  }

  if (isSparseFallbackField(next.impact, 'impact')) {
    next.impact = 'There is not enough data to quantify impact; check for symptoms after the suspicious window such as timeout, dropped frames, reset, degraded mode, or new DTCs.';
  }

  if (!Array.isArray(next.reproduction_steps) || !next.reproduction_steps.length) {
    next.reproduction_steps = [
      'Replay or recreate the conditions around the suspicious messages in the same time order.',
      'Expand the time window before/after the issue and check trigger conditions in ECU documentation.',
      'Confirm with a new log that has the same payload/timing or matching DTCs.'
    ];
  }

  if (isSparseFallbackField(next.recommended_action, 'recommendation')) {
    next.recommended_action = ids.length
      ? `Inspect messages #${ids.slice(0, 12).join(', ')} on the timeline, expand the analysis window to 2000-5000 ms if the issue spans longer, then compare with ECU/FIBEX/ARXML documentation.`
      : 'Expand the time/ID range around the suspicious area, check consecutive warnings/errors, and load FIBEX/ARXML if the log is non-verbose.';
  }

  if (!Array.isArray(next.next_steps) || !next.next_steps.length) {
    next.next_steps = [
      'Expand context around the issue and rerun AI range analysis.',
      'Inspect highlighted messages on the timeline.',
      'Load FIBEX/ARXML if non-verbose payloads are not decoded.'
    ];
  }

  return next;
}

function isSparseFallbackField(value, kind) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return true;
  if (text.includes('ai has not')) return true;
  if (text.includes('did not provide')) return true;
  if (text.includes('not explicit')) return true;
  if (text.includes('collect more context')) return true;
  if (kind === 'summary' && text.length < 12) return true;
  return false;
}

async function runNaturalSearch() {
  if (state.naturalSearching) return;
  const rawQuery = el.naturalQuery.value.trim();
  if (!rawQuery) return;
  const query = translateSearchQueryToEnglish(rawQuery);
  if (query && query !== rawQuery) {
    el.naturalQuery.value = query;
  }
  setNaturalSearchBusy(true);
  setAiStatus('AI is converting the English search query into a filter...', false);
  const localPlan = buildNaturalSearchPlan(query);
  try {
    const response = await api.naturalSearch({ query });
    if (!response.ok) {
      applyNaturalSearchPlan(localPlan, 'local', response.error);
      return;
    }
    const aiPlan = normalizeNaturalPlan(response.result);
    const mergedPlan = mergeNaturalPlans(aiPlan, localPlan);
    applyNaturalSearchPlan(mergedPlan, isEmptyNaturalPlan(aiPlan) ? 'local-empty-ai' : 'ai');
  } catch (error) {
    applyNaturalSearchPlan(localPlan, 'local', error.message);
  } finally {
    setNaturalSearchBusy(false);
  }
}

function setNaturalSearchBusy(isBusy) {
  state.naturalSearching = Boolean(isBusy);
  el.btnNatural.disabled = state.naturalSearching;
  el.btnNatural.textContent = state.naturalSearching ? 'Searching...' : 'AI Search';
}

function localNaturalFallback(query) {
  applyNaturalSearchPlan(buildNaturalSearchPlan(query), 'local');
}

function applyNaturalSearchPlan(plan, source, errorMessage = '') {
  const safePlan = normalizeNaturalPlan(plan);
  state.naturalFilter = buildRuntimeNaturalFilter(safePlan);
  state.levelFilter = safePlan.levels.length ? new Set(safePlan.levels.map(normalizeLevelName)) : null;
  state.currentPage = 1;

  el.searchInput.value = safePlan.displayQuery;
  if (el.searchField) el.searchField.value = 'payload-time';
  if (el.caseSensitive) el.caseSensitive.checked = false;
  if (el.regexSearch) el.regexSearch.checked = false;

  if (safePlan.from_time) el.timeFrom.value = safePlan.from_time;
  if (safePlan.to_time) el.timeTo.value = safePlan.to_time;
  syncFilterRangeFromHiddenInputs();

  applyFilters();
  let relaxedBy = '';
  if (state.filtered.length === 0 && state.levelFilter && state.levelFilter.size) {
    state.levelFilter = null;
    relaxedBy = 'Removed the level filter because no rows matched; keyword/concept filters remain active.';
    applyFilters();
  }
  const report = {
    source,
    explanation: safePlan.explanation,
    display_query: safePlan.displayQuery,
    levels: relaxedBy ? [] : safePlan.levels,
    keywords: safePlan.keywords,
    required_groups: safePlan.requiredGroups,
    optional_terms: safePlan.optionalTerms,
    field_terms: safePlan.fieldTerms,
    matched_rows: state.filtered.length,
    relaxed_by: relaxedBy,
    error: errorMessage || ''
  };
  const prefix = source === 'ai' ? 'Applied AI Search' : 'Applied smart local search';
  const suffix = errorMessage ? ` Fallback reason: ${errorMessage}` : '';
  const detail = report.relaxed_by ? ` ${report.relaxed_by}` : '';
  setAiStatus(`${prefix}: found ${formatNumber(state.filtered.length)} row(s).${suffix}${detail}`, state.filtered.length === 0);
}

function buildNaturalSearchPlan(query) {
  const raw = String(query || '').trim();
  const normalized = normalizeSearchText(raw);
  const levels = detectNaturalLevels(normalized);
  const concepts = detectNaturalConcepts(normalized);
  const fieldTerms = detectNaturalFieldTerms(raw);
  const numericTerms = raw.match(/\b\d+(?:[.,]\d+)?\b/g) || [];
  const directTerms = tokenizeNaturalQuery(raw)
    .filter((term) => !NATURAL_STOP_WORDS.has(term))
    .filter((term) => term.length >= 3 || /^\d+$/.test(term));

  const optionalTerms = uniqueStrings([
    ...concepts.flatMap((concept) => concept.terms),
    ...directTerms,
    ...numericTerms
  ]).slice(0, 80);

  const requiredGroups = concepts.map((concept) => ({
    label: concept.label,
    terms: concept.terms
  }));
  const displayQuery = buildNaturalDisplayQuery(optionalTerms, levels, fieldTerms);

  return {
    explanation: concepts.length
      ? `Detected ${concepts.map((concept) => concept.label).join(', ')} from the natural-language query.`
      : 'Extracted keywords from the natural-language query for log search.',
    search_text: displayQuery,
    regex: false,
    case_sensitive: false,
    levels,
    ecu: fieldTerms.ecu || '',
    apid: fieldTerms.apid || '',
    ctid: fieldTerms.ctid || '',
    from_time: '',
    to_time: '',
    keywords: optionalTerms,
    displayQuery,
    requiredGroups,
    optionalTerms,
    fieldTerms
  };
}

function normalizeNaturalPlan(plan) {
  const result = plan || {};
  const keywords = uniqueStrings([
    ...normalizeStringList(result.keywords),
    ...tokenizeNaturalQuery(result.search_text || result.query || '')
  ]).filter((term) => term.length >= 2);
  const fieldTerms = {
    ecu: String(result.ecu || result.fieldTerms?.ecu || '').trim(),
    apid: String(result.apid || result.fieldTerms?.apid || '').trim(),
    ctid: String(result.ctid || result.fieldTerms?.ctid || '').trim()
  };
  const optionalTerms = uniqueStrings([
    ...normalizeStringList(result.optionalTerms),
    ...keywords,
    ...Object.values(fieldTerms).filter(Boolean)
  ]);
  const requiredGroups = Array.isArray(result.requiredGroups)
    ? result.requiredGroups.map((group) => ({
      label: String(group.label || 'group'),
      terms: normalizeStringList(group.terms)
    })).filter((group) => group.terms.length)
    : [];
  const displayQuery = String(result.displayQuery || result.search_text || optionalTerms.slice(0, 18).join(' ')).trim();

  return {
    explanation: String(result.explanation || ''),
    search_text: String(result.search_text || displayQuery),
    regex: Boolean(result.regex),
    case_sensitive: Boolean(result.case_sensitive),
    levels: normalizeStringList(result.levels).map(normalizeLevelName).filter(Boolean),
    ecu: fieldTerms.ecu,
    apid: fieldTerms.apid,
    ctid: fieldTerms.ctid,
    from_time: String(result.from_time || ''),
    to_time: String(result.to_time || ''),
    keywords: optionalTerms,
    displayQuery,
    requiredGroups,
    optionalTerms,
    fieldTerms
  };
}

function mergeNaturalPlans(aiPlan, localPlan) {
  if (isEmptyNaturalPlan(aiPlan)) {
    return localPlan;
  }
  const normalizedAi = normalizeNaturalPlan(aiPlan);
  const normalizedLocal = normalizeNaturalPlan(localPlan);
  const fieldTerms = {
    ecu: normalizedAi.ecu || normalizedLocal.ecu,
    apid: normalizedAi.apid || normalizedLocal.apid,
    ctid: normalizedAi.ctid || normalizedLocal.ctid
  };

  return {
    ...normalizedAi,
    explanation: normalizedAi.explanation || normalizedLocal.explanation,
    levels: uniqueStrings([...normalizedAi.levels, ...normalizedLocal.levels]).map(normalizeLevelName),
    keywords: uniqueStrings([...normalizedAi.keywords, ...normalizedLocal.keywords]),
    optionalTerms: uniqueStrings([...normalizedAi.optionalTerms, ...normalizedLocal.optionalTerms]),
    requiredGroups: normalizedAi.requiredGroups.length ? normalizedAi.requiredGroups : normalizedLocal.requiredGroups,
    fieldTerms,
    ecu: fieldTerms.ecu,
    apid: fieldTerms.apid,
    ctid: fieldTerms.ctid,
    displayQuery: normalizedAi.displayQuery || normalizedLocal.displayQuery
  };
}

function isEmptyNaturalPlan(plan) {
  const normalized = normalizeNaturalPlan(plan);
  return !normalized.keywords.length &&
    !normalized.levels.length &&
    !normalized.ecu &&
    !normalized.apid &&
    !normalized.ctid &&
    !normalized.from_time &&
    !normalized.to_time;
}

function buildRuntimeNaturalFilter(plan) {
  const normalized = normalizeNaturalPlan(plan);
  return {
    ...normalized,
    optionalTerms: uniqueStrings(normalized.optionalTerms.map(normalizeSearchText).filter(Boolean)),
    requiredGroups: normalized.requiredGroups.map((group) => ({
      ...group,
      terms: uniqueStrings(group.terms.map(normalizeSearchText).filter(Boolean))
    })).filter((group) => group.terms.length),
    fieldTerms: {
      ecu: normalizeSearchText(normalized.fieldTerms.ecu),
      apid: normalizeSearchText(normalized.fieldTerms.apid),
      ctid: normalizeSearchText(normalized.fieldTerms.ctid)
    }
  };
}

function messageMatchesNaturalFilter(message, filter) {
  const haystack = normalizeSearchText([
    message.payload,
    message.payloadAscii,
    message.level,
    message.type,
    message.subtype,
    message.ecu,
    message.apid,
    message.ctid,
    message.fileName,
    message.messageId,
    message.time
  ].join(' '));

  if (filter.fieldTerms.ecu && !normalizeSearchText(message.ecu).includes(filter.fieldTerms.ecu)) return false;
  if (filter.fieldTerms.apid && !normalizeSearchText(message.apid).includes(filter.fieldTerms.apid)) return false;
  if (filter.fieldTerms.ctid && !normalizeSearchText(message.ctid).includes(filter.fieldTerms.ctid)) return false;

  if (!filter.optionalTerms.length && !filter.requiredGroups.length) {
    return true;
  }

  let score = 0;
  for (const group of filter.requiredGroups) {
    if (group.terms.some((term) => haystack.includes(term))) {
      score += 2;
    }
  }
  for (const term of filter.optionalTerms) {
    if (haystack.includes(term)) {
      score += 1;
    }
  }
  return score > 0;
}

function detectNaturalLevels(normalizedQuery) {
  const levels = [];
  if (/\b(fatal|nghiem trong|critical|crash|panic)\b/.test(normalizedQuery)) levels.push('Fatal', 'Error');
  if (/\b(error|err|fault|failure|failed)\b/.test(normalizedQuery)) levels.push('Error');
  if (/\b(warn|warning|canh bao)\b/.test(normalizedQuery)) levels.push('Warn');
  if (/\b(info|thong tin)\b/.test(normalizedQuery)) levels.push('Info');
  if (/\b(debug|trace|verbose)\b/.test(normalizedQuery)) levels.push('Debug', 'Trace', 'Verbose');
  return uniqueStrings(levels);
}

function detectNaturalConcepts(normalizedQuery) {
  const concepts = [];
  for (const concept of NATURAL_CONCEPTS) {
    if (concept.triggers.some((trigger) => normalizedQuery.includes(trigger))) {
      concepts.push(concept);
    }
  }
  return concepts;
}

function detectNaturalFieldTerms(query) {
  const result = {};
  const patterns = [
    ['ecu', /\bECU\s*[:=]?\s*([A-Za-z0-9_-]{2,8})/i],
    ['apid', /\bAPID\s*[:=]?\s*([A-Za-z0-9_-]{2,8})/i],
    ['ctid', /\bCTID\s*[:=]?\s*([A-Za-z0-9_-]{2,8})/i]
  ];
  for (const [field, pattern] of patterns) {
    const match = query.match(pattern);
    if (match) result[field] = match[1];
  }
  return result;
}

function buildNaturalDisplayQuery(terms, levels, fieldTerms) {
  const parts = [];
  if (levels.length) parts.push(`level:${levels.join('|')}`);
  if (fieldTerms.ecu) parts.push(`ecu:${fieldTerms.ecu}`);
  if (fieldTerms.apid) parts.push(`apid:${fieldTerms.apid}`);
  if (fieldTerms.ctid) parts.push(`ctid:${fieldTerms.ctid}`);
  parts.push(...terms.slice(0, 18));
  return parts.join(' ');
}

function tokenizeNaturalQuery(value) {
  return normalizeSearchText(value)
    .split(/[^a-z0-9_.-]+/g)
    .map((term) => term.trim())
    .filter(Boolean);
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function translateSearchQueryToEnglish(value) {
  let text = normalizeSearchText(value);
  if (!text) return '';

  const phraseMap = [
    ['rot frame', 'dropped frame'],
    ['drop frame', 'dropped frame'],
    ['mat frame', 'lost frame'],
    ['roi frame', 'dropped frame'],
    ['nhiet do', 'temperature'],
    ['qua nhiet', 'overheat'],
    ['dien ap', 'voltage'],
    ['nguon', 'power'],
    ['khong phan hoi', 'no response'],
    ['khong tra loi', 'no response'],
    ['ma loi', 'dtc'],
    ['chan doan', 'diagnostic'],
    ['khoi dong lai', 'reboot'],
    ['khoi dong', 'startup'],
    ['tat may', 'shutdown'],
    ['the nho', 'storage card'],
    ['bo nho', 'memory'],
    ['tim cho toi', 'search'],
    ['tim kiem', 'search']
  ];
  for (const [source, target] of phraseMap) {
    text = text.replace(new RegExp(`\\b${escapeRegExp(source)}\\b`, 'g'), target);
  }

  const wordMap = {
    loi: 'error',
    hong: 'fail',
    fail: 'fail',
    failed: 'failed',
    treo: 'hang',
    cham: 'slow',
    tre: 'delay',
    nong: 'hot',
    mat: 'lost',
    roi: 'drop',
    reset: 'reset',
    reboot: 'reboot',
    camera: 'camera',
    cam: 'camera',
    file: 'file',
    sd: 'sd',
    canh: 'warning',
    bao: 'warning',
    timeout: 'timeout',
    dtc: 'dtc',
    uds: 'uds'
  };

  const translated = text
    .split(/[^a-z0-9_.-]+/g)
    .map((term) => wordMap[term] || term)
    .filter((term) => term && !NATURAL_TRANSLATION_STOP_WORDS.has(term));
  return uniqueStrings(translated).join(' ') || String(value || '').trim();
}

const NATURAL_STOP_WORDS = new Set([
  'tim', 'kiem', 'cho', 'toi', 'nhung', 'luc', 'khi', 'sau', 'truoc', 'trong', 'khoang',
  'cac', 'dong', 'log', 'message', 'ban', 'tin', 'co', 'bi', 'va', 'hoac', 'neu', 'thi',
  'the', 'nao', 'hay', 'giup', 'minh', 'cua', 'ecu', 'app'
]);

const NATURAL_TRANSLATION_STOP_WORDS = new Set([
  'search', 'tim', 'kiem', 'cho', 'toi', 'minh', 'hay', 'giup', 'cac', 'nhung',
  'dong', 'log', 'message', 'ban', 'tin', 'co', 'bi', 'va', 'hoac', 'khi',
  'sau', 'truoc', 'trong', 'khoang', 'cua', 'thi', 'la'
]);

const NATURAL_CONCEPTS = [
  {
    label: 'camera/frame/FPS',
    triggers: ['camera', 'cam', 'frame', 'fps', 'rot frame', 'drop frame', 'mat frame'],
    terms: ['camera', 'cam', 'frame', 'fps', 'drop', 'dropped', 'lost', 'miss', 'timeout', 'sensor', 'isp', 'lvds']
  },
  {
    label: 'temperature/thermal',
    triggers: ['nhiet do', 'qua nhiet', 'nong', 'temperature', 'temp', 'thermal', 'overheat'],
    terms: ['temperature', 'temp', 'thermal', 'overheat', 'hot', 'nhiet', 'nong']
  },
  {
    label: 'voltage/power',
    triggers: ['dien ap', 'nguon', 'voltage', 'volt', '12v', 'undervoltage', 'overvoltage', 'power'],
    terms: ['voltage', 'volt', 'power', 'undervoltage', 'overvoltage', 'battery', '12v', 'acc', 'ign']
  },
  {
    label: 'timeout/hang/slow response',
    triggers: ['timeout', 'time out', 'treo', 'khong phan hoi', 'delay', 'latency', 'hang'],
    terms: ['timeout', 'time out', 'delay', 'latency', 'expired', 'hang', 'blocked', 'stuck', 'no response']
  },
  {
    label: 'DTC/UDS/diagnostic',
    triggers: ['dtc', 'uds', 'diagnostic', 'ma loi', 'chan doan'],
    terms: ['dtc', 'uds', 'diagnostic', 'diag', '0x19', '0x22', '0x2e', '0x10', '0x27', 'nrc']
  },
  {
    label: 'SD/storage',
    triggers: ['sd', 'storage', 'the nho', 'memory card', 'microsd', 'file'],
    terms: ['sd', 'storage', 'card', 'microsd', 'memory', 'mount', 'unmount', 'write', 'read', 'file']
  },
  {
    label: 'PMD/parking',
    triggers: ['pmd', 'parking', 'motion', 'radar', 'do xe'],
    terms: ['pmd', 'parking', 'motion', 'radar', 'parked', 'event']
  },
  {
    label: 'reset/reboot/ignition',
    triggers: ['reset', 'reboot', 'restart', 'ignition', 'key on', 'key off', 'khoi dong'],
    terms: ['reset', 'reboot', 'restart', 'ignition', 'key', 'startup', 'shutdown', 'power cycle']
  },
  {
    label: 'network/CAN/Ethernet/SOMEIP',
    triggers: ['can', 'canfd', 'ethernet', 'someip', 'some/ip', 'network', 'bus', 'ethnm'],
    terms: ['can', 'canfd', 'ethernet', 'someip', 'some/ip', 'network', 'bus', 'ethnm', 'timeout']
  }
];

async function generateSequence() {
  const range = selectedRange();
  if (!range) return;
  const context = buildLocalContext(range.fromMs, range.toMs, Number(el.aiWindow.value || 500), 500);
  setAiStatus('AI is generating a sequence diagram...', false);
  const response = await api.sequenceDiagram({
    query: 'Generate Mermaid sequence diagram for selected DLT messages.',
    messages: context,
    fromMs: range.fromMs,
    toMs: range.toMs
  });
  if (!response.ok) {
    setAiStatus(response.error || 'Sequence diagram generation failed.', true);
    return;
  }
  applyAiHighlights(response.result.suspicious_message_ids || []);
  renderAiObject('Sequence Diagram', response.result);
  setAiStatus('Sequence diagram generated.', false);
}

async function generateScript() {
  const range = selectedRange();
  if (!range) return;
  const context = buildLocalContext(range.fromMs, range.toMs, Number(el.aiWindow.value || 500), 700);
  setAiStatus('AI is generating a reproduction script...', false);
  const response = await api.reproductionScript({
    query: 'Create a lab-bench reproduction script for the selected issue. Answer in the same language as the user question.',
    messages: context,
    fromMs: range.fromMs,
    toMs: range.toMs
  });
  if (!response.ok) {
    setAiStatus(response.error || 'Reproduction script generation failed.', true);
    return;
  }
  applyAiHighlights(response.result.suspicious_message_ids || []);
  renderAiObject('Reproduction Script', response.result);
  setAiStatus('Reproduction script generated.', false);
}

function applyAiResult(result) {
  applyAiHighlights(result.suspicious_message_ids || []);
  renderAiReport(result);
}

function applyAiHighlights(ids) {
  for (const id of ids.map(Number).filter(Number.isFinite)) {
    state.aiHighlights.add(id);
  }
  renderAll();
}

function renderAiReport(result) {
  el.aiReport.innerHTML = `
    <div class="report-card"><h4>1. Issue Verification</h4><p>${escapeHtml(result.error_verification || result.summary || '-')}</p></div>
    <div class="report-card"><h4>2. Root Cause</h4><p>${escapeHtml(result.root_cause || '-')}</p></div>
    <div class="report-card"><h4>3. Impact</h4><p>${escapeHtml(result.impact || '-')}</p></div>
    <div class="report-card"><h4>4. Reproduction</h4><pre>${escapeHtml(JSON.stringify(result.reproduction_steps || [], null, 2))}</pre></div>
    <div class="report-card"><h4>Recommended Action</h4><p>${escapeHtml(result.recommended_action || '-')}</p></div>
    <div class="report-card"><h4>Suspicious Messages</h4><p>${escapeHtml((result.suspicious_message_ids || []).join(', ') || '-')}</p></div>
    <div class="report-card"><h4>Evidence</h4><pre>${escapeHtml(JSON.stringify(result.evidence || [], null, 2))}</pre></div>
    <div class="report-card"><h4>DTC / Next Steps</h4><pre>${escapeHtml(JSON.stringify({ dtc_codes: result.dtc_codes || [], next_steps: result.next_steps || [] }, null, 2))}</pre></div>
  `;
}

function renderAiObject(title, object) {
  el.aiReport.innerHTML = `
    <div class="report-card"><h4>${escapeHtml(title)}</h4><pre>${escapeHtml(JSON.stringify(object, null, 2))}</pre></div>
  `;
}

function setAiStatus(message, isError) {
  el.aiStatus.textContent = message;
  el.aiStatus.style.color = isError ? 'var(--error)' : 'var(--muted)';
}

function buildFaultClusters() {
  const faults = state.messages.filter((message) => message.level === 'Fatal' || message.level === 'Error');
  const clusters = [];
  let current = null;
  const gapMs = 2000;

  for (const message of faults) {
    if (!current || message.timeMs - current.toMs > gapMs) {
      current = { fromMs: message.timeMs, toMs: message.timeMs, ids: [message.id], count: 1 };
      clusters.push(current);
    } else {
      current.toMs = message.timeMs;
      current.ids.push(message.id);
      current.count += 1;
    }
  }
  return clusters.sort((a, b) => b.count - a.count);
}

function buildSuspiciousAutoScanTargets() {
  const suspiciousPattern = /\b(error|fail|failed|failure|fault|fatal|timeout|time out|dtc|uds|reset|reboot|abort|exception|denied|unavailable|lost|drop|dropped|fps|frame|voltage|temperature|thermal|camera|sensor|sd|storage|pmd|parking|overheat|undervoltage|overvoltage)\b/i;
  const candidates = state.messages.filter((message) => {
    if (message.level === 'Warn') return true;
    return suspiciousPattern.test(`${message.payload || ''} ${message.apid || ''} ${message.ctid || ''} ${message.type || ''}`);
  });

  return clusterMessages(candidates, 3000).sort((a, b) => b.count - a.count);
}

function buildBroadAutoScanTarget() {
  const sample = state.messages.slice(0, Math.min(state.messages.length, 300));
  if (!sample.length) return null;
  return {
    fromMs: sample[0].timeMs,
    toMs: sample[sample.length - 1].timeMs,
    ids: sample.map((message) => message.id),
    count: sample.length
  };
}

function clusterMessages(messages, gapMs) {
  const clusters = [];
  let current = null;
  for (const message of messages.filter((item) => Number.isFinite(item.timeMs)).sort((a, b) => a.timeMs - b.timeMs)) {
    if (!current || message.timeMs - current.toMs > gapMs) {
      current = { fromMs: message.timeMs, toMs: message.timeMs, ids: [message.id], count: 1 };
      clusters.push(current);
    } else {
      current.toMs = message.timeMs;
      current.ids.push(message.id);
      current.count += 1;
    }
  }
  return clusters;
}

function buildLocalContext(fromMs, toMs, windowMs, maxLines) {
  const start = Math.min(fromMs, toMs) - windowMs;
  const end = Math.max(fromMs, toMs) + windowMs;
  const context = state.messages.filter((message) => Number.isFinite(message.timeMs) && message.timeMs >= start && message.timeMs <= end);
  if (context.length <= maxLines) return context;

  const important = context.filter((message) => message.level === 'Fatal' || message.level === 'Error' || message.level === 'Warn');
  const selected = new Map(important.map((message) => [message.id, message]));
  const remaining = Math.max(0, maxLines - selected.size);
  const step = Math.max(1, Math.floor(context.length / Math.max(1, remaining)));
  for (let index = 0; index < context.length && selected.size < maxLines; index += step) {
    selected.set(context[index].id, context[index]);
  }
  return Array.from(selected.values()).sort((a, b) => a.id - b.id).slice(0, maxLines);
}

function selectedRange() {
  const message = getSelectedMessage();
  if (!message) return null;
  const value = Number.isFinite(message.timeMs) ? message.timeMs : getMessageRangeTimeMs(message);
  return Number.isFinite(value) ? { fromMs: value, toMs: value } : null;
}

function selectedTimeRange() {
  const message = getSelectedMessage();
  if (!message) return null;
  const value = getMessageRangeTimeMs(message);
  return Number.isFinite(value) ? { fromMs: value, toMs: value } : null;
}

function resolveTimeInput(value, allowId) {
  const raw = String(value || '').trim();
  if (!raw) return NaN;

  const idMatch = raw.match(/^#?(\d+)$/);
  if (allowId && idMatch) {
    const byId = state.messages.find((message) => message.id === Number(idMatch[1]));
    if (byId) return getMessageRangeTimeMs(byId);
  }

  const clockMs = parseClockTimeOfDayMs(raw);
  if (Number.isFinite(clockMs)) {
    return resolveClockInputToRangeTime(clockMs);
  }

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const parsed = Date.parse(raw.replace(/\//g, '-'));
  if (!Number.isFinite(parsed)) return NaN;
  return resolveClockInputToRangeTime(parseClockTimeOfDayMs(new Date(parsed).toISOString()));
}

function resolveClockInputToRangeTime(clockMs) {
  const bounds = getRangeBounds('time');
  if (!bounds) return clockMs;
  let value = clockMs;
  while (value < bounds.min && value + DAY_MS <= bounds.max) value += DAY_MS;
  while (value > bounds.max && value - DAY_MS >= bounds.min) value -= DAY_MS;
  return clampNumber(value, bounds.min, bounds.max);
}

async function exportFiltered(kind) {
  const messages = state.filtered.map((index) => state.messages[index]);
  const content = kind === 'csv' ? toCsv(messages) : JSON.stringify(messages, null, 2);
  const result = await api.saveExport({
    title: `Export ${kind.toUpperCase()}`,
    defaultPath: `dlt-filtered.${kind}`,
    filters: [{ name: kind.toUpperCase(), extensions: [kind] }],
    content
  });
  if (result.ok) {
    el.parseStatus.textContent = `Exported ${formatNumber(messages.length)} rows to ${result.filePath}`;
  }
}

function toCsv(messages) {
  const columns = ['id', 'time', 'deltaMs', 'level', 'type', 'ecu', 'apid', 'ctid', 'messageId', 'payload', 'length', 'fileName'];
  const rows = [columns.join(',')];
  for (const message of messages) {
    rows.push(columns.map((column) => csvCell(message[column])).join(','));
  }
  return rows.join('\n');
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function handleTimelineClick(event) {
  const rect = el.timeline.getBoundingClientRect();
  const ratio = (event.clientX - rect.left) / rect.width;
  const messages = state.filtered.map((index) => state.messages[index]).filter((message) => Number.isFinite(message.timeMs));
  if (!messages.length) return;
  const min = Math.min(...messages.map((message) => message.timeMs));
  const max = Math.max(...messages.map((message) => message.timeMs));
  const target = min + ratio * (max - min);
  const nearest = messages.reduce((best, message) => Math.abs(message.timeMs - target) < Math.abs(best.timeMs - target) ? message : best, messages[0]);
  selectMessage(nearest.id, true);
}

function handleMinimapClick(event) {
  const rect = el.minimap.getBoundingClientRect();
  const ratio = (event.clientY - rect.top) / rect.height;
  const targetIndex = Math.min(state.filtered.length - 1, Math.max(0, Math.floor(ratio * state.filtered.length)));
  const message = state.messages[state.filtered[targetIndex]];
  if (message) selectMessage(message.id, true);
}

function handleKeyboard(event) {
  const tag = document.activeElement?.tagName;
  const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  if (!isTyping && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    el.searchInput.focus();
    return;
  }
  if (isTyping) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveSelection(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveSelection(-1);
  }
}

function moveSelection(delta) {
  const currentMessageIndex = state.messages.findIndex((message) => message.id === state.selectedId);
  const filteredPos = state.filtered.indexOf(currentMessageIndex);
  const nextPos = Math.min(state.filtered.length - 1, Math.max(0, filteredPos + delta));
  const message = state.messages[state.filtered[nextPos]];
  if (message) selectMessage(message.id, true);
}

function getCurrentPageIndices() {
  if (state.pageSize === 'all') {
    return state.filtered;
  }
  const size = Number(state.pageSize);
  const start = (state.currentPage - 1) * size;
  return state.filtered.slice(start, start + size);
}

function getTotalPages() {
  if (state.pageSize === 'all') return 1;
  return Math.max(1, Math.ceil(state.filtered.length / Number(state.pageSize)));
}

function getSelectedMessage() {
  if (state.selectedId === null) return null;
  return state.messages.find((message) => message.id === state.selectedId) || null;
}

function collectStats() {
  const levels = {};
  for (const level of LEVELS) levels[level] = 0;
  for (const message of state.messages) {
    levels[message.level] = (levels[message.level] || 0) + 1;
  }
  return {
    total: state.messages.length,
    filtered: state.filtered.length,
    files: state.files,
    levels,
    timeSpanMs: state.firstTimeMs !== null && state.lastTimeMs !== null ? state.lastTimeMs - state.firstTimeMs : 0,
    ecuCount: new Set(state.messages.map((message) => message.ecu).filter(Boolean)).size
  };
}

function collectAiStats(mode, contextMessages) {
  const levels = {};
  for (const level of LEVELS) levels[level] = 0;
  for (const message of state.messages) {
    levels[message.level] = (levels[message.level] || 0) + 1;
  }
  const range = mode === 'range' ? resolveChatRange() : null;
  return {
    mode,
    totalMessages: state.messages.length,
    contextMessages: Array.isArray(contextMessages) ? contextMessages.length : 0,
    files: state.files.filter(Boolean).map((file) => ({
      fileName: file.fileName,
      size: file.size,
      messages: file.messages
    })),
    timeStart: state.firstTimeMs !== null ? formatTimeLabel(state.firstTimeMs) : '',
    timeEnd: state.lastTimeMs !== null ? formatTimeLabel(state.lastTimeMs) : '',
    timeSpanMs: state.firstTimeMs !== null && state.lastTimeMs !== null ? state.lastTimeMs - state.firstTimeMs : 0,
    selectedId: state.selectedId,
    selectedRange: range ? {
      unit: range.unit,
      from: range.unit === 'id' ? formatRangeValue('id', range.fromId) : formatRangeClockLabel(range.fromMs),
      to: range.unit === 'id' ? formatRangeValue('id', range.toId) : formatRangeClockLabel(range.toMs)
    } : null,
    levels
  };
}

function resetWorkspace() {
  clearData();
  resetFilters();
  el.workspace.classList.add('hidden');
  el.workspace.classList.remove('hide-left', 'hide-right', 'ai-focus', 'log-ai-focus');
  syncLayoutButtons();
  el.dropZone.classList.remove('hidden');
  el.parseStatus.textContent = 'Idle';
  el.parseProgress.style.width = '0%';
  el.aiReport.innerHTML = '';
  setAiStatus('No AI analysis yet.', false);
}

function clearData() {
  state.messages = [];
  state.filtered = [];
  state.files = [];
  state.aiHighlights = new Set();
  state.selectedId = null;
  state.firstTimeMs = null;
  state.lastTimeMs = null;
  state.currentPage = 1;
  state.parseDone = false;
  state.aiChatMode = DEFAULT_AI_CHAT_MODE;
  state.quickAiPendingId = null;
  state.aiRange = {
    unit: 'time',
    min: null,
    max: null,
    from: null,
    to: null,
    dirty: false
  };
  state.filterRange = {
    unit: 'time',
    min: null,
    max: null,
    from: null,
    to: null,
    dirty: false
  };
  el.fileList.innerHTML = '';
  el.virtualScroll.scrollTop = 0;
  state.virtualMetrics = null;
  renderAll();
}

function toggleTheme() {
  const light = el.app.classList.toggle('theme-light');
  if (el.btnTheme) el.btnTheme.textContent = light ? 'Dark' : 'Light';
  scheduleRender();
}

function setupCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

function highlightSearch(value) {
  const text = String(value ?? '');
  const query = el.searchInput.value.trim();
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const safe = escapeRegExp(query);
  const exactRegex = new RegExp(safe, 'gi');
  if (exactRegex.test(text)) {
    exactRegex.lastIndex = 0;
    return escaped.replace(exactRegex, (match) => `<mark>${match}</mark>`);
  }

  const compactNeedle = compactSearchText(query);
  if (compactNeedle && compactSearchText(text).includes(compactNeedle)) {
    return `<mark>${escaped}</mark>`;
  }
  return escaped;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value > 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`;
  if (value > 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function formatDuration(ms) {
  const value = Math.abs(Number(ms || 0));
  if (value >= 60000) return `${(value / 60000).toFixed(1)} min`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${value.toFixed(0)} ms`;
}

function formatDelta(ms) {
  if (!Number.isFinite(ms)) return '-';
  return `${formatTrimmedNumber(ms, 3)}ms`;
}

function formatTrimmedNumber(value, decimals) {
  const fixed = Number(value).toFixed(decimals);
  return fixed.replace(/\.?0+$/, '');
}

function formatTimeLabel(ms) {
  if (!Number.isFinite(ms)) return '-';
  const date = new Date(ms);
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

function formatHourTick(ms) {
  if (!Number.isFinite(ms)) return '-';
  const date = new Date(ms);
  return date.toISOString().slice(11, 16);
}

function formatMinuteTick(ms) {
  if (!Number.isFinite(ms)) return '-';
  const date = new Date(ms);
  return date.toISOString().slice(11, 16);
}

function formatHourMinuteSecond(ms) {
  if (!Number.isFinite(ms)) return '-';
  return new Date(ms).toISOString().slice(11, 19);
}

function formatRangeClockLabel(ms) {
  if (!Number.isFinite(ms)) return '-';
  const value = ((Math.floor(ms) % DAY_MS) + DAY_MS) % DAY_MS;
  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function parseClockTimeOfDayMs(value) {
  const raw = String(value || '');
  const match = raw.match(/\b(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?\b/);
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59) return NaN;
  const fraction = String(match[4] || '').padEnd(3, '0').slice(0, 3);
  const millis = Number(fraction || 0);
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
}

function getMessageRangeTimeMs(message) {
  if (Number.isFinite(message?.rangeTimeMs)) return message.rangeTimeMs;
  if (Number.isFinite(message?.timeMs)) return message.timeMs;
  return NaN;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function loadTextSetting(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch (_error) {
    return '';
  }
}

function saveTextSetting(key, value) {
  try {
    localStorage.setItem(key, String(value || ''));
  } catch (_error) {
    // Ignore local storage failures.
  }
}

function shortPath(filePath) {
  return String(filePath || '').split(/[\\/]/).slice(-2).join('\\');
}

function normalizeLevelName(level) {
  const text = String(level || '').toLowerCase();
  return LEVELS.find((item) => item.toLowerCase() === text) || level;
}

function formatBytes(bytes) {
  if (!bytes || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadAppVersion() {
  if (!el.brandVersion || !api.getAppVersion) return;
  try {
    const version = await api.getAppVersion();
    if (version) el.brandVersion.textContent = `v${version}`;
  } catch (_e) {
    // keep static fallback from HTML
  }
}

function initStarsCanvas() {
  const canvas = el.starsCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;
  let bgStars = [];
  let fallingStars = [];
  const shootingStars = [];
  let rafId = null;
  let lastTime = 0;
  let shootingTimer = 0;
  let nextShootingIn = randomShootingInterval();

  function randomShootingInterval() { return 2500 + Math.random() * 4500; }

  function randomColor() {
    const r = Math.random();
    if (r < 0.60) return 'rgba(255,255,255,';
    if (r < 0.75) return 'rgba(180,230,255,';
    if (r < 0.88) return 'rgba(57,217,138,';
    return 'rgba(0,184,169,';
  }

  function buildBgStars(n) {
    return Array.from({ length: n }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.4 + 0.3,
      base: Math.random() * 0.6 + 0.2,
      phase: Math.random() * Math.PI * 2,
      freq: Math.random() * 0.02 + 0.005,
      color: randomColor()
    }));
  }

  function newFallingStar() {
    return {
      x: Math.random() * W,
      y: -20 - Math.random() * 80,
      vx: (Math.random() - 0.5) * 0.4,
      vy: Math.random() * 1.2 + 0.5,
      r: Math.random() * 1.5 + 0.8,
      tail: Math.random() * 35 + 15,
      opacity: Math.random() * 0.5 + 0.4,
      color: randomColor()
    };
  }

  function buildFallingStars(n) {
    return Array.from({ length: n }, () => {
      const s = newFallingStar(); s.y = Math.random() * H; return s;
    });
  }

  function spawnShootingStar() {
    const angle = (10 + Math.random() * 25) * (Math.PI / 180);
    const speed = 12 + Math.random() * 14;
    return {
      x: Math.random() * W * 0.7,
      y: Math.random() * H * 0.5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      length: 160 + Math.random() * 200,
      opacity: 1,
      w: 1.5 + Math.random() * 2
    };
  }

  function drawBgStars(dt) {
    for (const s of bgStars) {
      s.phase += s.freq * dt * 0.06;
      const a = s.base * (0.5 + 0.5 * Math.sin(s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.color + a + ')';
      ctx.fill();
    }
  }

  function drawFallingStars(dt) {
    for (let i = 0; i < fallingStars.length; i++) {
      const s = fallingStars[i];
      s.x += s.vx * dt * 0.06;
      s.y += s.vy * dt * 0.06;
      if (s.y > H + 30) { fallingStars[i] = newFallingStar(); continue; }
      const grad = ctx.createLinearGradient(s.x, s.y - s.tail, s.x, s.y);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, s.color + s.opacity + ')');
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - s.tail);
      ctx.lineTo(s.x, s.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = s.r;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.color + Math.min(1, s.opacity + 0.2) + ')';
      ctx.fill();
    }
  }

  function drawShootingStars(dt) {
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const s = shootingStars[i];
      s.x += s.vx * dt * 0.06;
      s.y += s.vy * dt * 0.06;
      s.opacity -= 0.008 * dt * 0.06;
      if (s.opacity <= 0 || s.x > W + 200 || s.y > H + 200) {
        shootingStars.splice(i, 1); continue;
      }
      const mag = Math.hypot(s.vx, s.vy);
      const tx = s.x - (s.vx / mag) * s.length;
      const ty = s.y - (s.vy / mag) * s.length;
      const grad = ctx.createLinearGradient(tx, ty, s.x, s.y);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, `rgba(255,255,255,${s.opacity})`);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(s.x, s.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = s.w;
      ctx.stroke();
    }
  }

  function frame(timestamp) {
    rafId = requestAnimationFrame(frame);
    const dt = Math.min(timestamp - lastTime, 50);
    lastTime = timestamp;
    ctx.clearRect(0, 0, W, H);
    drawBgStars(dt);
    drawFallingStars(dt);
    shootingTimer += dt;
    if (shootingTimer >= nextShootingIn) {
      shootingTimer = 0;
      nextShootingIn = randomShootingInterval();
      shootingStars.push(spawnShootingStar());
    }
    drawShootingStars(dt);
    ctx.globalAlpha = 1;
  }

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    W = canvas.width = parent.offsetWidth;
    H = canvas.height = parent.offsetHeight;
    bgStars = buildBgStars(220);
    fallingStars = buildFallingStars(28);
  }

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);
  rafId = requestAnimationFrame((ts) => { lastTime = ts; frame(ts); });

  const mo = new MutationObserver(() => {
    const hidden = el.dropZone.classList.contains('hidden');
    if (hidden && rafId) { cancelAnimationFrame(rafId); rafId = null; }
    else if (!hidden && !rafId) { rafId = requestAnimationFrame((ts) => { lastTime = ts; frame(ts); }); }
  });
  mo.observe(el.dropZone, { attributes: true, attributeFilter: ['class'] });
}
