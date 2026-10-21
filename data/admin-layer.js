/* Шар адміністратора (v1.4).
   1) Прибирає з матеріалів для вчителів усі згадки про методичні проблеми архівів
      (розбіжності, відсутні чи скопійовані файли, «дописано платформою») і переносить їх
      у реєстр window.RS_PROBLEMS, який бачить лише адміністратор.
   2) Позначає доповнення платформи (теми, «Учитель має знати», конспекти TB) як окремі пункти,
      що мають статус «чернетка» / «опубліковано» і можуть редагуватися в адмін-панелі.
   Підключається після всіх файлів курсів, паспортів і data/admin-patches.js. */
(function(){
const ALL = [window.RS_METHOD].concat(window.RS_COURSES||[]).filter(Boolean);
const PR = window.RS_PROBLEMS = window.RS_PROBLEMS || {};
const add = (cid, p) => { (PR[cid] = PR[cid] || []).push(Object.assign({kind:'archive'}, p)); };
const strip = s => String(s||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();

/* Фрази, які означають «проблему для методиста» */
const RX = new RegExp([
  'платформою','платформа дописала','платформа склала','конспект(и)? платформи','конспектом платформи','для методиста',
  'в архіві (зараз|—|ці|немає|курсу зараз|\\d)','у архіві курсу','архів відрізняються','описі —','в описі',
  'не збігаю','синхроніз','скопійован','копія (уроку|TB|L\\d)','not finished','у папці лежить','у цій папці лежить',
  'відсутній','немає SB','немає TB','два SB','два варіанти SB','у папці тимчасові','лежить тимчасовий файл',
  'План на платформі','Платформа будує','за папками архіву','папки курсу ширші','старий номер','У TB цього уроку','TB цього уроку —',
  'TB у цій папці','папці TB від','назва дублює','Номери уроків у шапках','два TB','без TB','лише у форматі PDF','конспектами платформи','не відповідає архіву','інструкцій наборів у архіві'
].join('|'), 'i');
const SAFE = /Повні файли — лише в архіві/i;
const bad = s => RX.test(strip(s)) && !SAFE.test(strip(s));

/* Видаляє з HTML найменші блоки (секції «для методиста», callout, li, tr, p), що містять проблемні фрази */
function cleanHtml(html, onRemove){
  if(typeof html!=='string') return html;
  let h = html;
  // 1) цілі секції з заголовком «…для методиста…» / «Що варто виправити»
  h = h.replace(/<h([23])[^>]*>[^<]*(?:<[^h][^>]*>[^<]*)*?(для методиста|Що варто виправити)[\s\S]*?<\/h\1>[\s\S]*?(?=<h[23][\s>]|$)/gi, m => { onRemove(m); return ''; });
  // 2) callout-блоки (без вкладених div)
  h = h.replace(/<div class="callout[^"]*"[^>]*>(?:(?!<div)[\s\S])*?<\/div>/g, m => bad(m) ? (onRemove(m), '') : m);
  // 3) пункти списків, рядки таблиць, абзаци
  ['li','tr','p'].forEach(tag => {
    const re = new RegExp('<'+tag+'(?:\\s[^>]*)?>(?:(?!<'+tag+'[\\s>])[\\s\\S])*?</'+tag+'>','g');
    h = h.replace(re, m => bad(m) ? (onRemove(m), '') : m);
  });
  // 4) порожні списки/таблиці після чищення
  h = h.replace(/<ul>\s*<\/ul>|<ol>\s*<\/ol>/g,'');
  return h;
}
function cleanText(s, onRemove){
  if(typeof s!=='string' || !bad(s)) return s;
  const parts = s.split(/(?<=[.!?])\s+/); const keep=[];
  parts.forEach(x => bad(x) ? onRemove(x) : keep.push(x));
  return keep.join(' ');
}

ALL.forEach(c => {
  const cid = c.id;
  // вкладки курсу
  (c.tabs||[]).forEach(t => {
    const where = 'Вкладка «'+t.title+'»';
    if(typeof t.html==='string') t.html = cleanHtml(t.html, m => add(cid,{where, text:strip(m)}));
    if(typeof t.intro==='string') t.intro = /</.test(t.intro) ? cleanHtml(t.intro, m => add(cid,{where, text:strip(m)})) : cleanText(t.intro, x => add(cid,{where, text:strip(x)}));
    if(typeof t.intro==='string' && bad(t.intro)){ add(cid,{where, text:strip(t.intro)}); t.intro=''; }
    if(t.render==='plan' && typeof t.intro==='string' && !strip(t.intro)) t.intro='<p>План курсу за уроками. Розгорніть «Підготовка вчителя», щоб побачити «Учитель має знати» й методичні поради.</p>';
  });
  if(c.lessonsLabel && /архів/.test(c.lessonsLabel)){ add(cid,{where:'Картка курсу', text:'Кількість уроків: '+c.lessonsLabel}); c.lessonsLabel = c.lessonsLabel.replace(/\s*в архіві\s*/,' ').replace(/\s*\([^)]*за описом\)/,'').trim(); }
  (c.meta||[]).forEach((m,i)=>{ if(bad(m)){ add(cid,{where:'Шапка курсу',text:m}); c.meta[i]=''; } }); if(c.meta) c.meta=c.meta.filter(Boolean);
  // план
  (c.plan||[]).forEach(l => {
    const where = 'Урок '+(l.label||l.n)+' «'+l.name+'»';
    if(l.note && bad(l.note)){ add(cid,{where, lesson:l.n, text:l.note}); l._note = l.note; delete l.note; }
    if(l.tip && bad(l.tip)) l.tip = cleanText(l.tip, x => add(cid,{where:where+', порада', lesson:l.n, text:strip(x)}));
    if(l.folder) l.folder = l.folder.replace(/-$/,'');
  });
  // тести: питання про проблеми архіву прибираємо
  (c.tests||[]).forEach(t => {
    const keep = [];
    t.questions.forEach(q => { if(bad(q.q) || bad(q.o[q.a]) || bad(q.ex)) add(cid,{where:'Тест «'+t.title+'»', kind:'test', text:strip(q.q)+' → '+strip(q.o[q.a])}); else keep.push(q); });
    t.questions = keep; if(t.take && t.take>keep.length) t.take = keep.length;
  });
  // тренажери-класифікатори з пунктами про «дописане платформою»
  (c.trainers||[]).forEach(tr => { if(tr.type==='classify' && tr.items) tr.items = tr.items.filter(it => !bad(it[0])); });
  // паспорт
  const P = c.passport;
  if(P){
    const g=P.general||{}, t=P.tech||{};
    if(g.attrs && /не визначено/.test(g.attrs)){ add(cid,{where:'Паспорт курсу', kind:'todo', text:'Атрибути курсу (колір, абревіатура) не визначені у файлах курсу. '+strip(g.attrs)}); g.attrs=''; }
    if(g.count && /архів|за описом/.test(g.count)){ add(cid,{where:'Паспорт курсу', text:'Кількість занять: '+g.count}); g.count = g.count.replace(/\s*\([^)]*\)\s*/g,' ').replace(/\s*в архіві/,'').trim(); }
    if(t.summary && bad(t.summary)){ t.summary = cleanText(t.summary.replace(/\s*\(складено платформою[^)]*\)/,''), x=>add(cid,{where:'Паспорт курсу',text:x})); }
    if(t.files) t.files = t.files.filter(f => { if(bad(f[0])){ add(cid,{where:'Паспорт курсу', kind:'added', text:strip(f[0])+' ('+(f[2]||'')+')'}); return false } return true; });
    if(P.generated) add(cid,{where:'Паспорт курсу', kind:'added', text:'Загальний і технічний опис складено платформою (у файлах курсу їх немає). Перевірте й затвердьте.'});
    if(P.techGenerated) add(cid,{where:'Паспорт курсу', kind:'added', text:'Технічний опис складено платформою за TB курсу. Перевірте.'});
  }
});

