// Logica de cuentas, movimientos, historial y pendientes. Extraido mecanicamente de assets/pagasi-app.js.
window._cuentasTab = window._cuentasTab || 'cuentas';
window._cuentasSubTab = window._cuentasSubTab || 'cobrar';
window._cuentasMes = window._cuentasMes || (function(){ var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1<10?'0':'')+(d.getMonth()+1); })();

function switchCuentasTab(t){
  window._cuentasDetalle=null; window._cuentasTab=t; nav('cuentas');
}
function switchCuentasSubTab(t){
  window._cuentasDetalle=null; window._cuentasSubTab=t; nav('cuentas');
}
function setCuentasMes(v){
  window._cuentasMes=v; nav('cuentas');
}

function saldoCuenta(nombre){
  var s=0;
  S.movimientos.filter(function(m){return !m.eliminado;}).forEach(function(m){
    if(m.cuentaDestino===nombre) s+=m.monto;
    if(m.cuentaOrigen===nombre) s-=m.monto;
  });
  return s;
}
function totalCuentas(){
  return (_cuentasBanc||[]).reduce(function(a,c){return a+saldoCuenta(c.nombre);},0);
}
function movsCuenta(cid){
  return S.movimientos.filter(function(m){return m.cuentaOrigen===cid||m.cuentaDestino===cid;})
    .sort(function(a,b){return (b.fecha||'').localeCompare(a.fecha||'');});
}

// â”€â”€ Helpers â”€â”€
function fmtMontoMov(m,cuenta){
  var es=m.cuentaDestino===cuenta;
  var color=es?'var(--green)':'var(--red)';
  var signo=es?'+':'-';
  return '<span style="font-weight:800;color:'+color+'">'+signo+fmt(m.monto)+'</span>';
}
function nombreMesEsp(yyyy_mm){
  var meses=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var p=yyyy_mm.split('-'); return meses[parseInt(p[1])-1]+' '+p[0];
}

