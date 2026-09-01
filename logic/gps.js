// Pagasi logic: gps — control de dispositivos de rastreo y sus lineas SIM.
// Reemplaza el Excel "PAGASI Control GPS_MASTER". Cada fila del Excel es un
// equipo: una SIM Movistar + un GPS + (cuando se instala) un credito.
//
// El mapa y el corte de motor quedan preparados pero inertes hasta que se
// conecte la API de MiCODUS: sin ella no hay posiciones que pintar ni canal
// por donde mandar el comando.

// ══════════════════════════════════════════════════════════════════
// DATOS
// ══════════════════════════════════════════════════════════════════

var GPS_ESTADOS = [
  {v:'stock',     l:'En stock',   c:'#64748B', d:'Equipo recibido, sin instalar'},
  {v:'instalado', l:'Instalado',  c:'#00B876', d:'Montado en una moto y asociado a un credito'},
  {v:'retirado',  l:'Retirado',   c:'#F59E0B', d:'Desmontado — credito cancelado o moto recuperada'},
  {v:'falla',     l:'Con falla',  c:'#F04B6A', d:'Equipo o linea con problema'}
];

function _gpsEstadoDef(v){
  var e = GPS_ESTADOS.find(function(x){ return x.v === String(v||'stock'); });
  return e || GPS_ESTADOS[0];
}

// Ids unicos aun creando 500 de golpe. Con Date.now()+aleatorio, importar el
// lote entero producia colisiones y unos equipos pisaban a otros al guardar.
var _gpsSeq = 0;
function _gpsNuevoId(){
  _gpsSeq++;
  return 'GPS-' + Date.now() + '-' + _gpsSeq.toString(36) + '-' +
         Math.floor(Math.random()*1296).toString(36);
}

function _gpsLista(){
  return (S.gps || []).filter(function(g){ return g && !g.eliminado; });
}

function _gpsById(id){
  if(!id) return null;
  return _gpsLista().find(function(g){ return g.id === id; }) || null;
}

// El equipo guarda solo el creditoId. Cliente, moto, placa y mora se leen del
// credito, para que no queden dos verdades como pasaba en el Excel.
function _gpsCredInfo(creditoId){
  if(!creditoId) return null;
  var c = (S.creds||[]).find(function(x){ return x && !x.eliminado && x.id === creditoId; });
  if(!c) return null;
  var dias = parseInt(c.mora, 10) || 0;
  return {
    cred: c,
    cliente: c.cli || '',
    modelo: c.modelo || c.marca || '',
    placa: c.placa || '',
    concesionarioId: c.concesionarioId || '',
    estado: String(c.estado || ''),
    diasMora: dias,
    enMora: dias > 0 || String(c.estado||'') === 'mora',
    vivo: ['cancelado','recuperado','recuperada'].indexOf(String(c.estado||'')) === -1
  };
}

// Creditos vigentes que deberian tener un equipo montado.
function _gpsCredsVivos(){
  return (S.creds||[]).filter(function(c){
    if(!c || c.eliminado) return false;
    var e = String(c.estado||'');
    return e !== 'cancelado' && e !== 'recuperado' && e !== 'recuperada'
        && e !== 'pendiente_revision' && e !== 'rechazado' && e !== 'rechazada';
  });
}

// ── Revision manual: mientras no haya API, alguien entra a MiCODUS y
// confirma que el equipo responde. Estos son los mismos campos que la
// API va a llenar sola despues, asi que nada de esto se tira.
var GPS_DIAS_REVISION = 15;

