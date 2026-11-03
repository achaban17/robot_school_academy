/* Robot School System — конструктор курсів для методиста (v3.1).
   Методист створює новий курс: опис, уроки, тренажери й тести за шаблонами наявних курсів.
   Опублікований курс з’являється в учителів у навчанні (Academy) і в «Базі курсів», куди методист
   завантажує файли уроків. Курси зберігаються на сервері (аркуш «Курси (свої)»), у беті — у браузері. */
(function(){
'use strict';
const CFG = window.RS_CONFIG || {};
const BETA = CFG.MODE === 'beta';
const KEY = BETA ? 'rsa_beta_' : 'rsa_';
const LSg = (k,d)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d }catch(e){ return d } };
const LSs = (k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)) }catch(e){} };
const A = () => window.RS_APP;
const $ = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>Array.from(el.querySelectorAll(s));
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLORS = ['#0A44DC','#12A37F','#F2552C','#9C27B0','#E68A00','#0097A7','#C2185B','#5D4037','#E100E1','#23AFAC'];
const TYPES = {match:'Відповідність (пари)', order:'Правильний порядок', classify:'Розподіл за категоріями', choice:'Картки з вибором відповіді', situation:'Педагогічні ситуації'};
const para = t => String(t||'').trim().split(/\n\s*\n/).filter(Boolean).map(p=>'<p>'+esc(p).replace(/\n/g,'<br>')+'</p>').join('');
const lines = t => String(t||'').split('\n').map(x=>x.trim()).filter(Boolean);
const soft = hex => { const h=hex.replace('#',''); const n=parseInt(h,16); const r=n>>16&255,g=n>>8&255,b=n&255; const m=(c)=>Math.round(c+(255-c)*.86); return '#'+[m(r),m(g),m(b)].map(x=>x.toString(16).padStart(2,'0')).join('') };
const dark = hex => { const h=hex.replace('#',''); const n=parseInt(h,16); const r=n>>16&255,g=n>>8&255,b=n&255; return '#'+[r,g,b].map(c=>Math.round(c*.7).toString(16).padStart(2,'0')).join('') };

/* ======================================================================
   ПЕРЕТВОРЕННЯ: збережений курс → курс платформи (вкладки, план, тренажери, тести)
   ====================================================================== */
function compile(c){
  const color=c.color||COLORS[0], plan=(c.plan||[]).slice().sort((a,b)=>a.n-b.n);
  const blocks=[]; plan.forEach(l=>{ const s=(l.section||'').trim(); if(!s) return; const b=blocks[blocks.length-1]; if(b&&b.title===s&&b.to>=l.n-100) b.to=l.n; else blocks.push({title:s,from:l.n,to:l.n}) });
  const meta=[c.age,c.duration,c.group,c.tools].filter(Boolean);
  return { id:c.id, custom:true, status:c.status||'draft', dir:c.dir||'robot', order:Number(c.order||50), short:c.short||c.title, title:c.title, direction:({robot:'Робототехніка','3d':'3D-графіка',code:'Програмування'})[c.dir]||'Інше',
    subtitle:c.subtitle||'', color, soft:soft(color), colorInk:dark(color), age:c.age||'', lessonsLabel:plan.length+' '+(plan.length%10===1&&plan.length%100!==11?'заняття':'занять'), meta, blocks,
    plan:plan.map(l=>({n:Number(l.n),label:String(l.label||l.n),name:l.name||('Урок '+l.n),topic:l.topic||'',focus:l.focus||[],know:l.know||[],tip:esc(l.tip||''),kind:l.kind||'',_orig:{topic:l.topic||'',know:(l.know||[]).slice()},_ai:{}})),
    tabs:[
      {id:'overview', title:'Огляд курсу', read:true, render:'html', html:`<h2>Про курс</h2>${para(c.about)||'<p class="muted">Опис курсу ще не додано.</p>'}
        ${meta.length?`<div class="callout info"><b>Коротко</b><p>${meta.map(esc).join(' · ')}</p></div>`:''}${c.equipment?`<h3>Що потрібно</h3>${para(c.equipment)}`:''}`},
      {id:'plan', title:'Навчальний план', read:true, render:'plan', intro:'<p>Поурочний план курсу. Файли уроків — у розділі «База курсів», коли методист відкриє вам доступ.</p>'},
      {id:'materials', title:'Матеріали курсу', read:true, render:'html', html:`<h2>Матеріали курсу</h2><p>Файли уроків (сценарії, конспекти, інструкції) знаходяться в розділі <a href="#/lib">«База курсів»</a>. Доступ відкриває методист; файли відкриваються для перегляду й друку.</p>${para(c.materials)}`},
      {id:'method', title:'Методика', read:true, render:'html', html:`<h2>Методичні рекомендації</h2>${para(c.method)||'<p class="muted">Методичні рекомендації ще не додано.</p>'}`},
      {id:'literature', title:'Література', read:true, render:'html', html:`<h2>Література й корисні посилання</h2>${lines(c.literature).length?'<ul>'+lines(c.literature).map(x=>'<li>'+esc(x).replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>')+'</li>').join('')+'</ul>':'<p class="muted">Список ще не додано.</p>'}`},
      {id:'trainers', title:'Тренажери', render:'trainers'},
      {id:'tests', title:'Тести', render:'tests'}
    ],
    trainers:(c.trainers||[]).map(t=>Object.assign({},t)), tests:(c.tests||[]).map(t=>Object.assign({},t)) };
}

