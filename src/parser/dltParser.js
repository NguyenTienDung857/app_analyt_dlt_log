const path = require('node:path');

const STORAGE_HEADER_SIZE = 16;
const SERIAL_HEADER_SIZE = 4;
const STANDARD_HEADER_SIZE = 4;
const MIN_DLT_MESSAGE_SIZE = STANDARD_HEADER_SIZE;
const MAX_PAYLOAD_HEX_BYTES = 1024;
const MAX_STORAGE_TIMEZONE_OFFSET_MS = 14 * 60 * 60 * 1000;

function parseLogBuffer(buffer, options = {}) {
  if (looksLikeDlt(buffer, options)) {
    return parseDltBuffer(buffer, options);
  }
  return parseTextBuffer(buffer, options);
}

function looksLikeDlt(buffer, options = {}) {
  const scanLimit = Math.max(0, Math.min(buffer.length - STANDARD_HEADER_SIZE, 1024 * 1024));
  for (let offset = 0; offset < scanLimit; offset += 1) {
    if (isStorageHeader(buffer, offset) || isSerialHeader(buffer, offset)) {
      return true;
    }
  }
  if (isLikelyDltFile(options) && isPlausibleStandardHeader(buffer, 0, buffer.length, { strictVersion: true })) {
    return true;
  }
  return false;
}

function parseDltBuffer(buffer, options = {}) {
  const onChunk = options.onChunk || (() => {});
  const onProgress = options.onProgress || (() => {});
  const filePath = options.filePath || '';
  const fileName = options.fileName || path.basename(filePath) || 'unknown.dlt';
  const fileIndex = options.fileIndex || 0;
  const chunkSize = options.chunkSize || 2500;
  const totalLength = buffer.length;

  let offset = 0;
  let globalIndex = options.startIndex || 0;
  let previousTimeMs = null;
  let parsed = 0;
  let skippedBytes = 0;
  let lastProgressOffset = 0;
  let chunk = [];

  const frameFormats = new Set();
  const preferredFrameFormat = detectPreferredFrameFormat(buffer, options);
  const storageTimeOffsetMs = preferredFrameFormat === 'storage'
    ? inferStorageTimeOffsetMs(buffer, { fileName, filePath })
    : 0;

  if (preferredFrameFormat === 'storage') {
    return parseStorageDltBuffer(buffer, {
      onChunk,
      onProgress,
      filePath,
      fileName,
      fileIndex,
      chunkSize,
      startIndex: options.startIndex || 0,
      storageTimeOffsetMs
    });
  }

  while (offset + MIN_DLT_MESSAGE_SIZE <= totalLength) {
    const frame = resolveDltFrame(buffer, offset, totalLength, { preferredFrameFormat });
    if (!frame) {
      offset += 1;
      skippedBytes += 1;
      continue;
    }

    const message = parseDltMessage(buffer, offset, {
      ...frame,
      filePath,
      fileName,
      fileIndex,
      index: globalIndex,
      previousTimeMs,
      storageTimeOffsetMs
    });

    if (!message || message.nextOffset <= offset) {
      offset += 1;
      skippedBytes += 1;
      continue;
    }

    previousTimeMs = Number.isFinite(message.timeMs) ? message.timeMs : previousTimeMs;
    chunk.push(message);
    frameFormats.add(frame.format);
    parsed += 1;
    globalIndex += 1;
    offset = message.nextOffset;
    delete message.nextOffset;
    delete message.payloadStartOffset;

    if (chunk.length >= chunkSize) {
      onChunk(chunk);
      chunk = [];
    }

    if (offset - lastProgressOffset > 2 * 1024 * 1024) {
      lastProgressOffset = offset;
      onProgress({
        fileName,
        fileIndex,
        loadedBytes: offset,
        totalBytes: totalLength,
        parsed
      });
    }
  }

  if (chunk.length) {
    onChunk(chunk);
  }

  onProgress({
    fileName,
    fileIndex,
    loadedBytes: totalLength,
    totalBytes: totalLength,
    parsed
  });

  return {
    count: parsed,
    nextIndex: globalIndex,
    skippedBytes,
    parser: formatDltParserName(frameFormats)
  };
}