// â”€â”€ PAGE RENDER â”€â”€
function renderCuentas(){
  // Si hay una cuenta seleccionada, mostrar su detalle
  if(window._cuentasDetalle){
    return renderDetalleCuenta(window._cuentasDetalle);
  }

  var tab=window._cuentasTab||'cuentas';

  // MÃ©tricas rÃ¡pidas para el banner
  var cuentasList = (typeof _cuentasBanc!=='undefined' && _cuentasBanc)?_cuentasBanc:[];
  var totalSaldo = 0;
  try{
    cuentasList.forEach(function(c){ totalSaldo += (typeof saldoCuenta==='function' ? saldoCuenta(c.nombre) : 0); });
  }catch(e){}
  var nCuentas = cuentasList.length;
  var pendientesCount = (typeof S!=='undefined' && S && S.cuentasPendientes) ? S.cuentasPendientes.filter(function(p){return !p.confirmado;}).length : 0;

  var banner = '';
  if(typeof pageBanner==='function'){
    banner = pageBanner(
      'TesorerÃ­a Â· Cuentas bancarias',
      'Cuentas',
      '<b>'+nCuentas+'</b> cuenta'+(nCuentas!==1?'s':'')+' bancaria'+(nCuentas!==1?'s':'')+' Â· Saldo total: <b>'+(typeof fmt==='function'?fmt(totalSaldo):'$'+totalSaldo)+'</b>'+(pendientesCount>0?' Â· <b>'+pendientesCount+'</b> pendiente'+(pendientesCount!==1?'s':'')+' por confirmar':''),
      [
        {label:'ï¼‹ Nuevo DepÃ³sito', onclick:'openDeposito(null)', primary:true},
        {label:'â†“ Exportar CSV', onclick:"exportarCSV('movimientos')"}
      ]
    );
  }

  var tabBar='<div style="display:flex;gap:0;border-bottom:2px solid var(--rim);margin-bottom:20px">'
    +['cuentas','historial','pendientes'].map(function(t){
      var labels={cuentas:'ðŸ¦ Cuentas',historial:'ðŸ“‹ Historial',pendientes:'â³ Pendientes'};
      var active=tab===t;
      return '<button onclick="switchCuentasTab(\''+t+'\')" style="'
        +'background:none;border:none;padding:11px 20px;font-size:13px;font-weight:'+(active?'800':'600')
        +';color:'+(active?'var(--p1)':'var(--ink3)')
        +';border-bottom:'+(active?'3px solid var(--p1)':'3px solid transparent')
        +';margin-bottom:-2px;cursor:pointer;font-family:var(--f);transition:color .15s;letter-spacing:.1px">'+labels[t]+'</button>';
    }).join('')+'</div>';

  var body='';
  if(tab==='cuentas') body=renderTabCuentasBanc();
  else if(tab==='historial') body=renderTabHistorial();
  else body=renderTabPendientes();

  return '<div class="page">'+banner+tabBar+body+'</div>';
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TAB 1: CUENTAS BANCARIAS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function renderTabCuentasBanc(){
  var cuentas=_cuentasBanc||[];
  var total=cuentas.reduce(function(a,c){return a+saldoCuenta(c.nombre);},0);

  // â•â•â• MÃ©tricas del mes para los KPIs â•â•â•
  var now = new Date();
  var mesKey = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  var movsMes = (S.movimientos||[]).filter(function(m){
    return !m.eliminado && (m.fecha||'').startsWith(mesKey);
  });
  var ingresosMes = movsMes.filter(function(m){return m.cuentaDestino && m.tipo!=='transferencia';}).reduce(function(a,m){return a+(m.monto||0);},0);
  var egresosMes = movsMes.filter(function(m){return m.cuentaOrigen && m.tipo!=='transferencia';}).reduce(function(a,m){return a+(m.monto||0);},0);
  var transfMes = movsMes.filter(function(m){return m.tipo==='transferencia';}).length;
  var netoMes = ingresosMes - egresosMes;

  // Ãšltimos 6 meses de flujo neto (para mini-chart)
  var flujo6m = [];
  for(var i=5;i>=0;i--){
    var d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    var k = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    var ms = (S.movimientos||[]).filter(function(m){return !m.eliminado && (m.fecha||'').startsWith(k);});
    var ing = ms.filter(function(m){return m.cuentaDestino && m.tipo!=='transferencia';}).reduce(function(a,m){return a+(m.monto||0);},0);
    var eg = ms.filter(function(m){return m.cuentaOrigen && m.tipo!=='transferencia';}).reduce(function(a,m){return a+(m.monto||0);},0);
    flujo6m.push({lbl:d.toLocaleDateString('es-VE',{month:'short'}), ing:ing, eg:eg, neto:ing-eg});
  }
  var maxFlujo = Math.max(1, ...flujo6m.map(function(f){return Math.max(f.ing,f.eg);}));

  // â•â•â• KPIs row â•â•â•
  var kpisHTML = '<div class="sg" style="grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px">'
    +'<div class="stat" style="border-top:3px solid var(--p1)">'
      +'<div class="st-v" style="color:var(--p1);font-size:22px">'+fmt(total)+'</div>'
      +'<div class="st-l">Saldo total</div>'
      +'<div style="font-size:10px;color:var(--ink3);margin-top:2px">'+nCuentasLbl(cuentas.length)+'</div>'
    +'</div>'
    +'<div class="stat" style="border-top:3px solid var(--green)">'
      +'<div class="st-v" style="color:var(--green);font-size:22px">'+fmt(ingresosMes)+'</div>'
      +'<div class="st-l">Ingresos del mes</div>'
      +'<div style="font-size:10px;color:var(--ink3);margin-top:2px">'+movsMes.filter(function(m){return m.cuentaDestino && m.tipo!=='transferencia';}).length+' movimientos</div>'
    +'</div>'
    +'<div class="stat" style="border-top:3px solid var(--red)">'
      +'<div class="st-v" style="color:var(--red);font-size:22px">'+fmt(egresosMes)+'</div>'
      +'<div class="st-l">Egresos del mes</div>'
      +'<div style="font-size:10px;color:var(--ink3);margin-top:2px">'+movsMes.filter(function(m){return m.cuentaOrigen && m.tipo!=='transferencia';}).length+' movimientos</div>'
    +'</div>'
    +'<div class="stat" style="border-top:3px solid '+(netoMes>=0?'var(--green)':'var(--red)')+'">'
      +'<div class="st-v" style="color:'+(netoMes>=0?'var(--green)':'var(--red)')+';font-size:22px">'+(netoMes>=0?'+':'')+fmt(netoMes)+'</div>'
      +'<div class="st-l">Flujo neto</div>'
      +'<div style="font-size:10px;color:var(--ink3);margin-top:2px">'+now.toLocaleDateString('es-VE',{month:'long'})+'</div>'
    +'</div>'
    +'<div class="stat" style="border-top:3px solid var(--amber)">'
      +'<div class="st-v" style="color:var(--amber);font-size:22px">'+transfMes+'</div>'
      +'<div class="st-l">Transferencias</div>'
      +'<div style="font-size:10px;color:var(--ink3);margin-top:2px">Entre cuentas</div>'
    +'</div>'
    +'</div>';

  // â•â•â• Mini chart flujo 6 meses â•â•â•
  var chartHTML = '<div class="card" style="margin-bottom:14px">'
    +'<div class="ch"><div><div class="ct">Flujo de caja Â· Ãºltimos 6 meses</div><div class="cs">Ingresos vs egresos por mes</div></div>'
    +'<div style="display:flex;gap:12px;font-size:11px">'
    +'<span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:2px;background:var(--green)"></span>Ingresos</span>'
    +'<span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:2px;background:var(--red)"></span>Egresos</span>'
    +'</div></div>'
    +'<div style="display:flex;align-items:flex-end;gap:8px;height:140px;margin-top:14px;padding:0 4px">'
    +flujo6m.map(function(f){
      var hIng = f.ing>0 ? Math.max(6, Math.round(f.ing/maxFlujo*115)) : 2;
      var hEg = f.eg>0 ? Math.max(6, Math.round(f.eg/maxFlujo*115)) : 2;
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">'
        +'<div style="font-size:9px;font-weight:800;color:'+(f.neto>=0?'var(--green)':'var(--red)')+';height:12px;white-space:nowrap">'+(f.neto!==0?(f.neto>=0?'+':'')+fmt(f.neto).slice(0,6):'')+'</div>'
        +'<div style="flex:1;width:100%;display:flex;align-items:flex-end;gap:3px">'
        +'<div style="flex:1;background:linear-gradient(180deg,var(--green),#10c878);border-radius:3px 3px 0 0;height:'+hIng+'px" title="Ingresos: '+fmt(f.ing)+'"></div>'
        +'<div style="flex:1;background:linear-gradient(180deg,var(--red),#ef4e6f);border-radius:3px 3px 0 0;height:'+hEg+'px" title="Egresos: '+fmt(f.eg)+'"></div>'
        +'</div>'
        +'<div style="font-size:10px;color:var(--ink3);font-weight:600;text-transform:capitalize">'+f.lbl.replace('.','')+'</div>'
        +'</div>';
    }).join('')
    +'</div></div>';

  // â•â•â• Cards de cuentas â€” compactas, coherentes con .card del sistema â•â•â•
  var cardsHTML=cuentas.length?cuentas.map(function(c){
    var saldo=saldoCuenta(c.nombre);
    var pctTotal = total>0 ? Math.round(saldo/total*100) : 0;

    var movsCuenta = (S.movimientos||[]).filter(function(m){
      return !m.eliminado && (m.cuentaDestino===c.nombre || m.cuentaOrigen===c.nombre);
    });
    var nMovs = movsCuenta.length;
    var movsCuentaMes = movsCuenta.filter(function(m){return (m.fecha||'').startsWith(mesKey);});
    var ingCuentaMes = movsCuentaMes.filter(function(m){return m.cuentaDestino===c.nombre;}).reduce(function(a,m){return a+(m.monto||0);},0);
    var egCuentaMes = movsCuentaMes.filter(function(m){return m.cuentaOrigen===c.nombre;}).reduce(function(a,m){return a+(m.monto||0);},0);
    var moneda = (c.moneda||'USD').toUpperCase()==='BS'?'Bs':'$';
    var accentColor = (c.moneda||'USD').toUpperCase()==='BS' ? '#60A5FA' : 'var(--p1)';

    return '<div class="card" onclick="verMovsCuenta(\''+c.nombre+'\')" style="cursor:pointer;padding:16px 18px;border-top:3px solid '+accentColor+'">'

      // Fila 1: Ã­cono + nombre + badge moneda
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
        +'<div style="width:36px;height:36px;border-radius:10px;background:var(--gs);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:'+accentColor+';flex-shrink:0">'+moneda+'</div>'
        +'<div style="flex:1;min-width:0">'
          +'<div style="font-weight:800;font-size:13.5px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+c.nombre+'</div>'
          +'<div style="font-size:10.5px;color:var(--ink3);margin-top:1px">'+nMovs+' movimientos totales</div>'
        +'</div>'
        +'<span style="background:var(--gs);color:'+accentColor+';border-radius:20px;padding:3px 9px;font-size:10px;font-weight:800;flex-shrink:0">'+(c.moneda||'USD')+'</span>'
      +'</div>'

      // Saldo
      +'<div style="font-family:var(--fd);font-weight:900;font-size:22px;letter-spacing:-1px;color:var(--ink);line-height:1;margin-bottom:10px">'+fmt(saldo)+'</div>'

      // Barra de porcentaje
      +'<div style="height:4px;background:var(--rim);border-radius:2px;overflow:hidden;margin-bottom:10px">'
        +'<div style="height:100%;width:'+pctTotal+'%;background:'+accentColor+';border-radius:2px"></div>'
      +'</div>'

      // Ingresos/egresos del mes en una fila
      +'<div style="display:flex;gap:12px;margin-bottom:12px;font-size:11.5px">'
        +'<div style="flex:1">'
          +'<div style="color:var(--ink3);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">â†‘ IngresÃ³</div>'
          +'<div style="font-weight:800;color:var(--green);font-family:var(--fd)">'+fmt(ingCuentaMes)+'</div>'
        +'</div>'
        +'<div style="flex:1">'
          +'<div style="color:var(--ink3);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">â†“ SaliÃ³</div>'
          +'<div style="font-weight:800;color:var(--red);font-family:var(--fd)">'+fmt(egCuentaMes)+'</div>'
        +'</div>'
        +'<div style="flex:1;text-align:right">'
          +'<div style="color:var(--ink3);font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">% Total</div>'
          +'<div style="font-weight:800;color:'+accentColor+';font-family:var(--fd)">'+pctTotal+'%</div>'
        +'</div>'
      +'</div>'

      // Botones acciÃ³n
      +'<div style="display:flex;gap:5px;border-top:1px solid var(--rim2);padding-top:10px" onclick="event.stopPropagation()">'
        +'<button class="btn btn-p btn-xs" style="flex:1" onclick="openDeposito(\''+c.nombre+'\')">ï¼‹</button>'
        +'<button class="btn btn-d btn-xs" style="flex:1" onclick="openRetiro(\''+c.nombre+'\')">âˆ’</button>'
        +'<button class="btn btn-g btn-xs" style="flex:1" onclick="openTransferencia(\''+c.nombre+'\')">â‡„</button>'
        +'<button class="btn btn-g btn-xs" style="flex:1" onclick="verMovsCuenta(\''+c.nombre+'\')">Ver â†’</button>'
      +'</div>'
    +'</div>';
  }).join(''):'<div class="empty" style="padding:40px 20px;grid-column:1/-1"><div style="font-size:16px;font-weight:700;margin-bottom:8px">Sin cuentas configuradas</div><div style="font-size:12.5px;color:var(--ink3);margin-bottom:14px">Las cuentas bancarias sirven para registrar ingresos y egresos con trazabilidad completa.</div><button class="btn btn-p btn-sm" onclick="nav(\'config\')">ï¼‹ Crear primera cuenta</button></div>';

  // Toolbar superior
  var toolbar = '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap">'
      +'<button class="btn btn-p btn-sm" onclick="openDeposito(null)">ï¼‹ Ingresar saldo</button>'
      +'<button class="btn btn-d btn-sm" onclick="openRetiro(null)">âˆ’ Retirar</button>'
      +'<button class="btn btn-g btn-sm" onclick="openTransferencia(null)">â‡„ Transferir</button>'
    +'</div>'
    +'<button class="btn btn-g btn-sm" onclick="nav(\'config\')">ï¼‹ Nueva cuenta</button>'
    +'</div>';

  return '<div>'
    + kpisHTML
    + chartHTML
    + toolbar
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">'
    + cardsHTML
    + '</div></div>';
}

// Helper para pluralizaciÃ³n
function nCuentasLbl(n){
  return n+' '+(n===1?'cuenta activa':'cuentas activas');
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TAB 2: HISTORIAL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// VER MOVIMIENTOS DE UNA CUENTA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DETALLE DE CUENTA BANCARIA â€” Vista completa con buscador
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function verMovsCuenta(nombre){
  window._cuentasDetalle = nombre;
  window._cuentasTab = 'cuentas';
  nav('cuentas');
}

function renderDetalleCuenta(nombre){
  // Mostrar TODOS (incluyendo anulados para auditorÃ­a), ordenados por fecha desc
  var todos = (S.movimientos||[]).filter(function(m){
    return m.cuentaOrigen===nombre || m.cuentaDestino===nombre;
  }).sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||'') || (b.hora||'').localeCompare(a.hora||''); });

  // Para los totales y saldo: SOLO los NO eliminados
  var activos = todos.filter(function(m){ return !m.eliminado; });
  var totalIng = activos.filter(function(m){return m.cuentaDestino===nombre;}).reduce(function(a,m){return a+(m.monto||0);},0);
  var totalEg = activos.filter(function(m){return m.cuentaOrigen===nombre;}).reduce(function(a,m){return a+(m.monto||0);},0);
  var saldo = totalIng - totalEg;

  var esAdmin = S.currentUser && S.currentUser.rol === 'Administrador';

  function buildRow(m){
    var anulado = !!m.eliminado;
    var esIng = m.cuentaDestino===nombre;
    var iconBg = anulado ? 'var(--surf2)' : (esIng ? 'var(--greens)' : 'var(--reds)');
    var iconColor = anulado ? 'var(--ink3)' : (esIng ? 'var(--green)' : 'var(--red)');
    var arrow = esIng
      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="'+iconColor+'" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>'
      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="'+iconColor+'" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>';
    var monto = (esIng ? '+' : 'âˆ’') + fmt(m.monto||0);
    var contrap = esIng ? (m.cuentaOrigen||'Externo') : (m.cuentaDestino||'Externo');
    var rowStyle = anulado ? 'opacity:0.45' : '';
    var tags = '';
    if(anulado) tags += '<span style="font-size:9.5px;background:rgba(231,76,60,0.12);color:var(--red);border-radius:20px;padding:1px 8px;font-weight:800;margin-left:5px">ANULADO</span>';
    if(m.tipo==='transferencia') tags += '<span style="font-size:9.5px;background:rgba(37,99,235,0.10);color:var(--p1);border-radius:20px;padding:1px 7px;font-weight:700;margin-left:4px">â‡„ Transf.</span>';
    if(m.referencia) tags += '<span style="font-size:9.5px;background:var(--surf2);color:var(--ink3);border-radius:20px;padding:1px 7px;margin-left:4px">#'+m.referencia+'</span>';
    if(anulado && m.eliminadoPor) tags += '<span style="font-size:9.5px;color:var(--ink3);margin-left:5px">AnulÃ³: '+m.eliminadoPor+(m.eliminadoEn?' Â· '+m.eliminadoEn.split('T')[0]:'')+'</span>';

    var accionCell = '';
    if(!anulado && esAdmin){
      accionCell = '<button onclick="event.stopPropagation();anularMovimiento(\''+m.id+'\',\''+nombre+'\')" '
        +'title="Anular movimiento (solo Admin)" '
        +'style="background:none;border:none;cursor:pointer;color:var(--ink3);font-size:13px;padding:4px 7px;border-radius:6px;transition:all .15s" '
        +'onmouseover="this.style.color=\'var(--red)\';this.style.background=\'var(--reds)\'" '
        +'onmouseout="this.style.color=\'var(--ink3)\';this.style.background=\'none\'">âŠ˜</button>';
    }

    return '<tr class="det-row" style="'+rowStyle+'" data-buscar="'
      +([m.concepto,m.referencia,m.realizadoPor,String(m.monto||0),(m.fecha||''),contrap,(m.tipo||''),(anulado?'anulado':'')].join(' ')).toLowerCase()+'">'
      +'<td style="width:38px">'
        +'<div style="width:34px;height:34px;border-radius:10px;background:'+iconBg+';display:flex;align-items:center;justify-content:center">'+arrow+'</div>'
      +'</td>'
      +'<td>'
        +'<div style="font-size:12.5px;font-weight:700;color:var(--ink);'+(anulado?'text-decoration:line-through;':'')+'">'+(m.concepto||m.descripcion||'Movimiento')+tags+'</div>'
        +'<div style="font-size:10.5px;color:var(--ink3);margin-top:2px">'+function(){
            if(!m.fecha) return 'â€”';
            if(m.fecha.indexOf('T')!==-1||m.fecha.length>10) return fmtFechaHora(m.fecha);
            var h=(m.hora||'').trim();
            if(h&&(h.indexOf('a. m.')!==-1||h.indexOf('p. m.')!==-1||h.indexOf('a.m.')!==-1||h.indexOf('p.m.')!==-1)){
              try{var isPM=h.indexOf('p. m.')!==-1||h.indexOf('p.m.')!==-1;var parts=h.replace(/[ap]\. ?m\./i,'').trim().split(':');var hh=parseInt(parts[0],10);var mm=parseInt(parts[1]||'0',10);if(isPM&&hh!==12)hh+=12;if(!isPM&&hh===12)hh=0;h=String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');}catch(e){h='';}
            }
            var dd=m.fecha.split('-');
            return dd.length===3?(dd[2]+'/'+dd[1]+'/'+dd[0]+(h?' '+h:'')):(m.fecha+(h?' '+h:''));
          }()+'</div>'
      +'</td>'
      +'<td style="font-size:11.5px;color:var(--ink2)">'+(m.tipo==='transferencia'?(esIng?'Desde: ':'Hacia: ')+contrap:contrap)+'</td>'
      +'<td style="font-size:11px;color:var(--ink3)">'+(m.referencia||'â€”')+'</td>'
      +'<td style="font-size:11px;color:var(--ink3)">'+(m.realizadoPor||'â€”')+'</td>'
      +'<td style="text-align:right;font-family:var(--fd);font-weight:800;font-size:14px;color:'+iconColor+';'+(anulado?'text-decoration:line-through;':'')+'">'+monto+'</td>'
      +'<td style="width:36px">'+accionCell+'</td>'
      +'</tr>';
  }

  var rowsHTML = todos.length ? todos.map(buildRow).join('') : '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--ink3);font-size:13px">Sin movimientos registrados para esta cuenta</td></tr>';

  return '<div class="page">'
    // â”€â”€ HEADER: volver + nombre â”€â”€
    +'<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">'
      +'<button onclick="window._cuentasDetalle=null;nav(\'cuentas\')" class="btn btn-g btn-sm" style="gap:6px">â† Volver</button>'
      +'<div style="display:flex;align-items:center;gap:10px">'
        +'<div style="width:38px;height:38px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:800">BNK</div>'
        +'<div>'
          +'<div style="font-weight:900;font-size:17px;color:var(--ink);letter-spacing:-0.3px">'+nombre+'</div>'
          +'<div style="font-size:11px;color:var(--ink3)">'+activos.length+' activo(s)'+(todos.length>activos.length?' Â· '+(todos.length-activos.length)+' anulado(s)':'')+'</div>'
        +'</div>'
      +'</div>'
      +'<div style="margin-left:auto;display:flex;gap:8px">'
        +'<button class="btn btn-p btn-sm" onclick="openDeposito(\''+nombre+'\')">ï¼‹ Ingresar</button>'
        +'<button class="btn btn-d btn-sm" onclick="openRetiro(\''+nombre+'\')">âˆ’ Retirar</button>'
        +'<button class="btn btn-g btn-sm" onclick="openTransferencia(\''+nombre+'\')">â‡„ Transferir</button>'
      +'</div>'
    +'</div>'

    // â”€â”€ STATS â”€â”€
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:18px">'
      +'<div class="card" style="padding:16px 20px">'
        +'<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--ink3);font-weight:700;margin-bottom:6px">Saldo actual</div>'
        +'<div style="font-family:var(--fd);font-weight:900;font-size:24px;color:var(--ink);letter-spacing:-1px">'+fmt(saldo)+'</div>'
      +'</div>'
      +'<div class="card" style="padding:16px 20px;border-left:3px solid var(--green)">'
        +'<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--green);font-weight:700;margin-bottom:6px">â†‘ Total ingresos</div>'
        +'<div style="font-family:var(--fd);font-weight:900;font-size:24px;color:var(--green);letter-spacing:-1px">+'+fmt(totalIng)+'</div>'
        +'<div style="font-size:10.5px;color:var(--ink3);margin-top:2px">'+activos.filter(function(m){return m.cuentaDestino===nombre;}).length+' transacciones</div>'
      +'</div>'
      +'<div class="card" style="padding:16px 20px;border-left:3px solid var(--red)">'
        +'<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--red);font-weight:700;margin-bottom:6px">â†“ Total egresos</div>'
        +'<div style="font-family:var(--fd);font-weight:900;font-size:24px;color:var(--red);letter-spacing:-1px">âˆ’'+fmt(totalEg)+'</div>'
        +'<div style="font-size:10.5px;color:var(--ink3);margin-top:2px">'+activos.filter(function(m){return m.cuentaOrigen===nombre;}).length+' transacciones</div>'
      +'</div>'
    +'</div>'

    // â”€â”€ TABLA CON BUSCADOR â”€â”€
    +'<div class="card">'
      +'<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">'
        // Buscador
        +'<div style="position:relative;flex:1;min-width:220px">'
          +'<span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--ink3);font-size:12px;pointer-events:none">â—†</span>'
          +'<input id="det-srch" type="text" placeholder="Buscar por concepto, monto, referencia, fecha, usuario..." '
            +'style="width:100%;box-sizing:border-box;padding:8px 10px 8px 30px;border:1px solid var(--rim);border-radius:10px;font-size:12.5px;background:var(--surf2);color:var(--ink);font-family:var(--f);outline:none" '
            +'oninput="filtrarDetalleCuenta(this.value)" '
            +'onfocus="this.style.borderColor=\'var(--p1)\';this.style.boxShadow=\'0 0 0 3px var(--gb)\'" '
            +'onblur="this.style.borderColor=\'var(--rim)\';this.style.boxShadow=\'\'">'
        +'</div>'
        // Filtro tipo
        +'<div style="display:flex;gap:4px">'
          +'<button id="det-f-todos" class="btn btn-p btn-sm" onclick="filtrarDetallePorTipo(\'todos\')">Todos</button>'
          +'<button id="det-f-ingresos" class="btn btn-g btn-sm" onclick="filtrarDetallePorTipo(\'ingresos\')">â†‘ Ingresos</button>'
          +'<button id="det-f-egresos" class="btn btn-g btn-sm" onclick="filtrarDetallePorTipo(\'egresos\')">â†“ Egresos</button>'
        +'</div>'
        // Contador resultados
        +'<div id="det-count" style="font-size:11.5px;font-weight:700;color:var(--ink3)">'+todos.length+' registro(s)</div>'
      +'</div>'
      +'<div style="overflow-x:auto">'
        +'<table class="tbl" id="det-table">'
          +'<thead><tr>'
            +'<th style="width:38px"></th>'
            +'<th>Concepto</th>'
            +'<th>Contraparte</th>'
            +'<th>Referencia</th>'
            +'<th>Realizado por</th>'
            +'<th style="text-align:right">Monto</th>'
            +'<th></th>'
          +'</tr></thead>'
          +'<tbody id="det-tbody">'+rowsHTML+'</tbody>'
        +'</table>'
      +'</div>'
    +'</div>'
  +'</div>';
}

