/* Robot School Academy — інтерактивні тренажери.
   Кожен тренажер: RS_TRAINERS[type](box, cfg, done, course); done(score, max, note) зараховує результат. */
(function(){
'use strict';
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle = a => { a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a };
const T = window.RS_TRAINERS = {};
function resultBox(box, score, max, r, retry, extra){
  let el = box.querySelector('.tr-result'); if(!el){ el=document.createElement('div'); el.className='tr-result'; box.prepend(el) }
  const pct = Math.round(100*score/max);
  el.innerHTML = `<div class="result ${r&&r.passed?'pass':'fail'}"><div class="row"><div class="big">${pct}%</div><div class="grow"><b>${score} з ${max}</b> — ${r&&r.passed?'тренажер зараховано.':'ще не зараховано, спробуйте ще раз.'}${extra?'<div class="small" style="margin-top:4px">'+extra+'</div>':''}</div>
    <button class="btn sm" type="button">Ще раз</button></div></div>`;
  el.querySelector('button').onclick = retry;
  el.scrollIntoView({behavior:'smooth',block:'center'});
}

/* ---------- 1. Відповідності ---------- */
T.match = function(box,cfg,done){
  const pairs = shuffle(cfg.pairs);
  const rights = shuffle(cfg.pairs.map(p=>p[1]));
  box.innerHTML = `<div class="card">${pairs.map((p,i)=>`<div class="tr-row" data-i="${i}"><div class="grow"><b>${p[0]}</b></div>
     <select class="input" style="max-width:52%"><option value="">— оберіть —</option>${rights.map(r=>`<option>${esc(r)}</option>`).join('')}</select></div>`).join('')}
     <div class="row" style="margin-top:12px"><button class="btn" id="chk">Перевірити</button><span class="small muted">${esc(cfg.hint||'')}</span></div></div>`;
  box.querySelector('#chk').onclick=()=>{
    let s=0; box.querySelectorAll('.tr-row').forEach(row=>{ const p=pairs[+row.dataset.i]; const ok=row.querySelector('select').value===p[1]; row.classList.toggle('ok',ok); row.classList.toggle('no',!ok); if(ok)s++ });
    const r=done(s,pairs.length); resultBox(box,s,pairs.length,r,()=>T.match(box,cfg,done));
  };
};

/* ---------- 2. Послідовність ---------- */
T.order = function(box,cfg,done){
  let cur = shuffle(cfg.items.map((t,i)=>({t,i})));
  while(cfg.items.length>2 && cur.every((x,k)=>x.i===k)) cur=shuffle(cur);
  const draw=()=>{
    box.innerHTML = `<div class="card"><p class="small muted">${esc(cfg.hint||'Розташуйте кроки в правильному порядку кнопками ↑ ↓ (або перетягніть).')}</p>
      <div id="ol">${cur.map((x,k)=>`<div class="tr-row" draggable="true" data-k="${k}"><b style="width:26px">${k+1}.</b><div class="grow">${cfg.code?`<code style="white-space:pre;background:none">${esc(x.t)}</code>`:x.t}</div>
      <button class="ord-btn" data-u="${k}">↑</button><button class="ord-btn" data-d="${k}">↓</button></div>`).join('')}</div>
      <div class="row" style="margin-top:12px"><button class="btn" id="chk">Перевірити</button></div></div>`;
    box.querySelectorAll('[data-u]').forEach(b=>b.onclick=()=>{const k=+b.dataset.u; if(k>0){[cur[k-1],cur[k]]=[cur[k],cur[k-1]]; draw()}});
    box.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{const k=+b.dataset.d; if(k<cur.length-1){[cur[k+1],cur[k]]=[cur[k],cur[k+1]]; draw()}});
    let from=null;
    box.querySelectorAll('#ol .tr-row').forEach(r=>{ r.ondragstart=()=>{from=+r.dataset.k}; r.ondragover=e=>e.preventDefault(); r.ondrop=e=>{e.preventDefault(); const to=+r.dataset.k; if(from===null||from===to) return; const [m]=cur.splice(from,1); cur.splice(to,0,m); draw()} });
    box.querySelector('#chk').onclick=()=>{
      let s=0; box.querySelectorAll('#ol .tr-row').forEach((row,k)=>{ const ok=cur[k].i===k; row.classList.add(ok?'ok':'no'); if(ok)s++ });
      const r=done(s,cur.length); resultBox(box,s,cur.length,r,()=>T.order(box,cfg,done), s<cur.length?'Зелені рядки стоять на своїх місцях, червоні — ні.':'');
    };
  };
  draw();
};

/* ---------- 3. Класифікація ---------- */
T.classify = function(box,cfg,done){
  const items = shuffle(cfg.items);
  box.innerHTML = `<div class="card"><p class="small muted">${esc(cfg.hint||'Віднесіть кожен елемент до правильної категорії.')}</p>${items.map((it,i)=>`<div class="tr-row" data-i="${i}"><div class="grow">${it[0]}</div>
    <select class="input" style="max-width:46%"><option value="">— категорія —</option>${cfg.cats.map((c,ci)=>`<option value="${ci}">${esc(c)}</option>`).join('')}</select></div>`).join('')}
    <div class="row" style="margin-top:12px"><button class="btn" id="chk">Перевірити</button></div></div>`;
  box.querySelector('#chk').onclick=()=>{
    let s=0; box.querySelectorAll('.tr-row').forEach(row=>{ const it=items[+row.dataset.i]; const v=row.querySelector('select').value; const ok=v!==''&&+v===it[1]; row.classList.toggle('ok',ok); row.classList.toggle('no',!ok); if(ok)s++;
      if(!ok && !row.querySelector('.fix')){ const f=document.createElement('span'); f.className='fix tiny'; f.textContent='→ '+cfg.cats[it[1]]; row.querySelector('.grow').appendChild(document.createElement('br')); row.querySelector('.grow').appendChild(f) } });
    const r=done(s,items.length); resultBox(box,s,items.length,r,()=>T.classify(box,cfg,done));
  };
};

/* ---------- 4. Картки-вибір (швидкий тренінг) ---------- */
T.choice = function(box,cfg,done){
  const cards = shuffle(cfg.cards).slice(0,cfg.take||cfg.cards.length);
  let k=0, s=0;
  const show=()=>{
    if(k>=cards.length){ box.innerHTML=''; const r=done(s,cards.length); resultBox(box,s,cards.length,r,()=>T.choice(box,cfg,done)); return }
    const c=cards[k]; const opts=shuffle(c.o.map((t,i)=>({t,i})));
    box.innerHTML = `<div class="card"><div class="row"><span class="pill">${k+1} / ${cards.length}</span><span class="grow"></span><span class="small muted">Правильних: ${s}</span></div>
      <h3 style="margin:14px 0">${c.q}</h3>${c.code?`<pre><code>${esc(c.code)}</code></pre>`:''}
      <div class="grid ${opts.length>3?'g2':''}" style="gap:8px">${opts.map(o=>`<button class="opt" data-i="${o.i}" style="text-align:left;font-weight:600">${o.t}</button>`).join('')}</div>
      <div class="ex hide"></div><div class="row" style="margin-top:12px"><button class="btn hide" id="nx">Далі →</button></div></div>`;
    box.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
      if(box.querySelector('.opt.right')) return;
      const ok=+b.dataset.i===c.a; if(ok) s++;
      box.querySelectorAll('.opt').forEach(x=>{ if(+x.dataset.i===c.a) x.classList.add('right'); else if(x===b) x.classList.add('wrong') });
      const ex=box.querySelector('.ex'); if(c.ex){ ex.innerHTML=c.ex; ex.classList.remove('hide') }
      const nx=box.querySelector('#nx'); nx.classList.remove('hide'); nx.onclick=()=>{k++;show()}; nx.focus();
    });
  };
  show();
};

