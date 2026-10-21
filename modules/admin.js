/* Robot School Academy — адмін-панель (v1.4) і повідомлення методисту.
   Адміністратор: результати працівників усіх філій, звіти з діаграмами, методичні проблеми курсів,
   редагування доповнень платформи, вхідні повідомлення. Учитель: «Написати методисту». */
(function(){
'use strict';
const A = () => window.RS_APP;
const $ = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>Array.from(el.querySelectorAll(s));
const esc = s => A().esc(s);
const fmtD = d => d ? new Date(d).toLocaleDateString('uk-UA') : '—';
const fmtDT = d => d ? new Date(d).toLocaleString('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
const KIND = {read:'Розділ', trainer:'Тренажер', test:'Тест'};
const MSG_TYPES = ['Питання щодо курсу','Пропозиція','Помилка в матеріалах','Технічна проблема','Інше'];
const MSG_STATUS = ['Нове','Прочитано','В роботі','Відповідь надано','Закрито'];

/* ======================================================================
   ДАНІ ПРАЦІВНИКІВ
   ====================================================================== */
let PEOPLE = null;      // {teachers:[], best:{email:{cid:{iid:rec}}}, history:{email:[rec]}, loadedAt}
async function loadPeople(force){
  if(PEOPLE && !force) return PEOPLE;
  const {BETA, LS, KEY, API} = A();
  const out = {teachers:[], best:{}, history:{}, loadedAt:new Date().toISOString()};
  if(BETA){
    const users = LS.get(KEY+'users',{});
    Object.keys(users).forEach(email => {
      const p = users[email].profile; out.teachers.push(Object.assign({lastLogin:''},p));
      const best = LS.get(KEY+'progress_'+email,{}); out.best[email]=best;
      out.history[email] = [].concat(...Object.values(best).map(c=>Object.values(c)));
    });
  } else {
    const j = await API.adminCall('adminData');
    out.teachers = j.teachers||[]; out.branches = j.branches;
    (j.progress||[]).forEach(r => {
      (out.history[r.email] = out.history[r.email]||[]).push(r);
      const b = (out.best[r.email] = out.best[r.email]||{}); const c = (b[r.course]=b[r.course]||{}); const prev=c[r.item];
      if(!prev || r.percent>prev.percent || (r.passed&&!prev.passed)) c[r.item]=r;
    });
  }
  out.teachers.sort((a,b)=>String(a.fio).localeCompare(String(b.fio),'uk'));
  PEOPLE = out; return out;
}
function statsFor(email){
  const {ALL, courseItems} = A();
  const best = (PEOPLE.best[email]||{});
  const per = ALL.map(c => {
    const items = courseItems(c); const b = best[c.id]||{};
    const done = items.filter(i=>b[i.id]&&b[i.id].passed);
    const tests = items.filter(i=>i.kind==='test'); const tp = tests.filter(i=>b[i.id]);
    const byKind = {}; ['read','trainer','test'].forEach(k=>{ const all=items.filter(i=>i.kind===k); byKind[k]={done:all.filter(i=>b[i.id]&&b[i.id].passed).length, total:all.length} });
    return {c, total:items.length, done:done.length, pct: items.length?Math.round(100*done.length/items.length):0,
      started: Object.keys(b).length>0, complete: items.length>0 && done.length===items.length,
      testAvg: tp.length?Math.round(tp.reduce((a,i)=>a+b[i.id].percent,0)/tp.length):null, testsDone: tests.filter(i=>b[i.id]&&b[i.id].passed).length, testsTotal:tests.length,
      attempted: items.filter(i=>b[i.id]&&!b[i.id].passed).length, byKind};
  });
  const total = per.reduce((a,x)=>a+x.total,0), done = per.reduce((a,x)=>a+x.done,0);
  const hist = (PEOPLE.history[email]||[]).slice().sort((a,b)=>String(a.at).localeCompare(String(b.at)));
  return {per, total, done, pct: total?Math.round(100*done/total):0, completed: per.filter(x=>x.c.id!=='method'&&x.complete).length,
    started: per.filter(x=>x.started).map(x=>x.c), last: hist.length?hist[hist.length-1].at:'', hist};
}

/* ======================================================================
   ДІАГРАМИ (SVG, без зовнішніх бібліотек)
   ====================================================================== */
const SER = ['var(--s1)','var(--s2)','var(--s3)','var(--s4)','var(--s5)','var(--s6)'];
const tip = (t)=>` data-tip="${esc(t)}"`;
function chartBarsH(rows, opt){       // rows: [{label, value(0..100), sub}] — HTML-стовпчики, масштабуються під ширину
  opt=opt||{};
  return `<div class="hbars" role="img" aria-label="${esc(opt.title||'')}">${rows.map(r=>`<div class="hb"><span class="hl" title="${esc(r.label)}">${esc(r.label)}</span><span class="ht"><i style="width:${Math.max(0,Math.min(100,r.value))}%;background:${r.color||'var(--s1)'}"${tip(r.label+': '+r.value+'%'+(r.sub?' · '+r.sub:''))}></i></span><b class="hv">${r.value}%</b></div>`).join('')}
    <div class="hb hax"><span class="hl"></span><span class="ht ax">${[0,25,50,75,100].map(t=>`<em style="left:${t}%">${t}%</em>`).join('')}</span><b class="hv"></b></div></div>`;
}
function chartDonut(segs, opt){        // segs: [{label, value, color}]
  opt=opt||{}; const tot=segs.reduce((a,s)=>a+s.value,0)||1, R=70, r=46, cx=90, cy=90;
  let a0=-Math.PI/2, g=`<svg class="chart" style="max-width:${opt.compact?180:460}px" viewBox="0 0 ${opt.compact?180:380} 180" role="img" aria-label="${esc(opt.title||'')}">`;
  segs.forEach(s=>{ if(!s.value) return; const a1=a0+2*Math.PI*s.value/tot - (segs.filter(x=>x.value).length>1?0.02:0);
    const big=(a1-a0)>Math.PI?1:0, p=(ang,rad)=>[cx+rad*Math.cos(ang), cy+rad*Math.sin(ang)];
    const [x1,y1]=p(a0,R),[x2,y2]=p(a1,R),[x3,y3]=p(a1,r),[x4,y4]=p(a0,r);
    const full = s.value===tot;
    g+= full ? `<circle cx="${cx}" cy="${cy}" r="${(R+r)/2}" fill="none" stroke="${s.color}" stroke-width="${R-r}"${tip(s.label+': '+s.value)}/>`
      : `<path d="M${x1},${y1} A${R},${R} 0 ${big} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${big} 0 ${x4},${y4} Z" fill="${s.color}"${tip(s.label+': '+s.value+' ('+Math.round(100*s.value/tot)+'%)')}/>`;
    a0 = a1 + 0.02; });
  g+=`<text x="${cx}" y="${cy-2}" text-anchor="middle" class="big">${opt.center||''}</text><text x="${cx}" y="${cy+16}" text-anchor="middle" class="ax">${esc(opt.centerSub||'')}</text>`;
  if(!opt.compact) segs.forEach((s,i)=>{ const y=40+i*26; g+=`<rect x="200" y="${y-11}" width="12" height="12" rx="3" fill="${s.color}"/><text x="220" y="${y}" class="lb">${esc(s.label)} — <tspan class="vlt">${s.value}</tspan></text>` });
  return g+'</svg>';
}
function chartLine(points, opt){       // points: [{x:Date, y:0..100, label}]
  opt=opt||{}; const W=640,H=230,l=40,r=16,t=14,b=34;
  if(!points.length) return '<div class="empty small">Ще немає результатів тестів.</div>';
  const xs=points.map(p=>+new Date(p.x)); let mn=Math.min(...xs), mx=Math.max(...xs); if(mx===mn){ mn-=864e5; mx+=864e5 }
  const sx=v=>l+(W-l-r)*(v-mn)/(mx-mn), sy=v=>t+(H-t-b)*(1-v/100);
  let g=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.title||'')}">`;
  [0,50,80,100].forEach(v=>{ g+=`<line x1="${l}" x2="${W-r}" y1="${sy(v)}" y2="${sy(v)}" class="${v===80?'ref':'grid'}"/><text x="${l-6}" y="${sy(v)+4}" class="ax" text-anchor="end">${v}%</text>` });
  g+=`<text x="${W-r}" y="${sy(80)-5}" class="ax" text-anchor="end">поріг зарахування</text>`;
  [mn,(mn+mx)/2,mx].forEach(v=>{ g+=`<text x="${sx(v)}" y="${H-12}" class="ax" text-anchor="middle">${fmtD(v)}</text>` });
  g+=`<polyline fill="none" stroke="var(--s1)" stroke-width="2" points="${points.map(p=>sx(+new Date(p.x))+','+sy(p.y)).join(' ')}"/>`;
  points.forEach(p=>{ g+=`<circle cx="${sx(+new Date(p.x))}" cy="${sy(p.y)}" r="5" fill="${p.y>=(opt.pass||80)?'var(--s1)':'var(--s2)'}" stroke="var(--panel)" stroke-width="2"${tip(p.label+' · '+p.y+'% · '+fmtD(p.x))}/>` });
  return g+'</svg>';
}
function chartRadar(axes, opt){         // axes: [{label, value 0..100}]
  opt=opt||{}; const W=420,H=320,cx=210,cy=160,R=110,n=axes.length;
  if(n<3) return '';
  const pt=(i,v)=>{ const a=-Math.PI/2+2*Math.PI*i/n; return [cx+R*v/100*Math.cos(a), cy+R*v/100*Math.sin(a)] };
  let g=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.title||'')}">`;
  [25,50,75,100].forEach(v=>{ g+=`<polygon points="${axes.map((_,i)=>pt(i,v).join(',')).join(' ')}" class="grid" fill="none"/>` });
  axes.forEach((a,i)=>{ const [x,y]=pt(i,100), [lx,ly]=pt(i,122); g+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="grid"/><text x="${lx}" y="${ly+4}" class="lb" text-anchor="${Math.abs(lx-cx)<10?'middle':lx>cx?'start':'end'}">${esc(a.label.length>22?a.label.slice(0,21)+'…':a.label)}</text>` });
  g+=`<polygon points="${axes.map((a,i)=>pt(i,a.value).join(',')).join(' ')}" fill="var(--s1)" fill-opacity=".18" stroke="var(--s1)" stroke-width="2"/>`;
  axes.forEach((a,i)=>{ const [x,y]=pt(i,a.value); g+=`<circle cx="${x}" cy="${y}" r="5" fill="var(--s1)" stroke="var(--panel)" stroke-width="2"${tip(a.label+': '+a.value+'%')}/>` });
  return g+'</svg>';
}
function chartStacked(rows, keys, opt){ // rows: [{label, parts:{k:value}}], keys: [{k,label,color}]
  opt=opt||{}; const max=Math.max(1,...rows.map(r=>keys.reduce((a,k)=>a+(r.parts[k.k]||0),0)));
  return `<div class="hbars" role="img" aria-label="${esc(opt.title||'')}">${rows.map(r=>{ const tot=keys.reduce((a,k)=>a+(r.parts[k.k]||0),0);
    return `<div class="hb"><span class="hl" title="${esc(r.label)}">${esc(r.label)}</span><span class="ht stack">${keys.map(k=>{const v=r.parts[k.k]||0;return v?`<i style="width:${100*v/max}%;background:${k.color}"${tip(r.label+' · '+k.label+': '+v)}></i>`:''}).join('')}</span><b class="hv">${tot}</b></div>` }).join('')}</div>`
    +`<div class="legend">${keys.map(k=>`<span><i style="background:${k.color}"></i>${esc(k.label)}</span>`).join('')}</div>`;
}
function bindTips(root){
  let tp=$('#charttip'); if(!tp){ tp=document.createElement('div'); tp.id='charttip'; document.body.appendChild(tp) }
  $$('[data-tip]',root).forEach(el=>{
    el.addEventListener('mousemove',e=>{ tp.textContent=el.dataset.tip; tp.style.display='block'; tp.style.left=(e.clientX+14)+'px'; tp.style.top=(e.clientY+14)+'px' });
    el.addEventListener('mouseleave',()=>{ tp.style.display='none' });
  });
}
function csvDownload(name, rows){
  const csv = '﻿'+rows.map(r=>r.map(v=>{ v=String(v==null?'':v); return /[";\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v }).join(';')).join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove()},500);
}

/* ======================================================================
   ПРАВКИ (статуси доповнень, правки, статуси проблем)
   ====================================================================== */
async function saveEdit(key, val){
  const ed = await A().API.saveEdits({[key]:val});
  A().setEdits(ed); return ed;
}
function hashKey(s){ let h=0; for(let i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))|0 } return (h>>>0).toString(36) }
function probKey(cid,p){ return 'prob|'+cid+'|'+hashKey(p.where+'|'+p.text) }
function addStatus(a){ const e=A().EDITS[a.key]; return (e&&e.status)||'draft' }
const ST_LABEL = {draft:'Чернетка', published:'Опубліковано', deleted:'Відхилено'};

/* ======================================================================
   НАВІГАЦІЯ АДМІНІСТРАТОРА
   ====================================================================== */
let NEWMSG = 0;
function nav(active){
  const I=A().I;
  const add=(window.RS_ADDITIONS||[]).filter(a=>addStatus(a)==='draft').length;
  return `<div class="tiny" style="margin:12px 10px 2px;font-weight:800;letter-spacing:.06em;text-transform:uppercase">Адміністратор</div>
    <a class="nav ${active==='a:home'?'on':''}" href="#/admin">${I.chart}Огляд</a>
    <a class="nav ${active==='a:people'?'on':''}" href="#/admin/people">${I.user}Працівники й звіти</a>
    <a class="nav ${active==='a:problems'?'on':''}" href="#/admin/problems">${I.alert}Методичні проблеми</a>
    <a class="nav ${active==='a:additions'?'on':''}" href="#/admin/additions">${I.edit}Доповнення платформи${add?`<span class="cnt">${add}</span>`:''}</a>
    <a class="nav ${active==='a:messages'?'on':''}" href="#/admin/messages">${I.mail}Повідомлення${NEWMSG?`<span class="cnt" style="background:var(--red);color:#fff">${NEWMSG}</span>`:''}</a>`;
}
function route(p){
  const v = p[0]||'';
  if(v==='people') return viewPeople();
  if(v==='person') return viewPerson(decodeURIComponent(p[1]||''));
  if(v==='problems') return viewProblems(p[1]);
  if(v==='additions') return viewAdditions(p[1], p[2]?decodeURIComponent(p[2]):'');
  if(v==='messages') return viewInbox();
  return viewDash();
}
function loading(active,title){ A().shell(active,`<h1>${esc(title)}</h1><div class="card"><p class="muted">Завантаження даних…</p></div>`) }
function errBox(e){ return `<div class="callout bad"><b>Не вдалося завантажити дані</b><p>${esc(e.message||e)}</p></div>` }

/* ---------- огляд ---------- */
async function viewDash(){
  loading('a:home','Огляд');
  let P, msgs=[];
  try{ P = await loadPeople(true); msgs = await loadMessages(); }catch(e){ return A().shell('a:home','<h1>Огляд</h1>'+errBox(e)) }
  const {CFG, COURSES} = A();
  const st = P.teachers.map(t=>({t, s:statsFor(t.email)}));
  const branches = (P.branches||CFG.BRANCHES||[]).slice(); st.forEach(x=>{ if(branches.indexOf(x.t.branch)<0) branches.push(x.t.branch) });
  const byB = branches.map(b=>{ const L=st.filter(x=>x.t.branch===b); return {b, n:L.length, avg:L.length?Math.round(L.reduce((a,x)=>a+x.s.pct,0)/L.length):0, done:L.reduce((a,x)=>a+x.s.completed,0)} });
  const avg = st.length?Math.round(st.reduce((a,x)=>a+x.s.pct,0)/st.length):0;
  const drafts=(window.RS_ADDITIONS||[]).filter(a=>addStatus(a)==='draft').length;
  const probs=Object.keys(window.RS_PROBLEMS||{}).reduce((a,c)=>a+(window.RS_PROBLEMS[c]||[]).filter(p=>{const e=A().EDITS[probKey(c,p)];return !(e&&e.status==='resolved')}).length,0);
  NEWMSG = msgs.filter(m=>m.status==='Нове').length;
  // популярність курсів
  const courseRows = COURSES.map(c=>{ const L=st.filter(x=>x.s.started.indexOf(c)>=0); return {label:c.title, value: L.length?Math.round(L.reduce((a,x)=>a+x.s.per.find(p=>p.c===c).pct,0)/L.length):0, sub:'навчаються: '+L.length, n:L.length} }).filter(r=>r.n).sort((a,b)=>b.n-a.n).slice(0,12);
  const recent = [].concat(...P.teachers.map(t=>(P.history[t.email]||[]).map(h=>Object.assign({fio:t.fio,email:t.email},h)))).sort((a,b)=>String(b.at).localeCompare(String(a.at))).slice(0,10);
  A().shell('a:home',`
    <div class="row"><h1 style="margin:0">Огляд</h1><span class="grow"></span><span class="tiny">Дані на ${fmtDT(P.loadedAt)}${A().BETA?' · бета: лише цей браузер':''}</span></div>
    <div class="grid g4" style="margin:16px 0 22px">
      <div class="card kpi"><div class="v">${P.teachers.length}</div><div class="l">працівників зареєстровано</div></div>
      <div class="card kpi"><div class="v">${avg}%</div><div class="l">середній прогрес</div></div>
      <a class="card kpi" href="#/admin/messages" style="text-decoration:none;color:inherit"><div class="v">${NEWMSG}</div><div class="l">нових повідомлень</div></a>
      <a class="card kpi" href="#/admin/additions" style="text-decoration:none;color:inherit"><div class="v">${drafts}</div><div class="l">доповнень чекають перевірки</div></a>
    </div>
    <div class="grid g2" style="gap:18px;align-items:start">
      <div class="card"><h3>Філії: середній прогрес працівників</h3>${chartBarsH(byB.map(x=>({label:x.b+' ('+x.n+')',value:x.avg,sub:'завершено курсів: '+x.done})),{title:'Середній прогрес за філіями'})}
        <details class="small"><summary>Таблиця</summary><table class="prose"><tr><th>Філія</th><th>Працівників</th><th>Середній прогрес</th><th>Завершено курсів</th></tr>${byB.map(x=>`<tr><td>${esc(x.b)}</td><td>${x.n}</td><td>${x.avg}%</td><td>${x.done}</td></tr>`).join('')}</table></details></div>
      <div class="card"><h3>Курси, які проходять найбільше</h3>${courseRows.length?chartBarsH(courseRows,{title:'Середній прогрес за курсами'}):'<p class="muted">Поки ніхто не розпочав курси.</p>'}</div>
    </div>
    <div class="grid g2" style="gap:18px;margin-top:18px;align-items:start">
      <div class="card"><h3>Остання активність</h3>${recent.length?`<table class="prose" style="width:100%">${recent.map(r=>`<tr><td><a href="#/admin/person/${encodeURIComponent(r.email)}">${esc(r.fio)}</a><div class="tiny">${esc(r.courseTitle||r.course)} · ${esc(r.itemTitle||r.item)}</div></td><td style="text-align:right"><span class="pill ${r.passed?'good':'warn'}">${r.percent}%</span><div class="tiny">${fmtDT(r.at)}</div></td></tr>`).join('')}</table>`:'<p class="muted">Ще немає результатів.</p>'}</div>
      <div class="card"><h3>Методична робота</h3><ul>
        <li><a href="#/admin/problems">Відкритих методичних проблем: <b>${probs}</b></a></li>
        <li><a href="#/admin/additions">Доповнень платформи на перевірці: <b>${drafts}</b></a> — учителі їх не бачать, доки ви не опублікуєте.</li>
        <li><a href="#/admin/messages">Повідомлень від учителів: <b>${msgs.length}</b>, нових: <b>${NEWMSG}</b></a></li></ul></div>
    </div>`);
  bindTips($('#view'));
}

/* ---------- працівники ---------- */
async function viewPeople(){
  loading('a:people','Працівники й звіти');
  let P; try{ P=await loadPeople(true) }catch(e){ return A().shell('a:people','<h1>Працівники й звіти</h1>'+errBox(e)) }
  const {CFG}=A(); const branches=(P.branches||CFG.BRANCHES||[]).slice(); P.teachers.forEach(t=>{ if(branches.indexOf(t.branch)<0) branches.push(t.branch) });
  const rows = P.teachers.map(t=>({t, s:statsFor(t.email)}));
  A().shell('a:people',`<div class="row"><h1 style="margin:0">Працівники й звіти</h1><span class="grow"></span><button class="btn sm ghost" id="csv">⬇ CSV</button></div>
    <div class="filters" style="margin:14px 0"><input class="input" id="q" placeholder="Пошук: ПІБ, пошта, телефон" style="max-width:320px">
      <select class="input" id="fb" style="max-width:260px"><option value="">Усі філії</option>${branches.map(b=>`<option>${esc(b)}</option>`).join('')}</select></div>
    ${rows.length?`<div class="card" style="padding:0;overflow:auto"><table class="prose ptable" id="pt" style="width:100%;margin:0"><thead><tr><th>ПІБ</th><th>Філія</th><th>Контакти</th><th>Прогрес</th><th>Завершено курсів</th><th>Остання активність</th><th></th></tr></thead><tbody>
    ${rows.map(x=>`<tr data-b="${esc(x.t.branch)}" data-s="${esc((x.t.fio+' '+x.t.email+' '+x.t.phone).toLowerCase())}"><td><b>${esc(x.t.fio)}</b><div class="tiny">з ${fmtD(x.t.registered)}</div></td><td>${esc(x.t.branch)}</td><td class="small">${esc(x.t.email)}<br>${esc(x.t.phone)}</td>
      <td style="min-width:140px"><div class="bar"><i style="width:${x.s.pct}%"></i></div><b>${x.s.pct}%</b></td><td>${x.s.completed}</td><td class="small">${fmtDT(x.s.last||x.t.lastLogin)}</td>
      <td><a class="btn sm" href="#/admin/person/${encodeURIComponent(x.t.email)}">Звіт</a></td></tr>`).join('')}</tbody></table></div>`:'<div class="card"><p class="muted">Ще ніхто не зареєструвався.</p></div>'}`);
  const f=()=>{ const q=$('#q').value.trim().toLowerCase(), b=$('#fb').value; $$('#pt tbody tr').forEach(tr=>tr.style.display=(!q||tr.dataset.s.includes(q))&&(!b||tr.dataset.b===b)?'':'none') };
  $('#q').oninput=f; $('#fb').onchange=f;
  $('#csv').onclick=()=>csvDownload('robotschool-pracivnyky.csv',[['ПІБ','Філія','Email','Телефон','Дата реєстрації','Прогрес %','Завершено курсів','Остання активність']].concat(rows.filter(x=>{const b=$('#fb').value;return !b||x.t.branch===b}).map(x=>[x.t.fio,x.t.branch,x.t.email,x.t.phone,fmtD(x.t.registered),x.s.pct,x.s.completed,fmtDT(x.s.last||x.t.lastLogin)])));
}

/* ---------- звіт по людині ---------- */
async function viewPerson(email){
  loading('a:people','Звіт');
  let P; try{ P=await loadPeople() }catch(e){ return A().shell('a:people','<h1>Звіт</h1>'+errBox(e)) }
  const t=P.teachers.find(x=>x.email===email); if(!t){ A().shell('a:people','<h1>Звіт</h1><div class="card">Працівника не знайдено.</div>'); return }
  const s=statsFor(email), {PASS,LS}=A();
  const per=s.per.filter(x=>x.started||x.c.id==='method');
  const fmt=LS.get('rsa_chartfmt','bars');
  const dirs=[{k:'method',t:'Методична база'},{k:'robot',t:'Робототехніка'},{k:'3d',t:'3D-графіка'},{k:'code',t:'Програмування'}].map(d=>{ const L=s.per.filter(x=>d.k==='method'?x.c.id==='method':x.c.dir===d.k); const tot=L.reduce((a,x)=>a+x.total,0), dn=L.reduce((a,x)=>a+x.done,0); return {label:d.t, value: tot?Math.round(100*dn/tot):0} });
  const doneN=s.done, triedN=s.per.reduce((a,x)=>a+x.attempted,0);
  const testsPts=s.hist.filter(h=>(h.kind==='test'||h.kind==='Тест')).map(h=>({x:h.at,y:Number(h.percent)||0,label:(h.courseTitle||h.course)+' · '+(h.itemTitle||h.item)}));
  const courseChart = () => {
    const rows=per.map(x=>({label:x.c.title,value:x.pct,sub:x.done+' з '+x.total+' кроків',color:x.c.color}));
    if(fmt==='radar' && rows.length>=3) return chartRadar(rows,{title:'Прогрес за курсами'});
    if(fmt==='rings') return `<div class="rings">${per.map(x=>`<div class="ringc">${chartDonut([{label:'Пройдено',value:x.done,color:'var(--s1)'},{label:'Залишилось',value:Math.max(0,x.total-x.done),color:'var(--line)'}],{center:x.pct+'%',centerSub:'',compact:true})}<div class="small"><b>${esc(x.c.title)}</b><div class="tiny">${x.done} з ${x.total}</div></div></div>`).join('')}</div>`;
    return chartBarsH(rows.map(r=>Object.assign(r,{color:'var(--s1)'})),{title:'Прогрес за курсами'});
  };
  A().shell('a:people',`
    <div class="row noprint" style="margin-bottom:10px"><a class="btn sm ghost" href="#/admin/people">← До списку</a><span class="grow"></span><button class="btn sm ghost" id="csv">⬇ CSV</button><button class="btn sm" id="pr">🖨 Друк / PDF</button></div>
    <div class="card report-head"><div class="row"><div class="grow"><div class="tiny">Звіт про проходження навчання · Robot School Academy</div><h1 style="margin:4px 0">${esc(t.fio)}</h1>
      <div class="small">Філія «${esc(t.branch)}» · ${esc(t.email)} · ${esc(t.phone)}</div><div class="tiny">Зареєстровано ${fmtD(t.registered)} · остання активність ${fmtDT(s.last||t.lastLogin)} · звіт сформовано ${fmtDT(new Date())}</div></div>
      <img src="assets/logo.png" alt="" style="height:44px"></div></div>
    <div class="grid g4" style="margin:16px 0">
      <div class="card kpi"><div class="v">${s.pct}%</div><div class="l">загальний прогрес</div></div>
      <div class="card kpi"><div class="v">${s.completed}</div><div class="l">курсів завершено</div></div>
      <div class="card kpi"><div class="v">${s.per.reduce((a,x)=>a+x.testsDone,0)}</div><div class="l">тестів зараховано</div></div>
      <div class="card kpi"><div class="v">${s.started.length}</div><div class="l">курсів розпочато</div></div>
    </div>
    <div class="card"><div class="row"><h3 style="margin:0">Прогрес за курсами</h3><span class="grow"></span>
      <div class="seg inline noprint" id="fmt">${[['bars','Стовпчики'],['radar','Радар'],['rings','Кільця']].map(([k,l])=>`<button data-f="${k}" class="${fmt===k?'on':''}">${l}</button>`).join('')}</div></div>
      <div style="margin-top:10px">${courseChart()}</div></div>
    <div class="grid g2" style="gap:18px;margin-top:18px;align-items:start">
      <div class="card"><h3>Кроки навчання за статусом</h3>${chartDonut([{label:'Зараховано',value:doneN,color:'var(--s1)'},{label:'Є спроби, не зараховано',value:triedN,color:'var(--s2)'},{label:'Не розпочато',value:Math.max(0,s.total-doneN-triedN),color:'var(--line)'}],{center:s.pct+'%',centerSub:'зараховано'})}</div>
      <div class="card"><h3>Напрями</h3>${chartRadar(dirs,{title:'Прогрес за напрямами'})}</div>
    </div>
    <div class="card" style="margin-top:18px"><h3>Результати тестів у часі</h3>${chartLine(testsPts,{title:'Результати тестів',pass:PASS})}</div>
    <div class="card" style="margin-top:18px"><h3>Що пройдено за типами кроків</h3>${chartStacked(per.map(x=>({label:x.c.title,parts:{read:x.byKind.read.done,trainer:x.byKind.trainer.done,test:x.byKind.test.done}})),[{k:'read',label:'Розділи',color:'var(--s1)'},{k:'trainer',label:'Тренажери',color:'var(--s2)'},{k:'test',label:'Тести',color:'var(--s3)'}],{title:'Кроки за типами'})}</div>
    <h2 style="margin-top:24px">Детально за курсами</h2>
    ${per.map(x=>{ const b=(P.best[email]||{})[x.c.id]||{}; const items=A().courseItems(x.c); return `<div class="card" style="margin-bottom:12px;break-inside:avoid"><div class="row"><span class="sw" style="width:12px;height:12px;border-radius:3px;background:${x.c.color};display:inline-block"></span><h3 style="margin:0">${esc(x.c.title)}</h3><span class="grow"></span><b>${x.pct}%</b>${x.complete?'<span class="pill good">завершено</span>':''}${x.testAvg!==null?`<span class="pill">середній тест ${x.testAvg}%</span>`:''}</div>
      <table class="prose" style="width:100%;font-size:13.5px"><tr><th>Крок</th><th>Тип</th><th>Результат</th><th>Спроб</th><th>Дата</th></tr>${items.map(i=>{const r=b[i.id];return `<tr><td>${esc(i.title)}</td><td>${KIND[i.kind]}</td><td>${r?`<span class="pill ${r.passed?'good':'warn'}">${i.kind==='read'?'опрацьовано':r.percent+'%'}</span>`:'—'}</td><td>${r?(r.attempts||1):''}</td><td>${r?fmtD(r.at):''}</td></tr>`}).join('')}</table></div>` }).join('')}`);
  bindTips($('#view'));
  $$('#fmt [data-f]').forEach(b=>b.onclick=()=>{ LS.set('rsa_chartfmt',b.dataset.f); viewPerson(email) });
  $('#pr').onclick=()=>window.print();
  $('#csv').onclick=()=>{ const rows=[['ПІБ','Філія','Email','Курс','Крок','Тип','Результат %','Зараховано','Спроб','Дата']];
    per.forEach(x=>{ const b=(P.best[email]||{})[x.c.id]||{}; A().courseItems(x.c).forEach(i=>{ const r=b[i.id]; rows.push([t.fio,t.branch,t.email,x.c.title,i.title,KIND[i.kind],r?r.percent:'',r?(r.passed?'так':'ні'):'',r?(r.attempts||1):'',r?fmtD(r.at):'']) }) });
    csvDownload('zvit-'+t.email.replace(/[^a-z0-9]+/gi,'_')+'.csv',rows) };
}

/* ---------- методичні проблеми ---------- */
const PKIND = {archive:'Проблема в архіві курсу', todo:'Треба дописати / виправити', added:'Дописано платформою', test:'Прибране питання тесту'};
const PSTAT = {open:'Відкрито', work:'В роботі', resolved:'Вирішено'};
function viewProblems(cid){
  const {ALL}=A(); const PR=window.RS_PROBLEMS||{};
  const ADD=window.RS_ADDITIONS||[];
  const list = ALL.filter(c=>(PR[c.id]||[]).length || ADD.some(a=>a.cid===c.id));
  const cur = cid ? ALL.find(c=>c.id===cid) : null;
  const card = c => { const ps=PR[c.id]||[]; const open=ps.filter(p=>{const e=A().EDITS[probKey(c.id,p)];return !(e&&e.status==='resolved')}).length; const ad=ADD.filter(a=>a.cid===c.id); const dr=ad.filter(a=>addStatus(a)==='draft').length;
    return `<a class="card" href="#/admin/problems/${c.id}" style="text-decoration:none;color:inherit;display:block"><div class="row"><span class="sw" style="width:12px;height:12px;border-radius:3px;background:${c.color};display:inline-block"></span><b>${esc(c.title)}</b></div>
      <div class="small" style="margin-top:8px">Відкритих проблем: <b>${open}</b> з ${ps.length}<br>Доповнень платформи: <b>${ad.length}</b>${dr?`, на перевірці: <b>${dr}</b>`:''}</div></a>` };
  if(!cur){
    A().shell('a:problems',`<h1>Методичні проблеми курсів</h1><p class="muted" style="max-width:860px">Тут зібрано все, що вчителі більше не бачать: розбіжності в архівах, відсутні чи скопійовані файли, прибрані з тестів питання про архів, а також що дописала платформа й що ще треба дописати. Кожній проблемі можна поставити статус і коментар.</p><div class="grid g3">${list.map(card).join('')}</div>`);
    return;
  }
  const ps=PR[cur.id]||[]; const ad=ADD.filter(a=>a.cid===cur.id);
  const groups=['todo','archive','added','test'].map(k=>({k, items:ps.map((p,i)=>({p,i})).filter(x=>x.p.kind===k)})).filter(g=>g.items.length);
  A().shell('a:problems',`<div class="row" style="margin-bottom:10px"><a class="btn sm ghost" href="#/admin/problems">← Усі курси</a><span class="grow"></span><a class="btn sm ghost" href="#/course/${cur.id}">Відкрити курс</a></div>
    <h1>${esc(cur.title)}: методичні проблеми</h1>
    ${ad.length?`<div class="callout info"><b>Доповнення платформи в цьому курсі: ${ad.length}</b><p>Теми уроків: ${ad.filter(a=>a.field==='topic').length} · блоки «Учитель має знати»: ${ad.filter(a=>a.field==='know').length} · конспекти TB: ${ad.filter(a=>a.field==='tb').length}. На перевірці: ${ad.filter(a=>addStatus(a)==='draft').length}. <a href="#/admin/additions/${cur.id}">Перевірити й опублікувати →</a></p></div>`:''}
    ${groups.map(g=>`<h2>${PKIND[g.k]} <span class="pill">${g.items.length}</span></h2>${g.items.map(({p})=>{ const key=probKey(cur.id,p), e=A().EDITS[key]||{}; const st=e.status||'open';
      return `<div class="card prob ${st}" style="margin-bottom:10px" data-key="${esc(key)}"><div class="row" style="align-items:flex-start"><div class="grow"><div class="tiny">${esc(p.where)}</div><div style="margin-top:4px">${esc(p.text)}</div></div>
        <select class="input pst" style="max-width:160px">${Object.keys(PSTAT).map(k=>`<option value="${k}" ${k===st?'selected':''}>${PSTAT[k]}</option>`).join('')}</select></div>
        <div class="row" style="margin-top:8px"><input class="input pcm" placeholder="Коментар методиста (необов’язково)" value="${esc(e.comment||'')}"><button class="btn sm ghost psave">Зберегти</button></div></div>` }).join('')}`).join('')}`);
  $$('.prob').forEach(box=>{ const save=async()=>{ try{ await saveEdit(box.dataset.key,{status:$('.pst',box).value,comment:$('.pcm',box).value.trim(),at:new Date().toISOString()}); box.className='card prob '+$('.pst',box).value; A().toast('Збережено') }catch(e){ A().toast(e.message) } };
    $('.pst',box).onchange=save; $('.psave',box).onclick=save; });
}

/* ---------- доповнення платформи ---------- */
const FIELD = {topic:'Тема уроку', know:'Учитель має знати', tb:'Конспект учителя (TB)'};
function viewAdditions(cid, key){
  const {ALL, COURSES}=A(); const ADD=window.RS_ADDITIONS||[];
  if(key) return editAddition(ADD.find(a=>a.key===key), cid);
  const cur = cid ? COURSES.find(c=>c.id===cid) : null;
  const cnt = L=>({all:L.length, draft:L.filter(a=>addStatus(a)==='draft').length, pub:L.filter(a=>addStatus(a)==='published').length});
  if(!cur){
    const tot=cnt(ADD);
    A().shell('a:additions',`<h1>Доповнення платформи</h1>
      <p class="muted" style="max-width:880px">Платформа переписала теми уроків, що дублювалися або були порожні, доповнила блоки «Учитель має знати» і склала конспекти TB там, де їх не було в архіві. <b>Учителі бачать доповнення лише після публікації.</b> До того вони бачать вихідний варіант з архіву (а помилково скопійовані теми й пункти — приховані). Кожен пункт можна відредагувати, опублікувати, повернути в чернетку або відхилити.</p>
      <div class="row" style="margin:12px 0 18px"><span class="pill">усього ${tot.all}</span><span class="pill warn">чернеток ${tot.draft}</span><span class="pill good">опубліковано ${tot.pub}</span><span class="grow"></span><button class="btn sm" id="puball">Опублікувати всі чернетки</button></div>
      <div class="grid g3">${COURSES.filter(c=>ADD.some(a=>a.cid===c.id)).map(c=>{ const k=cnt(ADD.filter(a=>a.cid===c.id)); return `<a class="card" href="#/admin/additions/${c.id}" style="text-decoration:none;color:inherit;display:block"><div class="row"><span class="sw" style="width:12px;height:12px;border-radius:3px;background:${c.color};display:inline-block"></span><b>${esc(c.title)}</b></div><div class="small" style="margin-top:8px">${k.all} доповнень · чернеток <b>${k.draft}</b> · опубліковано <b>${k.pub}</b></div><div class="bar" style="margin-top:8px"><i style="width:${Math.round(100*k.pub/Math.max(1,k.all))}%;background:var(--good)"></i></div></a>` }).join('')}</div>`);
    $('#puball').onclick=()=>bulk(ADD,'published');
    return;
  }
  const L=ADD.filter(a=>a.cid===cur.id); const k=cnt(L);
  const lessons=[...new Set(L.map(a=>a.n))];
  A().shell('a:additions',`<div class="row" style="margin-bottom:10px"><a class="btn sm ghost" href="#/admin/additions">← Усі курси</a><span class="grow"></span><a class="btn sm ghost" href="#/course/${cur.id}/${(cur.tabs.find(t=>t.render==='plan')||{}).id||''}">План курсу</a></div>
    <h1>${esc(cur.title)}: доповнення</h1>
    <div class="row" style="margin:6px 0 16px"><span class="pill warn">чернеток ${k.draft}</span><span class="pill good">опубліковано ${k.pub}</span><span class="grow"></span><button class="btn sm ghost" id="draftall">Усі в чернетки</button><button class="btn sm" id="puball">Опублікувати всі в курсі</button></div>
    ${lessons.map(n=>{ const l=cur.plan.find(p=>p.n===n); return `<div class="card" style="margin-bottom:12px"><h3 style="margin:0 0 8px">Урок ${esc(l.label||l.n)} · ${esc(l.name)}</h3>${L.filter(a=>a.n===n).map(a=>{ const st=addStatus(a), e=A().EDITS[a.key]||{}, v=e.value!==undefined?e.value:a.value;
      return `<div class="addrow" data-key="${esc(a.key)}"><div class="row"><b>${FIELD[a.field]}</b>${a.mode==='replace'?'<span class="tiny">замінює архівний варіант</span>':a.field==='know'?'<span class="tiny">додається до архівних пунктів</span>':''}${e.value!==undefined?'<span class="pill">змінено вами</span>':''}<span class="grow"></span><span class="pill ${st==='published'?'good':st==='deleted'?'bad':'warn'}">${ST_LABEL[st]}</span></div>
        <div class="small" style="margin:6px 0">${previewVal(a,v)}</div>
        ${a.field!=='tb'&&a.orig&&(a.orig.length||typeof a.orig==='string')?`<details class="tiny"><summary>Варіант з архіву</summary>${a.field==='topic'?esc(a.orig||'(порожньо)'):'<ul>'+a.orig.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>'}</details>`:''}
        <div class="row" style="gap:6px;margin-top:6px"><a class="btn sm ghost" href="#/admin/additions/${cur.id}/${encodeURIComponent(a.key)}">✎ Редагувати</a>${st!=='published'?'<button class="btn sm good" data-act="published">Опублікувати</button>':'<button class="btn sm ghost" data-act="draft">У чернетку</button>'}${st!=='deleted'?'<button class="btn sm ghost" data-act="deleted">Відхилити</button>':''}</div></div>` }).join('<hr>')}</div>` }).join('')}`);
  $$('.addrow [data-act]').forEach(b=>b.onclick=async()=>{ const key=b.closest('.addrow').dataset.key; const e=Object.assign({},A().EDITS[key]||{}); e.status=b.dataset.act; e.at=new Date().toISOString(); try{ await saveEdit(key,e); viewAdditions(cid) }catch(x){ A().toast(x.message) } });
  $('#puball').onclick=()=>bulk(L,'published',cid); $('#draftall').onclick=()=>bulk(L,'draft',cid);
}
function previewVal(a,v){
  if(a.field==='topic') return esc(v);
  if(a.field==='know') return '<ul style="margin:0;padding-left:18px">'+v.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>';
  return `<b>Мета:</b> ${esc(v.goal||'')}<br><b>Етапи:</b> ${(v.stages||[]).map(s=>esc(s[0])+' ('+s[2]+' хв)').join(' → ')}`;
}
async function bulk(list, status, cid){
  if(!confirm((status==='published'?'Опублікувати':'Перевести в чернетки')+' '+list.length+' пунктів?')) return;
  const diff={}; list.forEach(a=>{ const e=Object.assign({},A().EDITS[a.key]||{}); if(status==='published'&&e.status==='deleted') return; e.status=status; e.at=new Date().toISOString(); diff[a.key]=e });
  try{ const ed=await A().API.saveEdits(diff); A().setEdits(ed); A().toast('Збережено: '+Object.keys(diff).length); viewAdditions(cid) }catch(x){ A().toast(x.message) }
}
function editAddition(a, cid){
  if(!a){ A().shell('a:additions','<div class="card">Пункт не знайдено.</div>'); return }
  const c=A().COURSES.find(x=>x.id===a.cid), l=c.plan.find(p=>p.n===a.n);
  const e=A().EDITS[a.key]||{}, v=e.value!==undefined?e.value:a.value, st=addStatus(a);
  let form='';
  if(a.field==='topic') form=`<div class="field"><label>Тема уроку</label><input class="input" name="topic" value="${esc(v)}"></div>`;
  else if(a.field==='know') form=`<div class="field"><label>Пункти «Учитель має знати» — кожен з нового рядка</label><textarea class="input" name="know" rows="10">${esc(v.join('\n'))}</textarea></div><p class="tiny">${a.mode==='replace'?'Ці пункти замінюють архівний блок.':'Ці пункти додаються після архівних пунктів уроку.'}</p>`;
  else form=`${['goal:Мета (навчальна)','dev:Розвивальна / виховна мета','type:Тип і форма уроку','equip:Обладнання'].map(x=>{const [k,lab]=x.split(':');return `<div class="field"><label>${lab}</label><textarea class="input" name="${k}" rows="2">${esc(v[k]||'')}</textarea></div>`}).join('')}
    <div class="field"><label>Етапи уроку — кожен з нового рядка у форматі «Етап | зміст | хвилини»</label><textarea class="input" name="stages" rows="12">${esc((v.stages||[]).map(s=>s.join(' | ')).join('\n'))}</textarea></div>
    <div class="field"><label>Домашнє завдання</label><textarea class="input" name="hw" rows="2">${esc(v.hw||'')}</textarea></div>
    <div class="field"><label>Матеріали для вчителя</label><textarea class="input" name="mat" rows="2">${esc(String(v.mat||'').replace(/<[^>]+>/g,''))}</textarea></div>`;
  A().shell('a:additions',`<div class="row" style="margin-bottom:10px"><a class="btn sm ghost" href="#/admin/additions/${a.cid}">← ${esc(c.title)}</a></div>
    <h1>${FIELD[a.field]}</h1><p class="muted">${esc(c.title)} · урок ${esc(l.label||l.n)} «${esc(l.name)}» · статус: <b>${ST_LABEL[st]}</b></p>
    <form class="card" id="ef" style="max-width:900px">${form}
      <div class="field"><label>Статус</label><select class="input" name="status" style="max-width:320px">${['draft','published','deleted'].map(k=>`<option value="${k}" ${k===st?'selected':''}>${ST_LABEL[k]}${k==='draft'?' (бачите лише ви)':k==='published'?' (бачать учителі)':''}</option>`).join('')}</select></div>
      <div class="row"><button class="btn" type="submit">Зберегти</button>${e.value!==undefined?'<button class="btn ghost" type="button" id="reset">Повернути варіант платформи</button>':''}<span class="grow"></span><a class="btn ghost" href="#/course/${c.id}/${(c.tabs.find(t=>t.render==='plan')||{}).id||''}">Переглянути в плані</a></div></form>`);
  $('#ef').onsubmit=async ev=>{ ev.preventDefault(); const d=Object.fromEntries(new FormData(ev.target).entries()); let val;
    if(a.field==='topic') val=d.topic.trim();
    else if(a.field==='know') val=d.know.split('\n').map(x=>x.trim()).filter(Boolean);
    else val={goal:d.goal.trim(),dev:d.dev.trim(),type:d.type.trim(),equip:d.equip.trim(),hw:d.hw.trim(),mat:A().esc(d.mat.trim()),stages:d.stages.split('\n').map(x=>x.split('|').map(y=>y.trim())).filter(x=>x[0]).map(x=>[x[0],x[1]||'',Number(x[2])||0])};
    const same = JSON.stringify(val)===JSON.stringify(a.value);
    const rec={status:d.status,at:new Date().toISOString()}; if(!same) rec.value=val;
    try{ await saveEdit(a.key,rec); A().toast('Збережено'); location.hash='#/admin/additions/'+a.cid }catch(x){ A().toast(x.message) } };
  const rs=$('#reset'); if(rs) rs.onclick=async()=>{ try{ await saveEdit(a.key,{status:st,at:new Date().toISOString()}); editAddition(a,cid) }catch(x){ A().toast(x.message) } };
}

/* ---------- повідомлення: адміністратор ---------- */
async function loadMessages(){
  const {BETA,LS,KEY,API}=A();
  if(BETA) return LS.get(KEY+'messages',[]).slice().reverse();
  const j=await API.adminCall('adminMessages'); return (j.messages||[]).slice().reverse();
}
async function replyMessage(id, reply, status){
  const {BETA,LS,KEY,API}=A();
  if(BETA){ const all=LS.get(KEY+'messages',[]); const m=all.find(x=>x.id===id); if(m){ if(reply!==undefined){ m.reply=reply; m.replyAt=new Date().toISOString() } m.status=status } LS.set(KEY+'messages',all); return }
  await API.adminCall('adminReply',{id,reply,status});
}
async function viewInbox(){
  loading('a:messages','Повідомлення');
  let msgs; try{ msgs=await loadMessages() }catch(e){ return A().shell('a:messages','<h1>Повідомлення</h1>'+errBox(e)) }
  NEWMSG=msgs.filter(m=>m.status==='Нове').length;
  A().shell('a:messages',`<h1>Повідомлення від учителів</h1>
    <div class="filters" style="margin:10px 0 16px"><select class="input" id="fs" style="max-width:220px"><option value="">Усі статуси</option>${MSG_STATUS.map(s=>`<option>${s}</option>`).join('')}</select><input class="input" id="fq" placeholder="Пошук" style="max-width:280px"></div>
    ${msgs.length?msgs.map(m=>`<div class="card msg" style="margin-bottom:12px" data-id="${esc(m.id)}" data-st="${esc(m.status)}" data-s="${esc((m.fio+' '+m.email+' '+m.text+' '+m.course+' '+m.branch).toLowerCase())}">
      <div class="row"><b>${esc(m.fio||m.email)}</b><span class="tiny">${esc(m.branch)} · ${esc(m.email)}</span><span class="grow"></span><span class="pill">${esc(m.type)}</span>${m.course?`<span class="pill">${esc(m.course)}</span>`:''}<span class="pill ${m.status==='Нове'?'warn':m.status==='Закрито'||m.status==='Відповідь надано'?'good':''}">${esc(m.status)}</span></div>
      <div class="tiny" style="margin-top:4px">${fmtDT(m.at)}</div>
      <p style="white-space:pre-wrap;margin:8px 0">${esc(m.text)}</p>
      ${m.reply?`<div class="callout info small"><b>Ваша відповідь · ${fmtDT(m.replyAt)}</b><p style="white-space:pre-wrap">${esc(m.reply)}</p></div>`:''}
      <details ${m.reply?'':'open'}><summary class="small">${m.reply?'Змінити відповідь':'Відповісти'}</summary>
        <textarea class="input rp" rows="3" style="margin-top:8px" placeholder="Відповідь побачить учитель у розділі «Написати методисту»">${esc(m.reply||'')}</textarea>
        <div class="row" style="margin-top:8px"><select class="input rs" style="max-width:220px">${MSG_STATUS.map(s=>`<option ${s===(m.reply?m.status:'Відповідь надано')?'selected':''}>${s}</option>`).join('')}</select><button class="btn sm send">Зберегти</button></div></details>
    </div>`).join(''):'<div class="card"><p class="muted">Повідомлень поки немає.</p></div>'}`);
  const f=()=>{ const s=$('#fs').value, q=$('#fq').value.trim().toLowerCase(); $$('.msg').forEach(el=>el.style.display=(!s||el.dataset.st===s)&&(!q||el.dataset.s.includes(q))?'':'none') };
  $('#fs').onchange=f; $('#fq').oninput=f;
  $$('.msg').forEach(el=>{ $('.send',el).onclick=async()=>{ const r=$('.rp',el).value.trim(); try{ await replyMessage(el.dataset.id, r||undefined, $('.rs',el).value); A().toast('Збережено'); viewInbox() }catch(e){ A().toast(e.message) } };
    if(el.dataset.st==='Нове') { const m=msgs.find(x=>x.id===el.dataset.id); if(m&&!m.reply){} } });
}

/* ---------- повідомлення: учитель ---------- */
async function viewMessages(){
  const {S,LS,KEY,API,COURSES,shell}=A();
  shell('messages',`<h1>Написати методисту</h1><div class="card"><p class="muted">Завантаження…</p></div>`);
  let mine=[]; try{ mine=await API.myMessages() }catch(e){ mine=LS.get(KEY+'mycache_'+S.user.email,[]) }
  LS.set(KEY+'mycache_'+S.user.email,mine);
  const seen=LS.get(KEY+'seen_'+S.user.email,[]);
  shell('messages',`<h1>Написати методисту</h1>
    <p class="muted" style="max-width:820px">Питання щодо курсів, пропозиції, помилки в матеріалах — пишіть сюди. Повідомлення отримує методичний відділ, а відповідь з’явиться нижче${A().BETA?'':' (і в таблиці методиста)'}.</p>
    <form class="card" id="mf" style="max-width:860px">
      <div class="grid g2" style="gap:10px"><div class="field"><label>Тема звернення</label><select class="input" name="type">${MSG_TYPES.map(t=>`<option>${t}</option>`).join('')}</select></div>
      <div class="field"><label>Курс (необов’язково)</label><select class="input" name="course"><option value="">—</option><option>Методична база</option>${COURSES.map(c=>`<option>${esc(c.title)}</option>`).join('')}</select></div></div>
      <div class="field"><label>Повідомлення</label><textarea class="input" name="text" rows="5" required minlength="3" placeholder="Опишіть питання чи пропозицію. Якщо це помилка в матеріалах — вкажіть урок."></textarea></div>
      <div class="err" id="merr"></div><button class="btn" type="submit">Надіслати</button></form>
    <h2 style="margin-top:26px">Мої звернення</h2>
    ${mine.length?mine.slice().reverse().map(m=>`<div class="card" style="margin-bottom:12px"><div class="row"><span class="pill">${esc(m.type)}</span>${m.course?`<span class="pill">${esc(m.course)}</span>`:''}<span class="grow"></span><span class="tiny">${fmtDT(m.at)}</span><span class="pill ${m.reply?'good':'warn'}">${m.reply?'Є відповідь':esc(m.status||'Надіслано')}</span></div>
      <p style="white-space:pre-wrap;margin:8px 0">${esc(m.text)}</p>${m.reply?`<div class="callout info small"><b>Відповідь методиста · ${fmtDT(m.replyAt)}</b><p style="white-space:pre-wrap">${esc(m.reply)}</p></div>`:''}</div>`).join(''):'<p class="muted">Ви ще не надсилали повідомлень.</p>'}`);
  LS.set(KEY+'seen_'+S.user.email, seen.concat(mine.filter(m=>m.reply).map(m=>m.id)));
  $('#mf').onsubmit=async e=>{ e.preventDefault(); const d=Object.fromEntries(new FormData(e.target).entries()); const btn=e.target.querySelector('button'); btn.disabled=true;
    try{ await API.sendMessage({type:d.type,course:d.course,text:d.text.trim()}); A().toast('Повідомлення надіслано методисту'); viewMessages() }catch(x){ $('#merr').textContent=x.message; btn.disabled=false } };
}

window.RS_ADMIN = { nav, route, viewMessages };
})();
