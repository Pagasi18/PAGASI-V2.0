'use strict';
/* ══════════════════════════════════════════════════════════════════════════
   AVISOS DE CUOTAS — la lista de cobranza del dia, lista para enviar

   Adam (11-sep-2026): "necesito avisarles a los clientes 3 dias antes de que
   se venza la cuota, y tambien el dia que se vence. Mas de mil cuotas al mes."

   Corre en GitHub Actions todas las mananas (7:46 am Venezuela). Lee Firestore
   (SOLO lectura), calcula con el MISMO motor de cuotas del admin quien tiene
   su proxima cuota venciendo HOY y quien EN 3 DIAS, y manda por Telegram la
   lista con un boton de WhatsApp por cliente: el mensaje ya va escrito con el
   texto de la plantilla "Recordatorio cuota" del sistema; el cobrador solo
   toca el enlace y le da enviar. No escribe nada en la base.

   - Solo se avisa la PROXIMA cuota sin pagar de cada credito. Los que ya
     estan atrasados no van aqui: esos son gestion de mora, otro flujo.
   - Los clientes sin telefono utilizable salen en su propia lista, para
     arreglar el dato.
   - El log de Actions es publico: aqui NUNCA se imprimen nombres, telefonos
     ni enlaces; solo cantidades e ids de credito.

   Secretos (en GitHub, no en el codigo):
     - TELEGRAM_TOKEN            : el token del bot (@BotFather)
     - TELEGRAM_CHAT_ID_AVISOS   : opcional; el chat/grupo que recibe la lista
                                   (p.ej. el grupo de cobranza). Si no esta,
                                   usa TELEGRAM_CHAT_ID y si tampoco, los
                                   chats por defecto del resumen diario.
   Con --dry calcula y reporta cantidades, sin mandar nada.
   ══════════════════════════════════════════════════════════════════════════ */

const Ledger = require('../logic/credito-ledger.js');

const DIAS_GRACIA = 5;
const DIAS_AVISO = 3;                 // el aviso anticipado: 3 dias antes
const TELEGRAM_MAX = 3500;            // margen bajo el limite real de 4096

/* ── Fechas ancladas a Venezuela (Actions corre en UTC) ── */
function fechasDe(hoyISO) {
  const ancla = new Date(hoyISO + 'T12:00:00Z');
  const en3 = new Date(ancla.getTime() + DIAS_AVISO * 86400000).toISOString().slice(0, 10);
  return { hoy: hoyISO, en3 };
}

function lindo(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return d + '/' + m + '/' + y;
}

/* ── Telefono: mismo criterio que el admin (wa.me/58 + numero sin el 0) ── */
function telWhatsapp(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('58')) d = d.slice(2);
  d = d.replace(/^0+/, '');
  if (d.length !== 10) return null;    // 4141234567
  return '58' + d;
}

/* ── El mensaje al cliente: la plantilla "Recordatorio cuota" del sistema ── */
function mensajeCliente(o) {
  const money = n => '$' + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace('.', ',');
  return [
    'Hola ' + o.nombre + ',',
    '',
    o.hoyMismo ? 'Tu cuota de la moto vence HOY:' : 'Te recordamos tu próxima cuota de la moto:',
    '• Monto: ' + money(o.monto),
    '• Fecha: ' + lindo(o.fechaVence),
    o.numero && o.totalCuotas ? '• Cuota N°: ' + o.numero + ' de ' + o.totalCuotas : '',
    '',
    'Escríbenos por aquí y la resolvemos rápido.',
    '',
    'PAGASI'
  ].filter(Boolean).join('\n');
}