/* ---------- 5. Симулятор зубчастої передачі (LEGO) ---------- */
function gearPath(z, r){
  const ro=r, ri=r-7, n=z*2, pts=[];
  for(let i=0;i<n;i++){ const a0=(i/n)*Math.PI*2, a1=((i+1)/n)*Math.PI*2, rr=i%2?ri:ro;
    pts.push([Math.cos(a0+0.06)*rr, Math.sin(a0+0.06)*rr],[Math.cos(a1-0.06)*rr, Math.sin(a1-0.06)*rr]) }
  return 'M'+pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L')+' Z';
}
T.gears = function(box,cfg,done){
  const sizes=[8,16,24,40];
  const tasks = cfg.tasks;
  const st = {a:24,b:24,idler:false,ti:0,ok:tasks.map(()=>false)};
  let ang=0, raf=0, last=0;
  const R = z => 6+z*2.1;
  box.innerHTML = `<div class="grid g2" style="align-items:start">
   <div class="card"><svg id="gsv" viewBox="0 0 520 300" style="width:100%;background:var(--panel2);border-radius:14px"></svg>
     <div class="row small" style="margin-top:10px"><span>Ведуча (від мотора): <b id="gA"></b></span><span>Ведена: <b id="gB"></b></span><span class="grow"></span><span id="gR" class="pill"></span></div></div>
   <div class="card"><h3>Налаштування</h3>
     <div class="field"><label>Ведуча шестерня (на валу мотора)</label><select class="input" id="sa">${sizes.map(z=>`<option ${z===24?'selected':''} value="${z}">${z} зубців</option>`).join('')}</select></div>
     <div class="field"><label>Ведена шестерня (на робочому валу)</label><select class="input" id="sb">${sizes.map(z=>`<option ${z===24?'selected':''} value="${z}">${z} зубців</option>`).join('')}</select></div>
     <label class="row small" style="gap:8px;margin-bottom:12px"><input type="checkbox" id="si"> Додати проміжну (паразитну) шестерню 16 зубців</label>
     <div id="tasks"></div>
   </div></div>`;
  const svg=box.querySelector('#gsv');
  function draw(){
    const ra=R(st.a), rb=R(st.b), ri=R(16);
    const cy=150; let xa=40+ra, xi=xa+ra+ri-6, xb=(st.idler?xi+ri:xa+ra)+rb-6;
    const total = xb+rb; const sc = Math.min(1, 500/total); const ox=(520-total*sc)/2;
    const ratio = st.a/st.b; const dir = st.idler?1:-1;
    const g=(x,r,z,a,col,label)=>`<g transform="translate(${ox+x*sc} ${cy}) scale(${sc})"><g transform="rotate(${a})"><path d="${gearPath(z,r)}" fill="${col}" stroke="#0B1A3F" stroke-width="1.5"/><circle r="${Math.max(5,r*0.18)}" fill="#fff" stroke="#0B1A3F"/><rect x="-2" y="${-r+12}" width="4" height="${r*0.5}" fill="#0B1A3F"/></g><text y="${r+22}" text-anchor="middle" font-size="${14/sc>20?20:14/sc}" fill="currentColor" font-weight="700">${label}</text></g>`;
    svg.innerHTML = `<g style="color:var(--ink)">${g(xa,ra,st.a,ang,'#F2552C','ведуча '+st.a)}${st.idler?g(xi,ri,16,-ang*st.a/16+11,'#9AA7C7','проміжна 16'):''}${g(xb,rb,st.b,dir*ang*ratio+(180/st.b),'#FFC400','ведена '+st.b)}</g>`;
    box.querySelector('#gA').textContent=st.a; box.querySelector('#gB').textContent=st.b;
    const k = st.b/st.a;
    box.querySelector('#gR').textContent = k===1?'швидкість однакова': k>1?`повільніше в ${+k.toFixed(2)} раза, сильніше`:`швидше в ${+(1/k).toFixed(2)} раза, слабше`;
  }
  function loop(t){ if(!box.isConnected){cancelAnimationFrame(raf);return} const dt=Math.min(50,t-(last||t)); last=t; ang=(ang+dt*0.09)%360000; draw(); raf=requestAnimationFrame(loop) }
  function renderTasks(){
    const tb=box.querySelector('#tasks');
    tb.innerHTML = `<h4>Завдання ${Math.min(st.ti+1,tasks.length)} з ${tasks.length}</h4>`+
      (st.ti<tasks.length?`<p>${tasks[st.ti].text}</p><button class="btn" id="gchk">Перевірити налаштування</button> <button class="btn ghost sm" id="gskip">Пропустити</button><div class="ex hide" id="gex"></div>`:'<p>Усі завдання переглянуто.</p>')+
      `<div class="row small" style="margin-top:12px;gap:6px">${tasks.map((t,i)=>`<span class="pill ${st.ok[i]?'good':i<st.ti?'bad':''}">${i+1}</span>`).join('')}</div>`;
    const c=tb.querySelector('#gchk'); if(c) c.onclick=()=>{
      const t=tasks[st.ti]; const k=st.b/st.a; const sameDir=st.idler;
      let ok = Math.abs(k-t.ratio)<1e-6 && (t.same===undefined || t.same===sameDir);
      const ex=tb.querySelector('#gex'); ex.classList.remove('hide');
      if(ok){ st.ok[st.ti]=true; ex.innerHTML='<b style="color:var(--good)">Вірно!</b> '+(t.ex||''); setTimeout(()=>{st.ti++;renderTasks();finish()},1400) }
      else ex.innerHTML='<b style="color:var(--bad)">Ще ні.</b> Передавальне відношення = зубці веденої ÷ зубці ведучої. Зараз: '+st.b+' ÷ '+st.a+' = '+(+k.toFixed(2))+(t.same!==undefined?'. Напрямок: '+(sameDir?'той самий, що в мотора':'протилежний'):'');
    };
    const sk=tb.querySelector('#gskip'); if(sk) sk.onclick=()=>{st.ti++;renderTasks();finish()};
  }
  let finished=false;
  function finish(){ if(st.ti>=tasks.length && !finished){ finished=true; const s=st.ok.filter(Boolean).length; const r=done(s,tasks.length); resultBox(box,s,tasks.length,r,()=>{cancelAnimationFrame(raf);T.gears(box,cfg,done)}) } }
  box.querySelector('#sa').onchange=e=>{st.a=+e.target.value};
  box.querySelector('#sb').onchange=e=>{st.b=+e.target.value};
  box.querySelector('#si').onchange=e=>{st.idler=e.target.checked};
  renderTasks(); raf=requestAnimationFrame(loop);
};

