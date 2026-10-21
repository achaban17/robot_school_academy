/* Бібліотека для симуляторів уроків (тип тренажера 'lessonsim').
   Показники: a — увага групи, u — розуміння, c — атмосфера, t — час (хв, що лишилися).
   o(текст, бали 0–2, 'a+5 u-3 c+2 t-8', відгук, прапорець) — варіант рішення.
   st(етап, ситуація, питання, [варіанти]) — етап з вибором; br(...) — етап лише за умови; ev(...) — подія-наслідок. */
window.SIM = (function(){
  const eff = s => { const e={}; String(s||'').split(/\s+/).filter(Boolean).forEach(tok=>{ const m=tok.match(/^([aucta])([+-]\d+)$/); if(m) e[m[1]]=(e[m[1]]||0)+(+m[2]) }); return e };
  const o = (l,p,e,f,set,fx) => ({l,p,e:eff(e),f,set,fx});
  const st = (h,t,q,opts) => ({h,t,q,o:opts});
  const br = (h,when,t,q,opts) => ({h,when,t,q,o:opts});
  const ev = (h,when,t,e) => ({h,when,t,e:eff(e)});
  const hi = (S,k,v) => S[k] >= (v||60);
  const pick = (S,k,good,bad,v) => S[k] >= (v||60) ? good : bad;
  const fin = extra => S => {
    const parts=[];
    parts.push(S.a>=70?'Група трималася уважно до кінця уроку.':S.a>=45?'Увага групи «плавала», але ви повертали дітей до роботи.':'Увагу групи втрачено — частина дітей просто дочекалася кінця.');
    parts.push(S.u>=70?'Більшість учнів зрозуміла нову тему й застосувала її самостійно.':S.u>=45?'Тему зрозуміли частково — на початку наступного уроку варто повторити ключове.':'Нову тему засвоїли одиниці; наступний урок доведеться починати з повторення.');
    parts.push(S.c>=70?'Атмосфера доброзичлива: діти йдуть з уроку з бажанням прийти знову.':S.c>=45?'Атмосфера рівна, без яскравих емоцій.':'Атмосфера напружена — хтось пішов ображеним.');
    if(S.t<0) parts.push('Урок затягнувся на '+(-S.t)+' хв.'); else if(S.t>12) parts.push('Залишилося '+S.t+' хв — частину часу можна було використати продуктивніше.');
    return parts.join(' ')+(extra?' '+(typeof extra==='function'?extra(S):extra):'');
  };
  const L = (title, sub, init, steps, finExtra) => ({title, sub, init:Object.assign({a:70,u:25,c:70,t:90,f:{}},init||{}), steps, fin:fin(finExtra)});
  const add = (courseId, tr) => { const c=(window.RS_COURSES||[]).find(x=>x.id===courseId); if(c){ c.trainers.unshift(Object.assign({type:'lessonsim'},tr)) } };
  return {o,st,br,ev,L,add,hi,pick};
})();
