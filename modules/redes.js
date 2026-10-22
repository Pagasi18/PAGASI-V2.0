// Pagasi module: redes (22-oct-2026). Adam: "el módulo de WhatsApp e Instagram ponlo en uno solo
// que se llame Redes sociales... que aparezca todo: Messenger, Instagram, WhatsApp, comentarios de
// Facebook, comentarios de Instagram, igual que la foto" (la bandeja de Meta Business Suite).
// Arriba, una pestaña por canal; debajo, la misma pantalla de siempre (lista + hilo + ficha, el
// motor de modules/whatsapp.js). La cola de cobranza de hoy y las instrucciones de las asistentes
// quedan como botones arriba a la derecha. Cada canal lo ve quien tiene su permiso ('whatsapp' o
// 'instagram', los mismos de las Reglas). Messenger y los comentarios de Facebook todavía no
// llegan al servidor (Adam, 22-oct: "por ahora no" a conectarlos): sus pestañas lo dicen.
window._rsTab = window._rsTab || 'todos';
window._rsVista = window._rsVista || 'bandeja';   // bandeja · hoy · asistente
window._rsAsis = window._rsAsis || 'cobranza';     // en Asistentes: cobranza (Patricia) · ventas (Paola)
window._rsComSel = window._rsComSel || '';
window._rsComFiltro = window._rsComFiltro || 'todos';

// perm: el permiso que hace falta para ver la pestaña. pendiente: el canal aún no está conectado.
var RS_TABS = [
  { id: 'todos', nombre: 'Todos los mensajes' },
  { id: 'messenger', nombre: 'Messenger', perm: 'instagram', pendiente: true },
  { id: 'instagram', nombre: 'Instagram', perm: 'instagram' },
  { id: 'whatsapp', nombre: 'WhatsApp', perm: 'whatsapp' },
  { id: 'fbcom', nombre: 'Comentarios de Facebook', perm: 'instagram', pendiente: true },
  { id: 'igcom', nombre: 'Comentarios de Instagram', perm: 'instagram' }
];
function _rsVe(canal){ return typeof hasModuleAccess !== 'function' || hasModuleAccess(canal); }
function _rsTabsVisibles(){ return RS_TABS.filter(function(t){ return !t.perm || _rsVe(t.perm); }); }
function _rsGlobo(n){ return n > 0 ? '<span class="b">' + (n > 9 ? '9+' : n) + '</span>' : ''; }
// Lo que pide atención en cada pestaña: conversaciones con mensajes sin leer, o comentarios de hoy
function _rsCuenta(tab){
  if(tab === 'igcom') return (window._waComs || []).filter(function(c){ return _waEsHoy(c.hora); }).length;
  if(tab === 'messenger' || tab === 'fbcom') return 0;
  return _waConvsDe({ canal: tab }).filter(function(c){ return (c.noLeidos || 0) > 0; }).length;
}

var _RS_CSS = '<style id="rs-css">'
  + '.rs-tabs{display:flex;gap:4px;background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:6px;margin-bottom:12px;overflow-x:auto}'
  + '.rs-tabs button{border:0;background:transparent;border-radius:10px;padding:9px 14px;font:inherit;font-size:13px;font-weight:700;color:var(--ink2);cursor:pointer;display:flex;gap:7px;align-items:center;white-space:nowrap;flex:none}'
  + '.rs-tabs button:hover{background:var(--surf2)}.rs-tabs button.on{background:#e8f0ff;color:#065cff}'
  + '.rs-tabs .b{background:#c81e1e;color:#fff;border-radius:999px;font-size:10.5px;font-weight:800;padding:1px 7px;line-height:16px}'
  + '.rs-tabs .pend{background:var(--surf2);color:var(--ink3);border-radius:999px;font-size:10px;font-weight:800;padding:1px 7px}'
  + '.rs-pend{background:var(--surf);border:1px solid var(--rim);border-radius:var(--r20);padding:46px 24px;text-align:center}.rs-pend .ic{font-size:34px;margin-bottom:10px}.rs-pend b{display:block;font-size:16px;margin-bottom:8px}.rs-pend p{max-width:520px;margin:0 auto;color:var(--ink3);font-size:13px;line-height:1.6}'
  + '.rs-com .estado{margin-top:4px}.rs-asis{display:flex;gap:0;margin:0 0 14px;border:1px solid var(--rim);border-radius:14px;overflow:hidden;width:max-content;max-width:100%}.rs-asis button{border:0;background:var(--surf);font:inherit;font-size:13px;font-weight:800;color:var(--ink2);padding:10px 18px;cursor:pointer}.rs-asis button+button{border-left:1px solid var(--rim)}.rs-asis button.on{background:var(--p1);color:#fff}'
  + '</style>';

