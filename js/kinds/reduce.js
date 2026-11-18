/* kind: reduce - parallel reductions (grid-stride accumulation, shared-memory tree, atomics, per-block partials).

   scene = { T: 8 threads, data:[..N numbers] (optional; thread t accumulates data[t], data[t+T], ...),
             values:[..T] (per-thread values when there is no data array), group: g (tree runs inside groups of g threads),
             name:'cache' (label of the shared array) }
   step ops (view is sticky):
     view:'data' + acc:m       m rounds of the grid-stride loop done:  tid += blockDim.x * gridDim.x
     view:'cache'              the shared array right after the per-thread values are stored
     view:'tree' + stride:S    one tree step: cache[j] += cache[j+S] for j < S (arrows from the "before" row to the "after" row)
     view:'atomic' + done:k    k threads have executed atomicAdd on the same address; the rest wait their turn
     view:'blocks' + partials:[..] + final:v   one partial result per block, then the CPU (or a second kernel) adds them
     rebase:{values, group}    restart the shared array with new values and/or a new group size
     out:true                  thread 0 writes the block result to global memory                                  */
(function () {
  'use strict';
  const PDC = window.PDC, esc = PDC.esc;

  PDC.kinds.reduce = {
    create: function (host, scene, steps) {
      const T = scene.T, nm = scene.name || 'cache';
      const data = scene.data || null;
      /* `rebase:{values, group}` on a step restarts the shared array with new values / group size (e.g. block-wide then tile-wise reductions) */
      function ctx(i) {
        let values = null, grp = scene.group || T, from = 0;
        for (let j = 0; j <= i; j++) if (steps[j].rebase) { values = steps[j].rebase.values.slice(); grp = steps[j].rebase.group || T; from = j; }
        return { values: values, group: grp, from: from };
      }

      function partials(m) {
        const p = new Array(T).fill(0);
        if (!data) return (scene.values || p).slice();
        for (let r = 0; r < m; r++) for (let t = 0; t < T; t++) { const q = r * T + t; if (q < data.length) p[t] += data[q]; }
        return p;
      }
      const base = function () { return data ? partials(Math.ceil(data.length / T)) : (scene.values || new Array(T).fill(0)).slice(); };

      /* state of the shared array after applying every `stride` step up to and including i */
      function treeState(i) {
        const cx = ctx(i), group = cx.group;
        let v = cx.values || base(), before = v.slice(), last = null;
        for (let j = cx.from; j <= i; j++) {
          if (steps[j].view === 'tree' || (steps[j].view == null && steps[j].stride != null)) {
            if (steps[j].stride != null) {
              before = v.slice();
              const S = steps[j].stride, nv = v.slice();
              for (let g0 = 0; g0 < T; g0 += group) for (let q = 0; q < S; q++) nv[g0 + q] = v[g0 + q] + v[g0 + q + S];
              v = nv; last = steps[j].stride;
            }
          }
        }
        return { v: v, before: before, S: last };
      }

      function render(i) {
        const s = steps[i], group = ctx(i).group;
        let view = null;
        for (let j = i; j >= 0; j--) if (steps[j].view) { view = steps[j].view; break; }
        if (!view) view = 'cache';
        const cw = PDC.clamp(Math.floor(640 / Math.max(T, 1)), 26, 54), gap = 4, pad = 52;
        const W = pad + T * (cw + gap) + 12;
        let svg = '', H = 150;

        const cell = function (x, y, v, cls, idx, h) {
          h = h || 34;
          return '<g class="rc ' + (cls || '') + '"><rect x="' + x + '" y="' + y + '" width="' + cw + '" height="' + h + '" rx="6"/><text x="' + (x + cw / 2) + '" y="' + (y + h / 2 + 5) + '" text-anchor="middle">' + esc(v) + '</text></g>' +
            (idx != null ? '<text class="ri" x="' + (x + cw / 2) + '" y="' + (y + h + 14) + '" text-anchor="middle">' + idx + '</text>' : '');
        };
        const cx = function (j) { return pad + j * (cw + gap); };

        if (view === 'data' && data) {
          const m = s.acc != null ? s.acc : 0;
          const N = data.length, perRow = T, rows = Math.ceil(N / perRow);
          H = 30 + rows * 40 + 100;
          svg += '<text class="rl" x="4" y="22">data[ ]</text>';
          for (let q = 0; q < N; q++) {
            const r = Math.floor(q / perRow), t = q % perRow, taken = q < m * T;
            svg += cell(cx(t), 30 + r * 40, data[q], PDC.col(t) + (taken ? ' taken' : '') + (q >= (m - 1) * T && q < m * T ? ' now' : ''), null, 30);
          }
          const yP = 30 + rows * 40 + 18;
          svg += '<text class="rl" x="4" y="' + (yP - 6) + '">temp (each thread keeps a running sum in a register)</text>';
          const p = partials(m);
          for (let t = 0; t < T; t++) svg += cell(cx(t), yP, p[t], PDC.col(t) + (m === 0 ? ' dim' : ''), 'thread ' + t, 34);
        } else if (view === 'tree') {
          const st = treeState(i), S = s.stride != null ? s.stride : st.S;
          H = 190;
          svg += '<text class="rl" x="4" y="18">before</text><text class="rl" x="4" y="148">after</text>';
          for (let j = 0; j < T; j++) svg += cell(cx(j), 26, st.before[j], 'faint', null);
          for (let g0 = 0; g0 < T; g0 += group) for (let q = 0; q < S; q++) {
            const a = cx(g0 + q + S) + cw / 2, b = cx(g0 + q) + cw / 2;
            svg += '<path class="arr" d="M' + a + ' 62 C ' + a + ' 100, ' + b + ' 90, ' + b + ' 130" marker-end="url(#rd-ah)"/>';
          }
          for (let j = 0; j < T; j++) {
            const inGroup = j % group, active = inGroup < S;
            svg += cell(cx(j), 134, st.v[j], active ? 'act ' + (j === 0 || inGroup === 0 ? 'zero' : '') : 'idle', 'tid ' + j);
          }
          if (group < T) for (let g0 = 0; g0 < T; g0 += group)
            svg += '<path class="grp" d="M' + (cx(g0) - 1) + ' 186 v6 h' + (group * (cw + gap) - gap + 2) + ' v-6"/>';
          svg += '<text class="rl note" x="' + (W / 2) + '" y="12" text-anchor="middle">stride = ' + S + ': threads 0&hellip;' + (S - 1) + ' add the value ' + S + ' places to their right</text>';
        } else if (view === 'atomic') {
          const k = s.done != null ? s.done : 0, vals = base();
          H = 200;
          let total = 0; for (let t = 0; t < k; t++) total += vals[t];
          svg += '<text class="rl" x="4" y="18">threads (each holds its partial sum)</text>';
          for (let t = 0; t < T; t++) {
            const state = t < k ? 'taken' : (t === k ? 'now' : 'wait');
            svg += cell(cx(t), 28, vals[t], PDC.col(t) + ' ' + state, 'thread ' + t);
          }
          const gx = W / 2 - 60;
          svg += '<text class="rl" x="4" y="112">one address in global memory</text>';
          svg += '<g class="rc big ' + (k < T ? 'hot' : 'good') + '"><rect x="' + gx + '" y="122" width="120" height="44" rx="8"/><text x="' + (gx + 60) + '" y="150" text-anchor="middle">' + total + '</text></g>';
          if (k < T) { const a = cx(k) + cw / 2; svg += '<path class="arr" d="M' + a + ' 64 C ' + a + ' 90, ' + (gx + 60) + ' 100, ' + (gx + 60) + ' 120" marker-end="url(#rd-ah)"/>'; }
          svg += '<text class="rl note" x="' + (W / 2) + '" y="190" text-anchor="middle">' + (k < T ? 'thread ' + k + ' is inside atomicAdd; ' + (T - k - 1) + ' more wait their turn' : 'all ' + T + ' updates were serialized, one after another') + '</text>';
        } else if (view === 'blocks') {
          const P = s.partials || [];
          H = 196;
          svg += '<text class="rl" x="4" y="18">one partial per block, in global memory</text>';
          P.forEach(function (v, b) { svg += cell(cx(b), 28, v, PDC.col(b), 'block ' + b); });
          if (s.final != null) {
            const gx = W / 2 - 60;
            P.forEach(function (v, b) { const a = cx(b) + cw / 2; svg += '<path class="arr" d="M' + a + ' 64 C ' + a + ' 100, ' + (gx + 60) + ' 94, ' + (gx + 60) + ' 120" marker-end="url(#rd-ah)"/>'; });
            svg += '<g class="rc big good"><rect x="' + gx + '" y="122" width="120" height="40" rx="8"/><text x="' + (gx + 60) + '" y="148" text-anchor="middle">' + esc(s.final) + '</text></g>';
            svg += '<text class="rl note" x="' + (W / 2) + '" y="184" text-anchor="middle">' + esc(s.finalLabel || 'summed on the CPU') + '</text>';
          }
        } else {   /* 'cache' */
          const cc = ctx(i), hasTree = steps.slice(cc.from, i + 1).some(function (x) { return x.stride != null; });
          const v = hasTree ? treeState(i).v : (cc.values || base());
          H = 110;
          svg += '<text class="rl" x="4" y="18">' + esc(nm) + '[ ] (shared memory)</text>';
          for (let j = 0; j < T; j++) svg += cell(cx(j), 28, v[j], PDC.col(j), 'tid ' + j);
          if (group < T) for (let g0 = 0; g0 < T; g0 += group)
            svg += '<path class="grp" d="M' + (cx(g0) - 1) + ' 80 v6 h' + (group * (cw + gap) - gap + 2) + ' v-6"/>';
        }
        host.innerHTML = '<div class="rd"><svg viewBox="0 0 ' + W + ' ' + (H + (s.out ? 34 : 0)) + '" role="img"><defs><marker id="rd-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="ah"/></marker></defs>' + svg +
          (s.out ? '<g class="outbox"><rect x="' + pad + '" y="' + (H + 2) + '" width="' + (cw * 4) + '" height="28" rx="6"/><text x="' + (pad + cw * 2) + '" y="' + (H + 21) + '" text-anchor="middle">' + esc(s.outLabel || 'c[blockIdx.x] = cache[0]') + '</text>' +
            '<path class="arr" d="M' + (cx(0) + cw / 2) + ' ' + (H - 6) + ' L' + (cx(0) + cw / 2) + ' ' + (H + 2) + '" marker-end="url(#rd-ah)"/></g>' : '') + '</svg></div>';
      }
      return { render: render };
    }
  };
})();
