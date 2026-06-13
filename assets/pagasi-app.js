// ╔══════════════════════════════════════════════════════════╗
// ║ FIREBASE — PEGA TU CONFIG AQUÍ ║
// ║ 1. console.firebase.google.com ║
// ║ 2. Engranaje → Configuración del proyecto ║
// ║ 3. Tu app Web → copia el objeto firebaseConfig ║
// ╚══════════════════════════════════════════════════════════╝
var FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDt07EYdmvIqjU5a9CGPMQdYz8iBJ69Su8',
  authDomain: 'pagasi-v2.firebaseapp.com',
  projectId: 'pagasi-v2',
  storageBucket: 'pagasi-v2.firebasestorage.app',
  messagingSenderId: '951911859002',
  appId: '1:951911859002:web:1eb8f0af7bcbd508474603'
};

// ════════════════════════════════════════════════════════════════
// PUSH NOTIFICATIONS del navegador — recordatorios automáticos
// ════════════════════════════════════════════════════════════════
function pushNotifSupported(){
  return ('Notification' in window) && typeof Notification.requestPermission === 'function';
}

function pushNotifState(){
  if(!pushNotifSupported()) return 'no-soportado';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

async function pushNotifRequest(){
  if(!pushNotifSupported()){
    if(typeof toast==='function') toast('Tu navegador no soporta notificaciones','error');
    return false;
  }
  try {
    var perm = await Notification.requestPermission();
    if(perm === 'granted'){
      if(typeof toast==='function') toast('✓ Notificaciones activadas','success');
      try { localStorage.setItem('pgsPushEnabled','1'); } catch(e){}
      // Notificación de prueba
      pushNotifShow('Pagasi activado', 'Recibirás recordatorios de cobros y leads nuevos.', 'check');
      // Iniciar el watcher periódico
      pushNotifIniciarWatcher();
      return true;
    } else {
      if(typeof toast==='function') toast('Permiso de notificaciones denegado','warn');
      return false;
    }
  } catch(e){
    console.error('Push permission error:', e);
    return false;
  }
}

function pushNotifShow(titulo, body, tag){
  if(pushNotifState() !== 'granted') return null;
  try {
    var n = new Notification(titulo, {
      body: body,
      icon: '/PAGASI-V2.0/assets/pagasi-favicon.png',  // GitHub Pages path
      badge: '/PAGASI-V2.0/assets/pagasi-favicon.png',
      tag: tag || 'pagasi-' + Date.now(),
      requireInteraction: false,
      silent: false
    });
    n.onclick = function(){
      window.focus();
      n.close();
    };
    return n;
  } catch(e){
    console.warn('Push notif show error:', e);
    return null;
  }
}

// Mantiene registro de cosas ya notificadas hoy para no spamear
function _pushNotifWasShown(key){
  try {
    var hoy = new Date().toISOString().slice(0,10);
    var raw = localStorage.getItem('pgsPushLog_'+hoy) || '[]';
    var arr = JSON.parse(raw);
    return arr.indexOf(key) >= 0;
  } catch(e){ return false; }
}
function _pushNotifMark(key){
  try {
    var hoy = new Date().toISOString().slice(0,10);
    var raw = localStorage.getItem('pgsPushLog_'+hoy) || '[]';
    var arr = JSON.parse(raw);
    if(arr.indexOf(key) < 0){ arr.push(key); localStorage.setItem('pgsPushLog_'+hoy, JSON.stringify(arr)); }
  } catch(e){}
}

function pushNotifChequearAhora(){
  if(pushNotifState() !== 'granted') return;
  if(!S || !S.creds) return;
  try {
    // 1) Cuotas vencidas (mora > 0)
    var vencidas = (S.creds||[]).filter(function(c){
      return !c.eliminado && c.estado === 'activo' && (parseInt(c.mora,10)||0) > 0;
    });
    var graves = vencidas.filter(function(c){ return (parseInt(c.mora,10)||0) > 30; });
    if(graves.length > 0 && !_pushNotifWasShown('mora-grave-'+graves.length)){
      pushNotifShow(
        '⚠ ' + graves.length + ' clientes con mora grave',
        graves.length + ' clientes tienen +30 días de atraso. Revisa cobranza.',
        'mora-grave'
      );
      _pushNotifMark('mora-grave-'+graves.length);
    }

    // 2) Cuotas que vencen HOY o mañana
    var hoy = new Date(); hoy.setHours(0,0,0,0);
    var manana = new Date(hoy); manana.setDate(hoy.getDate()+1);
    var venceProx = 0;
    (S.creds||[]).forEach(function(c){
      if(c.eliminado || c.estado !== 'activo' || !c.fecha) return;
      var inicio = new Date(c.fecha);
      var siguiente = new Date(inicio.getTime() + (((c.pagado||0)+1) * 15 * 24 * 60 * 60 * 1000));
      siguiente.setHours(0,0,0,0);
      if(siguiente.getTime() === hoy.getTime() || siguiente.getTime() === manana.getTime()){
        venceProx++;
      }
    });
    if(venceProx > 0 && !_pushNotifWasShown('vence-prox-'+venceProx)){
      pushNotifShow(
        '⏰ ' + venceProx + ' cuotas vencen hoy/mañana',
        'Revisa el módulo de cobranza para llamar antes de la fecha.',
        'vence-prox'
      );
      _pushNotifMark('vence-prox-'+venceProx);
    }

    // 3) Leads web nuevos sin atender
    var leadsWeb = (S.clientes||[]).filter(function(cl){
      if(cl.eliminado) return false;
      if(cl.origen !== 'web') return false;
      // Sin crédito asociado todavía
      var tieneCred = (S.creds||[]).some(function(cr){ return cr.cliId === cl.id || cr.cli === cl.nombre; });
      return !tieneCred;
    });
    if(leadsWeb.length > 0 && !_pushNotifWasShown('leads-web-'+leadsWeb.length)){
      pushNotifShow(
        '🎯 ' + leadsWeb.length + ' lead' + (leadsWeb.length!==1?'s':'') + ' web sin atender',
        'Tienes nuevos clientes que llenaron el formulario. Contáctalos antes de que se enfríen.',
        'leads-web'
      );
      _pushNotifMark('leads-web-'+leadsWeb.length);
    }
  } catch(e){ console.warn('pushNotifChequear error:', e); }
}

var _pushNotifTimer = null;
function pushNotifIniciarWatcher(){
  if(_pushNotifTimer) clearInterval(_pushNotifTimer);
  // Chequear al inicio + cada 30 min
  setTimeout(pushNotifChequearAhora, 5000);
  _pushNotifTimer = setInterval(pushNotifChequearAhora, 30 * 60 * 1000);
}

// ════════════════════════════════════════════════════════════════
// REPORTE MENSUAL POR EMAIL — generador + apertura mailto
// ════════════════════════════════════════════════════════════════
function generarReporteMensual(){
  if(!S || !S.creds) return null;
  var hoy = new Date();
  var mesAct = hoy.getFullYear() + '-' + String(hoy.getMonth()+1).padStart(2,'0');
  var mesAnt = new Date(hoy.getFullYear(), hoy.getMonth()-1, 1);
  var mesAntK = mesAnt.getFullYear() + '-' + String(mesAnt.getMonth()+1).padStart(2,'0');

  // ─── PAGOS CONFIRMADOS ───
  var pagosConf = (S.pagos||[]).filter(function(p){ return !p.eliminado && p.estado === 'confirmado'; });
  var pagosMesAct = pagosConf.filter(function(p){ return p.fecha && p.fecha.startsWith(mesAct); });
  var pagosMesAnt = pagosConf.filter(function(p){ return p.fecha && p.fecha.startsWith(mesAntK); });

  var cobradoMesAct = pagosMesAct.reduce(function(a,p){ return a + (parseFloat(p.monto)||0); }, 0);
  var cobradoMesAnt = pagosMesAnt.reduce(function(a,p){ return a + (parseFloat(p.monto)||0); }, 0);
  var pctCrec = cobradoMesAnt > 0 ? Math.round((cobradoMesAct - cobradoMesAnt) / cobradoMesAnt * 100) : (cobradoMesAct > 0 ? 100 : 0);

  // Cuotas vs Iniciales
  var iniciales = pagosMesAct.filter(function(p){
    return p.esInicial || p.tipoOperacion === 'inicial_credito' || (p.concepto && String(p.concepto).indexOf('Inicial · ') === 0);
  });
  var cuotas = pagosMesAct.filter(function(p){
    return !(p.esInicial || p.tipoOperacion === 'inicial_credito' || (p.concepto && String(p.concepto).indexOf('Inicial · ') === 0));
  });
  var totalIniciales = iniciales.reduce(function(a,p){ return a + (parseFloat(p.monto)||0); }, 0);
  var totalCuotas = cuotas.reduce(function(a,p){ return a + (parseFloat(p.monto)||0); }, 0);

  // ─── EGRESOS ───
  var egresosTodos = (S.egresos||[]).filter(function(e){ return !e.eliminado; });
  var egresosMesAct = egresosTodos.filter(function(e){ return e.fecha && e.fecha.startsWith(mesAct); });
  var totalEgresos = egresosMesAct.reduce(function(a,e){ return a + (parseFloat(e.monto)||0); }, 0);

  // Egresos por categoría
  var egresosPorCat = {};
  egresosMesAct.forEach(function(e){
    var cat = e.categoria || e.concepto || 'Sin categoría';
    if(!egresosPorCat[cat]) egresosPorCat[cat] = {cat:cat, total:0, count:0};
    egresosPorCat[cat].total += parseFloat(e.monto)||0;
    egresosPorCat[cat].count++;
  });
  var egresosListados = Object.values(egresosPorCat).sort(function(a,b){ return b.total - a.total; });

  // Utilidad
  var utilidad = cobradoMesAct - totalEgresos;

  // ─── CARTERA ───
  var cartera = (S.creds||[]).filter(function(c){ return !c.eliminado && c.estado === 'activo'; })
    .reduce(function(a,c){
      var tot = (parseFloat(c.cuotaQ||c.cuota||0) * (c.totalCuotas || (c.plazo||0)*2));
      var pag = (parseFloat(c.cuotaQ||c.cuota||0) * (parseInt(c.pagado,10)||0));
      return a + Math.max(0, tot - pag);
    }, 0);

  // ─── CRÉDITOS ───
  var creditosActivos = (S.creds||[]).filter(function(c){ return !c.eliminado && c.estado === 'activo'; }).length;
  var creditosCompletados = (S.creds||[]).filter(function(c){ return !c.eliminado && c.estado === 'completado'; }).length;
  var creditosNuevosArr = (S.creds||[]).filter(function(c){
    if(c.eliminado) return false;
    var f = c.fecha || c.creadoEn;
    return f && String(f).startsWith(mesAct);
  });
  var creditosNuevos = creditosNuevosArr.length;
  var montoCreditosNuevos = creditosNuevosArr.reduce(function(a,c){ return a + (parseFloat(c.precio)||0); }, 0);

  // ─── MORA ───
  var enMora = (S.creds||[]).filter(function(c){
    return !c.eliminado && c.estado === 'activo' && (parseInt(c.mora,10)||0) > 0;
  }).sort(function(a,b){ return (parseInt(b.mora,10)||0) - (parseInt(a.mora,10)||0); });
  var moraGraves = enMora.filter(function(c){ return (parseInt(c.mora,10)||0) > 30; });
  var moraLeves = enMora.filter(function(c){ return (parseInt(c.mora,10)||0) <= 30; });

  // ─── TOP COBRADORES ───
  var topCobradoresMap = {};
  pagosMesAct.forEach(function(p){
    var cob = p.cobrador || p.realizadoPor || 'Sin asignar';
    if(!topCobradoresMap[cob]) topCobradoresMap[cob] = {nombre:cob, total:0, count:0};
    topCobradoresMap[cob].total += parseFloat(p.monto)||0;
    topCobradoresMap[cob].count++;
  });
  var topCobradores = Object.values(topCobradoresMap).sort(function(a,b){ return b.total - a.total; });

  // ─── TOP CLIENTES (más pagaron) ───
  var topClientesMap = {};
  pagosMesAct.forEach(function(p){
    var cli = p.cli || 'Sin nombre';
    if(!topClientesMap[cli]) topClientesMap[cli] = {nombre:cli, total:0, count:0};
    topClientesMap[cli].total += parseFloat(p.monto)||0;
    topClientesMap[cli].count++;
  });
  var topClientes = Object.values(topClientesMap).sort(function(a,b){ return b.total - a.total; }).slice(0,10);

  // ─── CLIENTES ───
  var clientesTotales = (S.clientes||[]).filter(function(c){ return !c.eliminado; }).length;
  var clientesNuevos = (S.clientes||[]).filter(function(cl){
    if(cl.eliminado) return false;
    return cl.creado && String(cl.creado).startsWith(mesAct);
  }).length;
  var leadsWeb = (S.clientes||[]).filter(function(cl){
    if(cl.eliminado) return false;
    if(cl.origen !== 'web') return false;
    return cl.creado && String(cl.creado).startsWith(mesAct);
  }).length;

  // ─── INVENTARIO MOTOS ───
  var motosDisponibles = (S.motos||[]).filter(function(m){ return !m.eliminado && m.estado === 'disponible'; }).length;
  var motosVendidas = (S.motos||[]).filter(function(m){ return !m.eliminado && m.estado === 'vendida'; }).length;
  var motosTotal = (S.motos||[]).filter(function(m){ return !m.eliminado; }).length;

  // ─── PAGOS POR SEDE / CONCESIONARIO ───
  var pagosPorSedeMap = {};
  pagosMesAct.forEach(function(p){
    var cred = (S.creds||[]).find(function(c){ return c.id === p.cred; });
    var sede = 'Sin sede';
    if(cred && cred.concesionarioId){
      var conc = (S.concesionarios||[]).find(function(c){ return c.id === cred.concesionarioId; });
      sede = conc ? conc.nombre : 'Sin sede';
    }
    if(!pagosPorSedeMap[sede]) pagosPorSedeMap[sede] = {sede:sede, total:0, count:0};
    pagosPorSedeMap[sede].total += parseFloat(p.monto)||0;
    pagosPorSedeMap[sede].count++;
  });
  var pagosPorSede = Object.values(pagosPorSedeMap).sort(function(a,b){ return b.total - a.total; });

  // ─── FACTURAS EMITIDAS ───
  var facturasMes = (S.facturas||[]).filter(function(f){
    return !f.anulada && f.fechaEmision && String(f.fechaEmision).startsWith(mesAct);
  });
  var facturasAnuladas = (S.facturas||[]).filter(function(f){
    return f.anulada && f.fechaAnulacion && String(f.fechaAnulacion).startsWith(mesAct);
  }).length;

  var mesNombre = hoy.toLocaleDateString('es-VE',{month:'long',year:'numeric'});
  var fmtUsd = function(n){ return '$' + (Math.round(n)||0).toLocaleString('en-US'); };
  var fmtFecha = function(s){ if(!s) return '—'; try { return new Date(s).toLocaleDateString('es-VE',{day:'2-digit',month:'short'}); } catch(e){ return s; } };

  return {
    mes: mesNombre,
    mesAct: mesAct,
    cobradoMesAct: cobradoMesAct,
    cobradoMesAnt: cobradoMesAnt,
    pctCrec: pctCrec,
    cartera: cartera,
    creditosActivos: creditosActivos,
    creditosCompletados: creditosCompletados,
    creditosNuevos: creditosNuevos,
    montoCreditosNuevos: montoCreditosNuevos,
    creditosNuevosArr: creditosNuevosArr,
    enMora: enMora,
    moraGraves: moraGraves,
    moraLeves: moraLeves,
    topCobradores: topCobradores,
    topClientes: topClientes,
    clientesNuevos: clientesNuevos,
    clientesTotales: clientesTotales,
    leadsWeb: leadsWeb,
    pagosMesAct: pagosMesAct,
    pagosCount: pagosMesAct.length,
    iniciales: iniciales,
    cuotas: cuotas,
    totalIniciales: totalIniciales,
    totalCuotas: totalCuotas,
    egresosMesAct: egresosMesAct,
    totalEgresos: totalEgresos,
    egresosListados: egresosListados,
    utilidad: utilidad,
    motosDisponibles: motosDisponibles,
    motosVendidas: motosVendidas,
    motosTotal: motosTotal,
    pagosPorSede: pagosPorSede,
    facturasMes: facturasMes,
    facturasAnuladas: facturasAnuladas,
    fmtUsd: fmtUsd,
    fmtFecha: fmtFecha
  };
}

function reporteMensualHtml(){
  var r = generarReporteMensual();
  if(!r) return '<p>No hay datos para generar reporte.</p>';
  var emp = (typeof getEmpresa==='function') ? getEmpresa() : {nombre:'Pagasi'};

  // Helpers para tablas
  function trEmpty(cols, msg){ return '<tr><td colspan="'+cols+'" style="padding:18px;text-align:center;color:#9ca3af;font-style:italic;font-size:12px">'+msg+'</td></tr>'; }
  function thStyle(extra){ return 'padding:10px 12px;border-bottom:2px solid #e5e7eb;text-align:left;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;font-weight:800;background:#f9fafb;'+(extra||''); }
  function tdStyle(extra){ return 'padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:12.5px;color:#374151;'+(extra||''); }

  // Tablas
  var trCobradores = r.topCobradores.length ? r.topCobradores.map(function(c,i){
    return '<tr><td style="'+tdStyle()+'">'+(i+1)+'</td>'
      +'<td style="'+tdStyle('font-weight:700;color:#111')+'">'+c.nombre+'</td>'
      +'<td style="'+tdStyle('text-align:right;font-family:ui-monospace,monospace;color:#16a34a;font-weight:800')+'">'+r.fmtUsd(c.total)+'</td>'
      +'<td style="'+tdStyle('text-align:right;color:#9ca3af')+'">'+c.count+'</td></tr>';
  }).join('') : trEmpty(4,'Sin cobros registrados este mes');

  var trClientes = r.topClientes.length ? r.topClientes.map(function(c,i){
    return '<tr><td style="'+tdStyle()+'">'+(i+1)+'</td>'
      +'<td style="'+tdStyle('font-weight:700;color:#111')+'">'+c.nombre+'</td>'
      +'<td style="'+tdStyle('text-align:right;font-family:ui-monospace,monospace;color:#16a34a;font-weight:800')+'">'+r.fmtUsd(c.total)+'</td>'
      +'<td style="'+tdStyle('text-align:right;color:#9ca3af')+'">'+c.count+'</td></tr>';
  }).join('') : trEmpty(4,'Sin clientes que hayan pagado este mes');

  var trCreditosNuevos = r.creditosNuevosArr.length ? r.creditosNuevosArr.slice(0,15).map(function(c){
    return '<tr><td style="'+tdStyle('font-family:ui-monospace,monospace;color:#6b7280')+'">'+(c.id||'—')+'</td>'
      +'<td style="'+tdStyle('font-weight:700;color:#111')+'">'+(c.cli||'—')+'</td>'
      +'<td style="'+tdStyle()+'">'+(c.modelo||'—')+'</td>'
      +'<td style="'+tdStyle('text-align:right;font-family:ui-monospace,monospace;font-weight:700')+'">'+r.fmtUsd(c.precio)+'</td>'
      +'<td style="'+tdStyle('text-align:right;font-family:ui-monospace,monospace;color:#2563EB;font-weight:700')+'">'+r.fmtUsd(c.cuotaQ||c.cuota||0)+'</td>'
      +'<td style="'+tdStyle('text-align:center;color:#6b7280;font-size:11.5px')+'">'+r.fmtFecha(c.fecha)+'</td></tr>';
  }).join('') : trEmpty(6,'Sin créditos nuevos este mes');

  var trMora = r.enMora.length ? r.enMora.slice(0,20).map(function(c){
    var moraColor = (c.mora||0) > 30 ? '#dc2626' : (c.mora||0) > 15 ? '#ea580c' : '#ca8a04';
    return '<tr><td style="'+tdStyle('font-family:ui-monospace,monospace;color:#6b7280')+'">'+(c.id||'—')+'</td>'
      +'<td style="'+tdStyle('font-weight:700;color:#111')+'">'+(c.cli||'—')+'</td>'
      +'<td style="'+tdStyle()+'">'+(c.modelo||'—')+'</td>'
      +'<td style="'+tdStyle('text-align:center;font-family:ui-monospace,monospace;font-weight:900;color:'+moraColor)+'">'+c.mora+'d</td>'
      +'<td style="'+tdStyle('text-align:right;font-family:ui-monospace,monospace;font-weight:700')+'">'+r.fmtUsd(c.cuotaQ||c.cuota||0)+'</td></tr>';
  }).join('') : trEmpty(5,'Sin clientes en mora 🎉');

  var trIngresos = r.pagosMesAct.length ? r.pagosMesAct.slice(0,20).map(function(p){
    var tipo = (p.esInicial || p.tipoOperacion === 'inicial_credito') ? 'Inicial' : 'Cuota';
    var tipoColor = tipo === 'Inicial' ? '#2563EB' : '#16a34a';
    return '<tr><td style="'+tdStyle('color:#6b7280;font-size:11.5px')+'">'+r.fmtFecha(p.fecha)+'</td>'
      +'<td style="'+tdStyle('font-weight:700;color:#111')+'">'+(p.cli||'—')+'</td>'
      +'<td style="'+tdStyle('font-family:ui-monospace,monospace;color:#6b7280;font-size:11px')+'">'+(p.cred||'—')+'</td>'
      +'<td style="'+tdStyle()+'"><span style="background:'+tipoColor+'18;color:'+tipoColor+';padding:2px 8px;border-radius:50px;font-size:10.5px;font-weight:700">'+tipo+'</span></td>'
      +'<td style="'+tdStyle('text-align:right;font-family:ui-monospace,monospace;font-weight:800;color:#16a34a')+'">+'+r.fmtUsd(p.monto)+'</td></tr>';
  }).join('') : trEmpty(5,'Sin pagos registrados este mes');

  var trEgresos = r.egresosMesAct.length ? r.egresosMesAct.slice(0,15).map(function(e){
    return '<tr><td style="'+tdStyle('color:#6b7280;font-size:11.5px')+'">'+r.fmtFecha(e.fecha)+'</td>'
      +'<td style="'+tdStyle('font-weight:700;color:#111')+'">'+(e.concepto||e.descripcion||'—')+'</td>'
      +'<td style="'+tdStyle('color:#6b7280;font-size:11.5px')+'">'+(e.categoria||'Sin categoría')+'</td>'
      +'<td style="'+tdStyle('text-align:right;font-family:ui-monospace,monospace;font-weight:800;color:#dc2626')+'">-'+r.fmtUsd(e.monto)+'</td></tr>';
  }).join('') : trEmpty(4,'Sin egresos registrados este mes');

  var trEgresosCat = r.egresosListados.length ? r.egresosListados.map(function(e){
    return '<tr><td style="'+tdStyle('font-weight:700;color:#111')+'">'+e.cat+'</td>'
      +'<td style="'+tdStyle('text-align:right;color:#9ca3af')+'">'+e.count+'</td>'
      +'<td style="'+tdStyle('text-align:right;font-family:ui-monospace,monospace;font-weight:800;color:#dc2626')+'">'+r.fmtUsd(e.total)+'</td></tr>';
  }).join('') : trEmpty(3,'Sin egresos');

  var trSedes = r.pagosPorSede.length ? r.pagosPorSede.map(function(s){
    return '<tr><td style="'+tdStyle('font-weight:700;color:#111')+'">'+s.sede+'</td>'
      +'<td style="'+tdStyle('text-align:right;color:#9ca3af')+'">'+s.count+'</td>'
      +'<td style="'+tdStyle('text-align:right;font-family:ui-monospace,monospace;font-weight:800;color:#16a34a')+'">'+r.fmtUsd(s.total)+'</td></tr>';
  }).join('') : trEmpty(3,'Sin pagos por sede');

  // Sección reusable
  function seccion(titulo, sub, contenido){
    return '<div style="margin-bottom:28px"><div style="display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid #e5e7eb;padding-bottom:8px;margin-bottom:14px">'
      +'<h2 style="font-size:17px;font-weight:800;color:#111;margin:0;letter-spacing:-.3px">'+titulo+'</h2>'
      +(sub?'<div style="font-size:11px;color:#9ca3af;font-weight:600">'+sub+'</div>':'')+'</div>'
      +contenido+'</div>';
  }

  return ''
    +'<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;max-width:880px;margin:0 auto;color:#1f2937;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.06)">'

    // Header
    +'<div style="background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 50%,#1E3A8A 100%);color:#fff;padding:38px 40px">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap">'
        +'<div><div style="font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;opacity:.85;margin-bottom:8px">Reporte mensual completo</div>'
        +'<h1 style="font-size:36px;font-weight:900;margin:0;letter-spacing:-1.2px;text-transform:capitalize;line-height:1.05">'+r.mes+'</h1>'
        +'<div style="font-size:13px;opacity:.85;margin-top:10px">'+(emp.nombre||'Pagasi')+(emp.rif?' · RIF '+emp.rif:'')+' · Generado el '+new Date().toLocaleDateString('es-VE',{day:'numeric',month:'long',year:'numeric'})+' a las '+new Date().toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'})+'</div></div>'
        +'<div style="background:rgba(255,255,255,.18);backdrop-filter:blur(8px);border-radius:11px;padding:14px 18px;text-align:right;min-width:160px">'
          +'<div style="font-size:10px;font-weight:700;opacity:.85;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Utilidad neta</div>'
          +'<div style="font-size:26px;font-weight:900;letter-spacing:-.5px;font-family:ui-monospace,monospace;color:'+(r.utilidad>=0?'#86efac':'#fecaca')+'">'+r.fmtUsd(r.utilidad)+'</div>'
          +'<div style="font-size:10.5px;opacity:.85;margin-top:3px">Ingresos − Egresos</div>'
        +'</div>'
      +'</div>'
    +'</div>'

    // Body
    +'<div style="padding:36px 40px">'

      // ─── 1. RESUMEN EJECUTIVO ───
      +seccion('Resumen financiero','Visión general del mes',''
        +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">'
          +'<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:11px;padding:14px"><div style="font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Ingresos</div><div style="font-size:24px;font-weight:900;color:#16a34a;font-family:ui-monospace,monospace">'+r.fmtUsd(r.cobradoMesAct)+'</div><div style="font-size:11px;color:#16a34a;margin-top:3px;font-weight:600">'+r.pagosCount+' pagos · '+(r.pctCrec>=0?'↑ +':'↓ ')+Math.abs(r.pctCrec)+'%</div></div>'
          +'<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:11px;padding:14px"><div style="font-size:10px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Egresos</div><div style="font-size:24px;font-weight:900;color:#dc2626;font-family:ui-monospace,monospace">'+r.fmtUsd(r.totalEgresos)+'</div><div style="font-size:11px;color:#dc2626;margin-top:3px;font-weight:600">'+r.egresosMesAct.length+' transacciones</div></div>'
          +'<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:11px;padding:14px"><div style="font-size:10px;font-weight:700;color:#2563EB;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Cartera activa</div><div style="font-size:24px;font-weight:900;color:#2563EB;font-family:ui-monospace,monospace">'+r.fmtUsd(r.cartera)+'</div><div style="font-size:11px;color:#2563EB;margin-top:3px;font-weight:600">'+r.creditosActivos+' créditos activos</div></div>'
          +'<div style="background:'+(r.enMora.length>0?'#fef2f2':'#f9fafb')+';border:1px solid '+(r.enMora.length>0?'#fecaca':'#e5e7eb')+';border-radius:11px;padding:14px"><div style="font-size:10px;font-weight:700;color:'+(r.enMora.length>0?'#dc2626':'#6b7280')+';text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">En mora</div><div style="font-size:24px;font-weight:900;color:'+(r.enMora.length>0?'#dc2626':'#6b7280')+'">'+r.enMora.length+'</div><div style="font-size:11px;color:'+(r.enMora.length>0?'#dc2626':'#6b7280')+';margin-top:3px;font-weight:600">'+r.moraGraves.length+' graves (+30d)</div></div>'
        +'</div>'

        +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-top:12px">'
          +'<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:11px;padding:13px"><div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em">Créditos nuevos</div><div style="font-size:22px;font-weight:900;color:#111">'+r.creditosNuevos+'</div><div style="font-size:11px;color:#6b7280;font-weight:600">'+r.fmtUsd(r.montoCreditosNuevos)+' financiados</div></div>'
          +'<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:11px;padding:13px"><div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em">Clientes nuevos</div><div style="font-size:22px;font-weight:900;color:#111">'+r.clientesNuevos+'</div><div style="font-size:11px;color:#6b7280;font-weight:600">'+r.leadsWeb+' vinieron por la web</div></div>'
          +'<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:11px;padding:13px"><div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em">Inventario motos</div><div style="font-size:22px;font-weight:900;color:#111">'+r.motosDisponibles+'</div><div style="font-size:11px;color:#6b7280;font-weight:600">de '+r.motosTotal+' totales · '+r.motosVendidas+' vendidas</div></div>'
          +'<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:11px;padding:13px"><div style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em">Facturas SENIAT</div><div style="font-size:22px;font-weight:900;color:#111">'+r.facturasMes.length+'</div><div style="font-size:11px;color:#6b7280;font-weight:600">emitidas · '+r.facturasAnuladas+' anuladas</div></div>'
        +'</div>'

        +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">'
          +'<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:11px;padding:13px"><div style="font-size:10px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Desglose ingresos</div><div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-top:6px"><span>Cuotas regulares</span><span style="font-family:ui-monospace,monospace;color:#059669">'+r.fmtUsd(r.totalCuotas)+' ('+r.cuotas.length+')</span></div><div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-top:4px"><span>Iniciales</span><span style="font-family:ui-monospace,monospace;color:#059669">'+r.fmtUsd(r.totalIniciales)+' ('+r.iniciales.length+')</span></div></div>'
          +'<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:11px;padding:13px"><div style="font-size:10px;font-weight:700;color:#b45309;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Cartera vs mes anterior</div><div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-top:6px"><span>Mes actual</span><span style="font-family:ui-monospace,monospace;color:#b45309">'+r.fmtUsd(r.cobradoMesAct)+'</span></div><div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;margin-top:4px"><span>Mes anterior</span><span style="font-family:ui-monospace,monospace;color:#92400e">'+r.fmtUsd(r.cobradoMesAnt)+'</span></div></div>'
        +'</div>'
      )

      // ─── 2. INGRESOS DETALLADOS ───
      +seccion('Ingresos del mes', 'Pagos confirmados · '+(r.pagosMesAct.length>20?'mostrando 20 de ':'')+r.pagosMesAct.length+' pagos',''
        +'<table style="width:100%;border-collapse:collapse;background:#fff">'
          +'<thead><tr><th style="'+thStyle()+'">Fecha</th><th style="'+thStyle()+'">Cliente</th><th style="'+thStyle()+'">Crédito</th><th style="'+thStyle()+'">Tipo</th><th style="'+thStyle('text-align:right')+'">Monto</th></tr></thead>'
          +'<tbody>'+trIngresos+'</tbody>'
          +(r.pagosMesAct.length>0?'<tfoot><tr><td colspan="4" style="padding:11px 12px;border-top:2px solid #e5e7eb;font-weight:800;color:#111;font-size:13px">TOTAL INGRESOS</td><td style="padding:11px 12px;border-top:2px solid #e5e7eb;text-align:right;font-weight:900;color:#16a34a;font-family:ui-monospace,monospace;font-size:15px">'+r.fmtUsd(r.cobradoMesAct)+'</td></tr></tfoot>':'')
        +'</table>'
      )

      // ─── 3. EGRESOS DETALLADOS ───
      +seccion('Egresos del mes', 'Gastos y salidas · '+(r.egresosMesAct.length>15?'mostrando 15 de ':'')+r.egresosMesAct.length+' egresos',''
        +'<table style="width:100%;border-collapse:collapse;background:#fff;margin-bottom:14px">'
          +'<thead><tr><th style="'+thStyle()+'">Fecha</th><th style="'+thStyle()+'">Concepto</th><th style="'+thStyle()+'">Categoría</th><th style="'+thStyle('text-align:right')+'">Monto</th></tr></thead>'
          +'<tbody>'+trEgresos+'</tbody>'
          +(r.egresosMesAct.length>0?'<tfoot><tr><td colspan="3" style="padding:11px 12px;border-top:2px solid #e5e7eb;font-weight:800;color:#111;font-size:13px">TOTAL EGRESOS</td><td style="padding:11px 12px;border-top:2px solid #e5e7eb;text-align:right;font-weight:900;color:#dc2626;font-family:ui-monospace,monospace;font-size:15px">-'+r.fmtUsd(r.totalEgresos)+'</td></tr></tfoot>':'')
        +'</table>'
        +(r.egresosListados.length?'<div style="background:#f9fafb;border-radius:10px;padding:14px;margin-top:8px"><div style="font-size:11px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Egresos por categoría</div><table style="width:100%;border-collapse:collapse"><thead><tr><th style="'+thStyle()+'">Categoría</th><th style="'+thStyle('text-align:right')+'">#</th><th style="'+thStyle('text-align:right')+'">Total</th></tr></thead><tbody>'+trEgresosCat+'</tbody></table></div>':'')
      )

      // ─── 4. CRÉDITOS NUEVOS ───
      +seccion('Créditos nuevos otorgados', 'Solicitudes aprobadas en '+r.mes.toLowerCase()+' · '+(r.creditosNuevosArr.length>15?'mostrando 15 de ':'')+r.creditosNuevosArr.length,''
        +'<table style="width:100%;border-collapse:collapse">'
          +'<thead><tr><th style="'+thStyle()+'">Crédito</th><th style="'+thStyle()+'">Cliente</th><th style="'+thStyle()+'">Modelo</th><th style="'+thStyle('text-align:right')+'">Precio</th><th style="'+thStyle('text-align:right')+'">Cuota Q.</th><th style="'+thStyle('text-align:center')+'">Inicio</th></tr></thead>'
          +'<tbody>'+trCreditosNuevos+'</tbody>'
        +'</table>'
      )

      // ─── 5. CARTERA EN MORA ───
      +seccion('Cartera en mora', r.enMora.length+' clientes · '+r.moraGraves.length+' graves (+30d)',''
        +'<table style="width:100%;border-collapse:collapse">'
          +'<thead><tr><th style="'+thStyle()+'">Crédito</th><th style="'+thStyle()+'">Cliente</th><th style="'+thStyle()+'">Modelo</th><th style="'+thStyle('text-align:center')+'">Mora</th><th style="'+thStyle('text-align:right')+'">Cuota</th></tr></thead>'
          +'<tbody>'+trMora+'</tbody>'
        +'</table>'
      )

      // ─── 6. TOP COBRADORES ───
      +seccion('Top cobradores', 'Ranking del equipo en '+r.mes.toLowerCase(),''
        +'<table style="width:100%;border-collapse:collapse">'
          +'<thead><tr><th style="'+thStyle('width:40px')+'">#</th><th style="'+thStyle()+'">Cobrador</th><th style="'+thStyle('text-align:right')+'">Cobrado</th><th style="'+thStyle('text-align:right')+'"># Pagos</th></tr></thead>'
          +'<tbody>'+trCobradores+'</tbody>'
        +'</table>'
      )

      // ─── 7. TOP CLIENTES ───
      +seccion('Top 10 clientes (más pagaron)', 'Quiénes aportaron más este mes',''
        +'<table style="width:100%;border-collapse:collapse">'
          +'<thead><tr><th style="'+thStyle('width:40px')+'">#</th><th style="'+thStyle()+'">Cliente</th><th style="'+thStyle('text-align:right')+'">Aportado</th><th style="'+thStyle('text-align:right')+'"># Pagos</th></tr></thead>'
          +'<tbody>'+trClientes+'</tbody>'
        +'</table>'
      )

      // ─── 8. POR SEDE ───
      +(r.pagosPorSede.length>1 ? seccion('Cobranza por sede', 'Distribución del cobro por concesionario',''
        +'<table style="width:100%;border-collapse:collapse">'
          +'<thead><tr><th style="'+thStyle()+'">Sede</th><th style="'+thStyle('text-align:right')+'"># Pagos</th><th style="'+thStyle('text-align:right')+'">Total</th></tr></thead>'
          +'<tbody>'+trSedes+'</tbody>'
        +'</table>'
      ) : '')

      +'<div style="background:linear-gradient(135deg,#f9fafb,#eff6ff);border-radius:11px;padding:18px;margin-top:24px;border:1px solid #e5e7eb"><div style="font-size:11px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px">Notas del reporte</div><div style="font-size:12px;color:#6b7280;line-height:1.7">Este reporte se genera automáticamente desde el admin Pagasi V2 con datos en tiempo real de Firestore. Las tablas detalladas se limitan a los primeros registros más relevantes. Para análisis completo, exporta los datos crudos desde cada módulo. El reporte refleja datos del concesionario activo en el filtro de sede.</div></div>'

    +'</div>'

    +'<div style="padding:20px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:11px">'+
      (emp.nombre||'Pagasi')+' · Sistema Pagasi V2 · '+new Date().toLocaleDateString('es-VE',{day:'numeric',month:'long',year:'numeric'})+'</div>'
  +'</div>';
}

function reporteMensualAbrir(){
  var win = window.open('', '_blank');
  if(!win){ if(typeof toast==='function') toast('Habilita popups para ver el reporte','error'); return; }
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte mensual</title></head><body style="background:#f3f4f6;padding:24px 0;margin:0">'
    +reporteMensualHtml()
    +'<div style="max-width:680px;margin:18px auto 0;text-align:center;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;font-family:-apple-system,sans-serif">'
      +'<button onclick="window.print()" style="background:#2563EB;color:#fff;border:none;padding:12px 24px;border-radius:10px;font-weight:700;cursor:pointer;font-size:13px">Imprimir / PDF</button>'
      +'<button onclick="window.close()" style="background:#fff;color:#374151;border:1px solid #d1d5db;padding:12px 24px;border-radius:10px;font-weight:700;cursor:pointer;font-size:13px">Cerrar</button>'
    +'</div>'
    +'</body></html>';
  win.document.write(html);
  win.document.close();
}

function reporteMensualEnviarEmail(){
  var r = generarReporteMensual();
  if(!r){ if(typeof toast==='function') toast('Sin datos para reporte','error'); return; }
  var emp = (typeof getEmpresa==='function') ? getEmpresa() : {nombre:'Pagasi',email:''};
  var emailDest = prompt('¿A qué email enviar el reporte de '+r.mes+'?', emp.email || '');
  if(!emailDest) return;

  var subject = 'Reporte mensual Pagasi — ' + r.mes;
  var body = '═══════════════════════════════════════\n'
    + 'REPORTE MENSUAL · ' + r.mes.toUpperCase() + '\n'
    + (emp.nombre || 'Pagasi') + '\n'
    + '═══════════════════════════════════════\n\n'
    + 'RESUMEN FINANCIERO\n'
    + '──────────────────\n'
    + 'Cobrado este mes:    ' + r.fmtUsd(r.cobradoMesAct) + ' (' + r.pagosCount + ' pagos)\n'
    + 'Mes anterior:        ' + r.fmtUsd(r.cobradoMesAnt) + '\n'
    + 'Crecimiento:         ' + (r.pctCrec>=0?'+':'') + r.pctCrec + '%\n'
    + 'Cartera activa:      ' + r.fmtUsd(r.cartera) + '\n'
    + 'Créditos activos:    ' + r.creditosActivos + '\n\n'
    + 'COBRANZA\n'
    + '────────\n'
    + 'Clientes en mora:    ' + r.enMora + '\n'
    + 'Mora grave (+30d):   ' + r.moraGraves + '\n\n'
    + 'CRECIMIENTO\n'
    + '───────────\n'
    + 'Créditos nuevos:     ' + r.creditosNuevos + '\n'
    + 'Clientes nuevos:     ' + r.clientesNuevos + '\n'
    + 'Leads web:           ' + r.leadsWeb + '\n\n'
    + 'TOP COBRADORES\n'
    + '──────────────\n'
    + (r.topCobradores.length
        ? r.topCobradores.map(function(c,i){ return (i+1) + '. ' + c.nombre + ' — ' + r.fmtUsd(c.total) + ' (' + c.count + ' pagos)'; }).join('\n')
        : 'Sin cobros este mes')
    + '\n\n'
    + '───────────────────────────────────────\n'
    + 'Generado: ' + new Date().toLocaleString('es-VE') + '\n'
    + 'Sistema: Pagasi V2 · https://pagasi.io';

  var mailto = 'mailto:' + encodeURIComponent(emailDest)
    + '?subject=' + encodeURIComponent(subject)
    + '&body=' + encodeURIComponent(body);
  window.location.href = mailto;
}

// ══════════════════════════════════════════════════════════════
// REPORTES PERIÓDICOS — diario · semanal · quincenal · mensual · anual
// + búsqueda por día / mes / rango específico
// Documento confidencial profesional: logo azul + marca de agua + Nunito
// ══════════════════════════════════════════════════════════════
var _PAGASI_LOGO_BLUE = 'data:image/png;base64,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';

function generarReportePeriodo(periodo, opts){
  if(!S || !S.creds) return null;
  opts = opts || {};
  periodo = periodo || 'mensual';
  var hoy = new Date();
  var pad = function(n){ return String(n).padStart(2,'0'); };
  var isoLocal = function(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); };
  var dShift = function(b,days){ var d=new Date(b); d.setDate(d.getDate()+days); return d; };
  var parseISO = function(s){ return new Date(String(s).slice(0,10)+'T12:00:00'); };
  var hoyISO = isoLocal(hoy);
  var startISO, endISO=hoyISO, prevStartISO, prevEndISO, titulo, rangoLabel, lblPeriodo;

  if(periodo==='diario'){
    startISO=hoyISO; endISO=hoyISO; titulo='Reporte Diario'; lblPeriodo='Resumen del día';
    prevStartISO=isoLocal(dShift(hoy,-1)); prevEndISO=prevStartISO;
    rangoLabel=hoy.toLocaleDateString('es-VE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  } else if(periodo==='dia'){
    var f=opts.fecha||hoyISO; var fd=parseISO(f); startISO=f; endISO=f; titulo='Reporte Diario'; lblPeriodo='Día específico';
    prevStartISO=isoLocal(dShift(fd,-1)); prevEndISO=prevStartISO;
    rangoLabel=fd.toLocaleDateString('es-VE',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  } else if(periodo==='semanal'){
    startISO=isoLocal(dShift(hoy,-6)); endISO=hoyISO; titulo='Reporte Semanal'; lblPeriodo='Últimos 7 días';
    prevStartISO=isoLocal(dShift(hoy,-13)); prevEndISO=isoLocal(dShift(hoy,-7));
    rangoLabel=parseISO(startISO).toLocaleDateString('es-VE',{day:'numeric',month:'short'})+' al '+hoy.toLocaleDateString('es-VE',{day:'numeric',month:'short',year:'numeric'});
  } else if(periodo==='quincenal'){
    startISO=isoLocal(dShift(hoy,-14)); endISO=hoyISO; titulo='Reporte Quincenal'; lblPeriodo='Últimos 15 días';
    prevStartISO=isoLocal(dShift(hoy,-29)); prevEndISO=isoLocal(dShift(hoy,-15));
    rangoLabel=parseISO(startISO).toLocaleDateString('es-VE',{day:'numeric',month:'short'})+' al '+hoy.toLocaleDateString('es-VE',{day:'numeric',month:'short',year:'numeric'});
  } else if(periodo==='anual'){
    startISO=hoy.getFullYear()+'-01-01'; endISO=hoyISO; titulo='Reporte Anual'; lblPeriodo='Año en curso';
    prevStartISO=(hoy.getFullYear()-1)+'-01-01'; prevEndISO=(hoy.getFullYear()-1)+'-'+pad(hoy.getMonth()+1)+'-'+pad(hoy.getDate());
    rangoLabel='Año '+hoy.getFullYear();
  } else if(periodo==='mes'){
    var mk=opts.mes||hoyISO.slice(0,7); var y=parseInt(mk.slice(0,4),10), m=parseInt(mk.slice(5,7),10)-1;
    startISO=mk+'-01'; endISO=isoLocal(new Date(y,m+1,0)); titulo='Reporte Mensual'; lblPeriodo='Mes específico';
    prevStartISO=isoLocal(new Date(y,m-1,1)); prevEndISO=isoLocal(new Date(y,m,0));
    rangoLabel=new Date(y,m,1).toLocaleDateString('es-VE',{month:'long',year:'numeric'});
  } else if(periodo==='rango'){
    startISO=opts.desde||hoyISO; endISO=opts.hasta||hoyISO;
    if(startISO>endISO){ var tmp=startISO; startISO=endISO; endISO=tmp; }
    titulo='Reporte Personalizado'; lblPeriodo='Rango de fechas';
    var dias=Math.round((parseISO(endISO)-parseISO(startISO))/86400000)+1;
    prevEndISO=isoLocal(dShift(parseISO(startISO),-1)); prevStartISO=isoLocal(dShift(parseISO(startISO),-dias));
    rangoLabel=parseISO(startISO).toLocaleDateString('es-VE',{day:'numeric',month:'short',year:'numeric'})+' al '+parseISO(endISO).toLocaleDateString('es-VE',{day:'numeric',month:'short',year:'numeric'});
  } else {
    periodo='mensual'; startISO=hoyISO.slice(0,8)+'01'; endISO=hoyISO; titulo='Reporte Mensual'; lblPeriodo='Mes en curso';
    var pmm=new Date(hoy.getFullYear(),hoy.getMonth()-1,1);
    prevStartISO=isoLocal(pmm); prevEndISO=isoLocal(new Date(hoy.getFullYear(),hoy.getMonth(),0));
    rangoLabel=hoy.toLocaleDateString('es-VE',{month:'long',year:'numeric'});
  }
  var inW=function(f,a,b){ if(!f) return false; var s=String(f).slice(0,10); return s>=a && s<=b; };
  var num=function(v){ return parseFloat(v)||0; };

  var pagosConf=(S.pagos||[]).filter(function(p){return !p.eliminado&&p.estado==='confirmado';});
  var pagosWin=pagosConf.filter(function(p){return inW(p.fecha,startISO,endISO);});
  var pagosPrev=pagosConf.filter(function(p){return inW(p.fecha,prevStartISO,prevEndISO);});
  var cobrado=pagosWin.reduce(function(a,p){return a+num(p.monto);},0);
  var cobradoPrev=pagosPrev.reduce(function(a,p){return a+num(p.monto);},0);
  var pctCrec=cobradoPrev>0?Math.round((cobrado-cobradoPrev)/cobradoPrev*100):(cobrado>0?100:0);

  var esIni=function(p){return p.esInicial||p.tipoOperacion==='inicial_credito'||(p.concepto&&String(p.concepto).indexOf('Inicial · ')===0);};
  var iniciales=pagosWin.filter(esIni), cuotas=pagosWin.filter(function(p){return !esIni(p);});
  var totalIniciales=iniciales.reduce(function(a,p){return a+num(p.monto);},0);
  var totalCuotas=cuotas.reduce(function(a,p){return a+num(p.monto);},0);

  var egresosWin=(S.egresos||[]).filter(function(e){return !e.eliminado&&inW(e.fecha,startISO,endISO);});
  var totalEgresos=egresosWin.reduce(function(a,e){return a+num(e.monto);},0);
  var egPorCat={};
  egresosWin.forEach(function(e){var cat=e.categoria||e.concepto||'Sin categoría'; if(!egPorCat[cat])egPorCat[cat]={cat:cat,total:0,count:0}; egPorCat[cat].total+=num(e.monto); egPorCat[cat].count++;});
  var egresosListados=Object.keys(egPorCat).map(function(k){return egPorCat[k];}).sort(function(a,b){return b.total-a.total;});

  var utilidad=cobrado-totalEgresos;
  var margen=cobrado>0?Math.round(utilidad/cobrado*100):0;

  var credsActivos=(S.creds||[]).filter(function(c){return !c.eliminado&&c.estado==='activo';});
  var cartera=credsActivos.reduce(function(a,c){var tot=num(c.cuotaQ||c.cuota)*(c.totalCuotas||(c.plazo||0)*2); var pag=num(c.cuotaQ||c.cuota)*(parseInt(c.pagado,10)||0); return a+Math.max(0,tot-pag);},0);
  var enMora=(S.creds||[]).filter(function(c){return !c.eliminado&&c.estado==='activo'&&(parseInt(c.mora,10)||0)>0;}).sort(function(a,b){return (parseInt(b.mora,10)||0)-(parseInt(a.mora,10)||0);});
  var moraGraves=enMora.filter(function(c){return (parseInt(c.mora,10)||0)>30;});
  var tasaMora=credsActivos.length>0?Math.round(enMora.length/credsActivos.length*100):0;

  var creditosNuevosArr=(S.creds||[]).filter(function(c){if(c.eliminado)return false; return inW(c.fecha||c.creadoEn,startISO,endISO);});
  var montoCreditosNuevos=creditosNuevosArr.reduce(function(a,c){return a+num(c.precio);},0);

  var cobMap={}, cliMap={};
  pagosWin.forEach(function(p){
    var cob=p.cobrador||p.realizadoPor||'Sin asignar'; if(!cobMap[cob])cobMap[cob]={nombre:cob,total:0,count:0}; cobMap[cob].total+=num(p.monto); cobMap[cob].count++;
    var cli=p.cli||'Sin nombre'; if(!cliMap[cli])cliMap[cli]={nombre:cli,total:0,count:0}; cliMap[cli].total+=num(p.monto); cliMap[cli].count++;
  });
  var topCobradores=Object.keys(cobMap).map(function(k){return cobMap[k];}).sort(function(a,b){return b.total-a.total;});
  var topClientes=Object.keys(cliMap).map(function(k){return cliMap[k];}).sort(function(a,b){return b.total-a.total;}).slice(0,10);

  var sedeMap={};
  pagosWin.forEach(function(p){var cred=(S.creds||[]).find(function(c){return c.id===p.cred;}); var sede='Sin sede'; if(cred&&cred.concesionarioId){var conc=(S.concesionarios||[]).find(function(c){return c.id===cred.concesionarioId;}); sede=conc?conc.nombre:'Sin sede';} if(!sedeMap[sede])sedeMap[sede]={sede:sede,total:0,count:0}; sedeMap[sede].total+=num(p.monto); sedeMap[sede].count++;});
  var pagosPorSede=Object.keys(sedeMap).map(function(k){return sedeMap[k];}).sort(function(a,b){return b.total-a.total;});

  var clientesNuevos=(S.clientes||[]).filter(function(cl){return !cl.eliminado&&inW(cl.creado,startISO,endISO);}).length;
  var fmtUsd=function(n){return '$'+(Math.round(n)||0).toLocaleString('en-US');};
  var fmtFecha=function(s){if(!s)return '—'; try{return new Date(String(s).slice(0,10)+'T12:00:00').toLocaleDateString('es-VE',{day:'2-digit',month:'short'});}catch(e){return s;}};

  return {periodo:periodo,titulo:titulo,rangoLabel:rangoLabel,lblPeriodo:lblPeriodo,startISO:startISO,endISO:endISO,
    cobrado:cobrado,cobradoPrev:cobradoPrev,pctCrec:pctCrec,totalCuotas:totalCuotas,totalIniciales:totalIniciales,cuotas:cuotas,iniciales:iniciales,
    pagosWin:pagosWin,pagosCount:pagosWin.length,egresosWin:egresosWin,totalEgresos:totalEgresos,egresosListados:egresosListados,
    utilidad:utilidad,margen:margen,cartera:cartera,creditosActivos:credsActivos.length,
    enMora:enMora,moraGraves:moraGraves,tasaMora:tasaMora,creditosNuevosArr:creditosNuevosArr,creditosNuevos:creditosNuevosArr.length,montoCreditosNuevos:montoCreditosNuevos,
    topCobradores:topCobradores,topClientes:topClientes,pagosPorSede:pagosPorSede,clientesNuevos:clientesNuevos,
    fmtUsd:fmtUsd,fmtFecha:fmtFecha};
}

function reportePeriodoHtml(periodo, opts){
  var r = generarReportePeriodo(periodo, opts);
  if(!r) return '<p style="padding:40px;text-align:center;color:#6b7280">No hay datos para generar el reporte.</p>';
  var emp = (typeof getEmpresa==='function') ? getEmpresa() : {nombre:'Pagasi'};
  var nombreEmp = (emp.nombre||'PAGASI');
  var hoy = new Date();
  var genStr = hoy.toLocaleDateString('es-VE',{day:'numeric',month:'long',year:'numeric'})+' · '+hoy.toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'});
  var esc = function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
  var empty=function(c,m){return '<tr><td colspan="'+c+'" class="mut" style="padding:15px;text-align:center;font-style:italic">'+m+'</td></tr>';};
  var sec=function(t,sub,c,keep){return '<div class="rp-sec'+(keep?' keep':'')+'"><div class="rp-sec-h"><h2>'+t+'</h2>'+(sub?'<span class="rp-sub">'+sub+'</span>':'')+'</div>'+c+'</div>';};
  var kpi=function(l,v,s,cls){return '<div class="rp-kpi '+cls+'"><div class="rp-kpi-l">'+l+'</div><div class="rp-kpi-v">'+v+'</div>'+(s?'<div class="rp-kpi-s">'+s+'</div>':'')+'</div>';};
  var delta=(r.pctCrec>=0?'▲ +':'▼ ')+Math.abs(r.pctCrec)+'% vs previo';

  var byFechaAsc=function(a,b){var x=String(a.fecha||a.creadoEn||'').slice(0,10),y=String(b.fecha||b.creadoEn||'').slice(0,10); return x<y?-1:x>y?1:0;};
  var trIng=r.pagosWin.length?r.pagosWin.slice().sort(byFechaAsc).map(function(p){var tp=(p.esInicial||p.tipoOperacion==='inicial_credito')?'Inicial':'Cuota';return '<tr><td class="mut">'+r.fmtFecha(p.fecha)+'</td><td class="b" style="color:#111">'+esc(p.cli||'—')+'</td><td class="mut mono">'+esc(p.cred||'—')+'</td><td><span class="pill '+(tp==='Inicial'?'pill-b':'pill-g')+'">'+tp+'</span></td><td class="r num g">+'+r.fmtUsd(p.monto)+'</td></tr>';}).join(''):empty(5,'Sin pagos en este período');
  var trEg=r.egresosWin.length?r.egresosWin.slice().sort(byFechaAsc).map(function(e){return '<tr><td class="mut">'+r.fmtFecha(e.fecha)+'</td><td class="b" style="color:#111">'+esc(e.concepto||e.descripcion||'—')+'</td><td class="mut">'+esc(e.categoria||'Sin categoría')+'</td><td class="r num rd">-'+r.fmtUsd(e.monto)+'</td></tr>';}).join(''):empty(4,'Sin egresos en este período');
  var trEgCat=r.egresosListados.length?r.egresosListados.map(function(e){return '<tr><td class="b" style="color:#111">'+esc(e.cat)+'</td><td class="r mut">'+e.count+'</td><td class="r num rd">'+r.fmtUsd(e.total)+'</td></tr>';}).join(''):empty(3,'Sin egresos');
  var trCred=r.creditosNuevosArr.length?r.creditosNuevosArr.slice().sort(byFechaAsc).map(function(c){return '<tr><td class="mut mono">'+esc(c.id||'—')+'</td><td class="b" style="color:#111">'+esc(c.cli||'—')+'</td><td>'+esc(c.modelo||'—')+'</td><td class="r num">'+r.fmtUsd(c.precio)+'</td><td class="r num" style="color:#2563EB">'+r.fmtUsd(c.cuotaQ||c.cuota||0)+'</td><td class="c mut">'+r.fmtFecha(c.fecha)+'</td></tr>';}).join(''):empty(6,'Sin créditos nuevos en este período');
  var trMora=r.enMora.length?r.enMora.map(function(c){var mc=(c.mora||0)>30?'#dc2626':(c.mora||0)>15?'#ea580c':'#ca8a04';return '<tr><td class="mut mono">'+esc(c.id||'—')+'</td><td class="b" style="color:#111">'+esc(c.cli||'—')+'</td><td>'+esc(c.modelo||'—')+'</td><td class="c num" style="color:'+mc+'">'+c.mora+'d</td><td class="r num">'+r.fmtUsd(c.cuotaQ||c.cuota||0)+'</td></tr>';}).join(''):empty(5,'Sin clientes en mora');
  var trCob=r.topCobradores.length?r.topCobradores.map(function(c,i){return '<tr><td class="mut">'+(i+1)+'</td><td class="b" style="color:#111">'+esc(c.nombre)+'</td><td class="r num g">'+r.fmtUsd(c.total)+'</td><td class="r mut">'+c.count+'</td></tr>';}).join(''):empty(4,'Sin cobros registrados');
  var trCli=r.topClientes.length?r.topClientes.map(function(c,i){return '<tr><td class="mut">'+(i+1)+'</td><td class="b" style="color:#111">'+esc(c.nombre)+'</td><td class="r num g">'+r.fmtUsd(c.total)+'</td><td class="r mut">'+c.count+'</td></tr>';}).join(''):empty(4,'Sin clientes que pagaron');
  var trSede=r.pagosPorSede.map(function(s){return '<tr><td class="b" style="color:#111">'+esc(s.sede)+'</td><td class="r mut">'+s.count+'</td><td class="r num g">'+r.fmtUsd(s.total)+'</td></tr>';}).join('');

  var tbl=function(head,body){return '<table class="rp-t"><thead><tr>'+head+'</tr></thead><tbody>'+body+'</tbody></table>';};

  return ''
  +'<div class="rp">'
  +'<div class="rp-bar"></div>'
  +'<div class="rp-head">'
    +'<div class="rp-conf">● Confidencial</div>'
    +'<div class="rp-lh"><img class="rp-logo" src="'+_PAGASI_LOGO_BLUE+'" alt="Pagasi"><div class="rp-lh-co"><div class="rp-lh-n">'+esc(nombreEmp)+'</div><div class="rp-lh-s">'+(emp.rif?'RIF '+esc(emp.rif)+' · ':'')+'Reporte financiero interno</div></div></div>'
    +'<div class="rp-title-row"><div><div class="rp-kicker">'+r.lblPeriodo+'</div><h1 class="rp-title">'+r.titulo+'</h1><div class="rp-range">'+esc(r.rangoLabel)+'</div></div>'
      +'<div class="rp-util"><div class="rp-util-l">Utilidad neta</div><div class="rp-util-v" style="color:'+(r.utilidad>=0?'#16a34a':'#dc2626')+'">'+r.fmtUsd(r.utilidad)+'</div><div class="rp-util-s">Margen '+r.margen+'%</div></div></div>'
  +'</div>'
  +'<div class="rp-body">'
    +sec('Resumen financiero','Generado '+genStr,
       '<div class="rp-kpis">'
        +kpi('Ingresos',r.fmtUsd(r.cobrado),r.pagosCount+' pagos · '+delta,'k-g')
        +kpi('Egresos',r.fmtUsd(r.totalEgresos),r.egresosWin.length+' transacciones','k-r')
        +kpi('Utilidad neta',r.fmtUsd(r.utilidad),'Margen '+r.margen+'%',(r.utilidad>=0?'k-g':'k-r'))
        +kpi('Cartera activa',r.fmtUsd(r.cartera),r.creditosActivos+' créditos','k-b')
       +'</div><div class="rp-kpis" style="margin-top:11px">'
        +kpi('Cuotas cobradas',r.fmtUsd(r.totalCuotas),r.cuotas.length+' pagos','k-t')
        +kpi('Iniciales',r.fmtUsd(r.totalIniciales),r.iniciales.length+' pagos','k-b')
        +kpi('Créditos nuevos',String(r.creditosNuevos),r.fmtUsd(r.montoCreditosNuevos)+' financiados · '+r.clientesNuevos+' clientes','k-v')
        +kpi('En mora',String(r.enMora.length),r.moraGraves.length+' graves · '+r.tasaMora+'% tasa',(r.enMora.length>0?'k-r':'k-n'))
       +'</div>', true)
    +sec('Ingresos del período','Pagos confirmados · '+r.pagosWin.length+' pagos',
       tbl('<th>Fecha</th><th>Cliente</th><th>Crédito</th><th>Tipo</th><th class="r">Monto</th>', trIng+(r.pagosWin.length?'<tr class="tot"><td colspan="4">TOTAL INGRESOS</td><td class="r num g">'+r.fmtUsd(r.cobrado)+'</td></tr>':'')))
    +sec('Egresos del período','Gastos · '+r.egresosWin.length+' transacciones',
       tbl('<th>Fecha</th><th>Concepto</th><th>Categoría</th><th class="r">Monto</th>', trEg+(r.egresosWin.length?'<tr class="tot"><td colspan="3">TOTAL EGRESOS</td><td class="r num rd">-'+r.fmtUsd(r.totalEgresos)+'</td></tr>':''))
       +(r.egresosListados.length?'<div class="rp-subcard"><div class="rp-subcard-t">Egresos por categoría</div>'+tbl('<th>Categoría</th><th class="r">#</th><th class="r">Total</th>', trEgCat)+'</div>':''))
    +sec('Créditos nuevos otorgados',String(r.creditosNuevos)+' en el período · '+r.fmtUsd(r.montoCreditosNuevos),
       tbl('<th>Crédito</th><th>Cliente</th><th>Modelo</th><th class="r">Precio</th><th class="r">Cuota Q.</th><th class="c">Inicio</th>', trCred))
    +sec('Cartera en mora',r.enMora.length+' clientes · '+r.moraGraves.length+' graves (+30d) · tasa '+r.tasaMora+'%',
       tbl('<th>Crédito</th><th>Cliente</th><th>Modelo</th><th class="c">Mora</th><th class="r">Cuota</th>', trMora))
    +sec('Top cobradores','Ranking del equipo en el período',
       tbl('<th style="width:36px">#</th><th>Cobrador</th><th class="r">Cobrado</th><th class="r"># Pagos</th>', trCob))
    +sec('Top clientes','Quiénes aportaron más en el período',
       tbl('<th style="width:36px">#</th><th>Cliente</th><th class="r">Aportado</th><th class="r"># Pagos</th>', trCli))
    +(r.pagosPorSede.length>1?sec('Cobranza por sede','Distribución por concesionario',tbl('<th>Sede</th><th class="r"># Pagos</th><th class="r">Total</th>', trSede)):'')
    +'<div class="rp-note"><div class="rp-note-t">Documento confidencial</div><div class="rp-note-b">Este reporte contiene información financiera reservada de '+esc(nombreEmp)+'. Prohibida su divulgación, copia o distribución total o parcial sin autorización. Generado en tiempo real desde el sistema Pagasi; refleja el concesionario activo en el filtro de sede.</div></div>'
  +'</div>'
  +'<div class="rp-foot"><span>'+esc(nombreEmp)+' · '+r.titulo+'</span><span>Confidencial · '+genStr+'</span></div>'
  +'</div>';
}

function reportePeriodoAbrir(periodo, opts){
  var win=window.open('','_blank');
  if(!win){ if(typeof toast==='function') toast('Habilita popups para ver el reporte','error'); return; }
  var titulos={diario:'Reporte Diario',dia:'Reporte Diario',semanal:'Reporte Semanal',quincenal:'Reporte Quincenal',mensual:'Reporte Mensual',mes:'Reporte Mensual',anual:'Reporte Anual',rango:'Reporte Personalizado'};
  var wmSvg="<svg xmlns='http://www.w3.org/2000/svg' width='430' height='320'><text x='215' y='175' transform='rotate(-26 215 160)' font-family='Arial,sans-serif' font-size='30' font-weight='800' fill='rgba(37,99,235,0.07)' text-anchor='middle'>CONFIDENCIAL</text></svg>";
  var wmUrl="data:image/svg+xml;utf8,"+encodeURIComponent(wmSvg);
  var body=reportePeriodoHtml(periodo, opts);
  var css='*{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    +'@page{size:A4;margin:13mm 11mm}'
    +"body{background:#eef1f7;font-family:'Nunito Sans',system-ui,-apple-system,sans-serif;color:#1f2937;-webkit-font-smoothing:antialiased;padding:22px 0}"
    +".rp{max-width:820px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.08);background-image:url('"+wmUrl+"');background-repeat:repeat}"
    +".rp-bar{height:7px;background:linear-gradient(90deg,#1D4ED8 0%,#2563EB 55%,#60A5FA 100%)}"
    +".rp-head{padding:22px 34px 18px;border-bottom:2px solid #1D4ED8;position:relative;background:rgba(255,255,255,.92)}"
    +".rp-conf{position:absolute;top:18px;right:34px;background:#fde8ec;color:#b91c1c;border:1px solid #f5c2cb;font-size:9px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;padding:4px 11px;border-radius:5px}"
    +".rp-lh{display:flex;align-items:center;gap:15px}.rp-logo{height:40px;width:auto;display:block}"
    +".rp-lh-co{border-left:1px solid #d6dbe3;padding-left:15px}.rp-lh-n{font-family:'Nunito',sans-serif;font-size:15px;font-weight:900;color:#1D4ED8}.rp-lh-s{font-size:8.5px;color:#8a93a3;font-weight:700;letter-spacing:.14em;text-transform:uppercase;margin-top:3px}"
    +".rp-title-row{margin-top:15px;display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px}"
    +".rp-kicker{font-size:9.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:#9ca3af}"
    +".rp-title{font-family:'Nunito',sans-serif;font-size:26px;font-weight:900;color:#0f172a;letter-spacing:-.5px;margin:3px 0 0}"
    +".rp-range{font-size:12px;color:#6b7280;margin-top:4px;text-transform:capitalize}"
    +".rp-util{text-align:right}.rp-util-l{font-size:9px;color:#9ca3af;font-weight:700;text-transform:uppercase;letter-spacing:.1em}.rp-util-v{font-family:'Nunito',sans-serif;font-size:25px;font-weight:900;letter-spacing:-.5px}.rp-util-s{font-size:10px;color:#9ca3af;margin-top:1px}"
    +".rp-body{padding:24px 34px 28px}"
    +".rp-sec{margin-bottom:22px}.rp-sec.keep{break-inside:avoid}"
    +".rp-sec-h{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1D4ED8;padding-bottom:6px;margin-bottom:12px;break-after:avoid}"
    +".rp-sec-h h2{font-family:'Nunito',sans-serif;font-size:15px;font-weight:800;color:#1D4ED8}.rp-sub{font-size:10.5px;color:#9ca3af;font-weight:700}"
    +".rp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:11px}"
    +".rp-kpi{border-radius:11px;padding:13px 14px;border:1px solid #e5e7eb}.rp-kpi-l{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.rp-kpi-v{font-family:'Nunito',sans-serif;font-weight:900;font-size:22px;letter-spacing:-.5px;line-height:1;margin-top:5px}.rp-kpi-s{font-size:10px;font-weight:700;margin-top:4px;opacity:.85}"
    +".k-g{background:#f0fdf4;border-color:#bbf7d0}.k-g .rp-kpi-l,.k-g .rp-kpi-v,.k-g .rp-kpi-s{color:#16a34a}"
    +".k-r{background:#fef2f2;border-color:#fecaca}.k-r .rp-kpi-l,.k-r .rp-kpi-v,.k-r .rp-kpi-s{color:#dc2626}"
    +".k-b{background:#eff6ff;border-color:#bfdbfe}.k-b .rp-kpi-l,.k-b .rp-kpi-v,.k-b .rp-kpi-s{color:#2563EB}"
    +".k-t{background:#f0fdfa;border-color:#99f6e4}.k-t .rp-kpi-l,.k-t .rp-kpi-v,.k-t .rp-kpi-s{color:#0f766e}"
    +".k-v{background:#f5f3ff;border-color:#ddd6fe}.k-v .rp-kpi-l,.k-v .rp-kpi-v,.k-v .rp-kpi-s{color:#7c3aed}"
    +".k-n{background:#f9fafb;border-color:#e5e7eb}.k-n .rp-kpi-l,.k-n .rp-kpi-v,.k-n .rp-kpi-s{color:#6b7280}"
    +"table.rp-t{width:100%;border-collapse:collapse}table.rp-t thead{display:table-header-group}"
    +"table.rp-t th{padding:9px 11px;border-bottom:2px solid #e5e7eb;text-align:left;font-size:9.5px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;font-weight:800;background:#f8fafc}"
    +"table.rp-t td{padding:7px 11px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#374151}table.rp-t tr{break-inside:avoid}"
    +"table.rp-t tr.tot td{border-top:2px solid #e5e7eb;border-bottom:none;font-weight:900;color:#111;font-size:13px;padding-top:10px}"
    +".rp-t .r{text-align:right}.rp-t .c{text-align:center}.rp-t .b{font-weight:700}.rp-t .mut{color:#9ca3af}.rp-t .g{color:#16a34a}.rp-t .rd{color:#dc2626}.rp-t .num{font-family:'Nunito',sans-serif;font-weight:800}.rp-t .mono{font-family:'Nunito Sans',monospace;font-size:11px}"
    +".pill{padding:2px 8px;border-radius:50px;font-size:10px;font-weight:800}.pill-g{background:#dcfce7;color:#16a34a}.pill-b{background:#dbeafe;color:#2563EB}"
    +".rp-subcard{background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:13px;margin-top:12px;break-inside:avoid}.rp-subcard-t{font-size:10px;font-weight:800;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}"
    +".rp-note{background:#f8fafc;border:1px solid #e5e7eb;border-left:3px solid #b91c1c;border-radius:10px;padding:14px 16px;margin-top:18px;break-inside:avoid}.rp-note-t{font-size:10px;font-weight:900;color:#b91c1c;text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px}.rp-note-b{font-size:11px;color:#6b7280;line-height:1.6}"
    +".rp-foot{padding:15px 34px;background:#f8fafc;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#9ca3af;font-weight:700;flex-wrap:wrap;gap:6px}"
    +"@media print{body{background:#fff;padding:0}.rp{box-shadow:none;border-radius:0;max-width:none}.rp-actions{display:none!important}}";
  var html='<!DOCTYPE html><html lang="es-VE"><head><meta charset="UTF-8"><title>'+(titulos[periodo]||'Reporte')+' · Pagasi</title>'
    +'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    +'<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">'
    +'<style>'+css+'</style></head><body>'
    +body
    +'<div class="rp-actions" style="max-width:820px;margin:16px auto 0;text-align:center;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;font-family:Nunito Sans,sans-serif">'
      +'<button onclick="window.print()" style="background:#2563EB;color:#fff;border:none;padding:12px 26px;border-radius:10px;font-weight:800;cursor:pointer;font-size:13px">Imprimir / Guardar PDF</button>'
      +'<button onclick="window.close()" style="background:#fff;color:#374151;border:1px solid #d1d5db;padding:12px 24px;border-radius:10px;font-weight:700;cursor:pointer;font-size:13px">Cerrar</button>'
    +'</div></body></html>';
  win.document.write(html); win.document.close();
}
window.reportePeriodoAbrir = reportePeriodoAbrir;

// Auto-iniciar watcher si ya tenía permiso de antes
(function _pushNotifAutoInit(){
  try {
    if(pushNotifState() === 'granted'){
      // Esperar a que S esté cargado
      var checkS = setInterval(function(){
        if(S && S.creds && S.clientes){
          clearInterval(checkS);
          pushNotifIniciarWatcher();
        }
      }, 1500);
    }
  } catch(e){}
})();

// ─── COTILLÓN / CONFETTI (canvas + card centrada cerrable) ───
function dispararCotillon(nombre, esTeammate, genero){
  cerrarCotillon();
  // Inject animation styles
  if(!document.getElementById('cotillon-styles')){
    var s = document.createElement('style');
    s.id = 'cotillon-styles';
    s.textContent = '@keyframes cotIn{0%{transform:translate(-50%,-50%) scale(.7);opacity:0}55%{transform:translate(-50%,-50%) scale(1.05);opacity:1}100%{transform:translate(-50%,-50%) scale(1)}}@keyframes cotBackdrop{0%{opacity:0}100%{opacity:1}}@keyframes cotCake{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-6px) rotate(2deg)}}@keyframes cotShine{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}';
    document.head.appendChild(s);
  }
  // Tomar el logo Pagasi del sidebar (mismo base64 que ya está cargado)
  var _logoEl = document.querySelector('.sb-logo img');
  var _logoSrc = (_logoEl && _logoEl.src) ? _logoEl.src : '';
  // Paleta de colores según género
  var g = String(genero||'').toLowerCase();
  var isMale = (g === 'm' || g === 'masculino' || g === 'hombre');
  var isFemale = (g === 'f' || g === 'femenino' || g === 'mujer');
  // Default = rosado (neutral), si es hombre → azul
  var palette = isMale ? {
    bgCard:   'linear-gradient(145deg,#F0F9FF 0%,#DBEAFE 50%,#E0E7FF 100%)',
    shadow:   '0 30px 80px rgba(59,130,246,.32),0 0 0 1px rgba(255,255,255,.6)',
    tag:      '#1E40AF', titulo:'#1E3A8A', subtitulo:'#1D4ED8',
    closeCol: '#1E3A8A',
    btn:      'linear-gradient(135deg,#3B82F6,#1D4ED8)',
    btnShadow:'0 8px 22px rgba(59,130,246,.42)',
    // Filtro para tintar el logo Pagasi de azul (original es violeta)
    logoFilter:'brightness(0) saturate(100%) invert(20%) sepia(96%) saturate(2300%) hue-rotate(217deg) brightness(95%) contrast(98%) drop-shadow(0 6px 14px rgba(0,0,0,.18))'
  } : {
    bgCard:   'linear-gradient(145deg,#FFF7ED 0%,#FCE7F3 50%,#F3E8FF 100%)',
    shadow:   '0 30px 80px rgba(236,72,153,.32),0 0 0 1px rgba(255,255,255,.6)',
    tag:      '#BE185D', titulo:'#831843', subtitulo:'#9D174D',
    closeCol: '#831843',
    btn:      'linear-gradient(135deg,#EC4899,#BE185D)',
    btnShadow:'0 8px 22px rgba(236,72,153,.42)',
    // Filtro para tintar el logo de rosa fuerte
    logoFilter:'brightness(0) saturate(100%) invert(24%) sepia(92%) saturate(3500%) hue-rotate(316deg) brightness(94%) contrast(96%) drop-shadow(0 6px 14px rgba(0,0,0,.15))'
  };

  // Backdrop oscuro
  var backdrop = document.createElement('div');
  backdrop.id = 'cotillon-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:99998;animation:cotBackdrop .4s ease forwards';
  backdrop.onclick = cerrarCotillon;
  document.body.appendChild(backdrop);

  // Canvas confetti
  var canvas = document.createElement('canvas');
  canvas.id = 'cotillon-canvas';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d');
  var colors = ['#EC4899','#F97316','#FACC15','#22C55E','#3B82F6','#A855F7','#EF4444','#06B6D4','#FB923C','#84CC16'];
  var partis = [];
  function rafaga(originX, originY, vx0, vy0, cantidad){
    for(var i=0;i<cantidad;i++){
      partis.push({
        x: originX, y: originY,
        vx: vx0 + (Math.random()-.5)*4,
        vy: vy0 + (Math.random()-.5)*3 - 2,
        size: 6 + Math.random()*8,
        color: colors[Math.floor(Math.random()*colors.length)],
        rot: Math.random()*Math.PI*2,
        vrot: (Math.random()-.5)*.3,
        shape: ['sq','cr','st'][Math.floor(Math.random()*3)],
        life: 1
      });
    }
  }
  rafaga(canvas.width*.15, canvas.height*.75, 5, -10, 100);
  rafaga(canvas.width*.85, canvas.height*.75, -5, -10, 100);
  setTimeout(function(){ rafaga(canvas.width*.5, canvas.height*.9, 0, -12, 120); }, 300);
  setTimeout(function(){ rafaga(canvas.width*.3, canvas.height*.65, 2, -8, 70); }, 700);
  setTimeout(function(){ rafaga(canvas.width*.7, canvas.height*.65, -2, -8, 70); }, 800);

  // Card centrada con mensaje
  var who = nombre || (typeof S !== 'undefined' && S.currentUser && S.currentUser.nombre) || '';
  // Capitalizar primer nombre por si lo guardaron en minúsculas
  function _cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1).toLowerCase() : s; }
  var primerNombre = who ? _cap(who.split(' ')[0]) : '';
  who = who.split(/\s+/).map(_cap).join(' ');
  // Si es cumpleaños de un COMPAÑERO (no del usuario logueado), cambia el copy
  var _tagline, _titulo, _subtitulo, _btnTxt;
  if(esTeammate){
    _tagline = 'Cumpleaños del equipo';
    _titulo = '¡Hoy cumple años '+(who||'tu compañero/a')+'!';
    _subtitulo = 'No olvides felicitar a '+(primerNombre||'tu compañero/a')+'. Un mensaje rápido por WhatsApp hace el día.';
    _btnTxt = '¡A celebrar!';
  } else {
    _tagline = 'Cumpleaños';
    _titulo = '¡Feliz cumpleaños'+(primerNombre?', '+primerNombre:'')+'!';
    _subtitulo = 'Que este nuevo año te traiga muchos cobros puntuales, clientes satisfechos y motos vendidas. Todo el equipo Pagasi te desea lo mejor.';
    _btnTxt = '¡Gracias, a trabajar!';
  }
  var card = document.createElement('div');
  card.id = 'cotillon-card';
  card.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100000;background:'+palette.bgCard+';border-radius:32px;padding:0;width:90%;max-width:520px;box-shadow:'+palette.shadow+';animation:cotIn .6s cubic-bezier(.34,1.56,.64,1) forwards;overflow:hidden';
  // Logo Pagasi (caballito/pegaso) en lugar de torta — tintado según género
  var logoHTML = _logoSrc
    ? '<div style="margin-bottom:14px;animation:cotCake 2s ease-in-out infinite;display:flex;justify-content:center"><img src="'+_logoSrc+'" alt="Pagasi" style="width:96px;height:auto;filter:'+palette.logoFilter+'"></div>'
    : '<div style="font-size:82px;line-height:1;margin-bottom:14px;animation:cotCake 2s ease-in-out infinite">🐎</div>';
  card.innerHTML = ''
    +'<div style="position:relative;padding:48px 32px 40px;text-align:center;overflow:hidden">'
      +'<div style="position:absolute;inset:0;background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,.7) 50%,transparent 70%);animation:cotShine 2.5s ease-in-out infinite;pointer-events:none"></div>'
      +'<button onclick="cerrarCotillon()" style="position:absolute;top:14px;right:14px;width:34px;height:34px;border:none;background:rgba(255,255,255,.7);border-radius:50%;cursor:pointer;font-size:18px;font-weight:700;color:'+palette.closeCol+';display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);box-shadow:0 4px 12px rgba(0,0,0,.08);z-index:2" aria-label="Cerrar">×</button>'
      +logoHTML
      +'<div style="font-size:11px;font-weight:800;letter-spacing:.32em;text-transform:uppercase;color:'+palette.tag+';margin-bottom:10px">'+_tagline+'</div>'
      +'<div style="font-size:32px;font-weight:900;color:'+palette.titulo+';letter-spacing:-1.2px;line-height:1.1;margin-bottom:8px">'+_titulo+'</div>'
      +'<div style="font-size:14.5px;color:'+palette.subtitulo+';font-weight:500;line-height:1.55;max-width:380px;margin:0 auto 22px">'+_subtitulo+'</div>'
      +'<button onclick="cerrarCotillon()" style="background:'+palette.btn+';color:#fff;border:none;padding:13px 32px;border-radius:50px;font-weight:800;font-size:14px;cursor:pointer;letter-spacing:.02em;box-shadow:'+palette.btnShadow+';transition:transform .15s">'+_btnTxt+'</button>'
    +'</div>';
  document.body.appendChild(card);

  // Animar partículas
  var gravity = 0.18, drag = 0.992;
  var startTs = Date.now();
  function drawStar(cx, cy, size){
    ctx.beginPath();
    for(var i=0;i<5;i++){
      var ang = (Math.PI*2*i)/5 - Math.PI/2;
      var ang2 = ang + Math.PI/5;
      ctx.lineTo(cx + Math.cos(ang)*size, cy + Math.sin(ang)*size);
      ctx.lineTo(cx + Math.cos(ang2)*size*.5, cy + Math.sin(ang2)*size*.5);
    }
    ctx.closePath();
    ctx.fill();
  }
  function frame(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    var alive = 0;
    for(var i=0;i<partis.length;i++){
      var p = partis[i];
      if(p.life <= 0) continue;
      alive++;
      p.vx *= drag; p.vy = p.vy*drag + gravity;
      p.x += p.vx; p.y += p.vy;
      p.rot += p.vrot;
      var elapsed = (Date.now() - startTs) / 1000;
      p.life = Math.max(0, 1 - elapsed/6);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      if(p.shape === 'sq'){ ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size); }
      else if(p.shape === 'st'){ drawStar(0, 0, p.size/2); }
      else { ctx.beginPath(); ctx.arc(0, 0, p.size/2, 0, Math.PI*2); ctx.fill(); }
      ctx.restore();
    }
    if(document.getElementById('cotillon-canvas') && alive > 0 && (Date.now() - startTs) < 8000){
      requestAnimationFrame(frame);
    } else {
      if(canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
  }
  requestAnimationFrame(frame);

  // Listener para Escape cierra el card
  document.addEventListener('keydown', _cotillonEsc);
}

function _cotillonEsc(e){
  if(e.key === 'Escape') cerrarCotillon();
}

function cerrarCotillon(){
  ['cotillon-card','cotillon-backdrop','cotillon-canvas'].forEach(function(id){
    var el = document.getElementById(id);
    if(el && el.parentNode) el.parentNode.removeChild(el);
  });
  document.removeEventListener('keydown', _cotillonEsc);
}

// ─── EDITAR MI PERFIL (cumpleaños, nombre, teléfono) ───
function profProfileChanged(){
  var btn = document.getElementById('prof-save-btn');
  if(btn) btn.style.display = 'inline-flex';
}

// ─── BIENVENIDA: pide datos si el perfil está incompleto ───
function chequearPerfilIncompleto(){
  try {
    if(!S.currentUser || !S.currentUser.uid) return;
    var u = S.currentUser;
    // Campos que consideramos "imprescindibles" para que el perfil esté completo.
    // Las redes sociales se piden "al menos una".
    var faltantes = [];
    if(!u.cedula) faltantes.push('Cédula');
    if(!u.genero) faltantes.push('Género');
    if(!u.cumpleanos && !u.fechaNacimiento) faltantes.push('Cumpleaños');
    if(!u.tel && !u.telefono) faltantes.push('Teléfono');
    if(!u.direccion) faltantes.push('Dirección');
    if(!u.emergencia) faltantes.push('Contacto de emergencia');
    var algunaRed = !!(u.instagram || u.facebook || u.tiktok || u.twitter || u.linkedin);
    if(!algunaRed) faltantes.push('Al menos una red social');
    if(!faltantes.length) return; // perfil completo, no molestamos
    // Anti-spam: no mostrar más de una vez por día por usuario
    var hoy = new Date().toISOString().slice(0,10);
    var lsKey = '_perfilNagDismissed_'+u.uid+'_'+hoy;
    try { if(localStorage.getItem(lsKey)) return; } catch(e){}
    // Construir y mostrar el modal de bienvenida
    setTimeout(function(){ _mostrarBienvenidaPerfil(faltantes, lsKey); }, 1200);
  } catch(e){ console.warn('chequearPerfilIncompleto:', e); }
}

function _mostrarBienvenidaPerfil(faltantes, lsKey){
  if(document.getElementById('welcome-perfil-card')) return;
  // Inyectar estilos si no existen
  if(!document.getElementById('welcome-perfil-styles')){
    var s = document.createElement('style');
    s.id = 'welcome-perfil-styles';
    s.textContent = '@keyframes wpIn{0%{transform:translate(-50%,-50%) scale(.9);opacity:0}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}@keyframes wpBack{0%{opacity:0}100%{opacity:1}}';
    document.head.appendChild(s);
  }
  var nombre = (S.currentUser && S.currentUser.nombre) ? S.currentUser.nombre.split(' ')[0] : '';
  function _cap(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1).toLowerCase() : s; }
  nombre = _cap(nombre||'');

  // Backdrop
  var backdrop = document.createElement('div');
  backdrop.id = 'welcome-perfil-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:99998;animation:wpBack .3s ease forwards';
  document.body.appendChild(backdrop);

  // Logo Pagasi
  var _logoEl = document.querySelector('.sb-logo img');
  var _logoSrc = (_logoEl && _logoEl.src) ? _logoEl.src : '';
  var logoHTML = _logoSrc
    ? '<img src="'+_logoSrc+'" alt="Pagasi" style="width:64px;height:auto;margin:0 auto 14px;display:block;filter:brightness(0) saturate(100%) invert(20%) sepia(96%) saturate(2300%) hue-rotate(217deg) brightness(95%) contrast(98%) drop-shadow(0 4px 10px rgba(0,0,0,.12))">'
    : '<div style="font-size:48px;text-align:center;margin-bottom:14px">🐎</div>';

  // Lista de faltantes
  var faltantesList = faltantes.map(function(f){
    return '<li style="display:flex;align-items:center;gap:9px;padding:7px 0;color:var(--ink2);font-size:13px;font-weight:600"><span style="width:6px;height:6px;border-radius:50%;background:var(--p1);flex-shrink:0"></span>'+f+'</li>';
  }).join('');

  var card = document.createElement('div');
  card.id = 'welcome-perfil-card';
  card.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100000;background:#fff;border-radius:24px;padding:0;width:90%;max-width:480px;box-shadow:0 30px 80px rgba(37,99,235,.25),0 0 0 1px rgba(255,255,255,.6);animation:wpIn .4s cubic-bezier(.34,1.56,.64,1) forwards;overflow:hidden';
  card.innerHTML = ''
    +'<div style="position:relative;padding:36px 32px 28px;background:linear-gradient(180deg,#F0F9FF 0%,#fff 100%)">'
      +logoHTML
      +'<div style="font-size:11px;font-weight:800;letter-spacing:.32em;text-transform:uppercase;color:var(--p1);text-align:center;margin-bottom:8px">¡Bienvenid@'+(nombre?', '+nombre:'')+'!</div>'
      +'<div style="font-size:22px;font-weight:900;color:var(--ink);text-align:center;letter-spacing:-.6px;line-height:1.2;margin-bottom:10px">Completá tu perfil</div>'
      +'<div style="font-size:13px;color:var(--ink3);text-align:center;line-height:1.55;max-width:340px;margin:0 auto 18px">Para que el equipo pueda contactarte y celebrar tu cumpleaños, agregá estos datos a tu perfil:</div>'
      +'<ul style="list-style:none;padding:0;margin:0 0 22px;background:var(--surf);border:1px solid var(--rim);border-radius:12px;padding:10px 16px">'+faltantesList+'</ul>'
      +'<div style="display:flex;gap:9px">'
        +'<button onclick="_cerrarBienvenidaPerfil()" style="flex:1;background:var(--surf2);color:var(--ink2);border:1.5px solid var(--rim);font-family:inherit;font-weight:700;font-size:13.5px;padding:12px 0;border-radius:12px;cursor:pointer;transition:.15s">Después</button>'
        +'<button onclick="_abrirPerfilDesdeBienvenida()" style="flex:1.4;background:linear-gradient(135deg,var(--p1),var(--p2));color:#fff;border:none;font-family:inherit;font-weight:800;font-size:13.5px;padding:12px 0;border-radius:12px;cursor:pointer;box-shadow:0 6px 18px rgba(37,99,235,.28);transition:.15s">Completar ahora →</button>'
      +'</div>'
      +'<div style="text-align:center;font-size:10.5px;color:var(--ink4);margin-top:14px">No te molestaremos hasta mañana</div>'
    +'</div>';
  document.body.appendChild(card);

  // Cerrar al hacer click en el backdrop
  backdrop.onclick = function(){ _cerrarBienvenidaPerfil(); };
  // Guardar la clave para marcar como visto
  window._welcomePerfilLSKey = lsKey;
}

