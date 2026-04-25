const http = require('node:http');
const https = require('node:https');

const DIAGNOSTIC_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary',
    'error_verification',
    'root_cause',
    'impact',
    'reproduction_steps',
    'suspicious_message_ids',
    'recommended_action',
    'severity',
    'confidence',
    'evidence',
    'dtc_codes',
    'timeline_marks',
    'next_steps'
  ],
  properties: {
    summary: { type: 'string' },
    error_verification: { type: 'string' },
    root_cause: { type: 'string' },
    impact: { type: 'string' },
    reproduction_steps: {
      type: 'array',
      items: { type: 'string' }
    },
    suspicious_message_ids: {
      type: 'array',
      items: { type: 'integer' }
    },
    recommended_action: { type: 'string' },
    severity: { type: 'string', enum: ['fatal', 'error', 'warning', 'info', 'unknown'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['message_id', 'reason'],
        properties: {
          message_id: { type: 'integer' },
          reason: { type: 'string' }
        }
      }
    },
    dtc_codes: {
      type: 'array',
      items: { type: 'string' }
    },
    timeline_marks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['message_id', 'label'],
        properties: {
          message_id: { type: 'integer' },
          label: { type: 'string' }
        }
      }
    },
    next_steps: {
      type: 'array',
      items: { type: 'string' }
    }
  }
};

const NATURAL_SEARCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'explanation',
    'search_text',
    'regex',
    'case_sensitive',
    'levels',
    'ecu',
    'apid',
    'ctid',
    'from_time',
    'to_time',
    'keywords'
  ],
  properties: {
    explanation: { type: 'string' },
    search_text: { type: 'string' },
    regex: { type: 'boolean' },
    case_sensitive: { type: 'boolean' },
    levels: { type: 'array', items: { type: 'string' } },
    ecu: { type: 'string' },
    apid: { type: 'string' },
    ctid: { type: 'string' },
    from_time: { type: 'string' },
    to_time: { type: 'string' },
    keywords: { type: 'array', items: { type: 'string' } }
  }
};

const SEQUENCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'mermaid', 'participants', 'suspicious_message_ids'],
  properties: {
    summary: { type: 'string' },
    mermaid: { type: 'string' },
    participants: { type: 'array', items: { type: 'string' } },
    suspicious_message_ids: { type: 'array', items: { type: 'integer' } }
  }
};

const SCRIPT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['language', 'script', 'notes', 'suspicious_message_ids'],
  properties: {
    language: { type: 'string' },
    script: { type: 'string' },
    notes: { type: 'string' },
    suspicious_message_ids: { type: 'array', items: { type: 'integer' } }
  }
};

class AiClient {
  constructor(config) {
    this.config = config;
  }

  async diagnose(payload) {
    const result = await this.completeStructured(payload, DIAGNOSTIC_SCHEMA, 'dlt_diagnostic_report');
    const normalized = normalizeDiagnosticResult(result);
    if (!isSparseDiagnosticResult(normalized)) {
      return normalized;
    }

    try {
      const retry = await this.sendChatCompletion({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: [
              payload.systemPrompt,
              '',
              'IMPORTANT: The previous response did not contain enough data. Now return a NON-EMPTY JSON object.',
              'Use the same language as the user question for every text string.',
              'Required keys: summary, error_verification, root_cause, impact, reproduction_steps, suspicious_message_ids, recommended_action, severity, confidence, evidence, dtc_codes, timeline_marks, next_steps.',
              'If uncertain, provide the best technical hypothesis based on the log; do not return generic filler.'
            ].join('\n')
          },
          { role: 'user', content: payload.userPrompt }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });
      return normalizeDiagnosticResult(retry);
    } catch (_error) {
      return normalized;
    }
  }

  async naturalSearch(payload) {
    const result = await this.completeStructured(payload, NATURAL_SEARCH_SCHEMA, 'dlt_natural_search_filter');
    return normalizeNaturalSearchResult(result);
  }

  async sequenceDiagram(payload) {
    const result = await this.completeStructured(payload, SEQUENCE_SCHEMA, 'dlt_sequence_diagram');
    return normalizeSequenceResult(result);
  }

  async reproductionScript(payload) {
    const result = await this.completeStructured(payload, SCRIPT_SCHEMA, 'dlt_reproduction_script');
    return normalizeScriptResult(result);
  }

  async chat(payload) {
    return this.sendChatCompletion({
      model: this.config.model,
      messages: [
        { role: 'system', content: payload.systemPrompt },
        { role: 'user', content: payload.userPrompt }
      ],
      temperature: 0.2
    }, { parseJson: false });
  }

  async completeStructured(payload, schema, schemaName) {
    const messages = [
      { role: 'system', content: payload.systemPrompt },
      { role: 'user', content: payload.userPrompt }
    ];

    const body = {
      model: this.config.model,
      messages,
      temperature: 0.1,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: schemaName,
          strict: true,
          schema
        }
      }
    };

    try {
      return await this.sendChatCompletion(body);
    } catch (error) {
      if (!isStructuredOutputCompatibilityError(error)) {
        throw error;
      }

      const fallbackBody = {
        model: this.config.model,
        messages: [
          ...messages,
          {
            role: 'system',
            content: `Return valid JSON only. JSON schema name: ${schemaName}. Required keys: ${Object.keys(schema.properties || {}).join(', ')}.`
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      };
      return this.sendChatCompletion(fallbackBody);
    }
  }

  async sendChatCompletion(body, options = {}) {
    const url = joinUrl(this.config.baseUrl, '/chat/completions');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
      ...(this.config.headers || {})
    };
    const response = await postJson(url, body, headers);
    const content = extractContent(response);
    if (options.parseJson === false) {
      if (!String(content || '').trim()) {
        throw new Error('AI response was empty.');
      }
      return content;
    }
    const parsed = parseJsonContent(content);
    return parsed;
  }
}

