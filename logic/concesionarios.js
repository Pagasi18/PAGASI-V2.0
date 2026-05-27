// Pagasi logic: concesionarios
function _concGetById(id){
  if(!id) return null;
  return (S.concesionarios||[]).find(function(c){return c.id===id;}) || null;
}

// Devuelve los concesionarios que el usuario actual puede ver
// Admin (sin restricciones de concesionario) ve todos
function _concGetVisibles(){
  var all = (S.concesionarios||[]).filter(function(c){return !c.eliminado;});
  var u = S.currentUser;
  if(!u) return all;
  // Si el usuario tiene rol Administrador y no tiene asignaciones específicas, ve todos
  var asignados = u.concesionarios || [];
  if((u.rol === 'Administrador' || u.rol === 'Gerente') && (!asignados.length)){
    return all;
  }
  // Si tiene asignaciones explícitas, filtramos
  if(asignados.length){
    return all.filter(function(c){ return asignados.indexOf(c.id) !== -1; });
  }
  // Sin asignaciones y no admin → ve todos por compatibilidad (mientras está en transición)
  return all;
}

// ── HELPERS DE FILTRADO POR CONCESIONARIO (Entrega 2) ──
// Estos helpers son usados por todos los módulos (Motos, Créditos, Pagos, Clientes, etc)
// para filtrar automáticamente según el concesionario activo.

// Decide si un registro pasa el filtro de concesionario activo
// item.concesionarioId puede ser: undefined/null (sin asignar) ó un id específico
function _concPasaFiltro(item){
  if(!item) return false;
  var activo = S.concesionarioActivo;
  var u = S.currentUser || {};
  var asignados = u.concesionarios || [];
  var esAdminTotal = (u.rol === 'Administrador' || u.rol === 'Gerente') && !asignados.length;

  // 1) Si hay un concesionario activo en el switcher → filtrar por ese
  if(activo){
    return item.concesionarioId === activo;
  }
  // 2) Sin activo y admin total → ve todo (incluyendo sin asignar)
  if(esAdminTotal){
    return true;
  }
  // 3) Sin activo, usuario con asignaciones específicas → ve solo lo de sus sedes
  if(asignados.length){
    return asignados.indexOf(item.concesionarioId) !== -1;
  }
  // 4) Fallback: ve todo (compatibilidad)
  return true;
}

// Filtra cualquier array de registros según el concesionario activo
function _concFiltrar(arr){
  if(!Array.isArray(arr)) return [];
  return arr.filter(_concPasaFiltro);
}

// Filtra clientes SIN aplicar el filtro de concesionario activo
// Los clientes son globales: se ven en todos los módulos/concesionarios
function _concFiltrarClientes(arr){
  if(!Array.isArray(arr)) return [];
  var u = S.currentUser || {};
  var asignados = u.concesionarios || [];
  var esAdminTotal = (u.rol === 'Administrador' || u.rol === 'Gerente') && !asignados.length;
  if(esAdminTotal) return arr.filter(function(c){ return c; });
  if(asignados.length){
    return arr.filter(function(c){
      if(!c) return false;
      return !c.concesionarioId || asignados.indexOf(c.concesionarioId) !== -1;
    });
  }
  return arr.filter(function(c){ return c; });
}

// Filtra egresos por concesionario activo PERO incluye los sin sede asignada (histórico)
function _concFiltrarEgresos(arr){
  if(!Array.isArray(arr)) return [];
  var activo = S.concesionarioActivo;
  var u = S.currentUser || {};
  var asignados = u.concesionarios || [];
  var esAdminTotal = (u.rol === 'Administrador' || u.rol === 'Gerente') && !asignados.length;
  if(esAdminTotal) return arr.filter(function(e){ return e; });
  if(activo){
    // Muestra los del concesionario activo + los que no tienen sede asignada (histórico)
    return arr.filter(function(e){
      if(!e) return false;
      return !e.concesionarioId || e.concesionarioId === activo;
    });
  }
  if(asignados.length){
    return arr.filter(function(e){
      if(!e) return false;
      return !e.concesionarioId || asignados.indexOf(e.concesionarioId) !== -1;
    });
  }
  return arr.filter(function(e){ return e; });
}

// Devuelve el concesionarioId por defecto al crear un nuevo registro
// Si hay uno activo en el switcher → ese
// Si el usuario tiene UN solo concesionario asignado → ese
// Si no → null (sin asignar)
function _concDefaultId(){
  var activo = S.concesionarioActivo;
  if(activo) return activo;
  var u = S.currentUser || {};
  var asignados = u.concesionarios || [];
  if(asignados.length === 1) return asignados[0];
  return null;
}

// Cuenta registros sin concesionarioId (histórico sin asignar)
function _concContarSinAsignar(){
  return {
    motos: (S.motos||[]).filter(function(m){return !m.eliminado && !m.concesionarioId;}).length,
    creds: (S.creds||[]).filter(function(cr){return !cr.eliminado && !cr.concesionarioId;}).length,
    clis:  (S.clientes||[]).filter(function(cl){return !cl.eliminado && !cl.concesionarioId;}).length,
    pagos: (S.pagos||[]).filter(function(p){return !p.eliminado && !p.concesionarioId;}).length
  };
}

// Cambia el concesionario activo y guarda en localStorage
function _concSetActivo(id){
  S.concesionarioActivo = id || null;
  try{
    if(id) localStorage.setItem('concesionarioActivo', id);
    else localStorage.removeItem('concesionarioActivo');
  }catch(e){}
  if(typeof toast === 'function'){
    var nombre = id ? ((_concGetById(id)||{}).nombre || id) : 'Todos los concesionarios';
    toast('Trabajando en: '+nombre,'info');
  }
  // Re-render página actual
  if(typeof nav === 'function' && S.page) nav(S.page);
}

