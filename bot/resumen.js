'use strict';
/* ══════════════════════════════════════════════════════════════════════════
   RESUMEN DIARIO DE PAGASI POR TELEGRAM
   Corre en GitHub Actions todos los dias a las 6:00 PM hora Venezuela.
   Lee Firestore (solo lectura), arma el resumen del dia y lo manda a Telegram.
   NO modifica nada de la base de datos.

   Autenticacion con Google: SIN llave descargable. El paso
   google-github-actions/auth del workflow le prueba a Google la identidad de
   GitHub (Workload Identity Federation) y deja las credenciales en el entorno;
   firebase-admin las toma solo (ADC). Por eso aca no hay ningun JSON.

   Secreto que necesita (se configura en GitHub, no va en el codigo):
     - TELEGRAM_TOKEN     : el token del bot (@BotFather)
     - TELEGRAM_CHAT_ID   : opcional; si no esta, usa el chat por defecto de abajo
   ══════════════════════════════════════════════════════════════════════════ */

const admin = require('firebase-admin');

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT  = process.env.TELEGRAM_CHAT_ID || '8571975984';   // chat por defecto del dueno

if (!TOKEN) {
  console.error('Falta el secreto TELEGRAM_TOKEN.');
  process.exit(1);
}

admin.initializeApp({ projectId: 'pagasi-v2' });   // credenciales del entorno (WIF/ADC)
const db = admin.firestore();

// "Hoy" segun el reloj de Venezuela (el Action corre en UTC).
const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });         // 2026-07-27
const hoyLindo = new Date().toLocaleDateString('es-VE',
  { timeZone: 'America/Caracas', weekday: 'long', day: '2-digit', month: 'long' });

const money = n => '$' + (Math.round((Number(n) || 0) * 100) / 100)
  .toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const esInicial = p => p.esInicial === true || p.tipoOperacion === 'inicial_credito';

async function main() {
  const [credHoySnap, pagosHoySnap, moraSnap, clientesSnap] = await Promise.all([
    db.collection('creditos').where('fecha', '==', hoy).get(),
    db.collection('pagos').where('fecha', '==', hoy).get(),
    db.collection('creditos').where('estado', '==', 'mora').get(),
    db.collection('clientes').get()
  ]);

  const credHoy = credHoySnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(c => !c.eliminado && c.estado !== 'cancelado');
  const pagosHoy = pagosHoySnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(p => !p.eliminado && (p.estado || 'confirmado') === 'confirmado');

  // ── Ventas del dia ──
  const nVentas = credHoy.length;
  const montoVentas = credHoy.reduce((a, c) => a + (Number(c.precio) || 0), 0);

  // ── Iniciales y cuotas cobradas hoy ──
  const inis = pagosHoy.filter(esInicial);
  const cuotas = pagosHoy.filter(p => !esInicial(p));
  const montoIni = inis.reduce((a, p) => a + (Number(p.monto) || 0), 0);
  const montoCuotas = cuotas.reduce((a, p) => a + (Number(p.monto) || 0), 0);
  const entroHoy = montoIni + montoCuotas;

  // ── Snapshot de mora y clientes nuevos ──
  const enMora = moraSnap.size;
  const nNuevos = clientesSnap.docs.map(d => d.data())
    .filter(c => String(c.creado || '').slice(0, 10) === hoy).length;

  // ── Vigilante de integridad (solo lo que paso HOY) ──
  const sinMoto = credHoy.filter(c => c.motoId === null || c.motoId === undefined || c.motoId === '');
  const iniPorCred = {};
  inis.forEach(p => { iniPorCred[p.cred] = (iniPorCred[p.cred] || 0) + (Number(p.monto) || 0); });
  const iniExcede = credHoy
    .map(c => ({ id: c.id, cli: c.cli, plan: Number(c.ini) || 0, pagado: iniPorCred[c.id] || 0 }))
    .filter(x => x.pagado - x.plan > 1);

  // ── Armar el mensaje ──
  let m = `<b>🐴 Pagasi — Resumen del ${hoyLindo}</b>\n\n`;
  m += `🏍️ <b>Ventas:</b> ${nVentas} ${nVentas === 1 ? 'moto' : 'motos'}`;
  if (nVentas) m += ` · ${money(montoVentas)} en precio`;
  m += `\n`;
  m += `💵 <b>Iniciales cobradas:</b> ${money(montoIni)}\n`;
  m += `✅ <b>Cuotas cobradas:</b> ${cuotas.length} · ${money(montoCuotas)}\n`;
  m += `📥 <b>Entró hoy:</b> ${money(entroHoy)}\n`;
  m += `👤 <b>Clientes nuevos:</b> ${nNuevos}\n`;
  m += `⚠️ <b>En mora:</b> ${enMora} ${enMora === 1 ? 'crédito' : 'créditos'}\n\n`;

  const alertas = [];
  if (sinMoto.length) {
    alertas.push(`• ${sinMoto.length} venta(s) sin moto asignada: ${sinMoto.map(c => esc(c.id)).join(', ')}`);
  }
  iniExcede.forEach(x => {
    alertas.push(`• ${esc(x.id)} (${esc(x.cli)}): inicial cobrada ${money(x.pagado)} supera el plan ${money(x.plan)} — ¿inicial de otro cliente?`);
  });

  if (alertas.length) {
    m += `<b>🚨 Revisar hoy:</b>\n${alertas.join('\n')}`;
  } else {
    m += `🟢 <b>Integridad:</b> todo en orden.`;
  }

  // ── Enviar a Telegram ──
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text: m, parse_mode: 'HTML', disable_web_page_preview: true })
  });
  const body = await res.json();
  if (!body.ok) { console.error('Error de Telegram:', body); process.exit(1); }
  console.log('Resumen enviado. message_id:', body.result && body.result.message_id);
}

main().catch(e => { console.error(e); process.exit(1); });
