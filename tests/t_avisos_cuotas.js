// Avisos de cobranza (bot/avisos-cuotas.js): a quién se avisa (vence hoy / en
// 3 días / atrasados / críticos, con el motor de cuotas real y las mismas
// reglas que la pantalla de Cobranza), el reparto FIJO entre cobradoras, los
// teléfonos, los textos del WhatsApp y el troceo de Telegram. Fechas FIJAS: el
// cálculo recibe el "hoy" como dato.
const path = require('path');
const B = require(path.join(__dirname, '..', 'bot', 'avisos-cuotas.js'));
let pass = 0, fail = 0;
const ok = (l, v) => { if (v) { pass++; console.log('OK   ' + l); } else { fail++; console.log('FALLA ' + l); } };

const HOY = '2026-09-11';
// Crédito con fecha tal que su primera cuota venza en N días (fecha = hoy + N - 15)
const conVencimiento = (id, cli, clienteId, diasHasta, extra) => {
  const f = new Date(HOY + 'T12:00:00Z'); f.setUTCDate(f.getUTCDate() + diasHasta - 15);
  return Object.assign({ id, cli, clienteId, estado: 'activo', fecha: f.toISOString().slice(0, 10),
    cuotaQ: 50, totalCuotas: 24, plazo: 12, modelo: 'GN 125' }, extra || {});
};
const clientes = [
  { id: 'C1', nombre: 'ANA PRUEBA', tel: '0414-123.45.67' },
  { id: 'C2', nombre: 'LUIS PRUEBA', tel: '584241112233' },
  { id: 'C3', nombre: 'MARIA PRUEBA', tel: '123' },          // inútil
  { id: 'C4', nombre: 'PEDRO PRUEBA', tel: '04161234567' },
  { id: 'C5', nombre: 'JOSE PRUEBA', tel: '04140000005' },
  { id: 'C6', nombre: 'RITA PRUEBA', tel: '04140000006' },
  { id: 'C7', nombre: 'ROSA PRUEBA', tel: '04140000007' },
  { id: 'C8', nombre: 'CARLOS PRUEBA', tel: '04140000008' },
  { id: 'C9', nombre: 'DIANA PRUEBA', tel: '04140000009' },
  { id: 'C10', nombre: 'ELENA PRUEBA', tel: '04140000010' },
  { id: 'C11', nombre: 'FELIX PRUEBA', tel: '04140000011' },
];

// ── Teléfonos ──
ok('0414-123.45.67 → 584141234567', B.telWhatsapp('0414-123.45.67') === '584141234567');
ok('584241112233 se queda igual', B.telWhatsapp('584241112233') === '584241112233');
ok('muy corto → nulo', B.telWhatsapp('123') === null);
ok('vacío → nulo', B.telWhatsapp('') === null && B.telWhatsapp(null) === null);

// ── Quién recibe aviso, de qué tipo y a qué cobradora le toca ──
ok('por defecto: Samantha y Jofanny', B.COBRADORAS_DEFECTO.join(',') === 'Samantha,Jofanny');
const creds = [
  conVencimiento('CRED-010', 'ANA PRUEBA', 'C1', 0),                        // hoy · 10 par → Samantha
  conVencimiento('CRED-011', 'LUIS PRUEBA', 'C2', 3),                       // 3 días · 11 impar → Jofanny
  conVencimiento('CRED-012', 'MARIA PRUEBA', 'C3', 0),                      // hoy, sin teléfono → Samantha
  conVencimiento('CRED-013', 'PEDRO PRUEBA', 'C4', 1),                      // mañana: nada
  conVencimiento('CRED-015', 'JOSE PRUEBA', 'C5', -2, { estado: 'mora' }),  // 2 días de atraso → Jofanny
  conVencimiento('CRED-017', 'RITA PRUEBA', 'C6', 3, { estado: 'completado' }),  // completado: nada
  conVencimiento('CRED-019', 'ANA PRUEBA', 'C1', 3, { eliminado: true }),   // eliminado: nada
  // ROSA: su PRIMER crédito (002, eliminado) es par → Samantha, aunque el que vence sea el 021 (impar)
  conVencimiento('CRED-002', 'ROSA PRUEBA', 'C7', -40, { eliminado: true }),
  conVencimiento('CRED-021', 'ROSA PRUEBA', 'C7', 3),
  conVencimiento('CRED-022', 'CARLOS PRUEBA', 'C8', -40, { estado: 'mora' }),                 // 40 días → crítico, Samantha
  conVencimiento('CRED-023', 'DIANA PRUEBA', 'C9', -10, { fechaCompromiso: '2026-09-20' }),   // acuerdo: fuera
  conVencimiento('CRED-025', 'ELENA PRUEBA', 'C10', -10, { cobranzaStatus: 'ilocalizable' }), // ilocalizable: fuera
  conVencimiento('CRED-027', 'FELIX PRUEBA', 'C11', 5, { mora: 3 }),                          // c.mora=3 sin cuota vencida → atrasado
];
// LUIS abonó $20 a su próxima cuota: el aviso debe pedir los $30 que faltan
const pagos = [ { cred: 'CRED-011', monto: 20, fecha: HOY, estado: 'confirmado' } ];