/* ---------- 6. Конструктор програм WeDo 2.0 (спрощена модель) ---------- */
const WB = {
  start:{t:'▶ Старт',c:'#F5A623'},
  cw:{t:'↻ Мотор за год. стрілкою',c:'#2D9CDB'}, ccw:{t:'↺ Мотор проти год. стрілки',c:'#2D9CDB'},
  power:{t:'⚡ Потужність',c:'#2D9CDB',p:{type:'num',min:0,max:10,def:5}},
  ontime:{t:'⏱ Мотор увімкнути на, с',c:'#2D9CDB',p:{type:'num',min:0,max:30,def:3}},
  off:{t:'■ Мотор стоп',c:'#2D9CDB'},
  light:{t:'💡 Колір хаба',c:'#9B51E0',p:{type:'sel',opts:['вимкн.','рожевий','фіолетовий','синій','блакитний','бірюзовий','зелений','жовтий','помаранчевий','червоний','білий'],def:9}},
  sound:{t:'🔊 Звук №',c:'#9B51E0',p:{type:'num',min:1,max:20,def:1}},
  wait:{t:'⏳ Чекати, с',c:'#F2C94C',p:{type:'num',min:0,max:30,def:1}},
  waitnear:{t:'👁 Чекати: об’єкт наближається',c:'#F2C94C'},
  loop:{t:'🔁 Повторювати (усе нижче)',c:'#F5A623'}
};
const HUBC=['#555','#FF7AC6','#9B51E0','#2F80ED','#56CCF2','#1ABC9C','#27AE60','#F2C94C','#F2994A','#EB5757','#FFFFFF'];
T.wedo = function(box,cfg,done){
  const tasks=cfg.tasks; let ti=0; const okk=tasks.map(()=>false);
  let prog=[]; let running=false; let stopFlag=false;
  box.innerHTML = `<div class="grid g2" style="align-items:start">
    <div class="card"><h3 id="wt"></h3><p id="wd" class="small"></p>
      <div class="small muted" style="margin-bottom:6px">Палітра блоків (натисніть, щоб додати в кінець програми):</div>
      <div class="blocks" id="pal">${Object.keys(WB).map(k=>`<button class="wblock" data-k="${k}" style="background:${WB[k].c};${['wait','waitnear'].includes(k)?'color:#3a2a00':''}">${WB[k].t}</button>`).join('')}</div>
      <div class="small muted" style="margin:14px 0 6px">Програма (натисніть ✕, щоб видалити блок):</div>
      <div class="prog" id="prog"></div>
      <div class="row" style="margin-top:12px"><button class="btn" id="run">▶ Запустити</button><button class="btn ghost" id="stop">■ Стоп</button><button class="btn ghost" id="clr">Очистити</button><span class="grow"></span><button class="btn good" id="chk">Перевірити завдання</button></div>
      <div class="ex hide" id="wex"></div>
    </div>
    <div class="card"><h3>Модель</h3>
      <svg viewBox="0 0 300 200" style="width:100%;background:var(--panel2);border-radius:14px">
        <rect x="30" y="70" width="110" height="80" rx="14" fill="#F2F2F2" stroke="#0B1A3F" stroke-width="2"/><circle id="hub" cx="85" cy="110" r="16" fill="#555" stroke="#0B1A3F" stroke-width="2"/><text x="85" y="166" text-anchor="middle" font-size="12" fill="currentColor">Smart Hub</text>
        <g transform="translate(215 110)"><g id="wheel"><circle r="46" fill="#FFC400" stroke="#0B1A3F" stroke-width="2"/><rect x="-4" y="-44" width="8" height="40" fill="#0B1A3F"/><circle r="8" fill="#fff" stroke="#0B1A3F"/></g></g>
        <line x1="140" y1="110" x2="169" y2="110" stroke="#0B1A3F" stroke-width="4"/>
      </svg>
      <div class="row small" style="margin-top:10px"><span>Мотор: <b id="ms">стоп</b></span><span>Потужність: <b id="mp">5</b></span><span class="grow"></span><button class="btn sm soft" id="near" disabled>✋ Піднести руку до датчика</button></div>
      <div class="console" id="log" style="margin-top:10px"></div>
      <div class="row small" style="margin-top:10px;gap:6px" id="dots"></div>
    </div></div>`;
  const $=s=>box.querySelector(s);
  const log=m=>{ const l=$('#log'); l.textContent+=m+'\n'; l.scrollTop=1e9 };
  function showTask(){ const t=tasks[ti]; $('#wt').textContent=`Завдання ${ti+1} з ${tasks.length}: ${t.title}`; $('#wd').innerHTML=t.text; $('#wex').classList.add('hide');
    $('#dots').innerHTML=tasks.map((x,i)=>`<span class="pill ${okk[i]?'good':''}">${i+1}</span>`).join('') }
  function drawProg(){
    $('#prog').innerHTML = prog.length? prog.map((b,i)=>{ const d=WB[b.k]; let p='';
      if(d.p&&d.p.type==='num') p=`<input type="number" min="${d.p.min}" max="${d.p.max}" value="${b.v}" data-i="${i}" style="width:48px">`;
      if(d.p&&d.p.type==='sel') p=`<select data-i="${i}">${d.p.opts.map((o,oi)=>`<option value="${oi}" ${oi==b.v?'selected':''}>${o}</option>`).join('')}</select>`;
      return `<span class="wblock" style="background:${d.c};${['wait','waitnear'].includes(b.k)?'color:#3a2a00':''}">${d.t} ${p}<span class="x" data-x="${i}">✕</span></span>` }).join('<span class="muted">→</span>') : '<span class="tiny">Почніть із блока «Старт»</span>';
    box.querySelectorAll('#prog [data-x]').forEach(x=>x.onclick=()=>{prog.splice(+x.dataset.x,1);drawProg()});
    box.querySelectorAll('#prog input,#prog select').forEach(x=>x.onchange=()=>{prog[+x.dataset.i].v=+x.value});
  }
  box.querySelectorAll('#pal .wblock').forEach(b=>b.onclick=()=>{ const d=WB[b.dataset.k]; prog.push({k:b.dataset.k,v:d.p?d.p.def:null}); drawProg() });
  $('#clr').onclick=()=>{prog=[];drawProg()};
  // симуляція
  let rot=0, speed=0, dir=1, power=5, raf=0, last=0, nearResolve=null;
  function anim(t){ if(!box.isConnected){cancelAnimationFrame(raf);return} const dt=Math.min(50,t-(last||t)); last=t; rot+=speed*dir*dt*0.06; $('#wheel').setAttribute('transform',`rotate(${rot})`); raf=requestAnimationFrame(anim) }
  raf=requestAnimationFrame(anim);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function waitMs(ms){ const end=Date.now()+ms; while(Date.now()<end){ if(stopFlag) throw 'stop'; await sleep(40) } }
  async function exec(b){
    if(stopFlag) throw 'stop';
    switch(b.k){
      case 'cw': dir=1; log('Напрямок: за годинниковою'); break;
      case 'ccw': dir=-1; log('Напрямок: проти годинникової'); break;
      case 'power': power=b.v; $('#mp').textContent=power; if(speed) speed=power; log('Потужність '+power); break;
      case 'ontime': speed=power; $('#ms').textContent='обертається'; log('Мотор увімкнено на '+b.v+' с'); await waitMs(b.v*1000); speed=0; $('#ms').textContent='стоп'; break;
      case 'off': speed=0; $('#ms').textContent='стоп'; log('Мотор зупинено'); break;
      case 'light': $('#hub').setAttribute('fill',HUBC[b.v]); log('Хаб: '+WB.light.p.opts[b.v]); break;
      case 'sound': log('♪ Звук №'+b.v); break;
      case 'wait': log('Чекаємо '+b.v+' с'); await waitMs(b.v*1000); break;
      case 'waitnear': log('Чекаємо на датчик відстані… (натисніть «Піднести руку»)'); $('#near').disabled=false; await new Promise((res,rej)=>{ nearResolve=res; const iv=setInterval(()=>{ if(stopFlag){clearInterval(iv);rej('stop')} if(!nearResolve){clearInterval(iv)} },50) }); $('#near').disabled=true; log('Датчик: об’єкт наближається!'); break;
    }
  }
  $('#near').onclick=()=>{ if(nearResolve){ const r=nearResolve; nearResolve=null; r() } };
  $('#stop').onclick=()=>{ stopFlag=true; speed=0; $('#ms').textContent='стоп' };
  $('#run').onclick=async()=>{
    if(running) return; $('#log').textContent=''; stopFlag=false; running=true; dir=1; power=5; $('#mp').textContent=5; $('#hub').setAttribute('fill','#555');
    try{
      if(!prog.length||prog[0].k!=='start'){ log('⚠ Програма має починатися з блока «Старт» — інакше WeDo її не виконає.'); throw 'stop' }
      const li=prog.findIndex(b=>b.k==='loop');
      const pre = li<0?prog.slice(1):prog.slice(1,li), body = li<0?[]:prog.slice(li+1);
      for(const b of pre) await exec(b);
      if(li>=0){ let n=0; if(!body.length){log('⚠ Цикл порожній');throw 'stop'}
        const hasTime = body.some(b=>['ontime','wait','waitnear'].includes(b.k));
        if(!hasTime) log('⚠ У циклі немає очікування — модель «смикатиметься». Додайте «Чекати» або «Мотор увімкнути на».');
        while(!stopFlag && n<200){ for(const b of body) await exec(b); n++; if(!hasTime) await waitMs(300) } }
      log('Програму завершено.');
    }catch(e){ if(e!=='stop') log('Помилка: '+e) }
    running=false; speed=0; $('#ms').textContent='стоп'; $('#near').disabled=true;
  };
  $('#chk').onclick=()=>{
    const t=tasks[ti]; const res=t.check(prog.map(b=>({k:b.k,v:b.v})));
    const ex=$('#wex'); ex.classList.remove('hide');
    if(res===true){ okk[ti]=true; ex.innerHTML='<b style="color:var(--good)">Програма відповідає завданню.</b> '+(t.ex||''); setTimeout(next,1500) }
    else ex.innerHTML='<b style="color:var(--bad)">Ще ні:</b> '+res+' <button class="btn sm ghost" id="skip">Пропустити</button>';
    const sk=$('#skip'); if(sk) sk.onclick=next;
  };
  function next(){ stopFlag=true; ti++; prog=[]; drawProg(); if(ti>=tasks.length){ const s=okk.filter(Boolean).length; const r=done(s,tasks.length); resultBox(box,s,tasks.length,r,()=>{cancelAnimationFrame(raf);T.wedo(box,cfg,done)}); ti=tasks.length-1; showTask(); return } showTask() }
  showTask(); drawProg();
};
/* помічники для перевірки програм WeDo */
window.RS_WEDO = {
  has:(p,k,pred)=>p.some(b=>b.k===k&&(!pred||pred(b.v))),
  idx:(p,k)=>p.findIndex(b=>b.k===k)
};