function _cerrarBienvenidaPerfil(){
  var b = document.getElementById('welcome-perfil-backdrop');
  var c = document.getElementById('welcome-perfil-card');
  if(b) b.remove();
  if(c) c.remove();
  // Marcar como dismissed para hoy
  try { if(window._welcomePerfilLSKey) localStorage.setItem(window._welcomePerfilLSKey,'1'); } catch(e){}
}

function _abrirPerfilDesdeBienvenida(){
  _cerrarBienvenidaPerfil();
  // Abrir overlay de Mi Perfil
  if(typeof showAdminProfile === 'function') showAdminProfile();
}
window.chequearPerfilIncompleto = chequearPerfilIncompleto;
window._cerrarBienvenidaPerfil = _cerrarBienvenidaPerfil;
window._abrirPerfilDesdeBienvenida = _abrirPerfilDesdeBienvenida;

async function guardarMiPerfil(){
  if(!S.currentUser || !S.currentUser.uid){
    if(typeof toast==='function') toast('No estás logueado','error');
    return;
  }
  var btn = document.getElementById('prof-save-btn');
  function val(id){ var el = document.getElementById(id); return el ? (el.value||'') : ''; }
  if(btn){ btn.disabled = true; btn.textContent = 'Guardando…'; }

  var update = {
    // Datos personales
    nombre: val('prof-nombre').trim(),
    cedula: val('prof-cedula').trim(),
    genero: val('prof-genero').trim(),
    cumpleanos: val('prof-cumple').trim(),
    estadoCivil: val('prof-estadocivil').trim(),
    sede: val('prof-sede').trim(),
    // Contacto
    tel: val('prof-tel').trim(),
    tel2: val('prof-tel2').trim(),
    direccion: val('prof-direccion').trim(),
    emergencia: val('prof-emergencia').trim(),
    // Redes
    instagram: val('prof-instagram').trim().replace(/^@/,''),
    facebook: val('prof-facebook').trim(),
    tiktok: val('prof-tiktok').trim().replace(/^@/,''),
    twitter: val('prof-twitter').trim().replace(/^@/,''),
    linkedin: val('prof-linkedin').trim(),
    actualizadoEn: new Date().toISOString()
  };
  console.log('[Mi Perfil] Guardando:', S.currentUser.uid, update);

  if(!db){
    if(typeof toast==='function') toast('Firebase no inicializado — no se puede guardar','error');
    if(btn){ btn.disabled=false; btn.textContent='Guardar cambios'; }
    return;
  }

  try {
    // 1) Escribir a Firestore con merge
    await db.collection('usuarios').doc(S.currentUser.uid).set(update, {merge:true});
    // 2) Re-leer para verificar que se persistió correctamente
    var verifyDoc = await db.collection('usuarios').doc(S.currentUser.uid).get();
    var saved = verifyDoc.exists ? (verifyDoc.data()||{}) : {};
    console.log('[Mi Perfil] Persistido en Firestore:', saved);
    if(saved.cumpleanos !== update.cumpleanos){
      console.warn('[Mi Perfil] WARNING: cumpleanos guardado difiere del enviado', {enviado:update.cumpleanos, leido:saved.cumpleanos});
    }
    // 3) Actualizar estado local
    Object.assign(S.currentUser, saved); // usar lo que efectivamente quedó en Firestore
    // 4) Sincronizar caché de usuarios
    try {
      var uid = S.currentUser.uid;
      var fullObj = Object.assign({uid:uid, email:S.currentUser.email||''}, saved);
      if(typeof _usersCache !== 'undefined' && Array.isArray(_usersCache)){
        var idx = _usersCache.findIndex(function(u){ return u && u.uid === uid; });
        if(idx >= 0) Object.assign(_usersCache[idx], fullObj);
        else _usersCache.push(fullObj);
      }
      if(S._wtUsers && Array.isArray(S._wtUsers)){
        var idx2 = S._wtUsers.findIndex(function(u){ return u && u.uid === uid; });
        if(idx2 >= 0) Object.assign(S._wtUsers[idx2], fullObj);
        else S._wtUsers.push(fullObj);
      }
    } catch(e){ console.warn('cache sync miPerfil:', e); }
    // 5) Sidebar + log
    if(typeof updateSidebarFooter==='function') updateSidebarFooter();
    if(typeof logActividad==='function') logActividad('perfil_editado','perfil',S.currentUser.uid,{nombre:update.nombre,cumpleanos:update.cumpleanos});
    // 6) Re-render Centro si está abierto, para que aparezca en Mayo al instante
    if(S.page === 'centro' && typeof nav === 'function'){ try { nav('centro'); } catch(e){} }
    if(typeof toast==='function') toast('✓ Perfil guardado'+ (update.cumpleanos?' · cumple '+update.cumpleanos:''),'success');
    if(btn){ btn.style.display='none'; btn.disabled=false; btn.textContent='Guardar cambios'; }
  } catch(e){
    console.error('[Mi Perfil] Error guardando:', e);
    var msg = (e && e.message) || String(e);
    if(/permission|insufficient/i.test(msg)) msg = 'Permiso denegado en Firestore. Pídele al administrador revisar las reglas de usuarios/{uid}.';
    if(typeof toast==='function') toast('Error: '+msg,'error');
    if(btn){ btn.disabled=false; btn.textContent='Guardar cambios'; }
  }
}

