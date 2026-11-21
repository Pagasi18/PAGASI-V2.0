/* Módulo AI (21-nov-2026). Adam: "un modelo como que se llame AI.. donde los administradores de la
   empresa podamos buscar… a qué hora es la que más se vende… qué concesionario vendió más hoy… qué
   vendedor tuvo más ventas". Después: "haz el módulo de AI… dale sin parar".

   Aquí están las CONSULTAS que la AI puede pedir. Las cuentas las hace este código, no la AI: ella
   entiende la pregunta, escoge la consulta y explica el resultado. Así los números no se inventan y
   son los mismos del Dashboard (las piezas vienen de logic/grupo-resumen.js y del mismo ledger).

   Solo leen: ninguna consulta escribe, borra ni manda nada. De los clientes sale el nombre (cuando la
   pregunta lo pide: «quién debe más»); nunca cédula ni teléfono, que ni se cargan aquí.          */
'use strict';
const path = require('path'), fs = require('fs');
// La lógica compartida con el panel: al desplegar se copia a functions/logic (firebase.json, predeploy)
function compartido(nombre) { const copia = path.join(__dirname, '..', 'logic', nombre), original = path.join(__dirname, '..', '..', 'logic', nombre); return require(fs.existsSync(original) ? original : copia); }
const G = compartido('grupo-resumen.js');
const ledger = compartido('credito-ledger.js');

const DIA_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const ORDEN_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const METODO_NOM = { banco: 'banco (transferencia o pago móvil)', binance: 'Binance', efectivo: 'efectivo', zelle: 'Zelle', concesionario: 'inicial pagada en el concesionario', otros: 'otras formas' };
const TRAMO_NOM = { '1-15': 'de 1 a 15 días', '16-30': 'de 16 a 30 días', '31-60': 'de 31 a 60 días', '+60': 'más de 60 días' };
const p2 = n => (n < 10 ? '0' : '') + n;
const r2 = v => Math.round((+v || 0) * 100) / 100;
const r1 = v => Math.round((+v || 0) * 10) / 10;
// Para comparar nombres: sin tildes, en mayúsculas y sin espacios de más
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const esFecha = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T12:00:00Z'));
const docs = snap => snap.docs.map(d => Object.assign({ id: d.id }, d.data()));

class ErrorConsulta extends Error {}

// La hora (0 a 23, en Venezuela) en que se anotó algo. Una fecha con zona (…Z) se pasa a UTC−4;
// sin zona, la hora escrita ya es la de aquí. Sin hora, null.
function horaCaracas(v) {
  if (!v) return null;
  if (typeof v === 'object' && typeof v.toDate === 'function') v = v.toDate().toISOString();
  const s = String(v);
  if (!/T\d{2}:\d{2}/.test(s)) return null;
  const t = Date.parse(s);
  if (isNaN(t)) return null;
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(s)) return new Date(t - 4 * 3600000).getUTCHours();
  return +s.slice(11, 13);
}
function diaSemana(iso) { const d = new Date(iso + 'T12:00:00Z'); return isNaN(d.getTime()) ? null : d.getUTCDay(); }
function lunesDe(iso) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
function graciaDe(planDoc) {
  const p = (planDoc && planDoc.exists && planDoc.data()) || {};
  const g = Object.prototype.hasOwnProperty.call(p, 'diasGracia') ? p.diasGracia : p.gracia;
  return (g !== undefined && g !== null && isFinite(Number(g))) ? Number(g) : 5;
}

