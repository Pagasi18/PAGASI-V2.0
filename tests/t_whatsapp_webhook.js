// Cobranza por WhatsApp (18-oct-2026): el lado del servidor, con piezas falsas (sin red, sin Meta,
// sin Claude). Se prueba lo que llega de Meta, el briefing, la respuesta del cerebro, el flujo
// completo de un mensaje en las dos companias, los comprobantes, los estados, el equipo y los
// recordatorios.
const path = require('path');
const F = path.join(__dirname, '..', 'functions', 'lib');
const meta = require(path.join(F, 'meta.js')), briefing = require(path.join(F, 'briefing.js')), cerebro = require(path.join(F, 'cerebro.js')), procesar = require(path.join(F, 'procesar.js')), recordatorios = require(path.join(F, 'recordatorios.js'));
let pass = 0, fail = 0;
const ok = (l, v) => { if (v) { pass++; console.log('OK   ' + l); } else { fail++; console.log('FALLA ' + l); } };

// ── Un Firestore falso con lo que usa el servidor ──
function FakeDb(inicial) {
  const store = new Map();   // ruta completa -> datos
  Object.keys(inicial || {}).forEach(col => Object.keys(inicial[col]).forEach(id => store.set(col + '/' + id, Object.assign({}, inicial[col][id]))));
  let seq = 0;
  const cumple = (d, w) => w.every(([f, op, v]) => op === '==' ? d[f] === v : op === 'in' ? v.includes(d[f]) : true);
  function coleccion(ruta) {
    const q = (where, orden, lim) => ({
      where: (f, op, v) => q(where.concat([[f, op, v]]), orden, lim), orderBy: (f) => q(where, f, lim), limit: (n) => q(where, orden, n),
      async get() { let docs = [...store.entries()].filter(([k]) => k.startsWith(ruta + '/') && !k.slice(ruta.length + 1).includes('/')).map(([k, d]) => ({ id: k.slice(ruta.length + 1), data: () => d, exists: true })).filter(x => cumple(x.data(), where)); if (orden) docs.sort((a, b) => String(a.data()[orden]).localeCompare(String(b.data()[orden]))); if (lim) docs = docs.slice(-lim); return { docs, empty: !docs.length }; },
      doc: (id) => documento(ruta + '/' + (id || ('auto' + (++seq)))),
      async add(d) { const id = 'auto' + (++seq); store.set(ruta + '/' + id, Object.assign({}, d)); return { id }; }
    });
    return q([], null, 0);
  }
  function documento(ruta) {
    return { id: ruta.split('/').pop(), path: ruta,
      async get() { const d = store.get(ruta); return { exists: !!d, id: ruta.split('/').pop(), data: () => d }; },
      async set(d, o) { store.set(ruta, Object.assign({}, (o && o.merge && store.get(ruta)) || {}, d)); },
      async create(d) { if (store.has(ruta)) { const e = new Error('ya existe'); e.code = 6; throw e; } store.set(ruta, Object.assign({}, d)); },
      async update(d) { if (!store.has(ruta)) throw new Error('no existe'); store.set(ruta, Object.assign({}, store.get(ruta), d)); },
      collection: (sub) => coleccion(ruta + '/' + sub) };
  }
  return { collection: coleccion, _store: store, _lista: (pref) => [...store.entries()].filter(([k]) => k.startsWith(pref)).map(([k, d]) => Object.assign({ _ruta: k }, d)) };
}
const HOY = '2026-10-18', AHORA = '2026-10-18T14:00:00.000Z';
const iso = d => { const x = new Date(Date.UTC(2026, 9, 18)); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
function cred(id, clienteId, dias, extra) { return Object.assign({ id, clienteId, cli: 'MARÍA PÉREZ', marca: 'EK', modelo: 'XPRESS 150', placa: 'AB123CD', estado: 'activo', fecha: iso(-dias), cuotaQ: 50, cuota: 100, totalCuotas: 24, plazo: 12, total: 1200, fin: 1200, precio: 1800, ini: 600, frecuencia: 'quincenal' }, extra || {}); }
function armar() {
  const db26 = FakeDb({ indice_clientes: { '+584141234567': { clienteId: 'C26' } }, clientes: { C26: { id: 'C26', nombre: 'MARÍA JOSÉ PÉREZ', tel: '04141234567', telE164: '+584141234567' } }, creditos: { 'M-1': cred('M-1', 'C26', 20) }, pagos: { p1: { cred: 'M-1', monto: 50, fecha: iso(-6), estado: 'confirmado' } } });
  const db18 = FakeDb({ indice_clientes: { '+584241112233': { clienteId: 'C18' } }, clientes: { C18: { id: 'C18', nombre: 'JOSÉ ROJAS', telE164: '+584241112233' } }, creditos: { 'CRED-9': cred('CRED-9', 'C18', 40, { cli: 'JOSÉ ROJAS' }) }, pagos: {} });
  const enviados = [], plantillas = [], subidos = [];
  const metaFalso = { enviarTexto: async (a, t) => { enviados.push({ a, t }); return 'wamid.out' + enviados.length; }, enviarPlantilla: async (a, n, p) => { plantillas.push({ a, n, p }); return 'wamid.tpl' + plantillas.length; }, marcarLeido: async () => '', bajarMedio: async () => ({ bytes: Buffer.from('img'), mime: 'image/jpeg' }) };
  const cerebroFalso = { ultimo: null, respuesta: null, falla: false, async pensar(x) { this.ultimo = x; if (this.falla) throw new Error('sin cuota'); return this.respuesta || { reply: 'Hola María, vas al día.', draft: null, summary: 'Preguntó cuánto debe.', handoff: false, handoffReason: '' }; } };
  const deps = { bases: { '26': db26, '18': db18 }, storage: () => ({ subir: async (ruta, bytes, mime) => { subidos.push({ ruta, mime }); return 'https://st/' + ruta; } }), meta: metaFalso, cerebro: cerebroFalso, cfg: { instrucciones: 'Esta semana no se recibe efectivo.', datosPago: 'Pago Móvil 0414-000-0000 · Banco X · RIF J-00000000-0', empresaNombre: { '18': 'PAGASI 18', '26': 'PAGASI 26' } }, ahora: () => AHORA, hoy: () => HOY, log: () => {} };
  return { db26, db18, enviados, plantillas, subidos, metaFalso, cerebroFalso, deps };
}
const msgTexto = (de, texto, id) => ({ metaId: id || 'wamid.in' + Math.random().toString(36).slice(2), de, nombre: 'Perfil WA', tipo: 'texto', texto, medio: null, hora: AHORA });

(async () => {
  // ── 1. Lo que llega de Meta ──
  const aviso = { object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { metadata: { display_phone_number: '584222285526' }, contacts: [{ wa_id: '584141234567', profile: { name: 'María' } }],
    messages: [{ id: 'wamid.1', from: '584141234567', timestamp: '1760796000', type: 'text', text: { body: 'cuánto debo?' } }, { id: 'wamid.2', from: '584141234567', timestamp: '1760796001', type: 'image', image: { id: 'media9', mime_type: 'image/jpeg', caption: 'mi pago' } }],
    statuses: [{ id: 'wamid.out1', status: 'delivered', timestamp: '1760796002', recipient_id: '584141234567' }, { id: 'wamid.out2', status: 'failed', recipient_id: '584141234567', errors: [{ code: 131026, title: 'Message undeliverable' }] }] } }] }] };
  const p = meta.parsearWebhook(aviso);
  ok('del aviso salen 2 mensajes (texto e imagen) y 2 estados', p.mensajes.length === 2 && p.estados.length === 2 && p.objeto === 'whatsapp_business_account');
  ok('el texto trae id, número, nombre del perfil y hora', p.mensajes[0].metaId === 'wamid.1' && p.mensajes[0].de === '584141234567' && p.mensajes[0].nombre === 'María' && p.mensajes[0].texto === 'cuánto debo?' && /^2025|^2026/.test(p.mensajes[0].hora));
  ok('la imagen trae el medio y el pie', p.mensajes[1].tipo === 'imagen' && p.mensajes[1].medio.id === 'media9' && p.mensajes[1].texto === 'mi pago');
  ok('los estados se traducen (entregado / fallo con su error)', p.estados[0].estado === 'entregado' && p.estados[1].estado === 'fallo' && /131026/.test(p.estados[1].error));
  ok('un aviso que no es de WhatsApp no produce nada', meta.parsearWebhook({ object: 'instagram', entry: [] }).mensajes.length === 0);
  ok('la verificación responde el challenge solo con el token correcto', meta.verificacion({ 'hub.mode': 'subscribe', 'hub.verify_token': 'secreto', 'hub.challenge': '123' }, 'secreto') === '123' && meta.verificacion({ 'hub.mode': 'subscribe', 'hub.verify_token': 'otro', 'hub.challenge': '123' }, 'secreto') === null);
  const crypto = require('crypto'); const cuerpo = '{"a":1}'; const firma = 'sha256=' + crypto.createHmac('sha256', 'app-secret').update(cuerpo).digest('hex');
  ok('la firma X-Hub-Signature-256 se verifica, y sin el secreto real nada entra', meta.firmaValida(cuerpo, firma, 'app-secret') && !meta.firmaValida(cuerpo, 'sha256=mala', 'app-secret') && !meta.firmaValida(cuerpo, firma, '') && !meta.firmaValida(cuerpo, firma, 'pendiente'));

  // ── 2. El briefing ──
  const e = briefing.estadoCredito(cred('M-1', 'C26', 20), [{ cred: 'M-1', monto: 50, fecha: iso(-6), estado: 'confirmado' }], HOY);
  ok('el estado del crédito: 1 pagada de 24, la próxima es la 2 y vence hoy o pronto', e && e.pagadas === 1 && e.totalCuotas === 24 && e.proxima && e.proxima.numero === 2);
  const sis = briefing.armar({ empresa: 'PAGASI 26', cliente: { nombre: 'MARÍA JOSÉ PÉREZ' }, creditos: [e], instrucciones: 'Esta semana no se recibe efectivo.', datosPago: 'Pago Móvil 0414', hoy: HOY, nombrePerfil: 'María' });
  ok('el briefing lleva las reglas fijas, las instrucciones del equipo, cómo pagar y las cifras', /NUNCA inventes montos/.test(sis) && /no se recibe efectivo/.test(sis) && /Pago Móvil 0414/.test(sis) && /CRÉDITO M-1/.test(sis) && /1 de 24 cuotas pagadas/.test(sis) && /llámalo María/.test(sis));
  const sisDatos = briefing.armar({ empresa: 'PAGASI 26', cliente: { nombre: 'MARÍA JOSÉ PÉREZ', cedula: 'V-12345678', direccion: 'Calle 5, casa 12', tel: '04141234567', email: 'maria@x.com' }, creditos: [e], hoy: HOY });
  ok('el briefing no lleva la cédula, la dirección, el teléfono ni el correo del cliente', !/12345678|Calle 5|04141234567|maria@x/.test(sisDatos));
  ok('sin cliente, pide nombre y manda a una persona', /no está registrado como cliente/.test(briefing.armar({ cliente: null, creditos: [], hoy: HOY, nombrePerfil: 'Pepe' })));

  // ── 3. El cerebro: validación y turnos ──
  ok('una respuesta bien formada pasa y la promesa queda limpia', JSON.stringify(cerebro.validar({ reply: 'ok', draft: { tipo: 'promesa', fecha: '2026-10-24', monto: 50, nota: 'sábado' }, summary: 's', handoff: true, handoffReason: 'queja' })) === JSON.stringify({ reply: 'ok', draft: { tipo: 'promesa', fecha: '2026-10-24', monto: 50, nota: 'sábado' }, summary: 's', handoff: true, handoffReason: 'queja' }));
  ok('sin reply o con razón inventada se corrige o se descarta', cerebro.validar({ summary: 'x' }) === null && cerebro.validar({ reply: 'x', summary: '', handoff: true, handoffReason: 'zzz' }).handoffReason === 'otro' && cerebro.validar({ reply: 'x', draft: { tipo: 'promesa', fecha: 'mañana' }, summary: '', handoff: false }).draft === null);
  const t = cerebro.turnos([{ autor: 'asistente', texto: 'Hola' }, { autor: 'cliente', texto: 'cuánto debo' }, { autor: 'cliente', tipo: 'imagen' }, { autor: 'equipo', texto: 'Te ayudo yo' }]);
  ok('el historial se vuelve turnos user/assistant, empieza en user y termina en user', t[0].role === 'user' && t[t.length - 1].role === 'user' && t.some(x => /mandó una imagen/.test(x.content)) && t.some(x => /respuesta del equipo/.test(x.content)));

  // ── 4. El flujo completo ──
  let A = armar();
  let r = await procesar.procesarMensaje(A.deps, msgTexto('584141234567', 'cuánto debo?', 'wamid.a1'));
  ok('cliente de la 26 → la conversación se guarda en la 26 con su cliente y crédito', r.empresa === '26' && r.respondido && A.db26._store.get('conversaciones/wa:+584141234567').clienteId === 'C26' && A.db26._store.get('conversaciones/wa:+584141234567').cred === 'M-1');
  ok('...el cerebro recibió el briefing con sus cifras y el historial', /MARÍA JOSÉ PÉREZ/.test(A.cerebroFalso.ultimo.sistema) && /CRÉDITO M-1/.test(A.cerebroFalso.ultimo.sistema) && A.cerebroFalso.ultimo.mensajes.some(m => m.texto === 'cuánto debo?'));
  ok('...se le respondió por Meta y quedaron los dos mensajes (entrante y asistente) con su estado', A.enviados.length === 1 && A.enviados[0].a === '+584141234567' && A.db26._lista('conversaciones/wa:+584141234567/mensajes/').length === 2 && A.db26._store.get('conversaciones/wa:+584141234567/mensajes/wamid.out1').estado === 'enviado');
  r = await procesar.procesarMensaje(A.deps, msgTexto('584141234567', 'cuánto debo?', 'wamid.a1'));
  ok('el mismo id de Meta otra vez (reenvío) no se procesa ni se responde dos veces', r.saltado === 'repetido' && A.enviados.length === 1);
  r = await procesar.procesarMensaje(A.deps, msgTexto('584241112233', 'hola', 'wamid.b1'));
  ok('cliente de la 18 → la conversación va a la 18', r.empresa === '18' && A.db18._store.get('conversaciones/wa:+584241112233').clienteId === 'C18' && !A.db26._store.get('conversaciones/wa:+584241112233'));
  r = await procesar.procesarMensaje(A.deps, msgTexto('584160000000', 'quiero una moto', 'wamid.c1'));
  ok('un número que no es cliente → se guarda en la 26, sin cifras, y se marca para una persona', r.empresa === '26' && r.handoff && A.db26._store.get('conversaciones/wa:+584160000000').atencion === 'pide_persona' && !/CRÉDITO/.test(A.cerebroFalso.ultimo.sistema));
  // promesa y handoff del cerebro
  A.cerebroFalso.respuesta = { reply: 'Anotado para el sábado.', draft: { tipo: 'promesa', fecha: '2026-10-24', monto: 50 }, summary: 'Promete pagar el sábado.', handoff: false, handoffReason: '' };
  await procesar.procesarMensaje(A.deps, msgTexto('584141234567', 'pago el sábado', 'wamid.a2'));
  ok('la promesa del cerebro queda como borrador y el resumen en la conversación', A.db26._store.get('conversaciones/wa:+584141234567').borrador.fecha === '2026-10-24' && /sábado/.test(A.db26._store.get('conversaciones/wa:+584141234567').resumen));
  A.cerebroFalso.respuesta = { reply: 'Ya te paso con una persona.', draft: null, summary: 'Se queja del cobro.', handoff: true, handoffReason: 'queja' };
  await procesar.procesarMensaje(A.deps, msgTexto('584141234567', 'esto está mal cobrado', 'wamid.a3'));
  ok('la queja marca la conversación para una persona', A.db26._store.get('conversaciones/wa:+584141234567').atencion === 'queja');
  // modo humano: el asistente se calla
  await A.db26.collection('conversaciones').doc('wa:+584141234567').set({ modo: 'humano', atendidoPor: 'Samantha' }, { merge: true });
  const antes = A.enviados.length;
  r = await procesar.procesarMensaje(A.deps, msgTexto('584141234567', 'gracias', 'wamid.a4'));
  ok('con una persona atendiendo, el mensaje se guarda pero el asistente no responde', r.callado && A.enviados.length === antes && A.db26._store.get('conversaciones/wa:+584141234567/mensajes/wamid.a4').texto === 'gracias');
  // comprobante
  A = armar();
  r = await procesar.procesarMensaje(A.deps, { metaId: 'wamid.img', de: '584141234567', nombre: 'María', tipo: 'imagen', texto: '', medio: { id: 'media9', mime: 'image/jpeg' }, hora: AHORA });
  const comps = A.db26._lista('comprobantes/');
  ok('una imagen del cliente se sube a Storage, crea un comprobante pendiente y avisa al equipo', r.comprobante && A.subidos.length === 1 && comps.length === 1 && comps[0].estado === 'pendiente' && comps[0].origen === 'whatsapp' && comps[0].credId === 'M-1' && A.db26._store.get('conversaciones/wa:+584141234567').atencion === 'comprobante');
  ok('...y se le agradece sin pasar por el cerebro', A.enviados.length === 1 && /comprobante/.test(A.enviados[0].t) && A.cerebroFalso.ultimo === null);
  // cerebro caído
  A = armar(); A.cerebroFalso.falla = true;
  r = await procesar.procesarMensaje(A.deps, msgTexto('584141234567', 'hola', 'wamid.f1'));
  ok('si el cerebro falla, se manda una frase de cortesía y se marca error', r.cerebro === 'fallo' && A.enviados[0].t === procesar.CORTESIA && A.db26._store.get('conversaciones/wa:+584141234567').atencion === 'error');
  // estados
  A = armar();
  await procesar.procesarMensaje(A.deps, msgTexto('584141234567', 'hola', 'wamid.s1'));
  await procesar.procesarEstado(A.deps, { metaId: 'wamid.out1', estado: 'leido', para: '584141234567', error: '' });
  await procesar.procesarEstado(A.deps, { metaId: 'wamid.out1', estado: 'entregado', para: '584141234567', error: '' });
  ok('los estados de Meta actualizan el mensaje y no retroceden (leído no vuelve a entregado)', A.db26._store.get('conversaciones/wa:+584141234567/mensajes/wamid.out1').estado === 'leido');
  // el equipo escribe
  r = await procesar.enviarEquipo(A.deps, { empresa: '26', convId: 'wa:+584141234567', texto: 'Hola, soy Samantha', por: 'Samantha' });
  ok('el equipo escribe dentro de la ventana: se manda, se guarda y la conversación pasa a humano', r.metaId && A.db26._store.get('conversaciones/wa:+584141234567').modo === 'humano' && A.db26._store.get('conversaciones/wa:+584141234567').atendidoPor === 'Samantha');
  await A.db26.collection('conversaciones').doc('wa:+584141234567').set({ ultimoEntranteHora: '2026-10-16T10:00:00.000Z' }, { merge: true });
  let err = null; try { await procesar.enviarEquipo(A.deps, { empresa: '26', convId: 'wa:+584141234567', texto: 'otra', por: 'S' }); } catch (x) { err = x; }
  ok('fuera de la ventana de 24 h el equipo no puede escribir libre', err && err.codigo === 'ventana');

  // ── 5. Recordatorios ──
  A = armar();
  A.db26._store.set('creditos/M-2', cred('M-2', 'C26', 13, { cli: 'ANA LÓPEZ' }));            // la cuota 1 vence en 2 días
  A.db26._store.set('clientes/C26b', { id: 'C26b', nombre: 'ANA LÓPEZ', tel: '04149998877' }); A.db26._store.get('creditos/M-2').clienteId = 'C26b';
  let rr = await recordatorios.correr(A.deps, { hoy: HOY, plantillas: { proximas: 'cuota_proxima', hoy: 'cuota_hoy', gracia: 'cuota_gracia', atrasadas: 'cuota_atrasada' } });
  const r26 = rr.find(x => x.empresa === '26');
  ok('manda la plantilla a quien le toca hoy (cuota a 2 días) y la anota', r26.enviados >= 1 && A.plantillas.some(x => x.a === '+584149998877' && x.n === 'cuota_proxima') && A.db26._lista('recordatorios/').some(x => x.cred === 'M-2' && x.estado === 'enviado'));
  ok('...y queda como mensaje del asistente en una conversación nueva', A.db26._store.get('conversaciones/wa:+584149998877') && A.db26._lista('conversaciones/wa:+584149998877/mensajes/').some(m => m.tipo === 'plantilla'));
  const antesTpl = A.plantillas.length;
  rr = await recordatorios.correr(A.deps, { hoy: HOY, plantillas: { proximas: 'cuota_proxima' } });
  ok('la segunda corrida del mismo día no repite el envío', A.plantillas.length === antesTpl && rr.find(x => x.empresa === '26').repetidos >= 1);
  rr = await recordatorios.correr(armar().deps, { hoy: HOY, plantillas: {} });
  ok('sin plantillas aprobadas no se manda nada (se cuenta como sin plantilla)', rr.every(x => x.enviados === 0));

  console.log(''); console.log(pass + ' pruebas OK, ' + fail + ' fallas'); if (fail) process.exitCode = 1;
})().catch(e => { console.log('FALLA ' + e.stack); process.exitCode = 1; });
