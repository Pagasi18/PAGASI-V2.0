/* PAGASI 18 + 26 (21-nov-2026). Adam: "un dashboard de qué tiene pagasi 18 y 26 juntos…
   quiero ver los créditos, dinero en la calle, cantidad de mora… solo las cosas básicas".

   Lo básico de la cartera de UNA compañía, con las MISMAS cuentas del Dashboard del panel
   (modules/dash.js) para que el número de aquí sea el que cada compañía ve en su pantalla:

     créditos  los que están en cartera: no borrados, en estado activo o mora
     cartera   lo que falta por cobrar de esos créditos: total − pagos confirmados que no son la inicial
     enMora    los que tienen al menos un día de atraso
     vencido   el saldo de sus cuotas ya vencidas (el mismo ledger del Dashboard)

   Y desde el 21-nov (Adam: "dame más data… está muy vacío"):

     cobro      lo cobrado hoy, en los últimos 7 días, este mes, el mes pasado hasta el mismo día
                y el mes pasado completo: pagos confirmados, cuotas e iniciales por separado
     meses      los últimos 12 meses: lo cobrado y las motos vendidas (créditos otorgados) cada mes
     tramos     los créditos en mora por días de atraso (1-15, 16-30, 31-60, +60) y su vencido
     semana     las cuotas que vencen de hoy a 6 días y lo que falta de ellas
     historico  desde el principio: motos vendidas, financiado, terminaron de pagar, recuperadas

   El panel recalcula los días de atraso cada vez que alguien lo abre (calcularMoraAuto, en
   logic/pagos.js) y los guarda en el crédito. Aquí se calculan otra vez con la fecha de hoy:
   si nadie abrió el panel de una compañía ese día, el dato guardado estaría viejo.

   Es una función pura: recibe los créditos y los pagos tal como están en la base. La usa el
   servidor (functions/lib/grupo.js; al desplegar se copia a functions/logic, ver firebase.json);
   el panel no la carga. tests/t_grupo_18_26.js la compara con el Dashboard. */
