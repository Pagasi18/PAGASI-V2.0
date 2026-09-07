// Documentos del contrato: lo que se sabe cuando el cliente esta sentado
// delante con la carpeta, no cuando se crea el credito. Factura del
// concesionario, certificado de origen, poliza, los recaudos del Anexo D y la
// declaracion PEP.
//
// Vive en la pantalla de Contratos, al lado del boton de imprimir. Se guarda
// en el credito bajo UNA sola clave, `docsContrato`, para no mezclarse con
// nada de lo que usan los pagos, la mora o los reportes. Ninguno de estos
// datos entra en ningun calculo: se guardan y se imprimen.
//
// Antes de esto, todo esto salia en gris para llenar a mano. Adam pidio el
// 6-sep-2026 que "manana solo la firma salga a mano".
//
// DOS COSAS QUE HAY QUE SABER DE ESTA PANTALLA
// 1. startRealtime() re-renderiza la pagina entera 350 ms despues de CUALQUIER
//    escritura a Firestore (incluida la nuestra). Eso reseteaba el selector
//    al primer credito y borraba lo que se estaba escribiendo. Por eso el
//    cuadro recuerda el credito elegido (_docsSel) y guarda un borrador en
//    memoria por credito (_docsBorrador) que sobrevive al re-render.
// 2. El boton "Ver" de la lista cambia el selector sin pasar por
//    onCredContratoChange. Por eso Guardar NO lee el selector: lee el credito
//    al que pertenece el cuadro (data-cred). Asi nunca se guarda lo de un
//    credito encima de otro.

var _docsSel = null;          // ultimo credito para el que se pinto el cuadro
var _docsBorrador = {};       // credId -> lo que el empleado tiene escrito sin guardar

// El credito y su cliente, o null. Mismo criterio de busqueda que el contrato.
function _docsCredito(credId){
  var id = credId || ($('sel-cred') && $('sel-cred').value);
  var c = (S.creds||[]).find(function(x){ return String(x.id)===String(id); });
  if(!c) return null;
  var cli = (S.clientes||[]).find(function(x){ return String(x.id)===String(c.clienteId); })
         || (S.clientes||[]).find(function(x){ return x.nombre===c.cli; }) || {};
  return { c:c, cli:cli, hayFiador: !!String(cli.fiador_nom||'').trim() };
}

// Valores que se muestran, en este orden: el borrador sin guardar, lo
// guardado en el credito, y si no hay nada, lo que el sistema ya sabe.
// "Aprobado por" NO se rellena solo: es una atestacion y la escribe alguien.
function _docsValores(c, cli, borrador){
  var d = borrador || c.docsContrato || {};
  return {
    facturaNum:    d.facturaNum || '',
    facturaFecha:  d.facturaFecha || c.fecha || '',
    certOrigenNum: d.certOrigenNum || '',
    polizaCia:     d.polizaCia || '',
    polizaNum:     d.polizaNum || '',
    fiadorProfesion: d.fiadorProfesion || '',
    recaudos:      d.recaudos || {},
    otrosTexto:    d.otrosTexto || '',
    pep:           d.pep || 'no',
    pepDetalle:    d.pepDetalle || '',
    actividad:     d.actividad || cli.profesion || cli.ocupacion || '',
    ingresoMensual:d.ingresoMensual || '',
    verificado:    d.verificado === true,
    verificadoFecha: d.verificadoFecha || c.fecha || '',
    analista:      d.analista || c.creadoPor || '',
    aprobadoPor:   d.aprobadoPor || ''
  };
}

