/**
 * RURR Advisors — website forms + complaints reporting backend (Google Apps Script)
 * ----------------------------------------------------------------
 * - Receives contact enquiries and investor grievances from the website.
 * - Writes them to the Contacts / Complaints sheets.
 * - Powers the grievance tracker (lookup by ticket).
 * - Aggregates the Complaints sheet into the SEBI-format complaints tables
 *   that the website renders live (?report=complaints).
 * - Auto-stamps the resolution date when you set a complaint's Stage to 3.
 *
 * The Complaints sheet is the SINGLE source of truth. Your only ongoing task:
 *   • new complaints arrive via the form automatically;
 *   • to resolve one, set its Stage cell to 3 (Status + Resolved-on auto-fill);
 *   • for complaints that arrive via SEBI SCORES, add a row and set Source = "SEBI (SCORES)".
 *
 * Columns are matched by HEADER NAME, so you can reorder/add columns safely.
 * After editing this file you must redeploy: Deploy → Manage deployments →
 * Edit → Version: New version → Deploy.
 *
 * NOTE: an Apps Script web app always responds HTTP 200, so the website checks
 * JSON flags ({ ok }, { found }) rather than status codes.
 */

// ====== CONFIG ======
var FIRM_NAME       = 'RURR Advisors';
var NOTIFY_EMAIL    = 'rurradvisors@gmail.com'; // where new submissions are emailed
var SEND_ACK_EMAILS = true;                     // also email the visitor an acknowledgement
var TICKET_PREFIX   = 'RA';
var RESOLUTION_DAYS = 21;                        // expected-resolution window for complaints
var TREND_MONTHS    = 12;                        // months shown in the monthly-trend table
var TZ              = 'Asia/Kolkata';
var CONTACT_SHEET   = 'Contacts';
var COMPLAINT_SHEET = 'Complaints';

var CONTACT_HEADERS   = ['Timestamp', 'Name', 'Email', 'Phone', 'Interest', 'Message'];
var COMPLAINT_HEADERS = ['Ticket', 'Opened', 'Name', 'Email', 'Phone', 'Category', 'Details',
                         'Source', 'Status', 'Stage', 'Last update', 'Expected resolution', 'Resolved on'];
var SOURCES = ['Directly from investors', 'SEBI (SCORES)', 'Other sources'];

// =================== ROUTES ===================
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.report === 'complaints') return json(buildComplaintsReport_());
  var ticket = (p.ticket || '').toString().trim().toUpperCase();
  if (ticket) {
    var row = findComplaint_(ticket);
    return row
      ? json({ found: true, num: row.ticket, status: row.status, opened: row.opened, updated: row.updated, eta: row.eta, stage: row.stage })
      : json({ found: false });
  }
  return json({ ok: true, service: FIRM_NAME + ' forms backend' });
}

function doPost(e) {
  try {
    var data = (e && e.postData && e.postData.contents) ? JSON.parse(e.postData.contents) : {};
    return (data.type === 'complaint') ? handleComplaint_(data) : handleContact_(data);
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

// =================== SUBMISSIONS ===================
function handleContact_(d) {
  var sheet = ensureSheet_(CONTACT_SHEET, CONTACT_HEADERS);
  appendByHeader_(sheet, headerMap_(sheet), {
    'timestamp': new Date(), 'name': d.name || '', 'email': d.email || '',
    'phone': d.phone || '', 'interest': d.interest || '', 'message': d.message || ''
  });

  safeMail_(NOTIFY_EMAIL, 'New website enquiry — ' + (d.name || 'Unknown'),
    'Name: ' + (d.name || '') + '\nEmail: ' + (d.email || '') + '\nPhone: ' + (d.phone || '') +
    '\nInterest: ' + (d.interest || '') + '\n\n' + (d.message || ''), d.email);
  if (SEND_ACK_EMAILS && d.email) {
    safeMail_(d.email, 'We received your enquiry — ' + FIRM_NAME,
      'Hi ' + (d.name || '') + ',\n\nThanks for contacting ' + FIRM_NAME +
      '. We have received your enquiry and will get back to you shortly.\n\n— ' + FIRM_NAME);
  }
  return json({ ok: true });
}

function handleComplaint_(d) {
  var sheet   = ensureSheet_(COMPLAINT_SHEET, COMPLAINT_HEADERS);
  var headers = headerMap_(sheet);
  var now     = new Date();
  var ticket  = newTicket_(sheet, headers);
  var opened  = fmt_(now);
  var eta     = fmt_(addDays_(now, RESOLUTION_DAYS));

  appendByHeader_(sheet, headers, {
    'ticket': ticket, 'opened': opened, 'name': d.name || '', 'email': d.email || '',
    'phone': d.phone || '', 'category': d.category || '', 'details': d.details || '',
    'source': 'Directly from investors', 'status': 'Received', 'stage': 1,
    'last update': opened, 'expected resolution': eta, 'resolved on': ''
  });

  safeMail_(NOTIFY_EMAIL, 'New complaint ' + ticket + ' — ' + (d.name || 'Unknown'),
    'Ticket: ' + ticket + '\nName: ' + (d.name || '') + '\nEmail: ' + (d.email || '') +
    '\nPhone: ' + (d.phone || '') + '\nCategory: ' + (d.category || '') + '\n\n' + (d.details || ''), d.email);
  if (SEND_ACK_EMAILS && d.email) {
    safeMail_(d.email, 'Your complaint is registered — ' + ticket,
      'Hi ' + (d.name || '') + ',\n\nWe have registered your complaint. Your ticket number is ' +
      ticket + '. You can track its status on our website using this number.\n\n' +
      'Expected resolution by: ' + eta + '\n\n— ' + FIRM_NAME);
  }
  return json({ ok: true, ticket: ticket });
}

// =================== TRACKER ===================
function findComplaint_(ticket) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(COMPLAINT_SHEET);
  if (!sheet) return null;
  var h = headerMap_(sheet);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][h['ticket'] - 1]).trim().toUpperCase() === ticket) {
      return {
        ticket:  values[i][h['ticket'] - 1],
        opened:  fmtCell_(values[i][h['opened'] - 1]),
        status:  values[i][h['status'] - 1],
        stage:   Number(values[i][h['stage'] - 1]) || 1,
        updated: fmtCell_(values[i][h['last update'] - 1]),
        eta:     fmtCell_(values[i][h['expected resolution'] - 1])
      };
    }
  }
  return null;
}

