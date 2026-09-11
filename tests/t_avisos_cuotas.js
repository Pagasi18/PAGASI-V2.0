// Avisos de cuotas (bot/avisos-cuotas.js): a quién se avisa (vence hoy / en 3
// días, con el motor de cuotas real), teléfonos, el texto del WhatsApp, y el
// troceo de Telegram. Fechas FIJAS: el cálculo recibe el "hoy" como dato.
const path = require('path');
const B = require(path.join(__dirname, '..', 'bot', 'avisos-cuotas.js'));
let pass = 0, fail = 0;
const ok = (l, v) => { if (v) { pass++; console.log('OK   ' + l); } else { fail++; console.log('FALLA ' + l); } };

const HOY = '2026-09-11';
// Crédito con fecha tal que la próxima cuota venza en N días: fecha = hoy + N - 15*k
const conVencimiento = (id, cli, clienteId, diasHasta, extra) => {
  const f = new Date(HOY + 'T12:00:00Z'); f.setUTCDate(f.getUTCDate() + diasHasta - 15);
  return Object.assign({ id, cli, clienteId, estado: 'activo', fecha: f.toISOString().slice(0, 10),
    cuotaQ: 50, totalCuotas: 24, plazo: 12 }, extra || {});
};
const clientes = [
  { id: 'C1', nombre: 'ANA PRUEBA', tel: '0414-123.45.67' },
  { id: 'C2', nombre: 'LUIS PRUEBA', tel: '584241112233' },
  { id: 'C3', nombre: 'MARIA PRUEBA', tel: '123' },          // inútil
  { id: 'C4', nombre: 'PEDRO PRUEBA', tel: '04161234567' },
  { id: 'C5', nombre: 'JOSE PRUEBA', tel: '04140000005' },
  { id: 'C6', nombre: 'RITA PRUEBA', tel: '04140000006' },
];

// ── Teléfonos ──
ok('0414-123.45.67 → 584141234567', B.telWhatsapp('0414-123.45.67') === '584141234567');
ok('584241112233 se queda igual', B.telWhatsapp('584241112233') === '584241112233');
ok('muy corto → nulo', B.telWhatsapp('123') === null);
ok('vacío → nulo', B.telWhatsapp('') === null && B.telWhatsapp(null) === null);

// ── Quién recibe aviso ──
const creds = [
  conVencimiento('CRED-A', 'ANA PRUEBA', 'C1', 0),                     // vence hoy
  conVencimiento('CRED-B', 'LUIS PRUEBA', 'C2', 3),                    // en 3 días
  conVencimiento('CRED-C', 'MARIA PRUEBA', 'C3', 0),                   // hoy, sin teléfono útil
  conVencimiento('CRED-D', 'PEDRO PRUEBA', 'C4', 1),                   // mañana: nada
  conVencimiento('CRED-E', 'JOSE PRUEBA', 'C5', -2, { estado: 'mora' }),  // atrasado: mora, no aviso
  conVencimiento('CRED-F', 'RITA PRUEBA', 'C6', 3, { estado: 'completado' }),  // completado: nada
  conVencimiento('CRED-G', 'ANA PRUEBA', 'C1', 3, { eliminado: true }), // eliminado: nada
];
// LUIS abonó $20 a su próxima cuota: el aviso debe pedir los $30 que faltan
const pagos = [ { cred: 'CRED-B', monto: 20, fecha: HOY, estado: 'confirmado' } ];
// El abono de LUIS cubre parte de la PRIMERA cuota sin pagar; como su crédito
// no tiene pagos previos, esa primera cuota es la que vence en 3 días.