function _gpsDiasSinRevisar(g){
  var f = g && (g.ultimaRevision || g.fechaInstalacion);
  if(!f) return null;
  var d = new Date(String(f).slice(0,10) + 'T12:00:00');
  if(isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// Equipos instalados que llevan demasiado sin que nadie confirme que responden.
function _gpsSinRevisar(){
  return _gpsLista().filter(function(g){
    if(String(g.estado||'') !== 'instalado') return false;
    var d = _gpsDiasSinRevisar(g);
    return d === null || d > GPS_DIAS_REVISION;
  });
}

// Un equipo caido en un credito con mora es la peor combinacion: hay saldo
// vencido y la moto dejo de reportar.
function _gpsCaidosEnMora(){
  return _gpsLista().filter(function(g){
    if(String(g.estado||'') !== 'instalado') return false;
    var est = String(g.estadoMicodus||'').toUpperCase();
    var caido = est.indexOf('OFF') > -1 || est.indexOf('SIN SE') > -1 || est.indexOf('DESCON') > -1;
    if(!caido) return false;
    var info = _gpsCredInfo(g.creditoId);
    return info && info.enMora;
  });
}

// ══════════════════════════════════════════════════════════════════
// COBERTURA — que creditos vivos NO tienen equipo
// ══════════════════════════════════════════════════════════════════

function _gpsCobertura(){
  var vivos = _gpsCredsVivos();
  var conEquipo = {};
  _gpsLista().forEach(function(g){
    if(g.creditoId && String(g.estado||'') === 'instalado') conEquipo[g.creditoId] = g;
  });
  var sin = vivos.filter(function(c){ return !conEquipo[c.id]; });
  var sinYMora = sin.filter(function(c){
    return (parseInt(c.mora,10)||0) > 0 || String(c.estado||'') === 'mora';
  });
  return {
    vivos: vivos.length,
    cubiertos: vivos.length - sin.length,
    sin: sin,
    sinYMora: sinYMora,
    pct: vivos.length ? Math.round(((vivos.length - sin.length) / vivos.length) * 100) : 0
  };
}

// Equipos instalados en creditos que ya no estan vivos: hay que ir a buscarlos.
function _gpsPorRecuperar(){
  return _gpsLista().filter(function(g){
    if(String(g.estado||'') !== 'instalado' || !g.creditoId) return false;
    var info = _gpsCredInfo(g.creditoId);
    return info && !info.vivo;
  });
}

// ══════════════════════════════════════════════════════════════════
// RENDER
// ══════════════════════════════════════════════════════════════════

function _gpsTab(){ return window._gpsTabActual || 'equipos'; }
function _gpsSetTab(t){ window._gpsTabActual = t; nav('gps'); }

function _gpsRender(){
  var lista = _gpsLista();
  var cob = _gpsCobertura();
  var porRec = _gpsPorRecuperar();
  var instalados = lista.filter(function(g){ return String(g.estado||'') === 'instalado'; });
  var stock = lista.filter(function(g){ return String(g.estado||'') === 'stock'; });
  var fallas = lista.filter(function(g){ return String(g.estado||'') === 'falla'; });
  var sinRev = _gpsSinRevisar();
  var caidos = _gpsCaidosEnMora();

  var html = '<div class="page">'
    + (typeof pageBanner === 'function'
        ? pageBanner('Rastreo · Equipos y lineas SIM', 'GPS',
            'Control de los dispositivos de rastreo: inventario de equipos y SIMs, instalaciones, y que creditos vigentes quedaron sin cubrir.',
            [{label:'+ Nuevo equipo', onclick:'_gpsOpenEdit(null)', primary:true},
             {label:'Importar del Excel', onclick:'_gpsImportarAbrir()'}])
        : '<div style="margin-bottom:14px"><h1 style="font-size:22px;margin:0">GPS</h1></div>');

  // ── KPIs ──
  html += '<div class="sg" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:16px">'
    + '<div class="stat"><div class="st-v" style="font-size:22px">' + instalados.length + '</div>'
    + '<div class="st-l">Instalados</div></div>'
    + '<div class="stat"><div class="st-v" style="font-size:22px">' + stock.length + '</div>'
    + '<div class="st-l">En stock</div></div>'
    + '<div class="stat"><div class="st-v" style="font-size:22px;color:' + (cob.pct >= 90 ? 'var(--green)' : cob.pct >= 50 ? 'var(--amber)' : 'var(--red)') + '">' + cob.pct + '%</div>'
    + '<div class="st-l">Cobertura</div>'
    + '<div style="font-size:10px;color:var(--ink3);margin-top:3px">' + cob.cubiertos + ' de ' + cob.vivos + ' creditos</div></div>'
    + '<div class="stat"><div class="st-v" style="font-size:22px;color:' + (cob.sinYMora.length ? 'var(--red)' : 'var(--ink)') + '">' + cob.sinYMora.length + '</div>'
    + '<div class="st-l">En mora sin GPS</div></div>'
    + '<div class="stat"><div class="st-v" style="font-size:22px;color:' + (sinRev.length ? 'var(--amber)' : 'var(--ink)') + '">' + sinRev.length + '</div>'
    + '<div class="st-l">Sin revisar</div>'
    + '<div style="font-size:10px;color:var(--ink3);margin-top:3px">+' + GPS_DIAS_REVISION + ' dias</div></div>'
    + '<div class="stat"><div class="st-v" style="font-size:22px;color:' + (fallas.length ? 'var(--amber)' : 'var(--ink)') + '">' + fallas.length + '</div>'
    + '<div class="st-l">Con falla</div></div>'
    + '</div>';

  // ── Lo mas urgente primero: equipo caido justo donde hay mora ──
  if(caidos.length){
    html += '<div style="background:rgba(240,75,106,0.1);border:1px solid rgba(240,75,106,0.35);border-radius:10px;padding:13px 16px;margin-bottom:14px">'
      + '<div style="font-weight:800;color:var(--red);font-size:13px;margin-bottom:5px">'
      + caidos.length + ' equipo' + (caidos.length===1?'':'s') + ' sin señal en creditos con mora</div>'
      + '<div style="font-size:11.5px;color:var(--ink2);line-height:1.6;margin-bottom:7px">'
      + 'Hay saldo vencido y la moto dejo de reportar. Puede ser bateria, la SIM sin saldo, o que le quitaron el equipo.</div>';
    caidos.forEach(function(g){
      var i = _gpsCredInfo(g.creditoId);
      html += '<div style="font-size:11.5px;padding:2px 0"><b>' + (g.idGps||g.id) + '</b> · ' + g.creditoId
        + ' · ' + (i ? i.cliente + ' · ' + i.diasMora + ' dias de mora' : '') + '</div>';
    });
    html += '</div>';
  }

  // ── Aviso: la API todavia no esta conectada ──
  html += '<div style="background:rgba(29,78,216,0.07);border:1px solid rgba(29,78,216,0.25);border-radius:10px;padding:11px 14px;margin-bottom:16px;font-size:11.5px;color:var(--ink2);line-height:1.6">'
    + '<strong style="color:var(--p1)">Sin conexion con MiCODUS todavia.</strong> '
    + 'Este modulo lleva el inventario y las instalaciones, que es lo que hoy vive en el Excel. '
    + 'La posicion en vivo, el estado online y el corte de motor requieren la API del distribuidor: '
    + 'cuando llegue la documentacion se conectan sobre esto mismo.'
    + '</div>';

  // ── Pestañas ──
  var tabs = [
    {k:'equipos',   l:'Equipos',   n:lista.length},
    {k:'cobertura', l:'Cobertura', n:cob.sin.length},
    {k:'sims',      l:'Lineas SIM', n:lista.filter(function(g){return !!g.iccid;}).length},
    {k:'mapa',      l:'Mapa',      n:0}
  ];
  var act = _gpsTab();
  html += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;border-bottom:1px solid var(--rim);padding-bottom:0">';
  tabs.forEach(function(t){
    var on = act === t.k;
    html += '<button class="btn btn-sm" onclick="_gpsSetTab(\'' + t.k + '\')" '
      + 'style="border-radius:8px 8px 0 0;border-bottom:2px solid ' + (on ? 'var(--p1)' : 'transparent') + ';'
      + 'background:' + (on ? 'var(--surf2)' : 'transparent') + ';font-weight:' + (on ? '800' : '600') + ';'
      + 'color:' + (on ? 'var(--p1)' : 'var(--ink2)') + '">'
      + t.l + (t.n ? ' <span style="opacity:.6;font-size:10px">' + t.n + '</span>' : '') + '</button>';
  });
  html += '</div>';

  if(act === 'cobertura')      html += _gpsHtmlCobertura(cob, porRec);
  else if(act === 'sims')      html += _gpsHtmlSims(lista);
  else if(act === 'mapa')      html += _gpsHtmlMapa(instalados);
  else                         html += _gpsHtmlEquipos(lista);

  html += '</div>';
  return html;
}

// ── Pestaña: equipos ─────────────────────────────────────────────
function _gpsHtmlEquipos(lista){
  if(!lista.length){
    return '<div class="empty" style="padding:60px 20px;text-align:center">'
      + '<div style="font-size:40px;margin-bottom:12px;opacity:.35">📡</div>'
      + '<div style="font-size:16px;font-weight:800;margin-bottom:6px">Todavia no hay equipos cargados</div>'
      + '<div style="font-size:12.5px;color:var(--ink3);max-width:400px;margin:0 auto 16px;line-height:1.6">'
      + 'Puedes cargarlos uno por uno, o pegar de una vez las filas del Excel con el boton de importar.</div>'
      + '<button class="btn btn-p btn-sm" onclick="_gpsImportarAbrir()">Importar del Excel</button></div>';
  }
  var ord = lista.slice().sort(function(a,b){
    var pa = String(a.estado||'')==='instalado' ? 0 : 1, pb = String(b.estado||'')==='instalado' ? 0 : 1;
    if(pa !== pb) return pa - pb;
    return String(b.creado||'').localeCompare(String(a.creado||''));
  });
  var h = '<div style="overflow-x:auto"><table class="tbl"><thead><tr>'
    + '<th>Estado</th><th>ID GPS</th><th>IMEI</th><th>Linea Movistar</th>'
    + '<th>Credito</th><th>Cliente</th><th>Moto</th><th>Revisado</th><th></th>'
    + '</tr></thead><tbody>';
  ord.forEach(function(g){
    var def = _gpsEstadoDef(g.estado);
    var info = _gpsCredInfo(g.creditoId);
    var alerta = info && !info.vivo && String(g.estado||'')==='instalado';
    h += '<tr' + (alerta ? ' style="background:rgba(240,75,106,0.05)"' : '') + '>'
      + '<td><span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:800;'
      + 'color:' + def.c + ';background:' + def.c + '1a;border:1px solid ' + def.c + '40">' + def.l + '</span></td>'
      + '<td style="font-family:ui-monospace,monospace;font-size:11.5px">' + (g.idGps || '—') + '</td>'
      + '<td style="font-family:ui-monospace,monospace;font-size:11px;color:var(--ink3)">' + (g.imei || '—') + '</td>'
      + '<td style="font-family:ui-monospace,monospace;font-size:11.5px">' + (g.linea || '—') + '</td>'
      + '<td>' + (g.creditoId ? '<b>' + g.creditoId + '</b>' : '<span style="color:var(--ink3)">—</span>') + '</td>'
      + '<td>' + (info ? info.cliente : '<span style="color:var(--ink3)">—</span>')
      + (info && info.enMora ? ' <span style="color:var(--red);font-size:10px;font-weight:800">' + info.diasMora + 'd mora</span>' : '') + '</td>'
      + '<td style="font-size:11.5px">' + (info ? (info.modelo + (info.placa ? ' · ' + info.placa : '')) : '—') + '</td>'
      + '<td style="font-size:11.5px">' + _gpsHtmlRevision(g) + '</td>'
      + '<td style="white-space:nowrap">'
      + (String(g.estado||'')==='instalado'
          ? '<button class="btn btn-g btn-xs" onclick="_gpsRevisar(\'' + g.id + '\')" title="Marcar revisado hoy">Revisar</button> '
          : '')
      + '<button class="btn btn-p btn-xs" onclick="_gpsOpenEdit(\'' + g.id + '\')">Ver</button></td>'
      + '</tr>';
    if(alerta){
      h += '<tr><td colspan="9" style="padding:4px 10px 8px;font-size:11px;color:var(--red)">'
        + '⚠ El credito ' + g.creditoId + ' ya no esta vigente (' + info.estado + ') pero el equipo sigue marcado como instalado. Hay que recuperarlo.'
        + '</td></tr>';
    }
  });
  h += '</tbody></table></div>';
  return h;
}

// Cuanto lleva sin que nadie confirme que el equipo responde.
function _gpsHtmlRevision(g){
  if(String(g.estado||'') !== 'instalado'){
    return '<span style="color:var(--ink3)">—</span>';
  }
  var d = _gpsDiasSinRevisar(g);
  if(d === null) return '<span style="color:var(--amber);font-weight:800">nunca</span>';
  var col = d > GPS_DIAS_REVISION ? 'var(--amber)' : 'var(--ink3)';
  var txt = d === 0 ? 'hoy' : 'hace ' + d + ' d';
  return '<span style="color:' + col + (d > GPS_DIAS_REVISION ? ';font-weight:800' : '') + '">' + txt + '</span>'
    + (g.estadoMicodus ? '<br><span style="font-size:10px;color:var(--ink3)">' + g.estadoMicodus + '</span>' : '');
}

// Un clic: quien reviso, cuando, y como respondio el equipo. Es lo mismo que
// hoy se anota en las columnas ESTADO MiCODUS y VERIFICADO POR del Excel.
function _gpsRevisar(id){
  var g = _gpsById(id);
  if(!g) return;
  setMicon('check');
  $('mtt').textContent = 'Revisar equipo';
  $('msb').textContent = (g.idGps || g.id) + (g.creditoId ? ' · ' + g.creditoId : '');
  $('modal-box').className = 'modal';
  var info = _gpsCredInfo(g.creditoId);
  $('mbd').innerHTML = ''
    + (info ? '<div style="font-size:12.5px;color:var(--ink2);margin-bottom:12px">'
        + '<b>' + info.cliente + '</b> · ' + info.modelo + (info.placa ? ' · ' + info.placa : '')
        + (info.enMora ? ' · <span style="color:var(--red);font-weight:800">' + info.diasMora + ' dias de mora</span>' : '')
        + '</div>' : '')
    + '<div class="fgr c1" style="gap:10px">'
    + '<div class="fg"><label>¿Como respondio en MiCODUS?</label><select class="fs" id="gpsr_estado">'
    + '<option value="ONLINE / OK">ONLINE — responde bien</option>'
    + '<option value="OFFLINE">OFFLINE — no reporta</option>'
    + '<option value="SIN SEÑAL RECIENTE">Sin señal reciente</option>'
    + '<option value="BATERIA BAJA">Bateria baja</option>'
    + '<option value="FALLA">Con falla</option>'
    + '</select></div>'
    + '<div class="fgr" style="gap:10px">'
    + '<div class="fg"><label>Latitud</label><input class="fi" id="gpsr_lat" value="' + (typeof g.lat==='number'?g.lat:'') + '" placeholder="10.4806"></div>'
    + '<div class="fg"><label>Longitud</label><input class="fi" id="gpsr_lng" value="' + (typeof g.lng==='number'?g.lng:'') + '" placeholder="-66.9036"></div>'
    + '</div>'
    + '<div style="font-size:10.5px;color:var(--ink3);margin-top:-4px">Opcional. Copialas de MiCODUS y la moto aparece en el mapa. Cuando la API este conectada esto se llena solo.</div>'
    + '<div class="fg"><label>Nota</label><input class="fi" id="gpsr_nota" placeholder="Opcional"></div>'
    + '</div>';
  S.saveFn = function(){
    var est = ($('gpsr_estado')||{}).value || '';
    var lat = parseFloat(($('gpsr_lat')||{}).value);
    var lng = parseFloat(($('gpsr_lng')||{}).value);
    var o = Object.assign({}, g);
    o.estadoMicodus = est;
    o.ultimaRevision = (typeof hoyLocalISO === 'function') ? hoyLocalISO() : new Date().toISOString().slice(0,10);
    o.verificadoPor = (S.currentUser && S.currentUser.nombre) || 'Admin';
    // Solo se guardan coordenadas si las dos son numeros validos y estan en rango.
    if(!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180){
      o.lat = lat; o.lng = lng; o.ultimaSenal = o.ultimaRevision;
    }
    var nota = (($('gpsr_nota')||{}).value || '').trim();
    if(nota) o.observaciones = nota;
    if(est.indexOf('FALLA') > -1) o.estado = 'falla';
    var i = S.gps.findIndex(function(x){ return x.id === g.id; });
    if(i >= 0) S.gps[i] = o;
    if(DB && DB.saveGps) DB.saveGps(o);
    if(typeof logActividad === 'function') logActividad('gps_revisar','gps',g.id,{estado:est});
    closeM();
    toast('Equipo revisado', 'success');
    nav('gps');
    return true;
  };
  $('mft').innerHTML = '<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    + '<button class="btn btn-p" onclick="saveM()">Guardar revision</button>';
  $('ov').style.display = 'flex';
}

// ── Pestaña: cobertura ───────────────────────────────────────────
function _gpsHtmlCobertura(cob, porRec){
  var h = '';
  if(cob.sinYMora.length){
    h += '<div style="background:rgba(240,75,106,0.08);border:1px solid rgba(240,75,106,0.3);border-radius:10px;padding:13px 16px;margin-bottom:14px">'
      + '<div style="font-weight:800;color:var(--red);font-size:13px;margin-bottom:4px">'
      + cob.sinYMora.length + ' credito' + (cob.sinYMora.length===1?'':'s') + ' en mora sin equipo instalado</div>'
      + '<div style="font-size:11.5px;color:var(--ink2);line-height:1.6">'
      + 'Son los que mas expuestos estan: hay saldo vencido y no hay forma de ubicar la moto. '
      + 'Priorizarlos si queda stock disponible.</div></div>';
  }
  if(porRec.length){
    h += '<div style="background:rgba(255,165,0,0.08);border:1px solid rgba(255,165,0,0.3);border-radius:10px;padding:13px 16px;margin-bottom:14px">'
      + '<div style="font-weight:800;color:var(--amber);font-size:13px;margin-bottom:6px">'
      + porRec.length + ' equipo' + (porRec.length===1?'':'s') + ' por recuperar</div>'
      + '<div style="font-size:11.5px;color:var(--ink2);line-height:1.6;margin-bottom:8px">'
      + 'Siguen marcados como instalados en creditos que ya se cerraron. Son equipos que se pueden reutilizar.</div>';
    porRec.forEach(function(g){
      var i = _gpsCredInfo(g.creditoId);
      h += '<div style="font-size:11.5px;padding:3px 0"><b>' + (g.idGps||g.id) + '</b> · ' + g.creditoId
        + ' · ' + (i ? i.cliente + ' (' + i.estado + ')' : '') + '</div>';
    });
    h += '</div>';
  }
  var sinRev = _gpsSinRevisar();
  if(sinRev.length){
    h += '<div style="background:rgba(255,165,0,0.07);border:1px solid rgba(255,165,0,0.28);border-radius:10px;padding:13px 16px;margin-bottom:14px">'
      + '<div style="font-weight:800;color:var(--amber);font-size:13px;margin-bottom:6px">'
      + sinRev.length + ' equipo' + (sinRev.length===1?'':'s') + ' sin revisar en mas de ' + GPS_DIAS_REVISION + ' dias</div>'
      + '<div style="font-size:11.5px;color:var(--ink2);line-height:1.6;margin-bottom:8px">'
      + 'Nadie ha confirmado que respondan. Un equipo que dejo de reportar no avisa: hay que ir a verlo.</div>';
    sinRev.slice(0, 20).forEach(function(g){
      var i = _gpsCredInfo(g.creditoId);
      var d = _gpsDiasSinRevisar(g);
      h += '<div style="font-size:11.5px;padding:2px 0"><b>' + (g.idGps||g.id) + '</b> · ' + (g.creditoId||'sin credito')
        + (i ? ' · ' + i.cliente : '') + ' · ' + (d===null ? 'nunca revisado' : 'hace ' + d + ' dias') + '</div>';
    });
    if(sinRev.length > 20) h += '<div style="font-size:11px;color:var(--ink3);margin-top:5px">y ' + (sinRev.length-20) + ' mas.</div>';
    h += '</div>';
  }
  if(!cob.sin.length){
    return h + '<div class="empty" style="padding:50px 20px;text-align:center">'
      + '<div style="font-size:36px;margin-bottom:10px">✓</div>'
      + '<div style="font-size:15px;font-weight:800">Todos los creditos vigentes tienen equipo</div></div>';
  }
  var ord = cob.sin.slice().sort(function(a,b){
    return (parseInt(b.mora,10)||0) - (parseInt(a.mora,10)||0);
  });
  h += '<div style="font-size:12px;color:var(--ink3);margin-bottom:8px">'
    + ord.length + ' credito' + (ord.length===1?'':'s') + ' vigente' + (ord.length===1?'':'s') + ' sin equipo instalado, los de mas mora primero.</div>'
    + '<div style="overflow-x:auto"><table class="tbl"><thead><tr>'
    + '<th>Credito</th><th>Cliente</th><th>Moto</th><th>Estado</th><th>Mora</th><th></th>'
    + '</tr></thead><tbody>';
  ord.slice(0, 200).forEach(function(c){
    var dias = parseInt(c.mora,10) || 0;
    h += '<tr>'
      + '<td><b>' + c.id + '</b></td>'
      + '<td>' + (c.cli || '—') + '</td>'
      + '<td style="font-size:11.5px">' + (c.modelo || c.marca || '—') + (c.placa ? ' · ' + c.placa : '') + '</td>'
      + '<td style="font-size:11.5px">' + (c.estado || '—') + '</td>'
      + '<td>' + (dias > 0 ? '<span style="color:var(--red);font-weight:800">' + dias + ' d</span>' : '<span style="color:var(--ink3)">—</span>') + '</td>'
      + '<td><button class="btn btn-p btn-xs" onclick="_gpsOpenEdit(null,\'' + c.id + '\')">Asignar equipo</button></td>'
      + '</tr>';
  });
  h += '</tbody></table></div>';
  if(ord.length > 200) h += '<div style="font-size:11px;color:var(--ink3);margin-top:8px">Mostrando los 200 de mayor mora.</div>';
  return h;
}

// ── Pestaña: lineas SIM ──────────────────────────────────────────
function _gpsHtmlSims(lista){
  var conSim = lista.filter(function(g){ return !!(g.iccid || g.linea); });
  if(!conSim.length){
    return '<div class="empty" style="padding:50px 20px;text-align:center;color:var(--ink3)">'
      + 'Todavia no hay lineas cargadas.</div>';
  }
  // Duplicados: una misma linea o ICCID en dos equipos es un error de carga.
  var porLinea = {}, porIccid = {};
  conSim.forEach(function(g){
    if(g.linea){ (porLinea[g.linea] = porLinea[g.linea] || []).push(g); }
    if(g.iccid){ (porIccid[g.iccid] = porIccid[g.iccid] || []).push(g); }
  });
  var dups = [];
  Object.keys(porLinea).forEach(function(k){ if(porLinea[k].length > 1) dups.push({tipo:'linea', v:k, n:porLinea[k].length}); });
  Object.keys(porIccid).forEach(function(k){ if(porIccid[k].length > 1) dups.push({tipo:'ICCID', v:k, n:porIccid[k].length}); });

  var h = '';
  if(dups.length){
    h += '<div style="background:rgba(240,75,106,0.08);border:1px solid rgba(240,75,106,0.3);border-radius:10px;padding:12px 15px;margin-bottom:14px">'
      + '<div style="font-weight:800;color:var(--red);font-size:12.5px;margin-bottom:5px">Repetidos</div>';
    dups.forEach(function(d){
      h += '<div style="font-size:11.5px;color:var(--ink2)">El ' + d.tipo + ' <b style="font-family:ui-monospace,monospace">' + d.v + '</b> aparece en ' + d.n + ' equipos.</div>';
    });
    h += '</div>';
  }
  h += '<div style="overflow-x:auto"><table class="tbl"><thead><tr>'
    + '<th>Linea Movistar</th><th>ICCID</th><th>Equipo</th><th>Estado</th><th>Asignada a</th>'
    + '</tr></thead><tbody>';
  conSim.slice().sort(function(a,b){ return String(a.linea||'').localeCompare(String(b.linea||'')); })
    .forEach(function(g){
      var def = _gpsEstadoDef(g.estado);
      var info = _gpsCredInfo(g.creditoId);
      h += '<tr>'
        + '<td style="font-family:ui-monospace,monospace;font-size:11.5px">' + (g.linea || '—') + '</td>'
        + '<td style="font-family:ui-monospace,monospace;font-size:11px;color:var(--ink3)">' + (g.iccid || '—') + '</td>'
        + '<td style="font-family:ui-monospace,monospace;font-size:11.5px">' + (g.idGps || '—') + '</td>'
        + '<td><span style="color:' + def.c + ';font-weight:800;font-size:11px">' + def.l + '</span></td>'
        + '<td style="font-size:11.5px">' + (info ? info.cliente + ' · ' + g.creditoId : '<span style="color:var(--ink3)">libre</span>') + '</td>'
        + '</tr>';
    });
  h += '</tbody></table></div>';
  return h;
}

// ── Pestaña: mapa ────────────────────────────────────────────────
function _gpsHtmlMapa(instalados){
  var conPos = instalados.filter(function(g){
    return typeof g.lat === 'number' && typeof g.lng === 'number';
  });
  if(!conPos.length){
    return '<div class="empty" style="padding:60px 20px;text-align:center">'
      + '<div style="font-size:40px;margin-bottom:12px;opacity:.35">🗺️</div>'
      + '<div style="font-size:16px;font-weight:800;margin-bottom:6px">El mapa esta listo, faltan las posiciones</div>'
      + '<div style="font-size:12.5px;color:var(--ink3);max-width:440px;margin:0 auto;line-height:1.6">'
      + 'Las coordenadas las trae la API de MiCODUS. Apenas se conecte, cada equipo instalado '
      + 'aparece aqui con su cliente, su credito y su estado de mora.<br><br>'
      + 'Hay <b>' + instalados.length + '</b> equipo' + (instalados.length===1?'':'s') + ' instalado'
      + (instalados.length===1?'':'s') + ' esperando posicion.</div></div>';
  }
  setTimeout(_gpsPintarMapa, 60);
  return '<div id="gps-mapa" style="height:520px;border-radius:12px;border:1px solid var(--rim);overflow:hidden"></div>'
    + '<div style="font-size:11px;color:var(--ink3);margin-top:8px">'
    + conPos.length + ' equipo' + (conPos.length===1?'':'s') + ' con posicion conocida.</div>';
}

// Carga Leaflet bajo demanda: no tiene sentido pagarlo en cada carga del app.
function _gpsPintarMapa(){
  var cont = document.getElementById('gps-mapa');
  if(!cont) return;
  if(typeof L === 'undefined'){
    if(window._gpsLeafletCargando) return;
    window._gpsLeafletCargando = true;
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    var js = document.createElement('script');
    js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    js.onload = function(){ window._gpsLeafletCargando = false; _gpsPintarMapa(); };
    js.onerror = function(){
      window._gpsLeafletCargando = false;
      cont.innerHTML = '<div style="padding:40px;text-align:center;color:var(--ink3);font-size:12.5px">'
        + 'No se pudo cargar el mapa. Revisa la conexion.</div>';
    };
    document.head.appendChild(js);
    return;
  }
  var puntos = _gpsLista().filter(function(g){
    return String(g.estado||'')==='instalado' && typeof g.lat==='number' && typeof g.lng==='number';
  });
  if(!puntos.length) return;
  if(window._gpsMapaObj){ try{ window._gpsMapaObj.remove(); }catch(e){} }
  var mapa = L.map(cont).setView([puntos[0].lat, puntos[0].lng], 12);
  window._gpsMapaObj = mapa;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap'
  }).addTo(mapa);
  var bounds = [];
  puntos.forEach(function(g){
    var info = _gpsCredInfo(g.creditoId);
    var color = info && info.enMora ? '#F04B6A' : '#00B876';
    var m = L.circleMarker([g.lat, g.lng], {
      radius: 8, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.95
    }).addTo(mapa);
    var txt = '<div style="font-family:system-ui,sans-serif;font-size:12px;line-height:1.5">'
      + '<b>' + (info ? info.cliente : (g.idGps || g.id)) + '</b>'
      + (g.creditoId ? '<br>' + g.creditoId : '')
      + (info && info.modelo ? '<br>' + info.modelo + (info.placa ? ' · ' + info.placa : '') : '')
      + (info && info.enMora ? '<br><span style="color:#F04B6A;font-weight:700">' + info.diasMora + ' dias de mora</span>' : '')
      + (g.ultimaSenal ? '<br><span style="color:#888">Ultima señal: ' + g.ultimaSenal + '</span>' : '')
      + '</div>';
    m.bindPopup(txt);
    bounds.push([g.lat, g.lng]);
  });
  if(bounds.length > 1) mapa.fitBounds(bounds, {padding:[30,30]});
}