const r = B.calcularAvisos(creds, pagos, clientes, HOY);
const todos = [...r.vencenHoy, ...r.vencenEn3, ...r.atrasados, ...r.criticos, ...r.sinTelefono];
const buscar = id => todos.find(a => a.cred === id);
ok('fechas: hoy y hoy+3', r.hoy === HOY && r.en3 === '2026-09-14');
ok('vence HOY: solo ANA', r.vencenHoy.length === 1 && r.vencenHoy[0].cred === 'CRED-010' && r.vencenHoy[0].hoyMismo === true);
ok('en 3 días: LUIS y ROSA', r.vencenEn3.length === 2 && r.vencenEn3.map(a => a.cred).sort().join() === 'CRED-011,CRED-021');
ok('el aviso de LUIS pide lo que FALTA de la cuota ($30)', Math.abs(buscar('CRED-011').monto - 30) < 0.01);
ok('sin teléfono: MARIA, marcada como vence hoy', r.sinTelefono.length === 1 && r.sinTelefono[0].cred === 'CRED-012' && r.sinTelefono[0].tipo === 'hoy');
ok('mañana, completado y eliminado: fuera', !['CRED-013', 'CRED-017', 'CRED-019'].some(buscar));
ok('el teléfono queda listo para wa.me', r.vencenHoy[0].tel === '584141234567');

// ── Atrasados y críticos (reglas de Cobranza) ──
ok('atrasados: FELIX (3 días) y JOSE (2 días), el de más días primero', r.atrasados.map(a => a.cred).join() === 'CRED-027,CRED-015');
ok('JOSE: 2 días, debe la cuota vencida ($50)', buscar('CRED-015').dias === 2 && Math.abs(buscar('CRED-015').monto - 50) < 0.01);
ok('FELIX: c.mora=3 cuenta como atrasado aunque su cuota no haya vencido', buscar('CRED-027').dias === 3 && buscar('CRED-027').tipo === 'atrasado');
ok('crítico: CARLOS con 40 días y $150 vencidos (3 cuotas)', r.criticos.length === 1 && r.criticos[0].cred === 'CRED-022' && r.criticos[0].dias === 40 && Math.abs(r.criticos[0].monto - 150) < 0.01);
ok('con acuerdo de pago: DIANA fuera', !buscar('CRED-023'));
ok('ilocalizable: ELENA fuera', !buscar('CRED-025'));
ok('un atrasado no sale también como recordatorio', ![...r.vencenHoy, ...r.vencenEn3].some(a => a.cred === 'CRED-015' || a.cred === 'CRED-027'));

// ── Reparto ──
ok('ANA (primer crédito 010, par) → Samantha', buscar('CRED-010').cobradora === 'Samantha');
ok('LUIS (primer crédito 011, impar) → Jofanny', buscar('CRED-011').cobradora === 'Jofanny');
ok('MARIA sin teléfono también tiene dueña (012 → Samantha)', buscar('CRED-012').cobradora === 'Samantha');
ok('ROSA va con su PRIMER crédito (002, eliminado) → Samantha', buscar('CRED-021').cobradora === 'Samantha');
ok('atrasados y críticos también repartidos (015 → Jofanny, 022 → Samantha)', buscar('CRED-015').cobradora === 'Jofanny' && buscar('CRED-022').cobradora === 'Samantha');
const dueno = B.repartidor(creds, ['Samantha', 'Jofanny']);
ok('un cliente con dos créditos: siempre la misma cobradora', dueno({ id: 'CRED-019', clienteId: 'C1' }) === dueno({ id: 'CRED-010', clienteId: 'C1' }));
ok('sin clienteId: se agrupa por nombre', B.repartidor([{ id: 'CRED-004', cli: 'Zoe' }, { id: 'CRED-007', cli: 'ZOE ' }], ['A', 'B'])({ id: 'CRED-007', cli: 'zoe' }) === 'A');
ok('con 3 cobradoras reparte en tres (010 → la segunda)', B.repartidor(creds, ['A', 'B', 'C'])({ id: 'CRED-010', clienteId: 'C1' }) === 'B');

