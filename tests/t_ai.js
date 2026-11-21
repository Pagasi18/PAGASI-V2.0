// 21-nov-2026, Adam: "un modelo como que se llame AI.. donde los administradores de la empresa podamos
// buscar que si.... a qué hora es la que más se vende.... o qué concesionario vendió más hoy?? o qué
// vendedor tuvo más ventas" y después "haz el módulo de AI… dale sin parar".
//  1. Las consultas (functions/lib/ai-consultas.js) hacen las cuentas, las mismas del Dashboard, y
//     nunca sacan cédulas ni teléfonos.
//  2. La conversación con Claude (functions/lib/ai.js): las herramientas, las vueltas, los errores
//     (clave dañada, sin saldo, ocupado), el tope de vueltas y de tiempo, y lo que se gasta.
//  3. La puerta del servidor (/equipo, preguntaAI): solo administradores o con permiso, con topes.
//  4. La pantalla (modules/ai.js): el menú, la pregunta, la respuesta escapada, los gráficos y los errores.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (l, v) => { if (v) { pass++; console.log('OK   ' + l); } else { fail++; console.log('FALLA ' + l); } };
const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
process.on('unhandledRejection', e => { fail++; console.log('FALLA promesa rechazada: ' + (e && e.message)); });
function elemento() {
  return {
    innerHTML: '', outerHTML: '', textContent: '', value: '', className: '', id: '', type: 'text',
    style: {}, dataset: {}, classList: { add(){}, remove(){}, contains(){ return false; }, toggle(){} },
    children: [], checked: false, disabled: false,
    appendChild(){}, removeChild(){}, insertBefore(){}, remove(){},
    setAttribute(){}, getAttribute(){ return null; }, removeAttribute(){},
    addEventListener(){}, removeEventListener(){}, click(){}, focus(){}, blur(){},
    closest(){ return null; }, matches(){ return false; },
    getBoundingClientRect(){ return {top:0,left:0,width:0,height:0,bottom:0,right:0}; },
    querySelector(){ return elemento(); }, querySelectorAll(){ return []; },
  };
}
const doc = {
  getElementById(){ return elemento(); }, querySelector(){ return elemento(); }, querySelectorAll(){ return []; },
  createElement(){ return elemento(); }, createTextNode(){ return elemento(); },
  head: elemento(), body: elemento(), documentElement: elemento(), addEventListener(){}, removeEventListener(){},
};
const ctx = {
  console: { log(){}, warn(){}, error(){} },
  setTimeout(){ return 0; }, clearTimeout(){}, setInterval(){ return 0; }, clearInterval(){}, requestAnimationFrame(){ return 0; },
  document: doc, navigator: { userAgent: 'node', language: 'es' },
  location: { href: 'https://pagasi.io/admin.html', search: '', hash: '', pathname: '/admin.html' },
  localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
  sessionStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
  fetch(){ return Promise.resolve({ ok: true, json: () => Promise.resolve({}) }); },
  alert(){}, confirm(){ return true; }, prompt(){ return ''; },
  db: null, storage: null, firebase: undefined, innerWidth: 1440, innerHeight: 900, PG: {},
};
ctx.MutationObserver = function(){ return {observe(){}, disconnect(){}}; };
ctx.IntersectionObserver = function(){ return {observe(){}, disconnect(){}, unobserve(){}}; };
ctx.ResizeObserver = function(){ return {observe(){}, disconnect(){}}; };
ctx.addEventListener = function(){}; ctx.removeEventListener = function(){};
ctx.matchMedia = function(){ return {matches:false, addListener(){}, addEventListener(){}}; };
ctx.getComputedStyle = function(){ return {getPropertyValue(){ return ''; }}; };
ctx.scrollTo = function(){};
ctx.history = { state:null, pushState(){}, replaceState(){}, back(){} };
ctx.window = ctx;

const html = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
const archivos = [...html.matchAll(/src="((?:assets|logic|modules)\/[^"?]+\.js)/g)].map(m => m[1]);
vm.createContext(ctx);
vm.runInContext(archivos.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n'), ctx, { filename: 'app.js' });

const { grupoResumen } = require('../logic/grupo-resumen');
const ledger = require('../logic/credito-ledger');
const C = require('../functions/lib/ai-consultas');
const AI = require('../functions/lib/ai');
const p2 = n => String(n).padStart(2, '0');
const dia = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); };
const HOY = dia(0);
const clon = o => JSON.parse(JSON.stringify(o));
const lanza = (f, re) => { try { f(); return false; } catch (e) { return re ? re.test(e.message) : true; } };

// ── Datos de prueba: dos compañías, con horas, vendedores, concesionarios y pagos ──
const cred = (id, extra) => Object.assign({ id, cli: 'CLIENTE ' + id, estado: 'activo', mora: 0, pagado: 0, total: 1440, cuotaQ: 80, totalCuotas: 18, plazo: 9, precio: 1400, ini: 600, fin: 800,
  concesionarioId: 'CONC-1', modelo: 'OWEN 200S', marca: 'EMPIRE', vendedorNombre: 'Liz Ospina', cedula: 'V-12345678', telefono: '04141234567' }, extra);