function parseStorageDltBuffer(buffer, options = {}) {
  const onChunk = options.onChunk || (() => {});
  const onProgress = options.onProgress || (() => {});
  const filePath = options.filePath || '';
  const fileName = options.fileName || path.basename(filePath) || 'unknown.dlt';
  const fileIndex = options.fileIndex || 0;
  const chunkSize = options.chunkSize || 2500;
  const totalLength = buffer.length;
  const storageTimeOffsetMs = Number(options.storageTimeOffsetMs) || 0;
  const acceptedOffsets = filterStorageFrameOffsets(buffer, findStorageFrameOffsets(buffer), {
    filePath,
    fileName,
    fileIndex,
    storageTimeOffsetMs
  });

  let globalIndex = options.startIndex || 0;
  let previousTimeMs = null;
  let parsed = 0;
  let skippedBytes = 0;
  let previousEndOffset = 0;
  let lastProgressOffset = 0;
  let chunk = [];

  for (const frameOffset of acceptedOffsets) {
    const message = parseDltMessage(buffer, frameOffset, {
      standardOffset: frameOffset + STORAGE_HEADER_SIZE,
      hasStorageHeader: true,
      hasSerialHeader: false,
      format: 'storage',
      filePath,
      fileName,
      fileIndex,
      index: globalIndex,
      previousTimeMs,
      storageTimeOffsetMs
    });

    if (!message || message.nextOffset <= frameOffset) {
      continue;
    }

    if (frameOffset > previousEndOffset) {
      skippedBytes += frameOffset - previousEndOffset;
    }
    previousEndOffset = Math.max(previousEndOffset, message.nextOffset);

    previousTimeMs = Number.isFinite(message.timeMs) ? message.timeMs : previousTimeMs;
    chunk.push(message);
    parsed += 1;
    globalIndex += 1;
    delete message.nextOffset;
    delete message.payloadStartOffset;

    if (chunk.length >= chunkSize) {
      onChunk(chunk);
      chunk = [];
    }

    if (frameOffset - lastProgressOffset > 2 * 1024 * 1024) {
      lastProgressOffset = frameOffset;
      onProgress({
        fileName,
        fileIndex,
        loadedBytes: frameOffset,
        totalBytes: totalLength,
        parsed
      });
    }
  }

  if (previousEndOffset < totalLength) {
    skippedBytes += totalLength - previousEndOffset;
  }

  if (chunk.length) {
    onChunk(chunk);
  }

  onProgress({
    fileName,
    fileIndex,
    loadedBytes: totalLength,
    totalBytes: totalLength,
    parsed
  });

  return {
    count: parsed,
    nextIndex: globalIndex,
    skippedBytes,
    parser: 'dlt-storage'
  };
}

function resolveDltFrame(buffer, offset, totalLength, options = {}) {
  if (
    isStorageHeader(buffer, offset) &&
    isPlausibleStandardHeader(buffer, offset + STORAGE_HEADER_SIZE, totalLength, { strictVersion: true })
  ) {
    return {
      standardOffset: offset + STORAGE_HEADER_SIZE,
      hasStorageHeader: true,
      hasSerialHeader: false,
      format: 'storage'
    };
  }

  if (
    isSerialHeader(buffer, offset) &&
    isPlausibleStandardHeader(buffer, offset + SERIAL_HEADER_SIZE, totalLength, { strictVersion: false })
  ) {
    return {
      standardOffset: offset + SERIAL_HEADER_SIZE,
      hasStorageHeader: false,
      hasSerialHeader: true,
      format: 'serial'
    };
  }

  if (options.preferredFrameFormat === 'storage' || options.preferredFrameFormat === 'serial') {
    return null;
  }

  if (isPlausibleStandardHeader(buffer, offset, totalLength, { strictVersion: true })) {
    return {
      standardOffset: offset,
      hasStorageHeader: false,
      hasSerialHeader: false,
      format: 'raw'
    };
  }

  return null;
}

