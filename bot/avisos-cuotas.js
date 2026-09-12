'use strict';
/* ══════════════════════════════════════════════════════════════════════════
   AVISOS DE COBRANZA — la lista del dia, repartida y lista para enviar

   Adam (11-sep-2026): "necesito avisarles a los clientes 3 dias antes de que
   se venza la cuota, y tambien el dia que se vence. Mas de mil cuotas al mes."
   "Son 2 cobradoras, Samantha y Jofanny, reparte parejo." Y eligio incluir
   tambien a los ATRASADOS.

   Corre en GitHub Actions todas las mananas (7:46 am Venezuela). Lee Firestore
   (SOLO lectura) y, con el MISMO motor de cuotas del admin, arma para el grupo
   de Telegram "Cobranza Pagasi":
     1. un resumen con cuantos avisos le tocan a cada cobradora, y
     2. la lista de CADA cobradora, con un boton de WhatsApp por cliente (el
        mensaje ya va escrito; la cobradora solo toca el enlace y le da enviar):
          🔴 vence HOY          → plantilla "Recordatorio cuota"
          🟡 vence en 3 DIAS    → plantilla "Recordatorio cuota"
          ⏰ ATRASADOS 1-30 dias → plantilla "Aviso de mora"
          🚨 CRITICOS +30 dias   → plantilla "Aviso urgente de mora"
   No escribe nada en la base.

   Mismas reglas que la pantalla de Cobranza (modules/pagos.js):
   - Atrasado = la proxima cuota sin pagar ya vencio (lo que vence HOY no es
     mora) o el credito tiene c.mora > 0. Dias = el mayor de los dos.
   - Criticos = mas de 30 dias de atraso (su propia seccion).
   - Los que tienen ACUERDO de pago (fechaCompromiso) y los ILOCALIZABLES no
     van: cada uno tiene su propia gestion.

   Reparto: FIJO por cliente, para que dos cobradoras nunca le escriban al
   mismo cliente y el cliente hable siempre con la misma. La cobradora sale
   del numero del PRIMER credito del cliente (contando tambien los
   eliminados, para que no cambie nunca): con 2 cobradoras, par → la
   primera, impar → la segunda. Como los creditos se crean seguidos, la
   carga de cada dia queda pareja.

   - Clientes sin telefono utilizable: aparte, en la lista de su cobradora.
   - El log de Actions es publico: aqui NUNCA se imprimen nombres, telefonos
     ni enlaces; solo cantidades e ids de credito.

   Secretos / variables (en GitHub, no en el codigo):
     - TELEGRAM_TOKEN            : el token del bot (@BotFather)
     - TELEGRAM_CHAT_ID_AVISOS   : el grupo "Cobranza Pagasi". Si no esta, usa
                                   TELEGRAM_CHAT_ID y si tampoco, los chats por
                                   defecto del resumen diario.
     - COBRADORAS                : opcional, nombres separados por coma
                                   (por defecto "Samantha,Jofanny"). El orden
                                   importa: cambiarlo cambia a quien le toca.
   Con --dry calcula y reporta cantidades, sin mandar nada.
   ══════════════════════════════════════════════════════════════════════════ */

const Ledger = require('../logic/credito-ledger.js');

const DIAS_GRACIA = 5;
const DIAS_AVISO = 3;                 // el aviso anticipado: 3 dias antes
const DIAS_CRITICO = 30;              // mas de esto: seccion de criticos (como en Cobranza)
const TELEGRAM_MAX = 3500;            // margen bajo el limite real de 4096
const COBRADORAS_DEFECTO = ['Samantha', 'Jofanny'];

/* ── Fechas ancladas a Venezuela (Actions corre en UTC) ── */
function fechasDe(hoyISO) {
  const ancla = new Date(hoyISO + 'T12:00:00Z');
  const en3 = new Date(ancla.getTime() + DIAS_AVISO * 86400000).toISOString().slice(0, 10);
  return { hoy: hoyISO, en3 };
}
function diasEntre(desdeISO, hastaISO) {
  return Math.round((new Date(hastaISO + 'T12:00:00Z') - new Date(String(desdeISO).slice(0, 10) + 'T12:00:00Z')) / 86400000);
}
function lindo(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return d + '/' + m + '/' + y;
}
const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);

