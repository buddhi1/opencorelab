#!/usr/bin/env node
/* Runs feedback-backend/Code.gs and Form.gs in Node against small in-memory fakes of the Apps Script services
   (SpreadsheetApp, CacheService, LockService, PropertiesService, ContentService, FormApp).
   Usage:  node tools/test_backend.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const DIR = path.resolve(__dirname, '..', 'feedback-backend');

/* ---------- fakes ---------- */
function Sheet(name) { this.name = name; this.data = []; this.frozen = 0; }
Sheet.prototype = {
  getLastRow: function () { return this.data.length; },
  getLastColumn: function () { return this.data.reduce(function (m, r) { return Math.max(m, r.length); }, 0); },
  getRange: function (r, c, nr, nc) {
    const sh = this; nr = nr || 1; nc = nc || 1;
    return {
      getValues: function () {
        const out = [];
        for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (sh.data[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined ? '' : v); } out.push(row); }
        return out;
      },
      setValues: function (m) {
        if (m.length !== nr || m.some(function (row) { return row.length !== nc; })) throw new Error('setValues size mismatch');
        m.forEach(function (row, i) { const R = sh.data[r - 1 + i] = sh.data[r - 1 + i] || []; row.forEach(function (v, j) { R[c - 1 + j] = v; }); });
      },
      setValue: function (v) { this.setValues([[v]]); }
    };
  },
  deleteRow: function (i) { this.data.splice(i - 1, 1); },
  setFrozenRows: function (n) { this.frozen = n; },
  rows: function () { const h = this.data[0]; return this.data.slice(1).map(function (r) { const o = {}; h.forEach(function (k, i) { o[k] = r[i] === undefined ? '' : r[i]; }); return o; }); }
};
function services() {
  const sheets = {}, props = {}, cache = {};
  const ss = {
    getId: function () { return 'sheet-1'; }, getUrl: function () { return 'https://docs.google.com/spreadsheets/d/sheet-1'; },
    getSheetByName: function (n) { return sheets[n] || null; },
    insertSheet: function (n) { return (sheets[n] = new Sheet(n)); }
  };
  const formLog = [];
  function item(kind) {
    const it = { kind: kind };
    ['setTitle', 'setRequired', 'setBounds', 'setLabels', 'setHelpText', 'setChoiceValues', 'setChoices'].forEach(function (m) {
      it[m] = function () { it[m.slice(3).toLowerCase()] = Array.prototype.slice.call(arguments); return it; };
    });
    it.createChoice = function (t, nav) { return { t: t, nav: nav }; };
    formLog.push(it); return it;
  }
  const form = {};
  ['setDescription', 'setCollectEmail', 'setAllowResponseEdits', 'setShowLinkToRespondAgain', 'setDestination', 'setPublished'].forEach(function (m) { form[m] = function () { form[m.slice(3)] = arguments[0]; return form; }; });
  ['MultipleChoice', 'PageBreak', 'Scale', 'Checkbox', 'Text', 'ParagraphText'].forEach(function (k) { form['add' + k + 'Item'] = function () { return item(k); }; });
  form.getEditUrl = function () { return 'edit-url'; }; form.getPublishedUrl = function () { return 'share-url'; };
  return {
    sheets: sheets, formLog: formLog, form: form,
    ctx: {
      SpreadsheetApp: { getActiveSpreadsheet: function () { return ss; }, openById: function (id) { if (id !== 'sheet-1') throw new Error('bad id ' + id); return ss; } },
      PropertiesService: { getScriptProperties: function () { return { getProperty: function (k) { return props[k] || null; }, setProperty: function (k, v) { props[k] = v; } }; } },
      CacheService: { getScriptCache: function () { return {
        getAll: function (ks) { const o = {}; ks.forEach(function (k) { if (k in cache) o[k] = cache[k]; }); return o; },
        putAll: function (o) { Object.assign(cache, o); } }; } },
      LockService: { getScriptLock: function () { return { tryLock: function () { return true; }, releaseLock: function () {} }; } },
      ContentService: { MimeType: { JSON: 'json' }, createTextOutput: function (s) { return { body: s, setMimeType: function () { return this; } }; } },
      FormApp: { create: function (t) { form.title = t; return form; }, DestinationType: { SPREADSHEET: 'SPREADSHEET' }, PageNavigationType: { SUBMIT: 'SUBMIT' } },
      Logger: { log: function () {} }
    }
  };
}

/* ---------- tests ---------- */
const S = services();
const ctx = vm.createContext(S.ctx);
vm.runInContext(fs.readFileSync(path.join(DIR, 'Code.gs'), 'utf8'), ctx);
const post = function (o) { return JSON.parse(ctx.doPost({ postData: { contents: typeof o === 'string' ? o : JSON.stringify(o) } }).body); };
const rec = function (type, extra) { return Object.assign({ rid: Math.random().toString(16).slice(2, 18).padEnd(16, '0'), type: type, v: 1, at: '2026-10-29T12:00:00Z' }, extra); };

const res = [];
const ok = function (name, cond, info) { res.push({ name: name, pass: !!cond, info: info }); };

ctx.setup();
ok('setup creates one tab per record type', ['consent', 'profile', 'session', 'visit', 'feedback', 'survey', 'withdraw'].every(function (t) { return S.sheets[t] && S.sheets[t].frozen === 1; }));
ok('doGet answers', JSON.parse(ctx.doGet().body).ok === true);