function parseDltMessage(buffer, frameOffset, context) {
  const totalLength = buffer.length;
  const hasStorageHeader = Boolean(context.hasStorageHeader);
  const standardOffset = context.standardOffset ?? (frameOffset + STORAGE_HEADER_SIZE);
  const timestampSec = hasStorageHeader ? buffer.readUInt32LE(frameOffset + 4) : null;
  const timestampMicro = hasStorageHeader ? buffer.readUInt32LE(frameOffset + 8) : 0;
  const storageEcu = hasStorageHeader ? readAscii(buffer, frameOffset + 12, 4).trim() : '';

  const htyp = buffer[standardOffset];
  const counter = buffer[standardOffset + 1];
  const length = buffer.readUInt16BE(standardOffset + 2);

  if (!Number.isFinite(length) || length < STANDARD_HEADER_SIZE || standardOffset + length > totalLength) {
    return null;
  }

  const messageEnd = standardOffset + length;
  let cursor = standardOffset + 4;
  const useExtendedHeader = Boolean(htyp & 0x01);
  const msbFirst = Boolean(htyp & 0x02);
  const withEcuId = Boolean(htyp & 0x04);
  const withSessionId = Boolean(htyp & 0x08);
  const withTimestamp = Boolean(htyp & 0x10);
  const version = (htyp >> 5) & 0x07;
  const littleEndian = !msbFirst;

  let ecu = storageEcu;
  let sessionId = null;
  let dltTimestamp = null;

  if (withEcuId && cursor + 4 <= messageEnd) {
    ecu = readAscii(buffer, cursor, 4).trim() || ecu;
    cursor += 4;
  }

  if (withSessionId && cursor + 4 <= messageEnd) {
    sessionId = readUInt32(buffer, cursor, littleEndian);
    cursor += 4;
  }

  if (withTimestamp && cursor + 4 <= messageEnd) {
    dltTimestamp = readUInt32(buffer, cursor, littleEndian);
    cursor += 4;
  }

  let msin = 0;
  let noar = 0;
  let apid = '';
  let ctid = '';
  let type = 'unknown';
  let subtype = 'unknown';
  let level = 'Unknown';
  let verbose = false;

  if (useExtendedHeader && cursor + 10 <= messageEnd) {
    msin = buffer[cursor];
    noar = buffer[cursor + 1];
    apid = readAscii(buffer, cursor + 2, 4).trim();
    ctid = readAscii(buffer, cursor + 6, 4).trim();
    cursor += 10;

    verbose = Boolean(msin & 0x01);
    const mstp = (msin & 0x0e) >> 1;
    const mtin = (msin & 0xf0) >> 4;
    type = mapMessageType(mstp);
    subtype = mapMessageSubtype(mstp, mtin);
    level = mstp === 0 ? mapLogLevel(mtin) : subtype;
  }

  const payloadStart = cursor;
  const payloadLength = Math.max(0, messageEnd - payloadStart);
  const payloadBuffer = buffer.subarray(payloadStart, messageEnd);
  const decoded = verbose
    ? parseVerbosePayload(buffer, payloadStart, messageEnd, noar, littleEndian)
    : parseNonVerbosePayload(buffer, payloadStart, messageEnd, littleEndian);

  const storageTimeOffsetMs = Number(context.storageTimeOffsetMs) || 0;
  const timeMs = hasStorageHeader
    ? timestampSec * 1000 + Math.floor(timestampMicro / 1000) + storageTimeOffsetMs
    : dltTimestampToMilliseconds(dltTimestamp, context.index);
  const deltaMs = context.previousTimeMs === null || !Number.isFinite(timeMs)
    ? 0
    : timeMs - context.previousTimeMs;

  return {
    id: context.index,
    index: context.index,
    fileName: context.fileName,
    filePath: context.filePath,
    fileIndex: context.fileIndex,
    fileOffset: frameOffset,
    time: hasStorageHeader ? formatStorageTime(timestampSec, timestampMicro, storageTimeOffsetMs) : formatDltTime(dltTimestamp, context.index),
    timeMs,
    deltaMs,
    dltTimestamp,
    level,
    type,
    subtype,
    ecu: ecu || storageEcu || '-',
    apid: apid || '-',
    ctid: ctid || '-',
    session: sessionId,
    counter,
    length,
    payloadLength,
    payload: decoded.payload || '',
    payloadAscii: decoded.ascii || asciiPreview(payloadBuffer),
    payloadHex: hexPreview(payloadBuffer, MAX_PAYLOAD_HEX_BYTES),
    payloadHexTruncated: payloadBuffer.length > MAX_PAYLOAD_HEX_BYTES,
    messageId: decoded.messageId || '',
    verbose,
    nonVerbose: !verbose,
    decodeStatus: decoded.decodeStatus,
    version,
    storageHeader: hasStorageHeader,
    serialHeader: Boolean(context.hasSerialHeader),
    frameFormat: context.format || (hasStorageHeader ? 'storage' : 'raw'),
    payloadStartOffset: payloadStart,
    nextOffset: standardOffset + length
  };
}

