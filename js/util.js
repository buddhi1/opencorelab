/* Shared helpers and registry for the PDC / HPML visual lab. */
(function () {
  'use strict';
  const PDC = (window.PDC = window.PDC || {});

  PDC.REPO = 'https://github.com/buddhi1/pdc-class';         // course source code (per-file links)
  PDC.SITE_REPO = 'https://github.com/buddhi1/opencorelab';  // this website's own code
  PDC.BRANCH = 'main';
  PDC.kinds = {};          // animation engines, keyed by name
  PDC.courses = [];        // [{id,title,blurb,topics:[{id,title,blurb}]}]
  PDC.examples = [];       // flat list of registered examples

  PDC.esc = function (s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  /* Colour class for the n-th thread / rank / GPU (cycles through 8 colours). */
  PDC.col = function (n) { return 'c' + (((n % 8) + 8) % 8); };

  PDC.clamp = function (v, lo, hi) { return Math.max(lo, Math.min(hi, v)); };

  /* Register a course (once) and its topics. */
  PDC.defineCourse = function (c) { PDC.courses.push(c); };

  /* Register an example. Fields are documented in README.md. */
  PDC.add = function (ex) {
    if (!ex.id || !ex.course || !ex.topic) throw new Error('example needs id/course/topic: ' + JSON.stringify(ex.id));
    ex.files = ex.files || [];
    ex.concepts = ex.concepts || [];
    /* every example also shows its folder's Makefile as a last tab ("how do I build this?") */
    if (ex.files.length && window.PDC_SOURCES) {
      const dir = ex.files[0].replace(/[^/]*$/, '');
      ['Makefile', 'makefile'].forEach(function (n) {
        if (window.PDC_SOURCES[dir + n] && ex.files.indexOf(dir + n) < 0) ex.files.push(dir + n);
      });
    }
    PDC.examples.push(ex);
    return ex;
  };

  /* Clone an existing example with overrides - used when two folders hold near-copies. */
  PDC.reuse = function (base, over) {
    const c = Object.assign({}, base, over);
    return PDC.add(c);
  };

  /* Fly an SVG token <g data-f="x1,y1,x2,y2,dur,delay"> from its start to its end point (Web Animations API). */
  PDC.reducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  PDC.fly = function (el) {
    const f = el.getAttribute('data-f').split(',').map(Number);
    const from = 'translate(' + f[0] + 'px,' + f[1] + 'px)', to = 'translate(' + f[2] + 'px,' + f[3] + 'px)';
    el.style.transform = to;
    if (!el.animate || PDC.reducedMotion) return;
    el.animate([{ transform: from, opacity: 0.2 }, { transform: from, opacity: 1, offset: 0.08 }, { transform: to, opacity: 1 }],
      { duration: f[4] * 1000, delay: f[5] * 1000, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'backwards' });
  };

  PDC.repoUrl =function (path) { return PDC.REPO + '/blob/' + PDC.BRANCH + '/' + path; };
  PDC.baseName = function (p) { return p.split('/').pop(); };
})();
