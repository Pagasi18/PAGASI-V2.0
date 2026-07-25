// ══════════════════════════════════════════════════════════════════════════
// PORTAL DEL CLIENTE (micuenta.html) — lado administrativo
//   1) Generar / revocar el acceso de un cliente al portal
//   2) Bandeja de comprobantes que suben los clientes (cola de revision)
// Los comprobantes NO son pagos: se aprueban abriendo el MISMO modal de
// "Registrar Pago" que usa el equipo, para no duplicar la contabilidad.
// ══════════════════════════════════════════════════════════════════════════

var _PORTAL_COMPS = [];          // comprobantes cargados (todos los estados)
var _PORTAL_COMPS_CARGADO = false;

function _pRandomToken(n){
  var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  var s = '';
  for(var i=0;i<(n||20);i++) s += abc.charAt(Math.floor(Math.random()*abc.length));
  return s;
}
function _pDigitos(s){ return String(s==null?'':s).replace(/\D/g,''); }
function _pBaseUrl(){
  try{
    var u = location.origin + location.pathname.replace(/[^\/]*$/,'');
    return u + 'micuenta.html';
  }catch(e){ return 'https://pagasi.io/micuenta.html'; }
}

// ── 1. Acceso del cliente al portal ─────────────────────────────────────
function portalAcceso(clienteId){
  var cli = (S.clientes||[]).find(function(x){ return String(x.id)===String(clienteId); });
  if(!cli){ toast('Cliente no encontrado','error'); return; }
  var ced = _pDigitos(cli.cedula);
  if(ced.length < 5){
    toast('Este cliente no tiene cédula registrada. Agrégala primero para poder darle acceso.','error');
    return;
  }
  if(typeof db==='undefined' || !db){ toast('Sin conexión a Firebase','error'); return; }

  setMicon && setMicon('cliente');
  $('mtt').textContent = 'Acceso al portal';
  $('msb').textContent = cli.nombre || '';
  $('modal-box').className = 'modal';
  $('mbd').innerHTML = '<div style="padding:22px 0;text-align:center;color:var(--ink3);font-size:12.5px">Buscando acceso...</div>';
  $('mft').innerHTML = '<button class="btn btn-g" onclick="closeM()">Cerrar</button>';
  $('ov').style.display = 'flex';

  // ¿Ya tiene un acceso activo? Reutilizarlo (no invalidar el link que ya envio).
  db.collection('accesos_cliente').where('clienteId','==',String(clienteId)).where('activo','==',true).limit(1).get()
    .then(function(snap){
      if(!snap.empty){
        var d = snap.docs[0];
        return {token:d.id, data:d.data(), nuevo:false};
      }
      var token = 'CLI-' + Date.now() + '-' + _pRandomToken(18);
      var payload = {
        clienteId: String(clienteId),
        cedulaNorm: ced,
        nombre: cli.nombre || '',
        activo: true,
        creadoPor: (S.currentUser && S.currentUser.nombre) || 'Admin',
        creadoEn: new Date().toISOString()
      };
      return db.collection('accesos_cliente').doc(token).set(payload).then(function(){
        return {token:token, data:payload, nuevo:true};
      });
    })
    .then(function(res){
      var link = _pBaseUrl() + '?t=' + encodeURIComponent(res.token) + '&c=' + encodeURIComponent(clienteId);
      var tel = _pDigitos(cli.tel);
      var wa = tel ? ('https://wa.me/58' + tel.replace(/^0/,'') + '?text=' + encodeURIComponent(
        'Hola ' + (String(cli.nombre||'').split(' ')[0]) + ', desde Pagasi te compartimos tu acceso a Mi Cuenta. '
        + 'Ahi puedes ver tu saldo, tus cuotas y enviar tus comprobantes de pago:\n\n' + link
        + '\n\nPara entrar solo necesitas tu numero de cedula.')) : '';

      $('mbd').innerHTML =
        '<div style="background:var(--surf2);border:1px solid var(--rim);border-radius:12px;padding:13px 15px;margin-bottom:13px">'
        + '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--ink3);margin-bottom:7px">Enlace personal de ' + _pEsc(cli.nombre) + '</div>'
        + '<div style="font-family:var(--fd);font-size:11px;color:var(--p1);word-break:break-all;line-height:1.5">' + _pEsc(link) + '</div>'
        + '</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">'
        + '<button class="btn btn-p btn-sm" onclick="portalCopiar(\'' + _pEsc(link) + '\')">Copiar enlace</button>'
        + (wa ? '<a class="btn btn-s btn-sm" href="' + wa + '" target="_blank" rel="noopener">Enviar por WhatsApp</a>' : '')
        + '<button class="btn btn-d btn-sm" onclick="portalRevocar(\'' + res.token + '\',\'' + String(clienteId) + '\')">Revocar acceso</button>'
        + '</div>'
        + '<div style="font-size:11.5px;color:var(--ink3);line-height:1.6">'
        + '<b>Cómo funciona:</b> el cliente abre el enlace y escribe su cédula (<b>' + ced + '</b>) para entrar. '
        + 'El enlace solo sirve con esa cédula, así que si se filtra no expone su información. '
        + 'La sesión le queda guardada en el teléfono, no tiene que volver a entrar cada vez.'
        + (res.nuevo ? '' : '<br><br>Este cliente <b>ya tenía</b> un acceso activo: es el mismo enlace que se le envió antes.')
        + '</div>';
    })
    .catch(function(e){
      console.error('portalAcceso:', e);
      $('mbd').innerHTML = '<div style="padding:16px;color:var(--red);font-size:12.5px">No se pudo generar el acceso: ' + _pEsc(e.message||e) + '</div>';
    });
}