function parseVerbosePayload(buffer, start, end, noar, littleEndian) {
  const parts = [];
  let cursor = start;
  for (let argIndex = 0; argIndex < noar; argIndex += 1) {
    if (cursor + 4 > end) {
      break;
    }

    const typeInfo = readUInt32(buffer, cursor, littleEndian);
    cursor += 4;
    const typeLength = typeInfo & 0x0f;
    const byteSize = byteSizeFromTypeLength(typeLength);
    const isBool = Boolean(typeInfo & 0x10);
    const isSInt = Boolean(typeInfo & 0x20);
    const isUInt = Boolean(typeInfo & 0x40);
    const isFloat = Boolean(typeInfo & 0x80);
    const isString = Boolean(typeInfo & 0x200);
    const isRaw = Boolean(typeInfo & 0x400);

    if (isString) {
      if (cursor + 2 > end) break;
      const strLen = readUInt16(buffer, cursor, littleEndian);
      cursor += 2;
      if (cursor + strLen > end) break;
      parts.push(readAscii(buffer, cursor, strLen).replace(/\0+$/g, ''));
      cursor += strLen;
      continue;
    }

    if (isRaw) {
      if (cursor + 2 > end) break;
      const rawLen = readUInt16(buffer, cursor, littleEndian);
      cursor += 2;
      if (cursor + rawLen > end) break;
      const raw = buffer.subarray(cursor, cursor + rawLen);
      const ascii = asciiPreview(raw);
      parts.push(ascii ? `[raw:${rawLen}] ${ascii}` : `[raw:${rawLen}] ${hexPreview(raw, 48)}`);
      cursor += rawLen;
      continue;
    }

    if (isBool) {
      if (cursor + 1 > end) break;
      parts.push(buffer[cursor] ? 'true' : 'false');
      cursor += 1;
      continue;
    }

    if (isUInt || isSInt || isFloat) {
      if (!byteSize || cursor + byteSize > end) break;
      parts.push(readTypedNumber(buffer, cursor, byteSize, littleEndian, { isUInt, isSInt, isFloat }));
      cursor += byteSize;
      continue;
    }

    break;
  }

  return {
    payload: parts.map((item) => String(item)).join(' '),
    ascii: '',
    decodeStatus: parts.length ? 'verbose-decoded' : 'verbose-empty'
  };
}

function parseNonVerbosePayload(buffer, start, end, littleEndian) {
  const payloadBuffer = buffer.subarray(start, end);
  const ascii = asciiPreview(payloadBuffer);
  let messageId = '';

  if (payloadBuffer.length >= 4) {
    messageId = `0x${readUInt32(buffer, start, littleEndian).toString(16).padStart(8, '0')}`;
  }

  const readable = ascii && ascii.length >= 3 ? ascii : '';
  return {
    payload: readable
      ? `[non-verbose${messageId ? ` ${messageId}` : ''}] ${readable}`
      : `[non-verbose${messageId ? ` ${messageId}` : ''}] decoder mapping required`,
    ascii: readable,
    messageId,
    decodeStatus: 'non-verbose-needs-fibex-arxml'
  };
}

