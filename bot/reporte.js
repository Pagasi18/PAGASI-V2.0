'use strict';
/* ══════════════════════════════════════════════════════════════════════════
   REPORTES A PEDIDO — el motor detras de los botones del bot.
   El Worker de Telegram dispara el Action pasandole un MODO; este script arma
   el reporte pedido y lo manda a Telegram. Solo lectura de Firestore (WIF).

   Modos:
     cobranza      -> lo cobrado hoy, por metodo
     mora          -> deudores con nombre, dias, vencido y link de WhatsApp
     vencen        -> cuotas que vencen manana (para adelantarse)
     ventas        -> ventas del mes por concesionario + ranking de vendedores
     comprobantes  -> los que subieron los clientes, por revisar
     cliente       -> busqueda por cedula (ARG): saldo, proxima cuota, moto

   Variables (del Action):
     TELEGRAM_TOKEN, MODO, ARG (cedula para 'cliente'), CHAT (a quien responder)
   ══════════════════════════════════════════════════════════════════════════ */

const { Firestore } = require('@google-cloud/firestore');
const Ledger = require('../logic/credito-ledger.js');

const TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT  = process.env.CHAT || process.env.TELEGRAM_CHAT_ID || '8571975984';
const MODO  = (process.env.MODO || '').trim();
const ARG   = (process.env.ARG || '').trim();
const DIAS_GRACIA = 5;

if (!TOKEN) { console.error('Falta el secreto TELEGRAM_TOKEN.'); process.exit(1); }

const db = new Firestore({ projectId: 'pagasi-v2' });

const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });
const ancla = new Date(hoy + 'T12:00:00Z');
const manana = new Date(ancla.getTime() + 86400000).toISOString().slice(0, 10);
const mes = hoy.slice(0, 7);
const mesNombre = ancla.toLocaleDateString('es-VE', { month: 'long', timeZone: 'UTC' });

const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-VE');
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const digitos = s => String(s || '').replace(/\D/g, '');
const pagoOK = p => !p.eliminado && (p.estado || 'confirmado') === 'confirmado';
const esIni = p => p.esInicial === true || p.tipoOperacion === 'inicial_credito';
const fechaCorta = iso => {
  const p = String(iso || '').split('-'); if (p.length !== 3) return iso || '';
  return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
};
function waLink(tel) {
  let d = digitos(tel); if (!d) return '';
  if (d.startsWith('58')) { } else if (d.startsWith('0')) d = '58' + d.slice(1); else if (d.length === 10) d = '58' + d;
  return 'https://wa.me/' + d;
}
const waTag = tel => { const w = waLink(tel); return w ? ` <a href="${w}">📞</a>` : ''; };

async function tg(method, body) {
  return fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }).then(r => r.json());
}

/* Lee lo comun una sola vez */
async function cargar() {
  const [cS, pS, clS, coS] = await Promise.all([
    db.collection('creditos').get(),
    db.collection('pagos').get(),
    db.collection('clientes').get(),
    db.collection('concesionarios').get()
  ]);
  const creds = cS.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => !c.eliminado);
  const pagos = pS.docs.map(d => ({ id: d.id, ...d.data() })).filter(pagoOK);
  const clientes = clS.docs.map(d => ({ id: d.id, ...d.data() }));
  const concNom = {}; coS.docs.forEach(d => { concNom[d.id] = (d.data().nombre) || '—'; });
  const cliById = {}; clientes.forEach(c => { cliById[String(c.id)] = c; });
  const pagosByCred = {}; pagos.forEach(p => { (pagosByCred[p.cred] = pagosByCred[p.cred] || []).push(p); });
  const telDe = cred => {
    const cl = cliById[String(cred.clienteId)] || {};
    return cl.tel || cl.telefono || cl.wa || cred.tel || '';
  };
  return { creds, pagos, clientes, concNom, cliById, pagosByCred, telDe };
}

