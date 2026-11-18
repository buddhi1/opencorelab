/* kind: iters - which thread executes which loop iteration (OpenMP work-sharing, schedules, sections, tasks, reductions).

   scene = { threads: 4, tnames:['T0',..], rows:[{name:'for i', n:10, after:'implicit barrier' | 'nowait'}], total: 128,
             partials:true (show per-thread partial sums) }
   step ops (accumulate):
     a:[[iter, thread] | [row, iter, thread]]    assign iterations (shows execution order #)
     part:{thread: value}   per-thread partial result      final: value   combined result
     chunk:[[row, start, len]]  outline a chunk (schedule(static, k))
     now:[[row, iter]]  mark as currently executing (this step only)
     note:'text'  small hint under the rows (this step only)
     reset:true  forget earlier assignments      after:{rowIndex:'text'}  caption under a row (e.g. 'nowait')      noorder:true  hide execution-order numbers                                       */
(function () {
  'use strict';
  const PDC = window.PDC, esc = PDC.esc;

  PDC.kinds.iters = {
    create: function (host, scene, steps) {
      const T = scene.threads || 4;
      const tn = scene.tnames || Array.from({ length: T }, function (_, i) { return 'T' + i; });
      const rows = scene.rows;

      function render(i) {
        const own = rows.map(function (r) { return new Array(r.n).fill(null); });
        const order = rows.map(function (r) { return new Array(r.n).fill(0); });
        let chunks = [], part = {}, final = null, ord = 0, note = '';
        const after = {};
        let counts = new Array(T).fill(0);
        for (let j = 0; j <= i; j++) {
          const s = steps[j];
          if (s.reset) {
            own.forEach(function (r) { r.fill(null); }); order.forEach(function (r) { r.fill(0); });
            chunks = []; part = {}; final = null; ord = 0; counts = new Array(T).fill(0);
          }
          if (s.after) Object.keys(s.after).forEach(function (k) { after[k] = s.after[k]; });
          (s.a || []).forEach(function (x) {
            let row = 0, it, th;
            if (x.length === 3) { row = x[0]; it = x[1]; th = x[2]; } else { it = x[0]; th = x[1]; }
            if (own[row][it] != null) counts[own[row][it]]--;
            own[row][it] = th; order[row][it] = ++ord; counts[th]++;
          });
          (s.chunk || []).forEach(function (c) { chunks.push(c); });
          if (s.part) Object.keys(s.part).forEach(function (k) { part[k] = s.part[k]; });
          if (s.final != null) final = s.final;
          if (j === i) note = s.note || '';
        }
        const now = {}; (steps[i].now || []).forEach(function (n) { now[n[0] + ':' + n[1]] = true; });
        const showOrder = scene.order !== false && !steps[i].noorder;

        let h = '<div class="it">';
        rows.forEach(function (r, ri) {
          h += '<div class="it-row"><div class="it-name">' + esc(r.name) + (r.total ? '<small>showing ' + r.n + ' of ' + r.total + '</small>' : '') + '</div><div class="it-cells">';
          for (let k = 0; k < r.n; k++) {
            const o = own[ri][k];
            let inChunk = '';
            chunks.forEach(function (c) { if (c[0] === ri && k >= c[1] && k < c[1] + c[2]) inChunk = ' ch' + (k === c[1] ? ' first' : '') + (k === c[1] + c[2] - 1 ? ' last' : ''); });
            h += '<div class="it-cell ' + (o == null ? 'free' : PDC.col(o)) + (now[ri + ':' + k] ? ' now' : '') + inChunk + '" title="' +
              (o == null ? 'not yet assigned' : tn[o]) + '"><b>' + k + '</b>' + (o != null ? '<span class="who">' + esc(tn[o]) + '</span>' + (showOrder ? '<span class="ord">#' + order[ri][k] + '</span>' : '') : '') + '</div>';
          }
          h += '</div>' + ((after[ri] != null ? after[ri] : r.after) ? '<div class="it-after ' + ((after[ri] != null ? after[ri] : r.after) === 'nowait' ? 'nw' : '') + '">' + esc(after[ri] != null ? after[ri] : r.after) + '</div>' : '') + '</div>';
        });
        h += '<div class="it-threads">';
        for (let t = 0; t < T; t++) {
          h += '<div class="it-thread ' + PDC.col(t) + '"><b>' + esc(tn[t]) + '</b><span>' + counts[t] + ' iter' + (counts[t] === 1 ? '' : 's') + '</span>' +
            (scene.partials ? '<em class="part' + (part[t] != null ? ' on' : '') + '">partial = ' + (part[t] != null ? esc(part[t]) : '?') + '</em>' : '') + '</div>';
        }
        h += '</div>';
        if (scene.partials) h += '<div class="it-final' + (final != null ? ' on' : '') + '">result = <b>' + (final != null ? esc(final) : '?') + '</b></div>';
        if (note) h += '<p class="it-note">' + note + '</p>';
        h += '</div>';
        host.innerHTML = h;
      }
      return { render: render };
    }
  };
})();