// ── Armar los datos de UNA compañía: las ventas (créditos otorgados) y los cobros ──
function armar(emp, creds, pagos, concs, gracia, hoy) {
  const nomConc = {};
  (concs || []).forEach(k => { if (k && k.id != null) nomConc[String(k.id)] = norm(k.nombre); });
  const hoyN = G.diaDe(hoy), idx = G.indicePagos(pagos), porCred = G.agruparPagos(pagos);
  const ventas = [], porId = {};
  (creds || []).forEach(c0 => {
    if (!c0 || c0.eliminado) return;
    const guardado = String(c0.estado || '');
    if (G.NO_ES_VENTA.indexOf(guardado) > -1) return;           // anulados y solicitudes no son ventas
    const e = G.estadoHoy(c0, hoyN, gracia), activo = e.estado === 'activo' || e.estado === 'mora';
    const c = activo ? Object.assign({}, c0, { estado: e.estado, mora: e.mora }) : c0;
    const est = G.estadoLedger(c, porCred, ledger, hoy, gracia);
    const dias = activo ? (parseInt(e.mora, 10) || 0) : 0;
    const conc = c0.concesionarioId == null ? '' : String(c0.concesionarioId);
    const v = {
      empresa: emp, id: String(c0.id), cliente: String(c0.cli || '').trim().replace(/\s+/g, ' '),
      concesionario: conc ? (nomConc[conc] || 'CONCESIONARIO ' + conc) : 'SIN CONCESIONARIO',
      vendedor: norm(c0.vendedorNombre) || 'SIN VENDEDOR ANOTADO', modelo: norm(c0.modelo) || norm(c0.marca) || 'SIN MODELO', marca: norm(c0.marca) || 'SIN MARCA',
      precio: +c0.precio || 0, inicial: +c0.ini || 0, financiado: +c0.fin || 0, cuota: parseFloat(c0.cuotaQ || c0.cuota) || 0, plazo: +c0.plazo || 0,
      fecha: G.fechaTxt(c0.fecha) || G.fechaTxt(c0.creado), hora: horaCaracas(c0.creado),
      estado: activo ? (dias > 0 ? 'en mora' : 'al día') : (e.estado === 'completado' ? 'completado' : (guardado === 'recuperada' ? 'recuperado' : guardado || 'otro')),
      activo, diasAtraso: dias, saldo: activo ? r2(G.saldoPendiente(c, idx)) : 0, vencido: activo && dias > 0 ? r2(G.vencidoDe(c, est, hoy)) : 0,
      cuotasPagadas: est ? est.cuotasPagadas : (parseInt(c0.pagado, 10) || 0), cuotasTotal: est ? est.totalCuotas : (parseInt(c0.totalCuotas, 10) || 0),
      vencidas: []
    };
    // Las cuotas que ya vencieron: lo pagado hasta el día en que vencía, lo pagado después y lo que falta
    if (est && hoy) (est.cuotas || []).forEach(q => {
      if (!q || !q.fechaVence || q.fechaVence >= hoy) return;
      let at = 0;
      (q.aplicaciones || []).forEach(a => { if (String(a.fecha || '').slice(0, 10) <= q.fechaVence) at += parseFloat(a.monto) || 0; });
      at = Math.min(at, q.pagado || 0);
      v.vencidas.push({ vence: q.fechaVence, monto: q.monto || 0, aTiempo: at, tarde: Math.max(0, (q.pagado || 0) - at), sinPagar: Math.max(0, q.saldo || 0) });
    });
    ventas.push(v); porId[v.id] = v;
  });
  const cobros = [];
  (pagos || []).forEach(p => {
    if (!p || p.eliminado || p.estado !== 'confirmado') return;
    const m = parseFloat(p.monto) || 0;
    if (!m) return;
    const v = porId[String(p.cred)];
    cobros.push({ empresa: emp, fecha: G.fechaTxt(p.fecha), hora: horaCaracas(p.creadoEn), monto: m, tipo: (p.esInicial || p.tipoOperacion === 'inicial_credito') ? 'inicial' : 'cuota',
      metodo: G.metodoDe(p.metodo), concesionario: v ? v.concesionario : 'SIN CRÉDITO', vendedor: v ? v.vendedor : 'SIN CRÉDITO', modelo: v ? v.modelo : 'SIN CRÉDITO' });
  });
  return { ventas, cobros };
}

// Las dos bases, leídas en el momento (una memoria corta: varias preguntas seguidas no vuelven a leer)
const VIGENCIA_MS = 3 * 60 * 1000;
let memoria = null;
async function cargar(bases, hoy, o) {
  if (!(o && o.fresco) && memoria && memoria.hoy === hoy && Date.now() - memoria.t < VIGENCIA_MS) return memoria.D;
  const partes = await Promise.all(['18', '26'].map(async emp => {
    const db = bases[emp];
    const [cs, ps, ks, plan] = await Promise.all([db.collection('creditos').get(), db.collection('pagos').get(), db.collection('concesionarios').get(), db.collection('config').doc('plan').get()]);
    return armar(emp, docs(cs), docs(ps), docs(ks), graciaDe(plan), hoy);
  }));
  const D = { ventas: partes[0].ventas.concat(partes[1].ventas), cobros: partes[0].cobros.concat(partes[1].cobros) };
  memoria = { t: Date.now(), hoy, D };
  return D;
}
const olvidar = () => { memoria = null; };

