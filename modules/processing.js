/* Robot School Academy — міні-Processing (Python Mode) у браузері.
   Інтерпретатор Python: Skulpt (MIT, vendor/skulpt*.js) — підвантажується при першому запуску.
   Підтримано найуживаніші в курсі команди Processing.py. */
(function(){
'use strict';
let loading=null;
function loadSkulpt(){
  if(window.Sk && Sk.builtinFiles) return Promise.resolve();
  if(loading) return loading;
  const add=src=>new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('Не вдалося завантажити '+src)); document.head.appendChild(s) });
  loading = add('vendor/skulpt.min.js').then(()=>add('vendor/skulpt-stdlib.js'));
  return loading;
}
let cur=null;          // активний «скетч»
let runId=0;
function js(v){ return Sk.ffi.remapToJs(v) }
function colorArgs(a){
  a=a.map(js);
  if(a.length===1){ if(typeof a[0]==='string') return a[0]; return `rgb(${a[0]},${a[0]},${a[0]})` }
  if(a.length===2) return `rgba(${a[0]},${a[0]},${a[0]},${a[1]/255})`;
  if(a.length===3) return `rgb(${a[0]},${a[1]},${a[2]})`;
  return `rgba(${a[0]},${a[1]},${a[2]},${a[3]/255})`;
}
const KEYS={ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39,Shift:16,Control:17,Alt:18};
function install(){
  const B=Sk.builtins;
  const f=(name,fn)=>{ B[name]=new Sk.builtin.func(function(){ const r=fn.apply(null,Array.from(arguments)); return r===undefined?Sk.builtin.none.none$:r }) };
  const num=v=>new Sk.builtin.float_(v), int=v=>new Sk.builtin.int_(v|0);
  const C=()=>cur, g=()=>cur.g;
  const doFill=()=>{ if(C().fill!==null){ g().fillStyle=C().fill; g().fill() } };
  const doStroke=()=>{ if(C().stroke!==null&&C().sw>0){ g().strokeStyle=C().stroke; g().lineWidth=C().sw; g().stroke() } };
  f('size',(w,h)=>{ C().resize(js(w),js(h)) });
  f('fullScreen',()=>{ C().resize(600,400) });
  f('background',(...a)=>{ const s=C(); s.g.save(); s.g.setTransform(1,0,0,1,0,0); s.g.fillStyle=colorArgs(a); s.g.fillRect(0,0,s.cv.width,s.cv.height); s.g.restore() });
  f('fill',(...a)=>{ C().fill=colorArgs(a) }); f('noFill',()=>{ C().fill=null });
  f('stroke',(...a)=>{ C().stroke=colorArgs(a) }); f('noStroke',()=>{ C().stroke=null });
  f('strokeWeight',w=>{ C().sw=js(w) });
  f('color',(...a)=>new Sk.builtin.str(colorArgs(a)));
  f('rectMode',m=>{ C().rectMode=js(m) }); f('ellipseMode',m=>{ C().ellipseMode=js(m) });
  f('smooth',()=>{}); f('noSmooth',()=>{}); f('cursor',()=>{}); f('noCursor',()=>{});
  f('rect',(x,y,w,h,r)=>{ [x,y,w,h]=[x,y,w,h].map(js); if(C().rectMode===3){x-=w/2;y-=h/2} g().beginPath(); if(r!==undefined&&g().roundRect) g().roundRect(x,y,w,h,js(r)); else g().rect(x,y,w,h); doFill(); doStroke() });
  f('square',(x,y,w)=>{ [x,y,w]=[x,y,w].map(js); if(C().rectMode===3){x-=w/2;y-=w/2} g().beginPath(); g().rect(x,y,w,w); doFill(); doStroke() });
  f('ellipse',(x,y,w,h)=>{ [x,y,w,h]=[x,y,w,h].map(js); if(C().ellipseMode===0){x+=w/2;y+=h/2} g().beginPath(); g().ellipse(x,y,Math.abs(w/2),Math.abs(h/2),0,0,Math.PI*2); doFill(); doStroke() });
  f('circle',(x,y,d)=>{ d=js(d); g().beginPath(); g().ellipse(js(x),js(y),Math.abs(d/2),Math.abs(d/2),0,0,Math.PI*2); doFill(); doStroke() });
  f('arc',(x,y,w,h,a,b)=>{ [x,y,w,h,a,b]=[x,y,w,h,a,b].map(js); const s=C();
    if(s.fill!==null){ g().beginPath(); g().moveTo(x,y); g().ellipse(x,y,w/2,h/2,0,a,b); g().closePath(); g().fillStyle=s.fill; g().fill() }
    g().beginPath(); g().ellipse(x,y,w/2,h/2,0,a,b); doStroke() });
  f('line',(x1,y1,x2,y2)=>{ g().beginPath(); g().moveTo(js(x1),js(y1)); g().lineTo(js(x2),js(y2)); doStroke() });
  f('point',(x,y)=>{ const s=C(); if(s.stroke===null) return; g().fillStyle=s.stroke; const w=Math.max(1,s.sw); g().fillRect(js(x)-w/2,js(y)-w/2,w,w) });
  f('triangle',(...p)=>{ p=p.map(js); g().beginPath(); g().moveTo(p[0],p[1]); g().lineTo(p[2],p[3]); g().lineTo(p[4],p[5]); g().closePath(); doFill(); doStroke() });
  f('quad',(...p)=>{ p=p.map(js); g().beginPath(); g().moveTo(p[0],p[1]); for(let i=2;i<8;i+=2) g().lineTo(p[i],p[i+1]); g().closePath(); doFill(); doStroke() });
  f('textSize',s=>{ C().ts=js(s) }); f('textAlign',a=>{ const v=js(a); C().ta = v===3?'center':v===39?'right':'left' });
  f('text',(t,x,y)=>{ const s=C(); g().font=`${s.ts}px sans-serif`; g().textAlign=s.ta; g().fillStyle=s.fill||'rgba(0,0,0,0)'; g().fillText(String(js(t)),js(x),js(y)) });
  f('textWidth',t=>{ g().font=`${C().ts}px sans-serif`; return num(g().measureText(String(js(t))).width) });
  f('random',(a,b)=>{ a=js(a); if(b===undefined) return num(Math.random()*a); b=js(b); return num(a+Math.random()*(b-a)) });
  f('dist',(x1,y1,x2,y2)=>num(Math.hypot(js(x2)-js(x1),js(y2)-js(y1))));
  f('constrain',(v,a,b)=>num(Math.min(Math.max(js(v),js(a)),js(b))));
  f('sin',v=>num(Math.sin(js(v)))); f('cos',v=>num(Math.cos(js(v)))); f('radians',v=>num(js(v)*Math.PI/180)); f('degrees',v=>num(js(v)*180/Math.PI)); f('sqrt',v=>num(Math.sqrt(js(v)))); f('sq',v=>num(js(v)*js(v)));
  f('frameRate',r=>{ C().fps=js(r) }); f('noLoop',()=>{ C().looping=false }); f('loop',()=>{ C().looping=true }); f('redraw',()=>{ C().redrawOnce=true });
  f('millis',()=>int(Date.now()-C().t0)); f('second',()=>int(new Date().getSeconds())); f('minute',()=>int(new Date().getMinutes())); f('hour',()=>int(new Date().getHours()));
  f('loadImage',n=>new Sk.builtin.str('§IMG§'+js(n)));
  f('image',(im,x,y,w,h)=>{ const name=String(js(im)).replace('§IMG§',''); [x,y]=[x,y].map(js); w=w?js(w):80; h=h?js(h):80; g().save(); g().fillStyle='#C9D2EA'; g().strokeStyle='#7C87A8'; g().lineWidth=1; g().fillRect(x,y,w,h); g().strokeRect(x,y,w,h); g().fillStyle='#44507A'; g().font='11px sans-serif'; g().textAlign='left'; g().fillText(name.slice(0,18),x+4,y+14); g().restore() });
  f('pushMatrix',()=>g().save()); f('popMatrix',()=>g().restore()); f('push',()=>g().save()); f('pop',()=>g().restore());
  f('translate',(x,y)=>g().translate(js(x),js(y))); f('rotate',a=>g().rotate(js(a))); f('scale',(a,b)=>g().scale(js(a),b===undefined?js(a):js(b)));
  const k=(n,v)=>{ B[n]=v };
  k('PI',num(Math.PI)); k('HALF_PI',num(Math.PI/2)); k('QUARTER_PI',num(Math.PI/4)); k('TWO_PI',num(Math.PI*2)); k('TAU',num(Math.PI*2));
  k('CODED',int(65535)); k('UP',int(38)); k('DOWN',int(40)); k('LEFT',int(37)); k('RIGHT',int(39)); k('SHIFT',int(16)); k('ENTER',new Sk.builtin.str('\n')); k('BACKSPACE',new Sk.builtin.str('\b'));
  k('CENTER',int(3)); k('CORNER',int(0)); k('CORNERS',int(1)); k('RADIUS',int(2));
}
function setVars(s){
  const B=Sk.builtins;
  B.width=new Sk.builtin.int_(s.cv.width); B.height=new Sk.builtin.int_(s.cv.height);
  B.mouseX=new Sk.builtin.int_(s.mx|0); B.mouseY=new Sk.builtin.int_(s.my|0); B.pmouseX=new Sk.builtin.int_(s.pmx|0); B.pmouseY=new Sk.builtin.int_(s.pmy|0);
  B.mousePressed=s.mp?Sk.builtin.bool.true$:Sk.builtin.bool.false$;
  B.keyPressed=s.kp?Sk.builtin.bool.true$:Sk.builtin.bool.false$;
  B.key=typeof s.key==='number'?new Sk.builtin.int_(s.key):new Sk.builtin.str(s.key||'');
  B.keyCode=new Sk.builtin.int_(s.keyCode||0);
  B.frameCount=new Sk.builtin.int_(s.frame);
}
function Sketch(cv,out){
  this.cv=cv; this.g=cv.getContext('2d'); this.out=out; this.fill='rgb(255,255,255)'; this.stroke='rgb(0,0,0)'; this.sw=1; this.ts=12; this.ta='left';
  this.rectMode=0; this.ellipseMode=3; this.fps=60; this.looping=true; this.frame=0; this.mx=0; this.my=0; this.pmx=0; this.pmy=0; this.mp=false; this.kp=false; this.key=''; this.keyCode=0; this.t0=Date.now();
  this.resize(100,100);
}
Sketch.prototype.resize=function(w,h){ this.cv.width=w; this.cv.height=h; this.cv.style.width=Math.min(w,560)+'px'; this.g=this.cv.getContext('2d'); this.g.fillStyle='rgb(204,204,204)'; this.g.fillRect(0,0,w,h); this.g.lineCap='round'; if(window.Sk&&Sk.builtins) setVars(this) };
function print(out,txt,err){ if(!out) return; const sp=document.createElement('span'); if(err) sp.className='e'; sp.textContent=txt; out.appendChild(sp); out.scrollTop=1e9 }
function errText(e){ try{ return e.toString() }catch(x){ return String(e) } }
async function call(fn,args){ Sk.execStart=Date.now(); return Sk.misceval.asyncToPromise(()=>Sk.misceval.callsimOrSuspendArray(fn,args||[])) }
const ENGINE = {
  stop(){ runId++; if(cur&&cur.detach) cur.detach() },
  async run(code,cv,out,opts){
    opts=opts||{};
    await loadSkulpt();
    if(!ENGINE._inst){ install(); ENGINE._inst=true }
    this.stop(); const my=++runId;
    if(out) out.textContent='';
    const s=new Sketch(cv,out); cur=s; setVars(s);
    Sk.configure({ output:t=>print(out,t), read:x=>{ if(Sk.builtinFiles===undefined||Sk.builtinFiles.files[x]===undefined) throw "Файл не знайдено: '"+x+"'"; return Sk.builtinFiles.files[x] },
      __future__:Sk.python3, execLimit:4000, yieldLimit:100, killableWhile:true, killableFor:true });
    let mod;
    try{ Sk.execStart=Date.now(); mod = await Sk.misceval.asyncToPromise(()=>Sk.importMainWithBody('<sketch>',false,code,true)) }
    catch(e){ print(out,'⚠ '+errText(e).replace('<sketch>','рядок'),true); throw e }
    const d=mod.$d; const fn=n=>d[n]&&d[n].tp$call?d[n]:null;
    const setup=fn('setup'), draw=fn('draw');
    try{ if(setup){ cur=s; setVars(s); await call(setup) } if(draw&&opts.static){ cur=s; s.frame=1; setVars(s); await call(draw) } }
    catch(e){ print(out,'⚠ '+errText(e).replace('<sketch>','рядок'),true); throw e }
    if(!draw||opts.static) return s;
    // інтерактив
    const pos=e=>{ const r=cv.getBoundingClientRect(); return [(e.clientX-r.left)*cv.width/r.width,(e.clientY-r.top)*cv.height/r.height] };
    const ev=async(name)=>{ const h=fn(name); if(h&&my===runId){ try{ cur=s; setVars(s); await call(h) }catch(e){ print(out,'⚠ '+errText(e),true); runId++ } } };
    const mm=e=>{ [s.mx,s.my]=pos(e) };
    const md=e=>{ cv.focus(); [s.mx,s.my]=pos(e); s.mp=true; ev('mousePressed') };
    const mu=e=>{ s.mp=false; ev('mouseReleased'); ev('mouseClicked') };
    const kd=e=>{ if(KEYS[e.key]){ s.key=65535; s.keyCode=KEYS[e.key] } else { s.key=e.key.length===1?e.key:(e.key==='Enter'?'\n':e.key); s.keyCode=e.keyCode } s.kp=true; if(e.key.startsWith('Arrow')||e.key===' ') e.preventDefault(); ev('keyPressed') };
    const ku=e=>{ s.kp=false; ev('keyReleased') };
    cv.addEventListener('mousemove',mm); cv.addEventListener('mousedown',md); window.addEventListener('mouseup',mu); cv.addEventListener('keydown',kd); cv.addEventListener('keyup',ku);
    s.detach=()=>{ cv.removeEventListener('mousemove',mm); cv.removeEventListener('mousedown',md); window.removeEventListener('mouseup',mu); cv.removeEventListener('keydown',kd); cv.removeEventListener('keyup',ku) };
    let last=0;
    const tick=async(t)=>{
      if(my!==runId||!cv.isConnected){ s.detach(); return }
      if((s.looping||s.redrawOnce) && t-last>=1000/s.fps-2){
        last=t; s.redrawOnce=false; s.frame++; cur=s; setVars(s);
        try{ await call(draw) }catch(e){ print(out,'⚠ '+errText(e).replace('<sketch>','рядок'),true); runId++; return }
        s.pmx=s.mx; s.pmy=s.my;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return s;
  },
  /* частка збігу «намальованих» пікселів двох полотен (фон не враховується); -1 — різний розмір */
  compare(a,b){
    if(a.width!==b.width||a.height!==b.height) return -1;
    const A=a.getContext('2d').getImageData(0,0,a.width,a.height).data, Bd=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
    const bgA=[A[0],A[1],A[2]], bgB=[Bd[0],Bd[1],Bd[2]];
    if(Math.max(...bgA.map((v,i)=>Math.abs(v-bgB[i])))>30) return 0;
    let ink=0, same=0;
    for(let i=0;i<A.length;i+=4){
      const da=Math.abs(A[i]-bgA[0])+Math.abs(A[i+1]-bgA[1])+Math.abs(A[i+2]-bgA[2]);
      const db=Math.abs(Bd[i]-bgB[0])+Math.abs(Bd[i+1]-bgB[1])+Math.abs(Bd[i+2]-bgB[2]);
      if(da<20&&db<20) continue;
      ink++;
      const d=Math.abs(A[i]-Bd[i])+Math.abs(A[i+1]-Bd[i+1])+Math.abs(A[i+2]-Bd[i+2]);
      if(d<90) same++;
    }
    return ink?same/ink:1;
  }
};
window.RS_PROCESSING=ENGINE;
})();
