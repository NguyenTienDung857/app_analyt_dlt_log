const fs = require('node:fs');
const path = require('node:path');
const { parentPort } = require('node:worker_threads');

const { parseLogBuffer } = require('../parser/dltParser');

let canceled = false;

parentPort.on('message', (message) => {
  if (message.type === 'cancel') {
    canceled = true;
    return;
  }

  if (message.type === 'start') {
    canceled = false;
    parseFiles(message.files || []).catch((error) => {
      parentPort.postMessage({ type: 'error', error: error.message });
    });
  }
});

async function parseFiles(files) {
  const startedAt = Date.now();
  let nextIndex = 0;
  const fileSummaries = [];

  parentPort.postMessage({ type: 'start', files });

  for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    if (canceled) {
      parentPort.postMessage({ type: 'canceled' });
      return;
    }

    const filePath = files[fileIndex];
    const fileName = path.basename(filePath);
    const stat = fs.statSync(filePath);
    const parseStartedAt = Date.now();
    parentPort.postMessage({
      type: 'file-start',
      fileIndex,
      fileName,
      filePath,
      size: stat.size
    });

    const buffer = fs.readFileSync(filePath);
    const result = parseLogBuffer(buffer, {
      filePath,
      fileName,
      fileIndex,
      startIndex: nextIndex,
      onChunk: (messages) => {
        parentPort.postMessage({ type: 'chunk', fileIndex, messages });
      },
      onProgress: (progress) => {
        parentPort.postMessage({ type: 'progress', ...progress });
      }
    });

    nextIndex = result.nextIndex;
    fileSummaries.push({
      fileIndex,
      fileName,
      filePath,
      size: stat.size,
      parser: result.parser,
      messages: result.count,
      skippedBytes: result.skippedBytes,
      parseMs: Date.now() - parseStartedAt
    });

    parentPort.postMessage({
      type: 'file-done',
      fileIndex,
      fileName,
      summary: fileSummaries[fileSummaries.length - 1]
    });
  }

  parentPort.postMessage({
    type: 'done',
    totalMessages: nextIndex,
    files: fileSummaries,
    parseMs: Date.now() - startedAt
  });
}
