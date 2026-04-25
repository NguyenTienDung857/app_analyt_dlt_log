const api = window.nexusApi;

const LEVELS = ['Fatal', 'Error', 'Warn', 'Info', 'Debug', 'Verbose', 'Trace', 'Control', 'Unknown'];
const ROW_HEIGHT = 32;
const MAX_RENDER_ROWS = 120;
const DEFAULT_LOG_COLUMNS = [46, 66, 108, 82, 640, 58];
const MIN_LOG_COLUMNS = [34, 42, 72, 58, 180, 44];

const state = {
  messages: [],
  filtered: [],
  files: [],
  bookmarks: new Set(),
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
  aiChatMode: 'selection',
  aiSending: false,
  aiRange: {
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
  lastVirtualStart: -1,
  lastVirtualEnd: -1,
  lastVirtualCount: -1
};

const el = {
  app: document.getElementById('app'),
  dropZone: document.getElementById('drop-zone'),
  workspace: document.getElementById('workspace'),
  btnOpen: document.getElementById('btn-open'),
  btnOpenEmpty: document.getElementById('btn-open-empty'),
  btnDocs: document.getElementById('btn-docs'),
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
  distribution: document.getElementById('distribution'),
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
  markedOnly: document.getElementById('marked-only'),
  btnResetFilter: document.getElementById('btn-reset-filter'),
  btnExportCsv: document.getElementById('btn-export-csv'),
  btnExportJson: document.getElementById('btn-export-json'),
  timeline: document.getElementById('timeline'),
  timelineLabel: document.getElementById('timeline-label'),
  logHeader: document.querySelector('.log-header'),
  showFullTime: document.getElementById('show-full-time'),
  virtualScroll: document.getElementById('virtual-scroll'),
  virtualSpacer: document.getElementById('virtual-spacer'),
  rowsLayer: document.getElementById('rows-layer'),
  minimap: document.getElementById('minimap'),
  detailEmpty: document.getElementById('detail-empty'),
  detailPanel: document.getElementById('detail-panel'),
  btnCopyPayload: document.getElementById('btn-copy-payload'),
  btnCopyDetail: document.getElementById('btn-copy-detail'),
  btnBookmark: document.getElementById('btn-bookmark'),
  btnAnalyzeSelected: document.getElementById('btn-analyze-selected'),
  rangeA: document.getElementById('range-a'),
  rangeB: document.getElementById('range-b'),
  btnCopyRange: document.getElementById('btn-copy-range'),
  btnAnalyzeRange: document.getElementById('btn-analyze-range'),
  aiStatus: document.getElementById('ai-status'),
  aiReport: document.getElementById('ai-report'),
  aiBaseUrl: document.getElementById('ai-base-url'),
  aiModel: document.getElementById('ai-model'),
  aiKey: document.getElementById('ai-key'),
  aiHeaders: document.getElementById('ai-headers'),
  aiAutoScan: document.getElementById('ai-auto-scan'),
  aiWindow: document.getElementById('ai-window'),
  btnSaveAi: document.getElementById('btn-save-ai'),
  signalChart: document.getElementById('signal-chart'),
  btnPlotSignal: document.getElementById('btn-plot-signal'),
  diffPanel: document.getElementById('diff-panel'),
  aiChatLog: document.getElementById('ai-report'),
  aiChatInput: document.getElementById('ai-chat-input'),
  btnAiChatSend: document.getElementById('btn-ai-chat-send'),
  aiChatModeSelect: document.getElementById('ai-chat-mode-select'),
  aiChatRangePanel: document.getElementById('ai-chat-range-panel'),
  aiChatUseRange: document.getElementById('ai-chat-use-range'),
  aiChatFrom: document.getElementById('ai-chat-from'),
  aiChatTo: document.getElementById('ai-chat-to'),
  btnAiChatRangeSelected: document.getElementById('btn-ai-chat-range-selected'),
  btnAiChatRangeClear: document.getElementById('btn-ai-chat-range-clear'),
  aiChatRangeInfo: document.getElementById('ai-chat-range-info'),
  aiRangeStart: document.getElementById('ai-range-start'),
  aiRangeEnd: document.getElementById('ai-range-end'),
  aiRangeFromLabel: document.getElementById('ai-range-from-label'),
  aiRangeToLabel: document.getElementById('ai-range-to-label'),
  aiRangeLimits: document.getElementById('ai-range-limits'),
  aiRangeSelection: document.getElementById('ai-range-selection')
};

init();

function init() {
  wireEvents();
  initLogColumnResize();
  applyLogColumnTemplate();
  api.onParseEvent(handleParseEvent);
  loadAiConfig();
  refreshDocsStatus();
  resetWorkspace();
}

function wireEvents() {
  el.btnOpen.addEventListener('click', openFromDialog);
  el.btnOpenEmpty.addEventListener('click', openFromDialog);
  el.btnClear.addEventListener('click', resetWorkspace);
  el.btnTheme.addEventListener('click', toggleTheme);
  el.btnDocs.addEventListener('click', addDocs);
  el.btnAiFocus.addEventListener('click', toggleAiFocus);

  el.dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    el.dropZone.classList.add('dragover');
  });
  el.dropZone.addEventListener('dragleave', () => el.dropZone.classList.remove('dragover'));
  el.dropZone.addEventListener('drop', async (event) => {
    event.preventDefault();
    el.dropZone.classList.remove('dragover');
    const paths = api.pathsFromDroppedFiles(event.dataTransfer.files);
    if (paths.length) {
      await openFiles(paths);
    }
  });

  for (const item of [el.searchInput, el.searchField, el.caseSensitive, el.regexSearch, el.timeFrom, el.timeTo, el.markedOnly]) {
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

  el.pageSize.addEventListener('change', () => {
    state.pageSize = el.pageSize.value;
    state.currentPage = 1;
    renderAll();
  });
  el.btnPrev.addEventListener('click', () => {
    state.currentPage = Math.max(1, state.currentPage - 1);
    renderAll();
  });
  el.btnNext.addEventListener('click', () => {
    state.currentPage = Math.min(getTotalPages(), state.currentPage + 1);
    renderAll();
  });

  el.btnResetFilter.addEventListener('click', resetFilters);
  el.btnExportCsv.addEventListener('click', () => exportFiltered('csv'));
  el.btnExportJson.addEventListener('click', () => exportFiltered('json'));
  el.btnSaveAi.addEventListener('click', saveAiConfig);
  el.btnNatural.addEventListener('click', runNaturalSearch);

  el.virtualScroll.addEventListener('scroll', scheduleVirtualRows);
  el.rowsLayer.addEventListener('click', handleRowClick);
  el.timeline.addEventListener('click', handleTimelineClick);
  el.minimap.addEventListener('click', handleMinimapClick);
  el.showFullTime.addEventListener('change', () => {
    state.showFullLogTime = el.showFullTime.checked;
    scheduleVirtualRows();
  });

  el.btnCopyPayload.addEventListener('click', copySelectedPayload);
  el.btnCopyDetail.addEventListener('click', copySelectedDetail);
  el.btnBookmark.addEventListener('click', () => toggleBookmark(state.selectedId));
  el.btnAnalyzeSelected.addEventListener('click', () => setAiChatMode('selection'));
  el.btnCopyRange.addEventListener('click', copyRange);
  el.btnAnalyzeRange.addEventListener('click', selectRangeForAi);
  el.btnPlotSignal.addEventListener('click', plotSelectedSignal);
  el.btnAiChatSend.addEventListener('click', () => sendAiChat(state.aiChatMode));
  el.aiChatModeSelect.addEventListener('change', () => setAiChatMode(el.aiChatModeSelect.value));
  el.btnAiChatRangeSelected.addEventListener('click', selectRangeForAi);
  el.btnAiChatRangeClear.addEventListener('click', resetAiRangeToFull);
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

async function openFiles(paths) {
  clearData();
  el.dropZone.classList.add('hidden');
  el.workspace.classList.remove('hidden');
  el.parseStatus.textContent = 'Starting parser worker...';
  el.fileList.innerHTML = paths.map((filePath) => `<div class="file-item">${escapeHtml(shortPath(filePath))}</div>`).join('');
  const result = await api.parseLogs(paths);
  if (!result.ok) {
    el.parseStatus.textContent = result.error || 'Không khởi động được parser.';
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
    renderDiff();
    maybeRunConfiguredAutoScan();
    return;
  }

  if (event.type === 'error') {
    el.parseStatus.textContent = `Parse error: ${event.error}`;
  }
}

function appendMessages(messages) {
  for (const message of messages) {
    if (state.firstTimeMs === null && Number.isFinite(message.timeMs)) {
      state.firstTimeMs = message.timeMs;
    }
    if (Number.isFinite(message.timeMs)) {
      state.lastTimeMs = message.timeMs;
      message.relTimeMs = message.timeMs - state.firstTimeMs;
    } else {
      message.relTimeMs = message.id;
    }
    message.searchBlob = buildSearchBlob(message);
    state.messages.push(message);
  }
  if (!hasActiveFilters()) {
    for (let index = state.filtered.length; index < state.messages.length; index += 1) {
      state.filtered.push(index);
    }
  } else {
    applyFilters(false);
  }
}

function applyFilters(render = true) {
  const matcher = buildTextMatcher();
  const fromMs = resolveTimeInput(el.timeFrom.value, false);
  const toMs = resolveTimeInput(el.timeTo.value, false);
  const minTime = Number.isFinite(fromMs) ? fromMs : -Infinity;
  const maxTime = Number.isFinite(toMs) ? toMs : Infinity;
  const markedOnly = el.markedOnly.checked;
  const levelFilter = state.levelFilter;
  const naturalFilter = state.naturalFilter;

  state.filtered = [];
  for (let index = 0; index < state.messages.length; index += 1) {
    const message = state.messages[index];
    if (markedOnly && !state.bookmarks.has(message.id)) continue;
    if (levelFilter && levelFilter.size && !levelFilter.has(message.level)) continue;
    if (naturalFilter && !messageMatchesNaturalFilter(message, naturalFilter)) continue;
    if (Number.isFinite(message.timeMs) && (message.timeMs < minTime || message.timeMs > maxTime)) continue;
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

  const field = el.searchField.value;
  const caseSensitive = el.caseSensitive.checked;
  const useRegex = el.regexSearch.checked;
  let regex = null;
  let needle = query;

  if (useRegex) {
    try {
      regex = new RegExp(query, caseSensitive ? 'g' : 'gi');
    } catch (error) {
      el.parseStatus.textContent = `Invalid regex: ${error.message}`;
      return () => false;
    }
  } else if (!caseSensitive) {
    needle = query.toLowerCase();
  }

  return (message) => {
    const value = field === 'all' ? message.searchBlob : String(message[field] || '');
    if (regex) {
      regex.lastIndex = 0;
      return regex.test(value);
    }
    const haystack = caseSensitive ? value : value.toLowerCase();
    return haystack.includes(needle);
  };
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
    el.timeFrom.value.trim() ||
    el.timeTo.value.trim() ||
    el.markedOnly.checked ||
    (state.levelFilter && state.levelFilter.size) ||
    Boolean(state.naturalFilter)
  );
}

function resetFilters() {
  el.searchInput.value = '';
  el.timeFrom.value = '';
  el.timeTo.value = '';
  el.markedOnly.checked = false;
  el.caseSensitive.checked = false;
  el.regexSearch.checked = false;
  el.searchField.value = 'all';
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
  renderDistribution();
  renderPagination();
  renderVirtualRows();
  renderTimeline();
  renderMinimap();
  renderDetail(getSelectedMessage());
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

function renderDistribution() {
  const counts = Object.fromEntries(LEVELS.map((level) => [level, 0]));
  for (const index of state.filtered) {
    const level = state.messages[index].level || 'Unknown';
    counts[level] = (counts[level] || 0) + 1;
  }
  const max = Math.max(1, ...Object.values(counts));
  el.distribution.innerHTML = LEVELS.map((level) => {
    const count = counts[level] || 0;
    const width = Math.max(2, (count / max) * 100);
    return `
      <div class="bar-row">
        <span>${level}</span>
        <div class="bar-track"><div class="bar-fill level-bg-${level}" style="width:${width}%"></div></div>
        <span>${formatNumber(count)}</span>
      </div>
    `;
  }).join('');
}

function renderPagination() {
  const totalPages = getTotalPages();
  state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);
  el.pageInfo.textContent = `Page ${state.currentPage}/${totalPages}`;
  el.btnPrev.disabled = state.currentPage <= 1;
  el.btnNext.disabled = state.currentPage >= totalPages;
}

function renderVirtualRows() {
  const pageIndices = getCurrentPageIndices();
  const count = pageIndices.length;
  const viewportHeight = el.virtualScroll.clientHeight || 1;
  const scrollTop = el.virtualScroll.scrollTop;
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 12);
  const visibleCount = Math.min(MAX_RENDER_ROWS, Math.ceil(viewportHeight / ROW_HEIGHT) + 24);
  const end = Math.min(count, start + visibleCount);

  el.virtualSpacer.style.height = `${count * ROW_HEIGHT}px`;
  el.rowsLayer.style.transform = `translateY(${start * ROW_HEIGHT}px)`;

  const rows = [];
  for (let localIndex = start; localIndex < end; localIndex += 1) {
    const message = state.messages[pageIndices[localIndex]];
    rows.push(renderRow(message, localIndex));
  }
  el.rowsLayer.innerHTML = rows.join('');
  state.lastVirtualStart = start;
  state.lastVirtualEnd = end;
  state.lastVirtualCount = count;
}