// ── Los textos que le llegan al cliente ──
const msg = B.mensajeCliente(r.vencenHoy[0]);
ok('recordatorio: saluda por su nombre', msg.indexOf('Hola ANA PRUEBA,') === 0);
ok('recordatorio: dice que vence HOY', msg.includes('vence HOY'));
ok('recordatorio: monto y fecha en formato local', msg.includes('• Monto: $50,00') && msg.includes('• Fecha: 11/09/2026'));
ok('recordatorio: número de cuota', /• Cuota N°: \d+ de 24/.test(msg));
ok('recordatorio: cierra como la plantilla del sistema', msg.includes('Escríbenos por aquí y la resolvemos rápido.') && msg.trim().endsWith('PAGASI'));
ok('el de 3 días recuerda, no alarma', B.mensajeCliente(buscar('CRED-011')).includes('Te recordamos tu próxima cuota') && !B.mensajeCliente(buscar('CRED-011')).includes('HOY'));
const mora = B.mensajeCliente(buscar('CRED-015'));
ok('mora: plantilla "Aviso de mora"', mora.indexOf('PAGASI — AVISO DE MORA') === 0 && mora.includes('Estimado/a JOSE PRUEBA:'));
ok('mora: días, cuota, vehículo y monto vencido', mora.includes('2 días de atraso') && mora.includes('cuota quincenal N° 1') && mora.includes('vehículo GN 125') && mora.includes('• Monto vencido: $50,00'));
const grave = B.mensajeCliente(buscar('CRED-022'));
ok('crítico: plantilla "Aviso urgente de mora" con las 72 horas', grave.indexOf('PAGASI — AVISO URGENTE DE MORA') === 0 && grave.includes('72 horas') && grave.includes('40 días de atraso') && grave.includes('$150,00'));

// ── Los mensajes de Telegram ──
const partes = B.armarMensajes(r);
const resumen = partes[0];
const deSamantha = partes.filter(p => p.startsWith('<b>👩‍💼 SAMANTHA')).join('\n');
const deJofanny = partes.filter(p => p.startsWith('<b>👩‍💼 JOFANNY')).join('\n');
ok('3 mensajes: resumen + Samantha + Jofanny', partes.length === 3 && !!deSamantha && !!deJofanny);
ok('resumen con totales del día', resumen.includes('Vencen HOY: <b>1</b>') && resumen.includes('Vencen el 14/09/2026 (en 3 días): <b>2</b>')
  && resumen.includes('Atrasados (1–30 días): <b>2</b> · $100 vencido') && resumen.includes('Críticos (+30 días): <b>1</b> · $150 vencido'));
ok('resumen con la carga de cada una', resumen.includes('<b>Samantha</b>: 1 hoy · 1 en 3 días · 0 atrasados · 1 crítico · 1 sin teléfono')
  && resumen.includes('<b>Jofanny</b>: 0 hoy · 1 en 3 días · 2 atrasados · 0 críticos'));