// =================== REPORTING (aggregation) ===================
function buildComplaintsReport_() {
  var now    = new Date();
  var nowIdx = monthIdx_(now);
  var nowYr  = Number(Utilities.formatDate(now, TZ, 'yyyy'));
  var sheet  = ensureSheet_(COMPLAINT_SHEET, COMPLAINT_HEADERS);
  var h      = headerMap_(sheet);
  var values = sheet.getDataRange().getValues();
  var threeMonthsAgo = addDays_(now, -90);

  var items = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    var open = parseDate_(cell_(r, h, 'opened'));
    if (!open) continue;
    var stage = Number(cell_(r, h, 'stage')) || 1;
    var resolved = stage === 3;
    var resD = resolved ? (parseDate_(cell_(r, h, 'resolved on')) || parseDate_(cell_(r, h, 'last update')) || open) : null;
    items.push({
      source:   normSource_(cell_(r, h, 'source')),
      open:     open,   openIdx: monthIdx_(open),   openYr: Number(Utilities.formatDate(open, TZ, 'yyyy')),
      resolved: resolved, resD: resD,
      resIdx:   resD ? monthIdx_(resD) : null,
      resYr:    resD ? Number(Utilities.formatDate(resD, TZ, 'yyyy')) : null
    });
  }

  // ----- Table 1: current month, by source -----
  function blank() { return { pendingStart: 0, received: 0, resolved: 0, totalPending: 0, pendingGt3m: 0, resSum: 0, resCount: 0 }; }
  var bySrc = {}; SOURCES.forEach(function (s) { bySrc[s] = blank(); });
  items.forEach(function (it) {
    var b = bySrc[it.source] || (bySrc[it.source] = blank());
    if (it.openIdx <= nowIdx - 1 && (!it.resolved || it.resIdx > nowIdx - 1)) b.pendingStart++;
    if (it.openIdx === nowIdx) b.received++;
    if (it.resolved && it.resIdx === nowIdx) { b.resolved++; b.resCount++; b.resSum += daysBetween_(it.open, it.resD); }
    if (!it.resolved) { b.totalPending++; if (it.open < threeMonthsAgo) b.pendingGt3m++; }
  });
  var t1rows = SOURCES.map(function (s) { return bucketRow_(s, bySrc[s]); });
  var t1total = bucketRow_('Grand total', mergeBuckets_(SOURCES.map(function (s) { return bySrc[s]; })));

  // ----- Table 2: monthly trend (trailing TREND_MONTHS) -----
  var t2rows = [];
  for (var k = TREND_MONTHS - 1; k >= 0; k--) {
    var idx = nowIdx - k;
    var carried = 0, rec = 0, res = 0;
    items.forEach(function (it) {
      if (it.openIdx <= idx - 1 && (!it.resolved || it.resIdx > idx - 1)) carried++;
      if (it.openIdx === idx) rec++;
      if (it.resolved && it.resIdx === idx) res++;
    });
    t2rows.push({ month: idxLabel_(idx), carried: carried, received: rec, resolved: res, pending: carried + rec - res });
  }

  // ----- Table 3: annual trend -----
  var minYr = nowYr;
  items.forEach(function (it) { if (it.openYr < minYr) minYr = it.openYr; });
  var t3rows = [];
  for (var y = minYr; y <= nowYr; y++) {
    var c = 0, rc = 0, rs = 0;
    items.forEach(function (it) {
      if (it.openYr <= y - 1 && (!it.resolved || (it.resYr && it.resYr > y - 1))) c++;
      if (it.openYr === y) rc++;
      if (it.resolved && it.resYr === y) rs++;
    });
    t3rows.push({ year: String(y), carried: c, received: rc, resolved: rs, pending: c + rc - rs });
  }

  return {
    ok: true,
    generatedAt: fmt_(now),
    monthLabel: Utilities.formatDate(now, TZ, 'MMM yyyy'),
    table1: { rows: t1rows, total: t1total },
    table2: { rows: t2rows, total: sumRR_(t2rows) },
    table3: { rows: t3rows, total: sumRR_(t3rows) }
  };
}