// â”€â”€ Filtrar la tabla de detalle por texto â”€â”€
function filtrarDetalleCuenta(q){
  var lower = q.trim().toLowerCase();
  var rows = document.querySelectorAll('#det-tbody .det-row');
  var vis = 0;
  rows.forEach(function(r){
    var match = !lower || (r.dataset.buscar||'').includes(lower);
    r.style.display = match ? '' : 'none';
    if(match) vis++;
  });
  var cnt = document.getElementById('det-count');
  if(cnt) cnt.textContent = vis+' resultado(s)';
}

// â”€â”€ Filtrar por tipo â”€â”€
var _detTipo = 'todos';
function filtrarDetallePorTipo(tipo){
  _detTipo = tipo;
  ['todos','ingresos','egresos'].forEach(function(t){
    var btn = document.getElementById('det-f-'+t);
    if(btn){ btn.className = t===tipo ? 'btn btn-p btn-sm' : 'btn btn-g btn-sm'; }
  });
  var rows = document.querySelectorAll('#det-tbody .det-row');
  var vis = 0;
  rows.forEach(function(r){
    var esIng = r.querySelector('svg line[x1="12"][y1="19"]') !== null;
    var show = tipo==='todos' || (tipo==='ingresos'&&esIng) || (tipo==='egresos'&&!esIng);
    // Re-check buscar filter too
    var srch = (document.getElementById('det-srch')||{}).value||'';
    var matchQ = !srch.trim() || (r.dataset.buscar||'').includes(srch.trim().toLowerCase());
    r.style.display = (show && matchQ) ? '' : 'none';
    if(show && matchQ) vis++;
  });
  var cnt = document.getElementById('det-count');
  if(cnt) cnt.textContent = vis+' resultado(s)';
}

