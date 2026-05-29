// ══════════════════════════════════════════════════════════════
// CALCULADORA DE TASAS — Conversor profesional estilo Wise
// ══════════════════════════════════════════════════════════════

PG.calculadora = function(){
  var bcv = window._tasaBsGlobal || 0;
  var eur = window._tasaEuro || 0;
  var bin = window._tasaBinance || 0;
  var monedaDe = window._calcMonedaDe || 'USD';
  var monedaA  = window._calcMonedaA  || 'Bs';
  var fuente   = window._calcFuente   || 'BCV';  // BCV o BINANCE
  var monto    = (typeof window._calcMonto === 'number') ? window._calcMonto : 100;

  // ─── Currency flags/dots ───────────────────────────────────
  function curIcon(m, size){
    size = size || 28;
    var styles = {
      USD: {bg:'#15803D', sym:'$', font:.65},
      Bs : {bg:'#1f1f23', sym:'Bs', font:.42},
      EUR: {bg:'#003399', sym:'€', font:.62},
      USDT:{bg:'#26A17B', sym:'₮', font:.58}
    };
    var s = styles[m] || styles.USD;
    return '<span style="display:inline-flex;align-items:center;justify-content:center;width:'+size+'px;height:'+size+'px;border-radius:50%;background:'+s.bg+';color:#fff;font-weight:900;font-size:'+(size*s.font)+'px;font-family:var(--fd);flex-shrink:0;letter-spacing:-.5px">'+s.sym+'</span>';
  }

  setTimeout(function(){
    calcRender();
    var inp = document.getElementById('calc-monto');
    if(inp){ inp.focus(); inp.select(); }
  }, 60);

  var styles = `<style>
    /* ────── BASE ────── */
    .calc-page{background:#FAFAFB;min-height:calc(100vh - 100px)}
    .calc-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:24px;margin-top:8px;align-items:start}
    @media(max-width:1080px){.calc-grid{grid-template-columns:1fr}}

    /* ────── Live rate ticker ────── */
    .cv-ticker{display:flex;align-items:center;gap:0;background:#fff;border:1px solid #ECEEF3;border-radius:14px;padding:0;overflow:hidden;margin-bottom:14px}
    .cv-tk-item{flex:1;padding:14px 18px;display:flex;align-items:center;gap:11px;border-right:1px solid #ECEEF3;position:relative}
    .cv-tk-item:last-child{border-right:none}
    .cv-tk-info{display:flex;flex-direction:column;min-width:0;line-height:1.15}
    .cv-tk-lbl{font-size:10px;font-weight:800;color:#9CA3AF;letter-spacing:.14em;text-transform:uppercase}
    .cv-tk-val{font-family:var(--fd);font-size:17px;font-weight:800;color:#0F172A;letter-spacing:-.4px;margin-top:2px}
    .cv-tk-val small{font-size:10px;color:#9CA3AF;font-weight:700;margin-left:3px;letter-spacing:0}
    .cv-tk-dot{width:6px;height:6px;border-radius:50%;background:#22C55E;box-shadow:0 0 0 3px rgba(34,197,94,.18);margin-left:auto;align-self:flex-start;margin-top:4px}
    .cv-tk-refresh{padding:0 14px;display:flex;align-items:center;justify-content:center;background:#F8FAFC;border-left:1px solid #ECEEF3;cursor:pointer;color:#64748B;transition:.2s}
    .cv-tk-refresh:hover{background:#1D4ED8;color:#fff}
    .cv-tk-refresh svg{width:16px;height:16px}

    /* ────── Converter card ────── */
    .cv-conv{background:#fff;border:1px solid #ECEEF3;border-radius:18px;padding:0;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,.02)}
    .cv-row{padding:22px 26px;position:relative}
    .cv-row + .cv-row{border-top:1px solid #F1F3F7}
    .cv-row-label{font-size:11px;font-weight:800;color:#9CA3AF;letter-spacing:.16em;text-transform:uppercase;margin-bottom:12px}
    .cv-row-body{display:flex;align-items:center;gap:14px}
    .cv-cur-pick{display:inline-flex;align-items:center;gap:10px;background:#F4F6FB;border:1px solid #E5E8F0;padding:10px 14px 10px 12px;border-radius:14px;cursor:pointer;transition:.15s;flex-shrink:0;min-width:138px}
    .cv-cur-pick:hover{border-color:#1D4ED8;background:#fff}
    .cv-cur-pick-name{font-size:14px;font-weight:800;color:#0F172A;letter-spacing:-.2px;line-height:1}
    .cv-cur-pick-sub{font-size:10.5px;color:#64748B;font-weight:600;margin-top:2px}
    .cv-cur-pick svg.chev{width:14px;height:14px;color:#9CA3AF;margin-left:auto}
    .cv-amount{flex:1;text-align:right;font-family:var(--fd);font-size:36px;font-weight:800;color:#0F172A;background:transparent;border:none;outline:none;letter-spacing:-1.4px;padding:0;width:100%;min-width:0}
    .cv-amount::placeholder{color:#CBD5E1}
    .cv-amount[readonly]{color:#1D4ED8;font-weight:900;cursor:default}
    .cv-amount.is-to{color:#1D4ED8;font-weight:900}

    /* Swap button between FROM and TO rows */
    .cv-swap{position:absolute;left:50%;top:100%;transform:translate(-50%,-50%);z-index:2;width:38px;height:38px;border-radius:50%;background:#fff;border:1px solid #E5E8F0;color:#1D4ED8;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(15,23,42,.06);transition:.2s}
    .cv-swap:hover{transform:translate(-50%,-50%) rotate(180deg);background:#1D4ED8;color:#fff;border-color:#1D4ED8}
    .cv-swap svg{width:16px;height:16px}

    /* Source toggle: BCV vs BINANCE */
    .cv-src{display:flex;background:#F4F6FB;border:1px solid #E5E8F0;border-radius:12px;padding:3px;gap:0}
    .cv-src-btn{flex:1;background:transparent;border:none;font-family:inherit;padding:9px 12px;font-size:12px;font-weight:800;color:#64748B;cursor:pointer;border-radius:9px;display:flex;align-items:center;justify-content:center;gap:7px;letter-spacing:-.1px;transition:.15s}
    .cv-src-btn.is-active{background:#fff;color:#0F172A;box-shadow:0 2px 6px rgba(15,23,42,.08)}
    .cv-src-btn svg{width:13px;height:13px}
    .cv-src-rate{font-family:var(--fd);font-weight:900;color:#1D4ED8;font-size:11.5px;margin-left:auto;letter-spacing:-.2px}

    /* Quick amount chips */
    .cv-quick{display:flex;flex-wrap:wrap;gap:6px;padding:14px 26px 22px;background:#F8FAFC;border-top:1px solid #F1F3F7}
    .cv-quick-lbl{font-size:10.5px;font-weight:800;color:#9CA3AF;letter-spacing:.14em;text-transform:uppercase;margin-right:6px;align-self:center}
    .cv-quick button{background:#fff;border:1px solid #E5E8F0;color:#1D4ED8;font-family:var(--fd);font-size:12px;font-weight:800;padding:6px 12px;border-radius:8px;cursor:pointer;transition:.15s;letter-spacing:-.1px}
    .cv-quick button:hover{background:#1D4ED8;color:#fff;border-color:#1D4ED8;transform:translateY(-1px)}

    /* ────── Right panel: stats ────── */
    .cv-panel{background:#fff;border:1px solid #ECEEF3;border-radius:18px;padding:22px 24px;margin-bottom:14px;box-shadow:0 1px 2px rgba(15,23,42,.02)}
    .cv-panel-title{font-size:11px;font-weight:800;color:#9CA3AF;letter-spacing:.16em;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px}
    .cv-panel-title::before{content:'';width:5px;height:14px;background:#1D4ED8;border-radius:3px}

    /* Cruz multi-conversion list */
    .cv-cruz-row{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #F1F3F7}
    .cv-cruz-row:last-child{border-bottom:none}
    .cv-cruz-info{flex:1;min-width:0}
    .cv-cruz-from{font-size:11.5px;color:#64748B;font-weight:600;letter-spacing:-.1px;line-height:1.2}
    .cv-cruz-method{font-size:10.5px;color:#94A3B8;font-weight:600;margin-top:3px;letter-spacing:0}
    .cv-cruz-val{font-family:var(--fd);font-size:16px;font-weight:900;color:#0F172A;letter-spacing:-.4px;text-align:right;white-space:nowrap}
    .cv-cruz-val small{font-size:10.5px;color:#64748B;font-weight:700;margin-left:4px}

    /* Brechas dashboard */
    .cv-br-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 0;border-bottom:1px solid #F1F3F7}
    .cv-br-row:last-child{border-bottom:none}
    .cv-br-lbl{font-size:11.5px;color:#475569;font-weight:700;letter-spacing:-.1px}
    .cv-br-sub{font-size:10.5px;color:#94A3B8;font-weight:600;margin-top:2px}
    .cv-br-val{font-family:var(--fd);font-size:18px;font-weight:900;letter-spacing:-.5px;white-space:nowrap}
    .cv-br-arrow{display:inline-flex;align-items:center;gap:3px;font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:6px;margin-top:3px;letter-spacing:.05em}
    .cv-br-arrow.up{background:#FEF3C7;color:#A16207}
    .cv-br-arrow.high{background:#FECACA;color:#991B1B}
    .cv-br-arrow.low{background:#D1FAE5;color:#047857}

    /* ────── Selector modal (currency dropdown) ────── */
    .cv-modal{position:fixed;inset:0;background:rgba(15,23,42,.50);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:9999}
    .cv-modal.is-open{display:flex}
    .cv-modal-inner{background:#fff;border-radius:18px;padding:8px;width:300px;box-shadow:0 30px 60px rgba(15,23,42,.30);animation:cvModalIn .2s ease}
    @keyframes cvModalIn{from{transform:scale(.96);opacity:0}to{transform:scale(1);opacity:1}}
    .cv-modal-head{padding:14px 16px 10px;font-size:11px;font-weight:800;color:#9CA3AF;letter-spacing:.14em;text-transform:uppercase}
    .cv-modal-opt{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:11px;cursor:pointer;transition:.15s}
    .cv-modal-opt:hover{background:#F4F6FB}
    .cv-modal-opt-name{font-size:14px;font-weight:800;color:#0F172A;letter-spacing:-.2px}
    .cv-modal-opt-sub{font-size:11px;color:#64748B;font-weight:600;margin-top:2px}
    .cv-modal-opt.is-selected{background:#EFF6FF}
    .cv-modal-opt.is-selected .cv-modal-opt-name{color:#1D4ED8}

    /* ────── Compact summary line ────── */
    .cv-summary{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;padding:18px 26px;background:linear-gradient(135deg,#EFF6FF 0%,#DBEAFE 100%);border-bottom:1px solid #DBEAFE}
    .cv-summary-eq{font-family:var(--fd);font-size:13px;font-weight:700;color:#1E40AF;letter-spacing:-.2px}
    .cv-summary-rate{font-family:var(--fd);font-size:11.5px;font-weight:700;color:#1E3A8A;background:rgba(255,255,255,.55);padding:4px 10px;border-radius:7px;margin-left:auto}
  </style>`;

  function rateForActiveSource(){
    return fuente === 'BINANCE' ? bin : bcv;
  }

  return styles + `<div class="page calc-page">

  ${pageBanner(
    'Operaciones',
    'Calculadora de tasas',
    'Convierte entre Bs, USD, EUR y USDT con tasas en vivo del BCV y mercado paralelo'
  )}

  <div class="calc-grid">

    <!-- COLUMNA IZQUIERDA: TICKER + CONVERSOR + ATAJOS -->
    <div>
      <!-- Live rates ticker -->
      <div class="cv-ticker" id="cv-ticker">
        <div class="cv-tk-item">
          <div class="cv-tk-info">
            <span class="cv-tk-lbl">BCV</span>
            <span class="cv-tk-val" id="cv-tk-bcv">${bcv>1?_calcFmt(bcv):'—'}<small>Bs/$</small></span>
          </div>
          <span class="cv-tk-dot"></span>
        </div>
        <div class="cv-tk-item">
          <div class="cv-tk-info">
            <span class="cv-tk-lbl">Euro</span>
            <span class="cv-tk-val" id="cv-tk-eur">${eur>1?_calcFmt(eur):'—'}<small>Bs/€</small></span>
          </div>
          <span class="cv-tk-dot"></span>
        </div>
        <div class="cv-tk-item">
          <div class="cv-tk-info">
            <span class="cv-tk-lbl">Binance P2P</span>
            <span class="cv-tk-val" id="cv-tk-bin">${bin>1?_calcFmt(bin):'—'}<small>Bs/$</small></span>
          </div>
          <span class="cv-tk-dot"></span>
        </div>
        <button class="cv-tk-refresh" onclick="bcvForzarActualizacion&&bcvForzarActualizacion();setTimeout(calcRender,800)" title="Actualizar tasas">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M3 21v-5h5"/></svg>
        </button>
      </div>

      <!-- Converter card -->
      <div class="cv-conv">
        <!-- Source toggle -->
        <div style="padding:18px 26px 0">
          <div class="cv-src">
            <button class="cv-src-btn ${fuente==='BCV'?'is-active':''}" onclick="calcSetFuente('BCV')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 22h18M5 22V8l7-5 7 5v14M9 12h2M13 12h2M9 16h2M13 16h2"/></svg>
              Tasa BCV
              <span class="cv-src-rate" id="cv-src-bcv">${bcv>1?_calcFmt(bcv):'—'}</span>
            </button>
            <button class="cv-src-btn ${fuente==='BINANCE'?'is-active':''}" onclick="calcSetFuente('BINANCE')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l9 9 9-9M12 12v9"/></svg>
              Binance P2P
              <span class="cv-src-rate" id="cv-src-bin">${bin>1?_calcFmt(bin):'—'}</span>
            </button>
          </div>
        </div>

        <!-- FROM row -->
        <div class="cv-row">
          <div class="cv-row-label">Tú envías</div>
          <div class="cv-row-body">
            <button class="cv-cur-pick" onclick="calcOpenSelector('de')">
              ${curIcon(monedaDe, 28)}
              <div style="text-align:left">
                <div class="cv-cur-pick-name" id="cv-de-name">${monedaDe}</div>
                <div class="cv-cur-pick-sub" id="cv-de-sub">${_calcCurName(monedaDe)}</div>
              </div>
              <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <input type="text" inputmode="decimal" id="calc-monto" class="cv-amount"
                   value="${monto.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2})}"
                   oninput="calcOnInput(event)" onfocus="this.select()" placeholder="0,00">
          </div>
          <button class="cv-swap" onclick="calcSwap()" title="Intercambiar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10l5-5 5 5"/><path d="M12 5v14"/><path d="M17 14l-5 5-5-5"/></svg>
          </button>
        </div>

        <!-- TO row -->
        <div class="cv-row">
          <div class="cv-row-label">Reciben</div>
          <div class="cv-row-body">
            <button class="cv-cur-pick" onclick="calcOpenSelector('a')">
              ${curIcon(monedaA, 28)}
              <div style="text-align:left">
                <div class="cv-cur-pick-name" id="cv-a-name">${monedaA}</div>
                <div class="cv-cur-pick-sub" id="cv-a-sub">${_calcCurName(monedaA)}</div>
              </div>
              <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <input type="text" id="calc-result" class="cv-amount is-to" readonly value="0,00">
          </div>
        </div>

        <!-- Summary -->
        <div class="cv-summary" id="cv-summary">
          <span class="cv-summary-eq" id="cv-summary-eq">1 ${monedaDe} = … ${monedaA}</span>
          <span class="cv-summary-rate" id="cv-summary-rate">${fuente==='BCV'?'BCV oficial':'Binance P2P'}</span>
        </div>

        <!-- Quick amounts -->
        <div class="cv-quick">
          <span class="cv-quick-lbl">Atajos</span>
          <button onclick="calcQuick(10)">10</button>
          <button onclick="calcQuick(50)">50</button>
          <button onclick="calcQuick(100)">100</button>
          <button onclick="calcQuick(500)">500</button>
          <button onclick="calcQuick(1000)">1.000</button>
          <button onclick="calcQuick(5000)">5.000</button>
          <button onclick="calcQuick(10000)">10.000</button>
        </div>
      </div>
    </div>

    <!-- COLUMNA DERECHA: CRUZ + BRECHAS -->
    <div>
      <!-- Equivalencias cruzadas -->
      <div class="cv-panel">
        <div class="cv-panel-title">Equivalencias cruzadas</div>
        <div id="cv-cruz"></div>
      </div>

      <!-- Brechas dashboard -->
      <div class="cv-panel">
        <div class="cv-panel-title">Brechas del mercado</div>
        <div id="cv-brechas"></div>
      </div>
    </div>

  </div>

  <!-- Selector modal -->
  <div class="cv-modal" id="cv-modal" onclick="if(event.target===this)calcCloseSelector()">
    <div class="cv-modal-inner">
      <div class="cv-modal-head">Elegí una moneda</div>
      <div id="cv-modal-opts"></div>
    </div>
  </div>

  </div>`;
};