function _pEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function portalCopiar(link){
  try{
    navigator.clipboard.writeText(link).then(function(){ toast('Enlace copiado','success'); },
      function(){ toast('Copia el enlace manualmente','info'); });
  }catch(e){ toast('Copia el enlace manualmente','info'); }
}

function portalRevocar(token, clienteId){
  if(!confirm('¿Revocar el acceso al portal? El cliente ya no podrá entrar con ese enlace.')) return;
  db.collection('accesos_cliente').doc(token).update({activo:false, revocadoEn:new Date().toISOString()})
    .then(function(){
      toast('Acceso revocado','success');
      if(typeof logActividad==='function') logActividad('portal_acceso_revocado','clientes',clienteId,{token:token});
      closeM();
    })
    .catch(function(e){ toast('No se pudo revocar: '+(e.message||e),'error'); });
}

// ── 2. Bandeja de comprobantes ──────────────────────────────────────────
function portalCargarComprobantes(cb){
  if(typeof db==='undefined' || !db){ if(cb) cb(); return; }
  db.collection('comprobantes').get().then(function(s){
    _PORTAL_COMPS = s.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
    _PORTAL_COMPS_CARGADO = true;
    if(cb) cb();
  }).catch(function(e){
    console.warn('comprobantes:', e && e.message);
    _PORTAL_COMPS = []; _PORTAL_COMPS_CARGADO = true;
    if(cb) cb();
  });
}

function portalPendientes(){
  return _PORTAL_COMPS.filter(function(c){ return (c.estado||'pendiente')==='pendiente'; });
}

