/* ══════════════════════════════════════════════════════════════════════════
   BOTONES DE PAGASI — Cloudflare Worker
   Escucha tus mensajes de Telegram 24/7 y, segun el boton que toques, dispara
   el GitHub Action correspondiente (que lee Firestore y te manda el reporte).
   No lee la base: solo enciende Actions, por eso no necesita llave de Firebase.

   Secrets del Worker:
     TELEGRAM_TOKEN, GITHUB_PAT, CHAT_ID
   ══════════════════════════════════════════════════════════════════════════ */

const REPO = 'Pagasi18/PAGASI-V2.0';

// Teclado de botones que se muestra en Telegram
const KEYBOARD = {
  keyboard: [
    [{ text: '📊 Resumen ahora' }],
    [{ text: '💰 Cobranza hoy' }, { text: '⚠️ Mora' }],
    [{ text: '📅 Vencen mañana' }, { text: '🏍️ Ventas del mes' }],
    [{ text: '📸 Comprobantes' }, { text: '🔍 Buscar cliente' }]
  ],
  resize_keyboard: true,
  is_persistent: true
};

// Boton -> modo del reporte a pedido (reporte.js)
const MODOS = {
  '💰 Cobranza hoy': 'cobranza',
  '⚠️ Mora': 'mora',
  '📅 Vencen mañana': 'vencen',
  '🏍️ Ventas del mes': 'ventas',
  '📸 Comprobantes': 'comprobantes'
};

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Bot de Pagasi activo.');

    let update;
    try { update = await request.json(); } catch (e) { return new Response('ok'); }

    const msg = update.message || update.edited_message;
    const chatId = msg && msg.chat && msg.chat.id;
    const text = (msg && msg.text) || '';
    if (String(chatId) !== String(env.CHAT_ID)) return new Response('ignored');

    const tg = (method, body) => fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${method}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    const dispatch = (workflow, inputs) => fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GITHUB_PAT}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'pagasi-telegram-bot'
        },
        body: JSON.stringify(inputs ? { ref: 'main', inputs } : { ref: 'main' })
      }
    );

    // Menu
    if (text === '/start' || text === '/menu') {
      await tg('sendMessage', { chat_id: chatId, text: 'Tu panel Pagasi 👇 Toca lo que quieras ver.', reply_markup: KEYBOARD });
      return new Response('ok');
    }

    // Resumen completo (usa su propio workflow, el mismo de las 7 PM)
    if (text === '📊 Resumen ahora' || text === '/resumen') {
      const gh = await dispatch('resumen-diario.yml');
      await tg('sendMessage', { chat_id: chatId, text: gh.ok ? '⏳ Generando tu resumen…' : '⚠️ No pude ahora, intenta de nuevo.' });
      return new Response('ok');
    }

    // Buscar cliente: pedimos la cedula con "responder"
    if (text === '🔍 Buscar cliente') {
      await tg('sendMessage', { chat_id: chatId, text: 'Escribe la cédula del cliente:', reply_markup: { force_reply: true } });
      return new Response('ok');
    }

    // Respondio a la pregunta de la cedula -> busqueda
    const rt = msg && msg.reply_to_message;
    if (rt && /cédula/i.test(rt.text || '')) {
      const gh = await dispatch('bot-reporte.yml', { modo: 'cliente', arg: text.trim(), chat: String(chatId) });
      await tg('sendMessage', { chat_id: chatId, text: gh.ok ? '⏳ Buscando…' : '⚠️ No pude buscar, intenta de nuevo.' });
      return new Response('ok');
    }

    // Botones de reporte a pedido
    if (MODOS[text]) {
      const gh = await dispatch('bot-reporte.yml', { modo: MODOS[text], arg: '', chat: String(chatId) });
      await tg('sendMessage', { chat_id: chatId, text: gh.ok ? '⏳ Generando…' : '⚠️ No pude ahora, intenta de nuevo.' });
      return new Response('ok');
    }

    // Cualquier otra cosa
    await tg('sendMessage', { chat_id: chatId, text: 'Usa /menu para ver tus botones.' });
    return new Response('ok');
  }
};