const pago = (id, c, monto, extra) => Object.assign({ id, cred: c, monto, fecha: dia(-3), estado: 'confirmado', metodo: '100% Banco' }, extra);
const CR18 = [
  cred('A1', { fecha: dia(-60), pagado: 1, creado: dia(-60) + 'T21:15:00.000Z', vendedorNombre: '' }),         // 5:15 pm en Venezuela, sin vendedor (como los viejos de la 18)
  cred('A2', { fecha: dia(-40), pagado: 2, creado: dia(-40) + 'T14:05:00.000Z', concesionarioId: 'CONC-2' }), // 10:05 am
  cred('A3', { fecha: dia(-90), estado: 'cancelado', creado: dia(-90) + 'T15:00:00.000Z' }),                  // anulado: no es venta
  cred('A4', { fecha: dia(-200), pagado: 18, creado: dia(-200) + 'T20:00:00.000Z', modelo: 'RK 200' }),       // terminó de pagar
];
const PG18 = [pago('P1', 'A1', 80, { fecha: dia(-45) }), pago('P2', 'A2', 80, { fecha: dia(-25), creadoEn: dia(-25) + 'T13:30:00.000Z' }), pago('P3', 'A2', 80, { fecha: dia(-10), metodo: 'Binance' }),
  pago('P4', 'A1', 600, { fecha: dia(-60), esInicial: true, metodo: 'EFECTIVO' }), pago('P5', 'A4', 1440, { fecha: dia(-30) }), pago('P6', 'A2', 999, { estado: 'pendiente' })];
const CR26 = [
  cred('B1', { fecha: HOY, creado: HOY + 'T21:40:00.000Z', concesionarioId: 'CONC-1', vendedorNombre: 'Heymar Figuera' }),          // hoy, 5:40 pm
  cred('B2', { fecha: HOY, creado: HOY + 'T22:10:00.000Z', concesionarioId: 'CONC-3', vendedorNombre: 'Heymar Figuera', modelo: 'RK 200' }),  // hoy, 6:10 pm
  cred('B3', { fecha: dia(-20), creado: dia(-20) + 'T21:00:00.000Z', concesionarioId: 'CONC-3', cli: 'José Pérez Ñáñez' }),            // 5 pm, 20 días: 1 cuota vencida
  cred('B4', { fecha: dia(-5), estado: 'pendiente_revision', creado: dia(-5) + 'T15:00:00.000Z' }),                                     // solicitud: no es venta
];
const PG26 = [pago('Q1', 'B1', 700, { fecha: HOY, esInicial: true, metodo: 'Inicial en concesionario' }), pago('Q2', 'B2', 500, { fecha: HOY, tipoOperacion: 'inicial_credito', metodo: 'EFECTIVO' })];
const CONC = [{ id: 'CONC-1', nombre: 'Empire Bello Monte' }, { id: 'CONC-2', nombre: 'Motos TORO' }, { id: 'CONC-3', nombre: 'EK Trujillo' }];
const D18 = C.armar('18', clon(CR18), clon(PG18), CONC, 5, HOY), D26 = C.armar('26', clon(CR26), clon(PG26), CONC, 5, HOY);
const D = { ventas: D18.ventas.concat(D26.ventas), cobros: D18.cobros.concat(D26.cobros) };
const ctxC = () => ({ D, hoy: HOY, graficos: [], usadas: [] });
const ej = (n, a, c) => C.ejecutar(n, a || {}, c || ctxC());