/* ---------- 7. Координати Processing ---------- */
T.coords = function(box,cfg,done){
  const W=cfg.w||400, H=cfg.h||300;
  const rnd=(a,b,s)=>Math.round((a+Math.random()*(b-a))/s)*s;
  const tasks=[];
  for(let i=0;i<(cfg.click||5);i++) tasks.push({type:'click',x:rnd(20,W-20,10),y:rnd(20,H-20,10)});
  for(let i=0;i<(cfg.read||4);i++){ const x=rnd(20,W-20,10), y=rnd(20,H-20,10); const opts=shuffle([[x,y],[y,x],[x,H-y],[W-x,y]].filter((o,j,a)=>a.findIndex(q=>q[0]===o[0]&&q[1]===o[1])===j)); tasks.push({type:'read',x,y,opts}) }
  let k=0,s=0;
  box.innerHTML=`<div class="grid g2" style="align-items:start"><div class="card"><canvas id="cv" width="${W}" height="${H}" class="tr-canvas" style="width:100%;cursor:crosshair"></canvas><div class="tiny" style="margin-top:6px">Вікно size(${W}, ${H}). Початок координат (0, 0) — у лівому верхньому куті, вісь y спрямована вниз.</div></div>
    <div class="card"><div class="row"><span class="pill" id="cn"></span><span class="grow"></span><span class="small muted" id="cs"></span></div><h3 id="cq" style="margin-top:12px"></h3><div id="co"></div><div class="ex hide" id="cex"></div><button class="btn hide" id="cnx" style="margin-top:10px">Далі →</button></div></div>`;
  const cv=box.querySelector('#cv'), g=cv.getContext('2d');
  function grid(){ g.fillStyle='#fff';g.fillRect(0,0,W,H); g.strokeStyle='#E3E8F5'; g.lineWidth=1; for(let x=0;x<=W;x+=50){g.beginPath();g.moveTo(x+.5,0);g.lineTo(x+.5,H);g.stroke()} for(let y=0;y<=H;y+=50){g.beginPath();g.moveTo(0,y+.5);g.lineTo(W,y+.5);g.stroke()}
    g.fillStyle='#7C87A8'; g.font='11px sans-serif'; for(let x=50;x<W;x+=50) g.fillText(x,x+2,11); for(let y=50;y<H;y+=50) g.fillText(y,2,y-2); g.fillStyle='#0A44DC'; g.fillText('(0,0)',3,22) }
  function dot(x,y,c){ g.fillStyle=c; g.beginPath(); g.arc(x,y,6,0,7); g.fill() }
  let answered=false;
  function show(){
    if(k>=tasks.length){ const r=done(s,tasks.length); resultBox(box,s,tasks.length,r,()=>T.coords(box,cfg,done)); return }
    answered=false; const t=tasks[k]; grid();
    box.querySelector('#cn').textContent=`${k+1} / ${tasks.length}`; box.querySelector('#cs').textContent='Правильних: '+s;
    box.querySelector('#cex').classList.add('hide'); box.querySelector('#cnx').classList.add('hide');
    if(t.type==='click'){ box.querySelector('#cq').innerHTML=`Клацніть у точку <code>(${t.x}, ${t.y})</code>`; box.querySelector('#co').innerHTML='<p class="small muted">Наприклад, так задається центр кола: <code>ellipse('+t.x+', '+t.y+', 20, 20)</code></p>' }
    else { dot(t.x,t.y,'#F2552C'); box.querySelector('#cq').textContent='Які координати червоної точки?';
      box.querySelector('#co').innerHTML=t.opts.map((o,i)=>`<button class="opt" data-i="${i}" style="width:100%;font-weight:600">(${o[0]}, ${o[1]})</button>`).join('');
      box.querySelectorAll('#co .opt').forEach(b=>b.onclick=()=>{ if(answered)return; answered=true; const o=t.opts[+b.dataset.i]; const ok=o[0]===t.x&&o[1]===t.y; if(ok)s++; b.classList.add(ok?'right':'wrong');
        box.querySelectorAll('#co .opt').forEach(x=>{const oo=t.opts[+x.dataset.i]; if(oo[0]===t.x&&oo[1]===t.y) x.classList.add('right')});
        fb(ok, ok?'':'Пам’ятайте: перше число — x (вправо), друге — y (униз від верхнього краю).') }) }
  }
  function fb(ok,msg){ const e=box.querySelector('#cex'); e.classList.remove('hide'); e.innerHTML=(ok?'<b style="color:var(--good)">Так!</b> ':'<b style="color:var(--bad)">Ні.</b> ')+msg; const n=box.querySelector('#cnx'); n.classList.remove('hide'); n.onclick=()=>{k++;show()} }
  cv.onclick=e=>{ const t=tasks[k]; if(!t||t.type!=='click'||answered) return; answered=true; const r=cv.getBoundingClientRect(); const x=(e.clientX-r.left)*W/r.width, y=(e.clientY-r.top)*H/r.height;
    const d=Math.hypot(x-t.x,y-t.y); const ok=d<=15; if(ok)s++; dot(t.x,t.y,'#12A37F'); dot(x,y,ok?'#12A37F':'#F2552C');
    fb(ok, ok?`Ви влучили з точністю ${Math.round(d)} px.`:`Ви клацнули в (${Math.round(x)}, ${Math.round(y)}). Зелена точка — правильна.`) };
  show();
};

