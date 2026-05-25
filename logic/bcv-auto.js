// ══════════════════════════════════════════════════════════════
// BCV AUTO — Actualización automática diaria de la tasa BCV
// Fuente: ve.dolarapi.com (gratuita, sin API key, oficial BCV)
// Flujo: al cargar la app → verifica si la tasa del día ya existe
//        en Firestore → si no, la descarga y la guarda automáticamente
// ══════════════════════════════════════════════════════════════

var _bcvAutoEstado = 'inactivo'; // 'inactivo' | 'cargando' | 'ok' | 'error'
var _bcvAutoFecha  = '';
var _bcvAutoTasa   = 0;

// Endpoints en orden de preferencia (fallback si uno falla)
var _BCV_ENDPOINTS = [
  'https://ve.dolarapi.com/v1/dolares/oficial',
  'https://bcv-api.rafnixg.dev/rates/'
];

// ── Función principal — llamar al inicio de la app ──
function bcvAutoInit(){
  if(!db){
    console.log('[BCV-Auto] Sin Firebase — actualización automática desactivada');
    return;
  }
  var hoy = hoyLocalISO();

  // Verificar si ya tenemos la tasa de hoy en Firestore
  db.collection('config').doc('tasa').get().then(function(doc){
    if(doc.exists){
      var d = doc.data();
      var fechaGuardada = (d.fechaActualizacion||d.fecha||'').slice(0,10);
      var tasaGuardada  = parseFloat(d.tasaBs||0);

      if(fechaGuardada === hoy && tasaGuardada > 1){
        // Ya tenemos la tasa de hoy — usar directamente
        window._tasaBsGlobal = tasaGuardada;
        _bcvAutoEstado = 'ok';
        _bcvAutoFecha  = fechaGuardada;
        _bcvAutoTasa   = tasaGuardada;
        _bcvActualizarUI();
        console.log('[BCV-Auto] Tasa de hoy ya en Firestore: '+tasaGuardada+' Bs./$ ('+fechaGuardada+')');
        return;
      }
    }
    // No hay tasa de hoy → descargar del API
    console.log('[BCV-Auto] Descargando tasa BCV de hoy...');
    _bcvAutoEstado = 'cargando';
    _bcvActualizarUI();
    _bcvFetchTasa(0);
  }).catch(function(err){
    console.warn('[BCV-Auto] Error leyendo Firestore:', err.message);
    _bcvFetchTasa(0); // Intentar de todas formas
  });
}
window.bcvAutoInit = bcvAutoInit;

// ── Descarga la tasa con fallback entre endpoints ──
function _bcvFetchTasa(endpointIdx){
  if(endpointIdx >= _BCV_ENDPOINTS.length){
    _bcvAutoEstado = 'error';
    _bcvActualizarUI();
    console.warn('[BCV-Auto] Todos los endpoints fallaron. Mantener tasa anterior.');
    return;
  }

  var url = _BCV_ENDPOINTS[endpointIdx];
  fetch(url)
    .then(function(res){
      if(!res.ok) throw new Error('HTTP '+res.status);
      return res.json();
    })
    .then(function(data){
      var tasa = _bcvParseTasa(data, url);
      if(!tasa || tasa < 1){
        throw new Error('Tasa inválida: '+tasa);
      }
      _bcvGuardarTasa(tasa, data.fechaActualizacion || data.date || new Date().toISOString());
    })
    .catch(function(err){
      console.warn('[BCV-Auto] Endpoint '+url+' falló:', err.message);
      _bcvFetchTasa(endpointIdx + 1);
    });
}

// ── Parsea la tasa según el formato de cada API ──
function _bcvParseTasa(data, url){
  // ve.dolarapi.com formato: { promedio: 480.25, venta: ..., compra: ... }
  if(data.promedio && parseFloat(data.promedio) > 1) return parseFloat(data.promedio);
  if(data.venta    && parseFloat(data.venta)    > 1) return parseFloat(data.venta);
  // bcv-api.rafnixg.dev formato: { USD: { rate: 480.25 } }
  if(data.USD && data.USD.rate && parseFloat(data.USD.rate) > 1) return parseFloat(data.USD.rate);
  // Formato genérico: { tasa: ... } o { rate: ... } o { dolar: ... }
  if(data.tasa  && parseFloat(data.tasa)  > 1) return parseFloat(data.tasa);
  if(data.rate  && parseFloat(data.rate)  > 1) return parseFloat(data.rate);
  if(data.dolar && parseFloat(data.dolar) > 1) return parseFloat(data.dolar);
  return 0;
}