function hasUsableAiConfig(config) {
  return Boolean(config && config.baseUrl && config.model && config.apiKey);
}

function joinUrl(baseUrl, suffix) {
  return `${String(baseUrl || '').replace(/\/+$/g, '')}${suffix}`;
}

function postJson(urlString, payload, headers) {
  const url = new URL(urlString);
  const transport = url.protocol === 'http:' ? http : https;
  const body = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(body)
        },
        timeout: 120000
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : {};
          } catch (_error) {
            json = { raw: text };
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            const error = new Error(json.error?.message || json.message || text || `HTTP ${response.statusCode}`);
            error.statusCode = response.statusCode;
            error.body = json;
            reject(error);
            return;
          }
          resolve(json);
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error('AI request timed out after 120 seconds.'));
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function extractContent(response) {
  const message = response?.choices?.[0]?.message;
  if (message?.refusal) {
    throw new Error(`AI refused: ${message.refusal}`);
  }
  const content = message?.content ?? response?.output_text ?? response?.content;
  if (Array.isArray(content)) {
    return content.map((item) => item.text || item.content || '').join('\n');
  }
  if (typeof content === 'string') {
    return content;
  }
  if (content && typeof content === 'object') {
    return JSON.stringify(content);
  }
  throw new Error('AI response did not contain message content.');
}

function parseJsonContent(content) {
  const text = String(content || '').trim();
  try {
    return JSON.parse(text);
  } catch (_error) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      return JSON.parse(fenced[1]);
    }
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) {
      return JSON.parse(text.slice(first, last + 1));
    }
    throw new Error('AI response was not valid JSON.');
  }
}

function isStructuredOutputCompatibilityError(error) {
  const text = `${error.message || ''} ${JSON.stringify(error.body || {})}`.toLowerCase();
  return text.includes('response_format') || text.includes('json_schema') || text.includes('schema') || error.statusCode === 400;
}

function normalizeDiagnosticResult(result) {
  const diagnosis = result?.diagnosis && typeof result.diagnosis === 'object' ? result.diagnosis : {};
  const recommended = Array.isArray(result?.recommended_actions)
    ? result.recommended_actions
    : Array.isArray(result?.next_steps)
      ? result.next_steps
      : [];
  const evidence = normalizeEvidence(result?.evidence, result?.log_analysis, result?.timeline_marks);
  const suspiciousIds = normalizeIntegerArray(
    result?.suspicious_message_ids ||
    result?.suspicious_ids ||
    evidence.map((item) => item.message_id)
  );

  return {
    summary: stringOrFallback(result?.summary, result?.error_verification || diagnosis.primary_issue || result?.primary_issue || 'AI did not provide a clear enough summary.'),
    error_verification: stringOrFallback(
      result?.error_verification || result?.verification || result?.is_error,
      result?.summary || diagnosis.primary_issue || 'There is not enough evidence for firm verification; inspect the timeline and payload around the suspicious window.'
    ),
    root_cause: stringOrFallback(
      result?.root_cause,
      [
        diagnosis.primary_issue,
        Array.isArray(diagnosis.probable_causes) ? diagnosis.probable_causes.join('; ') : '',
        result?.rootCause
      ].filter(Boolean).join(' - ') || 'AI did not state a clear root cause; inspect messages around the issue time.'
    ),
    impact: stringOrFallback(
      result?.impact || result?.consequence || result?.effect,
      'There is not enough data to quantify impact; evaluate risk from symptoms after the suspicious message.'
    ),
    reproduction_steps: normalizeStringArrayOrFallback(
      result?.reproduction_steps ||
      result?.steps_to_reproduce ||
      result?.reproduce_steps ||
      result?.reproduction,
      ['There are not enough concrete reproduction conditions; replay or collect more logs around suspicious messages and compare trigger conditions in ECU documentation.']
    ),
    suspicious_message_ids: suspiciousIds,
    recommended_action: stringOrFallback(
      result?.recommended_action,
      recommended.join('\n') || result?.action || 'Inspect highlighted messages and collect more context around the issue window.'
    ),
    severity: normalizeSeverity(result?.severity || result?.overall_severity),
    confidence: normalizeConfidence(result?.confidence),
    evidence,
    dtc_codes: normalizeStringArray(result?.dtc_codes || result?.dtcs),
    timeline_marks: normalizeTimelineMarks(result?.timeline_marks, suspiciousIds),
    next_steps: normalizeStringArray(result?.next_steps || recommended)
  };
}