// ── Piezas comunes de las consultas ──
function periodo(a, hoy, defecto) {
  if (a.desde != null && a.desde !== '' && !esFecha(a.desde)) throw new ErrorConsulta('«desde» tiene que ser una fecha AAAA-MM-DD');
  if (a.hasta != null && a.hasta !== '' && !esFecha(a.hasta)) throw new ErrorConsulta('«hasta» tiene que ser una fecha AAAA-MM-DD');
  const desde = esFecha(a.desde) ? a.desde : (defecto || '2000-01-01'), hasta = esFecha(a.hasta) ? a.hasta : hoy;
  if (desde > hasta) throw new ErrorConsulta('«desde» es después de «hasta»');
  return { desde, hasta };
}
function empresas(a) { return a.empresa === '18' || a.empresa === '26' ? [a.empresa] : ['18', '26']; }
function filtrar(l, a) {
  const f = (campo, txt) => { const t = norm(txt); return t ? l.filter(x => norm(x[campo]).indexOf(t) > -1) : l; };
  if (a.filtro_concesionario) l = f('concesionario', a.filtro_concesionario);
  if (a.filtro_vendedor) l = f('vendedor', a.filtro_vendedor);
  if (a.filtro_modelo) l = f('modelo', a.filtro_modelo);
  return l;
}
function tramoDe(d) { for (const t of G.TRAMOS) if (d >= t[1] && d <= t[2]) return TRAMO_NOM[t[0]]; return 'al día'; }
// La etiqueta del grupo al que va cada fila
function grupoDe(por, x, fecha) {
  switch (por) {
    case 'dia': return fecha;
    case 'semana': return 'semana del lunes ' + lunesDe(fecha);
    case 'quincena': return fecha.slice(0, 7) + (+fecha.slice(8, 10) <= 15 ? ' 1ª quincena' : ' 2ª quincena');
    case 'mes': case 'mes_venta': return fecha.slice(0, 7);
    case 'hora': return x.hora == null ? 'sin hora anotada' : p2(x.hora) + ':00 a ' + p2(x.hora) + ':59';
    case 'dia_semana': return DIA_SEMANA[diaSemana(fecha)] || 'sin fecha';
    case 'concesionario': return x.concesionario;
    case 'vendedor': return x.vendedor;
    case 'modelo': return x.modelo;
    case 'marca': return x.marca;
    case 'empresa': return 'PAGASI ' + x.empresa;
    case 'plazo': return x.plazo ? x.plazo + ' meses' : 'sin plazo';
    case 'metodo': return METODO_NOM[x.metodo] || x.metodo;
    case 'tipo': return x.tipo === 'inicial' ? 'iniciales' : 'cuotas';
    case 'tramo_mora': return tramoDe(x.diasAtraso);
    case 'estado': return x.estado;
  }
  return 'total';
}
const EN_EL_TIEMPO = ['dia', 'semana', 'quincena', 'mes', 'mes_venta', 'hora', 'dia_semana'];
// Juntar por grupo, ordenar y cortar. valor: la cifra con la que se ordena «mayor/menor».
function agrupar(l, por, fechaDe, sumar, valor, a, cuantos) {
  const m = new Map(), n = new Map();
  l.forEach(x => { const k = grupoDe(por, x, fechaDe(x)); const acc = m.get(k) || {}; sumar(acc, x); m.set(k, acc); n.set(k, (n.get(k) || 0) + 1); });
  let grupos = [...m.entries()].map(([grupo, acc]) => Object.assign({ grupo }, acc));
  // En un ranking por porcentaje, un grupo de 1 crédito (100%) taparía a los de verdad: se piden al menos «minimo»
  const minimo = Math.max(1, parseInt(a.minimo, 10) || cuantos || 1);
  const chicos = grupos.filter(g => n.get(g.grupo) < minimo).length;
  if (chicos) grupos = grupos.filter(g => n.get(g.grupo) >= minimo);
  const orden = a.orden || (EN_EL_TIEMPO.indexOf(por) > -1 ? 'cronologico' : 'mayor');
  if (orden === 'cronologico') {
    if (por === 'dia_semana') grupos.sort((x, y) => ORDEN_SEMANA.indexOf(x.grupo) - ORDEN_SEMANA.indexOf(y.grupo));
    else grupos.sort((x, y) => String(x.grupo).localeCompare(String(y.grupo)));
  } else grupos.sort((x, y) => (orden === 'menor' ? valor(x) - valor(y) : valor(y) - valor(x)) || String(x.grupo).localeCompare(String(y.grupo)));
  const max = Math.max(1, Math.min(62, parseInt(a.limite, 10) || (EN_EL_TIEMPO.indexOf(por) > -1 ? 62 : 15)));
  const omitidos = Math.max(0, grupos.length - max) + chicos;
  // en el tiempo se quedan los más recientes; en un ranking, los primeros
  grupos = orden === 'cronologico' && por !== 'dia_semana' && por !== 'hora' ? grupos.slice(-max) : grupos.slice(0, max);
  return { grupos, omitidos };
}
const sumaDe = (l, k) => r2(l.reduce((s, x) => s + (+x[k] || 0), 0));
const pct = (n, t) => t > 0 ? r1(n * 100 / t) : 0;

