# PAGASI V2 — Work Log

> **Para futuras sesiones de Claude / Adam:** este archivo es la memoria
> entre sesiones. Leelo PRIMERO antes de hacer nada para entender el estado
> actual del proyecto.

**Última actualización:** 2026-05-28 · Adam (Mac Mini)

---

## 🎯 Stack

- **Vanilla JS/HTML/CSS** — sin build pipeline, sin npm. Editar archivos y pushear.
- **Firebase** compat SDK v10.7.1 (loaded via `<script>` from gstatic):
  - Auth (anonymous + email/password)
  - Firestore (data: clientes, créditos, pagos, egresos, usuarios, tareas, config, logs)
  - Storage (fotos de motos)
- **Proyecto Firebase:** `pagasi-v2` (V1 archivada: `pagasi-b859b`)
- **Hosting:** GitHub Pages
- **Dominio:** `pagasi.io` (DNS en Square)
- **Repo:** `https://github.com/Pagasi18/PAGASI-V2.0` (main branch)
- **Public site:** `pagasi.io` — `index.html`, `solicitar.html`, `simulador.html`, `catalogo.html`, `nosotros.html`
- **Admin:** `pagasi.io/admin.html`

## 📁 Mapa de archivos clave

```
admin.html                       Entry del admin (sidebar + main)
index.html, solicitar.html etc.  Sitio público
assets/
  pagasi-app.js   ★               App principal: Firebase, S.currentUser, dispararCotillon,
                                  guardarMiPerfil, logActividad, dashDailyLoad, etc.
  pagasi.css                      Estilos globales (variables CSS --p1, --green, --rim, etc.)
modules/
  dash.js                         Dashboard (KPI cards + charts)
  notif.js                        Notificaciones (3 columnas: mensaje|lista|preview)
  config.js                       Configuración + Bitácora de actividad
  users.js                        Lista de usuarios
  plan.js                         Plan & Precios (catálogo motos)
  reportes.js                     Finanzas + reporte mensual
logic/
  centro.js                       Centro de Trabajo + tareas + card cumpleaños
  usuarios.js     ★               Auth (onAuthStateChanged) + editarUsuario + editarPerfilPersonal
  clientes.js                     CRUD clientes
  creditos.js                     Wizard de crédito (2 pasos)
  pagos.js                        Registrar pago + recibos
  egresos.js                      Egresos
  facturacion.js                  Facturas SENIAT + recibos WA
  notificaciones.js               buildMensajeNotif, enviarNotificaciones, nxAcRender, setNotifTipo
  configuracion.js                guardarEmpresa, guardarPlan, guardarTasaBs, _cuentasBanc
  bcv-auto.js     ★               Fetch automático BCV + Binance + persistencia Firestore
```

## 🔑 Convenciones y patrones del código

- **DOM helper:** `$('id')` = `document.getElementById('id')`
- **Estado global:** `S.clientes`, `S.creds`, `S.pagos`, `S.egresos`, `S.usuarios` (no, es `_usersCache`!), `S._wtUsers`, `S.currentUser`, `S.tareas`, `S.movimientos`
- **Usuarios cache:** `_usersCache` (global, populado por `usuarios.js`). Si está vacío, `S._wtUsers` (populado por `wtLoadUsers` en `centro.js`).
- **Toasts:** `toast('mensaje','success'|'error'|'info'|'warn')`
- **Permisos admin:** `isAdminUser()` (en `usuarios.js`) chequea `S.currentUser.rol === 'Administrador'`
- **Logging de actividad:** `logActividad(action, modulo, target, detalle)` — escribe a Firestore `logs/{id}`. Disponible globalmente en `pagasi-app.js`.
- **Navegación:** `nav('clientes')`, `nav('config')`, etc. — actualiza `S.page` y re-renderiza
- **Modal:** `setMicon()`, `$('mtt').textContent`, `$('mbd').innerHTML`, `S.saveFn = function(){...}`, `$('mft').innerHTML`, `$('ov').style.display='flex'`, `closeM()`

## 🔐 Firestore Rules — IMPORTANTES

