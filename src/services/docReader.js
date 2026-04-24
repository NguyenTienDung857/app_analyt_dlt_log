const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function readDocumentText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.docx' && isZip(buffer)) {
    return readDocxText(buffer);
  }
  if (extension === '.docx') {
    return normalizeText(buffer.toString('utf8'));
  }
  if (isZip(buffer)) {
    return readDocxText(buffer);
  }

  const text = buffer.toString('utf8');
  if (extension === '.xml' || extension === '.arxml' || extension === '.fibex') {
    return stripXml(text);
  }
  return normalizeText(text);
}

function isZip(buffer) {
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function readDocxText(buffer) {
  const entries = readZipEntries(buffer);
  const docEntry = entries.find((entry) => entry.name === 'word/document.xml');
  if (!docEntry) {
    return '';
  }
  const xml = inflateZipEntry(buffer, docEntry).toString('utf8');
  return stripXml(xml);
}

function readZipEntries(buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) {
    return [];
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < totalEntries && cursor + 46 <= buffer.length; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      break;
    }

    const compression = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString('utf8');

    entries.push({
      name,
      compression,
      compressedSize,
      uncompressedSize,
      localHeaderOffset
    });

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function inflateZipEntry(buffer, entry) {
  const local = entry.localHeaderOffset;
  if (buffer.readUInt32LE(local) !== 0x04034b50) {
    return Buffer.alloc(0);
  }
  const fileNameLength = buffer.readUInt16LE(local + 26);
  const extraLength = buffer.readUInt16LE(local + 28);
  const dataStart = local + 30 + fileNameLength + extraLength;
  const data = buffer.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.compression === 0) {
    return data;
  }
  if (entry.compression === 8) {
    return zlib.inflateRawSync(data);
  }
  return Buffer.alloc(0);
}

function findEndOfCentralDirectory(buffer) {
  const min = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= min; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }
  return -1;
}

function stripXml(xml) {
  return normalizeText(
    xml
      .replace(/<w:tab\/>/g, ' ')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<\/w:tr>/g, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
  );
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\r?\n\s*\r?\n/g, '\n\n')
    .trim();
}

module.exports = {
  readDocumentText,
  stripXml,
  readDocxText
};