/* ---------- що ще треба дописати (виявлено під час аналізу архівів) ---------- */
[['arduino','Структура курсу','Уроки 25–30 і 39 відсутні в архіві: немає ні SB, ні TB. Потрібно написати ці уроки або перенумерувати курс.'],
 ['arduino','Нумерація','Номери уроків у SB (старі 19–32) не збігаються з номерами папок (19–24). Варто перейменувати SB.'],
 ['lego-scratch','Структура курсу','Урок 13 відсутній у папках. Потрібно написати урок або перенумерувати курс.'],
 ['lego-scratch','Урок 36','TB уроку 36 — копія уроку 34: потрібен власний TB для «Own project».'],
 ['wedo','Опис курсу','Тематичне планування «Загального опису» не відповідає папкам 2023 року — оновіть опис.'],
 ['uaro','Учнівські файли','Немає SB для уроків 1, 15, 19, 20, 23, 28, 35; інструкції наборів — лише російською. Потрібні українські SB і переклад інструкцій.'],
 ['transformers','Стара програма','TB старої програми (2017–2018) частково незавершені («not finished»). Якщо стара програма ще використовується — дописати TB.'],
 ['microbit','Опис курсу','Опис (38 занять) не збігається з архівом (42 уроки) — синхронізуйте опис.'],
 ['tinkercad','Опис курсу','У «Загальному описі» уроки 23–35 заплановані в Onshape, а в архіві — Tinkercad з конекторами. Оновіть опис і назву курсу.']
].forEach(x => add(x[0], {kind:'todo', where:x[1], text:x[2]}));