function parseTextBuffer(buffer, options = {}) {
  const onChunk = options.onChunk || (() => {});
  const onProgress = options.onProgress || (() => {});
  const filePath = options.filePath || '';
  const fileName = options.fileName || path.basename(filePath) || 'unknown.log';
  const fileIndex = options.fileIndex || 0;
  const chunkSize = options.chunkSize || 2500;
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/);
  let globalIndex = options.startIndex || 0;
  let chunk = [];
  let previousTimeMs = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (!line) continue;
    const parsed = parseTextLine(line);
    const timeMs = parsed.timeMs || lineIndex;
    const deltaMs = previousTimeMs === null ? 0 : timeMs - previousTimeMs;
    previousTimeMs = timeMs;

    chunk.push({
      id: globalIndex,
      index: globalIndex,
      fileName,
      filePath,
      fileIndex,
      fileOffset: lineIndex,
      time: parsed.time || `line ${lineIndex + 1}`,
      timeMs,
      deltaMs,
      dltTimestamp: null,
      level: parsed.level,
      type: 'text',
      subtype: 'text',
      ecu: parsed.ecu,
      apid: parsed.apid,
      ctid: parsed.ctid,
      session: null,
      counter: null,
      length: Buffer.byteLength(line),
      payloadLength: Buffer.byteLength(line),
      payload: parsed.payload,
      payloadAscii: parsed.payload,
      payloadHex: '',
      payloadHexTruncated: false,
      messageId: '',
      verbose: true,
      nonVerbose: false,
      decodeStatus: 'text-line',
      version: 0
    });
    globalIndex += 1;

    if (chunk.length >= chunkSize) {
      onChunk(chunk);
      chunk = [];
    }

    if (lineIndex % 10000 === 0) {
      onProgress({
        fileName,
        fileIndex,
        loadedBytes: lineIndex,
        totalBytes: lines.length,
        parsed: globalIndex - (options.startIndex || 0)
      });
    }
  }

  if (chunk.length) {
    onChunk(chunk);
  }
  onProgress({ fileName, fileIndex, loadedBytes: lines.length, totalBytes: lines.length, parsed: globalIndex });

  return {
    count: globalIndex - (options.startIndex || 0),
    nextIndex: globalIndex,
    skippedBytes: 0,
    parser: 'text'
  };
}