// ══════════════════════════════════════════════════════════════════
// CRUD
// ══════════════════════════════════════════════════════════════════

function _gpsOpenEdit(id, credPre){
  var ex = id ? _gpsById(id) : null;
  var g = ex || {
    id:'', estado:'stock', iccid:'', linea:'', idGps:'', passwordGps:'', imei:'',
    creditoId: credPre || '', fechaInstalacion:'', tecnico:'', verificadoPor:'', observaciones:''
  };
  var esc = function(v){ return String(v==null?'':v).replace(/"/g,'&quot;'); };

  setMicon('llave');
  $('mtt').textContent = ex ? 'Equipo GPS' : 'Nuevo equipo GPS';
  $('msb').textContent = ex ? (ex.idGps || ex.id) : 'Dispositivo de rastreo + linea SIM';
  $('modal-box').className = 'modal';

  var credsOpts = '<option value="">— sin asignar —</option>';
  _gpsCredsVivos().slice().sort(function(a,b){ return String(a.id).localeCompare(String(b.id)); })
    .forEach(function(c){
      credsOpts += '<option value="' + c.id + '"' + (g.creditoId === c.id ? ' selected' : '') + '>'
        + c.id + ' — ' + (c.cli || '') + ' · ' + (c.modelo || c.marca || '') + '</option>';
    });

  $('mbd').innerHTML = ''
    + '<div class="fgr c1" style="gap:10px">'
    + '<div class="fg"><label>Estado del equipo</label><select class="fs" id="gps_estado">'
    + GPS_ESTADOS.map(function(e){
        return '<option value="' + e.v + '"' + (String(g.estado||'stock')===e.v?' selected':'') + '>' + e.l + ' — ' + e.d + '</option>';
      }).join('')
    + '</select></div>'

    + '<div style="font-size:11px;font-weight:800;color:var(--p1);letter-spacing:.06em;text-transform:uppercase;margin-top:4px">Equipo</div>'
    + '<div class="fgr" style="gap:10px">'
    + '<div class="fg"><label>ID GPS</label><input class="fi" id="gps_idgps" value="' + esc(g.idGps) + '" placeholder="Ej: 19210075478"></div>'
    + '<div class="fg"><label>IMEI</label><input class="fi" id="gps_imei" value="' + esc(g.imei) + '" placeholder="15 digitos"></div>'
    + '</div>'
    + '<div class="fg"><label>Password del equipo</label>'
    + '<input class="fi" id="gps_pass" type="password" value="' + esc(g.passwordGps) + '" placeholder="Solo si el equipo la exige">'
    + '<div style="font-size:10.5px;color:var(--ink3);margin-top:3px">Se guarda oculta. Cualquiera con acceso a este modulo puede revelarla, asi que trata este campo como una llave.</div></div>'

    + '<div style="font-size:11px;font-weight:800;color:var(--p1);letter-spacing:.06em;text-transform:uppercase;margin-top:4px">Linea Movistar</div>'
    + '<div class="fgr" style="gap:10px">'
    + '<div class="fg"><label>N° de linea</label><input class="fi" id="gps_linea" value="' + esc(g.linea) + '" placeholder="Ej: 143557051"></div>'
    + '<div class="fg"><label>ICCID</label><input class="fi" id="gps_iccid" value="' + esc(g.iccid) + '" placeholder="Ej: 895804420015136641"></div>'
    + '</div>'

    + '<div style="font-size:11px;font-weight:800;color:var(--p1);letter-spacing:.06em;text-transform:uppercase;margin-top:4px">Instalacion</div>'
    + '<div class="fg"><label>Credito</label><select class="fs" id="gps_cred">' + credsOpts + '</select>'
    + '<div style="font-size:10.5px;color:var(--ink3);margin-top:3px">El cliente, la moto y la placa se leen del credito. No hay que copiarlos.</div></div>'
    + '<div class="fgr" style="gap:10px">'
    + '<div class="fg"><label>Dia de instalacion</label><input type="date" class="fi" id="gps_fecha" value="' + esc(g.fechaInstalacion) + '"></div>'
    + '<div class="fg"><label>Tecnico que instalo</label><input class="fi" id="gps_tecnico" value="' + esc(g.tecnico) + '" placeholder="Nombre"></div>'
    + '</div>'
    + '<div class="fgr" style="gap:10px">'
    + '<div class="fg"><label>Verificado por</label><input class="fi" id="gps_verif" value="' + esc(g.verificadoPor) + '" placeholder="Nombre"></div>'
    + '<div class="fg"><label>Estado en MiCODUS</label><input class="fi" id="gps_micodus" value="' + esc(g.estadoMicodus) + '" placeholder="ONLINE / OK"></div>'
    + '</div>'
    + '<div class="fg"><label>Observaciones</label><textarea class="fi" id="gps_obs" rows="2">' + String(g.observaciones||'').replace(/</g,'&lt;') + '</textarea></div>'
    + '</div>';

  S.saveFn = function(){
    var v = function(k){ var e = $(k); return e ? String(e.value||'').trim() : ''; };
    var idGps = v('gps_idgps'), imei = v('gps_imei'), linea = v('gps_linea');
    if(!idGps && !imei && !linea){
      toast('Pon al menos el ID del GPS, el IMEI o la linea', 'error'); return false;
    }
    var estado = v('gps_estado') || 'stock';
    var cred = v('gps_cred');
    if(estado === 'instalado' && !cred){
      toast('Un equipo instalado tiene que tener credito asignado', 'error'); return false;
    }
    // Un mismo credito no puede tener dos equipos instalados a la vez.
    if(estado === 'instalado' && cred){
      var choque = _gpsLista().find(function(x){
        return x.id !== (ex && ex.id) && x.creditoId === cred && String(x.estado||'')==='instalado';
      });
      if(choque){
        toast('El credito ' + cred + ' ya tiene el equipo ' + (choque.idGps||choque.id) + ' instalado', 'error');
        return false;
      }
    }
    var o = ex ? Object.assign({}, ex) : { id: _gpsNuevoId() };
    o.estado = estado;
    o.idGps = idGps; o.imei = imei; o.linea = linea;
    o.iccid = v('gps_iccid');
    o.passwordGps = v('gps_pass');
    o.creditoId = cred;
    o.fechaInstalacion = v('gps_fecha');
    o.tecnico = v('gps_tecnico');
    o.verificadoPor = v('gps_verif');
    o.estadoMicodus = v('gps_micodus');
    o.observaciones = v('gps_obs');
    o.eliminado = false;
    if(!ex){
      o.creado = new Date().toISOString();
      o.creadoPor = (S.currentUser && S.currentUser.nombre) || 'Admin';
      S.gps = S.gps || [];
      S.gps.push(o);
    } else {
      o.actualizado = new Date().toISOString();
      var i = S.gps.findIndex(function(x){ return x.id === ex.id; });
      if(i >= 0) S.gps[i] = o;
    }
    if(DB && DB.saveGps) DB.saveGps(o);
    if(typeof logActividad === 'function') logActividad(ex?'gps_editar':'gps_crear','gps',o.id,{estado:o.estado, credito:o.creditoId});
    closeM();
    toast(ex ? 'Equipo actualizado' : 'Equipo registrado', 'success');
    nav('gps');
    return true;
  };

  $('mft').innerHTML = '<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    + (ex ? '<button class="btn btn-g btn-sm" onclick="_gpsVerPassword(\'' + ex.id + '\')">Ver password</button>' : '')
    + (ex ? '<button class="btn btn-d btn-sm" onclick="_gpsEliminar(\'' + ex.id + '\')">Eliminar</button>' : '')
    + '<button class="btn btn-p" onclick="saveM()">' + (ex ? 'Guardar cambios' : 'Registrar equipo') + '</button>';
  $('ov').style.display = 'flex';
}

// Revelar la password deja rastro: es una credencial del equipo.
function _gpsVerPassword(id){
  var g = _gpsById(id);
  if(!g) return;
  var campo = $('gps_pass');
  if(!campo) return;
  if(campo.type === 'password'){
    campo.type = 'text';
    if(typeof logActividad === 'function') logActividad('gps_ver_password','gps',id,{idGps:g.idGps||''});
  } else {
    campo.type = 'password';
  }
}

function _gpsEliminar(id){
  var g = _gpsById(id);
  if(!g) return;
  if(!confirm('¿Eliminar el equipo ' + (g.idGps || g.id) + '?\n\nQueda marcado como eliminado, no se borra del historial.')) return;
  g.eliminado = true;
  g.eliminadoEn = new Date().toISOString();
  g.eliminadoPor = (S.currentUser && S.currentUser.nombre) || 'Admin';
  if(DB && DB.saveGps) DB.saveGps(g);
  if(typeof logActividad === 'function') logActividad('gps_eliminar','gps',id,{});
  closeM();
  toast('Equipo eliminado', 'success');
  nav('gps');
}

// ══════════════════════════════════════════════════════════════════
// IMPORTAR DESDE EL EXCEL
// ══════════════════════════════════════════════════════════════════

function _gpsImportarAbrir(){
  setMicon('exportar');
  $('mtt').textContent = 'Importar equipos';
  $('msb').textContent = 'Pegar filas del Excel';
  $('modal-box').className = 'modal';
  $('mbd').innerHTML = ''
    + '<div style="font-size:12.5px;color:var(--ink2);line-height:1.65;margin-bottom:12px">'
    + 'Copia las filas del Excel (sin el encabezado) y pegalas aqui. Se esperan las columnas en este orden:'
    + '<div style="font-family:ui-monospace,monospace;font-size:10.5px;background:var(--surf2);border-radius:6px;padding:8px 10px;margin-top:7px;line-height:1.7">'
    + 'ESTADO · ICCID · LINEA · ID GPS · PASSWORD · IMEI · CLIENTE · N° CRED · MODELO · PLACA · CONCESIONARIO · DIA INSTALACION · TECNICO · ESTADO MiCODUS · VERIFICADO POR · OBSERVACIONES'
    + '</div></div>'
    + '<div class="fg"><label>Filas</label>'
    + '<textarea class="fi" id="gps_imp" rows="9" placeholder="Pega aqui — una fila por equipo, columnas separadas por tabulador"></textarea></div>'
    + '<div id="gps_imp_prev" style="font-size:11.5px;color:var(--ink3);margin-top:8px"></div>';
  S.saveFn = _gpsImportarProcesar;
  $('mft').innerHTML = '<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    + '<button class="btn btn-p" onclick="saveM()">Importar</button>';
  $('ov').style.display = 'flex';
}

// El Excel trae cliente, modelo y placa, pero el sistema los saca del credito.
// Se ignoran a proposito para no crear una segunda verdad.
function _gpsImportarProcesar(){
  var txt = ($('gps_imp') && $('gps_imp').value) || '';
  var lineas = txt.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
  if(!lineas.length){ toast('No pegaste nada', 'error'); return false; }

  var creds = {};
  (S.creds||[]).forEach(function(c){ if(c && !c.eliminado) creds[String(c.id).toUpperCase()] = c.id; });

  var nuevos = [], saltados = 0, sinCred = 0;
  var yaIdGps = {}, yaImei = {};
  _gpsLista().forEach(function(g){
    if(g.idGps) yaIdGps[String(g.idGps)] = 1;
    if(g.imei) yaImei[String(g.imei)] = 1;
  });

  lineas.forEach(function(l){
    var c = l.split('\t');
    if(c.length < 2) c = l.split(/\s{2,}|;/);
    var get = function(i){ return String(c[i]==null?'':c[i]).trim(); };
    var idGps = get(3), imei = get(5), linea = get(2);
    if(!idGps && !imei && !linea) return;
    if((idGps && yaIdGps[idGps]) || (imei && yaImei[imei])){ saltados++; return; }

    var credRaw = get(7).toUpperCase().replace(/\s+/g,'');
    if(credRaw && credRaw.indexOf('CRED') === 0 && credRaw.indexOf('-') === -1){
      credRaw = credRaw.replace('CRED', 'CRED-');
    }
    var credId = creds[credRaw] || '';
    if(credRaw && !credId) sinCred++;

    var est = get(0).toUpperCase();
    var estado = est.indexOf('INSTAL') > -1 ? 'instalado'
               : est.indexOf('RETIR') > -1 ? 'retirado'
               : est.indexOf('FALL') > -1 ? 'falla' : 'stock';
    if(estado === 'instalado' && !credId) estado = 'stock';

    var f = get(11);
    var fecha = '';
    var mm = f.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if(mm){
      var yy = mm[3].length === 2 ? '20' + mm[3] : mm[3];
      fecha = yy + '-' + ('0'+mm[2]).slice(-2) + '-' + ('0'+mm[1]).slice(-2);
    } else if(/^\d{4}-\d{2}-\d{2}/.test(f)) fecha = f.slice(0,10);

    nuevos.push({
      id: _gpsNuevoId(),
      estado: estado,
      iccid: get(1), linea: linea, idGps: idGps, passwordGps: get(4), imei: imei,
      creditoId: credId,
      fechaInstalacion: fecha,
      tecnico: get(12), estadoMicodus: get(13), verificadoPor: get(14), observaciones: get(15),
      eliminado: false,
      creado: new Date().toISOString(),
      creadoPor: (S.currentUser && S.currentUser.nombre) || 'Admin',
      importado: true
    });
    if(idGps) yaIdGps[idGps] = 1;
    if(imei) yaImei[imei] = 1;
  });

  if(!nuevos.length){
    toast(saltados ? 'Todas las filas ya estaban cargadas' : 'No se entendio ninguna fila', 'error');
    return false;
  }
  S.gps = (S.gps || []).concat(nuevos);
  nuevos.forEach(function(o){ if(DB && DB.saveGps) DB.saveGps(o); });
  if(typeof logActividad === 'function') logActividad('gps_importar','gps','',{n:nuevos.length});
  closeM();
  var msg = nuevos.length + ' equipo' + (nuevos.length===1?'':'s') + ' importado' + (nuevos.length===1?'':'s');
  if(saltados) msg += ' · ' + saltados + ' repetido' + (saltados===1?'':'s') + ' omitido' + (saltados===1?'':'s');
  if(sinCred) msg += ' · ' + sinCred + ' con credito no encontrado';
  toast(msg, 'success');
  nav('gps');
  return true;
}