// ─── ROTAR TIP DEL DÍA manualmente ───
function dashTipNext(){
  try {
    // Cambiar el tip directamente en el DOM sin re-navegar
    var pool = (typeof WT_TIPS !== 'undefined' && WT_TIPS.length) ? WT_TIPS : null;
    if(!pool) return;
    var prev = window._tipOverride;
    var next = prev;
    var safety = 0;
    while((next === prev || next === undefined) && safety++ < 30){
      next = Math.floor(Math.random()*pool.length);
    }
    window._tipOverride = next;
    var tipEl = document.getElementById('dly-tip-text');
    if(tipEl) tipEl.textContent = pool[next % pool.length];
  } catch(e){ console.warn('dashTipNext:', e); }
}

// ─── TABS del card diario ───
function dashDailyTab(t){
  ['tip','chiste','dato','noticia'].forEach(function(k){
    var btn = document.querySelector('.dly-tab[data-tab="'+k+'"]');
    var pane = document.getElementById('dly-tab-'+k);
    if(btn){
      btn.classList.toggle('is-active', k === t);
      btn.style.color = k === t ? 'var(--ink)' : 'var(--ink3)';
      btn.style.fontWeight = k === t ? '800' : '700';
      btn.style.borderBottomColor = k === t ? 'var(--p1)' : 'transparent';
    }
    if(pane) pane.style.display = k === t ? 'block' : 'none';
  });
  // Si es la primera vez que abren la tab, cargar contenido
  if(t === 'chiste' || t === 'dato' || t === 'noticia'){
    var key = '_dlyLoaded_'+t;
    if(!window[key]){
      window[key] = true;
      dashDailyLoad(t, false);
    }
  }
}

