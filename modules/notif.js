// Pagasi module: notif — Rediseño 2026-05 · Nuevo envío como protagonista
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
  }).map(function(c){
    var cl=S.clientes.find(function(x){return x.nombre===c.cli;})||{};
    return {nombre:c.cli, tel:cl.tel||'', cred:c.id, cuota:c.cuotaQ||c.cuota, modelo:c.modelo};
  });

  var moraCritica = moraClientes.filter(c=>c.mora>60);
  var moraAlta = moraClientes.filter(c=>c.mora>30 && c.mora<=60);
  var moraMedia = moraClientes.filter(c=>c.mora>15 && c.mora<=30);
  var moraBaja = moraClientes.filter(c=>c.mora>0 && c.mora<=15);
  var clientesActivos = S.clientes.filter(c=>!c.eliminado&&c.estado==='activo');
  var conTelefono = clientesActivos.filter(c=>c.tel&&c.tel.replace(/[^0-9]/g,'').length>=7);
  var sinTelefono = clientesActivos.length - conTelefono.length;
  var pctCobertura = clientesActivos.length>0 ? Math.round(conTelefono.length/clientesActivos.length*100) : 0;
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
  var enviadosHoy = diasNotif[diasNotif.length-1].n;
  var enviados7d = diasNotif.slice(-7).reduce((a,d)=>a+d.n,0);

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
    // Poblar lista permanente de destinatarios desde el inicio
    if(typeof nxAcGetClientsForScope==='function' && typeof nxAcRender==='function'){
      try { _nxAcResults = nxAcGetClientsForScope(); nxAcRender(); } catch(e){}
    }
    actualizarPreviewNotif();
    actualizarTipoDesc();
  }, 80);

  // ──────────── CSS PERSONALIZADO ────────────
  var customStyles = `<style>
    .notif-hero{background:linear-gradient(180deg,#fff 0%,#FAFBFF 100%);border:1px solid var(--line-p,rgba(37,99,235,.18));border-radius:18px;padding:0;margin-bottom:14px;overflow:hidden;box-shadow:0 8px 32px rgba(37,99,235,.06),0 2px 8px rgba(0,0,0,.03);position:relative}
    .notif-hero::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#25D366 0%,#128C7E 50%,#075E54 100%);z-index:2}
    .notif-hero-head{padding:22px 28px 20px;border-bottom:1px solid var(--rim,rgba(0,0,0,.06));display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;background:rgba(37,99,235,.025)}
    .notif-hero-title{display:flex;align-items:center;gap:14px}
    .notif-hero-icon{width:46px;height:46px;border-radius:13px;background:linear-gradient(135deg,#25D366 0%,#128C7E 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(37,211,102,.32)}
    .notif-hero-icon svg{width:22px;height:22px;fill:#fff}
    .notif-hero-h1{font-size:22px;font-weight:800;letter-spacing:-.6px;color:var(--ink);margin:0;line-height:1.1}
    .notif-hero-h2{font-size:12px;color:var(--ink3);font-weight:600;margin-top:3px;letter-spacing:.01em}
    .notif-hero-meta{display:flex;gap:8px;flex-wrap:wrap}
    .notif-hero-pill{background:#fff;border:1px solid var(--rim,rgba(0,0,0,.08));padding:6px 12px;border-radius:50px;font-size:11px;font-weight:700;color:var(--ink2);display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
    .notif-hero-pill b{color:var(--p1)}
    .notif-hero-body{padding:24px 28px 28px;display:grid;grid-template-columns:1.15fr .85fr;gap:28px}
    @media(max-width:980px){.notif-hero-body{grid-template-columns:1fr;gap:22px}}
    .notif-steps-col{display:flex;flex-direction:column;gap:20px}
    .notif-step{background:#fff;border:1px solid var(--rim,rgba(0,0,0,.06));border-radius:13px;padding:16px 18px}
    .notif-step-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
    .notif-step-num{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#2563EB,#1D4ED8);color:#fff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:var(--fd)}
    .notif-step-lbl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--ink2)}
    .notif-step-cnt{margin-left:auto;font-size:10.5px;font-weight:700;color:var(--ink3);background:var(--surf2);padding:3px 9px;border-radius:50px}
    .notif-tpl-cats{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:11px}
    .notif-tpl-cat{background:transparent;border:1px solid transparent;color:var(--ink3);font-family:inherit;font-size:11px;font-weight:700;padding:6px 11px;border-radius:50px;cursor:pointer;transition:all .18s}
    .notif-tpl-cat:hover{color:var(--ink);background:var(--surf2)}
    .notif-tpl-cat.is-active{background:rgba(37,99,235,.10);border-color:rgba(37,99,235,.25);color:var(--p1)}
    .notif-tpl-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}
    .notif-tpl-card{background:var(--surf,rgba(0,0,0,.02));border:1.5px solid var(--rim,rgba(0,0,0,.08));border-radius:11px;padding:11px 12px;cursor:pointer;text-align:left;transition:all .18s;font-family:inherit;display:flex;flex-direction:column;gap:4px}
    .notif-tpl-card:hover{border-color:rgba(37,99,235,.35);background:#fff;transform:translateY(-1px)}
    .notif-tpl-card.is-active{border-color:var(--p1);background:rgba(37,99,235,.05);box-shadow:0 4px 14px rgba(37,99,235,.12)}
    .notif-tpl-card .tpl-name{font-size:12.5px;font-weight:800;color:var(--ink);letter-spacing:-.01em}
    .notif-tpl-card .tpl-desc{font-size:10.5px;color:var(--ink3);font-weight:500;line-height:1.35}
    .notif-tpl-card.is-active .tpl-name{color:var(--p1)}
    .notif-seg-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:11px}
    .notif-seg{background:var(--surf,rgba(0,0,0,.02));border:1.5px solid var(--rim,rgba(0,0,0,.08));border-radius:11px;padding:11px 13px;cursor:pointer;text-align:left;transition:all .18s;font-family:inherit;display:flex;align-items:center;gap:10px}
    .notif-seg:hover{border-color:rgba(37,99,235,.35);background:#fff}
    .notif-seg.is-active{border-color:var(--p1);background:rgba(37,99,235,.05);box-shadow:0 4px 14px rgba(37,99,235,.10)}
    .notif-seg-n{font-family:var(--fd);font-weight:900;font-size:18px;color:var(--ink);min-width:32px;text-align:left;line-height:1}
    .notif-seg.is-active .notif-seg-n{color:var(--p1)}
    .notif-seg-l{font-size:11.5px;font-weight:800;color:var(--ink);letter-spacing:-.01em}
    .notif-seg-h{font-size:10px;color:var(--ink3);font-weight:600;margin-top:2px}
    .notif-search{position:relative}
    .notif-search input{width:100%;background:#fff;border:1.5px solid var(--rim);border-radius:11px;padding:10px 38px 10px 38px;font-family:inherit;font-size:13px;font-weight:600;color:var(--ink);outline:none;transition:all .18s}
    .notif-search input:focus{border-color:var(--p1);box-shadow:0 0 0 3px rgba(37,99,235,.10)}
    .notif-search-icon{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--ink4);font-weight:800;pointer-events:none;font-size:13px}
    .notif-search-clear{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:22px;height:22px;border:none;background:transparent;color:var(--ink3);cursor:pointer;font-size:18px;line-height:1;display:none;border-radius:50%}
    .notif-search-clear:hover{background:var(--surf2);color:var(--ink)}
    .notif-preview-col{display:flex;flex-direction:column}
    .notif-wa-frame{background:linear-gradient(180deg,#E5DDD5 0%,#D9D2CB 100%);border-radius:18px;padding:18px 14px 12px;flex:1;display:flex;flex-direction:column;min-height:340px;position:relative;overflow:hidden;border:1px solid rgba(0,0,0,.06)}
    .notif-wa-frame::before{content:'';position:absolute;inset:0;background-image:radial-gradient(circle,rgba(0,0,0,.04) 1px,transparent 1px);background-size:16px 16px;opacity:.6;pointer-events:none}
    .notif-wa-tophead{background:#075E54;color:#fff;padding:9px 14px;border-radius:11px 11px 0 0;font-size:11.5px;font-weight:700;display:flex;align-items:center;gap:10px;margin:-18px -14px 12px;position:relative;z-index:2}
    .notif-wa-tophead .avatar{width:28px;height:28px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;color:#fff}
    .notif-wa-tophead .info{display:flex;flex-direction:column;line-height:1.2}
    .notif-wa-tophead .info small{font-size:9.5px;opacity:.75;font-weight:500}
    .notif-bubble-wrap{position:relative;z-index:1;display:flex;flex-direction:column;gap:8px;flex:1}
    .notif-bubble{background:#DCF8C6;padding:10px 13px 7px;border-radius:10px 10px 2px 10px;font-size:13px;line-height:1.5;color:#222;align-self:flex-end;max-width:88%;white-space:pre-wrap;word-wrap:break-word;box-shadow:0 1px 1px rgba(0,0,0,.08);position:relative}
    .notif-bubble::after{content:'';position:absolute;top:0;right:-7px;width:0;height:0;border-style:solid;border-width:0 0 8px 8px;border-color:transparent transparent transparent #DCF8C6}
    .notif-bubble-time{display:block;text-align:right;font-size:9.5px;color:#888;margin-top:3px;font-weight:500}
    .notif-bubble-empty{padding:22px 18px;background:rgba(255,255,255,.55);border:1px dashed rgba(0,0,0,.10);border-radius:11px;text-align:center;color:var(--ink3);font-size:11.5px;font-weight:600;align-self:center;max-width:80%;backdrop-filter:blur(4px)}
    .notif-custom-area{margin-top:9px}
    .notif-custom-vars{font-size:9.5px;color:var(--ink3);margin-bottom:5px;line-height:1.55}
    .notif-custom-vars code{background:var(--surf2);padding:1px 5px;border-radius:4px;font-size:10px;font-weight:700;color:var(--p1);font-family:var(--fd)}
    .notif-custom-area textarea{width:100%;background:var(--surf,#fff);border:1.5px solid var(--rim);border-radius:10px;padding:9px 11px;font-family:inherit;font-size:12.5px;color:var(--ink);outline:none;resize:vertical;min-height:80px;transition:all .18s}
    .notif-custom-area textarea:focus{border-color:var(--p1);box-shadow:0 0 0 3px rgba(37,99,235,.10);background:#fff}
    .notif-tipo-desc{margin-top:9px;font-size:11px;color:var(--ink3);padding:7px 10px;background:rgba(37,99,235,.05);border-left:3px solid var(--p1);border-radius:6px;line-height:1.45}
    .notif-cta-bar{margin-top:12px;background:linear-gradient(135deg,#25D366 0%,#1FAD55 100%);border-radius:14px;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:14px;box-shadow:0 8px 22px rgba(37,211,102,.32);flex-wrap:wrap}
    .notif-cta-count{color:#fff;display:flex;align-items:baseline;gap:6px}
    .notif-cta-count b{font-size:24px;font-weight:900;font-family:var(--fd);line-height:1}
    .notif-cta-count span{font-size:11.5px;opacity:.92;font-weight:600}
    .notif-cta-btn{background:#fff;color:#1FAD55;border:none;font-family:inherit;font-weight:800;font-size:14px;padding:11px 22px;border-radius:50px;cursor:pointer;display:inline-flex;align-items:center;gap:9px;transition:all .2s;box-shadow:0 4px 14px rgba(0,0,0,.12);letter-spacing:-.01em}
    .notif-cta-btn:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(0,0,0,.22)}
    .notif-cta-btn:active{transform:translateY(0)}
    .notif-cta-btn svg{width:16px;height:16px;fill:#1FAD55}
    .notif-cta-hint{text-align:center;font-size:10.5px;color:var(--ink3);margin-top:7px;font-weight:600}
    .notif-secondary{display:grid;grid-template-columns:1.2fr 1fr;gap:14px}
    @media(max-width:980px){.notif-secondary{grid-template-columns:1fr}}
    .notif-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
    .notif-kpi{background:#fff;border:1px solid var(--rim);border-radius:11px;padding:10px 12px;display:flex;flex-direction:column;justify-content:space-between;min-height:74px}
    .notif-kpi-v{font-family:var(--fd);font-weight:900;font-size:20px;line-height:1;letter-spacing:-.5px}
    .notif-kpi-l{font-size:10px;color:var(--ink3);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-top:7px}
    .notif-kpi-h{font-size:9.5px;color:var(--ink3);font-weight:600;margin-top:2px}
    .notif-urg{display:flex;flex-direction:column;gap:5px}
    .notif-urg-row{display:flex;align-items:center;gap:9px;padding:8px 11px;background:var(--surf);border-radius:9px;border:1px solid var(--rim);transition:all .15s;cursor:pointer}
    .notif-urg-row:hover{background:#fff;border-color:rgba(37,99,235,.25)}
    .notif-urg-pill{width:32px;height:30px;border-radius:7px;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;flex-shrink:0;font-family:var(--fd)}
    .notif-urg-lbl{flex:1;font-size:11.5px;font-weight:700;color:var(--ink);line-height:1.25}
    .notif-urg-sub{font-size:9.5px;color:var(--ink3);font-weight:600;margin-top:1px}
    .notif-chart-mini{display:flex;align-items:flex-end;gap:3px;height:78px;margin-top:9px}
    .notif-chart-mini > div{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px}
    .notif-chart-mini .bar{width:100%;border-radius:3px 3px 0 0;transition:all .3s}
    .notif-hist-empty{text-align:center;padding:28px 16px;color:var(--ink3);font-size:11.5px}
  </style>`;

  return customStyles + `<div class="page">

  ${pageBanner(
    'Comunicaciones · WhatsApp',
    'Notificaciones',
    '<b>'+totalEnviados+'</b> enviados histórico · <b>'+conTelefono.length+'</b> con WhatsApp ('+pctCobertura+'% cobertura)'
  )}

  <!-- ═══════════════════════════════════════════════════════ -->
  <!--   HERO · NUEVO ENVIO (protagonista)                    -->
  <!-- ═══════════════════════════════════════════════════════ -->
  <div class="notif-hero">
    <div class="notif-hero-head">
      <div class="notif-hero-title">
        <div class="notif-hero-icon">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </div>
        <div>
          <h1 class="notif-hero-h1">Nuevo envío</h1>
          <div class="notif-hero-h2">Comunícate por WhatsApp con tus clientes en 3 pasos</div>
        </div>
      </div>
      <div class="notif-hero-meta">
        <span class="notif-hero-pill"><b>${enviadosHoy}</b> hoy</span>
        <span class="notif-hero-pill"><b>${enviados7d}</b> últimos 7d</span>
        <span class="notif-hero-pill"><b>${conTelefono.length}</b> con WhatsApp</span>
      </div>
    </div>

    <div class="notif-hero-body">

      <!-- Columna izquierda: pasos 1 y 2 -->
      <div class="notif-steps-col">

        <!-- ① PLANTILLA -->
        <div class="notif-step">
          <div class="notif-step-head">
            <div class="notif-step-num">1</div>
            <div class="notif-step-lbl">Plantilla del mensaje</div>
            <div class="notif-step-cnt" id="nx-tpl-counter">Selecciona una</div>
          </div>

          <div class="notif-tpl-cats" id="nx-cat-tabs">
            <button type="button" class="notif-tpl-cat is-active" data-cat="all" onclick="setNxCat('all')">Todas</button>
            <button type="button" class="notif-tpl-cat" data-cat="bienvenida" onclick="setNxCat('bienvenida')">Bienvenida</button>
            <button type="button" class="notif-tpl-cat" data-cat="pagos" onclick="setNxCat('pagos')">Pagos</button>
            <button type="button" class="notif-tpl-cat" data-cat="cobranza" onclick="setNxCat('cobranza')">Cobranza</button>
            <button type="button" class="notif-tpl-cat" data-cat="cierre" onclick="setNxCat('cierre')">Cierre</button>
            <button type="button" class="notif-tpl-cat" data-cat="otros" onclick="setNxCat('otros')">Otros</button>
          </div>

          <div class="notif-tpl-cards nx-tpl-grid" id="nx-tpl-grid">
            <button type="button" class="notif-tpl-card nx-tpl-card is-active" data-tipo="lead_bienvenida" data-cat="bienvenida" onclick="setNotifTipo('lead_bienvenida')">
              <div class="tpl-name">Bienvenida Lead</div>
              <div class="tpl-desc">Saludo formal al nuevo interesado</div>
            </button>
            <button type="button" class="notif-tpl-card nx-tpl-card" data-tipo="bienvenida_activo" data-cat="bienvenida" onclick="setNotifTipo('bienvenida_activo')">
              <div class="tpl-name">Cliente activo</div>
              <div class="tpl-desc">Para clientes con cuenta aprobada</div>
            </button>
            <button type="button" class="notif-tpl-card nx-tpl-card" data-tipo="cuota" data-cat="pagos" onclick="setNotifTipo('cuota')">
              <div class="tpl-name">Recordatorio cuota</div>
              <div class="tpl-desc">Aviso corto antes del vencimiento</div>
            </button>
            <button type="button" class="notif-tpl-card nx-tpl-card" data-tipo="confirmado" data-cat="pagos" onclick="setNotifTipo('confirmado')">
              <div class="tpl-name">Pago recibido</div>
              <div class="tpl-desc">Confirma recepción y próxima fecha</div>
            </button>
            <button type="button" class="notif-tpl-card nx-tpl-card" data-tipo="cuenta" data-cat="pagos" onclick="setNotifTipo('cuenta')">
              <div class="tpl-name">Estado de cuenta</div>
              <div class="tpl-desc">Resumen completo del plan</div>
            </button>
            <button type="button" class="notif-tpl-card nx-tpl-card" data-tipo="mora" data-cat="cobranza" onclick="setNotifTipo('mora')">
              <div class="tpl-name">Aviso de mora</div>
              <div class="tpl-desc">Notifica atraso con datos completos</div>
            </button>
            <button type="button" class="notif-tpl-card nx-tpl-card" data-tipo="mora_grave" data-cat="cobranza" onclick="setNotifTipo('mora_grave')">
              <div class="tpl-name">Mora urgente</div>
              <div class="tpl-desc">Aviso por mora prolongada</div>
            </button>
            <button type="button" class="notif-tpl-card nx-tpl-card" data-tipo="acuerdo" data-cat="cobranza" onclick="setNotifTipo('acuerdo')">
              <div class="tpl-name">Acuerdo de pago</div>
              <div class="tpl-desc">Formaliza el acuerdo por escrito</div>
            </button>
            <button type="button" class="notif-tpl-card nx-tpl-card" data-tipo="liquidacion" data-cat="cierre" onclick="setNotifTipo('liquidacion')">
              <div class="tpl-name">Liquidación</div>
              <div class="tpl-desc">Oferta de cancelación anticipada</div>
            </button>
            <button type="button" class="notif-tpl-card nx-tpl-card" data-tipo="vencimiento" data-cat="cierre" onclick="setNotifTipo('vencimiento')">
              <div class="tpl-name">Vencimiento</div>
              <div class="tpl-desc">Alerta fin de contrato próximo</div>
            </button>
            <button type="button" class="notif-tpl-card nx-tpl-card" data-tipo="custom" data-cat="otros" onclick="setNotifTipo('custom')">
              <div class="tpl-name">Personalizado</div>
              <div class="tpl-desc">Escribe tu propio mensaje</div>
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

          <div id="notif-tipo-desc" class="notif-tipo-desc">Selecciona una plantilla para ver su descripción.</div>

          <div id="notif-custom-wrap" class="notif-custom-area" style="display:none">
            <div class="notif-custom-vars">Variables disponibles: <code>{nombre}</code> <code>{cuota}</code> <code>{mora}</code> <code>{modelo}</code> <code>{cuenta}</code> <code>{empresa}</code> <code>{saldo}</code> <code>{cuotaNum}</code> <code>{totalCuotas}</code> <code>{fechaProx}</code></div>
            <textarea class="fta" id="notif-msg" rows="4" placeholder="Estimado/a {nombre}, le recordamos su próxima cuota de {cuota} con fecha {fechaProx}..."></textarea>
          </div>
        </div>

        <!-- ② DESTINATARIOS -->
        <div class="notif-step">
          <div class="notif-step-head">
            <div class="notif-step-num">2</div>
            <div class="notif-step-lbl">Destinatarios</div>
            <div class="notif-step-cnt" id="nx-dest-counter">0 destinatarios</div>
          </div>

          <div class="notif-seg-grid nx-seg-grid" id="notif-dest-quick">
            <button type="button" class="notif-seg nx-seg is-active" data-dest="leads" onclick="setNotifDestQuick('leads')">
              <div class="notif-seg-n nx-seg-count" id="nx-c-leads">0</div>
              <div class="nx-seg-info">
                <div class="notif-seg-l nx-seg-lbl">Leads</div>
                <div class="notif-seg-h nx-seg-hint">Sin cuenta activa</div>
              </div>
            </button>
            <button type="button" class="notif-seg nx-seg" data-dest="activos" onclick="setNotifDestQuick('activos')">
              <div class="notif-seg-n nx-seg-count" id="nx-c-activos">0</div>
              <div class="nx-seg-info">
                <div class="notif-seg-l nx-seg-lbl">Activos</div>
                <div class="notif-seg-h nx-seg-hint">Con cuenta aprobada</div>
              </div>
            </button>
            <button type="button" class="notif-seg nx-seg" data-dest="proximas" onclick="setNotifDestQuick('proximas')">
              <div class="notif-seg-n nx-seg-count" id="nx-c-proximas">0</div>
              <div class="nx-seg-info">
                <div class="notif-seg-l nx-seg-lbl">Cuota pendiente</div>
                <div class="notif-seg-h nx-seg-hint">Vencen esta semana</div>
              </div>
            </button>
            <button type="button" class="notif-seg nx-seg" data-dest="mora" onclick="setNotifDestQuick('mora')">
              <div class="notif-seg-n nx-seg-count" id="nx-c-mora">0</div>
              <div class="nx-seg-info">
                <div class="notif-seg-l nx-seg-lbl">En mora</div>
                <div class="notif-seg-h nx-seg-hint">Con atraso</div>
              </div>
            </button>
          </div>

          <select class="fs" id="notif-dest" style="display:none">
            <option value="leads">Leads sin cuenta activa</option>
            <option value="activos">Clientes activos con cuenta</option>
            <option value="proximas">Clientes con cuota esta semana</option>
            <option value="mora">Clientes en mora</option>
            <option value="especifico">Cliente específico</option>
          </select>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <div style="font-size:10.5px;color:var(--ink3);font-weight:600" id="nx-ac-hint">Lista de destinatarios — filtra o selecciona uno específico</div>
            <button type="button" id="nx-ac-modeswitch" onclick="nxAcToggleScope()" style="border:none;background:transparent;color:var(--p1);font-size:10.5px;font-weight:700;cursor:pointer;padding:2px 6px;border-radius:6px">Ver todos</button>
          </div>

          <div class="notif-search nx-ac-wrap">
            <span class="notif-search-icon nx-ac-icon">⌕</span>
            <input type="text" class="nx-ac-input" id="nx-ac-input" placeholder="Filtrar por nombre, cédula, teléfono o crédito..." autocomplete="off" oninput="nxAcFilter()" onkeydown="nxAcKey(event)">
            <button type="button" class="notif-search-clear nx-ac-clear" id="nx-ac-clear" onclick="nxAcClearInput()">×</button>
          </div>

          <!-- LISTA PERMANENTE DE DESTINATARIOS (siempre visible) -->
          <div class="nx-ac-list-perm" id="nx-ac-list-perm">
            <div class="nx-ac-list-head">
              <span id="nx-ac-list-title">Destinatarios del grupo</span>
              <span class="count" id="nx-ac-list-count">0</span>
            </div>
            <div class="nx-ac-list" id="nx-ac-list" style="position:static;display:block;max-height:none;border:none;box-shadow:none;background:transparent;"></div>
          </div>

          <div id="nx-ac-selected-wrap"></div>
          <input type="hidden" id="notif-cliente-sel-id" value="">
          <select id="notif-cliente-sel" style="display:none"></select>
        </div>

      </div>

      <!-- Columna derecha: paso 3 (preview) -->
      <div class="notif-preview-col">
        <div class="notif-step" style="flex:1;display:flex;flex-direction:column">
          <div class="notif-step-head">
            <div class="notif-step-num">3</div>
            <div class="notif-step-lbl">Vista previa WhatsApp</div>
            <div class="notif-step-cnt">Así lo verá el cliente</div>
          </div>

          <div class="notif-wa-frame nx-wa-preview" style="flex:1">
            <div class="notif-wa-tophead">
              <div class="avatar">P</div>
              <div class="info">
                <span>Pagasi</span>
                <small>en línea</small>
              </div>
            </div>
            <div class="notif-bubble-wrap">
              <div id="notif-preview" class="notif-bubble nx-wa-bubble" style="display:none"></div>
              <div id="notif-preview-empty" class="notif-bubble-empty nx-wa-empty">
                Selecciona una plantilla y un destinatario<br>para ver el mensaje aquí
              </div>
            </div>
          </div>

          <!-- CTA: Botón grande de envío -->
          <div class="notif-cta-bar">
            <div class="notif-cta-count">
              <b id="nx-send-n">0</b>
              <span id="nx-send-lbl">destinatarios listos</span>
            </div>
            <button class="notif-cta-btn nx-send-btn" id="notif-send-btn">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.693.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <span>Enviar por WhatsApp</span>
            </button>
          </div>
          <div class="notif-cta-hint">Se abrirán hasta 5 chats a la vez para evitar bloqueos del navegador</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════ -->
  <!--   INFO SECUNDARIA · KPIs · Urgencia · Historial         -->
  <!-- ═══════════════════════════════════════════════════════ -->

  <!-- KPIs compactos -->
  <div class="notif-kpis">
    <div class="notif-kpi">
      <div class="notif-kpi-v" style="color:var(--red)">${moraClientes.length}</div>
      <div>
        <div class="notif-kpi-l">En mora</div>
        <div class="notif-kpi-h">${moraCritica.length+moraAlta.length} graves</div>
      </div>
    </div>
    <div class="notif-kpi">
      <div class="notif-kpi-v" style="color:var(--amber)">${proximasCuotas.length}</div>
      <div>
        <div class="notif-kpi-l">Vencen 7d</div>
        <div class="notif-kpi-h">Próximas cuotas</div>
      </div>
    </div>
    <div class="notif-kpi">
      <div class="notif-kpi-v" style="color:var(--green)">${conTelefono.length}</div>
      <div>
        <div class="notif-kpi-l">Con WhatsApp</div>
        <div class="notif-kpi-h">${pctCobertura}% cobertura</div>
      </div>
    </div>
    <div class="notif-kpi">
      <div class="notif-kpi-v" style="color:var(--ink3)">${sinTelefono}</div>
      <div>
        <div class="notif-kpi-l">Sin teléfono</div>
        <div class="notif-kpi-h">Requieren datos</div>
      </div>
    </div>
  </div>

  <!-- Sección dual: Urgencia + Historial -->
  <div class="notif-secondary">

    <!-- Card 1: Segmentos urgencia + Actividad 14d -->
    <div class="card">
      <div class="ch">
        <div>
          <div class="ct">Segmentos por urgencia</div>
          <div class="cs">Clientes que requieren atención prioritaria</div>
        </div>
        <div style="font-weight:900;font-size:18px;color:var(--p1);font-family:var(--fd)">${diasNotif.reduce((a,d)=>a+d.n,0)}</div>
      </div>

      <div class="notif-urg" style="margin-top:10px">
        ${[
          ['Crítico · +60 días', moraCritica.length, '#8B0000'],
          ['Alta · 31–60 días', moraAlta.length, 'var(--red)'],
          ['Media · 16–30 días', moraMedia.length, 'var(--amber)'],
          ['Baja · 1–15 días', moraBaja.length, '#C9A227'],
          ['Cuotas esta semana', proximasCuotas.length, 'var(--p1)'],
        ].map(function(row){
          var lbl=row[0], n=row[1], col=row[2];
          var sub = lbl.indexOf('Cuotas')===0 ? 'Próximas a vencer' : 'Días de mora';
          return '<div class="notif-urg-row" style="'+(n===0?'opacity:.5':'')+'">'
            +'<div class="notif-urg-pill" style="background:'+col+'">'+n+'</div>'
            +'<div style="flex:1;min-width:0"><div class="notif-urg-lbl">'+lbl+'</div><div class="notif-urg-sub">'+sub+'</div></div>'
            +'</div>';
        }).join('')}
      </div>

      <div style="font-size:11px;color:var(--ink3);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-top:18px;margin-bottom:4px">Actividad últimos 14 días</div>
      <div class="notif-chart-mini">
        ${diasNotif.map(d=>`<div>
          <div style="font-size:9px;font-weight:800;color:${d.n>0?'var(--p1)':'var(--ink3)'};height:11px">${d.n>0?d.n:''}</div>
          <div style="flex:1;width:100%;display:flex;align-items:flex-end">
            <div class="bar" style="width:100%;background:${d.n>0?'linear-gradient(180deg,var(--p1),#60A5FA)':'var(--rim)'};height:${d.n>0?Math.max(7,Math.round(d.n/maxNotif*60)):4}px"></div>
          </div>
          <div style="font-size:9px;color:var(--ink3);font-weight:600">${d.lbl}</div>
        </div>`).join('')}
      </div>
    </div>

    <!-- Card 2: Historial -->
    <div class="card">
      <div class="ch">
        <div>
          <div class="ct">Historial de envíos</div>
          <div class="cs">Registro de todas las notificaciones</div>
        </div>
        <span class="bdg b-b" style="font-size:10.5px">${(window._notifHistorial||[]).length} envíos</span>
      </div>

      ${(function(){
        var sinTel=S.clientes.filter(c=>!c.eliminado&&(!c.tel||c.tel.replace(/[^0-9]/g,'').length<7));
        if(!sinTel.length) return '';
        return '<div style="padding:9px 11px;background:rgba(240,150,50,0.08);border:1px solid rgba(240,150,50,0.3);border-radius:8px;margin-top:10px">'
          +'<div style="font-size:10.5px;font-weight:800;color:var(--amber);margin-bottom:3px">ATENCIÓN: '+sinTel.length+' sin teléfono</div>'
          +'<div style="font-size:10px;color:var(--ink3)">'+sinTel.slice(0,3).map(function(c){ return ((c&&c.nombre)||'Cliente').split(' ')[0]; }).join(', ')+(sinTel.length>3?' y '+(sinTel.length-3)+' más':'')+'</div>'
          +'</div>';
      })()}

      <div class="lst" id="notif-historial" style="max-height:420px;margin-top:10px">
        ${(window._notifHistorial||[]).length
          ? (window._notifHistorial||[]).map(n=>`<div class="li" style="padding:10px 12px;border-bottom:1px solid var(--rim)">
              <div style="width:9px;height:9px;border-radius:50%;background:${n.canal==='whatsapp'?'#25D366':'var(--p1)'};flex-shrink:0;margin-top:5px"></div>
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:800;color:var(--ink)">${n.tipo}</div>
                <div style="font-size:10.5px;color:var(--ink3);margin-top:2px">${n.dest} — ${n.cantidad} mensaje${n.cantidad!==1?'s':''} — ${n.canal}</div>
                <div style="font-size:10px;color:var(--ink3)">${n.fecha}</div>
                ${n.mensaje?`<div style="margin-top:5px;padding:7px 9px;background:var(--surf2);border:1px solid var(--rim);border-radius:7px;font-size:10.5px;white-space:pre-wrap;line-height:1.4;color:var(--ink)">${String(n.mensaje).replace(/</g,'&lt;')}</div>`:''}
              </div>
              <span class="bdg b-g" style="align-self:flex-start;font-size:9.5px">enviado</span>
            </div>`).join('')
          : '<div class="notif-hist-empty"><div style="font-weight:700;font-size:12.5px;color:var(--ink2);margin-bottom:4px">Sin envíos registrados</div><div>Los mensajes enviados aparecerán aquí con fecha y detalles.</div></div>'}
      </div>
    </div>

  </div>

  </div>`;};
