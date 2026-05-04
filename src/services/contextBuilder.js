const DEFAULT_MAX_LINES = 27000;
const DEFAULT_WINDOW_MS = 500;

function buildAnalysisPayload(request, ragDocs, config) {
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const windowMs = Number(request.windowMs || config.contextWindowMs || DEFAULT_WINDOW_MS);
  const maxLines = Number(request.maxLogLines || config.maxLogLines || DEFAULT_MAX_LINES);
  const selection = selectContextMessages(messages, request, windowMs, maxLines);
  const query = buildDiagnosticQuery(request, selection);
  const docs = trimDocs(ragDocs, 9000);

  return {
    title: request.title || 'DLT ECU diagnostic analysis',
    mode: request.mode || 'manual',
    query,
    systemPrompt: diagnosticSystemPrompt(docs),
    userPrompt: diagnosticUserPrompt(request, selection, query),
    promptStats: {
      selectedMessages: selection.selected.length,
      contextMessages: selection.context.length,
      docs: docs.length,
      docSources: countDocSources(docs),
      windowMs,
      maxLines
    }
  };
}

function buildNaturalSearchPayload(request, ragDocs) {
  return {
    systemPrompt: [
      'Convert a natural-language ECU log search request into a deterministic local filter.',
      'Translate any non-English user intent into English technical log keywords before building the filter.',
      'Always return valid JSON. All search_text and keywords must be English because the log payloads are English.',
      'Available DLT fields: payload, level, type, ecu, apid, ctid, fileName, time, timeMs, messageId.',
      'Do not return an empty filter. If uncertain, create broad keywords from the question and technical synonyms.',
      'Example: "dropped frame" -> keywords include frame, fps, drop, dropped, lost, camera. "temperature > 80" -> temperature, temp, thermal, overheat, 80.',
      'Only set levels if the user explicitly says Fatal/Error/Warn/Info/Debug; do not set a level only because the user says "issue" or "bug".'
    ].join('\n'),
    userPrompt: [
      `User search request: ${request.query || ''}`,
      '',
      'Relevant ECU documentation snippets:',
      formatDocs(trimDocs(ragDocs, 4000)),
      '',
      'Create a filter the UI can apply locally.'
    ].join('\n')
  };
}

function buildSequencePayload(request, ragDocs, config) {
  const selection = selectContextMessages(
    Array.isArray(request.messages) ? request.messages : [],
    request,
    Number(config.contextWindowMs || DEFAULT_WINDOW_MS),
    Math.min(Number(config.maxLogLines || DEFAULT_MAX_LINES), 600)
  );

  return {
    systemPrompt: [
      'You are an automotive ECU communication analysis expert.',
      'Generate Mermaid sequenceDiagram code from the selected DLT messages.',
      'Use ECU/APID/CTID or inferred components as participants. Mark timeout, retry, error, and missing response patterns if visible in the log.',
      'Use the same language as the user query for all descriptions.'
    ].join('\n'),
    userPrompt: [
      'ECU documentation snippets:',
      formatDocs(trimDocs(ragDocs, 4000)),
      '',
      'Selected log context:',
      formatMessages(selection.context),
      '',
      'Return a concise sequence diagram and summary.'
    ].join('\n')
  };
}

function buildScriptPayload(request, ragDocs, config) {
  const selection = selectContextMessages(
    Array.isArray(request.messages) ? request.messages : [],
    request,
    Number(config.contextWindowMs || DEFAULT_WINDOW_MS),
    Math.min(Number(config.maxLogLines || DEFAULT_MAX_LINES), 800)
  );

  return {
    systemPrompt: [
      'Create a safe reproduction script for a test bench or lab bench.',
      'Prefer Python pseudocode if there is not enough detail for CAPL. Do not control a real vehicle.',
      'Use suspicious messages and timing as the reproduction sequence.',
      'Use the same language as the user query for notes and explanations.'
    ].join('\n'),
    userPrompt: [
      'ECU documentation snippets:',
      formatDocs(trimDocs(ragDocs, 4000)),
      '',
      'Issue context:',
      formatMessages(selection.context),
      '',
      'Return a script that can replay or simulate the message sequence on a test bench.'
    ].join('\n')
  };
}