Reglas actuales en `pagasi-v2`. La regla `/logs/{id}` ya está incluida:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function esAdmin() { return request.auth != null
      && get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data.rol == 'Administrador'; }
    function logueado() { return request.auth != null; }

    match /usuarios/{uid} {
      allow read: if logueado();
      allow write: if esAdmin() || (request.auth != null && request.auth.uid == uid);
    }
    match /invitaciones/{id} { allow read: if logueado(); allow write: if esAdmin(); }
    match /config/{id} { allow read, write: if logueado(); }
    match /clientes/{id}    { allow read, create, update: if logueado(); allow delete: if esAdmin(); }
    match /creditos/{id}    { allow read, create, update: if logueado(); allow delete: if esAdmin(); }
    match /pagos/{id}       { allow read, create, update: if logueado(); allow delete: if esAdmin(); }
    match /motos/{id}       { allow read, create, update: if logueado(); allow delete: if esAdmin(); }
    match /facturas/{id}    { allow read, create, update: if logueado(); allow delete: if esAdmin(); }
    match /cuentas/{id}     { allow read, create, update: if logueado(); allow delete: if esAdmin(); }
    match /cuentasPendientes/{id} { allow read, create, update: if logueado(); allow delete: if esAdmin(); }
    match /movimientos/{id} { allow read, create, update: if logueado(); allow delete: if esAdmin(); }
    match /egresos/{id}     { allow read, create, update: if logueado(); allow delete: if esAdmin(); }
    match /concesionarios/{id} { allow read, create, update: if logueado(); allow delete: if esAdmin(); }
    match /tareas/{id}      { allow read, create, update, delete: if logueado(); }
    match /logs/{id} {
      allow read: if esAdmin();
      allow create: if logueado();
      allow update, delete: if false;
    }
    match /{document=**} { allow read, write: if false; }
  }
}
```

## ✅ Features funcionando hoy

### Centro de Trabajo (`logic/centro.js`)
- Card de cumpleaños con color **por género de cada usuario** (M=azul, F=rosa)
- Daily tabs: Noticias / Chiste / Dato (sin tip)
- Push notifications de tareas pendientes solo al asignado real (no a admins)
- Cotillón automático para cualquier cumpleañero del equipo (no solo el logueado)
  - Anti-spam vía localStorage `_cotillonShown_YYYY-M-D`
- Botón "🎊 Lanzar cotillón ahora" usa el género del usuario logueado si es cumpleañero

### Cotillón (`assets/pagasi-app.js > dispararCotillon`)
- Logo Pagasi tintado por contexto (azul si M, rosa si F) via CSS filter chain
- Toma el base64 del logo del sidebar (`.sb-logo img`) — no duplica el asset
- Card con animación de confetti canvas + bubble
- Acepta `(nombre, esTeammate, genero)`. Si es compañero: copy distinto ("¡Hoy cumple X!")

### Mi Perfil (en `assets/pagasi-app.js > showAdminProfile`)
**14 campos en 3 secciones:**
- Personales: nombre, cedula, genero, cumpleanos, estadoCivil, sede
- Contacto: tel, tel2, direccion, emergencia
- Redes: instagram, facebook, tiktok, twitter, linkedin

`guardarMiPerfil`:
- Lee + valida + escribe Firestore con merge + re-lee para verificar
- Sincroniza `_usersCache` y `S._wtUsers`
- Re-renderiza Centro si está abierto
- Loguea en bitácora
- Console logs para debug

### Welcome modal "Completá tu perfil" (`assets/pagasi-app.js > chequearPerfilIncompleto`)
- Dispara al login si faltan: Cedula, Genero, Cumpleanos, Telefono, Direccion, Emergencia, o al menos 1 red social
- Anti-spam: 1 vez por día por usuario via localStorage `_perfilNagDismissed_{uid}_{date}`
- Botones "Después" / "Completar ahora →"

### Notificaciones (`modules/notif.js`)
- Layout **3 columnas iguales**: Mensaje a enviar | Destinatarios | Vista previa
- Dropdown del mensaje con optgroups (Bienvenida/Pagos/Cobranza/Cierre/Otros) — **auto-determina el grupo destinatario** según el template
- Lista de destinatarios:
  - Ordenada por urgencia: morosos primero, después días asc hasta próxima cuota
  - Badge al lado del nombre: días vencidos (rojo) / días para próxima cuota (color escalonado)
  - Click en uno → banner azul "SOLO ESTE" arriba de la lista
- Recordatorio de cuota incluye **monto del cliente**
- Bloque header **sin línea de "Saldo pendiente"** (a pedido del usuario, en TODOS los templates)
- WhatsApp preview con burbuja verde

### Bitácora de actividad (`modules/config.js` + `assets/pagasi-app.js > logActividad`)
- Colección Firestore `logs/{id}` (inmutable: nadie puede update/delete)
- Hooks ya instalados en:
  - login / logout
  - cliente_creado, cliente_editado, cliente_eliminado
  - credito_creado, credito_eliminado
  - pago_registrado
  - egreso_registrado
  - usuario_editado, usuario_eliminado
  - perfil_editado (Mi Perfil)
  - config_actualizada (empresa + plan)
  - notif_enviada
- UI en Configuración → Sistema:
  - Agrupado por día (Hoy expandido, otros colapsados)
  - Cada día con header sticky + caret + mini-avatares apilados
  - Color determinístico por usuario (paleta de 12)
  - Filtros: módulo + usuario (poblado de logs ∪ usuarios del sistema)
  - Exportar CSV
  - Empty state inteligente que sugiere revisar reglas Firestore

### Tasa BCV + Binance (`logic/bcv-auto.js`)
- Al iniciar app fetcha automáticamente:
  - **BCV:** `ve.dolarapi.com/v1/dolares/oficial` (fallback `bcv-api.rafnixg.dev`)
  - **Binance:** `ve.dolarapi.com/v1/dolares/paralelo` (fallback `pydolarvenezuela-api.vercel.app`)
- Guarda en Firestore `config/tasa` con campos `tasaBs`, `tasaBinance`, `fechaActualizacion`, `fechaBinance`
- No re-descarga si ya tiene la tasa de hoy
- UI:
  - Card en Dashboard con BCV / Binance / Spread (con color según gap)
  - Badge en Configuración → Plan Financiero con estado (cargando/ok/error) + botón "↻ Actualizar"
- Globals: `window._tasaBsGlobal`, `window._tasaBinance`

### Editar perfiles de empleados como admin (`logic/usuarios.js > editarPerfilPersonal`)
- Botón "Editar datos personales" en panel de usuario (Configuración → Usuarios → click usuario)
- Solo visible para admins
- Modal espejo de Mi Perfil con los 14 campos
- Loguea en bitácora como `usuario_editado · datos personales (admin)`

### Otros features importantes
- **Solicitud web → admin** (`solicitar.html` → Firestore `clientes` con `origen:'web'`, `estado:'lead'`)
- **Botón WhatsApp de confirmación** apunta a `+58 424-217-7798`
- **Lead web** con badge "◆ LEAD WEB" en lista
- **Todos los leads** con fondo azul claro en lista de clientes
- **Fecha alta** sortable column en clientes
- **Buscador "Nueva Solicitud"** ordenado por más reciente
- **Smart concepto factura** detecta inicial/cuota/parcial/multi-cuota
- **Catálogo:** 41 motos sincronizadas a Firestore `config/catalogo`
- **Reporte mensual** con 8 secciones detalladas (botón en Finanzas)
- **Notificaciones push** del navegador (mora, leads, cuotas)
- **Cobranza** con badges de mora y filtros guardados

## 🚧 Pendientes

### 🔴 Bloqueantes / Verificar
- [ ] **Probar bitácora** después de actualizar Firestore rules (¿se ve?, ¿exporta CSV?)
- [ ] **Cumpleaños de Adam azul** — verificar que tras setear genero=M la card sale azul

### 🟡 Trabajo restante de la lista del usuario
- [ ] **#1 Deduplicar usuarios en filtro bitácora** (abraham vs abraham1benza) — agrupar por uid
- [ ] **#3 Subir V1 backup a repo privado** (JSON 2.9MB en `~/Downloads/pagasi-v1-backup-2026-05-28.json`)
- [ ] **#5 Auto-logout por inactividad** (30 min)
- [ ] **#7 Búsqueda global Cmd+K** (estilo Linear/Notion)
- [ ] **#8 Foto del cliente** (upload a Storage)
- [ ] **#9 Campanita notificaciones in-app** (header con badge)
- [ ] **#10 Modo oscuro** (toggle en Mi Perfil)
- [ ] **#11 Dashboard con gráficas** (top vendedores, cobranza semanal, mora por sede)
- [ ] **#12 Bulk operations** (selección múltiple)
- [ ] **#13 Filtros guardados**
- [ ] **#14 Recordatorios automáticos**
- [ ] **#15 Historial por registro** (usar bitácora ya existente)
- [ ] **#16 PDF de cliente**
- [ ] **#17 Auto-logout 30min**
- [ ] **#18 Avisos de acciones críticas a admin principal**

### 🟢 Cosas que el usuario debe darnos
- [ ] **Fotos reales del catálogo** ("mañana te paso")

## 🛠 Comandos útiles

### Commit con caracteres especiales (acentos, ñ, →)
**No usar HEREDOC** porque bash lo rompe con tildes. Usar archivo temp:
```bash
cat > /tmp/pagasi_commit_msg.txt <<'EOF'
Título del commit