// Renderiza el switcher en el header
function _renderConcSwitcher(){
  var wrap = document.getElementById('conc-switcher');
  if(!wrap) return;
  var visibles = _concGetVisibles();
  // Si no hay concesionarios creados todavía, ocultamos el switcher
  if(!visibles.length){
    wrap.style.display = 'none';
    return;
  }
  var u = S.currentUser || {};
  var asignados = u.concesionarios || [];
  var esAdminPuro = (u.rol === 'Administrador' || u.rol === 'Gerente') && asignados.length === 0;
  // Si tiene UNA sola sede asignada → mostrar como info estática (sin opción de cambiar)
  if(asignados.length === 1 && !esAdminPuro){
    var sedeUnica = _concGetById(asignados[0]);
    if(!sedeUnica){
      wrap.style.display = 'none';
      return;
    }
    // Forzar activo en su sede
    if(S.concesionarioActivo !== asignados[0]){
      S.concesionarioActivo = asignados[0];
      try{ localStorage.setItem('concesionarioActivo', asignados[0]); }catch(e){}
    }
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.innerHTML = ''
      + '<div style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:var(--surf2);border:1px solid var(--rim2);border-radius:9px;font-family:var(--f);font-size:12.5px;font-weight:700;color:var(--ink)">'
      + '<span style="width:7px;height:7px;border-radius:50%;background:var(--p1)"></span>'
      + '<span style="font-size:9.5px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px">Sede</span>'
      + '<span style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+sedeUnica.nombre+'</span>'
      + '</div>';
    return;
  }
  var activo = S.concesionarioActivo;
  // Verificar que el activo siga siendo visible (y dentro de las asignadas si aplica)
  if(activo && !visibles.find(function(c){return c.id===activo;})){
    S.concesionarioActivo = null;
    activo = null;
  }
  // Admin total (sin asignaciones específicas) ve "Todos" como opción
  // Usuario con asignaciones específicas (varias) NO ve "Todos" — solo sus sedes
  var puedeVerTodos = esAdminPuro;
  // Si NO puede ver todos y no tiene activo, forzar a su primera sede
  if(!puedeVerTodos && !activo && asignados.length){
    S.concesionarioActivo = asignados[0];
    activo = asignados[0];
    try{ localStorage.setItem('concesionarioActivo', asignados[0]); }catch(e){}
  }
  var labelActivo = activo ? ((_concGetById(activo)||{}).nombre || '?') : 'Todos';
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.innerHTML = ''
    + '<button type="button" id="conc-sw-btn" onclick="_concToggleDropdown()" '
    + 'style="display:flex;align-items:center;gap:8px;padding:7px 12px;background:var(--surf2);border:1px solid var(--rim2);border-radius:9px;cursor:pointer;font-family:var(--f);font-size:12.5px;font-weight:700;color:var(--ink);transition:.15s">'
    + '<span style="width:7px;height:7px;border-radius:50%;background:'+(activo?'var(--p1)':'var(--green)')+'"></span>'
    + '<span style="font-size:9.5px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px">Sede</span>'
    + '<span style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+labelActivo+'</span>'
    + '<span style="font-size:9px;color:var(--ink3)">▾</span>'
    + '</button>'
    + '<div id="conc-sw-menu" style="display:none;position:absolute;top:48px;right:20px;background:var(--surf);border:1px solid var(--rim);border-radius:11px;padding:6px;min-width:240px;box-shadow:0 12px 40px rgba(0,0,0,.18);z-index:9999">'
      + (puedeVerTodos
        ? '<button type="button" onclick="_concSetActivo(null);_concCloseDropdown()" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:9px 11px;background:'+(!activo?'rgba(0,184,118,.1)':'transparent')+';border:none;border-radius:7px;cursor:pointer;font-size:12.5px;color:var(--ink);font-weight:'+(!activo?'700':'500')+'">'
          + '<span style="width:6px;height:6px;border-radius:50%;background:var(--green)"></span>'
          + '<span>Todos los concesionarios</span>'
          + (!activo ? '<span style="margin-left:auto;color:var(--green);font-size:10px">✓</span>' : '')
          + '</button>'
          + '<div style="height:1px;background:var(--rim2);margin:4px 0"></div>'
        : '')
      + visibles.map(function(c){
        var sel = activo === c.id;
        return '<button type="button" onclick="_concSetActivo(\''+c.id+'\');_concCloseDropdown()" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:9px 11px;background:'+(sel?'rgba(74,107,255,.13)':'transparent')+';border:none;border-radius:7px;cursor:pointer;font-size:12.5px;color:var(--ink);font-weight:'+(sel?'700':'500')+'">'
          + '<span style="width:6px;height:6px;border-radius:50%;background:var(--p1)"></span>'
          + '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+c.nombre+'</span>'
          + (sel ? '<span style="color:var(--p1);font-size:10px">✓</span>' : '')
          + '</button>';
      }).join('')
    + '</div>';
}

function _concToggleDropdown(){
  var menu = document.getElementById('conc-sw-menu');
  if(!menu) return;
  if(menu.style.display === 'block'){
    menu.style.display = 'none';
  } else {
    menu.style.display = 'block';
    // Click outside cierra
    setTimeout(function(){
      function close(e){
        if(e.target.closest && (e.target.closest('#conc-sw-menu') || e.target.closest('#conc-sw-btn'))) return;
        _concCloseDropdown();
        document.removeEventListener('click', close);
      }
      document.addEventListener('click', close);
    }, 50);
  }
}

function _concCloseDropdown(){
  var menu = document.getElementById('conc-sw-menu');
  if(menu) menu.style.display = 'none';
}

// ════════ MÓDULO CRUD DE CONCESIONARIOS ════════