function normalizeNaturalSearchResult(result) {
  return {
    explanation: stringOrFallback(result?.explanation, result?.summary || ''),
    search_text: String(result?.search_text || result?.query || ''),
    regex: Boolean(result?.regex),
    case_sensitive: Boolean(result?.case_sensitive),
    levels: normalizeStringArray(result?.levels),
    ecu: String(result?.ecu || ''),
    apid: String(result?.apid || ''),
    ctid: String(result?.ctid || ''),
    from_time: String(result?.from_time || ''),
    to_time: String(result?.to_time || ''),
    keywords: normalizeStringArray(result?.keywords)
  };
}

function normalizeSequenceResult(result) {
  return {
    summary: stringOrFallback(result?.summary, ''),
    mermaid: String(result?.mermaid || result?.diagram || ''),
    participants: normalizeStringArray(result?.participants),
    suspicious_message_ids: normalizeIntegerArray(result?.suspicious_message_ids || result?.suspicious_ids)
  };
}

function normalizeScriptResult(result) {
  return {
    language: String(result?.language || 'python'),
    script: String(result?.script || result?.code || ''),
    notes: String(result?.notes || result?.summary || ''),
    suspicious_message_ids: normalizeIntegerArray(result?.suspicious_message_ids || result?.suspicious_ids)
  };
}

function normalizeEvidence(evidence, logAnalysis, timelineMarks) {
  const source = Array.isArray(evidence) && evidence.length
    ? evidence
    : Array.isArray(logAnalysis) && logAnalysis.length
      ? logAnalysis
      : Array.isArray(timelineMarks)
        ? timelineMarks
        : [];
  return source.map((item) => ({
    message_id: Number(item.message_id ?? item.id ?? item.line ?? 0),
    reason: String(item.reason || item.message || item.classification || item.impact || item.label || 'AI marked this message as suspicious.')
  })).filter((item) => Number.isFinite(item.message_id) && item.reason);
}

function normalizeTimelineMarks(marks, suspiciousIds) {
  if (Array.isArray(marks)) {
    return marks.map((item) => ({
      message_id: Number(item.message_id ?? item.id ?? 0),
      label: String(item.label || item.reason || 'AI suspicious')
    })).filter((item) => Number.isFinite(item.message_id));
  }
  return suspiciousIds.map((id) => ({ message_id: id, label: 'AI suspicious' }));
}

function normalizeIntegerArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map(Number).filter(Number.isFinite)));
}

function normalizeStringArray(value) {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function normalizeStringArrayOrFallback(value, fallback) {
  const normalized = normalizeStringArray(value);
  return normalized.length ? normalized : fallback;
}

function stringOrFallback(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : String(fallback || '');
}

function normalizeSeverity(value) {
  const severity = String(value || '').toLowerCase();
  if (['fatal', 'error', 'warning', 'info', 'unknown'].includes(severity)) return severity;
  if (severity === 'high' || severity === 'critical') return 'error';
  if (severity === 'medium') return 'warning';
  if (severity === 'low') return 'info';
  return 'unknown';
}

function normalizeConfidence(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }
  const text = String(value || '').toLowerCase();
  if (text.includes('high')) return 0.8;
  if (text.includes('medium')) return 0.55;
  if (text.includes('low')) return 0.3;
  return 0.5;
}

function isSparseDiagnosticResult(result) {
  const summary = String(result?.summary || '').toLowerCase();
  const rootCause = String(result?.root_cause || '').toLowerCase();
  const action = String(result?.recommended_action || '').toLowerCase();
  return (
    summary.includes('ai did not provide') ||
    rootCause.includes('ai did not state') ||
    action.includes('collect more context') ||
    (!result?.evidence?.length && !result?.suspicious_message_ids?.length && !result?.next_steps?.length)
  );
}

module.exports = {
  AiClient,
  hasUsableAiConfig,
  DIAGNOSTIC_SCHEMA,
  NATURAL_SEARCH_SCHEMA,
  SEQUENCE_SCHEMA,
  SCRIPT_SCHEMA
};
