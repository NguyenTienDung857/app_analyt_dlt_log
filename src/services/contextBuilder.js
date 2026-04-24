const DEFAULT_MAX_LINES = 1400;
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
      windowMs,
      maxLines
    }
  };
}

function buildNaturalSearchPayload(request, ragDocs) {
  return {
    systemPrompt: [
      'Bạn chuyển yêu cầu tìm kiếm log ECU bằng ngôn ngữ tự nhiên thành filter xác định.',
      'Luôn trả JSON hợp lệ. Các chuỗi giải thích phải viết bằng tiếng Việt.',
      'Các field DLT có sẵn: payload, level, type, ecu, apid, ctid, fileName, time, timeMs, messageId.',
      'Không được trả filter rỗng. Nếu không chắc, hãy tạo keywords rộng từ câu hỏi và synonym kỹ thuật.',
      'Ví dụ: "rớt frame" -> keywords gồm frame, fps, drop, dropped, lost, camera. "nhiệt độ > 80" -> temperature, temp, thermal, overheat, 80.',
      'Chỉ set levels nếu người dùng nói rõ Fatal/Error/Warn/Info/Debug; đừng set level chỉ vì người dùng nói "lỗi".'
    ].join('\n'),
    userPrompt: [
      `Yêu cầu tìm kiếm của người dùng: ${request.query || ''}`,
      '',
      'Đoạn tài liệu ECU liên quan:',
      formatDocs(trimDocs(ragDocs, 4000)),
      '',
      'Hãy tạo filter để UI có thể áp dụng local.'
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
      'Bạn là chuyên gia phân tích giao tiếp ECU ô tô.',
      'Sinh mã Mermaid sequenceDiagram từ các DLT message được chọn.',
      'Dùng ECU/APID/CTID hoặc component suy luận được làm participant. Đánh dấu timeout, retry, error và thiếu response nếu thấy trong log.',
      'Mọi phần mô tả phải viết bằng tiếng Việt.'
    ].join('\n'),
    userPrompt: [
      'Đoạn tài liệu ECU:',
      formatDocs(trimDocs(ragDocs, 4000)),
      '',
      'Ngữ cảnh log được chọn:',
      formatMessages(selection.context),
      '',
      'Trả về sequence diagram ngắn gọn và tóm tắt tiếng Việt.'
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
      'Bạn tạo script tái hiện lỗi an toàn cho bàn test/lab bench.',
      'Ưu tiên Python pseudocode nếu không đủ chi tiết CAPL. Không điều khiển xe thật.',
      'Dùng các message nghi ngờ và timing làm chuỗi tái hiện.',
      'Mọi ghi chú, giải thích phải viết bằng tiếng Việt.'
    ].join('\n'),
    userPrompt: [
      'Đoạn tài liệu ECU:',
      formatDocs(trimDocs(ragDocs, 4000)),
      '',
      'Ngữ cảnh lỗi:',
      formatMessages(selection.context),
      '',
      'Trả về script có thể replay hoặc mô phỏng chuỗi message trên bàn test.'
    ].join('\n')
  };
}

