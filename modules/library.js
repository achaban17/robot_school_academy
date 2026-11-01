/* Robot School Academy — база курсів (v2.0).
   Учитель: курси, які відкрив методист → уроки блоками → тест після блоку відкриває наступні уроки.
   Файли відкриваються у вбудованому переглядачі з водяним знаком: перегляд і друк, без завантаження.
   Адміністратор: доступ людям, режим відкриття уроків, прохідний бал, файли (заміна, додавання, приховування),
   редактор тестів, журнал переглядів і друку.
   У робочій версії все зберігається на сервері (Apps Script + Google Диск), у беті — демо-база в браузері. */
(function(){
'use strict';
const A = () => window.RS_APP;
const $ = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>Array.from(el.querySelectorAll(s));
const esc = s => A().esc(s);
const fmtDT = d => d ? new Date(d).toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
const MODES = {tests:'Блоками: наступні уроки відкриваються після тесту', all:'Усі уроки відкриті одразу', manual:'Уроки відкриває адміністратор вручну'};
const KINDS = ['SB','TB','Інструкція','Код','Додатково'];
const FSTAT = {active:'Доступний', hidden:'Прихований', draft:'Чернетка (лише адмін)', archived:'Замінений (архів)'};
const courseMeta = cid => (A().COURSES.find(c=>c.id===cid) || (cid==='transformers-old' ? A().COURSES.find(c=>c.id==='transformers') : null) || {color:'#0A44DC', title:cid});

/* ======================================================================
   ВИКЛИКИ СЕРВЕРА (prod) або локальної демо-бази (beta)
   ====================================================================== */
async function call(action, payload){
  const {BETA, S} = A();
  const body = Object.assign({action}, payload||{});
  if(S.admin) body.adminToken = S.adminToken; else { body.email = S.user.email; body.token = S.token; }
  if(BETA) return Local.handle(action, body);
  try{ return await A().callApi(body) }
  catch(e){ if(/Сесія (адміністратора )?застаріла/.test(e.message)){ A().toast(e.message); A().signOut() } throw e }
}

/* ---------- спільна логіка стану курсу (та сама, що в Code.gs) ---------- */
function courseState(cid, email, lib, tests, set, acc, best, withFiles){
  const s = set[cid] || {mode:'tests', pass:75};
  const lessons = {};
  lib.filter(f=>f.cid===cid && f.status!=='deleted').forEach(f=>{
    const L = lessons[f.n] = lessons[f.n] || {n:f.n, label:f.label, name:f.lname, always:f.always, files:[]};
    if(f.always) L.always = true;
    if(f.status==='active') L.files.push({id:f.id, title:f.title, kind:f.kind, size:f.size});
  });
  const T = tests.filter(t=>t.cid===cid).sort((a,b)=>a.after-b.after);
  let upTo;
  if(s.mode==='all') upTo = 1e9; else if(s.mode==='manual') upTo = -1e9;
  else { upTo = 1e9; for(const t of T){ const b=best[email+'|'+cid+'|'+t.id]; if(!(t.status==='published' && b && b.passed)){ upTo=t.after; break } } }
  if(acc && acc.upTo!==null && acc.upTo!==undefined && !isNaN(acc.upTo)) upTo = Math.max(upTo, acc.upTo);
  const list = Object.values(lessons).sort((a,b)=>a.n-b.n).map(L=>{ const open = L.always || L.n<=upTo;
    return {n:L.n, label:L.label, name:L.name, always:!!L.always, open, files: open&&withFiles ? L.files : L.files.map(f=>({title:f.title, kind:f.kind}))} });
  const tl = T.map(t=>{ const b=best[email+'|'+cid+'|'+t.id]||{};
    return {id:t.id, after:t.after, title:(t.t&&t.t.title)||('Тест після уроку '+t.after), status:t.status, count:((t.t&&t.t.questions)||[]).length,
      available: t.status==='published' && t.after<=upTo, passed:!!b.passed, percent:b.percent||0, attempts:b.attempts||0} });
  return {cid, mode:s.mode, pass:s.pass, upTo, lessons:list, tests:tl};
}

/* ---------- локальна демо-база для бета-версії ---------- */
const Local = {
  key(){ return A().KEY+'lib' },
  load(){
    const {LS} = A(); let st = LS.get(this.key(), null);
    const D = window.RS_LIBDEMO;
    if(!st && D){
      st = {lib:[], tests:[], settings:{}, access:[], bres:[], log:[], uploads:{}};
      D.library.courses.forEach(c=>{ st.settings[c.id]={cid:c.id,title:c.title,mode:c.mode||'tests',pass:75};
        c.lessons.forEach(l=>l.files.forEach(f=>st.lib.push({id:'demo:'+l.dir+'/'+f.file, cid:c.id, n:l.n, lname:l.name, label:String(l.label), title:f.title, kind:f.kind, status:f.draft?'draft':'active', path:l.dir+'/'+f.file, size:f.size||0, updated:'', always:!!l.always}))) });
      Object.keys(D.tests).forEach(cid=>D.tests[cid].forEach(t=>st.tests.push({cid, id:t.id, after:t.after, status:t.status||'draft', t:{title:t.title, questions:t.questions}, updated:''})));
      this.save(st);
    }
    return st || {lib:[], tests:[], settings:{}, access:[], bres:[], log:[], uploads:{}};
  },
  save(st){ try{ localStorage.setItem(this.key(), JSON.stringify(st)) }catch(e){ throw new Error('У браузері забракло місця для демо-бази (файл завеликий для бети).') } },
  best(st, email){ const o={}; st.bres.forEach(r=>{ if(email && r.email!==email) return; const k=r.email+'|'+r.cid+'|'+r.testId; const p=o[k]||{percent:0,passed:false,attempts:0}; o[k]={percent:Math.max(p.percent,r.percent), passed:p.passed||r.passed, attempts:p.attempts+1, at:r.at} }); return o },
  courses(st){ const o={}; st.lib.forEach(f=>{ o[f.cid]=o[f.cid]||{cid:f.cid,title:(st.settings[f.cid]||{}).title||f.cid,n:{}}; o[f.cid].n[f.n]=1 }); return Object.values(o).map(c=>({cid:c.cid,title:c.title,lessons:Object.keys(c.n).length})) },
  who(body){ const S=A().S; return S.admin?{email:'admin',fio:'Адміністратор',branch:''}:{email:S.user.email,fio:S.user.fio,branch:S.user.branch} },
  handle(action, b){
    const st=this.load(), S=A().S, email=S.admin?'admin':S.user.email;
    const needAdmin=()=>{ if(!S.admin) throw new Error('Потрібен вхід адміністратора.') };
    const acc=cid=>st.access.find(a=>a.email===email && a.cid===cid && a.granted);
    const state=(cid,files)=>courseState(cid,email,st.lib,st.tests,st.settings,acc(cid),this.best(st,email),files);
    const guard=id=>{ const row=st.lib.find(f=>f.id===id); if(!row) throw new Error('Файл не знайдено.');
      if(S.admin) return row; if(row.status!=='active') throw new Error('Файл недоступний.'); if(!acc(row.cid)) throw new Error('Методист ще не відкрив вам цей курс.');
      const L=state(row.cid,false).lessons.find(l=>l.n===row.n); if(!L||!L.open) throw new Error('Цей урок ще закритий. Складіть тест попереднього блоку.'); return row };
    const log=(row,act)=>{ const w=this.who(); st.log.push({at:new Date().toISOString(),email:w.email,fio:w.fio,branch:w.branch,cid:row.cid,lesson:row.label,file:row.title,action:act}); this.save(st) };
    switch(action){
      case 'libMe': return {courses:this.courses(st), granted: st.access.filter(a=>a.email===email&&a.granted).map(a=>state(a.cid,true))};
      case 'libFile': { const row=guard(b.id); const data=st.uploads[row.id] || (window.RS_LIBDEMO.files[row.path]); if(!data) throw new Error('У демо-базі немає цього файлу.');
        if(!b.offset) log(row,'перегляд'); const bin=atob(data); return {data, offset:0, total:bin.length, mime:/\.txt$/i.test(row.path)?'text/plain':'application/pdf', title:row.title} }
      case 'libLog': { const row=guard(b.id); log(row,b.action||'друк'); return {} }
      case 'blockTest': case 'blockSubmit': {
        if(!acc(b.cid)) throw new Error('Методист ще не відкрив вам цей курс.');
        const s=state(b.cid,false), ti=s.tests.find(t=>t.id===b.testId); if(!ti||!ti.available) throw new Error('Тест поки недоступний.');
        const t=st.tests.find(x=>x.cid===b.cid&&x.id===b.testId).t;
        if(action==='blockTest') return {test:{id:b.testId,title:ti.title,pass:t.pass||s.pass,questions:t.questions.map(q=>({q:q.q,o:q.o,code:q.code||''}))}};
        let score=0; const review=t.questions.map((q,i)=>{ const ok=Number((b.answers||[])[i])===q.a; if(ok) score++; return {ok, ex:ok?'':(q.ex||'')} });
        const max=t.questions.length, percent=max?Math.round(100*score/max):0, pass=t.pass||s.pass, passed=percent>=pass;
        st.bres.push({at:new Date().toISOString(),email,cid:b.cid,testId:b.testId,score,max,percent,passed}); this.save(st);
        return {score,max,percent,passed,pass,review,state:state(b.cid,true)} }
      case 'admLib': needAdmin(); { const best=this.best(st,null); return {lib:st.lib, tests:st.tests, settings:st.settings, access:st.access, results:Object.keys(best).map(k=>{const p=k.split('|');return Object.assign({email:p[0],cid:p[1],testId:p[2]},best[k])})} }
      case 'admGrant': { needAdmin(); const e=String(b.email).toLowerCase(); let a=st.access.find(x=>x.email===e&&x.cid===b.cid); if(!a){ a={email:e,cid:b.cid}; st.access.push(a) }
        Object.assign(a,{granted:!!b.granted, upTo:(b.upTo===''||b.upTo===null||b.upTo===undefined)?null:Number(b.upTo), at:new Date().toISOString(), note:b.note||''}); this.save(st); return {access:st.access} }
      case 'admSettings': needAdmin(); st.settings[b.cid]=Object.assign({},st.settings[b.cid]||{},{cid:b.cid,title:b.title||(st.settings[b.cid]||{}).title,mode:b.mode,pass:Number(b.pass)||75}); this.save(st); return {settings:st.settings};
      case 'admTestSave': { needAdmin(); const id=b.id||('t'+Date.now().toString(36)); let t=st.tests.find(x=>x.cid===b.cid&&x.id===id); if(!t){ t={cid:b.cid,id}; st.tests.push(t) }
        (b.test.questions||[]).forEach(q=>{ if(!(q.o&&q.o.length>=2)||!(q.a>=0&&q.a<q.o.length)) throw new Error('Перевірте варіанти й правильну відповідь у питанні: '+q.q) });
        Object.assign(t,{after:Number(b.after)||0,status:b.status==='published'?'published':'draft',t:b.test,updated:new Date().toISOString()}); this.save(st); return {tests:st.tests.filter(x=>x.cid===b.cid)} }
      case 'admTestDelete': needAdmin(); st.tests=st.tests.filter(x=>!(x.cid===b.cid&&x.id===b.id)); this.save(st); return {tests:st.tests.filter(x=>x.cid===b.cid)};
      case 'admFile': { needAdmin(); const f=st.lib.find(x=>x.id===b.id); if(!f) throw new Error('Файл не знайдено.'); if(b.status) f.status=b.status; if(b.title) f.title=b.title; if(b.kind) f.kind=b.kind; f.updated=new Date().toISOString(); this.save(st); return {lib:st.lib} }
      case 'admUpload': { needAdmin(); const same=st.lib.find(f=>f.cid===b.cid&&f.n===Number(b.n)); const id='up:'+Date.now().toString(36);
        st.uploads[id]=b.data; st.lib.push({id,cid:b.cid,n:Number(b.n),lname:(same&&same.lname)||('Урок '+b.n),label:(same&&same.label)||String(b.n),title:b.title||b.name,kind:b.kind||'Додатково',status:b.status==='draft'?'draft':'active',path:b.cid+'/'+b.n+'/'+b.name,size:atob(b.data).length,updated:new Date().toISOString(),always:!!(same&&same.always)});
        if(b.replaceId){ const o=st.lib.find(x=>x.id===b.replaceId); if(o) o.status='archived' } this.save(st); return {lib:st.lib} }
      case 'admLog': needAdmin(); return {log:st.log.slice().reverse()};
    }
    throw new Error('Невідома дія');
  }
};

/* ======================================================================
   ПЕРЕГЛЯДАЧ ФАЙЛІВ: водяний знак, друк, без завантаження
   ====================================================================== */
let pdfjsReady = false;
function setupPdfjs(){
  if(pdfjsReady || !window.pdfjsLib) return;
  const base = location.href.split('#')[0].replace(/[^/]*$/,'');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = base+'vendor/pdfjs/pdf.worker.min.js';
  pdfjsReady = true;
}
async function fetchFile(id){
  let off=0, total=1, parts=[], mime='application/pdf', title='';
  while(off<total){
    const j = await call('libFile',{id, offset:off});
    const bin = atob(j.data); const u8 = new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    parts.push(u8); total=j.total; mime=j.mime||mime; title=j.title; off += u8.length;
    const pr=$('#vw-progress'); if(pr) pr.textContent = total>3e6 ? `Завантаження ${Math.round(100*off/total)}%` : '';
    if(!u8.length) break;
  }
  const out = new Uint8Array(parts.reduce((a,p)=>a+p.length,0)); let k=0; parts.forEach(p=>{ out.set(p,k); k+=p.length });
  return {bytes:out, mime, title};
}
function wmText(){ const u=A().S.user; return `${u.fio} · ${A().S.admin?'адміністратор':u.email} · ${new Date().toLocaleDateString('uk-UA')} · Robot School`; }
function drawWatermark(ctx, w, h){
  ctx.save(); ctx.globalAlpha=.13; ctx.fillStyle='#0A44DC'; ctx.font=`600 ${Math.max(12,Math.round(w/42))}px Onest, Arial, sans-serif`;
  ctx.translate(w/2,h/2); ctx.rotate(-Math.PI/6); const t=wmText(), step=Math.max(90,Math.round(w/7));
  for(let y=-h;y<h;y+=step) for(let x=-w*1.2;x<w*1.2;x+=ctx.measureText(t).width+60) ctx.fillText(t,x,y);
  ctx.restore();
  ctx.save(); ctx.globalAlpha=.55; ctx.fillStyle='#0A44DC'; ctx.font=`600 ${Math.max(10,Math.round(w/70))}px Onest, Arial, sans-serif`; ctx.fillText(wmText(), 16, h-12); ctx.restore();
}
let VIEW = null;  // {pdf, id, title, row}
function closeViewer(){ const v=$('#viewer'); if(v) v.remove(); document.body.style.overflow=''; VIEW=null; document.removeEventListener('keydown', keyGuard, true) }
function keyGuard(e){
  const k=(e.key||'').toLowerCase();
  if((e.ctrlKey||e.metaKey) && (k==='s'||k==='p')){ e.preventDefault(); e.stopPropagation(); if(k==='p') printFile(); }
  if(k==='escape') closeViewer();
}
async function openFile(id, title){
  setupPdfjs();
  closeViewer();
  const v=document.createElement('div'); v.id='viewer'; v.className='viewer';
  v.innerHTML=`<div class="vw-bar"><b class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(title)}</b><span class="tiny" id="vw-progress">Завантаження…</span>
    <button class="btn sm ghost" id="vw-zo" title="Зменшити">−</button><button class="btn sm ghost" id="vw-zi" title="Збільшити">+</button>
    <button class="btn sm" id="vw-print">🖨 Друк</button><button class="btn sm ghost" id="vw-close">✕ Закрити</button></div>
    <div class="vw-body" id="vw-body"></div><div class="vw-note">Файл призначений лише для вчителя. Завантаження вимкнено; друк фіксується в журналі.</div>`;
  document.body.appendChild(v); document.body.style.overflow='hidden';
  v.addEventListener('contextmenu',e=>e.preventDefault()); v.addEventListener('dragstart',e=>e.preventDefault());
  document.addEventListener('keydown', keyGuard, true);
  $('#vw-close').onclick=closeViewer; $('#vw-print').onclick=printFile;
  try{
    const f = await fetchFile(id);
    VIEW = {id, title, scale:1, mime:f.mime};
    if(/^text\//.test(f.mime)){
      const txt=new TextDecoder('utf-8').decode(f.bytes); VIEW.text=txt;
      $('#vw-body').innerHTML=`<div class="vw-text"><pre>${esc(txt)}</pre></div>`;
      const c=document.createElement('canvas'); c.width=900; c.height=700; drawWatermark(c.getContext('2d'),900,700);
      $('.vw-text').style.backgroundImage=`url(${c.toDataURL()})`;
      $('#vw-progress').textContent=''; $('#vw-zo').style.display=$('#vw-zi').style.display='none';
      return;
    }
    VIEW.pdf = await window.pdfjsLib.getDocument({data:f.bytes, isEvalSupported:false}).promise;
    $('#vw-progress').textContent = VIEW.pdf.numPages+' стор.';
    renderPages();
    $('#vw-zo').onclick=()=>{ VIEW.scale=Math.max(.5,VIEW.scale-.2); renderPages() };
    $('#vw-zi').onclick=()=>{ VIEW.scale=Math.min(3,VIEW.scale+.2); renderPages() };
  }catch(e){ $('#vw-body').innerHTML=`<div class="callout bad" style="margin:20px"><b>Не вдалося відкрити файл</b><p>${esc(e.message||e)}</p></div>`; $('#vw-progress').textContent='' }
}
async function renderPages(){
  const body=$('#vw-body'); if(!body||!VIEW||!VIEW.pdf) return; body.innerHTML='';
  const width=Math.min(body.clientWidth-24, 980);
  for(let i=1;i<=VIEW.pdf.numPages;i++){
    const holder=document.createElement('div'); holder.className='vw-page'; holder.dataset.p=i; body.appendChild(holder);
  }
  const io = new IntersectionObserver(ents=>ents.forEach(async en=>{
    if(!en.isIntersecting||en.target.dataset.done) return; en.target.dataset.done=1; io.unobserve(en.target);
    const page=await VIEW.pdf.getPage(+en.target.dataset.p); const vp0=page.getViewport({scale:1}); const sc=width/vp0.width*VIEW.scale;
    const dpr=Math.min(2,window.devicePixelRatio||1); const vp=page.getViewport({scale:sc*dpr});
    const c=document.createElement('canvas'); c.width=vp.width; c.height=vp.height; c.style.width=(vp.width/dpr)+'px';
    await page.render({canvasContext:c.getContext('2d'), viewport:vp}).promise; drawWatermark(c.getContext('2d'),c.width,c.height);
    en.target.appendChild(c);
  }),{root:body, rootMargin:'600px'});
  $$('.vw-page',body).forEach(h=>{ h.style.minHeight=Math.round(width*1.3*VIEW.scale)+'px'; io.observe(h) });
}
async function printFile(){
  if(!VIEW) return;
  const btn=$('#vw-print'); if(btn){ btn.disabled=true; btn.textContent='Готуємо друк…' }
  try{
    let html='';
    if(VIEW.text){ html=`<pre style="font:12px/1.45 monospace;white-space:pre-wrap">${esc(VIEW.text)}</pre><div style="position:fixed;bottom:6px;left:6px;font:10px Arial;color:#557">${esc(wmText())}</div>`; }
    else {
      const n=Math.min(VIEW.pdf.numPages,150);
      for(let i=1;i<=n;i++){ const page=await VIEW.pdf.getPage(i); const vp=page.getViewport({scale:1.6}); const c=document.createElement('canvas'); c.width=vp.width; c.height=vp.height;
        await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise; drawWatermark(c.getContext('2d'),c.width,c.height);
        html+=`<img src="${c.toDataURL('image/jpeg',.85)}">`; if(btn) btn.textContent=`Готуємо друк… ${i}/${n}`; }
    }
    const fr=document.createElement('iframe'); fr.style.cssText='position:fixed;width:0;height:0;border:0;right:0;bottom:0'; document.body.appendChild(fr);
    fr.contentDocument.open(); fr.contentDocument.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(VIEW.title)}</title><style>@page{margin:8mm}body{margin:0}img{width:100%;display:block;page-break-after:always}</style></head><body oncontextmenu="return false">${html}</body></html>`); fr.contentDocument.close();
    await new Promise(r=>setTimeout(r,400));
    call('libLog',{id:VIEW.id, action:'друк'}).catch(()=>{});
    fr.contentWindow.focus(); fr.contentWindow.print();
    setTimeout(()=>fr.remove(), 60000);
  }catch(e){ A().toast('Не вдалося підготувати друк: '+(e.message||e)) }
  finally{ if(btn){ btn.disabled=false; btn.textContent='🖨 Друк' } }
}

/* ======================================================================
   УЧИТЕЛЬ: БАЗА КУРСІВ
   ====================================================================== */
let ME = null;
async function loadMe(){ ME = await call('libMe'); return ME }
function route(p){
  if(A().S.admin && !p[0]) return adminRoute([]);
  if(p[0] && p[1]==='test') return viewTest(p[0], decodeURIComponent(p[2]||''));
  if(p[0]) return viewCourse(p[0]);
  return viewList();
}
function head(t){ return `<h1>${esc(t)}</h1>` }
async function viewList(){
  A().shell('lib', head('База курсів')+'<div class="card"><p class="muted">Завантаження…</p></div>');
  let me; try{ me=await loadMe() }catch(e){ return A().shell('lib', head('База курсів')+`<div class="callout bad"><b>Не вдалося завантажити базу</b><p>${esc(e.message)}</p></div>`) }
  const g = Object.fromEntries(me.granted.map(s=>[s.cid,s]));
  const card = c => { const s=g[c.cid], m=courseMeta(c.cid);
    if(!s) return `<div class="card lcard locked"><div class="row"><span class="sw" style="background:${m.color}"></span><b>${esc(c.title)}</b><span class="grow"></span>${A().I.lock}</div><p class="small muted" style="margin:8px 0 0">${c.lessons} уроків · доступ відкриває методист</p></div>`;
    const reg=s.lessons.filter(l=>!l.always), open=reg.filter(l=>l.open).length, tp=s.tests.filter(t=>t.passed).length;
    return `<a class="card lcard" href="#/lib/${c.cid}"><div class="row"><span class="sw" style="background:${m.color}"></span><b>${esc(c.title)}</b></div>
      <div class="bar" style="margin:10px 0 6px"><i style="width:${reg.length?Math.round(100*open/reg.length):0}%;background:${m.color}"></i></div>
      <div class="small muted">Відкрито уроків: <b>${open}</b> з ${reg.length} · тестів складено: <b>${tp}</b> з ${s.tests.length}</div></a>` };
  const mine=me.courses.filter(c=>g[c.cid]), rest=me.courses.filter(c=>!g[c.cid]);
  A().shell('lib', `${head('База курсів')}
    <p class="muted" style="max-width:860px">Тут файли уроків курсів, які вам відкрив методист: учнівські (SB) і вчительські (TB) конспекти, інструкції, код. Уроки відкриваються блоками: після кожного блоку — короткий тест, і після його складання стають доступні наступні уроки. Файли можна переглядати й друкувати, але не завантажувати.</p>
    ${mine.length?`<h2>Мої курси</h2><div class="grid g3">${mine.map(card).join('')}</div>`:`<div class="callout info"><b>Поки що вам не відкрито жодного курсу</b><p>Доступ до матеріалів уроків надає методист. Пройдіть навчання вчителів і <a href="#/messages">напишіть методисту</a>, який курс ви ведете.</p></div>`}
    ${rest.length?`<h2 style="margin-top:24px">Інші курси школи</h2><div class="grid g3">${rest.map(card).join('')}</div>`:''}`);
}
function fileBtn(f){ return `<button class="fbtn" data-file="${esc(f.id)}" data-title="${esc(f.title)}"><span class="fk">${esc(f.kind)}</span>${esc(f.title)}</button>` }
async function viewCourse(cid){
  A().shell('lib', head('База курсів')+'<div class="card"><p class="muted">Завантаження…</p></div>');
  let me; try{ me=ME&&ME.granted.find(s=>s.cid===cid)?ME:await loadMe() }catch(e){ return A().shell('lib', `<div class="callout bad">${esc(e.message)}</div>`) }
  const s=me.granted.find(x=>x.cid===cid), c=me.courses.find(x=>x.cid===cid)||{title:cid}, m=courseMeta(cid);
  if(!s){ A().shell('lib',`<a class="btn sm ghost" href="#/lib">← База курсів</a><h1>${esc(c.title)}</h1><div class="callout info"><b>Курс ще не відкрито</b><p>Доступ до матеріалів уроків надає методист.</p></div>`); return }
  const always=s.lessons.filter(l=>l.always), reg=s.lessons.filter(l=>!l.always);
  const lessonRow = l => `<div class="lrow ${l.open?'':'locked'}"><div class="ln">${esc(l.label)}</div><div class="grow"><b>${esc(l.name)}</b>
      <div class="files">${l.open ? (l.files.length?l.files.map(fileBtn).join(''):'<span class="tiny">файлів немає</span>') : `<span class="tiny">${A().I.lock} ${l.files.length} файл(и) · відкриється після тесту попереднього блоку</span>`}</div></div></div>`;
  const testRow = t => `<div class="tcard ${t.passed?'ok':t.available?'go':'off'}"><div class="grow"><b>📝 ${esc(t.title)}</b><div class="tiny">${t.count} питань · прохідний бал ${s.pass}%${t.attempts?` · спроб: ${t.attempts}, найкраще ${t.percent}%`:''}</div></div>
      ${t.passed?'<span class="pill good">✓ Складено</span>':t.available?`<a class="btn sm" href="#/lib/${cid}/test/${encodeURIComponent(t.id)}">${t.attempts?'Скласти ще раз':'Скласти тест'}</a>`:t.status!=='published'&&reg.some(l=>l.n<=t.after&&l.open)?'<span class="pill">тест готує методист</span>':`<span class="tiny">${A().I.lock} закрито</span>`}</div>`;
  // уроки по блоках, межі — тести
  let html='', i=0; const T=s.tests.slice().sort((a,b)=>a.after-b.after); let bi=1;
  const blocks=[]; let cur=[]; reg.forEach(l=>{ cur.push(l); const t=T.find(x=>x.after===l.n); if(t){ blocks.push({lessons:cur,test:t}); cur=[] } }); if(cur.length) blocks.push({lessons:cur,test:null});
  blocks.forEach(b=>{ html+=`<div class="card block"><div class="row"><h3 style="margin:0">Блок ${bi++}: ${b.lessons.length===1?'урок '+esc(b.lessons[0].label):'уроки '+esc(String(b.lessons[0].label).split('–')[0])+'–'+esc(String(b.lessons[b.lessons.length-1].label).split('–').pop())}</h3><span class="grow"></span>${b.lessons.every(l=>l.open)?'<span class="pill good">відкрито</span>':b.lessons.some(l=>l.open)?'<span class="pill warn">частково</span>':'<span class="pill">закрито</span>'}</div>${b.lessons.map(lessonRow).join('')}${b.test?testRow(b.test):''}</div>` });
  A().shell('lib',`<a class="btn sm ghost" href="#/lib">← База курсів</a>
    <div class="chead" style="background:${m.color};color:#fff;margin-top:12px"><h1 style="margin:0">${esc(c.title)}</h1><div style="opacity:.9">${esc(MODES[s.mode]||'')}</div></div>
    ${always.length?`<div class="card block"><h3 style="margin:0 0 6px">Завжди відкрито</h3>${always.map(lessonRow).join('')}</div>`:''}
    ${html}`);
  $$('[data-file]').forEach(b=>b.onclick=()=>openFile(b.dataset.file, b.dataset.title));
}
async function viewTest(cid, tid){
  A().shell('lib','<div class="card"><p class="muted">Завантаження тесту…</p></div>');
  let t; try{ t=(await call('blockTest',{cid,testId:tid})).test }catch(e){ return A().shell('lib',`<a class="btn sm ghost" href="#/lib/${cid}">← До курсу</a><div class="callout bad" style="margin-top:12px">${esc(e.message)}</div>`) }
  const order = t.questions.map((q,i)=>({q,i,idx:A().S&&window.RS_SHUFFLE?window.RS_SHUFFLE(q.o.map((_,k)=>k)):q.o.map((_,k)=>k)}));
  A().shell('lib',`<a class="btn sm ghost" href="#/lib/${cid}">← До курсу</a><h1 style="margin-top:12px">${esc(t.title)}</h1><p class="muted">${t.questions.length} питань · прохідний бал ${t.pass}%. Після складання відкриються наступні уроки курсу.</p>
    <form id="bt">${order.map((x,n)=>`<div class="card q" data-i="${x.i}"><div class="qt">${n+1}. ${esc(x.q.q)}</div>${x.q.code?`<pre><code>${esc(x.q.code)}</code></pre>`:''}${x.idx.map(k=>`<label class="opt"><input type="radio" name="q${x.i}" value="${k}"><span>${esc(x.q.o[k])}</span></label>`).join('')}<div class="ex hide"></div></div>`).join('')}
    <div class="row"><button class="btn" type="submit">Завершити тест</button><span class="muted small" id="left"></span></div></form>`);
  const f=$('#bt'); const upd=()=>{ $('#left').textContent='Відповідей: '+t.questions.filter((_,i)=>f.querySelector(`input[name=q${i}]:checked`)).length+' з '+t.questions.length }; f.onchange=upd; upd();
  f.onsubmit=async e=>{ e.preventDefault();
    const answers=t.questions.map((_,i)=>{ const c=f.querySelector(`input[name=q${i}]:checked`); return c?+c.value:-1 });
    if(answers.includes(-1) && !confirm('Є питання без відповіді. Завершити тест?')) return;
    const btn=f.querySelector('button[type=submit]'); btn.disabled=true;
    try{ const r=await call('blockSubmit',{cid,testId:tid,answers});
      r.review.forEach((rv,i)=>{ const el=f.querySelector(`[data-i="${i}"]`); el.classList.add(rv.ok?'okq':'badq'); $$('input',el).forEach(x=>x.disabled=true); const ex=$('.ex',el); ex.classList.remove('hide'); ex.innerHTML=rv.ok?'<b style="color:var(--good)">Правильно.</b>':'<b style="color:var(--bad)">Неправильно.</b> '+esc(rv.ex||'') });
      btn.remove(); if(ME){ const k=ME.granted.findIndex(s=>s.cid===cid); if(k>=0) ME.granted[k]=r.state }
      const res=document.createElement('div'); res.className='result '+(r.passed?'pass':'fail');
      res.innerHTML=`<div class="big">${r.percent}%</div><div><b>${r.score} з ${r.max}</b> — ${r.passed?'тест складено! Наступні уроки відкрито.':`потрібно щонайменше ${r.pass}%. Перегляньте уроки блоку й спробуйте ще раз.`}</div><div class="row" style="margin-top:12px"><a class="btn sm" href="#/lib/${cid}">До курсу</a></div>`;
      f.parentNode.insertBefore(res,f); window.scrollTo({top:0,behavior:'smooth'});
    }catch(x){ A().toast(x.message); btn.disabled=false }
  };
}

/* ======================================================================
   АДМІНІСТРАТОР: БАЗА КУРСІВ
   ====================================================================== */
let ADM = null;
async function loadAdm(){ ADM = await call('admLib'); return ADM }
async function loadTeachers(){
  const {BETA,LS,KEY}=A();
  if(BETA){ const u=LS.get(KEY+'users',{}); return Object.values(u).map(x=>x.profile) }
  return (await A().API.adminCall('adminData')).teachers||[];
}
function adminRoute(p){
  if(p[0]==='course') return admCourse(p[1], p[2]||'files');
  if(p[0]==='test') return admTest(p[1], decodeURIComponent(p[2]||''));
  if(p[0]==='log') return admLog();
  if(p[0]==='user') return admUser(decodeURIComponent(p[1]||''));
  return admHome();
}
function admShell(inner){ A().shell('a:lib', inner) }
async function admHome(){
  admShell(head('База курсів')+'<div class="card"><p class="muted">Завантаження…</p></div>');
  let d, people; try{ d=await loadAdm(); people=await loadTeachers() }catch(e){ return admShell(head('База курсів')+`<div class="callout bad"><b>Помилка</b><p>${esc(e.message)}</p></div>`) }
  const cids=[...new Set(d.lib.map(f=>f.cid))];
  const rows=cids.map(cid=>{ const files=d.lib.filter(f=>f.cid===cid&&f.status!=='archived'), T=d.tests.filter(t=>t.cid===cid), s=d.settings[cid]||{mode:'tests',pass:75};
    return {cid,title:s.title||cid,files:files.length,draftF:files.filter(f=>f.status==='draft').length,lessons:new Set(files.map(f=>f.n)).size,tests:T.length,pub:T.filter(t=>t.status==='published').length,mode:s.mode,pass:s.pass,users:d.access.filter(a=>a.cid===cid&&a.granted).length} });
  admShell(`<div class="row"><h1 style="margin:0">База курсів</h1><span class="grow"></span><a class="btn sm ghost" href="#/admin/lib/log">Журнал переглядів і друку</a></div>
    <p class="muted" style="max-width:880px">Учитель після реєстрації бачить лише навчання вчителів. Матеріали уроків з’являються, коли ви відкриєте йому курс (тут або у звіті працівника). Тести, що мають статус «чернетка», учителі не бачать — і наступні уроки за ними не відкриються, доки ви не опублікуєте тест або не відкриєте уроки вручну.</p>
    ${A().BETA?'<div class="callout warn small"><b>Бета-версія</b><p>Тут демо-база з кількох уроків двох курсів. Повна база й заміна великих файлів працюють у робочій версії на Google Диску.</p></div>':''}
    <div class="card" style="padding:0;overflow:auto"><table class="prose ptable" style="width:100%;margin:0"><thead><tr><th>Курс</th><th>Уроків / файлів</th><th>Тести (опубліковано)</th><th>Режим</th><th>Бал</th><th>Учителів з доступом</th><th></th></tr></thead><tbody>
    ${rows.map(r=>`<tr><td><span class="sw" style="background:${courseMeta(r.cid).color}"></span> <b>${esc(r.title)}</b>${r.draftF?`<div class="tiny">файлів-чернеток: ${r.draftF}</div>`:''}</td><td>${r.lessons} / ${r.files}</td><td>${r.tests} (<b>${r.pub}</b>)</td><td class="small">${esc((MODES[r.mode]||'').split(':')[0])}</td><td>${r.pass}%</td><td>${r.users}</td>
      <td><a class="btn sm" href="#/admin/lib/course/${r.cid}">Керувати</a></td></tr>`).join('')}</tbody></table></div>
    <h2 style="margin-top:24px">Доступ працівників</h2>
    <div class="filters"><input class="input" id="uq" placeholder="Пошук працівника" style="max-width:320px"></div>
    <div class="card" style="padding:0;overflow:auto"><table class="prose ptable" id="ut" style="width:100%;margin:0"><thead><tr><th>Працівник</th><th>Філія</th><th>Відкриті курси</th><th></th></tr></thead><tbody>
    ${people.map(u=>{ const g=d.access.filter(a=>a.email===u.email&&a.granted).map(a=>(d.settings[a.cid]||{}).title||a.cid);
      return `<tr data-s="${esc((u.fio+' '+u.email).toLowerCase())}"><td><b>${esc(u.fio)}</b><div class="tiny">${esc(u.email)}</div></td><td>${esc(u.branch)}</td><td class="small">${g.length?g.map(esc).join(', '):'<span class="muted">лише навчання вчителів</span>'}</td><td><a class="btn sm ghost" href="#/admin/lib/user/${encodeURIComponent(u.email)}">Доступ</a></td></tr>` }).join('')||'<tr><td colspan="4" class="muted">Ще немає зареєстрованих працівників.</td></tr>'}</tbody></table></div>`);
  $('#uq').oninput=e=>{ const q=e.target.value.trim().toLowerCase(); $$('#ut tbody tr').forEach(tr=>tr.style.display=!q||(tr.dataset.s||'').includes(q)?'':'none') };
}
function lessonsOf(d,cid){ const o={}; d.lib.filter(f=>f.cid===cid).forEach(f=>{ o[f.n]=o[f.n]||{n:f.n,label:f.label,name:f.lname,always:f.always,files:[]}; o[f.n].files.push(f) }); return Object.values(o).sort((a,b)=>a.n-b.n) }
async function admUser(email){
  admShell('<div class="card"><p class="muted">Завантаження…</p></div>');
  let d, people; try{ d=await loadAdm(); people=await loadTeachers() }catch(e){ return admShell(`<div class="callout bad">${esc(e.message)}</div>`) }
  const u=people.find(x=>x.email===email)||{fio:email,email,branch:''};
  const cids=[...new Set(d.lib.map(f=>f.cid))];
  const best={}; d.results.filter(r=>r.email===email).forEach(r=>best[r.email+'|'+r.cid+'|'+r.testId]=r);
  admShell(`<a class="btn sm ghost" href="#/admin/lib">← База курсів</a><h1 style="margin-top:12px">${esc(u.fio)}</h1><p class="muted">${esc(u.branch)} · ${esc(u.email)} · <a href="#/admin/person/${encodeURIComponent(email)}">звіт про навчання</a></p>
    <div class="card" style="padding:0;overflow:auto"><table class="prose ptable" style="width:100%;margin:0"><thead><tr><th>Курс</th><th>Доступ</th><th>Відкрито вручну до уроку</th><th>Стан</th><th></th></tr></thead><tbody>
    ${cids.map(cid=>{ const a=d.access.find(x=>x.email===email&&x.cid===cid)||{granted:false,upTo:null}; const L=lessonsOf(d,cid).filter(l=>!l.always);
      const st=courseState(cid,email,d.lib,d.tests,d.settings,a.granted?a:null,best,false);
      const openN=st.lessons.filter(l=>!l.always&&l.open).length;
      return `<tr data-cid="${cid}"><td><b>${esc((d.settings[cid]||{}).title||cid)}</b></td><td><label class="row" style="gap:6px"><input type="checkbox" class="g" ${a.granted?'checked':''}> відкрито</label></td>
        <td><select class="input up" style="max-width:260px"><option value="">— за правилами курсу —</option>${L.map(l=>`<option value="${l.n}" ${a.upTo===l.n?'selected':''}>до уроку ${esc(l.label)} · ${esc(l.name)}</option>`).join('')}</select></td>
        <td class="small">${a.granted?`відкрито уроків: ${openN} з ${L.length}<br>тестів складено: ${st.tests.filter(t=>t.passed).length} з ${st.tests.length}`:'—'}</td><td><button class="btn sm sv">Зберегти</button></td></tr>` }).join('')}</tbody></table></div>`);
  $$('tr[data-cid]').forEach(tr=>{ $('.sv',tr).onclick=async()=>{ try{ await call('admGrant',{email,cid:tr.dataset.cid,granted:$('.g',tr).checked,upTo:$('.up',tr).value}); A().toast('Збережено'); admUser(email) }catch(e){ A().toast(e.message) } } });
}
async function admCourse(cid, tab){
  admShell('<div class="card"><p class="muted">Завантаження…</p></div>');
  let d, people; try{ d=await loadAdm(); people=tab==='access'?await loadTeachers():[] }catch(e){ return admShell(`<div class="callout bad">${esc(e.message)}</div>`) }
  const s=d.settings[cid]||{cid,mode:'tests',pass:75,title:cid}, L=lessonsOf(d,cid), T=d.tests.filter(t=>t.cid===cid).sort((a,b)=>a.after-b.after);
  const tabs=[['files','Файли уроків'],['tests','Тести блоків ('+T.length+')'],['access','Доступ учителів'],['settings','Налаштування']];
  let body='';
  if(tab==='settings') body=`<form class="card" id="sf" style="max-width:760px">
      <div class="field"><label>Назва курсу в базі</label><input class="input" name="title" value="${esc(s.title||cid)}"></div>
      <div class="field"><label>Як відкриваються уроки</label>${Object.keys(MODES).map(k=>`<label class="row" style="gap:8px;margin:4px 0"><input type="radio" name="mode" value="${k}" ${s.mode===k?'checked':''}> ${esc(MODES[k])}</label>`).join('')}</div>
      <div class="field"><label>Прохідний бал тестів, %</label><input class="input" name="pass" type="number" min="1" max="100" value="${s.pass}" style="max-width:140px"></div>
      <p class="tiny">Межі блоків задають тести: уроки до тесту включно — один блок. Щоб змінити розмір блоку, перенесіть тест на інший урок у вкладці «Тести блоків» або додайте новий тест.</p>
      <button class="btn" type="submit">Зберегти</button></form>`;
  if(tab==='files') body=`<p class="muted small">Перегляньте файл, змініть назву чи тип, приховайте його від учителів або замініть новою версією (стара переходить в архів). Файли-чернетки бачите лише ви.</p>
    ${L.map(l=>`<div class="card block"><div class="row"><h3 style="margin:0">Урок ${esc(l.label)} · ${esc(l.name)}</h3>${l.always?'<span class="pill">завжди відкритий</span>':''}<span class="grow"></span><button class="btn sm ghost" data-add="${l.n}">+ Додати файл</button></div>
      ${l.files.filter(f=>f.status!=='archived').map(f=>`<div class="frow" data-id="${esc(f.id)}"><button class="fbtn" data-file="${esc(f.id)}" data-title="${esc(f.title)}"><span class="fk">${esc(f.kind)}</span>${esc(f.title)}</button><span class="tiny">${Math.round((f.size||0)/1024)} КБ</span><span class="grow"></span>
        <select class="input fs" style="max-width:200px">${['active','hidden','draft'].map(k=>`<option value="${k}" ${f.status===k?'selected':''}>${FSTAT[k]}</option>`).join('')}</select>
        <button class="btn sm ghost fe">Назва / тип</button><button class="btn sm ghost fr">Замінити</button></div>`).join('')||'<p class="tiny">Файлів немає.</p>'}
      ${l.files.some(f=>f.status==='archived')?`<details class="tiny"><summary>Архів замінених версій (${l.files.filter(f=>f.status==='archived').length})</summary>${l.files.filter(f=>f.status==='archived').map(f=>`<div class="frow"><button class="fbtn" data-file="${esc(f.id)}" data-title="${esc(f.title)}"><span class="fk">архів</span>${esc(f.title)}</button></div>`).join('')}</details>`:''}</div>`).join('')}
    <input type="file" id="up" accept="application/pdf,.pdf,.txt,.java,.py,.pyde" style="display:none">`;
  if(tab==='tests') body=`<div class="row" style="margin-bottom:12px"><span class="muted small grow">Тест після уроку N закриває блок: наступні уроки відкриються, коли вчитель складе тест. Чернетки вчителі не бачать.</span><button class="btn sm ghost" id="pub">Опублікувати всі чернетки</button><a class="btn sm" href="#/admin/lib/test/${cid}/new">+ Новий тест</a></div>
    ${T.map(t=>`<div class="card tcard2 row"><div class="grow"><b>${esc((t.t&&t.t.title)||'Тест')}</b><div class="tiny">після уроку ${esc((L.find(l=>l.n===t.after)||{label:t.after}).label)} · ${((t.t&&t.t.questions)||[]).length} питань${t.t&&t.t.pass?` · свій прохідний бал ${t.t.pass}%`:''}</div></div>
      <span class="pill ${t.status==='published'?'good':'warn'}">${t.status==='published'?'опубліковано':'чернетка'}</span><a class="btn sm ghost" href="#/admin/lib/test/${cid}/${encodeURIComponent(t.id)}">Редагувати</a></div>`).join('')||'<p class="muted">Тестів немає.</p>'}`;
  if(tab==='access'){ const best={}; d.results.forEach(r=>best[r.email+'|'+r.cid+'|'+r.testId]=r);
    body=`<p class="muted small">Відкрийте курс учителю й за потреби вручну відкрийте уроки до потрібного (наприклад, досвідченому вчителю — усі).</p>
    <div class="card" style="padding:0;overflow:auto"><table class="prose ptable" style="width:100%;margin:0"><thead><tr><th>Учитель</th><th>Доступ</th><th>Відкрито вручну до</th><th>Стан</th><th></th></tr></thead><tbody>
    ${people.map(u=>{ const a=d.access.find(x=>x.email===u.email&&x.cid===cid)||{granted:false,upTo:null}; const st=courseState(cid,u.email,d.lib,d.tests,d.settings,a.granted?a:null,best,false); const R=L.filter(l=>!l.always);
      return `<tr data-email="${esc(u.email)}"><td><b>${esc(u.fio)}</b><div class="tiny">${esc(u.branch)} · ${esc(u.email)}</div></td><td><input type="checkbox" class="g" ${a.granted?'checked':''}></td>
      <td><select class="input up" style="max-width:240px"><option value="">— за правилами —</option>${R.map(l=>`<option value="${l.n}" ${a.upTo===l.n?'selected':''}>до уроку ${esc(l.label)}</option>`).join('')}</select></td>
      <td class="small">${a.granted?`уроків: ${st.lessons.filter(l=>!l.always&&l.open).length}/${R.length} · тестів: ${st.tests.filter(t=>t.passed).length}/${st.tests.length}`:'—'}</td><td><button class="btn sm sv">Зберегти</button></td></tr>` }).join('')||'<tr><td colspan="5" class="muted">Немає зареєстрованих працівників.</td></tr>'}</tbody></table></div>`; }
  admShell(`<a class="btn sm ghost" href="#/admin/lib">← База курсів</a><h1 style="margin-top:12px">${esc(s.title||cid)}</h1>
    <div class="tabs">${tabs.map(([k,l])=>`<button class="tab ${k===tab?'on':''}" data-go="#/admin/lib/course/${cid}/${k}">${esc(l)}</button>`).join('')}</div>${body}`);
  A().bindGo();
  $$('[data-file]').forEach(b=>b.onclick=()=>openFile(b.dataset.file,b.dataset.title));
  const sf=$('#sf'); if(sf) sf.onsubmit=async e=>{ e.preventDefault(); const x=Object.fromEntries(new FormData(sf).entries()); try{ await call('admSettings',{cid,title:x.title,mode:x.mode,pass:x.pass}); A().toast('Збережено') }catch(er){ A().toast(er.message) } };
  $$('.frow[data-id]').forEach(r=>{ const id=r.dataset.id; const f=d.lib.find(x=>x.id===id);
    const fs=$('.fs',r); if(fs) fs.onchange=async()=>{ try{ await call('admFile',{id,status:fs.value}); A().toast('Збережено') }catch(e){ A().toast(e.message) } };
    const fe=$('.fe',r); if(fe) fe.onclick=async()=>{ const t=prompt('Назва файлу для вчителів:',f.title); if(t===null) return; const k=prompt('Тип ('+KINDS.join(', ')+'):',f.kind); if(k===null) return; try{ await call('admFile',{id,title:t.trim()||f.title,kind:k.trim()||f.kind}); admCourse(cid,'files') }catch(e){ A().toast(e.message) } };
    const fr=$('.fr',r); if(fr) fr.onclick=()=>pickUpload({cid,n:f.n,replace:f});
  });
  $$('[data-add]').forEach(b=>b.onclick=()=>pickUpload({cid,n:Number(b.dataset.add)}));
  const pub=$('#pub'); if(pub) pub.onclick=async()=>{ const dr=T.filter(t=>t.status!=='published'); if(!dr.length) return A().toast('Чернеток немає'); if(!confirm('Опублікувати '+dr.length+' тест(ів)? Учителі побачать їх одразу.')) return;
    try{ for(const t of dr) await call('admTestSave',{cid,id:t.id,after:t.after,status:'published',test:t.t}); A().toast('Опубліковано'); admCourse(cid,'tests') }catch(e){ A().toast(e.message) } };
  $$('tr[data-email]').forEach(tr=>{ $('.sv',tr).onclick=async()=>{ try{ await call('admGrant',{email:tr.dataset.email,cid,granted:$('.g',tr).checked,upTo:$('.up',tr).value}); A().toast('Збережено'); admCourse(cid,'access') }catch(e){ A().toast(e.message) } } });
}
function pickUpload(o){
  const inp=$('#up'); inp.value=''; inp.onchange=async()=>{
    const file=inp.files[0]; if(!file) return;
    if(file.size>25*1024*1024) return A().toast('Файл більший за 25 МБ — стисніть PDF перед завантаженням.');
    const title=prompt('Назва файлу для вчителів:', o.replace?o.replace.title:file.name.replace(/\.[^.]+$/,'')); if(title===null) return;
    const kind=o.replace?o.replace.kind:(prompt('Тип ('+KINDS.join(', ')+'):','SB')||'Додатково');
    const data=await new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(String(fr.result).split(',')[1]); fr.onerror=rej; fr.readAsDataURL(file) });
    A().toast('Завантаження файлу…');
    try{ await call('admUpload',{cid:o.cid,n:o.n,name:file.name,mime:file.type||'application/pdf',title,kind,data,replaceId:o.replace?o.replace.id:''}); A().toast(o.replace?'Файл замінено':'Файл додано'); admCourse(o.cid,'files') }catch(e){ A().toast(e.message) }
  };
  inp.click();
}
async function admTest(cid, tid){
  admShell('<div class="card"><p class="muted">Завантаження…</p></div>');
  let d; try{ d=await loadAdm() }catch(e){ return admShell(`<div class="callout bad">${esc(e.message)}</div>`) }
  const L=lessonsOf(d,cid).filter(l=>!l.always), cur=d.tests.find(t=>t.cid===cid&&t.id===tid);
  const t = cur ? JSON.parse(JSON.stringify(cur.t)) : {title:'Тест після уроків', questions:[{q:'',o:['','','',''],a:0,ex:''}]};
  const after = cur ? cur.after : (L[3]||L[L.length-1]||{n:0}).n, status = cur ? cur.status : 'draft';
  const qHtml = (q,i) => `<div class="card qed" data-i="${i}"><div class="row"><b>Питання ${i+1}</b><span class="grow"></span><button type="button" class="btn sm ghost qdel">Видалити</button></div>
    <textarea class="input qq" rows="2" placeholder="Текст питання">${esc(q.q)}</textarea>
    ${q.o.map((o,k)=>`<div class="row" style="gap:8px;margin-top:6px"><input type="radio" name="a${i}" value="${k}" ${q.a===k?'checked':''} title="Правильна відповідь"><input class="input qo" value="${esc(o)}" placeholder="Варіант ${k+1}"></div>`).join('')}
    <input class="input qex" style="margin-top:8px" value="${esc(q.ex||'')}" placeholder="Пояснення, яке побачить учитель після помилки"></div>`;
  admShell(`<a class="btn sm ghost" href="#/admin/lib/course/${cid}/tests">← Тести курсу</a><h1 style="margin-top:12px">${cur?'Редагування тесту':'Новий тест'}</h1>
    <form id="tf" style="max-width:920px"><div class="card"><div class="field"><label>Назва тесту</label><input class="input" name="title" value="${esc(t.title||'')}"></div>
      <div class="grid g3" style="gap:10px"><div class="field"><label>Після уроку (кінець блоку)</label><select class="input" name="after">${L.map(l=>`<option value="${l.n}" ${l.n===after?'selected':''}>${esc(l.label)} · ${esc(l.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Власний прохідний бал, % (порожньо — як у курсі)</label><input class="input" name="pass" type="number" min="1" max="100" value="${t.pass||''}"></div>
      <div class="field"><label>Статус</label><select class="input" name="status"><option value="draft" ${status!=='published'?'selected':''}>Чернетка (учителі не бачать)</option><option value="published" ${status==='published'?'selected':''}>Опубліковано</option></select></div></div>
      <p class="tiny">Позначте правильну відповідь кружечком зліва. Порядок варіантів для вчителів перемішується автоматично.</p></div>
      <div id="qs">${t.questions.map(qHtml).join('')}</div>
      <div class="row"><button type="button" class="btn ghost" id="qadd">+ Питання</button><span class="grow"></span>${cur?'<button type="button" class="btn ghost" id="tdel">Видалити тест</button>':''}<button class="btn" type="submit">Зберегти</button></div></form>`);
  const collect=()=>$$('.qed').map((el,i)=>({q:$('.qq',el).value.trim(), o:$$('.qo',el).map(x=>x.value.trim()).filter(Boolean), a:Number((el.querySelector('input[type=radio]:checked')||{}).value||0), ex:$('.qex',el).value.trim()})).filter(q=>q.q);
  const bindDel=()=>$$('.qdel').forEach(b=>b.onclick=()=>{ b.closest('.qed').remove() });
  bindDel();
  $('#qadd').onclick=()=>{ const n=$$('.qed').length; $('#qs').insertAdjacentHTML('beforeend', qHtml({q:'',o:['','','',''],a:0,ex:''},n+Date.now()%1000)); bindDel() };
  const del=$('#tdel'); if(del) del.onclick=async()=>{ if(!confirm('Видалити тест? Блок об’єднається з наступним.')) return; try{ await call('admTestDelete',{cid,id:tid}); location.hash='#/admin/lib/course/'+cid+'/tests' }catch(e){ A().toast(e.message) } };
  $('#tf').onsubmit=async e=>{ e.preventDefault(); const x=Object.fromEntries(new FormData(e.target).entries()); const qs=collect();
    if(!qs.length) return A().toast('Додайте хоча б одне питання');
    const test={title:x.title.trim()||'Тест', questions:qs}; if(x.pass) test.pass=Number(x.pass);
    try{ await call('admTestSave',{cid,id:cur?tid:'',after:Number(x.after),status:x.status,test}); A().toast('Збережено'); location.hash='#/admin/lib/course/'+cid+'/tests' }catch(er){ A().toast(er.message) } };
}
async function admLog(){
  admShell('<div class="card"><p class="muted">Завантаження…</p></div>');
  let log; try{ log=(await call('admLog')).log }catch(e){ return admShell(`<div class="callout bad">${esc(e.message)}</div>`) }
  admShell(`<a class="btn sm ghost" href="#/admin/lib">← База курсів</a><h1 style="margin-top:12px">Журнал переглядів і друку</h1>
    <div class="filters"><input class="input" id="lq" placeholder="Пошук: ПІБ, пошта, курс, файл" style="max-width:340px"><select class="input" id="la" style="max-width:200px"><option value="">Усі дії</option><option>перегляд</option><option>друк</option></select></div>
    <div class="card" style="padding:0;overflow:auto"><table class="prose ptable" id="lt" style="width:100%;margin:0"><thead><tr><th>Дата</th><th>Учитель</th><th>Курс</th><th>Урок</th><th>Файл</th><th>Дія</th></tr></thead><tbody>
    ${log.map(r=>`<tr data-a="${esc(r.action)}" data-s="${esc((r.fio+' '+r.email+' '+r.cid+' '+r.file).toLowerCase())}"><td class="small">${fmtDT(r.at)}</td><td><b>${esc(r.fio||r.email)}</b><div class="tiny">${esc(r.branch)} ${esc(r.email)}</div></td><td>${esc(r.cid)}</td><td>${esc(r.lesson)}</td><td class="small">${esc(r.file)}</td><td><span class="pill ${r.action==='друк'?'warn':''}">${esc(r.action)}</span></td></tr>`).join('')||'<tr><td colspan="6" class="muted">Записів ще немає.</td></tr>'}</tbody></table></div>`);
  const f=()=>{ const q=$('#lq').value.trim().toLowerCase(), a=$('#la').value; $$('#lt tbody tr').forEach(tr=>tr.style.display=(!q||(tr.dataset.s||'').includes(q))&&(!a||tr.dataset.a===a)?'':'none') }; $('#lq').oninput=f; $('#la').onchange=f;
}

window.RS_LIB = { route, adminRoute, openFile, courseState };
})();