Detalle...

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF

cd /Users/adammanir/Downloads/PAGASI-clone && git add -A && git commit -F /tmp/pagasi_commit_msg.txt && git push && rm /tmp/pagasi_commit_msg.txt
```

### Probar cotillón (limpiar lock)
```js
// En consola del navegador:
localStorage.removeItem('_cotillonShown_' + new Date().getFullYear() + '-' + (new Date().getMonth()+1) + '-' + new Date().getDate());
window._cotillonShown = false;
location.reload();
```

### Setear cumpleaños hoy a todos (test)
```js
(async () => {
  const HOY = new Date().toISOString().slice(0,10);
  const snap = await db.collection('usuarios').get();
  for (const doc of snap.docs) {
    await db.collection('usuarios').doc(doc.id).set({ cumpleanos: HOY }, { merge: true });
  }
  if (typeof _usersCache !== 'undefined') _usersCache = [];
  window._cotillonShown = false;
  location.reload();
})();
```

### Verificar projectId Firebase
```js
firebase.app().options.projectId  // → "pagasi-v2"
```

## 📜 Historia de commits (últimos 25)

```
19af496 Dashboard: card de Tasa del dia con BCV + Binance y spread
6280fb5 3 mejoras: noticias silenciosas + tasa BCV automatica + admin edita perfiles
64a9824 Logo Pagasi tintado segun contexto (azul cotillon M / rosa F)
2948ea9 Bitácora: agrupada por día (Hoy/Ayer/fecha) + filtros poblados
62a6079 Fix: cotillón del Dashboard pasaba sin params → siempre rosa
2b2a51d Centro: cumpleaños y cotillón con color por género (cada usuario su color)
9376d21 Notif: layout de 3 columnas iguales · Mensaje | Lista | Vista previa
dc980ad Cotillón usa género del usuario logueado · Mi Perfil con 14 campos
19cc23a Notif: preview al lado del dropdown · Bitácora: color por usuario
2671189 Cotillón con logo Pagasi y color por género + bienvenida para completar perfil
21d01fd Fix: label hardcodeado pagasi-b859b · ahora muestra projectId real
511c297 Notif: preview arriba + ordenamiento por urgencia · Bitácora de actividad
f196fcb Notificaciones: simplificación máxima + monto en recordatorio + sin saldo
cb8814b Fix: cumpleaños del equipo no se reflejaban en card ni disparaban cotillón
c69d968 Notificaciones: rediseño simplificado para empleados
13f7a16 Fix: botón 'Ir a WhatsApp' tras enviar solicitud usaba número placeholder
204272b Fix: admin no recibe notificaciones de tareas asignadas a otros
7433686 Todos los leads (sin credito activo) con fondo azul claro
742d6bd Clientes: leads web en azul claro + buscador credito ordena por mas reciente
9fe5608 Reporte mensual con 8 secciones detalladas + boton destacado | Centro sin tip
```

## 📝 Notas para el próximo Claude

1. **Adam (Pagasi18) tiene Mac Mini y MacBook.** Si dice "ahora en la MacBook", probablemente vas a estar en `~/Downloads/PAGASI-clone` con git ya configurado. Hacé `git pull` antes de empezar.

2. **El usuario habla español.** Respondé en español rioplatense (usá "vos" / "tu" según pida).

3. **No spamees emojis.** El usuario los aprecia pero con moderación.

4. **Estilo de trabajo de Adam:**
   - Le gusta que pushees directo a main, sin PRs
   - Prefiere muchos commits pequeños que uno grande
   - Te va a mandar screenshots con bugs visuales → arregla rápido
   - Si dice "haceme X" → no preguntes, hacelo
   - Al final de cada commit espera un resumen claro de qué cambió

5. **Patrón típico de ciclo:**
   - Adam pide cambio → editás → `node --check` → `git add/commit/push` → resumen al usuario

6. **Cosas que el usuario odia (basado en feedback histórico):**
   - Múltiples cards/secciones cuando puede haber 1
   - Padding excesivo
   - Texto repetido o "saldo pendiente" en mensajes
   - Cards rosas cuando debería ser azul (¡revisar género!)
   - Console.warn ensuciando el debugger

7. **Datos importantes:**
   - WhatsApp Pagasi: `+58 424-217-7798`
   - Tasa BCV viene de `ve.dolarapi.com` (gratuita, sin key)
   - V1 está archivada en `alfredanderson1818.github.io/Pagasi/`
   - Catálogo: 41 motos en 3 sedes (EK Bello Monte 17 + Boleita 9 + Toro Sabana Grande 15)

8. **¿Cómo saber qué pidió Adam recientemente?** Mirá los últimos 5-10 commits con `git log --oneline -10`. Los mensajes son descriptivos.

---

## 🎯 Próximos pasos sugeridos cuando Adam vuelva

1. Probar la card del Dashboard de tasa BCV + Binance que pusheamos en `19af496`
2. Si todo OK, atacar **#1 deduplicar usuarios** o **#9 campanita in-app** (sus picks anteriores fueron por #2, #4, #6)
3. Backup V1 a repo privado pendiente desde hace varios commits

**Buena suerte, Claude del futuro. Adam es muy chevere, trabaja con él como colega.**