function rsTab(t){ window._rsTab = t; window._rsVista = 'bandeja'; window._waSel = null; nav('redes'); }
function rsVista(v){ window._rsVista = v; nav('redes'); }
function rsAsis(a){ window._rsAsis = a; nav('redes'); }

// Globos de las pestañas y contadores de arriba, en el sitio (al llegar mensajes o comentarios)
function _rsPintarContadores(){
  _rsTabsVisibles().forEach(function(t){ var e = document.getElementById('rs-b-' + t.id); if(e) e.innerHTML = t.pendiente ? '' : _rsGlobo(_rsCuenta(t.id)); });
}

// ── Messenger y comentarios de Facebook: todavía no llegan ──
function _rsPanelPendiente(tab){
  var ms = tab === 'messenger';
  return '<div class="rs-pend"><div class="ic">' + (ms ? '💬' : '📝') + '</div><b>' + (ms ? 'Messenger' : 'Los comentarios de Facebook') + ' todavía no ' + (ms ? 'está conectado' : 'están conectados') + '</b>'
    + '<p>' + (ms
      ? 'Los mensajes que la gente le escribe a la página de Facebook de Pagasi todavía no le llegan al sistema. Cuando se conecte, aparecerán aquí y Paola los contestará igual que en Instagram.'
      : 'Los comentarios en las publicaciones y anuncios de Facebook todavía no le llegan al sistema. Para que Paola también pueda contestarlos, Meta pide un permiso más que hay que solicitarles.')
    + '</p></div>';
}