// â”€â”€ Eliminar movimiento desde el detalle â”€â”€
function anularMovimiento(id, cuenta){
  // Solo administradores pueden anular movimientos
  if(!S.currentUser || S.currentUser.rol !== 'Administrador'){
    toast('Solo el Administrador puede anular movimientos','error');
    return;
  }
  var idx = (S.movimientos||[]).findIndex(function(m){return m.id===id;});
  if(idx<0) return;
  var m = S.movimientos[idx];
  if(m.eliminado){ toast('Este movimiento ya fue anulado','error'); return; }

  // Modal de confirmaciÃ³n con razÃ³n
  $('mic').textContent='âŠ˜';
  $('mtt').textContent='Anular movimiento';
  $('msb').textContent='El movimiento seguirÃ¡ visible pero no contarÃ¡ en saldos ni contabilidad';
  $('modal-box').className='modal';
  $('mbd').innerHTML=
    '<div style="background:rgba(231,76,60,0.07);border:1px solid rgba(231,76,60,0.2);border-radius:12px;padding:14px 16px;margin-bottom:14px">'
    +'<div style="font-size:13px;font-weight:700;color:var(--ink);margin-bottom:4px">'+(m.concepto||'Movimiento')+'</div>'
    +'<div style="font-size:12px;color:var(--ink3)">'+(m.fecha||'')+(m.referencia?' Â· #'+m.referencia:'')+'</div>'
    +'<div style="font-family:var(--fd);font-weight:900;font-size:20px;margin-top:8px;color:var(--red)">'+fmt(m.monto||0)+'</div>'
    +'</div>'
    +'<div class="fg"><label>RazÃ³n de anulaciÃ³n *</label>'
    +'<input class="fi" id="anul_razon" placeholder="Ej: Error de registro, duplicado, reverso..." autofocus></div>';
  $('mft').innerHTML='<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    +'<button class="btn btn-d" onclick="confirmarAnulacion(\''+id+'\',\''+cuenta+'\')">âŠ˜ Confirmar anulaciÃ³n</button>';
  $('ov').style.display='flex';
}

function confirmarAnulacion(id, cuenta){
  var razon = ($('anul_razon')||{}).value||'';
  if(!razon.trim()){ toast('La razÃ³n de anulaciÃ³n es obligatoria','error'); return; }
  var idx = (S.movimientos||[]).findIndex(function(m){return m.id===id;});
  if(idx<0){ closeM(); return; }
  Object.assign(S.movimientos[idx], {
    eliminado: true,
    eliminadoPor: (S.currentUser&&S.currentUser.nombre)||'Admin',
    eliminadoEn: new Date().toISOString(),
    eliminadoRazon: razon.trim()
  });
  DB.saveMovimiento(S.movimientos[idx]);
  closeM();
  window._cuentasDetalle = cuenta;
  nav('cuentas');
  toast('Movimiento anulado Â· quedarÃ¡ visible en auditorÃ­a','info');
}

function renderTabHistorial(){
  var mes=window._cuentasMes;
  var movs=S.movimientos.filter(function(m){
    var f=(m.fecha||'');
    return f.startsWith(mes); // incluye anulados para auditorÃ­a
  }).sort(function(a,b){return (b.fecha||'').localeCompare(a.fecha||'');});

  // Build month options (last 12 months)
  var mesOpts='';
  var now=new Date();
  for(var i=0;i<24;i++){
    var d=new Date(now.getFullYear(),now.getMonth()-i,1);
    var val=d.getFullYear()+'-'+(d.getMonth()+1<10?'0':'')+(d.getMonth()+1);
    var lbl=nombreMesEsp(val);
    mesOpts+='<option value="'+val+'" '+(val===mes?'selected':'')+'>'+lbl+'</option>';
  }

  var tasaBs=window._tasaBsGlobal||1;
  var esAdmin = S.currentUser && S.currentUser.rol === 'Administrador';

  // â•â•â• KPIs del mes â•â•â•
  var movsActivos = movs.filter(function(m){return !m.eliminado;});
  var totalIngresos = movsActivos.filter(function(m){return m.cuentaDestino && m.tipo!=='transferencia';}).reduce(function(a,m){return a+(m.monto||0);},0);
  var totalEgresos = movsActivos.filter(function(m){return m.cuentaOrigen && m.tipo!=='transferencia';}).reduce(function(a,m){return a+(m.monto||0);},0);
  var totalTransf = movsActivos.filter(function(m){return m.tipo==='transferencia';}).length;
  var neto = totalIngresos - totalEgresos;
  var anulados = movs.filter(function(m){return m.eliminado;}).length;
  var promedioPorMov = movsActivos.length>0 ? (totalIngresos+totalEgresos)/movsActivos.length : 0;

  var kpisHTML = '<div class="sg" style="grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px">'
    +'<div class="stat" style="border-top:3px solid var(--green)">'
      +'<div class="st-v" style="color:var(--green);font-size:20px">+'+fmt(totalIngresos)+'</div>'
      +'<div class="st-l">Ingresos</div>'
      +'<div style="font-size:10px;color:var(--ink3);margin-top:2px">'+movsActivos.filter(function(m){return m.cuentaDestino && m.tipo!=='transferencia';}).length+' movimientos</div>'
    +'</div>'
    +'<div class="stat" style="border-top:3px solid var(--red)">'
      +'<div class="st-v" style="color:var(--red);font-size:20px">-'+fmt(totalEgresos)+'</div>'
      +'<div class="st-l">Egresos</div>'
      +'<div style="font-size:10px;color:var(--ink3);margin-top:2px">'+movsActivos.filter(function(m){return m.cuentaOrigen && m.tipo!=='transferencia';}).length+' movimientos</div>'
    +'</div>'
    +'<div class="stat" style="border-top:3px solid '+(neto>=0?'var(--green)':'var(--red)')+'">'
      +'<div class="st-v" style="color:'+(neto>=0?'var(--green)':'var(--red)')+';font-size:20px">'+(neto>=0?'+':'')+fmt(neto)+'</div>'
      +'<div class="st-l">Neto</div>'
      +'<div style="font-size:10px;color:var(--ink3);margin-top:2px">Balance del mes</div>'
    +'</div>'
    +'<div class="stat" style="border-top:3px solid var(--p1)">'
      +'<div class="st-v" style="color:var(--p1);font-size:20px">'+movs.length+'</div>'
      +'<div class="st-l">Movimientos</div>'
      +'<div style="font-size:10px;color:var(--ink3);margin-top:2px">'+totalTransf+' transferencias'+(anulados>0?' Â· '+anulados+' anulados':'')+'</div>'
    +'</div>'
    +'<div class="stat" style="border-top:3px solid var(--amber)">'
      +'<div class="st-v" style="color:var(--amber);font-size:20px">'+fmt(promedioPorMov)+'</div>'
      +'<div class="st-l">Promedio</div>'
      +'<div style="font-size:10px;color:var(--ink3);margin-top:2px">Por movimiento</div>'
    +'</div>'
    +'</div>';

  // â•â•â• Mini chart de flujo diario â•â•â•
  var diasEnMes = new Date(parseInt(mes.split('-')[0]), parseInt(mes.split('-')[1]), 0).getDate();
  var flujoDiario = [];
  for(var d=1; d<=diasEnMes; d++){
    var dayKey = mes+'-'+String(d).padStart(2,'0');
    var movsDia = movsActivos.filter(function(m){return (m.fecha||'').startsWith(dayKey);});
    var ing = movsDia.filter(function(m){return m.cuentaDestino && m.tipo!=='transferencia';}).reduce(function(a,m){return a+(m.monto||0);},0);
    var eg = movsDia.filter(function(m){return m.cuentaOrigen && m.tipo!=='transferencia';}).reduce(function(a,m){return a+(m.monto||0);},0);
    flujoDiario.push({dia:d, ing:ing, eg:eg});
  }
  var maxDia = Math.max(1, ...flujoDiario.map(function(f){return Math.max(f.ing,f.eg);}));

  var chartDiario = '<div class="card" style="margin-bottom:14px">'
    +'<div class="ch"><div><div class="ct">Actividad diaria</div><div class="cs">Flujo por dÃ­a en '+nombreMesEsp(mes)+'</div></div></div>'
    +'<div style="display:flex;align-items:flex-end;gap:2px;height:90px;margin-top:12px;padding:0 4px">'
    +flujoDiario.map(function(f){
      var hIng = f.ing>0 ? Math.max(3, Math.round(f.ing/maxDia*70)) : 1;
      var hEg = f.eg>0 ? Math.max(3, Math.round(f.eg/maxDia*70)) : 1;
      var showLabel = f.dia%5===0 || f.dia===1;
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px" title="DÃ­a '+f.dia+': +'+fmt(f.ing)+' / -'+fmt(f.eg)+'">'
        +'<div style="flex:1;width:100%;display:flex;align-items:flex-end;gap:1px">'
        +'<div style="flex:1;background:var(--green);border-radius:2px 2px 0 0;height:'+hIng+'px;opacity:.85"></div>'
        +'<div style="flex:1;background:var(--red);border-radius:2px 2px 0 0;height:'+hEg+'px;opacity:.85"></div>'
        +'</div>'
        +'<div style="font-size:8.5px;color:var(--ink3);font-weight:600;height:10px">'+(showLabel?f.dia:'')+'</div>'
        +'</div>';
    }).join('')
    +'</div></div>';

  // â•â•â• Tabla de movimientos â•â•â•
  var rows=movs.length?movs.map(function(m){
    var cuenta=m.cuentaDestino||m.cuentaOrigen||'â€”';
    var esIngreso=!!m.cuentaDestino&&m.tipo!=='transferencia';
    var esTransfer = m.tipo==='transferencia';
    var anulado=!!m.eliminado;
    var monto=m.monto||0;
    var tasaM=m.tasaBs||tasaBs;
    var comision=m.comision||0;
    var realizadoPor=m.realizadoPor||S.currentUser&&S.currentUser.nombre||'â€”';
    var fechaFmt=(function(){
      if(!m.fecha) return 'â€”';
      // If hora exists and is a clean HH:MM string, combine directly
      var h = (m.hora||'').trim();
      // Clean up old locale strings with "a. m."/"p. m." notation
      if(h && (h.indexOf('a. m.')!==-1 || h.indexOf('p. m.')!==-1 || h.indexOf('a.m.')!==-1 || h.indexOf('p.m.')!==-1)){
        try{
          var isPM = h.indexOf('p. m.')!==-1 || h.indexOf('p.m.')!==-1;
          var parts = h.replace(/[ap]\. ?m\./i,'').trim().split(':');
          var hh = parseInt(parts[0],10);
          var mm = parseInt(parts[1]||'0',10);
          if(isPM && hh!==12) hh+=12;
          if(!isPM && hh===12) hh=0;
          h = String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
        }catch(e){ h=''; }
      }
      // Try to parse as ISO if fecha contains time
      if(m.fecha.indexOf('T')!==-1 || m.fecha.length>10) return fmtFechaHora(m.fecha);
      // fecha is YYYY-MM-DD, combine with cleaned hora
      var dd = m.fecha.split('-'); // [yyyy,mm,dd]
      if(dd.length===3){
        var fmtD = dd[2]+'/'+dd[1]+'/'+dd[0];
        return h ? (fmtD+' '+h) : fmtD;
      }
      return m.fecha+(h?' '+h:'');
    })();
    var tipoColor = anulado ? 'var(--ink3)' : (esTransfer ? 'var(--amber)' : (esIngreso ? '#27ae60' : '#e74c3c'));
    var tipoIcon = esTransfer ? 'â‡„' : (esIngreso ? 'â†©' : 'â†ª');
    var tipoBg = anulado ? 'var(--surf2)' : (esTransfer ? 'var(--ambers)' : (esIngreso ? 'var(--greens)' : 'var(--reds)'));
    var anulTag=anulado?'<span style="font-size:9px;background:rgba(231,76,60,0.12);color:var(--red);border-radius:20px;padding:2px 8px;font-weight:800;margin-left:6px">ANULADO</span>':'';
    var anulBtn=(!anulado&&esAdmin)?'<button onclick="anularMovimiento(\''+m.id+'\',null)" title="Anular movimiento" style="background:none;border:none;cursor:pointer;color:var(--ink3);font-size:14px;padding:4px 8px;border-radius:6px;transition:all .15s" onmouseover="this.style.color=\'var(--red)\';this.style.background=\'var(--reds)\'" onmouseout="this.style.color=\'var(--ink3)\';this.style.background=\'none\'">âŠ˜</button>':'';
    var montoColor = anulado ? 'var(--ink3)' : (esIngreso ? '#27ae60' : '#e74c3c');

    return '<tr style="'+(anulado?'opacity:0.55;':'')+'transition:background .15s" onmouseover="this.style.background=\'var(--surf2)\'" onmouseout="this.style.background=\'\'">'
      +'<td style="padding:11px 8px"><div style="display:flex;align-items:center;gap:8px">'
        +'<span style="width:30px;height:30px;border-radius:50%;background:'+tipoBg+';display:inline-flex;align-items:center;justify-content:center;font-size:14px;color:'+tipoColor+';font-weight:800;flex-shrink:0">'+tipoIcon+'</span>'
        +'<span style="'+(anulado?'text-decoration:line-through;color:var(--ink3)':'font-weight:600')+'">'+cuenta+'</span>'+anulTag
      +'</div></td>'
      +'<td style="white-space:nowrap;color:var(--ink3);font-size:11.5px">'+fechaFmt+'</td>'
      +'<td style="font-size:11.5px">'+realizadoPor+'</td>'
      +'<td class="tdm" style="max-width:220px;'+(anulado?'text-decoration:line-through;':'')+'">'+( m.concepto||'<span style="color:var(--ink3);font-style:italic">sin concepto</span>' )+'</td>'
      +'<td style="text-align:right;white-space:nowrap;font-size:11px;color:var(--ink3)">'+tasaM+' Bs/$</td>'
      +'<td style="text-align:right;font-size:11px;color:var(--ink3)">'+(comision>0?'BS '+parseFloat(comision).toFixed(2):'â€”')+'</td>'
      +'<td style="text-align:right;font-weight:800;color:'+montoColor+';white-space:nowrap;font-family:var(--fd);'+(anulado?'text-decoration:line-through;':'')+'">'+(esIngreso?'+':esTransfer?'':'-')+'$'+parseFloat(monto).toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2})+'</td>'
      +'<td style="text-align:center">'+anulBtn+'</td>'
      +'</tr>';
  }).join(''):'<tr><td colspan="8" style="text-align:center;padding:40px 20px;color:var(--ink3)"><div style="font-size:14px;font-weight:700;margin-bottom:4px">Sin movimientos en '+nombreMesEsp(mes)+'</div><div style="font-size:11.5px">No se registraron movimientos este mes</div></td></tr>';

  return '<div>'
    + kpisHTML
    + chartDiario
    +'<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">'
      +'<div style="display:flex;align-items:center;gap:10px">'
        +'<span style="font-size:12.5px;font-weight:700;color:var(--ink3)">Mes</span>'
        +'<select class="fs" onchange="setCuentasMes(this.value)" style="min-width:180px;font-weight:700;color:var(--p1);border-color:rgba(37,99,235,0.3)">'+mesOpts+'</select>'
      +'</div>'
      +'<button class="btn btn-p btn-sm" onclick="exportHistorialXLS()">â†“ Exportar CSV</button>'
    +'</div>'
    +'<div class="card" style="overflow:hidden">'
    +'<div class="ch" style="padding-bottom:10px;border-bottom:1px solid var(--rim2)"><div><div class="ct">Historial detallado</div><div class="cs">Registros de entrada y salida de todas las cuentas bancarias</div></div>'
    +'<div style="font-weight:800;font-size:14px;color:var(--p1);font-family:var(--fd)">'+movs.length+' <span style="font-size:11px;color:var(--ink3);font-weight:600;font-family:var(--f)">registros</span></div></div>'
    +'<div style="overflow-x:auto;margin:0 -4px;padding:0 4px">'
    +'<table class="tbl" style="margin-top:10px;width:100%"><thead><tr style="border-bottom:2px solid var(--rim2)">'
    +'<th style="text-align:left;padding:10px 8px;font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.4px">Cuenta</th>'
    +'<th style="text-align:left;padding:10px 8px;font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.4px">Fecha</th>'
    +'<th style="text-align:left;padding:10px 8px;font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.4px">Usuario</th>'
    +'<th style="text-align:left;padding:10px 8px;font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.4px">Concepto</th>'
    +'<th style="text-align:right;padding:10px 8px;font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.4px">Tasa</th>'
    +'<th style="text-align:right;padding:10px 8px;font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.4px">ComisiÃ³n</th>'
    +'<th style="text-align:right;padding:10px 8px;font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.4px">Monto</th>'
    +'<th style="width:40px"></th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table>'
    +'</div></div></div>';
}