const r = B.calcularAvisos(creds, pagos, clientes, HOY);
ok('fechas: hoy y hoy+3', r.hoy === HOY && r.en3 === '2026-09-14');
ok('vence HOY: solo ANA', r.vencenHoy.length === 1 && r.vencenHoy[0].cred === 'CRED-A' && r.vencenHoy[0].hoyMismo === true);
ok('en 3 días: solo LUIS', r.vencenEn3.length === 1 && r.vencenEn3[0].cred === 'CRED-B');
ok('el aviso de LUIS pide lo que FALTA de la cuota ($30)', Math.abs(r.vencenEn3[0].monto - 30) < 0.01);
ok('sin teléfono: MARIA, marcada como vence hoy', r.sinTelefono.length === 1 && r.sinTelefono[0].cred === 'CRED-C' && r.sinTelefono[0].hoyMismo === true);
ok('mañana, mora, completado y eliminado: fuera', ![...r.vencenHoy, ...r.vencenEn3, ...r.sinTelefono].some(a => ['CRED-D','CRED-E','CRED-F','CRED-G'].includes(a.cred)));
ok('el teléfono queda listo para wa.me', r.vencenHoy[0].tel === '584141234567');

// ── El texto que le llega al cliente ──
const msg = B.mensajeCliente(r.vencenHoy[0]);
ok('saluda por su nombre', msg.indexOf('Hola ANA PRUEBA,') === 0);
ok('dice que vence HOY', msg.includes('vence HOY'));
ok('monto y fecha en formato local', msg.includes('• Monto: $50,00') && msg.includes('• Fecha: 11/09/2026'));
ok('número de cuota', /• Cuota N°: \d+ de 24/.test(msg));
ok('cierra como la plantilla del sistema', msg.includes('Escríbenos por aquí y la resolvemos rápido.') && msg.trim().endsWith('PAGASI'));
const msg3 = B.mensajeCliente(r.vencenEn3[0]);
ok('el de 3 días recuerda, no alarma', msg3.includes('Te recordamos tu próxima cuota') && !msg3.includes('HOY'));

// ── El mensaje de Telegram ──
const tg = B.armarMensajes(r).join('\n');
ok('encabezados con conteos', tg.includes('VENCEN HOY (1') && tg.includes('EN 3 DÍAS · 14/09/2026 (1'));
ok('cada cliente con su enlace de WhatsApp', tg.includes('https://wa.me/584141234567?text=') && tg.includes('https://wa.me/584241112233?text='));
ok('el texto del wa.me va codificado (sin saltos crudos)', /wa\.me\/58\d+\?text=[^"]*Hola%20/.test(tg) && !/wa\.me[^"]*\n/.test(tg.split('">')[0]));
ok('lista de sin teléfono para corregir', tg.includes('SIN TELÉFONO ÚTIL (1)') && tg.includes('MARIA PRUEBA') && tg.includes('(vence HOY)'));
ok('instrucción para el cobrador', tg.includes('solo dale enviar'));

// ── Troceo: 200 avisos no rompen el límite de Telegram ──
const muchosCreds = [], muchosCli = [];
for (let i = 0; i < 200; i++) {
  muchosCli.push({ id: 'M' + i, nombre: 'CLIENTE NUMERO ' + i, tel: '0414' + String(1000000 + i) });
  muchosCreds.push(conVencimiento('CRED-M' + i, 'CLIENTE NUMERO ' + i, 'M' + i, i % 2 === 0 ? 0 : 3));
}
const rGrande = B.calcularAvisos(muchosCreds, [], muchosCli, HOY);
const partes = B.armarMensajes(rGrande);
ok('200 avisos: se parte en varios mensajes', rGrande.vencenHoy.length === 100 && partes.length > 1);
ok('ninguna parte pasa el límite', partes.every(p => p.length <= B.TELEGRAM_MAX));
ok('no se pierde ningún cliente al trocear', (partes.join('\n').match(/wa\.me\//g) || []).length === 200);
ok('ningún renglón quedó partido', partes.every(p => !p.startsWith('·') && !p.startsWith('>')));

// ── Día sin avisos ──
const rVacio = B.calcularAvisos([conVencimiento('CRED-X', 'ANA PRUEBA', 'C1', 7)], [], clientes, HOY);
const tgVacio = B.armarMensajes(rVacio).join('\n');
ok('día tranquilo: "Ninguna 🎉" y sin sección de sin-teléfono', tgVacio.includes('Ninguna 🎉') && !tgVacio.includes('SIN TELÉFONO'));

console.log(''); console.log(pass + ' pruebas OK, ' + fail + ' fallas');
if (fail) process.exitCode = 1;
