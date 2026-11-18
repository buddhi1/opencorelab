/* kind: diagram - a scene of boxes ("nodes") holding value cells, static links, and tokens that fly between nodes.

   scene = { w, h,
     nodes:  { id: { x, y, w, h, label, sub, cls, c, shape, cells, cols, cw, hidden } },
     edges:  [ [fromId, toId, { dash, label }] ],
     groups: [ { x, y, w, h, label, cls } ] }

   step ops (state ops accumulate, transient ops apply to the current step only):
     show:[ids]  hide:[ids]  set:{id:{label,sub,cls,c,cells,...}}  cellSet:{id:{index:value}}
     flow:[{from,to,label,cls,delay}]   pulse:[ids]   mark:{id:[cell indexes]}   bubble:{id:'text'}
   `from`/`to` may be a node id or an [x, y] point.                                                   */
(function () {
  'use strict';
  const PDC = window.PDC, esc = PDC.esc;

  const lines = function (s) { return s == null || s === '' ? [] : String(s).split('\n'); };
  const cellObj = function (c) { return (c !== null && typeof c === 'object') ? c : { v: c }; };
  const center = function (n) { return [n.x + n.w / 2, n.y + n.h / 2]; };

  /* font size that lets `text` fit in `width` px (k = average glyph width / font size) */
  function fitFs(text, width, base, min, k) {
    const need = Math.max(1, String(text).length) * k;
    return Math.round(Math.max(min, Math.min(base, (width - 8) / need)) * 10) / 10;
  }

  function labelHeight(n) {
    const l = lines(n.label).length, s = lines(n.sub).length;
    return (l ? 8 + 16 * l : 4) + (s ? 15 * s : 0) + 4;
  }

  function nodeSvg(id, n, marks, pulse) {
    if (n.hidden) return '';
    const cls = 'node ' + (n.shape || 'box') + ' ' + (n.cls || '') + (n.c != null ? ' ' + PDC.col(n.c) : '') + (pulse ? ' pulse' : '');
    let s = '<g class="' + cls + '" data-id="' + esc(id) + '">';
    const cx = n.x + n.w / 2;
    if (n.shape === 'text') {
      lines(n.label).forEach(function (t, i) { s += '<text class="nl plain" x="' + cx + '" y="' + (n.y + 14 + i * 16) + '" text-anchor="middle">' + esc(t) + '</text>'; });
      return s + '</g>';
    }
    if (n.shape === 'circle') s += '<ellipse class="body" cx="' + cx + '" cy="' + (n.y + n.h / 2) + '" rx="' + n.w / 2 + '" ry="' + n.h / 2 + '"/>';
    else s += '<rect class="body" x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h + '" rx="' + (n.shape === 'pill' ? n.h / 2 : 10) + '"/>';
    const L = lines(n.label), S = lines(n.sub);
    const circ = n.shape === 'circle';
    let y0 = n.y + (circ ? n.h / 2 - ((L.length + S.length) * 8) + 6 : 20);
    if (circ && n.cells && n.cells.length) y0 = n.y + 20;
    const inner = circ ? n.w * 0.8 : n.w;
    L.forEach(function (t, i) { const fs = fitFs(t, inner, 15, 10, 0.62); s += '<text class="nl" x="' + cx + '" y="' + (y0 + i * 16) + '" text-anchor="middle"' + (fs < 15 ? ' style="font-size:' + fs + 'px"' : '') + '>' + esc(t) + '</text>'; });
    S.forEach(function (t, i) { const fs = fitFs(t, inner, 13, 9, 0.56); s += '<text class="ns" x="' + cx + '" y="' + (y0 + L.length * 16 + i * 14 - 2) + '" text-anchor="middle"' + (fs < 13 ? ' style="font-size:' + fs + 'px"' : '') + '>' + esc(t) + '</text>'; });
    if (n.cells && n.cells.length) {
      const cw = n.cw || 30, ch = n.ch || 22, gap = 3;
      const perRow = n.cols || Math.max(1, Math.floor((n.w - 10) / (cw + gap)));
      const w = Math.min(cw, Math.floor((n.w - 10 - gap * (perRow - 1)) / perRow));
      const top = n.y + (circ ? Math.max(labelHeight(n), 26) : labelHeight(n)) + (n.cellsTop || 0);
      n.cells.forEach(function (raw, k) {
        const c = cellObj(raw), r = Math.floor(k / perRow), q = k % perRow;
        const inRow = Math.min(perRow, n.cells.length - r * perRow);
        const rowW = inRow * w + (inRow - 1) * gap;
        const x = cx - rowW / 2 + q * (w + gap), y = top + r * (ch + gap);
        const mk = marks && marks.indexOf(k) >= 0;
        s += '<g class="cell ' + (c.c || '') + (mk ? ' mk' : '') + '">' + (c.t ? '<title>' + esc(c.t) + '</title>' : '') +
          '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + ch + '" rx="4"/>' +
          '<text x="' + (x + w / 2) + '" y="' + (y + ch / 2 + 4) + '" text-anchor="middle"' + (function () { const fs = fitFs(c.v == null ? '' : c.v, w + 4, 13, 8, 0.62); return fs < 13 ? ' style="font-size:' + fs + 'px"' : ''; })() + '>' + esc(c.v == null ? '' : c.v) + '</text></g>';
      });
    }
    return s + '</g>';
  }

  PDC.kinds.diagram = {
    create: function (host, scene, steps) {
      const W = scene.w || 800, H = scene.h || 400;
      host.innerHTML = '<svg class="dg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img">' +
        '<defs><marker id="dg-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="ah"/></marker></defs>' +
        '<g class="layer"></g></svg>';
      const layer = host.querySelector('.layer');

      function fold(i) {
        const nodes = {};
        Object.keys(scene.nodes).forEach(function (id) {
          const n = scene.nodes[id];
          nodes[id] = Object.assign({}, n, { cells: n.cells ? n.cells.slice() : n.cells });
        });
        for (let j = 0; j <= i; j++) {
          const s = steps[j];
          (s.show || []).forEach(function (id) { if (nodes[id]) nodes[id].hidden = false; });
          (s.hide || []).forEach(function (id) { if (nodes[id]) nodes[id].hidden = true; });
          if (s.set) Object.keys(s.set).forEach(function (id) {
            if (!nodes[id]) throw new Error('diagram: unknown node ' + id);
            const v = Object.assign({}, s.set[id]);
            if (v.cells) v.cells = v.cells.slice();
            Object.assign(nodes[id], v);
          });
          if (s.cellSet) Object.keys(s.cellSet).forEach(function (id) {
            const m = s.cellSet[id];
            Object.keys(m).forEach(function (k) { nodes[id].cells[+k] = m[k]; });
          });
        }
        return nodes;
      }

      function pt(ref, nodes) {
        if (Array.isArray(ref)) return ref;
        if (!nodes[ref]) throw new Error('diagram: unknown node ' + ref);
        return center(nodes[ref]);
      }

      function render(i) {
        const nodes = fold(i), s = steps[i];
        let g = '';
        (scene.groups || []).forEach(function (gr) {
          g += '<g class="group ' + (gr.cls || '') + '"><rect x="' + gr.x + '" y="' + gr.y + '" width="' + gr.w + '" height="' + gr.h + '" rx="12"/>' +
            (gr.label ? '<text x="' + (gr.x + 10) + '" y="' + (gr.y + 16) + '">' + esc(gr.label) + '</text>' : '') + '</g>';
        });
        (scene.edges || []).forEach(function (e) {
          const a = nodes[e[0]], b = nodes[e[1]], o = e[2] || {};
          if (!a || !b || a.hidden || b.hidden) return;
          const p = center(a), q = center(b);
          g += '<line class="edge' + (o.dash ? ' dash' : '') + (o.cls ? ' ' + o.cls : '') + '" x1="' + p[0] + '" y1="' + p[1] + '" x2="' + q[0] + '" y2="' + q[1] + '"/>';
          if (o.label) g += '<text class="edge-l" x="' + (p[0] + q[0]) / 2 + '" y="' + ((p[1] + q[1]) / 2 - 4) + '" text-anchor="middle">' + esc(o.label) + '</text>';
        });
        const pulse = {}; (s.pulse || []).forEach(function (id) { pulse[id] = true; });
        Object.keys(nodes).forEach(function (id) { g += nodeSvg(id, nodes[id], (s.mark || {})[id], pulse[id]); });
        (s.flow || []).forEach(function (f, k) {
          const p = pt(f.from, nodes), q = pt(f.to, nodes);
          const lab = f.label == null ? '' : String(f.label);
          const tw = lab ? Math.max(24, lab.length * 7.2 + 12) : 14;
          const delay = (f.delay || 0) + k * 0.0;
          g += '<line class="flowline ' + (f.cls || '') + '" x1="' + p[0] + '" y1="' + p[1] + '" x2="' + q[0] + '" y2="' + q[1] + '" marker-end="url(#dg-ah)"/>' +
            '<g class="tok ' + (f.cls || '') + '" data-f="' + [p[0], p[1], q[0], q[1], f.dur || 0.9, delay].join(',') + '">' +
            (lab ? '<rect x="' + (-tw / 2) + '" y="-11" width="' + tw + '" height="22" rx="11"/><text y="4" text-anchor="middle">' + esc(lab) + '</text>'
                 : '<circle r="7"/>') + '</g>';
        });
        Object.keys(s.bubble || {}).forEach(function (id) {
          const n = nodes[id]; if (!n || n.hidden) return;
          const txt = String(s.bubble[id]), w = Math.max(30, txt.length * 6.6 + 14), cx = n.x + n.w / 2, by = n.y - 8;
          g += '<g class="bubble"><rect x="' + (cx - w / 2) + '" y="' + (by - 22) + '" width="' + w + '" height="22" rx="6"/><path d="M' + (cx - 5) + ' ' + by + 'l5 6 5-6z"/>' +
            '<text x="' + cx + '" y="' + (by - 7) + '" text-anchor="middle">' + esc(txt) + '</text></g>';
        });
        layer.innerHTML = g;
        Array.prototype.forEach.call(layer.querySelectorAll('.tok'), function (t) { PDC.fly(t); });
      }
      return { render: render };
    }
  };
})();