// ─── ESTADO ───
window._calcMonedaDe = window._calcMonedaDe || 'USD';
window._calcMonedaA  = window._calcMonedaA  || 'Bs';
window._calcFuente   = window._calcFuente   || 'BCV';
window._calcMonto    = (typeof window._calcMonto === 'number') ? window._calcMonto : 100;
window._calcSelectorTarget = 'de';

function _calcCurName(m){
  return {USD:'Dólar EE.UU.', Bs:'Bolívares VE', EUR:'Euro', USDT:'Tether USDT'}[m] || m;
}

function _calcParseMonto(str){
  if(typeof str === 'number') return str;
  str = String(str||'').trim();
  if(!str) return 0;
  var lastComma = str.lastIndexOf(',');
  var lastDot = str.lastIndexOf('.');
  if(lastComma > lastDot){ str = str.replace(/\./g,'').replace(',','.'); }
  else if(lastDot > lastComma){ str = str.replace(/,/g,''); }
  else {
    if((str.match(/\./g)||[]).length > 1) str = str.replace(/\./g,'');
    if((str.match(/,/g)||[]).length > 1) str = str.replace(/,/g,'');
    str = str.replace(',','.');
  }
  var n = parseFloat(str);
  return isFinite(n) ? n : 0;
}

function _calcFmt(n, frac){
  if(!isFinite(n) || n === 0) return '0,00';
  frac = (frac == null) ? 2 : frac;
  return n.toLocaleString('es-VE',{minimumFractionDigits:frac, maximumFractionDigits:frac});
}

