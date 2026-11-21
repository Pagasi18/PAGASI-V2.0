// Pagasi module: grupo — «PAGASI 18 + 26» (21-nov-2026).
// Adam: "un módulo nuevo que se llame PAGASI 18 + 26… un dashboard de qué tiene pagasi 18 y 26
// juntos… cada hora no: cuando alguien se meta en ese módulo… los créditos, dinero en la calle,
// cantidad de mora… solo las cosas básicas".
//
// Cada compañía tiene su propia base y aquí solo hay sesión en una. Por eso las cuentas las hace
// el servidor (functions/lib/grupo.js): al ENTRAR al módulo se le piden con la sesión del usuario,
// él lee las dos bases en ese momento y devuelve solo las sumas. No se guarda nada y no viaja
// ningún dato de clientes. Son las mismas cuentas del Dashboard de cada compañía.
var _grupo = { datos: null, error: '', pidiendo: false, promesa: null };
var GRUPO_COLOR = { '18': '#1D4ED8', '26': '#14B8A6' };   // cada compañía, su color (siempre con su nombre al lado)

function _grupoUrl(){
  return (typeof _waRoot !== 'undefined' && _waRoot && _waRoot._waCfg && _waRoot._waCfg.urlEquipo)
    || (typeof WA_URL_EQUIPO !== 'undefined' ? WA_URL_EQUIPO : 'https://pagasi-webhook-5ao0p23z.ue.gateway.dev/equipo');
}
// Pide los números al servidor. fresco = true (botón Actualizar) salta el minuto de memoria del servidor.
function grupoPedir(fresco){
  if(_grupo.pidiendo) return _grupo.promesa;
  var user = (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) || null;
  if(!user){ _grupo.error = 'Sin sesión: vuelve a entrar al sistema.'; _grupoPintar(); return Promise.resolve(); }
  _grupo.pidiendo = true; _grupo.error = '';
  _grupoPintar();
  _grupo.promesa = Promise.resolve().then(function(){ return user.getIdToken(); }).then(function(tok){
    return fetch(_grupoUrl(), { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify({ accion: 'resumenGrupo', fresco: !!fresco }) });
  }).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(j){
      if(!r.ok) throw new Error(j.codigo === 'permiso' ? 'No tienes acceso a este módulo.' : 'respuesta ' + r.status);
      if(!j || !j.empresas) throw new Error('sin números');
      return j;
    });
  }).then(function(j){ _grupo.datos = j; _grupo.error = ''; })
    .catch(function(e){
      var m = String(e && e.message || e);
      _grupo.error = /acceso|sesión/.test(m) ? m : 'No se pudieron calcular los números en este momento. Prueba otra vez en un minuto.';
      if(typeof console !== 'undefined' && console.warn) console.warn('PAGASI 18 + 26:', m);
    })
    .then(function(){ _grupo.pidiendo = false; _grupoPintar(); });
  return _grupo.promesa;
}
function grupoActualizar(){ return grupoPedir(true); }
// Redibuja solo el cuerpo del módulo, y solo si se sigue en él
function _grupoPintar(){
  if(typeof S === 'undefined' || !S || S.page !== 'grupo' || typeof document === 'undefined') return;
  var c = document.getElementById('g2-cuerpo'); if(c) c.innerHTML = _grupoHtml();
  var b = document.getElementById('g2-estado'); if(b) b.textContent = _grupoEstadoTxt();
}