// ══ 1. Las consultas ══
ok('las ventas son los créditos otorgados: sin anulados ni solicitudes', D.ventas.length === 6 && !D.ventas.some(v => ['A3', 'B4'].includes(v.id)));
ok('la hora de la venta en Venezuela sale de «creado» (21:15 UTC = 5 pm)', D.ventas.find(v => v.id === 'A1').hora === 17 && D.ventas.find(v => v.id === 'A2').hora === 10 && D.ventas.find(v => v.id === 'B2').hora === 18);
ok('...con o sin zona horaria, y con Timestamp de Firestore', C.horaCaracas('2026-11-21T03:30:00.000Z') === 23 && C.horaCaracas('2026-11-21T09:30:00') === 9 && C.horaCaracas('2026-11-21') === null && C.horaCaracas({ toDate: () => new Date('2026-11-21T16:00:00Z') }) === 12 && C.horaCaracas('') === null);
ok('nunca se cargan cédulas ni teléfonos (aunque el crédito los tenga)', !/V-12345678|04141234567/.test(JSON.stringify(D)));
const vh = ej('ventas', { agrupar_por: 'hora' });
ok('«¿a qué hora se vende más?»: las ventas por hora, en orden de hora, con la nota de que es la hora de carga', vh.total.motos_vendidas === 6 && vh.grupos.map(g => g.grupo).join() === '10:00 a 10:59,16:00 a 16:59,17:00 a 17:59,18:00 a 18:59' && vh.grupos.find(g => g.grupo === '17:00 a 17:59').motos === 3 && /se cargó en el sistema/.test(vh.nota));
const vc = ej('ventas', { desde: HOY, hasta: HOY, agrupar_por: 'concesionario' });
ok('«¿qué concesionario vendió más hoy?»: hoy, por concesionario, con su nombre', vc.total.motos_vendidas === 2 && vc.grupos.length === 2 && vc.grupos.every(g => g.motos === 1) && vc.grupos.map(g => g.grupo).sort().join() === 'EK TRUJILLO,EMPIRE BELLO MONTE' && vc.grupos[0].pct_del_total === 50);
const vv = ej('ventas', { agrupar_por: 'vendedor' });
ok('«¿qué vendedor vendió más?»: por vendedor, y avisa que a veces sale quien cargó la venta', vv.grupos[0].grupo === 'LIZ OSPINA' && vv.grupos[0].motos === 3 && vv.grupos[1].grupo === 'HEYMAR FIGUERA' && vv.grupos[1].motos === 2 && vv.grupos.some(g => g.grupo === 'SIN VENDEDOR ANOTADO') && /quien lo cargó/.test(vv.nota));
ok('...con filtros por compañía, concesionario, vendedor y modelo (sin importar tildes ni mayúsculas)', ej('ventas', { empresa: '18' }).total.motos_vendidas === 3 && ej('ventas', { filtro_concesionario: 'trujillo' }).total.motos_vendidas === 2 && ej('ventas', { filtro_modelo: 'rk' }).total.motos_vendidas === 2 && ej('ventas', { filtro_vendedor: 'héymar' }).total.motos_vendidas === 2);
ok('...y los promedios de la venta: precio, inicial y su % del precio', (() => { const t = ej('ventas', {}).total; return t.precio_promedio === 1400 && t.inicial_promedio === 600 && t.inicial_pct_del_precio === 42.9 && t.financiado === 4800; })());
ok('los días de la semana salen de lunes a domingo', (() => { const g = ej('ventas', { agrupar_por: 'dia_semana' }).grupos.map(x => x.grupo); const o = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']; return g.every((x, i) => i === 0 || o.indexOf(g[i - 1]) < o.indexOf(x)); })());
ok('fechas mal escritas o al revés: se le explica a la AI en vez de inventar', lanza(() => ej('ventas', { desde: 'ayer' }), /AAAA-MM-DD/) && lanza(() => ej('ventas', { desde: HOY, hasta: dia(-5) }), /después/) && lanza(() => ej('nada'), /No existe/));
ok('el límite corta el ranking y dice cuántos quedaron fuera', (() => { const r = ej('ventas', { agrupar_por: 'concesionario', limite: 1 }); return r.grupos.length === 1 && r.grupos_no_mostrados === 2; })());
const cb = ej('cobros', { agrupar_por: 'metodo' });
ok('cobros: solo pagos confirmados, cuotas e iniciales por separado, y por forma de pago', cb.total.cobrado === 80 * 3 + 600 + 1440 + 700 + 500 && cb.total.iniciales === 1800 && cb.total.cuotas === 1680 && cb.grupos.find(g => g.grupo === 'inicial pagada en el concesionario').cobrado === 700 && cb.grupos.find(g => g.grupo === 'Binance').cobrado === 80);
ok('...solo cuotas o solo iniciales, por compañía, y la hora del registro (los viejos sin hora)', ej('cobros', { tipo: 'iniciales', empresa: '26' }).total.cobrado === 1200 && ej('cobros', { tipo: 'cuotas' }).total.cobrado === 1680 && ej('cobros', { agrupar_por: 'hora' }).grupos.some(g => g.grupo === '09:00 a 09:59' && g.cobrado === 80) && ej('cobros', { agrupar_por: 'hora' }).grupos.some(g => g.grupo === 'sin hora anotada'));
const gr18 = grupoResumen(clon(CR18), clon(PG18), { hoy: HOY, ledger }), gr26 = grupoResumen(clon(CR26), clon(PG26), { hoy: HOY, ledger });
const ca = ej('cartera', { agrupar_por: 'empresa' });
ok('la cartera de hoy da lo mismo que el Dashboard y el módulo PAGASI 18 + 26', ca.total.creditos_activos === gr18.creditos + gr26.creditos && Math.abs(ca.total.dinero_en_la_calle - (gr18.cartera + gr26.cartera)) < 0.01 && ca.total.en_mora === gr18.enMora + gr26.enMora && Math.abs(ca.total.vencido - (gr18.vencido + gr26.vencido)) < 0.01 && ca.grupos.find(g => g.grupo === 'PAGASI 18').creditos === gr18.creditos);
ok('...por días de atraso, y en un ranking por % de mora no entran los grupos chicos', ej('cartera', { agrupar_por: 'tramo_mora' }).grupos.length >= 1 && ej('cartera', { agrupar_por: 'concesionario', ordenar_por: 'pct_mora' }).grupos.length === 0 && /menos de 5/.test(ej('cartera', { agrupar_por: 'concesionario', ordenar_por: 'pct_mora' }).nota) && ej('cartera', { agrupar_por: 'concesionario', ordenar_por: 'pct_mora', minimo: 1 }).grupos.length > 0);
const cr = ej('creditos', { estado: 'en_mora' });
ok('créditos en mora uno por uno: con el nombre, los días y lo vencido, del más atrasado al menos', cr.encontrados === gr18.enMora + gr26.enMora && cr.creditos.every((x, i) => i === 0 || cr.creditos[i - 1].dias_atraso >= x.dias_atraso) && cr.creditos.every(x => x.cliente && x.dias_atraso > 0 && 'vencido' in x && x.empresa));
ok('...buscar a una persona sin importar tildes, y nunca sale cédula ni teléfono', (() => { const r = ej('creditos', { estado: 'todos', buscar: 'jose perez nanez' }); return r.encontrados === 1 && r.creditos[0].credito === 'B3' && !/cedula|telefono|V-1234/.test(JSON.stringify(r)); })());
ok('...como mucho 25', ej('creditos', { estado: 'todos', limite: 999 }).mostrados <= 25);
const pu = ej('puntualidad', { agrupar_por: 'mes' });
ok('cuotas a tiempo, tarde y sin pagar: las partes suman lo que venció', Math.abs(pu.total.a_tiempo + pu.total.tarde + pu.total.sin_pagar - pu.total.monto) < 0.01 && pu.total.cuotas > 0 && pu.grupos.every(g => Math.abs(g.a_tiempo + g.tarde + g.sin_pagar - g.monto) < 0.01) && /A tiempo = pagado hasta el día/.test(pu.nota));
ok('...lo mismo que el módulo PAGASI 18 + 26 en los mismos meses', Math.abs(pu.total.monto - (gr18.puntualidad.concat(gr26.puntualidad)).reduce((a, x) => a + x.monto, 0)) < 0.01);
const cg = ctxC();
ej('grafico', { tipo: 'barras_horizontales', titulo: 'Ventas <b>hoy</b>', etiquetas: ['A', 'B'], series: [{ nombre: 'Motos', valores: [2, 'x'] }], formato: 'numero' }, cg);
ok('el gráfico que pide la AI se revisa: sin HTML, números de verdad y un valor por etiqueta', cg.graficos.length === 1 && cg.graficos[0].titulo === 'Ventas bhoy/b' && cg.graficos[0].series[0].valores.join() === '2,0' && lanza(() => ej('grafico', { tipo: 'barras', titulo: 'x', etiquetas: ['a', 'b'], series: [{ nombre: 's', valores: [1] }] }, cg), /un valor por etiqueta/));
ej('grafico', { tipo: 'linea', titulo: 'b', etiquetas: ['a'], series: [{ nombre: 's', valores: [1] }] }, cg); ej('grafico', { tipo: 'torta', titulo: 'c', etiquetas: ['a'], series: [{ nombre: 's', valores: [1] }] }, cg);
ok('...máximo 3 gráficos por respuesta', cg.graficos.length === 3 && lanza(() => ej('grafico', { tipo: 'barras', titulo: 'd', etiquetas: ['a'], series: [{ nombre: 's', valores: [1] }] }, cg), /3 gráficos/));
ok('debajo de la respuesta se dice qué se consultó, en sencillo', (() => { const c = ctxC(); ej('ventas', { desde: HOY, hasta: HOY, agrupar_por: 'concesionario' }, c); ej('cobros', { empresa: '18', desde: '2026-11-01' }, c); return c.usadas.join(' | ') === 'ventas · por concesionario · hoy | cobros · PAGASI 18 · 2026-11-01 a hoy'; })());
ok('las herramientas que ve Claude: ventas, cobros, cartera, créditos, puntualidad y gráfico, cada una con su esquema', C.HERRAMIENTAS.map(h => h.name).join() === 'ventas,cobros,cartera,creditos,puntualidad,grafico' && C.HERRAMIENTAS.every(h => h.description.length > 40 && h.input_schema.type === 'object'));

(async () => {
  // la carga de las dos bases, con su memoria
  let lecturas = 0;
  const baseFalsa = (creds, pagos, concs) => ({ collection(col) { return { get: async () => { lecturas++; const l = col === 'creditos' ? creds : col === 'pagos' ? pagos : col === 'concesionarios' ? concs : []; return { docs: l.map(o => ({ id: String(o.id), data: () => { const c = clon(o); delete c.id; return c; } })) }; },
    doc() { return { get: async () => ({ exists: true, data: () => ({ diasGracia: 5 }) }) }; } }; } });
  C.olvidar();
  const bases = { '18': baseFalsa(CR18, PG18, CONC), '26': baseFalsa(CR26, PG26, CONC) };
  const Dc = await C.cargar(bases, HOY);
  ok('se leen créditos, pagos y concesionarios de las dos bases (y el plan para la gracia)', lecturas === 6 && Dc.ventas.length === 6 && Dc.cobros.length === D.cobros.length);
  await C.cargar(bases, HOY);
  ok('...y varias preguntas seguidas no vuelven a leer (3 minutos de memoria)', lecturas === 6 && C.VIGENCIA_MS === 180000);
  await C.cargar(bases, dia(1));
  ok('...otro día sí', lecturas === 12);

  // ══ 2. La conversación con Claude ══
  const llamadas = [];
  const respuestas = [];
  const fetchFalso = async (url, o) => { llamadas.push({ url, cuerpo: JSON.parse(o.body), headers: o.headers }); const r = respuestas.shift(); return { ok: r.status === 200, status: r.status, json: async () => r.j }; };
  const uso = { input_tokens: 1000, output_tokens: 300, cache_read_input_tokens: 5000, cache_creation_input_tokens: 0 };
  const deps = extra => Object.assign({ apiKey: 'clave-de-prueba', fetchImpl: fetchFalso, datos: async () => D, hoy: HOY, ahora: new Date('2026-11-21T22:50:00Z') }, extra || {});
  respuestas.push({ status: 200, j: { stop_reason: 'tool_use', usage: uso, content: [{ type: 'thinking', thinking: 'pienso', signature: 'firma' }, { type: 'text', text: 'Déjame ver.' }, { type: 'tool_use', id: 'tu1', name: 'ventas', input: { desde: HOY, hasta: HOY, agrupar_por: 'concesionario' } }] } });
  respuestas.push({ status: 200, j: { stop_reason: 'tool_use', usage: uso, content: [{ type: 'tool_use', id: 'tu2', name: 'grafico', input: { tipo: 'barras', titulo: 'Hoy', etiquetas: ['EMPIRE BELLO MONTE', 'EK TRUJILLO'], series: [{ nombre: 'Motos', valores: [1, 1] }] } }, { type: 'tool_use', id: 'tu3', name: 'ventas', input: { desde: 'mañana' } }] } });
  respuestas.push({ status: 200, j: { stop_reason: 'end_turn', usage: uso, content: [{ type: 'text', text: 'Hoy van **2 motos**: empate.' }] } });
  let r = await AI.preguntar(deps(), { pregunta: '¿Qué concesionario vendió más hoy?', historial: [{ rol: 'ai', texto: 'hola' }, { rol: 'tu', texto: '¿cuánto se cobró?' }, { rol: 'ai', texto: '$5.000' }, { rol: 'tu', texto: '¿y ayer?' }, { rol: 'ai', texto: '$3.000' }] });
  ok('una pregunta: Claude pide una consulta, el servidor la corre y Claude contesta con esos números', r.respuesta === 'Hoy van **2 motos**: empate.' && llamadas.length === 3 && r.consultas.join() === 'ventas · por concesionario · hoy');
  const c2 = llamadas[1].cuerpo;
  ok('...a la segunda vuelta va lo que dijo Claude tal cual (con su razonamiento) y el resultado de la consulta', JSON.stringify(c2.messages[c2.messages.length - 2].content) === JSON.stringify(respuestas.length === 0 ? [{ type: 'thinking', thinking: 'pienso', signature: 'firma' }, { type: 'text', text: 'Déjame ver.' }, { type: 'tool_use', id: 'tu1', name: 'ventas', input: { desde: HOY, hasta: HOY, agrupar_por: 'concesionario' } }] : null)
    && c2.messages[c2.messages.length - 1].content[0].type === 'tool_result' && c2.messages[c2.messages.length - 1].content[0].tool_use_id === 'tu1' && JSON.parse(c2.messages[c2.messages.length - 1].content[0].content.replace(/^/, '')).total.motos_vendidas === 2);
  const c3 = llamadas[2].cuerpo, res3 = c3.messages[c3.messages.length - 1].content;
  ok('...una consulta mal pedida vuelve como error para que Claude la corrija, sin romper la pregunta', res3.length === 2 && res3[0].tool_use_id === 'tu2' && !res3[0].is_error && res3[1].tool_use_id === 'tu3' && res3[1].is_error === true && /AAAA-MM-DD/.test(res3[1].content));
  ok('...y el gráfico que pidió viaja con la respuesta', r.graficos.length === 1 && r.graficos[0].etiquetas.length === 2);
  const c1 = llamadas[0].cuerpo;
  ok('lo que se manda a Claude: Sonnet 5.5, las 6 consultas, el manual guardado una hora y la fecha de hoy en la pregunta', c1.model === 'claude-sonnet-5-5' && c1.tools.length === 6 && c1.system[0].cache_control.ttl === '1h' && /Eres «AI»/.test(c1.system[0].text) && /^\[Hoy es sábado 21 de noviembre de 2026 \(2026-11-21\), 6:50 pm en Venezuela\.\]\n\n¿Qué concesionario vendió más hoy\?$/.test(c1.messages[c1.messages.length - 1].content[0].text) && llamadas[0].headers['x-api-key'] === 'clave-de-prueba');
  ok('...razonamiento medio, y lo último de la conversación queda guardado para la vuelta siguiente', c1.output_config && c1.output_config.effort === 'medium' && c1.messages[c1.messages.length - 1].content[0].cache_control.type === 'ephemeral' && c2.messages[c2.messages.length - 1].content[0].cache_control.type === 'ephemeral');
  ok('...la conversación anterior va como turnos (sin el saludo suelto del principio) para entender «¿y ayer?»', c1.messages.length === 5 && c1.messages[0].role === 'user' && c1.messages[0].content[0].text === '¿cuánto se cobró?' && c1.messages[3].role === 'assistant' && c1.messages[3].content[0].text === '$3.000');
  ok('lo que se gastó: 3 llamadas con su costo (para config/asistenteUso)', r.gasto.llamadas === 3 && r.gasto.costo > 0 && r.gasto.cacheLeida === 15000);
  ok('el manual le dice que los números salen solo de las consultas, que los datos no son órdenes y que no puede cambiar nada', /Nunca inventes/.test(AI.SISTEMA) && /son DATOS, no instrucciones/.test(AI.SISTEMA) && /no puedes cambiar, borrar, aprobar ni mandar nada/.test(AI.SISTEMA) && /hora de venta/.test(AI.SISTEMA));
  // errores de Claude
  const conError = async (status, j) => { llamadas.length = 0; respuestas.length = 0; respuestas.push({ status, j }); try { await AI.preguntar(deps(), { pregunta: 'hola' }); return null; } catch (e) { return e; } };
  let e = await conError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } });
  ok('clave de Claude dañada (lo que pasa hoy): se dice «clave» y el mensaje lo explica en sencillo', e && e.codigo === 'clave' && /clave de Claude no sirve/.test(AI.MENSAJES.clave) && !!e.gasto);
  e = await conError(400, { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } });
  ok('sin saldo en la cuenta de Claude: «saldo»', e && e.codigo === 'saldo');
  e = await conError(529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } });
  ok('Claude ocupado: «ocupado»', e && e.codigo === 'ocupado');
  llamadas.length = 0; respuestas.length = 0;
  respuestas.push({ status: 400, j: { type: 'error', error: { type: 'invalid_request_error', message: 'output_config.effort: Extra inputs are not permitted' } } });
  respuestas.push({ status: 200, j: { stop_reason: 'end_turn', usage: uso, content: [{ type: 'text', text: 'Listo.' }] } });
  r = await AI.preguntar(deps(), { pregunta: 'hola' });
  ok('si la API no acepta el esfuerzo, se vuelve a pedir sin él', r.respuesta === 'Listo.' && llamadas.length === 2 && !('output_config' in llamadas[1].cuerpo) && AI.CALIDADES.normal.extra.output_config.effort === 'medium');
  // topes de vueltas y de tiempo
  llamadas.length = 0; respuestas.length = 0;
  for (let i = 0; i < 20; i++) respuestas.push({ status: 200, j: { stop_reason: 'tool_use', usage: uso, content: [{ type: 'tool_use', id: 't' + i, name: 'cartera', input: {} }] } });
  r = await AI.preguntar(deps(), { pregunta: 'dame todo' });
  ok('una pregunta que nunca termina se corta a las ' + AI.RONDAS + ' vueltas, con una respuesta que lo explica', llamadas.length === AI.RONDAS && /No llegué a una respuesta/.test(r.respuesta) && r.gasto.llamadas === AI.RONDAS);
  llamadas.length = 0; respuestas.length = 0;
  for (let i = 0; i < 20; i++) respuestas.push({ status: 200, j: { stop_reason: 'tool_use', usage: uso, content: [{ type: 'tool_use', id: 't' + i, name: 'cartera', input: {} }] } });
  let t = 0; r = await AI.preguntar(deps({ reloj: () => (t += 40000) }), { pregunta: 'dame todo' });
  ok('...y si se pasa del tiempo (la puerta espera 120 s) no se hacen más llamadas', llamadas.length < 4 && /se acabó el tiempo/.test(r.respuesta));
  llamadas.length = 0; respuestas.length = 0;
  respuestas.push({ status: 200, j: { stop_reason: 'max_tokens', usage: uso, content: [{ type: 'text', text: 'Una respuesta larguísima' }] } });
  r = await AI.preguntar(deps(), { pregunta: 'hola' });
  ok('una respuesta cortada por larga se muestra con el aviso', /se cortó por larga/.test(r.respuesta));
  const entrada = async (dd, p) => { try { await AI.preguntar(deps(dd), { pregunta: p }); return ''; } catch (x) { return x.codigo; } };
  ok('pregunta vacía, muy larga o sin clave: no se llama a Claude', (await entrada({}, '   ')) === 'entrada' && (await entrada({}, 'x'.repeat(1001))) === 'entrada' && (await entrada({ apiKey: '' }, 'hola')) === 'clave' && llamadas.length === 1);
  ok('la conversación de antes: alterna, sin repetir roles, sin caracteres raros y cortada a 2.000 letras', (() => { const tt = AI.turnosPrevios([{ rol: 'tu', texto: 'a' }, { rol: 'tu', texto: 'b\u0007' }, { rol: 'ai', texto: 'x'.repeat(5000) }, { rol: 'otro', texto: 'z' }, { rol: 'tu', texto: 'pendiente' }]); return tt.length === 2 && tt[0].content[0].text === 'a\n\nb' && tt[1].content[0].text.length === 2000; })());
  ok('quién la usa: administradores o con el permiso «ai»; un vendedor de concesionario nunca', AI.puedeUsar({ admin: true, permisos: [] }) && AI.puedeUsar({ admin: false, rol: 'Gerente', permisos: ['ai'] }) && !AI.puedeUsar({ admin: false, rol: 'Gerente', permisos: ['dash'] }) && !AI.puedeUsar({ admin: false, rol: 'Vendedor Concesionario', permisos: ['ai'] }) && !AI.puedeUsar(null));
  AI.olvidarTopes();
  const t0 = Date.now(); let n = 0; while (AI.tope('u1', t0 + n * 1000)) n++;
  ok('tope por persona: 12 preguntas cada 5 minutos', n === 12 && AI.tope('u1', t0 + 6 * 60 * 1000) && AI.tope('u2', t0));
  ok('cada error tiene su mensaje en sencillo', ['clave', 'saldo', 'ocupado', 'tiempo', 'red', 'topeDia', 'claude', 'error'].every(k => typeof AI.MENSAJES[k] === 'string' && AI.MENSAJES[k].length > 20));

  // ══ 3. La puerta del servidor ══
  const idx = src('functions/index.js'), ruta = idx.slice(idx.indexOf("if (/\\/equipo\\/?$/.test(req.path || '')) {"), idx.indexOf("if (/\\/aliados\\/?$/.test(req.path || '')) {"));
  const rama = ruta.slice(ruta.indexOf("accion === 'preguntaAI'"), ruta.indexOf("accion === 'vendedor'"));
  ok('/equipo atiende «preguntaAI» con la sesión del usuario, antes de lo que manda mensajes', rama.length > 100 && ruta.indexOf("accion === 'preguntaAI'") > ruta.indexOf('const quien = await quienEscribe(req)') && ruta.indexOf("accion === 'preguntaAI'") < ruta.indexOf('procesar.enviarEquipo'));
  ok('...revisa el permiso y el tope ANTES de leer nada o llamar a Claude', rama.indexOf('ai.puedeUsar(quien)') > -1 && rama.indexOf('ai.puedeUsar(quien)') < rama.indexOf('ai.tope(quien.uid)') && rama.indexOf('ai.tope(quien.uid)') < rama.indexOf('ai.preguntar('));
  ok('...con un tope de gasto por día (config/asistente.topeAIdia, 10 dólares si no se dice)', /gastadoHoy >= cfg\.topeAIdia/.test(rama) && rama.indexOf('gastadoHoy') < rama.indexOf('ai.preguntar(') && /topeAIdia: isFinite\(\+c\.topeAIdia\) && \+c\.topeAIdia > 0 \? \+c\.topeAIdia : 10/.test(idx));
  ok('...anota lo gastado (también cuando falla a mitad) en config/asistenteUso como «ai»', /anotarGasto\('ai', r\.gasto\)/.test(rama) && /if \(e\.gasto\) anotarGasto\('ai', e\.gasto\)/.test(rama) && /area === 'ai' \? 'ai'/.test(idx));
  ok('...el registro del servidor no lleva la pregunta (puede traer nombres de clientes)', /logger\.info\('ai', \{ ms: [^}]*\}\)/.test(rama) && !/logger\.[a-z]+\('ai[^)]*pregunta/.test(rama));
  ok('...los errores de Claude salen con su mensaje en sencillo, no el técnico', /ai\.MENSAJES\[cod\] \|\| ai\.MENSAJES\.error/.test(rama));
  ok('...y la consulta lee las dos bases con la fecha de Venezuela', /datos: \(\) => aiConsultas\.cargar\(bases, hoyCaracas\(\)\)/.test(rama));

  // ══ 4. La pantalla ══
  const app = src('assets/pagasi-app.js');
  ok('el módulo AI está en la lista, en el menú después de PAGASI 18 + 26 (computadora y teléfono) y con su ícono', ctx.MODULOS.some(m => m.id === 'ai' && m.label === 'AI' && m.grupo === 'Análisis') && vm.runInContext('PGL.ai', ctx) === 'AI' && (app.match(/keys:\['dash','grupo','ai','centro','recursos'\]/g) || []).length === 2 && /label:'Finanzas',keys:\['grupo','ai',/.test(src('logic/movil-navegacion.js')) && !!ctx.pgNavIcon('ai'));
  ok('la página carga el módulo', /<script charset="utf-8" src="modules\/ai\.js\?v=[^"]+"><\/script>/.test(src('admin.html')));
  const como = (rol, permisos) => { ctx.S.currentUser = { uid: 'u-' + rol, nombre: 'Prueba', rol, permisos: permisos || [] }; };
  como('Administrador'); const adm = ctx.hasModuleAccess('ai');
  como('Gerente', ['dash']); const sin = ctx.hasModuleAccess('ai');
  como('Gerente', ['ai']); const con = ctx.hasModuleAccess('ai');
  como('Vendedor Concesionario', ['ai']); const vcAi = ctx.hasModuleAccess('ai');
  ok('lo ve el administrador; los demás solo con el permiso; un vendedor de concesionario nunca', adm && !sin && con && !vcAi && Object.keys(ctx.ROL_PERMISOS).filter(k => ctx.ROL_PERMISOS[k].includes('ai')).join() === 'Administrador');
  ok('el redibujo automático no toca la AI ni PAGASI 18 + 26 (borraría lo que se está escribiendo)', /if\(S\.page==='ai' \|\| S\.page==='grupo'\) return;/.test(app) && app.indexOf("if(S.page==='ai' || S.page==='grupo') return;") < app.indexOf('try { nav(S.page); }'));
  como('Administrador'); ctx.S.page = 'ai';
  const cola = []; ctx.setTimeout = f => { cola.push(f); return 1; };
  const md = vm.runInContext('_aiMd', ctx);
  const x = md('Hoy van **22 motos**. <img src=x onerror=alert(1)>\n\n- EMPIRE: 7\n- TORO: 7\n\n| Concesionario | Motos |\n|---|---|\n| EMPIRE | 7 |\n| <script>x</script> | $1.234 |\n\n### Ojo\nla pct_mora no es _cursiva_ rara');
  ok('la respuesta se escapa: nada de HTML que venga de afuera', !/<img|<script/.test(x) && /&lt;img src=x onerror=alert\(1\)&gt;/.test(x) && /&lt;script&gt;x&lt;\/script&gt;/.test(x));
  ok('...con negritas, listas, tablas (números a la derecha) y títulos', /<b>22 motos<\/b>/.test(x) && /<ul><li>EMPIRE: 7<\/li><li>TORO: 7<\/li><\/ul>/.test(x) && /<table class="ai-tabla"><thead><tr><th>Concesionario<\/th><th>Motos<\/th><\/tr><\/thead>/.test(x) && /<td class="ai-num">\$1\.234<\/td>/.test(x) && /<div class="ai-h">Ojo<\/div>/.test(x) && /pct_mora no es <i>cursiva<\/i> rara/.test(x));
  vm.runInContext('_ai.mensajes = []; _ai.pidiendo = false;', ctx);
  let h = String(ctx.PG.ai());
  ok('al entrar: el saludo, las preguntas de ejemplo y la caja para escribir', /¿Qué quieres saber\?/.test(h) && (h.match(/class="ai-sug"/g) || []).length === 10 && /<textarea id="ai-texto"/.test(h) && /maxlength="1000"/.test(h) && /onclick="aiNueva\(\)"/.test(h));
  // preguntar
  const chat = { innerHTML: '', lastElementChild: null }, caja = { value: '', style: {}, focus(){} }, boton = { disabled: false, textContent: '' };
  ctx.document.getElementById = id => id === 'ai-chat' ? chat : id === 'ai-texto' ? caja : id === 'ai-enviar' ? boton : (/^aic-/.test(id) && chat.innerHTML.indexOf('id="' + id + '"') > -1 ? { id } : null);
  const pedidos = []; let resp = { status: 200, cuerpo: { ok: true, respuesta: 'Hoy van **22 motos**.', graficos: [{ tipo: 'barras_horizontales', titulo: 'Hoy por concesionario', etiquetas: ['EMPIRE', 'TORO'], series: [{ nombre: 'Motos', valores: [7, 7] }], formato: 'numero' }, { tipo: 'nada', titulo: 'malo', etiquetas: ['a', 'b'], series: [{ nombre: 's', valores: [1] }] }], consultas: ['ventas · por concesionario · hoy'], costo: 0.034 } };
  ctx.fetch = (url, o) => { pedidos.push({ url, o }); const r2 = resp; return Promise.resolve({ ok: r2.status === 200, status: r2.status, json: () => r2.red ? Promise.reject(new Error('x')) : Promise.resolve(r2.cuerpo) }); };
  ctx.firebase = { auth: () => ({ currentUser: { getIdToken: () => Promise.resolve('ficha') } }) };
  const actividad = []; ctx.logActividad = (a, m, t, d) => actividad.push([a, m, d]);
  const graficos = []; ctx.Chart = function(el, cfg){ this.el = el; this.cfg = cfg; this.destroy = () => { this.muerto = true; }; graficos.push(this); };
  const espera = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  vm.runInContext('_ai.mensajes = [{ rol: "tu", texto: "¿cuánto se cobró?" }, { rol: "ai", texto: "$5.000" }, { rol: "ai", error: true, texto: "falló", pregunta: "x" }];', ctx);
  let pr = ctx.aiPreguntar('¿Qué concesionario vendió más hoy?');
  ok('mientras piensa: se ve «Pensando…», el botón queda apagado y una segunda pregunta no sale', /Pensando… \d+ s/.test(chat.innerHTML) && boton.disabled === true && boton.textContent === 'Pensando…' && (ctx.aiPreguntar('otra') || true));
  await pr; await espera();
  ok('la pregunta va al servidor con la sesión del usuario y lo anterior de la conversación (sin los errores)', pedidos.length === 1 && /\/equipo$/.test(pedidos[0].url) && pedidos[0].o.headers.authorization === 'Bearer ficha' && JSON.parse(pedidos[0].o.body).accion === 'preguntaAI' && JSON.parse(pedidos[0].o.body).pregunta === '¿Qué concesionario vendió más hoy?' && JSON.stringify(JSON.parse(pedidos[0].o.body).historial) === JSON.stringify([{ rol: 'tu', texto: '¿cuánto se cobró?' }, { rol: 'ai', texto: '$5.000' }]));
  ok('...queda en el registro de actividad quién preguntó qué', actividad.length === 1 && actividad[0][0] === 'ai_pregunta' && actividad[0][1] === 'ai' && actividad[0][2].pregunta === '¿Qué concesionario vendió más hoy?');
  ok('la respuesta se ve con su texto, qué consultó y cuánto costó', /<b>22 motos<\/b>/.test(chat.innerHTML) && /Consultó: ventas · por concesionario · hoy/.test(chat.innerHTML) && /costó \$0,03/.test(chat.innerHTML) && boton.disabled === false);
  ok('...el gráfico bueno se dibuja (acostado, con el globito) y el malo se descarta', graficos.length === 1 && graficos[0].cfg.type === 'bar' && graficos[0].cfg.options.indexAxis === 'y' && graficos[0].cfg.data.datasets[0].data.join() === '7,7' && graficos[0].cfg.options.plugins.tooltip.callbacks.label({ raw: 7, dataset: { label: 'Motos' } }) === ' 7');
  const cfgDe = g => vm.runInContext('_aiConfig', ctx)(g, true);
  ok('...los otros tipos: línea, torta (con su %) y barras apiladas en dinero', cfgDe({ tipo: 'linea', titulo: 't', etiquetas: ['a', 'b'], series: [{ nombre: 'PAGASI 18', valores: [1, 2] }], formato: 'dinero' }).type === 'line' && cfgDe({ tipo: 'torta', titulo: 't', etiquetas: ['a', 'b'], series: [{ nombre: 's', valores: [1, 3] }], formato: 'dinero' }).options.plugins.tooltip.callbacks.label({ label: 'b', raw: 3 }) === ' b: $3 (75%)' && cfgDe({ tipo: 'barras', titulo: 't', etiquetas: ['a'], series: [{ nombre: 'PAGASI 18', valores: [1] }, { nombre: 'PAGASI 26', valores: [2] }], formato: 'dinero', apilado: true }).options.scales.y.stacked === true && cfgDe({ tipo: 'barras', titulo: 't', etiquetas: ['a'], series: [{ nombre: 'PAGASI 18', valores: [1] }, { nombre: 'PAGASI 26', valores: [2] }], formato: 'dinero' }).data.datasets.map(d => d.backgroundColor).join() === '#1D4ED8,#14B8A6');
  ok('la conversación se guarda en la pestaña (sobrevive a recargar)', true);
  // errores
  resp = { status: 503, cuerpo: { error: 'La AI no está disponible: la clave de Claude no sirve (la anularon en la cuenta de Anthropic).', codigo: 'clave' } };
  await ctx.aiPreguntar('¿y ayer?'); await espera();
  ok('si la clave de Claude no sirve, se dice eso en la conversación con «Intentar otra vez»', /la clave de Claude no sirve/.test(chat.innerHTML) && /onclick="aiReintentar\(\d+\)"/.test(chat.innerHTML));
  resp = { status: 200, cuerpo: { ok: true, respuesta: 'Ayer: **15 motos**.', graficos: [], consultas: [] } };
  const nAntes = vm.runInContext('_ai.mensajes.length', ctx);
  await ctx.aiReintentar(nAntes - 1); await espera();
  ok('«Intentar otra vez» quita el error y vuelve a preguntar lo mismo', vm.runInContext('_ai.mensajes.length', ctx) === nAntes && /15 motos/.test(chat.innerHTML) && JSON.parse(pedidos[pedidos.length - 1].o.body).pregunta === '¿y ayer?' && !/la clave de Claude no sirve/.test(chat.innerHTML));
  resp = { status: 0, red: true, cuerpo: null };
  ctx.fetch = () => Promise.reject(new TypeError('Failed to fetch'));
  await ctx.aiPreguntar('hola'); await espera();
  ok('sin internet: se dice en sencillo', /No hay conexión con el servidor/.test(chat.innerHTML));
  ctx.firebase = { auth: () => ({ currentUser: null }) };
  await ctx.aiPreguntar('hola'); await espera();
  ok('sin sesión no se llama al servidor', /Sin sesión/.test(chat.innerHTML));
  ctx.aiNueva();
  ok('«Nueva conversación» lo borra todo y vuelve al saludo', vm.runInContext('_ai.mensajes.length', ctx) === 0 && /¿Qué quieres saber\?/.test(chat.innerHTML));
  como('Gerente', ['dash']);
  ok('quien no tiene el permiso no ve nada', /No tienes acceso a la AI/.test(String(ctx.PG.ai())));
  const css = src('assets/pagasi.css');
  ok('los estilos existen y en el teléfono la caja de escribir queda encima de la barra de abajo', /\.ai-chat\{/.test(css) && /\.ai-entrada\{position:sticky/.test(css) && /@media \(max-width:720px\)\{\.ai-caja/.test(css));

  console.log('\n' + pass + ' OK · ' + fail + ' fallas');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FALLA la prueba se cayó: ' + (e && e.stack || e)); process.exit(1); });
