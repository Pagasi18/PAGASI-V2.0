// ══════════════════════════════════════════════════════════════
// CALCULADORA DE TASAS — Conversor multi-moneda con BCV / EUR / Binance
// ══════════════════════════════════════════════════════════════

PG.calculadora = function(){
  var bcv = window._tasaBsGlobal || 0;
  var eur = window._tasaEuro || 0;
  var bin = window._tasaBinance || 0;
  var monedaActiva = window._calcMoneda || 'USD';
  var montoActivo = (typeof window._calcMonto === 'number') ? window._calcMonto : 100;

  // Logos compartidos con el Dashboard
  var logoBCV  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 4v16M11 4v16M16 4v16M3 8h18M3 16h18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>';
  var logoEUR  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M16 6.5a6 6 0 0 0-9.5 4.5a6 6 0 0 0 9.5 4.5M4 10h7M4 13h7" stroke="#FFD700" stroke-width="2.4" stroke-linecap="round"/></svg>';
  var logoBIN  = '<svg width="13" height="13" viewBox="0 0 24 24" fill="#F0B90B"><path d="M12 4l-2.5 2.5L12 9l2.5-2.5L12 4zM5.5 10.5L3 13l2.5 2.5L8 13l-2.5-2.5zm13 0L16 13l2.5 2.5L21 13l-2.5-2.5zM12 15l-2.5 2.5L12 20l2.5-2.5L12 15z"/></svg>';
  function logoCircle(svg, bg){
    return '<span style="display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:'+bg+';flex-shrink:0">'+svg+'</span>';
  }
  function logoFor(m, size){
    size = size || 26;
    if(m==='BCV')     return '<span style="display:inline-flex;align-items:center;justify-content:center;width:'+size+'px;height:'+size+'px;border-radius:50%;background:#1E40AF;flex-shrink:0"><svg width="'+(size*0.55)+'" height="'+(size*0.55)+'" viewBox="0 0 24 24" fill="none"><path d="M6 4v16M11 4v16M16 4v16M3 8h18M3 16h18" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg></span>';
    if(m==='EUR')     return '<span style="display:inline-flex;align-items:center;justify-content:center;width:'+size+'px;height:'+size+'px;border-radius:50%;background:#003399;flex-shrink:0"><svg width="'+(size*0.55)+'" height="'+(size*0.55)+'" viewBox="0 0 24 24" fill="none"><path d="M16 6.5a6 6 0 0 0-9.5 4.5a6 6 0 0 0 9.5 4.5M4 10h7M4 13h7" stroke="#FFD700" stroke-width="2.4" stroke-linecap="round"/></svg></span>';
    if(m==='Binance' || m==='USDT') return '<span style="display:inline-flex;align-items:center;justify-content:center;width:'+size+'px;height:'+size+'px;border-radius:50%;background:#0B0E11;flex-shrink:0"><svg width="'+(size*0.5)+'" height="'+(size*0.5)+'" viewBox="0 0 24 24" fill="#F0B90B"><path d="M12 4l-2.5 2.5L12 9l2.5-2.5L12 4zM5.5 10.5L3 13l2.5 2.5L8 13l-2.5-2.5zm13 0L16 13l2.5 2.5L21 13l-2.5-2.5zM12 15l-2.5 2.5L12 20l2.5-2.5L12 15z"/></svg></span>';
    return '';
  }

  // Inicializar tras render
  setTimeout(function(){
    calcRender();
    var inp = document.getElementById('calc-monto');
    if(inp){
      inp.focus();
      inp.select();
    }
  }, 60);

  // ─── CSS ───
  var styles = `<style>
    .calc-wrap{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}
    @media(max-width:980px){.calc-wrap{grid-template-columns:1fr}}
    .calc-card{background:#fff;border:1px solid var(--rim);border-radius:14px;padding:18px 20px}
    .calc-title{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3);margin-bottom:14px;display:flex;align-items:center;gap:7px}
    .calc-title::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--p1);display:inline-block}

    /* ── Tasas chips ── */
    .calc-tasa-row{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:10px;background:var(--surf);border:1px solid var(--rim);margin-bottom:6px;transition:all .15s}
    .calc-tasa-row:hover{background:var(--gs);border-color:var(--p1)}
    .calc-tasa-row:last-child{margin-bottom:0}
    .calc-tasa-info{flex:1;min-width:0}
    .calc-tasa-nom{font-size:12px;font-weight:800;color:var(--ink);letter-spacing:-.1px}
    .calc-tasa-sub{font-size:10px;color:var(--ink3);font-weight:600;margin-top:1px}
    .calc-tasa-val{font-family:var(--fd);font-weight:900;font-size:16px;color:var(--ink);letter-spacing:-.4px;white-space:nowrap}
    .calc-refresh-btn{background:var(--surf2);border:1px solid var(--rim);color:var(--ink2);border-radius:50%;width:28px;height:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;line-height:1;padding:0;transition:.25s}
    .calc-refresh-btn:hover{transform:rotate(180deg);background:var(--p1);color:#fff;border-color:var(--p1)}

    /* ── Input grande ── */
    .calc-input-wrap{position:relative;margin-bottom:14px}
    .calc-input-prefix{position:absolute;left:18px;top:50%;transform:translateY(-50%);font-family:var(--fd);font-weight:900;font-size:30px;color:var(--ink3);pointer-events:none;letter-spacing:-1px;z-index:1}
    .calc-input{width:100%;padding:18px 22px 18px 56px;border:2px solid var(--rim);border-radius:14px;font-family:var(--fd);font-size:32px;font-weight:900;color:var(--ink);background:#fff;outline:none;transition:all .15s;letter-spacing:-1px;text-align:right}
    .calc-input:focus{border-color:var(--p1);box-shadow:0 0 0 4px rgba(37,99,235,.10);background:#fff}

    .calc-mon-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:6px}
    .calc-mon-chip{background:var(--surf2);border:1.5px solid var(--rim);color:var(--ink2);font-family:inherit;font-size:12px;font-weight:800;padding:11px 6px;border-radius:11px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:6px;letter-spacing:-.1px}
    .calc-mon-chip:hover{border-color:var(--p1);color:var(--p1);background:var(--gs);transform:translateY(-1px)}
    .calc-mon-chip.is-active{background:var(--p1);border-color:var(--p1);color:#fff;box-shadow:0 4px 12px rgba(37,99,235,.28)}
    .calc-mon-chip.is-active .calc-mon-cir{background:rgba(255,255,255,.18) !important}

    /* ── Resultados ── */
    .calc-res{display:grid;gap:8px}
    .calc-res-item{display:flex;align-items:center;gap:11px;padding:12px 14px;background:linear-gradient(135deg,var(--surf) 0%,#fff 100%);border:1px solid var(--rim);border-radius:12px;transition:all .15s}
    .calc-res-item:hover{border-color:var(--p1);box-shadow:0 4px 14px rgba(37,99,235,.08);transform:translateY(-1px)}
    .calc-res-info{flex:1;min-width:0}
    .calc-res-lbl{font-size:10.5px;color:var(--ink3);font-weight:700;text-transform:uppercase;letter-spacing:.5px;line-height:1.2}
    .calc-res-method{font-size:11px;color:var(--ink2);font-weight:700;margin-top:3px;line-height:1.2}
    .calc-res-val{font-family:var(--fd);font-weight:900;font-size:20px;color:var(--ink);letter-spacing:-.5px;white-space:nowrap;line-height:1}
    .calc-res-cur{font-size:11px;color:var(--ink3);font-weight:700;margin-left:5px}

    /* ── Atajos ── */
    .calc-quick-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
    .calc-quick{background:var(--surf2);border:1px solid var(--rim);color:var(--ink2);font-family:inherit;font-size:12px;font-weight:700;padding:9px 8px;border-radius:9px;cursor:pointer;transition:.12s;font-family:var(--fd);text-align:center;letter-spacing:-.2px}
    .calc-quick:hover{background:var(--p1);color:#fff;border-color:var(--p1);transform:translateY(-1px)}
    .calc-quick-cat{font-size:9.5px;color:var(--ink3);font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;margin-top:8px}
    .calc-quick-cat:first-child{margin-top:0}

    /* ── Swap button entre origen y destino ── */
    .calc-swap-row{display:flex;align-items:center;justify-content:center;margin:6px 0}
    .calc-swap{background:var(--p1);color:#fff;border:none;border-radius:50%;width:34px;height:34px;cursor:pointer;font-size:16px;font-weight:900;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(37,99,235,.28);transition:.2s}
    .calc-swap:hover{transform:scale(1.1) rotate(180deg)}

    /* ── Insight cards (spreads) ── */
    .calc-insight{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border-radius:9px;font-size:11.5px;font-weight:700;margin-top:6px}
    .calc-insight-lbl{color:var(--ink3);font-weight:600}
    .calc-insight-val{font-family:var(--fd);font-weight:900}
  </style>`;

  // ─── HTML ───
  return styles + `<div class="page">

  ${pageBanner(
    'Operaciones · Conversor',
    'Calculadora',
    'Convierte entre Bs, USD, EUR y USDT/Binance con tasas en vivo del BCV y mercado paralelo'
  )}

  <div class="calc-wrap">

    <!-- COLUMNA IZQUIERDA: Tasas + Input + Selectores -->
    <div>
      <!-- Card Tasas en vivo -->
      <div class="calc-card" style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div class="calc-title" style="margin-bottom:0">Tasas en vivo</div>
          <button class="calc-refresh-btn" onclick="bcvForzarActualizacion&&bcvForzarActualizacion();setTimeout(calcRender,800)" title="Actualizar tasas">↻</button>
        </div>

        <div class="calc-tasa-row" id="calc-tasa-bcv-row">
          ${logoFor('BCV')}
          <div class="calc-tasa-info"><div class="calc-tasa-nom">BCV</div><div class="calc-tasa-sub">Dólar oficial</div></div>
          <div class="calc-tasa-val" id="calc-bcv-val">${bcv>1?bcv.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</div>
        </div>
        <div class="calc-tasa-row" id="calc-tasa-eur-row">
          ${logoFor('EUR')}
          <div class="calc-tasa-info"><div class="calc-tasa-nom">Euro</div><div class="calc-tasa-sub">EUR oficial</div></div>
          <div class="calc-tasa-val" id="calc-eur-val">${eur>1?eur.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</div>
        </div>
        <div class="calc-tasa-row" id="calc-tasa-bin-row">
          ${logoFor('Binance')}
          <div class="calc-tasa-info"><div class="calc-tasa-nom">Binance</div><div class="calc-tasa-sub">USDT P2P paralelo</div></div>
          <div class="calc-tasa-val" id="calc-bin-val">${bin>1?bin.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</div>
        </div>
      </div>

      <!-- Card Input -->
      <div class="calc-card">
        <div class="calc-title">Convertir</div>

        <div class="calc-input-wrap">
          <span class="calc-input-prefix" id="calc-input-prefix">$</span>
          <input type="text" inputmode="decimal" id="calc-monto" class="calc-input"
                 value="${montoActivo.toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2})}"
                 oninput="calcOnInput(event)"
                 onfocus="this.select()"
                 placeholder="0,00">
        </div>

        <div style="font-size:10px;color:var(--ink3);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Moneda de origen</div>
        <div class="calc-mon-grid">
          <button class="calc-mon-chip ${monedaActiva==='USD'?'is-active':''}" data-mon="USD" onclick="calcSetMoneda('USD')">
            <span class="calc-mon-cir" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#1E40AF;color:#fff;font-family:var(--fd);font-weight:900;font-size:11px">$</span>
            USD
          </button>
          <button class="calc-mon-chip ${monedaActiva==='Bs'?'is-active':''}" data-mon="Bs" onclick="calcSetMoneda('Bs')">
            <span class="calc-mon-cir" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--ink);color:#fff;font-family:var(--fd);font-weight:900;font-size:10px">Bs</span>
            Bolívares
          </button>
          <button class="calc-mon-chip ${monedaActiva==='EUR'?'is-active':''}" data-mon="EUR" onclick="calcSetMoneda('EUR')">
            <span class="calc-mon-cir" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#003399;color:#FFD700;font-family:var(--fd);font-weight:900;font-size:13px">€</span>
            EUR
          </button>
          <button class="calc-mon-chip ${monedaActiva==='USDT'?'is-active':''}" data-mon="USDT" onclick="calcSetMoneda('USDT')">
            <span class="calc-mon-cir" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#0B0E11;color:#F0B90B;font-family:var(--fd);font-weight:900;font-size:9px">USDT</span>
            Binance
          </button>
        </div>
      </div>
    </div>

    <!-- COLUMNA DERECHA: Resultados + Atajos -->
    <div>
      <div class="calc-card" style="margin-bottom:14px">
        <div class="calc-title">Equivalencias</div>
        <div id="calc-resultados" class="calc-res"></div>
        <div id="calc-insights"></div>
      </div>

      <div class="calc-card">
        <div class="calc-title">Atajos rápidos</div>
        <div class="calc-quick-cat">Dólares</div>
        <div class="calc-quick-grid">
          <button class="calc-quick" onclick="calcQuick(10,'USD')">$10</button>
          <button class="calc-quick" onclick="calcQuick(50,'USD')">$50</button>
          <button class="calc-quick" onclick="calcQuick(100,'USD')">$100</button>
          <button class="calc-quick" onclick="calcQuick(500,'USD')">$500</button>
          <button class="calc-quick" onclick="calcQuick(1000,'USD')">$1.000</button>
          <button class="calc-quick" onclick="calcQuick(5000,'USD')">$5.000</button>
        </div>
        <div class="calc-quick-cat">Bolívares</div>
        <div class="calc-quick-grid">
          <button class="calc-quick" onclick="calcQuick(1000,'Bs')">Bs 1k</button>
          <button class="calc-quick" onclick="calcQuick(10000,'Bs')">Bs 10k</button>
          <button class="calc-quick" onclick="calcQuick(50000,'Bs')">Bs 50k</button>
          <button class="calc-quick" onclick="calcQuick(100000,'Bs')">Bs 100k</button>
          <button class="calc-quick" onclick="calcQuick(500000,'Bs')">Bs 500k</button>
          <button class="calc-quick" onclick="calcQuick(1000000,'Bs')">Bs 1M</button>
        </div>
        <div class="calc-quick-cat">Euros</div>
        <div class="calc-quick-grid">
          <button class="calc-quick" onclick="calcQuick(100,'EUR')">€100</button>
          <button class="calc-quick" onclick="calcQuick(500,'EUR')">€500</button>
          <button class="calc-quick" onclick="calcQuick(1000,'EUR')">€1.000</button>
        </div>
      </div>
    </div>

  </div>
  </div>`;
};