function buildChatPayload(request, ragDocs, config) {
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const maxLines = Math.max(1, Number(request.maxLogLines || config.maxLogLines || DEFAULT_MAX_LINES));
  const context = reduceContext(messages, maxLines);
  const docs = trimDocs(ragDocs, 9000);
  const selectedIds = normalizeIds(request.selectedIds);
  const conversationHistory = normalizeConversationHistory(request.conversationHistory);

  return {
    systemPrompt: '',
    userPrompt: [
      'Previous conversation in this chat:',
      formatConversationHistory(conversationHistory),
      '',
      `Current user question: ${request.question || ''}`,
      `Selected/current message IDs: ${selectedIds.length ? selectedIds.map((id) => `#${id}`).join(', ') : '(none)'}`,
      '',
      'Relevant ECU documentation from system_space:',
      formatDocs(docs),
      '',
      'Attached log context (message id and payload only):',
      formatMessages(context)
    ].join('\n'),
    promptStats: {
      contextMessages: context.length,
      docs: docs.length,
      docSources: countDocSources(docs),
      conversationTurns: conversationHistory.length,
      maxLines
    }
  };
}

function selectContextMessages(messages, request, windowMs, maxLines) {
  if (!messages.length) {
    return { selected: [], context: [] };
  }

  const selectedIds = new Set((request.selectedIds || []).map(Number));
  const suspiciousIds = new Set((request.suspiciousIds || []).map(Number));
  const selected = messages.filter((message) => selectedIds.has(message.id) || suspiciousIds.has(message.id));

  let fromMs = parseOptionalNumber(request.fromMs);
  let toMs = parseOptionalNumber(request.toMs);

  if (!Number.isFinite(fromMs) && selected.length) {
    fromMs = Math.min(...selected.map((message) => message.timeMs));
  }
  if (!Number.isFinite(toMs) && selected.length) {
    toMs = Math.max(...selected.map((message) => message.timeMs));
  }

  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    const firstFault = messages.find((message) => isFaultLevel(message.level));
    if (firstFault) {
      fromMs = firstFault.timeMs;
      toMs = firstFault.timeMs;
    }
  }

  let context;
  if (Number.isFinite(fromMs) && Number.isFinite(toMs)) {
    const start = Math.min(fromMs, toMs) - windowMs;
    const end = Math.max(fromMs, toMs) + windowMs;
    context = messages.filter((message) => message.timeMs >= start && message.timeMs <= end);
  } else {
    context = messages.slice(0, maxLines);
  }

  context = reduceContext(context, maxLines);
  return {
    selected,
    context
  };
}

function reduceContext(messages, maxLines) {
  if (messages.length <= maxLines) {
    return messages;
  }

  const important = messages.filter((message) => isFaultLevel(message.level) || message.level === 'Warn');
  const selected = new Map();
  for (const message of important) {
    selected.set(message.id, message);
  }

  const remainingSlots = Math.max(0, maxLines - selected.size);
  if (remainingSlots > 0) {
    const step = Math.max(1, Math.floor(messages.length / remainingSlots));
    for (let index = 0; index < messages.length && selected.size < maxLines; index += step) {
      selected.set(messages[index].id, messages[index]);
    }
  }

  return Array.from(selected.values()).sort((a, b) => a.id - b.id).slice(0, maxLines);
}

function diagnosticSystemPrompt(docs) {
  return [
    'You are a senior diagnostic engineer for Built-in Cam ECU.',
    'Use the same language as the user question for all text fields.',
    'Goal: find root cause from DLT logs, not just summarize. Prioritize Error/Fatal, reset/ignition-cycle windows, DTC/UDS evidence, camera FPS/voltage/temperature/storage/network symptoms, and timing order.',
    'Use the provided ECU documentation snippets as evidence. If evidence is insufficient, state which log/message/mapping is missing.',
    'For non-verbose DLT, do not interpret raw hex as text. Use only message id, decoded payload, and mapping/documentation if available.',
    'Return structured JSON matching the schema. suspicious_message_ids must be numeric ids from the provided log rows.',
    'Do not leave issue verification, root cause, impact, or reproduction empty. If uncertain, provide the best technical hypothesis and confidence level.',
    '',
    'ECU documentation snippets from system_space:',
    formatDocs(docs)
  ].join('\n');
}

