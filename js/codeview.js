/* Source-code viewer with line highlighting driven by animation steps.

   A step's `code` field is one spec or an array of specs. A spec is
     'text'          every line containing text
     'text#2'        only the 2nd line containing text
     'from>>to'      from the first line containing `from` through the first line (at or after it) containing `to`
     'from#2>>to'    same, starting at the 2nd line containing `from`
     {f:'name', m:spec}   restrict the spec to the file whose name contains `name`
   Whitespace around the pieces is trimmed. */
(function () {
  'use strict';
  const PDC = window.PDC;

  /* Resolve one spec against raw source lines -> array of 0-based line numbers (possibly empty). */
  function resolveIn(lines, spec) {
    let from = spec, to = null;
    const ri = spec.indexOf('>>');
    if (ri >= 0) { from = spec.slice(0, ri); to = spec.slice(ri + 2).trim(); }
    let nth = 0;
    const hi = from.lastIndexOf('#');
    if (hi >= 0 && /^\d+$/.test(from.slice(hi + 1).trim())) { nth = parseInt(from.slice(hi + 1), 10); from = from.slice(0, hi); }
    from = from.trim();
    if (!from) return [];
    const hits = [];
    for (let i = 0; i < lines.length; i++) if (lines[i].indexOf(from) >= 0) hits.push(i);
    if (!hits.length) return [];
    if (to !== null) {
      const start = hits[Math.max(0, nth - 1)];
      if (start === undefined) return [];
      let end = start;
      if (to !== '' && lines[start].indexOf(to, lines[start].indexOf(from) + from.length) < 0) {
        end = -1;
        for (let i = start + 1; i < lines.length; i++) if (lines[i].indexOf(to) >= 0) { end = i; break; }
        if (end < 0) return [];
      }
      const out = [];
      for (let i = start; i <= end; i++) out.push(i);
      return out;
    }
    if (nth) return hits[nth - 1] === undefined ? [] : [hits[nth - 1]];
    return hits;
  }

  /* Resolve a step's `code` against a list of file records [{path,raw:[lines]}].
     Returns a Map(path -> Set(lineNumber)); `first` is the path of the first matched spec. */
  PDC.resolveCode = function (code, files, preferPath) {
    const out = new Map();
    let first = null;
    if (!code) return { map: out, first: null, misses: [] };
    const specs = Array.isArray(code) ? code : [code];
    const misses = [];
    specs.forEach(function (sp) {
      let spec = sp, only = null;
      if (typeof sp === 'object') { spec = sp.m; only = sp.f; }
      let cand = files.filter(function (f) { return !only || f.path.indexOf(only) >= 0; });
      if (preferPath) cand = cand.slice().sort(function (a, b) { return (b.path === preferPath) - (a.path === preferPath); });
      for (let k = 0; k < cand.length; k++) {
        const res = resolveIn(cand[k].raw, spec);
        if (res.length) {
          if (!out.has(cand[k].path)) out.set(cand[k].path, new Set());
          res.forEach(function (n) { out.get(cand[k].path).add(n); });
          if (!first) first = cand[k].path;
          return;
        }
      }
      misses.push(spec);
    });
    return { map: out, first: first, misses: misses };
  };

  PDC.loadFiles = function (paths) {
    const SRC = window.PDC_SOURCES || {};
    return paths.map(function (p) {
      const text = SRC[p];
      return { path: p, name: PDC.baseName(p), text: text == null ? '// (source not available in this build)' : text,
               raw: (text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'), missing: text == null };
    });
  };

  /* ---- viewer ---- */
  PDC.CodeView = function (root, files, opts) {
    opts = opts || {};
    const self = this;
    this.files = files;
    this.active = files.length ? files[0].path : null;
    this.hl = new Map();
    this.onLineClick = opts.onLineClick || null;
    this.rendered = {};

    root.classList.add('codeview');
    root.innerHTML =
      '<div class="cv-tabs" role="tablist"></div>' +
      '<div class="cv-bar"><span class="cv-path"></span>' +
      '<span class="cv-actions"><button type="button" class="cv-copy" title="Copy source">Copy</button>' +
      '<a class="cv-gh" target="_blank" rel="noopener">View on GitHub &#8599;</a></span></div>' +
      '<div class="cv-scroll"><table class="cv-table"><tbody></tbody></table></div>' +
      '<div class="cv-legend"><span><i class="tk-kw">keyword</i></span><span><i class="tk-api">API call</i></span>' +
      '<span><i class="tk-launch">launch</i></span><span class="cv-hint">Click a highlighted line to jump to the step that explains it.</span></div>';
    this.tabs = root.querySelector('.cv-tabs');
    this.tbody = root.querySelector('tbody');
    this.scroller = root.querySelector('.cv-scroll');
    this.pathEl = root.querySelector('.cv-path');
    this.ghEl = root.querySelector('.cv-gh');
    this.copyBtn = root.querySelector('.cv-copy');

    files.forEach(function (f) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cv-tab'; b.setAttribute('role', 'tab');
      b.textContent = f.name; b.dataset.path = f.path;
      b.addEventListener('click', function () { self.show(f.path); });
      self.tabs.appendChild(b);
    });
    if (files.length < 2) this.tabs.style.display = 'none';

    this.copyBtn.addEventListener('click', function () {
      const f = self.files.find(function (x) { return x.path === self.active; });
      if (!f || !navigator.clipboard) return;
      navigator.clipboard.writeText(f.raw.join('\n')).then(function () {
        self.copyBtn.textContent = 'Copied'; setTimeout(function () { self.copyBtn.textContent = 'Copy'; }, 1200);
      });
    });
    this.tbody.addEventListener('click', function (e) {
      const tr = e.target.closest('tr');
      if (!tr || !self.onLineClick) return;
      self.onLineClick(self.active, parseInt(tr.dataset.n, 10));
    });
    if (files.length) this.show(files[0].path, true);
  };

  PDC.CodeView.prototype.show = function (path, force) {
    if (!force && path === this.active && this.tbody.children.length) return;
    this.active = path;
    const f = this.files.find(function (x) { return x.path === path; });
    if (!f) return;
    if (!this.rendered[path]) this.rendered[path] = PDC.highlight(f.text, PDC.langOf(path));
    const html = this.rendered[path];
    const parts = [];
    for (let i = 0; i < html.length; i++) {
      parts.push('<tr data-n="' + i + '"><td class="ln">' + (i + 1) + '</td><td class="src">' + (html[i] || ' ') + '</td></tr>');
    }
    this.tbody.innerHTML = parts.join('');
    this.pathEl.textContent = f.path;
    this.ghEl.href = PDC.repoUrl(f.path);
    Array.prototype.forEach.call(this.tabs.children, function (b) {
      const on = b.dataset.path === path;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    this.paint();
    this.scroller.scrollTop = 0;
  };

  /* map: Map(path -> Set(lines)); jumpTo: path to bring forward */
  PDC.CodeView.prototype.highlight = function (map, jumpTo) {
    this.hl = map || new Map();
    if (jumpTo && jumpTo !== this.active) this.show(jumpTo);
    else this.paint();
    this.revealFirst();
  };

  PDC.CodeView.prototype.paint = function () {
    const set = this.hl.get(this.active);
    const rows = this.tbody.children;
    for (let i = 0; i < rows.length; i++) {
      const on = !!(set && set.has(i));
      if (on !== rows[i].classList.contains('hl')) rows[i].classList.toggle('hl', on);
    }
    // mark tabs that currently contain highlighted lines
    const self = this;
    Array.prototype.forEach.call(this.tabs.children, function (b) {
      b.classList.toggle('has-hl', self.hl.has(b.dataset.path) && b.dataset.path !== self.active);
    });
  };

  PDC.CodeView.prototype.revealFirst = function () {
    const set = this.hl.get(this.active);
    if (!set || !set.size) return;
    let min = Infinity, max = -1;
    set.forEach(function (n) { if (n < min) min = n; if (n > max) max = n; });
    const rows = this.tbody.children;
    const a = rows[min], b = rows[Math.min(max, rows.length - 1)];
    if (!a) return;
    const top = a.offsetTop, bottom = b.offsetTop + b.offsetHeight;
    const vh = this.scroller.clientHeight, st = this.scroller.scrollTop;
    if (top < st + 24 || bottom > st + vh - 24) {
      const target = Math.max(0, (bottom - top) < vh ? top - (vh - (bottom - top)) / 2 : top - 24);
      /* small moves glide; long jumps (e.g. past a licence header) are instant */
      this.scroller.scrollTo({ top: target, behavior: Math.abs(target - st) > 420 || PDC.reducedMotion ? 'auto' : 'smooth' });
    }
  };
})();
