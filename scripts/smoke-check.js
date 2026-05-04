const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

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
  'src/services/exporter.js',
  'src/services/encDecryptor.js'
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
const { extractZipArchive } = require('../src/services/encDecryptor');

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

const storageTimeMessages = [];
parseLogBuffer(buildStorageDltMessage('storage shifted time', 1, {
  seconds: Date.UTC(2025, 9, 24, 5, 25, 50) / 1000,
  microseconds: 537081
}), {
  fileName: 'dvrs_8_20251024-142550.dlt',
  onChunk: (chunk) => storageTimeMessages.push(...chunk)
});
if (storageTimeMessages[0]?.time !== '2025-10-24 14:25:50.537081') {
  throw new Error('Storage DLT local timestamp inference smoke check failed.');
}

const resyncDltMessages = [];
const resyncDlt = Buffer.concat([
  buildBrokenStorageDltPrelude(10),
  buildStorageDltMessage('resynced storage payload', 11)
]);
const resyncDltResult = parseLogBuffer(resyncDlt, {
  fileName: 'sample.dlt',
  onChunk: (chunk) => resyncDltMessages.push(...chunk)
});
if (
  resyncDltResult.count !== 1 ||
  resyncDltResult.parser !== 'dlt-storage' ||
  resyncDltMessages[0]?.payload !== 'resynced storage payload'
) {
  throw new Error('Storage DLT resync smoke check failed.');
}

const sampleDvrs8 = path.join(root, '251028_150419', 'dvrs_8_20251024-142550.dlt');
if (fs.existsSync(sampleDvrs8)) {
  const sampleMessages = [];
  const sampleResult = parseLogBuffer(fs.readFileSync(sampleDvrs8), {
    fileName: 'dvrs_8_20251024-142550.dlt',
    filePath: sampleDvrs8,
    onChunk: (chunk) => sampleMessages.push(...chunk)
  });
  if (
    sampleResult.count !== 21203 ||
    sampleMessages[0]?.time !== '2025-10-24 14:25:50.537081' ||
    sampleMessages[730]?.payload !== 'PView:2219] FIRST START, UPTIME[2.670000]'
  ) {
    throw new Error('Sample DVRS storage DLT parser smoke check failed.');
  }
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

const encSmokeDir = path.join(root, '.smoke-enc');
try {
  fs.rmSync(encSmokeDir, { recursive: true, force: true });
  fs.mkdirSync(encSmokeDir, { recursive: true });
  const zipPath = path.join(encSmokeDir, 'sample.zip');
  const extractedDir = path.join(encSmokeDir, 'out');
  fs.writeFileSync(zipPath, buildZipArchive('sample.dlt', Buffer.from('DLT payload', 'utf8')));
  extractZipArchive(zipPath, extractedDir);
  if (fs.readFileSync(path.join(extractedDir, 'sample.dlt'), 'utf8') !== 'DLT payload') {
    throw new Error('ENC ZIP extraction smoke check failed.');
  }
} finally {
  fs.rmSync(encSmokeDir, { recursive: true, force: true });
}

console.log('Smoke check passed.');

function buildStorageDltMessage(text, counter, options = {}) {
  const storage = Buffer.alloc(16);
  storage.write('DLT\x01', 0, 'binary');
  storage.writeUInt32LE(options.seconds ?? (1713952800 + counter), 4);
  storage.writeUInt32LE(options.microseconds ?? (counter * 1000), 8);
  storage.write('ECU1', 12, 'ascii');
  return Buffer.concat([storage, buildStandardDltMessage(text, counter)]);
}

function buildBrokenStorageDltPrelude(counter) {
  const storage = Buffer.alloc(16);
  storage.write('DLT\x01', 0, 'binary');
  storage.writeUInt32LE(1713952800 + counter, 4);
  storage.writeUInt32LE(counter * 1000, 8);
  storage.write('ECU1', 12, 'ascii');

  const header = Buffer.alloc(4);
  const ecu = Buffer.from('ECU1', 'ascii');
  const timestamp = Buffer.alloc(4);
  const extended = Buffer.alloc(10);
  const payloadOverlapLength = 22;
  const length = header.length + ecu.length + timestamp.length + extended.length + payloadOverlapLength;

  header[0] = 0x35;
  header[1] = counter & 0xff;
  header.writeUInt16BE(length, 2);
  timestamp.writeUInt32LE(counter * 10000, 0);
  extended[0] = 0x41;
  extended[1] = 1;
  extended.write('APP ', 2, 'ascii');
  extended.write('CTX ', 6, 'ascii');

  return Buffer.concat([storage, header, ecu, timestamp, extended]);
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

function buildZipArchive(entryName, content) {
  const name = Buffer.from(entryName, 'utf8');
  const compressed = zlib.deflateRawSync(content);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(8, 8);
  localHeader.writeUInt32LE(0, 10);
  localHeader.writeUInt32LE(0, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(content.length, 22);
  localHeader.writeUInt16LE(name.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(8, 10);
  centralHeader.writeUInt32LE(0, 12);
  centralHeader.writeUInt32LE(0, 16);
  centralHeader.writeUInt32LE(compressed.length, 20);
  centralHeader.writeUInt32LE(content.length, 24);
  centralHeader.writeUInt16LE(name.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42);

  const centralDirectory = Buffer.concat([centralHeader, name]);
  const localFile = Buffer.concat([localHeader, name, compressed]);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localFile.length, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localFile, centralDirectory, end]);
}