// ─── CARGAR contenido del día desde APIs públicas ───
async function dashDailyLoad(tipo, force){
  var hoyKey = new Date().toISOString().slice(0,10);  // YYYY-MM-DD
  var cacheKey = 'pgsDaily_'+tipo+'_'+hoyKey;
  var textEl = document.getElementById('dly-'+tipo+'-text');
  if(!textEl) return;

  // Si NO force y hay cache de hoy, usarlo
  if(!force){
    try {
      var cached = localStorage.getItem(cacheKey);
      if(cached){
        // Noticias se renderiza como HTML (tiene links), el resto como texto
        if(tipo === 'noticia'){ textEl.innerHTML = cached; }
        else { textEl.textContent = cached; }
        return;
      }
    } catch(e){}
  }

  textEl.textContent = 'Cargando…';

  try {
    var resultado = '';
    if(tipo === 'chiste'){
      // 50% del tiempo usa local (variedad asegurada) y 50% API
      var pool = (typeof WT_CHISTES !== 'undefined' && WT_CHISTES.length) ? WT_CHISTES : null;
      var usarApi = Math.random() < 0.5;
      if(usarApi){
        try {
          var r = await fetch('https://v2.jokeapi.dev/joke/Any?lang=es&type=single&blacklistFlags=nsfw,racist,sexist,political,religious,explicit');
          var d = await r.json();
          if(d.joke){ resultado = d.joke; }
          else if(d.setup && d.delivery){ resultado = d.setup + ' — ' + d.delivery; }
          else throw new Error('API sin chiste');
        } catch(_e){
          if(pool) resultado = pool[Math.floor(Math.random()*pool.length)];
          else throw _e;
        }
      } else {
        // Pool local: garantiza nuevo chiste evitando repetir el anterior
        if(pool){
          var prevChiste = localStorage.getItem(cacheKey) || '';
          var idx = Math.floor(Math.random()*pool.length);
          var safety = 0;
          while(pool[idx] === prevChiste && safety++ < 20){
            idx = Math.floor(Math.random()*pool.length);
          }
          resultado = pool[idx];
        } else {
          // Sin pool local — fallback a API
          var r = await fetch('https://v2.jokeapi.dev/joke/Any?lang=es&type=single&blacklistFlags=nsfw,racist,sexist,political,religious,explicit');
          var d = await r.json();
          resultado = d.joke || (d.setup + ' — ' + d.delivery);
        }
      }
    }
    else if(tipo === 'dato'){
      var pool = (typeof WT_DATOS !== 'undefined' && WT_DATOS.length) ? WT_DATOS : null;
      if(pool){
        // Evitar repetir el dato anterior
        var prevDato = localStorage.getItem(cacheKey) || '';
        var idx = Math.floor(Math.random()*pool.length);
        var safety = 0;
        while(pool[idx] === prevDato && safety++ < 20){
          idx = Math.floor(Math.random()*pool.length);
        }
        resultado = pool[idx];
      } else {
        throw new Error('No hay datos locales');
      }
    }
    else if(tipo === 'noticia'){
      // Múltiples fuentes de noticias con fallback automático
      var noticias = null;
      var fuentesNoticias = [
        // 1) RSS2JSON con Google News VE
        {url:'https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent('https://news.google.com/rss?hl=es-419&gl=VE&ceid=VE:es-419')+'&count=6',
         parse:function(d){ return d.items && d.items.length ? d.items : null; }},
        // 2) AllOrigins proxy con Google News VE
        {url:'https://api.allorigins.win/get?url='+encodeURIComponent('https://news.google.com/rss?hl=es-419&gl=VE&ceid=VE:es-419'),
         parse:function(d){
           if(!d.contents) return null;
           try {
             var doc = new DOMParser().parseFromString(d.contents, 'text/xml');
             var items = doc.querySelectorAll('item');
             var arr = [];
             items.forEach(function(it){
               arr.push({
                 title: (it.querySelector('title')||{}).textContent || '',
                 link: (it.querySelector('link')||{}).textContent || '',
                 author: (it.querySelector('source')||{}).textContent || ''
               });
             });
             return arr.length ? arr.slice(0,6) : null;
           } catch(e) { return null; }
         }},
        // 3) RSS2JSON con BBC Mundo (cobertura LatAm en español)
        {url:'https://api.rss2json.com/v1/api.json?rss_url='+encodeURIComponent('https://feeds.bbci.co.uk/mundo/rss.xml')+'&count=6',
         parse:function(d){ return d.items && d.items.length ? d.items : null; }},
        // 4) AllOrigins con BBC Mundo
        {url:'https://api.allorigins.win/get?url='+encodeURIComponent('https://feeds.bbci.co.uk/mundo/rss.xml'),
         parse:function(d){
           if(!d.contents) return null;
           try {
             var doc = new DOMParser().parseFromString(d.contents, 'text/xml');
             var items = doc.querySelectorAll('item');
             var arr = [];
             items.forEach(function(it){
               arr.push({
                 title: (it.querySelector('title')||{}).textContent || '',
                 link: (it.querySelector('link')||{}).textContent || '',
                 author: 'BBC Mundo'
               });
             });
             return arr.length ? arr.slice(0,6) : null;
           } catch(e) { return null; }
         }}
      ];

      // Fetch con timeout para no quedar colgado en fuentes lentas
      function _newsfetch(url, timeoutMs){
        return new Promise(function(resolve, reject){
          var ctrl = (typeof AbortController!=='undefined') ? new AbortController() : null;
          var to = setTimeout(function(){ if(ctrl) ctrl.abort(); reject(new Error('timeout')); }, timeoutMs||4000);
          fetch(url, ctrl ? {signal: ctrl.signal} : {})
            .then(function(r){ clearTimeout(to); resolve(r); })
            .catch(function(e){ clearTimeout(to); reject(e); });
        });
      }
      for(var i=0;i<fuentesNoticias.length;i++){
        try {
          var src = fuentesNoticias[i];
          var rr = await _newsfetch(src.url, 4500);
          if(!rr.ok) continue;
          var dd = await rr.json();
          var arr = src.parse(dd);
          if(arr && arr.length){
            noticias = arr;
            break;
          }
        } catch(e){
          // Silencioso: los CORS/timeout de feeds externos no son bugs nuestros,
          // no ensuciar la consola del navegador.
        }
      }

      if(noticias && noticias.length){
        var items = noticias.slice(0,3);
        textEl.innerHTML = items.map(function(it, idx){
          var title = String(it.title||'').replace(/<[^>]*>/g,'').slice(0,180);
          var src = String(it.author||it.source||'').slice(0,40);
          var isLast = idx === items.length - 1;
          return '<div style="margin-bottom:'+(isLast?'0':'10px')+';padding-bottom:'+(isLast?'0':'10px')+';'+(isLast?'':'border-bottom:1px solid var(--rim);')+'">'
            +'<a href="'+(it.link||'#')+'" target="_blank" rel="noopener" style="color:var(--ink);text-decoration:none;font-weight:700;line-height:1.4;display:block;font-size:15px">'+title+'</a>'
            +(src?'<div style="font-size:11px;color:var(--ink3);margin-top:5px;font-weight:600">'+src+'</div>':'')
          +'</div>';
        }).join('');
        try { localStorage.setItem(cacheKey, textEl.innerHTML); } catch(e){}
        return;
      } else throw new Error('Todas las fuentes de noticias fallaron');
    }

    textEl.textContent = resultado;
    try { localStorage.setItem(cacheKey, resultado); } catch(e){}
  } catch(err) {
    // Silencioso: red/CORS no es bug nuestro, usar fallback local sin alarmar consola
    // Fallbacks locales
    var fallbacks = {
      chiste: '¿Por qué los programadores prefieren motos? Porque tienen "throw" y "catch" en cada curva.',
      dato: 'Las motocicletas pueden inclinarse hasta 55° en una curva sin perder estabilidad si el motociclista lo hace correctamente.',
      noticia: 'No se pudo cargar noticias en este momento. Verifica tu conexión a internet.'
    };
    textEl.textContent = fallbacks[tipo] || 'No disponible';
  }
}

// ── Notas de Firestore (consola → Firestore → Reglas): ──────
// rules_version = '2';
// service cloud.firestore {
// match /databases/{database}/documents {
// match /{document=**} {
// allow read, write: if request.auth != null;
//     }
//   }
// }
// ────────────────────────────────────────────────────────────

var db = null;
var auth = null;
var storage = null;
var FIREBASE_READY = false;


function getCreditoTotalCuotas(c){
  return parseInt((c&&c.totalCuotas) || ((c&&c.plazo) ? c.plazo*2 : 20), 10) || 20;
}
function getCreditoCuotaBase(c){
  return parseFloat((c&&(c.cuotaQ||c.cuota)) || 0) || 0;
}
function getCreditoPagosConfirmados(c){
  if(!c) return 0;
  var pagosDelCred = (S&&Array.isArray(S.pagos))
    ? S.pagos.filter(function(p){
        return p && !p.eliminado && p.estado==='confirmado' && p.cred===c.id && !p.esInicial && p.tipoOperacion!=='inicial_credito';
      })
    : [];
  if(pagosDelCred.length){
    return pagosDelCred.reduce(function(a,p){ return a + (parseFloat(p.monto)||0); }, 0);
  }
  if(Array.isArray(c.pagosRegistrados) && c.pagosRegistrados.length){
    return c.pagosRegistrados.reduce(function(a,h){ return a + (parseFloat(h.montoPagado)||0); }, 0);
  }
  return (parseInt(c.pagado,10)||0) * getCreditoCuotaBase(c);
}
function getCreditoCuotasPagadas(c){
  if(!c) return 0;
  var totalCuotas = getCreditoTotalCuotas(c);
  var cuotaBase = getCreditoCuotaBase(c);
  var pagadoRegistrado = parseInt(c.pagado,10) || 0;
  var pagadoPorMonto = cuotaBase>0 ? Math.floor((getCreditoPagosConfirmados(c)+0.000001)/cuotaBase) : pagadoRegistrado;
  return Math.max(0, Math.min(totalCuotas, Math.max(pagadoRegistrado, pagadoPorMonto)));
}
function getCreditoSaldoPendiente(c){
  return Math.max(0, (parseFloat((c&&c.total) || 0)||0) - getCreditoPagosConfirmados(c));
}

// ════════════════════════════════════════════════════════════════════
// nextCredId: Genera el siguiente ID de crédito MONOTÓNICAMENTE.
// Toma el máximo número existente (incluyendo eliminados y cancelados)
// y le suma 1 — así un ID nunca se repite aunque se borre uno anterior.
// Esto preserva la trazabilidad contable: si tenías CRED-001, CRED-002
// y CRED-003, y luego eliminas el 002, el siguiente será CRED-004 (no 003).
// ════════════════════════════════════════════════════════════════════
function nextCredId(){
  // Lee S.creds local como fallback offline
  var max = 0;
  var all = (S && Array.isArray(S.creds)) ? S.creds : [];
  all.forEach(function(c){
    if(!c || !c.id) return;
    var m = String(c.id).match(/CRED-(\d+)/);
    if(m){ var n = parseInt(m[1], 10); if(!isNaN(n) && n > max) max = n; }
  });
  return 'CRED-' + String(max + 1).padStart(3, '0');
}
function nextCredIdAsync(){
  // Consulta Firestore en tiempo real para evitar colisión de IDs entre vendedores
  if(!db) return Promise.resolve(nextCredId());
  return db.collection('creditos').get().then(function(snap){
    var max = 0;
    snap.forEach(function(d){
      var id = d.id || (d.data && d.data().id) || '';
      var m = String(id).match(/CRED-(\d+)/);
      if(m){ var n = parseInt(m[1], 10); if(!isNaN(n) && n > max) max = n; }
    });
    return 'CRED-' + String(max + 1).padStart(3, '0');
  }).catch(function(){ return nextCredId(); });
}

function nextClienteIdAsync(){
  if(!db) return Promise.resolve((S&&S.clientes&&S.clientes.length)?Math.max.apply(null,S.clientes.map(function(x){return parseInt(x.id,10)||0;}))+1:1);
  return db.collection('clientes').get().then(function(snap){
    var max = 0;
    snap.forEach(function(d){ var n=parseInt((d.data&&d.data().id)||d.id,10); if(!isNaN(n)&&n>max) max=n; });
    return max + 1;
  }).catch(function(){ return (S&&S.clientes&&S.clientes.length)?Math.max.apply(null,S.clientes.map(function(x){return parseInt(x.id,10)||0;}))+1:1; });
}
function nextMotoIdAsync(){
  if(!db) return Promise.resolve((S&&S.motos&&S.motos.length)?Math.max.apply(null,S.motos.map(function(x){return parseInt(x.id,10)||0;}))+1:1);
  return db.collection('motos').get().then(function(snap){
    var max = 0;
    snap.forEach(function(d){ var n=parseInt((d.data&&d.data().id)||d.id,10); if(!isNaN(n)&&n>max) max=n; });
    return max + 1;
  }).catch(function(){ return (S&&S.motos&&S.motos.length)?Math.max.apply(null,S.motos.map(function(x){return parseInt(x.id,10)||0;}))+1:1; });
}

function esMovimientoInicialCredito(m){
  if(!m || m.eliminado) return false;
  var concepto = (m.concepto||'');
  return m.tipoOperacion==='inicial_credito' || concepto.indexOf('Inicial · ')===0;
}
function getTotalInicialesCobradas(){
  return (S&&Array.isArray(S.movimientos) ? S.movimientos : []).filter(esMovimientoInicialCredito).reduce(function(a,m){
    return a + (parseFloat(m.monto)||0);
  }, 0);
}
function marcarInicialCreditoEliminada(credId, motivo){
  if(!credId || !Array.isArray(S.movimientos)) return;
  var ahora = new Date().toISOString();
  var actor = (S.currentUser&&S.currentUser.nombre)||'Admin';
  S.movimientos.forEach(function(m){
    if(!m || m.eliminado) return;
    var esDeEsteCredito = m.creditoId===credId || m.conceptoCredito===credId || ((m.concepto||'').indexOf('Inicial · ')===0 && (m.concepto||'').indexOf(credId)>=0);
    if(!esDeEsteCredito) return;
    m.eliminado = true;
    m.eliminadoPor = actor;
    m.eliminadoEn = ahora;
    if(motivo) m.eliminadoRazon = motivo;
    DB.saveMovimiento(m);
  });
}

try {
  if(typeof firebase === 'undefined'){
    console.warn('SDK de Firebase no cargado');
  } else if(FIREBASE_CONFIG.apiKey !== 'TU_API_KEY'){
    var _existingApp;
    try { _existingApp = firebase.app(); } catch(ex) {}
    if(!_existingApp) firebase.initializeApp(FIREBASE_CONFIG);
    if(typeof firebase.firestore !== 'function'){
      throw new Error('Firestore bundle no cargado. Habilita Firestore Database en Firebase Console.');
    }
    db = firebase.firestore();

    if(typeof firebase.auth === 'function') auth = firebase.auth();
    if(typeof firebase.storage === 'function') storage = firebase.storage();
    FIREBASE_READY = true;
    console.log('Firebase inicializado correctamente');
  } else {
    console.warn('Firebase no configurado');
  }
} catch(e){ console.warn('Firebase init:', e.message); }

// Loader
function showLoader(msg,sub){
  var w=$('ld-wrap'),m=$('ld-msg'),s=$('ld-sub');
  if(w)w.style.display='flex';
  if(m)m.textContent=msg||'Cargando...';
  if(s)s.textContent=sub||'';
}
function hideLoader(){var w=$('ld-wrap');if(w)w.style.display='none';}

// Firebase guarda el mismo objeto — sin conversión necesaria
function mapMoto(r){return r;}
function mapCred(r){return r;}
function mapPago(r){return r;}

// Limpia undefined antes de guardar en Firestore
function clean(o){
  var r={};
  Object.keys(o).forEach(function(k){if(o[k]!==undefined)r[k]=o[k]===null?null:o[k];});
  return r;
}

var _rtUnsubs = [];
var _rtTimer = null;
var _rtStarted = false;
var _rtRenderPending = false;

function _docsArray(snap){
  return snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
}

function stopRealtime(){
  _rtUnsubs.forEach(function(unsub){ try{ if(typeof unsub==='function') unsub(); }catch(e){} });
  _rtUnsubs = [];
  _rtStarted = false;
  if(_rtTimer){ clearTimeout(_rtTimer); _rtTimer = null; }
}

