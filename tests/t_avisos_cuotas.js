// Avisos de cobranza (bot/avisos-cuotas.js): a quién se avisa, con el motor de
// cuotas real y las mismas reglas que la pantalla de Cobranza; el reparto por
// TIPO (Adam, 14-sep-2026): PREVENTIVA (vence hoy / en 3 días) → Samantha y
// CRÍTICA (en mora desde el día 1, una sola lista) → Jofanny; los teléfonos,
// los textos del WhatsApp y el troceo de Telegram. Fechas FIJAS: el cálculo
// recibe el "hoy" como dato.
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
  { id: 'C12', nombre: 'HUGO PRUEBA', tel: '04140000012' },
  { id: 'C13', nombre: 'IRIS PRUEBA', tel: '12' },            // inútil
];

// ── Teléfonos ──
ok('0414-123.45.67 → 584141234567', B.telWhatsapp('0414-123.45.67') === '584141234567');
ok('584241112233 se queda igual', B.telWhatsapp('584241112233') === '584241112233');
ok('muy corto → nulo', B.telWhatsapp('123') === null);
ok('vacío → nulo', B.telWhatsapp('') === null && B.telWhatsapp(null) === null);

// ── Quién trabaja cada tipo ──
ok('por defecto: preventiva Samantha, crítica Jofanny', B.duenas().preventiva === 'Samantha' && B.duenas().critica === 'Jofanny');
ok('se pueden cambiar los nombres', B.duenas({ preventiva: 'Ana', critica: 'Bea' }).preventiva === 'Ana' && B.duenas({ preventiva: 'Ana', critica: 'Bea' }).critica === 'Bea');
ok('vacío o lista vieja: los de siempre', B.duenas({ preventiva: ' ', critica: '' }).critica === 'Jofanny' && B.duenas(['X', 'Y']).preventiva === 'Samantha');

// ── Quién recibe aviso y de qué tipo ──
const creds = [
  conVencimiento('CRED-010', 'ANA PRUEBA', 'C1', 0),                        // vence hoy → preventiva
  conVencimiento('CRED-011', 'LUIS PRUEBA', 'C2', 3),                       // en 3 días → preventiva
  conVencimiento('CRED-012', 'MARIA PRUEBA', 'C3', 0),                      // hoy, sin teléfono → preventiva
  conVencimiento('CRED-013', 'PEDRO PRUEBA', 'C4', 1),                      // mañana: nada
  conVencimiento('CRED-015', 'JOSE PRUEBA', 'C5', -2, { estado: 'mora' }),  // 2 días en mora → crítica
  conVencimiento('CRED-017', 'RITA PRUEBA', 'C6', 3, { estado: 'completado' }),  // completado: nada
  conVencimiento('CRED-019', 'ANA PRUEBA', 'C1', 3, { eliminado: true }),   // eliminado: nada
  conVencimiento('CRED-002', 'ROSA PRUEBA', 'C7', -40, { eliminado: true }),// eliminado: nada
  conVencimiento('CRED-021', 'ROSA PRUEBA', 'C7', 3),                       // en 3 días → preventiva
  conVencimiento('CRED-022', 'CARLOS PRUEBA', 'C8', -40, { estado: 'mora' }),                 // 40 días → crítica (aviso urgente)
  conVencimiento('CRED-023', 'DIANA PRUEBA', 'C9', -10, { fechaCompromiso: '2026-09-20' }),   // acuerdo: fuera
  conVencimiento('CRED-025', 'ELENA PRUEBA', 'C10', -10, { cobranzaStatus: 'ilocalizable' }), // ilocalizable: fuera
  conVencimiento('CRED-027', 'FELIX PRUEBA', 'C11', 5, { mora: 3 }),                          // c.mora=3 sin cuota vencida → crítica
  // HUGO tiene dos motos: una en mora (6 días) y otra que vence en 3 días → todo con la de crítica
  conVencimiento('CRED-031', 'HUGO PRUEBA', 'C12', -6, { estado: 'mora' }),
  conVencimiento('CRED-033', 'HUGO PRUEBA', 'C12', 3),
  conVencimiento('CRED-035', 'IRIS PRUEBA', 'C13', -4, { estado: 'mora' }),                   // en mora sin teléfono → crítica
];
// LUIS abonó $20 a su próxima cuota: el aviso debe pedir los $30 que faltan
const pagos = [ { cred: 'CRED-011', monto: 20, fecha: HOY, estado: 'confirmado' } ];

