/* Meta (WhatsApp Cloud API): leer lo que llega al webhook y mandar mensajes. Sin librerias:
   fetch de Node 20 contra graph.facebook.com. Todo lo que habla con Meta esta aqui, asi el
   resto se prueba con un `meta` falso.                                                    */
'use strict';
const crypto = require('crypto');
const GRAPH = 'https://graph.facebook.com/v22.0';

// Firma X-Hub-Signature-256 = sha256 HMAC del cuerpo crudo con el app secret
function firmaValida(cuerpoCrudo, cabecera, appSecret) {
  if (!appSecret || appSecret === 'pendiente') return false;   // sin el secreto real de Meta no entra nada
  if (!cabecera || typeof cabecera !== 'string' || !cabecera.startsWith('sha256=')) return false;
  const esperada = 'sha256=' + crypto.createHmac('sha256', appSecret).update(cuerpoCrudo).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(esperada), Buffer.from(cabecera)); } catch (e) { return false; }
}

// Verificacion del webhook (GET): Meta manda hub.mode, hub.verify_token y hub.challenge
function verificacion(query, verifyToken) {
  if (!query) return null;
  if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === verifyToken && query['hub.challenge']) return String(query['hub.challenge']);
  return null;
}

// Del aviso crudo salen mensajes y estados, planos, sin perder de que numero vinieron
function parsearWebhook(cuerpo) {
  const mensajes = [], estados = [];
  if (!cuerpo || cuerpo.object !== 'whatsapp_business_account' || !Array.isArray(cuerpo.entry)) return { mensajes, estados, objeto: cuerpo && cuerpo.object };
  cuerpo.entry.forEach(entry => {
    (entry.changes || []).forEach(ch => {
      const v = ch.value || {};
      if (ch.field !== 'messages') return;
      const perfil = {};
      (v.contacts || []).forEach(c => { if (c && c.wa_id) perfil[c.wa_id] = (c.profile && c.profile.name) || ''; });
      (v.messages || []).forEach(m => {
        if (!m || !m.id) return;
        const tipo = m.type || 'desconocido';
        let texto = '';
        if (tipo === 'text') texto = (m.text && m.text.body) || '';
        else if (tipo === 'button') texto = (m.button && m.button.text) || '';
        else if (tipo === 'interactive') texto = (m.interactive && ((m.interactive.button_reply && m.interactive.button_reply.title) || (m.interactive.list_reply && m.interactive.list_reply.title))) || '';
        else if (tipo === 'image' || tipo === 'document' || tipo === 'audio' || tipo === 'video' || tipo === 'sticker') texto = (m[tipo] && m[tipo].caption) || '';
        const medio = ['image', 'document', 'audio', 'video', 'sticker'].includes(tipo) && m[tipo] ? { id: m[tipo].id, mime: m[tipo].mime_type || '', nombre: m[tipo].filename || '' } : null;
        mensajes.push({ metaId: m.id, de: m.from, nombre: perfil[m.from] || '', tipo: tipo === 'text' || tipo === 'button' || tipo === 'interactive' ? 'texto' : tipo === 'image' ? 'imagen' : tipo === 'document' ? 'documento' : tipo === 'audio' ? 'audio' : tipo, texto, medio,
          hora: m.timestamp ? new Date(parseInt(m.timestamp, 10) * 1000).toISOString() : new Date().toISOString(), telefonoNegocio: (v.metadata && v.metadata.display_phone_number) || '' });
      });
      (v.statuses || []).forEach(s => {
        if (!s || !s.id) return;
        const estado = s.status === 'sent' ? 'enviado' : s.status === 'delivered' ? 'entregado' : s.status === 'read' ? 'leido' : s.status === 'failed' ? 'fallo' : s.status;
        const err = Array.isArray(s.errors) && s.errors[0] ? (s.errors[0].title || '') + (s.errors[0].code ? ' (' + s.errors[0].code + ')' : '') : '';
        estados.push({ metaId: s.id, estado, error: err, para: s.recipient_id || '', hora: s.timestamp ? new Date(parseInt(s.timestamp, 10) * 1000).toISOString() : new Date().toISOString() });
      });
    });
  });
  return { mensajes, estados, objeto: cuerpo.object };
}

function cliente(cfg) {
  const base = `${GRAPH}/${cfg.phoneNumberId}`;
  const cab = { authorization: 'Bearer ' + cfg.accessToken, 'content-type': 'application/json' };
  async function enviar(payload) {
    const r = await fetch(base + '/messages', { method: 'POST', headers: cab, body: JSON.stringify(Object.assign({ messaging_product: 'whatsapp' }, payload)) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error((j.error && j.error.message) || ('Meta HTTP ' + r.status)); e.code = j.error && j.error.code; throw e; }
    return (j.messages && j.messages[0] && j.messages[0].id) || '';
  }
  return {
    // Texto libre (solo dentro de la ventana de 24 h)
    enviarTexto: (para, texto) => enviar({ to: para.replace('+', ''), type: 'text', text: { body: String(texto).slice(0, 4096), preview_url: false } }),
    enviarImagen: (para, url, pie) => enviar({ to: para.replace('+', ''), type: 'image', image: Object.assign({ link: url }, pie ? { caption: String(pie).slice(0, 1024) } : {}) }),
    // Plantilla aprobada por Meta (la unica forma de escribir fuera de la ventana)
    enviarPlantilla: (para, nombre, parametros, idioma) => enviar({ to: para.replace('+', ''), type: 'template', template: { name: nombre, language: { code: idioma || 'es' }, components: parametros && parametros.length ? [{ type: 'body', parameters: parametros.map(t => ({ type: 'text', text: String(t) })) }] : [] } }),
    marcarLeido: (metaId) => enviar({ status: 'read', message_id: metaId }).catch(() => ''),
    // Un medio que mando el cliente: primero la URL temporal, despues los bytes
    async bajarMedio(mediaId) {
      const info = await (await fetch(`${GRAPH}/${mediaId}`, { headers: { authorization: 'Bearer ' + cfg.accessToken } })).json();
      if (!info || !info.url) throw new Error('Meta no devolvió la URL del medio');
      const r = await fetch(info.url, { headers: { authorization: 'Bearer ' + cfg.accessToken } });
      if (!r.ok) throw new Error('No se pudo bajar el medio (HTTP ' + r.status + ')');
      return { bytes: Buffer.from(await r.arrayBuffer()), mime: info.mime_type || r.headers.get('content-type') || 'application/octet-stream', tamano: info.file_size || 0 };
    }
  };
}

module.exports = { firmaValida, verificacion, parsearWebhook, cliente, GRAPH };
