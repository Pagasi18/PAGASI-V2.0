# Cobranza por WhatsApp

*18 de octubre de 2026.* Un asistente que recuerda las cuotas, responde por WhatsApp lo que el
cliente pregunta de su crédito y le pasa al equipo lo que no le toca. Sirve a las dos compañías
(PAGASI 18 y PAGASI 26) con un solo número.

## Las piezas

| Pieza | Dónde | Qué hace |
|---|---|---|
| Pantalla **Cobranza WhatsApp** | `modules/whatsapp.js`, `logic/whatsapp.js` | Hoy (la cola del día), Conversaciones (atender, devolver, promesa), Asistente (instrucciones, cómo pagar, estado) |
| Webhook `whatsappWebhook` | `functions/index.js` (proyecto **pagasi26-65ced**, us-east1) | GET: verificación de Meta · POST: recibe mensajes y estados · POST `/equipo`: el panel manda como equipo |
| Robot `recordatoriosWhatsApp` | `functions/index.js` | Todos los días 8:30 am (Caracas): plantillas 2 días antes, el día, al 3.º y al 6.º día de vencida |
| El cerebro | `functions/lib/cerebro.js` + `briefing.js` | Claude (`claude-sonnet-5-5`) con una herramienta `responder`: respuesta, promesa, resumen, handoff |
| El flujo | `functions/lib/procesar.js` | Dónde vive la conversación, de qué cliente es, qué se guarda, cuándo se calla |
| Meta | `functions/lib/meta.js` | Firma, verificación, parseo del aviso, envío de texto y plantillas, bajar medios |

## Dónde queda cada cosa

- La conversación vive en la compañía del cliente: el número se busca en `indice_clientes` de la 26 y luego de la 18. Un número que no es cliente queda en la 26 y pasa a una persona.
- `conversaciones/wa:+58414…` con sus `mensajes/{id de Meta}`. Usar el id de Meta como id del documento es lo que evita procesar dos veces un reenvío del webhook.
- Una imagen o PDF del cliente va a Storage (`comprobantes_whatsapp/<tel>/<id>`), crea un `comprobantes` pendiente con `origen: 'whatsapp'` (se confirma desde Pagos como los del portal) y marca la conversación con `atencion: 'comprobante'`.
- Auditoría en la 26: `webhooks_meta` (cada aviso crudo), `recordatorios/{empresa}_{crédito}_{cuota}_{tipo}` (cada envío, no se repite), `recordatorios_corridas` (el resultado de cada mañana).
- `config/asistente` (en la 26, lo lee el servidor): `instrucciones`, `datosPago`, `plantillas` (`{proximas, hoy, gracia, atrasadas}` con los nombres aprobados por Meta), `conectado`, `telefono`, `urlEquipo` opcional.

## Reglas fijas del asistente (en el briefing, no se editan desde la pantalla)

Solo habla del crédito del cliente. No inventa montos: todo sale del ledger. No aprueba, descuenta,
refinancia ni promete. No pide cédula ni documentos. Nunca amenaza. Si el cliente se queja, pide
una persona, manda una imagen o dice que no puede pagar, se calla y avisa. Si dice cuándo paga,
queda como borrador de promesa para que el equipo lo confirme con un clic. Cuando una persona
toma la conversación (`modo: 'humano'`), el asistente no responde hasta que la devuelvan.

## Lo que hace falta para encenderlo

1. **Meta**: cuenta de WhatsApp Business verificada, una app con el producto WhatsApp, el número
   dedicado a cobranza, y cuatro plantillas aprobadas (una por tipo de recordatorio, 5 variables:
   nombre, cuota, total, monto, fecha). Webhook: la URL del `whatsappWebhook` y el token de
   verificación (`firebase functions:secrets:access WHATSAPP_VERIFY_TOKEN`). Suscribirse a `messages`.
2. **Secretos** (los escribe Adam, nunca pasan por el chat):
   ```
   firebase functions:secrets:set WHATSAPP_ACCESS_TOKEN   --project pagasi26-65ced
   firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID --project pagasi26-65ced
   firebase functions:secrets:set WHATSAPP_APP_SECRET      --project pagasi26-65ced
   firebase functions:secrets:set ANTHROPIC_API_KEY        --project pagasi26-65ced
   ```
   Después de cambiar un secreto hay que volver a desplegar (`firebase deploy --only functions --project pagasi26-65ced`): las funciones quedan atadas a la versión del secreto que existía al desplegar. Mientras `WHATSAPP_APP_SECRET` diga `pendiente`, el webhook rechaza todo.
3. **Permisos** (hechos el 18-oct-2026): la cuenta de cómputo de la 26 (`415041001199-compute@developer.gserviceaccount.com`) corre y construye las funciones. En proyectos nuevos no trae Editor, así que tiene en la 26 `cloudbuild.builds.builder`, `datastore.user`, `storage.objectAdmin`, `logging.logWriter` y `artifactregistry.writer`; y para atender a los clientes de la 18, `datastore.user` en `pagasi-v2` y `storage.objectAdmin` en el bucket `pagasi-v2.firebasestorage.app`. Las imágenes de los contenedores se borran a los 3 días (`functions:artifacts:setpolicy`).
4. **Firestore Rules** publicadas en las dos compañías (bloque "Cobranza por WhatsApp").
5. `config/asistente`: `conectado: true`, `telefono`, `datosPago`, `plantillas`. Con `conectado` en falso, la pantalla sigue en demostración y el robot de la mañana no manda nada.
6. Consentimiento: una línea en el contrato y en la solicitud web para recibir avisos por WhatsApp.

## Despliegue

Desde la raíz del repo (el `firebase.json` de la raíz solo tiene las funciones):

```
cd functions && npm install && cd ..
firebase deploy --only functions --project pagasi26-65ced
```

El `predeploy` copia `logic/whatsapp.js` y `logic/credito-ledger.js` a `functions/logic/` (no van al
repo) para que el robot calcule la cola con el mismo código que la pantalla.

## Pruebas

- `node tests/t_whatsapp_webhook.js`: parseo de Meta, briefing, cerebro (validación y turnos), el flujo completo con bases falsas, comprobantes, estados, el equipo, los recordatorios.
- `node tests/t_whatsapp_cola.js`: la cola del día y la pantalla.
- `tests/reglas/t_reglas_whatsapp.js`: las Reglas contra el emulador (workflow `reglas-probar`).

## Medir si sirve

Comparar, por quincena, la mora a 5/15/30 días y las cuotas cobradas dentro de la gracia entre
quienes recibieron recordatorio y quienes no (los que no tienen celular válido quedan como grupo
de comparación natural). `recordatorios` guarda a quién se le mandó qué y cuándo.