function parseTextLine(line) {
  const levelMatch = line.match(/\b(FATAL|ERROR|ERR|WARN|WARNING|INFO|DEBUG|VERBOSE|TRACE|CONTROL)\b/i);
  const timeMatch = line.match(/\b(\d{4}[-/]\d{2}[-/]\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?|\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?)\b/);
  const triplet = line.match(/\b([A-Z0-9_]{2,4})[/: ]+([A-Z0-9_]{2,4})[/: ]+([A-Z0-9_]{2,4})\b/);
  const time = timeMatch ? timeMatch[1].replace(',', '.') : '';
  const dateValue = time && time.length > 10 ? Date.parse(time.replace(/\//g, '-')) : NaN;

  return {
    time,
    timeMs: Number.isFinite(dateValue) ? dateValue : null,
    level: normalizeTextLevel(levelMatch ? levelMatch[1] : ''),
    ecu: triplet ? triplet[1] : '-',
    apid: triplet ? triplet[2] : '-',
    ctid: triplet ? triplet[3] : '-',
    payload: line
  };
}

function isStorageHeader(buffer, offset) {
  return (
    buffer[offset] === 0x44 &&
    buffer[offset + 1] === 0x4c &&
    buffer[offset + 2] === 0x54 &&
    buffer[offset + 3] === 0x01
  );
}

function isSerialHeader(buffer, offset) {
  return (
    buffer[offset] === 0x44 &&
    buffer[offset + 1] === 0x4c &&
    buffer[offset + 2] === 0x53 &&
    buffer[offset + 3] === 0x01
  );
}

function isPlausibleStandardHeader(buffer, offset, totalLength = buffer.length, options = {}) {
  if (offset < 0 || offset + STANDARD_HEADER_SIZE > totalLength) return false;

  const htyp = buffer[offset];
  const length = buffer.readUInt16BE(offset + 2);
  if (!Number.isFinite(length) || length < STANDARD_HEADER_SIZE || offset + length > totalLength) {
    return false;
  }

  const version = (htyp >> 5) & 0x07;
  if (options.strictVersion && version !== 1) {
    return false;
  }

  const headerLength = getStandardHeaderLength(htyp);
  if (length < headerLength) {
    return false;
  }

  if ((htyp & 0x01) && options.strictVersion) {
    const extendedOffset = offset + getStandardHeaderLength(htyp, { withoutExtended: true });
    if (extendedOffset + 10 > offset + length) return false;
    const msin = buffer[extendedOffset];
    const mstp = (msin & 0x0e) >> 1;
    if (mstp > 3) return false;
    if (!isLikelyDltId(buffer, extendedOffset + 2) || !isLikelyDltId(buffer, extendedOffset + 6)) {
      return false;
    }
  }

  return true;
}

function detectPreferredFrameFormat(buffer, options = {}) {
  const scanLimit = Math.max(0, Math.min(buffer.length - STANDARD_HEADER_SIZE, 1024 * 1024));
  let firstStorage = Infinity;
  let firstSerial = Infinity;

  for (let offset = 0; offset <= scanLimit; offset += 1) {
    if (
      firstStorage === Infinity &&
      isStorageHeader(buffer, offset) &&
      isPlausibleStandardHeader(buffer, offset + STORAGE_HEADER_SIZE, buffer.length, { strictVersion: true })
    ) {
      firstStorage = offset;
    }

    if (
      firstSerial === Infinity &&
      isSerialHeader(buffer, offset) &&
      isPlausibleStandardHeader(buffer, offset + SERIAL_HEADER_SIZE, buffer.length, { strictVersion: false })
    ) {
      firstSerial = offset;
    }

    if (firstStorage !== Infinity || firstSerial !== Infinity) {
      break;
    }
  }

  if (firstStorage < firstSerial) return 'storage';
  if (firstSerial < firstStorage) return 'serial';
  if (isLikelyDltFile(options)) return 'raw';
  return '';
}

function findNextPlausibleStorageHeader(buffer, startOffset, endOffset, totalLength = buffer.length) {
  const safeStart = Math.max(0, startOffset);
  const safeEnd = Math.min(endOffset, totalLength - STORAGE_HEADER_SIZE - STANDARD_HEADER_SIZE);

  for (let offset = safeStart; offset <= safeEnd; offset += 1) {
    if (!isStorageHeader(buffer, offset)) continue;
    const seconds = buffer.readUInt32LE(offset + 4);
    const microseconds = buffer.readUInt32LE(offset + 8);
    if (!isPlausibleStorageTimestamp(seconds, microseconds)) continue;
    if (isPlausibleStandardHeader(buffer, offset + STORAGE_HEADER_SIZE, totalLength, { strictVersion: true })) {
      return offset;
    }
  }

  return -1;
}

function findStorageFrameOffsets(buffer) {
  const offsets = [];
  for (let offset = 0; offset <= buffer.length - STORAGE_HEADER_SIZE - STANDARD_HEADER_SIZE; offset += 1) {
    if (!isStorageHeader(buffer, offset)) continue;
    const seconds = buffer.readUInt32LE(offset + 4);
    const microseconds = buffer.readUInt32LE(offset + 8);
    if (!isPlausibleStorageTimestamp(seconds, microseconds)) continue;
    if (isPlausibleStandardHeader(buffer, offset + STORAGE_HEADER_SIZE, buffer.length, { strictVersion: true })) {
      offsets.push(offset);
    }
  }
  return offsets;
}

function filterStorageFrameOffsets(buffer, offsets, context) {
  const accepted = [];

  for (let index = 0; index < offsets.length; index += 1) {
    const frameOffset = offsets[index];
    const nextOffset = offsets[index + 1] ?? Infinity;
    const message = parseDltMessage(buffer, frameOffset, {
      standardOffset: frameOffset + STORAGE_HEADER_SIZE,
      hasStorageHeader: true,
      hasSerialHeader: false,
      format: 'storage',
      filePath: context.filePath,
      fileName: context.fileName,
      fileIndex: context.fileIndex,
      index,
      previousTimeMs: null,
      storageTimeOffsetMs: context.storageTimeOffsetMs
    });

    if (!message || shouldDropOverlappedStorageFrame(message, nextOffset)) {
      continue;
    }

    accepted.push(frameOffset);
  }

  return accepted;
}

function shouldDropOverlappedStorageFrame(message, nextOffset) {
  if (!Number.isFinite(nextOffset) || nextOffset >= message.nextOffset) {
    return false;
  }

  return nextOffset >= message.payloadStartOffset && message.decodeStatus !== 'verbose-decoded';
}

function inferStorageTimeOffsetMs(buffer, options = {}) {
  const fileTimeMs = parseLogFileNameTimeMs(options.fileName || options.filePath);
  if (!Number.isFinite(fileTimeMs)) return 0;

  const firstStorageOffset = findNextPlausibleStorageHeader(buffer, 0, Math.min(buffer.length, 1024 * 1024), buffer.length);
  if (firstStorageOffset < 0) return 0;

  const storageSecondsMs = buffer.readUInt32LE(firstStorageOffset + 4) * 1000;
  const offsetMs = fileTimeMs - storageSecondsMs;
  if (!Number.isFinite(offsetMs) || Math.abs(offsetMs) > MAX_STORAGE_TIMEZONE_OFFSET_MS) {
    return 0;
  }

  return offsetMs;
}

function parseLogFileNameTimeMs(value) {
  const match = String(value || '').match(/(?:^|[^\d])(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})(?:[^\d]|$)/);
  if (!match) return NaN;

  const [, year, month, day, hour, minute, second] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return NaN;
  }

  return Date.UTC(year, month - 1, day, hour, minute, second);
}

