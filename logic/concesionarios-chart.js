// Chart del modulo de Concesionarios: cuantas motos salio cada sede en el
// tiempo, por dia / mes / ano. Pedido de Adam el 8-sep-2026.
//
// Se alimenta de S.creds (fecha + concesionarioId), que es dato real. NO usa
// los anticipos: hoy nadie los registra y la serie saldria plana en cero.
//
// Solo LEE y pinta. No toca _concFinanzasDe ni ningun calculo del modulo.

var _concChart = null;
var _concChartPeriodo = 'mes';   // dia · mes · ano
var _concChartModo = 'motos';    // motos · monto

// Los buckets de tiempo segun el periodo, del mas viejo al mas nuevo.
function _concChartBuckets(periodo){
  var hoy = new Date(), b = [];
  if(periodo === 'dia'){
    for(var i=29; i>=0; i--){
      var d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()-i);
      b.push({ clave: d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),
               label: d.getDate()+'/'+(d.getMonth()+1) });
    }
  } else if(periodo === 'ano'){
    for(var a=4; a>=0; a--){
      var y = hoy.getFullYear()-a;
      b.push({ clave: String(y), label: String(y) });
    }
  } else {
    var M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    for(var k=11; k>=0; k--){
      var f = new Date(hoy.getFullYear(), hoy.getMonth()-k, 1);
      b.push({ clave: f.getFullYear()+'-'+String(f.getMonth()+1).padStart(2,'0'),
               label: M[f.getMonth()]+' '+String(f.getFullYear()).slice(-2) });
    }
  }
  return b;
}

function _concChartCorte(periodo){
  return periodo==='dia' ? 10 : (periodo==='ano' ? 4 : 7);
}

// Una serie por sede: cuantas motos (o cuanto dinero) en cada bucket.
function _concChartDatos(){
  var periodo = _concChartPeriodo, corte = _concChartCorte(periodo);
  var buckets = _concChartBuckets(periodo);
  var idx = {}; buckets.forEach(function(b,i){ idx[b.clave] = i; });

  var sedes = (S.concesionarios||[]).filter(function(c){ return c && !c.eliminado; });
  var series = {}, totalPorSede = {};
  sedes.forEach(function(s){ series[s.id] = buckets.map(function(){ return 0; }); totalPorSede[s.id] = 0; });

  (S.creds||[]).forEach(function(c){
    if(!c || c.eliminado || c.estado==='cancelado' || c.estado==='rechazado') return;
    var f = String(c.fecha||''); if(f.length < 7) return;
    var i = idx[f.slice(0, corte)];
    if(i === undefined) return;
    var sid = c.concesionarioId;
    if(!series[sid]) return;                      // credito sin sede o de una sede borrada
    var v = (_concChartModo === 'monto') ? (parseFloat(c.precioBaseReal||c.precio)||0) : 1;
    series[sid][i] += v; totalPorSede[sid] += v;
  });

  // Las sedes con movimiento, de mayor a menor
  var orden = sedes.filter(function(s){ return totalPorSede[s.id] > 0; })
                   .sort(function(a,b){ return totalPorSede[b.id] - totalPorSede[a.id]; });
  return { buckets: buckets, sedes: orden, series: series, totales: totalPorSede };
}

// Paleta: la del app, y suficientes tonos para 11 sedes
var _CONC_COLORES = ['#2563EB','#7C6DFF','#06B06A','#F59E0B','#EF4444','#0EA5E9',
                     '#8B5CF6','#14B8A6','#F97316','#EC4899','#64748B'];

function _concChartHtml(){
  var btn = function(v, txt, actual, fn){
    var on = (v === actual);
    return '<button class="btn '+(on?'btn-p':'btn-g')+' btn-xs" onclick="'+fn+'(\''+v+'\')">'+txt+'</button>';
  };
  return '<div class="card" style="margin-bottom:14px">'
    + '<div class="ch">'
    +   '<div><div class="ct">Motos por concesionario</div>'
    +   '<div class="cs" id="conc-chart-sub">Últimos 12 meses</div></div>'
    +   '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
    +     '<div style="display:flex;gap:4px">'
    +       btn('motos','Motos',_concChartModo,'_concChartSetModo')
    +       btn('monto','Monto',_concChartModo,'_concChartSetModo')
    +     '</div>'
    +     '<div style="width:1px;height:20px;background:var(--rim2)"></div>'
    +     '<div style="display:flex;gap:4px">'
    +       btn('dia','Días',_concChartPeriodo,'_concChartSetPeriodo')
    +       btn('mes','Meses',_concChartPeriodo,'_concChartSetPeriodo')
    +       btn('ano','Años',_concChartPeriodo,'_concChartSetPeriodo')
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '<div style="height:230px;margin-top:12px"><canvas id="conc-chart"></canvas></div>'
    + '<div id="conc-chart-leyenda" style="display:flex;flex-wrap:wrap;gap:5px 14px;margin-top:11px"></div>'
    + '</div>';
}

