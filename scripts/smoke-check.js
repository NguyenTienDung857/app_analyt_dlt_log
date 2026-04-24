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
const { parseTextBuffer } = require('../src/parser/dltParser');
const { readDocumentText } = require('../src/services/docReader');

const messages = [];
const result = parseTextBuffer(Buffer.from('2026-04-24 10:00:00 ERROR ECU APP CTX Camera timeout\nINFO ECU APP CTX recovered'), {
  fileName: 'sample.log',
  startIndex: 0,
  onChunk: (chunk) => messages.push(...chunk)
});

if (result.count !== 2 || messages[0].level !== 'Error') {
  throw new Error('Text parser smoke check failed.');
}

const rag = new RagStore();
rag.addDocument('system_space', 'Camera timeout has higher priority than SD warning. UDS DTC should be checked.');
rag.rebuildDocumentFrequency();
if (!rag.search('camera timeout DTC', 1).length) {
  throw new Error('RAG smoke check failed.');
}

const systemSpaceDocx = path.join(root, 'system_space.docx');
if (fs.existsSync(systemSpaceDocx) && !readDocumentText(systemSpaceDocx).includes('BLTN_CAM')) {
  throw new Error('system_space.docx reader smoke check failed.');
}

console.log('Smoke check passed.');