function _docsEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// El formulario. Se pinta dentro de #docs-contrato.
function _docsContratoHtml(credId){
  var X = _docsCredito(credId); if(!X) return '';
  var c = X.c, v = _docsValores(c, X.cli, _docsBorrador[c.id]);
  var guardado = c.docsContrato && c.docsContrato.actualizadoEn
    ? 'Guardado el '+new Date(c.docsContrato.actualizadoEn).toLocaleString('es-VE',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
      +(c.docsContrato.actualizadoPor?' por '+_docsEsc(c.docsContrato.actualizadoPor):'')
    : 'Todavía no se ha guardado nada para este crédito';
  if(_docsBorrador[c.id]) guardado += ' · <span style="color:var(--amber,#b45309);font-weight:700">tienes cambios sin guardar</span>';
  var inp = function(id, val, ph, tipo){
    return '<input class="fi" id="'+id+'" type="'+(tipo||'text')+'" value="'+_docsEsc(val)+'" placeholder="'+_docsEsc(ph||'')+'" style="width:100%">';
  };
  var campo = function(titulo, html){ return '<div><div style="font-size:10.5px;color:var(--ink2);margin-bottom:2px">'+titulo+'</div>'+html+'</div>'; };
  var lbl = 'font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px';
  var chk = function(key, texto){
    return '<label style="display:flex;align-items:flex-start;gap:7px;padding:5px 7px;background:var(--surf2);border-radius:6px;font-size:11px;line-height:1.35;cursor:pointer">'
      + '<input type="checkbox" id="dc_r_'+key+'" '+(v.recaudos[key]?'checked':'')+' style="margin-top:1px;accent-color:var(--p1)">'
      + '<span>'+texto+'</span></label>';
  };
  var recaudos = _docsRecaudosLista(X.hayFiador).map(function(r){ return chk(r[0], r[1]); }).join('');

  // data-cred: el credito al que pertenece este cuadro. Guardar lee ESTO.
  return '<div class="card" style="margin-top:12px" id="docs-contrato-box" data-cred="'+_docsEsc(c.id)+'" oninput="_docsAnotarBorrador()" onchange="_docsAnotarBorrador()">'
    + '<div class="ch"><div><div class="ct">Documentos del contrato · '+_docsEsc(c.id)+'</div>'
    + '<div class="cs">Lo que se llena con el cliente delante. <b>Hay que guardar</b> para que salga impreso — sin guardar, el contrato sale con la raya en gris.</div></div></div>'
    + '<div style="font-size:10.5px;color:var(--ink3);margin:6px 0 10px">'+guardado+'</div>'

    + '<div style="'+lbl+'">Papeles del vehículo</div>'
    + '<div style="display:grid;grid-template-columns:1.2fr 1fr 1.2fr;gap:7px;margin-bottom:9px">'
    +   campo('N° de factura del concesionario', inp('dc_facturaNum', v.facturaNum, 'Ej. 00012345'))
    +   campo('Fecha de la factura', inp('dc_facturaFecha', v.facturaFecha, '', 'date'))
    +   campo('N° de certificado de origen', inp('dc_certOrigenNum', v.certOrigenNum, 'Ej. BB-123456'))
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1.2fr 1fr'+(X.hayFiador?' 1.2fr':'')+';gap:7px;margin-bottom:12px">'
    +   campo('Póliza — aseguradora', inp('dc_polizaCia', v.polizaCia, 'Ej. Seguros Caracas'))
    +   campo('Póliza — N°', inp('dc_polizaNum', v.polizaNum, ''))
    +   (X.hayFiador ? campo('Profesión u oficio del fiador', inp('dc_fiadorProfesion', v.fiadorProfesion, 'Ej. Comerciante')) : '')
    + '</div>'

    + '<div style="'+lbl+'">Recaudos entregados (Anexo D)</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px">'+recaudos+'</div>'
    + '<div style="display:grid;grid-template-columns:auto 1fr;gap:7px;align-items:center;margin-bottom:12px">'
    +   chk('otros', 'Otros:')+inp('dc_otrosTexto', v.otrosTexto, '¿cuáles?')
    + '</div>'

    + '<div style="'+lbl+'">Origen de fondos y PEP</div>'
    + '<div style="display:grid;grid-template-columns:1.4fr 1fr;gap:7px;margin-bottom:7px">'
    +   campo('Actividad económica', inp('dc_actividad', v.actividad, 'Ej. Comerciante'))
    +   campo('Ingreso mensual aprox. (US$)', inp('dc_ingresoMensual', v.ingresoMensual, 'Ej. 450', 'number'))
    + '</div>'
    + '<div style="display:flex;gap:14px;align-items:center;margin-bottom:12px;font-size:11.5px">'
    +   '<span style="color:var(--ink2)">¿Persona Expuesta Políticamente?</span>'
    +   '<label style="display:flex;gap:5px;align-items:center;cursor:pointer"><input type="radio" name="dc_pep" value="no" '+(v.pep!=='si'?'checked':'')+' style="accent-color:var(--p1)"> No</label>'
    +   '<label style="display:flex;gap:5px;align-items:center;cursor:pointer"><input type="radio" name="dc_pep" value="si" '+(v.pep==='si'?'checked':'')+' style="accent-color:var(--p1)"> Sí</label>'
    +   '<input class="fi" id="dc_pepDetalle" value="'+_docsEsc(v.pepDetalle)+'" placeholder="si es PEP, indicar" style="flex:1">'
    + '</div>'

    + '<div style="'+lbl+'">Verificaciones de Pagasi (Anexo D.4)</div>'
    + '<label style="display:flex;gap:7px;align-items:center;font-size:11.5px;margin-bottom:7px;cursor:pointer">'
    +   '<input type="checkbox" id="dc_verificado" '+(v.verificado?'checked':'')+' style="accent-color:var(--p1)">'
    +   '<span>Se consultaron listas restrictivas, identidad, domicilio y el vehículo ante el INTT</span></label>'
    + '<div style="display:grid;grid-template-columns:1fr 1.2fr 1.2fr;gap:7px;margin-bottom:12px">'
    +   campo('Fecha', inp('dc_verificadoFecha', v.verificadoFecha, '', 'date'))
    +   campo('Analista', inp('dc_analista', v.analista, ''))
    +   campo('Aprobado por', inp('dc_aprobadoPor', v.aprobadoPor, 'quién aprobó el crédito'))
    + '</div>'

    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">'
    +   '<button class="btn btn-g btn-sm" onclick="guardarDocsContrato(false)">Guardar</button>'
    +   '<button class="btn btn-p btn-sm" onclick="guardarDocsContrato(true)">Guardar y ver contrato</button>'
    + '</div>'
    + '</div>';
}

// Cada tecla que escribe el empleado se anota en el borrador de ESE credito.
// Si la pagina se re-renderiza (tiempo real, Vista Previa), el cuadro vuelve
// con lo que estaba escribiendo.
function _docsAnotarBorrador(){
  var box = document.getElementById('docs-contrato-box'); if(!box) return;
  var id = box.getAttribute('data-cred'); if(!id) return;
  var X = _docsCredito(id); if(!X) return;
  _docsBorrador[id] = _docsContratoLeer(X.hayFiador);
}

// Pinta el cuadro para el credito del selector. Si ya esta pintado para ese
// mismo credito no lo toca (para no borrar lo que se esta escribiendo), salvo
// que se pida a la fuerza (despues de guardar).
function _docsContratoPintar(forzar){
  var box = document.getElementById('docs-contrato');
  if(!box) return;
  var sel = document.getElementById('sel-cred');
  var id = sel ? sel.value : null;
  if(!id){ box.innerHTML = ''; _docsSel = null; return; }
  var actual = box.querySelector('#docs-contrato-box');
  if(!forzar && actual && actual.getAttribute('data-cred')===String(id)) return;
  _docsSel = id;
  box.innerHTML = _docsContratoHtml(id);
}

// Despues de un re-render de la pagina (tiempo real), vuelve a dejar el
// selector en el credito que estaba y repinta cuadro y vista previa.
function _docsRestaurarSeleccion(){
  var sel = document.getElementById('sel-cred');
  if(sel && _docsSel){
    var hay = Array.prototype.some.call(sel.options||[], function(o){ return String(o.value)===String(_docsSel); });
    if(hay && sel.value!==_docsSel){
      sel.value = _docsSel;
      var td = document.getElementById('sel-tipo-doc');
      var c = (S.creds||[]).find(function(x){ return String(x.id)===String(_docsSel); });
      if(td && c && typeof _contratoVersionDe==='function') td.value = _contratoVersionDe(c);
      if(typeof renderContrato==='function') renderContrato();
    }
  }
  _docsContratoPintar();
}

// Lee el formulario. Devuelve el objeto que se guarda en el credito.
function _docsContratoLeer(hayFiador){
  var val = function(id){ var e = document.getElementById(id); return e ? String(e.value||'').trim() : ''; };
  var on  = function(id){ var e = document.getElementById(id); return !!(e && e.checked); };
  var rec = {};
  _docsRecaudosLista(hayFiador).forEach(function(r){ rec[r[0]] = on('dc_r_'+r[0]); });
  rec.otros = on('dc_r_otros');
  var pepSi = document.querySelector('input[name="dc_pep"][value="si"]');
  return {
    facturaNum:    val('dc_facturaNum'),
    facturaFecha:  val('dc_facturaFecha'),
    certOrigenNum: val('dc_certOrigenNum'),
    polizaCia:     val('dc_polizaCia'),
    polizaNum:     val('dc_polizaNum'),
    fiadorProfesion: val('dc_fiadorProfesion'),
    recaudos:      rec,
    otrosTexto:    val('dc_otrosTexto'),
    pep:           (pepSi && pepSi.checked) ? 'si' : 'no',
    pepDetalle:    val('dc_pepDetalle'),
    actividad:     val('dc_actividad'),
    ingresoMensual:val('dc_ingresoMensual'),
    verificado:    on('dc_verificado'),
    verificadoFecha: val('dc_verificadoFecha'),
    analista:      val('dc_analista'),
    aprobadoPor:   val('dc_aprobadoPor')
  };
}

function guardarDocsContrato(yVer){
  // El credito es el del cuadro, no el del selector: pueden no coincidir.
  var box = document.getElementById('docs-contrato-box');
  var id = box ? box.getAttribute('data-cred') : null;
  var X = _docsCredito(id); if(!X){ toast('Elige un crédito primero', 'error'); return; }
  var c = X.c;
  var d = _docsContratoLeer(X.hayFiador);
  d.actualizadoEn  = new Date().toISOString();
  d.actualizadoPor = (S.currentUser && S.currentUser.nombre) || '';
  // En memoria primero: asi el contrato se imprime con los datos nuevos aunque
  // Firestore tarde. La escritura va con merge sobre UNA sola clave del credito.
  c.docsContrato = d;
  delete _docsBorrador[c.id];
  var p = DB.updateCred(c.id, { docsContrato: d });
  var listo = function(ok){
    // _dbSilent ya avisa si fallo; aqui solo confirmamos cuando si se guardo
    if(ok!==false) toast('Documentos del contrato guardados', 'success');
    _docsContratoPintar(true);
    if(yVer && typeof renderContrato==='function') renderContrato();
  };
  if(p && p.then) p.then(listo); else listo(true);
  if(typeof logActividad==='function') logActividad('Documentos del contrato', 'contratos', c.id, {factura: d.facturaNum||'', pep: d.pep});
}
