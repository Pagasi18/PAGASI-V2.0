// Pagasi module: notif — Rediseño 2026-05 v3 · Simplificado
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
    if(tipoSel) tipoSel.onchange=function(){ setNotifTipo(this.value); };
    var destSel=$('notif-dest');
    if(destSel) destSel.onchange=function(){ actualizarPreviewNotif(); };
    if(typeof nxAcUpdateHint==='function') nxAcUpdateHint();
    if(typeof nxAcGetClientsForScope==='function' && typeof nxAcRender==='function'){
      try { _nxAcResults = nxAcGetClientsForScope(); nxAcRender(); } catch(e){}
    }
    actualizarPreviewNotif();
    actualizarTipoDesc();
  }, 80);

  // CSS limpio y compacto
  var styles = `<style>
    .nf2{display:grid;grid-template-columns:1fr;gap:14px}
    .nf2-cfg{background:#fff;border:1px solid var(--rim);border-radius:14px;padding:16px 18px;display:grid;grid-template-columns:1.4fr 1fr;gap:18px;align-items:start}
    @media(max-width:860px){.nf2-cfg{grid-template-columns:1fr}}
    .nf2-cfg.nf2-cfg-solo{grid-template-columns:1fr;max-width:640px}
    .nf2-cfg-section{display:flex;flex-direction:column;gap:10px;min-width:0}
    .nf2-label{font-size:10.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);display:flex;align-items:center;gap:7px}
    .nf2-label::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--p1);display:inline-block}
    .nf2-grp{display:flex;gap:6px;flex-wrap:wrap}
    .nf2-grp-chip{background:var(--surf2);border:1.5px solid var(--rim);color:var(--ink2);font-family:inherit;font-size:12.5px;font-weight:700;padding:8px 14px;border-radius:50px;cursor:pointer;transition:all .15s;display:inline-flex;align-items:center;gap:7px;letter-spacing:-.01em;line-height:1}
    .nf2-grp-chip:hover{border-color:var(--p1);color:var(--p1);background:var(--gs)}
    .nf2-grp-chip.is-active{background:var(--p1);border-color:var(--p1);color:#fff;box-shadow:0 3px 10px rgba(37,99,235,.25)}
    .nf2-grp-chip .nf2-n{background:rgba(0,0,0,.08);font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:50px;min-width:22px;text-align:center;line-height:1.3}
    .nf2-grp-chip.is-active .nf2-n{background:rgba(255,255,255,.22);color:#fff}
    .nf2-sel{position:relative}
    .nf2-sel select{appearance:none;-webkit-appearance:none;background:#fff url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='%236b7280' d='M6 8L0 0h12z'/></svg>") no-repeat right 14px center;border:1.5px solid var(--rim);border-radius:10px;padding:11px 38px 11px 14px;font-family:inherit;font-size:13.5px;font-weight:700;color:var(--ink);width:100%;cursor:pointer;outline:none;transition:.15s;letter-spacing:-.01em}
    .nf2-sel select:hover{border-color:var(--p1)}
    .nf2-sel select:focus{border-color:var(--p1);box-shadow:0 0 0 3px rgba(37,99,235,.10)}
    .nf2-sel optgroup{font-weight:800;color:var(--ink3);font-style:normal}
    .nf2-desc{font-size:11.5px;color:var(--ink3);padding:8px 12px;background:rgba(37,99,235,.06);border-left:3px solid var(--p1);border-radius:8px;line-height:1.5;min-height:18px}
    .nf2-body{display:grid;grid-template-columns:1.7fr 1fr;gap:14px;align-items:start}
    @media(max-width:980px){.nf2-body{grid-template-columns:1fr}}
    .nf2-list{background:#fff;border:1px solid var(--rim);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;height:460px}
    .nf2-list-head{padding:12px 16px;background:linear-gradient(180deg,#FAFBFF,#F5F7FF);border-bottom:1px solid var(--rim);display:flex;justify-content:space-between;align-items:center;gap:10px}
    .nf2-list-t{font-size:13px;font-weight:800;color:var(--ink);letter-spacing:-.2px}
    .nf2-list-c{background:var(--p1);color:#fff;padding:3px 10px;border-radius:50px;font-size:11px;font-weight:800;letter-spacing:.04em}
    .nf2-search{padding:10px 14px;border-bottom:1px solid var(--rim);position:relative}
    .nf2-search input{width:100%;padding:9px 12px 9px 34px;border:1.5px solid var(--rim);border-radius:9px;font-family:inherit;font-size:13px;font-weight:600;background:var(--surf);outline:none;transition:.15s}
    .nf2-search input:focus{border-color:var(--p1);background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.10)}
    .nf2-search-i{position:absolute;left:26px;top:50%;transform:translateY(-50%);color:var(--ink4);font-size:13px;pointer-events:none}
    .nf2-solo{padding:10px 14px;background:linear-gradient(90deg,rgba(37,99,235,.10),rgba(37,99,235,.04));border-bottom:1px solid var(--rim);display:flex;align-items:center;gap:10px}
    .nf2-solo-av{width:28px;height:28px;border-radius:50%;background:var(--p1);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;flex-shrink:0}
    .nf2-solo-info{flex:1;min-width:0}
    .nf2-solo-bdg{display:inline-block;background:var(--p1);color:#fff;font-size:9px;font-weight:900;padding:1px 6px;border-radius:4px;letter-spacing:.4px;margin-right:5px;vertical-align:middle}
    .nf2-solo-n{font-size:12.5px;font-weight:800;color:var(--ink)}
    .nf2-solo-m{font-size:10.5px;color:var(--ink3);font-weight:600;margin-top:1px}
    .nf2-solo-x{border:none;background:transparent;color:var(--ink3);cursor:pointer;font-size:20px;padding:0 4px;line-height:1;font-weight:300}
    .nf2-solo-x:hover{color:var(--red)}
    .nf2-list-scroll{flex:1;overflow-y:auto}
    .nf2-list-foot{padding:8px 14px;border-top:1px solid var(--rim);background:var(--surf);font-size:10.5px;color:var(--ink3);font-weight:600;text-align:center}
    .nf2-list-foot a{color:var(--p1);font-weight:700;cursor:pointer;text-decoration:none}
    .nf2-list-foot a:hover{text-decoration:underline}

    .nf2-prev{background:#fff;border:1px solid var(--rim);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;height:460px}
    .nf2-prev-h{padding:12px 16px;background:linear-gradient(180deg,#FAFBFF,#F5F7FF);border-bottom:1px solid var(--rim)}
    .nf2-prev-t{font-size:13px;font-weight:800;color:var(--ink);letter-spacing:-.2px}
    .nf2-prev-s{font-size:10.5px;color:var(--ink3);margin-top:2px;font-weight:600}
    .nf2-prev-wa{flex:1;background:linear-gradient(180deg,#E5DDD5 0%,#D9D2CB 100%);padding:14px;display:flex;flex-direction:column;position:relative;overflow:hidden}
    .nf2-prev-wa::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle,rgba(0,0,0,.04) 1px,transparent 1px);background-size:14px 14px;pointer-events:none}
    .nf2-prev-bw{flex:1;display:flex;flex-direction:column;justify-content:flex-end;position:relative;z-index:1;overflow-y:auto}
    .nf2-prev-bubble{background:#DCF8C6;padding:9px 12px 16px;border-radius:10px 10px 2px 10px;font-size:13px;line-height:1.5;color:#222;align-self:flex-end;max-width:94%;white-space:pre-wrap;word-wrap:break-word;box-shadow:0 1px 1px rgba(0,0,0,.08);position:relative}
    .nf2-prev-bubble::after{content:'';position:absolute;top:0;right:-6px;width:0;height:0;border-style:solid;border-width:0 0 8px 7px;border-color:transparent transparent transparent #DCF8C6}
    .nf2-prev-bubble .nx-wa-time{position:absolute;bottom:4px;right:10px;font-size:10px;color:#667781;font-weight:500}
    .nf2-prev-time{display:block;text-align:right;font-size:9.5px;color:#888;margin-top:3px;font-weight:500}
    .nf2-prev-empty{padding:24px 14px;text-align:center;color:rgba(0,0,0,.4);font-size:12px;font-weight:600;align-self:center;background:rgba(255,255,255,.6);border-radius:10px;backdrop-filter:blur(6px);width:80%;margin:auto}

    .nf2-custom{padding:11px 16px;border-top:1px solid var(--rim);background:var(--surf2);display:none}
    .nf2-custom.is-on{display:block}
    .nf2-custom-vars{font-size:10px;color:var(--ink3);margin-bottom:5px;line-height:1.55}
    .nf2-custom-vars code{background:#fff;padding:1px 5px;border-radius:4px;font-size:10px;font-weight:700;color:var(--p1);border:1px solid var(--rim)}
    .nf2-custom textarea{width:100%;background:#fff;border:1.5px solid var(--rim);border-radius:8px;padding:9px 11px;font-family:inherit;font-size:12.5px;color:var(--ink);outline:none;resize:vertical;min-height:60px}

    .nf2-send{background:linear-gradient(135deg,#25D366 0%,#1FAD55 100%);border-radius:14px;padding:14px 22px;display:flex;align-items:center;justify-content:space-between;gap:14px;box-shadow:0 8px 22px rgba(37,211,102,.30);flex-wrap:wrap}
    .nf2-send-info{color:#fff;display:flex;align-items:baseline;gap:8px}
    .nf2-send-info b{font-size:22px;font-weight:900;font-family:var(--fd);line-height:1}
    .nf2-send-info span{font-size:12.5px;opacity:.94;font-weight:600}
    .nf2-send-btn{background:#fff;color:#1FAD55;border:none;font-family:inherit;font-weight:800;font-size:14px;padding:11px 22px;border-radius:50px;cursor:pointer;display:inline-flex;align-items:center;gap:9px;transition:all .2s;box-shadow:0 4px 14px rgba(0,0,0,.12);letter-spacing:-.01em}
    .nf2-send-btn:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(0,0,0,.22)}
    .nf2-send-btn svg{width:15px;height:15px;fill:#1FAD55}
    .nf2-hint{text-align:center;font-size:10.5px;color:var(--ink3);font-weight:600;margin-top:-6px}

    .nf2-history{background:#fff;border:1px solid var(--rim);border-radius:14px;padding:14px 18px;max-height:320px;overflow-y:auto}
    .nf2-history h4{font-size:13px;font-weight:800;color:var(--ink);letter-spacing:-.2px;margin:0 0 10px;display:flex;justify-content:space-between;align-items:center}
    .nf2-history h4 .bdg{font-size:10px;background:var(--surf2);padding:2px 8px;border-radius:50px;color:var(--ink3);font-weight:700}
  </style>`;

  return styles + `<div class="page">

  ${pageBanner(
    'Comunicaciones · WhatsApp',
    'Notificaciones',
    '<b>'+totalEnviados+'</b> enviados histórico · <b>'+conTelefono.length+'</b> con WhatsApp ('+pctCobertura+'% cobertura)'
  )}

  <div class="nf2">

    <!-- ░░░ CONFIG: SOLO mensaje. El grupo se infiere automáticamente. ░░░ -->
    <div class="nf2-cfg nf2-cfg-solo">
      <div class="nf2-cfg-section">
        <div class="nf2-label">Mensaje a enviar</div>
        <div class="nf2-sel">
          <select id="notif-tipo" onchange="setNotifTipo(this.value)">
            <optgroup label="Bienvenida">
              <option value="lead_bienvenida">Bienvenida Lead</option>
              <option value="bienvenida_activo">Bienvenida Cliente Activo</option>
            </optgroup>
            <optgroup label="Pagos">
              <option value="cuota">Recordatorio de cuota</option>
              <option value="confirmado">Pago recibido</option>
              <option value="cuenta">Estado de cuenta</option>
            </optgroup>
            <optgroup label="Cobranza">
              <option value="mora">Aviso de mora</option>
              <option value="mora_grave">Mora urgente</option>
              <option value="acuerdo">Acuerdo de pago</option>
            </optgroup>
            <optgroup label="Cierre">
              <option value="liquidacion">Liquidación anticipada</option>
              <option value="vencimiento">Vencimiento de contrato</option>
            </optgroup>
            <optgroup label="Otros">
              <option value="custom">Mensaje personalizado</option>
            </optgroup>
          </select>
        </div>
        <div id="notif-tipo-desc" class="nf2-desc">Selecciona una plantilla para ver su descripción.</div>
        <div id="notif-custom-wrap" class="nf2-custom" style="display:none">
          <div class="nf2-custom-vars">Variables: <code>{nombre}</code> <code>{cuota}</code> <code>{mora}</code> <code>{modelo}</code> <code>{cuenta}</code> <code>{empresa}</code> <code>{cuotaNum}</code> <code>{totalCuotas}</code> <code>{fechaProx}</code></div>
          <textarea class="fta" id="notif-msg" rows="3" placeholder="Estimado/a {nombre}, le recordamos su próxima cuota de {cuota} con fecha {fechaProx}..."></textarea>
        </div>
      </div>
      <!-- select de destino oculto, lo setea setNotifTipo automáticamente -->
      <select class="fs" id="notif-dest" style="display:none">
        <option value="leads">Leads sin cuenta activa</option>
        <option value="activos">Clientes activos con cuenta</option>
        <option value="proximas">Clientes con cuota esta semana</option>
        <option value="mora">Clientes en mora</option>
        <option value="especifico">Cliente específico</option>
      </select>
      <!-- chips ocultos para compatibilidad con código viejo que lee data-dest -->
      <div id="notif-dest-quick" style="display:none">
        <button type="button" data-dest="leads" class="nx-seg"><span class="nx-seg-count" id="nx-c-leads">0</span></button>
        <button type="button" data-dest="activos" class="nx-seg"><span class="nx-seg-count" id="nx-c-activos">0</span></button>
        <button type="button" data-dest="proximas" class="nx-seg"><span class="nx-seg-count" id="nx-c-proximas">0</span></button>
        <button type="button" data-dest="mora" class="nx-seg"><span class="nx-seg-count" id="nx-c-mora">0</span></button>
      </div>
    </div>

    <!-- ░░░ BODY: lista ancha + preview ░░░ -->
    <div class="nf2-body">

      <!-- LISTA -->
      <div class="nf2-list">
        <div class="nf2-list-head">
          <div class="nf2-list-t" id="nx-ac-list-title">Destinatarios</div>
          <span class="nf2-list-c" id="nx-ac-list-count">0</span>
        </div>
        <div class="nf2-search">
          <span class="nf2-search-i nx-ac-icon">⌕</span>
          <input type="text" class="nx-ac-input" id="nx-ac-input" placeholder="Buscar por nombre, cédula, teléfono o crédito..." autocomplete="off" oninput="nxAcFilter()" onkeydown="nxAcKey(event)">
        </div>
        <div id="nx-ac-selected-wrap"></div>
        <div class="nf2-list-scroll nx-ac-list" id="nx-ac-list" style="position:static !important;display:block !important;border:none !important;background:transparent !important;box-shadow:none !important;max-height:none !important;"></div>
        <div class="nf2-list-foot" id="nx-ac-hint">Click en un cliente para enviar solo a ese · sin click envía a todo el grupo</div>
        <input type="hidden" id="notif-cliente-sel-id" value="">
        <select id="notif-cliente-sel" style="display:none"></select>
        <button type="button" id="nx-ac-modeswitch" onclick="nxAcToggleScope()" style="display:none">Ver todos</button>
        <button type="button" class="nx-ac-clear" id="nx-ac-clear" onclick="nxAcClearInput()" style="display:none">×</button>
      </div>

      <!-- PREVIEW -->
      <div class="nf2-prev">
        <div class="nf2-prev-h">
          <div class="nf2-prev-t">Vista previa</div>
          <div class="nf2-prev-s">Así lo verá el cliente</div>
        </div>
        <div class="nf2-prev-wa">
          <div class="nf2-prev-bw">
            <div id="notif-preview" class="nf2-prev-bubble" style="display:none"></div>
            <div id="notif-preview-empty" class="nf2-prev-empty">Selecciona plantilla y destinatario</div>
          </div>
        </div>
      </div>

    </div>

    <!-- ░░░ BOTÓN ENVÍO ░░░ -->
    <div class="nf2-send">
      <div class="nf2-send-info">
        <b id="nx-send-n">0</b>
        <span id="nx-send-lbl">destinatarios listos</span>
      </div>
      <button class="nf2-send-btn nx-send-btn" id="notif-send-btn">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        <span>Enviar por WhatsApp</span>
      </button>
    </div>
    <div class="nf2-hint">Se abrirán hasta 5 chats a la vez para evitar bloqueos del navegador</div>

    <!-- ░░░ HISTORIAL ░░░ -->
    ${(window._notifHistorial||[]).length ? `
    <div class="nf2-history">
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
