#!/usr/bin/env node
/* Lists teaching source files in the repository that no animated example links to.
   Usage:  node tools/coverage.js */
const path = require('path');
const root = path.resolve(__dirname, '..', 'js');
global.window = global; global.document = {}; global.navigator = {};
['util.js', 'highlight.js', 'codeview.js', 'sources-data.js']
  .concat(['diagram', 'lanes', 'iters', 'cudagrid', 'matmul', 'reduce', 'mem', 'gantt', 'trace', 'conv'].map(function (k) { return 'kinds/' + k + '.js'; }))
  .concat(['_courses', 'pthreads', 'openmp', 'openmp_offload', 'mpi', 'cuda_basics', 'cuda_matmul', 'cuda_advanced', 'debugging', 'dnn', 'hpml_cuda', 'hpml_ml'].map(function (k) { return 'examples/' + k + '.js'; }))
  .forEach(function (f) { require(path.join(root, f)); });

const linked = new Set();
PDC.examples.forEach(function (e) { e.files.forEach(function (f) { linked.add(f); }); });
const code = Object.keys(PDC_SOURCES).filter(function (p) { return /\.(c|cu|py|sh|job|ipynb)$/.test(p) || /(Makefile|makefile)$/.test(p) || /(README|faq)\.txt$/.test(p) || /commandsForArc\.txt$/.test(p) || /simpleMultiGPU\.h$/.test(p); });
const missing = code.filter(function (p) { return !linked.has(p); });
console.log('examples:', PDC.examples.length, ' linked source files:', linked.size, ' bundled code files:', code.length);
if (missing.length) { console.log('\nNot linked from any example:'); missing.forEach(function (m) { console.log('  ' + m); }); }
else console.log('every bundled source file is linked from at least one example');
