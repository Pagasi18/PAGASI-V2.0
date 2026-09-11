// Redibujo en tiempo real: la pestana oculta no se redibuja, como maximo un
// redibujo cada 4 s mientras sigan llegando cambios, se conserva la paginacion
// y el Dashboard no parpadea. Se prueba el bloque REAL extraido de
// assets/pagasi-app.js, con reloj y temporizadores falsos.
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
let pass=0, fail=0;
const ok=(l,v)=>{ if(v){pass++;console.log('OK   '+l);} else {fail++;console.log('FALLA '+l);} };

const app=fs.readFileSync(path.join(ROOT,'assets/pagasi-app.js'),'utf8');
const ini=app.indexOf('// ── Redibujo en tiempo real');
const fin=app.indexOf('// ── fin redibujo en tiempo real');
ok('el bloque de tiempo real esta marcado en pagasi-app.js', ini>0 && fin>ini);
const BLOQUE=app.slice(ini, fin);

function montar(opts){
  opts=opts||{};
  const reloj={now:100000};
  let timers=[], seq=0;
  const setT=(fn,ms)=>{ const id=++seq; timers.push({id, at:reloj.now+(ms||0), fn}); return id; };
  const clearT=id=>{ timers=timers.filter(t=>t.id!==id); };
  const avanzar=ms=>{
    const hasta=reloj.now+ms;
    for(;;){
      timers.sort((a,b)=>a.at-b.at || a.id-b.id);
      const t=timers[0];
      if(!t || t.at>hasta) break;
      timers.shift(); reloj.now=t.at; t.fn();
    }
    reloj.now=hasta;
  };
  const doc={hidden:false, handlers:{}, addEventListener(ev,fn){ this.handlers[ev]=fn; }};
  const win={_pgKeep:false, _rtRenderizando:false};
  const log=[];
  const S={currentUser:{nombre:'x'}, page:'pagos'};
  let modal=false;
  const nav=p=>{
    log.push({p, pgKeep:win._pgKeep, rt:win._rtRenderizando, at:reloj.now});
    if(!opts.noConsume) win._pgKeep=false;
    if(opts.navFalla) throw new Error('boom');
  };
  const f=new Function('S','nav','document','window','setTimeout','clearTimeout','Date','_isModalOpen','_captureFocus','_restoreFocus','updateBadge',
    'var _rtTimer=null, _rtRenderPending=false;\n'+BLOQUE+
    '\nreturn {schedule:scheduleRealtimeRender, flush:flushRealtimeRender, decidir:_rtDecidir, MIN:_RT_MIN_MS,'+
    ' prep:_rtBootPreparar, marca:_rtMarcarPrimera, bootListo:realtimeBootListo,'+
    ' get pendiente(){ return _rtRenderPending; }};');
  const api=f(S, nav, doc, win, setT, clearT, {now:()=>reloj.now}, ()=>modal, ()=>null, ()=>{}, ()=>{});
  return {api, reloj, avanzar, doc, win, log, S, setModal:v=>{ modal=v; }, timers:()=>timers};
}

// ── La decision, sola ──
{ const {api}=montar();
  ok('un redibujo cada 4 s como maximo', api.MIN===4000);
  ok('pestana oculta -> pendiente', api.decidir(10000,0,true,false).accion==='pendiente');
  ok('modal abierto -> pendiente', api.decidir(10000,0,false,true).accion==='pendiente');
  ok('nunca se redibujo -> redibuja', api.decidir(10000,0,false,false).accion==='render');
  const e=api.decidir(10000,9000,false,false);
  ok('1 s despues del ultimo -> espera 3 s', e.accion==='esperar' && e.espera===3000);
  ok('4 s despues -> redibuja', api.decidir(13000,9000,false,false).accion==='render');
}

// ── Mediodia: 30 cambios en 1 segundo ──
{ const m=montar(); const t0=m.reloj.now;
  for(let i=0;i<30;i++){ m.api.schedule(); m.avanzar(33); }
  ok('el primer redibujo llega a los 350 ms', m.log.length>=1 && m.log[0].at===t0+350);
  m.avanzar(10000);
  ok('30 cambios en 1 s -> 2 redibujos, no 30', m.log.length===2);
  ok('el segundo respeta los 4 s', m.log[1].at-m.log[0].at>=4000);
  ok('conserva la pagina de la tabla (_pgKeep)', m.log.every(l=>l.pgKeep===true));
  ok('avisa a nav que es tiempo real (sin esqueleto)', m.log.every(l=>l.rt===true));
  ok('la bandera de tiempo real se apaga despues', m.win._rtRenderizando===false);
  ok('al final no queda nada pendiente', m.api.pendiente===false);
}

// ── Cambios constantes 20 s: no se traba ──
// El codigo viejo reiniciaba su temporizador de 350 ms con cada cambio: con
// cambios cada 100 ms la pantalla NUNCA se actualizaba.
{ const m=montar();
  for(let i=0;i<200;i++){ m.api.schedule(); m.avanzar(100); }
  m.avanzar(5000);
  ok('cambios cada 100 ms durante 20 s: sigue actualizando', m.log.length>=5);
  ok('pero no mas de uno cada 4 s', m.log.length<=7);
  let gap=Infinity; for(let i=1;i<m.log.length;i++) gap=Math.min(gap, m.log[i].at-m.log[i-1].at);
  ok('ningun par de redibujos a menos de 4 s', gap>=4000);
}

