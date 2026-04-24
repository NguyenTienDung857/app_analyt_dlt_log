const fs = require('node:fs/promises');
const path = require('node:path');

async function writeExportFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

module.exports = {
  writeExportFile
};
