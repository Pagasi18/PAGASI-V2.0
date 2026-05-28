// ══════════════════════════════════════════════════════════════
// CALCULADORA DE TASAS — Conversor multi-moneda BCV / EUR / Binance
// ══════════════════════════════════════════════════════════════

PG.calculadora = function(){
  var bcv = window._tasaBsGlobal || 0;
  var eur = window._tasaEuro || 0;
  var bin = window._tasaBinance || 0;
  var monedaActiva = window._calcMoneda || 'USD';
  var montoActivo = (typeof window._calcMonto === 'number') ? window._calcMonto : 100;

  function logoFor(m, size){
    size = size || 32;
    var inner = size * 0.55;
    if(m==='BCV')     return '<span style="display:inline-flex;align-items:center;justify-content:center;width:'+size+'px;height:'+size+'px;border-radius:50%;background:linear-gradient(135deg,#1E40AF,#1E3A8A);flex-shrink:0;box-shadow:0 4px 10px rgba(30,64,175,.32)"><svg width="'+inner+'" height="'+inner+'" viewBox="0 0 24 24" fill="none"><path d="M6 4v16M11 4v16M16 4v16M3 8h18M3 16h18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg></span>';
    if(m==='EUR')     return '<span style="display:inline-flex;align-items:center;justify-content:center;width:'+size+'px;height:'+size+'px;border-radius:50%;background:linear-gradient(135deg,#003399,#001F66);flex-shrink:0;box-shadow:0 4px 10px rgba(0,31,102,.32)"><svg width="'+inner+'" height="'+inner+'" viewBox="0 0 24 24" fill="none"><path d="M16 6.5a6 6 0 0 0-9.5 4.5a6 6 0 0 0 9.5 4.5M4 10h7M4 13h7" stroke="#FFD700" stroke-width="2.4" stroke-linecap="round"/></svg></span>';
    if(m==='Binance' || m==='USDT') return '<span style="display:inline-flex;align-items:center;justify-content:center;width:'+size+'px;height:'+size+'px;border-radius:50%;background:linear-gradient(135deg,#1a1d20,#0B0E11);flex-shrink:0;box-shadow:0 4px 10px rgba(11,14,17,.34)"><svg width="'+(inner*0.95)+'" height="'+(inner*0.95)+'" viewBox="0 0 24 24" fill="#F0B90B"><path d="M12 4l-2.5 2.5L12 9l2.5-2.5L12 4zM5.5 10.5L3 13l2.5 2.5L8 13l-2.5-2.5zm13 0L16 13l2.5 2.5L21 13l-2.5-2.5zM12 15l-2.5 2.5L12 20l2.5-2.5L12 15z"/></svg></span>';
    if(m==='USD')     return '<span style="display:inline-flex;align-items:center;justify-content:center;width:'+size+'px;height:'+size+'px;border-radius:50%;background:linear-gradient(135deg,#15803D,#166534);flex-shrink:0;box-shadow:0 4px 10px rgba(21,128,61,.32);color:#fff;font-family:var(--fd);font-weight:900;font-size:'+(inner*0.9)+'px">$</span>';
    if(m==='Bs')      return '<span style="display:inline-flex;align-items:center;justify-content:center;width:'+size+'px;height:'+size+'px;border-radius:50%;background:linear-gradient(135deg,#444,#1a1a1a);flex-shrink:0;box-shadow:0 4px 10px rgba(0,0,0,.22);color:#fff;font-family:var(--fd);font-weight:900;font-size:'+(inner*0.65)+'px">Bs</span>';
    return '';
  }

  setTimeout(function(){
    calcRender();
    var inp = document.getElementById('calc-monto');
    if(inp){ inp.focus(); inp.select(); }
  }, 60);

  var styles = `<style>
    .calc-page{background:linear-gradient(180deg,#FAFBFF 0%,#fff 320px);min-height:calc(100vh - 100px)}
    .calc-wrap{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start;margin-top:6px}
    @media(max-width:980px){.calc-wrap{grid-template-columns:1fr}}

    /* ── Card base ── */
    .c-card{background:#fff;border:1px solid var(--rim);border-radius:18px;padding:20px 22px;box-shadow:0 2px 8px rgba(0,0,0,.02);transition:box-shadow .2s}
    .c-card:hover{box-shadow:0 8px 24px rgba(0,0,0,.06)}
    .c-title{font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);margin-bottom:14px;display:flex;align-items:center;gap:8px}
    .c-title::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--p1);display:inline-block;box-shadow:0 0 0 3px rgba(37,99,235,.15)}
    .c-title-right{margin-left:auto;display:flex;align-items:center;gap:6px}

    /* ── Tasas en vivo ── */
    .c-tasa-row{display:flex;align-items:center;gap:12px;padding:11px 13px;border-radius:13px;background:linear-gradient(135deg,#FAFBFF,#fff);border:1px solid var(--rim);margin-bottom:7px;transition:all .2s cubic-bezier(.4,0,.2,1)}
    .c-tasa-row:hover{transform:translateX(2px);border-color:rgba(37,99,235,.3);background:linear-gradient(135deg,#F0F4FF,#fff)}
    .c-tasa-row:last-child{margin-bottom:0}
    .c-tasa-info{flex:1;min-width:0}
    .c-tasa-nom{font-size:13px;font-weight:800;color:var(--ink);letter-spacing:-.2px;line-height:1.2}
    .c-tasa-sub{font-size:10.5px;color:var(--ink3);font-weight:600;margin-top:2px;line-height:1.2}
    .c-tasa-val{font-family:var(--fd);font-weight:900;font-size:18px;color:var(--ink);letter-spacing:-.5px;white-space:nowrap;text-align:right}
    .c-tasa-val small{font-size:11px;color:var(--ink3);font-weight:700;margin-left:4px}

    .c-refresh{background:var(--surf2);border:1px solid var(--rim);color:var(--ink2);border-radius:50%;width:30px;height:30px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;line-height:1;padding:0;transition:.3s}
    .c-refresh:hover{transform:rotate(180deg);background:var(--p1);color:#fff;border-color:var(--p1)}

    /* ── Input hero ── */
    .c-hero{background:linear-gradient(135deg,#2563EB 0%,#1E40AF 100%);border-radius:20px;padding:24px 22px;color:#fff;position:relative;overflow:hidden;box-shadow:0 10px 30px rgba(37,99,235,.22)}
    .c-hero::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:radial-gradient(circle,rgba(255,255,255,.10),transparent 70%);pointer-events:none}
    .c-hero::after{content:'';position:absolute;bottom:-80px;left:-30px;width:160px;height:160px;background:radial-gradient(circle,rgba(255,255,255,.06),transparent 70%);pointer-events:none}
    .c-hero-label{font-size:10.5px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.85);margin-bottom:14px;position:relative;z-index:1}
    .c-input-wrap{position:relative;margin-bottom:14px;z-index:1}
    .c-input-prefix{position:absolute;left:18px;top:50%;transform:translateY(-50%);font-family:var(--fd);font-weight:900;font-size:34px;color:rgba(255,255,255,.55);pointer-events:none;letter-spacing:-1px}
    .c-input{width:100%;padding:18px 22px 18px 62px;border:2px solid rgba(255,255,255,.18);border-radius:14px;font-family:var(--fd);font-size:36px;font-weight:900;color:#fff;background:rgba(255,255,255,.08);outline:none;transition:.2s;letter-spacing:-1.2px;text-align:right;backdrop-filter:blur(6px)}
    .c-input:focus{border-color:rgba(255,255,255,.55);background:rgba(255,255,255,.15)}
    .c-input::placeholder{color:rgba(255,255,255,.4)}

    .c-mon-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;position:relative;z-index:1}
    .c-mon-chip{background:rgba(255,255,255,.10);border:1.5px solid rgba(255,255,255,.18);color:rgba(255,255,255,.92);font-family:inherit;font-size:12px;font-weight:800;padding:11px 6px;border-radius:11px;cursor:pointer;transition:all .2s;display:flex;flex-direction:column;align-items:center;gap:7px;letter-spacing:-.1px;backdrop-filter:blur(6px)}
    .c-mon-chip:hover{background:rgba(255,255,255,.18);border-color:rgba(255,255,255,.4);transform:translateY(-2px)}
    .c-mon-chip.is-active{background:#fff;border-color:#fff;color:var(--p1);box-shadow:0 6px 16px rgba(0,0,0,.18)}

    /* ── Resultados ── */
    .c-res{display:grid;gap:9px}
    .c-res-item{display:flex;align-items:center;gap:13px;padding:14px 16px;background:#fff;border:1px solid var(--rim);border-radius:14px;transition:all .25s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden}
    .c-res-item:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(0,0,0,.06);border-color:rgba(37,99,235,.18)}
    .c-res-bar{position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:0 4px 4px 0}
    .c-res-info{flex:1;min-width:0;padding-left:6px}
    .c-res-lbl{font-size:11px;color:var(--ink3);font-weight:800;text-transform:uppercase;letter-spacing:.5px;line-height:1.2}
    .c-res-method{font-size:11.5px;color:var(--ink2);font-weight:600;margin-top:4px;line-height:1.3}
    .c-res-val{font-family:var(--fd);font-weight:900;font-size:22px;color:var(--ink);letter-spacing:-.6px;white-space:nowrap;line-height:1}
    .c-res-cur{font-size:12px;color:var(--ink3);font-weight:700;margin-left:6px}

    /* ── Brechas grid ── */
    .c-brechas{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}
    @media(max-width:600px){.c-brechas{grid-template-columns:1fr}}
    .c-brecha{padding:12px 14px;border-radius:13px;background:linear-gradient(135deg,#FAFBFF,#fff);border:1px solid var(--rim);transition:all .2s}
    .c-brecha:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,.05)}
    .c-brecha-lbl{font-size:10px;color:var(--ink3);font-weight:800;text-transform:uppercase;letter-spacing:.5px;line-height:1.2;margin-bottom:6px;display:flex;align-items:center;gap:5px}
    .c-brecha-val{font-family:var(--fd);font-weight:900;font-size:24px;letter-spacing:-.6px;line-height:1}
    .c-brecha-sub{font-size:10.5px;color:var(--ink3);font-weight:600;margin-top:4px;line-height:1.35}

    .c-brecha-pill{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;font-size:9px;font-weight:900;color:#fff;line-height:1}

    /* ── Atajos ── */
    .c-quick-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
    .c-quick{background:#fff;border:1.5px solid var(--rim);color:var(--ink2);font-family:var(--fd);font-size:12.5px;font-weight:800;padding:10px 8px;border-radius:10px;cursor:pointer;transition:.15s;text-align:center;letter-spacing:-.2px}
    .c-quick:hover{background:var(--p1);color:#fff;border-color:var(--p1);transform:translateY(-2px);box-shadow:0 6px 14px rgba(37,99,235,.28)}
    .c-quick-cat{font-size:10px;color:var(--ink3);font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 7px;display:flex;align-items:center;gap:6px}
    .c-quick-cat:first-of-type{margin-top:0}
    .c-quick-cat::before{content:'';width:3px;height:3px;border-radius:50%;background:var(--ink3);display:inline-block}
  </style>`;

  return styles + `<div class="page calc-page">

  ${pageBanner(
    'Operaciones · Conversor',
    'Calculadora',
    'Convierte entre Bs, USD, EUR y USDT/Binance · Tasas en vivo del BCV y mercado paralelo'
  )}

  <div class="calc-wrap">

    <!-- COLUMNA IZQUIERDA: HERO + TASAS -->
    <div>
      <!-- Hero card: input grande gradient azul -->
      <div class="c-hero" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1;margin-bottom:6px">
          <div class="c-hero-label">Monto a convertir</div>
        </div>
        <div class="c-input-wrap">
          <span class="c-input-prefix" id="calc-input-prefix">$</span>
          <input type="text" inputmode="decimal" id="calc-monto" class="c-input"
                 value="${montoActivo.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2})}"
                 oninput="calcOnInput(event)" onfocus="this.select()" placeholder="0,00">
        </div>
        <div class="c-mon-grid">
          <button class="c-mon-chip ${monedaActiva==='USD'?'is-active':''}" data-mon="USD" onclick="calcSetMoneda('USD')">
            ${logoFor('USD', 22)}<span>USD</span>
          </button>
          <button class="c-mon-chip ${monedaActiva==='Bs'?'is-active':''}" data-mon="Bs" onclick="calcSetMoneda('Bs')">
            ${logoFor('Bs', 22)}<span>Bolívares</span>
          </button>
          <button class="c-mon-chip ${monedaActiva==='EUR'?'is-active':''}" data-mon="EUR" onclick="calcSetMoneda('EUR')">
            ${logoFor('EUR', 22)}<span>EUR</span>
          </button>
          <button class="c-mon-chip ${monedaActiva==='USDT'?'is-active':''}" data-mon="USDT" onclick="calcSetMoneda('USDT')">
            ${logoFor('Binance', 22)}<span>Binance</span>
          </button>
        </div>
      </div>

      <!-- Card tasas en vivo -->
      <div class="c-card" style="margin-bottom:14px">
        <div class="c-title">
          Tasas en vivo
          <div class="c-title-right">
            <button class="c-refresh" onclick="bcvForzarActualizacion&&bcvForzarActualizacion();setTimeout(calcRender,800)" title="Actualizar tasas">↻</button>
          </div>
        </div>
        <div class="c-tasa-row">
          ${logoFor('BCV', 34)}
          <div class="c-tasa-info"><div class="c-tasa-nom">BCV</div><div class="c-tasa-sub">Dólar oficial · USD</div></div>
          <div class="c-tasa-val" id="calc-bcv-val">${bcv>1?bcv.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}<small>Bs</small></div>
        </div>
        <div class="c-tasa-row">
          ${logoFor('EUR', 34)}
          <div class="c-tasa-info"><div class="c-tasa-nom">Euro</div><div class="c-tasa-sub">EUR oficial · Banco Central</div></div>
          <div class="c-tasa-val" id="calc-eur-val">${eur>1?eur.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}<small>Bs</small></div>
        </div>
        <div class="c-tasa-row">
          ${logoFor('Binance', 34)}
          <div class="c-tasa-info"><div class="c-tasa-nom">Binance</div><div class="c-tasa-sub">USDT P2P · paralelo</div></div>
          <div class="c-tasa-val" id="calc-bin-val">${bin>1?bin.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}<small>Bs</small></div>
        </div>
      </div>

      <!-- Card atajos -->
      <div class="c-card">
        <div class="c-title">Atajos rápidos</div>
        <div class="c-quick-cat">Dólares</div>
        <div class="c-quick-grid">
          <button class="c-quick" onclick="calcQuick(10,'USD')">$10</button>
          <button class="c-quick" onclick="calcQuick(50,'USD')">$50</button>
          <button class="c-quick" onclick="calcQuick(100,'USD')">$100</button>
          <button class="c-quick" onclick="calcQuick(500,'USD')">$500</button>
          <button class="c-quick" onclick="calcQuick(1000,'USD')">$1k</button>
          <button class="c-quick" onclick="calcQuick(5000,'USD')">$5k</button>
        </div>
        <div class="c-quick-cat">Bolívares</div>
        <div class="c-quick-grid">
          <button class="c-quick" onclick="calcQuick(1000,'Bs')">Bs 1k</button>
          <button class="c-quick" onclick="calcQuick(10000,'Bs')">Bs 10k</button>
          <button class="c-quick" onclick="calcQuick(50000,'Bs')">Bs 50k</button>
          <button class="c-quick" onclick="calcQuick(100000,'Bs')">Bs 100k</button>
          <button class="c-quick" onclick="calcQuick(500000,'Bs')">Bs 500k</button>
          <button class="c-quick" onclick="calcQuick(1000000,'Bs')">Bs 1M</button>
        </div>
        <div class="c-quick-cat">Euros</div>
        <div class="c-quick-grid">
          <button class="c-quick" onclick="calcQuick(100,'EUR')">€100</button>
          <button class="c-quick" onclick="calcQuick(500,'EUR')">€500</button>
          <button class="c-quick" onclick="calcQuick(1000,'EUR')">€1k</button>
        </div>
      </div>
    </div>

    <!-- COLUMNA DERECHA: EQUIVALENCIAS + BRECHAS -->
    <div>
      <!-- Equivalencias -->
      <div class="c-card" style="margin-bottom:14px">
        <div class="c-title">Equivalencias</div>
        <div id="calc-resultados" class="c-res"></div>
      </div>

      <!-- Brechas -->
      <div class="c-card">
        <div class="c-title">Brechas y mercado</div>
        <div id="calc-brechas" class="c-brechas"></div>
      </div>
    </div>

  </div>
  </div>`;
};

