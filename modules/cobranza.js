// Pagasi module: cobranza
PG.cobranza = function(){
  var _SCREDS = _concFiltrar(S.creds||[]);
  var _SPAGOS = _concFiltrar(S.pagos||[]);
  const mora = _SCREDS.filter(c=>c.mora>0&&!c.eliminado);
  const bucket1= mora.filter(c=>c.mora<=15);
  const bucket2= mora.filter(c=>c.mora>15&&c.mora<=30);
  const bucket3= mora.filter(c=>c.mora>30&&c.mora<=60);
  const bucket4= mora.filter(c=>c.mora>60);
  const deudaTotal = mora.reduce((a,c)=>a+parseFloat(c.cuotaQ||c.cuota||0)*Math.ceil(c.mora/15),0);
  const promMora = mora.length?Math.round(mora.reduce((a,c)=>a+c.mora,0)/mora.length):0;
  const recuperadas= _SCREDS.filter(c=>c.estado==='recuperado'||c.estado==='recuperada').length;
  const cuotaCobrable = mora.reduce((a,c)=>a+parseFloat(c.cuotaQ||c.cuota||0),0);

  // ═══════════ MÉTRICAS AVANZADAS ═══════════
  var totalActivos = _SCREDS.filter(function(c){return c.estado==='activo' && !c.eliminado;}).length;
  var tasaMora = totalActivos ? Math.round(mora.length/totalActivos*100) : 0;
  var alDia = totalActivos - mora.length;

  // Pagos confirmados hoy y esta semana
  var hoy = new Date(); hoy.setHours(0,0,0,0);
  var hoyStr = fechaLocalISO(hoy);
  var iniSemana = new Date(hoy); iniSemana.setDate(hoy.getDate() - hoy.getDay());
  var iniSemanaStr = fechaLocalISO(iniSemana);
  var iniMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  var iniMesStr = fechaLocalISO(iniMes);

  var pagosHoy = _SPAGOS.filter(function(p){return !p.eliminado && p.estado==='confirmado' && p.fecha===hoyStr;});
  var cobradoHoy = pagosHoy.reduce(function(a,p){return a+p.monto;},0);
  var pagosSemana = _SPAGOS.filter(function(p){return !p.eliminado && p.estado==='confirmado' && p.fecha>=iniSemanaStr;});
  var cobradoSemana = pagosSemana.reduce(function(a,p){return a+p.monto;},0);
  var pagosMes = _SPAGOS.filter(function(p){return !p.eliminado && p.estado==='confirmado' && p.fecha>=iniMesStr;});
  var cobradoMes = pagosMes.reduce(function(a,p){return a+p.monto;},0);

  // Efectividad cobranza (% del cuotas del mes cobradas)
  var cuotasEsperadasMes = _SCREDS.filter(function(c){return c.estado==='activo' && !c.eliminado;}).reduce(function(a,c){return a+parseFloat(c.cuotaM||0);},0);
  var efectividadMes = cuotasEsperadasMes ? Math.round(cobradoMes/cuotasEsperadasMes*100) : 0;

  // Proyección cobranza si se recuperan todas las cuotas en mora
  var cobranzaPotencial = mora.reduce(function(a,c){return a+parseFloat(c.cuotaQ||c.cuota||0)*Math.ceil(c.mora/15);},0);

  // ── Chart: Recuperación por semana (últimas 8 semanas) ──
  const semanas = [];
  for(let i=7;i>=0;i--){
    const inicio = new Date(hoy); inicio.setDate(hoy.getDate() - (i*7 + hoy.getDay()));
    const fin = new Date(inicio); fin.setDate(inicio.getDate()+6);
    const iniStr = fechaLocalISO(inicio);
    const finStr = fechaLocalISO(fin);
    const tot = _SPAGOS
      .filter(p=>!p.eliminado && p.estado==='confirmado' && p.fecha>=iniStr && p.fecha<=finStr)
      .reduce((a,p)=>a+p.monto,0);
    const cnt = _SPAGOS.filter(p=>!p.eliminado && p.estado==='confirmado' && p.fecha>=iniStr && p.fecha<=finStr).length;
    const lbl = String(inicio.getDate()).padStart(2,'0')+'/'+String(inicio.getMonth()+1).padStart(2,'0');
    semanas.push({lbl, tot, cnt});
  }
  const maxSem = Math.max(1,...semanas.map(s=>s.tot));

  // Tendencia semana vs semana anterior
  var tendenciaSemanal = 0;
  if(semanas[semanas.length-2].tot > 0){
    tendenciaSemanal = Math.round((semanas[semanas.length-1].tot - semanas[semanas.length-2].tot)/semanas[semanas.length-2].tot*100);
  }

  // ── Chart: Cobros por día últimos 14 días ──
  var dias14 = [];
  for(var d=13; d>=0; d--){
    var dia = new Date(hoy); dia.setDate(hoy.getDate()-d);
    var diaStr = fechaLocalISO(dia);
    var tot = _SPAGOS.filter(function(p){return !p.eliminado && p.estado==='confirmado' && p.fecha===diaStr;}).reduce(function(a,p){return a+p.monto;},0);
    var diaLbl = String(dia.getDate()).padStart(2,'0');
    var dayOfWeek = dia.getDay();
    dias14.push({lbl:diaLbl, tot:tot, esDomingo:dayOfWeek===0, esHoy:d===0});
  }
  var maxDia = Math.max(1, Math.max.apply(null, dias14.map(function(d){return d.tot;})));

  // ── Top 5 deudores ──
  const topDeudores = mora.slice().sort((a,b)=>(b.mora||0)-(a.mora||0)).slice(0,5);

  // Distribución de motivos de mora (simulada con buckets)
  // Cobrador con mejor recuperación (si existe data)
  var cobradoresStats = {};
  _SPAGOS.filter(function(p){return !p.eliminado && p.estado==='confirmado' && p.fecha>=iniMesStr;}).forEach(function(p){
    var c = p.cobrador || 'Sin asignar';
    if(!cobradoresStats[c]) cobradoresStats[c] = {cnt:0, tot:0};
    cobradoresStats[c].cnt++;
    cobradoresStats[c].tot += p.monto;
  });
  var topCobradores = Object.keys(cobradoresStats).map(function(k){return {nombre:k, cnt:cobradoresStats[k].cnt, tot:cobradoresStats[k].tot};}).sort(function(a,b){return b.tot-a.tot;}).slice(0,3);

  setTimeout(function(){
    var el=$('cobranza-notas-list'); if(!el) return;
    var all=[];
    (S.creds||[]).forEach(function(c){ if(Array.isArray(c.gestiones)) c.gestiones.forEach(function(n){ all.push(Object.assign({credId:n.credId||c.id}, n)); }); });
    all.sort(function(a,b){ return String(b.creadoEn||b.fecha||'').localeCompare(String(a.creadoEn||a.fecha||'')); });
    all=all.slice(0,30);
    if(!all.length){ el.innerHTML='<div style="color:var(--ink3);font-size:12px;padding:12px 0">Sin gestiones registradas aún</div>'; return; }
    var esc=function(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};
    el.innerHTML=all.map(function(n){
      var typeColor={Llamada:'var(--p1)',WhatsApp:'var(--green)',Visita:'var(--amber)',Acuerdo:'var(--blue)'}[n.tipo]||'var(--ink3)';
      return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--rim2)">'
        +'<div style="width:32px;height:32px;border-radius:8px;background:var(--surf2);border:1px solid var(--rim);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:'+typeColor+';flex-shrink:0">'+esc((n.tipo||'Nota').slice(0,3).toUpperCase())+'</div>'
        +'<div style="flex:1;min-width:0">'
          +'<div style="font-size:12.5px;font-weight:700">'+esc(n.tipo||'Gestión')+' — <span style="color:var(--p1)">'+esc(n.credId)+'</span></div>'
          +'<div style="font-size:11.5px;color:var(--ink3);margin-top:2px">'+esc(n.resultado)+'</div>'
          +(n.fechaCompromiso?'<div style="font-size:11px;color:var(--p1);margin-top:3px;font-weight:700">Compromiso: '+esc(n.fechaCompromiso)+'</div>':'')
        +'</div>'
        +'<div style="text-align:right;flex-shrink:0"><div style="font-size:11px;font-weight:600;color:var(--ink2)">'+esc(n.cobrador)+'</div><div style="font-size:10px;color:var(--ink3)">'+esc(n.fecha)+(n.hora?' · '+esc(n.hora):'')+'</div></div>'
        +'</div>';
    }).join('');
  }, 120);

  function moraRow(c){
    const cl=S.clientes.find(x=>x.nombre===c.cli)||{};
    const critico = c.mora>60, grave = c.mora>30;
    const sevColor = grave ? 'var(--red)' : 'var(--amber)';
    const sevTint  = grave ? 'rgba(232,51,90,.10)' : 'rgba(245,166,35,.14)';
    const cuotasVencidas = Math.ceil(c.mora/15);
    const adeuda = parseFloat(c.cuotaQ||c.cuota||0)*cuotasVencidas;
    const ini = ((c.cli||'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(function(w){return w[0];}).join('')||'?').toUpperCase();
    const ibtn = 'width:36px;height:36px;border-radius:9px;border:1px solid var(--rim);background:var(--surf2);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background .15s,border-color .15s;padding:0';
    return `<div style="background:var(--surf);border:1px solid var(--rim);border-left:4px solid ${sevColor};border-radius:14px;padding:13px 15px;margin-bottom:10px;box-shadow:var(--shadow);transition:transform .15s,box-shadow .2s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 10px 24px rgba(15,23,42,.10)'" onmouseout="this.style.transform='';this.style.boxShadow='var(--shadow)'">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:42px;height:42px;border-radius:12px;background:${sevTint};color:${sevColor};display:flex;align-items:center;justify-content:center;font-family:var(--fd);font-weight:900;font-size:15px;flex-shrink:0">${ini}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:7px">
            <span style="font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.cli}</span>
            ${critico?'<span class="bdg b-r" style="font-size:8.5px;padding:1px 7px;flex-shrink:0">CRÍTICO</span>':''}
          </div>
          <div style="font-size:11px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px">${c.id} · ${c.modelo||'—'}${cl.tel?' · '+cl.tel:''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:var(--fd);font-weight:900;font-size:21px;color:${sevColor};letter-spacing:-.5px;line-height:1">${fmt(adeuda)}</div>
          <div style="margin-top:4px;white-space:nowrap"><span style="font-size:10px;color:var(--ink3)">${cuotasVencidas} cuota${cuotasVencidas>1?'s':''} · </span><span style="background:${sevColor};color:#fff;font-size:9.5px;font-weight:800;padding:1px 7px;border-radius:20px">${c.mora}d</span></div>
        </div>
      </div>
      <div style="display:flex;gap:7px;margin-top:11px;align-items:center">
        <button class="btn btn-p" onclick="openPagoRapido('${c.id}')" style="flex:1;font-weight:800;font-size:12.5px;padding:9px 12px;display:inline-flex;align-items:center;justify-content:center;gap:7px">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.4"/></svg>Cobrar ahora
        </button>
        <button onclick="whatsappCliente('${c.id}')" title="Enviar WhatsApp" style="${ibtn};color:var(--green)" onmouseover="this.style.background='var(--greens)';this.style.borderColor='var(--green)'" onmouseout="this.style.background='var(--surf2)';this.style.borderColor='var(--rim)'">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.9.9-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-5.6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.7.9-.3.2-.5.1a6.5 6.5 0 0 1-1.9-1.2 7.2 7.2 0 0 1-1.3-1.7c-.1-.2 0-.3.1-.4l.4-.4.2-.4v-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1A4.9 4.9 0 0 0 7 11.9a11 11 0 0 0 4.2 3.7c.6.3 1 .4 1.4.5a3.3 3.3 0 0 0 1.5.1c.5-.1 1.4-.6 1.6-1.1s.2-1 .1-1.1-.2-.2-.5-.3z"/></svg>
        </button>
        <button onclick="llamarCliente('${c.id}')" title="Llamar" style="${ibtn};color:var(--p1)" onmouseover="this.style.background='var(--lift)';this.style.borderColor='var(--p1)'" onmouseout="this.style.background='var(--surf2)';this.style.borderColor='var(--rim)'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .6 3.6 1 1 0 0 1-.2 1z"/></svg>
        </button>
        <button onclick="openNota('${c.id}')" title="Agregar nota" style="${ibtn};color:var(--ink2)" onmouseover="this.style.background='var(--lift)'" onmouseout="this.style.background='var(--surf2)'">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.2V21h3.8L17.8 9.9l-3.8-3.8L3 17.2zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8L20.7 7z"/></svg>
        </button>
        <button onclick="confirmarRecuperacion('${c.id}')" title="Recuperar moto" style="${ibtn};color:var(--red);border-color:rgba(232,51,90,.28)" onmouseover="this.style.background='var(--reds)'" onmouseout="this.style.background='var(--surf2)'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-1"/></svg>
        </button>
      </div>
    </div>`;
  }

  return`<div class="page">

  ${pageBanner(
    'Centro de recuperación · Cobranza',
    'Cobranza',
    '<b>'+mora.length+'</b> en mora · Potencial: <b>'+fmt(cobranzaPotencial)+'</b> · Efectividad: <b>'+efectividadMes+'%</b>',
    [
      {label:'↓ Exportar mora', onclick:"exportarCSV('cobranza')"},
      {label:'Registrar pago', onclick:"nav('pagos')", primary:true}
    ]
  )}

  <!-- ═══ KPIs COMPACTOS ═══ -->
  <div class="sg" style="grid-template-columns:repeat(6,1fr);margin-bottom:14px">
    <div class="stat">
      <div class="st-v" style="color:var(--red);font-size:26px">${mora.length}</div>
      <div class="st-l">En mora</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:2px">de ${totalActivos} activos · ${tasaMora}%</div>
    </div>
    <div class="stat">
      <div class="st-v" style="color:var(--amber);font-size:26px">${fmt(deudaTotal)}</div>
      <div class="st-l">Deuda total</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:2px">~${promMora}d promedio</div>
    </div>
    <div class="stat">
      <div class="st-v" style="color:var(--green);font-size:26px">${fmt(cobradoHoy)}</div>
      <div class="st-l">Cobrado hoy</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:2px">${pagosHoy.length} pagos</div>
    </div>
    <div class="stat">
      <div class="st-v" style="color:var(--p1);font-size:26px">${fmt(cobradoSemana)}</div>
      <div class="st-l">Esta semana</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:2px">${tendenciaSemanal>0?'↑ +'+tendenciaSemanal+'%':tendenciaSemanal<0?'↓ '+tendenciaSemanal+'%':'→ estable'}</div>
    </div>
    <div class="stat">
      <div class="st-v" style="color:var(--green);font-size:26px">${efectividadMes}%</div>
      <div class="st-l">Efectividad mes</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:2px">${fmt(cobradoMes)} cobrado</div>
    </div>
    <div class="stat">
      <div class="st-v" style="font-size:22px">${alDia}</div>
      <div class="st-l">Al día</div>
      <div style="font-size:10px;color:var(--green);margin-top:2px;font-weight:700">✓ sin mora</div>
    </div>
  </div>

  <!-- ═══ BARRA DE SEVERIDAD ═══ -->
  <div class="card" style="margin-bottom:14px;padding:12px 16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-size:12px;font-weight:800;color:var(--ink2)">Distribución por severidad</div>
      <div style="display:flex;gap:12px;font-size:11px">
        <span style="color:var(--amber);font-weight:700">⬛ ${bucket1.length} leve</span>
        <span style="color:var(--red);font-weight:700">⬛ ${bucket2.length} moderada</span>
        <span style="color:var(--red);font-weight:700">⬛ ${bucket3.length} grave</span>
        <span style="color:#8B0000;font-weight:800">⬛ ${bucket4.length} crítico</span>
      </div>
    </div>
    ${mora.length
      ? `<div style="display:flex;height:28px;border-radius:8px;overflow:hidden;background:var(--surf2)">
          ${bucket1.length?`<div style="flex:${bucket1.length};background:linear-gradient(90deg,#e8980a,#ffa94d);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800">${bucket1.length>1?bucket1.length:''}</div>`:''}
          ${bucket2.length?`<div style="flex:${bucket2.length};background:linear-gradient(90deg,#d93b5a,#ec6584);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800">${bucket2.length>1?bucket2.length:''}</div>`:''}
          ${bucket3.length?`<div style="flex:${bucket3.length};background:linear-gradient(90deg,#c0392b,#d93b5a);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800">${bucket3.length>1?bucket3.length:''}</div>`:''}
          ${bucket4.length?`<div style="flex:${bucket4.length};background:linear-gradient(90deg,#8B0000,#a52424);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800">${bucket4.length>1?bucket4.length:''}</div>`:''}
          <div style="flex:${alDia};background:var(--greens);min-width:4px"></div>
        </div>`
      : `<div style="text-align:center;padding:10px;background:rgba(5,160,96,.08);border-radius:8px;color:var(--green);font-weight:800;font-size:12px">✓ Sin clientes en mora</div>`
    }
  </div>

  <!-- ═══ TABS ═══ -->
  <div style="display:flex;gap:0;border-bottom:2px solid var(--rim);margin-bottom:16px">
    ${(function(){
      var tab = window._cobTab||'mora';
      var tabs=[['mora','📋 Lista de mora ('+mora.length+')'],['gestiones','📞 Gestiones'],['rendimiento','📊 Rendimiento']];
      return tabs.map(function(t){
        var active = tab===t[0];
        return '<button onclick="window._cobTab=\''+t[0]+'\';nav(\'cobranza\')" style="background:none;border:none;padding:11px 18px;font-size:13px;font-weight:'+(active?800:600)+';color:'+(active?'var(--p1)':'var(--ink3)')+';border-bottom:'+(active?'3px solid var(--p1)':'3px solid transparent')+';margin-bottom:-2px;cursor:pointer;font-family:var(--f)">'+t[1]+'</button>';
      }).join('');
    })()}
  </div>

  <!-- ══ TAB: LISTA DE MORA ══ -->
  <div style="display:${(window._cobTab||'mora')==='mora'?'block':'none'}">
    <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:14px;align-items:start">

      <!-- Lista priorizada -->
      <div>
        ${bucket4.length?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding:8px 12px;background:rgba(139,0,0,.1);border-radius:10px;border-left:4px solid #8B0000">
          <span style="font-size:13px">🚨</span>
          <span style="font-size:11.5px;font-weight:800;color:#8B0000;text-transform:uppercase;letter-spacing:.5px">Crítico — +60 días (${bucket4.length})</span>
        </div>${bucket4.map(moraRow).join('')}`:''}
        ${bucket3.length?`<div style="display:flex;align-items:center;gap:8px;margin:${bucket4.length?'16px':'0'} 0 10px;padding:8px 12px;background:var(--reds);border-radius:10px;border-left:4px solid var(--red)">
          <span style="font-size:13px">🔴</span>
          <span style="font-size:11.5px;font-weight:800;color:var(--red);text-transform:uppercase;letter-spacing:.5px">Grave — 31–60 días (${bucket3.length})</span>
        </div>${bucket3.map(moraRow).join('')}`:''}
        ${bucket2.length?`<div style="display:flex;align-items:center;gap:8px;margin:${(bucket3.length||bucket4.length)?'16px':'0'} 0 10px;padding:8px 12px;background:rgba(217,59,90,.07);border-radius:10px;border-left:4px solid var(--red)">
          <span style="font-size:13px">⚠️</span>
          <span style="font-size:11.5px;font-weight:800;color:var(--red);text-transform:uppercase;letter-spacing:.5px">Moderada — 16–30 días (${bucket2.length})</span>
        </div>${bucket2.map(moraRow).join('')}`:''}
        ${bucket1.length?`<div style="display:flex;align-items:center;gap:8px;margin:${(bucket2.length||bucket3.length||bucket4.length)?'16px':'0'} 0 10px;padding:8px 12px;background:var(--ambers);border-radius:10px;border-left:4px solid var(--amber)">
          <span style="font-size:13px">🟡</span>
          <span style="font-size:11.5px;font-weight:800;color:var(--amber);text-transform:uppercase;letter-spacing:.5px">Leve — 1–15 días (${bucket1.length})</span>
        </div>${bucket1.map(moraRow).join('')}`:''}
        <!-- Acciones rápidas -->
        <div class="card" style="padding:14px;margin-bottom:12px">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:var(--ink3);margin-bottom:10px">Acciones rápidas</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
            <button class="btn btn-p btn-sm" onclick="nav('pagos')" style="justify-content:center">💵 Cobrar</button>
            <button class="btn btn-g btn-sm" onclick="nav('creditos')" style="justify-content:center">📋 Créditos</button>
            <button class="btn btn-g btn-sm" onclick="exportarCSV('cobranza')" style="justify-content:center">↓ Exportar</button>
            <button class="btn btn-g btn-sm" onclick="nav('clientes')" style="justify-content:center">👥 Clientes</button>
          </div>
        </div>

        ${!mora.length?`<div class="card" style="padding:20px 24px">
          <div style="display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--rim2);margin-bottom:16px">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(5,160,96,.12);display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div>
              <div style="font-size:13px;font-weight:800;color:var(--ink1)">Sin clientes en mora</div>
              <div style="font-size:11px;color:var(--ink3);margin-top:1px">Todos los créditos activos están al día</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div style="background:var(--bg2);border-radius:10px;padding:12px 14px">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--ink3);font-weight:700;margin-bottom:4px">En mora</div>
              <div style="font-size:22px;font-weight:900;color:var(--green)">0</div>
            </div>
            <div style="background:var(--bg2);border-radius:10px;padding:12px 14px">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--ink3);font-weight:700;margin-bottom:4px">Recuperados</div>
              <div style="font-size:22px;font-weight:900;color:var(--ink1)">${recuperadas}</div>
            </div>
          </div>
        </div>`:''}
      </div>

      <!-- Panel lateral derecho -->
      <div style="display:flex;flex-direction:column;gap:12px">

        <!-- Top 5 deudores -->
        <div class="card">
          <div class="ch"><div><div class="ct">Top deudores</div><div class="cs">Mayor mora acumulada</div></div></div>
          ${topDeudores.length ? topDeudores.map(function(c,i){
            var col = c.mora>60?'#8B0000':c.mora>30?'var(--red)':'var(--amber)';
            return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--rim2);cursor:pointer" onclick="openAmort(\''+c.id+'\')">'
              +'<div style="width:24px;height:24px;border-radius:6px;background:'+col+';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:10px;flex-shrink:0">'+(i+1)+'</div>'
              +'<div style="flex:1;min-width:0">'
                +'<div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+c.cli+'</div>'
                +'<div style="font-size:10px;color:var(--ink3)">'+c.modelo+'</div>'
              +'</div>'
              +'<div style="text-align:right;flex-shrink:0">'
                +'<div style="font-size:15px;font-weight:900;color:'+col+';line-height:1">'+c.mora+'d</div>'
                +'<div style="font-size:10px;color:var(--ink3)">'+fmt(c.cuotaQ||c.cuota||0)+'</div>'
              +'</div>'
            +'</div>';
          }).join('') : '<div style="color:var(--green);padding:16px 0;text-align:center;font-size:12px;font-weight:700">✓ Sin deudores</div>'}
        </div>

        <!-- Resumen mes -->
        <div class="card" style="padding:14px">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:var(--ink3);margin-bottom:10px">Resumen del mes</div>
          <div style="display:flex;flex-direction:column;gap:7px">
            ${[
              ['Pagos registrados', pagosMes.length, 'var(--p1)'],
              ['Total recaudado', fmt(cobradoMes), 'var(--green)'],
              ['Recuperados', recuperadas, 'var(--green)'],
              ['Efectividad', efectividadMes+'%', efectividadMes>=70?'var(--green)':efectividadMes>=40?'var(--amber)':'var(--red)'],
            ].map(([l,v,c])=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 10px;background:var(--surf2);border-radius:8px">
              <span style="font-size:11.5px;color:var(--ink2)">${l}</span>
              <span style="font-size:14px;font-weight:900;color:${c}">${v}</span>
            </div>`).join('')}
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- ══ TAB: GESTIONES ══ -->
  <div style="display:${(window._cobTab||'mora')==='gestiones'?'block':'none'}">
    <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:14px;align-items:start">
      <div class="card">
        <div class="ch"><div><div class="ct">📞 Historial de gestiones</div><div class="cs">Llamadas, WhatsApp, visitas y acuerdos</div></div></div>
        <div id="cobranza-notas-list" style="max-height:500px;overflow-y:auto">
          <div style="color:var(--ink3);font-size:12px;padding:16px 0;text-align:center">Cargando gestiones...</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="card" style="padding:14px">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:var(--ink3);margin-bottom:12px">Nueva gestión</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <select class="fs" id="nota-tipo"><option>Llamada</option><option>WhatsApp</option><option>Visita</option><option>Acuerdo</option></select>
            <input class="fi" id="nota-cred" placeholder="ID del crédito (ej: CRED-001)">
            <textarea class="fi" id="nota-resultado" placeholder="Resultado de la gestión..." style="min-height:80px;resize:vertical"></textarea>
            <input class="fi" id="nota-compromiso" type="date" placeholder="Fecha de compromiso (opcional)">
            <button class="btn btn-p btn-sm" onclick="guardarNotaCobranza()" style="width:100%;justify-content:center">Guardar gestión</button>
          </div>
        </div>
        <div class="card" style="padding:14px">
          <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.7px;color:var(--ink3);margin-bottom:10px">Acciones de contacto</div>
          ${mora.slice(0,4).map(c=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--rim2)">
            <div style="flex:1;min-width:0">
              <div style="font-size:11.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.cli}</div>
              <div style="font-size:10px;color:${c.mora>30?'var(--red)':'var(--amber)'}">${c.mora}d mora</div>
            </div>
            <button class="btn btn-g btn-xs" onclick="whatsappCliente('${c.id}')">WA</button>
            <button class="btn btn-g btn-xs" onclick="llamarCliente('${c.id}')">📞</button>
          </div>`).join('')}
          ${mora.length>4?`<div style="font-size:11px;color:var(--ink3);text-align:center;padding-top:8px">+${mora.length-4} más en la lista de mora</div>`:''}
        </div>
      </div>
    </div>
  </div>

  <!-- ══ TAB: RENDIMIENTO ══ -->
  <div style="display:${(window._cobTab||'mora')==='rendimiento'?'block':'none'}">
    <div style="display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:12px;margin-bottom:14px">

      <!-- Recuperación semanal -->
      <div class="card">
        <div class="ch">
          <div><div class="ct">📈 Recuperación semanal</div><div class="cs">Últimas 8 semanas</div></div>
          <div style="text-align:right">
            <div style="font-weight:900;font-size:18px;color:var(--green)">${fmt(semanas.reduce((a,s)=>a+s.tot,0))}</div>
            <div style="font-size:10px;color:var(--ink3)">${semanas.reduce((a,s)=>a+s.cnt,0)} pagos</div>
          </div>
        </div>
        <div style="display:flex;align-items:flex-end;gap:4px;height:120px;margin-top:12px">
          ${semanas.map((s,i)=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
            <div style="flex:1;width:100%;display:flex;align-items:flex-end">
              <div style="width:100%;background:${i===semanas.length-1?'var(--grad)':s.tot>0?'var(--greens)':'var(--rim)'};border:${s.tot>0?'none':'1px solid var(--rim2)'};border-radius:4px 4px 0 0;height:${s.tot>0?Math.max(8,Math.round(s.tot/maxSem*100)):4}px;position:relative">
                ${i===semanas.length-1&&s.tot>0?'<div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:8px;font-weight:900;color:var(--p1);white-space:nowrap;background:var(--gs);border-radius:3px;padding:1px 4px">HOY</div>':''}
              </div>
            </div>
            <div style="font-size:8.5px;color:var(--ink3);font-weight:600">${s.lbl}</div>
          </div>`).join('')}
        </div>
        <div style="display:flex;gap:14px;margin-top:10px;padding-top:8px;border-top:1px solid var(--rim2);font-size:11px">
          <div><span style="color:var(--ink3)">Promedio:</span> <b style="color:var(--green)">${fmt(semanas.reduce((a,s)=>a+s.tot,0)/8)}</b></div>
          <div><span style="color:var(--ink3)">Tendencia:</span> <b style="color:${tendenciaSemanal>0?'var(--green)':tendenciaSemanal<0?'var(--red)':'var(--ink3)'}">${tendenciaSemanal>0?'↑ +':'↓ '}${tendenciaSemanal}%</b></div>
        </div>
      </div>

      <!-- Últimos 14 días -->
      <div class="card">
        <div class="ch"><div><div class="ct">📅 Últimos 14 días</div><div class="cs">${dias14.reduce((a,d)=>a+(d.tot>0?1:0),0)} días con cobros</div></div></div>
        <div style="display:flex;align-items:flex-end;gap:2px;height:120px;margin-top:12px">
          ${dias14.map(function(d){
            var h = d.tot>0 ? Math.max(6, Math.round(d.tot/maxDia*100)) : 3;
            var col = d.esHoy?'var(--p1)':d.tot>0?'var(--green)':'var(--rim)';
            return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">'
              +'<div style="flex:1;width:100%;display:flex;align-items:flex-end">'
              +'<div style="width:100%;background:'+col+';border-radius:2px 2px 0 0;height:'+h+'px;opacity:'+(d.tot>0?1:.35)+'" title="'+d.lbl+': '+fmt(d.tot)+'"></div>'
              +'</div>'
              +'<div style="font-size:8.5px;color:'+(d.esHoy?'var(--p1)':'var(--ink3)')+';font-weight:'+(d.esHoy?900:600)+'">'+d.lbl+'</div>'
            +'</div>';
          }).join('')}
        </div>
        <div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--rim2);font-size:11px;display:flex;justify-content:space-between">
          <span><span style="color:var(--ink3)">Mejor día:</span> <b>${fmt(maxDia)}</b></span>
          <span><span style="color:var(--ink3)">Total:</span> <b style="color:var(--green)">${fmt(dias14.reduce(function(a,d){return a+d.tot;},0))}</b></span>
        </div>
      </div>

      <!-- Top cobradores -->
      <div class="card">
        <div class="ch"><div><div class="ct">🏆 Cobradores del mes</div><div class="cs">Por monto recaudado</div></div></div>
        ${topCobradores.length ? topCobradores.map(function(c,i){
          var medals=['🥇','🥈','🥉'];
          var pct = cobradoMes > 0 ? Math.round(c.tot/cobradoMes*100) : 0;
          return '<div style="padding:10px 0;border-bottom:1px solid var(--rim2)">'
            +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
              +'<span style="font-size:16px">'+medals[i]+'</span>'
              +'<div style="flex:1;min-width:0">'
                +'<div style="font-size:12.5px;font-weight:800">'+c.nombre+'</div>'
                +'<div style="font-size:10.5px;color:var(--ink3)">'+c.cnt+' pagos · '+pct+'% del total</div>'
              +'</div>'
              +'<div style="font-size:15px;font-weight:900;color:var(--green)">'+fmt(c.tot)+'</div>'
            +'</div>'
            +'<div style="height:5px;background:var(--rim);border-radius:3px;overflow:hidden">'
              +'<div style="height:100%;width:'+pct+'%;background:var(--grad);border-radius:3px"></div>'
            +'</div>'
          +'</div>';
        }).join('') : '<div style="color:var(--ink3);font-size:12px;text-align:center;padding:24px 0">Sin registros este mes</div>'}
        ${renderDashboardCobradores?renderDashboardCobradores():''}
      </div>
    </div>
  </div>

  </div>`;
};

// Guardar gestión desde la pestaña Gestiones del módulo Cobranza
// (se persiste en el crédito; no usa la colección bloqueada notas_cobranza)
function guardarNotaCobranza(){
  var tipo=($('nota-tipo')&&$('nota-tipo').value)||'Gestión';
  var credId=($('nota-cred')&&$('nota-cred').value.trim())||'';
  var result=($('nota-resultado')&&$('nota-resultado').value.trim())||'';
  var comp=($('nota-compromiso')&&$('nota-compromiso').value)||'';
  if(!credId){ if(typeof toast==='function') toast('Indicá el ID del crédito (ej: CRED-007)','error'); return; }
  if(!result){ if(typeof toast==='function') toast('Describí el resultado de la gestión','error'); return; }
  var c=(S.creds||[]).find(function(x){ return String(x.id)===String(credId); });
  if(!c){ if(typeof toast==='function') toast('No se encontró el crédito '+credId,'error'); return; }
  var _now=new Date();
  var nota={ id:'NOTA-'+_now.getTime(), credId:credId, tipo:tipo, resultado:result, montoAcordado:null,
    fechaCompromiso:comp, proximaAccion:'', fecha:(typeof hoyLocalISO==='function'?hoyLocalISO():_now.toISOString().slice(0,10)),
    hora:(typeof _fmtHora==='function'?_fmtHora(_now):''), creadoEn:_now.toISOString(),
    cobrador:(S.currentUser&&S.currentUser.nombre)||'Admin' };
  if(typeof DB!=='undefined' && DB.addGestion){ DB.addGestion(credId, nota); }
  if(typeof logActividad==='function'){ logActividad('Gestión de cobranza','cobranza',credId,tipo); }
  if(typeof toast==='function') toast('Gestión guardada ✓','success');
  window._cobTab='gestiones';
  if(typeof nav==='function') nav('cobranza');
}