/* ── Telefono: mismo criterio que el admin (wa.me/58 + numero sin el 0) ── */
function telWhatsapp(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('58')) d = d.slice(2);
  d = d.replace(/^0+/, '');
  if (d.length !== 10) return null;    // 4141234567
  return '58' + d;
}

/* ── Los mensajes al cliente: las plantillas del sistema (logic/notificaciones.js) ── */
const dinero = n => '$' + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace('.', ',');

function mensajeRecordatorio(o) {        // plantilla "Recordatorio cuota"
  return [
    'Hola ' + o.nombre + ',',
    '',
    o.hoyMismo ? 'Tu cuota de la moto vence HOY:' : 'Te recordamos tu próxima cuota de la moto:',
    '• Monto: ' + dinero(o.monto),
    '• Fecha: ' + lindo(o.fechaVence),
    o.numero && o.totalCuotas ? '• Cuota N°: ' + o.numero + ' de ' + o.totalCuotas : '',
    '',
    'Escríbenos por aquí y la resolvemos rápido.',
    '',
    'PAGASI'
  ].filter(Boolean).join('\n');
}

function mensajeMora(o) {                // plantilla "Aviso de mora"
  return [
    'PAGASI — AVISO DE MORA',
    '',
    'Estimado/a ' + o.nombre + ':',
    '',
    'Le informamos que su cuenta presenta ' + plural(o.dias, 'día', 'días') + ' de atraso en el pago de la cuota quincenal N° '
      + o.numero + ' correspondiente a su vehículo' + (o.modelo ? ' ' + o.modelo : '') + '.',
    '',
    '• Crédito: ' + o.cred,
    '• Monto vencido: ' + dinero(o.monto),
    '• Días de atraso: ' + o.dias,
    '',
    'Le solicitamos respetuosamente que regularice su situación lo antes posible para evitar cargos adicionales y el inicio de un proceso de recuperación.',
    '',
    'Para realizar su pago o coordinar un acuerdo, comuníquese con nosotros a la brevedad.',
    '',
    'PAGASI'
  ].join('\n');
}

function mensajeMoraGrave(o) {           // plantilla "Aviso urgente de mora"
  return [
    'PAGASI — AVISO URGENTE DE MORA',
    '',
    'Estimado/a ' + o.nombre + ':',
    '',
    'Su cuenta N° ' + o.cred + ' registra ' + o.dias + ' días de atraso, lo cual representa una situación grave que requiere atención INMEDIATA.',
    '',
    '• Monto vencido: ' + dinero(o.monto),
    '• Días de atraso: ' + o.dias,
    '',
    'De no regularizarse esta situación en un plazo de 72 horas, nos veremos en la obligación de iniciar el proceso legal de recuperación del vehículo'
      + (o.modelo ? ' ' + o.modelo : '') + ' según los términos del contrato firmado.',
    '',
    'Le exhortamos a comunicarse con nosotros HOY MISMO para buscar una solución.',
    '',
    'PAGASI — Dpto. de Cobranza'
  ].join('\n');
}

function mensajeCliente(o) {
  if (o.tipo === 'critico') return mensajeMoraGrave(o);
  if (o.tipo === 'atrasado') return mensajeMora(o);
  return mensajeRecordatorio(o);
}

/* ── Reparto fijo por cliente ── */
function claveCliente(c) {
  if (c && c.clienteId != null && String(c.clienteId) !== '') return 'id:' + c.clienteId;
  return 'nom:' + String((c && c.cli) || '').trim().toUpperCase();
}
function numeroCredito(id) {
  const m = String(id || '').match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}
// Devuelve una funcion credito → cobradora. Usa TODOS los creditos (tambien
// eliminados y completados) para ubicar el primero de cada cliente.
function repartidor(creds, cobradoras) {
  const lista = (cobradoras && cobradoras.length) ? cobradoras : COBRADORAS_DEFECTO;
  const primero = {};
  (creds || []).forEach(c => {
    if (!c) return;
    const k = claveCliente(c), n = numeroCredito(c.id);
    if (!(k in primero) || n < primero[k]) primero[k] = n;
  });
  return c => lista[(primero[claveCliente(c)] || 0) % lista.length];
}

