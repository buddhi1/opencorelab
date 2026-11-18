/* Open Core Lab - feedback collector (Google Apps Script web app, bound to a Google Sheet).

   The site posts {app: 'opencorelab', records: [...]} as text/plain. Each record has a `type`; records are appended
   to the tab with that name (consent, profile, session, visit, feedback, survey, withdraw), one column per field.
   New fields simply add columns, so editing js/feedback-questions.js never needs a change here.
   A `withdraw` record deletes every row carrying its anonId. Setup: SETUP.md in this folder.

   Run `setup` once from the editor (it asks for permission and creates the tabs), then deploy as a web app. */

var APP = 'opencorelab';
var TYPES = ['consent', 'profile', 'session', 'visit', 'feedback', 'survey', 'withdraw'];
var MAX_BODY = 100 * 1024;     // characters per request
var MAX_RECORDS = 200;         // records per request
var MAX_FIELDS = 60;           // columns per record
var MAX_TEXT = 2000;           // characters per cell
var DEDUPE_SECONDS = 21600;    // remember record ids for 6 hours, so a resent batch is not stored twice

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  TYPES.forEach(function (t) { sheetFor_(ss, t); });
  Logger.log('Ready. Responses will be written to ' + ss.getUrl());
}

/* Opening the web-app URL in a browser shows this; handy for checking the deployment. */
function doGet() { return json_({ ok: true, app: APP }); }

function doPost(e) {
  var msg;
  try {
    var body = (e && e.postData && e.postData.contents) || '';
    if (body.length > MAX_BODY) return json_({ ok: false, error: 'request too large' });
    msg = JSON.parse(body);
  } catch (err) { return json_({ ok: false, error: 'not JSON' }); }
  if (!msg || msg.app !== APP || !Array.isArray(msg.records)) return json_({ ok: false, error: 'bad request' });
  if (msg.hp) return json_({ ok: true, stored: 0 });              // the hidden honeypot field was filled in: a bot

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return json_({ ok: false, error: 'busy, try again' });
  try { return json_({ ok: true, stored: store_(msg.records.slice(0, MAX_RECORDS)) }); }
  catch (err) { return json_({ ok: false, error: String(err && err.message || err) }); }
  finally { lock.releaseLock(); }
}

function store_(records) {
  var ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  var cache = CacheService.getScriptCache();
  var keys = records.map(function (r) { return r && typeof r.rid === 'string' && /^[0-9a-f]{8,40}$/.test(r.rid) ? 'rid:' + r.rid : ''; });
  var seen = cache.getAll(keys.filter(String)) || {};
  var byType = {}, withdraws = [], fresh = {}, n = 0;
  records.forEach(function (r, i) {
    var k = keys[i];
    if (!k || seen[k] || fresh[k] || TYPES.indexOf(r.type) < 0) return;
    fresh[k] = '1';
    if (r.type === 'withdraw') { withdraws.push(r); return; }
    (byType[r.type] = byType[r.type] || []).push(clean_(r));
    n++;
  });
  Object.keys(byType).forEach(function (t) { append_(sheetFor_(ss, t), byType[t]); });
  withdraws.forEach(function (r) {                                // after appending, so a same-batch withdraw also removes those rows
    append_(sheetFor_(ss, 'withdraw'), [{ rid: r.rid, v: r.v, at: r.at, deletedRows: deleteId_(ss, r.anonId) }]);
    n++;
  });
  if (Object.keys(fresh).length) cache.putAll(fresh, DEDUPE_SECONDS);
  return n;
}

/* One flat row per record: nested objects become "parent.child" columns, arrays become "a; b; c". */
function clean_(r) {
  var out = {}, count = 0;
  function put(k, v) {
    if (count >= MAX_FIELDS || !/^[A-Za-z][\w.]{0,60}$/.test(k)) return;
    if (v === null || v === undefined) v = '';
    if (Array.isArray(v)) v = v.join('; ');
    if (typeof v === 'object') v = JSON.stringify(v);
    if (typeof v === 'string') {
      v = v.slice(0, MAX_TEXT);
      if (/^[=+\-@]/.test(v)) v = "'" + v;                           // never let a student's text become a spreadsheet formula
    }
    out[k] = v; count++;
  }
  Object.keys(r).forEach(function (k) {
    var v = r[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.keys(v).forEach(function (k2) { put(k + '.' + k2, v[k2]); });
    else put(k, v);
  });
  return out;
}

function append_(sheet, rows) {
  var lastCol = sheet.getLastColumn();
  var header = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  if (!header.length || header[0] !== 'received') header = ['received'].concat(header.filter(String));
  rows.forEach(function (r) { Object.keys(r).forEach(function (k) { if (header.indexOf(k) < 0) header.push(k); }); });
  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  var now = new Date();
  var values = rows.map(function (r) { return header.map(function (h) { return h === 'received' ? now : (h in r ? r[h] : ''); }); });
  sheet.getRange(Math.max(sheet.getLastRow(), 1) + 1, 1, values.length, header.length).setValues(values);
}

/* Delete every row whose anonId column equals id, in every tab. Returns the number of rows removed. */
function deleteId_(ss, id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8,40}$/.test(id)) return 0;
  var removed = 0;
  TYPES.forEach(function (t) {
    var sh = ss.getSheetByName(t);
    if (!sh || sh.getLastRow() < 2) return;
    var data = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var col = data[0].indexOf('anonId');
    if (col < 0) return;
    for (var i = data.length - 1; i >= 1; i--) if (data[i][col] === id) { sh.deleteRow(i + 1); removed++; }
  });
  return removed;
}

function sheetFor_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1).setValue('received');
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
