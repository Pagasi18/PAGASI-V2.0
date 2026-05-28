// Pagasi module: notif — Rediseño 2026-05 v2 · Flat single screen
PG.notif = function(){
  // ──────────── DATOS ────────────
  var moraClientes = _concFiltrar(S.creds||[]).filter(c=>c.mora>0).map(function(c){
    var cl=S.clientes.find(function(x){return x.nombre===c.cli;})||{};
    return {nombre:c.cli, tel:cl.tel||'', cred:c.id, mora:c.mora, cuota:c.cuotaQ||c.cuota, modelo:c.modelo};
  });
  var proximasCuotas = _concFiltrar(S.creds||[]).filter(function(c){
    if(c.estado!=='activo'||!c.fecha) return false;
    var inicio=new Date(c.fecha);
    var siguiente=new Date(inicio.getTime()+((c.pagado+1)*15*24*60*60*1000));
    var diff=Math.floor((siguiente-new Date())/(24*60*60*1000));
    return diff>=0&&diff<=7;
  });
  var clientesActivos = S.clientes.filter(c=>!c.eliminado&&c.estado==='activo');
  var conTelefono = clientesActivos.filter(c=>c.tel&&c.tel.replace(/[^0-9]/g,'').length>=7);
  var pctCobertura = clientesActivos.length>0 ? Math.round(conTelefono.length/clientesActivos.length*100) : 0;
  var historial = window._notifHistorial || [];
  var totalEnviados = historial.reduce((a,h)=>a+(h.cantidad||1),0);

  // ──────────── INIT ────────────
  setTimeout(function(){
    renderHistorialNotificaciones();
    var btn=$('notif-send-btn');
    if(btn) btn.onclick=function(){ enviarNotificaciones(); };
    var tipoSel=$('notif-tipo');
    if(tipoSel) tipoSel.onchange=function(){ actualizarPreviewNotif(); actualizarTipoDesc(); };
    var destSel=$('notif-dest');
    if(destSel) destSel.onchange=function(){ actualizarPreviewNotif(); };
    if(typeof nxAcUpdateHint==='function') nxAcUpdateHint();
    if(typeof nxAcGetClientsForScope==='function' && typeof nxAcRender==='function'){
      try { _nxAcResults = nxAcGetClientsForScope(); nxAcRender(); } catch(e){}
    }
    actualizarPreviewNotif();
    actualizarTipoDesc();
  }, 80);

  // CSS unique para esta vista flat
  var styles = `<style>
    .nf-flat{display:grid;grid-template-columns:1fr;gap:16px;}
    .nf-row{background:#fff;border:1px solid var(--rim);border-radius:14px;padding:16px 18px;}
    .nf-row-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;gap:12px;flex-wrap:wrap}
    .nf-row-t{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);display:flex;align-items:center;gap:8px}
    .nf-row-t::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--p1);display:inline-block}
    .nf-row-c{display:flex;gap:6px;flex-wrap:wrap}
    .nf-chip{background:var(--surf2);border:1.5px solid var(--rim);color:var(--ink2);font-family:inherit;font-size:12.5px;font-weight:700;padding:9px 15px;border-radius:50px;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:7px;letter-spacing:-.01em}
    .nf-chip:hover{border-color:var(--p1);color:var(--p1);background:var(--gs)}
    .nf-chip.is-active{background:var(--p1);border-color:var(--p1);color:#fff;box-shadow:0 4px 12px rgba(37,99,235,.28)}
    .nf-chip-n{background:rgba(0,0,0,.08);font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:50px;min-width:24px;text-align:center}
    .nf-chip.is-active .nf-chip-n{background:rgba(255,255,255,.22);color:#fff}
    .nf-body{display:grid;grid-template-columns:1.1fr .9fr;gap:16px;align-items:start}
    @media(max-width:980px){.nf-body{grid-template-columns:1fr}}
    .nf-dest-card{background:#fff;border:1px solid var(--rim);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;height:520px}
    .nf-dest-head{padding:14px 18px;background:linear-gradient(180deg,#FAFBFF,#F5F7FF);border-bottom:1px solid var(--rim);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
    .nf-dest-title{font-size:13.5px;font-weight:800;color:var(--ink);letter-spacing:-.2px}
    .nf-dest-count{background:var(--p1);color:#fff;padding:3px 10px;border-radius:50px;font-size:11px;font-weight:800;letter-spacing:.04em}
    .nf-search{padding:12px 16px;border-bottom:1px solid var(--rim);position:relative}
    .nf-search input{width:100%;padding:10px 14px 10px 36px;border:1.5px solid var(--rim);border-radius:10px;font-family:inherit;font-size:13px;font-weight:600;background:var(--surf);outline:none;transition:.15s}
    .nf-search input:focus{border-color:var(--p1);background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.10)}
    .nf-search .nf-search-i{position:absolute;left:28px;top:50%;transform:translateY(-50%);color:var(--ink4);font-size:14px;pointer-events:none}
    .nf-list{flex:1;overflow-y:auto;padding:6px 0}
    .nf-item{display:flex;align-items:center;gap:11px;padding:9px 18px;cursor:pointer;transition:background .12s;border-bottom:1px solid var(--rim)}
    .nf-item:last-child{border-bottom:none}
    .nf-item:hover{background:var(--gs)}
    .nf-item.is-focus{background:rgba(37,99,235,.10)}
    .nf-item-av{width:34px;height:34px;border-radius:50%;background:var(--p1);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11.5px;flex-shrink:0}
    .nf-item-av.is-lead{background:var(--ink3)}
    .nf-item-info{flex:1;min-width:0}
    .nf-item-n{font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:-.01em}
    .nf-item-m{font-size:11px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;font-weight:500}
    .nf-empty{padding:48px 18px;text-align:center;color:var(--ink3);font-size:12.5px;line-height:1.5}
    .nf-prev-card{background:#fff;border:1px solid var(--rim);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;height:520px}
    .nf-prev-head{padding:14px 18px;background:linear-gradient(180deg,#FAFBFF,#F5F7FF);border-bottom:1px solid var(--rim)}
    .nf-prev-title{font-size:13.5px;font-weight:800;color:var(--ink);letter-spacing:-.2px}
    .nf-prev-sub{font-size:11px;color:var(--ink3);margin-top:3px;font-weight:600}
    .nf-prev-wa{flex:1;background:linear-gradient(180deg,#E5DDD5 0%,#D9D2CB 100%);padding:14px 14px 10px;display:flex;flex-direction:column;position:relative;overflow:hidden}
    .nf-prev-wa::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle,rgba(0,0,0,.04) 1px,transparent 1px);background-size:14px 14px;pointer-events:none}
    .nf-prev-tophead{background:#075E54;color:#fff;padding:9px 14px;border-radius:9px 9px 0 0;font-size:12px;font-weight:700;display:flex;align-items:center;gap:10px;margin:-14px -14px 10px;position:relative;z-index:2}
    .nf-prev-tophead .av{width:28px;height:28px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;color:#fff}
    .nf-prev-bubble-wrap{flex:1;display:flex;flex-direction:column;justify-content:flex-end;position:relative;z-index:1}
    .nf-prev-bubble{background:#DCF8C6;padding:10px 13px 7px;border-radius:10px 10px 2px 10px;font-size:13.5px;line-height:1.5;color:#222;align-self:flex-end;max-width:90%;white-space:pre-wrap;word-wrap:break-word;box-shadow:0 1px 1px rgba(0,0,0,.08);position:relative}
    .nf-prev-bubble::after{content:'';position:absolute;top:0;right:-6px;width:0;height:0;border-style:solid;border-width:0 0 8px 7px;border-color:transparent transparent transparent #DCF8C6}
    .nf-prev-time{display:block;text-align:right;font-size:9.5px;color:#888;margin-top:3px;font-weight:500}
    .nf-prev-empty{padding:30px 14px;text-align:center;color:rgba(0,0,0,.4);font-size:12.5px;font-weight:600;align-self:center;background:rgba(255,255,255,.6);border-radius:10px;backdrop-filter:blur(6px);width:80%;margin:0 auto}
    .nf-custom{padding:12px 18px;border-top:1px solid var(--rim);background:var(--surf2);display:none}
    .nf-custom.is-on{display:block}
    .nf-custom textarea{width:100%;background:#fff;border:1.5px solid var(--rim);border-radius:8px;padding:9px 11px;font-family:inherit;font-size:12.5px;color:var(--ink);outline:none;resize:vertical;min-height:70px}
    .nf-custom textarea:focus{border-color:var(--p1);box-shadow:0 0 0 3px rgba(37,99,235,.10)}
    .nf-custom-vars{font-size:10px;color:var(--ink3);margin-bottom:5px;line-height:1.55}
    .nf-custom-vars code{background:#fff;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:700;color:var(--p1);border:1px solid var(--rim)}
    .nf-send-bar{background:linear-gradient(135deg,#25D366 0%,#1FAD55 100%);border-radius:14px;padding:14px 22px;display:flex;align-items:center;justify-content:space-between;gap:14px;box-shadow:0 8px 22px rgba(37,211,102,.32);flex-wrap:wrap}
    .nf-send-info{color:#fff;display:flex;align-items:baseline;gap:8px}
    .nf-send-info b{font-size:24px;font-weight:900;font-family:var(--fd);line-height:1}
    .nf-send-info span{font-size:12.5px;opacity:.92;font-weight:600}
    .nf-send-btn{background:#fff;color:#1FAD55;border:none;font-family:inherit;font-weight:800;font-size:14px;padding:12px 24px;border-radius:50px;cursor:pointer;display:inline-flex;align-items:center;gap:9px;transition:all .2s;box-shadow:0 4px 14px rgba(0,0,0,.12);letter-spacing:-.01em}
    .nf-send-btn:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(0,0,0,.22)}
    .nf-send-btn svg{width:16px;height:16px;fill:#1FAD55}
    .nf-hint{text-align:center;font-size:10.5px;color:var(--ink3);margin-top:7px;font-weight:600}
    .nf-meta{background:linear-gradient(135deg,#FFFBEB 0%,#FEF3C7 100%);border:1px solid #FDE68A;border-radius:11px;padding:11px 15px;font-size:11.5px;color:#92400E;display:flex;align-items:center;gap:9px;font-weight:600;line-height:1.4}
    .nf-history{background:#fff;border:1px solid var(--rim);border-radius:14px;padding:16px 18px;max-height:340px;overflow-y:auto}
    .nf-history h4{font-size:13px;font-weight:800;color:var(--ink);letter-spacing:-.2px;margin:0 0 11px;display:flex;justify-content:space-between;align-items:center}
    .nf-history h4 .bdg{font-size:10px;background:var(--surf2);padding:2px 8px;border-radius:50px;color:var(--ink3);font-weight:700}
  </style>`;

  return styles + `<div class="page">

  ${pageBanner(
    'Comunicaciones · WhatsApp',
    'Notificaciones',
    '<b>'+totalEnviados+'</b> enviados histórico · <b>'+conTelefono.length+'</b> con WhatsApp ('+pctCobertura+'% cobertura)'
  )}

  <div class="nf-flat">

    <!-- 1️⃣ GRUPO + PLANTILLA en una sola fila -->
    <div class="nf-row">
      <div class="nf-row-h">
        <div class="nf-row-t">Grupo destinatario</div>
      </div>
      <div class="nf-row-c nx-seg-grid" id="notif-dest-quick">
        <button type="button" class="nf-chip nx-seg is-active" data-dest="leads" onclick="setNotifDestQuick('leads')">Leads <span class="nf-chip-n nx-seg-count" id="nx-c-leads">0</span></button>
        <button type="button" class="nf-chip nx-seg" data-dest="activos" onclick="setNotifDestQuick('activos')">Activos <span class="nf-chip-n nx-seg-count" id="nx-c-activos">0</span></button>
        <button type="button" class="nf-chip nx-seg" data-dest="proximas" onclick="setNotifDestQuick('proximas')">Cuota pendiente <span class="nf-chip-n nx-seg-count" id="nx-c-proximas">0</span></button>
        <button type="button" class="nf-chip nx-seg" data-dest="mora" onclick="setNotifDestQuick('mora')">En mora <span class="nf-chip-n nx-seg-count" id="nx-c-mora">0</span></button>
      </div>
      <select class="fs" id="notif-dest" style="display:none">
        <option value="leads">Leads sin cuenta activa</option>
        <option value="activos">Clientes activos con cuenta</option>
        <option value="proximas">Clientes con cuota esta semana</option>
        <option value="mora">Clientes en mora</option>
        <option value="especifico">Cliente específico</option>
      </select>
    </div>

    <div class="nf-row">
      <div class="nf-row-h">
        <div class="nf-row-t">Plantilla del mensaje</div>
        <div style="display:flex;gap:5px" id="nx-cat-tabs">
          <button type="button" class="nx-cat-tab is-active" data-cat="all" onclick="setNxCat('all')" style="background:transparent;border:none;color:var(--ink2);font-family:inherit;font-size:11px;font-weight:700;padding:5px 11px;border-radius:50px;cursor:pointer">Todas</button>
          <button type="button" class="nx-cat-tab" data-cat="bienvenida" onclick="setNxCat('bienvenida')" style="background:transparent;border:none;color:var(--ink3);font-family:inherit;font-size:11px;font-weight:700;padding:5px 11px;border-radius:50px;cursor:pointer">Bienvenida</button>
          <button type="button" class="nx-cat-tab" data-cat="pagos" onclick="setNxCat('pagos')" style="background:transparent;border:none;color:var(--ink3);font-family:inherit;font-size:11px;font-weight:700;padding:5px 11px;border-radius:50px;cursor:pointer">Pagos</button>
          <button type="button" class="nx-cat-tab" data-cat="cobranza" onclick="setNxCat('cobranza')" style="background:transparent;border:none;color:var(--ink3);font-family:inherit;font-size:11px;font-weight:700;padding:5px 11px;border-radius:50px;cursor:pointer">Cobranza</button>
          <button type="button" class="nx-cat-tab" data-cat="cierre" onclick="setNxCat('cierre')" style="background:transparent;border:none;color:var(--ink3);font-family:inherit;font-size:11px;font-weight:700;padding:5px 11px;border-radius:50px;cursor:pointer">Cierre</button>
          <button type="button" class="nx-cat-tab" data-cat="otros" onclick="setNxCat('otros')" style="background:transparent;border:none;color:var(--ink3);font-family:inherit;font-size:11px;font-weight:700;padding:5px 11px;border-radius:50px;cursor:pointer">Otros</button>
        </div>
      </div>
      <div class="nf-row-c nx-tpl-grid" id="nx-tpl-grid">
        <button type="button" class="nf-chip nx-tpl-card is-active" data-tipo="lead_bienvenida" data-cat="bienvenida" onclick="setNotifTipo('lead_bienvenida')">Bienvenida Lead</button>
        <button type="button" class="nf-chip nx-tpl-card" data-tipo="bienvenida_activo" data-cat="bienvenida" onclick="setNotifTipo('bienvenida_activo')">Cliente activo</button>
        <button type="button" class="nf-chip nx-tpl-card" data-tipo="cuota" data-cat="pagos" onclick="setNotifTipo('cuota')">Recordatorio cuota</button>
        <button type="button" class="nf-chip nx-tpl-card" data-tipo="confirmado" data-cat="pagos" onclick="setNotifTipo('confirmado')">Pago recibido</button>
        <button type="button" class="nf-chip nx-tpl-card" data-tipo="cuenta" data-cat="pagos" onclick="setNotifTipo('cuenta')">Estado de cuenta</button>
        <button type="button" class="nf-chip nx-tpl-card" data-tipo="mora" data-cat="cobranza" onclick="setNotifTipo('mora')">Aviso de mora</button>
        <button type="button" class="nf-chip nx-tpl-card" data-tipo="mora_grave" data-cat="cobranza" onclick="setNotifTipo('mora_grave')">Mora urgente</button>
        <button type="button" class="nf-chip nx-tpl-card" data-tipo="acuerdo" data-cat="cobranza" onclick="setNotifTipo('acuerdo')">Acuerdo de pago</button>
        <button type="button" class="nf-chip nx-tpl-card" data-tipo="liquidacion" data-cat="cierre" onclick="setNotifTipo('liquidacion')">Liquidación</button>
        <button type="button" class="nf-chip nx-tpl-card" data-tipo="vencimiento" data-cat="cierre" onclick="setNotifTipo('vencimiento')">Vencimiento</button>
        <button type="button" class="nf-chip nx-tpl-card" data-tipo="custom" data-cat="otros" onclick="setNotifTipo('custom')">Personalizado</button>
      </div>
      <select class="fs" id="notif-tipo" style="display:none">
        <option value="lead_bienvenida">Bienvenida Lead</option>
        <option value="bienvenida_activo">Bienvenida Cliente Activo</option>
        <option value="cuota">Recordatorio de Cuota</option>
        <option value="confirmado">Pago Recibido</option>
        <option value="cuenta">Estado de Cuenta Completo</option>
        <option value="acuerdo">Confirmación de Acuerdo de Pago</option>
        <option value="mora">Aviso de Mora</option>
        <option value="mora_grave">Aviso Urgente de Mora</option>
        <option value="liquidacion">Oferta de Liquidación Anticipada</option>
        <option value="vencimiento">Aviso de Vencimiento de Contrato</option>
        <option value="custom">Mensaje Personalizado</option>
      </select>
      <div id="notif-tipo-desc" style="margin-top:11px;font-size:11.5px;color:var(--ink3);padding:9px 13px;background:rgba(37,99,235,.06);border-left:3px solid var(--p1);border-radius:8px;line-height:1.5">Selecciona una plantilla para ver su descripción.</div>
      <div id="notif-custom-wrap" class="nf-custom" style="display:none">
        <div class="nf-custom-vars">Variables: <code>{nombre}</code> <code>{cuota}</code> <code>{mora}</code> <code>{modelo}</code> <code>{cuenta}</code> <code>{empresa}</code> <code>{saldo}</code> <code>{cuotaNum}</code> <code>{totalCuotas}</code> <code>{fechaProx}</code></div>
        <textarea class="fta" id="notif-msg" rows="3" placeholder="Estimado/a {nombre}, le recordamos su próxima cuota de {cuota} con fecha {fechaProx}..."></textarea>
      </div>
    </div>

    <!-- 2️⃣ Lista de destinatarios + Preview WhatsApp -->
    <div class="nf-body">
      <!-- Columna izquierda: lista con buscador -->
      <div class="nf-dest-card">
        <div class="nf-dest-head">
          <div>
            <div class="nf-dest-title" id="nx-ac-list-title">Destinatarios del grupo</div>
            <div style="font-size:10.5px;color:var(--ink3);margin-top:3px;font-weight:600" id="nx-ac-hint">Click en uno para enviar solo a ese cliente</div>
          </div>
          <span class="nf-dest-count" id="nx-ac-list-count">0</span>
        </div>
        <div class="nf-search">
          <span class="nf-search-i nx-ac-icon">⌕</span>
          <input type="text" class="nx-ac-input" id="nx-ac-input" placeholder="Filtrar por nombre, cédula, teléfono o crédito..." autocomplete="off" oninput="nxAcFilter()" onkeydown="nxAcKey(event)">
        </div>
        <div class="nf-list nx-ac-list" id="nx-ac-list" style="position:static !important;display:block !important;border:none !important;background:transparent !important;box-shadow:none !important;max-height:none !important;"></div>
        <div id="nx-ac-selected-wrap"></div>
        <input type="hidden" id="notif-cliente-sel-id" value="">
        <select id="notif-cliente-sel" style="display:none"></select>
        <button type="button" id="nx-ac-modeswitch" onclick="nxAcToggleScope()" style="display:none">Ver todos</button>
        <button type="button" class="nx-ac-clear" id="nx-ac-clear" onclick="nxAcClearInput()" style="display:none">×</button>
      </div>

      <!-- Columna derecha: preview WhatsApp -->
      <div class="nf-prev-card nx-wa-preview">
        <div class="nf-prev-head">
          <div class="nf-prev-title">Vista previa WhatsApp</div>
          <div class="nf-prev-sub">Así lo verá el cliente</div>
        </div>
        <div class="nf-prev-wa">
          <div class="nf-prev-tophead"><div class="av">P</div><div style="display:flex;flex-direction:column;line-height:1.2"><span>Pagasi</span><small style="font-size:10px;opacity:.75">en línea</small></div></div>
          <div class="nf-prev-bubble-wrap">
            <div id="notif-preview" class="nf-prev-bubble nx-wa-bubble" style="display:none"></div>
            <div id="notif-preview-empty" class="nf-prev-empty nx-wa-empty">Selecciona plantilla y destinatario para ver el mensaje aquí</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 3️⃣ Botón gigante de envío -->
    <div class="nf-send-bar">
      <div class="nf-send-info">
        <b id="nx-send-n">0</b>
        <span id="nx-send-lbl">destinatarios listos</span>
      </div>
      <button class="nf-send-btn nx-send-btn" id="notif-send-btn">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        <span>Enviar por WhatsApp</span>
      </button>
    </div>
    <div class="nf-hint">Se abrirán hasta 5 chats a la vez para evitar bloqueos del navegador</div>

    <!-- 4️⃣ Historial (compacto, abajo) -->
    ${(window._notifHistorial||[]).length ? `
    <div class="nf-history">
      <h4>Historial de envíos <span class="bdg">${(window._notifHistorial||[]).length} envíos</span></h4>
      <div class="lst" id="notif-historial">
        ${(window._notifHistorial||[]).map(n=>`<div class="li" style="padding:9px 11px;border-bottom:1px solid var(--rim);display:flex;gap:10px;align-items:flex-start">
          <div style="width:8px;height:8px;border-radius:50%;background:${n.canal==='whatsapp'?'#25D366':'var(--p1)'};flex-shrink:0;margin-top:5px"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:800;color:var(--ink)">${n.tipo}</div>
            <div style="font-size:10.5px;color:var(--ink3);margin-top:2px">${n.dest} — ${n.cantidad} mensaje${n.cantidad!==1?'s':''} — ${n.canal} — ${n.fecha}</div>
            ${n.mensaje?`<div style="margin-top:5px;padding:7px 9px;background:var(--surf2);border:1px solid var(--rim);border-radius:7px;font-size:10.5px;white-space:pre-wrap;line-height:1.4;color:var(--ink)">${String(n.mensaje).replace(/</g,'&lt;')}</div>`:''}
          </div>
          <span class="bdg b-g" style="align-self:flex-start;font-size:9.5px">enviado</span>
        </div>`).join('')}
      </div>
    </div>
    ` : ''}

  </div>

  </div>`;
};