/* ---------- 8. Пісочниця Processing (Python) з завданнями ---------- */
T.sandbox = function(box,cfg,done){
  const P = window.RS_PROCESSING;
  const ch = cfg.challenges||[];
  let ci=0; const okk=ch.map(()=>false);
  box.innerHTML = `<div class="callout info small"><b>Як це працює</b><p>Код виконується прямо в браузері інтерпретатором Python (Skulpt) з підтримкою основних команд Processing Python Mode: <code>size, background, fill, stroke, rect, ellipse, line, triangle, arc, text</code>, <code>setup()</code>/<code>draw()</code>, <code>mouseX</code>, <code>keyPressed</code>, <code>random()</code> тощо. Зображення (<code>loadImage</code>) тут замінюються сірими заглушками.</p></div>
   <div class="row" style="margin-bottom:10px;gap:6px" id="tabs"></div>
   <div class="grid g2" style="align-items:start">
     <div class="card"><h3 id="sh"></h3><div id="sd" class="small"></div>
       <textarea class="code" id="code" spellcheck="false"></textarea>
       <div class="row" style="margin-top:10px"><button class="btn" id="run">▶ Запустити</button><button class="btn ghost" id="stop">■ Стоп</button><span class="grow"></span><button class="btn good" id="chk">Перевірити</button></div>
       <div class="console" id="out" style="margin-top:10px"></div>
       <div class="ex hide" id="sx"></div></div>
     <div class="card"><div class="row small"><b>Ваш результат</b><span class="grow"></span><span class="tiny">клацніть по полотну, щоб керувати клавішами</span></div>
       <canvas id="cv" class="tr-canvas" width="100" height="100" tabindex="0" style="margin-top:8px"></canvas>
       <div id="tgtwrap"><div class="small" style="margin-top:12px"><b>Ціль</b> (має вийти так само)</div><canvas id="tg" class="tr-canvas" width="100" height="100" style="margin-top:8px"></canvas></div></div>
   </div>`;
  const $=s=>box.querySelector(s);
  const ed=$('#code');
  ed.addEventListener('keydown',e=>{ if(e.key==='Tab'){ e.preventDefault(); const s=ed.selectionStart; ed.value=ed.value.slice(0,s)+'    '+ed.value.slice(ed.selectionEnd); ed.selectionStart=ed.selectionEnd=s+4 } });
  if(!P){ $('#out').innerHTML='<span class="e">Модуль Processing не завантажився.</span>'; return }
  function tabs(){ $('#tabs').innerHTML = ch.map((c,i)=>`<button class="btn sm ${i===ci?'':'ghost'}" data-i="${i}">${okk[i]?'✓ ':''}${i+1}. ${esc(c.title)}</button>`).join('') + (cfg.free?`<button class="btn sm ${ci===-1?'':'soft'}" data-i="-1">Вільна пісочниця</button>`:'');
    box.querySelectorAll('#tabs [data-i]').forEach(b=>b.onclick=()=>{ P.stop(); ci=+b.dataset.i; load() }) }
  async function load(){
    tabs(); $('#sx').classList.add('hide'); $('#out').textContent='';
    if(ci===-1){ $('#sh').textContent='Вільна пісочниця'; $('#sd').innerHTML='<p>Оберіть приклад або пишіть свій код.</p><select class="input" id="ex">'+(cfg.free||[]).map((f,i)=>`<option value="${i}">${esc(f.title)}</option>`).join('')+'</select>';
      const sel=$('#ex'); sel.style.marginBottom='10px'; ed.value=cfg.free[0].code; sel.onchange=()=>{ed.value=cfg.free[+sel.value].code}; $('#chk').classList.add('hide'); $('#tgtwrap').classList.add('hide'); return }
    const c=ch[ci]; $('#chk').classList.remove('hide'); $('#tgtwrap').classList.remove('hide');
    $('#sh').textContent=c.title; $('#sd').innerHTML=c.text; ed.value=c.starter||'';
    try{ await P.run(c.solution,$('#tg'),null,{static:true}) }catch(e){ console.error(e) }
  }
  $('#run').onclick=()=>P.run(ed.value,$('#cv'),$('#out'));
  $('#stop').onclick=()=>P.stop();
  $('#chk').onclick=async()=>{
    const c=ch[ci]; const x=$('#sx'); x.classList.remove('hide'); x.innerHTML='Перевіряю…';
    if(c.must && !(new RegExp(c.must)).test(ed.value)){ x.innerHTML='<b style="color:var(--bad)">Умова завдання:</b> розв’яжіть його за допомогою конструкції, вказаної в завданні (цикл / умова).'; return }
    try{
      await P.run(ed.value,$('#cv'),$('#out'),{static:true});
      const sim=P.compare($('#cv'),$('#tg'));
      if(sim>=0.95){ okk[ci]=true; x.innerHTML='<b style="color:var(--good)">Збіг '+(sim*100).toFixed(1)+'% — завдання виконано!</b>'; tabs();
        if(okk.every(Boolean)||ci===ch.length-1){ const s=okk.filter(Boolean).length; const r=done(s,ch.length); resultBox(box,s,ch.length,r,()=>{P.stop();T.sandbox(box,cfg,done)},'Виконано завдань: '+s+' з '+ch.length) } else { setTimeout(()=>{ci++;load()},1200) } }
      else x.innerHTML='<b style="color:var(--bad)">'+(sim<0?'Не збігається.':'Збіг '+(sim*100).toFixed(1)+'%.')+'</b> '+(sim<0?'Розмір вікна не збігається з ціллю — перевірте size().':'Порівняйте свій малюнок із ціллю: координати, розміри, кольори.')+(c.hint?'<div style="margin-top:6px">Підказка: '+c.hint+'</div>':'');
    }catch(e){ x.innerHTML='<b style="color:var(--bad)">Помилка в коді.</b> Дивіться повідомлення в консолі.' }
  };
  load();
};

