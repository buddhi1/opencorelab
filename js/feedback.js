/* Feedback and consent: the first-visit consent dialog, the optional profile, the "did this help?" card at the end
   of each example, the course survey (#/feedback) and the privacy page (#/privacy).
   Nothing is recorded until the student chooses. Records wait in a localStorage queue and are posted to the
   Apps Script endpoint in feedback-config.js. Wording and questions live in feedback-questions.js.

   Modes:  full      usage records + profile + feedback, linked by a random anonymous id (18+ only)
           feedback  only ratings, comments and survey answers the student sends, with no id
           none      nothing, apart from one anonymous "declined" marker */
(function () {
  'use strict';
  const PDC = window.PDC;
  const Q = PDC.FEEDBACK_QUESTIONS, CFG = PDC.FEEDBACK || {};
  const C = Q.consent;
  const esc = PDC.esc;
  const $ = function (s, r) { return (r || document).querySelector(s); };

  const K = { consent: 'ocl-consent', id: 'ocl-anon-id', queue: 'ocl-queue', rated: 'ocl-rated', profile: 'ocl-profile-done' };
  const ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } },
    json: function (k, d) { try { const v = JSON.parse(ls.get(k)); return v === null ? d : v; } catch (e) { return d; } }
  };

  function hex(bytes) {
    const a = new Uint8Array(bytes);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < bytes; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.prototype.map.call(a, function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
  }
  const SID = hex(6);                                            // one id per page load ("session")
  function emitStatus() { document.dispatchEvent(new CustomEvent('ocl:fb')); }

  /* ---------- consent state ---------- */
  function consent() { const c = ls.json(K.consent, null); return c && c.v === C.version ? c : null; }
  function mode() { const c = consent(); return c ? c.mode : null; }
  function anonId() { return ls.get(K.id); }
  function canSendFeedback() { const m = mode(); return m === 'full' || m === 'feedback'; }

  /* ---------- queue + sending ---------- */
  const MAX_QUEUE = 400;
  function queue() { return ls.json(K.queue, []); }
  function pushRaw(rec) {
    const q = queue(); q.push(rec);
    while (q.length > MAX_QUEUE) {                               // drop the oldest usage record first, then the oldest of anything
      const i = q.findIndex(function (r) { return r.type === 'visit'; });
      q.splice(i >= 0 ? i : 0, 1);
    }
    ls.set(K.queue, JSON.stringify(q));
    return rec;
  }
  function record(type, fields) {
    const rec = { rid: hex(8), type: type, v: C.version, at: new Date().toISOString() };
    if (mode() === 'full') { rec.anonId = anonId(); rec.sid = SID; }
    return pushRaw(Object.assign(rec, fields));
  }

  let sending = false, honeypot = false;
  function dropSent(batch) {
    const sent = {}; batch.forEach(function (r) { sent[r.rid] = 1; });
    ls.set(K.queue, JSON.stringify(queue().filter(function (r) { return !sent[r.rid]; })));
  }
  /* Post up to 100 queued records. text/plain keeps it a "simple" request (no CORS preflight), which Apps Script needs.
     A beacon is used when the page is being hidden or closed, since fetch may be cancelled then. */
  function flush(beacon) {
    const q = queue();
    if (!CFG.endpoint || !q.length || (sending && !beacon)) return Promise.resolve(false);
    const batch = q.slice(0, 100);
    const body = JSON.stringify(Object.assign({ app: 'opencorelab', records: batch }, honeypot ? { hp: 1 } : {}));
    const done = function (ok) { sending = false; if (ok) dropSent(batch); emitStatus(); return ok; };
    if (beacon && navigator.sendBeacon) return Promise.resolve(done(navigator.sendBeacon(CFG.endpoint, new Blob([body], { type: 'text/plain;charset=utf-8' }))));
    sending = true;
    return fetch(CFG.endpoint, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
      .then(function (r) { return r.json(); })
      .then(function (j) { return done(!!(j && j.ok)); }, function () { return done(false); })
      .then(function (ok) { return ok && queue().length ? flush() : ok; });
  }

  /* ---------- device summary (deliberately coarse) ---------- */
  function bucket(v, edges, labels) { for (let i = 0; i < edges.length; i++) if (v < edges[i]) return labels[i]; return labels[labels.length - 1]; }
  function device() {
    const ua = navigator.userAgent || '';
    let br = ['Other', ''];
    [['Edge', /Edg\/(\d+)/], ['Opera', /OPR\/(\d+)/], ['Firefox', /Firefox\/(\d+)/], ['Chrome', /Chrome\/(\d+)/], ['Safari', /Version\/(\d+).*Safari/]].some(function (t) {
      const m = t[1].exec(ua); if (m) br = [t[0], m[1]]; return !!m;
    });
    const touch = (navigator.maxTouchPoints || 0) > 0;
    const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS'
      : /Mac OS X/.test(ua) ? (touch ? 'iPadOS' : 'macOS') : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
    const short = Math.min(screen.width || 0, screen.height || 0);
    let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* old browser */ }
    return {
      browser: br[0], browserVersion: br[1], os: os,
      form: short && short < 500 ? 'phone' : touch && short < 900 ? 'tablet' : 'desktop',
      viewport: bucket(window.innerWidth, [600, 900, 1280, 1600], ['<600', '600-899', '900-1279', '1280-1599', '1600+']),
      cores: navigator.hardwareConcurrency ? bucket(navigator.hardwareConcurrency, [3, 5, 9, 17], ['1-2', '3-4', '5-8', '9-16', '17+']) : '',
      memoryGB: navigator.deviceMemory || '', touch: touch, webgpu: !!navigator.gpu,
      timezone: tz, language: navigator.language || '',
      theme: document.documentElement.getAttribute('data-theme') || '',
      reducedMotion: !!PDC.reducedMotion
    };
  }

  /* ---------- usage: one "visit" record per page view (full mode only) ---------- */
  let visit = null, lastAct = Date.now(), lastPage = null;
  function startVisit(page, n) { visit = { page: page, n: n || 0, seen: {}, max: -1, t0: Date.now(), active: 0, ui: {} }; lastPage = { page: page, n: n }; }
  function endVisit() {
    const v = visit; visit = null;
    if (!v || mode() !== 'full') return;
    const steps = Object.keys(v.seen).length;
    record('visit', {
      page: v.page, steps: v.n || '', stepsSeen: v.n ? steps : '', lastStep: v.n ? v.max + 1 : '', completed: v.n ? v.max === v.n - 1 : '',
      activeSec: v.active, totalSec: Math.round((Date.now() - v.t0) / 1000), ui: v.ui
    });
  }
  ['pointerdown', 'keydown', 'wheel', 'scroll', 'mousemove', 'touchstart'].forEach(function (t) {
    window.addEventListener(t, function () { lastAct = Date.now(); }, { passive: true });
  });
  setInterval(function () {                                       // active = tab visible and some input in the last minute
    if (visit && document.visibilityState === 'visible' && Date.now() - lastAct < 60000) visit.active += 5;
  }, 5000);

  document.addEventListener('ocl:step', function (ev) {
    const d = ev.detail;
    lastAct = Date.now();
    if (!visit || visit.page !== d.key) { endVisit(); startVisit(d.key, d.n); }
    visit.seen[d.i] = 1; visit.max = Math.max(visit.max, d.i);
    if (d.i === d.n - 1) showCard();
  });
  document.addEventListener('ocl:route', function (ev) {
    const d = ev.detail;
    if (!visit || visit.page !== d.path) { endVisit(); startVisit(d.path, d.steps); }
    if (d.example) insertCard(d.path);
  });
  document.addEventListener('ocl:ui', function (ev) { if (visit) visit.ui[ev.detail.action] = (visit.ui[ev.detail.action] || 0) + 1; });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { const p = lastPage; endVisit(); lastPage = p; flush(true); }
    else if (lastPage && !visit) startVisit(lastPage.page, lastPage.n);
  });

  /* ---------- question rendering ---------- */
  function field(q, pre) {
    const name = pre + q.id;
    let h = '<fieldset class="fb-q" data-q="' + q.id + '" data-type="' + q.type + '"><legend>' + esc(q.label) + '</legend>';
    if (q.type === 'scale') {
      let opts = '';
      for (let n = 1; n <= q.max; n++) opts += '<label class="fb-opt sq"><input type="radio" name="' + name + '" value="' + n + '" aria-label="' + n + ' of ' + q.max + '"><span>' + n + '</span></label>';
      h += '<div class="fb-scale"><small>' + esc(q.low) + '</small>' + opts + '<small>' + esc(q.high) + '</small></div>';
    } else if (q.type === 'choice' || q.type === 'multi') {
      const t = q.type === 'choice' ? 'radio' : 'checkbox';
      h += '<div class="fb-opts">' + q.options.map(function (o) {
        return '<label class="fb-opt"><input type="' + t + '" name="' + name + '" value="' + esc(o) + '"><span>' + esc(o) + '</span></label>';
      }).join('') + '</div>';
    } else if (q.type === 'text') h += '<input class="fb-text" type="text" name="' + name + '" maxlength="' + (q.max || 300) + '" autocomplete="off">';
    else h += '<textarea class="fb-text" name="' + name + '" rows="4" maxlength="' + (q.max || 2000) + '"></textarea>';
    return h + '</fieldset>';
  }
  const HP = '<input class="fb-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">';   // bots fill this in; people never see it
  function form(qs, pre) { return qs.map(function (q) { return field(q, pre); }).join('') + HP; }
  /* the answers in a form, or null when nothing was answered */
  function answers(f) {
    if ($('.fb-hp', f) && $('.fb-hp', f).value) honeypot = true;
    const out = {}; let n = 0;
    f.querySelectorAll('.fb-q[data-q]').forEach(function (fs) {
      const t = fs.dataset.type;
      let v;
      if (t === 'multi') v = Array.prototype.map.call(fs.querySelectorAll('input:checked'), function (i) { return i.value; }).join('; ');
      else if (t === 'text' || t === 'longtext') v = $('.fb-text', fs).value.trim();
      else { const c = $('input:checked', fs); v = c ? (t === 'scale' ? +c.value : c.value) : ''; }
      if (v !== '') n++;
      out[fs.dataset.q] = v;
    });
    return n ? out : null;
  }
  /* feedback-only records carry the age group (coarse) instead of an id */
  function who() { const c = consent(); return c && c.mode === 'feedback' ? { age: c.age } : {}; }

  /* ---------- dialog (consent, then the optional profile) ---------- */
  let dlg = null, returnFocus = null;
  function closeDialog() {
    if (!dlg) return;
    dlg.remove(); dlg = null; document.body.classList.remove('fb-lock');
    if (returnFocus && returnFocus.focus) returnFocus.focus({ preventScroll: true });
  }
  function dialog(html) {
    if (!dlg) {
      returnFocus = document.activeElement;
      dlg = document.createElement('div');
      dlg.className = 'fb-overlay';
      dlg.addEventListener('keydown', function (ev) {
        ev.stopPropagation();                                      // keep the animation shortcuts from firing behind the dialog
        if (ev.key !== 'Tab') return;
        const f = dlg.querySelectorAll('button:not(:disabled), input, a[href], textarea');
        if (!f.length) return;
        if (ev.shiftKey && document.activeElement === f[0]) { f[f.length - 1].focus(); ev.preventDefault(); }
        else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { f[0].focus(); ev.preventDefault(); }
      });
      document.body.appendChild(dlg);
      document.body.classList.add('fb-lock');
    }
    dlg.onclick = dlg.onchange = null;                             // the consent view's handlers must not outlive it
    dlg.innerHTML = '<div class="fb-dialog" role="dialog" aria-modal="true" aria-labelledby="fb-title">' + html + '</div>';
    const first = $('.fb-dialog button', dlg);
    if (first) first.focus({ preventScroll: true });
    return dlg;
  }

  function openConsent() {
    const ch = C.choices;
    const btn = function (m, cls) {
      return '<button type="button" class="fb-choice' + cls + '" data-mode="' + m + '"><b>' + esc(ch[m].label) + '</b><small>' + esc(ch[m].help) + '</small></button>';
    };
    const d = dialog(
      '<p class="label">' + esc(C.label) + '</p><h2 id="fb-title">' + esc(C.title) + '</h2>' +
      '<p class="fb-intro">' + esc(C.intro) + '</p>' +
      '<ul class="fb-points">' + C.points.map(function (p) { return '<li>' + p + '</li>'; }).join('') + '</ul>' +
      '<div class="fb-choices">' + btn('full', ' primary') + btn('feedback', '') + btn('none', ' quiet') + '</div>' +
      '<p class="fb-small">' + esc(C.adultNote) + ' <button type="button" class="fb-link" data-act="age" aria-expanded="false">' + esc(C.under18Link) + '</button></p>' +
      '<div class="fb-age" hidden><div class="fb-opts">' + C.ages.map(function (a, i) {
        return '<label class="fb-opt"><input type="radio" name="fb-age" value="' + a.v + '"' + (i ? '' : ' checked') + '><span>' + esc(a.label) + '</span></label>';
      }).join('') + '</div><p class="fb-small fb-age-note" aria-live="polite"></p></div>');
    const age = function () { const r = $('input[name="fb-age"]:checked', d); return r ? r.value : '18+'; };
    const sync = function () {
      const a = age(), info = C.ages.find(function (x) { return x.v === a; });
      $('[data-mode="full"]', d).disabled = a !== '18+';
      $('[data-mode="feedback"]', d).disabled = a === 'under13';
      $('.fb-age-note', d).textContent = info ? info.note : '';
    };
    d.onclick = function (ev) {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.act === 'age') { const box = $('.fb-age', d); box.hidden = !box.hidden; b.setAttribute('aria-expanded', !box.hidden); return; }
      if (b.dataset.mode) choose(b.dataset.mode, age());
    };
    d.onchange = sync;
  }

  function choose(m, age) {
    const was = mode();
    ls.set(K.consent, JSON.stringify({ mode: m, age: m === 'none' ? '' : age, v: C.version, at: new Date().toISOString() }));
    if (m === 'full' && !anonId()) ls.set(K.id, hex(8));
    if (m === 'none') {
      if (was !== 'none') pushRaw({ rid: hex(8), type: 'consent', v: C.version, at: new Date().toISOString().slice(0, 10), choice: 'declined' });
    } else record('consent', { choice: m, age: age });
    if (m === 'full') {
      record('session', device());
      if (lastPage) startVisit(lastPage.page, lastPage.n);        // usage counts from the moment of consent, not before
    }
    flush(); emitStatus();
    if (m === 'full' && !ls.get(K.profile)) openProfile(); else closeDialog();
    refreshPage();
  }

  function openProfile() {
    const P = Q.profile;
    const d = dialog('<p class="label">' + esc(C.label) + ' &nbsp;/&nbsp; Optional</p><h2 id="fb-title">' + esc(P.title) + '</h2><p class="fb-intro">' + esc(P.intro) + '</p>' +
      '<form class="fb-form">' + form(P.questions, 'fbp-') +
      '<div class="fb-actions"><button type="submit" class="btn primary">Save</button><button type="button" class="btn" data-act="skip">Skip</button></div></form>');
    $('form', d).onsubmit = function (ev) {
      ev.preventDefault();
      const a = answers(ev.target);
      if (a && mode() === 'full') { record('profile', a); flush(); }
      ls.set(K.profile, '1'); closeDialog(); refreshPage();
    };
    $('[data-act="skip"]', d).onclick = function () { ls.set(K.profile, '1'); closeDialog(); };
  }

  /* ---------- "did this help?" card at the end of an example ---------- */
  function rated() { return ls.json(K.rated, []); }
  const dismissed = {};
  function insertCard(key) {
    const stage = $('.page.example .stage');
    if (!stage || !canSendFeedback() || rated().indexOf(key) >= 0 || dismissed[key]) return;
    const E = Q.example;
    const card = document.createElement('section');
    card.className = 'card fb-card'; card.id = 'fb-card'; card.hidden = true; card.dataset.key = key;
    card.setAttribute('aria-label', E.title);
    card.innerHTML = '<p class="label">Quick feedback</p><h2>' + esc(E.title) + '</h2><form class="fb-form">' + form(E.questions, 'fbx-') +
      '<div class="fb-actions"><button type="submit" class="btn primary small">Send</button><button type="button" class="btn small" data-act="later">Not now</button>' +
      '<span class="fb-status" aria-live="polite"></span></div></form>';
    stage.parentNode.insertBefore(card, stage.nextSibling);
    $('form', card).onsubmit = function (ev) {
      ev.preventDefault();
      const a = answers(ev.target);
      if (!a) { $('.fb-status', card).textContent = 'Pick at least one answer first.'; return; }
      record('feedback', Object.assign({ page: key }, who(), a));
      const r = rated(); r.push(key); ls.set(K.rated, JSON.stringify(r));
      card.innerHTML = '<p class="label">Quick feedback</p><p class="fb-thanks">Thanks! That helps us improve this example.</p>';
      flush();
    };
    $('[data-act="later"]', card).onclick = function () { dismissed[key] = 1; card.remove(); };
    if (visit && visit.page === key && visit.n && visit.max === visit.n - 1) showCard();
  }
  function showCard() { const c = $('#fb-card'); if (c) c.hidden = false; }

  /* ---------- pages: #/feedback and #/privacy ---------- */
  function crumbs(t) { return '<nav class="crumbs"><a href="#/">Home</a> &rsaquo; <span>' + esc(t) + '</span></nav>'; }
  function refreshPage() { const h = location.hash; if (h === '#/privacy' || h === '#/feedback') PDC.router.route(); }

  function pageSurvey(main) {
    const S = Q.survey;
    let h = '<div class="page fb-page">' + crumbs(S.title) + '<p class="label">' + esc(C.label) + ' &nbsp;/&nbsp; Feedback</p><h1>' + esc(S.title) + '</h1><p class="lead">' + esc(S.intro) + '</p>';
    if (canSendFeedback()) {
      h += '<form class="card fb-form fb-survey">' + form(S.questions, 'fbs-') +
        '<div class="fb-actions"><button type="submit" class="btn primary">Send feedback</button><span class="fb-status" aria-live="polite"></span></div></form>';
    } else {
      h += '<div class="card fb-off"><p>Feedback is switched off in your privacy settings. You can turn it on any time.</p>' +
        '<button type="button" class="btn primary" data-act="consent">Change my choice</button></div>';
    }
    main.innerHTML = h + '</div>';
    const f = $('.fb-survey', main);
    if (f) f.onsubmit = function (ev) {
      ev.preventDefault();
      const a = answers(f);
      if (!a) { $('.fb-status', f).textContent = 'Answer at least one question first.'; return; }
      record('survey', Object.assign(who(), a));
      f.outerHTML = '<div class="card fb-off"><p class="fb-thanks">Thank you! Your feedback has been saved.</p><a class="btn" href="#/">Back to the examples</a></div>';
      flush();
    };
    const b = $('[data-act="consent"]', main);
    if (b) b.onclick = openConsent;
  }

  function pagePrivacy(main) {
    const m = mode(), c = consent(), q = queue();
    const status = { full: 'You are sharing usage info and feedback.', feedback: 'You are sharing only the feedback you send.', none: 'You are not sharing any data.' }[m] || 'You have not chosen yet.';
    const sent = !CFG.endpoint ? ' (Sending is not switched on yet, so they are kept in your browser.)' : '';
    main.innerHTML = '<div class="page fb-page">' + crumbs('Privacy & data') + '<p class="label">' + esc(C.label) + ' &nbsp;/&nbsp; Privacy</p><h1>Privacy &amp; data</h1>' +
      '<div class="card fb-status-card"><p class="fb-now">' + esc(status) + (c && c.at ? ' <span class="muted">Since ' + esc(c.at.slice(0, 10)) + '.</span>' : '') + '</p>' +
      '<div class="fb-actions"><button type="button" class="btn primary" data-act="consent">Change my choice</button>' +
      (m === 'full' ? '<button type="button" class="btn" data-act="profile">Update my profile</button>' : '') +
      (m === 'full' || anonId() ? '<button type="button" class="btn" data-act="delete">Delete my data</button>' : '') + '</div>' +
      '<p class="fb-small fb-del-note" aria-live="polite"></p></div>' +
      '<section class="card notes"><h2>What we collect</h2><ul>' + C.points.map(function (p) { return '<li>' + p + '</li>'; }).join('') +
      '<li>With “Only feedback I send”, ratings and comments are sent without any id, so they cannot be linked to you or to each other.</li>' +
      '<li>If you choose “No thanks”, we only count that someone said no.</li></ul></section>' +
      '<section class="card notes"><h2>Waiting to be sent</h2><p>' + (q.length ? q.length + ' record' + (q.length > 1 ? 's are' : ' is') + ' stored in this browser and not yet sent.' + esc(sent) : 'Nothing is waiting to be sent.') + '</p>' +
      (q.length ? '<details class="fb-preview"><summary>Show exactly what will be sent</summary><pre>' + esc(JSON.stringify(q, null, 2)) + '</pre></details>' +
        (CFG.endpoint ? '<div class="fb-actions"><button type="button" class="btn small" data-act="send">Send now</button></div>' : '') : '') +
      (anonId() ? '<p class="fb-small">Your anonymous id: <code>' + esc(anonId()) + '</code></p>' : '') + '</section></div>';
    main.onclick = function (ev) {
      const b = ev.target.closest('button[data-act]');
      if (!b) return;
      const a = b.dataset.act;
      if (a === 'consent') openConsent();
      else if (a === 'profile') openProfile();
      else if (a === 'send') flush().then(refreshPage);
      else if (a === 'delete') {
        if (!b.classList.contains('confirm')) { b.classList.add('confirm'); b.textContent = 'Click again to delete'; return; }
        deleteMyData(); refreshPage();
      }
    };
    return function () { main.onclick = null; };
  }

  /* drop anything unsent and ask the backend to delete every row stored under this browser's id */
  function deleteMyData() {
    const id = anonId();
    visit = null;
    ls.set(K.queue, '[]');
    if (id) pushRaw({ rid: hex(8), type: 'withdraw', v: C.version, at: new Date().toISOString().slice(0, 10), anonId: id });
    ls.del(K.id); ls.del(K.profile);
    ls.set(K.consent, JSON.stringify({ mode: 'none', age: '', v: C.version, at: new Date().toISOString() }));
    flush(); emitStatus();
  }

  PDC.pages = PDC.pages || {};
  PDC.pages.feedback = { title: Q.survey.title, render: pageSurvey };
  PDC.pages.privacy = { title: 'Privacy & data', render: pagePrivacy };

  /* ---------- start ---------- */
  if (mode() === 'full') record('session', device());
  if (!mode()) setTimeout(openConsent, 0);                         // after the first route, which moves focus to <main>
  setTimeout(function () { flush(); }, 3000);
  setInterval(function () { flush(); }, CFG.sendEveryMs || 120000);

  PDC.fb = { mode: mode, queue: queue, flush: flush, openConsent: openConsent, openProfile: openProfile, deleteMyData: deleteMyData };
})();
