/* Lo que pasa con cada mensaje que llega por WhatsApp. Todo lo externo entra por `deps` (bases de
   las dos companias, Storage, Meta, el cerebro, la hora), asi el flujo completo se prueba con
   piezas falsas (tests/t_whatsapp_webhook.js).

   Donde vive cada conversacion: en la compania donde esta el cliente (el telefono se busca en
   indice_clientes de la 26 y despues de la 18). Un numero que no es cliente se guarda en la 26.
   El id de la conversacion es 'wa:' + telefono E.164; el id de cada mensaje es el id de Meta,
   asi un reenvio del webhook no se procesa dos veces.                                     */
'use strict';
const briefing = require('./briefing');

const EMPRESAS = ['26', '18'];
const CORTESIA = 'Disculpa, en este momento no puedo responderte bien. Un asesor de Pagasi te escribe en breve por aquí mismo.';
const ACK_COMPROBANTE = '¡Gracias! Recibí tu comprobante y lo pasé al equipo de Pagasi para confirmarlo. En cuanto lo registren te aviso por aquí.';
const RAZON_A_ATENCION = { pide_persona: 'pide_persona', queja: 'queja', comprobante: 'comprobante', no_puede_pagar: 'pide_persona', descuento: 'pide_persona', no_cliente: 'pide_persona', otro: 'pide_persona' };

function telDe(waId) { const d = String(waId || '').replace(/\D/g, ''); return d ? '+' + d : ''; }
function extDe(mime) { return mime === 'image/png' ? 'png' : mime === 'application/pdf' ? 'pdf' : mime === 'image/webp' ? 'webp' : 'jpg'; }

async function docs(q) { const s = await q.get(); return (s.docs || []).map(d => Object.assign({ id: d.id }, d.data())); }

// En que compania esta este telefono (y que cliente es)
async function ubicar(deps, tel) {
  for (const emp of EMPRESAS) {
    const db = deps.bases[emp]; if (!db) continue;
    const d = await db.collection('indice_clientes').doc(tel).get();
    if (d.exists && d.data() && d.data().clienteId) return { empresa: emp, clienteId: String(d.data().clienteId) };
  }
  return { empresa: '26', clienteId: '' };
}

// Ficha y creditos del cliente, ya convertidos a cifras para el briefing
async function contexto(deps, empresa, clienteId, hoy) {
  const db = deps.bases[empresa];
  if (!clienteId) return { cliente: null, creditos: [], credActivo: null, comprobantesPendientes: 0 };
  const c = await db.collection('clientes').doc(clienteId).get();
  const cliente = c.exists ? Object.assign({ id: c.id }, c.data()) : null;
  const creds = (await docs(db.collection('creditos').where('clienteId', '==', clienteId))).filter(x => !x.eliminado && !['cancelado', 'pendiente_revision'].includes(x.estado));
  const estados = [];
  for (const cr of creds) {
    const pagos = (await docs(db.collection('pagos').where('cred', '==', cr.id))).filter(p => !p.eliminado);
    const e = briefing.estadoCredito(cr, pagos, hoy);
    if (e) estados.push(e);
  }
  const vivos = estados.filter(e => !e.completado);
  const comp = (await docs(db.collection('comprobantes').where('clienteId', '==', clienteId))).filter(x => x.estado === 'pendiente').length;
  return { cliente, creditos: estados, credActivo: vivos[0] || null, comprobantesPendientes: comp };
}

