// ══════════════════════════════════════════════════════════════
// BCV AUTO — Actualización automática diaria de la tasa BCV
// Fuente: ve.dolarapi.com (gratuita, sin API key, oficial BCV)
// Flujo: al cargar la app → verifica si la tasa del día ya existe
//        en Firestore → si no, la descarga y la guarda automáticamente
// ══════════════════════════════════════════════════════════════

var _bcvAutoEstado = 'inactivo'; // 'inactivo' | 'cargando' | 'ok' | 'error'
var _bcvAutoFecha  = '';
var _bcvAutoTasa   = 0;
// Tasa Binance (mercado paralelo / P2P)
var _binanceTasa = 0;
var _binanceEstado = 'inactivo';
// Tasa Euro (calculada como EUR/USD × BCV)
var _eurTasa = 0;
var _eurEstado = 'inactivo';
var _eurUsdRatio = 0; // EUR/USD para mostrar como dato

// Endpoints en orden de preferencia (fallback si uno falla)
var _BCV_ENDPOINTS = [
  'https://ve.dolarapi.com/v1/dolares/oficial',
  'https://bcv-api.rafnixg.dev/rates/'
];

// Endpoints para tasa Binance / Paralelo
var _BINANCE_ENDPOINTS = [
  'https://ve.dolarapi.com/v1/dolares/paralelo',
  'https://pydolarvenezuela-api.vercel.app/api/v1/dollar?monitor=binance'
];

// Endpoint para EUR/USD (ECB official via Frankfurter)
var _EUR_ENDPOINTS = [
  'https://api.frankfurter.app/latest?from=EUR&to=USD',
  'https://open.er-api.com/v6/latest/EUR'
];

// ── Función principal — llamar al inicio de la app ──
function bcvAutoInit(){
  if(!db){
    console.log('[BCV-Auto] Sin Firebase — actualización automática desactivada');
    // Descargar Binance igual aunque no haya Firebase (no requiere persistencia)
    _binanceFetchTasa(0);
    return;
  }
  var hoy = hoyLocalISO();

  // Verificar si ya tenemos la tasa de hoy en Firestore
  db.collection('config').doc('tasa').get().then(function(doc){
    if(doc.exists){
      var d = doc.data();
      var fechaGuardada = (d.fechaActualizacion||d.fecha||'').slice(0,10);
      var tasaGuardada  = parseFloat(d.tasaBs||0);
      var binanceGuardada = parseFloat(d.tasaBinance||0);
      var euroGuardada = parseFloat(d.tasaEuro||0);
      var eurUsdGuardado = parseFloat(d.eurUsd||0);

      if(fechaGuardada === hoy && tasaGuardada > 1){
        // Ya tenemos la tasa BCV de hoy — usar directamente
        window._tasaBsGlobal = tasaGuardada;
        _bcvAutoEstado = 'ok';
        _bcvAutoFecha  = fechaGuardada;
        _bcvAutoTasa   = tasaGuardada;
        if(binanceGuardada > 1){
          window._tasaBinance = binanceGuardada;
          _binanceTasa = binanceGuardada;
          _binanceEstado = 'ok';
        }
        if(euroGuardada > 1){
          window._tasaEuro = euroGuardada;
          _eurTasa = euroGuardada;
          _eurEstado = 'ok';
          if(eurUsdGuardado > 0) _eurUsdRatio = eurUsdGuardado;
        }
        _bcvActualizarUI();
        console.log('[BCV-Auto] Tasas de hoy ya en Firestore: BCV '+tasaGuardada+' · Binance '+binanceGuardada+' · EUR '+euroGuardada);
        // Si falta alguna, descargarla
        if(!binanceGuardada || binanceGuardada <= 1) _binanceFetchTasa(0);
        if(!euroGuardada || euroGuardada <= 1) _eurFetchTasa(0);
        return;
      }
    }
    // No hay tasa de hoy → descargar del API
    console.log('[BCV-Auto] Descargando tasas BCV, Binance y EUR de hoy...');
    _bcvAutoEstado = 'cargando';
    _binanceEstado = 'cargando';
    _eurEstado = 'cargando';
    _bcvActualizarUI();
    _bcvFetchTasa(0);
    _binanceFetchTasa(0);
    // EUR se calcula después de que BCV esté disponible (necesita la base USD/VES)
    setTimeout(function(){ _eurFetchTasa(0); }, 1500);
  }).catch(function(err){
    console.warn('[BCV-Auto] Error leyendo Firestore:', err.message);
    _bcvFetchTasa(0);
    _binanceFetchTasa(0);
    setTimeout(function(){ _eurFetchTasa(0); }, 1500);
  });
}
window.bcvAutoInit = bcvAutoInit;