/* ── COBRANZA DE HOY ── */
function cobranza(D) {
  const hoyP = D.pagos.filter(p => p.fecha === hoy);
  const ini = hoyP.filter(esIni).reduce((a, p) => a + (Number(p.monto) || 0), 0);
  const cuo = hoyP.filter(p => !esIni(p)).reduce((a, p) => a + (Number(p.monto) || 0), 0);
  const porMetodo = {};
  hoyP.forEach(p => { const k = p.metodo || 'Otro'; porMetodo[k] = (porMetodo[k] || 0) + (Number(p.monto) || 0); });
  const L = [`<b>💰 Cobranza de hoy — ${fechaCorta(hoy)}</b>`, ''];
  L.push(`Total: <b>${money(ini + cuo)}</b> · ${hoyP.length} ${hoyP.length === 1 ? 'pago' : 'pagos'}`);
  L.push(`Iniciales ${money(ini)} · Cuotas ${money(cuo)}`);
  const met = Object.keys(porMetodo).sort((a, b) => porMetodo[b] - porMetodo[a])
    .map(k => `${esc(k)} ${money(porMetodo[k])}`).join(' · ');
  if (met) { L.push(''); L.push(met); }
  if (!hoyP.length) L.push('\nSin pagos registrados hoy todavía.');
  return L.join('\n');
}

/* ── MORA ── */
function mora(D) {
  const moraCreds = D.creds.filter(c => c.estado === 'mora');
  const filas = moraCreds.map(c => {
    let venc = 0;
    try {
      const est = Ledger.generarEstadoCredito(c, D.pagosByCred[c.id] || [], { today: hoy, diasGracia: DIAS_GRACIA });
      (est.cuotas || []).forEach(q => { if ((Number(q.saldo) || 0) > 0.01 && q.fechaVence <= hoy) venc += Number(q.saldo) || 0; });
    } catch (e) { }
    return { cli: c.cli, dias: Number(c.mora) || 0, venc, tel: D.telDe(c) };
  }).sort((a, b) => b.dias - a.dias);
  const total = filas.reduce((a, f) => a + f.venc, 0);
  const L = [`<b>⚠️ En mora — ${moraCreds.length} · ${money(total)} vencido</b>`, ''];
  filas.slice(0, 20).forEach((f, i) => {
    L.push(`${i + 1}. ${esc(f.cli)} — ${f.dias}d · ${money(f.venc)}${waTag(f.tel)}`);
  });
  if (!filas.length) L.push('🟢 Nadie en mora. Excelente.');
  return L.join('\n');
}

/* ── VENCEN MAÑANA ── */
function vencen(D) {
  const filas = [];
  D.creds.filter(c => c.estado === 'activo' || c.estado === 'mora').forEach(c => {
    try {
      const est = Ledger.generarEstadoCredito(c, D.pagosByCred[c.id] || [], { today: hoy, diasGracia: DIAS_GRACIA });
      (est.cuotas || []).forEach(q => {
        if (q.fechaVence === manana && (Number(q.saldo) || 0) > 0.01)
          filas.push({ cli: c.cli, monto: Number(q.saldo) || 0, tel: D.telDe(c) });
      });
    } catch (e) { }
  });
  const total = filas.reduce((a, f) => a + f.monto, 0);
  const L = [`<b>📅 Vencen mañana — ${filas.length} · ${money(total)}</b>`, ''];
  filas.sort((a, b) => b.monto - a.monto).slice(0, 25).forEach(f => {
    L.push(`• ${esc(f.cli)} — ${money(f.monto)}${waTag(f.tel)}`);
  });
  if (!filas.length) L.push('Sin cuotas venciendo mañana.');
  return L.join('\n');
}

/* ── VENTAS DEL MES ── */
function ventas(D) {
  const mesC = D.creds.filter(c => String(c.fecha || '').slice(0, 7) === mes && c.estado !== 'cancelado');
  const total = mesC.reduce((a, c) => a + (Number(c.precio) || 0), 0);
  const sede = {}, vend = {};
  mesC.forEach(c => {
    const s = (sede[c.concesionarioId] = sede[c.concesionarioId] || { n: 0, m: 0 }); s.n++; s.m += Number(c.precio) || 0;
    const k = c.creadoPor || c.vendedorNombre || '—';
    const v = (vend[k] = vend[k] || { n: 0, m: 0 }); v.n++; v.m += Number(c.precio) || 0;
  });
  const L = [`<b>🏍️ Ventas de ${esc(mesNombre)} — ${mesC.length} motos · ${money(total)}</b>`, ''];
  L.push('<b>Por concesionario:</b>');
  Object.keys(sede).sort((a, b) => sede[b].n - sede[a].n).forEach(id =>
    L.push(`${esc(D.concNom[id] || 'Sin sede')}: ${sede[id].n} · ${money(sede[id].m)}`));
  L.push('');
  L.push('<b>Vendedores:</b>');
  Object.keys(vend).sort((a, b) => vend[b].m - vend[a].m).slice(0, 8).forEach(k =>
    L.push(`${esc(k)}: ${vend[k].n} · ${money(vend[k].m)}`));
  if (!mesC.length) L.push('Sin ventas este mes todavía.');
  return L.join('\n');
}

