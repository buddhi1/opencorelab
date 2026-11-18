/* kind: lanes - one horizontal timeline per thread / process, plus a strip of shared variables.

   scene = { lanes:['main','T0','T1'], vars:{counter:10}, colw:104, laneh:46 }
   step ops:
     col:n | same:true      column (time slot) of this step; default = previous column + 1
     reset:true             forget all earlier events / links / barriers (start a second scenario in the same space)
     ev:[[lane, 'text', cls, span, col]]   (col overrides this step's column)   cls: '' (lane colour) | wait | lock | sys | good | bad | done | print
     link:[[fromLane, toLane, 'label']]   vertical arrow at this step's column (fork, signal, wake-up)
     bar:{at, lanes, label}   dashed barrier line at the left edge of column `at` (default: this column)
     set:{name: value | {v, cls}}   shared-variable strip (cls: 'locked', 'bad', 'good')               */
(function () {
  'use strict';
  const PDC = window.PDC, esc = PDC.esc;

  PDC.kinds.lanes = {
    create: function (host, scene, steps) {
      const L = scene.lanes, colw = Math.min(scene.colw || 100, 104), laneh = scene.laneh || 46, Y0 = 26;
      const cols = [];
      steps.forEach(function (s, j) {
        let c;
        if (s.col != null) c = s.col; else if (j === 0) c = 0; else c = s.same ? cols[j - 1] : cols[j - 1] + 1;
        cols.push(c);
      });
      let maxCol = Math.max.apply(null, cols);
      steps.forEach(function (s, j) {
        if (s.bar && s.bar.at != null) maxCol = Math.max(maxCol, s.bar.at);
        (s.ev || []).forEach(function (e) { maxCol = Math.max(maxCol, (e[4] != null ? e[4] : cols[j]) + (e[3] || 1) - 1); });
      });
      const width = (maxCol + 1) * colw + 14, height = Y0 + L.length * laneh + 8;

      host.innerHTML =
        '<div class="ln-vars" aria-live="off"></div>' +
        '<div class="ln-wrap"><div class="ln-labels" style="padding-top:' + Y0 + 'px">' +
        L.map(function (n, i) { return '<div class="ln-label ' + PDC.col(i) + '" style="height:' + laneh + 'px"><span>' + esc(n) + '</span></div>'; }).join('') +
        '</div><div class="ln-scroll"><svg class="ln" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '"></svg></div></div>';
      const varsEl = host.querySelector('.ln-vars'), svg = host.querySelector('svg'), scroller = host.querySelector('.ln-scroll');
      const labelsEl = host.querySelector('.ln-labels');
      let scale = 1;

      /* Scale the timeline down to the panel width when that costs at most ~22 %; otherwise let it scroll sideways.
         The HTML lane labels are resized with it so they stay aligned with their lanes. */
      function fit() {
        const avail = scroller.clientWidth || width;
        let s = Math.min(1, avail / width);
        if (s < 0.78) s = 1;
        scale = s;
        svg.setAttribute('width', Math.round(width * s)); svg.setAttribute('height', Math.round(height * s));
        labelsEl.style.paddingTop = Math.round(Y0 * s) + 'px';
        Array.prototype.forEach.call(labelsEl.children, function (n) { n.style.height = (laneh * s) + 'px'; });
      }
      let ro = null;
      /* fit() changes the observed box's size, so run it on the next frame to avoid a "ResizeObserver loop" error */
      if (window.ResizeObserver) { ro = new ResizeObserver(function () { requestAnimationFrame(fit); }); ro.observe(host); }

      function fmt(v) {
        if (Array.isArray(v)) return '[' + v.join(', ') + ']';
        return String(v);
      }

      function render(i) {
        /* variable strip: fold */
        const vars = {}, changed = {};
        for (let j = 0; j <= i; j++) {
          const s = steps[j];
          if (j === 0 && scene.vars) Object.keys(scene.vars).forEach(function (k) { vars[k] = scene.vars[k]; });
          if (s.set) Object.keys(s.set).forEach(function (k) { vars[k] = s.set[k]; if (j === i) changed[k] = true; });
        }
        varsEl.innerHTML = Object.keys(vars).map(function (k) {
          let v = vars[k], cls = '';
          if (v && typeof v === 'object' && !Array.isArray(v)) { cls = v.cls || ''; v = v.v; }
          return '<span class="var ' + cls + (changed[k] ? ' chg' : '') + '"><i>' + esc(k) + '</i><b>' + esc(fmt(v)) + '</b></span>';
        }).join('');

        let g = '';
        const cur = cols[i];
        g += '<rect class="cursor" x="' + (cur * colw + 2) + '" y="' + Y0 + '" width="' + (colw - 4) + '" height="' + (L.length * laneh) + '" rx="6"/>';
        for (let l = 0; l < L.length; l++) {
          const y = Y0 + l * laneh + laneh / 2;
          g += '<line class="lane-line" x1="0" x2="' + width + '" y1="' + y + '" y2="' + y + '"/>';
        }
        const evs = [];
        let extra = '';
        for (let j = 0; j <= i; j++) {
          const s = steps[j], c = cols[j];
          if (s.reset) { evs.length = 0; extra = ''; }
          (s.ev || []).forEach(function (e) { evs.push({ l: e[0], t: e[1], cls: e[2] || '', span: e[3] || 1, c: e[4] != null ? e[4] : c, fresh: j === i }); });
          (s.bar ? [s.bar] : []).forEach(function (b) {
            const at = b.at != null ? b.at : c, x = at * colw;
            const lanes = !b.lanes || b.lanes === 'all' ? L.map(function (_, k) { return k; }) : b.lanes;
            const y1 = Y0 + Math.min.apply(null, lanes) * laneh + 2, y2 = Y0 + (Math.max.apply(null, lanes) + 1) * laneh - 2;
            extra += '<line class="bar' + (j === i ? ' fresh' : '') + '" x1="' + x + '" x2="' + x + '" y1="' + y1 + '" y2="' + y2 + '"/>';
            if (b.label) extra += '<text class="bar-l" x="' + x + '" y="' + (Y0 - 8) + '" text-anchor="middle">' + esc(b.label) + '</text>';
          });
          (s.link || []).forEach(function (k, li, arr) {
            const x = c * colw + colw / 2 + (arr.length > 1 ? (li - (arr.length - 1) / 2) * 9 : 0), ya = Y0 + k[0] * laneh + laneh / 2, yb = Y0 + k[1] * laneh + laneh / 2;
            const dir = yb > ya ? 1 : -1;
            extra += '<line class="link' + (j === i ? ' fresh' : '') + '" x1="' + x + '" x2="' + x + '" y1="' + (ya + dir * 14) + '" y2="' + (yb - dir * 14) + '" marker-end="url(#ln-ah)"/>';
            if (k[2]) extra += '<text class="link-l" x="' + (x + 5) + '" y="' + ((ya + yb) / 2 + 4) + '">' + esc(k[2]) + '</text>';
          });
        }
        g += extra;
        evs.forEach(function (e) {
          const x = e.c * colw + 4, y = Y0 + e.l * laneh + 6, w = e.span * colw - 8, h = laneh - 12;
          const cc = (!e.cls || e.cls === 'run' || e.cls === 'print') ? PDC.col(e.l) : e.cls;
          const parts = String(e.t).split('\n');
          const maxCh = Math.floor(w / 6.3);
          let tx = '';
          parts.forEach(function (p, k) {
            const t = p.length > maxCh ? p.slice(0, maxCh - 1) + '…' : p;
            const ty = parts.length === 1 ? y + h / 2 + 4 : y + h / 2 + (k === 0 ? -2 : 10);
            tx += '<text x="' + (x + w / 2) + '" y="' + ty + '" text-anchor="middle"' + (parts.length > 1 ? ' class="two"' : '') + '>' + esc(t) + '</text>';
          });
          g += '<g class="ev ' + cc + (e.fresh ? ' fresh' : '') + '"><title>' + esc(e.t) + '</title><rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="7"/>' + tx + '</g>';
        });
        svg.innerHTML = '<defs><marker id="ln-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="ah"/></marker></defs>' + g;

        /* keep the active column in view */
        fit();
        const left = cur * colw * scale, vw = scroller.clientWidth;
        if (left < scroller.scrollLeft + 6 || left + colw * scale > scroller.scrollLeft + vw - 6) {
          scroller.scrollTo({ left: Math.max(0, left - vw / 2 + colw * scale / 2), behavior: 'smooth' });
        }
      }
      return { render: render, destroy: function () { if (ro) ro.disconnect(); } };
    }
  };
})();