/* ---------- 9. Конструктор плану уроку (таблиця TB) ---------- */
T.planner = function(box,cfg,done){
  const C = (window.RS_COURSES||[]);
  const ST = cfg.stages;
  const user = window.RS_USER ? window.RS_USER() : null;
  box.innerHTML = `<div class="card" style="margin-bottom:14px"><div class="grid g3" style="gap:10px">
      <div class="field"><label>Курс</label><select class="input" id="pc">${C.map((c,i)=>`<option value="${i}">${esc(c.title)}</option>`).join('')}</select></div>
      <div class="field"><label>Урок</label><select class="input" id="pl"></select></div>
      <div class="field"><label>Тривалість заняття, хв</label><select class="input" id="pd"><option>60</option><option selected>90</option><option>120</option></select></div></div>
      <div class="small muted" id="ptopic"></div></div>
    <div class="card" style="margin-bottom:14px"><h3>Мета уроку</h3>
      <div class="field"><label>Навчальна (що учні дізнаються/навчаться робити)</label><textarea class="input" id="g1" rows="2" placeholder="Ознайомити учнів з… Навчити… Розглянути…"></textarea></div>
      <div class="field"><label>Розвивальна</label><textarea class="input" id="g2" rows="2" placeholder="Розвивати логічне мислення, просторову уяву, вміння діяти за інструкцією…"></textarea></div>
      <div class="field"><label>Виховна</label><textarea class="input" id="g3" rows="2" placeholder="Виховувати акуратність, повагу до одногрупників, відповідальність за обладнання…"></textarea></div></div>
    <div class="card"><h3>Етапи уроку</h3><p class="small muted">Заповніть зміст кожного етапу коротко, але конкретно: що робить учитель, що роблять учні, яке питання/завдання. Етап «Перевірка домашнього завдання» можна залишити 0 хв, якщо д/з не було.</p>
      ${ST.map((s,i)=>`<div class="tr-row" style="align-items:flex-start" data-i="${i}"><div class="grow"><b>${esc(s.name)}</b>${s.optional?' <span class="tiny">(за потреби)</span>':''}<div class="tiny">${esc(s.hint)}</div><textarea class="input" rows="2" style="margin-top:6px" data-c="${i}"></textarea></div><div style="width:86px"><label class="tiny">хв</label><input class="input" type="number" min="0" max="120" value="0" data-t="${i}"></div></div>`).join('')}
      <div class="row" style="margin-top:10px"><b>Разом: <span id="sum">0</span> хв</b><span class="grow"></span><button class="btn ghost" id="auto">Підказка: типовий розподіл часу</button><button class="btn" id="chk">Перевірити план</button><button class="btn soft" id="prn">Друкувати мій план</button></div>
      <div id="rep" style="margin-top:12px"></div></div>`;
  const $=s=>box.querySelector(s);
  function lessons(){ const c=C[+$('#pc').value]; $('#pl').innerHTML=c.plan.map((l,i)=>`<option value="${i}">${esc(l.label||l.n)}. ${esc(l.name)}</option>`).join(''); topic() }
  function topic(){ const c=C[+$('#pc').value]; const l=c.plan[+$('#pl').value]; $('#ptopic').innerHTML=`<b>Тема:</b> ${esc(l.topic)}`+(l.focus&&l.focus.length?` · <b>ключове:</b> ${esc(l.focus.join(', '))}`:'') }
  $('#pc').onchange=lessons; $('#pl').onchange=topic; lessons();
  const sum=()=>{ let s=0; box.querySelectorAll('[data-t]').forEach(x=>s+=+x.value||0); $('#sum').textContent=s; return s };
  box.addEventListener('input',sum);
  $('#auto').onclick=()=>{ const d=+$('#pd').value; ST.forEach((s,i)=>{ box.querySelector(`[data-t="${i}"]`).value=Math.round(s.share*d) }); let diff=d-sum(); const k=ST.findIndex(s=>s.main); const el=box.querySelector(`[data-t="${k}"]`); el.value=+el.value+diff; sum() };
  function analyse(){
    const d=+$('#pd').value, total=sum(); const t=i=>+box.querySelector(`[data-t="${i}"]`).value||0; const c=i=>box.querySelector(`[data-c="${i}"]`).value.trim();
    const checks=[];
    const goals=['#g1','#g2','#g3'].map(s=>$(s).value.trim());
    checks.push([goals.every(g=>g.length>=25),'Усі три цілі (навчальна, розвивальна, виховна) сформульовано змістовно (від 25 символів).']);
    const verbs=/^(ознайом|навч|розгля|сформ|закріп|поглиб|забезпеч|пригада|поясн|показ|відпрац|перевір|узагальн|систематиз|дати|продемонстр|вивч)/i;
    checks.push([verbs.test(goals[0]),'Навчальна мета починається з дієслова дії вчителя («Ознайомити…», «Навчити…», «Розглянути…», «Закріпити…»).']);
    const mand=ST.map((s,i)=>i).filter(i=>!ST[i].optional);
    checks.push([mand.every(i=>c(i).length>=15&&t(i)>0),'Кожен обов’язковий етап має зміст (від 15 символів) і час більше 0 хв.']);
    checks.push([total===d,`Сума часу дорівнює тривалості заняття (${total} з ${d} хв).`]);
    const practice=ST.reduce((a,s,i)=>a+(s.practice?t(i):0),0);
    checks.push([practice>=d*0.5,`Практична частина (нове + практика + закріплення) займає щонайменше половину заняття (зараз ${practice} хв).`]);
    const intro=ST.reduce((a,s,i)=>a+(s.intro?t(i):0),0);
    checks.push([intro<=d*0.2,`Організаційний і мотиваційний етапи разом не довші за 20% часу (зараз ${intro} хв).`]);
    const refl=ST.findIndex(s=>s.reflect);
    checks.push([t(refl)>=5 && /\?|рефлекс|що сподоб|чого навчил|оцін|бал/i.test(c(refl)),'Підсумок і рефлексія: щонайменше 5 хв і є конкретні питання/оцінювання.']);
    return checks;
  }
  $('#chk').onclick=()=>{
    const ch=analyse(); const s=ch.filter(x=>x[0]).length;
    $('#rep').innerHTML=ch.map(x=>`<div class="tr-row ${x[0]?'ok':'no'}">${x[0]?'✓':'✕'} <span class="grow">${x[1]}</span></div>`).join('');
    const c=C[+$('#pc').value]; const l=c.plan[+$('#pl').value];
    const r=done(s,ch.length,c.title+' · '+(l.label||l.n)+'. '+l.name); resultBox(box,s,ch.length,r,()=>{ $('#rep').innerHTML='' });
  };
  $('#prn').onclick=()=>{
    const c=C[+$('#pc').value]; const l=c.plan[+$('#pl').value];
    const w=window.open('','_blank'); if(!w) return;
    const rows=ST.map((s,i)=>`<tr><td><b>${esc(s.name)}</b><div style="white-space:pre-wrap">${esc(box.querySelector(`[data-c="${i}"]`).value)}</div></td><td style="text-align:center">${esc(box.querySelector(`[data-t="${i}"]`).value)} хв</td></tr>`).join('');
    w.document.write(`<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>План уроку</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#0B1A3F}table{border-collapse:collapse;width:100%}td,th{border:1px solid #9AA7C7;padding:8px;vertical-align:top}h2{color:#0A44DC}</style></head><body>
      <h2>План уроку — ${esc(c.title)}</h2><table><tr><td style="width:30%">Викладач</td><td>${esc(user?user.fio:'')}</td></tr><tr><td>Філія</td><td>${esc(user?user.branch:'')}</td></tr><tr><td>Дата</td><td></td></tr><tr><td>Кількість учнів / вік</td><td> / ${esc(c.age)}</td></tr><tr><td>№ і назва уроку</td><td>${esc(l.label||l.n)}. ${esc(l.name)}</td></tr><tr><td>Тема</td><td>${esc(l.topic)}</td></tr>
      <tr><td>Навчальна мета</td><td>${esc($('#g1').value)}</td></tr><tr><td>Розвивальна мета</td><td>${esc($('#g2').value)}</td></tr><tr><td>Виховна мета</td><td>${esc($('#g3').value)}</td></tr></table><h3>Етапи уроку (${esc($('#pd').value)} хв)</h3><table><tr><th>Етап і зміст</th><th style="width:90px">Час</th></tr>${rows}</table><script>setTimeout(()=>print(),400)<\/script></body></html>`);
    w.document.close();
  };
};

