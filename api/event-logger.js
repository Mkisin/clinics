const fs = require('node:fs');
const path = require('node:path');

function createEventLogger(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const stream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf8', mode: 0o600 });
  stream.on('error', error => {
    console.error(JSON.stringify({
      event: 'registration_log_error',
      errorName: typeof error?.name === 'string' ? error.name : 'Error',
      errorCode: typeof error?.code === 'string' ? error.code : null,
    }));
  });
  const write = value => stream.write(value + '\n');
  return { info: write, error: write, close: () => new Promise(resolve => stream.end(resolve)) };
}

module.exports = { createEventLogger };