// ── Guarda la tasa en Firestore y actualiza la UI ──
function _bcvGuardarTasa(tasa, fechaISO){
  var hoy = hoyLocalISO();
  var tasaRedondeada = Math.round(tasa * 100) / 100;

  window._tasaBsGlobal  = tasaRedondeada;
  _bcvAutoEstado        = 'ok';
  _bcvAutoFecha         = hoy;
  _bcvAutoTasa          = tasaRedondeada;

  // Actualizar input de configuración si está visible
  if($('cfg_tasa_bs')) $('cfg_tasa_bs').value = tasaRedondeada;

  // Guardar en Firestore
  if(db){
    db.collection('config').doc('tasa').set({
      tasaBs:            tasaRedondeada,
      fechaActualizacion: hoy,
      fecha:             fechaISO || new Date().toISOString(),
      fuenteAuto:        true,
      api:               _BCV_ENDPOINTS[0]
    }).then(function(){
      console.log('[BCV-Auto] ✓ Tasa guardada en Firestore: '+tasaRedondeada+' Bs./$ ('+hoy+')');
      _bcvActualizarUI();
      toast('✓ Tasa BCV actualizada automáticamente: '+tasaRedondeada+' Bs./$', 'success');
    }).catch(function(err){
      console.warn('[BCV-Auto] Error guardando en Firestore:', err.message);
      _bcvActualizarUI();
    });
  } else {
    _bcvActualizarUI();
  }
}

// ── Actualiza cualquier elemento de UI que muestre la tasa ──
function _bcvActualizarUI(){
  // Badge en el módulo de configuración
  var badge = $('bcv-auto-badge');
  if(badge) badge.innerHTML = _bcvBadgeHTML();

  // KPI de tasa en la card de configuración
  var kpi = $('bcv-kpi-tasa');
  if(kpi){
    kpi.textContent = (_bcvAutoTasa || window._tasaBsGlobal || 1).toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' Bs';
  }

  // Input numérico
  if($('cfg_tasa_bs') && _bcvAutoTasa > 1){
    $('cfg_tasa_bs').value = _bcvAutoTasa;
  }
}
window._bcvActualizarUI = _bcvActualizarUI;

// ── HTML del badge de estado ──
function _bcvBadgeHTML(){
  var tasa = _bcvAutoTasa || window._tasaBsGlobal || 1;
  if(_bcvAutoEstado === 'cargando'){
    return '<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.2);border-radius:9px;font-size:12px;color:var(--p1)">'
      +'<div style="width:10px;height:10px;border-radius:50%;background:var(--p1);animation:pulse 1s infinite"></div>'
      +'<span><strong>Actualizando tasa BCV...</strong> Consultando ve.dolarapi.com</span>'
      +'</div>';
  }
  if(_bcvAutoEstado === 'ok'){
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;background:var(--greens);border:1px solid rgba(6,176,106,0.2);border-radius:9px">'
      +'<div style="display:flex;align-items:center;gap:8px">'
      +'<div style="width:10px;height:10px;border-radius:50%;background:var(--green)"></div>'
      +'<div>'
      +'<div style="font-size:12px;font-weight:700;color:var(--green)">✓ Tasa BCV actualizada automáticamente</div>'
      +'<div style="font-size:10.5px;color:var(--ink3)">Fuente: ve.dolarapi.com · Fecha: '+(_bcvAutoFecha||hoyLocalISO())+' · Actualiza cada día automáticamente</div>'
      +'</div>'
      +'</div>'
      +'<div style="font-family:var(--fd);font-size:22px;font-weight:900;color:var(--green);white-space:nowrap">'
      +tasa.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2})+' Bs./$'
      +'</div>'
      +'</div>';
  }
  if(_bcvAutoEstado === 'error'){
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;background:var(--reds);border:1px solid rgba(217,59,90,0.2);border-radius:9px">'
      +'<div style="display:flex;align-items:center;gap:8px">'
      +'<div style="width:10px;height:10px;border-radius:50%;background:var(--red)"></div>'
      +'<div>'
      +'<div style="font-size:12px;font-weight:700;color:var(--red)">⚠ No se pudo obtener la tasa automáticamente</div>'
      +'<div style="font-size:10.5px;color:var(--ink3)">Usando tasa guardada: '+tasa.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2})+' Bs./$ · Actualiza manualmente o reintenta</div>'
      +'</div>'
      +'</div>'
      +'<button class="btn btn-p btn-sm" onclick="bcvAutoInit()">↻ Reintentar</button>'
      +'</div>';
  }
  // Estado inicial
  return '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;background:var(--surf2);border:1px solid var(--rim2);border-radius:9px">'
    +'<div style="font-size:12px;color:var(--ink3)">Actualización automática BCV · iniciando...</div>'
    +'<button class="btn btn-g btn-sm" onclick="bcvAutoInit()">↻ Actualizar ahora</button>'
    +'</div>';
}
window._bcvBadgeHTML = _bcvBadgeHTML;

// ── Forzar actualización manual (botón en config) ──
function bcvForzarActualizacion(){
  _bcvAutoEstado = 'cargando';
  _bcvActualizarUI();
  toast('Consultando tasa BCV...', 'info');
  _bcvFetchTasa(0);
}
window.bcvForzarActualizacion = bcvForzarActualizacion;
