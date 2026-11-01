/* Robot School Academy — CRM філій (v3.0).
   Адміністратор філії: учні й батьки, групи й розклад, заміни, відвідування, оплати (абонемент),
   боржники, учителі й зарплата, витрати, фінансовий звіт.
   Учитель: «Мій розклад» — свої заняття й заміни, відмітка присутності, заробіток за місяць.
   Методист: логіни й паролі адміністраторів філій, видалення вчителів, зведення по філіях.
   У робочій версії дані — у Google Таблиці філії (Apps Script), у беті — у цьому браузері. */
(function(){
'use strict';
const A = () => window.RS_APP;
const $ = (s,el=document)=>el.querySelector(s);
const $$ = (s,el=document)=>Array.from(el.querySelectorAll(s));
const esc = s => A().esc(s);
const UAH = n => (Math.round(Number(n)||0)).toLocaleString('uk-UA').replace(/[,\s]/g,'\u00a0')+'\u00a0грн';
const WD = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
const WD_FULL = ['Понеділок','Вівторок','Середа','Четвер','П’ятниця','Субота','Неділя'];
const MONTHS = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
const MONTHS_GEN = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];
const roleLabel = o => `${o.role} — ${UAH(o.rate)}${o.type==='hour'?' / год':' / міс.'}`;
const EXP_CATS = ['Оренда','Закупівлі (обладнання, набори)','Канцтовари й витратні матеріали','Реклама','Комунальні послуги','Зарплата адміністратора','Податки й банк','Інше'];
const PAY_METHODS = ['Готівка','Картка / переказ','Безготівковий рахунок'];
const ROLES = ['Адміністратор','Лаборант','Методист','Інше'];

/* ---------- дати ---------- */
const pad = n => String(n).padStart(2,'0');
const ymd = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const parse = s => { const [y,m,d]=String(s).slice(0,10).split('-').map(Number); return new Date(y,(m||1)-1,d||1) };
const today = () => ymd(new Date());
const wdOf = s => { const g=parse(s).getDay(); return g===0?7:g };          // 1 = Пн … 7 = Нд
const addDays = (s,n) => { const d=parse(s); d.setDate(d.getDate()+n); return ymd(d) };
const monthOf = s => String(s).slice(0,7);
const curMonth = () => today().slice(0,7);
const monthRange = m => { const [y,mm]=m.split('-').map(Number); return [m+'-01', ymd(new Date(y,mm,0))] };
const shiftMonth = (m,k) => { const [y,mm]=m.split('-').map(Number); const d=new Date(y,mm-1+k,1); return d.getFullYear()+'-'+pad(d.getMonth()+1) };
const monthTitle = m => { const [y,mm]=m.split('-').map(Number); return MONTHS[mm-1]+' '+y };
const fmtDate = s => { const d=parse(s); return d.getDate()+' '+MONTHS_GEN[d.getMonth()] };
const weekStart = s => addDays(s, 1-wdOf(s));
const age = b => { if(!b) return ''; const d=parse(b), n=new Date(); let a=n.getFullYear()-d.getFullYear(); if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate())) a--; return a>=0&&a<30?a+' р.':'' };
const initials = s => String(s||'').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
const COLORS = ['#0A44DC','#12A37F','#F2552C','#9C27B0','#E68A00','#0097A7','#C2185B','#5D4037'];
const colorOf = id => COLORS[[...String(id)].reduce((a,c)=>a+c.charCodeAt(0),0)%COLORS.length];
const normPhone = p => { let d=String(p||'').replace(/\D/g,''); if(d.length===10&&d[0]==='0') d='38'+d; if(d.length===9) d='380'+d; return /^380\d{9}$/.test(d)?'+'+d:'' };
const fmtPhone = p => { const d=String(p||'').replace(/\D/g,''); return d.length===12?`+${d.slice(0,3)} (${d.slice(3,5)}) ${d.slice(5,8)}-${d.slice(8,10)}-${d.slice(10)}`:p };
const uid = p => p+Math.random().toString(36).slice(2,10);

/* ======================================================================
   РОЗРАХУНКИ (однакові для адміністратора, вчителя й звітів)
   ====================================================================== */
function slotsOf(g){ try{ const s=typeof g.slots==='string'?JSON.parse(g.slots||'[]'):(g.slots||[]); return Array.isArray(s)?s:[] }catch(e){ return [] } }
function slotText(g){ return slotsOf(g).slice().sort((a,b)=>a.d-b.d||String(a.t).localeCompare(b.t)).map(s=>`${WD[s.d-1]} ${s.t}`).join(', ') || 'розклад не задано' }
function groupIds(s){ return String(s.groups||'').split(',').map(x=>x.trim()).filter(Boolean) }
/* усі заняття груп у проміжку [from; to]: регулярні за розкладом + разові, з урахуванням замін і скасувань */
function lessonsIn(T, from, to){
  const out=[], byId={}; (T.lessons||[]).forEach(l=>byId[l.id]=l);
  (T.groups||[]).forEach(g=>{
    if(g.status==='archive') return;
    const st = g.start && g.start>from ? g.start : from, en = g.end && g.end<to ? g.end : to;
    const sl = slotsOf(g);
    for(let d=st; d<=en; d=addDays(d,1)){ const w=wdOf(d);
      sl.filter(s=>Number(s.d)===w).forEach(s=>{ const id=g.id+'|'+d+'|'+s.t; out.push(mk(g, d, s.t, Number(s.m)||60, byId[id])); delete byId[id] }) }
  });
  Object.values(byId).forEach(l=>{ if(l.status==='extra' && l.date>=from && l.date<=to){ const g=(T.groups||[]).find(x=>x.id===l.gid); if(g) out.push(mk(g,l.date,l.time,60,l)) } });
  return out.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  function mk(g,date,time,dur,l){ l=l||{}; const sub=String(l.sub||'').toLowerCase();
    return {id:g.id+'|'+date+'|'+time, gid:g.id, g, date, time, dur, sub, groupTeacher:String(g.teacher||'').toLowerCase(), teacher: sub||String(g.teacher||'').toLowerCase(),
      status:l.status||'', cancelled:l.status==='cancelled', extra:l.status==='extra', done:l.done==='так'||l.done===true, note:l.note||'', by:l.by||'', row:l} }
}
function attIndex(T){ const o={}; (T.att||[]).forEach(a=>{ (o[a.lid]=o[a.lid]||{})[a.sid]=a }); return o }
function balances(T){ const b={}; (T.pays||[]).forEach(p=>b[p.sid]=(b[p.sid]||0)+Number(p.amount||0)); (T.att||[]).forEach(a=>{ if(a.mark==='p') b[a.sid]=(b[a.sid]||0)-Number(a.price||0) }); return b }
const DEF_DISC = [{id:'d2c',name:'Відвідує два або більше курсів',pct:10},{id:'dhalf',name:'Оплата за пів року',pct:5},{id:'dyear',name:'Оплата за рік',pct:10},{id:'dfam',name:'Багатодітна родина',pct:15},{id:'dmil',name:'Військові пільги',pct:20}];
function cfgOf(T){ const c={bonusFrom:5, bonusPer:25, defaultBase:300, premiumMode:'rate', discMax:50, discounts:DEF_DISC, orgName:'Robot School', unit:'', edrpou:'', cashier:'', receiptPrefix:''};
  const TXTK=['premiumMode','orgName','unit','edrpou','cashier','receiptPrefix'];
  (T.cfg||[]).forEach(r=>{ if(!(r.id in c)) return; if(TXTK.includes(r.id)) c[r.id]=String(r.value==null?'':r.value); else if(r.id==='discounts'){ try{ const x=JSON.parse(r.value); if(Array.isArray(x)) c.discounts=x }catch(e){} } else c[r.id]=Number(r.value) }); return c }
/* знижки учня: [{id,name,pct}]; сума відсотків обмежена максимумом із налаштувань */
function discOf(s){ try{ const x=typeof s.disc==='string'?JSON.parse(s.disc||'[]'):(s.disc||[]); return Array.isArray(x)?x:[] }catch(e){ return [] } }
function discPct(T, s){ const c=cfgOf(T); return Math.max(0, Math.min(c.discMax, discOf(s||{}).reduce((t,x)=>t+Number(x.pct||0),0))) }
const lessonPrice = (T, g, s) => Math.round(Number(g&&g.price||0)*(100-discPct(T,s))/100);
function rolesOf(r){ try{ const x=typeof r.roles==='string'?JSON.parse(r.roles||'[]'):(r.roles||[]); return Array.isArray(x)?x.filter(o=>o&&o.role):[] }catch(e){ return [] } }
function rateOf(T, email){ const r=(T.rates||[]).find(x=>String(x.id).toLowerCase()===String(email).toLowerCase()); const c=cfgOf(T); return {base: r&&r.base!==''&&r.base!==undefined?Number(r.base):c.defaultBase, premium: r?Number(r.premium)||0:0, roles: r?rolesOf(r):[]} }
/* доплати за додаткові ролі (адміністратор, лаборант, методист…) за місяць:
   «за місяць» — фіксована ставка (можна змінити суму для конкретного місяця), «за годину» — ставка × години місяця */
function rolePay(T, email, month){
  const r=rateOf(T,email); const ex=(T.extra||[]).filter(x=>String(x.teacher).toLowerCase()===String(email).toLowerCase()&&x.month===month);
  return r.roles.map(o=>{ const e=ex.find(x=>x.role===o.role)||{}; const hours=e.hours===''||e.hours===undefined?0:Number(e.hours);
    const sum = e.amount!==''&&e.amount!==undefined ? Number(e.amount) : o.type==='hour' ? Math.round(Number(o.rate||0)*hours) : Number(o.rate||0);
    return {role:o.role, type:o.type, rate:Number(o.rate||0), hours, sum, override:e.amount!==''&&e.amount!==undefined, note:e.note||''} });
}
/* оплата вчителю за одне заняття */
function lessonPay(T, l, marks, c){
  c=c||cfgOf(T); const present=Object.values(marks||{}).filter(a=>a.mark==='p'); const revenue=present.reduce((t,a)=>t+Number(a.price||0),0);
  const r=rateOf(T,l.teacher); const prem = c.premiumMode==='revenue' ? revenue*r.premium/100 : r.base*r.premium/100;
  const extra=Math.max(0, present.length-c.bonusFrom); const bonus=extra*c.bonusPer;
  return {present:present.length, revenue, base:r.base, prem:Math.round(prem), bonus, extra, total:Math.round(r.base+prem+bonus)};
}
const isHeld = (l, marks) => !l.cancelled && (l.done || Object.keys(marks||{}).length>0);
function salaries(T, month){
  const [f,t]=monthRange(month), L=lessonsIn(T,f,t), ai=attIndex(T), c=cfgOf(T), out={};
  const mk=e=>out[e]=out[e]||{email:e,lessons:0,present:0,base:0,prem:0,bonus:0,roles:0,roleItems:[],total:0,subs:0,items:[]};
  L.forEach(l=>{ const m=ai[l.id]; if(!isHeld(l,m) || !l.teacher) return; const p=lessonPay(T,l,m,c);
    const o=mk(l.teacher); o.lessons++; o.present+=p.present; o.base+=p.base; o.prem+=p.prem; o.bonus+=p.bonus; o.total+=p.total; if(l.sub) o.subs++; o.items.push({l,p}) });
  (T.rates||[]).forEach(r=>{ const e=String(r.id).toLowerCase(); const rp=rolePay(T,e,month).filter(x=>x.sum>0); if(!rp.length) return; const o=mk(e);
    o.roleItems=rp; o.roles=rp.reduce((t,x)=>t+x.sum,0); o.total+=o.roles });
  return out;
}
function monthReport(T, month){
  const [f,t]=monthRange(month), L=lessonsIn(T,f,t), ai=attIndex(T);
  const paid=(T.pays||[]).filter(p=>monthOf(p.date)===month).reduce((s,p)=>s+Number(p.amount||0),0);
  const att=(T.att||[]).filter(a=>monthOf(a.date)===month); const visits=att.filter(a=>a.mark==='p').length, miss=att.filter(a=>a.mark==='a').length;
  const charged=att.filter(a=>a.mark==='p').reduce((s,a)=>s+Number(a.price||0),0);
  const gp={}; (T.groups||[]).forEach(g=>gp[g.id]=Number(g.price||0)); const discGiven=att.filter(a=>a.mark==='p').reduce((s,a)=>s+Math.max(0,(gp[a.gid]||0)-Number(a.price||0)),0);
  const sal=salaries(T,month); const salary=Object.values(sal).reduce((s,x)=>s+x.total,0);
  const ex=(T.exps||[]).filter(e=>monthOf(e.month||e.date)===month); const expenses=ex.reduce((s,e)=>s+Number(e.amount||0),0);
  const byCat={}; ex.forEach(e=>byCat[e.cat||'Інше']=(byCat[e.cat||'Інше']||0)+Number(e.amount||0));
  const held=L.filter(l=>isHeld(l,ai[l.id])).length, planned=L.filter(l=>!l.cancelled).length, cancelled=L.filter(l=>l.cancelled).length;
  const byGroup=(T.groups||[]).filter(g=>g.status!=='archive').map(g=>{ const a=att.filter(x=>x.gid===g.id); const p=a.filter(x=>x.mark==='p').length;
    return {g, visits:p, marks:a.length, pct:a.length?Math.round(100*p/a.length):null, revenue:a.filter(x=>x.mark==='p').reduce((s,x)=>s+Number(x.price||0),0)} });
  return {month, paid, charged, discGiven, salary, expenses, byCat, visits, miss, attPct: visits+miss?Math.round(100*visits/(visits+miss)):null,
    held, planned, cancelled, byGroup, sal, profitCash: paid-salary-expenses, profitAccr: charged-salary-expenses, exps:ex};
}
/* сума абонемента: ціна уроку × кількість занять групи в місяці (без скасованих) */
function abonement(T, s, month){
  const [f,t]=monthRange(month); const L=lessonsIn(T,f,t).filter(l=>!l.cancelled);
  return groupIds(s).map(gid=>{ const g=(T.groups||[]).find(x=>x.id===gid); if(!g||g.status==='archive') return null; const n=L.filter(l=>l.gid===gid).length;
    const price=lessonPrice(T,g,s), full=Number(g.price||0); return {g, n, full, price, pct:discPct(T,s), sum:n*price, fullSum:n*full} }).filter(Boolean);
}

/* ======================================================================
   СЕРВЕР (prod) або локальна база в браузері (beta)
   ====================================================================== */