// ─── ESTADO ───
window._calcMoneda = window._calcMoneda || 'USD';
window._calcMonto  = (typeof window._calcMonto === 'number') ? window._calcMonto : 100;

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

function _calcPrefixFor(m){ return {USD:'$', Bs:'Bs', EUR:'€', USDT:'₮'}[m] || '$'; }

function calcOnInput(ev){
  var monto = _calcParseMonto(ev.target.value);
  window._calcMonto = monto;
  calcRender();
}

function calcSetMoneda(m){
  window._calcMoneda = m;
  document.querySelectorAll('.c-mon-chip').forEach(function(btn){
    btn.classList.toggle('is-active', btn.getAttribute('data-mon') === m);
  });
  var prefix = document.getElementById('calc-input-prefix');
  if(prefix) prefix.textContent = _calcPrefixFor(m);
  calcRender();
}

function calcQuick(monto, moneda){
  window._calcMonto = monto;
  window._calcMoneda = moneda;
  var input = document.getElementById('calc-monto');
  if(input) input.value = monto.toLocaleString('es-VE',{minimumFractionDigits:2, maximumFractionDigits:2});
  var prefix = document.getElementById('calc-input-prefix');
  if(prefix) prefix.textContent = _calcPrefixFor(moneda);
  document.querySelectorAll('.c-mon-chip').forEach(function(btn){
    btn.classList.toggle('is-active', btn.getAttribute('data-mon') === moneda);
  });
  calcRender();
}

