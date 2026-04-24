const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mainSource = fs.readFileSync(path.join(root, 'electron-main.js'), 'utf8');
const apiKey = (mainSource.match(/apiKey: '([^']+)'/) || [])[1] || process.env.DLT_AI_API_KEY;
const baseUrl = ((mainSource.match(/baseUrl: '([^']+)'/) || [])[1] || process.env.DLT_AI_BASE_URL || '').replace(/\/+$/, '');

const url = new URL(`${baseUrl}/models`);

const request = https.request({
  method: 'GET',
  hostname: url.hostname,
  port: url.port || undefined,
  path: `${url.pathname}${url.search}`,
  headers: {
    Authorization: `Bearer ${apiKey}`
  },
  timeout: 60000
}, (response) => {
  const chunks = [];
  response.on('data', (chunk) => chunks.push(chunk));
  response.on('end', () => {
    const text = Buffer.concat(chunks).toString('utf8');
    let body = text;
    try {
      body = JSON.parse(text);
    } catch (_error) {
      body = text;
    }
    console.log(JSON.stringify({
      ok: response.statusCode >= 200 && response.statusCode < 300,
      statusCode: response.statusCode,
      body
    }, null, 2));
    process.exit(response.statusCode >= 200 && response.statusCode < 300 ? 0 : 1);
  });
});

request.on('timeout', () => request.destroy(new Error('Request timed out.')));
request.on('error', (error) => {
  console.error(JSON.stringify({ ok: false, message: error.message }, null, 2));
  process.exit(1);
});
request.end();
