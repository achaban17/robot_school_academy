/**
 * Robot School Academy — серверна частина (Google Apps Script), версія 1.4.
 *
 * Що робить:
 *  - кожна філія має ОКРЕМУ Google Таблицю: аркуші «Учителі», «Прогрес» і прихований «_auth»;
 *  - головна таблиця методиста зберігає «Повідомлення» (питання від учителів і ваші відповіді)
 *    і «Правки» (ваші зміни доповнень платформи й статуси методичних проблем);
 *  - вхід адміністратора (логін і пароль задано нижче у вигляді хешу) відкриває результати
 *    всіх філій, повідомлення й редагування.
 *
 * ВСТАНОВЛЕННЯ — див. README.txt, розділ «Підключення Google Таблиць». Коротко:
 *  1) Створіть головну таблицю методиста → Розширення → Apps Script → вставте цей код.
 *  2) Створіть по таблиці на кожну філію й вставте їхні посилання в BRANCH_SHEETS нижче.
 *  3) Запустіть функцію setup() (надайте дозволи) — у всіх таблицях з’являться потрібні аркуші.
 *  4) Розгорнути → Нове розгортання → Веб-застосунок: «Виконувати як: я», «Доступ: усі».
 *  5) URL веб-застосунку (…/exec) вставте в config.js сайту (API_URL).
 */

/* =====================================================================
   НАЛАШТУВАННЯ — ВСТАВТЕ СВОЇ ПОСИЛАННЯ
   ===================================================================== */

// Головна таблиця методиста (повідомлення й правки). Порожньо '' — таблиця, до якої прив’язано цей скрипт.
const MAIN_SHEET_URL = '';

// Таблиця кожної філії: 'Назва філії': 'посилання на Google Таблицю'.
// Порожнє посилання '' — дані цієї філії пишуться в головну таблицю.
// Назви філій з’являться у формі реєстрації саме в такому порядку. Щоб додати філію — додайте рядок.
const BRANCH_SHEETS = {
  'Полтава':                '',
  'Онлайн':                 '',
  'Кременчук':              '',
  'Київ — виїзні заняття':  ''
};

// Адміністратор. Пароль зберігається лише як хеш. Щоб змінити пароль — див. функцію showAdminHash() унизу.
const ADMIN_LOGIN = 'robotschool';
const ADMIN_PASSWORD_HASH = '1d1a7bc3337eed8d521fd9e316ddc6321b599f19d09426d084d9addf51f39562';
const ADMIN_SESSION_HOURS = 12;

/* ===================================================================== */

const SHEET_TEACHERS = 'Учителі';
const SHEET_PROGRESS = 'Прогрес';
const SHEET_AUTH = '_auth';
const SHEET_MESSAGES = 'Повідомлення';
const SHEET_EDITS = 'Правки';
const TEACHER_HEADERS = ['Дата реєстрації', 'ПІБ', 'Email', 'Телефон', 'Філія', 'Останній вхід', 'Останній результат', 'Завершені курси'];
const PROGRESS_HEADERS = ['Дата й час', 'ПІБ', 'Email', 'Філія', 'Курс', 'Крок', 'Тип', 'Бал', 'Макс.', '%', 'Зараховано', 'Спроба №', 'Прогрес курсу %', 'Курс завершено', 'Примітка', 'ID курсу', 'ID кроку'];
const MESSAGE_HEADERS = ['ID', 'Дата', 'ПІБ', 'Email', 'Філія', 'Тип', 'Курс', 'Повідомлення', 'Статус', 'Відповідь методиста', 'Дата відповіді'];
const EDIT_HEADERS = ['Ключ', 'Значення (JSON)', 'Оновлено'];

/* ---------- одноразове налаштування ---------- */
function setup() {
  const main = main_();
  styled_(ensureSheet_(main, SHEET_MESSAGES, MESSAGE_HEADERS));
  styled_(ensureSheet_(main, SHEET_EDITS, EDIT_HEADERS));
  const done = {};
  branches_().forEach(b => {
    const ss = branchSs_(b), id = ss.getId();
    if (done[id]) return; done[id] = true;
    const t = styled_(ensureSheet_(ss, SHEET_TEACHERS, TEACHER_HEADERS));
    const p = styled_(ensureSheet_(ss, SHEET_PROGRESS, PROGRESS_HEADERS));
    ensureSheet_(ss, SHEET_AUTH, ['Email', 'Сіль', 'Хеш', 'Токен', 'Створено']).hideSheet();
    t.setColumnWidth(2, 240); t.setColumnWidth(3, 220); p.setColumnWidth(5, 200); p.setColumnWidth(6, 260);
  });
  try { SpreadsheetApp.getActive().toast('Аркуші створено в усіх таблицях. Тепер розгорніть веб-застосунок.', 'Robot School Academy', 8); } catch (e) {}
}

