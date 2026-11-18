/* kind: gantt - bars on named rows over a time axis (streams, copy/compute overlap, multi-GPU, pipelines, timing comparisons).

   scene = { rows:['H2D copy','Kernel','D2H copy'], span: 12 (axis length), unit:'time units', groups:[{label, from, to}] (row groups) }
   step ops (accumulate):
     bars:[{row, s, d, label, c:colourIndex|class, cls}]   a bar on `row` from time s lasting d
     mark:{t, label}     vertical marker at time t (e.g. total time)
     clear:true          drop all bars first (to compare two schedules one after the other)
     total:'text'        text shown at the right end (e.g. "total: 12 units")                                  */
(function () {
  'use strict';
  const PDC = window.PDC, esc = PDC.esc;

  PDC.kinds.gantt = {
    create: function (host, scene, steps) {
      const rows = scene.rows, span = scene.span || 12, labW = scene.labw || 118, rowH = scene.rowh || 38, top = 28, W = 720;
      const plotW = W - labW - 14, H = top + rows.length * rowH + 40;
      const x = function (t) { return labW + (t / span) * plotW; };

      function render(i) {
        let bars = [], marks = [], total = '';
        for (let j = 0; j <= i; j++) {
          const s = steps[j];
          if (s.clear) { bars = []; marks = []; total = ''; }
          (s.bars || []).forEach(function (b) { bars.push(Object.assign({ fresh: j === i }, b)); });
          if (s.mark) marks.push(Object.assign({ fresh: j === i }, s.mark));
          if (s.total != null) total = s.total;
        }
        let g = '';
        for (let t = 0; t <= span; t++) {
          g += '<line class="gx" x1="' + x(t) + '" x2="' + x(t) + '" y1="' + top + '" y2="' + (top + rows.length * rowH) + '"/>';
          if (span <= 24 || t % 2 === 0) g += '<text class="gt" x="' + x(t) + '" y="' + (top - 8) + '" text-anchor="middle">' + t + '</text>';
        }
        rows.forEach(function (r, k) {
          const y = top + k * rowH;
          g += '<rect class="grow' + (k % 2 ? ' alt' : '') + '" x="' + labW + '" y="' + y + '" width="' + plotW + '" height="' + rowH + '"/>';
          g += '<text class="gl" x="' + (labW - 8) + '" y="' + (y + rowH / 2 + 4) + '" text-anchor="end">' + esc(r) + '</text>';
        });
        bars.forEach(function (b) {
          const y = top + b.row * rowH + 5, w = Math.max(2, x(b.s + b.d) - x(b.s) - 2);
          const cc = b.cls || (b.c != null ? PDC.col(b.c) : 'c0');
          g += '<g class="gb ' + cc + (b.fresh ? ' fresh' : '') + '"><title>' + esc(b.label || '') + '</title><rect x="' + (x(b.s) + 1) + '" y="' + y + '" width="' + w + '" height="' + (rowH - 10) + '" rx="5"/>' +
            (b.label ? '<text x="' + (x(b.s) + 1 + w / 2) + '" y="' + (y + (rowH - 10) / 2 + 4) + '" text-anchor="middle">' + esc(b.label.length * 6.2 > w ? b.label.slice(0, Math.max(1, Math.floor(w / 6.2))) : b.label) + '</text>' : '') + '</g>';
        });
        marks.forEach(function (m) {
          g += '<line class="gm' + (m.fresh ? ' fresh' : '') + '" x1="' + x(m.t) + '" x2="' + x(m.t) + '" y1="' + (top - 2) + '" y2="' + (top + rows.length * rowH + 6) + '"/>' +
            '<text class="gml" x="' + x(m.t) + '" y="' + (top + rows.length * rowH + 20) + '" text-anchor="middle">' + esc(m.label || '') + '</text>';
        });
        g += '<text class="gu" x="' + (W - 8) + '" y="' + (H - 6) + '" text-anchor="end">' + esc(scene.unit || 'time (illustrative units)') + '</text>';
        if (total) g += '<text class="gtot" x="' + labW + '" y="' + (H - 6) + '">' + esc(total) + '</text>';
        host.innerHTML = '<div class="gantt"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img">' + g + '</svg></div>';
      }
      return { render: render };
    }
  };
})();