function scheduleVirtualRows() {
  if (state.virtualRenderQueued) return;
  state.virtualRenderQueued = true;
  requestAnimationFrame(() => {
    state.virtualRenderQueued = false;
    renderVirtualRows();
  });
}

function renderRow(message, localIndex) {
  const bookmarked = state.bookmarks.has(message.id);
  const selected = state.selectedId === message.id;
  const aiHit = state.aiHighlights.has(message.id);
  return `
    <div class="log-row log-grid ${selected ? 'selected' : ''} ${bookmarked ? 'bookmarked' : ''} ${aiHit ? 'ai-hit' : ''}" data-id="${message.id}" data-local-index="${localIndex}">
      <div class="mark-cell" data-action="mark">${bookmarked ? 'B' : '-'}</div>
      <div>${message.id}</div>
      <div title="${escapeHtml(message.time)}">${escapeHtml(formatLogTime(message))}</div>
      <div>${formatDelta(message.deltaMs)}</div>
      <div class="payload-cell" title="${escapeHtml(message.payload || '')}">${highlightSearch(message.payload || '')}</div>
      <div>${message.length || message.payloadLength || 0}</div>
    </div>
  `;
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
    handle.title = 'Kéo để đổi độ rộng cột';
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
  const template = `${widths[0]}px ${widths[1]}px ${widths[2]}px ${widths[3]}px minmax(${widths[4]}px, 1fr) ${widths[5]}px`;
  document.documentElement.style.setProperty('--log-grid-columns', template);
}