const r = B.calcularAvisos(creds, pagos, clientes, HOY);
const todos = [...r.vencenHoy, ...r.vencenEn3, ...r.critica, ...r.sinTelefono];
const buscar = id => todos.find(a => a.cred === id);
ok('fechas: hoy y hoy+3', r.hoy === HOY && r.en3 === '2026-09-14');
ok('vence HOY: solo ANA', r.vencenHoy.length === 1 && r.vencenHoy[0].cred === 'CRED-010' && r.vencenHoy[0].hoyMismo === true);
ok('en 3 días: HUGO, LUIS y ROSA', r.vencenEn3.map(a => a.cred).join() === 'CRED-033,CRED-011,CRED-021');
ok('el aviso de LUIS pide lo que FALTA de la cuota ($30)', Math.abs(buscar('CRED-011').monto - 30) < 0.01);
ok('sin teléfono: IRIS (4 días en mora) y MARIA (vence hoy)', r.sinTelefono.map(a => a.cred).join() === 'CRED-035,CRED-012' && buscar('CRED-012').tipo === 'hoy' && buscar('CRED-035').dias === 4);
ok('mañana, completado y eliminado: fuera', !['CRED-013', 'CRED-017', 'CRED-019', 'CRED-002'].some(buscar));
ok('el teléfono queda listo para wa.me', r.vencenHoy[0].tel === '584141234567');

// ── Crítica: en mora desde el día 1, una sola lista (reglas de Cobranza) ──
ok('crítica: CARLOS 40, HUGO 6, FELIX 3, JOSE 2 (los de más días primero)', r.critica.map(a => a.cred).join() === 'CRED-022,CRED-031,CRED-027,CRED-015');
ok('desde el día 1: JOSE con 2 días ya está en crítica', buscar('CRED-015').dias === 2 && buscar('CRED-015').cobradora === 'Jofanny');
ok('JOSE debe la cuota vencida ($50)', Math.abs(buscar('CRED-015').monto - 50) < 0.01);
ok('FELIX: c.mora=3 cuenta como mora aunque su cuota no haya vencido', buscar('CRED-027').dias === 3 && buscar('CRED-027').tipo === 'atrasado');
ok('CARLOS: 40 días y $150 vencidos (3 cuotas), con aviso urgente', buscar('CRED-022').tipo === 'critico' && buscar('CRED-022').dias === 40 && Math.abs(buscar('CRED-022').monto - 150) < 0.01);
ok('se siguen entregando atrasados y críticos por separado', r.atrasados.length === 3 && r.criticos.length === 1);
ok('con acuerdo de pago: DIANA fuera', !buscar('CRED-023'));
ok('ilocalizable: ELENA fuera', !buscar('CRED-025'));
ok('uno en mora no sale también como recordatorio', ![...r.vencenHoy, ...r.vencenEn3].some(a => a.cred === 'CRED-015' || a.cred === 'CRED-027' || a.cred === 'CRED-031'));

// ── Reparto por tipo ──
ok('preventiva → Samantha (ANA, LUIS, ROSA, MARIA)', ['CRED-010', 'CRED-011', 'CRED-021', 'CRED-012'].every(id => buscar(id).cobradora === 'Samantha'));
ok('crítica → Jofanny (CARLOS, HUGO, FELIX, JOSE, IRIS)', ['CRED-022', 'CRED-031', 'CRED-027', 'CRED-015', 'CRED-035'].every(id => buscar(id).cobradora === 'Jofanny'));
ok('HUGO está en mora: su cuota que vence en 3 días también la lleva Jofanny', buscar('CRED-033').cobradora === 'Jofanny' && buscar('CRED-033').clienteEnMora === true);
ok('los demás recordatorios no quedan marcados como cliente en mora', !buscar('CRED-011').clienteEnMora && !buscar('CRED-012').clienteEnMora);
const rNombres = B.calcularAvisos(creds, pagos, clientes, HOY, { preventiva: 'Ana', critica: 'Bea' });
ok('con otros nombres, el reparto los usa', rNombres.vencenHoy[0].cobradora === 'Ana' && rNombres.critica[0].cobradora === 'Bea');

// ── El reparto anterior (par/impar por cliente) sigue disponible ──
const dueno = B.repartidor(creds, ['Jofanny', 'Samantha']);
ok('anterior: un cliente con dos créditos, siempre la misma', dueno({ id: 'CRED-019', clienteId: 'C1' }) === dueno({ id: 'CRED-010', clienteId: 'C1' }));
ok('anterior: sin clienteId se agrupa por nombre', B.repartidor([{ id: 'CRED-004', cli: 'Zoe' }, { id: 'CRED-007', cli: 'ZOE ' }], ['A', 'B'])({ id: 'CRED-007', cli: 'zoe' }) === 'A');

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
ok('+30 días: plantilla "Aviso urgente de mora" con las 72 horas', grave.indexOf('PAGASI — AVISO URGENTE DE MORA') === 0 && grave.includes('72 horas') && grave.includes('40 días de atraso') && grave.includes('$150,00'));

