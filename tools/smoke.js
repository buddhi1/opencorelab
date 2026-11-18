#!/usr/bin/env node
/* Headless-Chrome smoke test: renders every step of every example and checks every code-highlight pattern.
   Usage:  node tools/smoke.js            (needs google-chrome / chromium on PATH) */
const { execFileSync } = require('child_process');
const path = require('path');
const url = 'file://' + path.resolve(__dirname, 'smoke.html');
const bins = ['google-chrome', 'chromium', 'chromium-browser'];
let out = null, lastErr;
for (const b of bins) {
  try {
    out = execFileSync(b, ['--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files', '--virtual-time-budget=20000', '--dump-dom', url],
      { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
    break;
  } catch (e) { lastErr = e; }
}
if (out === null) { console.error('could not run a headless browser:', lastErr && lastErr.message); process.exit(2); }
const m = out.match(/SMOKE_JSON:([\s\S]*?):END/);
if (!m) { console.error('no report found in page output'); console.error(out.slice(0, 600)); process.exit(2); }
const rep = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
console.log('examples:', rep.examples, ' steps:', rep.steps, ' problems in', rep.problems.length, 'examples');
rep.problems.forEach(function (p) { console.log('\n' + p.ex); p.errs.forEach(function (e) { console.log('   - ' + e); }); });
const uniq = Array.from(new Set(rep.warn || []));
if (uniq.length) { console.log('\nLayout warnings (' + uniq.length + '):'); uniq.slice(0, +process.env.WARN_MAX || 60).forEach(function (w) { console.log('   ~ ' + w); }); }
process.exit(rep.problems.length ? 1 : 0);