async function call(action, payload){
  const {BETA, S} = A(); const body=Object.assign({action}, payload||{});
  if(S.crm) body.crmToken=S.crm.token; else if(S.admin) body.adminToken=S.adminToken; else if(S.user){ body.email=S.user.email; body.token=S.token }
  if(BETA) return Local.handle(action, body);
  try{ return await A().callApi(body) }
  catch(e){ if(/Сесія .*застаріла/.test(e.message)){ A().toast(e.message); A().signOut() } throw e }
}
const Local = {
  key(b){ return A().KEY+'crm_'+b },
  load(b){ return A().LS.get(this.key(b), null) },
  save(b,d){ try{ localStorage.setItem(this.key(b), JSON.stringify(d)) }catch(e){ throw new Error('У браузері забракло місця для даних беты.') } },
  empty(){ return {students:[],groups:[],lessons:[],att:[],pays:[],exps:[],rates:[],extra:[],cfg:[]} },
  creds(){ const {LS,KEY,CFG}=A(); const o=Object.assign({}, CFG.BRANCH_ADMINS||{}); const ov=LS.get(KEY+'bcred',{}); Object.keys(ov).forEach(b=>o[b]=ov[b]); return o },
  users(){ return A().LS.get(A().KEY+'users',{}) },
  teachers(b){ const u=this.users(); return Object.keys(u).map(e=>u[e].profile).filter(p=>p.branch===b).map(p=>({fio:p.fio,email:p.email,phone:p.phone,branch:p.branch,registered:p.registered,lastLogin:''})) },
  data(b){ let d=this.load(b); if(!d){ d=demoData(b, this.teachers(b)); this.save(b,d) } if(!d.extra) d.extra=[]; return d },
  handle(action, r){
    const {S,LS,KEY}=A();
    switch(action){
      case 'branchLogin': { const c=this.creds(); const b=Object.keys(c).find(x=>c[x].login===String(r.login).trim().toLowerCase()&&c[x].hash===r.hash);
        if(!b) throw new Error('Невірний логін або пароль адміністратора філії.'); return {token:'beta-crm', branch:b, login:c[b].login} }
      case 'crmData': { const b=S.crm.branch, d=this.data(b); const t=this.teachers(b);
        const prog=[]; t.forEach(x=>{ const best=LS.get(KEY+'progress_'+x.email,{}); Object.values(best).forEach(c=>Object.values(c).forEach(rec=>prog.push(Object.assign({email:x.email},rec)))) });
        return {branch:b, tables:d, teachers:t, progress:prog} }
      case 'crmSave': { const b=S.crm.branch, d=this.data(b); const rows=Array.isArray(r.rows)?r.rows:[r.row];
        rows.forEach(row=>{ row=Object.assign({},row); if(!row.id) row.id=r.table.slice(0,1)+Math.random().toString(36).slice(2,10);
          if(r.table==='students'){ if(!String(row.child||'').trim()||!String(row.parent||'').trim()||!normPhone(row.phone)) throw new Error('Для учня обов’язкові: ПІБ дитини, ПІБ одного з батьків і телефон.'); if(!row.created) row.created=new Date().toISOString() }
          if(r.table==='att'){ const g=d.groups.find(x=>x.id===row.gid); row.price=row.mark==='p'?lessonPrice(d,g,d.students.find(x=>x.id===row.sid)):0; row.by=row.by||'адміністратор'; row.at=new Date().toISOString() }
          if(r.table==='pays'||r.table==='exps'){ row.amount=Number(row.amount)||0; row.by='адміністратор' }
          if(r.table==='pays'&&!row.no){ const same=d.pays.find(x=>x.id===row.id); row.no=same&&same.no?same.no:d.pays.reduce((mx,x)=>Math.max(mx,Number(x.no)||0),0)+1 }
          if(r.table==='extra'){ row.hours=row.hours===''||row.hours==null?'':Number(row.hours); row.amount=row.amount===''||row.amount==null?'':Number(row.amount) }
          row.branch=b; const i=d[r.table].findIndex(x=>x.id===row.id); if(i>=0) d[r.table][i]=row; else d[r.table].push(row) });
        this.save(b,d); return {tables:d} }
      case 'crmDelete': { const b=S.crm.branch, d=this.data(b); const ids=Array.isArray(r.ids)?r.ids:[r.id]; d[r.table]=d[r.table].filter(x=>ids.indexOf(x.id)<0); this.save(b,d); return {tables:d} }
      case 'teacherData': return {branch:S.user.branch, tables:this.scope(S.user)};
      case 'teacherMark': { const u=S.user, b=u.branch, d=this.data(b), sc=this.scope(u), g=sc.groups.find(x=>x.id===r.gid); if(!g) throw new Error('Це не ваша група.');
        const lid=r.gid+'|'+r.date+'|'+r.time, les=d.lessons.find(l=>l.id===lid)||{}; if(String(les.sub||g.teacher).toLowerCase()!==u.email) throw new Error('Це заняття веде інший учитель (заміна).');
        if(les.status==='cancelled') throw new Error('Заняття скасовано адміністратором.'); if(r.date>today()) throw new Error('Майбутнє заняття ще не можна відмітити.');
        Object.keys(r.marks||{}).forEach(sid=>{ const m=r.marks[sid]; const i=d.att.findIndex(a=>a.lid===lid&&a.sid===sid);
          if(!m){ if(i>=0) d.att.splice(i,1); return }
          const row={id:i>=0?d.att[i].id:uid('a'),branch:b,lid,gid:g.id,date:r.date,sid,mark:m,price:m==='p'?lessonPrice(d,g,d.students.find(x=>x.id===sid)):0,by:u.email,at:new Date().toISOString()};
          if(i>=0) d.att[i]=row; else d.att.push(row) });
        const row=Object.assign({},les,{id:lid,branch:b,gid:g.id,date:r.date,time:r.time,done:'так',note:r.note||les.note||'',by:u.email,at:new Date().toISOString()});
        const li=d.lessons.findIndex(l=>l.id===lid); if(li>=0) d.lessons[li]=row; else d.lessons.push(row); this.save(b,d); return {tables:this.scope(u)} }
      case 'mBranchAdmins': { const c=this.creds(); return {admins:A().CFG.BRANCHES.map(b=>({branch:b,login:(c[b]||{}).login||''}))} }
      case 'mSetBranchAdmin': { const c=this.creds(); const login=String(r.login).trim().toLowerCase(); if(!/^[a-z0-9._-]{3,30}$/.test(login)) throw new Error('Логін: 3–30 латинських літер або цифр.');
        if(Object.keys(c).some(x=>x!==r.branch&&c[x].login===login)) throw new Error('Такий логін уже має інша філія.');
        const ov=LS.get(KEY+'bcred',{}); ov[r.branch]={login,hash:r.hash}; LS.set(KEY+'bcred',ov); return this.handle('mBranchAdmins',{}) }
      case 'mDeleteTeacher': { const u=this.users(); delete u[r.email]; LS.set(KEY+'users',u); LS.del(KEY+'progress_'+r.email); return {deleted:r.email} }
      case 'mCrmSummary': { const m=curMonth(); return {month:m, branches:A().CFG.BRANCHES.map(b=>{ const d=this.load(b)||this.empty(); const bal=balances(d); const act=d.students.filter(s=>s.status!=='archive');
        return {branch:b, students:act.length, groups:d.groups.filter(g=>g.status!=='archive').length, teachers:this.teachers(b).length, debtors:act.filter(s=>(bal[s.id]||0)<0).length,
          debt:act.reduce((t,s)=>t+Math.min(0,bal[s.id]||0),0), paid:d.pays.filter(p=>monthOf(p.date)===m).reduce((t,p)=>t+Number(p.amount||0),0),
          expenses:d.exps.filter(e=>monthOf(e.month||e.date)===m).reduce((t,e)=>t+Number(e.amount||0),0), visits:d.att.filter(a=>a.mark==='p'&&monthOf(a.date)===m).length} })} }
    }
    throw new Error('Невідома дія');
  },
  scope(u){ const d=this.data(u.branch), me=u.email; const subG={}; d.lessons.forEach(l=>{ if(String(l.sub).toLowerCase()===me) subG[l.gid]=1 });
    const groups=d.groups.filter(g=>String(g.teacher).toLowerCase()===me||subG[g.id]); const gids={}; groups.forEach(g=>gids[g.id]=1);
    return {groups, students:d.students.filter(s=>groupIds(s).some(x=>gids[x])||d.att.some(a=>gids[a.gid]&&a.sid===s.id)).map(s=>({id:s.id,child:s.child,groups:s.groups,status:s.status})),
      lessons:d.lessons.filter(l=>gids[l.gid]), att:d.att.filter(a=>gids[a.gid]), rates:d.rates.filter(x=>String(x.id).toLowerCase()===me), extra:(d.extra||[]).filter(x=>String(x.teacher).toLowerCase()===me), cfg:d.cfg} }
};
/* демо-дані для бети: 3 групи, 12 учнів, оплати, відвідування з початку місяця */
function demoData(branch, teachers){
  const d=Local.empty(); const t0=(teachers[0]||{}).email||'', t1=(teachers[1]||teachers[0]||{}).email||'';
  const m=curMonth(), [f]=monthRange(m), td=today();
  d.groups=[
    {id:'gls1',name:'LEGO Start · молодша',cid:'lego-start',teacher:t0,slots:JSON.stringify([{d:1,t:'16:30',m:60},{d:3,t:'16:30',m:60}]),price:220,start:shiftMonth(m,-1)+'-01',end:'',room:'Аудиторія 1',status:''},
    {id:'gard',name:'Arduino AI · 12+',cid:'arduino',teacher:t1,slots:JSON.stringify([{d:2,t:'17:00',m:90},{d:4,t:'17:00',m:90}]),price:280,start:shiftMonth(m,-1)+'-01',end:'',room:'Аудиторія 2',status:''},
    {id:'gscr',name:'Scratch · субота',cid:'scratch',teacher:t0,slots:JSON.stringify([{d:6,t:'10:00',m:90}]),price:250,start:shiftMonth(m,-1)+'-01',end:'',room:'Комп’ютерний клас',status:''}];
  const kids=[['Бондаренко Мирослава','2018-03-14','Бондаренко Ірина','+380671112233','gls1'],['Ткаченко Марк','2017-11-02','Ткаченко Олег','+380501234567','gls1'],
    ['Мельник Софія','2018-07-21','Мельник Оксана','+380631239876','gls1'],['Шевченко Тимофій','2017-05-30','Шевченко Анна','+380992223344','gls1,gscr'],
    ['Коваленко Артем','2012-09-09','Коваленко Сергій','+380673334455','gard'],['Олійник Дарина','2013-01-17','Олійник Марина','+380504445566','gard'],
    ['Кравчук Богдан','2012-04-05','Кравчук Віктор','+380635556677','gard'],['Лисенко Злата','2013-12-12','Лисенко Тетяна','+380966667788','gard'],
    ['Поліщук Максим','2015-02-28','Поліщук Юлія','+380677778899','gscr'],['Гончар Єва','2014-06-16','Гончар Дмитро','+380508889900','gscr'],
    ['Руденко Назар','2015-10-10','Руденко Олена','+380639990011','gscr'],['Савченко Кіра','2014-08-08','Савченко Ігор','+380991110022','gscr,gard']];
  d.students=kids.map((k,i)=>({id:'s'+(i+1),branch,child:k[0],birth:k[1],parent:k[2],phone:k[3],phone2:'',groups:k[4],status:'',note:'',created:f,
    disc: k[4].includes(',') ? JSON.stringify([{id:'d2c',name:'Відвідує два або більше курсів',pct:10}]) : i===6 ? JSON.stringify([{id:'dmil',name:'Військові пільги',pct:20}]) : ''}));
  const L=lessonsIn(d, shiftMonth(m,-1)+'-01', addDays(td,-1)); let seed=7; const rnd=()=>{ seed=(seed*9301+49297)%233280; return seed/233280 };
  L.forEach(l=>{ d.students.filter(s=>groupIds(s).includes(l.gid)).forEach(s=>{ const p=rnd()>0.13; d.att.push({id:uid('a'),branch,lid:l.id,gid:l.gid,date:l.date,sid:s.id,mark:p?'p':'a',price:p?lessonPrice(d,l.g,s):0,by:l.teacher||'адміністратор',at:l.date}) });
    d.lessons.push({id:l.id,branch,gid:l.gid,date:l.date,time:l.time,sub:'',status:'',done:'так',note:'',by:l.teacher,at:l.date}) });
  d.students.forEach((s,i)=>{ const prev=shiftMonth(m,-1); [prev,m].forEach((mm,k)=>{ if(k===1&&i%4===3) return; const sum=abonement(d,s,mm).reduce((t,x)=>t+x.sum,0); if(sum) d.pays.push({id:uid('p'),branch,date:mm+'-0'+(2+i%5),sid:s.id,amount:i%5===4?Math.round(sum*0.6):sum,month:mm,method:PAY_METHODS[i%2],note:'абонемент',by:'адміністратор',payer:s.parent,no:d.pays.length+1}) }) });
  d.exps=[{id:uid('e'),branch,date:f,month:m,cat:'Оренда',amount:12000,note:'оренда приміщення',by:'адміністратор'},{id:uid('e'),branch,date:f,month:m,cat:'Закупівлі (обладнання, набори)',amount:3500,note:'датчики Arduino',by:'адміністратор'},
    {id:uid('e'),branch,date:shiftMonth(m,-1)+'-01',month:shiftMonth(m,-1),cat:'Оренда',amount:12000,note:'оренда приміщення',by:'адміністратор'}];
  d.cfg=[{id:'cashier',branch,value:'Адміністратор філії'},{id:'bonusFrom',branch,value:5},{id:'bonusPer',branch,value:25},{id:'defaultBase',branch,value:300},{id:'premiumMode',branch,value:'rate'}];
  if(t0) d.rates.push({id:t0,branch,base:300,premium:10,note:'преміум',roles:JSON.stringify([{role:'Методист',type:'month',rate:2500}])});
  if(t1&&t1!==t0) d.rates.push({id:t1,branch,base:300,premium:0,note:'',roles:JSON.stringify([{role:'Лаборант',type:'hour',rate:120}])});
  if(t1&&t1!==t0) d.extra.push({id:t1+'|'+m+'|Лаборант',branch,teacher:t1,month:m,role:'Лаборант',hours:16,amount:'',note:'підготовка наборів'});
  return d;
}

/* ======================================================================
   СПІЛЬНІ ЕЛЕМЕНТИ ІНТЕРФЕЙСУ
   ====================================================================== */