function _captureFocus(){
  var el = document.activeElement;
  if(!el || !el.id || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return null;
  return {
    id: el.id,
    start: typeof el.selectionStart==='number' ? el.selectionStart : null,
    end: typeof el.selectionEnd==='number' ? el.selectionEnd : null
  };
}

function _restoreFocus(f){
  if(!f || !f.id) return;
  setTimeout(function(){
    var el = document.getElementById(f.id);
    if(!el) return;
    try{ el.focus(); }catch(e){}
    if(f.start!==null && typeof el.setSelectionRange==='function'){
      try{ el.setSelectionRange(f.start, f.end); }catch(e){}
    }
  }, 0);
}

function scheduleRealtimeRender(){
  if(_rtTimer) clearTimeout(_rtTimer);
  _rtTimer = setTimeout(function(){
    _rtTimer = null;
    if(!S || !S.currentUser) return;
    try{ if(typeof updateBadge==='function') updateBadge(); }catch(e){}
    if(typeof _isModalOpen==='function' && _isModalOpen()){
      _rtRenderPending = true;
      return;
    }
    if(!S.page || typeof nav!=='function') return;
    _rtRenderPending = false;
    var focus = _captureFocus();
    nav(S.page);
    _restoreFocus(focus);
  }, 350);
}

function flushRealtimeRender(){
  if(!_rtRenderPending || !S || !S.currentUser || !S.page || typeof nav!=='function') return;
  _rtRenderPending = false;
  try{ if(typeof updateBadge==='function') updateBadge(); }catch(e){}
  nav(S.page);
}

function _aplicarConcesionarioActivoRealtime(){
  try{
    // El Administrador siempre trabaja con "Todos" por defecto: no forzar sede en tiempo real.
    if(typeof isAdminUser==='function' && isAdminUser()) return;
    var conc = S.concesionarios || [];
    var savedConc = localStorage.getItem('concesionarioActivo');
    if(savedConc && conc.find(function(c){return c.id === savedConc;})) S.concesionarioActivo = savedConc;
    if(S.currentUser){
      var asignados = S.currentUser.concesionarios || [];
      if(asignados.length === 1){
        S.concesionarioActivo = asignados[0];
        localStorage.setItem('concesionarioActivo', asignados[0]);
      } else if(asignados.length > 1 && (!S.concesionarioActivo || asignados.indexOf(S.concesionarioActivo) === -1)){
        S.concesionarioActivo = asignados[0];
        localStorage.setItem('concesionarioActivo', asignados[0]);
      }
    }
  }catch(e){}
}

function startRealtime(){
  if(!db || !S || !S.currentUser || _rtStarted) return;
  stopRealtime();
  _rtStarted = true;
  [
    {col:'motos', key:'motos', map:mapMoto},
    {col:'clientes', key:'clientes'},
    {col:'creditos', key:'creds', map:mapCred},
    {col:'pagos', key:'pagos', map:mapPago},
    {col:'egresos', key:'egresos'},
    {col:'movimientos', key:'movimientos'},
    {col:'cuentasPendientes', key:'cuentasPendientes'},
    {col:'facturas', key:'facturas'},
    {col:'concesionarios', key:'concesionarios'},
    {col:'tareas', key:'tareas'},
    {col:'recursos', key:'recursos'}
  ].forEach(function(spec){
    try{
      var unsub = db.collection(spec.col).onSnapshot(function(snap){
        var arr = _docsArray(snap);
        if(typeof spec.map==='function') arr = arr.map(spec.map);
        S[spec.key] = arr;
        if(spec.key==='motos') saveMotosCache(S.motos);
        if(spec.key==='concesionarios') _aplicarConcesionarioActivoRealtime();
        scheduleRealtimeRender();
      }, function(err){
        console.warn('Realtime '+spec.col+':', err && (err.message || err));
      });
      _rtUnsubs.push(unsub);
    }catch(e){
      console.warn('Realtime init '+spec.col+':', e.message);
    }
  });
}

// Parsea una fecha 'YYYY-MM-DD' como hora LOCAL (mediodía) para evitar el corrimiento
// de un día por zona horaria: new Date('2026-06-04') se interpreta como UTC y en VE (UTC-4)
// retrocede al día anterior. Con mediodía local nunca cambia el día.
function parseFechaLocal(v){
  if(!v) return new Date();
  if(v instanceof Date) return v;
  var s = String(v);
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s + 'T12:00:00');
  return new Date(s);
}
function fechaLocalISO(value){
  var d = value ? parseFechaLocal(value) : new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function hoyLocalISO(){ return fechaLocalISO(); }
window.parseFechaLocal = parseFechaLocal;

// Cache local específica para motos — evita perder unidades nuevas entre sesiones
var MOTOS_CACHE_KEY='pagasi_motos_cache_v1';
function loadMotosCache(){
  try{
    var raw=localStorage.getItem(MOTOS_CACHE_KEY);
    var arr=raw?JSON.parse(raw):[];
    return Array.isArray(arr)?arr:[];
  }catch(e){ return []; }
}
function saveMotosCache(arr){
  try{ localStorage.setItem(MOTOS_CACHE_KEY, JSON.stringify(Array.isArray(arr)?arr:[])); }catch(e){}
}
function upsertMotoCache(moto){
  try{
    var arr=loadMotosCache();
    var i=arr.findIndex(function(x){ return String(x.id)===String(moto.id); });
    if(i>=0) arr[i]=clean(moto); else arr.push(clean(moto));
    saveMotosCache(arr);
  }catch(e){}
}
function delMotoCache(id){
  try{
    var arr=loadMotosCache().filter(function(x){ return String(x.id)!==String(id); });
    saveMotosCache(arr);
  }catch(e){}
}
// Estrategia de merge:
// - Union de motos remotas y locales.
// - En caso de conflicto de id, gana la versión local (puede tener cambios aún no subidos a Firebase).
// - Si el caché local quedó "sucio" (motos borradas de Firebase que reaparecen), el usuario puede
// usar el botón "⟳ Resincronizar" del módulo de motos para limpiar el caché local.
function mergeMotosPreferLocal(remote, local){
  var map={};
  (Array.isArray(remote)?remote:[]).forEach(function(x){ if(x&&x.id!=null) map[String(x.id)]=x; });
  (Array.isArray(local)?local:[]).forEach(function(x){ if(x&&x.id!=null) map[String(x.id)]=x; });
  return Object.keys(map).map(function(k){ return map[k]; });
}

// ── DB — persistencia con Firestore ──
// Cola offline: guarda operaciones pendientes cuando no hay conexión
var _dbQueue = [];
var _dbOnline = true;
window.addEventListener('online', function(){ _dbOnline=true; _flushDbQueue(); });
window.addEventListener('offline', function(){ _dbOnline=false; });

function _dbSilent(fn){
  // Ejecuta fn() y avisa errores reales sin romper los flujos existentes.
  try {
    var p = fn();
    if(p && p.then) return p.then(function(){ return true; }).catch(function(e){
      var msg = e.message||'';
      if(msg.includes('transport') || msg.includes('WebChannel') || msg.includes('network') || e.code==='unavailable'){
        console.warn('DB write pending/offline:', msg);
        if(typeof toast==='function') toast('Sin conexión estable: Firebase intentará sincronizar el cambio.','info');
        return false;
      }
      console.warn('DB write error:', msg);
      if(typeof toast==='function') toast('No se pudo guardar en Firebase: '+msg,'error');
      return false;
    });
    return Promise.resolve(true);
  } catch(e){
    console.warn('DB error:', e.message);
    if(typeof toast==='function') toast('No se pudo guardar en Firebase: '+e.message,'error');
    return Promise.resolve(false);
  }
}

function _flushDbQueue(){
  var q=_dbQueue.slice(); _dbQueue=[];
  q.forEach(function(fn){ _dbSilent(fn); });
}

var DB = {
  load: function(){
    var motosCacheLocal = loadMotosCache();
    if(!db){
      if(motosCacheLocal.length) S.motos = mergeMotosPreferLocal(S.motos, motosCacheLocal);
      return Promise.resolve();
    }
    showLoader('Cargando datos...','Conectando con Firebase');
    return Promise.all([
      db.collection('motos').get(),
      db.collection('clientes').get(),
      db.collection('creditos').get(),
      db.collection('pagos').get(),
      db.collection('egresos').get(),
      Promise.resolve({docs:[]}),
      db.collection('movimientos').get(),
      db.collection('cuentasPendientes').get(),
      db.collection('config').doc('plan').get(),
      db.collection('config').doc('catalogo').get(),
      db.collection('config').doc('planes').get(),
      db.collection('facturas').get(),
      db.collection('concesionarios').get(),
      db.collection('config').doc('inventarioOficina').get(),
    ]).then(function(snaps){
      function read(snap, withId){return snap.docs.map(function(d){return withId ? Object.assign({id:d.id}, d.data()) : d.data();});}
      var m=read(snaps[0], true),cl=read(snaps[1], true),cr=read(snaps[2]),p=read(snaps[3]),e=read(snaps[4]),_skip=snaps[5],mv=read(snaps[6]),pnd=read(snaps[7]);
      var planDoc = snaps[8], catalogoDoc = snaps[9], planesDoc = snaps[10];
      var fac = snaps[11] ? read(snaps[11]) : [];
      var conc = snaps[12] ? read(snaps[12], true) : [];
      if(planDoc && planDoc.exists){
        var pd = planDoc.data() || {};
        if(Object.prototype.hasOwnProperty.call(pd,'factor')) PLAN.factor = pd.factor;
        if(Object.prototype.hasOwnProperty.call(pd,'inicial')) PLAN.inicial = pd.inicial;
        if(Object.prototype.hasOwnProperty.call(pd,'tasaMensual')) PLAN.tasaMensual = pd.tasaMensual;
        if(Object.prototype.hasOwnProperty.call(pd,'plazo')) PLAN.plazo = pd.plazo;
        if(Object.prototype.hasOwnProperty.call(pd,'apy')) PLAN.apy = pd.apy;
        var graciaCfg = Object.prototype.hasOwnProperty.call(pd,'diasGracia') ? pd.diasGracia : pd.gracia;
        if(typeof graciaCfg !== 'undefined' && graciaCfg !== null) PLAN.diasGracia = graciaCfg;
        var moraCfg = Object.prototype.hasOwnProperty.call(pd,'moraPct') ? pd.moraPct : pd.mora_pct;
        if(typeof moraCfg !== 'undefined' && moraCfg !== null) PLAN.moraPct = moraCfg;
      }
      if(catalogoDoc && catalogoDoc.exists){
        var catData = catalogoDoc.data() || {};
        // Solo usar el catálogo de Firestore si está en la versión actual (2).
        // Si es viejo/sin versión, mantener el catálogo completo hardcoded y re-sembrar Firestore una vez.
        if(Array.isArray(catData.items) && catData.items.length && (catData.version||0) >= 2){
          CATALOGO.splice(0, CATALOGO.length);
          catData.items.forEach(function(item){ CATALOGO.push(item); });
        } else {
          db.collection('config').doc('catalogo').set({items: CATALOGO, version: 2}).catch(function(){});
          try{ localStorage.setItem('pagasi_catalogo_config', JSON.stringify(CATALOGO)); localStorage.setItem('pagasi_catalogo_ver','2'); }catch(e){}
        }
      } else {
        db.collection('config').doc('catalogo').set({items: CATALOGO, version: 2}).catch(function(){});
        try{ localStorage.setItem('pagasi_catalogo_config', JSON.stringify(CATALOGO)); localStorage.setItem('pagasi_catalogo_ver','2'); }catch(e){}
      }
      if(planesDoc && planesDoc.exists){
        var extraData = planesDoc.data() || {};
        window._planesExtra = Array.isArray(extraData.items) ? extraData.items : [];
      } else {
        window._planesExtra = window._planesExtra || [];
      }
      S.motos = mergeMotosPreferLocal(m.map(mapMoto), motosCacheLocal);
      saveMotosCache(S.motos);

      // ══════ SANEAR score_indexa corrupto ══════
      // En algunos clientes se guardó el objeto completo del score en lugar del número
      var _scoreCorruptos = 0;
      cl.forEach(function(cli){
        if(!cli) return;
        var sr = cli.score_indexa;
        // Caso 1: objeto → rescatar total/score/valor
        if(sr && typeof sr === 'object' && sr !== null){
          _scoreCorruptos++;
          if(_scoreCorruptos <= 2) console.log('[SCORE CORRUPTO]', cli.nombre, 'tenía:', sr);
          var t = parseFloat(sr.total || sr.score || sr.valor || sr.value || 0);
          cli.score_indexa = (t >= 300 && t <= 850) ? t : 0;
          cli._scoreFueCorrupto = true;
        } else {
          var n = parseFloat(sr);
          if(isNaN(n) || n < 300 || n > 850) cli.score_indexa = 0;
          else cli.score_indexa = n;
        }

        // Fallback: si no hay score pero hay ingreso, calcular uno estimado simple
        if(!cli.score_indexa && cli.ingreso){
          var ing = parseFloat(cli.ingreso) || 0;
          var emp = (cli.trabajo || '').toLowerCase();
          // Score base por ingreso (300 a 750 según rango)
          var base = 300;
          if(ing >= 2000) base = 720;
          else if(ing >= 1000) base = 650;
          else if(ing >= 500) base = 580;
          else if(ing >= 300) base = 500;
          else if(ing >= 150) base = 430;
          else base = 380;
          // Bonus/penalización por tipo de empleo
          if(emp.indexOf('formal')>=0 || emp.indexOf('público')>=0 || emp.indexOf('publico')>=0) base += 40;
          else if(emp.indexOf('informal')>=0 || emp.indexOf('indepen')>=0) base -= 20;
          // Limitar 300-850
          cli.score_indexa = Math.max(300, Math.min(850, base));
          cli._scoreEstimado = true;
        }
      });
      if(_scoreCorruptos > 0){
        console.log('[SCORE] Se sanearon '+_scoreCorruptos+' scores corruptos de Firestore');
      }

      S.clientes = cl;

      // Persistir en background los scores saneados — sobrescribe el objeto corrupto en Firestore
      setTimeout(function(){
        if(!db) return;
        var fixed = 0;
        cl.forEach(function(cli){
          if(cli._scoreFueCorrupto && cli.id){
            delete cli._scoreFueCorrupto;
            try {
              db.collection('clientes').doc(String(cli.id)).update({
                score_indexa: cli.score_indexa || 0,
                score_saneado: new Date().toISOString()
              }).then(function(){ fixed++; }).catch(function(){});
            } catch(e){}
          }
        });
        if(fixed>0) console.log('[SCORE] Persistidos '+fixed+' scores saneados en Firestore');
      }, 1500);
      S.creds = cr.map(mapCred);
      S.pagos = p.map(mapPago);
      S.egresos = e;
      S.movimientos = mv;
      S.cuentasPendientes = pnd;
      S.facturas = fac;
      S.concesionarios = conc;
      try {
        var _invDoc = snaps[13];
        S.inventarioOficina = (_invDoc && _invDoc.exists && Array.isArray((_invDoc.data()||{}).items))
          ? _invDoc.data().items
          : (function(){ try{ return JSON.parse(localStorage.getItem('pagasi_inv_oficina')||'[]'); }catch(e){ return []; } })();
      } catch(e){ S.inventarioOficina = S.inventarioOficina || []; }
      // ── Admin total (sin sedes asignadas) → SIEMPRE arranca con "Todos" ──
      // Solo restauramos el concesionario guardado si el usuario tiene sedes específicas
      // asignadas (no es admin total). Esto evita que el admin se quede pegado en una sede.
      try{
        var esAdminPuro = (typeof isAdminUser==='function' && isAdminUser()) || !S.currentUser || !(S.currentUser.concesionarios||[]).length;
        if(esAdminPuro){
          S.concesionarioActivo = null;
          try{ localStorage.removeItem('concesionarioActivo'); }catch(e){}
        } else {
          var savedConc = localStorage.getItem('concesionarioActivo');
          if(savedConc && conc.find(function(c){return c.id === savedConc;})){
            S.concesionarioActivo = savedConc;
          }
        }
      }catch(e){}
      // Si el usuario tiene UNA sola sede asignada, forzarla como activa (no permitir "Todos")
      // EXCEPCIÓN: el Administrador siempre puede quedarse en "Todos".
      try{
        if(S.currentUser && !(typeof isAdminUser==='function' && isAdminUser())){
          var asignados = S.currentUser.concesionarios || [];
          if(asignados.length === 1){
            S.concesionarioActivo = asignados[0];
            try{ localStorage.setItem('concesionarioActivo', asignados[0]); }catch(e){}
          } else if(asignados.length > 1){
            // Si tiene varias y el savedConc no está en su lista, usar la primera
            if(!S.concesionarioActivo || asignados.indexOf(S.concesionarioActivo) === -1){
              S.concesionarioActivo = asignados[0];
              try{ localStorage.setItem('concesionarioActivo', asignados[0]); }catch(e){}
            }
          }
        }
      }catch(e){}
      calcularMoraAuto();
      cargarCuentasBanc();
      cargarEmpresa();
      hideLoader();
      // Re-render charts now that data is available
      setTimeout(function(){
        if(typeof renderDashChart==='function') renderDashChart();
        if(typeof renderCredChart==='function') renderCredChart();
        if(typeof renderMoraChart==='function') renderMoraChart();
        if(typeof renderFinIngChart==='function') renderFinIngChart();
        // Re-render egresos chart if on dashboard
        if(typeof renderDashEgrChart==='function') renderDashEgrChart();
        if(typeof renderDashCuotasChart==='function') renderDashCuotasChart();
      }, 300);
      setTimeout(mostrarAlertaMora, 800); // pequeño delay para que el dashboard cargue
    }).catch(function(e){
      hideLoader();
      // Si es error de red, trabajar con datos locales sin avisar con error
      if(e.code==='unavailable'||( e.message&&e.message.includes('network'))){
        if(motosCacheLocal.length) S.motos = mergeMotosPreferLocal(S.motos, motosCacheLocal);
        toast('Sin conexión — modo offline activo','info');
      } else {
        if(motosCacheLocal.length) S.motos = mergeMotosPreferLocal(S.motos, motosCacheLocal);
        toast('Error al cargar datos: '+e.message,'error');
      }
    });
  },
  saveMoto: function(o){ upsertMotoCache(o); if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('motos').doc(String(o.id)).set(clean(o)); }); },
  delMoto: function(id){ delMotoCache(id); if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('motos').doc(String(id)).delete(); }); },
  saveCliente: function(o){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('clientes').doc(String(o.id)).set(clean(o), {merge:true}); }); },
  delCliente: function(id){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('clientes').doc(String(id)).delete(); }); },
  saveCred: function(o){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('creditos').doc(o.id).set(clean(o)); }); },
  updateCred: function(id,u){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('creditos').doc(id).update(u); }); },
  savePago: function(o){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('pagos').doc(o.id).set(clean(o)); }); },
  saveEgreso: function(o){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('egresos').doc(String(o.id)).set(clean(o)); }); },
  delEgreso: function(id){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('egresos').doc(String(id)).delete(); }); },
  saveFactura: function(o){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('facturas').doc(String(o.id)).set(clean(o)); }); },
  saveConcesionario: function(o){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('concesionarios').doc(String(o.id)).set(clean(o)); }); },
  delConcesionario: function(id){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('concesionarios').doc(String(id)).delete(); }); },
};

// Usuarios e invitaciones en Firestore
DB.getUsuarios = function(){ if(!db) return Promise.resolve([]); return db.collection('usuarios').get().then(function(s){return s.docs.map(function(d){return Object.assign({uid:d.id},d.data());});}); };
DB.saveUsuario = function(uid,data){ if(!db) return Promise.resolve(); return db.collection('usuarios').doc(uid).set(data,{merge:true}); };
DB.updateUsuario = function(uid,data){ if(!db) return Promise.resolve(false); return _dbSilent(function(){ return db.collection('usuarios').doc(uid).update(data); }); };
DB.deleteUsuario = function(uid){ if(!db) return Promise.resolve(false); return _dbSilent(function(){ return db.collection('usuarios').doc(uid).delete(); }); };
DB.saveInvitacion = function(token,data){ if(!db) return; return db.collection('invitaciones').doc(token).set(data); };
DB.getInvitacion = function(token){ if(!db) return Promise.resolve(null); return db.collection('invitaciones').doc(token).get(); };
DB.usarInvitacion = function(token,uid){ if(!db) return Promise.resolve(false); return _dbSilent(function(){ return db.collection('invitaciones').doc(token).update({usado:true,uid:uid,fechaUso:new Date().toISOString()}); }); };
DB.saveCuenta = function(o){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('cuentas').doc(String(o.id)).set(clean(o)); }); };
DB.delCuenta = function(id){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('cuentas').doc(String(id)).delete(); }); };
DB.updateCuenta = function(id,u){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('cuentas').doc(String(id)).update(u); }); };
DB.saveMovimiento = function(o){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('movimientos').doc(o.id).set(clean(o)); }); };
DB.delMovimiento = function(id){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('movimientos').doc(id).delete(); }); };
DB.saveTarea = function(o){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('tareas').doc(String(o.id)).set(clean(o),{merge:true}); }); };
DB.delTarea = function(id){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('tareas').doc(String(id)).delete(); }); };
DB.getTareas = function(){ if(!db) return Promise.resolve([]); return db.collection('tareas').get().then(function(s){return s.docs.map(function(d){return Object.assign({id:d.id},d.data());});}); };
DB.saveRecurso = function(o){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('recursos').doc(String(o.id)).set(clean(o),{merge:true}); }); };
DB.delRecurso = function(id){ if(!db)return Promise.resolve(false); return _dbSilent(function(){ return db.collection('recursos').doc(String(id)).delete(); }); };
DB.getRecursos = function(){ if(!db) return Promise.resolve([]); return db.collection('recursos').get().then(function(s){return s.docs.map(function(d){return Object.assign({id:d.id},d.data());});}); };
DB.saveInventarioOficina = function(){ if(!db) return Promise.resolve(false); return _dbSilent(function(){ return db.collection('config').doc('inventarioOficina').set({items:(S.inventarioOficina||[]), actualizado:new Date().toISOString()}); }); };
// Gestiones de cobranza guardadas en el propio crédito (creditos/{id}.gestiones)
// — evita una colección aparte bloqueada por las reglas; cargan junto con S.creds.
DB.addGestion = function(credId, nota){
  var c = (S.creds||[]).find(function(x){ return String(x.id)===String(credId); });
  if(c){ if(!Array.isArray(c.gestiones)) c.gestiones=[]; c.gestiones.push(nota); }
  if(!db) return Promise.resolve(false);
  return _dbSilent(function(){
    try { return db.collection('creditos').doc(String(credId)).update({ gestiones: firebase.firestore.FieldValue.arrayUnion(nota) }); }
    catch(e){ return db.collection('creditos').doc(String(credId)).update({ gestiones: (c?c.gestiones:[nota]) }); }
  });
};
DB.delGestion = function(credId, gestionId){
  var c = (S.creds||[]).find(function(x){ return String(x.id)===String(credId); });
  if(c && Array.isArray(c.gestiones)){ c.gestiones = c.gestiones.filter(function(g){ return g && g.id!==gestionId; }); }
  if(!db) return Promise.resolve(false);
  return _dbSilent(function(){ return db.collection('creditos').doc(String(credId)).update({ gestiones: (c?c.gestiones:[]) }); });
};

// ══════════════════════════════════════════
// AUDIT LOG / BITÁCORA DE ACTIVIDADES
// ══════════════════════════════════════════
// Colección 'logs' en Firestore. Cada doc: {id, timestamp, uid, userName, userEmail, action, modulo, target, detalle, ip?}
DB.saveLog = function(o){ if(!db) return Promise.resolve(false); return _dbSilent(function(){ return db.collection('logs').doc(String(o.id)).set(clean(o)); }); };
DB.getLogs = function(limite){
  if(!db) return Promise.resolve([]);
  var q = db.collection('logs').orderBy('timestamp','desc');
  if(limite) q = q.limit(limite);
  return q.get().then(function(s){ return s.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); }); }).catch(function(e){ console.warn('getLogs:', e); return []; });
};

// Helper global: registra una actividad. Fire-and-forget — no bloquea la UI.
// Acciones recomendadas: login, logout, cliente_creado, cliente_editado, cliente_eliminado,
//   credito_creado, credito_editado, credito_eliminado, pago_registrado, pago_eliminado,
//   egreso_registrado, egreso_eliminado, usuario_creado, usuario_editado, usuario_eliminado,
//   perfil_editado, config_actualizada, sede_creada, contrato_firmado, notif_enviada, tarea_creada.
function logActividad(action, modulo, target, detalle){
  try {
    if(!db || !S || !S.currentUser) return; // no logueado, no log
    var id = 'LOG-' + Date.now() + '-' + Math.floor(Math.random()*9999);
    var doc = {
      id: id,
      timestamp: new Date().toISOString(),
      uid: S.currentUser.uid || '',
      userName: S.currentUser.nombre || S.currentUser.email || 'Desconocido',
      userEmail: S.currentUser.email || '',
      action: String(action||'desconocido'),
      modulo: String(modulo||'sistema'),
      target: target ? String(target) : '',
      detalle: detalle && typeof detalle === 'object' ? detalle : (detalle ? {nota:String(detalle)} : null)
    };
    DB.saveLog(doc);
  } catch(e){ console.warn('logActividad:', e); }
}
window.logActividad = logActividad;

// ── Lista de módulos disponibles ──
var MODULOS = [
  {id:'dash', label:'Dashboard', grupo:'Principal'},
  {id:'centro', label:'Centro de trabajo', grupo:'Principal'},
  {id:'clientes', label:'Clientes', grupo:'Gestión'},
  {id:'motos', label:'Motocicletas', grupo:'Gestión'},
  {id:'creditos', label:'Créditos', grupo:'Gestión'},
  {id:'pagos', label:'Pagos', grupo:'Gestión'},
  {id:'cobranza', label:'Cobranza', grupo:'Operaciones'},
  {id:'contratos', label:'Contratos', grupo:'Operaciones'},
  {id:'notif', label:'Notificaciones', grupo:'Operaciones'},
  {id:'calculadora', label:'Calculadora', grupo:'Operaciones'},
  {id:'reportes', label:'Finanzas', grupo:'Análisis'},
  {id:'cuentas', label:'Cuentas', grupo:'Análisis'},
  {id:'comisiones', label:'Comisiones', grupo:'Análisis'},
  {id:'concesionarios', label:'Concesionarios', grupo:'Sistema'},
  {id:'aprobaciones', label:'Aprobaciones', grupo:'Operaciones'},
  {id:'plan', label:'Plan & Precios', grupo:'Sistema'},
  {id:'config', label:'Configuración', grupo:'Sistema'},
  {id:'users', label:'Usuarios', grupo:'Sistema'},
];

// (S.currentUser se inicializa después de declarar S)

// ══════════════════════════════════════════
// CATÁLOGO OFICIAL PAGASI — PLAN GLOBAL CONFIGURABLE
// ══════════════════════════════════════════
const PLAN = {plazo:12, factor:1.935483870967742, inicial:0.45, tasaMensual:12.26, apy:413.34, diasGracia:5, moraPct:5};

// ══════════════════════════════════════════
// SCORE CFG — Política de riesgo configurable
// ══════════════════════════════════════════
const SCORE_CFG_DEFAULT = {
  // Pesos de los factores (deben sumar 100)
  pesos: { f1:30, f2:30, f3:20, f4:15, f5:5 },
  // Umbrales de aprobación
  umbrales: {
    excelente:700, // ≥ → aprobación automática
    bueno: 600, // ≥ → aprobar
    regular: 500, // ≥ → revisar manualmente
    // < regular → rechazar
  },
  // Hard rejects: condiciones que fuerzan rechazo sin importar el resto
  hardReject: {
    ingresoMinimo: 250, // rechazar si ingreso efectivo < este valor (USD/mes)
    ratioCuotaMax: 0.35, // rechazar si cuota/ingreso > 35%
    historialMaloConDeuda:true,// rechazar si hist=malo y deuda=graves
    sinTelefono: false, // rechazar si no tiene teléfono
    sinReferencias: false, // rechazar si no tiene referencia alguna
  },
  // Ratio cuota/ingreso: políticas
  ratios: {
    ideal: 0.20, // ≤ → bonus
    aceptable: 0.30,
    alto: 0.40,
    muyAlto: 0.50,
  },
  // Ingreso base (para normalizar f2)
  ingreso: {
    minBase: 250, // ingresos por debajo de este valor reciben 0 puntos de base
    maxBase: 3000, // ingresos desde este valor reciben el máximo de base
  }
};
var SCORE_CFG = JSON.parse(JSON.stringify(SCORE_CFG_DEFAULT));
try{
  var _scLs = JSON.parse(localStorage.getItem('pagasi_config_score')||'null');
  if(_scLs && typeof _scLs==='object'){
    if(_scLs.pesos) Object.assign(SCORE_CFG.pesos, _scLs.pesos);
    if(_scLs.umbrales) Object.assign(SCORE_CFG.umbrales, _scLs.umbrales);
    if(_scLs.hardReject) Object.assign(SCORE_CFG.hardReject, _scLs.hardReject);
    if(_scLs.ratios) Object.assign(SCORE_CFG.ratios, _scLs.ratios);
    if(_scLs.ingreso) Object.assign(SCORE_CFG.ingreso, _scLs.ingreso);
  }
}catch(_e){}


try {
  var _catLs = JSON.parse(localStorage.getItem('pagasi_catalogo_config')||'null');
  var _catVer = parseInt(localStorage.getItem('pagasi_catalogo_ver')||'0',10);
  // Solo usar caché local si está en la versión actual (2); si es vieja, se ignora y queda el catálogo completo hardcoded
  if(Array.isArray(_catLs) && _catLs.length && _catVer >= 2){ CATALOGO.splice(0, CATALOGO.length); _catLs.forEach(function(item){ CATALOGO.push(item); }); }
  var _planLs = JSON.parse(localStorage.getItem('pagasi_config_plan')||'null');
  if(_planLs && typeof _planLs==='object'){
    if(Object.prototype.hasOwnProperty.call(_planLs,'factor')) PLAN.factor = _planLs.factor;
    if(Object.prototype.hasOwnProperty.call(_planLs,'inicial')) PLAN.inicial = _planLs.inicial;
    if(Object.prototype.hasOwnProperty.call(_planLs,'tasaMensual')) PLAN.tasaMensual = _planLs.tasaMensual;
    if(Object.prototype.hasOwnProperty.call(_planLs,'plazo')) PLAN.plazo = _planLs.plazo;
    if(Object.prototype.hasOwnProperty.call(_planLs,'apy')) PLAN.apy = _planLs.apy;
    var _gr = Object.prototype.hasOwnProperty.call(_planLs,'diasGracia') ? _planLs.diasGracia : _planLs.gracia;
    if(typeof _gr!=='undefined' && _gr!==null) PLAN.diasGracia = _gr;
    var _mp = Object.prototype.hasOwnProperty.call(_planLs,'moraPct') ? _planLs.moraPct : _planLs.mora_pct;
    if(typeof _mp!=='undefined' && _mp!==null) PLAN.moraPct = _mp;
  }
  window._planesExtra = JSON.parse(localStorage.getItem('pagasi_planes_extra')||'[]') || [];
} catch(_cfgErr) { window._planesExtra = window._planesExtra || []; }


// CATÁLOGO actualizado al 27/05/2026 — 41 motos en 3 sedes
// Fuente: "Actualizacion de Precios.xlsx" (EK Bello Monte, Boleita, Toro Sabana Grande)
const CATALOGO = [
  // ─── EK Bello Monte (17) ────────────────────────────────────
  {id:1,  sede:'EK Bello Monte',     modelo:'NEW HORSE 150',       precio:1320.00},
  {id:2,  sede:'EK Bello Monte',     modelo:'EK XPRESS 150',       precio:1099.00},
  {id:3,  sede:'EK Bello Monte',     modelo:'EK XPRESS II 150',    precio:1126.00},
  {id:4,  sede:'EK Bello Monte',     modelo:'EK XPRESS 200S',      precio:1360.00},
  {id:5,  sede:'EK Bello Monte',     modelo:'EK XPRESS 150 LITE',  precio:1020.00},
  {id:6,  sede:'EK Bello Monte',     modelo:'NEW OWEN II 150',     precio:1265.00},
  {id:7,  sede:'EK Bello Monte',     modelo:'OWEN 200S',           precio:1550.00},
  {id:8,  sede:'EK Bello Monte',     modelo:'RK 200',              precio:1750.00},
  {id:9,  sede:'EK Bello Monte',     modelo:'RK 250',              precio:2075.00},
  {id:10, sede:'EK Bello Monte',     modelo:'TX 250 GS',           precio:2650.00},
  {id:11, sede:'EK Bello Monte',     modelo:'MATRIX 150 LITE',     precio:1290.00},
  {id:12, sede:'EK Bello Monte',     modelo:'MATRIX 150',          precio:1550.00},
  {id:13, sede:'EK Bello Monte',     modelo:'NEW OUTLOOK 175',     precio:2450.00},
  {id:14, sede:'EK Bello Monte',     modelo:'OUTLOOK XL PALETA',   precio:4851.00},
  {id:15, sede:'EK Bello Monte',     modelo:'ATLAS 200HD',         precio:4600.00},
  {id:16, sede:'EK Bello Monte',     modelo:'OWEN 200S AMARILLO',  precio:1500.00},
  {id:17, sede:'EK Bello Monte',     modelo:'ARSEN',               precio:1950.00},
  // ─── Boleita (9) ────────────────────────────────────────────
  {id:18, sede:'Boleita',            modelo:'LECHUZA I',           precio:1700.00},
  {id:19, sede:'Boleita',            modelo:'LECHUZA II',          precio:1900.00},
  {id:20, sede:'Boleita',            modelo:'CUERVO',              precio:1149.00},
  {id:21, sede:'Boleita',            modelo:'CANARIO',             precio:1190.00},
  {id:22, sede:'Boleita',            modelo:'FÉNIX 150',           precio:1450.00},
  {id:23, sede:'Boleita',            modelo:'FÉNIX 200',           precio:1590.00},
  {id:24, sede:'Boleita',            modelo:'ÁGUILA',              precio:980.00},
  {id:25, sede:'Boleita',            modelo:'CÓNDOR',              precio:1190.00},
  {id:26, sede:'Boleita',            modelo:'TUCÁN II',            precio:1239.00},
  // ─── Toro Sabana Grande (15) ────────────────────────────────
  {id:27, sede:'Toro Sabana Grande', modelo:'JAGUAR 150',          precio:1090.00},
  {id:28, sede:'Toro Sabana Grande', modelo:'TRX150 RAYO',         precio:1050.00},
  {id:29, sede:'Toro Sabana Grande', modelo:'TRX150 PALETA',       precio:1070.00},
  {id:30, sede:'Toro Sabana Grande', modelo:'LEÓN 200',            precio:1320.00},
  {id:31, sede:'Toro Sabana Grande', modelo:'REX 150',             precio:1520.00},
  {id:32, sede:'Toro Sabana Grande', modelo:'REX 250',             precio:2090.00},
  {id:33, sede:'Toro Sabana Grande', modelo:'REX 250 MT',          precio:2100.00},
  {id:34, sede:'Toro Sabana Grande', modelo:'R3X',                 precio:2590.00},
  {id:35, sede:'Toro Sabana Grande', modelo:'MOKA',                precio:1295.00},
  {id:36, sede:'Toro Sabana Grande', modelo:'FOX',                 precio:1850.00},
  {id:37, sede:'Toro Sabana Grande', modelo:'POWER',               precio:1880.00},
  {id:38, sede:'Toro Sabana Grande', modelo:'TANK III',            precio:2500.00},
  {id:39, sede:'Toro Sabana Grande', modelo:'TANK',                precio:1920.00},
  {id:40, sede:'Toro Sabana Grande', modelo:'CAPPUCINO',           precio:1890.00},
  {id:41, sede:'Toro Sabana Grande', modelo:'TYPHOON',             precio:1690.00}
];

