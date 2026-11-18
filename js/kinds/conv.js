/* kind: conv - a filter sliding over an image (convolution, padding, stride, max-pooling).

   scene = { img:[[..],[..]] (rows of numbers), kernel:[[..]] | null (pooling), k:3 (window size), stride:1, pad:0, mode:'conv'|'pool', relu:false }
   step ops:  p: n   output position (row-major) the window is currently on; every earlier position is already computed
              all:true  show the complete output                                                                    */
(function () {
  'use strict';
  const PDC = window.PDC, esc = PDC.esc;

  PDC.kinds.conv = {
    create: function (host, scene, steps) {
      const k = scene.k || 3, stride = scene.stride || 1, pad = scene.pad || 0, pool = scene.mode === 'pool';
      const H = scene.img.length, W = scene.img[0].length;
      const padded = [];
      for (let r = 0; r < H + 2 * pad; r++) {
        padded.push([]);
        for (let c = 0; c < W + 2 * pad; c++) {
          const rr = r - pad, cc = c - pad;
          padded[r].push(rr >= 0 && rr < H && cc >= 0 && cc < W ? scene.img[rr][cc] : 0);
        }
      }
      const oh = Math.floor((H + 2 * pad - k) / stride) + 1, ow = Math.floor((W + 2 * pad - k) / stride) + 1;
      const compute = function (p) {
        const orow = Math.floor(p / ow), ocol = p % ow, r0 = orow * stride, c0 = ocol * stride;
        let sum = pool ? -Infinity : 0; const terms = [];
        for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) {
          const x = padded[r0 + a][c0 + b];
          if (pool) sum = Math.max(sum, x); else { const w = scene.kernel[a][b]; sum += x * w; terms.push(x + '×' + (w < 0 ? '(' + w + ')' : w)); }
        }
        if (scene.relu && sum < 0) sum = 0;
        return { v: sum, r0: r0, c0: c0, terms: terms };
      };

      function render(i) {
        const s = steps[i];
        const p = s.all ? oh * ow - 1 : (s.p != null ? s.p : -1);
        const cur = p >= 0 && !s.all ? compute(p) : null;
        const cs = PDC.clamp(Math.floor(170 / Math.max(padded.length, padded[0].length)), 18, 34);
        let img = '<div class="cv-m"><div class="mm-t">input' + (pad ? ' (zero padding ' + pad + ')' : '') + '</div><div class="mm-grid" style="--cs:' + cs + 'px;grid-template-columns:repeat(' + padded[0].length + ',var(--cs))">';
        for (let r = 0; r < padded.length; r++) for (let c = 0; c < padded[0].length; c++) {
          const inWin = cur && r >= cur.r0 && r < cur.r0 + k && c >= cur.c0 && c < cur.c0 + k;
          const isPad = r < pad || c < pad || r >= H + pad || c >= W + pad;
          img += '<i class="mc' + (inWin ? ' h1' : '') + (isPad ? ' padc' : '') + '">' + padded[r][c] + '</i>';
        }
        img += '</div></div>';
        let ker = '';
        if (!pool) {
          ker = '<div class="cv-m"><div class="mm-t">filter ' + k + '&times;' + k + '</div><div class="mm-grid" style="--cs:' + cs + 'px;grid-template-columns:repeat(' + k + ',var(--cs))">' +
            scene.kernel.map(function (row) { return row.map(function (w) { return '<i class="mc h2">' + w + '</i>'; }).join(''); }).join('') + '</div></div>';
        } else {
          ker = '<div class="cv-m"><div class="mm-t">window ' + k + '&times;' + k + '</div><div class="mm-grid" style="--cs:' + cs + 'px;grid-template-columns:repeat(' + k + ',var(--cs))">' +
            Array.from({ length: k * k }, function () { return '<i class="mc h2">max</i>'; }).join('') + '</div></div>';
        }
        let out = '<div class="cv-m"><div class="mm-t">' + (pool ? 'pooled' : 'feature map') + ' ' + oh + '&times;' + ow + '</div><div class="mm-grid" style="--cs:' + cs + 'px;grid-template-columns:repeat(' + ow + ',var(--cs))">';
        for (let q = 0; q < oh * ow; q++) {
          const done = q <= p;
          out += '<i class="mc' + (q === p && !s.all ? ' h1' : '') + (done ? ' dn' : ' empty') + '">' + (done ? compute(q).v : '') + '</i>';
        }
        out += '</div></div>';
        const eq = cur ? (pool ? 'max of the ' + k * k + ' values in the window = <b>' + cur.v + '</b>' : cur.terms.join(' + ') + ' = <b>' + cur.v + '</b>') : '&nbsp;';
        host.innerHTML = '<div class="mm cvw"><div class="mm-eq small">' + eq + '</div><div class="mm-mats">' + img + (pool ? '' : '<span class="op">&lowast;</span>') + ker + '<span class="op">&rarr;</span>' + out + '</div></div>';
      }
      return { render: render };
    }
  };
})();