/* ── Que avisos tocan hoy. Puro: recibe los datos, devuelve las listas. ── */
function calcularAvisos(creds, pagos, clientes, hoyISO, cobradoras) {
  const lista = (cobradoras && cobradoras.length) ? cobradoras : COBRADORAS_DEFECTO;
  const { hoy, en3 } = fechasDe(hoyISO);
  const dueno = repartidor(creds, lista);
  const pagosByCred = {};
  pagos.forEach(p => { (pagosByCred[p.cred] = pagosByCred[p.cred] || []).push(p); });
  const cliPorId = {}, cliPorNombre = {};
  clientes.forEach(c => {
    if (c && c.id != null) cliPorId[String(c.id)] = c;
    if (c && c.nombre) cliPorNombre[c.nombre] = c;
  });

  const vencenHoy = [], vencenEn3 = [], atrasados = [], criticos = [], sinTelefono = [];
  creds.forEach(c => {
    if (!c || c.eliminado) return;
    if (c.estado !== 'activo' && c.estado !== 'mora') return;
    let est;
    try { est = Ledger.generarEstadoCredito(c, pagosByCred[c.id] || [], { today: hoy, diasGracia: DIAS_GRACIA }); }
    catch (e) { return; }
    const cuotas = est.cuotas || [];
    const prox = cuotas.find(q => (Number(q.saldo) || 0) > 0.01);   // la proxima cuota sin pagar
    if (!prox) return;

    const cli = (c.clienteId != null && cliPorId[String(c.clienteId)]) || cliPorNombre[c.cli] || {};
    const base = {
      cred: c.id,
      nombre: cli.nombre || c.cli || 'Cliente',
      tel: telWhatsapp(cli.tel),
      numero: prox.numero,
      totalCuotas: cuotas.length,
      fechaVence: prox.fechaVence,
      modelo: c.modelo || '',
      cobradora: dueno(c)
    };

    // ── ¿Atrasado? (misma definicion que Cobranza) ──
    const moraCampo = parseInt(c.mora, 10) || 0;
    const diasLedger = prox.fechaVence < hoy ? diasEntre(prox.fechaVence, hoy) : 0;
    if (diasLedger > 0 || moraCampo > 0) {
      if (c.fechaCompromiso) return;                                         // acuerdo de pago: su propia gestion
      if (String(c.cobranzaStatus || '') === 'ilocalizable') return;         // ilocalizable: su propia gestion
      const dias = Math.max(moraCampo, diasLedger);
      const vencido = cuotas.filter(q => q.fechaVence < hoy).reduce((s, q) => s + (Number(q.saldo) || 0), 0);
      const aviso = Object.assign(base, {
        tipo: dias > DIAS_CRITICO ? 'critico' : 'atrasado',
        dias,
        monto: vencido > 0.01 ? vencido : (Number(prox.saldo) || 0),
        hoyMismo: false
      });
      if (!aviso.tel) { sinTelefono.push(aviso); return; }
      (aviso.tipo === 'critico' ? criticos : atrasados).push(aviso);
      return;
    }

    // ── Recordatorio: vence hoy o en 3 dias ──
    if (prox.fechaVence !== hoy && prox.fechaVence !== en3) return;
    const hoyMismo = prox.fechaVence === hoy;
    const aviso = Object.assign(base, {
      tipo: hoyMismo ? 'hoy' : 'en3',
      dias: 0,
      monto: Number(prox.saldo) || 0,          // lo que falta de esa cuota (respeta abonos)
      hoyMismo
    });
    if (!aviso.tel) { sinTelefono.push(aviso); return; }
    (hoyMismo ? vencenHoy : vencenEn3).push(aviso);
  });

  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre);
  const porDias = (a, b) => (b.dias - a.dias) || porNombre(a, b);
  vencenHoy.sort(porNombre); vencenEn3.sort(porNombre); sinTelefono.sort(porNombre);
  atrasados.sort(porDias); criticos.sort(porDias);
  return { hoy, en3, cobradoras: lista, vencenHoy, vencenEn3, atrasados, criticos, sinTelefono };
}