function exportHistorialXLS(){
  var mes=window._cuentasMes;
  var movs=S.movimientos.filter(function(m){
    return !m.eliminado&&(m.fecha||'').startsWith(mes);
  }).sort(function(a,b){return (b.fecha||'').localeCompare(a.fecha||'');});
  if(!movs.length){toast('No hay movimientos en este mes','info');return;}
  var rows=[['Cuenta','Fecha','Realizado por','Concepto','Tasa de cambio','Comision','Monto']];
  var tasaBs=window._tasaBsGlobal||1;
  movs.forEach(function(m){
    rows.push([
      m.cuentaDestino||m.cuentaOrigen||'',
      (m.fecha||'')+' '+(m.hora||''),
      m.realizadoPor||'',
      m.concepto||'',
      m.tasaBs||tasaBs,
      m.comision||0,
      m.monto||0
    ]);
  });
  var csv=rows.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"';}).join(',');}).join('\n');
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download='historial-'+mes+'.csv';a.click();
  URL.revokeObjectURL(url);
  toast('Historial exportado','success');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TAB 3: CUENTAS PENDIENTES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function renderTabPendientes(){
  var subTab=window._cuentasSubTab||'cobrar';
  var ocultarCero=window._ocultarCero!==false;

  // â•â•â• KPIs de pendientes â•â•â•
  var credActivosKpi = S.creds.filter(function(c){return !c.eliminado&&(c.estado==='activo'||c.estado==='mora');});
  var totalPorCobrar = credActivosKpi.reduce(function(a,c){return a+(getCreditoSaldoPendiente(c)||0);},0);
  var manualCobrarKpi = (S.cuentasPendientes||[]).filter(function(p){return p.tipo==='cobrar'&&!p.pagado&&!p.eliminado;});
  var manualPagarKpi = (S.cuentasPendientes||[]).filter(function(p){return p.tipo==='pagar'&&!p.pagado&&!p.eliminado;});
  var totalManualCobrar = manualCobrarKpi.reduce(function(a,p){return a+(p.monto||0);},0);
  var totalManualPagar = manualPagarKpi.reduce(function(a,p){return a+(p.monto||0);},0);
  var clientesMoraKpi = credActivosKpi.filter(function(c){return c.estado==='mora';}).length;
  var clientesAlDiaKpi = credActivosKpi.filter(function(c){return c.estado==='activo';}).length;

  var kpisHTML = '<div class="sg" style="grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">'
    +'<div class="stat" style="border-top:3px solid var(--green)">'
      +'<div class="st-v" style="color:var(--green);font-size:22px">'+fmt(totalPorCobrar + totalManualCobrar)+'</div>'
      +'<div class="st-l">Por cobrar</div>'
      +'<div style="font-size:10px;color:var(--ink3);margin-top:2px">'+credActivosKpi.length+' crÃ©ditos'+(manualCobrarKpi.length>0?' Â· '+manualCobrarKpi.length+' manuales':'')+'</div>'
    +'</div>'
    +'<div class="stat" style="border-top:3px solid var(--red)">'
      +'<div class="st-v" style="color:var(--red);font-size:22px">'+fmt(totalManualPagar)+'</div>'
      +'<div class="st-l">Por pagar</div>'
      +'<div style="font-size:10px;color:var(--ink3);margin-top:2px">'+manualPagarKpi.length+' pendiente'+(manualPagarKpi.length!==1?'s':'')+'</div>'
    +'</div>'
    +'<div class="stat" style="border-top:3px solid '+(clientesMoraKpi>0?'var(--red)':'var(--green)')+'">'
      +'<div class="st-v" style="color:'+(clientesMoraKpi>0?'var(--red)':'var(--green)')+';font-size:22px">'+clientesMoraKpi+'</div>'
      +'<div class="st-l">En mora</div>'
      +'<div style="font-size:10px;color:var(--ink3);margin-top:2px">'+clientesAlDiaKpi+' al dÃ­a</div>'
    +'</div>'
    +'<div class="stat" style="border-top:3px solid var(--p1)">'
      +'<div class="st-v" style="color:var(--p1);font-size:22px">'+fmt((totalPorCobrar + totalManualCobrar) - totalManualPagar)+'</div>'
      +'<div class="st-l">Balance neto</div>'
      +'<div style="font-size:10px;color:var(--ink3);margin-top:2px">Por cobrar âˆ’ por pagar</div>'
    +'</div>'
    +'</div>';

  var subTabBar='<div style="display:flex;gap:0;border-bottom:1px solid var(--rim);margin-bottom:16px">'
    +[['cobrar','Cuentas por cobrar'],['pagar','Cuentas por pagar']].map(function(p){
      var active=subTab===p[0];
      return '<button onclick="switchCuentasSubTab(\''+p[0]+'\')" style="'
        +'background:none;border:none;padding:11px 18px;font-size:13px;font-weight:'+(active?'800':'600')
        +';color:'+(active?'var(--p1)':'var(--ink3)')
        +';border-bottom:'+(active?'2px solid var(--p1)':'2px solid transparent')
        +';margin-bottom:-1px;cursor:pointer;font-family:var(--f);transition:color .15s">'+p[1]+'</button>';
    }).join('')
    +'<label style="display:flex;align-items:center;gap:6px;margin-left:auto;font-size:12px;font-weight:600;color:var(--ink2);cursor:pointer;padding:0 8px">'
    +'<input type="checkbox" '+(ocultarCero?'checked':'')+' onchange="window._ocultarCero=this.checked;nav(\'cuentas\')" style="accent-color:var(--p1)"> Ocultar cuentas en cero</label>'
    +'</div>'
    +'<div style="display:flex;gap:8px;margin-bottom:14px">'
    +(subTab==='cobrar'
      ? '<button class="btn btn-p btn-sm" onclick="openAgregarPendiente(\'cobrar\')">ï¼‹ Agregar pendiente por cobrar</button>'
      : '<button class="btn btn-d btn-sm" onclick="openAgregarPendiente(\'pagar\')" style="background:rgba(231,76,60,0.12);color:#e74c3c;border:1px solid rgba(231,76,60,0.25)">ï¼‹ Agregar pendiente por pagar</button>'
    )
    +'</div>';

  var body='';
  if(subTab==='cobrar') body=renderCobrar(ocultarCero);
  else body=renderPagar(ocultarCero);

  return '<div>'+kpisHTML+subTabBar+body+'</div>';
}

function renderCobrar(ocultarCero){
  // Manual pendientes por cobrar
  var manualCobrar=(S.cuentasPendientes||[]).filter(function(p){return p.tipo==='cobrar'&&!p.pagado&&!p.eliminado;});
  // Group creditos by client, compute pending cuotas
  var credActivos=S.creds.filter(function(c){return !c.eliminado&&(c.estado==='activo'||c.estado==='mora');});
  var byCliente={};
  credActivos.forEach(function(c){
    if(!byCliente[c.cli]) byCliente[c.cli]={cli:c.cli,creds:[],total:0,pendCount:0,diasRest:null};
    var saldoPend=getCreditoSaldoPendiente(c);
    var cuotasRestantes=Math.max(0,getCreditoTotalCuotas(c)-getCreditoCuotasPagadas(c));
    byCliente[c.cli].creds.push({id:c.id,saldoPend:saldoPend,cuotasRestantes:cuotasRestantes,fecha:c.fecha,estado:c.estado});
    byCliente[c.cli].total+=saldoPend;
    byCliente[c.cli].pendCount+=cuotasRestantes;
  });

  var grupos=Object.values(byCliente).filter(function(g){
    return !ocultarCero||g.total>0;
  }).sort(function(a,b){return b.total-a.total;});

  var totalCobrar=grupos.reduce(function(a,g){return a+g.total;},0);

  if(!grupos.length && !manualCobrar.length) return '<div class="empty"><span class="e-ic">âœ“</span><div class="e-tt">Sin cuentas pendientes por cobrar</div><div style="font-size:12px;color:var(--ink3);margin-top:6px"><button class="btn btn-p btn-sm" onclick="openAgregarPendiente(\'cobrar\')">ï¼‹ Agregar pendiente</button></div></div>';

  var rowsManual=manualCobrar.map(function(p,idx){
    return '<tr style="background:rgba(37,99,235,0.03)">'
      +'<td><span style="font-size:10px;background:rgba(37,99,235,0.12);color:var(--p1);border-radius:20px;padding:2px 8px;font-weight:700;margin-right:6px">MANUAL</span>'+p.descripcion+'</td>'
      +'<td style="text-align:center;color:var(--ink3)">'+( p.contraparte||'â€”' )+'</td>'
      +'<td style="text-align:right;font-weight:700">'+fmt(p.monto||0)+'</td>'
      +'<td style="text-align:center">'+(p.fechaVenc?'<span style="font-size:11px;color:var(--amber)">'+p.fechaVenc+'</span>':'â€”')+'</td>'
      +'<td style="text-align:center;display:flex;gap:6px;justify-content:center;align-items:center">'
      +'<button class="btn btn-p btn-xs" onclick="marcarPendientePagado(\''+p.id+'\')">âœ“ Cobrado</button>'
      +'<button class="btn btn-d btn-xs" onclick="delPendiente(\''+p.id+'\')">âœ•</button>'
      +'</td></tr>';
  }).join('');

  var rows=grupos.map(function(g,idx){
    var expired=g.creds.some(function(c){return c.estado==='mora';});
    var diasLabel=expired?'<span style="color:#e74c3c;font-weight:700">Expirado</span>':'<span style="color:var(--ink2)">â€”</span>';
    return '<tr>'
      +'<td><span style="cursor:pointer;font-size:11px;color:var(--p1)" onclick="toggleCobrarRow('+idx+')">â–¶</span> Cliente: '+g.cli+'</td>'
      +'<td style="text-align:center;font-weight:700">'+g.pendCount+'</td>'
      +'<td style="text-align:right;font-weight:700">'+fmt(g.total)+'</td>'
      +'<td style="text-align:center">'+diasLabel+'</td>'
      +'<td style="text-align:center">'
      +'<button onclick="cobrarTodoCliente(\''+g.cli+'\')" class="btn btn-p btn-xs">Cobrar todo</button>'
      +'<button style="background:none;border:none;font-size:16px;cursor:pointer;color:var(--ink3);padding:4px 6px">â‹®</button>'
      +'</td></tr>'
      +'<tr id="cobrar-row-'+idx+'" style="display:none"><td colspan="5" style="padding:0">'
      +'<div style="padding:10px 20px 10px 40px;background:var(--base);border-bottom:1px solid var(--rim)">'
      +g.creds.map(function(cr){
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:12px">'
          +'<span style="color:var(--ink2)">'+cr.id+'</span>'
          +'<span>'+cr.cuotasRestantes+' cuotas</span>'
          +'<span style="font-weight:700;color:var(--p1)">'+fmt(cr.saldoPend)+'</span>'
          +'</div>';
      }).join('')
      +'</div></td></tr>';
  }).join('');

  var totalManual=manualCobrar.reduce(function(a,p){return a+(p.monto||0);},0);
  var totalCobrarFull=totalCobrar+totalManual;

  return '<div class="card">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">'
    +'<div><div class="ct" style="color:var(--p1)">Cuentas pendientes por cobrar</div></div>'
    +'<div style="display:flex;gap:10px;align-items:center">'
    +'<input type="text" class="fi" placeholder="BÃºsqueda de texto completo..." style="min-width:220px;font-size:12px" oninput="filtrarCobrar(this.value)">'
    +'<div style="background:rgba(37,99,235,0.12);border-radius:20px;padding:8px 16px;font-weight:800;font-size:13px;color:var(--p1)">Total: '+fmt(totalCobrarFull)+'</div>'
    +'</div></div>'
    +'<div style="overflow-x:auto"><table class="tbl" id="cobrar-table"><thead><tr>'
    +'<th>Asunto â†‘</th><th style="text-align:center">Contraparte / Cuotas â†‘</th>'
    +'<th style="text-align:right">Por cobrar â†‘</th><th style="text-align:center">Vencimiento â†‘</th>'
    +'<th style="text-align:center">AcciÃ³n</th></tr></thead>'
    +'<tbody>'+rows+rowsManual+'</tbody></table></div>'
    +'<div style="font-size:12px;color:var(--ink3);padding-top:12px">'+(grupos.length+manualCobrar.length)+' resultado(s) â€” '+(manualCobrar.length)+' manuales</div>'
    +'</div>';
}

function renderPagar(ocultarCero){
  var manualPagar=(S.cuentasPendientes||[]).filter(function(p){return p.tipo==='pagar'&&!p.pagado&&!p.eliminado;});
  var egresos=S.egresos.filter(function(e){return !e.eliminado;});
  // Group by categoria
  var byCateg={};
  egresos.forEach(function(e){
    var cat=e.categoria||'otros';
    if(!byCateg[cat]) byCateg[cat]={cat:cat,items:[],total:0};
    byCateg[cat].items.push(e);
    byCateg[cat].total+=(e.monto||0);
  });
  var grupos=Object.values(byCateg).filter(function(g){return !ocultarCero||g.total>0;})
    .sort(function(a,b){return b.total-a.total;});
  var totalPagar=grupos.reduce(function(a,g){return a+g.total;},0);

  if(!grupos.length && !manualPagar.length) return '<div class="empty"><span class="e-ic">âœ“</span><div class="e-tt">Sin cuentas pendientes por pagar</div><div style="font-size:12px;color:var(--ink3);margin-top:6px"><button class="btn btn-d btn-sm" onclick="openAgregarPendiente(\'pagar\')">ï¼‹ Agregar pendiente</button></div></div>';

  var rowsManualPagar=manualPagar.map(function(p){
    return '<tr style="background:rgba(231,76,60,0.03)">'
      +'<td><span style="font-size:10px;background:rgba(231,76,60,0.12);color:#e74c3c;border-radius:20px;padding:2px 8px;font-weight:700;margin-right:6px">MANUAL</span>'+p.descripcion+'</td>'
      +'<td style="text-align:center;color:var(--ink3)">'+( p.contraparte||'â€”' )+'</td>'
      +'<td style="text-align:right;font-weight:700;color:#e74c3c">'+fmt(p.monto||0)+'</td>'
      +'<td style="text-align:center">'+(p.fechaVenc?'<span style="font-size:11px;color:var(--amber)">'+p.fechaVenc+'</span>':'â€”')+'</td>'
      +'<td style="text-align:center;display:flex;gap:6px;justify-content:center;align-items:center">'
      +'<button class="btn btn-g btn-xs" onclick="marcarPendientePagado(\''+p.id+'\')">âœ“ Pagado</button>'
      +'<button class="btn btn-d btn-xs" onclick="delPendiente(\''+p.id+'\')">âœ•</button>'
      +'</td></tr>';
  }).join('');

  var rows=grupos.map(function(g,idx){
    var catLabel={inventario:'Inventario',equipos:'Equipos',operativo:'Operativo',nomina:'NÃ³mina',otros:'Otros'}[g.cat]||g.cat;
    return '<tr>'
      +'<td><span style="cursor:pointer;font-size:11px;color:var(--p1)" onclick="togglePagarRow('+idx+')">â–¶</span> '+catLabel+'</td>'
      +'<td style="text-align:center;font-weight:700">'+g.items.length+'</td>'
      +'<td style="text-align:right;font-weight:700;color:var(--red)">'+fmt(g.total)+'</td>'
      +'<td style="text-align:center"><span style="color:var(--ink3)">â€”</span></td>'
      +'<td style="text-align:center">'
      +'<button onclick="nav(\'conta\')" class="btn btn-g btn-xs">Ver detalle</button>'
      +'</td></tr>'
      +'<tr id="pagar-row-'+idx+'" style="display:none"><td colspan="5" style="padding:0">'
      +'<div style="padding:10px 20px 10px 40px;background:var(--base);border-bottom:1px solid var(--rim)">'
      +g.items.slice(0,5).map(function(e){
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:12px">'
          +'<span style="color:var(--ink2)">'+e.concepto+'</span>'
          +'<span style="color:var(--ink3)">'+e.fecha+'</span>'
          +'<span style="font-weight:700;color:var(--red)">'+fmt(e.monto)+'</span>'
          +'</div>';
      }).join('')
      +'</div></td></tr>';
  }).join('');

  var totalManualPagar=manualPagar.reduce(function(a,p){return a+(p.monto||0);},0);
  var totalPagarFull=totalPagar+totalManualPagar;

  return '<div class="card">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">'
    +'<div><div class="ct" style="color:var(--red,#e74c3c)">Cuentas por pagar</div></div>'
    +'<div style="display:flex;gap:10px;align-items:center">'
    +'<input type="text" class="fi" placeholder="BÃºsqueda de texto completo..." style="min-width:220px;font-size:12px">'
    +'<div style="background:rgba(231,76,60,0.10);border-radius:20px;padding:8px 16px;font-weight:800;font-size:13px;color:#e74c3c">Total: '+fmt(totalPagarFull)+'</div>'
    +'</div></div>'
    +'<div style="overflow-x:auto"><table class="tbl"><thead><tr>'
    +'<th>DescripciÃ³n</th><th style="text-align:center">Contraparte</th>'
    +'<th style="text-align:right">Por pagar</th><th style="text-align:center">Vencimiento</th>'
    +'<th style="text-align:center">AcciÃ³n</th></tr></thead>'
    +'<tbody>'+rows+rowsManualPagar+'</tbody></table></div>'
    +'<div style="font-size:12px;color:var(--ink3);padding-top:12px">'+(grupos.length+manualPagar.length)+' resultado(s) â€” '+(manualPagar.length)+' manuales</div>'
    +'</div>';
}

function toggleCobrarRow(idx){
  var row=document.getElementById('cobrar-row-'+idx);
  if(row){row.style.display=(row.style.display==='none'?'':'none');}
}
function togglePagarRow(idx){
  var row=document.getElementById('pagar-row-'+idx);
  if(row){row.style.display=(row.style.display==='none'?'':'none');}
}
function cobrarTodoCliente(cli){
  nav('pagos');
  setTimeout(function(){toast('Registra el pago para '+cli,'info');},200);
}
function filtrarCobrar(q){
  var rows=document.querySelectorAll('#cobrar-table tbody tr');
  var lower=q.toLowerCase();
  rows.forEach(function(r){
    if(!r.id||!r.id.startsWith('cobrar-row-')){
      r.style.display=(r.textContent.toLowerCase().includes(lower)||!q)?'':'none';
    }
  });
}

// â”€â”€ PENDIENTES MANUALES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openAgregarPendiente(tipo){
  var esCobrar=tipo==='cobrar';
  var color=esCobrar?'var(--p1)':'#e74c3c';
  var label=esCobrar?'por cobrar':'por pagar';
  $('mic').textContent=esCobrar?'PND':'PAG';
  $('mtt').textContent='Nueva cuenta pendiente '+label;
  $('msb').textContent='Se agregarÃ¡ a cuentas '+label;
  $('modal-box').className='modal';
  $('mbd').innerHTML=
    '<div class="fgr c1" style="gap:10px">'
    +'<div class="fg"><label>DescripciÃ³n *</label><input class="fi" id="pnd_desc" placeholder="Ej: Pago alquiler local, Cobro cliente ABC..."></div>'
    +'<div class="fg"><label>Contraparte</label><input class="fi" id="pnd_contra" placeholder="Nombre del cliente o proveedor"></div>'
    +'<div class="fgr c2" style="gap:10px">'
    +'<div class="fg"><label>Monto *</label><input class="fi" id="pnd_monto" type="number" min="0" step="0.01" placeholder="0.00"></div>'
    +'<div class="fg"><label>Fecha de vencimiento</label><input class="fi" id="pnd_fecha" type="date"></div>'
    +'</div>'
    +'<div class="fg"><label>Notas</label><input class="fi" id="pnd_notas" placeholder="Opcional..."></div>'
    +'</div>';
  $('mft').innerHTML='<button class="btn btn-g btn-sm" onclick="closeM()">Cancelar</button>'
    +'<button class="btn btn-p btn-sm" style="background:'+color+'" onclick="savePendiente(\''+tipo+'\')">ï¼‹ Guardar pendiente</button>';
  $('ov').style.display='flex';
}

