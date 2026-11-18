/* kind: mem - GPU warp / memory behaviour.   scene.mode selects the model:

   'coalesce'  a warp's 32 loads against 128-byte cache lines.   step: stride:s   (thread i reads word i*s)
   'banks'     a warp's 32 shared-memory accesses against 32 banks.  step: stride:s, pass:p (which serialized pass is running)
   'diverge'   branch divergence inside a warp.   step: pattern:'evenodd'|'warp', pass:0|1|2
   'matrix'    2-D copy: which matrix elements one warp touches.  step: layout:'col'|'row'  (threadIdx.x walks columns / rows)

   All steps may carry `note` (a short readout under the picture).                                             */
(function () {
  'use strict';
  const PDC = window.PDC, esc = PDC.esc;
  const hue = function (i, n) { return 'hsl(' + Math.round(i * 300 / Math.max(1, n)) + ',68%,55%)'; };

  /* ---------------- coalesce ---------------- */
  function coalesce(s, scene) {
    const stride = s.stride || 1, W = 700, lanes = 32, cwid = 19;
    const lineCount = Math.min(32, stride >= 32 ? 32 : Math.ceil(lanes * stride / 32));
    const cell = 17, gx = 52, top = 90, rowH = 8;
    let h = '';
    h += '<text class="rl" x="4" y="14">warp: 32 threads execute the load together</text>';
    for (let i = 0; i < lanes; i++) h += '<g class="ln-t"><rect x="' + (gx + i * (cwid + 1)) + '" y="22" width="' + cwid + '" height="20" rx="4" style="fill:' + hue(i, lanes) + '"/><text x="' + (gx + i * (cwid + 1) + cwid / 2) + '" y="36" text-anchor="middle">' + i + '</text></g>';
    h += '<text class="rl" x="4" y="' + (top - 8) + '">memory: each row = one 128-byte cache line (32 words)</text>';
    const rows = Math.max(1, lineCount);
    const touched = {}, sectors = {};
    for (let i = 0; i < lanes; i++) { const w = i * stride, r = Math.floor(w / 32), c = w % 32; touched[r + ',' + c] = i; sectors[r + ',' + Math.floor(c / 8)] = true; }
    const showRows = Math.min(rows, 32);
    for (let r = 0; r < showRows; r++) {
      h += '<text class="ri" x="' + (gx - 6) + '" y="' + (top + r * (rowH + 2) + rowH - 1) + '" text-anchor="end">' + (showRows <= 8 ? 'line ' + r : (r % 4 === 0 ? r : '')) + '</text>';
      for (let c = 0; c < 32; c++) {
        const k = r + ',' + c, who = touched[k];
        h += '<rect class="mw' + (who != null ? ' hit' : '') + (c % 8 === 7 ? ' sec' : '') + '" x="' + (gx + c * (cwid + 1)) + '" y="' + (top + r * (rowH + 2)) + '" width="' + cwid + '" height="' + rowH + '" ' + (who != null ? 'style="fill:' + hue(who, lanes) + '"' : '') + '/>';
      }
    }
    const nSec = Object.keys(sectors).length, nLines = Object.keys(sectors).reduce(function (m, k) { m[k.split(',')[0]] = 1; return m; }, {});
    const H = top + showRows * (rowH + 2) + 10;
    return { svg: h, W: W, H: H, readout: '<b>' + Object.keys(nLines).length + '</b> cache line' + (Object.keys(nLines).length > 1 ? 's' : '') + ' &middot; <b>' + nSec + '</b> sectors per request &middot; ' +
      (nSec <= 4 ? '<span class="good">coalesced: one wide transaction serves the whole warp</span>' : '<span class="bad">strided: ' + nSec + ' separate memory transactions for one load</span>') };
  }

  /* ---------------- banks ---------------- */
  function banks(s) {
    const stride = s.stride || 1, lanes = 32, cwid = 19, gx = 40, W = 700;
    const q = []; for (let b = 0; b < 32; b++) q.push([]);
    for (let i = 0; i < lanes; i++) q[(i * stride) % 32].push(i);
    const deg = q.reduce(function (m, a) { return Math.max(m, a.length); }, 0);
    const pass = s.pass != null ? s.pass : -1;
    const rh = deg > 10 ? 9 : 17;          // shrink rows when a bank holds a tall queue
    let h = '<text class="rl" x="4" y="14">32 banks (a word at address a lives in bank a mod 32)</text>';
    const top = 28;
    for (let b = 0; b < 32; b++) {
      h += '<rect class="bank" x="' + (gx + b * (cwid + 1)) + '" y="' + top + '" width="' + cwid + '" height="' + (20 + deg * rh) + '" rx="3"/>';
      h += '<text class="ri" x="' + (gx + b * (cwid + 1) + cwid / 2) + '" y="' + (top + 14) + '" text-anchor="middle">' + b + '</text>';
      q[b].forEach(function (lane, d) {
        const st = pass < 0 ? 'wait0' : (d < pass ? 'served' : (d === pass ? 'now' : 'wait'));
        h += '<g class="bk ' + st + '"><rect x="' + (gx + b * (cwid + 1) + 1) + '" y="' + (top + 20 + d * rh) + '" width="' + (cwid - 2) + '" height="' + (rh - 2) + '" rx="2" style="fill:' + hue(lane, lanes) + '"/>' +
          (rh > 12 ? '<text x="' + (gx + b * (cwid + 1) + cwid / 2) + '" y="' + (top + 31 + d * rh) + '" text-anchor="middle">' + lane + '</text>' : '') + '</g>';
      });
    }
    h += '<text class="rl" x="4" y="' + (top + 20 + deg * rh + 22) + '">stack height = number of threads that want the same bank = serialized passes' + (rh <= 12 ? ' (one thin slice per thread)' : '') + '</text>';
    return { svg: h, W: W, H: top + 20 + deg * rh + 32,
      readout: '<b>' + deg + '</b> memory pass' + (deg > 1 ? 'es' : '') + ' needed &middot; ' + (deg === 1 ? '<span class="good">no bank conflict</span>' : '<span class="bad">' + deg + '-way bank conflict &mdash; the warp is ' + deg + '&times; slower on this access</span>') +
        (pass >= 0 ? ' &middot; serving pass ' + (pass + 1) + ' of ' + deg : '') };
  }

  /* ---------------- diverge ---------------- */
  function diverge(s) {
    const pattern = s.pattern || 'evenodd', pass = s.pass != null ? s.pass : -1, W = 740, cwid = 19, gx = 70;
    const warps = pattern === 'warp' ? 2 : 1;
    let h = '', y = 22;
    const colorA = 'var(--c0)', colorB = 'var(--c1)';
    h += '<text class="rl" x="4" y="14">' + (pattern === 'warp' ? 'if (warpId % 2 == 0) pathA else pathB' : 'if (idx % 2 == 0) pathA else pathB') + '</text>';
    for (let w = 0; w < warps; w++) {
      h += '<text class="rl" x="4" y="' + (y + 15) + '">warp ' + w + '</text>';
      for (let i = 0; i < 32; i++) {
        const isA = pattern === 'warp' ? (w % 2 === 0) : (i % 2 === 0);
        let state = 'idle';
        if (pattern === 'warp') state = pass >= 0 ? 'on' : 'idle';
        else if (pass === 0) state = isA ? 'on' : 'mask';
        else if (pass === 1) state = isA ? 'mask' : 'on';
        h += '<g class="lane ' + state + '"><rect x="' + (gx + i * (cwid + 1)) + '" y="' + y + '" width="' + cwid + '" height="22" rx="4" style="' + (state === 'mask' ? '' : 'fill:' + (isA ? colorA : colorB)) + '"/><text x="' + (gx + i * (cwid + 1) + cwid / 2) + '" y="' + (y + 15) + '" text-anchor="middle">' + i + '</text></g>';
      }
      y += 34;
    }
    /* timeline of passes */
    y += 8;
    h += '<text class="rl" x="4" y="' + (y + 12) + '">time</text>';
    const bw = 200, bx = gx;
    if (pattern === 'warp') {
      h += '<rect class="pbar a' + (pass >= 0 ? ' now' : '') + '" x="' + bx + '" y="' + y + '" width="' + bw + '" height="20" rx="4"/><text class="pt" x="' + (bx + bw / 2) + '" y="' + (y + 14) + '" text-anchor="middle">warp 0: path A (32 active)</text>';
      h += '<rect class="pbar b' + (pass >= 0 ? ' now' : '') + '" x="' + bx + '" y="' + (y + 24) + '" width="' + bw + '" height="20" rx="4"/><text class="pt" x="' + (bx + bw / 2) + '" y="' + (y + 38) + '" text-anchor="middle">warp 1: path B (32 active)</text>';
      h += '<text class="rl" x="' + (bx + bw + 10) + '" y="' + (y + 27) + '">both finish after 1 unit</text>';
      y += 48;
    } else {
      h += '<rect class="pbar a' + (pass === 0 ? ' now' : '') + '" x="' + bx + '" y="' + y + '" width="' + bw + '" height="20" rx="4"/><text class="pt" x="' + (bx + bw / 2) + '" y="' + (y + 14) + '" text-anchor="middle">pass 1: path A (16 active)</text>';
      h += '<rect class="pbar b' + (pass === 1 ? ' now' : '') + '" x="' + (bx + bw + 4) + '" y="' + y + '" width="' + bw + '" height="20" rx="4"/><text class="pt" x="' + (bx + bw + 4 + bw / 2) + '" y="' + (y + 14) + '" text-anchor="middle">pass 2: path B (16 active)</text>';
      h += '<text class="rl" x="' + (bx + 2 * bw + 14) + '" y="' + (y + 14) + '">2 units</text>';
      y += 28;
    }
    return { svg: h, W: W, H: y + 6,
      readout: pattern === 'warp' ? 'average active threads per warp: <b>32</b> <span class="good">(no divergence)</span>' : 'average active threads per warp: <b>16</b> <span class="bad">(half the lanes idle on each pass)</span>' };
  }

  /* ---------------- matrix (2-D copy) ---------------- */
  function matrix(s, scene) {
    const n = scene.n || 8, layout = s.layout || 'col', cs = 30, gx = 40, top = 30;
    const warp = scene.warp || 8;
    let h = '<text class="rl" x="4" y="16">matrix in memory is row-major: element (r,c) is word r*n + c</text>';
    const touched = {};
    for (let t = 0; t < warp; t++) {
      const r = layout === 'col' ? 0 : t, c = layout === 'col' ? t : 0;
      touched[r + ',' + c] = t;
    }
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const who = touched[r + ',' + c];
      h += '<g class="mx"><rect class="' + (who != null ? 'hit' : '') + '" x="' + (gx + c * (cs + 2)) + '" y="' + (top + r * (cs + 2)) + '" width="' + cs + '" height="' + cs + '" rx="4" ' + (who != null ? 'style="fill:' + hue(who, warp) + '"' : '') + '/>' +
        '<text x="' + (gx + c * (cs + 2) + cs / 2) + '" y="' + (top + r * (cs + 2) + cs / 2 + 4) + '" text-anchor="middle">' + (who != null ? 't' + who : r * n + c) + '</text></g>';
    }
    const mx = gx + n * (cs + 2) + 40;
    h += '<text class="rl" x="' + mx + '" y="' + (top + 8) + '">cache lines (' + n + ' words each) the warp touches:</text>';
    const lines = {};
    Object.keys(touched).forEach(function (k) { const p = k.split(','); lines[+p[0]] = true; });
    const nl = Object.keys(lines).length;
    for (let r = 0; r < n; r++) {
      h += '<rect class="line' + (lines[r] ? ' hit' : '') + '" x="' + mx + '" y="' + (top + 18 + r * 14) + '" width="' + (n * 14) + '" height="11" rx="3"/>';
    }
    h += '<text class="rl" x="' + mx + '" y="' + (top + 18 + n * 14 + 16) + '">' + nl + ' of ' + n + ' lines fetched</text>';
    return { svg: h, W: 700, H: top + n * (cs + 2) + 10,
      readout: (layout === 'col' ? 'threadIdx.x &rarr; <b>column</b>: the warp reads one contiguous row segment &mdash; <span class="good">1 cache line</span>'
                                 : 'threadIdx.x &rarr; <b>row</b>: neighbouring threads are n words apart &mdash; <span class="bad">' + nl + ' cache lines for one warp</span>') };
  }

  PDC.kinds.mem = {
    create: function (host, scene, steps) {
      const fn = { coalesce: coalesce, banks: banks, diverge: diverge, matrix: matrix }[scene.mode];
      function render(i) {
        const s = steps[i], r = fn(s, scene);
        host.innerHTML = '<div class="mem"><svg viewBox="0 0 ' + r.W + ' ' + r.H + '" role="img">' + r.svg + '</svg><div class="readout">' + r.readout + (s.note ? '<div class="mm-note">' + s.note + '</div>' : '') + '</div></div>';
      }
      return { render: render };
    }
  };
})();