async function procesarMensaje(deps, m) {
  const tel = telDe(m.de); if (!tel) return { saltado: 'sin-telefono' };
  const ahora = deps.ahora(), hoy = deps.hoy();
  const u = await ubicar(deps, tel);
  const db = deps.bases[u.empresa];
  const convRef = db.collection('conversaciones').doc('wa:' + tel);
  const msgRef = convRef.collection('mensajes').doc(m.metaId);
  const entrante = { metaId: m.metaId, direccion: 'entrante', autor: 'cliente', tipo: m.tipo, texto: m.texto || '', medio: m.medio ? { id: m.medio.id, mime: m.medio.mime } : null, estado: 'recibido', hora: m.hora || ahora };
  try { await msgRef.create(entrante); } catch (e) { return { saltado: 'repetido', empresa: u.empresa }; }

  const convSnap = await convRef.get();
  const conv = convSnap.exists ? convSnap.data() : null;
  const ctx = await contexto(deps, u.empresa, u.clienteId, hoy);
  const textoLista = m.texto || (m.tipo === 'imagen' ? '📷 Imagen' : m.tipo === 'audio' ? '🎤 Audio' : m.tipo === 'documento' ? '📄 Documento' : 'Mensaje');
  const base = { canal: 'whatsapp', telE164: tel, nombre: (conv && conv.nombre) || m.nombre || (ctx.cliente && ctx.cliente.nombre) || tel, clienteId: u.clienteId || (conv && conv.clienteId) || '', clienteNombre: (ctx.cliente && ctx.cliente.nombre) || (conv && conv.clienteNombre) || '',
    cred: ctx.credActivo ? ctx.credActivo.id : ((conv && conv.cred) || ''), modo: (conv && conv.modo) || 'bot', noLeidos: ((conv && conv.noLeidos) || 0) + 1, ultimoMensaje: textoLista, ultimoMensajeHora: entrante.hora, ultimoEntranteHora: entrante.hora, actualizado: ahora, empresa: u.empresa };
  if (!conv) base.creado = ahora;
  await convRef.set(base, { merge: true });
  deps.log('entrante', { empresa: u.empresa, tipo: m.tipo, cliente: !!u.clienteId });
  if (deps.meta.marcarLeido) deps.meta.marcarLeido(m.metaId).catch(() => {});

  // Una imagen o un documento: posible comprobante. Se guarda y se le pasa al equipo.
  if (m.medio && (m.tipo === 'imagen' || m.tipo === 'documento')) {
    let medio = null;
    try {
      const b = await deps.meta.bajarMedio(m.medio.id);
      const ruta = 'comprobantes_whatsapp/' + tel.replace('+', '') + '/' + m.metaId + '.' + extDe(b.mime);
      const url = await deps.storage(u.empresa).subir(ruta, b.bytes, b.mime);
      medio = { url, path: ruta, mime: b.mime };
      await msgRef.set({ medio }, { merge: true });
    } catch (e) { deps.log('medio-fallo', { error: String(e && e.message || e).slice(0, 120) }); }
    if (u.clienteId && medio) {
      await db.collection('comprobantes').add({ clienteId: u.clienteId, clienteNombre: (ctx.cliente && ctx.cliente.nombre) || '', credId: ctx.credActivo ? ctx.credActivo.id : '', monto: null, fecha: hoy, metodo: 'WhatsApp', referencia: '', fotoUrl: medio.url, fotoPath: medio.path, estado: 'pendiente', origen: 'whatsapp', creadoEn: ahora, telE164: tel });
    }
    await convRef.set({ atencion: 'comprobante', actualizado: ahora }, { merge: true });
    if (base.modo === 'bot') await responder(deps, db, convRef, tel, u.clienteId ? ACK_COMPROBANTE : 'Recibí tu imagen. ¿Me dices tu nombre y si tienes un crédito con Pagasi? Un asesor te atiende en breve.', ahora, { resumen: 'Mandó una imagen (posible comprobante).' });
    return { empresa: u.empresa, comprobante: true };
  }

  // Con una persona atendiendo, el asistente se calla
  if (base.modo === 'humano') return { empresa: u.empresa, callado: true };

  // El cerebro
  const historial = await docs(convRef.collection('mensajes').orderBy('hora', 'asc').limit(40));
  const sistema = briefing.armar({ empresa: (deps.cfg.empresaNombre || {})[u.empresa] || 'Pagasi', cliente: ctx.cliente, creditos: ctx.creditos, instrucciones: deps.cfg.instrucciones, datosPago: deps.cfg.datosPago, hoy, nombrePerfil: m.nombre, promesa: conv && conv.borrador && conv.borrador.tipo === 'promesa' ? conv.borrador : null, comprobantesPendientes: ctx.comprobantesPendientes });
  let r;
  try { r = await deps.cerebro.pensar({ sistema, mensajes: historial }); }
  catch (e) {
    deps.log('cerebro-fallo', { error: String(e && e.message || e).slice(0, 160) });
    await responder(deps, db, convRef, tel, CORTESIA, ahora, { atencion: 'error' });
    return { empresa: u.empresa, cerebro: 'fallo' };
  }
  const cambios = {};
  if (r.summary) cambios.resumen = r.summary;
  if (r.draft) cambios.borrador = r.draft;
  if (!u.clienteId) { r.handoff = true; r.handoffReason = r.handoffReason || 'no_cliente'; }
  if (r.handoff) cambios.atencion = RAZON_A_ATENCION[r.handoffReason] || 'pide_persona';
  await responder(deps, db, convRef, tel, r.reply, ahora, cambios);
  return { empresa: u.empresa, respondido: true, handoff: !!r.handoff, draft: r.draft || null };
}