// ── Los mensajes de Telegram ──
const partes = B.armarMensajes(r);
const resumen = partes[0];
const dePrev = partes.filter(p => p.startsWith('<b>🟢 PREVENTIVA — SAMANTHA')).join('\n');
const deCrit = partes.filter(p => p.startsWith('<b>🔴 CRÍTICA — JOFANNY')).join('\n');
ok('resumen primero y luego solo partes de preventiva o de crítica (la crítica puede venir troceada)', partes.length >= 3 && !!dePrev && !!deCrit
  && partes.slice(1).every(p => p.startsWith('<b>🟢 PREVENTIVA — SAMANTHA') || p.startsWith('<b>🔴 CRÍTICA — JOFANNY')));
ok('resumen: título del día', resumen.startsWith('<b>📣 Cobranza del día — 11/09/2026</b>'));
ok('resumen: preventiva de Samantha con su total', resumen.includes('🟢 <b>PREVENTIVA</b> · Samantha: <b>4</b> avisos · $130')
  && resumen.includes('Vencen HOY: <b>1</b> · Vencen el 14/09/2026 (en 3 días): <b>2</b>'));
ok('resumen: crítica de Jofanny con lo vencido y los de +30', resumen.includes('🔴 <b>CRÍTICA</b> · Jofanny: <b>4</b> en mora · $300 vencido · 1 con +30 días'));
ok('resumen: la cuota de HUGO que también vence', resumen.includes('+ 1 cuota que también vence a clientes en mora'));
ok('resumen: sin teléfono y quién hace qué', resumen.includes('Sin teléfono útil: 2') && resumen.includes('Samantha trabaja la preventiva y Jofanny la crítica'));
ok('preventiva: título con sus avisos', dePrev.startsWith('<b>🟢 PREVENTIVA — SAMANTHA — 4 avisos</b>'));
ok('preventiva: ANA, LUIS, ROSA y MARIA; nadie en mora', ['ANA PRUEBA', 'LUIS PRUEBA', 'ROSA PRUEBA', 'MARIA PRUEBA'].every(n => dePrev.includes(n))
  && !['JOSE PRUEBA', 'CARLOS PRUEBA', 'FELIX PRUEBA', 'HUGO PRUEBA', 'IRIS PRUEBA'].some(n => dePrev.includes(n)));
ok('preventiva: secciones hoy y en 3 días', dePrev.includes('📅 VENCEN HOY (1)') && dePrev.includes('🗓 VENCEN EL 14/09/2026 (2)') && dePrev.includes('📲 Enviar aviso'));
ok('preventiva: MARIA sin teléfono al final', dePrev.includes('SIN TELÉFONO ÚTIL (1)') && dePrev.includes('MARIA PRUEBA — CRED-012 (vence HOY)'));
ok('crítica: título con sus avisos', deCrit.startsWith('<b>🔴 CRÍTICA — JOFANNY — 6 avisos</b>'));
ok('crítica: CARLOS, HUGO, FELIX, JOSE e IRIS; nadie de preventiva', ['CARLOS PRUEBA', 'HUGO PRUEBA', 'FELIX PRUEBA', 'JOSE PRUEBA', 'IRIS PRUEBA'].every(n => deCrit.includes(n))
  && !['ANA PRUEBA', 'LUIS PRUEBA', 'ROSA PRUEBA', 'MARIA PRUEBA'].some(n => deCrit.includes(n)));
ok('crítica: una sola lista desde el día 1, los de más días primero', deCrit.includes('EN MORA DESDE EL DÍA 1 (4)')
  && deCrit.indexOf('CARLOS PRUEBA') < deCrit.indexOf('HUGO PRUEBA — CRED-031') && deCrit.indexOf('HUGO PRUEBA — CRED-031') < deCrit.indexOf('FELIX PRUEBA') && deCrit.indexOf('FELIX PRUEBA') < deCrit.indexOf('JOSE PRUEBA'));
ok('crítica: +30 días con aviso urgente; los demás con cobro', deCrit.includes('CARLOS PRUEBA — CRED-022 · 40 días · $150') && deCrit.includes('🚨 Aviso urgente')
  && deCrit.includes('FELIX PRUEBA — CRED-027 · 3 días · $50') && deCrit.includes('📲 Enviar cobro'));