(function(root){
  'use strict';

  var DIA = 86400000;
  // Estados que calcularMoraAuto no toca: cerrados o fuera de la cartera
  var NO_RECALCULA = ['completado','cancelado','recuperado','recuperada','pendiente_revision','rechazado','rechazada'];

  function totalCuotas(c){ return parseInt((c && c.totalCuotas) || ((c && c.plazo) ? c.plazo * 2 : 20), 10) || 20; }   // getCreditoTotalCuotas
  function cuotaBase(c){ return parseFloat((c && (c.cuotaQ || c.cuota)) || 0) || 0; }                                // getCreditoCuotaBase

  // El día (en días desde 1970) de una fecha, en hora de Venezuela (UTC−4, sin cambio de hora):
  // 'AAAA-MM-DD' es ese día; una fecha con hora se pasa a la hora local, como hace el panel.
  function diaDe(v){
    if(v == null || v === '') return null;
    var s = String(v), m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if(m) return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DIA);
    var t = (v instanceof Date) ? v.getTime() : new Date(s).getTime();
    return isNaN(t) ? null : Math.floor((t - 4 * 3600000) / DIA);
  }

  // Cómo dejaría calcularMoraAuto este crédito hoy: su estado y sus días de atraso
  function estadoHoy(c, hoyN, gracia){
    if(!c.fecha) return { estado: c.estado, mora: c.mora };          // sin fecha no se recalcula
    if(NO_RECALCULA.indexOf(String(c.estado || '')) > -1) return { estado: c.estado, mora: 0 };
    var pagadas = parseInt(c.pagado || 0, 10) || 0, tc = totalCuotas(c);
    if(pagadas >= tc && tc > 0) return { estado: 'completado', mora: 0 };
    var inicio = diaDe(c.fecha);
    var atraso = (inicio == null || hoyN == null) ? NaN : hoyN - (inicio + (pagadas + 1) * 15);
    return { estado: atraso > gracia ? 'mora' : 'activo', mora: atraso > 0 ? atraso : 0 };
  }

  // Pagos confirmados que no son la inicial, por crédito (igual que _pagosIdxObtener del panel)
  function indicePagos(pagos){
    var map = new Map();   // Map compara como ===: un cred '12' no casa con un id 12, igual que en el panel
    (pagos || []).forEach(function(p){
      if(!(p && !p.eliminado && p.estado === 'confirmado' && !p.esInicial && p.tipoOperacion !== 'inicial_credito')) return;
      var e = map.get(p.cred);
      if(!e){ e = { sum: 0, n: 0 }; map.set(p.cred, e); }
      e.sum = e.sum + (parseFloat(p.monto) || 0);
      e.n++;
    });
    return map;
  }
  function pagosConfirmados(c, idx){                                  // getCreditoPagosConfirmados
    var e = idx.get(c.id);
    if(e && e.n) return e.sum;
    if(Array.isArray(c.pagosRegistrados) && c.pagosRegistrados.length)
      return c.pagosRegistrados.reduce(function(a, h){ return a + (parseFloat(h.montoPagado) || 0); }, 0);
    return (parseInt(c.pagado, 10) || 0) * cuotaBase(c);
  }
  function saldoPendiente(c, idx){ return Math.max(0, (parseFloat((c && c.total) || 0) || 0) - pagosConfirmados(c, idx)); }

  // El calendario de cuotas de un crédito con sus pagos ya aplicados (el ledger del panel), o
  // null si no se puede armar. porCred: los pagos agrupados por crédito (ver agruparPagos).
  function estadoLedger(c, porCred, ledger, hoy, gracia){
    try {
      if(!ledger || !ledger.generarEstadoCredito) return null;
      return ledger.generarEstadoCredito(c, porCred[String(c.id)] || [], { diasGracia: gracia, today: hoy });
    } catch(e){ return null; }
  }
  // Lo vencido de un crédito atrasado: el saldo de sus cuotas vencidas o, si no hay ninguna,
  // lo que falta de la próxima (el mismo cálculo del Dashboard)
  function vencidoDe(c, est, hoy){
    if(!est) return parseFloat(c.cuotaQ || c.cuota) || 0;
    var venc = 0, n = 0;
    (est.cuotas || []).forEach(function(q){ if(q && q.saldo > 0.001 && q.fechaVence && q.fechaVence < hoy){ venc += q.saldo; n++; } });
    if(n) return venc;
    var prox = (est.cuotas || [])[est.cuotasPagadas];
    return prox ? (prox.saldo || 0) : (parseFloat(c.cuotaQ || c.cuota) || 0);
  }
  // Los pagos de cada crédito, para no recorrer todos los pagos por cada crédito. El ledger los
  // filtra con String(p.cred) === String(c.id): agruparlos con la misma llave da lo mismo.
  function agruparPagos(pagos){
    var m = {};
    (pagos || []).forEach(function(p){ if(p && p.cred != null){ var k = String(p.cred); (m[k] = m[k] || []).push(p); } });
    return m;
  }

  var centavos = function(v){ return Math.round((v || 0) * 100) / 100; };
  var p2 = function(n){ return (n < 10 ? '0' : '') + n; };

  // 'AAAA-MM-DD' de una fecha guardada. Un texto que empieza con la fecha se toma tal cual (como
  // compara el Dashboard: p.fecha >= '2026-11-01'); una fecha con hora se pasa a hora de Venezuela.
  function fechaTxt(v){
    if(v == null || v === '') return '';
    if(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    var t = (typeof v.toDate === 'function') ? v.toDate().getTime() : (v instanceof Date) ? v.getTime() : new Date(String(v)).getTime();
    return isNaN(t) ? '' : new Date(t - 4 * 3600000).toISOString().slice(0, 10);
  }
  function sumarDias(iso, n){ var d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function mesMas(mes, n){ var y = +mes.slice(0, 4), m = +mes.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + p2(m + 1); }
  function diasDelMes(mes){ return new Date(Date.UTC(+mes.slice(0, 4), +mes.slice(5, 7), 0)).getUTCDate(); }

  var MESES = 12;                                             // los meses de los gráficos, contando el de hoy
  // Cuándo un crédito fue una venta: lo que no se anuló ni se quedó en solicitud
  var NO_ES_VENTA = ['cancelado','rechazado','rechazada','pendiente_revision'];
  // Los tramos de la mora, los mismos del Dashboard (días de atraso)
  var TRAMOS = [['1-15', 1, 15], ['16-30', 16, 30], ['31-60', 31, 60], ['+60', 61, Infinity]];
  var cobroVacio = function(){ return { cuotas: 0, iniciales: 0 }; };

  // creds y pagos: los documentos de la base, cada uno con su id. opts: hoy ('AAAA-MM-DD' en
  // Venezuela), gracia (días de gracia de la compañía; 5 si no se dice) y ledger (CreditoLedger).
  function grupoResumen(creds, pagos, opts){
    opts = opts || {};
    var hoy = String(opts.hoy || ''), hoyN = diaDe(hoy), conFecha = /^\d{4}-\d{2}-\d{2}$/.test(hoy);
    var gracia = (opts.gracia != null && isFinite(Number(opts.gracia))) ? Number(opts.gracia) : 5;
    var ledger = opts.ledger || (root && root.CreditoLedger) || null;
    var idx = indicePagos(pagos), porCred = agruparPagos(pagos);
    var r = { creditos: 0, cartera: 0, alDia: 0, enMora: 0, vencido: 0 };

    // ── Las fechas de hoy: el mes, los últimos 7 días, el mes pasado y lo que vence esta semana ──
    var mesHoy = conFecha ? hoy.slice(0, 7) : '', mesIni = mesHoy + '-01';
    var hace7 = conFecha ? sumarDias(hoy, -6) : '', en7 = conFecha ? sumarDias(hoy, 6) : '';
    var mesAnt = conFecha ? mesMas(mesHoy, -1) : '';
    var mesAntAFecha = conFecha ? mesAnt + '-' + p2(Math.min(+hoy.slice(8, 10), diasDelMes(mesAnt))) : '';
    var meses = [], iMes = {};
    for(var k = MESES - 1; conFecha && k >= 0; k--){ var mk = mesMas(mesHoy, -k); iMes[mk] = meses.length; meses.push({ mes: mk, cuotas: 0, iniciales: 0, ventas: 0, financiado: 0 }); }
    var cobro = { hoy: cobroVacio(), semana: cobroVacio(), mes: cobroVacio(), mesPasadoAFecha: cobroVacio(), mesPasado: cobroVacio(), total: cobroVacio() };
    var tramos = TRAMOS.map(function(t){ return { tramo: t[0], creditos: 0, vencido: 0 }; });
    var semana = { cuotas: 0, monto: 0 };
    var historico = { vendidos: 0, financiado: 0, terminados: 0, recuperados: 0 };

    // ── Lo cobrado: pagos confirmados, cuotas e iniciales por separado (como el Dashboard) ──
    (pagos || []).forEach(function(p){
      if(!p || p.eliminado || p.estado !== 'confirmado') return;
      var m = parseFloat(p.monto) || 0;
      if(!m) return;
      var tipo = (p.esInicial || p.tipoOperacion === 'inicial_credito') ? 'iniciales' : 'cuotas', f = fechaTxt(p.fecha);
      cobro.total[tipo] += m;
      if(!f || !conFecha) return;
      if(f === hoy) cobro.hoy[tipo] += m;
      if(f >= hace7 && f <= hoy) cobro.semana[tipo] += m;
      if(f >= mesIni) cobro.mes[tipo] += m;                 // igual que «Cobrado» del Dashboard
      if(f.slice(0, 7) === mesAnt){ cobro.mesPasado[tipo] += m; if(f <= mesAntAFecha) cobro.mesPasadoAFecha[tipo] += m; }
      var i = iMes[f.slice(0, 7)];
      if(i != null) meses[i][tipo] += m;
    });

    (creds || []).forEach(function(c0){
      if(!c0 || c0.eliminado) return;
      var guardado = String(c0.estado || '');
      // ── Las ventas: cada crédito otorgado, en el mes de su fecha ──
      if(NO_ES_VENTA.indexOf(guardado) < 0){
        var fin = parseFloat(c0.fin) || 0, iv = iMes[fechaTxt(c0.fecha).slice(0, 7)];
        historico.vendidos++; historico.financiado += fin;
        if(iv != null){ meses[iv].ventas++; meses[iv].financiado += fin; }
      }
      if(guardado === 'recuperado' || guardado === 'recuperada') historico.recuperados++;
      var e = estadoHoy(c0, hoyN, gracia);
      if(e.estado === 'completado') historico.terminados++;
      if(e.estado !== 'activo' && e.estado !== 'mora') return;
      // ── La cartera: lo de siempre ──
      var c = Object.assign({}, c0, { estado: e.estado, mora: e.mora });
      r.creditos++;
      r.cartera += saldoPendiente(c, idx);
      var est = estadoLedger(c, porCred, ledger, hoy, gracia);
      // lo que vence de hoy a 6 días: lo que falta de esas cuotas
      if(est && conFecha) (est.cuotas || []).forEach(function(q){
        if(q && q.saldo > 0.001 && q.fechaVence && q.fechaVence >= hoy && q.fechaVence <= en7){ semana.cuotas++; semana.monto += q.saldo; }
      });
      var dias = parseInt(c.mora, 10) || 0;
      if(!(dias > 0)) return;
      r.enMora++;
      var venc = vencidoDe(c, est, hoy);
      r.vencido += venc;
      for(var t = 0; t < TRAMOS.length; t++) if(dias >= TRAMOS[t][1] && dias <= TRAMOS[t][2]){ tramos[t].creditos++; tramos[t].vencido += venc; break; }
    });
    r.alDia = Math.max(0, r.creditos - r.enMora);
    r.cartera = centavos(r.cartera);
    r.vencido = centavos(r.vencido);
    Object.keys(cobro).forEach(function(k){ cobro[k].cuotas = centavos(cobro[k].cuotas); cobro[k].iniciales = centavos(cobro[k].iniciales); });
    meses.forEach(function(x){ x.cuotas = centavos(x.cuotas); x.iniciales = centavos(x.iniciales); x.financiado = centavos(x.financiado); });
    tramos.forEach(function(x){ x.vencido = centavos(x.vencido); });
    semana.monto = centavos(semana.monto);
    historico.financiado = centavos(historico.financiado);
    r.cobro = cobro; r.meses = meses; r.tramos = tramos; r.semana = semana; r.historico = historico;
    return r;
  }

  // Suma dos resúmenes casilla por casilla. Los textos (el mes, el tramo) tienen que ser iguales.
  function sumarDos(a, b){
    if(typeof a === 'number' && typeof b === 'number') return centavos(a + b);
    if(Array.isArray(a) && Array.isArray(b)) return a.length === b.length ? a.map(function(x, i){ return sumarDos(x, b[i]); }) : undefined;
    if(a && b && typeof a === 'object' && typeof b === 'object'){
      var o = {};
      Object.keys(a).forEach(function(k){ if(k !== 'nombre' && k !== 'error' && k in b){ var v = sumarDos(a[k], b[k]); if(v !== undefined) o[k] = v; } });
      return o;
    }
    return (typeof a === 'string' && a === b) ? a : undefined;
  }
  // Las dos juntas: se suman. Si falta alguna (no se pudo leer), no hay total.
  function grupoSumar(lista){
    var t = null;
    for(var i = 0; i < lista.length; i++){
      var x = lista[i];
      if(!x || typeof x.creditos !== 'number') return null;
      t = t ? sumarDos(t, x) : JSON.parse(JSON.stringify(x));
    }
    if(t){ delete t.nombre; delete t.error; }
    return t;
  }

  var api = { grupoResumen: grupoResumen, grupoSumar: grupoSumar, estadoHoy: estadoHoy, diaDe: diaDe, fechaTxt: fechaTxt };
  if(root){ root.grupoResumen = grupoResumen; root.grupoSumar = grupoSumar; }
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
