/* ══════════════════════════════════════════════════════════════════════════
   BOTON "RESUMEN AHORA" — Cloudflare Worker
   Es el "cerebro" que escucha tus mensajes de Telegram 24/7 (Cloudflare es
   gratis y siempre esta prendido). Cuando tocas el boton, dispara el mismo
   GitHub Action del resumen, que lee Firestore y te manda el reporte.

   NO lee la base de datos: solo enciende el Action que ya tienes. Asi no hace
   falta ninguna llave de Firebase aca.

   Variables (se ponen como "secrets" del Worker, no van en el codigo):
     - TELEGRAM_TOKEN : el token del bot (@BotFather)
     - GITHUB_PAT     : token de GitHub con permiso de Actions (para disparar)
     - CHAT_ID        : tu chat de Telegram (solo tu puedes usar el bot)

   Ajusta si tu repo cambia de nombre:
   ══════════════════════════════════════════════════════════════════════════ */

const REPO = 'Pagasi18/PAGASI-V2.0';
const WORKFLOW = 'resumen-diario.yml';

export default {
  async fetch(request, env) {
    // Telegram siempre manda POST. Cualquier otra cosa (o un chequeo) responde ok.
    if (request.method !== 'POST') return new Response('Bot de Pagasi activo.');

    let update;
    try { update = await request.json(); } catch (e) { return new Response('ok'); }

    const msg = update.message || update.edited_message;
    const cbq = update.callback_query;
    const chatId = (msg && msg.chat && msg.chat.id) || (cbq && cbq.message && cbq.message.chat.id);
    const text = (msg && msg.text) || (cbq && cbq.data) || '';

    // Solo responde a TU chat. A cualquier otro, lo ignora en silencio.
    if (String(chatId) !== String(env.CHAT_ID)) return new Response('ignored');

    const tg = (method, body) => fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${method}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );

    // /start o /menu: muestra el boton fijo abajo del teclado
    if (text === '/start' || text === '/menu') {
      await tg('sendMessage', {
        chat_id: chatId,
        text: 'Toca el botón cuando quieras tu resumen al instante 👇',
        reply_markup: {
          keyboard: [[{ text: '📊 Resumen ahora' }]],
          resize_keyboard: true,
          is_persistent: true
        }
      });
      return new Response('ok');
    }

    // El boton (o /resumen): dispara el GitHub Action que arma y envia el reporte
    const pide = text === '/resumen' || text === '📊 Resumen ahora' || (cbq && cbq.data === 'resumen');
    if (pide) {
      const gh = await fetch(
        `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.GITHUB_PAT}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'pagasi-telegram-bot'
          },
          body: JSON.stringify({ ref: 'main' })
        }
      );
      await tg('sendMessage', {
        chat_id: chatId,
        text: gh.ok
          ? '⏳ Generando tu resumen… llega en unos segundos.'
          : '⚠️ No pude generarlo ahora. Intenta de nuevo en un momento.'
      });
      if (cbq) await tg('answerCallbackQuery', { callback_query_id: cbq.id });
      return new Response('ok');
    }

    // Cualquier otro mensaje: recordamos el boton
    await tg('sendMessage', { chat_id: chatId, text: 'Toca 📊 Resumen ahora para recibir tu reporte.' });
    return new Response('ok');
  }
};