function _concChartSetPeriodo(p){ _concChartPeriodo = p; if(typeof nav==='function') nav('concesionarios'); }
function _concChartSetModo(m){ _concChartModo = m; if(typeof nav==='function') nav('concesionarios'); }

function _concChartPintar(){
  var canvas = document.getElementById('conc-chart');
  if(!canvas || typeof Chart === 'undefined') return;
  var D = _concChartDatos();
  var esMonto = (_concChartModo === 'monto');
  var oscuro = document.documentElement.getAttribute('data-theme') === 'dark';
  var ink3 = oscuro ? '#6B6896' : '#9794BB';

  var sub = document.getElementById('conc-chart-sub');
  if(sub) sub.textContent = ({dia:'Últimos 30 días', mes:'Últimos 12 meses', ano:'Últimos 5 años'})[_concChartPeriodo]
                          + ' · ' + D.sedes.length + ' sede' + (D.sedes.length!==1?'s':'') + ' con movimiento';

  var datasets = D.sedes.map(function(s, i){
    return { label: s.nombre || s.id, data: D.series[s.id],
             backgroundColor: _CONC_COLORES[i % _CONC_COLORES.length],
             borderWidth: 0, borderRadius: 3, borderSkipped: false };
  });

  var fmtV = function(v){
    return esMonto ? '$'+(v||0).toLocaleString('es-VE',{minimumFractionDigits:0,maximumFractionDigits:0})
                   : (v||0)+' moto'+(v===1?'':'s');
  };

  if(_concChart){ _concChart.destroy(); _concChart = null; }
  _concChart = new Chart(canvas, {
    type: 'bar',
    data: { labels: D.buckets.map(function(b){ return b.label; }), datasets: datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: oscuro ? '#252844' : '#fff',
          borderColor: oscuro ? 'rgba(37,99,235,0.3)' : 'rgba(37,99,235,0.2)', borderWidth: 1,
          titleColor: oscuro ? '#E8E6FF' : '#0B0B1E', bodyColor: oscuro ? '#B0ADDB' : '#4A4870',
          padding: 10, itemSort: function(a,b){ return b.raw - a.raw; },
          callbacks: {
            label: function(ctx){ return ctx.raw ? ' '+ctx.dataset.label+': '+fmtV(ctx.raw) : null; },
            footer: function(items){
              var t = items.reduce(function(s,x){ return s + (x.raw||0); }, 0);
              return t ? 'Total: '+fmtV(t) : '';
            }
          }
        }
      },
      scales: {
        x: { stacked: true, grid: { display: false }, border: { display: false },
             ticks: { color: ink3, font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 14 } },
        y: { stacked: true, grid: { color: oscuro ? 'rgba(37,99,235,0.08)' : 'rgba(37,99,235,0.06)' },
             border: { display: false, dash: [4,4] },
             ticks: { color: ink3, font: { size: 9 }, maxTicksLimit: 5, precision: esMonto ? undefined : 0,
                      callback: function(v){ return esMonto ? (v>=1000 ? '$'+Math.round(v/1000)+'k' : '$'+v) : v; } } }
      }
    }
  });

  // Leyenda propia: nombre, color y total de cada sede
  var ley = document.getElementById('conc-chart-leyenda');
  if(ley){
    ley.innerHTML = D.sedes.map(function(s, i){
      return '<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--ink2)">'
        + '<span style="width:9px;height:9px;border-radius:2px;background:'+_CONC_COLORES[i % _CONC_COLORES.length]+';flex-shrink:0"></span>'
        + (s.nombre||s.id)
        + '<b style="color:var(--ink)">'+fmtV(D.totales[s.id])+'</b></span>';
    }).join('') || '<span style="font-size:11px;color:var(--ink3)">Sin movimiento en este período.</span>';
  }
}