// Calculos financieros y helpers de planes movidos a logic/financiero.js.

const S = {
  motos: [],
  clientes: [],
  creds: [],
  pagos: [],
  egresos: [],
  cuentas: [],
  movimientos:[],
  cuentasPendientes:[],
  facturas: [],
  concesionarios: [],
  concesionarioActivo: null, // null = "Todos" / id = trabajando en un concesionario
  page:'dash', mTab:'todas', credTab:'todos', pagosTab:'todos', saveFn:null, clienteFiltro:'',
  credSort:{col:'id',dir:'asc'}, cliSort:{col:'nombre',dir:'asc'}, pagosSort:{col:'fecha',dir:'desc'}, motosSort:{col:'modelo',dir:'asc'}, credFiltro:'',
  pagosDesde:'', pagosHasta:'',
  currentUser: null,
  tareas: []
};

const $=id=>document.getElementById(id);
// Iconos SVG para los iconos de modales (sinergia visual en todo el sistema)
const MODAL_ICONS = {
  cliente:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/></svg>','#2563EB','#E6F1FB'],
  star:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/></svg>','#F5A623','#FAEEDA'],
  pago:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>','#00B876','#E1F5EE'],
  dinero:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>','#00B876','#E1F5EE'],
  factura:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>','#2563EB','#E6F1FB'],
  imprimir:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>','#4A4870','#EEF0FA'],
  moto:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M5 17h3l3-5h6l2 5"/><path d="M14 12l-2-4h-3"/><path d="M16 8h3"/></svg>','#2563EB','#E6F1FB'],
  banco:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M9 21v-6h6v6"/></svg>','#2563EB','#E6F1FB'],
  plan:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>','#2563EB','#E6F1FB'],
  user:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/></svg>','#2563EB','#E6F1FB'],
  conces:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/></svg>','#2563EB','#E6F1FB'],
  comision:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>','#F5A623','#FAEEDA'],
  detalle:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>','#2563EB','#E6F1FB'],
  editar:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>','#2563EB','#E6F1FB'],
  eliminar:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>','#E8335A','#FCEBEB'],
  check:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>','#00B876','#E1F5EE'],
  retiro:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>','#E8335A','#FCEBEB'],
  deposito:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>','#00B876','#E1F5EE'],
  transfer:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3l5 5-5 5M21 8H9M8 21l-5-5 5-5M3 16h12"/></svg>','#2563EB','#E6F1FB'],
  mensaje:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>','#2563EB','#E6F1FB'],
  nota:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>','#F5A623','#FAEEDA'],
  score:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/></svg>','#F5A623','#FAEEDA'],
  llave:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M17 6l3 3M15 8l2 2"/></svg>','#2563EB','#E6F1FB'],
  reloj:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>','#F5A623','#FAEEDA'],
  link:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>','#2563EB','#E6F1FB'],
  rol:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/></svg>','#2563EB','#E6F1FB'],
  restaurar:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>','#00B876','#E1F5EE'],
  egreso:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>','#E8335A','#FCEBEB'],
  anular:['<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5 5l14 14"/></svg>','#E8335A','#FCEBEB']
};
function setMicon(key){
  var ic = MODAL_ICONS[key];
  var el = $('mic');
  if(!el) return;
  if(ic){
    el.innerHTML = '<svg style="width:20px;height:20px" viewBox="0 0 24 24">'+ic[0].replace('<svg viewBox="0 0 24 24" ','').replace('</svg>','')+'</svg>';
    el.innerHTML = ic[0];
    el.querySelector('svg').style.width='20px';
    el.querySelector('svg').style.height='20px';
    el.style.color = ic[1];
    el.style.background = ic[2];
    el.style.border = 'none';
  } else {
    el.textContent = key;
    el.style.color=''; el.style.background=''; el.style.border='';
  }
}
const fmt=n=>'$'+parseFloat(n).toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2});
window.S = S;
window.$ = $;
window.fmt = fmt;

// Formatea una fecha ISO o timestamp como "DD/MM/YYYY HH:MM"
function fmtFechaHora(iso){
  if(!iso) return '';
  try{
    var d = parseFechaLocal(iso);
    if(isNaN(d.getTime())) return '';
    var dd = String(d.getDate()).padStart(2,'0');
    var mm = String(d.getMonth()+1).padStart(2,'0');
    var yy = d.getFullYear();
    var hh = String(d.getHours()).padStart(2,'0');
    var mn = String(d.getMinutes()).padStart(2,'0');
    return dd+'/'+mm+'/'+yy+' '+hh+':'+mn;
  }catch(e){ return ''; }
}
function fmtFecha(iso){
  if(!iso) return '';
  try{
    var d = parseFechaLocal(iso);
    if(isNaN(d.getTime())) return '';
    return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
  }catch(e){ return ''; }
}
const ini=n=>n.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
const sbg=s=>({activo:'b-g',mora:'b-r',recuperada:'b-a',recuperado:'b-a',disponible:'b-p',financiada:'b-p',inventario:'b-b',confirmado:'b-g',pendiente:'b-a',completado:'b-g',propia:'b-g',cancelado:'b-r'}[s]||'b-x');
const PGL={dash:'Dashboard',centro:'Centro de trabajo',clientes:'Clientes',motos:'Motocicletas',creditos:'Créditos',pagos:'Pagos',cobranza:'Cobranza',contratos:'Contratos',notif:'Notificaciones',calculadora:'Calculadora',reportes:'Finanzas',cuentas:'Cuentas',comisiones:'Comisiones',conta:'Finanzas',plan:'Plan & Precios',config:'Configuración',scores:'Scores',users:'Usuarios',concesionarios:'Concesionarios',aprobaciones:'Aprobaciones',recursos:'Files'};

const EXTRA_PERMS={perm_delete:'Permiso para eliminar'};
function getCurrentPerms(){ return (S.currentUser&&Array.isArray(S.currentUser.permisos)) ? S.currentUser.permisos : []; }
function isAdminUser(){ return !!(S.currentUser && S.currentUser.rol==='Administrador'); }
// ══════════════════════════════════════════
// PERMISOS POR ROL — presets automáticos
// ══════════════════════════════════════════
var ROL_PERMISOS = {
  // Acceso total: dueño del sistema
  Administrador: ['dash','centro','clientes','motos','creditos','pagos','cobranza','contratos','notif','reportes','cuentas','plan','config','users','perm_delete'],
  // Supervisa operaciones, ve reportes, NO toca config ni usuarios
  Gerente: ['dash','centro','clientes','motos','creditos','pagos','cobranza','contratos','notif','reportes','cuentas'],
  // Cobra en la oficina: ve todos los clientes, registra pagos, ve cobranza y deudores
  Cobrador: ['dash','centro','clientes','cobranza','pagos','creditos'],
  // Capta clientes, hace solicitudes, NO toca pagos ni cobranza
  Vendedor: ['dash','centro','clientes','creditos','motos'],
  // Solo finanzas: reportes, pagos, cuentas y contabilidad
  Contador: ['dash','centro','pagos','reportes','cuentas'],
  // Empleado general: hace casi todo excepto config/users
  Empleado: ['dash','centro','clientes','motos','creditos','pagos','cobranza','contratos','notif'],
  // Vendedor Concesionario: solo calculadora (motos), clientes y solicitudes (creditos)
  // Los créditos que crea quedan en estado 'pendiente_revision' hasta que admin apruebe
  'Vendedor Concesionario': ['motos','clientes','creditos'],
};

// Roles disponibles para invitar (el nombre visible y su descripción)
var ROLES_INFO = {
  Administrador: { desc:'Control total. Puede gestionar usuarios, configuración y todos los módulos.', color:'#2563EB', icon:'ADM' },
  Gerente: { desc:'Supervisa operaciones y ve reportes. No puede cambiar configuración del sistema.', color:'#e8980a', icon:'GER' },
  Cobrador: { desc:'Cobra y registra pagos. Ve todos los clientes y la cartera de cobranza.', color:'#06b06a', icon:'COB' },
  Vendedor: { desc:'Capta clientes y crea solicitudes de crédito. No ve cobranza ni pagos.', color:'#2194ff', icon:'VEN' },
  Contador: { desc:'Acceso exclusivo a pagos, reportes financieros, cuentas y contabilidad.', color:'#9c64ff', icon:'CNT' },
  Empleado: { desc:'Empleado general. Hace casi todo menos configuración y gestión de usuarios.', color:'#ff6b6b', icon:'EMP' },
  'Vendedor Concesionario': { desc:'Vendedor de un concesionario externo. Solo calculadora, clientes y solicitudes. Los créditos requieren aprobación del admin.', color:'#0ea5e9', icon:'VCO' }
};

// Helper: devuelve true si el usuario es un Empleado (o legacy Cobrador/Vendedor)
function isEmpleadoRole(){
  if(!S.currentUser) return false;
  var r = S.currentUser.rol;
  return r === 'Empleado' || r === 'Cobrador' || r === 'Vendedor';
}

// Vendedor Concesionario: rol especial con sidebar reducido (solo 3 módulos)
function isVendedorConcesionarioRole(){
  if(!S.currentUser) return false;
  return S.currentUser.rol === 'Vendedor Concesionario';
}

// Permisos efectivos del usuario actual
function getPermsEfectivos(){
  if(isAdminUser()) return Object.keys(PGL).concat(['perm_delete']);
  // Todos los demás roles (incluido Empleado / Cobrador / Vendedor):
  // respetar los permisos configurados por el administrador
  return getCurrentPerms();
}

function hasModuleAccess(key){
  if(isAdminUser()) return true;
  // Recursos: repositorio de material disponible para TODOS los usuarios logueados
  if(key === 'recursos') return true;
  // Vendedor Concesionario: solo 3 módulos permitidos + recursos
  if(isVendedorConcesionarioRole()){
    return key === 'motos' || key === 'clientes' || key === 'creditos';
  }
  return getPermsEfectivos().includes(key);
}

// ══════════════════════════════════════════
// LISTENER EN TIEMPO REAL DEL USUARIO ACTUAL
// Cuando el admin cambia rol/permisos en Firestore, el usuario afectado
// recibe la actualización al instante: sidebar se redibuja, módulos
// nuevos aparecen y los retirados desaparecen sin necesidad de re-login.
// ══════════════════════════════════════════
window._currentUserUnsub = null;
function _detachCurrentUserListener(){
  if(typeof window._currentUserUnsub === 'function'){
    try{ window._currentUserUnsub(); }catch(e){}
    window._currentUserUnsub = null;
  }
}
function _attachCurrentUserListener(uid){
  if(!db || !uid) return;
  _detachCurrentUserListener();
  try{
    window._currentUserUnsub = db.collection('usuarios').doc(uid).onSnapshot(function(doc){
      if(!doc || !doc.exists) return;
      if(!S.currentUser || S.currentUser.uid !== uid) return;
      var data = doc.data() || {};
      var prevRol = S.currentUser.rol;
      var prevPerms = (S.currentUser.permisos||[]).slice().sort().join('|');
      var nuevoRol = data.rol || S.currentUser.rol;
      var nuevosPerms = Array.isArray(data.permisos) ? data.permisos.slice() : (S.currentUser.permisos||[]);
      var newPermsKey = nuevosPerms.slice().sort().join('|');
      // Si nada cambió, salir
      if(prevRol === nuevoRol && prevPerms === newPermsKey){
        // Solo actualizar nombre si cambió
        if(data.nombre && data.nombre !== S.currentUser.nombre){
          S.currentUser.nombre = data.nombre;
          if(typeof updateSidebarFooter === 'function') updateSidebarFooter();
        }
        return;
      }
      // Si fue suspendido por admin, cerrar sesión
      if(data.suspendido === true && typeof auth !== 'undefined' && auth){
        try{ toast('Tu cuenta ha sido suspendida','error'); }catch(e){}
        setTimeout(function(){ try{ auth.signOut(); }catch(e){} }, 1200);
        return;
      }
      // Aplicar cambios al usuario en memoria
      S.currentUser.rol = nuevoRol;
      S.currentUser.permisos = nuevosPerms;
      if(data.nombre) S.currentUser.nombre = data.nombre;
      S.currentUser.concesionarios = data.concesionarios || [];
      S.currentUser.comisiones = data.comisiones || null;
      // Auto-set sede activa si tiene 1 sola asignada
      try{
        var _asgn = S.currentUser.concesionarios || [];
        if((typeof isAdminUser==='function' && isAdminUser())){
          /* Administrador: se queda en "Todos", no se fuerza sede */
        } else if(_asgn.length === 1){
          S.concesionarioActivo = _asgn[0];
          try{ localStorage.setItem('concesionarioActivo', _asgn[0]); }catch(e){}
        } else if(_asgn.length > 1 && _asgn.indexOf(S.concesionarioActivo) === -1){
          S.concesionarioActivo = _asgn[0];
          try{ localStorage.setItem('concesionarioActivo', _asgn[0]); }catch(e){}
        }
      }catch(e){}
      if(typeof _renderConcSwitcher === 'function') _renderConcSwitcher();
      // Avisar al usuario
      try{
        if(prevRol !== nuevoRol){
          toast('Tu rol fue actualizado a '+nuevoRol,'info');
        } else {
          toast('Tus permisos fueron actualizados','info');
        }
      }catch(e){}
      // Redibujar sidebar (mostrará/ocultará módulos según los nuevos permisos)
      if(typeof renderSidebar === 'function') renderSidebar();
      if(typeof updateSidebarFooter === 'function') updateSidebarFooter();
      // Si la página actual ya no es accesible, mover al dashboard (o primer módulo permitido)
      if(S.page && typeof hasModuleAccess === 'function' && !hasModuleAccess(S.page)){
        var fallback = ['dash','centro','clientes','creditos','pagos','cobranza'].find(function(k){ return hasModuleAccess(k); });
        if(fallback && typeof nav === 'function') nav(fallback);
      } else if(S.page && typeof nav === 'function'){
        // Repintar la página actual por si depende de permisos (ej. botones de eliminar)
        try{ nav(S.page); }catch(e){}
      }
    }, function(err){
      // Errores silenciosos: el usuario ya verá los cambios al refrescar
      console&&console.warn&&console.warn('Listener usuario:', err && err.message);
    });
  }catch(e){
    // Si falla, no rompemos nada — la sesión continúa funcionando
  }
}

// ── Sidebar dinámico: solo muestra módulos con acceso ──
var PG_NAVICONS = {
  dash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
  centro:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></svg>',
  clientes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="3"/><path d="M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1"/><path d="M16 3.5a3 3 0 0 1 0 6"/><path d="M21 20v-1a5 5 0 0 0-3-4.5"/></svg>',
  motos:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M5 17h3l3-5h6l2 5"/><path d="M14 12l-2-4h-3"/><path d="M16 8h3"/></svg>',
  creditos:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h3"/></svg>',
  pagos:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>',
  cobranza:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 13l1 4v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
  contratos:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>',
  notif:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M10.5 21a2 2 0 0 0 3 0"/></svg>',
  calculadora:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><rect x="7" y="6" width="10" height="3" rx="0.5"/><circle cx="8" cy="13" r="0.6" fill="currentColor"/><circle cx="12" cy="13" r="0.6" fill="currentColor"/><circle cx="16" cy="13" r="0.6" fill="currentColor"/><circle cx="8" cy="17" r="0.6" fill="currentColor"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/><circle cx="16" cy="17" r="0.6" fill="currentColor"/></svg>',
  reportes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16l3-4 3 2 4-6"/></svg>',
  aprobaciones:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  cuentas:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a9 3 0 0 0 18 0a9 3 0 0 0-18 0"/><path d="M3 7v5a9 3 0 0 0 18 0V7"/><path d="M3 12v5a9 3 0 0 0 18 0v-5"/></svg>',
  comisiones:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  conta:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>',
  plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  config:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  scores:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/></svg>',
  users:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/></svg>',
  concesionarios:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/></svg>',
  recursos:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M12 11v5M9.5 13.5h5"/></svg>'
};
function pgNavIcon(k){ return PG_NAVICONS[k] || ''; }
function renderSidebar(){
  var sb = document.querySelector('.sb-nav');
  if(!sb) return;
  if(!S.currentUser){ return; }

  // Empleado (o legacy Cobrador/Vendedor): sidebar especializado con Nueva Solicitud
  // pero respetando los permisos configurados por el administrador
  if(isEmpleadoRole()){
    var permsEmp = getCurrentPerms();
    var grposEmp = [
      {label:'Mi Trabajo', keys:['dash','centro','recursos']},
      {label:'Gestión', keys:['clientes','motos','creditos','pagos']},
      {label:'Operaciones',keys:['cobranza','contratos','notif','calculadora']},
      {label:'Análisis', keys:['reportes','cuentas','comisiones']},
      {label:'Sistema', keys:['plan','config','scores','users']},
    ];
    var iconMapEmp = {
      dash:'DB',centro:'WK',clientes:'CLI',motos:'MOT',creditos:'SOL',pagos:'PAG',
      cobranza:'COB',contratos:'CTR',notif:'NOT',reportes:'RPT',
      cuentas:'CTA',comisiones:'CMS',conta:'CNT',plan:'PLN',config:'CFG',scores:'SCR',users:'USR'
    };
    var nameMapEmp = { dash:'Mi Dashboard', creditos:'Solicitudes' };
    var extraMapEmp = {cobranza:'<span class="si-bx" id="sb-badge-cob"></span>', centro:'<span class="si-bx" id="sb-badge-wt"></span>'};

    var sidebarEmp = '<div style="padding:10px 8px">'
      +'<div style="margin-bottom:6px">'
      +'<button type="button" style="display:flex;align-items:center;gap:9px;padding:11px 12px;border-radius:12px;background:var(--p1);color:#fff;border:none;cursor:pointer;font-family:var(--f);font-size:13px;font-weight:700;width:100%" onclick="openAddCred()">'
      +'<span style="font-size:16px;font-weight:900;line-height:1">＋</span><span>Nueva Solicitud</span></button>'
      +'</div>'
      + grposEmp.map(function(g){
          var items = g.keys.filter(function(k){ return k==='recursos' || permsEmp.includes(k); });
          if(!items.length) return '';
          return '<div class="sb-grp"><div class="sb-lbl">'+g.label+'</div>'
            +items.map(function(k){
              var label = nameMapEmp[k] || PGL[k];
              return '<button type="button" class="si" data-nav="'+k+'" onclick="nav(\''+k+'\')">'
                +'<span class="sic nav-ic">'+pgNavIcon(k)+'</span><span>'+label+'</span>'+(extraMapEmp[k]||'')+'</button>';
            }).join('')
            +'</div>';
        }).join('')
      +'</div>';
    sb.innerHTML = sidebarEmp;
    updateSidebarFooter();
    return;
  }

  // Vendedor Concesionario: sidebar MUY reducido (solo 3 módulos esenciales)
  // No ve admin, finanzas, GPS, otros concesionarios — nada de eso
  if(isVendedorConcesionarioRole()){
    var sidebarVC = '<div style="padding:10px 8px">'
      +'<div style="margin-bottom:6px">'
      +'<button type="button" style="display:flex;align-items:center;gap:9px;padding:11px 12px;border-radius:12px;background:var(--p1);color:#fff;border:none;cursor:pointer;font-family:var(--f);font-size:13px;font-weight:700;width:100%" onclick="openAddCred()">'
      +'<span style="font-size:16px;font-weight:900;line-height:1">＋</span><span>Nueva Solicitud</span></button>'
      +'</div>'
      +'<div class="sb-grp"><div class="sb-lbl">Mi Trabajo</div>'
      +'<button type="button" class="si" data-nav="motos" onclick="nav(\'motos\')"><span class="sic nav-ic">'+pgNavIcon('motos')+'</span><span>Motos</span></button>'
      +'<button type="button" class="si" data-nav="calculadora" onclick="nav(\'calculadora\')"><span class="sic nav-ic">'+pgNavIcon('calculadora')+'</span><span>Calculadora</span></button>'
      +'<button type="button" class="si" data-nav="clientes" onclick="nav(\'clientes\')"><span class="sic nav-ic">'+pgNavIcon('clientes')+'</span><span>Clientes</span></button>'
      +'<button type="button" class="si" data-nav="creditos" onclick="nav(\'creditos\')"><span class="sic nav-ic">'+pgNavIcon('creditos')+'</span><span>Solicitudes</span></button>'
      +'<button type="button" class="si" data-nav="recursos" onclick="nav(\'recursos\')"><span class="sic nav-ic">'+pgNavIcon('recursos')+'</span><span>Files</span></button>'
      +'</div>'
      +'</div>';
    sb.innerHTML = sidebarVC;
    updateSidebarFooter();
    return;
  }

  // Otros roles: filtrar módulos según permisos
  var perms = getCurrentPerms();
  var grupos = [
    {label:'Principal', keys:['dash','centro','recursos']},
    {label:'Gestión', keys:['clientes','motos','creditos','pagos']},
    {label:'Operaciones',keys:['cobranza','contratos','notif','calculadora','aprobaciones']},
    {label:'Análisis', keys:['reportes','cuentas','comisiones']},
    {label:'Sistema', keys:['plan','config','concesionarios','scores','users']},
  ];
  var iconMap = {
    dash:'DB',centro:'WK',clientes:'CLI',motos:'MOT',creditos:'FIN',pagos:'PAG',
    cobranza:'COB',contratos:'CTR',notif:'NOT',reportes:'RPT',aprobaciones:'APR',
    cuentas:'CTA',comisiones:'CMS',conta:'CNT',plan:'PLN',config:'CFG',scores:'SCR',users:'USR',concesionarios:'CNC'
  };
  var extraMap = {cobranza:'<span class="si-bx" id="sb-badge-cob"></span>', centro:'<span class="si-bx" id="sb-badge-wt"></span>'};

  sb.innerHTML = grupos.map(function(g){
    var items = g.keys.filter(function(k){ return isAdminUser() || k==='recursos' || perms.includes(k); });
    if(!items.length) return '';
    return '<div class="sb-grp"><div class="sb-lbl">'+g.label+'</div>'
      +items.map(function(k){
        return '<button type="button" class="si" data-nav="'+k+'" onclick="nav(\''+k+'\')">'
          +'<span class="sic nav-ic">'+pgNavIcon(k)+'</span><span>'+PGL[k]+'</span>'+(extraMap[k]||'')+'</button>';
      }).join('')
      +'</div>';
  }).join('');
  updateSidebarFooter();
}

function updateSidebarFooter(){
  if(!S.currentUser) return;
  var nombre = S.currentUser.nombre || S.currentUser.email || 'Usuario';
  var rol = S.currentUser.rol || 'Usuario';
  var inics = nombre.split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase()||'U';
  var rolColors = {Administrador:'var(--p1)',Gerente:'var(--p2)',Empleado:'var(--green)',Vendedor:'var(--green)',Cobrador:'var(--green)',Contador:'var(--ink3)'};
  var rolColor = rolColors[rol] || 'var(--p1)';

  var sbUn = document.querySelector('.sb-un');
  var sbAv = document.querySelector('.sb-av');
  var sbUr = document.querySelector('.sb-ur');
  var mobAv = document.getElementById('mob-av');

  if(sbUn) sbUn.textContent = nombre;
  if(sbAv){ sbAv.textContent = inics; sbAv.style.background = rolColor; }
  if(sbUr){ sbUr.textContent = rol; sbUr.style.background = rolColor; sbUr.style.webkitTextFillColor = '#fff'; sbUr.style.webkitBackgroundClip = 'unset'; sbUr.style.backgroundClip = 'unset'; sbUr.style.color = '#fff'; sbUr.style.fontSize = '10px'; sbUr.style.fontWeight = '700'; sbUr.style.padding = '2px 8px'; sbUr.style.borderRadius = '20px'; }
  if(mobAv){ mobAv.textContent = inics; mobAv.style.background = rolColor; }

  // Also update the footer card to be clickable for all roles
  var sbFoot = document.querySelector('.sb-foot');
  if(sbFoot && !sbFoot.querySelector('.sb-usr[onclick]')){
    var usr = sbFoot.querySelector('.sb-usr');
    if(usr) usr.setAttribute('onclick','showAdminProfile()');
  }

  // ── Badge de mora automático ──
  actualizarBadgeMora();
}

function actualizarBadgeMora(){
  try{
    var cob = document.getElementById('sb-badge-cob');
    if(!cob) return;
    var enMora = _concFiltrar(S.creds||[]).filter(function(c){return !c.eliminado && c.mora>0 && c.estado==='activo';}).length;
    if(enMora>0){
      cob.textContent = enMora;
      cob.style.display='flex';
      cob.style.background='var(--red)';
      cob.style.color='#fff';
      cob.style.fontSize='10px';
      cob.style.fontWeight='900';
      cob.style.minWidth='18px';
      cob.style.height='18px';
      cob.style.borderRadius='9px';
      cob.style.alignItems='center';
      cob.style.justifyContent='center';
      cob.style.padding='0 5px';
    } else {
      cob.textContent='';
      cob.style.display='none';
    }
    // Toast de alerta si hay créditos nuevos en mora (mora entre 1-3 días)
    var _moraKey = 'pagasi_mora_alert_'+hoyLocalISO();
    if(enMora>0 && !sessionStorage.getItem(_moraKey)){
      var nuevosEnMora = _concFiltrar(S.creds||[]).filter(function(c){return !c.eliminado && c.mora>0 && c.mora<=3 && c.estado==='activo';});
      if(nuevosEnMora.length>0){
        sessionStorage.setItem(_moraKey,'1');
        setTimeout(function(){
          toast('⚠️ '+nuevosEnMora.length+' crédito'+(nuevosEnMora.length>1?'s':'')+(nuevosEnMora.length>1?' entraron':' entró')+' en mora hoy','warning',6000);
        }, 1500);
      }
    }
  }catch(e){}
}
function canDeleteAction(){ return isAdminUser() || getCurrentPerms().includes('perm_delete'); }

// ── Pantalla de bienvenida para Vendedor ──
function requireDeletePermission(){
  if(canDeleteAction()) return true;
  toast('No tienes permiso para eliminar','error');
  return false;
}

// Variables globales de configuración
var _cuentasBanc = [];
var _cobradores = ['Juan Admin'];

// ── Helper: lista unificada de cobradores ──
// Devuelve la UNIÓN de:
//   1) Lista manual de _cobradores (config/cobradores en Firestore)
//   2) Usuarios del sistema que tengan comisiones.activo === true
// Dedupe por nombre (case-insensitive con normalización).
// Esto garantiza que cualquiera con comisión configurada aparezca en
// todos los dropdowns de "Recibido por", "Cobrador", "Vendedor", etc.
function getCobradoresList(){
  function normN(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim(); }
  var seen = {}; // mapa normalizado → nombre original a usar
  var resultado = [];
  // 1) Lista manual histórica
  (_cobradores||[]).forEach(function(n){
    var k = normN(n);
    if(!k || seen[k]) return;
    seen[k] = n;
    resultado.push(n);
  });
  // 2) Usuarios con comisión activa
  try {
    var lista = (typeof _usersCache !== 'undefined' && _usersCache && _usersCache.length) ? _usersCache :
                (S && S._wtUsers && S._wtUsers.length ? S._wtUsers : []);
    lista.forEach(function(u){
      if(!u || u.eliminado || u.suspendido) return;
      // Cualquier usuario que tenga el objeto comisiones configurado aparece,
      // sin importar si los valores son 0 o si activo está en false.
      // Basta con que el admin haya tocado la sección de comisiones del usuario.
      var tieneComision = !!u.comisiones;
      if(!tieneComision) return;
      var nombre = u.nombre || u.email || '';
      if(!nombre) return;
      var k = normN(nombre);
      if(seen[k]) return;
      seen[k] = nombre;
      resultado.push(nombre);
    });
  } catch(e){ console.warn('getCobradoresList:', e); }
  return resultado;
}
window.getCobradoresList = getCobradoresList;
// Datos de la empresa (nombre, RIF, ciudad, tel, email) — se usan en contratos y reportes
// Fuente única de verdad que NO depende del DOM (Config solo existe cuando estás en esa página)
var _empresa = { nombre:'Pagasi', rif:'J-00000000-0', ciudad:'Caracas', tel:'', email:'', direccion:'', representante:'', repCI:'' };