function isPlausibleStorageTimestamp(seconds, microseconds) {
  if (!Number.isFinite(seconds) || !Number.isFinite(microseconds) || microseconds >= 1000000) {
    return false;
  }

  const minSeconds = Date.UTC(2000, 0, 1) / 1000;
  const maxSeconds = Date.UTC(2100, 0, 1) / 1000;
  return seconds >= minSeconds && seconds <= maxSeconds;
}

function getStandardHeaderLength(htyp, options = {}) {
  let length = STANDARD_HEADER_SIZE;
  if (htyp & 0x04) length += 4;
  if (htyp & 0x08) length += 4;
  if (htyp & 0x10) length += 4;
  if ((htyp & 0x01) && !options.withoutExtended) length += 10;
  return length;
}

function isLikelyDltId(buffer, offset) {
  for (let index = 0; index < 4; index += 1) {
    const code = buffer[offset + index];
    if (code !== 0 && (code < 32 || code > 126)) return false;
  }
  return true;
}

function isLikelyDltFile(options = {}) {
  const name = String(options.fileName || options.filePath || '').toLowerCase();
  return name.endsWith('.dlt') || name.endsWith('.bin');
}

function formatDltParserName(frameFormats) {
  if (!frameFormats || !frameFormats.size) return 'dlt';
  if (frameFormats.size === 1) return `dlt-${Array.from(frameFormats)[0]}`;
  return `dlt-${Array.from(frameFormats).sort().join('+')}`;
}

function dltTimestampToMilliseconds(dltTimestamp, fallbackIndex) {
  if (Number.isFinite(dltTimestamp)) {
    return Math.floor(dltTimestamp / 10);
  }
  return Number.isFinite(fallbackIndex) ? fallbackIndex : 0;
}

function formatDltTime(dltTimestamp, fallbackIndex) {
  if (Number.isFinite(dltTimestamp)) {
    return `dlt ${dltTimestamp}`;
  }
  return `message ${Number(fallbackIndex || 0) + 1}`;
}

function readAscii(buffer, offset, length) {
  let result = '';
  for (let index = 0; index < length && offset + index < buffer.length; index += 1) {
    const code = buffer[offset + index];
    if (code === 0) break;
    result += code >= 32 && code <= 126 ? String.fromCharCode(code) : '';
  }
  return result;
}

function asciiPreview(buffer) {
  let result = '';
  for (let index = 0; index < buffer.length; index += 1) {
    const code = buffer[index];
    if (code === 0) continue;
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126)) {
      result += String.fromCharCode(code);
    } else if (result.length && result[result.length - 1] !== ' ') {
      result += ' ';
    }
  }
  return result.replace(/\s+/g, ' ').trim();
}

