#!/usr/bin/env node
/* End-to-end test: loads tools/e2e.html in headless Chrome and drives the real application.
   Usage:  node tools/e2e.js */
const { execFileSync } = require('child_process');
const path = require('path');
const url = 'file://' + path.resolve(__dirname, 'e2e.html');
let out = null, lastErr;
for (const b of ['google-chrome', 'chromium', 'chromium-browser']) {
  try {
    out = execFileSync(b, ['--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files', '--virtual-time-budget=30000', '--dump-dom', url],
      { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
    break;
  } catch (e) { lastErr = e; }
}
if (out === null) { console.error('could not run a headless browser:', lastErr && lastErr.message); process.exit(2); }
const m = out.match(/E2EJSON:([\s\S]*?):END/);
if (!m) { console.error('no report found'); console.error(out.slice(0, 500)); process.exit(2); }
const res = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
let failed = 0;
res.forEach(function (r) { if (!r.pass) failed++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (r.info && !r.pass ? '   [' + r.info + ']' : '')); });
console.log('\n' + (res.length - failed) + '/' + res.length + ' checks passed');
process.exit(failed ? 1 : 0);