function savePendiente(tipo){
  var desc=($('pnd_desc')||{}).value||'';
  var monto=parseFloat(($('pnd_monto')||{}).value||'0');
  if(!desc.trim()){toast('La descripciÃ³n es obligatoria','error');return;}
  if(isNaN(monto)||monto<0){toast('Monto invÃ¡lido','error');return;}
  if(!S.cuentasPendientes) S.cuentasPendientes=[];
  var obj={
    id:'PND-'+Date.now(),
    tipo:tipo,
    descripcion:desc.trim(),
    contraparte:($('pnd_contra')||{}).value||'',
    monto:monto,
    fechaVenc:($('pnd_fecha')||{}).value||'',
    notas:($('pnd_notas')||{}).value||'',
    creadoEn:new Date().toISOString().split('T')[0],
    creadoPor:(S.currentUser&&S.currentUser.nombre)||'Admin',
    pagado:false,
    eliminado:false
  };
  S.cuentasPendientes.push(obj);
  if(db){
    db.collection('cuentasPendientes').doc(obj.id).set(obj).catch(function(){});
  }
  closeM();
  nav('cuentas');
  window._cuentasTab='pendientes';
  window._cuentasSubTab=tipo;
  nav('cuentas');
  toast('Pendiente agregado','success');
}