/* ---------- точка входу ---------- */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const A = {
      meta: meta_, register: register_, login: login_, progress: progress_, sync: sync_,
      message: message_, myMessages: myMessages_, getEdits: getEdits_,
      adminLogin: adminLogin_, adminData: adminData_, adminMessages: adminMessages_, adminReply: adminReply_, saveEdits: saveEdits_
    };
    if (!A[req.action]) throw new Error('Невідома дія');
    return json_(Object.assign({ ok: true }, A[req.action](req)));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}
function doGet() { return json_({ ok: true, service: 'Robot School Academy API', version: '1.4', branches: branches_(), time: new Date().toISOString() }); }

/* ---------- учителі ---------- */
function meta_() { return { branches: branches_() }; }

function register_(r) {
  const email = normEmail_(r.email), fio = clean_(r.fio, 120), phone = String(r.phone == null ? '' : r.phone).replace(/[^\d+]/g, '').slice(0, 16), branch = clean_(r.branch, 60);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Некоректна електронна пошта.');
  if (fio.split(/\s+/).length < 2) throw new Error('Вкажіть ПІБ.');
  if (!/^\+380\d{9}$/.test(phone)) throw new Error('Телефон у форматі +380XXXXXXXXX.');
  if (branches_().indexOf(branch) < 0) throw new Error('Оберіть філію зі списку.');
  if (!/^[0-9a-f]{64}$/.test(r.hash || '')) throw new Error('Некоректні дані пароля.');
  if (findUser_(email)) throw new Error('Учитель з такою поштою вже зареєстрований. Увійдіть.');
  const ss = branchSs_(branch);
  const salt = Utilities.getUuid(), token = Utilities.getUuid(), now = new Date();
  sheetIn_(ss, SHEET_AUTH).appendRow([email, salt, hash_(salt + r.hash), token, now]);
  sheetIn_(ss, SHEET_TEACHERS).appendRow([now, fio, email, "'" + phone, branch, now, '', '']);
  PropertiesService.getScriptProperties().setProperty('u:' + email, branch);
  return { user: { fio: fio, email: email, phone: phone, branch: branch, registered: now.toISOString() }, token: token, progress: {} };
}