// ─── RENDER ───
function calcRender(){
  var bcv = window._tasaBsGlobal || 0;
  var eur = window._tasaEuro || 0;
  var bin = window._tasaBinance || 0;

  var bcvEl = document.getElementById('calc-bcv-val'); if(bcvEl) bcvEl.innerHTML = (bcv>1 ? _calcFmt(bcv) : '—')+'<small>Bs</small>';
  var eurEl = document.getElementById('calc-eur-val'); if(eurEl) eurEl.innerHTML = (eur>1 ? _calcFmt(eur) : '—')+'<small>Bs</small>';
  var binEl = document.getElementById('calc-bin-val'); if(binEl) binEl.innerHTML = (bin>1 ? _calcFmt(bin) : '—')+'<small>Bs</small>';

  var monto = window._calcMonto || 0;
  var moneda = window._calcMoneda || 'USD';

  // ─── Calcular conversiones ───
  var bs_via_bcv=0, bs_via_bin=0, bs_via_eur=0;
  var en_usd_bcv=0, en_usd_bin=0;
  var en_eur_bcv=0, en_usdt=0;

  if(moneda==='USD'){
    bs_via_bcv = monto * bcv;
    bs_via_bin = monto * bin;
    en_eur_bcv = eur > 0 ? (monto * bcv / eur) : 0;
    en_usdt = monto;
  } else if(moneda==='Bs'){
    en_usd_bcv = bcv > 0 ? (monto / bcv) : 0;
    en_usd_bin = bin > 0 ? (monto / bin) : 0;
    en_eur_bcv = eur > 0 ? (monto / eur) : 0;
    en_usdt = en_usd_bin;
  } else if(moneda==='EUR'){
    bs_via_eur = monto * eur;
    en_usd_bcv = bcv > 0 ? (monto * eur / bcv) : 0;
    en_usd_bin = bin > 0 ? (monto * eur / bin) : 0;
    en_usdt = en_usd_bin;
  } else if(moneda==='USDT'){
    bs_via_bin = monto * bin;
    en_usd_bcv = monto;
    en_eur_bcv = eur > 0 ? (monto * bin / eur) : 0;
  }

  function row(label, valor, cur, method, accent){
    return '<div class="c-res-item">'
      + '<div class="c-res-bar" style="background:'+accent+'"></div>'
      + '<div class="c-res-info">'
        + '<div class="c-res-lbl">'+label+'</div>'
        + '<div class="c-res-method">'+method+'</div>'
      + '</div>'
      + '<div style="text-align:right">'
        + '<div class="c-res-val">'+_calcFmt(valor)+'<span class="c-res-cur">'+cur+'</span></div>'
      + '</div>'
    + '</div>';
  }

  var html = '';
  if(moneda==='USD'){
    html += row('A Bolívares', bs_via_bcv, 'Bs', 'Tasa BCV (oficial)', '#1E40AF');
    html += row('A Bolívares', bs_via_bin, 'Bs', 'Tasa Binance P2P (paralelo)', '#F0B90B');
    if(en_eur_bcv > 0) html += row('A Euros', en_eur_bcv, '€', 'Cruz BCV: USD → Bs → EUR', '#003399');
  } else if(moneda==='Bs'){
    html += row('A Dólares', en_usd_bcv, '$', 'Tasa BCV (oficial)', '#1E40AF');
    html += row('A Dólares', en_usd_bin, '$', 'Tasa Binance P2P (paralelo)', '#F0B90B');
    if(en_eur_bcv > 0) html += row('A Euros', en_eur_bcv, '€', 'Tasa EUR oficial BCV', '#003399');
  } else if(moneda==='EUR'){
    html += row('A Bolívares', bs_via_eur, 'Bs', 'Tasa EUR oficial BCV', '#003399');
    if(en_usd_bcv > 0) html += row('A Dólares', en_usd_bcv, '$', 'Cruz oficial: EUR → Bs → USD', '#1E40AF');
    if(en_usd_bin > 0) html += row('A Dólares', en_usd_bin, '$', 'Cruz mixto: EUR oficial → USDT paralelo', '#F0B90B');
  } else if(moneda==='USDT'){
    html += row('A Bolívares', bs_via_bin, 'Bs', 'Binance P2P', '#F0B90B');
    html += row('A Dólares', en_usd_bcv, '$', 'USDT ≈ USD (1:1)', '#1E40AF');
    if(en_eur_bcv > 0) html += row('A Euros', en_eur_bcv, '€', 'Cruz: USDT → Bs → EUR', '#003399');
  }

  var cont = document.getElementById('calc-resultados');
  if(cont) cont.innerHTML = html;

  // ─── BRECHAS Y MERCADO ───
  var brechas = '';
  function brecha(lbl, val, sub, col){
    return '<div class="c-brecha">'
      + '<div class="c-brecha-lbl">'+lbl+'</div>'
      + '<div class="c-brecha-val" style="color:'+col+'">'+val+'</div>'
      + '<div class="c-brecha-sub">'+sub+'</div>'
      + '</div>';
  }
  function pickCol(pct){ return pct > 30 ? '#E8335A' : (pct > 15 ? '#BA7517' : '#15803D'); }

  if(bcv > 1 && bin > 1){
    var brechaUsd = ((bin - bcv) / bin) * 100;
    brechas += brecha(
      'Brecha USD oficial → paralelo',
      (brechaUsd>=0?'+':'')+brechaUsd.toFixed(1)+'%',
      'El BCV está '+brechaUsd.toFixed(1)+'% por debajo del Binance',
      pickCol(brechaUsd)
    );
    var spreadUsd = bin - bcv;
    brechas += brecha(
      'Premium por USD',
      'Bs '+_calcFmt(spreadUsd),
      'Cada USD paralelo te cuesta Bs '+_calcFmt(spreadUsd)+' más que el oficial',
      '#7C3AED'
    );
  }

  if(bcv > 1 && eur > 1){
    // EUR/USD implícito según el BCV
    var eurUsdBcv = eur / bcv;
    brechas += brecha(
      'EUR/USD implícito BCV',
      eurUsdBcv.toFixed(4),
      'El BCV publica 1 EUR = '+eurUsdBcv.toFixed(4)+' USD (mercado internacional ≈ 1.08)',
      '#003399'
    );
  }

  if(bcv > 1 && eur > 1 && bin > 1){
    // Brecha EUR oficial vs EUR paralelo estimado
    // EUR paralelo estimado = Binance × (EUR/USD del BCV) = Binance × eur/bcv
    var eurParalelo = bin * (eur / bcv);
    var brechaEur = ((eurParalelo - eur) / eurParalelo) * 100;
    brechas += brecha(
      'Brecha EUR oficial → paralelo',
      (brechaEur>=0?'+':'')+brechaEur.toFixed(1)+'%',
      '1 EUR paralelo estimado ≈ Bs '+_calcFmt(eurParalelo)+' · oficial Bs '+_calcFmt(eur),
      pickCol(brechaEur)
    );
    var spreadEur = eurParalelo - eur;
    brechas += brecha(
      'Premium por EUR',
      'Bs '+_calcFmt(spreadEur),
      'Cada EUR paralelo te costaría Bs '+_calcFmt(spreadEur)+' más que el oficial',
      '#7C3AED'
    );
  }

  if(bcv > 1 && eur > 1){
    // Cross-rate: cuántos USD compras con 1 EUR oficial
    brechas += brecha(
      'EUR oficial → USD oficial',
      '$ '+_calcFmt(eur/bcv, 4),
      '1 EUR del BCV equivale a '+_calcFmt(eur/bcv,4)+' USD del BCV (cross-rate)',
      '#15803D'
    );
  }

  var bcont = document.getElementById('calc-brechas');
  if(bcont) bcont.innerHTML = brechas || '<div style="padding:20px;text-align:center;color:var(--ink3);font-size:12px;grid-column:1/-1">Cargando tasas...</div>';
}

window.calcOnInput = calcOnInput;
window.calcSetMoneda = calcSetMoneda;
window.calcQuick = calcQuick;
window.calcRender = calcRender;