function delPendiente(id){
  var idx=S.cuentasPendientes.findIndex(function(p){return p.id===id;});
  if(idx<0) return;
  S.cuentasPendientes[idx].eliminado=true;
  if(db){db.collection('cuentasPendientes').doc(id).update({eliminado:true}).catch(function(){});}
  nav('cuentas');
  toast('Pendiente eliminado','info');
}

function marcarPendientePagado(id){
  var idx=S.cuentasPendientes.findIndex(function(p){return p.id===id;});
  if(idx<0) return;
  S.cuentasPendientes[idx].pagado=true;
  S.cuentasPendientes[idx].pagadoEn=new Date().toISOString().split('T')[0];
  if(db){db.collection('cuentasPendientes').doc(id).update({pagado:true,pagadoEn:S.cuentasPendientes[idx].pagadoEn}).catch(function(){});}
  nav('cuentas');
  toast('Marcado como '+(S.cuentasPendientes[idx].tipo==='cobrar'?'cobrado':'pagado'),'success');
}


// â”€â”€ DEPÃ“SITO â”€â”€
function openDeposito(cuentaNombre){
  $('mic').textContent='âœ“';$('mtt').textContent='Registrar DepÃ³sito';
  $('msb').textContent=cuentaNombre||'Selecciona la cuenta';
  $('modal-box').className='modal';
  var opts = (_cuentasBanc||[]).map(function(cu){
    return '<option value="'+cu.nombre+'" '+(cu.nombre===cuentaNombre?'selected':'')+'>'+cu.nombre+'</option>';
  }).join('');
  $('mbd').innerHTML='<div class="fgr c1" style="gap:9px">'
    +'<div class="fg"><label>Cuenta destino *</label>'
    +(opts?'<select class="fs" id="dep_cuenta">'+opts+'</select>'
      :'<input class="fi" id="dep_cuenta" placeholder="Nombre de la cuenta">')
    +'</div>'
    +'<div class="fg"><label>Concepto *</label><input class="fi" id="dep_conc" placeholder="Ej: Cobro cuota, pago inicial..."></div>'
    +'<div class="fgr" style="gap:8px">'
    +'<div class="fg"><label>Monto *</label><input class="fi" id="dep_monto" type="number" step="0.01" placeholder="0.00"></div>'
    +'<div class="fg"><label>Fecha</label><input class="fi" id="dep_fecha" type="date" value="'+new Date().toISOString().split('T')[0]+'"></div></div>'
    +'<div class="fg"><label>Referencia / Comprobante</label><input class="fi" id="dep_ref" placeholder="Opcional"></div>'
    +'<div class="fgr" style="gap:8px"><div class="fg"><label>Tasa Bs./$</label><input class="fi" id="dep_tasa" type="number" step="0.01" placeholder="Ej: 478.58" value="'+(window._tasaBsGlobal||1)+'"></div>'
    +'<div class="fg"><label>Moneda</label><select class="fs" id="dep_moneda"><option value="USD">USD $</option><option value="BS">Bs.</option></select></div></div>'
    +'</div>';
  S.saveFn=function(){
    var cnombre=($('dep_cuenta')&&$('dep_cuenta').value)||cuentaNombre||'';
    var conc=($('dep_conc')&&$('dep_conc').value.trim())||'';
    var monto=parseFloat(($('dep_monto')&&$('dep_monto').value))||0;
    if(!cnombre){toast('Selecciona una cuenta','error');return false;}
    if(!conc||monto<=0){toast('Concepto y monto obligatorios','error');return false;}
    var mov={id:'MOV-'+Date.now(),tipo:'deposito',concepto:conc,monto:monto,
      cuentaOrigen:null,cuentaDestino:cnombre,
      fecha:($('dep_fecha')&&$('dep_fecha').value)||new Date().toISOString().split('T')[0],
      hora:new Date().toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit',hour12:false}),
      referencia:($('dep_ref')&&$('dep_ref').value)||'',
      tasaBs:parseFloat(($('dep_tasa')&&$('dep_tasa').value))||window._tasaBsGlobal||1,
      monedaMov:($('dep_moneda')&&$('dep_moneda').value)||'USD',
      realizadoPor:(S.currentUser&&S.currentUser.nombre)||'Admin'};
    S.movimientos.push(mov); DB.saveMovimiento(mov);
    closeM(); nav('cuentas'); toast('DepÃ³sito registrado Â· '+fmt(monto),'success'); return true;
  };
  $('mft').innerHTML='<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    +'<button class="btn btn-p" onclick="saveM()">Registrar DepÃ³sito</button>';
  $('ov').style.display='flex';
}