// Convierte cualquier moneda a USD usando la fuente activa
function _calcToUsd(monto, m, fuente, bcv, eur, bin){
  var rate = fuente === 'BINANCE' ? bin : bcv;
  if(m==='USD' || m==='USDT') return monto;
  if(m==='Bs')  return rate>0 ? monto/rate : 0;
  if(m==='EUR') return bcv>0 && eur>0 ? (monto*eur)/bcv : 0;
  return 0;
}

// Convierte USD a moneda destino usando la fuente activa
function _calcFromUsd(usd, m, fuente, bcv, eur, bin){
  var rate = fuente === 'BINANCE' ? bin : bcv;
  if(m==='USD' || m==='USDT') return usd;
  if(m==='Bs')  return usd * rate;
  if(m==='EUR') return eur>0 && bcv>0 ? (usd*bcv)/eur : 0;
  return 0;
}

function calcOnInput(ev){
  window._calcMonto = _calcParseMonto(ev.target.value);
  calcRender();
}

function calcSetFuente(f){
  window._calcFuente = f;
  document.querySelectorAll('.cv-src-btn').forEach(function(b,i){
    b.classList.toggle('is-active', (i===0&&f==='BCV')||(i===1&&f==='BINANCE'));
  });
  calcRender();
}

function calcSwap(){
  var de = window._calcMonedaDe, a = window._calcMonedaA;
  window._calcMonedaDe = a;
  window._calcMonedaA = de;
  // Refresh: re-render full page sections that show de/a
  nav('calculadora');
}