// Manda el texto, lo guarda como mensaje del asistente y actualiza la conversacion
async function responder(deps, db, convRef, tel, texto, ahora, cambios) {
  let metaId = '', estado = 'enviado', error = '';
  try { metaId = await deps.meta.enviarTexto(tel, texto); } catch (e) { estado = 'fallo'; error = String(e && e.message || e).slice(0, 160); deps.log('envio-fallo', { error }); }
  const msg = { metaId, direccion: 'saliente', autor: 'asistente', tipo: 'texto', texto, estado, error, hora: ahora };
  if (metaId) await convRef.collection('mensajes').doc(metaId).set(msg); else await convRef.collection('mensajes').add(msg);
  await convRef.set(Object.assign({ ultimoMensaje: texto, ultimoMensajeHora: ahora, actualizado: ahora }, cambios || {}), { merge: true });
}

// Estados que manda Meta de nuestros mensajes (enviado, entregado, leido, fallo)
async function procesarEstado(deps, s) {
  const tel = telDe(s.para);
  for (const emp of EMPRESAS) {
    const db = deps.bases[emp]; if (!db) continue;
    const ref = db.collection('conversaciones').doc('wa:' + tel).collection('mensajes').doc(s.metaId);
    const d = await ref.get();
    if (!d.exists) continue;
    const orden = { enviado: 1, entregado: 2, leido: 3, fallo: 4 };
    if ((orden[d.data().estado] || 0) > (orden[s.estado] || 0) && s.estado !== 'fallo') return { empresa: emp, ignorado: true };
    await ref.set({ estado: s.estado, error: s.error || '' }, { merge: true });
    return { empresa: emp, actualizado: true };
  }
  return { ignorado: true };
}

async function procesarAviso(deps, parsed) {
  const res = { mensajes: [], estados: [] };
  for (const m of parsed.mensajes || []) { try { res.mensajes.push(await procesarMensaje(deps, m)); } catch (e) { deps.log('mensaje-fallo', { error: String(e && e.message || e).slice(0, 160) }); res.mensajes.push({ error: true }); } }
  for (const s of parsed.estados || []) { try { res.estados.push(await procesarEstado(deps, s)); } catch (e) { res.estados.push({ error: true }); } }
  return res;
}

// El equipo escribe desde el panel: solo dentro de la ventana de 24 h de Meta
async function enviarEquipo(deps, { empresa, convId, texto, por }) {
  const db = deps.bases[empresa]; if (!db) throw Object.assign(new Error('Compañía desconocida'), { codigo: 'empresa' });
  texto = String(texto || '').trim(); if (!texto) throw Object.assign(new Error('Sin texto'), { codigo: 'texto' });
  const ref = db.collection('conversaciones').doc(convId);
  const d = await ref.get(); if (!d.exists) throw Object.assign(new Error('Conversación no encontrada'), { codigo: 'conversacion' });
  const conv = d.data(), ahora = deps.ahora();
  if (!conv.ultimoEntranteHora || Date.parse(ahora) - Date.parse(conv.ultimoEntranteHora) >= 24 * 3600 * 1000) throw Object.assign(new Error('La ventana de 24 horas está cerrada: solo se puede escribir cuando el cliente vuelva a escribir.'), { codigo: 'ventana' });
  const metaId = await deps.meta.enviarTexto(conv.telE164, texto);
  const msg = { metaId, direccion: 'saliente', autor: 'equipo', tipo: 'texto', texto, estado: 'enviado', error: '', hora: ahora, por: por || 'Equipo' };
  await ref.collection('mensajes').doc(metaId || ('eq-' + Date.now())).set(msg);
  await ref.set({ modo: 'humano', atendidoPor: por || 'Equipo', ultimoMensaje: texto, ultimoMensajeHora: ahora, actualizado: ahora }, { merge: true });
  return { metaId };
}

module.exports = { procesarAviso, procesarMensaje, procesarEstado, enviarEquipo, ubicar, contexto, CORTESIA, ACK_COMPROBANTE, telDe };