// ── Las consultas ──
function ventas(D, a, hoy) {
  const per = periodo(a, hoy), emps = empresas(a), por = a.agrupar_por || 'nada';
  const l = filtrar(D.ventas.filter(v => emps.includes(v.empresa) && v.fecha && v.fecha >= per.desde && v.fecha <= per.hasta), a);
  const n = l.length, precio = sumaDe(l, 'precio'), inicial = sumaDe(l, 'inicial');
  const total = { motos_vendidas: n, financiado: sumaDe(l, 'financiado'), precio_promedio: n ? r2(precio / n) : 0, inicial_promedio: n ? r2(inicial / n) : 0, inicial_pct_del_precio: pct(inicial, precio), cuota_quincenal_promedio: n ? r2(sumaDe(l, 'cuota') / n) : 0 };
  const r = { periodo: per, empresa: emps.length === 2 ? 'las dos' : 'PAGASI ' + emps[0], total };
  if (por !== 'nada') {
    const g = agrupar(l, por, x => x.fecha, (acc, x) => { acc.motos = (acc.motos || 0) + 1; acc.financiado = r2((acc.financiado || 0) + x.financiado); }, x => x.motos, a);
    r.grupos = g.grupos.map(x => Object.assign(x, { pct_del_total: pct(x.motos, n) }));
    if (g.omitidos) r.grupos_no_mostrados = g.omitidos;
    if (por === 'hora') r.nota = 'La hora es cuando el crédito se cargó en el sistema (no necesariamente la firma).';
    if (por === 'vendedor') r.nota = 'El vendedor es el anotado en el crédito: a veces es quien lo cargó, no quien vendió. Los créditos viejos de la 18 no tienen vendedor anotado.';
  }
  return r;
}
function cobros(D, a, hoy) {
  const per = periodo(a, hoy), emps = empresas(a), por = a.agrupar_por || 'nada', tipo = a.tipo === 'cuotas' ? 'cuota' : a.tipo === 'iniciales' ? 'inicial' : '';
  const l = filtrar(D.cobros.filter(p => emps.includes(p.empresa) && p.fecha && p.fecha >= per.desde && p.fecha <= per.hasta && (!tipo || p.tipo === tipo)), a);
  const monto = sumaDe(l, 'monto');
  const total = { cobrado: monto, pagos: l.length, cuotas: r2(l.filter(p => p.tipo === 'cuota').reduce((s, p) => s + p.monto, 0)), iniciales: r2(l.filter(p => p.tipo === 'inicial').reduce((s, p) => s + p.monto, 0)) };
  const r = { periodo: per, empresa: emps.length === 2 ? 'las dos' : 'PAGASI ' + emps[0], tipo: tipo ? (tipo === 'cuota' ? 'solo cuotas' : 'solo iniciales') : 'cuotas e iniciales', total };
  if (por !== 'nada') {
    const g = agrupar(l, por, x => x.fecha, (acc, x) => { acc.cobrado = r2((acc.cobrado || 0) + x.monto); acc.pagos = (acc.pagos || 0) + 1; }, x => x.cobrado, a);
    r.grupos = g.grupos.map(x => Object.assign(x, { pct_del_total: pct(x.cobrado, monto) }));
    if (g.omitidos) r.grupos_no_mostrados = g.omitidos;
    if (por === 'hora') r.nota = 'La hora es cuando el pago se registró en el sistema; los pagos viejos no la tienen (salen como «sin hora anotada»).';
  }
  return r;
}
function cartera(D, a) {
  const emps = empresas(a), por = a.agrupar_por || 'nada', ord = a.ordenar_por || 'creditos';
  const l = filtrar(D.ventas.filter(v => v.activo && emps.includes(v.empresa)), a);
  const tot = { creditos_activos: l.length, dinero_en_la_calle: sumaDe(l, 'saldo'), en_mora: l.filter(v => v.diasAtraso > 0).length, vencido: sumaDe(l, 'vencido') };
  tot.al_dia = tot.creditos_activos - tot.en_mora; tot.pct_en_mora = pct(tot.en_mora, tot.creditos_activos);
  const r = { hoy: true, empresa: emps.length === 2 ? 'las dos' : 'PAGASI ' + emps[0], total: tot };
  if (por !== 'nada') {
    const valor = { creditos: x => x.creditos, cartera: x => x.dinero_en_la_calle, en_mora: x => x.en_mora, pct_mora: x => x.pct_en_mora, vencido: x => x.vencido }[ord] || (x => x.creditos);
    const g = agrupar(l, por, x => x.fecha || '0000-00-00', (acc, x) => {
      acc.creditos = (acc.creditos || 0) + 1; acc.dinero_en_la_calle = r2((acc.dinero_en_la_calle || 0) + x.saldo);
      acc.en_mora = (acc.en_mora || 0) + (x.diasAtraso > 0 ? 1 : 0); acc.vencido = r2((acc.vencido || 0) + x.vencido);
      acc.pct_en_mora = pct(acc.en_mora, acc.creditos);
    }, valor, a, ord === 'pct_mora' ? 5 : 1);
    r.grupos = g.grupos;
    if (g.omitidos) r.grupos_no_mostrados = g.omitidos;
    if (ord === 'pct_mora') r.nota = 'Ordenado por % en mora, sin los grupos de menos de ' + Math.max(1, parseInt(a.minimo, 10) || 5) + ' créditos (con 1 o 2 el porcentaje engaña).';
  }
  return r;
}
function creditos(D, a, hoy) {
  const emps = empresas(a), est = a.estado || 'en_mora';
  let l = D.ventas.filter(v => emps.includes(v.empresa));
  if (est === 'en_mora') l = l.filter(v => v.diasAtraso > 0);
  else if (est === 'activos') l = l.filter(v => v.activo);
  else if (est === 'completados') l = l.filter(v => v.estado === 'completado');
  if (a.buscar) { const t = norm(a.buscar); l = l.filter(v => norm(v.cliente).indexOf(t) > -1 || norm(v.id) === t || norm(v.id).indexOf(t) > -1); }
  if (a.vendidos_desde || a.vendidos_hasta) { const per = periodo({ desde: a.vendidos_desde, hasta: a.vendidos_hasta }, hoy); l = l.filter(v => v.fecha && v.fecha >= per.desde && v.fecha <= per.hasta); }
  l = filtrar(l, a);
  const orden = a.orden || (est === 'en_mora' ? 'mas_atraso' : 'mas_reciente');
  const cmp = { mas_atraso: (x, y) => y.diasAtraso - x.diasAtraso || y.vencido - x.vencido, mas_vencido: (x, y) => y.vencido - x.vencido || y.diasAtraso - x.diasAtraso, mas_saldo: (x, y) => y.saldo - x.saldo,
    mas_reciente: (x, y) => String(y.fecha).localeCompare(String(x.fecha)), mas_antiguo: (x, y) => String(x.fecha).localeCompare(String(y.fecha)) }[orden] || ((x, y) => y.diasAtraso - x.diasAtraso);
  l = l.slice().sort(cmp);
  const max = Math.max(1, Math.min(25, parseInt(a.limite, 10) || 10));
  return { encontrados: l.length, mostrados: Math.min(max, l.length), creditos: l.slice(0, max).map(v => ({ credito: v.id, cliente: v.cliente, empresa: 'PAGASI ' + v.empresa, concesionario: v.concesionario, vendedor: v.vendedor, modelo: v.modelo,
    fecha_venta: v.fecha, estado: v.estado, dias_atraso: v.diasAtraso, vencido: v.vencido, saldo_por_cobrar: v.saldo, cuota_quincenal: v.cuota, cuotas_pagadas: v.cuotasPagadas, cuotas_total: v.cuotasTotal })) };
}
function puntualidad(D, a, hoy) {
  const per = periodo(a, hoy, G.mesMas(hoy.slice(0, 7), -5) + '-01'), emps = empresas(a), por = a.agrupar_por || 'mes';
  const filas = [];
  filtrar(D.ventas.filter(v => emps.includes(v.empresa)), a).forEach(v => v.vencidas.forEach(q => { if (q.vence >= per.desde && q.vence <= per.hasta) filas.push(Object.assign({ vence: q.vence }, q, { empresa: v.empresa, concesionario: v.concesionario, vendedor: v.vendedor, modelo: v.modelo })); }));
  const sumar = (acc, x) => { acc.cuotas = (acc.cuotas || 0) + 1; acc.monto = r2((acc.monto || 0) + x.monto); acc.a_tiempo = r2((acc.a_tiempo || 0) + x.aTiempo); acc.tarde = r2((acc.tarde || 0) + x.tarde); acc.sin_pagar = r2((acc.sin_pagar || 0) + x.sinPagar); };
  const conPct = x => Object.assign(x, { pct_a_tiempo: pct(x.a_tiempo, x.monto), pct_tarde: pct(x.tarde, x.monto), pct_sin_pagar: pct(x.sin_pagar, x.monto) });
  const tot = {}; filas.forEach(x => sumar(tot, x));
  const r = { periodo_de_vencimiento: per, empresa: emps.length === 2 ? 'las dos' : 'PAGASI ' + emps[0], total: conPct(Object.assign({ cuotas: 0, monto: 0, a_tiempo: 0, tarde: 0, sin_pagar: 0 }, tot)),
    nota: 'A tiempo = pagado hasta el día en que vencía la cuota; los pagos se aplican a la cuota más vieja primero. Solo cuotas que ya vencieron (antes de hoy).' };
  if (por !== 'nada') {
    const ord = a.ordenar_por === 'pct_a_tiempo' ? (x => x.pct_a_tiempo) : a.ordenar_por === 'sin_pagar' ? (x => x.sin_pagar) : (x => x.monto);
    const g = agrupar(filas, por, x => x.vence, sumar, x => { conPct(x); return ord(x); }, a, a.ordenar_por === 'pct_a_tiempo' ? 20 : 1);
    r.grupos = g.grupos.map(conPct);
    if (g.omitidos) r.grupos_no_mostrados = g.omitidos;
  }
  return r;
}