// Helper global para leer empresa de forma consistente.
// Primero intenta el DOM (por si está en Config editándose), si no usa la variable cacheada.
function getEmpresa(){
  var nombre = ($('cfg_empresa')&&$('cfg_empresa').value) || _empresa.nombre || 'Pagasi';
  var rif = ($('cfg_rif') &&$('cfg_rif').value) || _empresa.rif || 'J-00000000-0';
  var ciudad = ($('cfg_ciudad') &&$('cfg_ciudad').value) || _empresa.ciudad || 'Caracas';
  var tel = ($('cfg_tel') &&$('cfg_tel').value) || _empresa.tel || '';
  var email = ($('cfg_email2') &&$('cfg_email2').value) || _empresa.email || '';
  var direccion = ($('cfg_direccion') &&$('cfg_direccion').value) || _empresa.direccion || '';
  var representante= ($('cfg_representante')&&$('cfg_representante').value)|| _empresa.representante|| '';
  var repCI = ($('cfg_rep_ci') &&$('cfg_rep_ci').value) || _empresa.repCI || '';
  return { nombre:nombre.trim(), rif:rif.trim(), ciudad:ciudad.trim(), tel:tel.trim(), email:email.trim(), direccion:direccion.trim(), representante:representante.trim(), repCI:repCI.trim() };
}

// Cargar datos de empresa desde Firebase al iniciar

function updateBadge(){
  const b=$('mora-badge');
  if(b) b.textContent=S.creds.filter(c=>c.mora>0).length;
  var wb=$('sb-badge-wt');
  if(wb){
    var hoyISO = (typeof hoyLocalISO==='function') ? hoyLocalISO() : new Date().toISOString().slice(0,10);
    // Solo cuenta lo que REQUIERE ATENCIÓN: tareas mías, activas, que vencen hoy o están vencidas.
    var n=(S.tareas||[]).filter(function(t){
      if(!t || t.eliminado || t.archivado || t.estado==='completada') return false;
      if(typeof wtIsMine==='function' && !wtIsMine(t)) return false;
      return t.fecha && t.fecha <= hoyISO;
    }).length;
    wb.textContent=n||'';
    wb.style.display=n?'inline-flex':'none';
  }
}

// ══════════════════════════════════════════
// HISTORY / BACK BUTTON HANDLING
// ══════════════════════════════════════════
// Evita que el botón "atrás" del navegador saque al usuario del sistema.
// Cada navegación interna (nav) hace pushState; el popstate navega
// internamente o cierra modales abiertos.
window._navFromPop = false; // flag: evita push cuando venimos de popstate

function _isModalOpen(){
  try {
    var ov = document.getElementById('ov');
    if(!ov) return false;
    var d = ov.style.display;
    return d && d !== 'none';
  } catch(e){ return false; }
}

function _pushNavState(p){
  try {
    window.history.pushState({app:'pagasi', page:p, t:Date.now()}, '', window.location.href);
  } catch(e){}
}

function _replaceNavState(p){
  try {
    window.history.replaceState({app:'pagasi', page:p, t:Date.now()}, '', window.location.href);
  } catch(e){}
}

window.addEventListener('popstate', function(ev){
  // Si hay un modal abierto, ciérralo y vuelve a poner el estado
  // (no dejamos que el back "navegue" cuando hay un diálogo).
  if(_isModalOpen()){
    try { if(typeof closeM==='function') closeM(); } catch(e){}
    // Reponer el estado para que quedemos en la misma página
    _pushNavState(S.page || 'dash');
    return;
  }
  // Si el usuario aún no ha iniciado sesión, no hacemos nada raro
  if(!S.currentUser){
    // Reponer para que no se salga
    _pushNavState('login');
    return;
  }
  // Navegar a la página del estado (si existe) o al dashboard
  var target = (ev.state && ev.state.page) ? ev.state.page : 'dash';
  window._navFromPop = true;
  try { nav(target); } finally { window._navFromPop = false; }
});

function nav(p){
  if(typeof closeMobileMenu==='function') closeMobileMenu();
  // Verificar permiso
  if(S.currentUser){
    if(!hasModuleAccess(p)){
      document.querySelectorAll('.si').forEach(function(e){e.classList.remove('on');});
      $('pgT').textContent = 'Sin acceso'; if($('pgT-mob')) $('pgT-mob').textContent='Sin acceso';
      $('cnt').innerHTML = '<div class="empty" style="padding:80px 20px;text-align:center"><div style="font-size:48px;margin-bottom:14px;opacity:0.4">🔒</div><div class="e-tt" style="font-size:18px;font-weight:800;margin-bottom:8px">Acceso restringido</div><div style="font-size:13px;color:var(--ink3);line-height:1.6;max-width:380px;margin:0 auto">No tienes permiso para ver este módulo.<br>Contacta al administrador.</div></div>';
      return;
    }
  }
  // Registrar en el history del navegador (solo si NO venimos de popstate,
  // para evitar duplicados infinitos al dar back).
  if(!window._navFromPop){
    // Si es la primera navegación de la sesión, reemplazamos el estado base;
    // en las siguientes, hacemos push.
    if(!window.history.state || !window.history.state.app){
      _replaceNavState(p);
    } else if(window.history.state.page !== p){
      _pushNavState(p);
    }
  }
  S.page=p;
  S.clienteFiltro='';
  if(window._pgKeep){ window._pgKeep=false; } else { window._pages={}; } // reset pagination on module change (preserve when navigating pages)
  if(p !== 'cuentas') window._cuentasDetalle = null; // reset account detail view
  document.querySelectorAll('.si').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.si[data-nav]').forEach(e=>{if(e.dataset.nav===p)e.classList.add('on');});
  $('pgT').textContent=PGL[p]||p; if($('pgT-mob')) $('pgT-mob').textContent=PGL[p]||p;
  updateTopbar();
  if(typeof _renderConcSwitcher === 'function') _renderConcSwitcher();
  if(window.innerWidth<=820) updateMobileNav();
  const fn=PG[p];
  if(fn){
    if(p==='dash'){
      showSkeleton();
      setTimeout(function(){
        $('cnt').innerHTML=fn();
        updateBadge();
        if(!isEmpleadoRole()){
          if(typeof renderDashChart==='function') renderDashChart();
          setTimeout(function(){ if(typeof renderCredChart==='function') renderCredChart(); }, 50);
          setTimeout(function(){ if(typeof renderMoraChart==='function') renderMoraChart(); }, 80);
          setTimeout(function(){ if(typeof renderDashEgrChart==='function') renderDashEgrChart(); }, 200);
          setTimeout(function(){ if(typeof renderDashCuotasChart==='function') renderDashCuotasChart(); }, 220);
          setTimeout(function(){
            if(typeof renderCredChart==='function') renderCredChart();
            if(typeof renderDashChart==='function' && !_dashChart) renderDashChart();
            if(typeof renderDashEgrChart==='function') renderDashEgrChart();
            if(typeof renderDashCuotasChart==='function' && !_dashCuotasChart) renderDashCuotasChart();
          }, 900);
          setTimeout(function(){
            if(typeof renderDashEgrChart==='function') renderDashEgrChart();
            if(typeof renderDashCuotasChart==='function' && !_dashCuotasChart) renderDashCuotasChart();
          }, 2500);
        }
      },80);
    }
    else {
      $('cnt').innerHTML=fn(); wtInjectDataLabels();
      if(p==='finanzas'){
        setTimeout(function(){ if(typeof renderFinIngChart==='function') renderFinIngChart(); }, 150);
        setTimeout(function(){ if(typeof renderFinIngChart==='function') renderFinIngChart(); }, 600);
        setTimeout(function(){ if(typeof renderFinIngChart==='function') renderFinIngChart(); }, 1500);
      }
    }
  } else {
    $('cnt').innerHTML=`<div class="empty"><span class="e-ic" style="font-size:28px;opacity:0.3;display:block;margin-bottom:10px">···</span><div class="e-tt">En desarrollo</div></div>`;
  }
  updateBadge();
  wtInjectDataLabels();
}

// ── Mobile: inyectar data-label en celdas de tabla para CSS card layout ──
// Logica de graficos Chart.js movida a logic/charts.js.

const PG = {};
window.PG = PG;

function showSkeleton(){
  var cnt = $('cnt');
  if(!cnt) return;
  var skCards = Array(4).fill(0).map(()=>
    '<div class="sk-card" style="flex:1">'+
      '<div class="sk sk-line" style="width:35%;height:10px"></div>'+
      '<div class="sk sk-val"></div>'+
      '<div class="sk sk-line" style="width:70%"></div>'+
      '<div class="sk sk-line" style="width:50%;margin-top:12px"></div>'+
    '</div>'
  ).join('');
  cnt.innerHTML = '<div class="page">'+
    '<div style="background:var(--surf2);border-radius:12px;height:80px;margin-bottom:18px" class="sk"></div>'+
    '<div style="display:flex;gap:12px;margin-bottom:14px">'+skCards+'</div>'+
    '<div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px">'+
      '<div class="sk-card"><div class="sk sk-title"></div><div class="sk" style="height:110px;border-radius:8px"></div></div>'+
      '<div class="sk-card"><div class="sk sk-title"></div>'+Array(3).fill('<div class="sk sk-line"></div>').join('')+'</div>'+
    '</div>'+
  '</div>';
}


// ══════════════════════════════════════════
// MOTO CARD
// ══════════════════════════════════════════

// Helpers de pago/egreso para compra de motos movidos a logic/moto-pagos.js.

function setCredTab(t){S.credTab=t;S.credFiltro='';window._pages={};nav('creditos');}
function setCredSort(col){var cur=S.credSort||{col:'id',dir:'asc'};S.credSort={col:col,dir:(cur.col===col&&cur.dir==='asc')?'desc':'asc'};window._pages={};nav('creditos');}
var _credSearchTimer=null;
function liveSearchCred(q){
  S.credFiltro=q||'';
  pgSet('creditos',1);
  if(_credSearchTimer) clearTimeout(_credSearchTimer);
  _credSearchTimer=setTimeout(function(){
    if(!S || S.page!=='creditos') return;
    var cursor=(q||'').length;
    nav('creditos');
    setTimeout(function(){
      var inp=$('credQ');
      if(inp){
        inp.focus();
        try{ inp.setSelectionRange(cursor,cursor); }catch(e){}
      }
    },0);
  },160);
}
function setCliSort(col){var cur=S.cliSort||{col:'nombre',dir:'asc'};S.cliSort={col:col,dir:(cur.col===col&&cur.dir==='asc')?'desc':'asc'};window._pages={};nav('clientes');}
function setPagosSort(col){var cur=S.pagosSort||{col:'fecha',dir:'desc'};S.pagosSort={col:col,dir:(cur.col===col&&cur.dir==='asc')?'desc':'asc'};window._pages={};nav('pagos');}
function setMotosSort(col){var cur=S.motosSort||{col:'modelo',dir:'asc'};S.motosSort={col:col,dir:(cur.col===col&&cur.dir==='asc')?'desc':'asc'};window._pages={};nav('motos');}
function setCuotasSort(col){var cur=S.cuotasSort||{col:'vence',dir:'asc'};S.cuotasSort={col:col,dir:(cur.col===col&&cur.dir==='asc')?'desc':'asc'};window._pages={};nav('pagos');}
function _thSort(sortState,setFn,col,label){var isActive=sortState.col===col;var arrow=isActive?(sortState.dir==='asc'?'↑':'↓'):'';return '<th onclick="'+setFn+'(\''+col+'\')" style="cursor:pointer;user-select:none;white-space:nowrap">'+label+(arrow?' <span style="color:var(--p1);font-size:10px">'+arrow+'</span>':'<span style="color:var(--ink3);font-size:9px;opacity:.4"> ⇅</span>')+'</th>';}
function getCuotasVencidas(c){
  // Devuelve cuántas cuotas están vencidas sin pagar
  if(!c||c.estado==='completado'||c.estado==='cancelado') return 0;
  var mora = parseInt(c.mora||0,10);
  if(mora<=0) return 0;
  return Math.ceil(mora/15); // 1 cuota cada 15 días
}
function setPagosTab(t){S.pagosTab=t;window._pages={};nav('pagos');}
function setReportesTab(t){S.reportesTab=t;nav('reportes');}
window.setReportesTab=setReportesTab;

// Resincroniza S.motos con Firebase, descartando el caché local.
// Útil cuando el caché local tiene motos "fantasma" que ya no existen en Firebase
// (p.ej. duplicados creados por un bug antiguo, o motos borradas manualmente desde la consola de Firebase).

function confirmarEliminacion(opts){
  // opts: { titulo, descripcion, onConfirm }
  window._delAuditCallback = opts.onConfirm;
  $('mic').textContent='Del';
  $('mtt').textContent = opts.titulo || 'Eliminar registro';
  $('msb').textContent = 'Esta acción quedará registrada con tu nombre';
  $('modal-box').className='modal';
  $('mbd').innerHTML = '<div style="text-align:center;padding:8px 0 14px">'
    +'<div style="font-size:40px;margin-bottom:10px"></div>'
    +'<div style="font-size:14px;font-weight:800;margin-bottom:6px">'+(opts.descripcion||'¿Confirmar eliminación?')+'</div>'
    +'<div style="color:var(--ink3);font-size:12px;margin-bottom:14px">Quedará registrado como eliminado por <strong>'+((S.currentUser&&S.currentUser.nombre)||'Administrador')+'</strong></div>'
    +'</div>'
    +'<div class="fg"><label>Razón de la eliminación (obligatorio)</label>'
    +'<select class="fs" id="del_razon">'
    +'<option value="">— Seleccionar —</option>'
    +'<option>Error de captura</option>'
    +'<option>Pago duplicado</option>'
    +'<option>Cliente solicitó reverso</option>'
    +'<option>Monto incorrecto</option>'
    +'<option>Operación cancelada</option>'
    +'<option>Orden del administrador</option>'
    +'<option>Otro</option>'
    +'</select></div>'
    +'<div class="fg" style="margin-top:8px" id="del_otro_wrap" style="display:none">'
    +'<label>Especifica la razón</label>'
    +'<input class="fi" id="del_otro" placeholder="Describe la razón..."></div>';
  // Show text input when "Otro" selected
  setTimeout(function(){
    var sel = $('del_razon');
    if(sel) sel.onchange = function(){
      var wrap = $('del_otro_wrap');
      if(wrap) wrap.style.display = sel.value==='Otro' ? 'block' : 'none';
    };
  }, 50);
  $('mft').innerHTML='<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    +'<button class="btn btn-d" onclick="ejecutarEliminacionAuditada()">Eliminar</button>';
  $('ov').style.display='flex';
}

function ejecutarEliminacionAuditada(){
  if(!requireDeletePermission()) return;
  var razon = ($('del_razon')&&$('del_razon').value)||'';
  if(razon==='Otro') razon = ($('del_otro')&&$('del_otro').value.trim())||'Otro';
  if(!razon){ toast('Debes seleccionar una razón','error'); return; }
  var auditInfo = {
    eliminado: true,
    eliminadoPor: (S.currentUser&&S.currentUser.nombre)||'Administrador',
    eliminadoPorUid: (S.currentUser&&S.currentUser.uid)||'',
    eliminadoEn: new Date().toISOString(),
    eliminadoRazon: razon
  };
  closeM();
  if(window._delAuditCallback) window._delAuditCallback(auditInfo);
  window._delAuditCallback = null;
}

function auditBadge(item){
  if(!item||!item.eliminado) return '';
  var por = item.eliminadoPor || 'Admin';
  var razon = item.eliminadoRazon || '';
  var fecha = item.eliminadoEn ? item.eliminadoEn.split('T')[0] : '';
  return '<div style="background:var(--reds);border:1px solid rgba(240,75,106,0.3);border-radius:6px;padding:4px 9px;font-size:10px;display:flex;align-items:center;gap:6px;margin-top:4px">'
    +'<span style="font-weight:900;color:var(--red)">Del ELIMINADO</span>'
    +'<span style="color:var(--ink3)">por <strong>'+por+'</strong>'+(fecha?' · '+fecha:'')+(razon?' · '+razon:'')+'</span>'
    +'</div>';
}

// CLIENTE CRUD
// ══════════════════════════════════════════

// ═══ RESTAURAR PAGO ELIMINADO ═══
// Logica de pagos, cobranza, mora y liquidaciones movida a logic/pagos.js.

// Logica de contratos y documentos legales movida a logic/contratos.js.

// Logica de egresos movida a logic/egresos.js.

// Logica de alertas, recibos, facturas y libro SENIAT movida a logic/facturacion.js.

// Logica de comisiones movida a logic/comisiones.js.

function closeM(){
  $('ov').style.display='none';
  $('modal-box').className='modal';
  $('mft').style.display='';
  if($('mbd')) $('mbd').style.padding='';
  $('mft').innerHTML=`<button class="btn btn-g" onclick="closeM()">Cancelar</button><button class="btn btn-p" onclick="saveM()">Guardar</button>`;
  if(typeof flushRealtimeRender === 'function') flushRealtimeRender();
}
function saveM(){if(S.saveFn)S.saveFn();}
function topAct(){
  var p=S.page;
  // Solicitud es el punto de entrada único para clientes + motos + financiamientos
  if(p==='dash') openAddCred();
  else if(p==='centro') openWtTask();
  else if(p==='clientes') openAddCred();
  else if(p==='creditos') openAddCred();
  // Inventario de motos: sí se pueden agregar unidades sueltas al stock
  else if(p==='motos') openAddMoto();
  // Operaciones
  else if(p==='pagos') openAddPago();
  else if(p==='conta') openAddEgreso();
  else if(p==='cuentas') openDeposito(null);
  else if(p==='plan') openAddCatalogo();
  else if(p==='cobranza') openAddPago();
  else if(p==='contratos') openAddCred();
}

// Map pages to button labels (empty = hide button)
var TOP_BTN_LABELS = {
  dash: 'Nueva Solicitud',
  centro: 'Nueva tarea',
  clientes: 'Nueva Solicitud',
  creditos: 'Nueva Solicitud',
  contratos: 'Nueva Solicitud',
  motos: 'Nueva Unidad al Inventario',
  pagos: 'Registrar Pago',
  conta: 'Nuevo Egreso',
  cuentas: 'Depositar',
  plan: 'Agregar Modelo',
  cobranza: 'Registrar Pago',
};

function updateTopbar(){
  var p = S.page;
  // + Nuevo button
  var btn = $('topNewBtn');
  var label = $('topNewLabel');
  var lbl = TOP_BTN_LABELS[p];
  if(btn){
    if(lbl){ btn.style.display=''; label.textContent=lbl; }
    else { btn.style.display='none'; }
  }
  // Notification dot
  var mora = S.creds.filter(function(c){return c.mora>0;}).length;
  var pend = S.pagos.filter(function(p){return p.estado==='pendiente';}).length;
  var dot = $('notif-dot');
  if(dot){
    dot.style.display = (mora+pend>0) ? '' : 'none';
    dot.textContent = '';
  }
  // Notification bell badge in mobile
  updateBadge();
}
function toast(msg,type='info'){
  const c=$('toasts'),t=document.createElement('div');t.className=`toast ${type}`;
  const ic={success:'✓',error:'OFF',info:'ℹ️',warn:''};
  t.innerHTML=`<span>${ic[type]||'ℹ️'}</span><span>${msg}</span>`;c.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(12px)';t.style.transition='all .26s';},3000);
  setTimeout(()=>t.remove(),3300);
}

// GUARDAR CONFIGURACIÓN


// Mora auto recalculation — refresh every 5 minutes while app is open
(function(){
  function autoMora(){ if(typeof calcularMoraAuto==='function' && S.creds && S.creds.length) calcularMoraAuto(); }
  setInterval(autoMora, 5*60*1000);
})();

function recargarDesdeFirebase(){
  if(!db){
    toast('Firebase no está configurado','error');
    return;
  }
  if(!confirm('¿Limpiar el caché local y recargar todos los valores desde Firebase?\n\nSe descartarán los cambios sin guardar en pantalla.')) return;

  toast('Sincronizando con Firebase...','info');

  // 1) Limpiar caché en memoria de configuración
  try {
    _empresa = { nombre:'Pagasi', rif:'J-00000000-0', ciudad:'Caracas', tel:'', email:'', direccion:'', representante:'', repCI:'' };
    _cuentasBanc = [];
    _cobradores = ['Juan Admin'];
    window._tasaBsGlobal = 1;
    window._planesExtra = [];
  } catch(e){ /* variables pueden no estar definidas todavía */ }

  // 2) Limpiar caché de motos en localStorage para forzar lectura limpia
  try {
    if(typeof localStorage !== 'undefined'){
      localStorage.removeItem('motosCache');
      localStorage.removeItem('motosCacheV2');
    }
  } catch(e){}

  // 3) Recargar configuraciones específicas desde Firestore
  var tareas = [];

  // Empresa
  tareas.push(
    db.collection('config').doc('empresa').get().then(function(doc){
      if(doc.exists){
        var d = doc.data() || {};
        _empresa = {
          nombre: d.nombre || 'Pagasi',
          rif: d.rif || 'J-00000000-0',
          ciudad: d.ciudad || 'Caracas',
          tel: d.tel || '',
          email: d.email || '',
          direccion: d.direccion || '',
          representante: d.representante || '',
          repCI: d.repCI || ''
        };
      }
    })
  );

  // Tasa Bs
  tareas.push(
    db.collection('config').doc('tasa').get().then(function(doc){
      if(doc.exists && doc.data().tasaBs) window._tasaBsGlobal = doc.data().tasaBs;
    })
  );

  // Cuentas bancarias
  tareas.push(
    db.collection('config').doc('cuentasBanc').get().then(function(doc){
      var lista = (doc.exists && doc.data().lista) ? doc.data().lista : [];
      if(typeof renderCuentasBanc === 'function') renderCuentasBanc(lista);
      else _cuentasBanc = lista;
    })
  );

  // Cobradores
  tareas.push(
    db.collection('config').doc('cobradores').get().then(function(doc){
      var lista = (doc.exists && doc.data().lista) ? doc.data().lista : ['Juan Admin'];
      if(typeof renderCobradores === 'function') renderCobradores(lista);
      else _cobradores = lista;
    })
  );

  // Score config
  tareas.push(
    db.collection('config').doc('score').get().then(function(doc){
      if(doc.exists && typeof SCORE_CFG !== 'undefined'){
        var d = doc.data() || {};
        Object.keys(d).forEach(function(k){ SCORE_CFG[k] = d[k]; });
      }
    }).catch(function(){})
  );

  // Roles y permisos personalizados
  tareas.push(
    db.collection('config').doc('rolesPermisos').get().then(function(doc){
      if(doc.exists && typeof ROL_PERMISOS !== 'undefined'){
        var d = doc.data() || {};
        Object.keys(d).forEach(function(rol){
          if(Array.isArray(d[rol])) ROL_PERMISOS[rol] = d[rol];
        });
      }
    }).catch(function(){})
  );

  // 4) Recargar todos los datos principales (motos, clientes, créditos, pagos, etc.)
  // a través de DB.load() — recarga PLAN, CATALOGO, planes extra, etc.
  tareas.push(
    (typeof DB !== 'undefined' && DB.load) ? DB.load() : Promise.resolve()
  );

  Promise.all(tareas).then(function(){
    toast('✓ Datos recargados desde Firebase','success');
    // Re-render de la página actual para reflejar los nuevos valores
    if(typeof nav === 'function' && S && S.page){
      nav(S.page);
    } else if(typeof nav === 'function'){
      nav('config');
    }
  }).catch(function(e){
    toast('Error al sincronizar: '+(e&&e.message||e),'error');
  });
}

// PUNTO 1 — FINIQUITO DE CONTRATO
// ══════════════════════════════════════════
// Logica de finiquitos, PDFs, CSV, paginacion y reportes movida a logic/reportes.js.

// Logica de cuentas, movimientos, historial y pendientes movida a logic/cuentas.js.

function init() {
  // Mostrar el contenedor principal
  var appRoot = $('app-root');
  if (appRoot) appRoot.style.display = 'flex';

  // Defensa: cerrar cualquier overlay de perfil que haya quedado abierto
  var profOverlay = document.getElementById('profile-overlay');
  if(profOverlay) profOverlay.style.display = 'none';
  document.body.style.overflow = '';

  cargarHistorialNotificaciones();

  // Pre-cargar usuarios desde Firestore para que getCobradoresList() tenga datos
  // disponibles desde el inicio (ej: al abrir modal de pago sin haber visitado Usuarios)
  try {
    if(DB && DB.getUsuarios){
      DB.getUsuarios().then(function(arr){
        if(Array.isArray(arr)){
          if(typeof _usersCache !== 'undefined') _usersCache = arr;
          if(S && (!S._wtUsers || !S._wtUsers.length)) S._wtUsers = arr;
        }
      }).catch(function(e){ console.warn('Pre-carga usuarios init:', e); });
    }
  } catch(e){}

  // Cargar datos desde Firebase o usar datos locales de demostración
  DB.load().then(function() {
    // ── Migración única: créditos existentes (sin contratoFirmado) → confirmados automáticamente ──
    // Los créditos creados ANTES de esta versión ya tienen historial contable,
    // así que se marcan como firmados sin tocar nada más.
    (function _migrarContratoFirmado(){
      try {
        (S.creds||[]).forEach(function(c){
          if(c && !c.eliminado && c.contratoFirmado === undefined){
            c.contratoFirmado = true;
            c.fechaContratoFirmado = c.fecha || (c.creado||'').split('T')[0] || '';
            if(DB && DB.updateCred) DB.updateCred(c.id, { contratoFirmado: true, fechaContratoFirmado: c.fechaContratoFirmado });
          }
        });
      } catch(e){ console.warn('migrarContratoFirmado error:', e); }
    })();
    renderSidebar();
    // Vendedor Concesionario → calculadora (motos). Otros roles → dashboard.
    var paginaInicial = isVendedorConcesionarioRole() ? 'motos' : 'dash';
    if(!hasModuleAccess(paginaInicial)){
      // Fallback: ir al primer módulo accesible
      var candidatos = ['motos','clientes','creditos','dash','centro'];
      paginaInicial = candidatos.find(function(p){ return hasModuleAccess(p); }) || 'dash';
    }
    nav(paginaInicial);
    updateBadge();
    startRealtime();
    iniciarListenerSolicitudes();
    // BCV Auto — actualizar tasa diariamente si es necesario
    if(typeof bcvAutoInit === 'function') setTimeout(bcvAutoInit, 1500);
    var isMob = window.innerWidth <= 820;
    var mobBar = $('mobile-topbar');
    var deskBar = $('desktop-topbar');
    if (mobBar) mobBar.style.display = isMob ? 'flex' : 'none';
    if (deskBar) deskBar.style.display = isMob ? 'none' : 'flex';
  }).catch(function(e) {
    console.warn('Error cargando datos:', e);
    renderSidebar();
    var paginaInicial = isVendedorConcesionarioRole() ? 'motos' : 'dash';
    nav(paginaInicial);
    updateBadge();
    startRealtime();
    iniciarListenerSolicitudes();
  });
}

// ── AUTENTICACIÓN ──────────────────────────────────────────
var _doLoginInProgress = false;
async function doLogin() {
  // Guard: prevent concurrent/loop calls
  if (_doLoginInProgress) return;
  _doLoginInProgress = true;
  setTimeout(function(){ _doLoginInProgress = false; }, 4000);

  // Read from whichever login form is visible
  var loginScreen = $('login-screen');
  var inviteScreen = $('invite-screen');
  var usingInvite = inviteScreen && inviteScreen.style.display !== 'none';
  var email = usingInvite
    ? (($('l_user_inv') || {}).value || '').trim()
    : (($('l_user') || {}).value || '').trim();
  var pass = usingInvite
    ? (($('l_pass_inv') || {}).value || '').trim()
    : (($('l_pass') || {}).value || '').trim();
  var errEl = usingInvite ? $('login-err-inv') : $('login-err');
  if (errEl) errEl.style.display = 'none';

  // Validate email before hitting Firebase
  if (auth && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (errEl) { errEl.textContent = 'El email no tiene un formato válido.'; errEl.style.display = 'block'; }
    _doLoginInProgress = false;
    return;
  }

  if (!email || !pass) {
    if (errEl) { errEl.textContent = 'Ingresa tu email y contraseña.'; errEl.style.display = 'block'; }
    _doLoginInProgress = false;
    return;
  }

  if (!auth) {
    if (errEl) {
      errEl.textContent = 'Firebase Auth no esta disponible. Revisa la configuracion de Firebase.';
      errEl.style.display = 'block';
    }
    _doLoginInProgress = false;
    return;
  }
  showLoader('Iniciando sesión...', '');
  auth.signInWithEmailAndPassword(email, pass)
    .then(function() { hideLoader(); _doLoginInProgress = false; })
    .catch(function(e) {
      hideLoader();
      _doLoginInProgress = false;
      if (errEl) {
        if (e.code === 'auth/network-request-failed') {
          errEl.textContent = 'Sin conexión a internet. Verifica tu red e intenta de nuevo.';
          errEl.style.background = 'rgba(232,152,10,0.08)';
          errEl.style.borderColor = 'rgba(232,152,10,0.3)';
          errEl.style.color = 'var(--amber)';
        } else if (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
          errEl.textContent = 'Usuario o contraseña incorrectos.';
          errEl.style.background = '';
          errEl.style.borderColor = '';
          errEl.style.color = '';
        } else {
          errEl.textContent = 'Error: ' + (e.message || e.code);
          errEl.style.background = '';
          errEl.style.borderColor = '';
          errEl.style.color = '';
        }
        errEl.style.display = 'block';
      }
      console.warn('Login error:', e.code, e.message);
    });
}
window.doLogin = doLogin;