// ─── ESTADO ───
window._calcMoneda = window._calcMoneda || 'USD';
window._calcMonto  = (typeof window._calcMonto === 'number') ? window._calcMonto : 100;

// ─── HELPERS ───
function _calcParseMonto(str){
  if(typeof str === 'number') return str;
  str = String(str||'').trim();
  if(!str) return 0;
  // Quitar separadores de miles (.) y reemplazar coma decimal por punto
  // Si tiene ambos, usar el último como decimal
  var lastComma = str.lastIndexOf(',');
  var lastDot = str.lastIndexOf('.');
  if(lastComma > lastDot){
    // coma decimal
    str = str.replace(/\./g,'').replace(',','.');
  } else if(lastDot > lastComma){
    // punto decimal
    str = str.replace(/,/g,'');
  } else {
    // solo uno: si hay más de un punto/coma → es miles
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

function _calcPrefixFor(m){
  return {USD:'$', Bs:'Bs', EUR:'€', USDT:'₮'}[m] || '$';
}

// ─── ACCIONES ───
function calcOnInput(ev){
  var monto = _calcParseMonto(ev.target.value);
  window._calcMonto = monto;
  calcRender();
}

function calcSetMoneda(m){
  window._calcMoneda = m;
  document.querySelectorAll('.calc-mon-chip').forEach(function(btn){
    btn.classList.toggle('is-active', btn.getAttribute('data-mon') === m);
  });
  var prefix = document.getElementById('calc-input-prefix');
  if(prefix) prefix.textContent = _calcPrefixFor(m);
  calcRender();
}

function calcQuick(monto, moneda){
  window._calcMonto = monto;
  window._calcMoneda = moneda;
  // Actualizar input visualmente
  var input = document.getElementById('calc-monto');
  if(input) input.value = monto.toLocaleString('es-VE',{minimumFractionDigits:2, maximumFractionDigits:2});
  var prefix = document.getElementById('calc-input-prefix');
  if(prefix) prefix.textContent = _calcPrefixFor(moneda);
  document.querySelectorAll('.calc-mon-chip').forEach(function(btn){
    btn.classList.toggle('is-active', btn.getAttribute('data-mon') === moneda);
  });
  calcRender();
}

// ─── RENDER PRINCIPAL ───
function calcRender(){
  var bcv = window._tasaBsGlobal || 0;
  var eur = window._tasaEuro || 0;
  var bin = window._tasaBinance || 0;

  // Actualizar tasas visibles
  var bcvEl = document.getElementById('calc-bcv-val'); if(bcvEl) bcvEl.textContent = bcv>1 ? _calcFmt(bcv) : '—';
  var eurEl = document.getElementById('calc-eur-val'); if(eurEl) eurEl.textContent = eur>1 ? _calcFmt(eur) : '—';
  var binEl = document.getElementById('calc-bin-val'); if(binEl) binEl.textContent = bin>1 ? _calcFmt(bin) : '—';

  var monto = window._calcMonto || 0;
  var moneda = window._calcMoneda || 'USD';

  // Calcular equivalencias según moneda de origen
  // Convertimos siempre al monto en USD equivalente y luego derivamos todo
  var bs_via_bcv = 0, bs_via_bin = 0, bs_via_eur = 0;
  var en_usd_bcv = 0, en_usd_bin = 0;
  var en_eur = 0, en_usdt = 0;

  if(moneda === 'USD'){
    bs_via_bcv = monto * bcv;
    bs_via_bin = monto * bin;
    en_eur = (eur > 0) ? (monto * bcv / eur) : 0;
    en_usdt = monto; // USDT≈USD
  } else if(moneda === 'Bs'){
    en_usd_bcv = (bcv > 0) ? (monto / bcv) : 0;
    en_usd_bin = (bin > 0) ? (monto / bin) : 0;
    en_eur = (eur > 0) ? (monto / eur) : 0;
    en_usdt = en_usd_bin; // USDT P2P
  } else if(moneda === 'EUR'){
    bs_via_eur = monto * eur;
    en_usd_bcv = (bcv > 0) ? (monto * eur / bcv) : 0;
    en_usd_bin = (bin > 0) ? (monto * eur / bin) : 0;
    en_usdt = en_usd_bin;
  } else if(moneda === 'USDT'){
    bs_via_bin = monto * bin;
    en_usd_bcv = monto; // USDT≈USD
    en_eur = (eur > 0) ? (monto * bin / eur) : 0;
  }

  // Construir resultados
  var html = '';
  function row(label, valor, cur, method, accent){
    accent = accent || 'var(--p1)';
    return '<div class="calc-res-item">'
      + '<div style="width:4px;align-self:stretch;background:'+accent+';border-radius:2px"></div>'
      + '<div class="calc-res-info">'
        + '<div class="calc-res-lbl">'+label+'</div>'
        + '<div class="calc-res-method">'+method+'</div>'
      + '</div>'
      + '<div class="calc-res-val">'+_calcFmt(valor)+'<span class="calc-res-cur">'+cur+'</span></div>'
    + '</div>';
  }

  if(moneda === 'USD'){
    html += row('A Bolívares', bs_via_bcv, 'Bs', 'Usando tasa BCV oficial', '#1E40AF');
    html += row('A Bolívares', bs_via_bin, 'Bs', 'Usando tasa Binance P2P', '#F0B90B');
    if(en_eur > 0) html += row('A Euros', en_eur, '€', 'Cruz BCV → EUR oficial', '#003399');
  } else if(moneda === 'Bs'){
    html += row('A Dólares', en_usd_bcv, '$', 'Usando tasa BCV oficial', '#1E40AF');
    html += row('A Dólares', en_usd_bin, '$', 'Usando tasa Binance P2P', '#F0B90B');
    if(en_eur > 0) html += row('A Euros', en_eur, '€', 'Usando tasa EUR oficial', '#003399');
  } else if(moneda === 'EUR'){
    html += row('A Bolívares', bs_via_eur, 'Bs', 'Usando tasa EUR oficial', '#003399');
    if(en_usd_bcv > 0) html += row('A Dólares', en_usd_bcv, '$', 'Cruz EUR → USD vía BCV', '#1E40AF');
    if(en_usd_bin > 0) html += row('A Dólares', en_usd_bin, '$', 'Cruz EUR → USD vía Binance', '#F0B90B');
  } else if(moneda === 'USDT'){
    html += row('A Bolívares', bs_via_bin, 'Bs', 'Tasa Binance P2P', '#F0B90B');
    html += row('A Dólares', en_usd_bcv, '$', 'USDT ≈ USD', '#1E40AF');
    if(en_eur > 0) html += row('A Euros', en_eur, '€', 'Cruz USDT → EUR vía BCV', '#003399');
  }

  var cont = document.getElementById('calc-resultados');
  if(cont) cont.innerHTML = html;

  // ─── Insight: brecha BCV ↔ Binance ───
  // Fórmula venezolana: (paralelo - oficial) / paralelo
  // Representa cuánto el oficial está por debajo del paralelo
  var insightHtml = '';
  if(bcv > 1 && bin > 1){
    var brecha = ((bin - bcv) / bin) * 100;
    var col = brecha > 30 ? '#E8335A' : (brecha > 15 ? '#BA7517' : '#15803D');
    var bg = brecha > 30 ? 'rgba(232,51,90,.08)' : (brecha > 15 ? 'rgba(186,117,23,.08)' : 'rgba(21,128,61,.08)');
    insightHtml += '<div class="calc-insight" style="background:'+bg+'">'
      + '<span class="calc-insight-lbl">Brecha oficial → paralelo</span>'
      + '<span class="calc-insight-val" style="color:'+col+'">'+(brecha>=0?'+':'')+brecha.toFixed(1)+'%</span>'
    + '</div>';
  }
  if(bcv > 1 && eur > 1){
    var eurUsd = eur / bcv;
    insightHtml += '<div class="calc-insight" style="background:rgba(0,51,153,.06)">'
      + '<span class="calc-insight-lbl">EUR/USD implícito</span>'
      + '<span class="calc-insight-val" style="color:#003399">'+eurUsd.toFixed(4)+'</span>'
    + '</div>';
  }
  var ins = document.getElementById('calc-insights');
  if(ins) ins.innerHTML = insightHtml;
}

// Exponer al global
window.calcOnInput = calcOnInput;
window.calcSetMoneda = calcSetMoneda;
window.calcQuick = calcQuick;
window.calcRender = calcRender;