const id = 'a1b2c3d4e5f60718';
const r1 = rec('consent', { choice: 'full', age: '18+', anonId: id, sid: 'abc123' });
const r2 = rec('session', { anonId: id, sid: 'abc123', browser: 'Chrome', ui: { play: 2 } });
const r3 = rec('visit', { anonId: id, page: 'pdc/mpi/hello', stepsSeen: 5, completed: true, ui: { play: 2, codeclick: 1 } });
const r4 = rec('feedback', { page: 'pdc/mpi/hello', helpful: 4, comment: '=HYPERLINK("http://x")' });
let out = post({ app: 'opencorelab', records: [r1, r2, r3, r4] });
ok('valid batch is stored', out.ok && out.stored === 4, JSON.stringify(out));
ok('rows land in the tab named by type', S.sheets.visit.rows().length === 1 && S.sheets.visit.rows()[0].page === 'pdc/mpi/hello');
ok('header starts with "received" and grows per field', S.sheets.visit.data[0][0] === 'received' && S.sheets.visit.data[0].indexOf('stepsSeen') > 0);
ok('nested objects become dotted columns', S.sheets.visit.rows()[0]['ui.codeclick'] === 1, JSON.stringify(S.sheets.visit.data[0]));
ok('text that looks like a formula is escaped', S.sheets.feedback.rows()[0].comment.charAt(0) === "'", S.sheets.feedback.rows()[0].comment);
ok('received timestamp is a Date', S.sheets.visit.rows()[0].received instanceof Date || Object.prototype.toString.call(S.sheets.visit.rows()[0].received) === '[object Date]');

out = post({ app: 'opencorelab', records: [r3] });
ok('a resent record is not stored twice', out.ok && out.stored === 0 && S.sheets.visit.rows().length === 1, JSON.stringify(out));

out = post({ app: 'opencorelab', records: [rec('visit', { anonId: id, page: 'home', newField: 'x' })] });
ok('a new field adds a column without disturbing old rows', S.sheets.visit.data[0].indexOf('newField') > 0 && S.sheets.visit.rows()[0].page === 'pdc/mpi/hello' && S.sheets.visit.rows()[1].newField === 'x');

const other = rec('visit', { anonId: 'ffff0000ffff0000', page: 'hpml' });
post({ app: 'opencorelab', records: [other, rec('consent', { choice: 'declined' })] });
ok('declined marker is stored without an id', S.sheets.consent.rows().some(function (r) { return r.choice === 'declined' && !r.anonId; }));

out = post({ app: 'opencorelab', records: [rec('withdraw', { anonId: id })] });
const left = ['consent', 'session', 'visit'].reduce(function (n, t) { return n + S.sheets[t].rows().filter(function (r) { return r.anonId === id; }).length; }, 0);
ok('withdraw deletes every row with that anonId', out.ok && left === 0, JSON.stringify(out));
ok('withdraw keeps other students\' rows', S.sheets.visit.rows().some(function (r) { return r.anonId === 'ffff0000ffff0000'; }));
ok('withdraw log records the count but not the id', S.sheets.withdraw.rows()[0].deletedRows === 4 && S.sheets.withdraw.data[0].indexOf('anonId') < 0, JSON.stringify(S.sheets.withdraw.rows()));

const before = S.sheets.feedback.rows().length;
ok('honeypot requests are ignored', post({ app: 'opencorelab', hp: 1, records: [rec('feedback', { helpful: 1 })] }).stored === 0 && S.sheets.feedback.rows().length === before);
ok('wrong app name is rejected', post({ app: 'other', records: [] }).ok === false);
ok('non-JSON is rejected', post('hello').ok === false);
ok('oversized request is rejected', post({ app: 'opencorelab', records: [rec('feedback', { comment: 'x'.repeat(120000) })] }).ok === false);
ok('unknown record types are skipped', post({ app: 'opencorelab', records: [rec('evil', { a: 1 })] }).stored === 0 && !S.sheets.evil);
ok('records without a valid rid are skipped', post({ app: 'opencorelab', records: [Object.assign(rec('feedback', {}), { rid: 'x y' })] }).stored === 0);
const long = rec('feedback', { comment: 'y'.repeat(5000) });
post({ app: 'opencorelab', records: [long] });
ok('long text is trimmed to 2000 characters', S.sheets.feedback.rows().slice(-1)[0].comment.length === 2000);

/* Form.gs (generated) */
const formFile = path.join(DIR, 'Form.gs');
if (fs.existsSync(formFile)) {
  vm.runInContext(fs.readFileSync(formFile, 'utf8'), ctx);
  ctx.buildForm();
  const kinds = S.formLog.map(function (i) { return i.kind; });
  const ageItem = S.formLog[0];
  ok('buildForm: age question first, with page branching', ageItem.kind === 'MultipleChoice' && ageItem.choices[0].length === 3 && ageItem.choices[0][2].nav === 'SUBMIT');
  ok('buildForm: two page breaks (profile, survey)', kinds.filter(function (k) { return k === 'PageBreak'; }).length === 2, kinds.join(','));
  ok('buildForm: responses go to the spreadsheet', S.form.Destination === 'SPREADSHEET');
  ok('buildForm: every question is created', kinds.length === 1 + 2 + ctx.FORM_SPEC.profile.questions.length + ctx.FORM_SPEC.survey.questions.length, kinds.length);
} else ok('Form.gs exists (run node tools/build_form.js)', false);

let failed = 0;
res.forEach(function (r) { if (!r.pass) failed++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.name + (!r.pass && r.info !== undefined ? '   [' + r.info + ']' : '')); });
console.log('\n' + (res.length - failed) + '/' + res.length + ' checks passed');
process.exit(failed ? 1 : 0);
