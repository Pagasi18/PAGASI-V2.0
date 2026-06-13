// Pagasi module: dash
PG.dash = function(){
  // Los empleados ven un dashboard especializado
  if(isEmpleadoRole()) return empleadoDashHTML();

  // ── Variables filtradas por concesionario activo ──
  // Si hay un concesionario en el switcher, todas las métricas se calculan solo sobre esos datos.
  var _SCREDS = _concFiltrar(S.creds||[]);
  var _SPAGOS = _concFiltrar(S.pagos||[]);
  var _SMOTOS = _concFiltrar(S.motos||[]);
  var _SEGR = _concFiltrarEgresos(S.egresos||[]);

  // ── Core metrics ──
  const mora = _SCREDS.filter(c=>c.mora>0).length;
  const activos = _SCREDS.filter(c=>c.estado==='activo').length;
  const completados = _SCREDS.filter(c=>c.estado==='completado').length;
  const totalCreds = _SCREDS.filter(c=>!c.eliminado && c.estado!=='cancelado' && c.estado!=='recuperado' && c.estado!=='recuperada').length;
  // Cartera: suma del saldo pendiente REAL de cada crédito activo
  // (usa la función canónica que respeta pagos parciales)
  const cartera = _SCREDS.filter(c=>c.estado==='activo').reduce((a,c)=>a+getCreditoSaldoPendiente(c),0);
  const cuotasCobradas = _SPAGOS.filter(p=>!p.eliminado&&p.estado==='confirmado'&&!p.esInicial&&p.tipoOperacion!=='inicial_credito').reduce((a,p)=>a+p.monto,0);
  const inicialesCobradas = _SPAGOS.filter(p=>!p.eliminado&&p.estado==='confirmado'&&(p.esInicial||p.tipoOperacion==='inicial_credito')).reduce((a,p)=>a+p.monto,0);
  const ingMes = inicialesCobradas + cuotasCobradas; // Dashboard: ingresos confirmados sin duplicar la inicial
  // ── Cobrado SOLO del mes actual ──
  const _primerDiaMesDash = hoyLocalISO().slice(0,7)+'-01';
  const _pagosMesDash = _SPAGOS.filter(p=>!p.eliminado&&p.estado==='confirmado'&&(p.fecha||'')>=_primerDiaMesDash);
  const cuotasCobradasMes = _pagosMesDash.filter(p=>!p.esInicial&&p.tipoOperacion!=='inicial_credito').reduce((a,p)=>a+p.monto,0);
  const inicialesCobradasMes = _pagosMesDash.filter(p=>p.esInicial||p.tipoOperacion==='inicial_credito').reduce((a,p)=>a+p.monto,0);
  const ingMesReal = cuotasCobradasMes + inicialesCobradasMes;
  const egMes = _SEGR.filter(e=>!e.eliminado).reduce((a,e)=>a+(e.monto||0),0);
  const utilidad = ingMes - egMes;
  const pendPagos = _SPAGOS.filter(p=>p.estado==='pendiente').length;
  const dispMotos = _SMOTOS.filter(m=>!m.eliminado&&m.estado==='disponible').length;

  // ── Mora buckets ──
  const moraBuckets = {
    '1-15': _SCREDS.filter(c=>c.mora>0&&c.mora<=15).length,
    '16-30': _SCREDS.filter(c=>c.mora>15&&c.mora<=30).length,
    '31-60': _SCREDS.filter(c=>c.mora>30&&c.mora<=60).length,
    '+60': _SCREDS.filter(c=>c.mora>60).length,
  };
  // BUG FIX: sumar la cuota REAL de cada crédito activo (antes multiplicaba count × primer cuota,
  // lo cual era incorrecto si los créditos tenían distintos montos)
  const cuotaEsperada = _SCREDS.filter(c=>c.estado==='activo').reduce((a,c)=>a+parseFloat(c.cuotaQ||c.cuota||0),0);
  const pctCobro = cuotaEsperada > 0 ? Math.min(100, Math.round(cuotasCobradas / cuotaEsperada * 100)) : 0;

  // ── Promedios de crédito (inicial y cuota) ──
  const credsProm = _SCREDS.filter(c=>!c.eliminado && c.estado!=='cancelado' && c.estado!=='recuperado' && c.estado!=='recuperada');
  const _iniVals = credsProm.map(c=>parseFloat(c.ini)||0).filter(v=>v>0);
  const _cuoVals = credsProm.map(c=>parseFloat(c.cuotaQ||c.cuota||0)||0).filter(v=>v>0);
  const inicialProm = _iniVals.length ? _iniVals.reduce((a,v)=>a+v,0)/_iniVals.length : 0;
  const cuotaProm = _cuoVals.length ? _cuoVals.reduce((a,v)=>a+v,0)/_cuoVals.length : 0;
  const cuotaPromMes = cuotaProm*2;

  // ── Moto inventory ──
  const mDisp = _SMOTOS.filter(m=>!m.eliminado&&m.estado==='disponible').length;
  const mFin = _SMOTOS.filter(m=>!m.eliminado&&m.estado==='financiada').length;
  const mRec = _SMOTOS.filter(m=>!m.eliminado&&m.estado==='recuperada').length;
  const mInv = _SMOTOS.filter(m=>!m.eliminado&&m.estado==='inventario').length;
  const mTotal = Math.max(1, mDisp+mFin+mRec+mInv);

  // ── Créditos por estado (para pie) ──
  const cActivos = activos;
  const cCompletados = completados;
  const cEnMora = mora;
  const cCancelados = _SCREDS.filter(c=>!c.eliminado&&c.estado==='cancelado').length;
  const cTotalReal = cActivos+cCompletados+cEnMora+cCancelados;
  const cTotal = Math.max(1, cTotalReal);

  // ── Pie chart SVG helper ──
  function pieSlice(pct, offsetPct, color, r=40, cx=50, cy=50){
    if(pct<=0) return '';
    const circ = 2*Math.PI*r;
    const dash = pct/100*circ;
    const gap = circ - dash;
    const rot = offsetPct/100*360 - 90;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="10" stroke-linecap="round"
      stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}"
      transform="rotate(${rot} ${cx} ${cy})"
      style="transition:stroke-width .2s"
      onmouseover="this.setAttribute('stroke-width','13')"
      onmouseout="this.setAttribute('stroke-width','10')"/>`;
  }

  // Moto pie
  const motoSlices=[
    [mDisp/mTotal*100, 0, '#06B06A'],
    [mFin/mTotal*100, mDisp/mTotal*100, '#2563EB'],
    [mRec/mTotal*100, (mDisp+mFin)/mTotal*100, '#D93B5A'],
    [mInv/mTotal*100, (mDisp+mFin+mRec)/mTotal*100, '#5B8DEF'],
  ];
  let mOff=0;
  const motoArcs = motoSlices.map(([p,,c])=>{const a=pieSlice(p,mOff,c);mOff+=p;return a;}).join('');

  // Créditos pie
  const credSlices=[
    [cActivos/cTotal*100, 0, '#2563EB'],
    [cEnMora/cTotal*100, cActivos/cTotal*100, '#D93B5A'],
    [cCompletados/cTotal*100, (cActivos+cEnMora)/cTotal*100, '#06B06A'],
  ];
  let cOff=0;
  const credArcs = credSlices.map(([p,,c])=>{const a=pieSlice(p,cOff,c);cOff+=p;return a;}).join('');

  // ── Pagos por método (para pie) ──
  const metodoCounts={};
  _SPAGOS.filter(p=>!p.eliminado&&p.estado==='confirmado').forEach(p=>{
    var m=p.metodo||'Otro';
    metodoCounts[m]=(metodoCounts[m]||0)+1;
  });
  const metodoTotalReal=Object.values(metodoCounts).reduce((a,b)=>a+b,0);
  const metodoTotal=Math.max(1,metodoTotalReal);
  const metodoColors=['#2563EB','#06B06A','#5B8DEF','#D93B5A','#F59E0B'];
  const metodoEntries=Object.entries(metodoCounts).slice(0,5);
  let pagoOff=0;
  const pagoArcs=metodoEntries.map(([,v],i)=>{
    const p=v/metodoTotal*100;
    const a=pieSlice(p,pagoOff,metodoColors[i%metodoColors.length]);
    pagoOff+=p;
    return a;
  }).join('');

  // ── Próximas cuotas ──
  const hoy=(function(){
    var prox=_SCREDS.filter(function(c){
      if(c.estado!=='activo'||!c.fecha) return false;
      var start=parseFechaLocal(c.fecha);
      var cuotaNum=(c.pagado||0)+1;
      var vence=new Date(start.getTime()+(cuotaNum*15*24*60*60*1000));
      var diff=Math.round((vence-new Date())/(24*60*60*1000));
      return diff<=7 && diff>=-2;
    });
    return prox.length ? prox : _SCREDS.filter(c=>c.estado==='activo').slice(0,5);
  })();

  // ── HTML ──
  // ─── TIPS LOCALES (sin emojis) — rotativos por día del año ───
  var TIPS_DEL_DIA = [
    '"Lo que se mide, se mejora." Revisa tu cartera vencida cada lunes a primera hora.',
    'Una moto se entrega tres veces: en el lote, en el contrato, y en la primera cuota a tiempo.',
    'El mejor cliente es el que paga puntual. Premia a los puntuales con un mensaje de "gracias" antes de pedir la siguiente cuota.',
    'No respondas WhatsApp después de las 8pm; protege tu tiempo personal. Los clientes lo respetan.',
    'El precio de la moto no es el problema. El problema es no haber explicado bien la cuota.',
    'Cobranza al día = libertad financiera. Un día de atraso es un día de tu plata trabajando para otro.',
    '"El cliente no compra una moto, compra movilidad y libertad." Vende eso, no las especificaciones.',
    'Un cliente referido vale 5 veces más que uno por publicidad. Pide referencias cuando paguen la última cuota.',
    'Si no sabes tu costo de oportunidad, todo te parece barato. Calcula cuánto te cuesta cada día de mora.',
    'Llama al cliente el día antes de su cuota, no después. Convierte el cobro en un servicio.',
    'Una factura emitida es un cliente más conectado. Pide su RIF/cédula al emitir y guarda los datos.',
    'Las primeras 3 cuotas predicen las 21 restantes. Si fallan ahí, el patrón se repite.',
    'Sorprende a tus mejores clientes con un casco gratis o una revisión. El boca a boca es tu mejor marketing.',
    'Si un cliente no contesta WhatsApp en 24h, llámalo. Si no contesta llamadas en 48h, ve al lote.',
    'Documenta todo: contratos firmados, fotos de la moto, copias de cédula. La memoria falla, los papeles no.',
    '"La calidad no es un acto, es un hábito." Aristóteles. Revisa cada moto antes de entregarla, sin excepción.',
    'El admin no es para llenarlo de datos, es para tomar decisiones más rápido. Si una pantalla no te ayuda a decidir, sobra.',
    'Un cliente con plan personalizado paga 30% más puntual que uno con plan estándar. Vale la conversación.',
    'Compite contigo, no con la competencia. Si este mes cobraste $20k, la meta del próximo es $22k.',
    'Un fiador firmado vale más que tres promesas verbales. No bajes ese requisito por presión de cerrar.',
    'Si un cliente tarda más de 1 hora en pensar la oferta, no la va a tomar. Ofrece dos opciones y deja que elija.',
    'Nadie nace sabiendo cobrar. Practica el guion de cobranza amable hasta que lo digas natural.',
    'Cada hora que un crédito está en mora cuesta tu margen del día. Cobranza temprana = ganancia real.',
    'El cliente que paga su última cuota merece una llamada de felicitación. Y un descuento si vuelve.',
    'Configura recordatorios automáticos 3 días antes de cada cuota. El olvido es enemigo del cobro.',
    'Mide tu APY real cada mes. Si bajó, algo está fallando: ya sea precio, plazo o cobranza.',
    'El sistema es tan bueno como los datos que le metes. Llena bien el perfil del cliente desde el primer contacto.',
    'No vendas crédito al primero que entra. Vende al que califica. La mora arruina más negocios que la falta de clientes.',
    '"Hay que pensar en grande, pero empezar pequeño." Cobra una cuota completa antes de pensar en 100.',
    'Cada lunes es nueva oportunidad. Empieza con la lista de morosos del viernes, no con emails.',
    'Celebra los logros chiquitos del equipo. 10 cobros perfectos en una semana merecen reconocimiento.'
  ];
  var diaDelAnio = (function(){var d=new Date();var i=new Date(d.getFullYear(),0,0);return Math.floor((d-i)/(1000*60*60*24));})();
  var tipIdx = (typeof window._tipOverride !== 'undefined' && window._tipOverride !== null) ? window._tipOverride : (diaDelAnio % TIPS_DEL_DIA.length);
  var tipHoy = TIPS_DEL_DIA[tipIdx % TIPS_DEL_DIA.length];

  // ─── CUMPLEAÑOS — empleados que cumplen este mes ───
  function _parseCumple(v){
    if(!v) return null;
    // Acepta YYYY-MM-DD, DD/MM/YYYY, DD-MM, etc.
    var s = String(v).replace(/\//g,'-');
    var m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(m1) return {mes:parseInt(m1[2],10), dia:parseInt(m1[3],10)};
    var m2 = s.match(/^(\d{1,2})-(\d{1,2})(?:-\d{2,4})?/);
    if(m2) return {mes:parseInt(m2[2],10), dia:parseInt(m2[1],10)};
    return null;
  }
  var hoyM = new Date().getMonth()+1, hoyD = new Date().getDate();
  var _bdaySrc = (typeof _usersCache!=='undefined' && _usersCache && _usersCache.length) ? _usersCache : (S._wtUsers||S.usuarios||[]);
  var cumplesEsteMes = _bdaySrc.filter(function(u){
    if(!u || u.eliminado) return false;
    var c = _parseCumple(u.cumpleanos || u.fechaNacimiento || u.bday);
    return c && c.mes === hoyM;
  }).map(function(u){
    var c = _parseCumple(u.cumpleanos || u.fechaNacimiento || u.bday);
    return {nom:u.nombre||u.email||'Usuario', dia:c.dia, esHoy:c.dia===hoyD};
  }).sort(function(a,b){ return a.dia - b.dia; });
  var cumplesHoy = cumplesEsteMes.filter(function(u){return u.esHoy;});

  // Si el usuario LOGUEADO es cumpleañero hoy, disparar cotillón con SU género
  setTimeout(function(){
    try {
      var u = S.currentUser || {};
      var miCumple = _parseCumple(u.cumpleanos || u.fechaNacimiento);
      if(miCumple && miCumple.mes === hoyM && miCumple.dia === hoyD){
        if(typeof dispararCotillon === 'function' && !window._cotillonShown){
          // Anti-spam por día via localStorage (compatible con centro.js)
          var hoyKey = '_cotillonShown_'+(new Date()).getFullYear()+'-'+hoyM+'-'+hoyD;
          var yaShown = false;
          try { yaShown = !!localStorage.getItem(hoyKey); } catch(e){}
          if(!yaShown){
            window._cotillonShown = true;
            try { localStorage.setItem(hoyKey,'1'); } catch(e){}
            var nombre = u.nombre || u.email || 'Compañero/a';
            var genero = u.genero || '';
            setTimeout(function(){ dispararCotillon(nombre, false, genero); }, 600);
          }
        }
      }
    } catch(e){}
    // Pre-cargar chistes/datos/noticias en segundo plano (silencioso, usa cache si ya hay)
    if(typeof dashDailyLoad === 'function'){
      setTimeout(function(){ dashDailyLoad('chiste', false); }, 300);
      setTimeout(function(){ dashDailyLoad('dato', false); }, 600);
      setTimeout(function(){ dashDailyLoad('noticia', false); }, 900);
    }
  }, 400);

  function _initialsName(n){var p=(n||'').split(/\s+/).filter(Boolean);return ((p[0]||'')[0]||'?').toUpperCase()+((p[1]||'')[0]||'').toUpperCase();}

  return`<div class="page">

  ${pageBanner(
    'Panel principal · '+new Date().toLocaleDateString('es-VE',{weekday:'long',year:'numeric',month:'long',day:'numeric'}),
    'Hola, '+(S.currentUser&&S.currentUser.nombre?S.currentUser.nombre.split(' ')[0]:'')+'!',
    'Resumen general del negocio · cartera activa, cobranza, inventario y rendimiento',
    [
      {label:'Reportes', onclick:"nav('reportes')"},
      {label:'＋ Nueva Solicitud', onclick:'openAddCred()', primary:true}
    ]
  )}

  <!-- Cumpleaños y daily tabs viven ahora en Centro de Trabajo -->


  <style>
    .dash-tasa-card .dash-refresh:hover{transform:rotate(180deg);background:var(--p1);color:#fff!important;border-color:var(--p1)}
    .dash-tasa-card{transition:box-shadow .2s,transform .2s}
    .dash-tasa-card:hover{box-shadow:0 6px 18px rgba(0,0,0,.08)}
  </style>
  <!-- ROW 1: 6 KPI CARDS -->
  <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px;margin-bottom:18px">

    <div class="card dash-kpi" onclick="nav(&quot;creditos&quot;)" style="cursor:pointer;background:var(--p1);border:none">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.85);font-family:var(--fm)">Cartera Activa</span>
        <span style="font-size:9px;background:rgba(255,255,255,0.2);color:#fff;padding:2px 7px;border-radius:20px;font-weight:700">${activos} créditos</span>
      </div>
      <div style="font-family:var(--fd);font-weight:900;font-size:26px;letter-spacing:-1px;color:#fff;margin-bottom:4px">${fmt(cartera)}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.8)">Saldo pendiente de cobro</div>
      <div style="margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,0.2);display:flex;justify-content:space-between;font-size:10.5px">
        <span style="color:rgba(255,255,255,0.8)">${completados} completados</span>
        <span style="color:#fff;font-weight:700">${totalCreds} total →</span>
      </div>
    </div>

    <!-- Créditos Activos (estado de la cartera) -->
    <div class="card dash-kpi" onclick="nav(&quot;creditos&quot;)" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--p1);font-family:var(--fm)">Créditos Activos</span>
        <span style="font-size:9px;background:var(--gs);color:var(--p1);padding:2px 7px;border-radius:20px;font-weight:700">${totalCreds} total</span>
      </div>
      <div style="font-family:var(--fd);font-weight:900;font-size:28px;letter-spacing:-1px;color:var(--p1);margin-bottom:4px">${activos}</div>
      <div style="font-size:11px;color:var(--ink3)">Créditos activos en cartera</div>
      <div style="margin-top:10px;padding-top:9px;border-top:1px solid var(--rim);display:flex;flex-direction:column;gap:6px">
        ${[['Activos',cActivos,'#2563EB'],['En mora',cEnMora,'#E8335A'],['Completados',cCompletados,'#00B876']].map(function(b){var pct=cTotal>0?Math.round(b[1]/cTotal*100):0;return '<div><div style="display:flex;justify-content:space-between;font-size:9.5px;margin-bottom:3px"><span style="color:var(--ink3)">'+b[0]+'</span><span style="font-weight:700;color:var(--ink);font-family:var(--fm)">'+b[1]+'</span></div><div style="background:var(--gs);border-radius:3px;height:5px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+b[2]+';border-radius:3px"></div></div></div>';}).join('')}
      </div>
    </div>

    <div class="card dash-kpi" onclick="nav(&quot;pagos&quot;)" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--green);font-family:var(--fm)">Cobrado (Mes)</span>
        <span style="font-size:9px;background:var(--greens);color:var(--green);padding:2px 7px;border-radius:20px;font-weight:700">${new Date().toLocaleDateString('es-VE',{month:'short'}).replace('.','')}</span>
      </div>
      <div style="font-family:var(--fd);font-weight:900;font-size:28px;letter-spacing:-1px;color:var(--green);margin-bottom:4px">${fmt(ingMesReal)}</div>
      <div style="font-size:11px;color:var(--ink3)">Cobrado este mes</div>
      <div style="margin-top:10px;padding-top:9px;border-top:1px solid var(--rim);display:flex;flex-direction:column;gap:4px">
        <div style="display:flex;justify-content:space-between;font-size:10.5px"><span style="color:var(--ink3)">Cuotas recibidas</span><span style="color:var(--green);font-weight:700">${fmt(cuotasCobradasMes)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:10.5px"><span style="color:var(--ink3)">Iniciales recibidas</span><span style="color:var(--p1);font-weight:700">${fmt(inicialesCobradasMes)}</span></div>
      </div>
    </div>

    <div class="card dash-kpi" onclick="nav(&quot;pagos&quot;)" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--green);font-family:var(--fm)">Cobrado (Total)</span>
        ${pendPagos>0?`<span style="font-size:9px;background:rgba(232,152,10,0.12);color:var(--amber);padding:2px 7px;border-radius:20px;font-weight:700">${pendPagos} pend.</span>`:'<span style="font-size:9px;background:var(--greens);color:var(--green);padding:2px 7px;border-radius:20px;font-weight:700">Al día</span>'}
      </div>
      <div style="font-family:var(--fd);font-weight:900;font-size:28px;letter-spacing:-1px;color:var(--green);margin-bottom:4px">${fmt(ingMes)}</div>
      <div style="font-size:11px;color:var(--ink3)">Histórico total</div>
      <div style="margin-top:10px;padding-top:9px;border-top:1px solid var(--rim);display:flex;flex-direction:column;gap:4px">
        <div style="display:flex;justify-content:space-between;font-size:10.5px"><span style="color:var(--ink3)">Cuotas recibidas</span><span style="color:var(--green);font-weight:700">${fmt(cuotasCobradas)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:10.5px"><span style="color:var(--ink3)">Iniciales recibidas</span><span style="color:var(--p1);font-weight:700">${fmt(inicialesCobradas)}</span></div>
      </div>
    </div>

    <div class="card dash-kpi" onclick="nav(&quot;conta&quot;)" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--p2);font-family:var(--fm)">Utilidad</span>
        <span style="font-size:9px;background:rgba(91,141,239,0.1);color:var(--p2);padding:2px 7px;border-radius:20px;font-weight:700">${new Date().toLocaleDateString('es-VE',{month:'short'})}</span>
      </div>
      <div style="font-family:var(--fd);font-weight:900;font-size:26px;letter-spacing:-1px;color:${utilidad>=0?'var(--p2)':'var(--red)'};margin-bottom:4px">${fmt(utilidad)}</div>
      <div style="font-size:11px;color:var(--ink3)">Ingresos menos Egresos</div>
      <div style="margin-top:10px;padding-top:9px;border-top:1px solid var(--rim);display:flex;justify-content:space-between;font-size:10.5px">
        <span style="color:var(--green)">↑ ${fmt(ingMes)}</span>
        <span style="color:var(--red)">↓ ${fmt(egMes)}</span>
      </div>
    </div>

    <!-- KPI: TASA DEL DÍA (BCV + EUR + Binance) -->
    <div class="card dash-kpi dash-tasa-card" id="dash-tasa-card" style="background:#fff;position:relative">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--p1);font-family:var(--fm)">Tasa del día</span>
        <button class="dash-refresh" onclick="event.stopPropagation();bcvForzarActualizacion&&bcvForzarActualizacion()"
                title="Actualizar tasas"
                style="background:var(--surf2);border:1px solid var(--rim);color:var(--ink2);border-radius:50%;width:22px;height:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;line-height:1;padding:0;transition:transform .3s">↻</button>
      </div>

      <!-- BCV -->
      <div style="display:flex;align-items:center;gap:9px;padding:7px 4px;border-bottom:1px solid var(--rim)">
        <!-- Logo BCV: círculo con líneas estilo seal -->
        <span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#1E40AF;flex-shrink:0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 4v16M11 4v16M16 4v16M3 8h18M3 16h18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>
        </span>
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;font-weight:800;color:var(--ink);letter-spacing:-.1px;line-height:1.2">BCV</div>
          <div style="font-size:9px;color:var(--ink3);font-weight:600;line-height:1.2;margin-top:1px">Dólar oficial</div>
        </div>
        <span id="dash-tasa-bcv" style="font-family:var(--fd);font-weight:900;font-size:15px;color:var(--ink);letter-spacing:-.4px;white-space:nowrap">${(window._tasaBsGlobal||0)>1?(window._tasaBsGlobal).toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</span>
      </div>

      <!-- EUR -->
      <div style="display:flex;align-items:center;gap:9px;padding:7px 4px;border-bottom:1px solid var(--rim)">
        <!-- Logo Euro: círculo con € estilizado -->
        <span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#003399;flex-shrink:0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M16 6.5a6 6 0 0 0-9.5 4.5a6 6 0 0 0 9.5 4.5M4 10h7M4 13h7" stroke="#FFD700" stroke-width="2.4" stroke-linecap="round"/></svg>
        </span>
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;font-weight:800;color:var(--ink);letter-spacing:-.1px;line-height:1.2">Euro</div>
          <div style="font-size:9px;color:var(--ink3);font-weight:600;line-height:1.2;margin-top:1px">EUR oficial</div>
        </div>
        <span id="dash-tasa-eur" style="font-family:var(--fd);font-weight:900;font-size:15px;color:var(--ink);letter-spacing:-.4px;white-space:nowrap">${(window._tasaEuro||0)>1?(window._tasaEuro).toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</span>
      </div>

      <!-- Binance -->
      <div style="display:flex;align-items:center;gap:9px;padding:7px 4px">
        <!-- Logo Binance: 4 rombos -->
        <span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:#0B0E11;flex-shrink:0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#F0B90B"><path d="M12 4l-2.5 2.5L12 9l2.5-2.5L12 4zM5.5 10.5L3 13l2.5 2.5L8 13l-2.5-2.5zm13 0L16 13l2.5 2.5L21 13l-2.5-2.5zM12 15l-2.5 2.5L12 20l2.5-2.5L12 15z"/></svg>
        </span>
        <div style="flex:1;min-width:0">
          <div style="font-size:10px;font-weight:800;color:var(--ink);letter-spacing:-.1px;line-height:1.2">Binance</div>
          <div style="font-size:9px;color:var(--ink3);font-weight:600;line-height:1.2;margin-top:1px">P2P paralelo</div>
        </div>
        <span id="dash-tasa-binance" style="font-family:var(--fd);font-weight:900;font-size:15px;color:var(--ink);letter-spacing:-.4px;white-space:nowrap">${(window._tasaBinance||0)>1?(window._tasaBinance).toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</span>
      </div>

      <!-- Footer: Brecha BCV↔Binance -->
      <div style="margin-top:10px;padding:7px 10px;background:var(--surf2);border-radius:8px;display:flex;justify-content:space-between;align-items:center;font-size:10.5px">
        <span style="color:var(--ink3);font-weight:700">Brecha oficial → paralelo</span>
        <span id="dash-tasa-spread" style="color:var(--ink);font-weight:800;font-family:var(--fd)">${(window._tasaBinance>1&&window._tasaBsGlobal>1)?('+'+(((window._tasaBinance-window._tasaBsGlobal)/window._tasaBinance*100).toFixed(1))+'%'):'—'}</span>
      </div>
    </div>
  </div>

  <!-- ROW 2: Analytics charts -->
  <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px">

    <!-- CRÉDITOS CHART — primero -->
    <div class="card">
      <div class="ch" style="margin-bottom:12px">
        <div>
          <div class="ct">Créditos otorgados</div>
          <div class="cs" id="dash-cred-sub">Últimos 7 meses</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-xs btn-p" id="dash-cred-d"  onclick="setDashPeriodo('creditos','diario')"   style="font-size:10px;padding:4px 9px">Diario</button>
          <button class="btn btn-xs" id="dash-cred-q"  onclick="setDashPeriodo('creditos','quincenal')" style="font-size:10px;padding:4px 9px">Quincenal</button>
          <button class="btn btn-xs" id="dash-cred-m" onclick="setDashPeriodo('creditos','mensual')"   style="font-size:10px;padding:4px 9px">Mensual</button>
        </div>
      </div>
      <div style="position:relative;height:160px;min-height:160px">
        <canvas id="dash-cred-chart" style="width:100%;height:100%"></canvas>
      </div>
    </div>

    <!-- CUOTAS COBRADAS CHART — segundo -->
    <div class="card">
      <div class="ch" style="margin-bottom:12px;flex-wrap:wrap;row-gap:6px">
        <div>
          <div class="ct" style="color:#0E9488">Cuotas cobradas</div>
          <div class="cs" id="dash-cuo-sub">Últimos 30 días</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-xs btn-p" id="dash-cuo-d"  onclick="setDashPeriodo('cuotas','diario')"    style="font-size:10px;padding:4px 9px">Diario</button>
          <button class="btn btn-xs" id="dash-cuo-q"  onclick="setDashPeriodo('cuotas','quincenal')" style="font-size:10px;padding:4px 9px">Quincenal</button>
          <button class="btn btn-xs" id="dash-cuo-m" onclick="setDashPeriodo('cuotas','mensual')"   style="font-size:10px;padding:4px 9px">Mensual</button>
        </div>
      </div>
      <div style="position:relative;height:160px;min-height:160px">
        <canvas id="dash-cuo-chart" style="width:100%;height:100%"></canvas>
      </div>
    </div>

    <!-- INGRESOS CHART — tercero -->
    <div class="card">
      <div class="ch" style="margin-bottom:12px">
        <div>
          <div class="ct">Ingresos</div>
          <div class="cs" id="dash-ing-sub">Últimos 7 meses</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-xs btn-p" id="dash-ing-d"  onclick="setDashPeriodo('ingresos','diario')"  style="font-size:10px;padding:4px 9px">Diario</button>
          <button class="btn btn-xs" id="dash-ing-q"  onclick="setDashPeriodo('ingresos','quincenal')" style="font-size:10px;padding:4px 9px">Quincenal</button>
          <button class="btn btn-xs" id="dash-ing-m" onclick="setDashPeriodo('ingresos','mensual')"   style="font-size:10px;padding:4px 9px">Mensual</button>
        </div>
      </div>
      <div style="position:relative;height:160px;min-height:160px">
        <canvas id="dash-chart" style="width:100%;height:100%"></canvas>
      </div>
    </div>

    <!-- EGRESOS CHART — cuarto -->
    <div class="card">
      <div class="ch" style="margin-bottom:12px">
        <div>
          <div class="ct" style="color:var(--red)">Egresos</div>
          <div class="cs" id="dash-egr-sub">Últimos 30 días</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-xs btn-p" id="dash-egr-d"  onclick="setDashPeriodo('egresos','diario')"   style="font-size:10px;padding:4px 9px">Diario</button>
          <button class="btn btn-xs" id="dash-egr-q"  onclick="setDashPeriodo('egresos','quincenal')" style="font-size:10px;padding:4px 9px">Quincenal</button>
          <button class="btn btn-xs" id="dash-egr-m" onclick="setDashPeriodo('egresos','mensual')"   style="font-size:10px;padding:4px 9px">Mensual</button>
        </div>
      </div>
      <div style="position:relative;height:160px;min-height:160px">
        <canvas id="dash-egr-chart" style="width:100%;height:100%"></canvas>
      </div>
    </div>

  </div>

    <!-- ROW 2b: 5 cards de operación -->
  <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:14px;margin-bottom:18px">

    <!-- 1 · Mora por mes -->
    <div class="card dash-kpi" onclick="nav(&quot;cobranza&quot;)" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--red);font-family:var(--fm)">Mora por mes</span>
        <span style="font-size:9px;background:var(--reds);color:var(--red);padding:2px 7px;border-radius:20px;font-weight:700">6 meses</span>
      </div>
      <div style="font-family:var(--fd);font-weight:900;font-size:26px;letter-spacing:-1px;color:${mora>0?'var(--red)':'var(--green)'};margin-bottom:4px">${mora>0?mora:'✓'}</div>
      <div style="font-size:11px;color:var(--ink3)">${mora>0?'Créditos con atraso':'Sin atrasos'}</div>
      ${(function(){try{var d=(typeof getMoraMensual==='function')?getMoraMensual():[];if(!d||!d.length)return'';var mx=Math.max(1,...d.map(function(x){return x.mora||0;}));return'<div style="display:flex;align-items:flex-end;gap:4px;height:42px;margin-top:10px;padding-top:9px;border-top:1px solid var(--rim)">'+d.map(function(x){var h=Math.max(3,Math.round((x.mora||0)/mx*26));return'<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;justify-content:flex-end"><div style="width:100%;max-width:13px;background:var(--red);opacity:.8;border-radius:3px 3px 0 0;height:'+h+'px"></div><span style="font-size:7px;color:var(--ink3);font-family:var(--fm)">'+x.label+'</span></div>';}).join('')+'</div>';}catch(e){return'';}})()}
    </div>

    <!-- 2 · Promedios de crédito (inicial y cuota) -->
    <div class="card dash-kpi" onclick="nav(&quot;creditos&quot;)" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--p1);font-family:var(--fm)">Promedios de crédito</span>
        <span style="font-size:9px;background:var(--gs);color:var(--p1);padding:2px 7px;border-radius:20px;font-weight:700">${credsProm.length} créd.</span>
      </div>
      <div style="font-family:var(--fd);font-weight:900;font-size:26px;letter-spacing:-1px;color:var(--p1);margin-bottom:4px">${fmt(inicialProm)}</div>
      <div style="font-size:11px;color:var(--ink3)">Inicial promedio</div>
      <div style="margin-top:10px;padding-top:9px;border-top:1px solid var(--rim);display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:10.5px"><span style="color:var(--ink3)">Cuota promedio · quincena</span><span style="font-weight:800;color:var(--green);font-family:var(--fd)">${fmt(cuotaProm)}</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:10.5px"><span style="color:var(--ink3)">Equivalente mensual</span><span style="font-weight:700;color:var(--ink);font-family:var(--fd)">${fmt(cuotaPromMes)}</span></div>
      </div>
    </div>

    <!-- 3 · Pagos por método -->
    <div class="card dash-kpi" onclick="nav(&quot;pagos&quot;)" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--p1);font-family:var(--fm)">Pagos por método</span>
        <span style="font-size:9px;background:var(--gs);color:var(--p1);padding:2px 7px;border-radius:20px;font-weight:700">${metodoTotalReal} pagos</span>
      </div>
      <div style="font-family:var(--fd);font-weight:900;font-size:26px;letter-spacing:-1px;color:var(--ink);margin-bottom:4px">${metodoEntries.length}</div>
      <div style="font-size:11px;color:var(--ink3)">Métodos en uso</div>
      <div style="margin-top:10px;padding-top:9px;border-top:1px solid var(--rim);display:flex;flex-direction:column;gap:6px">
        ${metodoEntries.length>0?metodoEntries.slice(0,4).map(function(e,i){var pct=metodoTotal>0?Math.round(e[1]/metodoTotal*100):0;return '<div style="display:flex;align-items:center;gap:6px"><span style="width:8px;height:8px;border-radius:50%;background:'+metodoColors[i%metodoColors.length]+';flex-shrink:0"></span><span style="font-size:9.5px;color:var(--ink3);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+e[0]+'</span><span style="font-size:10px;font-weight:700;color:var(--ink);font-family:var(--fm)">'+pct+'%</span></div>';}).join(''):'<div style="font-size:10px;color:var(--ink3);text-align:center;padding:6px 0">Sin pagos confirmados</div>'}
      </div>
    </div>

    <!-- 4 · Alerta de cobranza -->
    <div class="card dash-kpi" onclick="nav(&quot;cobranza&quot;)" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${mora>0?'var(--red)':'var(--green)'};font-family:var(--fm)">Alerta de cobranza</span>
        <span style="font-size:9px;background:${mora>0?'var(--reds)':'var(--greens)'};color:${mora>0?'var(--red)':'var(--green)'};padding:2px 7px;border-radius:20px;font-weight:700">${mora>0?mora+' en mora':'Al día'}</span>
      </div>
      <div style="font-family:var(--fd);font-weight:900;font-size:26px;letter-spacing:-1px;color:${mora>0?'var(--red)':'var(--green)'};margin-bottom:4px">${mora>0?mora:'✓'}</div>
      <div style="font-size:11px;color:var(--ink3)">${mora>0?'Requieren gestión':'Todos al día'}</div>
      <div style="margin-top:10px;padding-top:9px;border-top:1px solid var(--rim);display:flex;flex-direction:column;gap:6px">
        ${mora>0?_SCREDS.filter(function(c){return c.mora>0;}).slice(0,3).map(function(c){return '<div style="display:flex;align-items:center;gap:7px"><span style="font-size:8px;font-weight:900;color:var(--red);font-family:var(--fm);background:var(--reds);padding:2px 5px;border-radius:5px;flex-shrink:0">'+c.mora+'d</span><span style="font-size:10px;color:var(--ink2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+c.cli+'</span><span style="font-size:10px;font-weight:700;color:var(--red);font-family:var(--fd)">'+fmt(c.cuotaQ||c.cuota)+'</span></div>';}).join(''):'<div style="font-size:10px;color:var(--green);text-align:center;padding:6px 0">✓ Sin clientes en mora</div>'}
      </div>
    </div>

    <!-- 5 · Próximas cuotas -->
    <div class="card dash-kpi" onclick="nav(&quot;pagos&quot;)" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--amber);font-family:var(--fm)">Próximas cuotas</span>
        <span style="font-size:9px;background:${hoy.length>0?'var(--ambers)':'var(--greens)'};color:${hoy.length>0?'var(--amber)':'var(--green)'};padding:2px 7px;border-radius:20px;font-weight:700">${hoy.length}</span>
      </div>
      <div style="font-family:var(--fd);font-weight:900;font-size:26px;letter-spacing:-1px;color:var(--ink);margin-bottom:4px">${hoy.length}</div>
      <div style="font-size:11px;color:var(--ink3)">Por cobrar pronto</div>
      <div style="margin-top:10px;padding-top:9px;border-top:1px solid var(--rim);display:flex;flex-direction:column;gap:6px">
        ${hoy.length>0?hoy.slice(0,3).map(function(c){var start=parseFechaLocal(c.fecha);var cuotaNum=(c.pagado||0)+1;var vence=new Date(start.getTime()+(cuotaNum*15*24*60*60*1000));var diff=Math.round((vence-new Date())/(24*60*60*1000));var col=diff<0?'var(--red)':diff<=1?'var(--amber)':'var(--green)';var lbl=diff<0?Math.abs(diff)+'d':diff===0?'hoy':diff+'d';return '<div style="display:flex;align-items:center;gap:7px"><span style="font-size:8px;font-weight:900;font-family:var(--fm);color:'+col+';background:var(--gs);padding:2px 5px;border-radius:5px;flex-shrink:0">'+lbl+'</span><span style="font-size:10px;color:var(--ink2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+c.cli+'</span><span style="font-size:10px;font-weight:700;color:var(--ink);font-family:var(--fd)">'+fmt(c.cuotaQ||c.cuota)+'</span></div>';}).join(''):'<div style="font-size:10px;color:var(--ink3);text-align:center;padding:6px 0">Sin cuotas próximas</div>'}
      </div>
    </div>

  </div>

<!-- ROW 5: Quick access -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px">
    ${[
      ['CLI','var(--gs)','var(--p1)','rgba(37,99,235,0.15)','Clientes',_concFiltrarClientes(S.clientes||[]).length,'registrados',"nav('clientes')"],
      ['MOT','var(--greens)','var(--green)','rgba(6,176,106,0.15)','Disponibles',dispMotos,'de '+_SMOTOS.filter(m=>!m.eliminado).length+' motos',"nav('motos');setTimeout(()=>setMTab('disponible'),100)"],
      ['ACT','rgba(37,99,235,0.08)','var(--p1)','rgba(37,99,235,0.2)','Activos',activos,'créditos activos',"nav('creditos')"],
      ['PLN','var(--gs)','var(--p1)','var(--rim2)','Catálogo',CATALOGO.length,'modelos',"nav('plan')"],
    ].map(([ic,bg,cl,br,label,val,sub,action])=>`
    <div class="card" onclick="${action}" style="cursor:pointer;display:flex;align-items:center;gap:12px;padding:13px 15px;border-color:${br}" onmouseover="this.style.borderColor='rgba(37,99,235,0.3)'" onmouseout="this.style.borderColor='${br}'">
      <div style="width:38px;height:38px;border-radius:10px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:${cl};font-family:var(--fm);flex-shrink:0">${ic}</div>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--fd);font-weight:700;font-size:22px;color:var(--ink);letter-spacing:-1.5px;line-height:1">${val}</div>
        <div style="font-size:10px;color:var(--ink3);margin-top:2px;font-weight:500">${sub}</div>
      </div>
    </div>`).join('')}
  </div>
</div>`;
};