function modal(title, body, onOk, okText){
  const w=document.createElement('div'); w.className='mdl-wrap';
  w.innerHTML=`<div class="mdl card" role="dialog" aria-modal="true"><div class="row" style="margin-bottom:10px"><h2 style="margin:0" class="grow">${esc(title)}</h2><button class="btn sm ghost" data-x>✕</button></div>
    <form class="mdl-f">${body}<div class="err" id="m-err"></div><div class="row" style="margin-top:14px"><span class="grow"></span><button type="button" class="btn ghost" data-x>${onOk?'Скасувати':'Закрити'}</button>${onOk?`<button class="btn" type="submit">${esc(okText||'Зберегти')}</button>`:''}</div></form></div>`;
  document.body.appendChild(w);
  const close=()=>w.remove(); $$('[data-x]',w).forEach(b=>b.onclick=close); w.onclick=e=>{ if(e.target===w) close() };
  const f=$('.mdl-f',w); f.onsubmit=async e=>{ e.preventDefault(); if(!onOk) return close(); const btn=$('button[type=submit]',f); btn.disabled=true; $('#m-err',w).textContent='';
    try{ const r=await onOk(Object.fromEntries(new FormData(f).entries()), f); if(r!==false) close() }catch(ex){ $('#m-err',w).textContent=ex.message||'Помилка'; btn.disabled=false } };
  const first=$('input,select,textarea',f); if(first) setTimeout(()=>first.focus(),30);
  return w;
}
const bal = n => n<0?`<span class="pill bad">Борг ${UAH(-n)}</span>`:n>0?`<span class="pill good">Баланс ${UAH(n)}</span>`:`<span class="pill">0 грн</span>`;
const avatar = (txt,id) => `<span class="ava" style="background:${colorOf(id)}">${esc(initials(txt))}</span>`;
function monthNav(m, base){ return `<div class="row mnav"><a class="btn sm ghost" href="${base}/${shiftMonth(m,-1)}">‹</a><b style="min-width:140px;text-align:center">${monthTitle(m)}</b><a class="btn sm ghost" href="${base}/${shiftMonth(m,1)}">›</a>${m!==curMonth()?`<a class="btn sm ghost" href="${base}/${curMonth()}">Поточний</a>`:''}</div>` }
function kpi(label, value, sub, tone){ return `<div class="card kpi"><div class="l">${esc(label)}</div><div class="v" ${tone?`style="color:var(--${tone})"`:''}>${value}</div>${sub?`<div class="tiny">${sub}</div>`:''}</div>` }
function courseTitle(cid){ const c=A().COURSES.find(x=>x.id===cid); return c?c.title:(cid||'—') }
function courseColor(cid){ const c=A().COURSES.find(x=>x.id===cid); return c?c.color:'#7C87A8' }
function csv(name, rows){ const s='﻿'+rows.map(r=>r.map(x=>{ x=String(x==null?'':x); return /[";\n]/.test(x)?'"'+x.replace(/"/g,'""')+'"':x }).join(';')).join('\n');
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([s],{type:'text/csv;charset=utf-8'})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000) }


/* ======================================================================
   EXCEL (.xlsx) БЕЗ ЗОВНІШНІХ БІБЛІОТЕК: мінімальний XLSX у ZIP без стиснення
   ====================================================================== */
const CRC_T=(()=>{ const t=new Uint32Array(256); for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; t[n]=c>>>0 } return t })();
function crc32(u8){ let c=0xFFFFFFFF; for(let i=0;i<u8.length;i++) c=CRC_T[(c^u8[i])&255]^(c>>>8); return (c^0xFFFFFFFF)>>>0 }
function zip(files){   // files: [{name, data:string}]
  const enc=new TextEncoder(), parts=[], central=[]; let off=0;
  const u16=n=>[n&255,(n>>8)&255], u32=n=>[n&255,(n>>8)&255,(n>>16)&255,(n>>>24)&255];
  files.forEach(f=>{ const name=enc.encode(f.name), data=enc.encode(f.data), crc=crc32(data);
    const head=new Uint8Array([0x50,0x4b,3,4,...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0)]);
    parts.push(head,name,data);
    central.push(new Uint8Array([0x50,0x4b,1,2,...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),name);
    off+=head.length+name.length+data.length });
  const csize=central.reduce((t,x)=>t+x.length,0);
  const end=new Uint8Array([0x50,0x4b,5,6,...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(csize),...u32(off),...u16(0)]);
  return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
/* sheets: [{name, cols:[ширини], rows:[[значення…]], header:1, money:[індекси колонок]}] */
function xlsx(filename, sheets){
  const x=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
  const colL=i=>{ let s=''; i++; while(i){ const m=(i-1)%26; s=String.fromCharCode(65+m)+s; i=Math.floor((i-1)/26) } return s };
  const sheetXml=sh=>{ const rows=sh.rows.map((r,ri)=>`<row r="${ri+1}">`+r.map((v,ci)=>{ const ref=colL(ci)+(ri+1); const head=ri<(sh.header||0);
      if(typeof v==='number'&&isFinite(v)) return `<c r="${ref}" s="${head?1:(sh.money||[]).includes(ci)?(v<0?4:2):3}"><v>${v}</v></c>`;
      if(v===''||v==null) return head?`<c r="${ref}" s="1"/>`:'';
      return `<c r="${ref}" t="inlineStr" s="${head?1:(sh.bold&&sh.bold(ri)?1:0)}"><is><t xml:space="preserve">${x(v)}</t></is></c>` }).join('')+'</row>').join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">${sh.header?`<pane ySplit="${sh.header}" xSplit="${sh.freezeCols||0}" topLeftCell="${colL(sh.freezeCols||0)}${sh.header+1}" activePane="bottomRight" state="frozen"/>`:''}</sheetView></sheetViews><cols>${(sh.cols||[]).map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData>${sh.header?`<autoFilter ref="A${sh.header}:${colL(Math.max(0,(sh.rows[sh.header-1]||[]).length-1))}${sh.rows.length}"/>`:''}</worksheet>` };
  const files=[
    {name:'[Content_Types].xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`},
    {name:'_rels/.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sh,i)=>`<sheet name="${x(sh.name.slice(0,31))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets>${sheets.some(sh=>sh.header)?`<definedNames>${sheets.map((sh,i)=>sh.header?`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${x(sh.name.slice(0,31))}'!$A$${sh.header}:$${colL(Math.max(0,(sh.rows[sh.header-1]||[]).length-1))}$${sh.rows.length}</definedName>`:'').join('')}</definedNames>`:''}</workbook>`},
    {name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:'xl/styles.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0 &quot;грн&quot;"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FFC8352B"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEFF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFDCE4F7"/></left><right style="thin"><color rgb="FFDCE4F7"/></right><top style="thin"><color rgb="FFDCE4F7"/></top><bottom style="thin"><color rgb="FFDCE4F7"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment wrapText="1" vertical="center"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="164" fontId="2" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`}
  ].concat(sheets.map((sh,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,data:sheetXml(sh)})));
  const a=document.createElement('a'); a.href=URL.createObjectURL(zip(files)); a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),3000);
}
function exportStudents(){
  const T=D.tables, m2=curMonth(), y=Number(m2.slice(0,4)), mm=Number(m2.slice(5));
  const def1=(mm>=9?y:y-1)+'-09';   // з початку навчального року
  modal('Експорт в Excel',`<p class="small muted">Таблиця всіх учнів, що навчаються: батьки й телефон, групи, знижка, оплати за кожен місяць, сплачено й списано за весь час, баланс (борг або залишок). Другий аркуш — усі платежі за період.</p>
    <div class="grid g2" style="gap:10px"><div class="field"><label>Місяці з</label><input class="input" name="from" type="month" required value="${def1}"></div><div class="field"><label>по</label><input class="input" name="to" type="month" required value="${m2}"></div></div>
    <label class="row small" style="gap:6px"><input type="checkbox" name="arch"> додати учнів з архіву, які мають борг або залишок</label>`, x=>{
    if(x.from>x.to) throw new Error('Початковий місяць пізніше за кінцевий.');
    const months=[]; for(let m=x.from;m<=x.to;m=shiftMonth(m,1)) months.push(m); if(months.length>36) throw new Error('Не більше 36 місяців за раз.');
    const b=balances(T), list=T.students.filter(s=>s.status!=='archive'||(x.arch&&(b[s.id]||0)!==0)).sort((p,q)=>p.child.localeCompare(q.child,'uk'));
    const head=['№','Учень','Дата народження','Батьки','Телефон','Групи','Знижка, %'].concat(months.map(monthTitle),['Сплачено за період','Сплачено всього','Списано за уроки (всього)','Відвідувань (всього)','Баланс','Стан','Статус']);
    const rows=list.map((s,i)=>{ const pays=T.pays.filter(p=>p.sid===s.id), att=T.att.filter(a=>a.sid===s.id&&a.mark==='p');
      const per=months.map(m=>pays.filter(p=>(p.month||monthOf(p.date))===m).reduce((t,p)=>t+Number(p.amount||0),0));
      const bl=b[s.id]||0;
      return [i+1,s.child,s.birth?s.birth.split('-').reverse().join('.'):'',s.parent,fmtPhone(s.phone),groupIds(s).map(gname).join(', '),discPct(T,s)||''].concat(per,[per.reduce((t,v)=>t+v,0),pays.reduce((t,p)=>t+Number(p.amount||0),0),att.reduce((t,a)=>t+Number(a.price||0),0),att.length,bl,bl<0?'Борг '+(-bl)+' грн':bl>0?'Залишок '+bl+' грн':'Розраховано',s.status==='archive'?'Архів':'Навчається']) });
    const n0=7, money=months.map((_,k)=>n0+k).concat([n0+months.length,n0+months.length+1,n0+months.length+2,n0+months.length+4]);
    const tot=['','Разом','','','','',''].concat(months.map((_,k)=>rows.reduce((t,r)=>t+r[n0+k],0)),[rows.reduce((t,r)=>t+r[n0+months.length],0),rows.reduce((t,r)=>t+r[n0+months.length+1],0),rows.reduce((t,r)=>t+r[n0+months.length+2],0),rows.reduce((t,r)=>t+r[n0+months.length+3],0),rows.reduce((t,r)=>t+r[n0+months.length+4],0),'','']);
    const pays=T.pays.filter(p=>{ const m=p.month||monthOf(p.date); return m>=x.from&&m<=x.to }).sort((p,q)=>String(p.date).localeCompare(q.date));
    xlsx(`uchni_oplaty_${D.branch.replace(/[^\wА-Яа-яІіЇїЄєҐґ]+/g,'_')}_${x.from}_${x.to}.xlsx`,[
      {name:'Учні й оплати', header:1, freezeCols:2, cols:[5,28,12,24,18,28,9].concat(months.map(()=>13),[14,14,15,11,13,20,11]), money, rows:[head].concat(rows,[tot]), bold:ri=>ri===rows.length+1},
      {name:'Платежі', header:1, cols:[9,12,28,26,14,16,18,26], money:[4], rows:[['№ квит.','Дата','Учень','Платник','Сума','За місяць','Спосіб','Коментар']].concat(pays.map(p=>[p.no||'',p.date,sname(p.sid),p.payer||'',Number(p.amount||0),monthTitle(p.month||monthOf(p.date)),p.method||'',p.note||'']))}
    ]);
    A().toast('Файл Excel сформовано');
  }, 'Завантажити .xlsx');
}

/* ======================================================================
   КВИТАНЦІЯ: прибутковий касовий ордер + квитанція до нього
   ====================================================================== */
function sumWords(n){
  const ones=[['','один','два','три','чотири','п’ять','шість','сім','вісім','дев’ять'],['','одна','дві','три','чотири','п’ять','шість','сім','вісім','дев’ять']];
  const teens=['десять','одинадцять','дванадцять','тринадцять','чотирнадцять','п’ятнадцять','шістнадцять','сімнадцять','вісімнадцять','дев’ятнадцять'];
  const tens=['','','двадцять','тридцять','сорок','п’ятдесят','шістдесят','сімдесят','вісімдесят','дев’яносто'];
  const hund=['','сто','двісті','триста','чотириста','п’ятсот','шістсот','сімсот','вісімсот','дев’ятсот'];
  const form=(n,f)=>{ const a=n%100, b=n%10; return a>10&&a<20?f[2]:b===1?f[0]:b>=2&&b<=4?f[1]:f[2] };
  const tri=(n,fem)=>{ const w=[]; w.push(hund[Math.floor(n/100)]); const r=n%100; if(r>=10&&r<20) w.push(teens[r-10]); else { w.push(tens[Math.floor(r/10)]); w.push(ones[fem?1:0][r%10]) } return w.filter(Boolean).join(' ') };
  const grn=Math.floor(Math.abs(n)), kop=Math.round((Math.abs(n)-grn)*100);
  const parts=[]; const mln=Math.floor(grn/1e6), th=Math.floor(grn%1e6/1000), rest=grn%1000;
  if(mln) parts.push(tri(mln,false)+' '+form(mln,['мільйон','мільйони','мільйонів']));
  if(th) parts.push(tri(th,true)+' '+form(th,['тисяча','тисячі','тисяч']));
  if(rest||!grn) parts.push(grn?tri(rest,true):'нуль');
  return parts.join(' ')+' '+form(grn,['гривня','гривні','гривень'])+' '+String(kop).padStart(2,'0')+' '+form(kop,['копійка','копійки','копійок']);
}
function receiptHtml(p){
  const T=D.tables, c=cfgOf(T), st=T.students.find(x=>x.id===p.sid)||{child:'',groups:''}, dt=String(p.date||today()).split('-').reverse().join('.');
  const amt=Number(p.amount||0), grn=Math.floor(amt), kop=String(Math.round((amt-grn)*100)).padStart(2,'0');
  const gl=groupIds(st).map(gname).join(', '); const what=`${p.basisDebt?'оплата боргу за абонемент':'оплата за абонемент'}${gl?' «'+gl+'»':''} за ${monthTitle(p.month||monthOf(p.date)).toLowerCase()}`;
  const no=(c.receiptPrefix?c.receiptPrefix+'/':'')+(p.no||'—'), who=p.payer||st.parent||st.child, child=st.child&&p.payer&&p.payer!==st.child?` (за учня: ${st.child})`:'';
  const e=esc;
  return `<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>Квитанція № ${e(no)}</title><style>
  @page{size:A4 landscape;margin:10mm}body{font-family:"Times New Roman",Times,serif;font-size:12px;color:#000;margin:0;padding:10px}
  .wrap{display:grid;grid-template-columns:1.55fr 1fr;border:1px solid #000}.l,.r{padding:14px 14px 18px}.l{border-right:2px solid #000}
  .ln{border-bottom:1px solid #000;font-weight:bold;min-height:16px;padding:1px 2px}.cap{font-size:9px;text-align:center;color:#333;margin-bottom:6px}
  .c{text-align:center}.b{font-weight:bold}table{border-collapse:collapse}td,th{border:1px solid #000;padding:3px 5px}
  .row{display:grid;grid-template-columns:110px 1fr;gap:6px;align-items:end;margin:8px 0}.h{font-family:Arial,sans-serif;font-weight:bold;font-size:15px}
  .sig{display:grid;grid-template-columns:90px 110px 1fr;gap:10px;align-items:end;margin-top:34px}.it{font-style:italic}
  @media print{.np{display:none}}</style></head><body>
  <div class="wrap"><div class="l">
    <div style="display:grid;grid-template-columns:1fr 130px;gap:20px"><div><div class="ln c" style="font-size:14px">${e(c.orgName)}</div><div class="cap">організація</div><div class="ln c it" style="font-size:14px">${e(c.unit||D.branch)}</div><div class="cap">структурний підрозділ</div></div>
      <table style="height:70px"><tr><td class="c" style="font-family:Arial;font-size:10px">Код за ЄДРПОУ</td></tr><tr><td class="c b">${e(c.edrpou||'')}&nbsp;</td></tr></table></div>
    <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;margin:14px 0"><div class="h c">ПРИБУТКОВИЙ КАСОВИЙ ОРДЕР</div>
      <table><tr><th style="font-family:Arial;font-size:10px;font-weight:normal">Номер<br>документа</th><th style="font-family:Arial;font-size:10px;font-weight:normal">Дата<br>складання</th></tr><tr><td class="c b">${e(no)}</td><td class="c b">${e(dt)}</td></tr></table></div>
    <table style="width:100%"><tr style="font-family:Arial;font-size:10px"><td class="c" style="width:60%">Товар або послуга</td><td class="c">Кількість</td><td class="c">Ціна грн.</td><td class="c">Всього грн.</td></tr>
      <tr><td class="b">${e(what)}</td><td class="c b">1</td><td class="c b">${amt.toFixed(2)}</td><td class="c b">${amt.toFixed(2)}</td></tr></table>
    <div class="row"><span>Прийнято від</span><span class="ln">${e(who)}${e(child)}</span></div>
    <div class="row"><span>Деталі операції:</span><span class="ln">${e(what)}${p.method?', '+e(p.method.toLowerCase()):''}</span></div>
    <div class="row"><span>Сума</span><span class="ln">${e(sumWords(amt))}</span></div><div class="cap">прописом</div>
    <div class="row"><span>В тому числі</span><span class="ln">без ПДВ</span></div>
    <div class="sig"><span>Одержав (ла)</span><span class="ln">&nbsp;</span><span class="ln c">${e(c.cashier||'')}</span></div><div class="sig" style="margin-top:0"><span></span><span class="cap">підпис</span><span class="cap">розшифровка підпису</span></div>
  </div><div class="r">
    <div class="ln c" style="font-size:14px">${e(c.orgName)} ${e(c.unit||D.branch)}</div><div class="cap">організація</div>
    <div class="h c" style="margin:10px 0 6px">КВИТАНЦІЯ</div><div class="c">до прибуткового касового ордеру № <span class="ln" style="display:inline-block;min-width:80px">${e(no)}</span></div>
    <div class="c" style="margin-top:6px">від <span class="ln" style="display:inline-block;min-width:120px">${e(dt)}</span></div>
    <div class="row" style="margin-top:22px"><span>Прийнято від</span><span class="ln">${e(who)}${e(child)}</span></div>
    <div class="row"><span>Підстава</span><span class="ln">${e(what)}</span></div>
    <div class="row" style="grid-template-columns:110px 1fr auto 1fr auto;margin-top:22px"><span>Сума</span><span class="ln c">${grn}</span><span>грн.</span><span class="ln c">${kop}</span><span>коп.</span></div><div class="cap">цифрами</div>
    <div class="ln">${e(sumWords(amt))}</div><div class="cap">прописом</div>
    <div class="row"><span>В тому числі</span><span class="ln">без ПДВ</span></div>
    <div style="margin-top:26px">М.П. (штампу)</div>
    <div class="sig" style="grid-template-columns:80px 90px 1fr"><span>Одержав (ла)</span><span class="ln">&nbsp;</span><span class="ln c">${e(c.cashier||'')}</span></div><div class="sig" style="margin-top:0;grid-template-columns:80px 90px 1fr"><span></span><span class="cap">підпис</span><span class="cap">розшифровка підпису</span></div>
  </div></div></body></html>`;
}
function showReceipt(p){
  const w=modal('Квитанція № '+((cfgOf(D.tables).receiptPrefix?cfgOf(D.tables).receiptPrefix+'/':'')+(p.no||'')), `<iframe id="rcpt" style="width:100%;height:470px;border:1px solid var(--line);border-radius:12px;background:#fff"></iframe>
    <p class="tiny muted">Квитанцію можна надрукувати чи зберегти в PDF зараз або пізніше — кнопка 🧾 біля платежу.</p>
    <div class="row"><button type="button" class="btn" id="rprint">🖨 Роздрукувати</button></div>`, null);
  const f=$('#rcpt',w); f.srcdoc=receiptHtml(p); $('.mdl',w).style.maxWidth='1000px';
  $('#rprint',w).onclick=()=>{ try{ f.contentWindow.focus(); f.contentWindow.print() }catch(e){ const x=window.open('','_blank'); x.document.write(receiptHtml(p)); x.document.close(); x.print() } };
}
/* ======================================================================
   АДМІНІСТРАТОР ФІЛІЇ — оболонка й дані
   ====================================================================== */
let D=null;   // {branch, tables, teachers, progress}
async function load(force){ if(D && !force) return D; const j=await call('crmData'); D={branch:j.branch, tables:j.tables, teachers:j.teachers||[], progress:j.progress||[]}; return D }
async function save(table, rowOrRows){ const j=await call('crmSave', Array.isArray(rowOrRows)?{table,rows:rowOrRows}:{table,row:rowOrRows}); D.tables=j.tables; return D }
async function del(table, ids){ const j=await call('crmDelete', {table, ids:[].concat(ids)}); D.tables=j.tables; return D }
const tname = email => { if(!email) return 'не призначено'; const t=(D&&D.teachers||[]).find(x=>x.email===String(email).toLowerCase()); return t?t.fio:email };
const sname = id => { const s=D.tables.students.find(x=>x.id===id); return s?s.child:'(видалений учень)' };
const gname = id => { const g=D.tables.groups.find(x=>x.id===id); return g?g.name:'(видалена група)' };

const NAV = [['home','Сьогодні','home'],['students','Учні','user'],['groups','Групи й розклад','courses'],['attendance','Відвідування','test'],['payments','Оплати й борги','book'],['teachers','Учителі й зарплата','method'],['finance','Фінансовий звіт','chart'],['settings','Налаштування','edit']];
function crmShell(active, inner){
  const {S,I,BETA}=A();
  const debt = D ? (()=>{ const b=balances(D.tables); return D.tables.students.filter(s=>s.status!=='archive'&&(b[s.id]||0)<0).length })() : 0;
  $('#root').innerHTML=`<div class="app crm">
    <aside class="side noprint" id="side">
      <div class="brandrow"><img class="logo" src="assets/logo.png" alt="Robot School"><span class="sysname">CRM</span></div>
      <div class="tiny" style="margin:4px 10px 8px;font-weight:800;letter-spacing:.06em;text-transform:uppercase">Філія · ${esc(S.crm.branch)}</div>
      ${NAV.map(([k,l,ic])=>`<a class="nav ${active===k?'on':''}" href="#/crm/${k}">${I[ic]}${esc(l)}${k==='payments'&&debt?`<span class="cnt" style="background:var(--red);color:#fff">${debt}</span>`:''}</a>`).join('')}
      <div class="me"><b>Адміністратор філії</b><span class="tiny">${esc(S.crm.branch)} · логін ${esc(S.crm.login)}</span>
        <div class="row" style="margin-top:10px;gap:6px"><button class="btn sm ghost" id="logout">${I.out.replace('<svg','<svg width="16" height="16"')}Вийти</button><button class="btn sm ghost" id="theme">${I.theme.replace('width="20" height="20"','width="16" height="16"')}</button></div></div>
    </aside>
    <main class="main"><div class="top noprint"><button class="btn sm ghost burger" id="burger">${I.menu}</button><span class="grow"></span><span class="mode-chip" style="background:var(--good-soft);color:var(--good)">АДМІНІСТРАТОР ФІЛІЇ</span>${BETA?'<span class="mode-chip">БЕТА · дані лише локально</span>':''}</div>
    <div id="view">${inner}</div></main></div>`;
  $('#logout').onclick=A().signOut;
  $('#theme').onclick=()=>{ const r=document.documentElement; const cur=r.getAttribute('data-theme'); const dark=cur?cur==='dark':matchMedia('(prefers-color-scheme: dark)').matches; r.setAttribute('data-theme',dark?'light':'dark'); A().LS.set('rsa_theme',dark?'light':'dark') };
  $('#burger').onclick=()=>{ $('#side').classList.toggle('open') };
  window.scrollTo(0,0);
}
async function route(p){
  const v=p[0]||'home'; $$('.mdl-wrap').forEach(x=>x.remove());
  try{ if(!D) { crmShell(v,'<div class="card"><p class="muted">Завантаження даних філії…</p></div>'); await load() } }
  catch(e){ return crmShell(v,`<div class="callout bad"><b>Не вдалося завантажити дані</b><p>${esc(e.message)}</p></div>`) }
  const views={home:vHome, students:vStudents, student:vStudent, groups:vGroups, attendance:vAttendance, payments:vPayments, teachers:vTeachers, finance:vFinance, settings:vSettings};
  (views[v]||vHome)(p.slice(1));
}
const reroute = () => A().route();

/* ---------- Сьогодні ---------- */
function vHome(){
  const T=D.tables, td=today(), m=curMonth(), R=monthReport(T,m), ai=attIndex(T), b=balances(T);
  const L=lessonsIn(T,td,addDays(td,6));
  const act=T.students.filter(s=>s.status!=='archive'); const debtors=act.filter(s=>(b[s.id]||0)<0).sort((x,y)=>b[x.id]-b[y.id]);
  const unmarked=lessonsIn(T,addDays(td,-14),addDays(td,-1)).filter(l=>!l.cancelled&&!isHeld(l,ai[l.id]));
  const card=l=>{ const marks=ai[l.id]||{}, n=Object.keys(marks).length, pr=Object.values(marks).filter(a=>a.mark==='p').length;
    return `<div class="card lcard" style="border-left:5px solid ${courseColor(l.g.cid)}"><div class="row"><b class="grow">${esc(l.g.name)}</b>${l.cancelled?'<span class="pill bad">Скасовано</span>':n?`<span class="pill good">Відмічено ${pr}/${n}</span>`:l.date<=td?'<span class="pill warn">Не відмічено</span>':''}</div>
      <div class="small muted">${l.date===td?'Сьогодні':WD_FULL[wdOf(l.date)-1]+', '+fmtDate(l.date)} · ${esc(l.time)} · ${esc(l.g.room||'')}</div>
      <div class="small">${esc(tname(l.teacher))}${l.sub?' <span class="pill warn">заміна</span>':''}</div>
      <div class="row" style="margin-top:8px"><a class="btn sm ghost" href="#/crm/attendance/${l.gid}/${monthOf(l.date)}">Журнал</a><button class="btn sm ghost" data-les="${esc(l.id)}">Заміна / скасування</button></div></div>` };
  crmShell('home',`<h1>Сьогодні, ${fmtDate(td)}</h1><p class="muted">${esc(D.branch)} · ${monthTitle(m)}</p>
    <div class="grid g4">${kpi('Учнів навчається',act.length,`груп: ${T.groups.filter(g=>g.status!=='archive').length}`)}${kpi('Оплачено за місяць',UAH(R.paid),'надходження','good')}${kpi('Списано за уроки',UAH(R.charged),`відвідувань: ${R.visits}`)}${kpi('Боржники',debtors.length,debtors.length?'разом '+UAH(-debtors.reduce((t,s)=>t+b[s.id],0)):'немає',debtors.length?'bad':'')}</div>
    ${unmarked.length?`<div class="callout warn" style="margin-top:16px"><b>Невідмічені заняття за 2 тижні: ${unmarked.length}</b><p>${unmarked.slice(0,6).map(l=>`<a href="#/crm/attendance/${l.gid}/${monthOf(l.date)}">${esc(l.g.name)} · ${fmtDate(l.date)} ${esc(l.time)}</a>`).join(' · ')}</p></div>`:''}
    <h2 style="margin-top:22px">Заняття на тиждень</h2>
    ${L.length?`<div class="grid g3">${L.map(card).join('')}</div>`:'<div class="card"><p class="muted">Занять немає. Створіть групу з розкладом у розділі «Групи й розклад».</p></div>'}
    ${debtors.length?`<h2 style="margin-top:22px">Боржники</h2><div class="card" style="padding:0;overflow:auto"><table class="prose ptable" style="width:100%;margin:0"><tbody>${debtors.slice(0,8).map(s=>`<tr><td>${avatar(s.child,s.id)} <a href="#/crm/student/${s.id}">${esc(s.child)}</a></td><td class="small">${esc(s.parent)} · <a href="tel:${esc(s.phone)}">${esc(fmtPhone(s.phone))}</a></td><td style="text-align:right">${bal(b[s.id])}</td></tr>`).join('')}</tbody></table></div>`:''}`);
  $$('[data-les]').forEach(x=>x.onclick=()=>lessonModal(L.find(l=>l.id===x.dataset.les)));
}

/* ---------- Учні ---------- */
function studentForm(s){
  s=s||{}; const T=D.tables, gs=groupIds(s);
  return `<div class="grid g2" style="gap:10px">
    <div class="field"><label>ПІБ дитини *</label><input class="input" name="child" required value="${esc(s.child||'')}" placeholder="Прізвище Ім’я"></div>
    <div class="field"><label>Дата народження</label><input class="input" name="birth" type="date" value="${esc(s.birth||'')}"></div>
    <div class="field"><label>ПІБ одного з батьків *</label><input class="input" name="parent" required value="${esc(s.parent||'')}"></div>
    <div class="field"><label>Телефон батьків *</label><input class="input" name="phone" type="tel" required value="${esc(s.phone||'')}" placeholder="+380 XX XXX XX XX"></div>
    <div class="field"><label>Додатковий контакт</label><input class="input" name="phone2" value="${esc(s.phone2||'')}" placeholder="другий телефон, Viber, e-mail"></div>
    <div class="field"><label>Статус</label><select class="input" name="status"><option value="">Навчається</option><option value="archive" ${s.status==='archive'?'selected':''}>Архів (не навчається)</option></select></div></div>
    <div class="field"><label>Групи</label><div class="chkgrid">${T.groups.filter(g=>g.status!=='archive'||gs.includes(g.id)).map(g=>`<label class="row small" style="gap:6px"><input type="checkbox" name="g_${g.id}" ${gs.includes(g.id)?'checked':''}> ${esc(g.name)} <span class="muted">· ${esc(slotText(g))} · ${UAH(g.price)}/урок</span></label>`).join('')||'<span class="muted small">Спершу створіть групу.</span>'}</div></div>
    <div class="field"><label>Знижка на абонемент</label><div class="chkgrid">${discRows(s)}</div>
      <div class="tiny muted">Відсоток можна змінити для цієї дитини. Знижки складаються, але разом не більше ${cfgOf(D.tables).discMax}%. Причини й відсотки за замовчуванням — у «Налаштуваннях».</div></div>
    <div class="field"><label>Примітка</label><textarea class="input" name="note" rows="2">${esc(s.note||'')}</textarea></div>`;
}
function discRows(s){ const c=cfgOf(D.tables), cur=discOf(s||{}); const list=c.discounts.slice(); cur.forEach(x=>{ if(!list.some(y=>y.id===x.id)) list.push(x) });
  return list.map(d=>{ const on=cur.find(x=>x.id===d.id); return `<label class="row small" style="gap:8px"><input type="checkbox" name="dc_${esc(d.id)}" ${on?'checked':''}> <span class="grow">${esc(d.name)}</span><input class="input" name="dp_${esc(d.id)}" type="number" min="0" max="100" step="1" value="${on?on.pct:d.pct}" style="max-width:80px;padding:6px 8px"> %</label>` }).join('') }
function readStudent(x, s){
  const phone=normPhone(x.phone); if(!x.child.trim()||!x.parent.trim()) throw new Error('Заповніть ПІБ дитини й одного з батьків.'); if(!phone) throw new Error('Телефон у форматі +380XXXXXXXXX.');
  return Object.assign({}, s||{}, {child:x.child.trim().replace(/\s+/g,' '), birth:x.birth, parent:x.parent.trim().replace(/\s+/g,' '), phone, phone2:x.phone2.trim(), status:x.status, note:x.note.trim(),
    groups:D.tables.groups.filter(g=>x['g_'+g.id]).map(g=>g.id).join(','),
    disc:JSON.stringify(Object.keys(x).filter(k=>k.startsWith('dc_')).map(k=>{ const id=k.slice(3); const d=cfgOf(D.tables).discounts.concat(discOf(s||{})).find(y=>y.id===id)||{name:id}; return {id, name:d.name, pct:Math.max(0,Math.min(100,Number(x['dp_'+id])||0))} }))});
}
function addStudent(){ modal('Новий учень', studentForm(), async x=>{ await save('students', readStudent(x)); A().toast('Учня додано'); reroute() }) }
function vStudents(p){
  const T=D.tables, b=balances(T); const st=p[0]==='archive'?'archive':'';
  const list=T.students.filter(s=>(s.status==='archive')===(st==='archive')).sort((x,y)=>x.child.localeCompare(y.child,'uk'));
  crmShell('students',`<div class="row"><h1 class="grow" style="margin:0">Учні</h1><button class="btn ghost" id="xl">⬇ Excel</button><button class="btn" id="add">+ Додати учня</button></div>
    <p class="muted">${T.students.filter(s=>s.status!=='archive').length} навчаються · ${T.students.filter(s=>s.status==='archive').length} в архіві</p>
    <div class="filters"><div class="seg"><a class="${st?'':'on'}" href="#/crm/students">Навчаються</a><a class="${st?'on':''}" href="#/crm/students/archive">Архів</a></div>
      <input class="input" id="q" placeholder="Пошук: ім’я, батьки, телефон" style="max-width:320px"><select class="input" id="fg" style="max-width:260px"><option value="">Усі групи</option>${T.groups.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select>
      <select class="input" id="fb" style="max-width:180px"><option value="">Будь-який баланс</option><option value="debt">Лише боржники</option></select></div>
    <div class="grid g3" id="sl">${list.map(s=>`<a class="card scard" href="#/crm/student/${s.id}" data-q="${esc((s.child+' '+s.parent+' '+s.phone).toLowerCase())}" data-g="${esc(s.groups)}" data-d="${(b[s.id]||0)<0?1:0}">
      <div class="row">${avatar(s.child,s.id)}<div class="grow"><b>${esc(s.child)}</b><div class="tiny">${esc(age(s.birth))}</div></div></div>
      <div class="tags">${groupIds(s).map(g=>`<span class="tag"><i style="background:${courseColor((T.groups.find(x=>x.id===g)||{}).cid)}"></i>${esc(gname(g))}</span>`).join('')||'<span class="tiny muted">без групи</span>'}</div>
      <div class="kv small"><span class="muted">Батьки</span><span>${esc(s.parent)}</span><span class="muted">Телефон</span><span>${esc(fmtPhone(s.phone))}</span></div>
      <div class="row" style="margin-top:8px">${discPct(T,s)?`<span class="pill warn" title="${esc(discOf(s).map(x=>x.name+' '+x.pct+'%').join(', '))}">знижка ${discPct(T,s)}%</span>`:''}<span class="grow"></span>${bal(b[s.id]||0)}</div></a>`).join('')||'<div class="card"><p class="muted">Учнів ще немає.</p></div>'}</div>`);
  $('#add').onclick=addStudent; $('#xl').onclick=exportStudents;
  const flt=()=>{ const q=$('#q').value.trim().toLowerCase(), g=$('#fg').value, d=$('#fb').value; $$('#sl .scard').forEach(c=>{ c.style.display=(!q||c.dataset.q.includes(q))&&(!g||c.dataset.g.split(',').includes(g))&&(!d||c.dataset.d==='1')?'':'none' }) };
  ['q','fg','fb'].forEach(i=>$('#'+i).oninput=flt);
}
function vStudent(p){
  const T=D.tables, s=T.students.find(x=>x.id===p[0]); if(!s) return vStudents([]);
  const b=balances(T)[s.id]||0, pays=T.pays.filter(x=>x.sid===s.id).sort((x,y)=>y.date.localeCompare(x.date)), att=T.att.filter(x=>x.sid===s.id).sort((x,y)=>y.date.localeCompare(x.date));
  const ab=abonement(T,s,curMonth()), abN=abonement(T,s,shiftMonth(curMonth(),1));
  crmShell('students',`<a class="btn sm ghost" href="#/crm/students">← Учні</a>
    <div class="row" style="margin-top:12px">${avatar(s.child,s.id)}<h1 style="margin:0" class="grow">${esc(s.child)}</h1>${bal(b)}</div>
    <div class="grid g2" style="margin-top:14px"><div class="card"><div class="kv"><span class="muted">Вік</span><span>${esc(age(s.birth)||'—')} ${s.birth?'('+esc(s.birth.split('-').reverse().join('.'))+')':''}</span>
      <span class="muted">Батьки</span><span>${esc(s.parent)}</span><span class="muted">Телефон</span><span><a href="tel:${esc(s.phone)}">${esc(fmtPhone(s.phone))}</a></span>
      <span class="muted">Дод. контакт</span><span>${esc(s.phone2||'—')}</span><span class="muted">Групи</span><span>${groupIds(s).map(g=>esc(gname(g))).join(', ')||'—'}</span>
      <span class="muted">Знижка</span><span>${discOf(s).length?discOf(s).map(x=>esc(x.name)+' — '+x.pct+'%').join('<br>')+(discOf(s).length>1||discPct(T,s)!==discOf(s).reduce((t,x)=>t+Number(x.pct||0),0)?`<br><b>разом ${discPct(T,s)}%</b>`:''):'немає'}</span>
      <span class="muted">Примітка</span><span>${esc(s.note||'—')}</span><span class="muted">Статус</span><span>${s.status==='archive'?'Архів':'Навчається'}</span></div>
      <div class="row" style="margin-top:12px"><button class="btn sm" id="pay">Внести оплату</button><button class="btn sm ghost" id="ed">Редагувати</button><span class="grow"></span><button class="btn sm ghost" id="rm">Видалити</button></div></div>
      <div class="card"><h3 style="margin-top:0">Абонемент</h3>${[[curMonth(),ab],[shiftMonth(curMonth(),1),abN]].map(([m,a])=>`<p class="small"><b>${monthTitle(m)}:</b> ${a.map(x=>`${esc(x.g.name)} — ${x.n} занять × ${x.pct?`<s>${UAH(x.full)}</s> `:''}${UAH(x.price)} = <b>${UAH(x.sum)}</b>`).join('<br>')||'немає груп'}${a.length>1?`<br>Разом: <b>${UAH(a.reduce((t,x)=>t+x.sum,0))}</b>`:''}</p>`).join('')}
      <p class="tiny muted">За кожне відвідане заняття з балансу списується ціна уроку групи з урахуванням знижки. Пропуски не списуються. Нова знижка діє для занять, відмічених після її зміни.</p></div></div>
    <div class="grid g2" style="margin-top:16px"><div class="card" style="padding:0;overflow:auto"><h3 style="margin:14px 16px">Оплати</h3><table class="prose ptable" style="width:100%;margin:0"><tbody>${pays.map(x=>`<tr><td>${esc(x.date)}</td><td>${monthTitle(x.month||monthOf(x.date))}</td><td>${esc(x.method||'')}</td><td style="text-align:right"><b>${UAH(x.amount)}</b>${x.payer?`<div class="tiny">${esc(x.payer)}</div>`:''}</td><td style="white-space:nowrap"><button class="btn sm ghost" data-rc="${x.id}" title="Квитанція">🧾</button><button class="btn sm ghost" data-dp="${x.id}" title="Видалити оплату">✕</button></td></tr>`).join('')||'<tr><td class="muted">Оплат немає</td></tr>'}</tbody></table></div>
      <div class="card" style="padding:0;overflow:auto;max-height:420px"><h3 style="margin:14px 16px">Відвідування (${att.filter(a=>a.mark==='p').length} з ${att.length})</h3><table class="prose ptable" style="width:100%;margin:0"><tbody>${att.map(a=>`<tr><td>${esc(a.date)}</td><td>${esc(gname(a.gid))}</td><td>${a.mark==='p'?'<span class="pill good">присутній</span>':'<span class="pill bad">відсутній</span>'}</td><td style="text-align:right">${a.mark==='p'?'−'+UAH(a.price):''}</td></tr>`).join('')||'<tr><td class="muted">Ще не відвідував</td></tr>'}</tbody></table></div></div>`);
  $('#pay').onclick=()=>payModal(s); $('#ed').onclick=()=>modal('Редагування учня', studentForm(s), async x=>{ await save('students', readStudent(x,s)); A().toast('Збережено'); reroute() });
  $('#rm').onclick=async()=>{ if(!confirm('Видалити учня разом з оплатами й відвідуваннями? Краще перевести в архів, щоб зберегти історію.')) return;
    await del('att',T.att.filter(a=>a.sid===s.id).map(a=>a.id)); await del('pays',T.pays.filter(a=>a.sid===s.id).map(a=>a.id)); await del('students',s.id); location.hash='#/crm/students' };
  $$('[data-dp]').forEach(x=>x.onclick=async()=>{ if(!confirm('Видалити оплату?')) return; await del('pays',x.dataset.dp); reroute() });
  $$('[data-rc]').forEach(x=>x.onclick=()=>showReceipt(T.pays.find(p=>p.id===x.dataset.rc)));
}
function payModal(s, month){
  const m=month||curMonth(), ab=abonement(D.tables,s,m), sum=ab.reduce((t,x)=>t+x.sum,0), b=balances(D.tables)[s.id]||0;
  modal('Оплата: '+s.child, `<p class="small muted">${ab.map(x=>`${esc(x.g.name)}: ${x.n} занять × ${UAH(x.price)} = ${UAH(x.sum)}`).join('<br>')||'Учень не записаний у групу.'}${ab.length&&ab[0].pct?`<br>Знижка ${ab[0].pct}% (${esc(discOf(s).map(x=>x.name).join(', '))}) — без знижки було б ${UAH(ab.reduce((t,x)=>t+x.fullSum,0))}`:''}<br>Поточний баланс: ${bal(b)}</p>
    <div class="grid g2" style="gap:10px"><div class="field"><label>Сума, грн</label><input class="input" name="amount" type="number" min="1" step="1" required value="${sum||''}"></div>
    <div class="field"><label>За місяць (абонемент)</label><input class="input" name="month" type="month" required value="${m}"></div>
    <div class="field"><label>Дата оплати</label><input class="input" name="date" type="date" required value="${today()}"></div>
    <div class="field"><label>Спосіб</label><select class="input" name="method">${PAY_METHODS.map(x=>`<option>${x}</option>`).join('')}</select></div></div>
    <div class="field"><label>Платник — від кого прийнято оплату *</label><input class="input" name="payer" required value="${esc(s.parent||'')}" placeholder="ПІБ того, хто вносить оплату"><div class="tiny muted">Це ім’я буде у квитанції в полі «Прийнято від».</div></div>
    <div class="field"><label>Коментар</label><input class="input" name="note" value="абонемент"></div>
    <label class="row small" style="gap:6px"><input type="checkbox" name="rc" checked> одразу сформувати квитанцію</label>`, async x=>{
      if(!(Number(x.amount)>0)) throw new Error('Вкажіть суму.'); if(!x.payer.trim()) throw new Error('Вкажіть платника.');
      const id=uid('p'); await save('pays',{id,sid:s.id,amount:Number(x.amount),month:x.month,date:x.date,method:x.method,note:x.note,payer:x.payer.trim().replace(/\s+/g,' ')});
      A().toast('Оплату внесено'); reroute(); const p=D.tables.pays.find(q=>q.id===id); if(x.rc&&p) showReceipt(Object.assign({basisDebt:b<0},p)) }, 'Зарахувати');
}

/* ---------- Групи й розклад ---------- */
function groupForm(g){
  g=g||{slots:'[]'}; const sl=slotsOf(g); if(!sl.length) sl.push({d:1,t:'16:00',m:60});
  const {COURSES}=A();
  return `<div class="grid g2" style="gap:10px"><div class="field"><label>Назва групи *</label><input class="input" name="name" required value="${esc(g.name||'')}" placeholder="наприклад, LEGO Start · Пн/Ср 16:30"></div>
    <div class="field"><label>Курс *</label><select class="input" name="cid" required>${COURSES.map(c=>`<option value="${c.id}" ${c.id===g.cid?'selected':''}>${esc(c.title)}</option>`).join('')}</select></div>
    <div class="field"><label>Учитель</label><select class="input" name="teacher"><option value="">— не призначено —</option>${D.teachers.map(t=>`<option value="${esc(t.email)}" ${t.email===String(g.teacher||'').toLowerCase()?'selected':''}>${esc(t.fio)}</option>`).join('')}</select></div>
    <div class="field"><label>Ціна одного уроку, грн *</label><input class="input" name="price" type="number" min="0" step="1" required value="${esc(g.price||'')}"></div>
    <div class="field"><label>Початок навчання</label><input class="input" name="start" type="date" value="${esc(g.start||today())}"></div>
    <div class="field"><label>Кінець (необов’язково)</label><input class="input" name="end" type="date" value="${esc(g.end||'')}"></div>
    <div class="field"><label>Аудиторія / адреса</label><input class="input" name="room" value="${esc(g.room||'')}"></div>
    <div class="field"><label>Статус</label><select class="input" name="status"><option value="">Активна</option><option value="archive" ${g.status==='archive'?'selected':''}>Архів</option></select></div></div>
    <div class="field"><label>Розклад (день, час, тривалість у хв)</label><div id="slots">${sl.map(slotRow).join('')}</div><button type="button" class="btn sm ghost" id="addslot">+ день</button></div>
    ${D.teachers.length?'':'<p class="tiny muted">У філії ще немає зареєстрованих учителів — вони з’являться тут після реєстрації на платформі.</p>'}`;
}
function slotRow(s){ return `<div class="row slot" style="gap:6px;margin-bottom:6px"><select class="input" name="sd" style="max-width:150px">${WD_FULL.map((w,i)=>`<option value="${i+1}" ${Number(s.d)===i+1?'selected':''}>${w}</option>`).join('')}</select>
  <input class="input" name="st" type="time" value="${esc(s.t||'16:00')}" style="max-width:130px"><input class="input" name="sm" type="number" min="15" step="5" value="${esc(s.m||60)}" style="max-width:100px"><span class="small muted">хв</span><button type="button" class="btn sm ghost" data-rs>✕</button></div>` }
function roleRow(o){ const known=ROLES.indexOf(o.role)>=0; return `<div class="row rrow" style="gap:6px;margin-bottom:6px"><select class="input" name="rr" style="max-width:170px">${ROLES.map(x=>`<option ${(known?o.role===x:x==='Інше')?'selected':''}>${x}</option>`).join('')}</select>
  <input class="input" name="rx" placeholder="назва ролі" value="${known?'':esc(o.role||'')}" style="max-width:150px"><select class="input" name="rt" style="max-width:150px"><option value="month" ${o.type!=='hour'?'selected':''}>за місяць</option><option value="hour" ${o.type==='hour'?'selected':''}>за годину</option></select>
  <input class="input" name="rv" type="number" min="0" step="1" value="${esc(o.rate)}" placeholder="грн" style="max-width:110px"><button type="button" class="btn sm ghost" data-rr>✕</button></div>` }
function bindSlots(w){ const box=$('#slots',w); const rb=()=>$$('[data-rs]',w).forEach(b=>b.onclick=()=>{ if($$('.slot',w).length>1) b.closest('.slot').remove() }); $('#addslot',w).onclick=()=>{ box.insertAdjacentHTML('beforeend',slotRow({d:3,t:'16:00',m:60})); rb() }; rb() }
function readGroup(x, f, g){
  if(!x.name.trim()) throw new Error('Вкажіть назву групи.'); if(!(Number(x.price)>=0)||x.price==='') throw new Error('Вкажіть ціну уроку.');
  const slots=$$('.slot',f).map(r=>({d:Number($('[name=sd]',r).value),t:$('[name=st]',r).value,m:Number($('[name=sm]',r).value)||60})).filter(s=>s.t);
  if(!slots.length) throw new Error('Додайте хоча б один день розкладу.');
  return Object.assign({},g||{},{name:x.name.trim(),cid:x.cid,teacher:x.teacher,price:Number(x.price),start:x.start,end:x.end,room:x.room.trim(),status:x.status,slots:JSON.stringify(slots)});
}
function editGroup(g){ const w=modal(g?'Група: '+g.name:'Нова група', groupForm(g), async (x,f)=>{ await save('groups', readGroup(x,f,g)); A().toast('Групу збережено'); reroute() }); bindSlots(w) }
function vGroups(p){
  const T=D.tables, ws=p[0]&&/^\d{4}-\d\d-\d\d$/.test(p[0])?weekStart(p[0]):weekStart(today()), we=addDays(ws,6), L=lessonsIn(T,ws,we), ai=attIndex(T);
  const cnt=gid=>T.students.filter(s=>s.status!=='archive'&&groupIds(s).includes(gid)).length;
  crmShell('groups',`<div class="row"><h1 class="grow" style="margin:0">Групи й розклад</h1><button class="btn ghost" id="extra">+ Разове заняття</button><button class="btn" id="add">+ Нова група</button></div>
    <div class="card" style="padding:0;overflow:auto;margin-top:14px"><table class="prose ptable" style="width:100%;margin:0"><thead><tr><th>Група</th><th>Курс</th><th>Учитель</th><th>Розклад</th><th>Ціна уроку</th><th>Учнів</th><th></th></tr></thead><tbody>
    ${T.groups.slice().sort((a,b)=>(a.status==='archive')-(b.status==='archive')||a.name.localeCompare(b.name,'uk')).map(g=>`<tr ${g.status==='archive'?'style="opacity:.55"':''}><td><span class="sw" style="background:${courseColor(g.cid)}"></span> <b>${esc(g.name)}</b>${g.status==='archive'?' <span class="pill">архів</span>':''}<div class="tiny">${esc(g.room||'')}</div></td><td class="small">${esc(courseTitle(g.cid))}</td><td class="small">${esc(tname(g.teacher))}</td><td class="small">${esc(slotText(g))}</td><td>${UAH(g.price)}</td><td>${cnt(g.id)}</td><td><button class="btn sm ghost" data-eg="${g.id}">Змінити</button></td></tr>`).join('')||'<tr><td class="muted">Груп ще немає — створіть першу.</td></tr>'}</tbody></table></div>
    <div class="row" style="margin-top:24px"><h2 class="grow" style="margin:0">Розклад тижня</h2><a class="btn sm ghost" href="#/crm/groups/${addDays(ws,-7)}">‹</a><b>${fmtDate(ws)} — ${fmtDate(we)}</b><a class="btn sm ghost" href="#/crm/groups/${addDays(ws,7)}">›</a>${ws!==weekStart(today())?'<a class="btn sm ghost" href="#/crm/groups">Цей тиждень</a>':''}</div>
    <p class="small muted">Натисніть на заняття, щоб призначити заміну вчителя, скасувати його чи додати тему.</p>
    <div class="week">${WD.map((w,i)=>{ const d=addDays(ws,i); const ls=L.filter(l=>l.date===d); return `<div class="wday ${d===today()?'today':''}"><div class="wh"><b>${w}</b> <span class="tiny">${fmtDate(d)}</span></div>${ls.map(l=>{ const n=Object.keys(ai[l.id]||{}).length;
      return `<button class="wl ${l.cancelled?'off':''}" data-les="${esc(l.id)}" style="border-left-color:${courseColor(l.g.cid)}"><b>${esc(l.time)}</b> ${esc(l.g.name)}<span>${esc(tname(l.teacher))}${l.sub?' · заміна':''}${l.extra?' · разове':''}${l.cancelled?' · скасовано':n?' · ✓ відмічено':''}</span></button>` }).join('')||'<span class="tiny muted">—</span>'}</div>` }).join('')}</div>`);
  $('#add').onclick=()=>editGroup(); $$('[data-eg]').forEach(b=>b.onclick=()=>editGroup(T.groups.find(g=>g.id===b.dataset.eg)));
  $$('[data-les]').forEach(b=>b.onclick=()=>lessonModal(L.find(l=>l.id===b.dataset.les)));
  $('#extra').onclick=()=>modal('Разове заняття',`<div class="field"><label>Група</label><select class="input" name="gid" required>${T.groups.filter(g=>g.status!=='archive').map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></div>
    <div class="grid g2" style="gap:10px"><div class="field"><label>Дата</label><input class="input" name="date" type="date" required value="${today()}"></div><div class="field"><label>Час</label><input class="input" name="time" type="time" required value="16:00"></div></div>
    <div class="field"><label>Учитель (якщо не основний)</label><select class="input" name="sub"><option value="">— учитель групи —</option>${D.teachers.map(t=>`<option value="${esc(t.email)}">${esc(t.fio)}</option>`).join('')}</select></div>
    <div class="field"><label>Примітка</label><input class="input" name="note" placeholder="відпрацювання, майстер-клас…"></div>`, async x=>{ if(!x.gid) throw new Error('Оберіть групу.'); await save('lessons',{id:x.gid+'|'+x.date+'|'+x.time,gid:x.gid,date:x.date,time:x.time,sub:x.sub,status:'extra',done:'',note:x.note}); A().toast('Заняття додано'); reroute() });
}
function lessonModal(l){
  if(!l) return; const ai=attIndex(D.tables)[l.id]||{};
  modal(`${l.g.name} · ${fmtDate(l.date)}, ${l.time}`, `<p class="small muted">Учитель групи: <b>${esc(tname(l.groupTeacher))}</b>${Object.keys(ai).length?` · відмічено ${Object.values(ai).filter(a=>a.mark==='p').length} з ${Object.keys(ai).length}`:''}</p>
    <div class="field"><label>Проводить (заміна)</label><select class="input" name="sub"><option value="">${esc(tname(l.groupTeacher))} (учитель групи)</option>${D.teachers.filter(t=>t.email!==l.groupTeacher).map(t=>`<option value="${esc(t.email)}" ${t.email===l.sub?'selected':''}>${esc(t.fio)}</option>`).join('')}</select>
      <div class="tiny muted">Оплата за це заняття нараховується тому, хто його проводить.</div></div>
    <div class="field"><label>Статус</label><select class="input" name="status"><option value="${l.extra?'extra':''}">${l.extra?'Разове заняття':'Відбувається'}</option><option value="cancelled" ${l.cancelled?'selected':''}>Скасовано (не списується, не оплачується)</option></select></div>
    <div class="field"><label>Тема / примітка</label><input class="input" name="note" value="${esc(l.note)}"></div>
    <p class="small"><a href="#/crm/attendance/${l.gid}/${monthOf(l.date)}">Відкрити журнал відвідування →</a></p>`, async x=>{
      await save('lessons', Object.assign({}, l.row||{}, {id:l.id,gid:l.gid,date:l.date,time:l.time,sub:x.sub,status:x.status,note:x.note,done:l.done?'так':''})); A().toast('Збережено'); reroute() });
}

/* ---------- Відвідування ---------- */
function vAttendance(p){
  const T=D.tables, groups=T.groups.filter(g=>g.status!=='archive');
  const gid=p[0]&&T.groups.find(g=>g.id===p[0])?p[0]:(groups[0]||{}).id, m=p[1]&&/^\d{4}-\d\d$/.test(p[1])?p[1]:curMonth();
  if(!gid) return crmShell('attendance','<h1>Відвідування</h1><div class="card"><p class="muted">Створіть групу в розділі «Групи й розклад».</p></div>');
  const g=T.groups.find(x=>x.id===gid), [f,t]=monthRange(m), L=lessonsIn(T,f,t).filter(l=>l.gid===gid), ai=attIndex(T);
  const st=T.students.filter(s=>groupIds(s).includes(gid)||T.att.some(a=>a.gid===gid&&a.sid===s.id&&monthOf(a.date)===m)).sort((a,b)=>a.child.localeCompare(b.child,'uk'));
  const cell=(l,s)=>{ const a=(ai[l.id]||{})[s.id]; const mk=a?a.mark:''; return `<td><button class="ac ${mk}" data-l="${esc(l.id)}" data-s="${s.id}" ${l.cancelled?'disabled':''} title="${a?esc((a.by==='адміністратор'?'адміністратор':tname(a.by))):''}">${mk==='p'?'✓':mk==='a'?'Н':''}</button></td>` };
  crmShell('attendance',`<h1>Відвідування</h1><p class="muted">Клітинка: порожньо → ✓ присутній → Н відсутній → порожньо. Учитель відмічає заняття у своєму кабінеті; тут ви можете виправити будь-яку позначку. За «✓» з балансу учня списується ${UAH(g.price)} (зі знижкою учня — менше).</p>
    <div class="row" style="gap:10px"><select class="input" id="gs" style="max-width:320px">${T.groups.map(x=>`<option value="${x.id}" ${x.id===gid?'selected':''}>${esc(x.name)}</option>`).join('')}</select><span class="grow"></span>${monthNav(m,'#/crm/attendance/'+gid)}</div>
    <div class="card" style="padding:0;overflow:auto;margin-top:12px"><table class="prose ptable att" style="margin:0"><thead><tr><th>Учень · ${st.length}</th>${L.map(l=>`<th><button class="lh ${l.cancelled?'off':''}" data-les="${esc(l.id)}">${WD[wdOf(l.date)-1]}<br>${l.date.slice(8)}.${l.date.slice(5,7)}<br><span class="tiny">${esc(l.time)}</span>${l.sub?'<br><span class="pill warn" style="font-size:10px">заміна</span>':''}</button></th>`).join('')}<th>%</th></tr></thead>
    <tbody>${st.map(s=>{ const ms=L.map(l=>(ai[l.id]||{})[s.id]).filter(Boolean); const pr=ms.filter(a=>a.mark==='p').length;
      return `<tr><td style="white-space:nowrap"><a href="#/crm/student/${s.id}">${esc(s.child)}</a></td>${L.map(l=>cell(l,s)).join('')}<td>${ms.length?`<span class="pill ${pr/ms.length>=.8?'good':pr/ms.length>=.5?'warn':'bad'}">${Math.round(100*pr/ms.length)}%</span>`:''}</td></tr>` }).join('')}
      <tr><td class="tiny muted">Присутні</td>${L.map(l=>{ const v=Object.values(ai[l.id]||{}); return `<td class="tiny">${l.cancelled?'скас.':v.length?v.filter(a=>a.mark==='p').length+'/'+v.length:''}</td>` }).join('')}<td></td></tr></tbody></table></div>
    ${L.length?'':'<p class="muted">У цьому місяці занять немає.</p>'}
    <p class="tiny muted">Натисніть на дату, щоб призначити заміну, скасувати заняття або додати тему.</p>`);
  $('#gs').onchange=e=>location.hash='#/crm/attendance/'+e.target.value+'/'+m;
  $$('[data-les]').forEach(b=>b.onclick=()=>lessonModal(L.find(l=>l.id===b.dataset.les)));
  $$('button.ac').forEach(b=>b.onclick=async()=>{ const l=L.find(x=>x.id===b.dataset.l), sid=b.dataset.s, a=(ai[l.id]||{})[sid], cur=a?a.mark:'', nx=cur===''?'p':cur==='p'?'a':'';
    b.disabled=true; try{ if(!nx) await del('att',a.id); else await save('att',{id:a?a.id:undefined,lid:l.id,gid:l.gid,date:l.date,sid,mark:nx,by:'адміністратор'});
      if(!l.done) await save('lessons',Object.assign({},l.row||{},{id:l.id,gid:l.gid,date:l.date,time:l.time,sub:l.sub,status:l.status,note:l.note,done:'так'})); vAttendance([gid,m]) }catch(e){ A().toast(e.message); b.disabled=false } });
}

/* ---------- Оплати й борги ---------- */
function vPayments(p){
  const T=D.tables, m=p[0]&&/^\d{4}-\d\d$/.test(p[0])?p[0]:curMonth(), flt=p[1]||'', b=balances(T), R=monthReport(T,m);
  const act=T.students.filter(s=>s.status!=='archive'||(b[s.id]||0)<0);
  const rows=act.map(s=>{ const ab=abonement(T,s,m), due=ab.reduce((t,x)=>t+x.sum,0), paid=T.pays.filter(x=>x.sid===s.id&&(x.month||monthOf(x.date))===m).reduce((t,x)=>t+Number(x.amount),0);
    const ch=T.att.filter(a=>a.sid===s.id&&a.mark==='p'&&monthOf(a.date)===m); return {s,ab,due,paid,visits:ch.length,charged:ch.reduce((t,a)=>t+Number(a.price),0),bal:b[s.id]||0} })
    .filter(r=>flt==='debt'?r.bal<0:flt==='unpaid'?r.due>0&&r.paid<r.due:true).sort((a,b)=>a.bal-b.bal);
  const debt=act.filter(s=>(b[s.id]||0)<0), totalDebt=debt.reduce((t,s)=>t+b[s.id],0), prepaid=act.reduce((t,s)=>t+Math.max(0,b[s.id]||0),0);
  const pays=T.pays.filter(x=>monthOf(x.date)===m).sort((x,y)=>y.date.localeCompare(x.date));
  crmShell('payments',`<h1>Оплати й борги</h1><p class="muted">Оплата вноситься за місяць (абонемент) і зараховується на баланс учня. Сума абонемента = ціна уроку × кількість занять групи в місяці, тому в різні місяці вона різна. За кожне відвідане заняття з балансу списується ціна уроку; якщо дитина була на занятті, а грошей немає — баланс стає від’ємним і учень потрапляє до боржників.</p>
    ${monthNav(m,'#/crm/payments')}
    <div class="grid g4" style="margin-top:12px">${kpi('Оплачено за '+MONTHS[Number(m.slice(5))-1].toLowerCase(),UAH(R.paid),`платежів: ${pays.length}`,'good')}${kpi('Списано за уроки',UAH(R.charged),`відвідувань: ${R.visits}`)}${kpi('Борг зараз',UAH(-totalDebt),`боржників: ${debt.length}`,debt.length?'bad':'')}${kpi('Передоплата на балансах',UAH(prepaid),'залишки учнів')}</div>
    <div class="filters" style="margin-top:14px"><div class="seg"><a class="${flt?'':'on'}" href="#/crm/payments/${m}">Усі</a><a class="${flt==='debt'?'on':''}" href="#/crm/payments/${m}/debt">Боржники</a><a class="${flt==='unpaid'?'on':''}" href="#/crm/payments/${m}/unpaid">Не сплатили абонемент</a></div><input class="input" id="q" placeholder="Знайти учня" style="max-width:280px"><span class="grow"></span><button class="btn sm" id="xl">⬇ Excel: учні й оплати</button><button class="btn sm ghost" id="csv">CSV</button></div>
    <div class="card" style="padding:0;overflow:auto"><table class="prose ptable" style="width:100%;margin:0" id="pt"><thead><tr><th>Учень</th><th>Групи</th><th>Абонемент</th><th>Сплачено за місяць</th><th>Відвідав / списано</th><th>Баланс</th><th></th></tr></thead><tbody>
    ${rows.map(r=>`<tr data-q="${esc(r.s.child.toLowerCase())}"><td>${avatar(r.s.child,r.s.id)} <a href="#/crm/student/${r.s.id}">${esc(r.s.child)}</a><div class="tiny">${esc(r.s.parent)} · ${esc(fmtPhone(r.s.phone))}</div></td><td class="small">${r.ab.map(x=>esc(x.g.name)+' ('+x.n+' зан.)').join('<br>')||'—'}</td><td>${r.due?UAH(r.due):'—'}${discPct(T,r.s)?`<div class="tiny">знижка ${discPct(T,r.s)}%</div>`:''}</td><td>${r.paid?`<b>${UAH(r.paid)}</b>`:'<span class="muted">—</span>'}</td><td class="small">${r.visits} / ${UAH(r.charged)}</td><td>${bal(r.bal)}</td><td><button class="btn sm" data-pay="${r.s.id}">Внести</button></td></tr>`).join('')||'<tr><td class="muted">Немає учнів за фільтром</td></tr>'}</tbody></table></div>
    <h2 style="margin-top:22px">Платежі за ${monthTitle(m).toLowerCase()}</h2>
    <div class="card" style="padding:0;overflow:auto"><table class="prose ptable" style="width:100%;margin:0"><tbody>${pays.map(x=>`<tr><td>${x.no?'№ '+esc(x.no)+'<br>':''}${esc(x.date)}</td><td>${esc(sname(x.sid))}${x.payer?`<div class="tiny">платник: ${esc(x.payer)}</div>`:''}</td><td class="small">за ${monthTitle(x.month||monthOf(x.date)).toLowerCase()} · ${esc(x.method||'')} ${x.note?'· '+esc(x.note):''}</td><td style="text-align:right"><b>${UAH(x.amount)}</b></td><td style="white-space:nowrap"><button class="btn sm ghost" data-rc="${x.id}" title="Квитанція">🧾</button><button class="btn sm ghost" data-dp="${x.id}">✕</button></td></tr>`).join('')||'<tr><td class="muted">Платежів немає</td></tr>'}</tbody></table></div>`);
  $$('[data-pay]').forEach(x=>x.onclick=()=>payModal(T.students.find(s=>s.id===x.dataset.pay), m));
  $$('[data-dp]').forEach(x=>x.onclick=async()=>{ if(!confirm('Видалити платіж?')) return; await del('pays',x.dataset.dp); reroute() });
  $$('[data-rc]').forEach(x=>x.onclick=()=>showReceipt(T.pays.find(p=>p.id===x.dataset.rc)));
  $('#xl').onclick=exportStudents;
  $('#q').oninput=e=>{ const q=e.target.value.trim().toLowerCase(); $$('#pt tbody tr').forEach(r=>r.style.display=!q||(r.dataset.q||'').includes(q)?'':'none') };
  $('#csv').onclick=()=>csv(`oplaty_${m}.csv`,[['Учень','Батьки','Телефон','Абонемент','Сплачено за місяць','Відвідувань','Списано','Баланс']].concat(rows.map(r=>[r.s.child,r.s.parent,r.s.phone,r.due,r.paid,r.visits,r.charged,r.bal])));
}

/* ---------- Учителі й зарплата ---------- */
function vTeachers(p){
  const T=D.tables, m=p[0]&&/^\d{4}-\d\d$/.test(p[0])?p[0]:curMonth(), S=salaries(T,m), c=cfgOf(T), {ALL,courseItems}=A();
  const progOf=email=>{ const pr=D.progress.filter(x=>x.email===email); const best={}; pr.forEach(r=>{ const k=r.course+'|'+r.item; if(!best[k]||r.passed) best[k]=r });
    const passed=Object.values(best).filter(r=>r.passed); const courses=ALL.filter(cc=>{ const it=courseItems(cc); return it.length&&it.every(i=>best[cc.id+'|'+i.id]&&best[cc.id+'|'+i.id].passed) }).length; return {steps:passed.length, courses} };
  const emails=[...new Set(D.teachers.map(t=>t.email).concat(Object.keys(S)))];
  const total=Object.values(S).reduce((t,x)=>t+x.total,0);
  crmShell('teachers',`<h1>Учителі й зарплата</h1><p class="muted">Учителі вашої філії (реєструються самі на платформі). Оплата за заняття = ставка за урок + преміум-відсоток + надбавка за кожного учня понад ${c.bonusFrom} (${UAH(c.bonusPer)} за учня). Заміна оплачується тому, хто провів заняття. До зарплати додаються доплати за додаткові ролі (адміністратор, лаборант, методист): фіксовано за місяць або погодинно. Умови надбавки — у «Налаштуваннях».</p>
    ${monthNav(m,'#/crm/teachers')}
    <div class="card" style="padding:0;overflow:auto;margin-top:12px"><table class="prose ptable" style="width:100%;margin:0"><thead><tr><th>Учитель</th><th>Групи</th><th>Ставка</th><th>Занять</th><th>Учнів</th><th>За заняття</th><th>Ролі</th><th>До виплати</th><th></th></tr></thead><tbody>
    ${emails.map(e=>{ const t=D.teachers.find(x=>x.email===e)||{fio:e,email:e}, s=S[e]||{lessons:0,present:0,base:0,prem:0,bonus:0,roles:0,roleItems:[],total:0,subs:0}, r=rateOf(T,e), gs=T.groups.filter(g=>String(g.teacher).toLowerCase()===e&&g.status!=='archive'), pr=progOf(e);
      return `<tr><td style="min-width:180px"><b>${esc(t.fio)}</b><div class="tiny">${esc(e)}</div><div class="tiny">навчання: ${pr.steps} кроків, курсів пройдено ${pr.courses}</div></td><td class="small" style="min-width:120px">${gs.map(g=>esc(g.name)).join('<br>')||'—'}</td><td>${UAH(r.base)}${r.premium?`<div class="tiny">+${r.premium}% преміум</div>`:''}</td><td>${s.lessons}${s.subs?`<div class="tiny">заміни: ${s.subs}</div>`:''}</td><td>${s.present}</td><td>${UAH(s.base+s.prem+s.bonus)}<div class="tiny">ставки ${UAH(s.base)}${s.prem?` · преміум ${UAH(s.prem)}`:''}${s.bonus?` · надбавка ${UAH(s.bonus)}`:''}</div></td><td class="small">${r.roles.length?`${s.roleItems.map(x=>`${esc(x.role)}: ${UAH(x.sum)}${x.type==='hour'?` <span class="tiny">(${x.hours} год)</span>`:''}`).join('<br>')||'0 грн'}<br><button class="btn sm ghost" data-ex="${esc(e)}" style="margin-top:4px">${r.roles.some(o=>o.type==='hour')?'Години / сума':'Сума за місяць'}</button>`:'—'}</td><td><b>${UAH(s.total)}</b></td><td><button class="btn sm ghost" data-rate="${esc(e)}">Ставка й ролі</button>${s.lessons||s.roles?` <button class="btn sm ghost" data-det="${esc(e)}">Деталі</button>`:''}</td></tr>` }).join('')||'<tr><td class="muted">Учителів ще немає. Учителі вашої філії з’являться тут після реєстрації на платформі.</td></tr>'}
    <tr><td colspan="7" style="text-align:right"><b>Разом фонд оплати за ${monthTitle(m).toLowerCase()}</b></td><td><b>${UAH(total)}</b></td><td><button class="btn sm ghost" id="csv">CSV</button></td></tr></tbody></table></div><div id="det"></div>`);
  $$('[data-rate]').forEach(b=>b.onclick=()=>{ const e=b.dataset.rate, r=rateOf(T,e), row=T.rates.find(x=>String(x.id).toLowerCase()===e)||{id:e};
    const w=modal('Ставка: '+tname(e),`<div class="grid g2" style="gap:10px"><div class="field"><label>Фіксована оплата за урок, грн</label><input class="input" name="base" type="number" min="0" step="1" required value="${r.base}"></div>
      <div class="field"><label>Преміум: + % ${c.premiumMode==='revenue'?'від виручки уроку':'до ставки за урок'}</label><input class="input" name="premium" type="number" min="0" max="100" step="0.5" value="${r.premium}"></div></div>
      <div class="field"><label>Примітка</label><input class="input" name="note" value="${esc(row.note||'')}" placeholder="преміум-викладач, стаж…"></div>
      <p class="tiny muted">Для звичайних учителів преміум = 0. Надбавку за учнів понад ${c.bonusFrom} отримують усі.</p>
      <div class="field"><label>Додаткові ролі (доплата до зарплати)</label><div id="roles">${r.roles.map(roleRow).join('')}</div><button type="button" class="btn sm ghost" id="addrole">+ роль</button>
        <div class="tiny muted">«За місяць» — фіксована доплата щомісяця; «за годину» — ставка × години, які ви вносите щомісяця кнопкою «Години / сума».</div></div>`, async (x,f)=>{
      const roles=$$('.rrow',f).map(rw=>({role:($('[name=rr]',rw).value==='Інше'?($('[name=rx]',rw).value.trim()||'Інше'):$('[name=rr]',rw).value), type:$('[name=rt]',rw).value, rate:Number($('[name=rv]',rw).value)||0})).filter(o=>o.rate>0);
      await save('rates',{id:e,base:Number(x.base),premium:Number(x.premium)||0,note:x.note,roles:JSON.stringify(roles)}); A().toast('Ставку збережено'); reroute() });
    const bind=()=>$$('[data-rr]',w).forEach(x=>x.onclick=()=>x.closest('.rrow').remove());
    $('#addrole',w).onclick=()=>{ $('#roles',w).insertAdjacentHTML('beforeend',roleRow({role:'Лаборант',type:'month',rate:''})); bind() }; bind() });
  $$('[data-ex]').forEach(b=>b.onclick=()=>{ const e=b.dataset.ex, rp=rolePay(T,e,m);
    modal('Доплати за ролі · '+tname(e)+' · '+monthTitle(m), rp.map((o,i)=>`<div class="card" style="padding:12px;margin-bottom:8px"><b>${esc(o.role)}</b> <span class="small muted">${esc(roleLabel(o))}</span>
      <div class="grid g2" style="gap:10px;margin-top:6px">${o.type==='hour'?`<div class="field"><label>Відпрацьовано годин</label><input class="input" name="h${i}" type="number" min="0" step="0.5" value="${o.hours||''}"></div>`:''}
      <div class="field"><label>${o.type==='hour'?'Або сума вручну, грн':'Сума за цей місяць, грн'}</label><input class="input" name="a${i}" type="number" min="0" step="1" value="${o.override?o.sum:''}" placeholder="${o.type==='hour'?'ставка × години':UAH(o.rate)}"></div></div>
      <div class="field"><label>Коментар</label><input class="input" name="n${i}" value="${esc(o.note)}"></div></div>`).join('')+`<p class="tiny muted">Порожнє поле суми — розрахунок за ставкою. Щоб у цьому місяці не платити за роль, впишіть 0.</p>`,
      async x=>{ await save('extra', rp.map((o,i)=>({id:e+'|'+m+'|'+o.role,teacher:e,month:m,role:o.role,hours:x['h'+i]===undefined?'':x['h'+i],amount:x['a'+i],note:x['n'+i]}))); A().toast('Доплати збережено'); reroute() }) });
  $$('[data-det]').forEach(b=>b.onclick=()=>{ const s=S[b.dataset.det]||{items:[],roleItems:[]}; $('#det').innerHTML=`<h2 style="margin-top:22px">${esc(tname(b.dataset.det))} · ${monthTitle(m)}</h2><div class="card" style="padding:0;overflow:auto"><table class="prose ptable" style="width:100%;margin:0"><thead><tr><th>Дата</th><th>Група</th><th>Учнів</th><th>Ставка</th><th>Преміум</th><th>Надбавка</th><th>Разом</th></tr></thead><tbody>${(s.roleItems||[]).map(x=>`<tr><td>${monthTitle(m)}</td><td>Роль: ${esc(x.role)}</td><td></td><td colspan="3" class="small">${x.type==='hour'?`${x.hours} год × ${UAH(x.rate)}`:'фіксовано за місяць'}${x.override?' (сума змінена вручну)':''}</td><td><b>${UAH(x.sum)}</b></td></tr>`).join('')}${s.items.map(({l,p})=>`<tr><td>${fmtDate(l.date)} ${esc(l.time)}</td><td>${esc(l.g.name)}${l.sub?' <span class="pill warn">заміна</span>':''}</td><td>${p.present}</td><td>${UAH(p.base)}</td><td>${UAH(p.prem)}</td><td>${p.extra?`${p.extra} × ${UAH(c.bonusPer)}`:'—'}</td><td><b>${UAH(p.total)}</b></td></tr>`).join('')}</tbody></table></div>`; $('#det').scrollIntoView({behavior:'smooth'}) });
  $('#csv').onclick=()=>csv(`zarplata_${m}.csv`,[['Учитель','Email','Занять','Замін','Учнів','Ставки','Преміум','Надбавка','Доплати за ролі','Ролі','До виплати']].concat(emails.map(e=>{ const s=S[e]||{}; return [tname(e),e,s.lessons||0,s.subs||0,s.present||0,s.base||0,s.prem||0,s.bonus||0,s.roles||0,(s.roleItems||[]).map(x=>x.role+' '+x.sum).join(', '),s.total||0] })));
}

/* ---------- Фінансовий звіт ---------- */
function vFinance(p){
  const T=D.tables, m=p[0]&&/^\d{4}-\d\d$/.test(p[0])?p[0]:curMonth(), R=monthReport(T,m);
  const hist=[-5,-4,-3,-2,-1,0].map(k=>monthReport(T,shiftMonth(m,k))); const mx=Math.max(1,...hist.map(h=>Math.max(h.paid,h.salary+h.expenses)));
  const catMax=Math.max(1,...Object.values(R.byCat));
  crmShell('finance',`<div class="row noprint"><h1 class="grow" style="margin:0">Фінансовий звіт</h1><button class="btn ghost" id="pr">Друк / PDF</button><button class="btn ghost" id="csv">CSV</button><button class="btn" id="addx">+ Витрата</button></div>
    <div class="printonly"><h1>Фінансовий звіт · ${esc(D.branch)} · ${monthTitle(m)}</h1></div>
    <div class="noprint" style="margin-top:8px">${monthNav(m,'#/crm/finance')}</div>
    <div class="grid g4" style="margin-top:12px">${kpi('Надходження (оплати)',UAH(R.paid),'гроші, що надійшли','good')}${kpi('Зарплати вчителів',UAH(R.salary),`занять проведено: ${R.held}${Object.values(R.sal).some(x=>x.roles)?' · з доплатами за ролі':''}`)}${kpi('Інші витрати',UAH(R.expenses),`записів: ${R.exps.length}`)}${kpi('Прибуток',UAH(R.profitCash),'надходження − зарплати − витрати',R.profitCash<0?'bad':'good')}</div>
    <div class="grid g4" style="margin-top:12px">${kpi('Списано за уроки',UAH(R.charged),R.discGiven?`вартість відвіданих занять · знижки ${UAH(R.discGiven)}`:'вартість відвіданих занять')}${kpi('Прибуток за нарахуванням',UAH(R.profitAccr),'списано − зарплати − витрати',R.profitAccr<0?'bad':'')}${kpi('Відвідуваність',R.attPct===null?'—':R.attPct+'%',`присутні ${R.visits} · пропуски ${R.miss}`)}${kpi('Заняття',R.held+' / '+R.planned,`проведено / заплановано${R.cancelled?' · скасовано '+R.cancelled:''}`)}</div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><h3 style="margin-top:0">Надходження й витрати за 6 місяців</h3><div class="vbars">${hist.map(h=>`<div class="vb"><div class="vbx"><i style="height:${Math.round(100*h.paid/mx)}%;background:var(--good)" title="Надходження ${UAH(h.paid)}"></i><i style="height:${Math.round(100*(h.salary+h.expenses)/mx)}%;background:var(--red)" title="Витрати ${UAH(h.salary+h.expenses)}"></i></div><span class="tiny">${MONTHS[Number(h.month.slice(5))-1].slice(0,3)}</span><span class="tiny"><b>${UAH(h.paid-h.salary-h.expenses)}</b></span></div>`).join('')}</div>
        <div class="row tiny" style="gap:14px;margin-top:6px"><span><i class="lg" style="background:var(--good)"></i>надходження</span><span><i class="lg" style="background:var(--red)"></i>зарплати + витрати</span><span>під стовпчиками — прибуток</span></div></div>
      <div class="card"><h3 style="margin-top:0">Витрати за категоріями</h3>${R.salary?`<div class="hb"><span>Зарплати вчителів</span><div><i style="width:${Math.round(100*R.salary/Math.max(catMax,R.salary))}%"></i></div><b>${UAH(R.salary)}</b></div>`:''}${Object.keys(R.byCat).map(k=>`<div class="hb"><span>${esc(k)}</span><div><i style="width:${Math.round(100*R.byCat[k]/Math.max(catMax,R.salary))}%"></i></div><b>${UAH(R.byCat[k])}</b></div>`).join('')||'<p class="muted small">Витрат ще немає.</p>'}</div></div>
    <h2 style="margin-top:22px">Групи: відвідуваність і виручка</h2>
    <div class="card" style="padding:0;overflow:auto"><table class="prose ptable" style="width:100%;margin:0"><thead><tr><th>Група</th><th>Учитель</th><th>Відвідувань</th><th>Відвідуваність</th><th>Списано (виручка)</th></tr></thead><tbody>${R.byGroup.map(x=>`<tr><td><span class="sw" style="background:${courseColor(x.g.cid)}"></span> ${esc(x.g.name)}</td><td class="small">${esc(tname(x.g.teacher))}</td><td>${x.visits}</td><td>${x.pct===null?'—':`<div class="mini"><i style="width:${x.pct}%"></i></div> ${x.pct}%`}</td><td>${UAH(x.revenue)}</td></tr>`).join('')}</tbody></table></div>
    <h2 style="margin-top:22px">Витрати за ${monthTitle(m).toLowerCase()}</h2>
    <div class="card" style="padding:0;overflow:auto"><table class="prose ptable" style="width:100%;margin:0"><tbody>${R.exps.sort((a,b)=>String(a.date).localeCompare(b.date)).map(e=>`<tr><td>${esc(e.date)}</td><td>${esc(e.cat)}</td><td class="small">${esc(e.note||'')}</td><td style="text-align:right"><b>${UAH(e.amount)}</b></td><td class="noprint"><button class="btn sm ghost" data-dx="${e.id}">✕</button></td></tr>`).join('')||'<tr><td class="muted">Немає</td></tr>'}
      ${Object.values(R.sal).map(s=>`<tr><td></td><td>Зарплата</td><td class="small">${esc(tname(s.email))} · занять ${s.lessons}${s.roles?` · ролі: ${s.roleItems.map(x=>esc(x.role)).join(', ')} (${UAH(s.roles)})`:''}</td><td style="text-align:right"><b>${UAH(s.total)}</b></td><td class="noprint"></td></tr>`).join('')}</tbody></table></div>`);
  $('#pr').onclick=()=>print();
  $('#addx').onclick=()=>modal('Нова витрата',`<div class="grid g2" style="gap:10px"><div class="field"><label>Категорія</label><select class="input" name="cat">${EXP_CATS.map(x=>`<option>${x}</option>`).join('')}</select></div>
    <div class="field"><label>Сума, грн</label><input class="input" name="amount" type="number" min="1" step="1" required></div>
    <div class="field"><label>Дата</label><input class="input" name="date" type="date" required value="${m===curMonth()?today():m+'-01'}"></div><div class="field"><label>Відноситься до місяця</label><input class="input" name="month" type="month" required value="${m}"></div></div>
    <div class="field"><label>Коментар</label><input class="input" name="note" placeholder="оренда за листопад, 10 наборів…"></div>`, async x=>{ if(!(Number(x.amount)>0)) throw new Error('Вкажіть суму.'); await save('exps',{cat:x.cat,amount:Number(x.amount),date:x.date,month:x.month,note:x.note}); A().toast('Витрату додано'); reroute() });
  $$('[data-dx]').forEach(b=>b.onclick=async()=>{ if(!confirm('Видалити витрату?')) return; await del('exps',b.dataset.dx); reroute() });
  $('#csv').onclick=()=>csv(`finzvit_${m}.csv`,[['Показник','Сума, грн'],['Надходження (оплати)',R.paid],['Списано за уроки',R.charged],['Надано знижок',R.discGiven],['Зарплати вчителів',R.salary]].concat(Object.keys(R.byCat).map(k=>['Витрати: '+k,R.byCat[k]]),[['Прибуток (каса)',R.profitCash],['Прибуток (за нарахуванням)',R.profitAccr],['Відвідувань',R.visits],['Пропусків',R.miss],['Відвідуваність, %',R.attPct||0]]));
}

/* ---------- Налаштування ---------- */
function discRow(d){ return `<div class="row drow" data-id="${esc(d.id)}" style="gap:6px;margin-bottom:6px"><input class="input" name="dn" value="${esc(d.name)}" placeholder="Причина знижки" style="max-width:360px"><input class="input" name="dv" type="number" min="0" max="100" step="1" value="${esc(d.pct)}" style="max-width:90px"><span class="small muted">%</span><button type="button" class="btn sm ghost" data-rd>✕</button></div>` }
function vSettings(){
  const T=D.tables, c=cfgOf(T), {BETA}=A();
  crmShell('settings',`<h1>Налаштування CRM</h1><form class="card" id="sf" style="max-width:720px">
    <h3 style="margin-top:0">Оплата вчителям</h3>
    <div class="grid g2" style="gap:10px"><div class="field"><label>Ставка за урок за замовчуванням, грн</label><input class="input" name="defaultBase" type="number" min="0" value="${c.defaultBase}"><div class="tiny muted">Для вчителя без власної ставки.</div></div>
    <div class="field"><label>Преміум-відсоток рахується</label><select class="input" name="premiumMode"><option value="rate" ${c.premiumMode!=='revenue'?'selected':''}>від фіксованої ставки за урок</option><option value="revenue" ${c.premiumMode==='revenue'?'selected':''}>від виручки уроку (сума, списана з учнів)</option></select></div>
    <div class="field"><label>Надбавка — від якої кількості учнів</label><input class="input" name="bonusFrom" type="number" min="0" value="${c.bonusFrom}"><div class="tiny muted">Наприклад 5: шостий і кожен наступний присутній учень дає надбавку.</div></div>
    <div class="field"><label>Надбавка за кожного наступного учня, грн</label><input class="input" name="bonusPer" type="number" min="0" value="${c.bonusPer}"></div></div>
    <h3>Квитанції</h3><div class="grid g2" style="gap:10px">
    <div class="field"><label>Організація</label><input class="input" name="orgName" value="${esc(c.orgName)}"></div>
    <div class="field"><label>Структурний підрозділ</label><input class="input" name="unit" value="${esc(c.unit)}" placeholder="${esc(D.branch)}"></div>
    <div class="field"><label>Код за ЄДРПОУ / ІПН ФОП</label><input class="input" name="edrpou" value="${esc(c.edrpou)}"></div>
    <div class="field"><label>Одержав (ПІБ касира / адміністратора)</label><input class="input" name="cashier" value="${esc(c.cashier)}"></div>
    <div class="field"><label>Префікс номера квитанції</label><input class="input" name="receiptPrefix" value="${esc(c.receiptPrefix)}" placeholder="наприклад, ПЛТ"><div class="tiny muted">Номер: префікс/порядковий номер у філії.</div></div></div>
    <h3>Знижки на абонемент</h3><p class="small muted">Причини знижок і відсотки за замовчуванням. У картці учня можна вибрати одну чи кілька причин і змінити відсоток саме для цієї дитини.</p>
    <div id="discs">${c.discounts.map(discRow).join('')}</div><button type="button" class="btn sm ghost" id="adddisc">+ причина знижки</button>
    <div class="field" style="margin-top:12px;max-width:340px"><label>Максимальна сумарна знижка, %</label><input class="input" name="discMax" type="number" min="0" max="100" value="${c.discMax}"></div>
    <button class="btn" type="submit">Зберегти</button></form>
    <div class="card" style="max-width:720px;margin-top:16px"><h3 style="margin-top:0">Як рахується абонемент</h3><p class="small">Ціна уроку задається для кожної групи. Сума абонемента за місяць = ціна уроку × кількість занять групи в цьому місяці (за розкладом, без скасованих). За кожне відвідане заняття з балансу списується ціна уроку; пропуски не списуються. Від’ємний баланс = борг.</p>
    <p class="small">Змінити логін і пароль адміністратора філії може методист у своїй панелі.</p></div>
    ${BETA?`<div class="card" style="max-width:720px;margin-top:16px"><h3 style="margin-top:0">Бета</h3><p class="small">Дані CRM цієї філії зберігаються лише в цьому браузері. На початку додано демо-групи, учнів і оплати.</p><button class="btn ghost" id="reset">Почати з порожньої бази</button> <button class="btn ghost" id="demo">Повернути демо-дані</button></div>`:''}`);
  const bindD=()=>$$('[data-rd]').forEach(b=>b.onclick=()=>b.closest('.drow').remove()); bindD();
  $('#adddisc').onclick=()=>{ $('#discs').insertAdjacentHTML('beforeend',discRow({id:uid('d'),name:'',pct:5})); bindD() };
  $('#sf').onsubmit=async e=>{ e.preventDefault(); const x=Object.fromEntries(new FormData(e.target).entries());
    const discs=$$('#discs .drow').map(r=>({id:r.dataset.id,name:$('[name=dn]',r).value.trim(),pct:Math.max(0,Math.min(100,Number($('[name=dv]',r).value)||0))})).filter(d=>d.name);
    await save('cfg',['bonusFrom','bonusPer','defaultBase','premiumMode','discMax'].map(k=>({id:k,value:k==='premiumMode'?x[k]:Number(x[k])||0})).concat([{id:'discounts',value:JSON.stringify(discs)}],['orgName','unit','edrpou','cashier','receiptPrefix'].map(k=>({id:k,value:String(x[k]||'').trim()})))); A().toast('Налаштування збережено'); reroute() };
  if(BETA){ $('#reset').onclick=()=>{ if(!confirm('Видалити всі дані CRM цієї філії в браузері?')) return; Local.save(D.branch,Local.empty()); D=null; reroute() };
    $('#demo').onclick=()=>{ A().LS.del(Local.key(D.branch)); D=null; reroute() } }
}

/* ======================================================================
   УЧИТЕЛЬ: МІЙ РОЗКЛАД І ВІДМІТКИ
   ====================================================================== */
let TD=null;
async function teacherRoute(p){
  const {shell}=A();
  try{ if(!TD||p[0]==='reload'){ shell('schedule','<h1>Мій розклад</h1><div class="card"><p class="muted">Завантаження…</p></div>'); const j=await call('teacherData'); TD=j.tables } }
  catch(e){ return shell('schedule',`<h1>Мій розклад</h1><div class="callout bad"><b>Не вдалося завантажити розклад</b><p>${esc(e.message)}</p></div>`) }
  const me=A().S.user.email, ws=p[0]&&/^\d{4}-\d\d-\d\d$/.test(p[0])?weekStart(p[0]):weekStart(today()), we=addDays(ws,6);
  const all=lessonsIn(TD,ws,we), ai=attIndex(TD), mine=all.filter(l=>l.teacher===me), given=all.filter(l=>l.groupTeacher===me&&l.sub&&l.sub!==me);
  const m=curMonth(), [mf,mt]=monthRange(m); const ML=lessonsIn(TD,mf,mt).filter(l=>l.teacher===me); const c=cfgOf(TD);
  let earn=0, held=0; ML.forEach(l=>{ if(isHeld(l,ai[l.id])){ held++; earn+=lessonPay(TD,l,ai[l.id],c).total } });
  const rp=rolePay(TD,me,m).filter(x=>x.sum>0); earn+=rp.reduce((t,x)=>t+x.sum,0);
  const unmarked=lessonsIn(TD,addDays(today(),-14),addDays(today(),-1)).filter(l=>l.teacher===me&&!l.cancelled&&!isHeld(l,ai[l.id]));
  const stud=gid=>TD.students.filter(s=>s.status!=='archive'&&groupIds(s).includes(gid));
  shell('schedule',`<h1>Мій розклад</h1><p class="muted">Заняття, які ви проводите (разом із замінами). Після заняття відмітьте присутніх — так рахуються оплата учнів і ваша зарплата.</p>
    <div class="grid g3">${kpi('Проведено в '+MONTHS[Number(m.slice(5))-1].toLowerCase(),held+' з '+ML.filter(l=>!l.cancelled).length,'занять')}${kpi('Заробіток за місяць',UAH(earn),rp.length?'заняття + '+rp.map(x=>esc(x.role.toLowerCase())+' '+UAH(x.sum)).join(', '):'за відміченими заняттями','good')}${kpi('Невідмічені',unmarked.length,unmarked.length?'за останні 2 тижні':'усе відмічено',unmarked.length?'bad':'')}</div>
    ${unmarked.length?`<div class="callout warn" style="margin-top:14px"><b>Відмітьте заняття:</b> ${unmarked.map(l=>`<a href="#/schedule/${weekStart(l.date)}">${esc(l.g.name)} · ${fmtDate(l.date)}</a>`).join(' · ')}</div>`:''}
    <div class="row" style="margin-top:20px"><h2 class="grow" style="margin:0">${fmtDate(ws)} — ${fmtDate(we)}</h2><a class="btn sm ghost" href="#/schedule/${addDays(ws,-7)}">‹</a><a class="btn sm ghost" href="#/schedule/${addDays(ws,7)}">›</a>${ws!==weekStart(today())?'<a class="btn sm ghost" href="#/schedule">Цей тиждень</a>':''}<a class="btn sm ghost" href="#/schedule/reload">Оновити</a></div>
    ${WD.map((w,i)=>{ const d=addDays(ws,i), ls=mine.filter(l=>l.date===d), gv=given.filter(l=>l.date===d); if(!ls.length&&!gv.length) return '';
      return `<h3 style="margin:18px 0 8px">${WD_FULL[i]}, ${fmtDate(d)}${d===today()?' · сьогодні':''}</h3>`+ls.map(l=>{ const mk=ai[l.id]||{}, n=Object.keys(mk).length, pr=Object.values(mk).filter(a=>a.mark==='p').length, ss=stud(l.gid);
        return `<div class="card tl" style="border-left:5px solid ${courseColor(l.g.cid)}" data-lid="${esc(l.id)}"><div class="row"><div class="grow"><b>${esc(l.time)} · ${esc(l.g.name)}</b><div class="small muted">${esc(courseTitle(l.g.cid))} · ${esc(l.g.room||'')} · учнів: ${ss.length}${l.sub?' · <span class="pill warn">ви на заміні</span>':''}${l.extra?' · разове заняття':''}</div>${l.note?`<div class="small">Тема: ${esc(l.note)}</div>`:''}</div>
          ${l.cancelled?'<span class="pill bad">Скасовано</span>':n?`<span class="pill good">Відмічено ${pr}/${n}</span>`:''}${!l.cancelled&&l.date<=today()?`<button class="btn sm" data-mark="${esc(l.id)}">${n?'Змінити':'Відмітити'}</button>`:''}</div><div class="markbox"></div></div>` }).join('')
        +gv.map(l=>`<div class="card tl" style="opacity:.6"><b>${esc(l.time)} · ${esc(l.g.name)}</b> <span class="pill">заміна: проводить інший учитель</span></div>`).join('') }).join('')||'<div class="card" style="margin-top:12px"><p class="muted">На цьому тижні занять немає. Розклад складає адміністратор філії.</p></div>'}`);
  $$('[data-mark]').forEach(b=>b.onclick=()=>{ const l=all.find(x=>x.id===b.dataset.mark), box=$('.markbox',b.closest('.tl')), mk=ai[l.id]||{};
    const ss=stud(l.gid).concat(TD.students.filter(s=>mk[s.id]&&!groupIds(s).includes(l.gid)));
    box.innerHTML=`<div class="marks">${ss.map(s=>{ const v=(mk[s.id]||{}).mark||''; return `<div class="mrow" data-s="${s.id}"><span class="grow">${esc(s.child)}</span><button type="button" class="btn sm ${v==='p'?'':'ghost'}" data-v="p">✓ Присутній</button><button type="button" class="btn sm ${v==='a'?'':'ghost'}" data-v="a">Н Відсутній</button></div>` }).join('')||'<p class="muted small">У групі немає учнів.</p>'}</div>
      <div class="field" style="margin-top:8px"><label>Тема заняття</label><input class="input" id="note" value="${esc(l.note)}"></div><div class="row"><button class="btn sm ghost" id="allp" type="button">Усі присутні</button><span class="grow"></span><button class="btn" id="svm">Зберегти відмітки</button></div>`;
    $$('.mrow',box).forEach(r=>$$('[data-v]',r).forEach(x=>x.onclick=()=>{ const on=!x.classList.contains('ghost'); $$('[data-v]',r).forEach(y=>y.classList.add('ghost')); if(!on) x.classList.remove('ghost'); r.dataset.v=on?'':x.dataset.v }));
    $$('.mrow',box).forEach(r=>{ r.dataset.v=(mk[r.dataset.s]||{}).mark||'' });
    $('#allp',box).onclick=()=>$$('.mrow',box).forEach(r=>{ $$('[data-v]',r).forEach(y=>y.classList.toggle('ghost',y.dataset.v!=='p')); r.dataset.v='p' });
    $('#svm',box).onclick=async()=>{ const marks={}; $$('.mrow',box).forEach(r=>marks[r.dataset.s]=r.dataset.v||''); const btn=$('#svm',box); btn.disabled=true;
      try{ const j=await call('teacherMark',{gid:l.gid,date:l.date,time:l.time,marks,note:$('#note',box).value}); TD=j.tables; A().toast('Відмітки збережено'); teacherRoute([ws]) }catch(e){ A().toast(e.message); btn.disabled=false } };
  });
}

/* ======================================================================
   МЕТОДИСТ: ФІЛІЇ, АДМІНІСТРАТОРИ, УЧИТЕЛІ
   ====================================================================== */
async function methodistRoute(){
  const {shell, BETA}=A();
  shell('a:branches','<h1>Філії й адміністратори</h1><div class="card"><p class="muted">Завантаження…</p></div>');
  let adm, sum, people;
  try{ adm=(await call('mBranchAdmins')).admins; sum=(await call('mCrmSummary')); people=BETA?Object.values(Local.users()).map(u=>u.profile):((await A().API.adminCall('adminData')).teachers||[]) }
  catch(e){ return shell('a:branches',`<h1>Філії й адміністратори</h1><div class="callout bad">${esc(e.message)}</div>`) }
  const S=sum.branches;
  shell('a:branches',`<h1>Філії й адміністратори</h1><p class="muted">Вхід адміністраторів філій у CRM. Адміністратор бачить лише учнів, групи, фінанси й учителів своєї філії.</p>
    <div class="card" style="padding:0;overflow:auto"><table class="prose ptable" style="width:100%;margin:0"><thead><tr><th>Філія</th><th>Логін адміністратора</th><th>Учнів</th><th>Груп</th><th>Учителів</th><th>Оплачено (${monthTitle(sum.month).toLowerCase()})</th><th>Витрати</th><th>Боржники</th><th></th></tr></thead><tbody>
    ${adm.map(a=>{ const s=S.find(x=>x.branch===a.branch)||{}; return `<tr><td><b>${esc(a.branch)}</b></td><td><code>${esc(a.login)}</code></td><td>${s.students||0}</td><td>${s.groups||0}</td><td>${s.teachers||0}</td><td>${UAH(s.paid)}</td><td>${UAH(s.expenses)}</td><td>${s.debtors?`<span class="pill bad">${s.debtors} · ${UAH(-s.debt)}</span>`:'—'}</td><td><button class="btn sm" data-pw="${esc(a.branch)}" data-login="${esc(a.login)}">Змінити логін / пароль</button></td></tr>` }).join('')}</tbody></table></div>
    <h2 style="margin-top:24px">Учителі платформи</h2><p class="muted small">Видалення прибирає обліковий запис учителя, його прогрес навчання й доступи до бази курсів. Групи в CRM, де він був учителем, лишаються — адміністратор філії призначить іншого.</p>
    <div class="filters"><input class="input" id="q" placeholder="Пошук: ПІБ, пошта" style="max-width:320px"><select class="input" id="fb" style="max-width:240px"><option value="">Усі філії</option>${A().CFG.BRANCHES.map(b=>`<option>${esc(b)}</option>`).join('')}</select></div>
    <div class="card" style="padding:0;overflow:auto"><table class="prose ptable" style="width:100%;margin:0" id="tt"><thead><tr><th>Учитель</th><th>Філія</th><th>Телефон</th><th></th></tr></thead><tbody>
    ${people.sort((a,b)=>String(a.fio).localeCompare(String(b.fio),'uk')).map(t=>`<tr data-q="${esc((t.fio+' '+t.email).toLowerCase())}" data-b="${esc(t.branch)}"><td><a href="#/admin/person/${encodeURIComponent(t.email)}"><b>${esc(t.fio)}</b></a><div class="tiny">${esc(t.email)}</div></td><td>${esc(t.branch)}</td><td class="small">${esc(fmtPhone(t.phone||''))}</td><td><button class="btn sm ghost" data-del="${esc(t.email)}" data-fio="${esc(t.fio)}">Видалити з платформи</button></td></tr>`).join('')||'<tr><td class="muted">Учителів немає</td></tr>'}</tbody></table></div>`);
  $$('[data-pw]').forEach(b=>b.onclick=()=>modal('Адміністратор філії «'+b.dataset.pw+'»',`<div class="field"><label>Логін</label><input class="input" name="login" required value="${esc(b.dataset.login)}" autocomplete="off"></div>
    <div class="grid g2" style="gap:10px"><div class="field"><label>Новий пароль</label><input class="input" name="pw" type="text" minlength="6" required autocomplete="off"></div><div class="field"><label>Повторіть пароль</label><input class="input" name="pw2" type="text" minlength="6" required autocomplete="off"></div></div>
    <p class="tiny muted">Після зміни всі відкриті сесії адміністратора цієї філії завершаться. Повідомте новий пароль адміністратору особисто.</p>`, async x=>{
      if(x.pw!==x.pw2) throw new Error('Паролі не збігаються.'); const login=x.login.trim().toLowerCase(); await call('mSetBranchAdmin',{branch:b.dataset.pw,login,hash:await A().sha256('rs-academy|'+login+'|'+x.pw)}); A().toast('Логін і пароль змінено'); methodistRoute() }));
  $$('[data-del]').forEach(b=>b.onclick=async()=>{ if(!confirm(`Видалити вчителя «${b.dataset.fio}» з платформи? Обліковий запис і прогрес навчання буде видалено без можливості відновлення.`)) return;
    try{ await call('mDeleteTeacher',{email:b.dataset.del}); A().toast('Учителя видалено'); methodistRoute() }catch(e){ A().toast(e.message) } });
  const flt=()=>{ const q=$('#q').value.trim().toLowerCase(), br=$('#fb').value; $$('#tt tbody tr').forEach(r=>r.style.display=(!q||(r.dataset.q||'').includes(q))&&(!br||r.dataset.b===br)?'':'none') };
  $('#q').oninput=flt; $('#fb').onchange=flt;
}

function reset(){ D=null; TD=null }
window.RS_CRM = { route, teacherRoute, methodistRoute, reset, _sumWords:sumWords, _calc:{lessonsIn, balances, salaries, monthReport, abonement, lessonPay, rolePay, cfgOf} };
})();