// â”€â”€ RETIRO â”€â”€
function openRetiro(cuentaNombre){
  $('mic').textContent='â—';$('mtt').textContent='Registrar Retiro';
  $('msb').textContent=cuentaNombre||'Selecciona la cuenta';
  $('modal-box').className='modal';
  var opts = (_cuentasBanc||[]).map(function(cu){
    return '<option value="'+cu.nombre+'" '+(cu.nombre===cuentaNombre?'selected':'')+'>'+cu.nombre+'</option>';
  }).join('');
  $('mbd').innerHTML='<div class="fgr c1" style="gap:9px">'
    +'<div class="fg"><label>Cuenta origen *</label>'
    +(opts?'<select class="fs" id="ret_cuenta">'+opts+'</select>'
      :'<input class="fi" id="ret_cuenta" placeholder="Nombre de la cuenta">')
    +'</div>'
    +'<div class="fg"><label>Concepto *</label><input class="fi" id="ret_conc" placeholder="Ej: Pago proveedor, nÃ³mina..."></div>'
    +'<div class="fgr" style="gap:8px">'
    +'<div class="fg"><label>Monto *</label><input class="fi" id="ret_monto" type="number" step="0.01" placeholder="0.00"></div>'
    +'<div class="fg"><label>Fecha</label><input class="fi" id="ret_fecha" type="date" value="'+new Date().toISOString().split('T')[0]+'"></div></div>'
    +'<div class="fg"><label>Referencia</label><input class="fi" id="ret_ref" placeholder="Opcional"></div>'
    +'<div class="fgr" style="gap:8px"><div class="fg"><label>Tasa Bs./$</label><input class="fi" id="ret_tasa" type="number" step="0.01" placeholder="Ej: 478.58" value="'+(window._tasaBsGlobal||1)+'"></div>'
    +'<div class="fg"><label>Moneda</label><select class="fs" id="ret_moneda"><option value="USD">USD $</option><option value="BS">Bs.</option></select></div></div>'
    +'</div>';
  S.saveFn=function(){
    var cnombre=($('ret_cuenta')&&$('ret_cuenta').value)||cuentaNombre||'';
    var conc=($('ret_conc')&&$('ret_conc').value.trim())||'';
    var monto=parseFloat(($('ret_monto')&&$('ret_monto').value))||0;
    if(!cnombre){toast('Selecciona una cuenta','error');return false;}
    if(!conc||monto<=0){toast('Concepto y monto obligatorios','error');return false;}
    var mov={id:'MOV-'+Date.now(),tipo:'retiro',concepto:conc,monto:monto,
      cuentaOrigen:cnombre,cuentaDestino:null,
      fecha:($('ret_fecha')&&$('ret_fecha').value)||new Date().toISOString().split('T')[0],
      hora:new Date().toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit',hour12:false}),
      referencia:($('ret_ref')&&$('ret_ref').value)||'',
      tasaBs:parseFloat(($('ret_tasa')&&$('ret_tasa').value))||window._tasaBsGlobal||1,
      monedaMov:($('ret_moneda')&&$('ret_moneda').value)||'USD',
      realizadoPor:(S.currentUser&&S.currentUser.nombre)||'Admin'};
    S.movimientos.push(mov); DB.saveMovimiento(mov);
    closeM(); nav('cuentas'); toast('Retiro registrado Â· '+fmt(monto),'success'); return true;
  };
  $('mft').innerHTML='<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    +'<button class="btn btn-d" onclick="saveM()">Registrar Retiro</button>';
  $('ov').style.display='flex';
}

// â”€â”€ TRANSFERENCIA â”€â”€
function openTransferencia(cuentaNombre){
  $('mic').textContent='â†»';$('mtt').textContent='Transferencia entre Cuentas';$('msb').textContent='Mueve dinero entre cuentas';
  $('modal-box').className='modal';
  var opts = (_cuentasBanc||[]).map(function(cu){
    return '<option value="'+cu.nombre+'">'+cu.nombre+'</option>';
  }).join('');
  var optsOrig = (_cuentasBanc||[]).map(function(cu){
    return '<option value="'+cu.nombre+'" '+(cu.nombre===cuentaNombre?'selected':'')+'>'+cu.nombre+'</option>';
  }).join('');
  if(!opts){ toast('Agrega cuentas en ConfiguraciÃ³n primero','error'); return; }
  $('mbd').innerHTML='<div class="fgr c1" style="gap:9px">'
    +'<div class="fg"><label>Cuenta origen *</label><select class="fs" id="tr_origen">'+optsOrig+'</select></div>'
    +'<div style="text-align:center;font-size:22px;color:var(--p1);margin:4px 0">â¬‡ï¸</div>'
    +'<div class="fg"><label>Cuenta destino *</label><select class="fs" id="tr_destino">'+opts+'</select></div>'
    +'<div class="fgr" style="gap:8px">'
    +'<div class="fg"><label>Monto *</label><input class="fi" id="tr_monto" type="number" step="0.01" placeholder="0.00"></div>'
    +'<div class="fg"><label>Fecha</label><input class="fi" id="tr_fecha" type="date" value="'+new Date().toISOString().split('T')[0]+'"></div></div>'
    +'<div class="fg"><label>Concepto</label><input class="fi" id="tr_conc" placeholder="Ej: Traspaso operativo..."></div>'
    +'<div class="fg"><label>Referencia</label><input class="fi" id="tr_ref" placeholder="Opcional"></div>'
    +'<div class="fg"><label>Tasa Bs./$</label><input class="fi" id="tr_tasa" type="number" step="0.01" placeholder="Ej: 478.58" value="'+(window._tasaBsGlobal||1)+'"></div>'
    +'</div>';
  S.saveFn=function(){
    var orig=($('tr_origen')&&$('tr_origen').value)||'';
    var dest=($('tr_destino')&&$('tr_destino').value)||'';
    var monto=parseFloat(($('tr_monto')&&$('tr_monto').value))||0;
    if(!orig||!dest){toast('Selecciona origen y destino','error');return false;}
    if(orig===dest){toast('El origen y destino deben ser distintos','error');return false;}
    if(monto<=0){toast('Ingresa un monto vÃ¡lido','error');return false;}
    var conc=($('tr_conc')&&$('tr_conc').value)||'Transferencia interna';
    var mov={id:'MOV-'+Date.now(),tipo:'transferencia',concepto:conc,monto:monto,
      cuentaOrigen:orig,cuentaDestino:dest,
      fecha:($('tr_fecha')&&$('tr_fecha').value)||new Date().toISOString().split('T')[0],
      hora:new Date().toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit',hour12:false}),
      referencia:($('tr_ref')&&$('tr_ref').value)||'',
      tasaBs:parseFloat(($('tr_tasa')&&$('tr_tasa').value))||window._tasaBsGlobal||1,
      monedaMov:'USD',
      realizadoPor:(S.currentUser&&S.currentUser.nombre)||'Admin'};
    S.movimientos.push(mov); DB.saveMovimiento(mov);
    closeM(); nav('cuentas'); toast('Transferencia registrada Â· '+fmt(monto),'success'); return true;
  };
  $('mft').innerHTML='<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    +'<button class="btn btn-p" onclick="saveM()">Transferir</button>';
  $('ov').style.display='flex';
}


function delMovimiento(id){
  if(!S.currentUser || S.currentUser.rol !== 'Administrador'){
    toast('Solo el Administrador puede anular movimientos','error');
    return;
  }
  var i=S.movimientos.findIndex(function(x){return x.id===id;});
  if(i<0) return;
  anularMovimiento(id, null);
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// NOTIFICACIONES â€” funciones reales
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•


// â”€â”€ INIT â€” arranca la app despuÃ©s del login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