// ── Pestana oculta ──
{ const m=montar(); m.doc.hidden=true;
  for(let i=0;i<10;i++){ m.api.schedule(); m.avanzar(500); }
  ok('pestana oculta: no redibuja nada', m.log.length===0);
  ok('pero queda pendiente', m.api.pendiente===true);
  ok('y no deja temporizadores corriendo', m.timers().length===0);
  m.api.flush();
  ok('flush con la pestana oculta tampoco redibuja', m.log.length===0);
  m.doc.hidden=false;
  ok('escucha visibilitychange', typeof m.doc.handlers.visibilitychange==='function');
  m.doc.handlers.visibilitychange();
  ok('al volver a la pestana: un solo redibujo', m.log.length===1);
  ok('y ya nada pendiente', m.api.pendiente===false);
}
{ const m=montar();
  m.api.schedule(); m.doc.hidden=true; m.avanzar(1000);
  ok('se oculto antes del redibujo programado: no redibuja', m.log.length===0 && m.api.pendiente===true);
  m.doc.hidden=false; m.doc.handlers.visibilitychange();
  ok('al volver, redibuja', m.log.length===1);
}

// ── Modal abierto ──
{ const m=montar(); m.setModal(true);
  m.api.schedule(); m.avanzar(1000);
  ok('modal abierto: no redibuja', m.log.length===0 && m.api.pendiente===true);
  m.setModal(false); m.api.flush();
  ok('al cerrar el modal: redibuja', m.log.length===1);
}
{ const m=montar(); m.api.schedule(); m.setModal(true); m.avanzar(1000);
  ok('se abrio un modal antes del redibujo: espera', m.log.length===0 && m.api.pendiente===true);
  m.setModal(false); m.api.flush();
  ok('al cerrarlo, redibuja', m.log.length===1);
}

// ── Bordes ──
{ const m=montar(); m.api.flush(); ok('flush sin nada pendiente no redibuja', m.log.length===0); }
{ const m=montar(); m.api.schedule(); m.api.flush();
  ok('flush redibuja al instante', m.log.length===1);
  m.avanzar(5000);
  ok('y cancela el temporizador: no redibuja dos veces', m.log.length===1);
}
{ const m=montar({navFalla:true}); m.api.schedule();
  try{ m.avanzar(1000); }catch(e){}
  ok('si nav falla, la bandera de tiempo real se apaga igual', m.win._rtRenderizando===false);
}
{ const m=montar({noConsume:true}); m.api.schedule(); m.avanzar(1000);
  ok('si nav sale antes (sin acceso), no queda pegado conservar-pagina', m.log.length===1 && m.win._pgKeep===false);
}
{ const m=montar(); m.S.currentUser=null; m.api.schedule(); m.avanzar(1000);
  ok('sin sesion: no programa nada', m.log.length===0 && m.timers().length===0);
}

// ── Primera bajada (arranque sin doble descarga) ──
(async () => {
  const tick = async () => { await null; await null; await null; };
  { const m=montar();
    let res=null; m.api.prep(3).then(v=>{res=v;});
    m.api.marca('motos'); m.api.marca('motos'); m.api.marca('clientes');
    await tick();
    ok('2 de 3 colecciones (una repetida): sigue esperando', res===null);
    m.api.marca('creditos'); await tick();
    ok('llego la ultima: arranque completo', !!res && res.completo===true);
    let res2=null; m.api.bootListo().then(v=>{res2=v;}); await tick();
    ok('preguntar despues del arranque tambien da completo', !!res2 && res2.completo===true);
  }
  { const m=montar();
    let res=null; m.api.prep(2).then(v=>{res=v;});
    m.api.marca('motos'); m.api.marca('pagos', true); await tick();
    ok('una coleccion fallo: completo=false (cae a la carga clasica)', !!res && res.completo===false);
  }
  { const m=montar();
    m.api.prep(2); m.api.marca('motos');
    let res=null; m.api.bootListo(45000).then(v=>{res=v;});
    m.avanzar(45001); await tick();
    ok('45 s sin terminar: completo=false, no se queda colgado', !!res && res.completo===false);
  }
  { const m=montar();
    let res=null; m.api.bootListo(1000).then(v=>{res=v;}); await tick();
    ok('tiempo real sin arrancar: completo=false', !!res && res.completo===false);
  }
  _finalizar();
})();

// ── En pagasi-app.js ──
ok('la cache local (enablePersistence) ya no se activa', !/db\.enablePersistence\s*\(/.test(app));
ok('nav no muestra el esqueleto en redibujos de tiempo real', /if\(!window\._rtRenderizando\) showSkeleton\(\);/.test(app));
ok('quedo una sola definicion de scheduleRealtimeRender', (app.match(/function scheduleRealtimeRender\(/g)||[]).length===1);
ok('quedo una sola definicion de flushRealtimeRender', (app.match(/function flushRealtimeRender\(/g)||[]).length===1);

function _finalizar(){
  console.log(''); console.log(pass+' pruebas OK, '+fail+' fallas');
  if(fail) process.exitCode=1;
}
