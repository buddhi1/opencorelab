/* kind: matmul - A x B = C as three grids, with ownership colouring, an animated dot-product sweep,
   shared-memory tiles and a linear memory strip.

   scene = { n:8, tile:4 (draw tile borders), own:'none'|'tile'|'row'|'gpu'|'regs'|'col', T:threads (row mode), G:gpus, outs:2, cval:'8' }
   cell specs:  [r,c] | {row:r} | {col:c} | {rect:[r0,c0,r1,c1]} | 'all' | {rows:[r0,r1]}
   step ops:
     A:{hl,hl2}  B:{hl,hl2}  C:{hl,hl2,done,val:{'r,c':'text'}}     highlight / done sets (cell specs)
     own:'...'            override the ownership colouring for this step
     eq:'html'            equation strip above the matrices
     sweep:{a:[[r,k]..], b:[[k,c]..], out:[r,c], label:'k'}   animates a dot product (one pair every ~300 ms)
     sh:{title, A:{label,hl}, B:{label,hl}, size:t}    shared-memory tiles As / Bs (t x t boxes)
     mem:{title, len, hl:[i..], hl2:[i..], note}   linear memory strip (row-major order)                */
(function () {
  'use strict';
  const PDC = window.PDC, esc = PDC.esc;

  function expand(spec, n) {
    const out = [];
    if (!spec) return out;
    const list = Array.isArray(spec) && Array.isArray(spec[0]) ? spec : (Array.isArray(spec) && typeof spec[0] === 'object' ? spec : [spec]);
    list.forEach(function (sp) {
      if (sp === 'all') { for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) out.push([r, c]); }
      else if (Array.isArray(sp)) out.push(sp);
      else if (sp.row != null) for (let c = 0; c < n; c++) out.push([sp.row, c]);
      else if (sp.col != null) for (let r = 0; r < n; r++) out.push([r, sp.col]);
      else if (sp.rows) for (let r = sp.rows[0]; r <= sp.rows[1]; r++) for (let c = 0; c < n; c++) out.push([r, c]);
      else if (sp.rect) for (let r = sp.rect[0]; r <= sp.rect[2]; r++) for (let c = sp.rect[1]; c <= sp.rect[3]; c++) out.push([r, c]);
    });
    return out;
  }
  function keyset(spec, n) { const s = {}; expand(spec, n).forEach(function (p) { s[p[0] + ',' + p[1]] = true; }); return s; }

  PDC.kinds.matmul = {
    expand: expand,
    create: function (host, scene, steps) {
      const n = scene.n || 8, tile = scene.tile || 0;
      const cs = PDC.clamp(Math.floor(140 / n), 12, 26);
      let timer = null;

      function ownColor(mode, r, c) {
        const sc = scene;
        switch (mode) {
          case 'tile': { const t = sc.tile || 4, gn = Math.ceil(n / t); return PDC.col(Math.floor(r / t) * gn + Math.floor(c / t)); }
          case 'row': return PDC.col(r % (sc.T || 4));
          case 'col': return PDC.col(c % (sc.T || 4));
          case 'gpu': return PDC.col(Math.floor(r / (n / (sc.G || 2))));
          case 'regs': { const t = sc.tile || 2; return PDC.col((r % t) * t + (c % t)); }
          default: return '';
        }
      }

      function gridHtml(name, set, ownMode, extraSets) {
        let h = '<div class="mm-m ' + name + '"><div class="mm-t">' + name + '</div><div class="mm-grid" style="--cs:' + cs + 'px;grid-template-columns:repeat(' + n + ',var(--cs))">';
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
          const k = r + ',' + c;
          let cls = 'mc';
          if (ownMode) cls += ' ' + ownColor(ownMode, r, c) + ' ow';
          if (tile && ((c + 1) % tile === 0) && c < n - 1) cls += ' tr';
          if (tile && ((r + 1) % tile === 0) && r < n - 1) cls += ' tb';
          if (set.done && set.done[k]) cls += ' dn';
          if (set.hl && set.hl[k]) cls += ' h1';
          if (set.hl2 && set.hl2[k]) cls += ' h2';
          const v = set.val && set.val[k] != null ? set.val[k] : (set.done && set.done[k] && scene.cval != null && name === 'C' ? scene.cval : '');
          h += '<i class="' + cls + '" data-r="' + r + '" data-c="' + c + '">' + esc(v) + '</i>';
        }
        return h + '</div></div>';
      }

      function render(i) {
        clearInterval(timer);
        const s = steps[i];
        const own = s.own != null ? s.own : scene.own;
        const mk = function (o) { o = o || {}; return { hl: keyset(o.hl, n), hl2: keyset(o.hl2, n), done: keyset(o.done, n), val: o.val }; };
        const A = mk(s.A), B = mk(s.B), C = mk(s.C);
        /* accumulate "done" cells over earlier steps unless the step says otherwise */
        if (!s.C || s.C.done == null) {
          for (let j = i - 1; j >= 0; j--) { if (steps[j].C && steps[j].C.done != null) { C.done = keyset(steps[j].C.done, n); break; } }
        }
        let h = '<div class="mm">';
        h += '<div class="mm-eq">' + (s.eq || '&nbsp;') + '</div>';
        h += '<div class="mm-mats">' + gridHtml('A', A, own && (own === 'row' || own === 'gpu') ? own : '') + '<span class="op">&times;</span>' +
          gridHtml('B', B, own === 'col' ? own : '') + '<span class="op">=</span>' + gridHtml('C', C, own) + '</div>';

        if (s.sh) {
          const t = s.sh.size || tile || 4;
          const box = function (nm, o) {
            o = o || {};
            const hl = keyset(o.hl, t);
            let b = '<div class="mm-sbox"><div class="mm-t">' + nm + '<small>' + esc(o.label || '') + '</small></div><div class="mm-grid" style="--cs:' + Math.max(16, cs - 4) + 'px;grid-template-columns:repeat(' + t + ',var(--cs))">';
            for (let r = 0; r < t; r++) for (let c = 0; c < t; c++) b += '<i class="mc sh' + (hl[r + ',' + c] ? ' h1' : '') + (o.filled === false ? ' empty' : '') + '"></i>';
            return b + '</div></div>';
          };
          h += '<div class="mm-sh"><div class="mm-shl">' + esc(s.sh.title || 'Shared memory (one copy per block)') + '</div><div class="mm-shb">' + box('As', s.sh.A) + box('Bs', s.sh.B) + '</div></div>';
        }
        if (s.mem) {
          const len = s.mem.len || n * n, hl = {}, hl2 = {};
          (s.mem.hl || []).forEach(function (x) { hl[x] = true; }); (s.mem.hl2 || []).forEach(function (x) { hl2[x] = true; });
          h += '<div class="mm-mem"><div class="mm-shl">' + esc(s.mem.title || 'Memory (row-major)') + '</div><div class="strip">';
          for (let q = 0; q < len; q++) h += '<i class="' + (hl[q] ? 'h1' : hl2[q] ? 'h2' : '') + '">' + (len <= 36 || hl[q] || hl2[q] ? q : '') + '</i>';
          h += '</div>' + (s.mem.note ? '<div class="mm-note">' + s.mem.note + '</div>' : '') + '</div>';
        }
        h += '</div>';
        host.innerHTML = h;

        if (s.sweep) {
          const sw = s.sweep, len = sw.a.length;
          let k = 0;
          const q = function (r, c) { return host.querySelector('.mm-m.A .mc[data-r="' + r + '"][data-c="' + c + '"]'); };
          const qb = function (r, c) { return host.querySelector('.mm-m.B .mc[data-r="' + r + '"][data-c="' + c + '"]'); };
          const qc = host.querySelector('.mm-m.C .mc[data-r="' + sw.out[0] + '"][data-c="' + sw.out[1] + '"]');
          const eq = host.querySelector('.mm-eq');
          const tick = function () {
            host.querySelectorAll('.mc.sw').forEach(function (e) { e.classList.remove('sw'); });
            const a = q(sw.a[k][0], sw.a[k][1]), b = qb(sw.b[k][0], sw.b[k][1]);
            if (a) a.classList.add('sw'); if (b) b.classList.add('sw');
            if (qc) qc.classList.add('h1');
            if (eq && !s.eq) eq.textContent = (sw.label || 'k') + ' = ' + k + '   (' + (k + 1) + ' of ' + len + ' products added)';
            k++;
            if (k >= len) { clearInterval(timer); }
          };
          tick();
          if (len > 1 && !PDC.reducedMotion) timer = setInterval(tick, sw.ms || 320); else { k = len - 1; tick(); }
        }
      }
      return { render: render, destroy: function () { clearInterval(timer); } };
    }
  };

  /* helpers for building sweeps */
  PDC.MM = {
    rowcol: function (n, r, c) {
      const a = [], b = [];
      for (let k = 0; k < n; k++) { a.push([r, k]); b.push([k, c]); }
      return { a: a, b: b, out: [r, c] };
    },
    tiled: function (n, tile, bi, bj, t) {      /* partial products of one k-tile for block (bi,bj), thread (tile-1,tile-1)... */
      const a = [], b = [], r = bi * tile + (tile - 1), c = bj * tile + (tile - 1);
      for (let k = 0; k < tile; k++) { a.push([r, t * tile + k]); b.push([t * tile + k, c]); }
      return { a: a, b: b, out: [r, c], label: 'k' };
    }
  };
})();
