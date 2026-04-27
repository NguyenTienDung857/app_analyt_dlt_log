const fs = require('node:fs');
const path = require('node:path');

const { readDocumentText } = require('./docReader');

const SUPPORTED_EXTENSIONS = new Set(['', '.txt', '.md', '.log', '.xml', '.arxml', '.fibex', '.docx']);

class RagStore {
  constructor() {
    this.chunks = [];
    this.documentFrequency = new Map();
    this.sources = [];
  }

  async rebuildFromPaths(pathsToIndex) {
    this.chunks = [];
    this.documentFrequency = new Map();
    this.sources = [];

    const files = expandPaths(pathsToIndex || []);
    for (const filePath of files) {
      try {
        const text = readDocumentText(filePath);
        if (!text) continue;
        this.addDocument(filePath, text);
      } catch (error) {
        this.sources.push({
          path: filePath,
          fileName: path.basename(filePath),
          chunks: 0,
          error: error.message
        });
      }
    }

    this.rebuildDocumentFrequency();
    return this.stats();
  }

  addDocument(filePath, text) {
    const chunks = chunkText(text, 1200, 220);
    const source = {
      path: filePath,
      fileName: path.basename(filePath),
      chunks: chunks.length,
      error: ''
    };
    this.sources.push(source);

    for (const chunk of chunks) {
      const tokens = tokenize(chunk);
      const tf = new Map();
      for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
      }

      this.chunks.push({
        id: this.chunks.length,
        source: source.fileName,
        sourcePath: filePath,
        text: chunk,
        tokens,
        tf
      });
    }
  }

  rebuildDocumentFrequency() {
    this.documentFrequency = new Map();
    for (const chunk of this.chunks) {
      const unique = new Set(chunk.tokens);
      for (const token of unique) {
        this.documentFrequency.set(token, (this.documentFrequency.get(token) || 0) + 1);
      }
    }
  }

  search(query, limit = 6) {
    const queryTokens = tokenize(query);
    if (!queryTokens.length || !this.chunks.length) {
      return [];
    }

    const queryTf = new Map();
    for (const token of queryTokens) {
      queryTf.set(token, (queryTf.get(token) || 0) + 1);
    }

    const scored = [];
    for (const chunk of this.chunks) {
      const score = cosineScore(queryTf, chunk.tf, this.documentFrequency, this.chunks.length);
      if (score > 0) {
        scored.push({
          id: chunk.id,
          score,
          source: chunk.source,
          sourcePath: chunk.sourcePath,
          text: chunk.text
        });
      }
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => ({
        ...item,
        score: Number(item.score.toFixed(4))
      }));
  }

  searchSource(sourcePattern, query, limit = 3) {
    const pattern = String(sourcePattern || '').toLowerCase();
    if (!pattern || !this.chunks.length) return [];

    const sourceChunks = this.chunks.filter((chunk) => {
      return String(chunk.source || '').toLowerCase().includes(pattern) ||
        String(chunk.sourcePath || '').toLowerCase().includes(pattern);
    });
    if (!sourceChunks.length) return [];

    const queryTokens = tokenize(query);
    if (!queryTokens.length) {
      return sourceChunks.slice(0, limit).map((chunk) => chunkToResult(chunk, 0));
    }

    const queryTf = new Map();
    for (const token of queryTokens) {
      queryTf.set(token, (queryTf.get(token) || 0) + 1);
    }

    const scored = sourceChunks
      .map((chunk) => ({
        ...chunkToResult(chunk, cosineScore(queryTf, chunk.tf, this.documentFrequency, this.chunks.length))
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const fallback = scored.length ? scored : sourceChunks.slice(0, limit).map((chunk) => chunkToResult(chunk, 0));
    return fallback.slice(0, limit).map((item) => ({
      ...item,
      score: Number(item.score.toFixed(4))
    }));
  }

  stats() {
    return {
      chunks: this.chunks.length,
      sources: this.sources,
      terms: this.documentFrequency.size
    };
  }
}

function chunkToResult(chunk, score) {
  return {
    id: chunk.id,
    score,
    source: chunk.source,
    sourcePath: chunk.sourcePath,
    text: chunk.text
  };
}

function expandPaths(pathsToIndex) {
  const files = [];
  for (const itemPath of pathsToIndex) {
    if (!itemPath || !fs.existsSync(itemPath)) continue;
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(itemPath)) {
        files.push(...expandPaths([path.join(itemPath, child)]));
      }
      continue;
    }

    const extension = path.extname(itemPath).toLowerCase();
    if (SUPPORTED_EXTENSIONS.has(extension)) {
      files.push(itemPath);
    }
  }
  return files;
}

function chunkText(text, targetSize, overlap) {
  const paragraphs = String(text || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks = [];
  let current = '';

  for (const paragraph of paragraphs) {
    if ((current + '\n\n' + paragraph).length > targetSize && current) {
      chunks.push(current.trim());
      current = current.slice(Math.max(0, current.length - overlap));
    }
    current += `${current ? '\n\n' : ''}${paragraph}`;
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length ? chunks : splitByLength(text, targetSize, overlap);
}

function splitByLength(text, targetSize, overlap) {
  const chunks = [];
  const value = String(text || '');
  for (let start = 0; start < value.length; start += targetSize - overlap) {
    const chunk = value.slice(start, start + targetSize).trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[a-z0-9_]{2,}/g) || [];
}

function cosineScore(queryTf, docTf, documentFrequency, totalDocuments) {
  let dot = 0;
  let queryNorm = 0;
  let docNorm = 0;
  const allTokens = new Set([...queryTf.keys(), ...docTf.keys()]);

  for (const token of allTokens) {
    const idf = Math.log(1 + totalDocuments / (1 + (documentFrequency.get(token) || 0)));
    const q = (queryTf.get(token) || 0) * idf;
    const d = (docTf.get(token) || 0) * idf;
    dot += q * d;
    queryNorm += q * q;
    docNorm += d * d;
  }

  if (!queryNorm || !docNorm) {
    return 0;
  }
  return dot / (Math.sqrt(queryNorm) * Math.sqrt(docNorm));
}

module.exports = {
  RagStore,
  tokenize,
  chunkText
};
