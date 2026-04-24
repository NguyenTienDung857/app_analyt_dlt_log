const fs = require('node:fs');
const path = require('node:path');

const { AiClient } = require('../src/services/aiClient');

const root = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'electron-main.js'), 'utf8');
const apiKey = (mainSource.match(/apiKey: '([^']+)'/) || [])[1] || process.env.DLT_AI_API_KEY;
const baseUrl = (mainSource.match(/baseUrl: '([^']+)'/) || [])[1] || process.env.DLT_AI_BASE_URL;
const modelArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const model = modelArg || (mainSource.match(/model: '([^']+)'/) || [])[1] || process.env.DLT_AI_MODEL;

async function main() {
  const client = new AiClient({
    baseUrl,
    model,
    apiKey,
    headers: {}
  });

  if (process.argv.includes('--diagnose')) {
    const result = await client.diagnose({
      systemPrompt: 'Bạn là trợ lý chẩn đoán DLT ECU. Luôn trả JSON theo schema và mọi chuỗi text phải viết bằng tiếng Việt.',
      userPrompt: 'Phân tích log nhỏ này: [1] 2026-04-24 ERROR CAM/APP/CTX camera timeout. [2] 2026-04-24 INFO CAM/APP/CTX recovery attempted.',
      promptStats: {}
    });
    console.log(JSON.stringify({ ok: true, model, result }, null, 2));
    return;
  }

  const result = await client.sendChatCompletion({
    model,
    messages: [
      { role: 'system', content: 'Return valid JSON only.' },
      { role: 'user', content: 'Return {"ok":true,"message":"ai credential test"}.' }
    ],
    temperature: 0,
    response_format: { type: 'json_object' }
  });

  console.log(JSON.stringify({ ok: true, model, result }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    model,
    statusCode: error.statusCode || null,
    message: error.message,
    body: error.body || null
  }, null, 2));
  process.exit(1);
});
