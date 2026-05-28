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
function dispararCotillon(nombre, esTeammate){
  cerrarCotillon();
  // Inject animation styles
  if(!document.getElementById('cotillon-styles')){
    var s = document.createElement('style');
    s.id = 'cotillon-styles';
    s.textContent = '@keyframes cotIn{0%{transform:translate(-50%,-50%) scale(.7);opacity:0}55%{transform:translate(-50%,-50%) scale(1.05);opacity:1}100%{transform:translate(-50%,-50%) scale(1)}}@keyframes cotBackdrop{0%{opacity:0}100%{opacity:1}}@keyframes cotCake{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-6px) rotate(2deg)}}@keyframes cotShine{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}';
    document.head.appendChild(s);
  }

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
  var primerNombre = who ? who.split(' ')[0] : '';
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
  card.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100000;background:linear-gradient(145deg,#FFF7ED 0%,#FCE7F3 50%,#F3E8FF 100%);border-radius:32px;padding:0;width:90%;max-width:520px;box-shadow:0 30px 80px rgba(236,72,153,.32),0 0 0 1px rgba(255,255,255,.6);animation:cotIn .6s cubic-bezier(.34,1.56,.64,1) forwards;overflow:hidden';
  card.innerHTML = ''
    +'<div style="position:relative;padding:48px 32px 40px;text-align:center;overflow:hidden">'
      +'<div style="position:absolute;inset:0;background:linear-gradient(120deg,transparent 30%,rgba(255,255,255,.7) 50%,transparent 70%);animation:cotShine 2.5s ease-in-out infinite;pointer-events:none"></div>'
      +'<button onclick="cerrarCotillon()" style="position:absolute;top:14px;right:14px;width:34px;height:34px;border:none;background:rgba(255,255,255,.7);border-radius:50%;cursor:pointer;font-size:18px;font-weight:700;color:#831843;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);box-shadow:0 4px 12px rgba(0,0,0,.08);z-index:2" aria-label="Cerrar">×</button>'
      +'<div style="font-size:82px;line-height:1;margin-bottom:14px;animation:cotCake 2s ease-in-out infinite">🎂</div>'
      +'<div style="font-size:11px;font-weight:800;letter-spacing:.32em;text-transform:uppercase;color:#BE185D;margin-bottom:10px">'+_tagline+'</div>'
      +'<div style="font-size:32px;font-weight:900;color:#831843;letter-spacing:-1.2px;line-height:1.1;margin-bottom:8px">'+_titulo+'</div>'
      +'<div style="font-size:14.5px;color:#9D174D;font-weight:500;line-height:1.55;max-width:380px;margin:0 auto 22px">'+_subtitulo+'</div>'
      +'<button onclick="cerrarCotillon()" style="background:linear-gradient(135deg,#EC4899,#BE185D);color:#fff;border:none;padding:13px 32px;border-radius:50px;font-weight:800;font-size:14px;cursor:pointer;letter-spacing:.02em;box-shadow:0 8px 22px rgba(236,72,153,.42);transition:transform .15s">'+_btnTxt+'</button>'
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

async function guardarMiPerfil(){
  if(!S.currentUser || !S.currentUser.uid){
    if(typeof toast==='function') toast('No estás logueado','error');
    return;
  }
  var btn = document.getElementById('prof-save-btn');
  var nombre = (document.getElementById('prof-nombre')||{}).value || '';
  var cumple = (document.getElementById('prof-cumple')||{}).value || '';
  var tel = (document.getElementById('prof-tel')||{}).value || '';
  if(btn){ btn.disabled = true; btn.textContent = 'Guardando…'; }

  var update = {
    nombre: nombre.trim(),
    cumpleanos: cumple.trim(),
    tel: tel.trim(),
    actualizadoEn: new Date().toISOString()
  };

  try {
    if(db){
      await db.collection('usuarios').doc(S.currentUser.uid).set(update, {merge:true});
    }
    // Actualizar estado local también
    Object.assign(S.currentUser, update);
    // Sincronizar caché de usuarios para que la card de cumpleaños refleje cambios al instante
    try {
      if(typeof _usersCache !== 'undefined' && Array.isArray(_usersCache)){
        var idx = _usersCache.findIndex(function(u){ return u && u.uid === S.currentUser.uid; });
        if(idx >= 0) Object.assign(_usersCache[idx], update);
        else _usersCache.push(Object.assign({uid:S.currentUser.uid, email:S.currentUser.email||''}, update));
      }
      if(S._wtUsers && Array.isArray(S._wtUsers)){
        var idx2 = S._wtUsers.findIndex(function(u){ return u && u.uid === S.currentUser.uid; });
        if(idx2 >= 0) Object.assign(S._wtUsers[idx2], update);
        else S._wtUsers.push(Object.assign({uid:S.currentUser.uid, email:S.currentUser.email||''}, update));
      }
    } catch(e){ console.warn('cache sync miPerfil:', e); }
    // Actualizar sidebar si cambió el nombre
    if(typeof updateSidebarFooter==='function') updateSidebarFooter();
    if(typeof toast==='function') toast('✓ Perfil actualizado','success');
    if(btn){ btn.style.display='none'; btn.disabled=false; btn.textContent='Guardar cambios'; }
  } catch(e){
    console.error('Error guardando perfil:', e);
    if(typeof toast==='function') toast('Error: '+(e.message||e),'error');
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

      for(var i=0;i<fuentesNoticias.length;i++){
        try {
          var src = fuentesNoticias[i];
          var rr = await fetch(src.url);
          if(!rr.ok) continue;
          var dd = await rr.json();
          var arr = src.parse(dd);
          if(arr && arr.length){
            noticias = arr;
            console.log('[Noticias] Fuente', i+1, 'OK -', arr.length, 'items');
            break;
          }
        } catch(e){
          console.warn('[Noticias] Fuente', i+1, 'falló:', e.message);
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
    console.warn('[daily-'+tipo+'] falla red:', err);
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
    {col:'tareas', key:'tareas'}
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

function fechaLocalISO(value){
  var d = value ? new Date(value) : new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function hoyLocalISO(){ return fechaLocalISO(); }

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
        if(Array.isArray(catData.items) && catData.items.length){
          CATALOGO.splice(0, CATALOGO.length);
          catData.items.forEach(function(item){ CATALOGO.push(item); });
        }
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
      // ── Admin total (sin sedes asignadas) → SIEMPRE arranca con "Todos" ──
      // Solo restauramos el concesionario guardado si el usuario tiene sedes específicas
      // asignadas (no es admin total). Esto evita que el admin se quede pegado en una sede.
      try{
        var esAdminPuro = !S.currentUser || !(S.currentUser.concesionarios||[]).length;
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
      try{
        if(S.currentUser){
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
  if(Array.isArray(_catLs) && _catLs.length){ CATALOGO.splice(0, CATALOGO.length); _catLs.forEach(function(item){ CATALOGO.push(item); }); }
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
    var d = new Date(iso);
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
    var d = new Date(iso);
    if(isNaN(d.getTime())) return '';
    return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
  }catch(e){ return ''; }
}
const ini=n=>n.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
const sbg=s=>({activo:'b-g',mora:'b-r',recuperada:'b-a',recuperado:'b-a',disponible:'b-p',financiada:'b-p',inventario:'b-b',confirmado:'b-g',pendiente:'b-a',completado:'b-g',propia:'b-g',cancelado:'b-r'}[s]||'b-x');
const PGL={dash:'Dashboard',centro:'Centro de trabajo',clientes:'Clientes',motos:'Motocicletas',creditos:'Créditos',pagos:'Pagos',cobranza:'Cobranza',contratos:'Contratos',notif:'Notificaciones',reportes:'Finanzas',cuentas:'Cuentas',comisiones:'Comisiones',conta:'Finanzas',plan:'Plan & Precios',config:'Configuración',scores:'Scores',users:'Usuarios',concesionarios:'Concesionarios',aprobaciones:'Aprobaciones'};

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
  // Vendedor Concesionario: solo 3 módulos permitidos
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
        if(_asgn.length === 1){
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
  reportes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16l3-4 3 2 4-6"/></svg>',
  aprobaciones:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  cuentas:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a9 3 0 0 0 18 0a9 3 0 0 0-18 0"/><path d="M3 7v5a9 3 0 0 0 18 0V7"/><path d="M3 12v5a9 3 0 0 0 18 0v-5"/></svg>',
  comisiones:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  conta:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>',
  plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  config:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  scores:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/></svg>',
  users:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/></svg>',
  concesionarios:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/></svg>'
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
      {label:'Mi Trabajo', keys:['dash','centro']},
      {label:'Gestión', keys:['clientes','motos','creditos','pagos']},
      {label:'Operaciones',keys:['cobranza','contratos','notif']},
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
          var items = g.keys.filter(function(k){ return permsEmp.includes(k); });
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
      +'<button type="button" class="si" data-nav="motos" onclick="nav(\'motos\')"><span class="sic nav-ic">'+pgNavIcon('motos')+'</span><span>Calculadora</span></button>'
      +'<button type="button" class="si" data-nav="clientes" onclick="nav(\'clientes\')"><span class="sic nav-ic">'+pgNavIcon('clientes')+'</span><span>Clientes</span></button>'
      +'<button type="button" class="si" data-nav="creditos" onclick="nav(\'creditos\')"><span class="sic nav-ic">'+pgNavIcon('creditos')+'</span><span>Solicitudes</span></button>'
      +'</div>'
      +'</div>';
    sb.innerHTML = sidebarVC;
    updateSidebarFooter();
    return;
  }

  // Otros roles: filtrar módulos según permisos
  var perms = getCurrentPerms();
  var grupos = [
    {label:'Principal', keys:['dash','centro']},
    {label:'Gestión', keys:['clientes','motos','creditos','pagos']},
    {label:'Operaciones',keys:['cobranza','contratos','notif','aprobaciones']},
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
    var items = g.keys.filter(function(k){ return isAdminUser() || perms.includes(k); });
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
    var n=(S.tareas||[]).filter(function(t){return !t.eliminado && t.estado!=='completada' && (typeof wtIsMine!=='function' || wtIsMine(t));}).length;
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
  window._pages={}; // reset pagination on module change
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
          setTimeout(function(){
            if(typeof renderCredChart==='function') renderCredChart();
            if(typeof renderDashChart==='function' && !_dashChart) renderDashChart();
            if(typeof renderDashEgrChart==='function') renderDashEgrChart();
          }, 900);
          setTimeout(function(){
            if(typeof renderDashEgrChart==='function') renderDashEgrChart();
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
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start">'
        + '<div class="fg"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Nombre completo</label>'
        +   '<input class="fi" id="prof-nombre" type="text" value="'+(user.nombre||'').replace(/"/g,'&quot;')+'" oninput="profProfileChanged()" placeholder="Tu nombre completo"></div>'
        + '<div class="fg"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Cumpleaños</label>'
        +   '<input class="fi" id="prof-cumple" type="date" value="'+(user.cumpleanos||user.fechaNacimiento||'')+'" oninput="profProfileChanged()">'
        +   '<div style="font-size:10.5px;color:var(--ink3);margin-top:4px;line-height:1.4">Aparecerá en el dashboard cuando se acerque la fecha. El día que cumplas se lanzará un cotillón.</div></div>'
        + '<div class="fg"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Teléfono</label>'
        +   '<input class="fi" id="prof-tel" type="tel" value="'+(user.tel||user.telefono||'').replace(/"/g,'&quot;')+'" oninput="profProfileChanged()" placeholder="+58 414 ..."></div>'
        + '<div class="fg"><label style="font-size:11px;font-weight:700;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:5px;display:block">Email (no editable)</label>'
        +   '<input class="fi" type="email" value="'+email+'" disabled style="background:var(--surf2);color:var(--ink3)"></div>'
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
          ['Firebase', db ? '● Conectado · pagasi-b859b' : '● Sin conexión', db ? 'var(--green)' : 'var(--red)'],
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