// ─── EUR fetcher (calcula EUR/VES = EUR/USD × BCV) ──
function _eurFetchTasa(endpointIdx){
  if(endpointIdx >= _EUR_ENDPOINTS.length){
    _eurEstado = 'error';
    _bcvActualizarUI();
    return;
  }
  // Necesitamos la tasa BCV (USD/VES) para calcular EUR/VES
  var bcvBase = _bcvAutoTasa || window._tasaBsGlobal || 0;
  if(bcvBase < 1){
    // BCV aún no disponible, reintentar en 2s (max 5 reintentos)
    if(!window._eurRetries) window._eurRetries = 0;
    if(window._eurRetries++ > 5){ _eurEstado = 'error'; _bcvActualizarUI(); return; }
    setTimeout(function(){ _eurFetchTasa(endpointIdx); }, 2000);
    return;
  }
  var url = _EUR_ENDPOINTS[endpointIdx];
  var ctrl = (typeof AbortController!=='undefined') ? new AbortController() : null;
  var to = setTimeout(function(){ if(ctrl) ctrl.abort(); }, 5000);
  fetch(url, ctrl ? {signal: ctrl.signal} : {})
    .then(function(res){ clearTimeout(to); if(!res.ok) throw new Error('HTTP '+res.status); return res.json(); })
    .then(function(data){
      // frankfurter: { rates: { USD: 1.0876 } }
      // er-api: { rates: { USD: 1.0876, ... } }
      var eurUsd = 0;
      if(data.rates && data.rates.USD) eurUsd = parseFloat(data.rates.USD);
      if(!eurUsd || eurUsd <= 0) throw new Error('EUR/USD inválido');
      _eurUsdRatio = Math.round(eurUsd * 10000) / 10000;
      var eurVes = eurUsd * bcvBase;
      eurVes = Math.round(eurVes * 100) / 100;
      window._tasaEuro = eurVes;
      _eurTasa = eurVes;
      _eurEstado = 'ok';
      if(db){
        db.collection('config').doc('tasa').set({
          tasaEuro: eurVes,
          eurUsd: _eurUsdRatio,
          fechaEuro: hoyLocalISO()
        }, {merge:true}).catch(function(){});
      }
      _bcvActualizarUI();
    })
    .catch(function(){
      clearTimeout(to);
      _eurFetchTasa(endpointIdx + 1);
    });
}

// ─── Binance fetcher ──
function _binanceFetchTasa(endpointIdx){
  if(endpointIdx >= _BINANCE_ENDPOINTS.length){
    _binanceEstado = 'error';
    _bcvActualizarUI();
    return;
  }
  var url = _BINANCE_ENDPOINTS[endpointIdx];
  var ctrl = (typeof AbortController!=='undefined') ? new AbortController() : null;
  var to = setTimeout(function(){ if(ctrl) ctrl.abort(); }, 5000);
  fetch(url, ctrl ? {signal: ctrl.signal} : {})
    .then(function(res){ clearTimeout(to); if(!res.ok) throw new Error('HTTP '+res.status); return res.json(); })
    .then(function(data){
      // ve.dolarapi.com /paralelo: { promedio, venta, compra }
      // pydolarvenezuela /binance: { monitors: { binance: { price: X } } }
      var tasa = 0;
      if(data.promedio && parseFloat(data.promedio) > 1) tasa = parseFloat(data.promedio);
      else if(data.venta && parseFloat(data.venta) > 1) tasa = parseFloat(data.venta);
      else if(data.price && parseFloat(data.price) > 1) tasa = parseFloat(data.price);
      else if(data.monitors && data.monitors.binance && data.monitors.binance.price) tasa = parseFloat(data.monitors.binance.price);
      if(!tasa || tasa < 1) throw new Error('Tasa Binance inválida');
      tasa = Math.round(tasa * 100) / 100;
      window._tasaBinance = tasa;
      _binanceTasa = tasa;
      _binanceEstado = 'ok';
      // Guardar en Firestore junto con la BCV
      if(db){
        db.collection('config').doc('tasa').set({tasaBinance: tasa, fechaBinance: hoyLocalISO()}, {merge:true}).catch(function(){});
      }
      _bcvActualizarUI();
    })
    .catch(function(){
      clearTimeout(to);
      _binanceFetchTasa(endpointIdx + 1);
    });
}

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
      // Ahora que BCV está disponible, gatillar EUR si no se cargó aún
      if(_eurEstado !== 'ok'){ setTimeout(function(){ _eurFetchTasa(0); }, 500); }
      toast('✓ Tasa BCV actualizada: '+tasaRedondeada+' Bs./$', 'success');
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

  // Card del Dashboard (Tasa del día)
  function _fmtTasa(v){ return v.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  var dashBCV = document.getElementById('dash-tasa-bcv');
  if(dashBCV){
    var bcv = _bcvAutoTasa || window._tasaBsGlobal || 0;
    dashBCV.textContent = bcv > 1 ? _fmtTasa(bcv) : '—';
  }
  var dashBinance = document.getElementById('dash-tasa-binance');
  if(dashBinance){
    var bin = _binanceTasa || window._tasaBinance || 0;
    dashBinance.textContent = bin > 1 ? _fmtTasa(bin) : '—';
  }
  var dashEur = document.getElementById('dash-tasa-eur');
  if(dashEur){
    var eur = _eurTasa || window._tasaEuro || 0;
    dashEur.textContent = eur > 1 ? _fmtTasa(eur) : '—';
  }
  var dashSpread = document.getElementById('dash-tasa-spread');
  if(dashSpread){
    var b1 = _bcvAutoTasa || window._tasaBsGlobal || 0;
    var b2 = _binanceTasa || window._tasaBinance || 0;
    if(b1 > 1 && b2 > 1){
      var pct = ((b2 - b1) / b1) * 100;
      dashSpread.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
      dashSpread.style.color = pct > 10 ? '#E8335A' : (pct > 5 ? '#BA7517' : '#8B5CF6');
    } else {
      dashSpread.textContent = '—';
    }
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
  _binanceEstado = 'cargando';
  _eurEstado = 'cargando';
  window._eurRetries = 0;
  _bcvActualizarUI();
  toast('Consultando tasas BCV, Binance y EUR...', 'info');
  _bcvFetchTasa(0);
  _binanceFetchTasa(0);
  setTimeout(function(){ _eurFetchTasa(0); }, 1500);
}
window.bcvForzarActualizacion = bcvForzarActualizacion;