// Card para insertar en el modulo Cobranza. Solo aparece si hay pendientes.
function portalComprobantesCard(){
  if(!_PORTAL_COMPS_CARGADO){
    // Cargar en segundo plano y redibujar Cobranza cuando llegue
    portalCargarComprobantes(function(){
      if(S.page==='pagos' && portalPendientes().length && typeof nav==='function') nav('pagos');
    });
    return '';
  }
  var pend = portalPendientes();
  if(!pend.length) return '';
  pend.sort(function(a,b){ return String(a.creadoEn||'').localeCompare(String(b.creadoEn||'')); });

  var rows = pend.map(function(c){
    var cred = (S.creds||[]).find(function(x){ return String(x.id)===String(c.credId); });
    var quien = c.clienteNombre || (cred && cred.cli) || '—';
    return '<tr>'
      + '<td class="tdm">' + _pEsc(quien) + '</td>'
      + '<td class="tds" style="font-family:var(--fd)">' + _pEsc(c.credId||'—') + '</td>'
      + '<td class="tds">' + _pEsc(c.fecha||'') + '</td>'
      + '<td style="font-weight:800;font-family:var(--fd)">' + fmt(c.monto||0) + '</td>'
      + '<td class="tds">' + _pEsc(c.metodo||'') + (c.referencia?'<div style="font-size:10px;color:var(--ink3)">Ref ' + _pEsc(c.referencia) + '</div>':'') + '</td>'
      + '<td><div style="display:flex;gap:4px;flex-wrap:wrap">'
      + (c.fotoUrl ? '<a class="btn btn-g btn-xs" href="' + _pEsc(c.fotoUrl) + '" target="_blank" rel="noopener">Ver foto</a>' : '')
      + '<button class="btn btn-p btn-xs" onclick="portalCompRegistrar(\'' + c.id + '\')">Registrar pago</button>'
      + '<button class="btn btn-d btn-xs" onclick="portalCompRechazar(\'' + c.id + '\')">Rechazar</button>'
      + '</div></td></tr>';
  }).join('');

  return '<div class="card" style="margin-bottom:12px;border-left:3px solid var(--amber)">'
    + '<div class="ch" style="margin-bottom:10px"><div>'
    + '<div class="ct">Comprobantes enviados por clientes</div>'
    + '<div class="cs">Los subieron desde Mi Cuenta · revisa la foto y registra el pago</div>'
    + '</div><span class="bdg b-a">' + pend.length + '</span></div>'
    + '<div class="tw"><table><thead><tr><th>Cliente</th><th>Crédito</th><th>Fecha</th><th>Monto</th><th>Método</th><th></th></tr></thead>'
    + '<tbody>' + rows + '</tbody></table></div></div>';
}

// Aprobar = abrir el modal normal de Registrar Pago, prellenado, y marcar el
// comprobante solo si el pago se guardo de verdad.
function portalCompRegistrar(compId){
  var c = _PORTAL_COMPS.find(function(x){ return x.id===compId; });
  if(!c){ toast('Comprobante no encontrado','error'); return; }
  var cred = (S.creds||[]).find(function(x){ return String(x.id)===String(c.credId); });
  if(!cred){ toast('El crédito '+(c.credId||'')+' no está activo. Revísalo a mano.','error'); return; }

  openAddPago(c.credId);
  setTimeout(function(){
    if($('p_monto')) $('p_monto').value = c.monto || '';
    if($('p_fecha') && c.fecha) $('p_fecha').value = String(c.fecha).slice(0,10);
    if($('p_ref')) $('p_ref').value = c.referencia || ('Portal ' + String(compId).slice(0,6));
    // Envolver el guardado original: si el pago se registra, marcar aprobado.
    var orig = S.saveFn;
    S.saveFn = function(){
      var r = orig();
      if(r !== false) portalCompMarcar(compId, 'aprobado', '');
      return r;
    };
  }, 130);
}

function portalCompRechazar(compId){
  var nota = prompt('¿Por qué se rechaza? (el cliente lo verá en su portal)', 'No se pudo verificar el pago');
  if(nota===null) return;
  portalCompMarcar(compId, 'rechazado', nota || '');
}

function portalCompMarcar(compId, estado, nota){
  var upd = {
    estado: estado,
    notaStaff: nota || '',
    revisadoPor: (S.currentUser && S.currentUser.nombre) || 'Admin',
    revisadoEn: new Date().toISOString()
  };
  db.collection('comprobantes').doc(compId).update(upd)
    .then(function(){
      var i = _PORTAL_COMPS.findIndex(function(x){ return x.id===compId; });
      if(i>=0) _PORTAL_COMPS[i] = Object.assign(_PORTAL_COMPS[i], upd);
      if(typeof logActividad==='function') logActividad('comprobante_'+estado,'pagos',compId,upd);
      toast(estado==='aprobado' ? 'Comprobante aprobado' : 'Comprobante rechazado', estado==='aprobado'?'success':'info');
      if(S.page==='pagos' && typeof nav==='function') nav('pagos');
    })
    .catch(function(e){ toast('No se pudo actualizar: '+(e.message||e),'error'); });
}