/* ── Los mensajes de Telegram (HTML): resumen + una lista por cobradora ── */
function armarMensajes(r) {
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-VE');
  const total = arr => arr.reduce((s, a) => s + a.monto, 0);
  const cobradoras = (r.cobradoras && r.cobradoras.length) ? r.cobradoras : COBRADORAS_DEFECTO;
  const atrasados = r.atrasados || [], criticos = r.criticos || [];
  const de = (arr, nom) => arr.filter(a => a.cobradora === nom);
  const enlace = (a, texto) => '<a href="https://wa.me/' + a.tel + '?text=' + encodeURIComponent(mensajeCliente(a)) + '">' + texto + '</a>';
  const lineaAviso = a => '• ' + esc(a.nombre) + ' — ' + esc(a.cred) + ' · ' + money(a.monto) + ' · ' + enlace(a, '📲 Enviar aviso');
  const lineaMora = a => '• ' + esc(a.nombre) + ' — ' + esc(a.cred) + ' · ' + plural(a.dias, 'día', 'días') + ' · ' + money(a.monto)
    + ' · ' + enlace(a, a.tipo === 'critico' ? '🚨 Aviso urgente' : '📲 Enviar cobro');
  const etiquetaSinTel = a => a.tipo === 'hoy' ? ' (vence HOY)' : a.tipo === 'en3' ? ' (vence en ' + DIAS_AVISO + ' días)'
    : ' (' + plural(a.dias, 'día', 'días') + ' de atraso)';
  const mensajes = [];

  // 1) Resumen del dia
  const res = [];
  res.push('<b>📣 Cobranza del día — ' + lindo(r.hoy) + '</b>');
  res.push('🔴 Vencen HOY: <b>' + r.vencenHoy.length + '</b> · ' + money(total(r.vencenHoy)));
  res.push('🟡 Vencen el ' + lindo(r.en3) + ' (en ' + DIAS_AVISO + ' días): <b>' + r.vencenEn3.length + '</b> · ' + money(total(r.vencenEn3)));
  res.push('⏰ Atrasados (1–' + DIAS_CRITICO + ' días): <b>' + atrasados.length + '</b> · ' + money(total(atrasados)) + ' vencido');
  res.push('🚨 Críticos (+' + DIAS_CRITICO + ' días): <b>' + criticos.length + '</b> · ' + money(total(criticos)) + ' vencido');
  res.push('');
  cobradoras.forEach(nom => {
    const s = de(r.sinTelefono, nom).length;
    res.push('👩‍💼 <b>' + esc(nom) + '</b>: ' + de(r.vencenHoy, nom).length + ' hoy · ' + de(r.vencenEn3, nom).length + ' en ' + DIAS_AVISO + ' días · '
      + plural(de(atrasados, nom).length, 'atrasado', 'atrasados') + ' · ' + plural(de(criticos, nom).length, 'crítico', 'críticos')
      + (s ? ' · ' + s + ' sin teléfono' : ''));
  });
  res.push('');
  res.push('<i>Cada una trabaja SOLO su lista (abajo). A cada cliente le toca siempre la misma cobradora.</i>');
  mensajes.push(res.join('\n'));

  // 2) La lista de cada cobradora, troceada si hace falta
  cobradoras.forEach(nom => {
    const hoyL = de(r.vencenHoy, nom), en3L = de(r.vencenEn3, nom), atrL = de(atrasados, nom), criL = de(criticos, nom), sinL = de(r.sinTelefono, nom);
    const n = hoyL.length + en3L.length + atrL.length + criL.length + sinL.length;
    const cabeza = '<b>👩‍💼 ' + esc(String(nom).toUpperCase());
    const b = [cabeza + ' — ' + n + ' aviso' + (n === 1 ? '' : 's') + '</b>', ''];
    b.push('<b>🔴 VENCEN HOY (' + hoyL.length + ')</b>');
    if (hoyL.length) hoyL.forEach(a => b.push(lineaAviso(a))); else b.push('— Ninguna 🎉');
    b.push('');
    b.push('<b>🟡 VENCEN EL ' + lindo(r.en3) + ' (' + en3L.length + ')</b>');
    if (en3L.length) en3L.forEach(a => b.push(lineaAviso(a))); else b.push('— Ninguna');
    b.push('');
    b.push('<b>⏰ ATRASADOS 1–' + DIAS_CRITICO + ' DÍAS (' + atrL.length + ')</b>');
    if (atrL.length) atrL.forEach(a => b.push(lineaMora(a))); else b.push('— Ninguno 🎉');
    b.push('');
    b.push('<b>🚨 CRÍTICOS +' + DIAS_CRITICO + ' DÍAS (' + criL.length + ')</b>');
    if (criL.length) criL.forEach(a => b.push(lineaMora(a))); else b.push('— Ninguno');
    if (atrL.length || criL.length) b.push('<i>Los atrasados salen cada día hasta que paguen: no hace falta escribirles a diario.</i>');
    if (sinL.length) {
      b.push('');
      b.push('<b>⚠ SIN TELÉFONO ÚTIL (' + sinL.length + ')</b> — corregir en Clientes:');
      sinL.forEach(a => b.push('• ' + esc(a.nombre) + ' — ' + esc(a.cred) + etiquetaSinTel(a)));
    }
    b.push('');
    b.push('<i>Toca el enlace: WhatsApp se abre con el mensaje listo, solo dale enviar.</i>');

    let actual = '';
    b.forEach(x => {
      const cand = actual ? actual + '\n' + x : x;
      if (cand.length > TELEGRAM_MAX && actual) {
        mensajes.push(actual);
        actual = cabeza + ' (continúa)</b>\n' + x;
      } else actual = cand;
    });
    if (actual) mensajes.push(actual);
  });
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
  const COBRADORAS = (process.env.COBRADORAS || '').split(',').map(s => s.trim()).filter(Boolean);
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

  const r = calcularAvisos(creds, pagos, clientes, hoyISO, COBRADORAS);
  const mensajes = armarMensajes(r);

  // Log SIN datos personales (los logs de Actions son publicos): ni clientes ni nombres de cobradoras
  const ids = arr => arr.map(a => a.cred).join(', ');
  console.log('Base: ' + creds.length + ' creditos · ' + pagos.length + ' pagos · hoy ' + r.hoy + ' · aviso para ' + r.en3);
  console.log('  vencen HOY: ' + r.vencenHoy.length + '  (' + ids(r.vencenHoy) + ')');
  console.log('  vencen en ' + DIAS_AVISO + ' dias: ' + r.vencenEn3.length + '  (' + ids(r.vencenEn3) + ')');
  console.log('  atrasados 1-' + DIAS_CRITICO + ': ' + r.atrasados.length + '  (' + ids(r.atrasados) + ')');
  console.log('  criticos +' + DIAS_CRITICO + ': ' + r.criticos.length + '  (' + ids(r.criticos) + ')');
  console.log('  sin telefono util: ' + r.sinTelefono.length + '  (' + ids(r.sinTelefono) + ')');
  const todos = [...r.vencenHoy, ...r.vencenEn3, ...r.atrasados, ...r.criticos, ...r.sinTelefono];
  r.cobradoras.forEach((nom, i) => console.log('  cobradora ' + (i + 1) + ': ' + todos.filter(a => a.cobradora === nom).length + ' avisos'));
  console.log('  mensajes de Telegram: ' + mensajes.length);

  const resumen = 'hoy=' + r.vencenHoy.length + ' en3=' + r.vencenEn3.length + ' atrasados=' + r.atrasados.length
    + ' criticos=' + r.criticos.length + ' sintel=' + r.sinTelefono.length;
  if (DRY) { console.log('\n(dry-run) no se envio nada'); console.log('RESULTADO dry=1 ' + resumen); return; }
  const ok = await enviarTelegram(TOKEN, CHATS, mensajes);
  console.log('RESULTADO dry=0 ' + resumen + ' enviado=' + (ok ? 1 : 0));
  if (!ok) process.exit(1);
}

if (require.main === module) {
  main().catch(e => { console.error('ERROR', e.message); process.exit(1); });
}

module.exports = { calcularAvisos, armarMensajes, mensajeCliente, telWhatsapp, fechasDe, repartidor, claveCliente,
  DIAS_AVISO, DIAS_CRITICO, TELEGRAM_MAX, COBRADORAS_DEFECTO };
