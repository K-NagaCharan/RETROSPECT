const fs = require('fs');
const filePath = 'scripts/trace_engineering_diagnostic.js';
let content = fs.readFileSync(filePath, 'utf8');

const target = `    target: {
      file_path: 'core/src/main/java/io/undertow/websockets/core/WebSocket07FrameSinkChannel.java',
      symbol_name: 'WebSocket07FrameSinkChannel.sendInternal',
      short_name: 'sendInternal'
    }`;

const replacement = `    target: {
      file_path: 'core/src/main/java/io/undertow/websockets/core/protocol/version07/WebSocket07FrameSinkChannel.java',
      symbol_name: 'WebSocket07FrameSinkChannel.sendInternal',
      short_name: 'sendInternal'
    }`;

if (!content.includes(target)) {
  console.error('Target not found in trace_engineering_diagnostic.js');
  process.exit(1);
}

content = content.replace(target, replacement);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully aligned DIAG-07 target path in trace_engineering_diagnostic.js');