/* ---------- 10. Ситуаційний тренажер: конфліктні та складні ситуації на уроці ---------- */
T.situation = function(box,cfg,done){
  const cases = cfg.shuffle===false ? cfg.cases.slice() : shuffle(cfg.cases);
  let k=0, s=0, half=0;
  const tone={best:['var(--good)','Найкраще рішення'],ok:['var(--warn)','Прийнятно, але є краще'],bad:['var(--bad)','Не варто так робити']};
  const show=()=>{
    if(k>=cases.length){ box.innerHTML=''; const r=done(s,cases.length); resultBox(box,s,cases.length,r,()=>T.situation(box,cfg,done), half?('Ще '+half+' відповідей були прийнятними, але не найкращими — перегляньте пояснення.'):''); return }
    const c=cases[k]; const opts=shuffle(c.o.map((o,i)=>Object.assign({i},o)));
    box.innerHTML = `<div class="card"><div class="row"><span class="pill">${k+1} / ${cases.length}</span>${c.age?`<span class="pill warn">👥 ${esc(c.age)}</span>`:''}${c.place?`<span class="chip">${esc(c.place)}</span>`:''}<span class="grow"></span><span class="small muted">Найкращих рішень: ${s}</span></div>
      <h3 style="margin:16px 0 8px">${c.title||'Ситуація'}</h3>
      <div class="quote" style="color:var(--ink);font-size:15.5px">${c.text}</div>
      <p style="font-weight:700;margin:14px 0 8px">${c.q||'Що ви зробите?'}</p>
      <div>${opts.map(o=>`<button class="opt" data-i="${o.i}" style="width:100%;text-align:left;font-weight:500">${o.t}</button>`).join('')}</div>
      <div class="ex hide" id="sfb"></div>
      <div class="row" style="margin-top:12px"><button class="btn hide" id="nx">Наступна ситуація →</button></div></div>`;
    box.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
      if(box.querySelector('#sfb:not(.hide)')) return;
      const o=c.o[+b.dataset.i]; if(o.r==='best') s++; else if(o.r==='ok') half++;
      box.querySelectorAll('.opt').forEach(x=>{ const oo=c.o[+x.dataset.i]; if(oo.r==='best') x.classList.add('right'); else if(x===b) x.classList.add(o.r==='ok'?'right':'wrong'); if(x===b&&o.r==='ok'){ x.style.borderColor='var(--warn)'; x.style.background='var(--warn-soft)' } x.disabled=true });
      const best=c.o.find(x=>x.r==='best');
      const fb=box.querySelector('#sfb'); fb.classList.remove('hide');
      fb.innerHTML=`<b style="color:${tone[o.r][0]}">${tone[o.r][1]}.</b> ${o.f||''}`+(o.r!=='best'&&best&&best.f?`<div style="margin-top:8px"><b style="color:var(--good)">Краще:</b> ${best.f}</div>`:'')+(c.why?`<div class="callout tip small" style="margin:10px 0 0"><b>Чому так (вікова особливість)</b><p>${c.why}</p></div>`:'');
      const nx=box.querySelector('#nx'); nx.classList.remove('hide'); nx.onclick=()=>{k++;show();window.scrollTo({top:box.getBoundingClientRect().top+scrollY-90})};
    });
  };
  show();
};