ok('crítica: la otra cuota de HUGO, en su lista', deCrit.includes('📅 TAMBIÉN LES VENCE (1)') && deCrit.includes('HUGO PRUEBA — CRED-033 · $50') && deCrit.includes('(14/09/2026)'));
ok('crítica: IRIS sin teléfono con sus días', deCrit.includes('SIN TELÉFONO ÚTIL (1)') && deCrit.includes('IRIS PRUEBA — CRED-035 (4 días de atraso)'));
ok('aviso de que la mora se repite a diario, solo en crítica', deCrit.includes('no hace falta escribirles a diario') && !dePrev.includes('escribirles a diario'));
ok('nadie con acuerdo ni ilocalizable en ninguna lista', !partes.join('\n').includes('DIANA PRUEBA') && !partes.join('\n').includes('ELENA PRUEBA'));
ok('cada aviso sale UNA sola vez (8 enlaces)', (partes.join('\n').match(/wa\.me\//g) || []).length === 8);
ok('cada cliente con su enlace de WhatsApp', dePrev.includes('https://wa.me/584141234567?text=') && dePrev.includes('https://wa.me/584241112233?text='));
ok('el enlace de mora lleva el texto de mora', deCrit.includes('https://wa.me/584140000005?text=' + encodeURIComponent('PAGASI — AVISO DE MORA')));
ok('instrucción para la cobradora', dePrev.includes('solo dale enviar') && deCrit.includes('solo dale enviar'));

// ── 200 avisos: cada una su tipo, troceado, sin perder a nadie ──
const muchosCreds = [], muchosCli = [];
for (let i = 0; i < 200; i++) {
  muchosCli.push({ id: 'M' + i, nombre: 'CLIENTE NUMERO ' + i, tel: '0414' + String(1000000 + i) });
  const tipo = i % 4;   // 0 y 1: vence hoy · 2: en 3 días · 3: en mora
  muchosCreds.push(conVencimiento('CRED-' + (1000 + i), 'CLIENTE NUMERO ' + i, 'M' + i, tipo < 2 ? 0 : tipo === 2 ? 3 : -2, tipo === 3 ? { estado: 'mora' } : {}));
}
const rGrande = B.calcularAvisos(muchosCreds, [], muchosCli, HOY);
ok('200 avisos: 150 preventiva para Samantha y 50 crítica para Jofanny',
  [...rGrande.vencenHoy, ...rGrande.vencenEn3].filter(a => a.cobradora === 'Samantha').length === 150 && rGrande.critica.filter(a => a.cobradora === 'Jofanny').length === 50);
const partesG = B.armarMensajes(rGrande);
ok('se trocea en varios mensajes', partesG.length > 3);
ok('ninguna parte pasa el límite de Telegram', partesG.every(p => p.length <= B.TELEGRAM_MAX));
ok('las partes de continuación dicen de quién son', partesG.some(p => p.startsWith('<b>🟢 PREVENTIVA — SAMANTHA (continúa)</b>')) && partesG.some(p => p.startsWith('<b>🔴 CRÍTICA — JOFANNY (continúa)</b>')));
ok('no se pierde ningún cliente al trocear', (partesG.join('\n').match(/wa\.me\//g) || []).length === 200);
const numeros = txt => (txt.match(/CLIENTE NUMERO (\d+)/g) || []).map(s => parseInt(s.split(' ').pop(), 10));
const partesPrev = partesG.filter(p => /^<b>🟢 PREVENTIVA — SAMANTHA/.test(p)).join('\n');
const partesCrit = partesG.filter(p => /^<b>🔴 CRÍTICA — JOFANNY/.test(p)).join('\n');
ok('en TODAS las partes de preventiva solo hay avisos preventivos', numeros(partesPrev).length === 150 && numeros(partesPrev).every(n => n % 4 !== 3));
ok('en TODAS las partes de crítica solo hay clientes en mora', numeros(partesCrit).length === 50 && numeros(partesCrit).every(n => n % 4 === 3));

// ── Día sin avisos ──
const rVacio = B.calcularAvisos([conVencimiento('CRED-030', 'ANA PRUEBA', 'C1', 7)], [], clientes, HOY);
const tgVacio = B.armarMensajes(rVacio);
ok('día tranquilo: resumen en cero y cada lista con "Ninguna"/"Ninguno"', tgVacio.length === 3
  && tgVacio[0].includes('Samantha: <b>0</b> avisos') && tgVacio[0].includes('Jofanny: <b>0</b> en mora')
  && tgVacio[1].includes('Ninguna 🎉') && tgVacio[2].includes('Ninguno 🎉') && !tgVacio[2].includes('escribirles a diario'));

console.log(''); console.log(pass + ' pruebas OK, ' + fail + ' fallas');
if (fail) process.exitCode = 1;