function hexPreview(buffer, maxBytes) {
  const limit = Math.min(buffer.length, maxBytes);
  const parts = [];
  for (let index = 0; index < limit; index += 1) {
    parts.push(buffer[index].toString(16).padStart(2, '0').toUpperCase());
  }
  return parts.join(' ');
}

function readUInt16(buffer, offset, littleEndian) {
  return littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
}

function readUInt32(buffer, offset, littleEndian) {
  return littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
}

function readTypedNumber(buffer, offset, byteSize, littleEndian, flags) {
  if (flags.isFloat) {
    if (byteSize === 4) return littleEndian ? buffer.readFloatLE(offset) : buffer.readFloatBE(offset);
    if (byteSize === 8) return littleEndian ? buffer.readDoubleLE(offset) : buffer.readDoubleBE(offset);
    return `[float:${byteSize}]`;
  }

  if (flags.isSInt) {
    if (byteSize === 1) return buffer.readInt8(offset);
    if (byteSize === 2) return littleEndian ? buffer.readInt16LE(offset) : buffer.readInt16BE(offset);
    if (byteSize === 4) return littleEndian ? buffer.readInt32LE(offset) : buffer.readInt32BE(offset);
    if (byteSize === 8) return littleEndian ? Number(buffer.readBigInt64LE(offset)) : Number(buffer.readBigInt64BE(offset));
  }

  if (byteSize === 1) return buffer.readUInt8(offset);
  if (byteSize === 2) return littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
  if (byteSize === 4) return littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
  if (byteSize === 8) return littleEndian ? Number(buffer.readBigUInt64LE(offset)) : Number(buffer.readBigUInt64BE(offset));
  return `[uint:${byteSize}]`;
}

function byteSizeFromTypeLength(typeLength) {
  if (typeLength === 1) return 1;
  if (typeLength === 2) return 2;
  if (typeLength === 3) return 4;
  if (typeLength === 4) return 8;
  if (typeLength === 5) return 16;
  return 0;
}

function mapMessageType(mstp) {
  if (mstp === 0) return 'log';
  if (mstp === 1) return 'app_trace';
  if (mstp === 2) return 'nw_trace';
  if (mstp === 3) return 'control';
  return 'unknown';
}

function mapMessageSubtype(mstp, mtin) {
  if (mstp === 0) return mapLogLevel(mtin);
  if (mstp === 1) return ['Variable', 'FunctionIn', 'FunctionOut', 'State', 'Vfb'][mtin] || `Trace-${mtin}`;
  if (mstp === 2) return ['Ipc', 'Can', 'FlexRay', 'Most', 'Ethernet', 'SomeIp'][mtin] || `Network-${mtin}`;
  if (mstp === 3) return ['Request', 'Response', 'Time'][mtin] || `Control-${mtin}`;
  return 'Unknown';
}

function mapLogLevel(mtin) {
  if (mtin === 1) return 'Fatal';
  if (mtin === 2) return 'Error';
  if (mtin === 3) return 'Warn';
  if (mtin === 4) return 'Info';
  if (mtin === 5) return 'Debug';
  if (mtin === 6) return 'Verbose';
  return 'Unknown';
}

function normalizeTextLevel(value) {
  const upper = String(value || '').toUpperCase();
  if (upper === 'FATAL') return 'Fatal';
  if (upper === 'ERROR' || upper === 'ERR') return 'Error';
  if (upper === 'WARN' || upper === 'WARNING') return 'Warn';
  if (upper === 'INFO') return 'Info';
  if (upper === 'DEBUG') return 'Debug';
  if (upper === 'VERBOSE') return 'Verbose';
  if (upper === 'TRACE') return 'Trace';
  if (upper === 'CONTROL') return 'Control';
  return 'Unknown';
}

function formatStorageTime(seconds, microseconds, offsetMs = 0) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 'unknown';
  }
  const millis = Math.floor(microseconds / 1000);
  const micros = microseconds % 1000;
  const date = new Date(seconds * 1000 + millis + offsetMs);
  const iso = date.toISOString().replace('T', ' ').replace('Z', '');
  return `${iso}${micros.toString().padStart(3, '0')}`;
}

module.exports = {
  parseLogBuffer,
  parseDltBuffer,
  parseTextBuffer,
  looksLikeDlt
};