// ── Comentarios de Instagram ──
var RS_COM_FILTROS = [
  { id: 'todos', nombre: 'Todos', f: function(){ return true; } },
  { id: 'respondido', nombre: 'Paola respondió', f: function(c){ return c.estado === 'respondido'; } },
  { id: 'sin', nombre: 'Sin respuesta', f: function(c){ return c.estado === 'sin-respuesta' || c.estado === 'nuevo'; } },
  { id: 'reclamos', nombre: 'Reclamos', f: function(c){ return !!c.reclamo; } },
  { id: 'fallo', nombre: 'No se pudo enviar', f: function(c){ return c.estado === 'fallo'; } },
  { id: 'hoy', nombre: 'Hoy', f: function(c){ return _waEsHoy(c.hora); } }
];
function _rsComEstado(c){
  return c.estado === 'respondido' ? '<span class="wa-pill verde">Paola respondió</span>'
    : c.estado === 'fallo' ? '<span class="wa-pill rojo">No se pudo enviar</span>'
    : c.estado === 'nuevo' ? '<span class="wa-pill azul">Recién llegado</span>'
    : '<span class="wa-pill gris">Sin respuesta</span>';
}
function _rsComDonde(c){ return c.tipoMedia === 'AD' ? 'un anuncio' : c.tipoMedia === 'REELS' ? 'un reel' : c.tipoMedia === 'STORY' ? 'una historia' : 'una publicación'; }
function rsComFiltro(f){ window._rsComFiltro = f; _rsPintarComentarios(); }
function rsComAbrir(id){ window._rsComSel = id; _rsPintarComentarios(); }
// La conversación privada que abrió Paola a partir del comentario (si la hay)
function _rsComConv(c){
  var igsid = c.privado && c.privado.igsid;
  return (window._waConvs || []).find(function(x){ return x.canal === 'instagram' && (x.origenComentario === c.id || (igsid && x.id === 'ig:' + igsid)); });
}
function _rsPanelComentarios(){
  setTimeout(_rsPintarComentarios, 0);
  return '<div class="wa-split rs-com">'
    + '<div class="wa-lista"><div class="wa-busca"><input class="fi" id="rs-com-q" placeholder="Buscar por usuario o texto" oninput="_rsPintarComentarios()" style="width:100%"></div><div class="wa-filtros" id="rs-com-filtros"></div><div class="items" id="rs-com-items"></div></div>'
    + '<div class="wa-hilo" id="rs-com-hilo"></div>'
    + '<div class="wa-ficha" id="rs-com-ficha"></div></div>';
}
function _rsPintarComentarios(){
  var cont = document.getElementById('rs-com-items'); if(!cont) return;
  if(typeof _waAjustarAltura === 'function') _waAjustarAltura();
  var todos = window._waComs || [], q = String((document.getElementById('rs-com-q') || {}).value || '').toLowerCase();
  var filtro = RS_COM_FILTROS.find(function(f){ return f.id === window._rsComFiltro; }) || RS_COM_FILTROS[0];
  var chips = document.getElementById('rs-com-filtros');
  if(chips) chips.innerHTML = RS_COM_FILTROS.map(function(f){ var n = todos.filter(f.f).length; return '<button class="' + (f.id === filtro.id ? 'on' : '') + '" onclick="rsComFiltro(\'' + f.id + '\')"' + (!n && f.id !== 'todos' && f.id !== filtro.id ? ' disabled' : '') + '>' + f.nombre + '<i>' + n + '</i></button>'; }).join('');
  var lista = todos.filter(filtro.f).filter(function(c){ return !q || (String(c.usuario || '') + ' ' + String(c.texto || '')).toLowerCase().indexOf(q) > -1; });
  var sel = lista.find(function(c){ return c.id === window._rsComSel; }) || lista[0] || null;
  window._rsComSel = sel ? sel.id : '';
  cont.innerHTML = window._waComsError ? '<div class="empty" style="padding:30px 16px">No se pudieron leer los comentarios: ' + _waEsc(window._waComsError) + '</div>'
    : lista.length ? lista.map(function(c){
      return '<div class="wa-item' + (sel && c.id === sel.id ? ' on' : '') + '" onclick="rsComAbrir(\'' + _waEsc(c.id) + '\')">'
        + '<div class="av ig">' + _waEsc(String(c.usuario || '?').slice(0, 2).toUpperCase()) + '<span class="cn ig"></span></div>'
        + '<div><div class="n">@' + _waEsc(c.usuario || 'alguien') + (c.reclamo ? '<span class="wa-pill rojo">reclamo</span>' : '') + '</div>'
        + '<div class="u">' + _waEsc(c.texto || '') + '</div><div class="estado">' + _rsComEstado(c) + '</div></div>'
        + '<div class="h">' + _waHora(c.hora) + '</div></div>';
    }).join('') : '<div class="empty" style="padding:30px 16px">' + (todos.length ? 'Ningún comentario con ese filtro.' : 'Todavía no hay comentarios.') + '</div>';
  var hilo = document.getElementById('rs-com-hilo'), ficha = document.getElementById('rs-com-ficha');
  if(!sel){ if(hilo) hilo.innerHTML = '<div class="empty" style="padding:60px 20px">Elige un comentario.</div>'; if(ficha) ficha.innerHTML = ''; return; }
  var conv = _rsComConv(sel);
  if(hilo) hilo.innerHTML = '<div class="wa-hilo-top"><div class="quien"><b>@' + _waEsc(sel.usuario || 'alguien') + '</b><small>Comentó en ' + _rsComDonde(sel) + ' de Instagram · ' + _waHora(sel.hora) + '</small></div>'
      + '<div class="acc">' + (conv ? '<button class="btn btn-p btn-sm" onclick="rsTab(\'instagram\');setTimeout(function(){ waAbrir(\'' + _waEsc(conv.id) + '\'); },0)">Ver la conversación privada</button>' : '') + '</div></div>'
    + '<div class="wa-burbujas">'
      + '<div class="wa-b cliente">' + _waEsc(sel.texto || '(sin texto)') + '<div class="meta"><span class="quien">@' + _waEsc(sel.usuario || '') + '</span><span>' + _waHora(sel.hora) + '</span></div></div>'
      + (sel.respuesta ? '<div class="wa-b asistente"><div class="plantilla">Respuesta pública</div>' + _waEsc(sel.respuesta) + '<div class="meta"><span class="quien">Paola</span><span>' + _waHora(sel.respondidoEn || sel.hora) + '</span>' + (sel.estado === 'fallo' ? '<span style="color:var(--red)">✕ no se publicó</span>' : '') + '</div></div>' : '')
      + (sel.privado && sel.privado.enviado ? '<div class="wa-b asistente"><div class="plantilla">Mensaje privado</div>Paola también le escribió por mensaje directo.' + (conv ? '' : ' (la conversación aparece en la pestaña Instagram)') + '<div class="meta"><span class="quien">Paola</span></div></div>' : '')
    + '</div>'
    + '<div class="wa-cerrada" style="background:var(--surf2);color:var(--ink3);border-top-color:var(--rim)">Paola contesta los comentarios sola. Para contestar tú, hazlo desde Instagram.</div>';
  if(ficha) ficha.innerHTML = '<div class="card"><div class="ct">Comentario</div>'
      + '<div class="wa-kv"><span>Usuario</span><span>@' + _waEsc(sel.usuario || '—') + '</span></div>'
      + '<div class="wa-kv"><span>Dónde</span><span>' + ({ AD: 'Anuncio', REELS: 'Reel', STORY: 'Historia' }[sel.tipoMedia] || 'Publicación') + '</span></div>'
      + '<div class="wa-kv"><span>Fecha</span><span>' + _waHora(sel.hora) + '</span></div>'
      + '<div class="wa-kv"><span>Estado</span><span>' + _rsComEstado(sel) + '</span></div>'
      + (sel.motivo ? '<div class="wa-kv"><span>Por qué no respondió</span><span>' + _waEsc(sel.motivo) + '</span></div>' : '')
      + (sel.error ? '<div class="wa-kv"><span>Error</span><span>' + _waEsc(sel.error) + '</span></div>' : '')
      + '<div class="wa-kv"><span>Mensaje privado</span><span>' + (sel.privado && sel.privado.enviado ? 'Sí' : 'No') + '</span></div>'
      + '<div class="wa-kv"><span>Reclamo</span><span>' + (sel.reclamo ? '<span class="wa-pill rojo">Sí</span>' : 'No') + '</span></div>'
      + (sel.resumen ? '<div class="cs" style="margin-top:10px;line-height:1.5"><b>Resumen:</b> ' + _waEsc(sel.resumen) + '</div>' : '')
    + '</div>';
}
function _rsRefrescarComentarios(){ _rsPintarContadores(); _rsPintarComentarios(); }