/* ---------- завантаження й підміна курсів у списку платформи ---------- */
let RAW = LSg(KEY+'custom_courses', []);
function inject(list, arrs){
  arrs.forEach(arr=>{ for(let i=arr.length-1;i>=0;i--) if(arr[i]&&arr[i].custom) arr.splice(i,1) });
  list.forEach(raw=>{ const c=compile(raw); arrs.forEach(arr=>arr.push(c)) });
}
// до старту застосунку: курси з кешу потрапляють у список одразу (учитель бачить лише опубліковані)
inject(RAW.filter(c=>c.status==='published' || LSg(KEY+'session',{}).admin), [window.RS_COURSES=window.RS_COURSES||[]]);
async function refresh(){
  const app=A(); if(!app) return;
  let list;
  if(BETA) list=LSg(KEY+'custom_store',[]);
  else { const j=await app.callApi(Object.assign({action:'customCourses'}, app.S.admin?{adminToken:app.S.adminToken}:{})); list=j.courses||[] }
  RAW=list; LSs(KEY+'custom_courses', list);
  const vis=list.filter(c=>c.status==='published'||app.S.admin);
  const arrs=[app.COURSES]; if(app.ALL!==app.COURSES) arrs.push(app.ALL); inject(vis, arrs);
  window.RS_CUSTOM = list;
}
window.RS_CUSTOM = RAW;
async function save(course){
  const app=A();
  if(BETA){ const st=LSg(KEY+'custom_store',[]); const i=st.findIndex(x=>x.id===course.id); course.updated=new Date().toISOString(); if(i>=0) st[i]=course; else st.push(course); LSs(KEY+'custom_store',st) }
  else await app.API.adminCall('admCourseSave',{course});
  await refresh();
}
async function remove(id){ const app=A(); if(BETA) LSs(KEY+'custom_store',LSg(KEY+'custom_store',[]).filter(x=>x.id!==id)); else await app.API.adminCall('admCourseDelete',{id}); await refresh() }
window.addEventListener('load',()=>setTimeout(()=>{ if(!A()||!A().S.user||A().S.crm) return; refresh().then(()=>{ const h=location.hash; if(/^#\/(course|courses|home|admin\/builder|admin\/lib|lib|profile)/.test(h)||!h) A().route() }).catch(e=>console.warn('custom courses:',e.message)) },50));

/* ======================================================================
   ПРОСТІ ФОРМАТИ ДЛЯ РЕДАГУВАННЯ (текстом)
   ====================================================================== */
// тест / картки: «? питання», «+ правильна», «- неправильна», «! пояснення»
function parseQ(text){
  const qs=[]; let q=null;
  String(text||'').split('\n').forEach(raw=>{ const ln=raw.trim(); if(!ln) return; const t=ln[0], v=ln.slice(1).trim();
    if(t==='?'){ q={q:v,o:[],a:-1,ex:''}; qs.push(q) } else if(!q) throw new Error('Перший рядок питання має починатися з «?»: '+ln);
    else if(t==='+'){ if(q.a>=0) throw new Error('У питанні «'+q.q+'» дві правильні відповіді.'); q.a=q.o.length; q.o.push(v) }
    else if(t==='-') q.o.push(v); else if(t==='!') q.ex=v; else q.q+=' '+ln });
  qs.forEach(x=>{ if(x.o.length<2) throw new Error('У питанні «'+x.q+'» менше двох варіантів.'); if(x.a<0) throw new Error('У питанні «'+x.q+'» не позначено правильну відповідь (+).') });
  return qs;
}
const showQ = qs => (qs||[]).map(q=>['? '+q.q].concat(q.o.map((o,i)=>(i===q.a?'+ ':'- ')+o), q.ex?['! '+q.ex]:[]).join('\n')).join('\n\n');
// ситуації: «## Назва | вік | етап», далі опис; варіанти «best: текст | відгук», «ok: …», «bad: …»
function parseSit(text){
  const cs=[]; let c=null;
  String(text||'').split('\n').forEach(raw=>{ const ln=raw.trim(); if(!ln) return;
    if(ln.startsWith('##')){ const p=ln.slice(2).split('|').map(x=>x.trim()); c={title:p[0]||'Ситуація',age:p[1]||'',place:p[2]||'',text:'',o:[]}; cs.push(c); return }
    if(!c) throw new Error('Ситуація має починатися з рядка «## Назва».');
    const m=ln.match(/^(best|ok|bad)\s*:\s*(.*)$/i);
    if(m){ const [t,f]=m[2].split('|'); c.o.push({t:(t||'').trim(),r:m[1].toLowerCase(),f:(f||'').trim()}) } else c.text+=(c.text?' ':'')+ln });
  cs.forEach(x=>{ if(x.o.length<2) throw new Error('У ситуації «'+x.title+'» менше двох варіантів дій.'); if(!x.o.some(o=>o.r==='best')) throw new Error('У ситуації «'+x.title+'» немає найкращого варіанта (best).') });
  return cs;
}
const showSit = cs => (cs||[]).map(c=>[`## ${c.title}${c.age||c.place?' | '+(c.age||'')+' | '+(c.place||''):''}`, c.text].concat(c.o.map(o=>`${o.r}: ${o.t}${o.f?' | '+o.f:''}`)).join('\n')).join('\n\n');
const HELP = {
  match:'Кожен рядок — пара через « = ». Учитель з’єднує ліву частину з правою.\nНаприклад:\nСервопривід = повертається на заданий кут\nДатчик відстані = вимірює відстань ультразвуком',
  order:'Кроки в ПРАВИЛЬНОМУ порядку, кожен з нового рядка. Учителю вони покажуться перемішаними.',
  classify:'Перший рядок — категорії через «;». Далі рядки «текст = номер категорії» (1, 2, …).\nНаприклад:\nМеханік; Інженер\nЗбирає модель = 1\nПодає деталі = 2',
  choice:'Картки: «? питання», «+ правильна відповідь», «- неправильна». Порожній рядок між картками.',
  situation:'«## Назва | вік | етап уроку», далі опис ситуації. Варіанти дій:\nbest: найкраща дія | чому так\nok: прийнятна дія | коментар\nbad: помилкова дія | наслідок'
};
function trainerToText(t){
  if(t.type==='match') return (t.pairs||[]).map(p=>p[0]+' = '+p[1]).join('\n');
  if(t.type==='order') return (t.items||[]).join('\n');
  if(t.type==='classify') return [(t.cats||[]).join('; ')].concat((t.items||[]).map(i=>i[0]+' = '+(Number(i[1])+1))).join('\n');
  if(t.type==='choice') return showQ(t.cards);
  if(t.type==='situation') return showSit(t.cases);
  return '';
}
function textToTrainer(type, text){
  const L=lines(text);
  if(type==='match'){ const pairs=L.map(l=>{ const i=l.indexOf('='); if(i<0) throw new Error('Рядок без « = »: '+l); return [l.slice(0,i).trim(),l.slice(i+1).trim()] }); if(pairs.length<3) throw new Error('Потрібно щонайменше 3 пари.'); return {pairs} }
  if(type==='order'){ if(L.length<3) throw new Error('Потрібно щонайменше 3 кроки.'); return {items:L} }
  if(type==='classify'){ const cats=(L.shift()||'').split(';').map(x=>x.trim()).filter(Boolean); if(cats.length<2) throw new Error('Перший рядок — щонайменше дві категорії через «;».');
    const items=L.map(l=>{ const i=l.lastIndexOf('='); const k=Number(l.slice(i+1).trim())-1; if(i<0||!(k>=0&&k<cats.length)) throw new Error('Рядок має закінчуватися « = номер категорії»: '+l); return [l.slice(0,i).trim(),k] }); if(items.length<3) throw new Error('Потрібно щонайменше 3 елементи.'); return {cats,items} }
  if(type==='choice'){ const cards=parseQ(text); if(!cards.length) throw new Error('Додайте хоча б одну картку.'); return {cards} }
  if(type==='situation'){ const cases=parseSit(text); if(!cases.length) throw new Error('Додайте хоча б одну ситуацію.'); return {cases} }
  throw new Error('Невідомий тип');
}

/* ======================================================================
   ІНТЕРФЕЙС МЕТОДИСТА
   ====================================================================== */
let DRAFT=null;   // курс, що редагується
const shell = (h)=>A().shell('a:builder',h);
const slug = t => { const tr={а:'a',б:'b',в:'v',г:'h',ґ:'g',д:'d',е:'e',є:'ie',ж:'zh',з:'z',и:'y',і:'i',ї:'i',й:'i',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ь:'',ю:'iu',я:'ia','’':'',"'":''};
  return String(t).toLowerCase().split('').map(ch=>tr[ch]!==undefined?tr[ch]:ch).join('').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,30)||'kurs' };
function modal(title, body, onOk, okText){
  const w=document.createElement('div'); w.className='mdl-wrap';
  w.innerHTML=`<div class="mdl card" role="dialog" aria-modal="true" style="max-width:820px"><div class="row" style="margin-bottom:10px"><h2 style="margin:0" class="grow">${esc(title)}</h2><button class="btn sm ghost" data-x>✕</button></div>
    <form class="mdl-f">${body}<div class="err" id="m-err"></div><div class="row" style="margin-top:14px"><span class="grow"></span><button type="button" class="btn ghost" data-x>Скасувати</button><button class="btn" type="submit">${esc(okText||'Зберегти')}</button></div></form></div>`;
  document.body.appendChild(w); const close=()=>w.remove(); $$('[data-x]',w).forEach(b=>b.onclick=close);
  $('.mdl-f',w).onsubmit=async e=>{ e.preventDefault(); const btn=$('button[type=submit]',w); btn.disabled=true; $('#m-err',w).textContent='';
    try{ const r=await onOk(Object.fromEntries(new FormData(e.target).entries()), e.target); if(r!==false) close() }catch(ex){ $('#m-err',w).textContent=ex.message||'Помилка'; btn.disabled=false } };
  return w;
}
const stdCourses = () => A().COURSES.filter(c=>!c.custom);
const allCourses = () => A().COURSES;

async function route(p){
  $$('.mdl-wrap').forEach(x=>x.remove());
  if(!p[0]){ try{ await refresh() }catch(e){ return shell(`<h1>Конструктор курсів</h1><div class="callout bad">${esc(e.message)}</div>`) } return vList() }
  const raw=(window.RS_CUSTOM||[]).find(c=>c.id===p[0]);
  if(!raw && p[0]!=='new'){ return vList() }
  if(!DRAFT || DRAFT.id!==p[0]) DRAFT = raw ? JSON.parse(JSON.stringify(raw)) : null;
  if(!DRAFT) return vList();
  return vEdit(p[1]||'main');
}
function vList(){
  const list=(window.RS_CUSTOM||[]);
  shell(`<div class="row"><h1 class="grow" style="margin:0">Конструктор курсів</h1><button class="btn" id="new">+ Новий курс</button></div>
    <p class="muted" style="max-width:860px">Створіть новий курс: опис, уроки, тренажери й тести за шаблонами наявних курсів. Поки курс — чернетка, його бачите лише ви. Після публікації він з’являється в учителів у навчанні (Academy), а в «Базі курсів» ви додаєте файли до його уроків і відкриваєте доступ.</p>
    <div class="grid g3">${list.map(c=>{ const cc=compile(c); return `<a class="card" href="#/admin/builder/${c.id}" style="text-decoration:none;color:inherit;border-top:6px solid ${cc.color}"><div class="row"><b class="grow">${esc(c.title)}</b><span class="pill ${c.status==='published'?'good':'warn'}">${c.status==='published'?'опубліковано':'чернетка'}</span></div>
      <div class="small muted">${esc(cc.direction)} · ${esc(c.age||'вік не вказано')}</div><div class="small" style="margin-top:8px">уроків: ${(c.plan||[]).length} · тренажерів: ${(c.trainers||[]).length} · тестів: ${(c.tests||[]).length}</div></a>` }).join('')||'<div class="card"><p class="muted">Власних курсів ще немає.</p></div>'}</div>`);
  $('#new').onclick=()=>modal('Новий курс',`<div class="field"><label>Назва курсу *</label><input class="input" name="title" required placeholder="наприклад, LEGO SPIKE Prime"></div>
    <div class="grid g2" style="gap:10px"><div class="field"><label>Напрям</label><select class="input" name="dir">${(CFG.DIRS||[]).map(d=>`<option value="${d.key}">${esc(d.title)}</option>`).join('')}</select></div>
    <div class="field"><label>Вік учнів</label><input class="input" name="age" placeholder="9–11 років"></div></div>
    <div class="field"><label>Взяти за основу (необов’язково)</label><select class="input" name="tpl"><option value="">— порожній курс —</option>${stdCourses().map(c=>`<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select>
      <div class="tiny muted">Буде скопійовано структуру: опис, план уроків, тренажери й тести. Далі все можна змінити.</div></div>`, async x=>{
      let id='u-'+slug(x.title); const ids=(window.RS_CUSTOM||[]).map(c=>c.id).concat(allCourses().map(c=>c.id)); let k=2; while(ids.includes(id)) id='u-'+slug(x.title)+'-'+(k++);
      DRAFT={id,title:x.title.trim(),short:x.title.trim(),dir:x.dir,age:x.age,color:COLORS[(window.RS_CUSTOM||[]).length%COLORS.length],status:'draft',plan:[],trainers:[],tests:[]};
      if(x.tpl){ const t=stdCourses().find(c=>c.id===x.tpl); DRAFT.subtitle=t.subtitle||''; DRAFT.about='Курс створено на основі «'+t.title+'». Замініть цей текст описом нового курсу.';
        DRAFT.plan=(t.plan||[]).map(l=>({n:l.n,label:String(l.label||l.n),name:l.name,topic:l.topic||'',focus:(l.focus||[]).slice(),know:(l.know||[]).slice(),tip:String(l.tip||'').replace(/<[^>]+>/g,'')}));
        DRAFT.trainers=(t.trainers||[]).filter(tr=>TYPES[tr.type]||tr.type==='lessonsim').map((tr,i)=>Object.assign(JSON.parse(JSON.stringify(tr)),{id:id+'-tr'+(i+1)}));
        DRAFT.tests=(t.tests||[]).map((ts,i)=>Object.assign(JSON.parse(JSON.stringify(ts)),{id:id+'-t'+(i+1)})) }
      await save(DRAFT); A().toast('Курс створено (чернетка)'); location.hash='#/admin/builder/'+id });
}
const TABS=[['main','Основне'],['lessons','Уроки'],['trainers','Тренажери'],['tests','Тести'],['publish','Публікація']];
async function persist(msg){ await save(DRAFT); A().toast(msg||'Збережено') }
function vEdit(tab){
  const c=DRAFT, cc=compile(c);
  const head=`<a class="btn sm ghost" href="#/admin/builder">← Конструктор курсів</a>
    <div class="row" style="margin-top:12px"><span class="sw" style="background:${cc.color};width:18px;height:18px"></span><h1 class="grow" style="margin:0">${esc(c.title)}</h1><span class="pill ${c.status==='published'?'good':'warn'}">${c.status==='published'?'опубліковано':'чернетка'}</span><a class="btn sm ghost" href="#/course/${c.id}">Переглянути як учитель</a></div>
    <div class="tabs" style="margin-top:12px">${TABS.map(([k,l])=>`<a class="tab ${k===tab?'on':''}" href="#/admin/builder/${c.id}/${k}">${l}${k==='lessons'?' ('+(c.plan||[]).length+')':k==='trainers'?' ('+(c.trainers||[]).length+')':k==='tests'?' ('+(c.tests||[]).length+')':''}</a>`).join('')}</div>`;
  if(tab==='main') return vMain(head);
  if(tab==='lessons') return vLessons(head);
  if(tab==='trainers') return vTrainers(head);
  if(tab==='tests') return vTests(head);
  return vPublish(head);
}
function vMain(head){
  const c=DRAFT;
  shell(head+`<form class="card" id="mf" style="max-width:900px">
    <div class="grid g2" style="gap:10px"><div class="field"><label>Назва курсу *</label><input class="input" name="title" required value="${esc(c.title)}"></div><div class="field"><label>Коротка назва (у меню)</label><input class="input" name="short" value="${esc(c.short||'')}"></div>
    <div class="field"><label>Напрям</label><select class="input" name="dir">${(CFG.DIRS||[]).map(d=>`<option value="${d.key}" ${d.key===c.dir?'selected':''}>${esc(d.title)}</option>`).join('')}</select></div>
    <div class="field"><label>Колір курсу</label><div class="row" style="gap:6px">${COLORS.map(x=>`<label style="cursor:pointer"><input type="radio" name="color" value="${x}" ${x===c.color?'checked':''} style="display:none"><span class="sw" style="background:${x};width:26px;height:26px;border-radius:8px;display:inline-block;outline:${x===c.color?'3px solid var(--ink)':'none'};outline-offset:2px"></span></label>`).join('')}</div></div>
    <div class="field"><label>Вік учнів</label><input class="input" name="age" value="${esc(c.age||'')}" placeholder="9–11 років"></div><div class="field"><label>Тривалість</label><input class="input" name="duration" value="${esc(c.duration||'')}" placeholder="9 місяців · 1 раз на тиждень · 1,5 год"></div>
    <div class="field"><label>Група</label><input class="input" name="group" value="${esc(c.group||'')}" placeholder="до 8 учнів · набір на пару"></div><div class="field"><label>Обладнання / середовище</label><input class="input" name="tools" value="${esc(c.tools||'')}" placeholder="LEGO SPIKE Prime, ноутбук"></div>
    <div class="field"><label>Порядок у списку напряму</label><input class="input" name="order" type="number" value="${esc(c.order||50)}"></div></div>
    <div class="field"><label>Підзаголовок (одне речення)</label><input class="input" name="subtitle" value="${esc(c.subtitle||'')}"></div>
    <div class="field"><label>Опис курсу (абзаци через порожній рядок)</label><textarea class="input" name="about" rows="6">${esc(c.about||'')}</textarea></div>
    <div class="field"><label>Що потрібно (обладнання, програми)</label><textarea class="input" name="equipment" rows="3">${esc(c.equipment||'')}</textarea></div>
    <div class="field"><label>Методичні рекомендації</label><textarea class="input" name="method" rows="6">${esc(c.method||'')}</textarea></div>
    <div class="field"><label>Матеріали курсу (пояснення до файлів)</label><textarea class="input" name="materials" rows="3">${esc(c.materials||'')}</textarea></div>
    <div class="field"><label>Література й посилання (кожне з нового рядка)</label><textarea class="input" name="literature" rows="4">${esc(c.literature||'')}</textarea></div>
    <button class="btn" type="submit">Зберегти</button></form>`);
  $$('#mf input[name=color]').forEach(r=>r.onchange=()=>$$('#mf input[name=color]').forEach(x=>x.nextElementSibling.style.outline=x.checked?'3px solid var(--ink)':'none'));
  $('#mf').onsubmit=async e=>{ e.preventDefault(); const x=Object.fromEntries(new FormData(e.target).entries()); if(!x.title.trim()) return A().toast('Вкажіть назву');
    Object.assign(DRAFT,x,{title:x.title.trim(),order:Number(x.order)||50}); await persist(); vEdit('main') };
}
function lessonForm(l){ l=l||{}; return `<div class="grid g2" style="gap:10px"><div class="field"><label>Номер уроку (n) *</label><input class="input" name="n" type="number" step="0.5" required value="${esc(l.n==null?'':l.n)}"><div class="tiny muted">За номером прив’язуються файли в «Базі курсів» і тести блоків.</div></div>
    <div class="field"><label>Підпис номера</label><input class="input" name="label" value="${esc(l.label||'')}" placeholder="як номер, або «11–12»"></div>
    <div class="field"><label>Назва уроку *</label><input class="input" name="name" required value="${esc(l.name||'')}"></div><div class="field"><label>Розділ / блок (необов’язково)</label><input class="input" name="section" value="${esc(l.section||'')}" placeholder="Блок 1. Знайомство"></div></div>
    <div class="field"><label>Тема уроку</label><input class="input" name="topic" value="${esc(l.topic||'')}"></div>
    <div class="field"><label>Ключові поняття (через кому)</label><input class="input" name="focus" value="${esc((l.focus||[]).join(', '))}"></div>
    <div class="field"><label>Учитель має знати (кожен пункт з нового рядка)</label><textarea class="input" name="know" rows="4">${esc((l.know||[]).join('\n'))}</textarea></div>
    <div class="field"><label>Методична порада</label><textarea class="input" name="tip" rows="2">${esc(l.tip||'')}</textarea></div>
    <div class="field"><label>Тип уроку</label><select class="input" name="kind"><option value="">звичайний</option><option value="check" ${l.kind==='check'?'selected':''}>контроль / самостійна</option><option value="project" ${l.kind==='project'?'selected':''}>проєкт</option></select></div>` }
function readLesson(x){ const n=Number(x.n); if(!(n>0)) throw new Error('Номер уроку — додатне число.'); if(!x.name.trim()) throw new Error('Вкажіть назву уроку.');
  return {n,label:x.label.trim()||String(n),name:x.name.trim(),section:x.section.trim(),topic:x.topic.trim(),focus:x.focus.split(',').map(s=>s.trim()).filter(Boolean),know:lines(x.know),tip:x.tip.trim(),kind:x.kind} }
function vLessons(head){
  const P=(DRAFT.plan||[]).slice().sort((a,b)=>a.n-b.n);
  shell(head+`<div class="row" style="margin:6px 0 12px"><span class="muted small grow">Уроки курсу. Файли до кожного уроку додаються в «Базі курсів» (кнопка праворуч), тести блоків — там само у вкладці «Тести блоків».</span>
      <a class="btn ghost" href="#/admin/lib/course/${DRAFT.id}/files">Файли уроків у Базі курсів →</a><button class="btn ghost" id="bulk">Додати списком</button><button class="btn" id="add">+ Урок</button></div>
    <div class="card" style="padding:0;overflow:auto"><table class="prose ptable" style="width:100%;margin:0"><thead><tr><th>№</th><th>Урок</th><th>Розділ</th><th>Учитель має знати</th><th></th></tr></thead><tbody>
    ${P.map(l=>`<tr><td>${esc(l.label||l.n)}</td><td><b>${esc(l.name)}</b><div class="small muted">${esc(l.topic||'')}</div></td><td class="small">${esc(l.section||'')}</td><td class="small">${(l.know||[]).length} пункт(ів)${l.tip?' · є порада':''}</td>
      <td style="white-space:nowrap"><button class="btn sm ghost" data-el="${l.n}">Змінити</button><button class="btn sm ghost" data-dl="${l.n}">✕</button></td></tr>`).join('')||'<tr><td class="muted">Уроків ще немає.</td></tr>'}</tbody></table></div>`);
  $('#add').onclick=()=>modal('Новий урок',lessonForm({n:(P.length?Math.floor(P[P.length-1].n)+1:1)}),async x=>{ const l=readLesson(x); if(P.some(y=>y.n===l.n)) throw new Error('Урок з таким номером уже є.'); DRAFT.plan.push(l); await persist('Урок додано'); vEdit('lessons') });
  $$('[data-el]').forEach(b=>b.onclick=()=>{ const l=DRAFT.plan.find(y=>String(y.n)===b.dataset.el); modal('Урок '+l.label,lessonForm(l),async x=>{ const nl=readLesson(x); if(nl.n!==l.n&&DRAFT.plan.some(y=>y.n===nl.n)) throw new Error('Урок з таким номером уже є.'); Object.assign(l,nl); await persist(); vEdit('lessons') }) });
  $$('[data-dl]').forEach(b=>b.onclick=async()=>{ if(!confirm('Видалити урок з плану? Файли в Базі курсів не видаляються.')) return; DRAFT.plan=DRAFT.plan.filter(y=>String(y.n)!==b.dataset.dl); await persist('Урок видалено'); vEdit('lessons') });
  $('#bulk').onclick=()=>modal('Додати уроки списком',`<p class="small muted">Кожен рядок — урок: «Назва уроку | тема». Номери підуть далі за останнім уроком.</p><textarea class="input" name="list" rows="12" placeholder="Знайомство з набором | Деталі, хаб, мотор&#10;Перша модель | Мотор і кнопка"></textarea>`, async x=>{
    let n=P.length?Math.floor(P[P.length-1].n):0; lines(x.list).forEach(l=>{ const [name,topic]=l.split('|').map(s=>s.trim()); n++; DRAFT.plan.push({n,label:String(n),name,topic:topic||'',focus:[],know:[],tip:''}) }); await persist('Уроки додано'); vEdit('lessons') });
}
function trainerModal(t){
  const isNew=!t; const type=t?t.type:'match';
  const simple=!!TYPES[type];
  const w=modal(isNew?'Новий тренажер':'Тренажер: '+t.title,`<div class="grid g2" style="gap:10px"><div class="field"><label>Шаблон (тип)</label><select class="input" name="type" ${isNew?'':'disabled'}>${Object.keys(TYPES).map(k=>`<option value="${k}" ${k===type?'selected':''}>${TYPES[k]}</option>`).join('')}${!simple?`<option value="${esc(type)}" selected>${esc(type)} (скопійований)</option>`:''}</select></div>
    <div class="field"><label>Назва *</label><input class="input" name="title" required value="${esc(t?t.title:'')}"></div></div>
    <div class="field"><label>Короткий опис / завдання</label><input class="input" name="desc" value="${esc(t?t.desc||'':'')}"></div>
    ${simple?`<div class="field"><label>Зміст</label><textarea class="input" name="body" rows="14" style="font-family:var(--f-mono,monospace);font-size:13px">${esc(t?trainerToText(t):'')}</textarea><pre class="tiny muted" id="help" style="white-space:pre-wrap;margin:6px 0 0">${esc(HELP[type])}</pre></div>`
      :`<div class="field"><label>Зміст (JSON) — складний тренажер, скопійований з іншого курсу</label><textarea class="input" name="json" rows="16" style="font-family:monospace;font-size:12px">${esc(JSON.stringify(Object.assign({},t,{id:undefined,title:undefined,desc:undefined,type:undefined}),null,1))}</textarea><div class="tiny muted">Редагуйте тексти в лапках, не змінюючи структуру.</div></div>`}`, async x=>{
      if(!x.title.trim()) throw new Error('Вкажіть назву.');
      const ty=isNew?x.type:type; let body;
      if(TYPES[ty]) body=textToTrainer(ty,x.body); else { try{ body=JSON.parse(x.json) }catch(e){ throw new Error('Помилка в JSON: '+e.message) } }
      const tr=Object.assign({},body,{id:t?t.id:DRAFT.id+'-tr'+Date.now().toString(36),type:ty,title:x.title.trim(),desc:x.desc.trim()});
      if(t){ const i=DRAFT.trainers.findIndex(y=>y.id===t.id); DRAFT.trainers[i]=tr } else DRAFT.trainers.push(tr);
      await persist('Тренажер збережено'); vEdit('trainers') });
  const sel=$('select[name=type]',w); if(sel&&isNew) sel.onchange=()=>{ $('#help',w).textContent=HELP[sel.value] };
}
function copyModal(kind){
  const src=allCourses().filter(c=>c.id!==DRAFT.id&&(c[kind]||[]).length);
  modal(kind==='trainers'?'Скопіювати тренажер з курсу':'Скопіювати тест з курсу',`<div class="field"><label>Курс</label><select class="input" name="cid" id="cpc">${src.map(c=>`<option value="${c.id}">${esc(c.title)}</option>`).join('')}</select></div>
    <div class="field"><label>${kind==='trainers'?'Тренажер':'Тест'}</label><select class="input" name="iid" id="cpi"></select></div><p class="tiny muted">Копія з’явиться у вашому курсі — далі змініть зміст під новий курс.</p>`, async x=>{
      const c=src.find(y=>y.id===x.cid), it=(c[kind]||[]).find(y=>y.id===x.iid); if(!it) throw new Error('Оберіть елемент.');
      const cp=JSON.parse(JSON.stringify(it)); cp.id=DRAFT.id+(kind==='trainers'?'-tr':'-t')+Date.now().toString(36); cp.title=(cp.title||'')+' (копія)';
      DRAFT[kind].push(cp); await persist('Скопійовано'); vEdit(kind) }, 'Скопіювати');
  const fill=()=>{ const c=src.find(y=>y.id===$('#cpc').value); $('#cpi').innerHTML=(c?c[kind]:[]).map(i=>`<option value="${esc(i.id)}">${esc(i.title)}${i.type?' · '+esc(TYPES[i.type]||i.type):''}</option>`).join('') };
  $('#cpc').onchange=fill; fill();
}
function move(arr,i,d){ const j=i+d; if(j<0||j>=arr.length) return; [arr[i],arr[j]]=[arr[j],arr[i]] }
function vTrainers(head){
  const T=DRAFT.trainers||[];
  shell(head+`<div class="row" style="margin:6px 0 12px"><span class="muted small grow">Шаблони: ${Object.values(TYPES).join(' · ')}. Складніші тренажери (симулятор уроків, шестерні тощо) можна скопіювати з наявного курсу.</span><button class="btn ghost" id="cp">Скопіювати з курсу</button><button class="btn" id="add">+ Тренажер за шаблоном</button></div>
    <div class="card" style="padding:0;overflow:auto"><table class="prose ptable" style="width:100%;margin:0"><tbody>${T.map((t,i)=>`<tr><td><b>${esc(t.title)}</b><div class="small muted">${esc(TYPES[t.type]||t.type)}${t.desc?' · '+esc(t.desc):''}</div></td>
      <td style="white-space:nowrap;text-align:right"><a class="btn sm ghost" href="#/course/${DRAFT.id}/trainers/${encodeURIComponent(t.id)}">Спробувати</a><button class="btn sm ghost" data-up="${i}">↑</button><button class="btn sm ghost" data-dn="${i}">↓</button><button class="btn sm ghost" data-et="${i}">Змінити</button><button class="btn sm ghost" data-dt="${i}">✕</button></td></tr>`).join('')||'<tr><td class="muted">Тренажерів ще немає.</td></tr>'}</tbody></table></div>
    <p class="tiny muted">«Спробувати» відкриває тренажер так, як його побачить учитель (для чернетки — лише вам).</p>`);
  $('#add').onclick=()=>trainerModal(); $('#cp').onclick=()=>copyModal('trainers');
  $$('[data-et]').forEach(b=>b.onclick=()=>trainerModal(T[Number(b.dataset.et)]));
  $$('[data-dt]').forEach(b=>b.onclick=async()=>{ if(!confirm('Видалити тренажер? Результати вчителів за нього перестануть враховуватися.')) return; T.splice(Number(b.dataset.dt),1); await persist('Видалено'); vEdit('trainers') });
  $$('[data-up]').forEach(b=>b.onclick=async()=>{ move(T,Number(b.dataset.up),-1); await persist(); vEdit('trainers') });
  $$('[data-dn]').forEach(b=>b.onclick=async()=>{ move(T,Number(b.dataset.dn),1); await persist(); vEdit('trainers') });
}
function testModal(t){
  modal(t?'Тест: '+t.title:'Новий тест',`<div class="grid g2" style="gap:10px"><div class="field"><label>Назва тесту *</label><input class="input" name="title" required value="${esc(t?t.title:'')}"></div>
    <div class="field"><label>Опис</label><input class="input" name="desc" value="${esc(t?t.desc||'':'')}"></div></div>
    <label class="row small" style="gap:6px;margin-bottom:8px"><input type="checkbox" name="final" ${t&&t.final?'checked':''}> підсумковий тест курсу</label>
    <div class="field"><label>Питання</label><textarea class="input" name="body" rows="18" style="font-family:var(--f-mono,monospace);font-size:13px">${esc(t?showQ(t.questions):'')}</textarea>
    <pre class="tiny muted" style="white-space:pre-wrap;margin:6px 0 0">«? питання», «+ правильна відповідь», «- неправильна», «! пояснення» (необов’язково). Порожній рядок між питаннями.
Варіанти перемішуються автоматично. Порада: робіть неправильні варіанти такої ж довжини, як правильний.</pre></div>`, async x=>{
    if(!x.title.trim()) throw new Error('Вкажіть назву.'); const qs=parseQ(x.body); if(qs.length<3) throw new Error('Потрібно щонайменше 3 питання.');
    const ts={id:t?t.id:DRAFT.id+'-t'+Date.now().toString(36),title:x.title.trim(),desc:x.desc.trim(),questions:qs}; if(x.final) ts.final=true;
    if(t){ const i=DRAFT.tests.findIndex(y=>y.id===t.id); DRAFT.tests[i]=ts } else DRAFT.tests.push(ts); await persist('Тест збережено'); vEdit('tests') });
}
function vTests(head){
  const T=DRAFT.tests||[];
  shell(head+`<div class="row" style="margin:6px 0 12px"><span class="muted small grow">Тести навчання вчителів цього курсу (зараховуються від ${A().PASS}%). Тести блоків для доступу до файлів уроків (кожні 4 уроки) створюються в «Базі курсів» → курс → «Тести блоків».</span>
    <a class="btn ghost" href="#/admin/lib/course/${DRAFT.id}/tests">Тести блоків →</a><button class="btn ghost" id="cp">Скопіювати з курсу</button><button class="btn" id="add">+ Тест</button></div>
    <div class="card" style="padding:0;overflow:auto"><table class="prose ptable" style="width:100%;margin:0"><tbody>${T.map((t,i)=>`<tr><td><b>${esc(t.title)}</b>${t.final?' <span class="pill">підсумковий</span>':''}<div class="small muted">${(t.questions||[]).length} питань${t.desc?' · '+esc(t.desc):''}</div></td>
      <td style="white-space:nowrap;text-align:right"><a class="btn sm ghost" href="#/course/${DRAFT.id}/tests/${encodeURIComponent(t.id)}">Спробувати</a><button class="btn sm ghost" data-up="${i}">↑</button><button class="btn sm ghost" data-dn="${i}">↓</button><button class="btn sm ghost" data-et="${i}">Змінити</button><button class="btn sm ghost" data-dt="${i}">✕</button></td></tr>`).join('')||'<tr><td class="muted">Тестів ще немає.</td></tr>'}</tbody></table></div>`);
  $('#add').onclick=()=>testModal(); $('#cp').onclick=()=>copyModal('tests');
  $$('[data-et]').forEach(b=>b.onclick=()=>testModal(T[Number(b.dataset.et)]));
  $$('[data-dt]').forEach(b=>b.onclick=async()=>{ if(!confirm('Видалити тест?')) return; T.splice(Number(b.dataset.dt),1); await persist('Видалено'); vEdit('tests') });
  $$('[data-up]').forEach(b=>b.onclick=async()=>{ move(T,Number(b.dataset.up),-1); await persist(); vEdit('tests') });
  $$('[data-dn]').forEach(b=>b.onclick=async()=>{ move(T,Number(b.dataset.dn),1); await persist(); vEdit('tests') });
}
function vPublish(head){
  const c=DRAFT, pub=c.status==='published';
  const checks=[[c.about,'Опис курсу'],[(c.plan||[]).length,'Уроки в плані'],[(c.trainers||[]).length,'Хоча б один тренажер'],[(c.tests||[]).length,'Хоча б один тест']];
  shell(head+`<div class="grid g2"><div class="card"><h3 style="margin-top:0">Готовність</h3><ul class="small" style="padding-left:18px">${checks.map(([ok,l])=>`<li>${ok?'✅':'⬜'} ${esc(l)}</li>`).join('')}</ul>
      <p class="small">${pub?'Курс опубліковано: учителі бачать його в навчанні (Academy).':'Курс — чернетка: його бачите лише ви.'}</p>
      <button class="btn" id="pub">${pub?'Зняти з публікації (у чернетку)':'Опублікувати для вчителів'}</button></div>
    <div class="card"><h3 style="margin-top:0">Далі</h3><ol class="small" style="padding-left:18px"><li>У «Базі курсів» додайте файли до уроків курсу.</li><li>Там само створіть тести блоків (кожні 4 уроки) й опублікуйте їх.</li><li>Відкрийте курс учителям у вкладці «Доступ учителів».</li></ol>
      <a class="btn ghost" href="#/admin/lib/course/${c.id}/files">Перейти до Бази курсів</a>
      <hr style="border:0;border-top:1px solid var(--line);margin:16px 0"><button class="btn ghost" id="del" style="color:var(--bad)">Видалити курс</button>
      <p class="tiny muted">Видалення прибирає курс з навчання. Файли на Диску й записи «Бази курсів» лишаються.</p></div></div>`);
  $('#pub').onclick=async()=>{ if(!pub&&!(c.plan||[]).length&&!confirm('У курсі ще немає уроків. Опублікувати все одно?')) return; c.status=pub?'draft':'published'; await persist(pub?'Курс у чернетках':'Курс опубліковано'); vEdit('publish') };
  $('#del').onclick=async()=>{ if(!confirm('Видалити курс «'+c.title+'»? Прогрес учителів за цим курсом перестане відображатися.')) return; await remove(c.id); DRAFT=null; A().toast('Курс видалено'); location.hash='#/admin/builder' };
}

window.RS_BUILDER = { route, refresh, compile, _parseQ:parseQ, _parseSit:parseSit, _textToTrainer:textToTrainer };
})();