function loadLogColumnWidths() {
  try {
    const parsed = JSON.parse(localStorage.getItem('bltn-log-column-widths') || '[]');
    if (Array.isArray(parsed) && parsed.length === DEFAULT_LOG_COLUMNS.length) {
      return parsed.map((value, index) => clampNumber(value, MIN_LOG_COLUMNS[index], 1200));
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
  const row = event.target.closest('.log-row');
  if (!row) return;
  const id = Number(row.dataset.id);
  if (event.target.dataset.action === 'mark') {
    toggleBookmark(id);
    return;
  }
  selectMessage(id, true);
}

function selectMessage(id, ensureVisible) {
  if (!Number.isFinite(id)) return;
  state.selectedId = id;
  const message = getSelectedMessage();
  if (message) {
    el.rangeA.value = el.rangeA.value || String(message.id);
    el.rangeB.value = String(message.id);
  }
  if (ensureVisible) {
    scrollToMessage(id);
  }
  renderAll();
}

function scrollToMessage(id) {
  const pageIndices = getCurrentPageIndices();
  const messageIndex = state.messages.findIndex((message) => message.id === id);
  const localIndex = pageIndices.indexOf(messageIndex);
  if (localIndex >= 0) {
    const viewportHeight = el.virtualScroll.clientHeight || 0;
    const currentScroll = el.virtualScroll.scrollTop;
    const rowTop = localIndex * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;
    if (rowTop < currentScroll || rowBottom > currentScroll + viewportHeight) {
      el.virtualScroll.scrollTop = Math.max(0, rowTop - ROW_HEIGHT * 4);
    }
    return;
  }

  const filteredPosition = state.filtered.indexOf(messageIndex);
  if (filteredPosition >= 0 && state.pageSize !== 'all') {
    state.currentPage = Math.floor(filteredPosition / Number(state.pageSize)) + 1;
    renderPagination();
    el.virtualScroll.scrollTop = (filteredPosition % Number(state.pageSize)) * ROW_HEIGHT;
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
    el.timelineLabel.textContent = 'Timeline not loaded';
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
  drawHourlyTicks(ctx, min, max, width, height, top, bottom);
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

  ctx.fillStyle = 'rgba(237,247,242,0.7)';
  ctx.font = '11px Cascadia Code, Consolas, monospace';
  ctx.fillText(formatTimeLabel(min), 8, 14);
  ctx.textAlign = 'right';
  ctx.fillText(formatTimeLabel(max), width - 8, 14);
  ctx.textAlign = 'left';
  el.timelineLabel.textContent = `${formatTimeLabel(min)} -> ${formatTimeLabel(max)} | ${formatDuration(span)} | hourly ticks`;
}

function drawStack(ctx, x, yBottom, barWidth, count, maxCount, color, plotHeight) {
  if (!count) return;
  const barHeight = Math.max(1, (count / maxCount) * plotHeight);
  ctx.fillStyle = color;
  ctx.fillRect(x, yBottom - barHeight, Math.max(1, barWidth - 1), barHeight);
}

function drawHourlyTicks(ctx, min, max, width, height, top, bottom) {
  const hourMs = 60 * 60 * 1000;
  const firstHour = Math.ceil(min / hourMs) * hourMs;
  if (!Number.isFinite(firstHour) || firstHour > max) return;

  const hourCount = Math.max(1, Math.floor((max - firstHour) / hourMs) + 1);
  const labelEvery = Math.max(1, Math.ceil(hourCount / Math.max(1, Math.floor(width / 88))));
  ctx.save();
  ctx.font = '10px Cascadia Code, Consolas, monospace';
  ctx.textAlign = 'left';
  ctx.strokeStyle = 'rgba(237,247,242,0.11)';
  ctx.fillStyle = 'rgba(237,247,242,0.56)';

  let index = 0;
  for (let tick = firstHour; tick <= max; tick += hourMs) {
    const x = ((tick - min) / Math.max(1, max - min)) * width;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    if (index % labelEvery === 0) {
      ctx.fillText(formatHourTick(tick), Math.min(width - 46, x + 3), height - 7);
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
    ${kv('Delta', formatDelta(message.deltaMs))}
    ${kv('ECU/APID/CTID', `${message.ecu}/${message.apid}/${message.ctid}`)}
    ${kv('Level', message.level)}
    ${kv('Type', `${message.type}/${message.subtype}`)}
    ${kv('Session', message.session ?? '-')}
    ${kv('Counter', message.counter ?? '-')}
    ${kv('Offset', message.fileOffset)}
    ${kv('Length', `${message.length} bytes`)}
    ${kv('Message ID', message.messageId || '-')}
    ${kv('Decode', message.decodeStatus || '-')}
    <div class="raw-box">${escapeHtml(message.payload || '')}</div>
    <div class="raw-box">ASCII\n${escapeHtml(message.payloadAscii || '')}</div>
    <div class="raw-box">HEX${message.payloadHexTruncated ? ' (truncated)' : ''}\n${escapeHtml(message.payloadHex || '')}</div>
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

function renderDiff() {
  const files = state.files.filter(Boolean);
  if (files.length < 2) {
    el.diffPanel.textContent = 'Open two files to view signature diff.';
    return;
  }

  const groups = new Map();
  for (const message of state.messages) {
    const signature = `${message.level}|${message.ecu}|${message.apid}|${message.ctid}|${normalizePayload(message.payload)}`;
    if (!groups.has(signature)) groups.set(signature, new Set());
    groups.get(signature).add(message.fileIndex);
  }

  const onlyFirst = [];
  const onlySecond = [];
  for (const [signature, fileSet] of groups.entries()) {
    if (fileSet.size === 1 && fileSet.has(0)) onlyFirst.push(signature);
    if (fileSet.size === 1 && fileSet.has(1)) onlySecond.push(signature);
  }

  el.diffPanel.innerHTML = [
    `Unique in ${files[0].fileName}: ${onlyFirst.length}`,
    ...onlyFirst.slice(0, 8).map((item) => `  - ${escapeHtml(item.slice(0, 150))}`),
    '',
    `Unique in ${files[1].fileName}: ${onlySecond.length}`,
    ...onlySecond.slice(0, 8).map((item) => `  - ${escapeHtml(item.slice(0, 150))}`)
  ].join('\n');
}

async function loadAiConfig() {
  state.aiConfig = await api.getAiConfig();
  el.aiBaseUrl.value = state.aiConfig.baseUrl || '';
  el.aiModel.value = state.aiConfig.model || '';
  el.aiHeaders.value = JSON.stringify(state.aiConfig.headers || {}, null, 2);
  el.aiAutoScan.checked = Boolean(state.aiConfig.autoScan);
  el.aiWindow.value = state.aiConfig.contextWindowMs || 500;
  el.aiKey.placeholder = state.aiConfig.apiKeySet ? `Saved ${state.aiConfig.apiKeyPreview}` : 'Paste API key';
}

async function saveAiConfig() {
  let headers = {};
  try {
    headers = JSON.parse(el.aiHeaders.value || '{}');
  } catch (error) {
    setAiStatus(`Invalid headers JSON: ${error.message}`, true);
    return;
  }

  state.aiConfig = await api.saveAiConfig({
    baseUrl: el.aiBaseUrl.value,
    model: el.aiModel.value,
    apiKey: el.aiKey.value,
    headers,
    autoScan: el.aiAutoScan.checked,
    contextWindowMs: Number(el.aiWindow.value || 500),
    maxLogLines: 1400
  });
  el.aiKey.value = '';
  el.aiKey.placeholder = state.aiConfig.apiKeySet ? `Saved ${state.aiConfig.apiKeyPreview}` : 'Paste API key';
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

async function maybeRunConfiguredAutoScan() {
  const config = await api.getAiConfig();
  state.aiConfig = config;
  if (config.autoScan && config.apiKeySet) {
    setAiChatMode('errors');
    setAiStatus('Đã chọn mode Bug tiềm ẩn. AI sẽ chỉ chạy khi bạn bấm Send.', false);
  }
}

async function runAutoAiScan() {
  if (!state.messages.length) {
    setAiStatus('Chưa có log để auto-scan. Hãy mở file DLT/log trước.', true);
    renderAiObject('Auto Scan', {
      summary: 'Chưa có dữ liệu log.',
      recommended_action: 'Mở file log trước, sau đó bấm Run AI Auto Scan.'
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
    setAiStatus('Auto-scan không tìm thấy message đủ điều kiện để phân tích.', true);
    renderAiObject('Auto Scan', {
      summary: 'Không tìm thấy Error/Fatal/Warn hoặc keyword nghi ngờ trong log.',
      recommended_action: 'Dùng Search hoặc chọn thủ công một khoảng thời gian A-B rồi bấm AI A-B.'
    });
    return;
  }

  setAiStatus(`Auto-scan đang phân tích ${targets.length} cụm nghi ngờ...`, false);
  for (const cluster of targets.slice(0, 10)) {
    for (const message of buildLocalContext(cluster.fromMs, cluster.toMs, Number(el.aiWindow.value || 500), 220)) {
      if (!seen.has(message.id)) {
        contextMessages.push(message);
        seen.add(message.id);
      }
    }
  }

  await runAiAnalysis({
    title: 'Báo cáo chẩn đoán tổng thể bằng Auto-scan',
    mode: 'auto-scan',
    query: clusters.length
      ? 'Phân tích tất cả cụm Error/Fatal và tìm nguyên nhân gốc có khả năng cao nhất của Built-in Cam ECU. Trả lời bằng tiếng Việt.'
      : 'Log không có Error/Fatal rõ ràng. Hãy phân tích các Warn/keyword nghi ngờ và tìm bất thường tiềm ẩn của Built-in Cam ECU. Trả lời bằng tiếng Việt.',
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
    title: `Phân tích message ${message.id}`,
    mode: 'selected-message',
    query: `Phân tích lỗi/triệu chứng trong message này và trả lời bằng tiếng Việt: ${message.level} ${message.ecu}/${message.apid}/${message.ctid} ${message.payload}`,
    messages: context,
    selectedIds: [message.id],
    fromMs: message.timeMs,
    toMs: message.timeMs,
    stats: collectStats()
  });
}

async function analyzeRange() {
  const range = resolveRange();
  if (!range) {
    setAiStatus('Range A/B is invalid.', true);
    return;
  }
  const context = buildLocalContext(range.fromMs, range.toMs, Number(el.aiWindow.value || 500), 1200);
  await runAiAnalysis({
    title: `Phân tích khoảng ${formatTimeLabel(range.fromMs)} -> ${formatTimeLabel(range.toMs)}`,
    mode: 'time-range',
    query: 'Phân tích khoảng thời gian A-B để tìm lỗi Built-in Cam ECU và nguyên nhân gốc. Trả lời bằng tiếng Việt.',
    messages: context,
    fromMs: range.fromMs,
    toMs: range.toMs,
    stats: collectStats()
  });
}

async function sendAiChat(mode) {
  if (state.aiSending) return;
  mode = mode === 'auto' ? state.aiChatMode : (mode || state.aiChatMode);
  const typedQuestion = el.aiChatInput.value.trim();
  const question = typedQuestion || defaultChatQuestion(mode);
  if (!question) {
    setAiStatus('Hãy nhập câu hỏi cho AI hoặc chọn một quick action.', true);
    return;
  }

  const rawContextMessages = buildChatContextMessages(mode);
  if (!rawContextMessages.length) {
    setAiStatus('Chưa có log context để gửi AI. Hãy mở file log trước.', true);
    return;
  }
  const contextMessages = rawContextMessages.map(toAiMessage);
  const aiQuestion = withHiddenAiInstructions(question, mode);
  const maxLogLines = getAiChatMaxLogLines(mode, contextMessages.length);
  const estimatedContextMessages = Math.min(contextMessages.length, maxLogLines);

  appendChatBubble('user', question, estimatedContextMessages);
  const pendingBubble = appendChatBubble('assistant', 'AI đang phân tích context và chờ phản hồi...', estimatedContextMessages);
  el.aiChatInput.value = '';
  setAiSending(true);
  setAiStatus(`AI đang xử lý chat với tối đa ${formatNumber(estimatedContextMessages)} message context...`, false);

  try {
    const response = await api.chatWithAi({
      question: aiQuestion,
      mode,
      messages: contextMessages,
      stats: collectAiStats(mode, rawContextMessages),
      maxLogLines
    });
    if (!response.ok) {
      updateChatBubble(pendingBubble, 'assistant', `Lỗi AI: ${response.error || 'Không gọi được AI.'}`);
      setAiStatus(response.error || 'AI chat thất bại.', true);
      return;
    }

    const resultText = String(response.result || '').trim();
    if (!resultText) {
      throw new Error('AI đã trả về response rỗng. Chưa coi là hoàn tất; hãy thử lại hoặc giảm phạm vi nếu model bị quá tải context.');
    }

    const responseMeta = {
      contextMessages: response.promptStats?.contextMessages || contextMessages.length,
      docs: response.promptStats?.docs || 0,
      docSources: response.promptStats?.docSources || 0
    };
    updateChatBubble(pendingBubble, 'assistant', resultText, responseMeta.contextMessages, responseMeta.docs, responseMeta.docSources);
    setAiStatus(`AI chat xong. Đã gửi ${formatNumber(responseMeta.contextMessages)} message và ${formatAiDocUsage(responseMeta)}.`, false);
  } catch (error) {
    updateChatBubble(pendingBubble, 'assistant', `Lỗi AI: ${error.message}`);
    setAiStatus(`AI chat lỗi: ${error.message}`, true);
  } finally {
    setAiSending(false);
  }
}

function getAiChatMaxLogLines(mode, contextCount) {
  if (mode === 'errors') {
    return Math.max(1, Number(contextCount || 0));
  }
  return Math.max(1, Number(state.aiConfig?.maxLogLines || 1400));
}

function resolveChatRange() {
  if (state.aiChatMode !== 'range') return null;
  const from = Number(state.aiRange.from ?? el.aiRangeStart.value);
  const to = Number(state.aiRange.to ?? el.aiRangeEnd.value);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return { fromMs: Math.min(from, to), toMs: Math.max(from, to) };
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
      ? `Dòng #${selected.id}, kèm message lân cận theo thời gian`
      : 'Chưa chọn dòng log';
    return;
  }
  if (state.aiChatMode === 'errors') {
    el.aiChatRangeInfo.textContent = `${formatNumber(state.messages.length)} message toàn log`;
    return;
  }
  const range = resolveChatRange();
  if (!range) {
    el.aiChatRangeInfo.textContent = 'Chưa chọn khoảng thời gian';
    return;
  }
  const count = countMessagesInRange(range.fromMs, range.toMs);
  el.aiChatRangeInfo.textContent = `${formatNumber(count)} message trong khoảng đã chọn`;
}

function buildChatContextMessages(mode) {
  if (!state.messages.length) return [];
  mode = mode || state.aiChatMode;

  if (mode === 'range') {
    const chatRange = resolveChatRange();
    if (chatRange) {
      return messagesInRange(chatRange.fromMs, chatRange.toMs);
    }
    return [];
  }

  if (mode === 'selection') {
    const selected = getSelectedMessage();
    if (selected) {
      return buildLocalContext(selected.timeMs, selected.timeMs, Math.max(2000, Number(el.aiWindow.value || 500)), 900);
    }
  }

  if (mode === 'errors') {
    return state.messages.slice();
  }

  if (mode === 'filtered' || state.filtered.length) {
    return buildFilteredContextMessages(1200);
  }

  return state.messages.slice(0, Math.min(1200, state.messages.length));
}

function buildFilteredContextMessages(limit) {
  const filteredMessages = state.filtered.map((index) => state.messages[index]).filter(Boolean);
  if (filteredMessages.length <= limit) return filteredMessages;

  const important = filteredMessages.filter((message) => (
    message.level === 'Fatal' ||
    message.level === 'Error' ||
    message.level === 'Warn' ||
    state.bookmarks.has(message.id) ||
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
  if (mode === 'selection') {
    return 'Hãy phân tích dòng log hiện tại và các message lân cận. Trả lời đúng 4 mục: xác thực có phải lỗi không, nguyên nhân vì sao lỗi, hậu quả lỗi, cách tái hiện lỗi.';
  }
  if (mode === 'range') {
    return 'Hãy phân tích khoảng thời gian đã chọn. Trả lời đúng 4 mục: xác thực có phải lỗi không, nguyên nhân vì sao lỗi, hậu quả lỗi, cách tái hiện lỗi.';
  }
  if (mode === 'errors') {
    return 'Tôi nghi ngờ có bug tiềm ẩn. Hãy quét toàn bộ timeline + payload để tìm lỗi quan trọng nhất và trả lời đúng 4 mục: xác thực có phải lỗi không, nguyên nhân vì sao lỗi, hậu quả lỗi, cách tái hiện lỗi.';
  }
  return 'Hãy phân tích context log hiện tại và trả lời theo cấu trúc chẩn đoán lỗi.';
}

function withHiddenAiInstructions(question, mode) {
  const range = mode === 'range' ? resolveChatRange() : null;
  const rangeText = range ? `Range: ${formatTimeLabel(range.fromMs)} -> ${formatTimeLabel(range.toMs)}.` : '';
  return [
    question,
    '',
    'Yeu cau an cua UI: tu dung timeline/sequence tu context, neu co nghi van loi thi luon neu cach tai hien/sequence tai hien ngan gon. Khong can nguoi dung bam nut rieng cho sequence hay reproduction.',
    rangeText
  ].filter(Boolean).join('\n');
}

function setAiChatMode(mode) {
  state.aiChatMode = mode || 'selection';
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

function syncAiRangeControls() {
  if (!el.aiRangeStart || !el.aiRangeEnd) return;
  if (!Number.isFinite(state.firstTimeMs) || !Number.isFinite(state.lastTimeMs)) {
    el.aiRangeStart.disabled = true;
    el.aiRangeEnd.disabled = true;
    el.aiRangeStart.value = '0';
    el.aiRangeEnd.value = '0';
    el.aiRangeFromLabel.textContent = '-';
    el.aiRangeToLabel.textContent = '-';
    el.aiRangeSelection.style.left = '0%';
    el.aiRangeSelection.style.width = '0%';
    el.aiRangeLimits.textContent = 'Chưa có log';
    return;
  }

  const min = state.firstTimeMs;
  const max = Math.max(min, state.lastTimeMs);
  const boundsChanged = state.aiRange.min !== min || state.aiRange.max !== max;
  state.aiRange.min = min;
  state.aiRange.max = max;
  if (boundsChanged || !state.aiRange.dirty || !Number.isFinite(state.aiRange.from) || !Number.isFinite(state.aiRange.to)) {
    state.aiRange.from = min;
    state.aiRange.to = max;
  }

  const step = getAiRangeStep(max - min);
  for (const input of [el.aiRangeStart, el.aiRangeEnd]) {
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.disabled = false;
  }
  state.aiRange.from = clampNumber(state.aiRange.from, min, max);
  state.aiRange.to = clampNumber(state.aiRange.to, min, max);
  if (state.aiRange.from > state.aiRange.to) {
    const tmp = state.aiRange.from;
    state.aiRange.from = state.aiRange.to;
    state.aiRange.to = tmp;
  }
  applyAiRangeValues();
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
  if (!Number.isFinite(state.firstTimeMs) || !Number.isFinite(state.lastTimeMs)) return;
  state.aiRange.dirty = false;
  setAiRange(state.firstTimeMs, state.lastTimeMs, false);
  setAiChatMode('range');
  if (focus) el.aiChatInput.focus();
}

function selectRangeForAi() {
  const range = resolveRange() || selectedRange();
  if (!range) {
    setAiStatus('Range A/B is invalid.', true);
    return;
  }
  setAiRange(range.fromMs, range.toMs, true);
  setAiChatMode('range');
}

function prepareRangePrompt(prompt) {
  selectRangeForAi();
  if (prompt && !el.aiChatInput.value.trim()) {
    el.aiChatInput.value = prompt;
  }
}

function setAiRange(fromMs, toMs, dirty) {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return;
  const min = Number.isFinite(state.aiRange.min) ? state.aiRange.min : Math.min(fromMs, toMs);
  const max = Number.isFinite(state.aiRange.max) ? state.aiRange.max : Math.max(fromMs, toMs);
  state.aiRange.from = clampNumber(Math.min(fromMs, toMs), min, max);
  state.aiRange.to = clampNumber(Math.max(fromMs, toMs), min, max);
  state.aiRange.dirty = Boolean(dirty);
  applyAiRangeValues();
  updateChatRangeInfo();
}

function applyAiRangeValues() {
  const from = Number.isFinite(state.aiRange.from) ? state.aiRange.from : 0;
  const to = Number.isFinite(state.aiRange.to) ? state.aiRange.to : from;
  el.aiRangeStart.value = String(from);
  el.aiRangeEnd.value = String(to);
  el.aiChatFrom.value = String(from);
  el.aiChatTo.value = String(to);
  el.aiRangeFromLabel.textContent = formatTimeLabel(from);
  el.aiRangeToLabel.textContent = formatTimeLabel(to);
  if (Number.isFinite(state.aiRange.min) && Number.isFinite(state.aiRange.max)) {
    const span = Math.max(1, state.aiRange.max - state.aiRange.min);
    const left = ((Math.min(from, to) - state.aiRange.min) / span) * 100;
    const width = ((Math.max(from, to) - Math.min(from, to)) / span) * 100;
    el.aiRangeSelection.style.left = `${clampNumber(left, 0, 100)}%`;
    el.aiRangeSelection.style.width = `${clampNumber(width, 0, 100)}%`;
    el.aiRangeLimits.textContent = `${formatHourTick(state.aiRange.min)} -> ${formatHourTick(state.aiRange.max)}`;
  }
}

function getAiRangeStep(spanMs) {
  if (spanMs > 24 * 60 * 60 * 1000) return 60 * 1000;
  if (spanMs > 60 * 60 * 1000) return 1000;
  if (spanMs > 60 * 1000) return 100;
  return 1;
}

function messagesInRange(fromMs, toMs) {
  const start = Math.min(fromMs, toMs);
  const end = Math.max(fromMs, toMs);
  return state.messages.filter((message) => Number.isFinite(message.timeMs) && message.timeMs >= start && message.timeMs <= end);
}

function countMessagesInRange(fromMs, toMs) {
  let count = 0;
  const start = Math.min(fromMs, toMs);
  const end = Math.max(fromMs, toMs);
  for (const message of state.messages) {
    if (Number.isFinite(message.timeMs) && message.timeMs >= start && message.timeMs <= end) count += 1;
  }
  return count;
}

function toAiMessage(message) {
  return {
    time: formatAiClockTime(message),
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

function appendChatBubble(role, text, contextCount = null, docCount = null, docSourceCount = null) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  updateChatBubble(bubble, role, text, contextCount, docCount, docSourceCount);
  el.aiChatLog.appendChild(bubble);
  el.aiChatLog.scrollTop = el.aiChatLog.scrollHeight;
  return bubble;
}

function updateChatBubble(bubble, role, text, contextCount = null, docCount = null, docSourceCount = null) {
  if (!bubble) return;
  bubble.className = `chat-bubble ${role}`;
  const meta = [];
  if (contextCount !== null) meta.push(`${formatNumber(contextCount)} log messages`);
  if (docCount !== null) meta.push(formatAiDocUsage({ docs: docCount, docSources: docSourceCount }));
  bubble.innerHTML = `
    <strong>${role === 'user' ? 'Bạn' : 'AI'}</strong>
    ${meta.length ? `<span class="chat-meta">${escapeHtml(meta.join(' | '))}</span>` : ''}
    <p>${escapeHtml(String(text || '')).replace(/\n/g, '<br>')}</p>
  `;
  el.aiChatLog.scrollTop = el.aiChatLog.scrollHeight;
}

function formatAiDocUsage(meta = {}) {
  const docs = Number(meta.docs || 0);
  const sources = Number(meta.docSources || 0);
  if (!docs) return '0 đoạn trích ECU';
  return sources
    ? `${formatNumber(docs)} đoạn trích / ${formatNumber(sources)} tài liệu ECU`
    : `${formatNumber(docs)} đoạn trích ECU`;
}

function setAiSending(isSending) {
  state.aiSending = Boolean(isSending);
  el.btnAiChatSend.disabled = isSending;
  el.aiChatModeSelect.disabled = isSending;
  el.btnAiChatSend.textContent = isSending ? 'Đợi...' : 'Send';
}

async function runAiAnalysis(payload) {
  setAiStatus('AI đang phân tích...', false);
  try {
    const response = await api.analyzeWithAi(payload);
    if (!response.ok) {
      setAiStatus(response.error || 'AI phân tích thất bại.', true);
      return;
    }
    const enrichedResult = enrichAiResult(response.result, payload);
    applyAiResult(enrichedResult);
    setAiStatus(`AI đã phân tích xong. Context: ${response.promptStats.contextMessages} message, docs: ${response.promptStats.docs}.`, false);
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

  if (isSparseVietnameseField(next.summary, 'tóm tắt') && first) {
    next.summary = `AI đã đánh dấu ${ids.length || 1} message nghi ngờ trong cửa sổ log. Message nổi bật: #${first.id} ${first.level || 'Unknown'} ${first.ecu || '-'}/${first.apid || '-'}/${first.ctid || '-'} tại ${first.time || '-'} với payload: ${(first.payload || '').slice(0, 220)}.`;
  }

  if (isSparseVietnameseField(next.error_verification, 'xác thực') && first) {
    next.error_verification = `Có dấu hiệu lỗi/nghi vấn quanh message #${first.id} tại ${first.time || '-'}, nhưng cần đối chiếu thêm tài liệu và log lân cận để xác thực tuyệt đối.`;
  }

  if (isSparseVietnameseField(next.root_cause, 'nguyên nhân') && first) {
    next.root_cause = `Chưa đủ bằng chứng để kết luận tuyệt đối, nhưng điểm nghi ngờ chính nằm ở luồng ${first.ecu || '-'}/${first.apid || '-'}/${first.ctid || '-'} quanh message #${first.id}. Cần đối chiếu các message trước/sau, trạng thái camera/storage/network và mapping non-verbose nếu có.`;
  }

  if (isSparseVietnameseField(next.impact, 'hậu quả')) {
    next.impact = 'Chưa đủ dữ liệu để lượng hóa hậu quả; cần kiểm tra triệu chứng sau vùng nghi ngờ như timeout, mất frame, reset, degraded mode hoặc DTC phát sinh.';
  }

  if (!Array.isArray(next.reproduction_steps) || !next.reproduction_steps.length) {
    next.reproduction_steps = [
      'Replay hoặc tái tạo điều kiện quanh các message nghi ngờ theo đúng thứ tự thời gian.',
      'Mở rộng cửa sổ thời gian trước/sau lỗi và kiểm tra điều kiện kích hoạt trong tài liệu ECU.',
      'Xác nhận lại bằng log mới có cùng payload/timing hoặc DTC tương ứng.'
    ];
  }

  if (isSparseVietnameseField(next.recommended_action, 'khuyến nghị')) {
    next.recommended_action = ids.length
      ? `Kiểm tra các message #${ids.slice(0, 12).join(', ')} trên timeline, mở rộng window phân tích lên 2000-5000 ms nếu lỗi kéo dài, rồi đối chiếu với tài liệu ECU/FIBEX/ARXML để xác nhận nguyên nhân.`
      : 'Mở rộng khoảng thời gian A-B quanh vùng nghi ngờ, kiểm tra warning/error liên tiếp, và nạp thêm FIBEX/ARXML nếu log là non-verbose.';
  }

  if (!Array.isArray(next.next_steps) || !next.next_steps.length) {
    next.next_steps = [
      'Mở rộng context quanh lỗi và chạy lại AI A-B.',
      'Kiểm tra các message đã bookmark/highlight trên timeline.',
      'Nạp thêm FIBEX/ARXML nếu payload non-verbose chưa decode được.'
    ];
  }

  return next;
}

function isSparseVietnameseField(value, kind) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return true;
  if (text.includes('ai chưa')) return true;
  if (text.includes('did not provide')) return true;
  if (text.includes('not explicit')) return true;
  if (text.includes('collect more context')) return true;
  if (kind === 'tóm tắt' && text.length < 12) return true;
  return false;
}

async function runNaturalSearch() {
  const query = el.naturalQuery.value.trim();
  if (!query) return;
  setAiStatus('AI đang chuyển câu tìm kiếm tự nhiên thành filter...', false);
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
  }
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
  el.searchField.value = 'all';
  el.caseSensitive.checked = false;
  el.regexSearch.checked = false;

  if (safePlan.from_time) el.timeFrom.value = safePlan.from_time;
  if (safePlan.to_time) el.timeTo.value = safePlan.to_time;

  applyFilters();
  let relaxedBy = '';
  if (state.filtered.length === 0 && state.levelFilter && state.levelFilter.size) {
    state.levelFilter = null;
    relaxedBy = 'Bỏ level filter vì không có dòng match, giữ keyword/concept filter.';
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
  renderAiObject('Natural Search', report);
  const prefix = source === 'ai' ? 'Đã áp dụng AI Search' : 'Đã áp dụng tìm kiếm local thông minh';
  const suffix = errorMessage ? ` Lý do fallback: ${errorMessage}` : '';
  setAiStatus(`${prefix}: tìm thấy ${formatNumber(state.filtered.length)} dòng.${suffix}`, state.filtered.length === 0);
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
      ? `Đã nhận diện ${concepts.map((concept) => concept.label).join(', ')} từ câu hỏi tự nhiên.`
      : 'Đã tách keyword từ câu hỏi tự nhiên để tìm trong log.',
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
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

const NATURAL_STOP_WORDS = new Set([
  'tim', 'kiem', 'cho', 'toi', 'nhung', 'luc', 'khi', 'sau', 'truoc', 'trong', 'khoang',
  'cac', 'dong', 'log', 'message', 'ban', 'tin', 'co', 'bi', 'va', 'hoac', 'neu', 'thi',
  'the', 'nao', 'hay', 'giup', 'minh', 'cua', 'ecu', 'app'
]);

const NATURAL_CONCEPTS = [
  {
    label: 'camera/frame/FPS',
    triggers: ['camera', 'cam', 'frame', 'fps', 'rot frame', 'drop frame', 'mat frame'],
    terms: ['camera', 'cam', 'frame', 'fps', 'drop', 'dropped', 'lost', 'miss', 'timeout', 'sensor', 'isp', 'lvds']
  },
  {
    label: 'nhiệt độ/quá nhiệt',
    triggers: ['nhiet do', 'qua nhiet', 'nong', 'temperature', 'temp', 'thermal', 'overheat'],
    terms: ['temperature', 'temp', 'thermal', 'overheat', 'hot', 'nhiet', 'nong']
  },
  {
    label: 'điện áp/nguồn',
    triggers: ['dien ap', 'nguon', 'voltage', 'volt', '12v', 'undervoltage', 'overvoltage', 'power'],
    terms: ['voltage', 'volt', 'power', 'undervoltage', 'overvoltage', 'battery', '12v', 'acc', 'ign']
  },
  {
    label: 'timeout/treo/chậm phản hồi',
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
  const range = resolveRange() || selectedRange();
  if (!range) return;
  const context = buildLocalContext(range.fromMs, range.toMs, Number(el.aiWindow.value || 500), 500);
  setAiStatus('AI đang tạo sequence diagram...', false);
  const response = await api.sequenceDiagram({
    query: 'Generate Mermaid sequence diagram for selected DLT messages.',
    messages: context,
    fromMs: range.fromMs,
    toMs: range.toMs
  });
  if (!response.ok) {
    setAiStatus(response.error || 'Tạo sequence diagram thất bại.', true);
    return;
  }
  applyAiHighlights(response.result.suspicious_message_ids || []);
  renderAiObject('Sequence Diagram', response.result);
  setAiStatus('Đã tạo sequence diagram.', false);
}

async function generateScript() {
  const range = resolveRange() || selectedRange();
  if (!range) return;
  const context = buildLocalContext(range.fromMs, range.toMs, Number(el.aiWindow.value || 500), 700);
  setAiStatus('AI đang tạo script tái hiện lỗi...', false);
  const response = await api.reproductionScript({
    query: 'Tạo script tái hiện lỗi trong lab bench cho lỗi đã chọn. Trả lời bằng tiếng Việt.',
    messages: context,
    fromMs: range.fromMs,
    toMs: range.toMs
  });
  if (!response.ok) {
    setAiStatus(response.error || 'Tạo script tái hiện lỗi thất bại.', true);
    return;
  }
  applyAiHighlights(response.result.suspicious_message_ids || []);
  renderAiObject('Reproduction Script', response.result);
  setAiStatus('Đã tạo script tái hiện lỗi.', false);
}

function applyAiResult(result) {
  applyAiHighlights(result.suspicious_message_ids || []);
  renderAiReport(result);
}

function applyAiHighlights(ids) {
  for (const id of ids.map(Number).filter(Number.isFinite)) {
    state.aiHighlights.add(id);
    state.bookmarks.add(id);
  }
  renderAll();
}

function renderAiReport(result) {
  el.aiReport.innerHTML = `
    <div class="report-card"><h4>1. Xác thực có phải lỗi không</h4><p>${escapeHtml(result.error_verification || result.summary || '-')}</p></div>
    <div class="report-card"><h4>2. Nguyên nhân vì sao lỗi</h4><p>${escapeHtml(result.root_cause || '-')}</p></div>
    <div class="report-card"><h4>3. Hậu quả lỗi</h4><p>${escapeHtml(result.impact || '-')}</p></div>
    <div class="report-card"><h4>4. Cách tái hiện lỗi</h4><pre>${escapeHtml(JSON.stringify(result.reproduction_steps || [], null, 2))}</pre></div>
    <div class="report-card"><h4>Hành động khuyến nghị</h4><p>${escapeHtml(result.recommended_action || '-')}</p></div>
    <div class="report-card"><h4>Message nghi ngờ</h4><p>${escapeHtml((result.suspicious_message_ids || []).join(', ') || '-')}</p></div>
    <div class="report-card"><h4>Bằng chứng</h4><pre>${escapeHtml(JSON.stringify(result.evidence || [], null, 2))}</pre></div>
    <div class="report-card"><h4>DTC / Bước tiếp theo</h4><pre>${escapeHtml(JSON.stringify({ dtc_codes: result.dtc_codes || [], next_steps: result.next_steps || [] }, null, 2))}</pre></div>
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

function resolveRange() {
  const a = resolveTimeInput(el.rangeA.value, true);
  const b = resolveTimeInput(el.rangeB.value, true);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { fromMs: Math.min(a, b), toMs: Math.max(a, b) };
}

function selectedRange() {
  const message = getSelectedMessage();
  if (!message) return null;
  return { fromMs: message.timeMs, toMs: message.timeMs };
}

function resolveTimeInput(value, allowId) {
  const raw = String(value || '').trim();
  if (!raw) return NaN;

  const idMatch = raw.match(/^#?(\d+)$/);
  if (allowId && idMatch) {
    const byId = state.messages.find((message) => message.id === Number(idMatch[1]));
    if (byId) return byId.timeMs;
  }

  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    if (state.firstTimeMs !== null && numeric >= 0 && numeric < 24 * 60 * 60 * 1000) {
      return state.firstTimeMs + numeric;
    }
    return numeric;
  }

  const parsed = Date.parse(raw.replace(/\//g, '-'));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function copySelectedPayload() {
  const message = getSelectedMessage();
  if (message) api.writeClipboard(message.payload || '');
}

function copySelectedDetail() {
  const message = getSelectedMessage();
  if (message) api.writeClipboard(JSON.stringify(message, null, 2));
}

function copyRange() {
  const range = resolveRange();
  if (!range) {
    setAiStatus('Range A/B is invalid.', true);
    return;
  }
  const messages = state.messages.filter((message) => message.timeMs >= range.fromMs && message.timeMs <= range.toMs);
  api.writeClipboard(JSON.stringify(messages, null, 2));
  setAiStatus(`Copied ${formatNumber(messages.length)} messages from range A-B.`, false);
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

function toggleBookmark(id) {
  if (!Number.isFinite(Number(id))) return;
  const numericId = Number(id);
  if (state.bookmarks.has(numericId)) state.bookmarks.delete(numericId);
  else state.bookmarks.add(numericId);
  renderAll();
}

function plotSelectedSignal() {
  const selected = getSelectedMessage();
  if (!selected) return;
  const key = `${selected.ecu}|${selected.apid}|${selected.ctid}`;
  const points = [];
  for (const message of state.messages) {
    if (`${message.ecu}|${message.apid}|${message.ctid}` !== key) continue;
    const numbers = String(message.payload || '').match(/[-+]?\d+(?:\.\d+)?/g);
    if (numbers?.length) {
      points.push({ x: message.timeMs, y: Number(numbers[0]), id: message.id });
    }
  }
  drawSignal(points);
}

function drawSignal(points) {
  const canvas = el.signalChart;
  const ctx = setupCanvas(canvas);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  ctx.fillRect(0, 0, width, height);
  if (points.length < 2) {
    ctx.fillStyle = '#95aa9f';
    ctx.fillText('No numeric signal found in selected APID/CTID.', 10, 24);
    return;
  }

  const minX = Math.min(...points.map((point) => point.x));
  const maxX = Math.max(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxY = Math.max(...points.map((point) => point.y));
  const sx = (value) => 10 + ((value - minX) / Math.max(1, maxX - minX)) * (width - 20);
  const sy = (value) => height - 10 - ((value - minY) / Math.max(1, maxY - minY)) * (height - 24);

  ctx.strokeStyle = '#39d98a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(sx(point.x), sy(point.y));
    else ctx.lineTo(sx(point.x), sy(point.y));
  });
  ctx.stroke();
  ctx.fillStyle = '#95aa9f';
  ctx.font = '11px Cascadia Code, Consolas, monospace';
  ctx.fillText(`points=${points.length} min=${minY} max=${maxY}`, 10, 14);
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
  } else if (event.key.toLowerCase() === 'b') {
    event.preventDefault();
    toggleBookmark(state.selectedId);
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
    ecuCount: new Set(state.messages.map((message) => message.ecu).filter(Boolean)).size,
    bookmarks: Array.from(state.bookmarks)
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
      from: formatTimeLabel(range.fromMs),
      to: formatTimeLabel(range.toMs)
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
    setAiStatus('Chưa có phân tích AI.', false);
}

function clearData() {
  state.messages = [];
  state.filtered = [];
  state.files = [];
  state.bookmarks = new Set();
  state.aiHighlights = new Set();
  state.selectedId = null;
  state.firstTimeMs = null;
  state.lastTimeMs = null;
  state.currentPage = 1;
  state.parseDone = false;
  state.aiChatMode = 'selection';
  state.aiRange = {
    min: null,
    max: null,
    from: null,
    to: null,
    dirty: false
  };
  el.fileList.innerHTML = '';
  el.virtualScroll.scrollTop = 0;
  renderAll();
}

function toggleTheme() {
  const light = el.app.classList.toggle('theme-light');
  el.btnTheme.textContent = light ? 'Dark' : 'Light';
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
  const text = String(value || '');
  const query = el.searchInput.value.trim();
  if (!query || el.regexSearch.checked) return escapeHtml(text);
  const flags = el.caseSensitive.checked ? 'g' : 'gi';
  const safe = escapeRegExp(query);
  return escapeHtml(text).replace(new RegExp(safe, flags), (match) => `<mark>${match}</mark>`);
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
  return `${ms.toFixed(3)} ms`;
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

function formatHourMinuteSecond(ms) {
  if (!Number.isFinite(ms)) return '-';
  return new Date(ms).toISOString().slice(11, 19);
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function shortPath(filePath) {
  return String(filePath || '').split(/[\\/]/).slice(-2).join('\\');
}

function normalizePayload(payload) {
  return String(payload || '').replace(/\d+/g, '#').replace(/\s+/g, ' ').slice(0, 160);
}

function normalizeLevelName(level) {
  const text = String(level || '').toLowerCase();
  return LEVELS.find((item) => item.toLowerCase() === text) || level;
}