PG.redes = function(){
  if(!document.getElementById('wa-css')) document.head.insertAdjacentHTML('beforeend', _WA_CSS);
  if(!document.getElementById('rs-css')) document.head.insertAdjacentHTML('beforeend', _RS_CSS);
  if(!window._waCfg){ waCargarCfg(function(){ if(S.page === 'redes') nav('redes'); }); }
  var veWa = _rsVe('whatsapp'), veIg = _rsVe('instagram'), cfg = window._waCfg || {};
  var tabs = _rsTabsVisibles();
  if(!tabs.some(function(t){ return t.id === window._rsTab; })) window._rsTab = 'todos';
  var cola = veWa ? waColaHoy() : null;
  // Cada canal se abre solo si este usuario lo ve (las Reglas tampoco dejan leer el otro)
  if(veWa){ if(waConectado()) waAbrirConversaciones('whatsapp'); else waDemoConversaciones(cola); }
  if(veIg){ if(waConectadoCanal('instagram')) waAbrirConversaciones('instagram'); else waDemoInstagram(); waAbrirComentarios(); }
  if(window._rsVista === 'hoy' && !veWa) window._rsVista = 'bandeja';
  var vista = window._rsVista, tab = window._rsTab, ctx = _waCtxActual();
  var convs = _waConvsDe(ctx), esperan = convs.filter(function(c){ return c.atencion; }).length, leads = convs.filter(function(c){ return c.borrador && c.borrador.tipo === 'lead'; }).length;
  var waOk = waConectado(), igOk = waConectadoCanal('instagram');

  var h = '<div class="page wa-page">'
    + '<div class="wa-cab"><div class="wa-cab-izq"><div class="ct" style="font-size:20px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">Redes sociales '
      + (veWa ? (waOk ? '<span class="wa-pill verde">WhatsApp · ' + _waEsc(cfg.telefono || 'conectado') + '</span>' : '<span class="wa-pill ambar">WhatsApp en demostración</span>') : '')
      + (veIg ? (igOk ? '<span class="wa-pill ig">Instagram · @' + _waEsc(String(cfg.instagram).replace(/^@/, '')) + '</span>' : '<span class="wa-pill ambar">Instagram en demostración</span>') : '')
    + '</div><div class="cs">Todos los mensajes y comentarios de Pagasi en un solo sitio. ' + (veWa ? 'Patricia atiende la cobranza por WhatsApp. ' : '') + 'Paola atiende las ventas' + (veIg && veWa ? ' por WhatsApp e Instagram' : veIg ? ' por Instagram' : ' por WhatsApp') + '.</div></div>'
    + '<div class="wa-cab-der">'
      + (vista === 'bandeja' && tab !== 'igcom' && tab !== 'messenger' && tab !== 'fbcom' ? '<div class="wa-minis"><span><b id="wa-st-conv">' + convs.length + '</b> conversaciones</span><span class="ambar"><b id="wa-st-esperan">' + esperan + '</b> esperan persona</span><span class="verde"><b id="wa-st-leads">' + leads + '</b> quieren comprar</span></div>' : '')
      + '<div class="wa-tabs"><button class="' + (vista === 'bandeja' ? 'on' : '') + '" onclick="rsVista(\'bandeja\')">Bandeja</button>'
      + (veWa ? '<button class="' + (vista === 'hoy' ? 'on' : '') + '" onclick="rsVista(\'hoy\')">Cobranza de hoy · ' + cola.total + '</button>' : '')
      + '<button class="' + (vista === 'asistente' ? 'on' : '') + '" onclick="rsVista(\'asistente\')">Asistentes</button></div>'
    + '</div></div>'
    + ((veWa && !waOk) || (veIg && !igOk) ? '<div class="wa-aviso"><span style="font-size:18px">⚠️</span><div><b>' + (veWa && !waOk && veIg && !igOk ? 'WhatsApp e Instagram todavía no están conectados' : veWa && !waOk ? 'WhatsApp todavía no está conectado' : 'Instagram todavía no está conectado') + ' en esta compañía.</b> Lo que ves de ' + (veWa && !waOk && veIg && !igOk ? 'esos canales' : 'ese canal') + ' es de muestra, en memoria, para ver cómo atienden las asistentes.</div></div>' : '');

  if(vista === 'hoy'){
    h += _waPanelHoy(cola);
  } else if(vista === 'asistente'){
    var area = window._rsAsis;
    if(area === 'cobranza' && !veWa) area = 'ventas';
    h += '<div class="rs-asis">' + (veWa ? '<button class="' + (area === 'cobranza' ? 'on' : '') + '" onclick="rsAsis(\'cobranza\')">Patricia · cobranza</button>' : '') + '<button class="' + (area === 'ventas' ? 'on' : '') + '" onclick="rsAsis(\'ventas\')">Paola · ventas</button></div>'
      + _waPanelAsistente({ modulo: 'redes', canal: area === 'cobranza' ? 'whatsapp' : (veIg ? 'instagram' : 'whatsapp'), area: area });
  } else {
    h += '<div class="rs-tabs">' + tabs.map(function(t){
      return '<button class="' + (t.id === tab ? 'on' : '') + '" onclick="rsTab(\'' + t.id + '\')">' + t.nombre
        + '<span id="rs-b-' + t.id + '">' + (t.pendiente ? '' : _rsGlobo(_rsCuenta(t.id))) + '</span>' + (t.pendiente ? '<span class="pend">sin conectar</span>' : '') + '</button>';
    }).join('') + '</div>';
    // En pantallas angostas la fila de pestañas se desliza: que la abierta quede a la vista
    setTimeout(function(){ var b = document.querySelector('.rs-tabs button.on'), f = b && b.parentNode; if(f && b.offsetLeft + b.offsetWidth > f.clientWidth) f.scrollLeft = b.offsetLeft - 12; }, 0);
    if(tab === 'messenger' || tab === 'fbcom') h += _rsPanelPendiente(tab);
    else if(tab === 'igcom') h += _rsPanelComentarios();
    else h += _waPanelConversaciones(ctx);
  }
  h += '</div>';
  return h;
};
