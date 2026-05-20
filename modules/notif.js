// Pagasi module: notif
PG.notif = function(){
  // Build real recipient lists
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
  }).map(function(c){
    var cl=S.clientes.find(function(x){return x.nombre===c.cli;})||{};
    return {nombre:c.cli, tel:cl.tel||'', cred:c.id, cuota:c.cuotaQ||c.cuota, modelo:c.modelo};
  });

  // ── Segmentos de urgencia ──
  var moraCritica = moraClientes.filter(c=>c.mora>60);
  var moraAlta = moraClientes.filter(c=>c.mora>30 && c.mora<=60);
  var moraMedia = moraClientes.filter(c=>c.mora>15 && c.mora<=30);
  var moraBaja = moraClientes.filter(c=>c.mora>0 && c.mora<=15);
  var clientesActivos = S.clientes.filter(c=>!c.eliminado&&c.estado==='activo');
  var conTelefono = clientesActivos.filter(c=>c.tel&&c.tel.replace(/[^0-9]/g,'').length>=7);
  var sinTelefono = clientesActivos.length - conTelefono.length;
  var pctCobertura = clientesActivos.length>0 ? Math.round(conTelefono.length/clientesActivos.length*100) : 0;

  // ── Historial: envíos por día (últimos 14 días) ──
  var historial = window._notifHistorial || [];
  var hoyNotif = new Date(); hoyNotif.setHours(0,0,0,0);
  var diasNotif = [];
  for(let i=13;i>=0;i--){
    let d = new Date(hoyNotif); d.setDate(d.getDate()-i);
    let k = fechaLocalISO(d);
    let n = historial.filter(h=>h.fecha && h.fecha.startsWith(k)).reduce((a,h)=>a+(h.cantidad||1),0);
    diasNotif.push({lbl:d.getDate(), n});
  }
  var maxNotif = Math.max(1, ...diasNotif.map(d=>d.n));
  var totalEnviados = historial.reduce((a,h)=>a+(h.cantidad||1),0);

  setTimeout(function(){
    renderHistorialNotificaciones();
    var btn=$('notif-send-btn');
    if(btn) btn.onclick=function(){ enviarNotificaciones(); };
    var tipoSel=$('notif-tipo');
    if(tipoSel) tipoSel.onchange=function(){ actualizarPreviewNotif(); actualizarTipoDesc(); };
    var destSel=$('notif-dest');
    if(destSel) destSel.onchange=function(){ actualizarPreviewNotif(); };
    if(typeof nxAcUpdateHint==='function') nxAcUpdateHint();
    actualizarPreviewNotif();
    actualizarTipoDesc();
  }, 80);

  return`<div class="page">

  ${pageBanner(
    'Comunicaciones · WhatsApp',
    'Notificaciones',
    '<b>'+totalEnviados+'</b> mensajes enviados históricamente · <b>'+conTelefono.length+'</b> clientes con WhatsApp (<b>'+pctCobertura+'%</b> cobertura)'
  )}

  <!-- KPIs compactos · segmentos de mora/vencimiento -->
  <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:14px">
    <div class="stat" style="border-top:3px solid var(--red)">
      <div class="st-v" style="color:var(--red);font-size:22px">${moraClientes.length}</div>
      <div class="st-l">En mora</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:3px">${moraCritica.length+moraAlta.length} graves</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--amber)">
      <div class="st-v" style="color:var(--amber);font-size:22px">${proximasCuotas.length}</div>
      <div class="st-l">Vencen 7d</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:3px">Próximas cuotas</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--p1)">
      <div class="st-v" style="color:var(--p1);font-size:22px">${S.creds.filter(c=>c.estado==='activo').length}</div>
      <div class="st-l">Activos</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:3px">Créditos al día</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--green)">
      <div class="st-v" style="color:var(--green);font-size:22px">${conTelefono.length}</div>
      <div class="st-l">Con WhatsApp</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:3px">${pctCobertura}% cobertura</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--ink3)">
      <div class="st-v" style="color:var(--ink3);font-size:22px">${sinTelefono}</div>
      <div class="st-l">Sin teléfono</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:3px">Requieren datos</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--p1)">
      <div class="st-v" style="color:var(--p1);font-size:22px">${totalEnviados}</div>
      <div class="st-l">Enviados histórico</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:3px">Todos los canales</div>
    </div>
  </div>

  <!-- Segmentos por urgencia + actividad 14 días -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">

    <div class="card">
      <div class="ch"><div><div class="ct">Segmentos por urgencia</div><div class="cs">Usa los botones de abajo para notificar a cada grupo</div></div></div>
      <div style="display:flex;flex-direction:column;gap:7px;margin-top:10px">
        ${[
          ['Crítico · +60 días de atraso', moraCritica.length, '#8B0000', 'rgba(139,0,0,.08)','mora_grave'],
          ['Alta · 31 a 60 días', moraAlta.length, 'var(--red)', 'rgba(217,59,90,.07)','mora_grave'],
          ['Media · 16 a 30 días', moraMedia.length, 'var(--amber)', 'var(--ambers)','mora'],
          ['Baja · 1 a 15 días', moraBaja.length, 'var(--amber)', 'rgba(232,152,10,.05)','mora'],
          ['Cuotas esta semana', proximasCuotas.length, 'var(--p1)', 'var(--gs)','cuota'],
        ].map(function(row){
          var lbl=row[0], n=row[1], col=row[2], bg=row[3];
          var disabled = n===0;
          return '<div style="display:flex;align-items:center;gap:10px;padding:10px 13px;background:'+bg+';border:1px solid var(--rim);border-radius:10px;'+(disabled?'opacity:.5':'')+'">'
            +'<div style="width:36px;height:36px;border-radius:9px;background:'+col+';color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;flex-shrink:0">'+n+'</div>'
            +'<div style="flex:1;min-width:0;font-size:12.5px;font-weight:700">'+lbl+'</div>'
            +'</div>';
        }).join('')}
      </div>
    </div>

    <div class="card">
      <div class="ch"><div><div class="ct">Actividad últimos 14 días</div><div class="cs">Mensajes enviados por día</div></div>
        <div style="font-weight:900;font-size:18px;color:var(--p1);font-family:var(--fd)">${diasNotif.reduce((a,d)=>a+d.n,0)}</div>
      </div>
      <div style="display:flex;align-items:flex-end;gap:3px;height:130px;margin-top:14px">
        ${diasNotif.map(d=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
          <div style="font-size:9px;font-weight:800;color:${d.n>0?'var(--p1)':'var(--ink3)'};height:12px">${d.n>0?d.n:''}</div>
          <div style="flex:1;width:100%;display:flex;align-items:flex-end">
            <div style="width:100%;background:${d.n>0?'linear-gradient(180deg,var(--p1),#60A5FA)':'var(--rim)'};border-radius:3px 3px 0 0;height:${d.n>0?Math.max(8,Math.round(d.n/maxNotif*100)):4}px;transition:height .3s"></div>
          </div>
          <div style="font-size:9px;color:var(--ink3);font-weight:600">${d.lbl}</div>
        </div>`).join('')}
      </div>
      ${totalEnviados===0?'<div style="text-align:center;color:var(--ink3);font-size:11.5px;margin-top:12px;padding:10px;background:var(--gs);border-radius:8px;border:1px dashed var(--rim2)">Aún no has enviado notificaciones. Usa el panel de abajo para empezar.</div>':''}
    </div>

  </div>

  <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:14px">

  <!-- Panel izquierdo: Formulario -->
  <div class="card">
    <div class="ch" style="border-bottom:2px solid var(--rim);padding-bottom:10px;margin-bottom:14px">
      <div>
        <div class="ct" style="font-size:14px">Nuevo envío</div>
        <div style="font-size:11px;color:var(--ink3)">Elige plantilla, destinatarios y envía por WhatsApp</div>
      </div>
    </div>

    <!-- PASO 1: Plantilla -->
    <div class="nx-step">
      <div class="nx-step-head">
        <div class="nx-step-num">1</div>
        <div class="nx-step-title">Plantilla</div>
        <div class="nx-step-sub" id="nx-tpl-counter">Selecciona una</div>
      </div>

      <div class="nx-cat-tabs" id="nx-cat-tabs">
        <button type="button" class="nx-cat-tab is-active" data-cat="all" onclick="setNxCat('all')">Todas</button>
        <button type="button" class="nx-cat-tab" data-cat="bienvenida" onclick="setNxCat('bienvenida')">Bienvenida</button>
        <button type="button" class="nx-cat-tab" data-cat="pagos" onclick="setNxCat('pagos')">Pagos</button>
        <button type="button" class="nx-cat-tab" data-cat="cobranza" onclick="setNxCat('cobranza')">Cobranza</button>
        <button type="button" class="nx-cat-tab" data-cat="cierre" onclick="setNxCat('cierre')">Cierre</button>
        <button type="button" class="nx-cat-tab" data-cat="otros" onclick="setNxCat('otros')">Otros</button>
      </div>

      <div class="nx-tpl-grid" id="nx-tpl-grid">
        <button type="button" class="nx-tpl-card is-active" data-tipo="lead_bienvenida" data-cat="bienvenida" onclick="setNotifTipo('lead_bienvenida')">
          <div class="nx-tpl-head">
            <div class="nx-tpl-icon" style="background:rgba(37,99,235,.12);color:var(--p1)"></div>
            <div class="nx-tpl-name">Bienvenida Lead</div>
          </div>
          <div class="nx-tpl-desc">Saludo formal al nuevo interesado</div>
        </button>
        <button type="button" class="nx-tpl-card" data-tipo="bienvenida_activo" data-cat="bienvenida" onclick="setNotifTipo('bienvenida_activo')">
          <div class="nx-tpl-head">
            <div class="nx-tpl-icon" style="background:rgba(37,99,235,.12);color:var(--p1)"></div>
            <div class="nx-tpl-name">Cliente activo</div>
          </div>
          <div class="nx-tpl-desc">Para clientes con cuenta aprobada</div>
        </button>
        <button type="button" class="nx-tpl-card" data-tipo="cuota" data-cat="pagos" onclick="setNotifTipo('cuota')">
          <div class="nx-tpl-head">
            <div class="nx-tpl-icon" style="background:rgba(37,99,235,.12);color:var(--p1)"></div>
            <div class="nx-tpl-name">Recordatorio cuota</div>
          </div>
          <div class="nx-tpl-desc">Aviso corto antes del vencimiento</div>
        </button>
        <button type="button" class="nx-tpl-card" data-tipo="confirmado" data-cat="pagos" onclick="setNotifTipo('confirmado')">
          <div class="nx-tpl-head">
            <div class="nx-tpl-icon" style="background:rgba(39,174,96,.14);color:#27ae60"></div>
            <div class="nx-tpl-name">Pago recibido</div>
          </div>
          <div class="nx-tpl-desc">Confirma recepción y próxima fecha</div>
        </button>
        <button type="button" class="nx-tpl-card" data-tipo="cuenta" data-cat="pagos" onclick="setNotifTipo('cuenta')">
          <div class="nx-tpl-head">
            <div class="nx-tpl-icon" style="background:rgba(37,99,235,.12);color:var(--p1)"></div>
            <div class="nx-tpl-name">Estado de cuenta</div>
          </div>
          <div class="nx-tpl-desc">Resumen completo de su plan</div>
        </button>
        <button type="button" class="nx-tpl-card" data-tipo="mora" data-cat="cobranza" onclick="setNotifTipo('mora')">
          <div class="nx-tpl-head">
            <div class="nx-tpl-icon" style="background:rgba(232,152,10,.14);color:var(--amber)">️</div>
            <div class="nx-tpl-name">Aviso de mora</div>
          </div>
          <div class="nx-tpl-desc">Notifica atraso con datos completos</div>
        </button>
        <button type="button" class="nx-tpl-card" data-tipo="mora_grave" data-cat="cobranza" onclick="setNotifTipo('mora_grave')">
          <div class="nx-tpl-head">
            <div class="nx-tpl-icon" style="background:rgba(217,59,90,.14);color:var(--red)"></div>
            <div class="nx-tpl-name">Mora urgente</div>
          </div>
          <div class="nx-tpl-desc">Aviso por mora prolongada</div>
        </button>
        <button type="button" class="nx-tpl-card" data-tipo="acuerdo" data-cat="cobranza" onclick="setNotifTipo('acuerdo')">
          <div class="nx-tpl-head">
            <div class="nx-tpl-icon" style="background:rgba(37,99,235,.12);color:var(--p1)"></div>
            <div class="nx-tpl-name">Acuerdo de pago</div>
          </div>
          <div class="nx-tpl-desc">Formaliza el acuerdo por escrito</div>
        </button>
        <button type="button" class="nx-tpl-card" data-tipo="liquidacion" data-cat="cierre" onclick="setNotifTipo('liquidacion')">
          <div class="nx-tpl-head">
            <div class="nx-tpl-icon" style="background:rgba(39,174,96,.14);color:#27ae60"></div>
            <div class="nx-tpl-name">Liquidación</div>
          </div>
          <div class="nx-tpl-desc">Oferta de cancelación anticipada</div>
        </button>
        <button type="button" class="nx-tpl-card" data-tipo="vencimiento" data-cat="cierre" onclick="setNotifTipo('vencimiento')">
          <div class="nx-tpl-head">
            <div class="nx-tpl-icon" style="background:rgba(232,152,10,.14);color:var(--amber)"></div>
            <div class="nx-tpl-name">Vencimiento</div>
          </div>
          <div class="nx-tpl-desc">Alerta fin de contrato próximo</div>
        </button>
        <button type="button" class="nx-tpl-card" data-tipo="custom" data-cat="otros" onclick="setNotifTipo('custom')">
          <div class="nx-tpl-head">
            <div class="nx-tpl-icon" style="background:var(--surf2);color:var(--ink2)">️</div>
            <div class="nx-tpl-name">Personalizado</div>
          </div>
          <div class="nx-tpl-desc">Escribe tu propio mensaje</div>
        </button>
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

      <div id="notif-tipo-desc" style="margin-top:10px;font-size:11.5px;color:var(--ink3);padding:8px 10px;background:var(--surf2);border-radius:8px;border-left:3px solid var(--p1);line-height:1.4">
        Selecciona una plantilla para ver su descripción.
      </div>

      <div id="notif-custom-wrap" style="display:none;margin-top:10px">
        <div style="font-size:11px;color:var(--ink3);margin-bottom:6px">Variables disponibles: <code>{nombre}</code> <code>{cuota}</code> <code>{mora}</code> <code>{modelo}</code> <code>{cuenta}</code> <code>{empresa}</code> <code>{saldo}</code> <code>{cuotaNum}</code> <code>{totalCuotas}</code> <code>{fechaProx}</code></div>
        <textarea class="fta" id="notif-msg" rows="4" placeholder="Estimado/a {nombre}, le recordamos su próxima cuota de {cuota} con fecha {fechaProx}..."></textarea>
      </div>
    </div>

    <!-- PASO 2: Destinatarios -->
    <div class="nx-step">
      <div class="nx-step-head">
        <div class="nx-step-num">2</div>
        <div class="nx-step-title">Destinatarios</div>
        <div class="nx-step-sub" id="nx-dest-counter">0 destinatarios</div>
      </div>

      <div class="nx-seg-grid" id="notif-dest-quick">
        <button type="button" class="nx-seg is-active" data-dest="leads" onclick="setNotifDestQuick('leads')">
          <div class="nx-seg-count" id="nx-c-leads">0</div>
          <div class="nx-seg-info"><div class="nx-seg-lbl">Leads</div><div class="nx-seg-hint">Sin cuenta activa</div></div>
        </button>
        <button type="button" class="nx-seg" data-dest="activos" onclick="setNotifDestQuick('activos')">
          <div class="nx-seg-count" id="nx-c-activos">0</div>
          <div class="nx-seg-info"><div class="nx-seg-lbl">Activos</div><div class="nx-seg-hint">Con cuenta aprobada</div></div>
        </button>
        <button type="button" class="nx-seg" data-dest="proximas" onclick="setNotifDestQuick('proximas')">
          <div class="nx-seg-count" id="nx-c-proximas">0</div>
          <div class="nx-seg-info"><div class="nx-seg-lbl">Cuota pendiente</div><div class="nx-seg-hint">Vencen esta semana</div></div>
        </button>
        <button type="button" class="nx-seg" data-dest="mora" onclick="setNotifDestQuick('mora')">
          <div class="nx-seg-count" id="nx-c-mora">0</div>
          <div class="nx-seg-info"><div class="nx-seg-lbl">En mora</div><div class="nx-seg-hint">Con atraso</div></div>
        </button>
      </div>

      <select class="fs" id="notif-dest" style="display:none">
        <option value="leads">Leads sin cuenta activa</option>
        <option value="activos">Clientes activos con cuenta</option>
        <option value="proximas">Clientes con cuota esta semana</option>
        <option value="mora">Clientes en mora</option>
        <option value="especifico">Cliente específico</option>
      </select>

      <!-- Buscador: siempre visible. Filtra dentro del segmento. Si seleccionas uno, se envía solo a ese. -->
      <div style="margin-top:4px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div style="font-size:11px;color:var(--ink3);font-weight:600" id="nx-ac-hint">O busca un cliente específico dentro del grupo</div>
          <button type="button" id="nx-ac-modeswitch" onclick="nxAcToggleScope()" style="border:none;background:transparent;color:var(--p1);font-size:11px;font-weight:700;cursor:pointer;padding:2px 6px;border-radius:6px">Ver todos</button>
        </div>
        <div class="nx-ac-wrap">
          <span class="nx-ac-icon"></span>
          <input type="text" class="nx-ac-input" id="nx-ac-input" placeholder="Busca por nombre, cuenta, teléfono o cédula..." autocomplete="off" oninput="nxAcFilter()" onfocus="nxAcOpen()" onkeydown="nxAcKey(event)">
          <button type="button" class="nx-ac-clear" id="nx-ac-clear" onclick="nxAcClearInput()">×</button>
          <div class="nx-ac-list" id="nx-ac-list"></div>
        </div>
        <div id="nx-ac-selected-wrap"></div>
        <input type="hidden" id="notif-cliente-sel-id" value="">
        <select id="notif-cliente-sel" style="display:none"></select>
      </div>
    </div>

    <!-- PASO 3: Preview -->
    <div class="nx-step">
      <div class="nx-step-head">
        <div class="nx-step-num">3</div>
        <div class="nx-step-title">Vista previa</div>
        <div class="nx-step-sub">Así lo verá el cliente</div>
      </div>
      <div class="nx-wa-preview">
        <div id="notif-preview" class="nx-wa-bubble" style="display:none"></div>
        <div id="notif-preview-empty" class="nx-wa-empty">Selecciona una plantilla para ver el mensaje…</div>
      </div>
    </div>

    <!-- Barra de envío -->
    <div class="nx-send-bar">
      <div class="nx-send-count">
        <b id="nx-send-n">0</b>
        <span id="nx-send-lbl">destinatarios listos</span>
      </div>
      <button class="nx-send-btn" id="notif-send-btn">
        <span style="font-size:15px"></span>
        <span>Enviar por WhatsApp</span>
      </button>
    </div>
    <div style="text-align:center;font-size:10.5px;color:var(--ink3);margin-top:6px">
      Se abrirán hasta 5 chats a la vez para evitar bloqueos del navegador
    </div>
  </div>

  <!-- Panel derecho: Historial -->
  <div class="card">
    <div class="ch" style="border-bottom:2px solid var(--rim);padding-bottom:10px;margin-bottom:14px">
      <div>
        <div class="ct" style="font-size:14px">Historial de Envios</div>
        <div style="font-size:11px;color:var(--ink3)">Registro de todas las notificaciones enviadas</div>
      </div>
    </div>

    <!-- Clientes sin teléfono -->
    ${(function(){
      var sinTel=S.clientes.filter(c=>!c.eliminado&&(!c.tel||c.tel.replace(/[^0-9]/g,'').length<7));
      if(!sinTel.length) return '';
      return '<div style="padding:10px 12px;background:rgba(240,150,50,0.08);border:1px solid rgba(240,150,50,0.3);border-radius:8px;margin-bottom:12px">'
        +'<div style="font-size:11px;font-weight:800;color:var(--amber);margin-bottom:4px">ATENCION: '+sinTel.length+' cliente'+(sinTel.length!==1?'s':'')+' sin telefono registrado</div>'
        +'<div style="font-size:10.5px;color:var(--ink3)">'+sinTel.slice(0,3).map(function(c){ return ((c&&c.nombre)||'Cliente').split(' ')[0]; }).join(', ')+(sinTel.length>3?' y '+(sinTel.length-3)+' mas':'')+' — Agregaelos en la ficha del cliente.</div>'
        +'</div>';
    })()}

    <div class="lst" id="notif-historial" style="max-height:480px">
      ${(window._notifHistorial||[]).length
        ? (window._notifHistorial||[]).map(n=>`<div class="li" style="padding:10px 12px;border-bottom:1px solid var(--rim)">
            <div style="width:10px;height:10px;border-radius:50%;background:${n.canal==='whatsapp'?'#25D366':'var(--p1)'};flex-shrink:0;margin-top:4px"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:800;color:var(--ink)">${n.tipo}</div>
              <div style="font-size:11px;color:var(--ink3);margin-top:2px">${n.dest} — ${n.cantidad} mensaje${n.cantidad!==1?'s':''} — ${n.canal}</div>
              <div style="font-size:10.5px;color:var(--ink3)">${n.fecha}</div>
              ${n.mensaje?`<div style="margin-top:6px;padding:8px 10px;background:var(--surf2);border:1px solid var(--rim);border-radius:8px;font-size:11px;white-space:pre-wrap;line-height:1.45;color:var(--ink)">${String(n.mensaje).replace(/</g,'&lt;')}</div>`:''}
            </div>
            <span class="bdg b-g" style="align-self:flex-start">enviado</span>
          </div>`).join('')
        : '<div style="text-align:center;padding:40px 20px"><div style="font-weight:700;font-size:13px;color:var(--ink2);margin-bottom:4px">Sin envios registrados</div><div style="font-size:12px;color:var(--ink3)">Los mensajes enviados apareceran aqui con fecha y detalles.</div></div>'}
    </div>
  </div>

  </div></div>`;};