// ══════════════════════════════════════════════════
// BACKUP — Exportar e Importar datos
// ══════════════════════════════════════════════════


function showAdminProfile() {
  var user = S.currentUser || {};
  var nombre = user.nombre || user.email || 'Usuario';
  var email = (auth && auth.currentUser) ? auth.currentUser.email : (user.email || '—');
  var rol = user.rol || 'Administrador';
  var inicial = nombre.charAt(0).toUpperCase();

  // ── Stats del usuario actual ──
  var solCreadas = S.creds.filter(function(c){ return c.creadoPor === nombre; }).length;
  var misPagos = S.pagos.filter(function(p){ return !p.eliminado && p.cobrador === nombre; });
  var misPagosConf = misPagos.filter(function(p){ return p.estado==='confirmado'; });
  var pagosReg = misPagos.length;
  var totalCobrado = misPagosConf.reduce(function(a,p){ return a+(parseFloat(p.monto)||0); }, 0);
  var credsActivos = S.creds.filter(function(c){ return !c.eliminado && c.estado === 'activo'; }).length;
  var misClientes= new Set(misPagosConf.map(function(p){ return p.cli; })).size;

  // ── Chart: actividad últimas 12 semanas (pagos cobrados por el user) ──
  var hoyProf = new Date(); hoyProf.setHours(0,0,0,0);
  var semProf = [];
  for(var i=11;i>=0;i--){
    var ini = new Date(hoyProf); ini.setDate(hoyProf.getDate() - (i*7 + hoyProf.getDay()));
    var fin = new Date(ini); fin.setDate(ini.getDate()+6);
    var iniS = fechaLocalISO(ini);
    var finS = fechaLocalISO(fin);
    var tot = misPagosConf
      .filter(function(p){ return p.fecha>=iniS && p.fecha<=finS; })
      .reduce(function(a,p){ return a+p.monto; }, 0);
    semProf.push({lbl: String(ini.getDate()).padStart(2,'0')+'/'+String(ini.getMonth()+1).padStart(2,'0'), tot:tot});
  }
  var maxSemProf = Math.max(1, ...semProf.map(function(s){ return s.tot; }));

  // ── Top 5 clientes más atendidos ──
  var topClientesMap = {};
  misPagosConf.forEach(function(p){
    if(!topClientesMap[p.cli]) topClientesMap[p.cli] = {nombre:p.cli, total:0, count:0};
    topClientesMap[p.cli].total += p.monto;
    topClientesMap[p.cli].count++;
  });
  var topClientesList = Object.values(topClientesMap).sort(function(a,b){ return b.total-a.total; }).slice(0,5);

  // ── Actividad mes actual vs mes anterior ──
  var mesAct = hoyProf.getFullYear()+'-'+String(hoyProf.getMonth()+1).padStart(2,'0');
  var mesAnt = new Date(hoyProf.getFullYear(), hoyProf.getMonth()-1, 1);
  var mesAntK = mesAnt.getFullYear()+'-'+String(mesAnt.getMonth()+1).padStart(2,'0');
  var pagosMesAct = misPagosConf.filter(function(p){ return p.fecha && p.fecha.startsWith(mesAct); });
  var pagosMesAnt = misPagosConf.filter(function(p){ return p.fecha && p.fecha.startsWith(mesAntK); });
  var cobradoMesAct = pagosMesAct.reduce(function(a,p){return a+p.monto;}, 0);
  var cobradoMesAnt = pagosMesAnt.reduce(function(a,p){return a+p.monto;}, 0);
  var pctCrecimiento = cobradoMesAnt > 0 ? Math.round((cobradoMesAct-cobradoMesAnt)/cobradoMesAnt*100) : (cobradoMesAct>0?100:0);

  // Rol color
  var rolColors = {Administrador:'var(--p1)',Gerente:'var(--p2)',Empleado:'var(--green)',Vendedor:'var(--green)',Cobrador:'var(--green)',Contador:'var(--ink3)'};
  var rolColor = rolColors[rol] || 'var(--p1)';

  // Módulos accesibles
  var perms = isAdminUser() ? Object.keys(PGL) : (user.permisos || []);
  var modList = perms.filter(function(k){ return PGL[k]; }).map(function(k){ return PGL[k]; });

  // Overlay fullscreen
  var overlay = document.getElementById('profile-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'profile-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2000;background:var(--bg);overflow-y:auto;display:none';
    document.body.appendChild(overlay);
  }
  document.body.style.overflow = 'hidden';
  overlay.style.display = 'block';

  overlay.innerHTML =
    // Header
    '<div style="position:sticky;top:0;z-index:10;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border-bottom:1px solid var(--rim);padding:0 20px;height:56px;display:flex;align-items:center;gap:12px">'
    + '<button onclick="document.getElementById(\'profile-overlay\').style.display=\'none\';document.body.style.overflow=\'\'" style="width:32px;height:32px;border-radius:50%;border:1px solid var(--rim);background:var(--surf2);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;color:var(--ink3);flex-shrink:0">✕</button>'
    + '<div style="font-size:15px;font-weight:800;letter-spacing:-.3px;flex:1">Mi Perfil</div>'
    + '<button class="btn btn-d btn-sm" onclick="doLogout()" style="gap:6px">Cerrar sesión</button>'
    + '</div>'

    // Body
    + '<div style="max-width:900px;margin:0 auto;padding:24px 20px 80px">'

    // Avatar card con gradient
    + '<div style="background:var(--grad);border-radius:16px;padding:24px;margin-bottom:14px;display:flex;align-items:center;gap:20px;color:#fff;box-shadow:0 10px 40px rgba(37,99,235,.2)">'
      + '<div style="width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.25);backdrop-filter:blur(10px);border:3px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;color:#fff;flex-shrink:0">'+ inicial +'</div>'
      + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:22px;font-weight:900;letter-spacing:-.4px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+ nombre +'</div>'
        + '<div style="font-size:13px;opacity:.85;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+ email +'</div>'
        + '<span style="display:inline-block;background:rgba(255,255,255,.25);color:#fff;font-size:11px;font-weight:800;padding:4px 14px;border-radius:20px;letter-spacing:.3px;backdrop-filter:blur(10px)">'+ rol.toUpperCase() +'</span>'
      + '</div>'
    + '</div>'

    // 6 KPI stats
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px;margin-bottom:14px">'
      + _profKpi('Cobrado total', fmt(totalCobrado), 'var(--green)', 'TOT')
      + _profKpi('Este mes', fmt(cobradoMesAct), pctCrecimiento>=0?'var(--p1)':'var(--red)', (pctCrecimiento>=0?'↑':'↓')+' '+Math.abs(pctCrecimiento)+'%')
      + _profKpi('Pagos registrados', pagosReg, 'var(--p1)', 'PAG')
      + _profKpi('Solicitudes creadas', solCreadas, 'var(--amber)', 'SOL')
      + _profKpi('Clientes atendidos', misClientes, 'var(--green)', 'CLI')
      + _profKpi('Créditos activos', credsActivos, 'var(--p1)', 'ACT')
    + '</div>'

    // ── Mi información editable ──
    + '<div class="card" style="margin-bottom:14px;padding:18px 20px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">'
        + '<div><div style="font-size:14px;font-weight:800;color:var(--ink);letter-spacing:-.3px">Mi información</div>'
        + '<div style="font-size:11.5px;color:var(--ink3);margin-top:2px">Datos que puedes editar tú mismo</div></div>'
        + '<button id="prof-save-btn" class="btn btn-p btn-sm" onclick="guardarMiPerfil()" style="display:none">Guardar cambios</button>'
      + '</div>'
      // ─── Datos personales ───
      + '<div style="font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);margin-bottom:10px">Datos personales</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;margin-bottom:18px">'
        + '<div class="fg"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Nombre completo</label>'
        +   '<input class="fi" id="prof-nombre" type="text" value="'+(user.nombre||'').replace(/"/g,'&quot;')+'" oninput="profProfileChanged()" placeholder="Tu nombre completo"></div>'
        + '<div class="fg"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Cédula</label>'
        +   '<input class="fi" id="prof-cedula" type="text" value="'+(user.cedula||'').replace(/"/g,'&quot;')+'" oninput="profProfileChanged()" placeholder="V-12345678"></div>'
        + '<div class="fg"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Género</label>'
        +   '<select class="fs" id="prof-genero" onchange="profProfileChanged()">'
        +     '<option value=""'+(!user.genero?' selected':'')+'>— Selecciona —</option>'
        +     '<option value="M"'+(user.genero==='M'?' selected':'')+'>Masculino</option>'
        +     '<option value="F"'+(user.genero==='F'?' selected':'')+'>Femenino</option>'
        +   '</select>'
        +   '<div style="font-size:10.5px;color:var(--ink3);margin-top:4px;line-height:1.4">Personaliza el color del cumpleaños.</div></div>'
        + '<div class="fg"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Cumpleaños</label>'
        +   '<input class="fi" id="prof-cumple" type="date" value="'+(user.cumpleanos||user.fechaNacimiento||'')+'" oninput="profProfileChanged()">'
        +   '<div style="font-size:10.5px;color:var(--ink3);margin-top:4px;line-height:1.4">El día que cumplas se lanzará un cotillón.</div></div>'
        + '<div class="fg"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Estado civil</label>'
        +   '<select class="fs" id="prof-estadocivil" onchange="profProfileChanged()">'
        +     '<option value=""'+(!user.estadoCivil?' selected':'')+'>— Selecciona —</option>'
        +     '<option value="soltero"'+(user.estadoCivil==='soltero'?' selected':'')+'>Soltero/a</option>'
        +     '<option value="casado"'+(user.estadoCivil==='casado'?' selected':'')+'>Casado/a</option>'
        +     '<option value="union"'+(user.estadoCivil==='union'?' selected':'')+'>Unión estable</option>'
        +     '<option value="divorciado"'+(user.estadoCivil==='divorciado'?' selected':'')+'>Divorciado/a</option>'
        +     '<option value="viudo"'+(user.estadoCivil==='viudo'?' selected':'')+'>Viudo/a</option>'
        +   '</select></div>'
        + '<div class="fg"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Sede / Oficina</label>'
        +   '<input class="fi" id="prof-sede" type="text" value="'+(user.sede||'').replace(/"/g,'&quot;')+'" oninput="profProfileChanged()" placeholder="EK Bello Monte, Boleita..."></div>'
      + '</div>'

      // ─── Contacto ───
      + '<div style="font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);margin-bottom:10px">Contacto</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;margin-bottom:18px">'
        + '<div class="fg"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Teléfono</label>'
        +   '<input class="fi" id="prof-tel" type="tel" value="'+(user.tel||user.telefono||'').replace(/"/g,'&quot;')+'" oninput="profProfileChanged()" placeholder="+58 414 ..."></div>'
        + '<div class="fg"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Tel. alternativo</label>'
        +   '<input class="fi" id="prof-tel2" type="tel" value="'+(user.tel2||'').replace(/"/g,'&quot;')+'" oninput="profProfileChanged()" placeholder="Casa o familiar (opcional)"></div>'
        + '<div class="fg" style="grid-column:1 / -1"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Dirección</label>'
        +   '<input class="fi" id="prof-direccion" type="text" value="'+(user.direccion||'').replace(/"/g,'&quot;')+'" oninput="profProfileChanged()" placeholder="Sector, calle, residencia, piso..."></div>'
        + '<div class="fg" style="grid-column:1 / -1"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Contacto de emergencia</label>'
        +   '<input class="fi" id="prof-emergencia" type="text" value="'+(user.emergencia||'').replace(/"/g,'&quot;')+'" oninput="profProfileChanged()" placeholder="Nombre y teléfono"></div>'
        + '<div class="fg" style="grid-column:1 / -1"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Email (no editable)</label>'
        +   '<input class="fi" type="email" value="'+email+'" disabled style="background:var(--surf2);color:var(--ink3)"></div>'
      + '</div>'

      // ─── Redes sociales ───
      + '<div style="font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);margin-bottom:10px">Redes sociales</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">'
        + '<div class="fg"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Instagram</label>'
        +   '<input class="fi" id="prof-instagram" type="text" value="'+(user.instagram||'').replace(/"/g,'&quot;')+'" oninput="profProfileChanged()" placeholder="@tuusuario"></div>'
        + '<div class="fg"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Facebook</label>'
        +   '<input class="fi" id="prof-facebook" type="text" value="'+(user.facebook||'').replace(/"/g,'&quot;')+'" oninput="profProfileChanged()" placeholder="usuario o URL"></div>'
        + '<div class="fg"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">TikTok</label>'
        +   '<input class="fi" id="prof-tiktok" type="text" value="'+(user.tiktok||'').replace(/"/g,'&quot;')+'" oninput="profProfileChanged()" placeholder="@tuusuario"></div>'
        + '<div class="fg"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">X (Twitter)</label>'
        +   '<input class="fi" id="prof-twitter" type="text" value="'+(user.twitter||'').replace(/"/g,'&quot;')+'" oninput="profProfileChanged()" placeholder="@tuusuario"></div>'
        + '<div class="fg" style="grid-column:1 / -1"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">LinkedIn</label>'
        +   '<input class="fi" id="prof-linkedin" type="text" value="'+(user.linkedin||'').replace(/"/g,'&quot;')+'" oninput="profProfileChanged()" placeholder="linkedin.com/in/tuusuario"></div>'
      + '</div>'
    + '</div>'

    // Chart: cobros últimas 12 semanas
    + '<div style="background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:18px;margin-bottom:14px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
        + '<div><div style="font-size:14px;font-weight:800">Mi actividad de cobros</div><div style="font-size:11.5px;color:var(--ink3)">Últimas 12 semanas</div></div>'
        + '<div style="font-weight:900;font-size:15px;color:var(--green)">'+ fmt(semProf.reduce(function(a,s){return a+s.tot;}, 0)) +'</div>'
      + '</div>'
      + (misPagosConf.length > 0
        ? '<div style="display:flex;align-items:flex-end;gap:4px;height:140px">'
          + semProf.map(function(s,i){
              return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">'
                + '<div style="font-size:9px;font-weight:800;color:'+(s.tot>0?'var(--green)':'var(--ink3)')+';height:14px">'+(s.tot>0?fmt(s.tot).replace('$','$').slice(0,7):'')+'</div>'
                + '<div style="flex:1;width:100%;display:flex;align-items:flex-end">'
                  + '<div style="width:100%;background:'+(i===semProf.length-1?'var(--p1)':s.tot>0?'var(--green)':'var(--rim)')+';border-radius:4px 4px 0 0;height:'+(s.tot>0?Math.max(8,Math.round(s.tot/maxSemProf*110)):4)+'px"></div>'
                + '</div>'
                + '<div style="font-size:9px;color:var(--ink3);font-weight:600">'+s.lbl+'</div>'
              + '</div>';
            }).join('')
        + '</div>'
        : '<div style="text-align:center;padding:40px 0;color:var(--ink3);font-size:12.5px">Aún no tienes pagos registrados a tu nombre</div>')
    + '</div>'

    // Top clientes
    + (topClientesList.length > 0
      ? '<div style="background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:18px;margin-bottom:14px">'
        + '<div style="font-size:14px;font-weight:800;margin-bottom:12px">Tus top 5 clientes <span style="color:var(--ink3);font-weight:500;font-size:11.5px">· por monto cobrado</span></div>'
        + topClientesList.map(function(c,i){
            var pct = totalCobrado>0 ? Math.round(c.total/totalCobrado*100) : 0;
            return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--rim2)">'
              + '<div style="width:28px;height:28px;border-radius:8px;background:var(--grad);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;flex-shrink:0">'+(i+1)+'</div>'
              + '<div style="flex:1;min-width:0">'
                + '<div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+c.nombre+'</div>'
                + '<div style="font-size:10.5px;color:var(--ink3)">'+c.count+' pago'+(c.count!==1?'s':'')+'</div>'
              + '</div>'
              + '<div style="text-align:right;flex-shrink:0">'
                + '<div style="font-size:13.5px;font-weight:900;color:var(--green)">'+fmt(c.total)+'</div>'
                + '<div style="font-size:10.5px;color:var(--ink3)">'+pct+'% de total</div>'
              + '</div>'
            + '</div>';
          }).join('')
      + '</div>'
      : '')

    // Módulos accesibles
    + '<div style="background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:18px;margin-bottom:14px">'
      + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--ink3);margin-bottom:12px">Módulos con acceso</div>'
      + (isAdminUser()
          ? '<div style="display:flex;flex-wrap:wrap;gap:6px"><span style="background:var(--gs);color:var(--p1);font-size:11.5px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid var(--rim2)">Acceso total al sistema</span></div>'
          : (modList.length
            ? '<div style="display:flex;flex-wrap:wrap;gap:6px">'
              + modList.map(function(m){ return '<span style="background:var(--surf2);color:var(--ink2);font-size:11.5px;font-weight:600;padding:4px 11px;border-radius:20px;border:1px solid var(--rim)">'+m+'</span>'; }).join('')
              + '</div>'
            : '<div style="color:var(--ink3);font-size:13px">Solo nueva solicitud</div>'))
    + '</div>'

    // Info de sesión
    + '<div style="background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:18px;margin-bottom:14px">'
      + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--ink3);margin-bottom:12px">Información de sesión</div>'
      + [
          ['Firebase', db ? '● Conectado · '+(FIREBASE_CONFIG.projectId||'firebase') : '● Sin conexión', db ? 'var(--green)' : 'var(--red)'],
          ['Email', email, 'var(--ink)'],
          ['UID', (auth && auth.currentUser && auth.currentUser.uid) ? auth.currentUser.uid.slice(0,20)+'…' : '--', 'var(--ink3)'],
          ['Último acceso', (auth && auth.currentUser && auth.currentUser.metadata && auth.currentUser.metadata.lastSignInTime) ? new Date(auth.currentUser.metadata.lastSignInTime).toLocaleString('es-VE') : '—', 'var(--ink3)'],
        ].map(function(row){
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--rim2)">'
            + '<span style="font-size:12.5px;color:var(--ink3)">'+ row[0] +'</span>'
            + '<span style="font-size:12.5px;font-weight:600;color:'+ row[2] +'">'+ row[1] +'</span>'
            + '</div>';
        }).join('')
    + '</div>'

    // Cambiar contraseña
    + '<div style="background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:18px;margin-bottom:14px">'
      + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--ink3);margin-bottom:14px">Cambiar Contraseña</div>'
      + '<div style="display:flex;flex-direction:column;gap:10px">'
        + '<div class="fg"><label>Contraseña actual</label><input id="prof-pass-current" type="password" class="fi" placeholder="Tu contraseña actual" autocomplete="current-password" style="width:100%"></div>'
        + '<div class="fg"><label>Nueva contraseña</label><input id="prof-pass1" type="password" class="fi" placeholder="Mínimo 6 caracteres" autocomplete="new-password" style="width:100%"></div>'
        + '<div class="fg"><label>Confirmar contraseña</label><input id="prof-pass2" type="password" class="fi" placeholder="Repetir contraseña" autocomplete="new-password" style="width:100%"></div>'
        + '<div id="prof-msg" style="display:none;font-size:12px;padding:9px 12px;border-radius:9px"></div>'
        + '<button class="btn btn-p btn-sm" onclick="cambiarPasswordPerfil()" style="align-self:flex-start">Actualizar contraseña</button>'
      + '</div>'
    + '</div>'

    // Cerrar sesión
    + '<button class="btn btn-d" onclick="doLogout()" style="width:100%;justify-content:center;padding:12px;border-radius:12px;font-size:13.5px">Cerrar sesión</button>'

    + '</div>'; // end body
}

function _profKpi(label, val, color, badge){
  return '<div class="stat" style="border-left:3px solid '+color+'">'
    + '<div class="st-ic" style="background:var(--gs);color:'+color+';font-size:9px;font-weight:800">'+badge+'</div>'
    + '<div class="st-v" style="color:'+color+';font-size:17px">'+val+'</div>'
    + '<div class="st-l">'+label+'</div>'
  + '</div>';
}

function cambiarPasswordPerfil() {
  var pCur = ($('prof-pass-current') || {}).value || '';
  var p1 = ($('prof-pass1') || {}).value || '';
  var p2 = ($('prof-pass2') || {}).value || '';
  var msg = $('prof-msg');
  function showMsg(txt, ok) {
    if (!msg) return;
    msg.style.display = 'block';
    msg.style.background = ok ? 'rgba(39,174,96,0.12)' : 'rgba(231,76,60,0.12)';
    msg.style.color = ok ? '#27ae60' : '#e74c3c';
    msg.textContent = txt;
  }
  if (!pCur) return showMsg(' Ingresá tu contraseña actual', false);
  if (p1.length < 6) return showMsg(' La contraseña debe tener al menos 6 caracteres', false);
  if (p1 !== p2) return showMsg('Las contraseñas no coinciden', false);
  var user = auth && auth.currentUser;
  if (!user) return showMsg(' No hay sesión activa', false);
  if (!user.email) return showMsg(' El usuario no tiene email asociado', false);

  showMsg('Verificando…', true);

  // Reautenticar con la contraseña actual y luego actualizar
  var credential = firebase.auth.EmailAuthProvider.credential(user.email, pCur);
  user.reauthenticateWithCredential(credential)
    .then(function() {
      return user.updatePassword(p1);
    })
    .then(function() {
      showMsg('✓ Contraseña actualizada correctamente', true);
      if ($('prof-pass-current')) $('prof-pass-current').value = '';
      if ($('prof-pass1')) $('prof-pass1').value = '';
      if ($('prof-pass2')) $('prof-pass2').value = '';
    })
    .catch(function(e) {
      var code = e && e.code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        showMsg(' La contraseña actual es incorrecta', false);
      } else if (code === 'auth/too-many-requests') {
        showMsg(' Demasiados intentos. Esperá un momento e intentá de nuevo.', false);
      } else if (code === 'auth/weak-password') {
        showMsg(' La nueva contraseña es demasiado débil', false);
      } else if (code === 'auth/network-request-failed') {
        showMsg(' Error de conexión. Verificá tu internet.', false);
      } else {
        showMsg(' ' + (e.message || 'Error al actualizar'), false);
      }
    });
}

function doLogout() {
  // Log antes de cerrar (mientras S.currentUser aún existe)
  try { if(typeof logActividad === 'function') logActividad('logout','auth',(S.currentUser&&S.currentUser.uid)||'',null); } catch(e){}
  // Cerrar perfil overlay si está abierto
  var overlay = document.getElementById('profile-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
  if(typeof stopRealtime === 'function') stopRealtime();
  if (auth) {
    auth.signOut();
  } else {
    location.reload();
  }
}

// ── Mobile Menu ──────────────────────────
function openMobileMenu(){
  var sidebarEl = document.querySelector('.sb') || document.querySelector('.sidebar');
  var ov = $('sb-overlay');
  if(sidebarEl) { sidebarEl.classList.add('mob-open'); sidebarEl.classList.add('open'); }
  if(ov) { ov.style.display = 'block'; ov.classList.add('open'); }
  document.body.style.overflow = 'hidden';
}
function closeMobileMenu(){
  var sidebarEl = document.querySelector('.sb') || document.querySelector('.sidebar');
  var ov = $('sb-overlay');
  if(sidebarEl) { sidebarEl.classList.remove('mob-open'); sidebarEl.classList.remove('open'); }
  if(ov) { ov.style.display = 'none'; ov.classList.remove('open'); }
  document.body.style.overflow = '';
}

// Cerrar menú automáticamente al navegar en móvil
(function(){
  if(typeof window.nav !== 'function') return;
  var _origNav = window.nav;
  window.nav = function(){
    var r = _origNav.apply(this, arguments);
    if(window.innerWidth <= 820) closeMobileMenu();
    return r;
  };
})();

// ══════════════════════════════════════════
// MOBILE BOTTOM NAV & SEARCH
// ══════════════════════════════════════════
function mbbSelect(page){
  document.querySelectorAll('.mbb-btn').forEach(function(b){ b.classList.remove('on'); });
  var btn = $('mbb-'+page);
  if(btn) btn.classList.add('on');
}

function updateMobileNav(){
  var page = S.page;

  // Empleado (incluye legacy Cobrador/Vendedor): bottom nav especializado
  var mbb = $('mob-bottom-bar');
  if(mbb){
    if(isEmpleadoRole()){
      mbb.innerHTML = ''
        +'<button class="mbb-btn'+(page==='dash'?' on':'')+'" onclick="nav(\'dash\');mbbSelect(\'dash\')">'
        +'<span class="mbb-ic">DB</span><span>Inicio</span></button>'
        +'<button class="mbb-btn'+(page==='cobranza'?' on':'')+'" onclick="nav(\'cobranza\');mbbSelect(\'cobranza\')">'
        +'<span class="mbb-ic">COB</span><span>Cobranza</span></button>'
        +'<button class="mbb-btn" onclick="openAddCred()" style="color:var(--p1)">'
        +'<span class="mbb-ic" style="background:var(--p1);color:#fff">＋</span><span>Solicitud</span></button>'
        +'<button class="mbb-btn'+(page==='creditos'?' on':'')+'" onclick="nav(\'creditos\');mbbSelect(\'creditos\')">'
        +'<span class="mbb-ic">SOL</span><span>Solicitudes</span></button>';
      return;
    }
  }

  var mapped = {dash:'dash', clientes:'clientes', creditos:'creditos'};
  mbbSelect(mapped[page] || 'more');
}

function openMobSearch(){
  var el = $('mob-search-overlay');
  if(el){ el.classList.add('open'); setTimeout(function(){ var inp=$('mob-srch-input'); if(inp) inp.focus(); },100); }
}

function closeMobSearch(){
  var el = $('mob-search-overlay');
  if(el) el.classList.remove('open');
  var inp = $('mob-srch-input');
  if(inp) inp.value = '';
  var res = $('mob-srch-results');
  if(res) res.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--ink3);font-size:13px">Escribe para buscar en todo el sistema</div>';
}

function mobSearch(q){
  var val = q.trim().toLowerCase();
  var res = $('mob-srch-results');
  if(!res) return;
  if(!val){
    res.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--ink3);font-size:13px">Escribe para buscar en todo el sistema</div>';
    return;
  }
  var results = [];
  S.clientes.filter(c=>!c.eliminado).forEach(function(c){
    if((c.nombre+' '+c.cedula+' '+c.tel).toLowerCase().includes(val))
      results.push({icon:'CLI',titulo:c.nombre,sub:c.cedula+' · '+c.tel,fn:function(){ closeMobSearch(); nav('clientes'); setTimeout(function(){verCliente(c.id);},100); }});
  });
  S.creds.filter(c=>!c.eliminado).forEach(function(c){
    if((c.id+' '+c.cli+' '+c.modelo).toLowerCase().includes(val))
      results.push({icon:'≡',titulo:c.cli+' — '+c.modelo,sub:c.id+' · '+c.estado,fn:function(){ closeMobSearch(); nav('creditos'); setTimeout(function(){openAmort(c.id);},100); }});
  });
  S.motos.filter(m=>!m.eliminado).forEach(function(m){
    if((m.modelo+' '+(m.vin||'')+' '+(m.cliente||'')).toLowerCase().includes(val))
      results.push({icon:'MOT',titulo:m.modelo,sub:(m.vin||'Sin VIN')+' · '+m.estado,fn:function(){ closeMobSearch(); nav('motos'); }});
  });
  S.pagos.filter(p=>!p.eliminado).forEach(function(p){
    if((p.cli+' '+p.id).toLowerCase().includes(val))
      results.push({icon:'PAG',titulo:p.cli,sub:fmt(p.monto)+' · '+p.fecha,fn:function(){ closeMobSearch(); nav('pagos'); }});
  });
  window._mobSrchFns = results.map(function(r){ return r.fn; });
  if(!results.length){
    res.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--ink3);font-size:13px">Sin resultados para "'+q+'"</div>';
    return;
  }
  res.innerHTML = results.slice(0,15).map(function(r,i){
    return '<div onclick="window._mobSrchFns['+i+']()" style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--rim);cursor:pointer;-webkit-tap-highlight-color:transparent" onmousedown="event.preventDefault()">'+
      '<div style="width:36px;height:36px;border-radius:10px;background:var(--gs);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--p1);font-family:var(--fm);flex-shrink:0">'+r.icon+'</div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:14px;font-weight:600;color:var(--ink)">'+r.titulo+'</div>'+
        '<div style="font-size:11.5px;color:var(--ink3);margin-top:1px">'+r.sub+'</div>'+
      '</div>'+
      '<span style="color:var(--ink3);font-size:18px;font-weight:200">›</span>'+
    '</div>';
  }).join('');
}

// Responsive: ajustar topbars en resize
window.addEventListener('resize', function(){
  if (!$('app-root') || $('app-root').style.display === 'none') return;
  var isMob = window.innerWidth <= 820;
  var mobBar = $('mobile-topbar');
  var deskBar = $('desktop-topbar');
  if (mobBar) mobBar.style.display = isMob ? 'flex' : 'none';
  if (deskBar) deskBar.style.display = isMob ? 'none' : 'flex';
});

setTimeout(function(){ try{ if(window.S && Array.isArray(S.clientes) && Array.isArray(S.creds)) syncTodosEstadosClientes(); }catch(e){} }, 1200);