function login_(r) {
  const email = normEmail_(r.email), u = findUser_(email);
  if (!u) throw new Error('Невірна пошта або пароль.');
  const a = sheetIn_(u.ss, SHEET_AUTH), row = u.authRow;
  const [, salt, stored] = a.getRange(row, 1, 1, 3).getValues()[0];
  if (!/^[0-9a-f]{64}$/.test(r.hash || '')) throw new Error('Невірна пошта або пароль.');
  // Якщо методист очистив хеш (скидання пароля) — новий пароль встановлюється під час входу.
  if (!stored) a.getRange(row, 3).setValue(hash_(salt + r.hash));
  else if (stored !== hash_(salt + r.hash)) throw new Error('Невірна пошта або пароль.');
  let token = a.getRange(row, 4).getValue();
  if (!token) { token = Utilities.getUuid(); a.getRange(row, 4).setValue(token); }
  const t = sheetIn_(u.ss, SHEET_TEACHERS), tr = findRow_(t, email, 3);
  let user = { email: email, fio: '', phone: '', branch: u.branch };
  if (tr > 0) {
    const v = t.getRange(tr, 1, 1, 5).getValues()[0];
    user = { registered: v[0], fio: v[1], email: email, phone: String(v[3]).replace(/^'/, ''), branch: v[4] || u.branch };
    t.getRange(tr, 6).setValue(new Date());
  }
  return { user: user, token: token, progress: progressOf_(u.ss, email) };
}

function sync_(r) { const u = auth_(r); return { progress: progressOf_(u.ss, u.email) }; }

function progress_(r) {
  const u = auth_(r), email = u.email;
  const rec = r.record || {};
  const t = sheetIn_(u.ss, SHEET_TEACHERS), tr = findRow_(t, email, 3);
  const info = tr > 0 ? t.getRange(tr, 1, 1, 5).getValues()[0] : ['', '', email, '', u.branch];
  const courseTitle = clean_(rec.courseTitle, 80), itemTitle = clean_(rec.itemTitle, 120);
  const kind = { read: 'Розділ', test: 'Тест', trainer: 'Тренажер' }[rec.kind] || clean_(rec.kind, 20);
  sheetIn_(u.ss, SHEET_PROGRESS).appendRow([
    new Date(rec.at || Date.now()), info[1], email, info[4], courseTitle, itemTitle, kind,
    num_(rec.score), num_(rec.max), num_(rec.percent), rec.passed ? 'так' : 'ні', num_(rec.attempts),
    num_(rec.coursePercent), rec.courseDone ? 'так' : 'ні', clean_(rec.note, 200), clean_(rec.course, 40), clean_(rec.item, 60)
  ]);
  if (tr > 0) {
    const pctCol = ensureCol_(t, courseTitle + ', %'), stCol = ensureCol_(t, courseTitle + ', статус');
    const prevPct = Number(t.getRange(tr, pctCol).getValue()) || 0;
    t.getRange(tr, pctCol).setValue(Math.max(prevPct, num_(rec.coursePercent)));
    const status = rec.courseDone ? 'Завершено ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy') : 'Навчається';
    if (!String(t.getRange(tr, stCol).getValue()).startsWith('Завершено')) t.getRange(tr, stCol).setValue(status);
    t.getRange(tr, 7).setValue(courseTitle + ' · ' + itemTitle + ' · ' + num_(rec.percent) + '%');
    if (rec.courseDone) {
      const done = String(t.getRange(tr, 8).getValue() || '');
      if (done.indexOf(courseTitle) < 0) t.getRange(tr, 8).setValue(done ? done + '; ' + courseTitle : courseTitle);
    }
  }
  return {};
}

/* ---------- повідомлення методисту ---------- */
function message_(r) {
  const u = auth_(r);
  const text = clean_(r.text, 3000);
  if (text.length < 3) throw new Error('Напишіть текст повідомлення.');
  const t = sheetIn_(u.ss, SHEET_TEACHERS), tr = findRow_(t, u.email, 3);
  const fio = tr > 0 ? t.getRange(tr, 2).getValue() : '';
  const id = Utilities.getUuid().slice(0, 8), now = new Date();
  sheetIn_(main_(), SHEET_MESSAGES).appendRow([id, now, fio, u.email, u.branch, clean_(r.type, 40), clean_(r.course, 80), text, 'Нове', '', '']);
  return { message: { id: id, at: now.toISOString(), type: r.type, course: r.course, text: text, status: 'Нове', reply: '', replyAt: '' } };
}
function myMessages_(r) { const u = auth_(r); return { messages: readMessages_().filter(m => m.email === u.email) }; }
function readMessages_() {
  const sh = sheetIn_(main_(), SHEET_MESSAGES), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, MESSAGE_HEADERS.length).getValues().map(v => ({
    id: String(v[0]), at: iso_(v[1]), fio: v[2], email: String(v[3]).toLowerCase(), branch: v[4], type: v[5], course: v[6],
    text: String(v[7]), status: v[8], reply: String(v[9] || ''), replyAt: iso_(v[10])
  }));
}

/* ---------- правки адміністратора (публічне читання) ---------- */
function getEdits_() {
  const sh = sheetIn_(main_(), SHEET_EDITS), n = sh.getLastRow(), out = {};
  if (n >= 2) sh.getRange(2, 1, n - 1, 2).getValues().forEach(v => { try { if (v[0]) out[v[0]] = JSON.parse(v[1]); } catch (e) {} });
  return { edits: out };
}