/* ── Que avisos tocan hoy. Puro: recibe los datos, devuelve las listas. ── */
function calcularAvisos(creds, pagos, clientes, hoyISO) {
  const { hoy, en3 } = fechasDe(hoyISO);
  const pagosByCred = {};
  pagos.forEach(p => { (pagosByCred[p.cred] = pagosByCred[p.cred] || []).push(p); });
  const cliPorId = {}, cliPorNombre = {};
  clientes.forEach(c => {
    if (c && c.id != null) cliPorId[String(c.id)] = c;
    if (c && c.nombre) cliPorNombre[c.nombre] = c;
  });

  const vencenHoy = [], vencenEn3 = [], sinTelefono = [];
  creds.forEach(c => {
    if (!c || c.eliminado) return;
    if (c.estado !== 'activo' && c.estado !== 'mora') return;
    let est;
    try { est = Ledger.generarEstadoCredito(c, pagosByCred[c.id] || [], { today: hoy, diasGracia: DIAS_GRACIA }); }
    catch (e) { return; }
    // La proxima cuota sin pagar (la primera con saldo)
    const prox = (est.cuotas || []).find(q => (Number(q.saldo) || 0) > 0.01);
    if (!prox) return;
    if (prox.fechaVence < hoy) return;         // ya atrasado: eso es mora, no recordatorio
    if (prox.fechaVence !== hoy && prox.fechaVence !== en3) return;

    const cli = (c.clienteId != null && cliPorId[String(c.clienteId)]) || cliPorNombre[c.cli] || {};
    const hoyMismo = prox.fechaVence === hoy;
    const aviso = {
      cred: c.id,
      nombre: cli.nombre || c.cli || 'Cliente',
      tel: telWhatsapp(cli.tel),
      monto: Number(prox.saldo) || 0,          // lo que falta de esa cuota (respeta abonos)
      numero: prox.numero,
      totalCuotas: (est.cuotas || []).length,
      fechaVence: prox.fechaVence,
      hoyMismo
    };
    if (!aviso.tel) { sinTelefono.push(aviso); return; }
    (hoyMismo ? vencenHoy : vencenEn3).push(aviso);
  });

  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre);
  vencenHoy.sort(porNombre); vencenEn3.sort(porNombre); sinTelefono.sort(porNombre);
  return { hoy, en3, vencenHoy, vencenEn3, sinTelefono };
}

/* ── Los mensajes de Telegram (HTML), troceados bajo el limite ── */
function armarMensajes(r) {
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-VE');
  const linea = a => {
    const url = 'https://wa.me/' + a.tel + '?text=' + encodeURIComponent(mensajeCliente(a));
    return '• ' + esc(a.nombre) + ' — ' + esc(a.cred) + ' · ' + money(a.monto)
      + ' · <a href="' + url + '">📲 Enviar aviso</a>';
  };
  const bloques = [];
  const total = arr => arr.reduce((s, a) => s + a.monto, 0);

  bloques.push('<b>📣 Avisos de cuotas — ' + lindo(r.hoy) + '</b>');
  bloques.push('');
  bloques.push('<b>🔴 VENCEN HOY (' + r.vencenHoy.length + ' · ' + money(total(r.vencenHoy)) + ')</b>');
  if (r.vencenHoy.length) r.vencenHoy.forEach(a => bloques.push(linea(a)));
  else bloques.push('— Ninguna 🎉');
  bloques.push('');
  bloques.push('<b>🟡 VENCEN EN ' + DIAS_AVISO + ' DÍAS · ' + lindo(r.en3) + ' (' + r.vencenEn3.length + ' · ' + money(total(r.vencenEn3)) + ')</b>');
  if (r.vencenEn3.length) r.vencenEn3.forEach(a => bloques.push(linea(a)));
  else bloques.push('— Ninguna');
  if (r.sinTelefono.length) {
    bloques.push('');
    bloques.push('<b>⚠ SIN TELÉFONO ÚTIL (' + r.sinTelefono.length + ')</b> — corregir en Clientes:');
    r.sinTelefono.forEach(a => bloques.push('• ' + esc(a.nombre) + ' — ' + esc(a.cred) + (a.hoyMismo ? ' (vence HOY)' : '')));
  }
  bloques.push('');
  bloques.push('<i>Toca "Enviar aviso": WhatsApp se abre con el mensaje listo, solo dale enviar.</i>');

  // Trocear sin partir renglones
  const mensajes = [];
  let actual = '';
  bloques.forEach(b => {
    const cand = actual ? actual + '\n' + b : b;
    if (cand.length > TELEGRAM_MAX && actual) { mensajes.push(actual); actual = b; }
    else actual = cand;
  });
  if (actual) mensajes.push(actual);
  return mensajes;
}