/* ---------- доповнення: теми, «Учитель має знати», конспекти TB ---------- */
const PATCH = window.RS_PATCHES || {};
/* Уроки, де вихідна тема чи «Учитель має знати» в архіві помилкові (скопійовані з іншого уроку):
   поки доповнення не опубліковане, учителі бачать порожнє поле замість помилкового. */
const WRONG = {topic:{arduino:[31,32,33,34,35,36,37,38,40], wedo:[25]}, know:{'lego-start':[38], engineering:[38], wedo:[25]}};
const ADD = window.RS_ADDITIONS = [];   // [{key, cid, n, field, value, orig}]
(window.RS_COURSES||[]).forEach(c => {
  const P = PATCH[c.id] || {};
  (c.plan||[]).forEach(l => {
    l._orig = {topic:l.topic, know:(l.know||[]).slice()};
    const x = P[l.n];
    if(x){
      if(x.topic) ADD.push({key:c.id+'|'+l.n+'|topic', cid:c.id, n:l.n, field:'topic', value:x.topic, orig:l.topic});
      if(x.know) ADD.push({key:c.id+'|'+l.n+'|know', cid:c.id, n:l.n, field:'know', value:x.know.items, mode:x.know.mode, orig:(l.know||[]).slice()});
    }
    if(l.tb){ ADD.push({key:c.id+'|'+l.n+'|tb', cid:c.id, n:l.n, field:'tb', value:l.tb, orig:null}); l._tb = l.tb; delete l.tb; }
  });
});
/* Застосовує доповнення до плану з урахуванням статусів і правок адміністратора.
   ed = {key: {status:'draft'|'published'|'hidden', value:…}}; admin=true — показати все з позначками. */
window.RS_APPLY_ADDITIONS = function(ed, admin){
  ed = ed || {};
  (window.RS_COURSES||[]).forEach(c => (c.plan||[]).forEach(l => { l.topic=l._orig.topic; l.know=l._orig.know.slice(); delete l.tb; l._ai={}; }));
  ADD.forEach(a => {
    const c = (window.RS_COURSES||[]).find(x=>x.id===a.cid); const l = c && c.plan.find(p=>p.n===a.n); if(!l) return;
    const e = ed[a.key] || {}; const status = e.status || 'draft'; const val = e.value!==undefined ? e.value : a.value;
    const show = admin ? status!=='deleted' : status==='published';
    if(!show){ const w=(WRONG[a.field]||{})[a.cid]; if(!admin && w && w.indexOf(a.n)>=0){ if(a.field==='topic') l.topic=''; if(a.field==='know') l.know=[]; } return; }
    l._ai[a.field] = status;
    if(a.field==='topic') l.topic = val;
    else if(a.field==='know') l.know = a.mode==='replace' ? val.slice() : l._orig.know.concat(val);
    else if(a.field==='tb') l.tb = val;
  });
};
window.RS_APPLY_ADDITIONS({}, false);
})();