function buildChatPayload(request, ragDocs, config) {
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const maxLines = Math.min(Number(request.maxLogLines || config.maxLogLines || DEFAULT_MAX_LINES), 1200);
  const context = reduceContext(messages, maxLines);
  const docs = trimDocs(ragDocs, 9000);

  return {
    systemPrompt: [
      'Bạn là AI phân tích lỗi Built-in Cam ECU, ưu tiên tìm nguyên nhân lỗi từ DLT log.',
      'Luôn trả lời bằng tiếng Việt, rõ ràng, thực dụng, có bằng chứng từ message id nếu có.',
      'Bạn được cung cấp context log đã được ứng dụng chọn/lọc, không phải toàn bộ file.',
      'Nếu thiếu dữ liệu, nói rõ cần thêm khoảng thời gian/message/mapping FIBEX/ARXML nào.',
      'Với DLT non-verbose, không suy diễn raw hex thành text nếu không có mapping.',
      '',
      'Tài liệu ECU liên quan từ RAG:',
      formatDocs(docs)
    ].join('\n'),
    userPrompt: [
      `Câu hỏi của người dùng: ${request.question || ''}`,
      '',
      'Thống kê log/session:',
      JSON.stringify(request.stats || {}, null, 2),
      '',
      'Context log gửi kèm:',
      formatMessages(context),
      '',
      'Hãy trả lời như một kỹ sư chẩn đoán: kết luận, bằng chứng message id, giả thuyết nguyên nhân, bước kiểm tra tiếp theo.'
    ].join('\n'),
    promptStats: {
      contextMessages: context.length,
      docs: docs.length,
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
    'Bạn là kỹ sư chẩn đoán cấp senior cho Built-in Cam ECU.',
    'Bắt buộc trả lời bằng tiếng Việt trong mọi field dạng text.',
    'Mục tiêu: tìm nguyên nhân gốc từ DLT log, không chỉ tóm tắt. Ưu tiên Error/Fatal, khoảng reset/ignition-cycle, bằng chứng DTC/UDS, triệu chứng camera FPS/voltage/temperature/storage/network và thứ tự timing.',
    'Dùng các đoạn tài liệu ECU được cung cấp làm căn cứ. Nếu chưa đủ bằng chứng, nói rõ đang thiếu log/message/mapping nào.',
    'Với DLT non-verbose, không diễn giải raw hex thành text. Chỉ dùng decoded text, message ID, APID/CTID, timing và mapping/tài liệu nếu có.',
    'Trả JSON structured đúng schema. suspicious_message_ids phải là id số của các dòng log được cung cấp.',
    'Không được để summary/root_cause/recommended_action rỗng. Nếu chưa chắc chắn, vẫn phải nêu giả thuyết hợp lý nhất và mức độ tin cậy.',
    '',
    'Đoạn tài liệu ECU:',
    formatDocs(docs)
  ].join('\n');
}

function diagnosticUserPrompt(request, selection, query) {
  return [
    `Chế độ phân tích: ${request.mode || 'manual'}`,
    `Mục tiêu/câu hỏi của người dùng: ${request.query || 'Tìm lỗi ECU có khả năng cao nhất và nguyên nhân gốc.'}`,
    `Từ khóa ngữ cảnh: ${query}`,
    '',
    'Thống kê log:',
    JSON.stringify(request.stats || {}, null, 2),
    '',
    'Các DLT message trong ngữ cảnh:',
    formatMessages(selection.context),
    '',
    'Yêu cầu output:',
    '- summary: tóm tắt tiếng Việt, nói lỗi gì xảy ra và xảy ra khi nào',
    '- root_cause: nguyên nhân gốc có khả năng cao nhất, kèm lập luận dựa trên log',
    '- suspicious_message_ids: id chính xác cần highlight/bookmark',
    '- recommended_action: hành động kỹ thuật tiếp theo, viết tiếng Việt'
  ].join('\n');
}

function buildDiagnosticQuery(request, selection) {
  const parts = [
    request.query || '',
    request.title || '',
    ...selection.context
      .filter((message) => isFaultLevel(message.level) || message.level === 'Warn')
      .slice(0, 80)
      .map((message) => `${message.level} ${message.ecu} ${message.apid} ${message.ctid} ${message.messageId || ''} ${message.payload}`)
  ];
  return parts.join(' ').slice(0, 8000);
}

function formatMessages(messages) {
  if (!messages.length) {
    return '(no messages)';
  }

  return messages.map((message) => {
    const payload = contextSafePayload(message);
    const delta = Number.isFinite(message.deltaMs) ? `${message.deltaMs.toFixed(3)}ms` : '-';
    return [
      `[${message.id}]`,
      `${message.time || message.timeMs}`,
      `dt=${delta}`,
      message.level || 'Unknown',
      `${message.ecu || '-'}/${message.apid || '-'}/${message.ctid || '-'}`,
      message.type || '-',
      message.messageId ? `msg=${message.messageId}` : '',
      payload
    ].filter(Boolean).join(' | ');
  }).join('\n');
}

function contextSafePayload(message) {
  const payload = String(message.payload || '').trim();
  if (message.nonVerbose && message.decodeStatus === 'non-verbose-needs-fibex-arxml') {
    return payload.includes('decoder mapping required')
      ? payload
      : `[non-verbose ${message.messageId || ''}] ${payload.replace(/[0-9A-F]{2}(?:\s+[0-9A-F]{2}){4,}/gi, '[raw hex withheld]')}`;
  }
  return payload.slice(0, 600);
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

module.exports = {
  buildAnalysisPayload,
  buildChatPayload,
  buildNaturalSearchPayload,
  buildSequencePayload,
  buildScriptPayload,
  selectContextMessages,
  formatMessages
};