async function enviarTelegram(token, chats, mensajes) {
  let algunoOk = false;
  for (const chat of chats) {
    for (const m of mensajes) {
      const res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text: m, parse_mode: 'HTML', disable_web_page_preview: true })
      });
      const body = await res.json();
      if (body.ok) algunoOk = true;
      else console.error('Telegram', chat + ':', body.description);
    }
    console.log('Chat', chat, ': ' + mensajes.length + ' mensaje(s)');
  }
  return algunoOk;
}

async function main() {
  const DRY = process.argv.includes('--dry');
  const TOKEN = process.env.TELEGRAM_TOKEN;
  const CHATS = (process.env.TELEGRAM_CHAT_ID_AVISOS || process.env.TELEGRAM_CHAT_ID || '8571975984,1280343056')
    .split(',').map(s => s.trim()).filter(Boolean);
  if (!DRY && !TOKEN) { console.error('Falta el secreto TELEGRAM_TOKEN.'); process.exit(1); }

  const { Firestore } = require('@google-cloud/firestore');
  const db = new Firestore({ projectId: 'pagasi-v2' });
  const hoyISO = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

  const [credSnap, pagoSnap, cliSnap] = await Promise.all([
    db.collection('creditos').get(),
    db.collection('pagos').get(),
    db.collection('clientes').get(),
  ]);
  const creds = credSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const pagos = pagoSnap.docs.map(d => d.data()).filter(p => p && !p.eliminado && (p.estado || 'confirmado') === 'confirmado');
  const clientes = cliSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const r = calcularAvisos(creds, pagos, clientes, hoyISO);
  const mensajes = armarMensajes(r);

  // Log SIN datos personales (los logs de Actions son publicos)
  console.log('Base: ' + creds.length + ' creditos · ' + pagos.length + ' pagos · hoy ' + r.hoy + ' · aviso para ' + r.en3);
  console.log('  vencen HOY: ' + r.vencenHoy.length + '  (' + r.vencenHoy.map(a => a.cred).join(', ') + ')');
  console.log('  vencen en ' + DIAS_AVISO + ' dias: ' + r.vencenEn3.length + '  (' + r.vencenEn3.map(a => a.cred).join(', ') + ')');
  console.log('  sin telefono util: ' + r.sinTelefono.length + '  (' + r.sinTelefono.map(a => a.cred).join(', ') + ')');
  console.log('  mensajes de Telegram: ' + mensajes.length);

  if (DRY) { console.log('\n(dry-run) no se envio nada'); console.log('RESULTADO dry=1 hoy=' + r.vencenHoy.length + ' en3=' + r.vencenEn3.length + ' sintel=' + r.sinTelefono.length); return; }
  const ok = await enviarTelegram(TOKEN, CHATS, mensajes);
  console.log('RESULTADO dry=0 hoy=' + r.vencenHoy.length + ' en3=' + r.vencenEn3.length + ' sintel=' + r.sinTelefono.length + ' enviado=' + (ok ? 1 : 0));
  if (!ok) process.exit(1);
}

if (require.main === module) {
  main().catch(e => { console.error('ERROR', e.message); process.exit(1); });
}

module.exports = { calcularAvisos, armarMensajes, mensajeCliente, telWhatsapp, fechasDe, DIAS_AVISO, TELEGRAM_MAX };