function _concRender(){
  var lista = (S.concesionarios||[]).filter(function(c){return !c.eliminado;});
  // Stats por concesionario (motos, créditos, clientes, pagos)
  function statsDe(cid){
    return {
      motos: (S.motos||[]).filter(function(m){return !m.eliminado && m.concesionarioId === cid;}).length,
      creds: (S.creds||[]).filter(function(cr){return !cr.eliminado && cr.concesionarioId === cid;}).length,
      clis:  (S.clientes||[]).filter(function(cl){return !cl.eliminado && cl.concesionarioId === cid;}).length,
      pagos: (S.pagos||[]).filter(function(p){return !p.eliminado && p.concesionarioId === cid;}).length
    };
  }
  // Sin asignar (histórico)
  var sinAsig = {
    motos: (S.motos||[]).filter(function(m){return !m.eliminado && !m.concesionarioId;}).length,
    creds: (S.creds||[]).filter(function(cr){return !cr.eliminado && !cr.concesionarioId;}).length,
    clis:  (S.clientes||[]).filter(function(cl){return !cl.eliminado && !cl.concesionarioId;}).length,
    pagos: (S.pagos||[]).filter(function(p){return !p.eliminado && !p.concesionarioId;}).length
  };
  var html = '<div class="page">'
    + (typeof pageBanner === 'function'
      ? pageBanner(
          'Sedes y puntos de venta · Multi-sucursal',
          'Concesionarios',
          'Define cada sede física donde operas. Asigna usuarios y filtra datos por concesionario para mantener cada operación clara y separada.',
          [{label:'+ Nuevo concesionario', onclick:'_concOpenEdit(null)', primary:true}]
        )
      : '<div style="margin-bottom:14px"><h1 style="font-size:22px;margin:0">Concesionarios</h1></div>'
    )
    // KPIs
    + '<div class="sg" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:16px">'
    + '<div class="stat" style="">'
    + '<div class="st-v" style="font-size:22px">'+lista.filter(function(c){return c.activo!==false;}).length+'</div>'
    + '<div class="st-l">Sedes activas</div>'
    + '</div>'
    + '<div class="stat">'
    + '<div class="st-v" style="font-size:22px">'+lista.length+'</div>'
    + '<div class="st-l">Total sedes</div>'
    + '</div>'
    + '<div class="stat" style="">'
    + '<div class="st-v" style="color:var(--amber);font-size:22px">'+(sinAsig.creds+sinAsig.motos+sinAsig.clis+sinAsig.pagos)+'</div>'
    + '<div class="st-l">Sin asignar</div>'
    + '<div style="font-size:10px;color:var(--ink3);margin-top:3px">registros históricos</div>'
    + '</div>'
    + '<div class="stat">'
    + '<div class="st-v" style="font-size:22px">'+((typeof _usersCache!=='undefined'&&_usersCache)?_usersCache.filter(function(u){return u.concesionarios && u.concesionarios.length;}).length:0)+'</div>'
    + '<div class="st-l">Usuarios asignados</div>'
    + '</div>'
    + '</div>';
  // Mensaje informativo
  html += ''
    + '<div style="background:rgba(0,184,118,0.08);border:1px solid rgba(0,184,118,0.25);border-radius:10px;padding:11px 14px;margin-bottom:16px;font-size:11.5px;color:var(--ink2);line-height:1.6">'
    + '<strong style="color:var(--green)">Entrega 2 — Filtros y operaciones por sede activos.</strong> '
    + 'El switcher arriba filtra todos los módulos por concesionario. Los registros nuevos heredan la sede activa automáticamente. '
    + 'Usa <b>"Asignar histórico"</b> abajo para migrar registros antiguos a sus sedes.'
    + '</div>';

  // Bloque de asignación de histórico (masivo + individual)
  var totalSinAsig = sinAsig.creds + sinAsig.motos + sinAsig.clis + sinAsig.pagos;
  if(totalSinAsig > 0 && lista.length > 0){
    html += ''
      + '<div style="background:rgba(255,165,0,0.07);border:1px solid rgba(255,165,0,0.3);border-radius:10px;padding:13px 16px;margin-bottom:16px">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">'
      + '<div style="flex:1;min-width:240px">'
      + '<div style="font-size:11px;font-weight:800;color:var(--amber);text-transform:uppercase;letter-spacing:.5px">Asignación de histórico</div>'
      + '<div style="font-size:12px;color:var(--ink2);margin-top:5px;line-height:1.5">Tienes <b style="color:var(--amber);font-family:var(--fd)">'+totalSinAsig+'</b> registros sin concesionario asignado:</div>'
      + '<div style="display:flex;gap:14px;margin-top:6px;font-size:11px;color:var(--ink3);flex-wrap:wrap">'
      + '<span><b style="color:var(--ink2);font-family:var(--fd)">'+sinAsig.motos+'</b> motos</span>'
      + '<span><b style="color:var(--ink2);font-family:var(--fd)">'+sinAsig.creds+'</b> créditos</span>'
      + '<span><b style="color:var(--ink2);font-family:var(--fd)">'+sinAsig.clis+'</b> clientes</span>'
      + '<span><b style="color:var(--ink2);font-family:var(--fd)">'+sinAsig.pagos+'</b> pagos</span>'
      + '</div></div>'
      + '<div style="display:flex;gap:7px;flex-wrap:wrap">'
      + '<button class="btn btn-p btn-sm" onclick="_concAbrirAsignarMasivo()">⇒ Asignar masivo</button>'
      + '<button class="btn btn-g btn-sm" onclick="_concAbrirAsignarIndividual()">⌗ Asignar individual</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }
  // Lista de concesionarios
  if(lista.length === 0){
    html += '<div style="padding:60px 20px;text-align:center;background:var(--surf);border-radius:14px;border:1px dashed var(--rim2)">'
      + '<div style="font-size:36px;margin-bottom:12px;opacity:.4">⌂</div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--ink2);margin-bottom:6px">Sin concesionarios creados</div>'
      + '<div style="font-size:11.5px;color:var(--ink3);max-width:380px;margin:0 auto;line-height:1.55">Crea tu primer concesionario para empezar a separar la operación por sede.</div>'
      + '<button class="btn btn-p btn-sm" style="margin-top:14px" onclick="_concOpenEdit(null)">+ Crear primer concesionario</button>'
      + '</div>';
  } else {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:14px">';
    lista.forEach(function(c){
      var st = statsDe(c.id);
      var inactivoBadge = c.activo === false ? '<span style="background:rgba(255,71,87,.18);color:var(--red);padding:2px 8px;border-radius:9px;font-size:10px;font-weight:700;letter-spacing:.3px">INACTIVO</span>' : '<span style="background:rgba(0,184,118,.18);color:var(--green);padding:2px 8px;border-radius:9px;font-size:10px;font-weight:700;letter-spacing:.3px">ACTIVO</span>';
      var nUsuarios = ((typeof _usersCache!=='undefined'&&_usersCache)?_usersCache.filter(function(u){return (u.concesionarios||[]).indexOf(c.id)!==-1;}).length:0);
      html += ''
        + '<div class="card" style="overflow:hidden;padding:0">'
        + '<div style="padding:14px 16px 10px;border-bottom:1px solid var(--rim2)">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:5px">'
        + '<div style="flex:1;min-width:0">'
        + '<div class="cs" style="text-transform:uppercase;letter-spacing:.6px">Concesionario</div>'
        + '<div class="ct" style="font-size:16px;margin-top:2px">'+(c.nombre||'—')+'</div>'
        + '</div>'
        + '<div>'+inactivoBadge+'</div>'
        + '</div>'
        + (c.ciudad ? '<div style="font-size:11.5px;color:var(--ink3);margin-top:3px">'+c.ciudad+(c.direccion?' · '+c.direccion:'')+'</div>' : '')
        + (c.telefono ? '<div style="font-size:11px;color:var(--ink3);margin-top:1px">Tel: '+c.telefono+'</div>' : '')
        + '</div>'
        + '<div style="padding:11px 16px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;border-bottom:1px solid var(--rim2)">'
        + '<div><div style="font-size:9.5px;font-weight:800;color:var(--ink3);text-transform:uppercase">Motos</div><div style="font-family:var(--fd);font-weight:800;font-size:15px;margin-top:2px">'+st.motos+'</div></div>'
        + '<div><div style="font-size:9.5px;font-weight:800;color:var(--ink3);text-transform:uppercase">Créditos</div><div style="font-family:var(--fd);font-weight:800;font-size:15px;margin-top:2px;color:var(--p1)">'+st.creds+'</div></div>'
        + '<div><div style="font-size:9.5px;font-weight:800;color:var(--ink3);text-transform:uppercase">Clientes</div><div style="font-family:var(--fd);font-weight:800;font-size:15px;margin-top:2px">'+st.clis+'</div></div>'
        + '<div><div style="font-size:9.5px;font-weight:800;color:var(--ink3);text-transform:uppercase">Pagos</div><div style="font-family:var(--fd);font-weight:800;font-size:15px;margin-top:2px;color:var(--green)">'+st.pagos+'</div></div>'
        + '</div>'
        + '<div style="padding:9px 16px;font-size:11px;color:var(--ink3);border-bottom:1px solid var(--rim2)">'
        + (nUsuarios > 0 ? '<b style="color:var(--ink2)">'+nUsuarios+'</b> usuario'+(nUsuarios===1?'':'s')+' asignado'+(nUsuarios===1?'':'s') : 'Sin usuarios asignados')
        + '</div>'
        + '<div style="padding:11px 12px;display:grid;grid-template-columns:1fr 1fr;gap:8px">'
        + '<button class="btn btn-p btn-sm" onclick="_concOpenEdit(\''+c.id+'\')">Editar</button>'
        + '<button class="btn btn-g btn-sm" onclick="_concAbrirDetalle(\''+c.id+'\')">Ver Detalle</button>'
        + '</div>'
        + '</div>';
    });
    html += '</div>';
  }
  html += '</div>';
  return html;
}

// Modal: crear / editar concesionario
function _concOpenEdit(id){
  var existing = id ? _concGetById(id) : null;
  var c = existing || { id:'', nombre:'', direccion:'', ciudad:'', telefono:'', activo:true };
  setMicon('conces');
  $('mtt').textContent= existing ? 'Editar Concesionario' : 'Nuevo Concesionario';
  $('msb').textContent= existing ? c.id : 'Sede o punto de venta';
  $('modal-box').className='modal';
  $('mbd').innerHTML = ''
    + '<div class="fgr c1" style="gap:10px">'
    + '<div class="fg"><label>Nombre del concesionario <span style="color:var(--red)">*</span></label>'
    + '<input class="fi" id="conc_nombre" value="'+(c.nombre||'').replace(/"/g,'&quot;')+'" placeholder="Ej: Maracay Centro" maxlength="80"></div>'
    + '<div class="fgr" style="gap:10px">'
    + '<div class="fg"><label>Ciudad</label><input class="fi" id="conc_ciudad" value="'+(c.ciudad||'').replace(/"/g,'&quot;')+'" placeholder="Ej: Maracay"></div>'
    + '<div class="fg"><label>Teléfono</label><input class="fi" id="conc_telefono" value="'+(c.telefono||'').replace(/"/g,'&quot;')+'" placeholder="Ej: 0414-1234567"></div>'
    + '</div>'
    + '<div class="fg"><label>Dirección</label><textarea class="fi" id="conc_direccion" rows="2" placeholder="Av. Bolívar, c/c Av. Sucre...">'+(c.direccion||'').replace(/</g,'&lt;')+'</textarea></div>'
    + '<div class="fg"><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="conc_activo" '+(c.activo!==false?'checked':'')+' style="accent-color:var(--green);transform:scale(1.15)"> Concesionario activo</label>'
    + '<div style="font-size:10.5px;color:var(--ink3);margin-top:3px">Si está inactivo, no aparecerá en los selectores de creación de motos/créditos.</div></div>'
    + '</div>';
  S.saveFn = function(){
    var nombre = (($('conc_nombre')&&$('conc_nombre').value)||'').trim();
    if(!nombre){ toast('El nombre es obligatorio','error'); return false; }
    var newConc = existing ? Object.assign({}, existing) : { id: 'CONC-'+Date.now() };
    newConc.nombre = nombre;
    newConc.ciudad = (($('conc_ciudad')&&$('conc_ciudad').value)||'').trim();
    newConc.telefono = (($('conc_telefono')&&$('conc_telefono').value)||'').trim();
    newConc.direccion = (($('conc_direccion')&&$('conc_direccion').value)||'').trim();
    newConc.activo = !!($('conc_activo')&&$('conc_activo').checked);
    if(!existing){
      newConc.createdAt = new Date().toISOString();
      newConc.creadoPor = (S.currentUser&&S.currentUser.nombre)||'Admin';
      S.concesionarios.push(newConc);
    } else {
      newConc.updatedAt = new Date().toISOString();
      var idx = S.concesionarios.findIndex(function(x){return x.id===existing.id;});
      if(idx>=0) S.concesionarios[idx] = newConc;
    }
    if(DB && DB.saveConcesionario) DB.saveConcesionario(newConc);
    closeM();
    toast(existing ? 'Concesionario actualizado' : 'Concesionario creado','success');
    nav('concesionarios');
    return true;
  };
  $('mft').innerHTML = '<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    + (existing ? '<button class="btn btn-d btn-sm" onclick="_concEliminar(\''+existing.id+'\')">Eliminar</button>' : '')
    + '<button class="btn btn-p" onclick="saveM()">'+(existing?'Guardar cambios':'Crear concesionario')+'</button>';
  $('ov').style.display='flex';
}

function _concEliminar(id){
  var c = _concGetById(id);
  if(!c){ toast('No encontrado','error'); return; }
  // Verificar dependencias
  var nMotos = (S.motos||[]).filter(function(m){return !m.eliminado && m.concesionarioId===id;}).length;
  var nCreds = (S.creds||[]).filter(function(cr){return !cr.eliminado && cr.concesionarioId===id;}).length;
  var nClis = (S.clientes||[]).filter(function(cl){return !cl.eliminado && cl.concesionarioId===id;}).length;
  var nUsr = ((typeof _usersCache!=='undefined'&&_usersCache)?_usersCache.filter(function(u){return (u.concesionarios||[]).indexOf(id)!==-1;}).length:0);
  if(nMotos > 0 || nCreds > 0 || nClis > 0 || nUsr > 0){
    var msg = 'Este concesionario tiene datos asociados:\n\n';
    if(nMotos) msg += '• '+nMotos+' moto(s)\n';
    if(nCreds) msg += '• '+nCreds+' crédito(s)\n';
    if(nClis) msg += '• '+nClis+' cliente(s)\n';
    if(nUsr) msg += '• '+nUsr+' usuario(s) asignado(s)\n';
    msg += '\nMejor desactívalo en lugar de eliminarlo. ¿Marcar como inactivo?';
    if(confirm(msg)){
      c.activo = false;
      c.updatedAt = new Date().toISOString();
      if(DB && DB.saveConcesionario) DB.saveConcesionario(c);
      closeM();
      toast('Concesionario marcado como inactivo','info');
      nav('concesionarios');
    }
    return;
  }
  if(confirm('¿Eliminar concesionario "'+c.nombre+'"? Esta acción no se puede deshacer.')){
    c.eliminado = true;
    c.eliminadoEn = new Date().toISOString();
    c.eliminadoPor = (S.currentUser&&S.currentUser.nombre)||'Admin';
    if(DB && DB.saveConcesionario) DB.saveConcesionario(c);
    closeM();
    toast('Concesionario eliminado','info');
    nav('concesionarios');
  }
}

function _concAbrirDetalle(id){
  var c = _concGetById(id);
  if(!c){ toast('No encontrado','error'); return; }
  var st = {
    motos: (S.motos||[]).filter(function(m){return !m.eliminado && m.concesionarioId===id;}),
    creds: (S.creds||[]).filter(function(cr){return !cr.eliminado && cr.concesionarioId===id;}),
    clis:  (S.clientes||[]).filter(function(cl){return !cl.eliminado && cl.concesionarioId===id;}),
    pagos: (S.pagos||[]).filter(function(p){return !p.eliminado && p.concesionarioId===id;})
  };
  var usuarios = (typeof _usersCache!=='undefined'&&_usersCache) ? _usersCache.filter(function(u){return (u.concesionarios||[]).indexOf(id)!==-1;}) : [];
  setMicon('conces');
  $('mtt').textContent= c.nombre;
  $('msb').textContent= 'Detalle del concesionario';
  $('modal-box').className='modal modal-lg';
  $('mbd').innerHTML = ''
    + '<div style="background:var(--gs);padding:13px 15px;border-radius:10px;margin-bottom:13px">'
    + '<div style="font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px">INFORMACIÓN</div>'
    + '<div style="margin-top:6px;font-size:12.5px;line-height:1.6">'
    + (c.ciudad ? '<div><b>Ciudad:</b> '+c.ciudad+'</div>' : '')
    + (c.direccion ? '<div><b>Dirección:</b> '+c.direccion+'</div>' : '')
    + (c.telefono ? '<div><b>Teléfono:</b> '+c.telefono+'</div>' : '')
    + '<div><b>Estado:</b> '+(c.activo!==false?'<span style="color:var(--green);font-weight:700">Activo</span>':'<span style="color:var(--red);font-weight:700">Inactivo</span>')+'</div>'
    + (c.createdAt?'<div style="color:var(--ink3);font-size:10.5px;margin-top:3px">Creado: '+(c.createdAt||'').slice(0,10)+'</div>':'')
    + '</div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">'
    + '<div style="background:var(--surf);padding:12px;border-radius:9px;text-align:center;border:1px solid var(--rim2)"><div style="font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase">Motos</div><div style="font-family:var(--fd);font-weight:800;font-size:20px;margin-top:3px">'+st.motos.length+'</div></div>'
    + '<div style="background:var(--surf);padding:12px;border-radius:9px;text-align:center;border:1px solid var(--rim2)"><div style="font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase">Créditos</div><div style="font-family:var(--fd);font-weight:800;font-size:20px;margin-top:3px;color:var(--p1)">'+st.creds.length+'</div></div>'
    + '<div style="background:var(--surf);padding:12px;border-radius:9px;text-align:center;border:1px solid var(--rim2)"><div style="font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase">Clientes</div><div style="font-family:var(--fd);font-weight:800;font-size:20px;margin-top:3px">'+st.clis.length+'</div></div>'
    + '<div style="background:var(--surf);padding:12px;border-radius:9px;text-align:center;border:1px solid var(--rim2)"><div style="font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase">Pagos</div><div style="font-family:var(--fd);font-weight:800;font-size:20px;margin-top:3px;color:var(--green)">'+st.pagos.length+'</div></div>'
    + '</div>'
    // Usuarios asignados
    + '<div style="margin-top:10px"><div style="font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Usuarios asignados ('+usuarios.length+')</div>'
    + (usuarios.length === 0
        ? '<div style="padding:18px;text-align:center;background:var(--gs);border-radius:9px;color:var(--ink3);font-size:11.5px">Sin usuarios asignados. Asigna usuarios desde el módulo <b>Usuarios</b> → Editar permisos.</div>'
        : '<div style="display:grid;gap:6px">'+ usuarios.map(function(u){
            return '<div style="background:var(--gs);padding:9px 11px;border-radius:8px;display:flex;justify-content:space-between;align-items:center">'
              + '<div><div style="font-weight:700;font-size:12.5px">'+(u.nombre||u.email||'?')+'</div><div style="font-size:10.5px;color:var(--ink3)">'+(u.rol||'')+' · '+(u.email||'')+'</div></div>'
              + '<button class="btn btn-g btn-xs" onclick="closeM();nav(\'users\');setTimeout(function(){editarUsuario(\''+u.uid+'\');},250)">Editar</button>'
              + '</div>';
          }).join('') +'</div>')
    + '</div>';
  $('mft').innerHTML = '<button class="btn btn-g" onclick="closeM()">Cerrar</button>'
    + '<button class="btn btn-p" onclick="_concOpenEdit(\''+c.id+'\')">Editar</button>';
  $('ov').style.display='flex';
}


// ╔══════════════════════════════════════════════════════════╗
// ║  ASIGNACIÓN DE HISTÓRICO POR CONCESIONARIO (Entrega 2)    ║
// ║  - Modal masivo: aplicar a todo lo sin asignar de un tipo ║
// ║  - Modal individual: lista filtrable, asignar uno por uno ║
// ╚══════════════════════════════════════════════════════════╝

// Modal: asignación masiva
function _concAbrirAsignarMasivo(){
  var concesList = (S.concesionarios||[]).filter(function(c){return !c.eliminado && c.activo!==false;});
  if(!concesList.length){ toast('No hay concesionarios disponibles','error'); return; }
  var sin = _concContarSinAsignar();
  setMicon('conces');
  $('mtt').textContent='Asignación Masiva de Histórico';
  $('msb').textContent='Aplicar concesionario a todo lo sin asignar';
  $('modal-box').className='modal';
  $('mbd').innerHTML = ''
    + '<div style="background:rgba(255,165,0,0.08);border:1px solid rgba(255,165,0,0.3);border-radius:9px;padding:11px 13px;margin-bottom:14px;font-size:11.5px;line-height:1.55">'
    + '<strong style="color:var(--amber)">⚠ Atención:</strong> Esta acción asignará TODOS los registros sin concesionario al sede que selecciones. Útil si todo tu histórico viene de una sola sede.'
    + '</div>'
    + '<div class="fg" style="margin-bottom:10px"><label>Concesionario destino</label>'
    + '<select class="fs" id="cmas_sede">'
    + concesList.map(function(c){
        return '<option value="'+c.id+'">'+c.nombre+(c.ciudad?' · '+c.ciudad:'')+'</option>';
      }).join('')
    + '</select></div>'
    + '<div style="margin-top:14px"><div style="font-size:11px;font-weight:800;color:var(--ink2);margin-bottom:8px">¿Qué tipos asignar?</div>'
    + '<div style="display:grid;gap:6px">'
    + '<label style="display:flex;align-items:center;gap:8px;padding:9px 11px;background:var(--gs);border-radius:8px;cursor:pointer'+(sin.motos===0?';opacity:.5':'')+'">'
    + '<input type="checkbox" id="cmas_motos" '+(sin.motos>0?'checked':'disabled')+' style="accent-color:var(--p1);transform:scale(1.1)">'
    + '<span style="flex:1"><b>Motos</b> · '+sin.motos+' sin asignar</span></label>'
    + '<label style="display:flex;align-items:center;gap:8px;padding:9px 11px;background:var(--gs);border-radius:8px;cursor:pointer'+(sin.creds===0?';opacity:.5':'')+'">'
    + '<input type="checkbox" id="cmas_creds" '+(sin.creds>0?'checked':'disabled')+' style="accent-color:var(--p1);transform:scale(1.1)">'
    + '<span style="flex:1"><b>Créditos</b> · '+sin.creds+' sin asignar</span></label>'
    + '<label style="display:flex;align-items:center;gap:8px;padding:9px 11px;background:var(--gs);border-radius:8px;cursor:pointer'+(sin.clis===0?';opacity:.5':'')+'">'
    + '<input type="checkbox" id="cmas_clis" '+(sin.clis>0?'checked':'disabled')+' style="accent-color:var(--p1);transform:scale(1.1)">'
    + '<span style="flex:1"><b>Clientes</b> · '+sin.clis+' sin asignar</span></label>'
    + '<label style="display:flex;align-items:center;gap:8px;padding:9px 11px;background:var(--gs);border-radius:8px;cursor:pointer'+(sin.pagos===0?';opacity:.5':'')+'">'
    + '<input type="checkbox" id="cmas_pagos" '+(sin.pagos>0?'checked':'disabled')+' style="accent-color:var(--p1);transform:scale(1.1)">'
    + '<span style="flex:1"><b>Pagos</b> · '+sin.pagos+' sin asignar</span></label>'
    + '</div></div>'
    + '<div id="cmas_info" style="margin-top:11px;font-size:11px;color:var(--ink3);font-style:italic"></div>';
  $('mft').innerHTML = '<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    + '<button class="btn btn-p" onclick="_concEjecutarMasivo()">Asignar registros</button>';
  $('ov').style.display='flex';
}

function _concEjecutarMasivo(){
  var sedeId = ($('cmas_sede')&&$('cmas_sede').value);
  if(!sedeId){ toast('Selecciona un concesionario','error'); return; }
  var sede = _concGetById(sedeId);
  if(!sede){ toast('Concesionario no encontrado','error'); return; }
  var hacerMotos = !!($('cmas_motos')&&$('cmas_motos').checked);
  var hacerCreds = !!($('cmas_creds')&&$('cmas_creds').checked);
  var hacerClis  = !!($('cmas_clis')&&$('cmas_clis').checked);
  var hacerPagos = !!($('cmas_pagos')&&$('cmas_pagos').checked);
  if(!hacerMotos && !hacerCreds && !hacerClis && !hacerPagos){
    toast('Selecciona al menos un tipo','error'); return;
  }
  if(!confirm('¿Asignar todos los registros sin concesionario seleccionados a "'+sede.nombre+'"?\n\nEsto modificará registros en la base de datos.')) return;
  var total = 0;
  if(hacerMotos){
    (S.motos||[]).forEach(function(m){
      if(!m.eliminado && !m.concesionarioId){
        m.concesionarioId = sedeId;
        if(DB && DB.saveMoto) DB.saveMoto(m);
        total++;
      }
    });
  }
  if(hacerCreds){
    (S.creds||[]).forEach(function(c){
      if(!c.eliminado && !c.concesionarioId){
        c.concesionarioId = sedeId;
        if(DB && DB.saveCred) DB.saveCred(c);
        total++;
        // Cascadear a los pagos de este crédito sin sede
        (S.pagos||[]).forEach(function(p){
          if(!p.eliminado && !p.concesionarioId && p.cred === c.id){
            p.concesionarioId = sedeId;
            if(DB && DB.savePago) DB.savePago(p);
            total++;
          }
        });
      }
    });
  }
  if(hacerClis){
    (S.clientes||[]).forEach(function(cl){
      if(!cl.eliminado && !cl.concesionarioId){
        cl.concesionarioId = sedeId;
        if(DB && DB.saveCliente) DB.saveCliente(cl);
        total++;
      }
    });
  }
  if(hacerPagos){
    (S.pagos||[]).forEach(function(p){
      if(!p.eliminado && !p.concesionarioId){
        p.concesionarioId = sedeId;
        if(DB && DB.savePago) DB.savePago(p);
        total++;
      }
    });
  }
  closeM();
  toast(total+' registros asignados a '+sede.nombre,'success');
  nav('concesionarios');
}

// Modal: asignación individual con lista filtrable
var _concAsignIndState = { tipo:'motos', q:'' };

function _concAbrirAsignarIndividual(){
  _concAsignIndState = { tipo:'motos', q:'' };
  _concRenderAsignarIndividual();
  $('ov').style.display='flex';
}

function _concRenderAsignarIndividual(){
  var concesList = (S.concesionarios||[]).filter(function(c){return !c.eliminado && c.activo!==false;});
  if(!concesList.length){ toast('No hay concesionarios disponibles','error'); return; }
  var tipo = _concAsignIndState.tipo || 'motos';
  var q = (_concAsignIndState.q || '').toLowerCase().trim();
  setMicon('detalle');
  $('mtt').textContent='Asignación Individual';
  $('msb').textContent='Asigna registros uno por uno';
  $('modal-box').className='modal modal-lg';
  // Tab buttons
  var sin = _concContarSinAsignar();
  var tabBtn = function(t, lbl, count){
    var act = tipo === t;
    return '<button onclick="_concAsignSetTipo(\''+t+'\')" style="background:none;border:none;padding:9px 14px;font-size:12px;font-weight:'+(act?'800':'600')+';color:'+(act?'var(--p1)':'var(--ink3)')+';border-bottom:3px solid '+(act?'var(--p1)':'transparent')+';margin-bottom:-2px;cursor:pointer;font-family:var(--f)">'
      + lbl + ' <span style="background:'+(act?'var(--p1)':'var(--gs)')+';color:'+(act?'#fff':'var(--ink2)')+';font-size:10px;padding:1px 7px;border-radius:9px;margin-left:4px">'+count+'</span>'
      + '</button>';
  };
  // Datos según tipo
  var registros = [];
  if(tipo==='motos'){
    registros = (S.motos||[]).filter(function(m){return !m.eliminado && !m.concesionarioId;});
    if(q) registros = registros.filter(function(m){ return (((m.modelo||'')+' '+(m.vin||'')+' '+(m.cliente||'')).toLowerCase().indexOf(q) !== -1); });
  } else if(tipo==='creds'){
    registros = (S.creds||[]).filter(function(c){return !c.eliminado && !c.concesionarioId;});
    if(q) registros = registros.filter(function(c){ return (((c.cli||'')+' '+(c.modelo||'')+' '+(c.id||'')).toLowerCase().indexOf(q) !== -1); });
  } else if(tipo==='clis'){
    registros = (S.clientes||[]).filter(function(cl){return !cl.eliminado && !cl.concesionarioId;});
    if(q) registros = registros.filter(function(cl){ return (((cl.nombre||'')+' '+(cl.cedula||'')+' '+(cl.tel||'')).toLowerCase().indexOf(q) !== -1); });
  } else { // pagos
    registros = (S.pagos||[]).filter(function(p){return !p.eliminado && !p.concesionarioId;});
    if(q) registros = registros.filter(function(p){ return (((p.cli||'')+' '+(p.id||'')+' '+(p.cred||'')).toLowerCase().indexOf(q) !== -1); });
  }
  registros = registros.slice(0, 200); // limitar para no colgar el navegador
  // Construir select de sedes para cada fila
  var sedesOpts = '<option value="">— Sin asignar —</option>' + concesList.map(function(c){ return '<option value="'+c.id+'">'+c.nombre+'</option>'; }).join('');
  // Render filas según tipo
  var filas;
  if(registros.length === 0){
    filas = '<div style="padding:40px 20px;text-align:center;color:var(--ink3);font-size:12.5px">' + (q ? 'Sin resultados para "'+q+'"' : 'No hay registros sin asignar de este tipo') + '</div>';
  } else {
    filas = '<div style="display:grid;gap:5px;max-height:380px;overflow-y:auto">'
      + registros.map(function(r){
          var label, sub;
          if(tipo==='motos'){
            label = (r.modelo||'(sin modelo)') + ' · ' + (r.estado||'');
            sub = 'VIN: '+(r.vin||'—')+(r.cliente?' · Cliente: '+r.cliente:'');
          } else if(tipo==='creds'){
            label = r.id + ' · ' + (r.cli||'');
            sub = (r.modelo||'') + ' · ' + (r.estado||'') + (r.fecha?' · '+r.fecha:'');
          } else if(tipo==='clis'){
            label = r.nombre || '(sin nombre)';
            sub = 'C.I.: '+(r.cedula||'—')+(r.tel?' · '+r.tel:'')+(r.ciudad?' · '+r.ciudad:'');
          } else {
            label = r.id + ' · ' + (r.cli||'');
            sub = '$'+(parseFloat(r.monto)||0).toFixed(2)+(r.fecha?' · '+r.fecha:'')+' · '+(r.metodo||'');
          }
          return '<div style="display:grid;grid-template-columns:1fr auto;gap:10px;padding:9px 11px;background:var(--gs);border-radius:8px;align-items:center">'
            + '<div style="min-width:0">'
            + '<div style="font-size:12.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+label+'</div>'
            + '<div style="font-size:10.5px;color:var(--ink3);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+sub+'</div>'
            + '</div>'
            + '<select class="fs" style="min-width:160px;font-size:11.5px" onchange="_concAsignarUno(\''+tipo+'\',\''+String(r.id).replace(/\'/g,'')+'\', this.value)">'+sedesOpts+'</select>'
            + '</div>';
        }).join('')
      + '</div>';
    if((tipo==='motos'?sin.motos:tipo==='creds'?sin.creds:tipo==='clis'?sin.clis:sin.pagos) > 200){
      filas += '<div style="margin-top:9px;padding:8px;background:rgba(255,165,0,.08);border-radius:7px;text-align:center;font-size:11px;color:var(--ink3)">Mostrando los primeros 200. Usa el buscador para filtrar.</div>';
    }
  }
  $('mbd').innerHTML = ''
    // Tabs por tipo
    + '<div style="display:flex;border-bottom:2px solid var(--rim);margin-bottom:12px">'
    + tabBtn('motos','Motos',sin.motos)
    + tabBtn('creds','Créditos',sin.creds)
    + tabBtn('clis','Clientes',sin.clis)
    + tabBtn('pagos','Pagos',sin.pagos)
    + '</div>'
    // Buscador
    + '<div class="fg" style="margin-bottom:12px"><input class="fi" id="cind_q" placeholder="Buscar..." value="'+q.replace(/"/g,'&quot;')+'" oninput="_concAsignSetQ(this.value)" style="font-size:12.5px"></div>'
    // Lista
    + filas;
  $('mft').innerHTML = '<button class="btn btn-g" onclick="closeM();nav(\'concesionarios\')">Cerrar</button>';
}

function _concAsignSetTipo(t){
  _concAsignIndState.tipo = t;
  _concAsignIndState.q = '';
  _concRenderAsignarIndividual();
}

var _concAsignDebounce;
function _concAsignSetQ(v){
  _concAsignIndState.q = v || '';
  clearTimeout(_concAsignDebounce);
  _concAsignDebounce = setTimeout(_concRenderAsignarIndividual, 200);
}

function _concAsignarUno(tipo, id, sedeId){
  if(!sedeId) return;
  var coll, saveFn;
  if(tipo==='motos'){ coll=S.motos; saveFn=DB.saveMoto; }
  else if(tipo==='creds'){ coll=S.creds; saveFn=DB.saveCred; }
  else if(tipo==='clis'){ coll=S.clientes; saveFn=DB.saveCliente; }
  else { coll=S.pagos; saveFn=DB.savePago; }
  if(!coll) return;
  var it = coll.find(function(x){ return String(x.id) === String(id); });
  if(!it){ toast('Registro no encontrado','error'); return; }
  it.concesionarioId = sedeId;
  if(saveFn) saveFn(it);
  // Si es crédito, cascadear a sus pagos sin sede
  if(tipo==='creds'){
    var nPagos = 0;
    (S.pagos||[]).forEach(function(p){
      if(!p.eliminado && !p.concesionarioId && p.cred === it.id){
        p.concesionarioId = sedeId;
        if(DB && DB.savePago) DB.savePago(p);
        nPagos++;
      }
    });
    toast('Crédito asignado' + (nPagos > 0 ? ' + '+nPagos+' pago(s)' : ''), 'success');
  } else {
    toast('Asignado','success');
  }
  _concRenderAsignarIndividual();
}


// ╔══════════════════════════════════════════════════════════╗
// ║  BANDEJA DE APROBACIONES (Entrega 3)                      ║
// ║  Créditos creados por Vendedores Concesionario en estado  ║
// ║  'pendiente_revision' que requieren tu visto bueno.       ║
// ╚══════════════════════════════════════════════════════════╝

// Cuenta créditos pendientes de revisión (visibles según concesionario activo)
