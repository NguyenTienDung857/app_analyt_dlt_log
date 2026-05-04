const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = [
  'electron-main.js',
  'preload.js',
  'renderer.js',
  'src/parser/dltParser.js',
  'src/workers/parseWorker.js',
  'src/services/aiClient.js',
  'src/services/contextBuilder.js',
  'src/services/docReader.js',
  'src/services/ragStore.js',
  'src/services/exporter.js'
];

for (const file of files) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${file}`);
  }
  new Function(fs.readFileSync(filePath, 'utf8'));
}

const { RagStore } = require('../src/services/ragStore');
const { parseLogBuffer, parseTextBuffer } = require('../src/parser/dltParser');
const { readDocumentText } = require('../src/services/docReader');
const { buildChatPayload } = require('../src/services/contextBuilder');

const messages = [];
const result = parseTextBuffer(Buffer.from('2026-04-24 10:00:00 ERROR ECU APP CTX Camera timeout\nINFO ECU APP CTX recovered'), {
  fileName: 'sample.log',
  startIndex: 0,
  onChunk: (chunk) => messages.push(...chunk)
});

if (result.count !== 2 || messages[0].level !== 'Error') {
  throw new Error('Text parser smoke check failed.');
}

const storageDltMessages = [];
const storageDlt = Buffer.concat([
  buildStorageDltMessage('storage hello', 1),
  buildStorageDltMessage('storage recovered', 2)
]);
const storageDltResult = parseLogBuffer(storageDlt, {
  fileName: 'sample.dlt',
  onChunk: (chunk) => storageDltMessages.push(...chunk)
});
if (storageDltResult.count !== 2 || storageDltMessages[0].payload !== 'storage hello') {
  throw new Error('Storage DLT parser smoke check failed.');
}

const rawDltMessages = [];
const rawDlt = Buffer.concat([
  buildStandardDltMessage('raw hello', 1),
  buildStandardDltMessage('raw recovered', 2)
]);
const rawDltResult = parseLogBuffer(rawDlt, {
  fileName: 'sample.dlt',
  onChunk: (chunk) => rawDltMessages.push(...chunk)
});
if (rawDltResult.count !== 2 || rawDltMessages[1].payload !== 'raw recovered') {
  throw new Error('Raw DLT parser smoke check failed.');
}

const serialDltMessages = [];
const serialDlt = Buffer.concat([
  buildSerialDltMessage('serial hello', 1),
  buildSerialDltMessage('serial recovered', 2)
]);
const serialDltResult = parseLogBuffer(serialDlt, {
  fileName: 'sample.bin',
  onChunk: (chunk) => serialDltMessages.push(...chunk)
});
if (serialDltResult.count !== 2 || serialDltMessages[0].payload !== 'serial hello') {
  throw new Error('Serial DLT parser smoke check failed.');
}

const rag = new RagStore();
rag.addDocument('system_space', 'Camera timeout has higher priority than SD warning. UDS DTC should be checked.');
rag.rebuildDocumentFrequency();
if (!rag.search('camera timeout DTC', 1).length) {
  throw new Error('RAG smoke check failed.');
}

const chatPayload = buildChatPayload({
  question: 'Continue the diagnosis.',
  messages: [{ id: 1, payload: 'Camera timeout detected' }],
  conversationHistory: [{
    user: 'What is the first issue?',
    assistant: 'The first issue is a camera timeout around message #1.'
  }],
  maxLogLines: 10
}, [{ source: 'system_space', sourcePath: 'system_space.txt', score: 1, text: 'Camera timeout diagnostic guidance.' }], { maxLogLines: 10 });
if (!chatPayload.userPrompt.includes('Previous conversation in this chat')
  || !chatPayload.userPrompt.includes('camera timeout around message #1')
  || chatPayload.promptStats.conversationTurns !== 1) {
  throw new Error('AI conversation history smoke check failed.');
}

const systemSpaceDocx = path.join(root, 'system_space.docx');
if (fs.existsSync(systemSpaceDocx) && !readDocumentText(systemSpaceDocx).includes('BLTN_CAM')) {
  throw new Error('system_space.docx reader smoke check failed.');
}

console.log('Smoke check passed.');

function buildStorageDltMessage(text, counter) {
  const storage = Buffer.alloc(16);
  storage.write('DLT\x01', 0, 'binary');
  storage.writeUInt32LE(1713952800 + counter, 4);
  storage.writeUInt32LE(counter * 1000, 8);
  storage.write('ECU1', 12, 'ascii');
  return Buffer.concat([storage, buildStandardDltMessage(text, counter)]);
}

function buildSerialDltMessage(text, counter) {
  return Buffer.concat([Buffer.from([0x44, 0x4c, 0x53, 0x01]), buildStandardDltMessage(text, counter)]);
}

function buildStandardDltMessage(text, counter) {
  const stringPayload = Buffer.from(`${text}\0`, 'ascii');
  const typeInfo = Buffer.alloc(4);
  typeInfo.writeUInt32LE(0x200, 0);
  const stringLength = Buffer.alloc(2);
  stringLength.writeUInt16LE(stringPayload.length, 0);
  const payload = Buffer.concat([typeInfo, stringLength, stringPayload]);

  const header = Buffer.alloc(4);
  const ecu = Buffer.from('ECU1', 'ascii');
  const timestamp = Buffer.alloc(4);
  const extended = Buffer.alloc(10);
  const length = header.length + ecu.length + timestamp.length + extended.length + payload.length;

  header[0] = 0x35;
  header[1] = counter & 0xff;
  header.writeUInt16BE(length, 2);
  timestamp.writeUInt32LE(counter * 10000, 0);
  extended[0] = 0x41;
  extended[1] = 1;
  extended.write('APP ', 2, 'ascii');
  extended.write('CTX ', 6, 'ascii');

  return Buffer.concat([header, ecu, timestamp, extended, payload]);
}