function _g2Num(n){ return (Math.round(+n || 0)).toLocaleString('es-VE'); }
// El dinero, con los centavos chiquitos: así las dos compañías suman exacto el total
function _g2Dinero(v){
  var t = (Math.round((+v || 0) * 100) / 100).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), i = t.lastIndexOf(',');
  return '<span class="g2-mon">$</span>' + (i > -1 ? t.slice(0, i) + '<small>' + t.slice(i) + '</small>' : t);
}
function _g2Pct(n, t){ return t > 0 ? (Math.round(n * 1000 / t) / 10).toLocaleString('es-VE') + '%' : '0%'; }
function _g2Hora(iso){
  var d = new Date(iso); if(isNaN(d.getTime())) return '';
  // Siempre en hora de Venezuela, se abra donde se abra
  try { return d.toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Caracas' }); }
  catch(e){ return d.toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit' }); }
}
function _grupoEstadoTxt(){
  if(_grupo.pidiendo) return _grupo.datos ? 'Actualizando…' : 'Calculando…';
  if(_grupo.datos && _grupo.datos.calculado) return 'Calculado hoy a las ' + _g2Hora(_grupo.datos.calculado);
  return '';
}

// Una fila de cuatro cifras: créditos, dinero en la calle, en mora y vencido
function _g2Cifras(x, grande){
  var c = grande ? ' g2-grande' : '';
  return '<div class="g2-cifras' + c + '">'
    + '<div class="g2-cifra"><div class="g2-rot">Créditos activos</div><div class="g2-val" data-g2="creditos">' + _g2Num(x.creditos) + '</div><div class="g2-nota">' + _g2Num(x.alDia) + ' al día</div></div>'
    + '<div class="g2-cifra"><div class="g2-rot">Dinero en la calle</div><div class="g2-val" data-g2="cartera">' + _g2Dinero(x.cartera) + '</div><div class="g2-nota">lo que falta por cobrar</div></div>'
    + '<div class="g2-cifra"><div class="g2-rot">En mora</div><div class="g2-val' + (x.enMora > 0 ? ' g2-rojo' : '') + '" data-g2="mora">' + _g2Num(x.enMora) + '</div><div class="g2-nota">' + _g2Pct(x.enMora, x.creditos) + ' de los créditos</div></div>'
    + '<div class="g2-cifra"><div class="g2-rot">Monto vencido</div><div class="g2-val' + (x.vencido > 0 ? ' g2-rojo' : '') + '" data-g2="vencido">' + _g2Dinero(x.vencido) + '</div><div class="g2-nota">cuotas ya vencidas</div></div>'
    + '</div>';
}
// Cuánto pone cada compañía en un total: una barra de dos colores con el nombre y el número al lado
function _g2Reparto(titulo, a, b, dinero){
  var t = (+a || 0) + (+b || 0), pa = t > 0 ? Math.round(a * 1000 / t) / 10 : 0, pb = t > 0 ? Math.round((100 - pa) * 10) / 10 : 0;
  var val = function(v){ return dinero ? '$' + _g2Num(v) : _g2Num(v); };
  return '<div class="g2-rep"><div class="g2-rep-t">' + titulo + '</div>'
    + '<div class="g2-barra" role="img" aria-label="' + titulo + ': PAGASI 18 ' + pa.toLocaleString('es-VE') + '%, PAGASI 26 ' + pb.toLocaleString('es-VE') + '%">'
    + (t > 0 ? '<i style="width:' + pa + '%;background:' + GRUPO_COLOR['18'] + '"></i><i style="width:' + pb + '%;background:' + GRUPO_COLOR['26'] + '"></i>' : '') + '</div>'
    + '<div class="g2-rep-l"><span><b style="background:' + GRUPO_COLOR['18'] + '"></b>18 · ' + val(a) + ' · ' + pa.toLocaleString('es-VE') + '%</span>'
    + '<span><b style="background:' + GRUPO_COLOR['26'] + '"></b>26 · ' + val(b) + ' · ' + pb.toLocaleString('es-VE') + '%</span></div></div>';
}
function _g2Empresa(emp, x){
  var nombre = (x && x.nombre) || ('PAGASI ' + emp), sitio = emp === '18' ? '18.pagasi.io · solo cobra' : 'pagasi.io · vende y cobra';
  var cab = '<div class="g2-cab"><span class="g2-chapa" style="background:' + GRUPO_COLOR[emp] + '">' + emp + '</span><div><div class="g2-nom">' + nombre + '</div><div class="g2-sitio">' + sitio + '</div></div></div>';
  if(!x || x.error || typeof x.creditos !== 'number')
    return '<div class="g2-card" data-g2-emp="' + emp + '">' + cab + '<div class="g2-falla">No se pudo leer esta compañía en este momento. Toca «Actualizar» para intentar otra vez.</div></div>';
  return '<div class="g2-card" data-g2-emp="' + emp + '">' + cab + _g2Cifras(x, false) + _g2Historico(x) + '</div>';
}

// ══ Lo que se agregó el 21-nov (Adam: "dame más data… está muy vacío") ══
var G2_MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function _g2MesNom(mes){ return G2_MES[(+String(mes).slice(5, 7) || 1) - 1] || ''; }
function _g2MesCorto(mes){ var n = _g2MesNom(mes); return n === 'septiembre' ? 'sep' : n.slice(0, 3); }
function _g2Total(c){ return c ? (+c.cuotas || 0) + (+c.iniciales || 0) : 0; }
function _g2Plata0(v){ return '$' + _g2Num(v); }
// Para encima de las barras: corto y sin repetirse ("$1,2k", "$84k")
function _g2Corto(v){
  v = +v || 0;
  if(v < 1000) return '$' + Math.round(v);
  if(v < 10000) return '$' + (Math.round(v / 100) / 10).toLocaleString('es-VE') + 'k';
  return '$' + Math.round(v / 1000).toLocaleString('es-VE') + 'k';
}
// Cuánto pone cada compañía, en una línea chiquita con su color
function _g2Split(a, b, dinero){
  var v = function(x){ return dinero ? _g2Plata0(x) : _g2Num(x); };
  return '<span class="g2-split"><span><b style="background:' + GRUPO_COLOR['18'] + '"></b>18 · ' + v(a) + '</span><span><b style="background:' + GRUPO_COLOR['26'] + '"></b>26 · ' + v(b) + '</span></span>';
}
var _g2Ley = '<div class="g2-ley"><span><b style="background:' + GRUPO_COLOR['18'] + '"></b>PAGASI 18</span><span><b style="background:' + GRUPO_COLOR['26'] + '"></b>PAGASI 26</span></div>';
// Tiene los datos nuevos (un servidor de antes no los manda)
function _g2Completo(x){ return !!(x && x.cobro && Array.isArray(x.meses) && Array.isArray(x.tramos) && x.semana && x.historico); }

// Desde qué mes mostrar los gráficos: el primero con algo en alguna de las dos (no meses vacíos al principio)
function _g2Desde(a, b){
  for(var i = 0; i < a.meses.length; i++){
    var x = a.meses[i], y = b.meses[i] || {};
    if(_g2Total(x) || x.ventas || _g2Total(y) || y.ventas) return Math.min(i, Math.max(0, a.meses.length - 3));
  }
  return Math.max(0, a.meses.length - 3);
}
// Barras por mes, cada una con lo de las dos compañías una encima de la otra (18 abajo, 26 arriba)
function _g2Columnas(titulo, a, b, valor, dinero, desde){
  var meses = a.meses.slice(desde), otros = b.meses.slice(desde), ALTO = 132;
  var max = Math.max.apply(null, [1].concat(meses.map(function(x, i){ return valor(x) + valor(otros[i] || {}); })));
  var ult = meses.length - 1, f = function(v){ return dinero ? _g2Plata0(v) : _g2Num(v); };
  var cols = meses.map(function(x, i){
    var va = valor(x), vb = valor(otros[i] || {}), t = va + vb;
    var ha = va > 0 ? Math.max(3, Math.round(va / max * ALTO)) : 0, hb = vb > 0 ? Math.max(3, Math.round(vb / max * ALTO)) : 0;
    var tip = _g2MesNom(x.mes) + ' ' + x.mes.slice(0, 4) + (i === ult ? ' (hasta hoy)' : '') + ': PAGASI 18 ' + f(va) + ' · PAGASI 26 ' + f(vb) + ' · juntas ' + f(t);
    return '<div class="g2-col' + (i === ult ? ' g2-col-hoy' : '') + '" title="' + tip + '" data-g2-mes="' + x.mes + '">'
      + '<div class="g2-col-z"><div class="g2-col-v">' + (t > 0 ? (dinero ? _g2Corto(t) : _g2Num(t)) : '') + '</div>'
      + '<div class="g2-pila">' + (hb ? '<i style="height:' + hb + 'px;background:' + GRUPO_COLOR['26'] + '"></i>' : '') + (ha ? '<i style="height:' + ha + 'px;background:' + GRUPO_COLOR['18'] + '"></i>' : '') + '</div></div>'
      + '<div class="g2-col-m">' + _g2MesCorto(x.mes) + '</div></div>';
  }).join('');
  return '<div class="g2-graf" role="img" aria-label="' + titulo + ' por mes"><div class="g2-cols" style="--g2-n:' + meses.length + '">' + cols + '</div></div>';
}
function _g2CabSec(titulo, sub, derecha){
  return '<div class="g2-sec-cab"><div><div class="g2-sec-t">' + titulo + '</div>' + (sub ? '<div class="g2-sec-s">' + sub + '</div>' : '') + '</div>' + (derecha || '') + '</div>';
}

// ── Lo cobrado: hoy, 7 días, este mes (con el mes pasado a la misma fecha) y el mes pasado ──
function _g2Cobrado(a, b, j, hoy){
  var c = j.cobro, mes = String(hoy || '').slice(0, 7), mesAnt = (a.meses[a.meses.length - 2] || {}).mes || '';
  var dia = +String(hoy || '').slice(8, 10) || 0;
  var esteMes = _g2Total(c.mes), antes = _g2Total(c.mesPasadoAFecha);
  var cambio = antes > 0 ? Math.round((esteMes - antes) * 100 / antes) : null;
  var compara = cambio === null ? 'el mes pasado no hubo cobros a esta fecha'
    : '<span class="' + (cambio >= 0 ? 'g2-sube' : 'g2-baja') + '">' + (cambio >= 0 ? '▲ ' : '▼ ') + Math.abs(cambio).toLocaleString('es-VE') + '%</span> vs. ' + _g2Plata0(antes) + ' al ' + dia + ' de ' + _g2MesNom(mesAnt);
  var celda = function(rot, k, nota, dato){
    var x = c[k], t = _g2Total(x);
    return '<div class="g2-cifra"><div class="g2-rot">' + rot + '</div><div class="g2-val" data-g2="' + dato + '">' + _g2Dinero(t) + '</div>'
      + '<div class="g2-nota">' + nota + '</div>' + _g2Split(_g2Total(a.cobro[k]), _g2Total(b.cobro[k]), true) + '</div>';
  };
  var detalle = function(x){ return 'cuotas ' + _g2Plata0(x.cuotas) + ' · iniciales ' + _g2Plata0(x.iniciales); };
  return '<div class="g2-card g2-sec" data-g2-sec="cobrado">'
    + _g2CabSec('Lo que entró', 'Pagos confirmados de las dos compañías: cuotas e iniciales', _g2Ley)
    + '<div class="g2-cobro">'
    + '<div class="g2-cifras g2-cifras-c">'
    + celda('Hoy', 'hoy', detalle(c.hoy), 'cobro-hoy')
    + celda('Últimos 7 días', 'semana', detalle(c.semana), 'cobro-semana')
    + celda('En ' + _g2MesNom(mes), 'mes', compara, 'cobro-mes')
    + celda(_g2MesNom(mesAnt).replace(/^./, function(l){ return l.toUpperCase(); }) + ' completo', 'mesPasado', detalle(c.mesPasado), 'cobro-mes-pasado')
    + '</div>'
    + '<div class="g2-cobro-g"><div class="g2-rot">Cobrado por mes</div>' + _g2Columnas('Cobrado', a, b, _g2Total, true, _g2Desde(a, b)) + '</div>'
    + '</div></div>';
}
// ── Las motos vendidas por mes ──
function _g2Ventas(a, b, j, hoy){
  var desde = _g2Desde(a, b), n = j.meses.length, x = j.meses[n - 1] || {}, y = j.meses[n - 2] || {};
  return '<div class="g2-card g2-sec" data-g2-sec="ventas">'
    + _g2CabSec('Motos vendidas', 'Créditos otorgados cada mes', _g2Ley)
    + '<div class="g2-mini">'
    + '<div><div class="g2-rot">En ' + _g2MesNom(x.mes) + '</div><div class="g2-val" data-g2="ventas-mes">' + _g2Num(x.ventas) + '</div><div class="g2-nota">' + _g2Plata0(x.financiado) + ' financiado</div></div>'
    + '<div><div class="g2-rot">En ' + _g2MesNom(y.mes) + '</div><div class="g2-val g2-val-s" data-g2="ventas-mes-pasado">' + _g2Num(y.ventas) + '</div><div class="g2-nota">' + _g2Plata0(y.financiado) + ' financiado</div></div>'
    + '</div>'
    + _g2Columnas('Motos vendidas', a, b, function(m){ return +m.ventas || 0; }, false, desde)
    + '<div class="g2-nota g2-nota-f">Desde el principio, entre las dos: <b>' + _g2Num(j.historico.vendidos) + ' motos</b> · ' + _g2Plata0(j.historico.financiado) + ' financiado.</div>'
    + '</div>';
}
// ── La mora por días de atraso ──
var G2_TRAMO = { '1-15': 'De 1 a 15 días', '16-30': 'De 16 a 30 días', '31-60': 'De 31 a 60 días', '+60': 'Más de 60 días' };
function _g2Mora(a, b, j){
  var max = Math.max.apply(null, [1].concat(j.tramos.map(function(t){ return t.creditos; })));
  var filas = j.tramos.map(function(t, i){
    var ta = a.tramos[i] || {}, tb = b.tramos[i] || {};
    var wa = (ta.creditos || 0) * 100 / max, wb = (tb.creditos || 0) * 100 / max;
    return '<div class="g2-tramo" data-g2-tramo="' + t.tramo + '"><div class="g2-tramo-r"><span>' + (G2_TRAMO[t.tramo] || t.tramo) + '</span>'
      + '<b>' + _g2Num(t.creditos) + ' crédito' + (t.creditos === 1 ? '' : 's') + ' · <span class="' + (t.vencido > 0 ? 'g2-rojo-t' : '') + '">' + _g2Plata0(t.vencido) + '</span></b></div>'
      + '<div class="g2-tramo-b" title="PAGASI 18: ' + _g2Num(ta.creditos) + ' (' + _g2Plata0(ta.vencido) + ') · PAGASI 26: ' + _g2Num(tb.creditos) + ' (' + _g2Plata0(tb.vencido) + ')">'
      + (wa > 0 ? '<i style="width:' + wa.toFixed(2) + '%;background:' + GRUPO_COLOR['18'] + '"></i>' : '') + (wb > 0 ? '<i style="width:' + wb.toFixed(2) + '%;background:' + GRUPO_COLOR['26'] + '"></i>' : '') + '</div>'
      + '<div class="g2-tramo-n">' + _g2Split(ta.creditos || 0, tb.creditos || 0, false) + '</div></div>';
  }).join('');
  var viejo = j.tramos[j.tramos.length - 1] || { vencido: 0 };
  var pct = j.vencido > 0 ? Math.round(viejo.vencido * 100 / j.vencido) : 0;
  return '<div class="g2-card g2-sec" data-g2-sec="mora">'
    + _g2CabSec('La mora por días de atraso', _g2Num(j.enMora) + ' créditos en mora · ' + _g2Plata0(j.vencido) + ' vencido', '')
    + '<div class="g2-tramos">' + filas + '</div>'
    + (viejo.vencido > 0 ? '<div class="g2-nota g2-nota-f">Los de más de 60 días son el ' + pct + '% del monto vencido: son los más difíciles de cobrar.</div>' : '')
    + '</div>';
}
// ── Lo que vence esta semana ──
function _g2Semana(a, b, j, hoy){
  var hasta = '';
  try { var d = new Date(String(hoy) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 6); hasta = d.getUTCDate() + ' de ' + G2_MES[d.getUTCMonth()]; } catch(e){}
  var prom = j.semana.cuotas > 0 ? j.semana.monto / j.semana.cuotas : 0;
  return '<div class="g2-card g2-sec" data-g2-sec="semana">'
    + _g2CabSec('Lo que vence esta semana', 'Cuotas que vencen de hoy al ' + hasta, '')
    + '<div class="g2-val g2-val-g" data-g2="semana-monto">' + _g2Dinero(j.semana.monto) + '</div>'
    + '<div class="g2-nota">' + _g2Num(j.semana.cuotas) + ' cuotas por cobrar' + (prom ? ' · ' + _g2Plata0(prom) + ' en promedio' : '') + '</div>'
    + '<div class="g2-reps g2-reps-1">' + _g2Reparto('Monto por compañía', a.semana.monto, b.semana.monto, true) + _g2Reparto('Cuotas por compañía', a.semana.cuotas, b.semana.cuotas, false) + '</div>'
    + (j.vencido > 0 ? '<div class="g2-nota g2-nota-f" data-g2="semana-con-vencido">Y hay <b>' + _g2Plata0(j.vencido) + '</b> ya vencido sin pagar: si todos se pusieran al día, esta semana entrarían <b>' + _g2Plata0(j.semana.monto + j.vencido) + '</b>.</div>' : '')
    + '</div>';
}
// ── Desde el principio (en la tarjeta de cada compañía) ──
function _g2Historico(x){
  if(!_g2Completo(x)) return '';
  var h = x.historico, cobrado = _g2Total(x.cobro.total);
  var c = function(rot, v, nota, dato){ return '<div class="g2-cifra"><div class="g2-rot">' + rot + '</div><div class="g2-val g2-val-s" data-g2="' + dato + '">' + v + '</div><div class="g2-nota">' + nota + '</div></div>'; };
  return '<div class="g2-hist"><div class="g2-hist-t">Desde el principio</div><div class="g2-cifras g2-cifras-4">'
    + c('Motos vendidas', _g2Num(h.vendidos), _g2Plata0(h.financiado) + ' financiado', 'hist-vendidos')
    + c('Cobrado', _g2Dinero(cobrado), 'cuotas e iniciales', 'hist-cobrado')
    + c('Terminaron de pagar', _g2Num(h.terminados), 'créditos completos', 'hist-terminados')
    + c('Recuperadas', _g2Num(h.recuperados), 'motos devueltas', 'hist-recuperados')
    + '</div></div>';
}

function _grupoHtml(){
  var d = _grupo.datos;
  if(!d){
    if(_grupo.error) return '<div class="g2-card g2-aviso"><div class="g2-falla">' + _grupo.error + '</div><button type="button" class="btn btn-p btn-sm" onclick="grupoActualizar()">Intentar otra vez</button></div>';
    return '<div class="g2-card g2-aviso"><div class="g2-espera"><span class="g2-giro" aria-hidden="true"></span>Leyendo las dos compañías… tarda unos segundos.</div></div>';
  }
  var a = d.empresas['18'], b = d.empresas['26'], j = d.juntas, h = '';
  if(_grupo.error) h += '<div class="g2-card g2-aviso"><div class="g2-falla">' + _grupo.error + ' Abajo están los números de la última vez.</div></div>';
  if(j){
    h += '<div class="g2-card g2-hero" data-g2-emp="juntas"><div class="g2-cab"><span class="g2-chapa g2-chapa-j">18 + 26</span><div><div class="g2-nom">Las dos compañías juntas</div><div class="g2-sitio">la suma de PAGASI 18 y PAGASI 26</div></div></div>'
      + _g2Cifras(j, true)
      + '<div class="g2-reps">' + _g2Reparto('Créditos activos', a.creditos, b.creditos, false) + _g2Reparto('Dinero en la calle', a.cartera, b.cartera, true)
      + _g2Reparto('Créditos en mora', a.enMora, b.enMora, false) + _g2Reparto('Monto vencido', a.vencido, b.vencido, true) + '</div></div>';
    // Lo nuevo solo si las dos lo traen (un servidor de antes no lo manda)
    if(_g2Completo(a) && _g2Completo(b) && _g2Completo(j) && a.meses.length === b.meses.length && a.meses.length >= 2){
      h += _g2Cobrado(a, b, j, d.hoy);
      h += '<div class="g2-tres">' + _g2Ventas(a, b, j, d.hoy) + _g2Mora(a, b, j) + _g2Semana(a, b, j, d.hoy) + '</div>';
    }
  } else {
    h += '<div class="g2-card g2-aviso"><div class="g2-falla">Falta una de las dos compañías, así que no hay total. Toca «Actualizar» para intentar otra vez.</div></div>';
  }
  h += '<div class="g2-dos">' + _g2Empresa('18', a) + _g2Empresa('26', b) + '</div>';
  h += '<div class="g2-pie"><b>Créditos activos:</b> los que están en cartera (al día o en mora). <b>Dinero en la calle:</b> lo que falta por cobrar de esos créditos, capital e intereses. '
    + '<b>En mora:</b> los que tienen al menos un día de atraso; el monto vencido es el saldo de sus cuotas ya vencidas. '
    + '<b>Lo que entró:</b> los pagos confirmados, cuotas e iniciales, por la fecha del pago. <b>Motos vendidas:</b> los créditos otorgados, por su fecha (sin los anulados ni las solicitudes sin aprobar). '
    + 'Son las mismas cuentas del Dashboard de cada compañía.</div>';
  return '<div class="' + (_grupo.pidiendo ? 'g2-viejo' : '') + '">' + h + '</div>';
}

PG.grupo = function(){
  if(typeof hasModuleAccess === 'function' && !hasModuleAccess('grupo'))
    return '<div class="page"><div class="empty" style="padding:60px 20px;text-align:center">No tienes acceso a PAGASI 18 + 26.</div></div>';
  // Al ENTRAR al módulo se calcula. Un redibujo automático (cuando cambia algo en la base de esta
  // compañía) no vuelve a pedir nada: si no, dejar la pestaña abierta sería estar leyendo sin parar.
  if(!window._rtRenderizando) setTimeout(function(){ grupoPedir(false); }, 0);
  return '<div class="page g2">'
    + pageBanner('Las dos compañías', 'PAGASI 18 + 26', 'Créditos, dinero en la calle y mora · <span id="g2-estado">' + _grupoEstadoTxt() + '</span>',
        [{ label: 'Actualizar', onclick: 'grupoActualizar()', primary: true }])
    + '<div id="g2-cuerpo">' + _grupoHtml() + '</div></div>';
};