// ── El gráfico: la AI lo pide con números que ya sacó de otra consulta; la pantalla lo dibuja ──
const TIPOS_GRAFICO = ['barras', 'barras_horizontales', 'linea', 'torta'];
function grafico(a, ctx) {
  if (ctx.graficos.length >= 3) throw new ErrorConsulta('Ya hay 3 gráficos en esta respuesta: no se pueden más.');
  const txt = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
  const tipo = TIPOS_GRAFICO.includes(a.tipo) ? a.tipo : 'barras';
  const etiquetas = Array.isArray(a.etiquetas) ? a.etiquetas.slice(0, 40).map(e => txt(e, 40)) : [];
  if (!etiquetas.length) throw new ErrorConsulta('Faltan las etiquetas del gráfico.');
  const series = (Array.isArray(a.series) ? a.series : []).slice(0, tipo === 'torta' ? 1 : 3).map(s => ({ nombre: txt(s && s.nombre, 40) || 'Serie', valores: (Array.isArray(s && s.valores) ? s.valores : []).slice(0, etiquetas.length).map(v => (typeof v === 'number' && isFinite(v)) ? r2(v) : 0) }));
  if (!series.length || series.some(s => s.valores.length !== etiquetas.length)) throw new ErrorConsulta('Cada serie tiene que traer un valor por etiqueta.');
  const g = { tipo, titulo: txt(a.titulo, 80) || 'Gráfico', etiquetas, series, formato: ['dinero', 'numero', 'porcentaje'].includes(a.formato) ? a.formato : 'numero', apilado: a.apilado === true && tipo !== 'torta' && series.length > 1 };
  ctx.graficos.push(g);
  return { listo: true, mensaje: 'El gráfico se mostrará debajo de tu respuesta.' };
}