/* ---------- адміністратор ---------- */
function adminLogin_(r) {
  if (String(r.login || '').trim().toLowerCase() !== ADMIN_LOGIN || r.hash !== ADMIN_PASSWORD_HASH) {
    Utilities.sleep(800); throw new Error('Невірний логін або пароль адміністратора.');
  }
  const token = Utilities.getUuid() + Utilities.getUuid();
  const props = PropertiesService.getScriptProperties();
  props.setProperty('admin:' + token, String(Date.now() + ADMIN_SESSION_HOURS * 3600 * 1000));
  // прибираємо прострочені сесії
  const all = props.getProperties();
  Object.keys(all).forEach(k => { if (k.indexOf('admin:') === 0 && Number(all[k]) < Date.now()) props.deleteProperty(k); });
  return { token: token };
}
function adminAuth_(r) {
  const exp = Number(PropertiesService.getScriptProperties().getProperty('admin:' + (r.adminToken || '')) || 0);
  if (exp < Date.now()) throw new Error('Сесія адміністратора застаріла — увійдіть знову.');
}
function adminData_(r) {
  adminAuth_(r);
  const teachers = [], progress = [], done = {};
  branches_().forEach(b => {
    const ss = branchSs_(b), id = ss.getId();
    if (done[id]) return; done[id] = true;
    const t = sheetIn_(ss, SHEET_TEACHERS), nt = t.getLastRow();
    if (nt >= 2) t.getRange(2, 1, nt - 1, 8).getValues().forEach(v => teachers.push({
      registered: iso_(v[0]), fio: v[1], email: String(v[2]).toLowerCase(), phone: String(v[3]).replace(/^'/, ''), branch: v[4] || b, lastLogin: iso_(v[5])
    }));
    const p = sheetIn_(ss, SHEET_PROGRESS), np = p.getLastRow();
    if (np >= 2) p.getRange(2, 1, np - 1, PROGRESS_HEADERS.length).getValues().forEach(v => progress.push({
      at: iso_(v[0]), email: String(v[2]).toLowerCase(), course: v[15], item: v[16], courseTitle: v[4], itemTitle: v[5], kind: v[6],
      score: num_(v[7]), max: num_(v[8]), percent: num_(v[9]), passed: v[10] === 'так', attempts: num_(v[11]), note: v[14]
    }));
  });
  return { teachers: teachers, progress: progress, branches: branches_() };
}
function adminMessages_(r) { adminAuth_(r); return { messages: readMessages_() }; }
function adminReply_(r) {
  adminAuth_(r);
  const sh = sheetIn_(main_(), SHEET_MESSAGES), row = findRow_(sh, String(r.id || '').toLowerCase(), 1);
  if (row < 0) throw new Error('Повідомлення не знайдено.');
  if (r.reply !== undefined) { sh.getRange(row, 10).setValue(clean_(r.reply, 3000)); sh.getRange(row, 11).setValue(new Date()); }
  sh.getRange(row, 9).setValue(clean_(r.status || (r.reply ? 'Відповідь надано' : 'Прочитано'), 40));
  return { messages: readMessages_() };
}
function saveEdits_(r) {
  adminAuth_(r);
  const sh = sheetIn_(main_(), SHEET_EDITS), edits = r.edits || {};
  Object.keys(edits).forEach(k => {
    const key = String(k).slice(0, 120), row = findRow_(sh, key.toLowerCase(), 1);
    if (edits[k] === null) { if (row > 0) sh.deleteRow(row); return; }
    const val = JSON.stringify(edits[k]).slice(0, 45000);
    if (row > 0) sh.getRange(row, 2, 1, 2).setValues([[val, new Date()]]);
    else sh.appendRow([key, val, new Date()]);
  });
  return getEdits_();
}

/* ---------- допоміжні ---------- */
function branches_() { return Object.keys(BRANCH_SHEETS); }
function main_() { return MAIN_SHEET_URL ? SpreadsheetApp.openByUrl(MAIN_SHEET_URL) : SpreadsheetApp.getActiveSpreadsheet(); }
function branchSs_(b) {
  const url = BRANCH_SHEETS[b];
  if (url === undefined) throw new Error('Невідома філія: ' + b);
  return url ? SpreadsheetApp.openByUrl(url) : main_();
}
function findUser_(email) {
  const props = PropertiesService.getScriptProperties();
  const hint = props.getProperty('u:' + email);
  const order = branches_(); if (hint && order.indexOf(hint) >= 0) { order.splice(order.indexOf(hint), 1); order.unshift(hint); }
  const seen = {};
  for (let i = 0; i < order.length; i++) {
    const ss = branchSs_(order[i]), id = ss.getId(); if (seen[id]) continue; seen[id] = true;
    const row = findRow_(sheetIn_(ss, SHEET_AUTH), email);
    if (row > 0) {
      let branch = order[i];
      const t = sheetIn_(ss, SHEET_TEACHERS), tr = findRow_(t, email, 3);
      if (tr > 0) branch = t.getRange(tr, 5).getValue() || branch;
      props.setProperty('u:' + email, branch);
      return { ss: ss, authRow: row, branch: branch };
    }
  }
  return null;
}
function auth_(r) {
  const email = normEmail_(r.email), u = findUser_(email);
  if (!u || !r.token || sheetIn_(u.ss, SHEET_AUTH).getRange(u.authRow, 4).getValue() !== r.token) throw new Error('Сесія застаріла — увійдіть знову.');
  u.email = email; return u;
}
function progressOf_(ss, email) {
  const sh = sheetIn_(ss, SHEET_PROGRESS), n = sh.getLastRow();
  const out = {};
  if (n < 2) return out;
  sh.getRange(2, 1, n - 1, PROGRESS_HEADERS.length).getValues().forEach(v => {
    if (String(v[2]).toLowerCase() !== email) return;
    const c = v[15], i = v[16]; if (!c || !i) return;
    const rec = { course: c, item: i, courseTitle: v[4], itemTitle: v[5], score: v[7], max: v[8], percent: Number(v[9]) || 0, passed: v[10] === 'так', attempts: Number(v[11]) || 1, at: iso_(v[0]) };
    out[c] = out[c] || {};
    const prev = out[c][i];
    if (!prev || rec.percent > prev.percent || (rec.passed && !prev.passed)) out[c][i] = rec;
  });
  return out;
}
function sheetIn_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (sh) return sh;
  const H = { [SHEET_TEACHERS]: TEACHER_HEADERS, [SHEET_PROGRESS]: PROGRESS_HEADERS, [SHEET_AUTH]: ['Email', 'Сіль', 'Хеш', 'Токен', 'Створено'], [SHEET_MESSAGES]: MESSAGE_HEADERS, [SHEET_EDITS]: EDIT_HEADERS }[name];
  const created = ensureSheet_(ss, name, H || ['']);
  if (name === SHEET_AUTH) created.hideSheet(); else styled_(created);
  return created;
}
function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}
function styled_(sh) {
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).setFontWeight('bold').setBackground('#0A44DC').setFontColor('#FFFFFF');
  return sh;
}
function ensureCol_(sh, title) {
  const last = sh.getLastColumn();
  const head = sh.getRange(1, 1, 1, last).getValues()[0];
  const idx = head.indexOf(title);
  if (idx >= 0) return idx + 1;
  sh.getRange(1, last + 1).setValue(title).setFontWeight('bold').setBackground('#0A44DC').setFontColor('#FFFFFF');
  return last + 1;
}
function findRow_(sh, key, col) {
  col = col || 1;
  const n = sh.getLastRow(); if (n < 2) return -1;
  const vals = sh.getRange(2, col, n - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (String(vals[i][0]).trim().toLowerCase() === key) return i + 2;
  return -1;
}
function hash_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}
function iso_(v) { if (!v) return ''; const d = new Date(v); return isNaN(d) ? '' : d.toISOString(); }
function normEmail_(e) { return String(e || '').trim().toLowerCase().slice(0, 120); }
function clean_(s, max) { s = String(s == null ? '' : s).replace(/[\r\t]+/g, ' ').trim().slice(0, max || 200); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function num_(v) { const n = Number(v); return isFinite(n) ? n : 0; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------- зміна пароля адміністратора ----------
   1) Впишіть новий пароль у NEW_PASSWORD нижче й запустіть showAdminHash().
   2) Скопіюйте хеш із журналу виконання в ADMIN_PASSWORD_HASH (угорі цього файлу) і в config.js сайту (ADMIN_HASH).
   3) Зітріть пароль із NEW_PASSWORD і створіть нову версію розгортання. */
function showAdminHash() {
  const NEW_PASSWORD = '';
  if (!NEW_PASSWORD) throw new Error('Впишіть новий пароль у NEW_PASSWORD.');
  Logger.log(hash_('rs-academy|' + ADMIN_LOGIN + '|' + NEW_PASSWORD));
}