function calcQuick(monto){
  window._calcMonto = monto;
  var input = document.getElementById('calc-monto');
  if(input) input.value = monto.toLocaleString('es-VE',{minimumFractionDigits:2, maximumFractionDigits:2});
  calcRender();
}

// ─── Selector modal ───
function calcOpenSelector(target){
  window._calcSelectorTarget = target;
  var modal = document.getElementById('cv-modal');
  var opts = document.getElementById('cv-modal-opts');
  if(!modal || !opts) return;
  var current = target==='de' ? window._calcMonedaDe : window._calcMonedaA;
  var monedas = ['USD','Bs','EUR','USDT'];
  var html = '';
  var styles = {
    USD: {bg:'#15803D', sym:'$', font:.65},
    Bs : {bg:'#1f1f23', sym:'Bs', font:.42},
    EUR: {bg:'#003399', sym:'€', font:.62},
    USDT:{bg:'#26A17B', sym:'₮', font:.58}
  };
  monedas.forEach(function(m){
    var s = styles[m];
    html += '<div class="cv-modal-opt '+(m===current?'is-selected':'')+'" onclick="calcSelect(\''+m+'\')">'
      + '<span style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:'+s.bg+';color:#fff;font-weight:900;font-size:'+(32*s.font)+'px;font-family:var(--fd);flex-shrink:0;letter-spacing:-.5px">'+s.sym+'</span>'
      + '<div>'
        + '<div class="cv-modal-opt-name">'+m+'</div>'
        + '<div class="cv-modal-opt-sub">'+_calcCurName(m)+'</div>'
      + '</div>'
    + '</div>';
  });
  opts.innerHTML = html;
  modal.classList.add('is-open');
}