// =================== AUTO-RESOLVE on Stage edit ===================
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    if (sh.getName() !== COMPLAINT_SHEET) return;
    if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;
    var h = headerMap_(sh);
    if (e.range.getColumn() !== h['stage']) return;
    var row = e.range.getRow();
    if (row === 1) return;

    var stage = Number(e.range.getValue()) || 0;
    var now = new Date();
    setCell_(sh, h, row, 'status', stage === 3 ? 'Resolved' : (stage === 2 ? 'Under review' : 'Received'));
    setCell_(sh, h, row, 'last update', fmt_(now));
    if (stage === 3) {
      if (!getCell_(sh, h, row, 'resolved on')) setCell_(sh, h, row, 'resolved on', fmt_(now));
    } else {
      setCell_(sh, h, row, 'resolved on', '');
    }
  } catch (err) { /* never block the edit */ }
}

// =================== helpers ===================
function bucketRow_(label, b) {
  return {
    source: label, pendingStart: b.pendingStart, received: b.received, resolved: b.resolved,
    totalPending: b.totalPending, pendingGt3m: b.pendingGt3m,
    avgDays: b.resCount ? Math.round(b.resSum / b.resCount) : 0
  };
}
function mergeBuckets_(arr) {
  var t = { pendingStart: 0, received: 0, resolved: 0, totalPending: 0, pendingGt3m: 0, resSum: 0, resCount: 0 };
  arr.forEach(function (b) {
    t.pendingStart += b.pendingStart; t.received += b.received; t.resolved += b.resolved;
    t.totalPending += b.totalPending; t.pendingGt3m += b.pendingGt3m; t.resSum += b.resSum; t.resCount += b.resCount;
  });
  return t;
}
function sumRR_(rows) {
  var r = 0, s = 0;
  rows.forEach(function (x) { r += x.received; s += x.resolved; });
  return { received: r, resolved: s };
}
function normSource_(v) {
  var s = String(v || '').trim().toLowerCase();
  if (!s) return 'Directly from investors';
  if (s.indexOf('score') > -1 || s.indexOf('sebi') > -1) return 'SEBI (SCORES)';
  if (s.indexOf('investor') > -1 || s.indexOf('direct') > -1) return 'Directly from investors';
  return 'Other sources';
}

function ensureSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    return sheet;
  }
  var map = headerMap_(sheet);
  var missing = headers.filter(function (hd) { return !map[hd.toLowerCase()]; });
  if (missing.length) {
    sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
  }
  return sheet;
}
function headerMap_(sheet) {
  var hdr = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  hdr.forEach(function (h, i) { if (h !== '' && h !== null) map[String(h).trim().toLowerCase()] = i + 1; });
  return map;
}
function appendByHeader_(sheet, headers, obj) {
  var width = sheet.getLastColumn();
  var row = [];
  for (var i = 0; i < width; i++) row.push('');
  Object.keys(obj).forEach(function (k) { var c = headers[k]; if (c) row[c - 1] = obj[k]; });
  sheet.appendRow(row);
}
function cell_(rowArr, headers, name) { var c = headers[name]; return c ? rowArr[c - 1] : ''; }
function setCell_(sh, headers, row, name, val) { var c = headers[name]; if (c) sh.getRange(row, c).setValue(val); }
function getCell_(sh, headers, row, name) { var c = headers[name]; return c ? sh.getRange(row, c).getValue() : ''; }

function newTicket_(sheet, headers) {
  var year = Utilities.formatDate(new Date(), TZ, 'yyyy');
  var col = headers['ticket'];
  var seen = {};
  if (sheet.getLastRow() > 1 && col) {
    sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getValues().forEach(function (r) { seen[String(r[0])] = true; });
  }
  var t;
  do { t = TICKET_PREFIX + '-' + year + '-' + Math.floor(10000 + Math.random() * 90000); } while (seen[t]);
  return t;
}

function monthIdx_(d) {
  var p = Utilities.formatDate(d, TZ, 'yyyy-MM').split('-');
  return Number(p[0]) * 12 + (Number(p[1]) - 1);
}
function idxLabel_(idx) {
  var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return names[idx % 12] + ' ' + Math.floor(idx / 12);
}
function parseDate_(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'string' && v.trim()) { var d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  return null;
}
function daysBetween_(a, b) { return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000)); }
function addDays_(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmt_(d) { return Utilities.formatDate(d, TZ, 'dd MMM yyyy'); }
function fmtCell_(v) { return (v instanceof Date) ? Utilities.formatDate(v, TZ, 'dd MMM yyyy') : v; }

function safeMail_(to, subject, body, replyTo) {
  try {
    var opts = { to: to, subject: subject, body: body };
    if (replyTo) opts.replyTo = replyTo;
    MailApp.sendEmail(opts);
  } catch (err) { /* never let email failure break the submission */ }
}
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