/* ---------- 11. Симулятор уроку (4 уроки курсу; рішення змінюють стан класу й наступні події) ---------- */
const SIM_M=[{k:'a',l:'Увага групи'},{k:'u',l:'Розуміння'},{k:'c',l:'Атмосфера'},{k:'t',l:'Час, хв'}];
function simKey(cfg){ const u=window.RS_USER&&window.RS_USER(); return 'rsa_sim_'+(u?u.email:'x')+'_'+cfg.id }
function simGet(cfg){ try{ return JSON.parse(localStorage.getItem(simKey(cfg))||'{}') }catch(e){ return {} } }
function simSet(cfg,v){ try{ localStorage.setItem(simKey(cfg),JSON.stringify(v)) }catch(e){} }
function simTxt(x,S){ return typeof x==='function'? x(S) : (x||'') }
T.lessonsim = function(box,cfg,done){
  const best=simGet(cfg);
  const menu=()=>{
    box.innerHTML = `<div class="callout info small"><b>Як працює симулятор</b><p>Ви проводите 4 уроки цього курсу від організаційного етапу до рефлексії. На кожному етапі оберіть, як учините. Рішення змінюють <b>увагу групи</b>, <b>розуміння</b>, <b>атмосферу</b> і <b>час</b> — і від них залежить, що станеться далі. Найкраще рішення не обовʼязково найдовше чи найбільш «правильне на вигляд». Тренажер зараховується, коли сума найкращих результатів чотирьох уроків — від 80%.</p></div>
    <div class="grid g2">${cfg.lessons.map((L,i)=>{const b=best[i];return `<div class="card item"><div class="ic">${i+1}</div><div class="grow"><h3 style="margin-bottom:4px">${L.title}</h3><p class="small muted">${L.sub||''}</p>
      <div class="row">${b?`<span class="status" style="color:${b.p>=80?'var(--good)':'var(--warn)'}">Найкраще: ${b.p}%</span>`:'<span class="status muted">Не пройдено</span>'}<span class="grow"></span><button class="btn sm" data-l="${i}">${b?'Ще раз':'Почати урок'}</button></div></div></div>`}).join('')}</div>`;
    box.querySelectorAll('[data-l]').forEach(b=>b.onclick=()=>play(+b.dataset.l));
  };
  const meters=(S,prev)=>`<div class="sim-meters">${SIM_M.map(m=>{const v=Math.round(S[m.k]),d=prev?v-Math.round(prev[m.k]):0;const pct=m.k==='t'?Math.max(0,Math.min(100,100*v/(S.T0||90))):v;const col=m.k==='t'?'var(--accent)':v>=65?'var(--good)':v>=40?'var(--warn)':'var(--bad)';
     return `<div class="sim-m">${m.l}<b>${m.k==='t'?Math.max(v,0)+' хв':v}${d?`<i class="${(m.k==='t'?d>0:d>0)?'up':'dn'}">${d>0?'+':''}${d}</i>`:''}</b><div class="bar"><i style="width:${pct}%;background:${col}"></i></div></div>`}).join('')}</div>`;
  function play(li){
    const L=cfg.lessons[li];
    const S=Object.assign({a:70,u:30,c:70,t:90,f:{}},JSON.parse(JSON.stringify(L.init||{}))); S.T0=S.t; S.f=S.f||{};
    const steps=L.steps; let k=0; const hist=[];
    const total=()=>steps.filter(st=>st.o).length;
    const apply=e=>{ if(!e) return; Object.keys(e).forEach(x=>{ if(x==='t') S.t+=e[x]; else S[x]=Math.max(0,Math.min(100,S[x]+e[x])) }) };
    const next=()=>{ k++; while(k<steps.length && steps[k].when && !steps[k].when(S)) k++; show() };
    function show(){
      if(k>=steps.length) return finish();
      const st=steps[k];
      if(st.when && !st.when(S)) return next();
      const prev={a:S.a,u:S.u,c:S.c,t:S.t};
      const visible=steps.filter(x=>!x.when||x.when(S));
      const pos=visible.indexOf(st);
      const bar=`<div class="sim-steps">${visible.map((x,i)=>`<span class="${i<pos?'done':i===pos?'on':''}"></span>`).join('')}</div>`;
      if(!st.o){ // подія
        apply(st.e);
        box.innerHTML=`<div class="card"><div class="row"><span class="pill">${L.title}</span><span class="grow"></span><button class="btn sm ghost" id="exit">До списку уроків</button></div>${bar}
          <h3 style="margin:12px 0 6px">⚡ ${st.h}</h3><div class="quote" style="color:var(--ink)">${simTxt(st.t,S)}</div>${meters(S,prev)}<button class="btn" id="go">Далі →</button></div>`;
        box.querySelector('#go').onclick=next; box.querySelector('#exit').onclick=menu; return;
      }
      const opts=shuffle(st.o.map((o,i)=>Object.assign({i},o)));
      box.innerHTML=`<div class="card"><div class="row"><span class="pill">${L.title}</span><span class="grow"></span><button class="btn sm ghost" id="exit">До списку уроків</button></div>${bar}
        <h3 style="margin:12px 0 6px">${st.h}</h3><div class="quote" style="color:var(--ink)">${simTxt(st.t,S)}</div>${meters(S)}
        <p style="font-weight:700;margin:6px 0 8px">${st.q||'Що ви зробите?'}</p>
        <div>${opts.map(o=>`<button class="opt" data-i="${o.i}" style="width:100%;text-align:left;font-weight:500">${simTxt(o.l,S)}</button>`).join('')}</div>
        <div id="fb"></div></div>`;
      box.querySelector('#exit').onclick=menu;
      box.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
        if(box.querySelector('#fb').innerHTML) return;
        const o=st.o[+b.dataset.i];
        apply(o.e); if(o.set) [].concat(o.set).forEach(f=>S.f[f]=true); if(o.fx) o.fx(S);
        hist.push({h:st.h,l:simTxt(o.l,S),p:o.p});
        box.querySelectorAll('.opt').forEach(x=>{ x.disabled=true; const oo=st.o[+x.dataset.i]; if(x===b) x.classList.add(o.p===2?'right':o.p===1?'right':'wrong'); if(x===b&&o.p===1){x.style.borderColor='var(--warn)';x.style.background='var(--warn-soft)'} });
        const tone=o.p===2?['var(--good)','Сильне рішення']:o.p===1?['var(--warn)','Можна, але є краще']:['var(--bad)','Слабке рішення'];
        box.querySelector('#fb').innerHTML=`<div class="ex"><b style="color:${tone[0]}">${tone[1]}.</b> ${simTxt(o.f,S)}</div>${meters(S,prev)}<button class="btn" id="go">Далі →</button>`;
        box.querySelector('#go').onclick=next;
      });
    }
    function finish(){
      const max=2*hist.length, sc=hist.reduce((a,h)=>a+h.p,0), pct=Math.round(100*sc/Math.max(1,max));
      const all=simGet(cfg); if(!all[li]||pct>=all[li].p) all[li]={p:pct,s:sc,m:max}; simSet(cfg,all);
      let S2=0,M2=0; cfg.lessons.forEach((_,i)=>{ const r=all[i]; const m=r?r.m:2*cfg.lessons[i].steps.filter(x=>x.o&&!x.when).length; S2+=r?r.s:0; M2+=m||0 });
      const r=done(S2,M2,L.title+': '+pct+'%');
      const over=S.t<0;
      box.innerHTML=`<div class="result ${pct>=80?'pass':'fail'}"><div class="row"><div class="big">${pct}%</div><div class="grow"><b>${L.title}</b> — ${pct>=80?'урок проведено впевнено.':'є що покращити: перегляньте рішення нижче.'}<div class="small" style="margin-top:4px">Загалом за 4 уроки: ${Math.round(100*S2/Math.max(1,M2))}% ${r&&r.passed?'· тренажер зараховано ✓':'(для зарахування потрібно 80% сумарно)'}</div></div></div></div>
        ${meters(S)}${over?'<div class="callout warn small"><b>Урок вийшов за межі часу</b><p>Етапи затягнулися — підсумок і прибирання відбулися поспіхом або після дзвінка.</p></div>':''}
        <div class="callout info"><b>Як пройшов урок</b><p>${simTxt(L.fin,S)}</p></div>
        <div class="card"><h3>Ваші рішення</h3><table class="prose" style="width:100%;font-size:14px;border-collapse:collapse">${hist.map((h,i)=>`<tr style="border-top:1px solid var(--line2)"><td style="padding:7px 4px;width:28%"><b>${h.h}</b></td><td style="padding:7px 4px">${h.l}</td><td style="padding:7px 4px;text-align:right">${['🔴','🟡','🟢'][h.p]}</td></tr>`).join('')}</table></div>
        <div class="row" style="margin-top:12px"><button class="btn" id="again">Провести ще раз</button><button class="btn ghost" id="menu">До списку уроків</button></div>`;
      box.querySelector('#again').onclick=()=>play(li); box.querySelector('#menu').onclick=menu;
      box.scrollIntoView({behavior:'smooth',block:'start'});
    }
    show();
  }
  menu();
};
})();
