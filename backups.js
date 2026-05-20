// Pagasi logic: aprobaciones
function _aprGetPendientes(){
  return _concFiltrar(S.creds||[]).filter(function(c){
    return !c.eliminado && c.estado === 'pendiente_revision';
  });
}

// Render del módulo Aprobaciones
function _aprRender(){
  var pendientes = _aprGetPendientes();
  // Ordenar más recientes primero
  pendientes.sort(function(a,b){ return (b.creado||'').localeCompare(a.creado||''); });

  var html = '<div class="page">'
    + (typeof pageBanner === 'function'
      ? pageBanner(
          'Revisión de solicitudes · Aprobaciones pendientes',
          'Aprobaciones',
          '<b>'+pendientes.length+'</b> crédito'+(pendientes.length===1?'':'s')+' pendiente'+(pendientes.length===1?'':'s')+' de revisión.',
          [{label:'↻ Actualizar', onclick:"nav('aprobaciones')"}]
        )
      : '<h1 style="font-size:22px;margin:0 0 14px">Aprobaciones</h1>'
    )
    // KPI
    + '<div style="background:rgba(255,165,0,0.07);border:1px solid rgba(255,165,0,0.3);border-radius:10px;padding:11px 14px;margin-bottom:16px;font-size:11.5px;color:var(--ink2);line-height:1.6">'
    + '<strong style="color:var(--amber)">Bandeja de aprobaciones.</strong> '
    + 'Los vendedores en modo concesionario crean créditos que aparecen aquí. Revísalos y aprueba para que pasen a estado activo, o rechaza con una razón.'
    + '</div>';

  if(pendientes.length === 0){
    html += '<div style="padding:60px 20px;text-align:center;background:var(--surf);border-radius:14px;border:1px dashed var(--rim2)">'
      + '<div style="font-size:36px;margin-bottom:12px;opacity:.4">✓</div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--ink2);margin-bottom:6px">Todo al día</div>'
      + '<div style="font-size:11.5px;color:var(--ink3);max-width:380px;margin:0 auto;line-height:1.55">No hay créditos pendientes de revisión.</div>'
      + '</div>';
  } else {
    html += '<div style="display:grid;gap:12px">';
    pendientes.forEach(function(c){
      var sede = c.concesionarioId ? (_concGetById ? _concGetById(c.concesionarioId) : null) : null;
      var sedeName = sede ? sede.nombre : (c.concesionarioId ? '(eliminada)' : '— sin sede —');
      var score = c.score_indexa || 0;
      var scoreCol = score >= 625 ? 'var(--green)' : score >= 450 ? 'var(--amber)' : 'var(--red)';
      var scoreLbl = score >= 750 ? 'Excelente' : score >= 625 ? 'Bueno' : score >= 450 ? 'Regular' : 'Bajo';
      html += '<div style="background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:16px;display:grid;grid-template-columns:1fr auto;gap:14px;align-items:start">'
        + '<div>'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
        + '<span style="font-family:var(--fd);font-weight:800;font-size:14px">'+c.id+'</span>'
        + '<span style="background:rgba(255,165,0,.18);color:var(--amber);padding:3px 9px;border-radius:9px;font-size:9.5px;font-weight:800;letter-spacing:.4px">PENDIENTE REVISIÓN</span>'
        + '<span style="font-size:11px;color:var(--ink3)">creado '+(c.creado||'').slice(0,10)+'</span>'
        + '</div>'
        + '<div style="font-size:16px;font-weight:700;margin-bottom:4px">'+(c.cli||'—')+'</div>'
        + '<div style="font-size:12px;color:var(--ink2);margin-bottom:8px">'+(c.modelo||'—')+' · $'+(parseFloat(c.precio)||0).toFixed(2)+'</div>'
        + '<div style="display:grid;grid-template-columns:repeat(4,auto);gap:18px;font-size:11px;margin-top:9px">'
        + '<div><div style="color:var(--ink3);font-weight:700;font-size:9.5px;text-transform:uppercase">Sede</div><div style="font-weight:700;margin-top:1px">'+sedeName+'</div></div>'
        + '<div><div style="color:var(--ink3);font-weight:700;font-size:9.5px;text-transform:uppercase">Vendedor</div><div style="font-weight:700;margin-top:1px">'+(c.creadoPor||'—')+'</div></div>'
        + '<div><div style="color:var(--ink3);font-weight:700;font-size:9.5px;text-transform:uppercase">Score</div><div style="font-weight:800;margin-top:1px;color:'+scoreCol+'">'+score+' · '+scoreLbl+'</div></div>'
        + '<div><div style="color:var(--ink3);font-weight:700;font-size:9.5px;text-transform:uppercase">Cuota Q.</div><div style="font-family:var(--fd);font-weight:800;margin-top:1px">$'+(parseFloat(c.cuotaQ||c.cuota||0)).toFixed(2)+'</div></div>'
        + '</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">'
        + '<button class="btn btn-s btn-sm" onclick="_aprAprobar(\''+c.id+'\')" style="min-width:120px">✓ Aprobar</button>'
        + '<button class="btn btn-d btn-sm" onclick="_aprRechazar(\''+c.id+'\')" style="min-width:120px">✕ Rechazar</button>'
        + '<button class="btn btn-g btn-sm" onclick="_aprVerDetalle(\''+c.id+'\')" style="min-width:120px">Ver Detalle</button>'
        + '</div>'
        + '</div>';
    });
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// Aprobar un crédito → pasa a 'activo'
function _aprAprobar(credId){
  var c = (S.creds||[]).find(function(x){return x.id === credId;});
  if(!c){ toast('Crédito no encontrado','error'); return; }
  if(c.estado !== 'pendiente_revision'){ toast('Este crédito no está pendiente','error'); return; }
  if(!confirm('¿Aprobar el crédito '+credId+' de '+(c.cli||'—')+'?\n\nPasará a estado ACTIVO y se cobrarán comisiones al vendedor (si aplica).')) return;
  c.estado = 'activo';
  c.aprobadoEn = new Date().toISOString();
  c.aprobadoPor = (S.currentUser&&S.currentUser.nombre)||'Admin';
  if(DB && DB.saveCred) DB.saveCred(c);
  toast('Crédito aprobado · '+credId,'success');
  nav('aprobaciones');
}

// Rechazar un crédito → estado 'cancelado' con razón
function _aprRechazar(credId){
  var c = (S.creds||[]).find(function(x){return x.id === credId;});
  if(!c){ toast('Crédito no encontrado','error'); return; }
  if(c.estado !== 'pendiente_revision'){ toast('Este crédito no está pendiente','error'); return; }
  var razon = prompt('Razón para rechazar el crédito '+credId+':');
  if(!razon || !razon.trim()){
    if(razon !== null) toast('Debes indicar una razón','error');
    return;
  }
  c.estado = 'cancelado';
  c.rechazadoEn = new Date().toISOString();
  c.rechazadoPor = (S.currentUser&&S.currentUser.nombre)||'Admin';
  c.razonRechazo = razon.trim();
  if(DB && DB.saveCred) DB.saveCred(c);
  toast('Crédito rechazado · '+credId,'info');
  nav('aprobaciones');
}

// Ver detalle: redirige al módulo de créditos con el ID
function _aprVerDetalle(credId){
  // Si existe función abrirDetalleCredito, úsala. Si no, navega a créditos
  if(typeof abrirDetalleCredito === 'function'){
    abrirDetalleCredito(credId);
  } else {
    nav('creditos');
  }
}