function calcCloseSelector(){
  var modal = document.getElementById('cv-modal');
  if(modal) modal.classList.remove('is-open');
}

function calcSelect(m){
  var target = window._calcSelectorTarget;
  if(target==='de') window._calcMonedaDe = m;
  else window._calcMonedaA = m;
  // Si las dos quedan iguales, intercambiar
  if(window._calcMonedaDe === window._calcMonedaA){
    if(target==='de') window._calcMonedaA = (m==='USD'?'Bs':'USD');
    else window._calcMonedaDe = (m==='USD'?'Bs':'USD');
  }
  calcCloseSelector();
  nav('calculadora');
}

// ─── RENDER ───
function calcRender(){
  var bcv = window._tasaBsGlobal || 0;
  var eur = window._tasaEuro || 0;
  var bin = window._tasaBinance || 0;
  var fuente = window._calcFuente || 'BCV';
  var de = window._calcMonedaDe || 'USD';
  var a  = window._calcMonedaA  || 'Bs';
  var monto = window._calcMonto || 0;

  // Update ticker values
  var setText = function(id, v){ var el = document.getElementById(id); if(el) el.innerHTML = v; };
  setText('cv-tk-bcv', (bcv>1 ? _calcFmt(bcv) : '—')+'<small>Bs/$</small>');
  setText('cv-tk-eur', (eur>1 ? _calcFmt(eur) : '—')+'<small>Bs/€</small>');
  setText('cv-tk-bin', (bin>1 ? _calcFmt(bin) : '—')+'<small>Bs/$</small>');
  setText('cv-src-bcv', bcv>1 ? _calcFmt(bcv) : '—');
  setText('cv-src-bin', bin>1 ? _calcFmt(bin) : '—');

  // Compute result: de → USD → a
  var enUsd = _calcToUsd(monto, de, fuente, bcv, eur, bin);
  var result = _calcFromUsd(enUsd, a, fuente, bcv, eur, bin);

  var resultEl = document.getElementById('calc-result');
  if(resultEl) resultEl.value = _calcFmt(result);

  // Summary line: "1 USD = 544,58 Bs · BCV"
  var unidad = _calcFromUsd(_calcToUsd(1, de, fuente, bcv, eur, bin), a, fuente, bcv, eur, bin);
  setText('cv-summary-eq', '1 '+de+' = <strong style="font-weight:900">'+_calcFmt(unidad, unidad<1?4:2)+'</strong> '+a);

  // ─── EQUIVALENCIAS CRUZADAS (todas las otras conversiones del monto) ───
  var otras = ['USD','Bs','EUR','USDT'].filter(function(x){ return x !== de && x !== a; });
  // siempre mostrar también la misma moneda con la otra fuente si aplica (BCV vs Binance)
  var cruz = '';
  function cruzRow(label, valor, cur, method){
    return '<div class="cv-cruz-row">'
      + '<div class="cv-cruz-info">'
        + '<div class="cv-cruz-from">'+label+'</div>'
        + '<div class="cv-cruz-method">'+method+'</div>'
      + '</div>'
      + '<div class="cv-cruz-val">'+_calcFmt(valor)+'<small>'+cur+'</small></div>'
    + '</div>';
  }

  // Conversión a las otras monedas
  otras.forEach(function(m){
    var v = _calcFromUsd(enUsd, m, fuente, bcv, eur, bin);
    if(v > 0){
      cruz += cruzRow(monto.toLocaleString('es-VE')+' '+de+' → '+m, v, m, 'Vía '+(fuente==='BCV'?'BCV oficial':'Binance P2P'));
    }
  });

  // Misma conversión pero con la otra fuente (para que se vea la brecha en práctica)
  if(fuente === 'BCV' && bin > 1){
    var resultBin = _calcFromUsd(_calcToUsd(monto, de, 'BINANCE', bcv, eur, bin), a, 'BINANCE', bcv, eur, bin);
    if(resultBin > 0 && Math.abs(resultBin - result) > 0.01){
      cruz += cruzRow(monto.toLocaleString('es-VE')+' '+de+' → '+a, resultBin, a, 'Si usaras Binance P2P en vez de BCV');
    }
  } else if(fuente === 'BINANCE' && bcv > 1){
    var resultBcv = _calcFromUsd(_calcToUsd(monto, de, 'BCV', bcv, eur, bin), a, 'BCV', bcv, eur, bin);
    if(resultBcv > 0 && Math.abs(resultBcv - result) > 0.01){
      cruz += cruzRow(monto.toLocaleString('es-VE')+' '+de+' → '+a, resultBcv, a, 'Si usaras BCV oficial en vez de Binance');
    }
  }

  var cruzEl = document.getElementById('cv-cruz');
  if(cruzEl) cruzEl.innerHTML = cruz || '<div style="padding:14px;text-align:center;color:#9CA3AF;font-size:12px">Sin equivalencias adicionales</div>';

  // ─── BRECHAS DASHBOARD ───
  var br = '';
  function brRow(lbl, sub, val, arrow, arrowKind){
    return '<div class="cv-br-row">'
      + '<div>'
        + '<div class="cv-br-lbl">'+lbl+'</div>'
        + '<div class="cv-br-sub">'+sub+'</div>'
      + '</div>'
      + '<div style="text-align:right">'
        + '<div class="cv-br-val" style="color:'+(arrowKind==='high'?'#991B1B':(arrowKind==='low'?'#047857':'#1D4ED8'))+'">'+val+'</div>'
        + (arrow ? '<span class="cv-br-arrow '+arrowKind+'">'+arrow+'</span>' : '')
      + '</div>'
    + '</div>';
  }
  function brKind(pct){ return pct > 30 ? 'high' : (pct > 15 ? 'up' : 'low'); }

  if(bcv > 1 && bin > 1){
    var pct = ((bin - bcv) / bin) * 100;
    br += brRow(
      'BCV vs Binance (USD)',
      'Brecha del paralelo sobre el oficial',
      (pct>=0?'+':'')+pct.toFixed(1)+'%',
      'Bs '+_calcFmt(bin-bcv)+' por USD',
      brKind(pct)
    );
  }

  if(bcv > 1 && eur > 1){
    var eurUsdBcv = eur / bcv;
    br += brRow(
      'EUR/USD implícito',
      'Cross-rate del BCV (mercado int. ≈ 1.08)',
      eurUsdBcv.toFixed(4),
      '',
      'low'
    );
  }

  if(bcv > 1 && eur > 1 && bin > 1){
    var eurParalelo = bin * (eur / bcv);
    var pctE = ((eurParalelo - eur) / eurParalelo) * 100;
    br += brRow(
      'EUR oficial vs paralelo',
      '1 EUR paralelo ≈ Bs '+_calcFmt(eurParalelo),
      (pctE>=0?'+':'')+pctE.toFixed(1)+'%',
      'Bs '+_calcFmt(eurParalelo-eur)+' por EUR',
      brKind(pctE)
    );
  }

  if(bcv > 1 && bin > 1){
    br += brRow(
      'Premium USD paralelo',
      'Cuánto más caro es el dólar Binance',
      'Bs '+_calcFmt(bin - bcv),
      'sobre el oficial',
      'up'
    );
  }

  var brEl = document.getElementById('cv-brechas');
  if(brEl) brEl.innerHTML = br || '<div style="padding:14px;text-align:center;color:#9CA3AF;font-size:12px">Cargando tasas…</div>';
}

window.calcOnInput = calcOnInput;
window.calcSetFuente = calcSetFuente;
window.calcSwap = calcSwap;
window.calcQuick = calcQuick;
window.calcOpenSelector = calcOpenSelector;
window.calcCloseSelector = calcCloseSelector;
window.calcSelect = calcSelect;
window.calcRender = calcRender;