/* ── COMPROBANTES POR REVISAR ── */
async function comprobantes(D) {
  const s = await db.collection('comprobantes').where('estado', '==', 'pendiente').get();
  const arr = s.docs.map(d => d.data())
    .sort((a, b) => String(a.creadoEn || '').localeCompare(String(b.creadoEn || '')));
  const L = [`<b>📸 Comprobantes por revisar — ${arr.length}</b>`, ''];
  arr.slice(0, 20).forEach(x => {
    L.push(`• ${esc(x.clienteNombre || x.clienteId || '—')} — ${money(x.monto)} · ${fechaCorta(String(x.creadoEn || '').slice(0, 10))}`);
  });
  if (!arr.length) L.push('🟢 No hay comprobantes pendientes.');
  else L.push('\nApruébalos en el panel de administración.');
  return L.join('\n');
}

/* ── BUSCAR CLIENTE POR CEDULA ── */
function cliente(D, arg) {
  const q = digitos(arg);
  if (!q) return 'Escribe una cédula para buscar. Ej: <code>20208377</code>';
  const cli = D.clientes.find(c => digitos(c.cedula) === q || digitos(c.cedulaNorm) === q)
    || D.clientes.find(c => digitos(c.cedula).indexOf(q) > -1 && q.length >= 6);
  if (!cli) return `No encontré ningún cliente con la cédula <b>${esc(arg)}</b>.`;

  const sus = D.creds.filter(c => String(c.clienteId) === String(cli.id) && c.estado !== 'cancelado');
  const tel = cli.tel || cli.telefono || cli.wa || '';
  const L = [`<b>🔍 ${esc(cli.nombre || '—')}</b>`, `CI ${esc(cli.cedula || '?')}${tel ? ' · ' + esc(tel) + waTag(tel) : ''}`];
  if (!sus.length) { L.push('\nSin créditos activos a su nombre.'); return L.join('\n'); }

  sus.forEach(c => {
    let saldo = 0, prox = null, dias = 0, pagadas = 0, tot = 0;
    try {
      const est = Ledger.generarEstadoCredito(c, D.pagosByCred[c.id] || [], { today: hoy, diasGracia: DIAS_GRACIA });
      saldo = est.saldoPendiente; pagadas = est.cuotasPagadas; tot = est.totalCuotas;
      prox = (est.cuotas || [])[est.cuotasPagadas] || null;
      (est.cuotas || []).forEach(q => { if ((Number(q.saldo) || 0) > 0.01 && q.fechaVence <= hoy) dias = Math.max(dias, 1); });
    } catch (e) { }
    const enMora = (Number(c.mora) || 0) > 0;
    L.push('');
    L.push(`<b>${esc(c.id)}</b> · ${esc([c.marca, c.modelo].filter(Boolean).join(' ') || c.modelo || 'Moto')}`);
    L.push(`Debe ${money(saldo)} · ${pagadas}/${tot} cuotas`);
    if (prox) L.push(`Próxima: ${money(prox.saldo)} el ${fechaCorta(prox.fechaVence)}`);
    L.push(enMora ? `⚠️ En mora (${Number(c.mora)} días)` : '🟢 Al día');
  });
  return L.join('\n');
}

async function main() {
  const D = await cargar();
  let m;
  if (MODO === 'cobranza') m = cobranza(D);
  else if (MODO === 'mora') m = mora(D);
  else if (MODO === 'vencen') m = vencen(D);
  else if (MODO === 'ventas') m = ventas(D);
  else if (MODO === 'comprobantes') m = await comprobantes(D);
  else if (MODO === 'cliente') m = cliente(D, ARG);
  else m = 'Modo no reconocido: ' + esc(MODO);

  const r = await tg('sendMessage', { chat_id: CHAT, text: m, parse_mode: 'HTML', disable_web_page_preview: true });
  if (!r.ok) { console.error('Telegram:', r); process.exit(1); }
  console.log('Reporte', MODO, 'enviado. message_id:', r.result && r.result.message_id);
}

main().catch(e => { console.error(e); process.exit(1); });