// ── Las herramientas como las ve Claude ──
const EMPRESA = { type: 'string', enum: ['ambas', '18', '26'], description: 'ambas (por defecto), 18 (PAGASI 18) o 26 (PAGASI 26)' };
const FECHA = d => ({ type: 'string', description: d + ' (AAAA-MM-DD, hora de Venezuela)' });
const ORDEN = { type: 'string', enum: ['mayor', 'menor', 'cronologico'], description: 'mayor primero (por defecto en rankings), menor primero o en orden de fecha/hora (por defecto si se agrupa por tiempo)' };
const LIMITE = { type: 'integer', minimum: 1, maximum: 62, description: 'cuántos grupos devolver (15 por defecto en rankings)' };
const FILTROS = { filtro_concesionario: { type: 'string', description: 'solo ese concesionario (parte del nombre)' }, filtro_vendedor: { type: 'string', description: 'solo ese vendedor (parte del nombre)' }, filtro_modelo: { type: 'string', description: 'solo ese modelo de moto (parte del nombre)' } };
const HERRAMIENTAS = [
  { name: 'ventas', description: 'Motos vendidas (créditos otorgados, sin anulados ni solicitudes sin aprobar) en un período: cuántas, cuánto se financió, precio, inicial y cuota promedio; y agrupadas. Para: cuántas se vendieron, qué concesionario/vendedor/modelo vendió más, a qué hora o qué día de la semana se vende más, ventas por día/semana/mes, comparar PAGASI 18 y 26.',
    input_schema: { type: 'object', properties: Object.assign({ empresa: EMPRESA, desde: FECHA('primer día'), hasta: FECHA('último día (hoy si no se dice)'),
      agrupar_por: { type: 'string', enum: ['nada', 'dia', 'semana', 'quincena', 'mes', 'hora', 'dia_semana', 'concesionario', 'vendedor', 'modelo', 'marca', 'empresa', 'plazo'] }, orden: ORDEN, limite: LIMITE }, FILTROS) } },
  { name: 'cobros', description: 'Lo cobrado (pagos confirmados) en un período, cuotas e iniciales, y agrupado: por día, semana, quincena, mes, hora en que se registró, día de la semana, forma de pago, tipo (cuotas o iniciales), concesionario, vendedor o modelo del crédito, o compañía.',
    input_schema: { type: 'object', properties: Object.assign({ empresa: EMPRESA, desde: FECHA('primer día'), hasta: FECHA('último día (hoy si no se dice)'), tipo: { type: 'string', enum: ['todo', 'cuotas', 'iniciales'] },
      agrupar_por: { type: 'string', enum: ['nada', 'dia', 'semana', 'quincena', 'mes', 'hora', 'dia_semana', 'metodo', 'tipo', 'concesionario', 'vendedor', 'modelo', 'empresa'] }, orden: ORDEN, limite: LIMITE }, FILTROS) } },
  { name: 'cartera', description: 'La cartera de HOY (créditos activos: al día o en mora): cuántos créditos, dinero en la calle (lo que falta por cobrar), cuántos en mora, % en mora y monto vencido; agrupada por compañía, concesionario, vendedor, modelo, tramo de días de atraso, mes de venta o plazo. Para: qué concesionario tiene más mora, cuánto hay en la calle, cómo está la mora.',
    input_schema: { type: 'object', properties: Object.assign({ empresa: EMPRESA, agrupar_por: { type: 'string', enum: ['nada', 'empresa', 'concesionario', 'vendedor', 'modelo', 'tramo_mora', 'mes_venta', 'plazo'] },
      ordenar_por: { type: 'string', enum: ['creditos', 'cartera', 'en_mora', 'pct_mora', 'vencido'] }, orden: ORDEN, limite: LIMITE,
      minimo: { type: 'integer', minimum: 1, description: 'al ordenar por porcentaje: solo grupos con al menos esta cantidad de créditos (5 por defecto)' } }, FILTROS) } },
  { name: 'creditos', description: 'Créditos uno por uno, con el nombre del cliente: los que tienen más días de atraso o más vencido, los más recientes, o buscar el crédito de una persona por su nombre o número. Nunca trae cédulas ni teléfonos.',
    input_schema: { type: 'object', properties: Object.assign({ empresa: EMPRESA, estado: { type: 'string', enum: ['en_mora', 'activos', 'completados', 'todos'] }, buscar: { type: 'string', description: 'nombre del cliente o número del crédito' },
      vendidos_desde: FECHA('vendidos desde'), vendidos_hasta: FECHA('vendidos hasta'), orden: { type: 'string', enum: ['mas_atraso', 'mas_vencido', 'mas_saldo', 'mas_reciente', 'mas_antiguo'] },
      limite: { type: 'integer', minimum: 1, maximum: 25 } }, FILTROS) } },
  { name: 'puntualidad', description: 'Cómo se pagan las cuotas que ya vencieron: a tiempo (pagado hasta el día en que vencía), tarde o sin pagar, en dinero y porcentaje. Por mes o quincena de vencimiento, compañía, concesionario, vendedor o modelo. Por defecto, los últimos 6 meses.',
    input_schema: { type: 'object', properties: Object.assign({ empresa: EMPRESA, desde: FECHA('cuotas que vencieron desde'), hasta: FECHA('hasta'), agrupar_por: { type: 'string', enum: ['nada', 'mes', 'quincena', 'empresa', 'concesionario', 'vendedor', 'modelo'] },
      ordenar_por: { type: 'string', enum: ['monto', 'pct_a_tiempo', 'sin_pagar'] }, orden: ORDEN, limite: LIMITE,
      minimo: { type: 'integer', minimum: 1, description: 'al ordenar por porcentaje: solo grupos con al menos esta cantidad de cuotas (20 por defecto)' } }, FILTROS) } },
  { name: 'grafico', description: 'Dibuja un gráfico interactivo debajo de tu respuesta con números que YA sacaste de otra consulta (nunca inventados). Úsalo cuando ayude a ver la respuesta: algo en el tiempo (barras o línea) o un ranking (barras_horizontales). Máximo 2 por respuesta.',
    input_schema: { type: 'object', properties: { tipo: { type: 'string', enum: TIPOS_GRAFICO }, titulo: { type: 'string' }, etiquetas: { type: 'array', items: { type: 'string' }, maxItems: 40 },
      series: { type: 'array', maxItems: 3, items: { type: 'object', properties: { nombre: { type: 'string' }, valores: { type: 'array', items: { type: 'number' } } }, required: ['nombre', 'valores'] } },
      formato: { type: 'string', enum: ['dinero', 'numero', 'porcentaje'] }, apilado: { type: 'boolean' } }, required: ['tipo', 'titulo', 'etiquetas', 'series'] } }
];
const NOMBRE_CONSULTA = { ventas: 'ventas', cobros: 'cobros', cartera: 'cartera de hoy', creditos: 'créditos uno por uno', puntualidad: 'cuotas a tiempo', grafico: 'gráfico' };
const POR_TXT = { dia: 'por día', semana: 'por semana', quincena: 'por quincena', mes: 'por mes', mes_venta: 'por mes de venta', hora: 'por hora', dia_semana: 'por día de la semana', concesionario: 'por concesionario', vendedor: 'por vendedor', modelo: 'por modelo', marca: 'por marca', empresa: 'por compañía', plazo: 'por plazo', metodo: 'por forma de pago', tipo: 'cuotas e iniciales', tramo_mora: 'por días de atraso' };
// Lo que se le muestra a la persona debajo de la respuesta: qué consultó (para que sepa de dónde salió)
function resumen(nombre, a, hoy) {
  a = a || {};
  if (nombre === 'grafico') return '';
  const partes = [NOMBRE_CONSULTA[nombre] || nombre];
  if (a.agrupar_por && a.agrupar_por !== 'nada') partes.push(POR_TXT[a.agrupar_por] || a.agrupar_por);
  if (a.empresa === '18' || a.empresa === '26') partes.push('PAGASI ' + a.empresa);
  const d = esFecha(a.desde) ? a.desde : '', h = esFecha(a.hasta) ? a.hasta : '';
  if (d && (d === h || (d === hoy && !h))) partes.push(d === hoy ? 'hoy' : d);
  else if (d || h) partes.push((d || 'el principio') + ' a ' + (h || 'hoy'));
  ['filtro_concesionario', 'filtro_vendedor', 'filtro_modelo'].forEach(k => { if (a[k]) partes.push(String(a[k]).slice(0, 30)); });
  if (nombre === 'creditos' && a.buscar) partes.push('«' + String(a.buscar).slice(0, 30) + '»');
  return partes.join(' · ');
}
// Ejecutar lo que pidió la AI. ctx: { D, hoy, graficos, usadas }
function ejecutar(nombre, args, ctx) {
  const a = (args && typeof args === 'object') ? args : {};
  let r;
  switch (nombre) {
    case 'ventas': r = ventas(ctx.D, a, ctx.hoy); break;
    case 'cobros': r = cobros(ctx.D, a, ctx.hoy); break;
    case 'cartera': r = cartera(ctx.D, a); break;
    case 'creditos': r = creditos(ctx.D, a, ctx.hoy); break;
    case 'puntualidad': r = puntualidad(ctx.D, a, ctx.hoy); break;
    case 'grafico': r = grafico(a, ctx); break;
    default: throw new ErrorConsulta('No existe la consulta «' + String(nombre).slice(0, 40) + '».');
  }
  const txt = resumen(nombre, a, ctx.hoy);
  if (txt && ctx.usadas.indexOf(txt) < 0) ctx.usadas.push(txt);
  return r;
}

module.exports = { armar, cargar, olvidar, ejecutar, HERRAMIENTAS, ErrorConsulta, horaCaracas, lunesDe, norm, resumen, VIGENCIA_MS,
  consultas: { ventas, cobros, cartera, creditos, puntualidad, grafico } };