ok('la lista de Samantha tiene a ANA, ROSA, CARLOS y MARIA, no a LUIS ni JOSE', ['ANA PRUEBA', 'ROSA PRUEBA', 'CARLOS PRUEBA', 'MARIA PRUEBA'].every(n => deSamantha.includes(n)) && !deSamantha.includes('LUIS PRUEBA') && !deSamantha.includes('JOSE PRUEBA'));
ok('la lista de Jofanny tiene a LUIS, JOSE y FELIX, no a ANA ni CARLOS', ['LUIS PRUEBA', 'JOSE PRUEBA', 'FELIX PRUEBA'].every(n => deJofanny.includes(n)) && !deJofanny.includes('ANA PRUEBA') && !deJofanny.includes('CARLOS PRUEBA'));
ok('nadie con acuerdo ni ilocalizable en ninguna lista', !partes.join('\n').includes('DIANA PRUEBA') && !partes.join('\n').includes('ELENA PRUEBA'));
ok('Jofanny: sección de atrasados con días y botón de cobro', deJofanny.includes('⏰ ATRASADOS 1–30 DÍAS (2)') && deJofanny.includes('FELIX PRUEBA — CRED-027 · 3 días · $50') && deJofanny.includes('📲 Enviar cobro'));
ok('Samantha: sección de críticos con aviso urgente', deSamantha.includes('🚨 CRÍTICOS +30 DÍAS (1)') && deSamantha.includes('CARLOS PRUEBA — CRED-022 · 40 días · $150') && deSamantha.includes('🚨 Aviso urgente'));
ok('aviso de que los atrasados se repiten a diario', deJofanny.includes('no hace falta escribirles a diario'));
ok('Jofanny sin cuotas hoy: "Ninguna 🎉"; Samantha sin atrasados: "Ninguno 🎉"', deJofanny.includes('VENCEN HOY (0)') && deJofanny.includes('Ninguna 🎉') && deSamantha.includes('ATRASADOS 1–30 DÍAS (0)') && deSamantha.includes('Ninguno 🎉'));
ok('cada cliente aparece UNA sola vez en total', (partes.join('\n').match(/wa\.me\//g) || []).length === 6);
ok('cada cliente con su enlace de WhatsApp', deSamantha.includes('https://wa.me/584141234567?text=') && deJofanny.includes('https://wa.me/584241112233?text='));
ok('el enlace de mora lleva el texto de mora', deJofanny.includes('https://wa.me/584140000005?text=' + encodeURIComponent('PAGASI — AVISO DE MORA')));
ok('sin teléfono va en la lista de su dueña', deSamantha.includes('SIN TELÉFONO ÚTIL (1)') && deSamantha.includes('(vence HOY)') && !deJofanny.includes('SIN TELÉFONO'));
ok('instrucción para la cobradora', deSamantha.includes('solo dale enviar') && deJofanny.includes('solo dale enviar'));

// ── 200 avisos: parejo, troceado, sin perder a nadie ──
const muchosCreds = [], muchosCli = [];
for (let i = 0; i < 200; i++) {
  muchosCli.push({ id: 'M' + i, nombre: 'CLIENTE NUMERO ' + i, tel: '0414' + String(1000000 + i) });
  muchosCreds.push(conVencimiento('CRED-' + (1000 + i), 'CLIENTE NUMERO ' + i, 'M' + i, i % 4 < 2 ? 0 : 3));
}
const rGrande = B.calcularAvisos(muchosCreds, [], muchosCli, HOY);
const todosG = [...rGrande.vencenHoy, ...rGrande.vencenEn3];
ok('200 avisos: 100 para cada una (parejo)', todosG.filter(a => a.cobradora === 'Samantha').length === 100 && todosG.filter(a => a.cobradora === 'Jofanny').length === 100);
const partesG = B.armarMensajes(rGrande);
ok('se trocea en varios mensajes', partesG.length > 3);
ok('ninguna parte pasa el límite de Telegram', partesG.every(p => p.length <= B.TELEGRAM_MAX));
ok('las partes de continuación dicen de quién son', partesG.some(p => p.startsWith('<b>👩‍💼 SAMANTHA (continúa)</b>')) && partesG.some(p => p.startsWith('<b>👩‍💼 JOFANNY (continúa)</b>')));
ok('no se pierde ningún cliente al trocear', (partesG.join('\n').match(/wa\.me\//g) || []).length === 200);
const numeros = txt => (txt.match(/CLIENTE NUMERO (\d+)/g) || []).map(s => parseInt(s.split(' ').pop(), 10));
const partesSam = partesG.filter(p => /^<b>👩‍💼 SAMANTHA/.test(p)).join('\n');
const partesJof = partesG.filter(p => /^<b>👩‍💼 JOFANNY/.test(p)).join('\n');
ok('en TODAS las partes de Samantha solo hay clientes suyos', numeros(partesSam).length === 100 && numeros(partesSam).every(n => n % 2 === 0));
ok('en TODAS las partes de Jofanny solo hay clientes suyos', numeros(partesJof).length === 100 && numeros(partesJof).every(n => n % 2 === 1));

// ── Día sin avisos ──
const rVacio = B.calcularAvisos([conVencimiento('CRED-030', 'ANA PRUEBA', 'C1', 7)], [], clientes, HOY);
const tgVacio = B.armarMensajes(rVacio);
ok('día tranquilo: resumen en cero y cada una con "Ninguna"/"Ninguno"', tgVacio.length === 3 && tgVacio[0].includes('Vencen HOY: <b>0</b>') && tgVacio[0].includes('Atrasados (1–30 días): <b>0</b>')
  && tgVacio[1].includes('Ninguna 🎉') && tgVacio[1].includes('Ninguno 🎉') && !tgVacio[1].includes('escribirles a diario'));

console.log(''); console.log(pass + ' pruebas OK, ' + fail + ' fallas');
if (fail) process.exitCode = 1;