function diagnosticUserPrompt(request, selection, query) {
  return [
    `Analysis mode: ${request.mode || 'manual'}`,
    `User goal/question: ${request.query || 'Find the most likely ECU issue and root cause.'}`,
    `Context keywords: ${query}`,
    '',
    'DLT messages in context (message id and payload only):',
    formatMessages(selection.context),
    '',
    'Output requirements:',
    '- error_verification: verify whether this is an issue, certainty level, evidence by message id/payload',
    '- root_cause: root cause and reasoning based on log and documentation',
    '- impact: issue consequence or impact',
    '- reproduction_steps: reproduction steps or required reproduction conditions',
    '- suspicious_message_ids: return an empty array if the context has no message ids',
    '- recommended_action: next technical action'
  ].join('\n');
}

function buildDiagnosticQuery(request, selection) {
  const parts = [
    request.query || '',
    request.title || '',
    ...selection.context
      .filter((message) => isFaultLevel(message.level) || message.level === 'Warn')
      .slice(0, 80)
      .map((message) => `${formatMessageId(message)} ${message.payload}`)
  ];
  return parts.join(' ').slice(0, 8000);
}

function formatMessages(messages) {
  if (!messages.length) {
    return '(no messages)';
  }

  return messages.map((message) => {
    const payload = contextSafePayload(message);
    return `id=${formatMessageId(message)} | payload=${payload}`;
  }).join('\n');
}

function normalizeConversationHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-20)
    .map((turn) => ({
      user: safeConversationText(turn?.user, 4000),
      assistant: safeConversationText(turn?.assistant, 12000)
    }))
    .filter((turn) => turn.assistant);
}

function formatConversationHistory(history) {
  if (!history.length) {
    return '(no previous conversation in this chat)';
  }

  return history.map((turn, index) => {
    const user = turn.user || '(user question was not captured)';
    return [
      `Turn ${index + 1} user question: ${user}`,
      `Turn ${index + 1} AI answer: ${turn.assistant}`
    ].join('\n');
  }).join('\n\n');
}

function safeConversationText(value, maxChars) {
  const text = String(value || '').trim();
  if (!text || text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 14)).trimEnd()}\n[truncated]`;
}

function formatMessageId(message) {
  const id = Number(message?.id ?? message?.messageId);
  return Number.isFinite(id) ? `#${Math.round(id)}` : '-';
}

function contextSafePayload(message) {
  const payload = String(message.payload || '').trim();
  if (message.nonVerbose && message.decodeStatus === 'non-verbose-needs-fibex-arxml') {
    return payload.includes('decoder mapping required')
      ? payload
      : `[non-verbose] ${payload.replace(/[0-9A-F]{2}(?:\s+[0-9A-F]{2}){4,}/gi, '[raw hex withheld]')}`;
  }
  return payload;
}

function formatAiClockTime(message) {
  const raw = String(message?.time || '');
  const match = raw.match(/\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/);
  if (match) return match[0].split('.')[0];
  const timeMs = Number(message?.timeMs);
  if (Number.isFinite(timeMs)) return new Date(timeMs).toISOString().slice(11, 19);
  return raw || '-';
}

function formatDocs(docs) {
  if (!docs || !docs.length) {
    return '(no matching ECU documentation snippets indexed)';
  }
  return docs.map((doc, index) => {
    return `#${index + 1} ${doc.source} score=${doc.score}\n${doc.text}`;
  }).join('\n\n');
}

function trimDocs(docs, maxChars) {
  const result = [];
  let used = 0;
  for (const doc of docs || []) {
    const text = String(doc.text || '');
    if (used + text.length > maxChars) {
      const remaining = maxChars - used;
      if (remaining > 300) {
        result.push({ ...doc, text: text.slice(0, remaining) });
      }
      break;
    }
    result.push(doc);
    used += text.length;
  }
  return result;
}

function countDocSources(docs) {
  return new Set((docs || [])
    .map((doc) => doc.sourcePath || doc.source || '')
    .filter(Boolean)).size;
}

function isFaultLevel(level) {
  return level === 'Error' || level === 'Fatal';
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === '') {
    return NaN;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function normalizeIds(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map(Number)
    .filter(Number.isFinite)));
}

module.exports = {
  buildAnalysisPayload,
  buildChatPayload,
  buildNaturalSearchPayload,
  buildSequencePayload,
  buildScriptPayload,
  selectContextMessages,
  formatMessages
};
