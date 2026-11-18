/* App shell: hash router, collapsible sidebar, home / course / topic pages, and the example page
   (animation player + linked source code). */
(function () {
  'use strict';
  const PDC = window.PDC;
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const esc = PDC.esc;

  /* true when the keyboard event came from a text field (so shortcuts must not fire) */
  function inField(t) { return !!(t && t.closest && t.closest('input, select, textarea')); }

  /* page, step and UI events; feedback.js listens to these (and does nothing without the student's consent) */
  function emit(name, detail) { document.dispatchEvent(new CustomEvent('ocl:' + name, { detail: detail })); }

  const store = {
    get: function (k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };

  /* ---------- derived lookups ---------- */
  const courseOf = {}; PDC.courses.forEach(function (c) { courseOf[c.id] = c; });
  function topicsOf(c) { return c.topics; }
  function examplesIn(course, topic) { return PDC.examples.filter(function (e) { return e.course === course && e.topic === topic; }); }
  const ORDER = [];
  PDC.courses.forEach(function (c) { c.topics.forEach(function (t) { examplesIn(c.id, t.id).forEach(function (e) { ORDER.push(e); }); }); });
  function exKey(e) { return e.course + '/' + e.topic + '/' + e.id; }
  function exHref(e) { return '#/' + exKey(e); }
  function findEx(c, t, i) { return ORDER.find(function (e) { return e.course === c && e.topic === t && e.id === i; }); }

  const visited = new Set();
  try { JSON.parse(store.get('pdc-visited', '[]')).forEach(function (k) { visited.add(k); }); } catch (e) { /* ignore */ }
  function markVisited(e) { visited.add(exKey(e)); store.set('pdc-visited', JSON.stringify(Array.from(visited))); }

  /* ---------- theme ---------- */
  $('#theme-toggle').addEventListener('click', function () {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', cur); store.set('pdc-theme', cur);
    emit('ui', { action: 'theme' });
  });

  /* Scaled SVG scenes are drawn 700-800 units wide, so on a phone their text would shrink to ~5px.
     Record each one's natural width in --vbw; on narrow screens the CSS keeps it at least 60% of that
     and the animation box scrolls sideways instead. (Lanes have a fixed pixel width and scroll already.) */
  function tagSvgWidths(host) {
    host.querySelectorAll('svg[viewBox]:not(.ln)').forEach(function (svg) {
      const vb = svg.viewBox && svg.viewBox.baseVal;
      if (vb && vb.width) svg.style.setProperty('--vbw', vb.width);
    });
  }

  /* ---------- site menu: on narrow screens the header links fold into a drop-down ---------- */
  const navBtn = $('#nav-toggle'), nav = $('#top-nav');
  function setNav(open) {
    if (!navBtn || !nav) return;
    nav.classList.toggle('open', open);
    navBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  if (navBtn && nav) {
    navBtn.addEventListener('click', function (ev) { ev.stopPropagation(); setNav(!nav.classList.contains('open')); });
    nav.addEventListener('click', function (ev) { if (ev.target.closest('a')) setNav(false); });
    document.addEventListener('click', function (ev) { if (!nav.contains(ev.target)) setNav(false); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') setNav(false); });
  }

  /* ---------- sidebar ---------- */
  const sidebar = $('#sidebar'), backdrop = $('#sb-backdrop'), toggleBtn = $('#sb-toggle');
  const isNarrow = function () { return window.matchMedia('(max-width: 900px)').matches; };
  function setSidebar(open, persist) {
    document.body.classList.toggle('sb-closed', !open);
    toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    backdrop.hidden = !(open && isNarrow());
    if (persist && !isNarrow()) store.set('pdc-sidebar', open ? 'open' : 'closed');
    if (persist) emit('ui', { action: 'sidebar' });
  }
  function sidebarOpen() { return !document.body.classList.contains('sb-closed'); }
  toggleBtn.addEventListener('click', function () { setSidebar(!sidebarOpen(), true); });
  backdrop.addEventListener('click', function () { setSidebar(false, false); });
  const sbParam = /[?&]sb=(0|1)/.exec(location.search);     // ?sb=0 starts with the sidebar hidden, ?sb=1 with it shown
  setSidebar(sbParam ? sbParam[1] === '1' : (isNarrow() ? false : store.get('pdc-sidebar', 'open') !== 'closed'), false);
  window.addEventListener('resize', function () { backdrop.hidden = !(sidebarOpen() && isNarrow()); });

  const openTopics = new Set(JSON.parse(store.get('pdc-open-topics', '[]')));
  const openCourses = new Set(JSON.parse(store.get('pdc-open-courses', '["pdc","hpml"]')));
  function saveOpen() { store.set('pdc-open-topics', JSON.stringify(Array.from(openTopics))); store.set('pdc-open-courses', JSON.stringify(Array.from(openCourses))); }

  function buildSidebar(activeKey, filter) {
    const tree = $('#sb-tree');
    const q = (filter || '').trim().toLowerCase();
    let h = '<a class="sb-home' + (activeKey === '' ? ' on' : '') + '" href="#/">Home &amp; guide</a>';
    PDC.courses.forEach(function (c) {
      const cOpen = q || openCourses.has(c.id);
      let chtml = '';
      let cCount = 0;
      c.topics.forEach(function (t) {
        let list = examplesIn(c.id, t.id);
        if (q) list = list.filter(function (e) {
          return (e.title + ' ' + e.id + ' ' + e.files.join(' ') + ' ' + e.concepts.join(' ')).toLowerCase().indexOf(q) >= 0;
        });
        if (!list.length) return;
        cCount += list.length;
        const tk = c.id + '/' + t.id;
        const tOpen = q || openTopics.has(tk) || (activeKey && activeKey.indexOf(tk + '/') === 0);
        let items = '';
        list.forEach(function (e) {
          const k = exKey(e);
          items += '<li><a href="' + exHref(e) + '" class="sb-ex' + (k === activeKey ? ' on' : '') + (visited.has(k) ? ' seen' : '') + '" data-key="' + k + '">' +
            '<span class="dot" aria-hidden="true"></span><span class="lbl">' + esc(e.title) + '</span></a></li>';
        });
        chtml += '<div class="sb-topic' + (tOpen ? ' open' : '') + '" data-tk="' + tk + '">' +
          '<div class="sb-t"><button type="button" class="tg" aria-expanded="' + (tOpen ? 'true' : 'false') + '" aria-label="Expand ' + esc(t.title) + '"><span class="chev" aria-hidden="true"></span></button>' +
          '<a class="t-link" href="#/' + tk + '" title="Topic overview">' + esc(t.title) + '</a><span class="count">' + list.length + '</span></div>' +
          '<ul class="sb-list">' + items + '</ul></div>';
      });
      if (q && !cCount) return;
      h += '<div class="sb-course' + (cOpen ? ' open' : '') + '" data-c="' + c.id + '">' +
        '<button type="button" class="sb-c" aria-expanded="' + (cOpen ? 'true' : 'false') + '"><span class="chev" aria-hidden="true"></span>' +
        '<span class="c-name">' + esc(c.short || c.title) + '</span><span class="c-badge ' + c.id + '">' + c.id.toUpperCase() + '</span></button>' +
        '<div class="sb-c-body">' + chtml + '</div></div>';
    });
    if (q && h.indexOf('sb-ex') < 0) h += '<p class="sb-empty">No example matches &ldquo;' + esc(q) + '&rdquo;.</p>';
    tree.innerHTML = h;
    $('#sb-progress').textContent = visited.size + ' / ' + ORDER.length + ' examples visited';
    const on = $('.sb-ex.on', tree);
    if (on) on.scrollIntoView({ block: 'nearest' });
  }

  $('#sb-tree').addEventListener('click', function (e) {
    const link = e.target.closest('a.sb-ex, a.sb-home');
    if (link) { if (isNarrow()) setSidebar(false, false); return; }
    const cbtn = e.target.closest('.sb-c');
    if (cbtn) {
      const id = cbtn.parentNode.dataset.c;
      if (openCourses.has(id)) openCourses.delete(id); else openCourses.add(id);
      cbtn.parentNode.classList.toggle('open'); cbtn.setAttribute('aria-expanded', openCourses.has(id)); saveOpen(); return;
    }
    const tl = e.target.closest('.t-link');
    if (tl) { openTopics.add(tl.closest('.sb-topic').dataset.tk); saveOpen(); return; }   // default navigation to the topic page
    const tg = e.target.closest('.tg');
    if (tg) {
      const box = tg.closest('.sb-topic'), tk = box.dataset.tk;
      const open = !box.classList.contains('open');
      box.classList.toggle('open', open); tg.setAttribute('aria-expanded', open);
      if (open) openTopics.add(tk); else openTopics.delete(tk);
      saveOpen();
    }
  });
  let lastFilter = '';
  $('#sb-filter').addEventListener('input', function (e) {
    if (e.target.value && !lastFilter) emit('ui', { action: 'search' });   // count searches, not keystrokes (the text is never sent)
    lastFilter = e.target.value;
    buildSidebar(currentKey, e.target.value);
  });

  /* ---------- pages ---------- */
  const main = $('#main');
  let cleanup = null;
  let currentKey = '';

  function setTitle(t) { document.title = (t ? t + ' – ' : '') + 'Open Core Lab'; }

  function pageHome() {
    setTitle('');
    let cards = '';
    PDC.courses.forEach(function (c) {
      const n = PDC.examples.filter(function (e) { return e.course === c.id; }).length;
      cards += '<a class="card course-card ' + c.id + '" href="#/' + c.id + '"><span class="c-badge ' + c.id + '">' + c.id.toUpperCase() + '</span>' +
        '<h3>' + esc(c.title) + '</h3><p>' + c.blurb + '</p><span class="more">' + c.topics.length + ' topics &middot; ' + n + ' animated examples &rarr;</span></a>';
    });
    main.innerHTML =
      '<div class="page home">' +
      '<section class="hero"><img class="brand-plate" src="img/ocl-logo-horizontal.svg" alt="Open Core Lab: parallel computing for all" width="1508" height="600">' +
      '<p class="label">Open Core Lab &mdash; a visual lab for PDC and HPML</p>' +
      '<h1>See the code <em>run</em>, one step at a time.</h1>' +
      '<p class="lead">Every example from the <b>Parallel &amp; Distributed Computing (PDC)</b> and <b>High-Performance Machine Learning (HPML)</b> classes has an animation. ' +
      'Step through threads, MPI ranks, CUDA grids, tiled matrix multiplies and distributed training &mdash; while the exact lines of source code that cause each step light up beside it.</p>' +
      '<div class="hero-cta"><a class="btn primary" href="' + exHref(ORDER[0]) + '">Start with the first example</a><a class="btn" href="#/pdc">Browse PDC</a><a class="btn" href="#/hpml">Browse HPML</a></div></section>' +
      '<section class="cards">' + cards + '</section>' +
      '<section class="how"><h2>How to use a page</h2><div class="how-grid">' +
      '<div class="how-item"><span class="num">1</span><h4>Pick an example</h4><p>Use the left sidebar. Click the &#9776; button (or press <kbd>[</kbd>) to hide it and give the animation more room.</p></div>' +
      '<div class="how-item"><span class="num">2</span><h4>Step through it</h4><p>Use <kbd>&larr;</kbd> <kbd>&rarr;</kbd> to move one step, <kbd>Space</kbd> to play or pause, or click the dots to jump.</p></div>' +
      '<div class="how-item"><span class="num">3</span><h4>Follow the code</h4><p>Highlighted lines are the code being executed. Click any highlighted line to jump to the step that explains it.</p></div>' +
      '<div class="how-item"><span class="num">4</span><h4>Experiment</h4><p>Many pages end with &ldquo;Try it&rdquo; ideas. Compile the file from the repository and compare with what you saw.</p></div>' +
      '</div></section>' +
      '<section class="legend-card"><h2>Reading the animations</h2><div class="legend-row">' +
      '<span class="lg"><i class="sw c0"></i>thread / rank / GPU 0</span><span class="lg"><i class="sw c1"></i>1</span><span class="lg"><i class="sw c2"></i>2</span><span class="lg"><i class="sw c3"></i>3</span>' +
      '<span class="lg"><i class="sw ok"></i>correct / done</span><span class="lg"><i class="sw bad"></i>problem (race, conflict, deadlock)</span><span class="lg"><i class="sw wait"></i>waiting / blocked</span></div>' +
      '<p class="muted">Timings drawn in the animations are <b>illustrative</b> unless a step says otherwise. Real numbers depend on your hardware; the shape of the effect is what the animation shows.</p></section>' +
      '</div>';
    currentKey = ''; buildSidebar('', $('#sb-filter').value);
  }

  function pageAbout() {
    setTitle('About');
    const topics = PDC.courses.reduce(function (n, c) { return n + c.topics.length; }, 0);
    const goal = function (n, h, p) { return '<div class="how-item"><span class="num">' + n + '</span><h4>' + h + '</h4><p>' + p + '</p></div>'; };
    main.innerHTML =
      '<div class="page about"><nav class="crumbs"><a href="#/">Home</a> &rsaquo; <span>About</span></nav>' +
      '<p class="label">Open Core Lab &mdash; parallel computing for all</p><h1>About Open Core Lab</h1>' +
      '<p class="lead">Open Core Lab is a visual lab for parallel and high-performance computing. It turns the code examples from the <b>Parallel &amp; Distributed Computing (PDC)</b> and ' +
      '<b>High-Performance Machine Learning (HPML)</b> courses into step-by-step animations, so you can watch what threads, MPI ranks and GPU blocks actually do while the lines of source code that cause it light up beside them.</p>' +
      '<p class="muted">' + ORDER.length + ' animated examples &middot; ' + topics + ' topics &middot; ' + PDC.courses.length + ' courses</p>' +
      '<section class="how"><h2>Our goal</h2><div class="how-grid">' +
      goal('01', 'Make parallel execution visible', 'Concurrency is hard to picture from static code or slides. Each animation shows ordering, waiting, data movement and races as they happen.') +
      goal('02', 'Tie every picture to real code', 'Animations are linked line by line to the same source files used in class, so what you see is what you compile and run.') +
      goal('03', 'Learn at your own pace', 'Step forward and back, replay or autoplay. Nothing to install: it runs in any modern browser, on a laptop or a phone.') +
      goal('04', 'Open to everyone', 'Parallel computing for all: the lab and its examples are free and open source, for students in the course and for anyone learning on their own.') +
      '</div></section>' +
      '<section class="card notes"><h2>What is inside</h2><ul>' + PDC.courses.map(function (c) {
        const n = PDC.examples.filter(function (e) { return e.course === c.id; }).length;
        return '<li><b><a href="#/' + c.id + '">' + esc(c.title) + '</a></b> &mdash; ' + c.topics.length + ' topics, ' + n + ' examples: ' +
          c.topics.map(function (t) { return esc(t.title); }).join(', ') + '.</li>';
      }).join('') + '</ul></section>' +
      '<section class="card notes"><h2>How it works</h2><ul>' +
      '<li>Each example is a short sequence of steps. A step draws the state of the program &mdash; threads, ranks, messages, memory or the GPU grid &mdash; and highlights the source lines responsible for it.</li>' +
      '<li>Clicking a highlighted line jumps to the step that explains it, so you can move from the picture to the code and back.</li>' +
      '<li>Topics are ordered the way the courses teach them, and &ldquo;Try it&rdquo; ideas suggest what to change when you compile the code yourself.</li>' +
      '<li>The lab is a static web page with no server and no build step; the course source code is bundled in, so a downloaded copy works offline too.</li>' +
      '</ul></section>' +
      '<section class="card notes"><h2>Open source</h2>' +
      '<p>Open Core Lab and all of its examples are free and open source. Created and maintained by <a href="https://buddhi1.github.io/bashan/" target="_blank" rel="noopener">Buddhi Ashan Mallika Kankanamalage</a>.</p>' +
      (PDC.pages && PDC.pages.feedback ? '<p>Using Open Core Lab in class? <a href="#/feedback">Tell us what works and what does not</a>; student feedback decides which examples we improve next.</p>' : '') +
      '<div class="ex-links"><a class="btn primary small" href="' + PDC.SITE_REPO + '" target="_blank" rel="noopener">Source code on GitHub &#8599;</a></div></section>' +
      '</div>';
    currentKey = ''; buildSidebar('', $('#sb-filter').value);
  }

  function pageCourse(c) {
    setTitle(c.title);
    let h = '<div class="page"><nav class="crumbs"><a href="#/">Home</a> &rsaquo; <span>' + esc(c.title) + '</span></nav>' +
      '<h1>' + esc(c.title) + '</h1><p class="lead">' + c.blurb + '</p><div class="cards">';
    c.topics.forEach(function (t) {
      const list = examplesIn(c.id, t.id);
      if (!list.length) return;
      h += '<a class="card topic-card" href="#/' + c.id + '/' + t.id + '"><h3>' + esc(t.title) + '</h3><p>' + t.blurb + '</p>' +
        '<span class="more">' + list.length + ' examples &rarr;</span></a>';
    });
    h += '</div></div>';
    main.innerHTML = h; currentKey = ''; buildSidebar('', $('#sb-filter').value);
  }

  function pageTopic(c, t) {
    setTitle(t.title);
    const list = examplesIn(c.id, t.id);
    let h = '<div class="page"><nav class="crumbs"><a href="#/">Home</a> &rsaquo; <a href="#/' + c.id + '">' + esc(c.short || c.title) + '</a> &rsaquo; <span>' + esc(t.title) + '</span></nav>' +
      '<h1>' + esc(t.title) + '</h1><p class="lead">' + t.blurb + '</p><div class="ex-list">';
    list.forEach(function (e, i) {
      h += '<a class="ex-row" href="' + exHref(e) + '"><span class="n">' + (i + 1) + '</span><span class="body"><b>' + esc(e.title) + '</b><span>' + e.summary + '</span></span>' +
        '<span class="files">' + e.files.filter(function (f) { return !/makefile$/i.test(f); }).slice(0, 2).map(function (f) { return '<code>' + esc(PDC.baseName(f)) + '</code>'; }).join('') + '</span></a>';
    });
    h += '</div></div>';
    main.innerHTML = h; currentKey = c.id + '/' + t.id + '/'; buildSidebar(currentKey, $('#sb-filter').value);
  }

  /* ---------- example page ---------- */
  function pageExample(e) {
    const c = courseOf[e.course];
    const t = c.topics.find(function (x) { return x.id === e.topic; });
    setTitle(e.title);
    markVisited(e);

    const files = PDC.loadFiles(e.files);
    const hasCode = files.length > 0;
    const kind = PDC.kinds[e.kind];
    const steps = e.steps;
    const idx = ORDER.indexOf(e);
    const prev = ORDER[idx - 1], next = ORDER[idx + 1];

    main.innerHTML =
      '<div class="page example">' +
      '<nav class="crumbs"><a href="#/">Home</a> &rsaquo; <a href="#/' + c.id + '">' + esc(c.short || c.title) + '</a> &rsaquo; <a href="#/' + c.id + '/' + t.id + '">' + esc(t.title) + '</a> &rsaquo; <span>' + esc(e.title) + '</span></nav>' +
      '<header class="ex-head"><div><h1>' + esc(e.title) + '</h1><p class="lead">' + e.summary + '</p></div>' +
      '<div class="chips">' + e.concepts.map(function (x) { return '<span class="chip">' + esc(x) + '</span>'; }).join('') + '</div>' +
      (e.links && e.links.length ? '<div class="ex-links">' + e.links.map(function (l) { return '<a class="btn small" target="_blank" rel="noopener" href="' + esc(l.href) + '">' + esc(l.label) + ' &#8599;</a>'; }).join('') + '</div>' : '') +
      '</header>' +
      '<div class="stage' + (hasCode ? '' : ' no-code') + '">' +
      '<section class="card anim-card" aria-label="Animation">' +
      '<div class="anim-title"><span class="step-pill" id="step-pill"></span><b id="step-title"></b></div>' +
      '<div class="anim-host" id="anim-host"></div>' +
      '<p class="caption" id="caption" aria-live="polite"></p>' +
      '<div class="controls">' +
      '<button type="button" class="ctl" id="b-first" title="Restart" aria-label="Restart"><svg viewBox="0 0 24 24"><path d="M6 5v14M19 5l-10 7 10 7z" /></svg></button>' +
      '<button type="button" class="ctl" id="b-prev" title="Previous step (Left arrow)" aria-label="Previous step"><svg viewBox="0 0 24 24"><path d="M17 5l-10 7 10 7z" /></svg></button>' +
      '<button type="button" class="ctl play" id="b-play" title="Play / pause (Space)" aria-label="Play"><svg class="i-play" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" /></svg><svg class="i-pause" viewBox="0 0 24 24"><path d="M7 4h4v16H7zM13 4h4v16h-4z" /></svg></button>' +
      '<button type="button" class="ctl" id="b-next" title="Next step (Right arrow)" aria-label="Next step"><svg viewBox="0 0 24 24"><path d="M7 5l10 7-10 7z" /></svg></button>' +
      '<button type="button" class="ctl" id="b-last" title="Last step" aria-label="Last step"><svg viewBox="0 0 24 24"><path d="M18 5v14M5 5l10 7-10 7z" /></svg></button>' +
      '<div class="dots" id="dots" role="tablist" aria-label="Steps"></div>' +
      '<label class="speed">Speed <select id="speed"><option value="0.5">0.5&times;</option><option value="1" selected>1&times;</option><option value="2">2&times;</option><option value="3">3&times;</option></select></label>' +
      '</div></section>' +
      (hasCode ? '<section class="card code-card" aria-label="Source code"><div id="code-host"></div></section>' : '') +
      '</div>' +
      (e.notes && e.notes.length ? '<section class="card notes"><h2>What to notice</h2><ul>' + e.notes.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ul></section>' : '') +
      (e.tryit && e.tryit.length ? '<section class="card notes tryit"><h2>Try it</h2><ul>' + e.tryit.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ul></section>' : '') +
      '<nav class="pager">' +
      (prev ? '<a class="pg prev" href="' + exHref(prev) + '"><small>&larr; Previous</small><span>' + esc(prev.title) + '</span></a>' : '<span></span>') +
      (next ? '<a class="pg next" href="' + exHref(next) + '"><small>Next &rarr;</small><span>' + esc(next.title) + '</span></a>' : '<span></span>') +
      '</nav></div>';

    currentKey = exKey(e);
    buildSidebar(currentKey, $('#sb-filter').value);

    /* code viewer + step -> line map */
    const stepMaps = steps.map(function (s) { return PDC.resolveCode(s.code, files); });
    const cv = hasCode ? new PDC.CodeView($('#code-host'), files, {
      onLineClick: function (path, line) {
        for (let i = 0; i < stepMaps.length; i++) {
          const s = stepMaps[i].map.get(path);
          if (s && s.has(line)) { emit('ui', { action: 'codeclick' }); player.go(i, true); return; }
        }
      }
    }) : null;

    /* animation */
    const host = $('#anim-host');
    const eng = kind.create(host, e.scene || {}, steps);
    const dotsEl = $('#dots');
    dotsEl.innerHTML = steps.map(function (s, i) {
      return '<button type="button" class="dot" role="tab" aria-label="Step ' + (i + 1) + '" data-i="' + i + '"></button>';
    }).join('');

    const player = {
      i: 0, playing: false, timer: null, speed: 1,
      go: function (i, stopPlay) {
        i = PDC.clamp(i, 0, steps.length - 1);
        if (stopPlay) this.pause();
        this.i = i;
        const s = steps[i];
        eng.render(i);
        tagSvgWidths(host);
        $('#step-pill').textContent = (i + 1) + ' / ' + steps.length;
        $('#step-title').textContent = s.t || '';
        $('#caption').innerHTML = s.say || '';
        Array.prototype.forEach.call(dotsEl.children, function (d, k) {
          d.classList.toggle('on', k === i); d.classList.toggle('past', k < i); d.setAttribute('aria-selected', k === i);
        });
        const m = stepMaps[i];
        if (cv) cv.highlight(m.map, m.first);
        $('#b-prev').disabled = i === 0; $('#b-first').disabled = i === 0;
        $('#b-next').disabled = i === steps.length - 1; $('#b-last').disabled = i === steps.length - 1;
        emit('step', { key: exKey(e), i: i, n: steps.length });
      },
      play: function () {
        if (this.playing) return;
        if (this.i >= steps.length - 1) this.go(0);
        this.playing = true; $('#b-play').classList.add('is-playing'); $('#b-play').setAttribute('aria-label', 'Pause');
        this.tick();
      },
      pause: function () {
        this.playing = false; clearTimeout(this.timer);
        $('#b-play').classList.remove('is-playing'); $('#b-play').setAttribute('aria-label', 'Play');
      },
      tick: function () {
        const self = this;
        clearTimeout(this.timer);
        const s = steps[this.i];
        const base = (s && s.ms) || 2600;
        this.timer = setTimeout(function () {
          if (!self.playing) return;
          if (self.i >= steps.length - 1) { self.pause(); return; }
          self.go(self.i + 1); self.tick();
        }, base / this.speed);
      }
    };
    $('#b-play').addEventListener('click', function () { if (player.playing) player.pause(); else { emit('ui', { action: 'play' }); player.play(); } });
    $('#b-next').addEventListener('click', function () { player.go(player.i + 1, true); });
    $('#b-prev').addEventListener('click', function () { player.go(player.i - 1, true); });
    $('#b-first').addEventListener('click', function () { player.go(0, true); });
    $('#b-last').addEventListener('click', function () { player.go(steps.length - 1, true); });
    dotsEl.addEventListener('click', function (ev) { const d = ev.target.closest('.dot'); if (d) player.go(+d.dataset.i, true); });
    $('#speed').addEventListener('change', function (ev) { emit('ui', { action: 'speed' }); player.speed = parseFloat(ev.target.value); if (player.playing) player.tick(); });

    const onKey = function (ev) {
      if (inField(ev.target) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === 'ArrowRight') { player.go(player.i + 1, true); ev.preventDefault(); }
      else if (ev.key === 'ArrowLeft') { player.go(player.i - 1, true); ev.preventDefault(); }
      else if (ev.key === ' ' && !(ev.target && ev.target.closest && ev.target.closest('button, a'))) { player.playing ? player.pause() : player.play(); ev.preventDefault(); }
      else if (ev.key === 'Home') { player.go(0, true); }
      else if (ev.key === 'End') { player.go(steps.length - 1, true); }
    };
    document.addEventListener('keydown', onKey);
    cleanup = function () { player.pause(); document.removeEventListener('keydown', onKey); if (eng.destroy) eng.destroy(); };

    player.go(initialStep !== null ? initialStep : 0);
    initialStep = null;                                         // ?step=N only applies to the page the link opened
    window.PDC_PLAYER = player;
  }

  /* ?step=N in the URL (e.g. index.html?step=3#/pdc/...) opens the first example page at step N; used for sharing and screenshots */
  let initialStep = (function () { const m = /[?&]step=(\d+)/.exec(location.search); return m ? Math.max(0, +m[1] - 1) : null; })();

  /* ---------- router ---------- */
  function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    /* on a phone the sidebar covers the page, so close it (and the menu) once a link is followed */
    setNav(false);
    if (isNarrow() && sidebarOpen()) setSidebar(false, false);
    let parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    window.scrollTo(0, 0);
    if (!parts.length) pageHome();
    else if (parts.length === 1 && parts[0] === 'about') pageAbout();
    else if (parts.length === 1 && courseOf[parts[0]]) pageCourse(courseOf[parts[0]]);
    else if (parts.length === 2 && courseOf[parts[0]] && courseOf[parts[0]].topics.some(function (t) { return t.id === parts[1]; }))
      pageTopic(courseOf[parts[0]], courseOf[parts[0]].topics.find(function (t) { return t.id === parts[1]; }));
    else if (parts.length === 3 && findEx(parts[0], parts[1], parts[2])) pageExample(findEx(parts[0], parts[1], parts[2]));
    else if (parts.length === 1 && PDC.pages && PDC.pages[parts[0]]) pageExtra(PDC.pages[parts[0]]);
    else { main.innerHTML = '<div class="page"><h1>Not found</h1><p>That page does not exist. <a href="#/">Back to the start</a>.</p></div>'; currentKey = ''; buildSidebar('', ''); parts = ['not-found']; }
    main.focus({ preventScroll: true });
    const ex = parts.length === 3 ? findEx(parts[0], parts[1], parts[2]) : null;
    emit('route', { path: parts.join('/') || 'home', example: !!ex, steps: ex ? ex.steps.length : 0 });
  }

  /* pages registered by other modules (feedback.js: #/feedback, #/privacy) */
  function pageExtra(p) {
    setTitle(p.title);
    cleanup = p.render(main) || null;
    currentKey = ''; buildSidebar('', $('#sb-filter').value);
  }
  window.addEventListener('hashchange', route);

  document.addEventListener('keydown', function (ev) {
    if (inField(ev.target) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === '[') { setSidebar(!sidebarOpen(), true); }
    if (ev.key === '/') { ev.preventDefault(); setSidebar(true, true); $('#sb-filter').focus(); }
  });

  window.PDC.router = { route: route };
  route();
})();
