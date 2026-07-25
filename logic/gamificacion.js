// ══════════════════════════════════════════════════════════════════════════
// GAMIFICACION — racha de pagos puntuales y niveles del cliente
//
// Mide, en cada fecha de corte (vencimiento + dias de gracia), si el cliente
// estaba al dia con el acumulado que le tocaba a esa altura del plan.
//
// Se hace asi —y NO cuota por cuota— por una razon importante: los pagos se
// aplican siempre a la cuota mas vieja pendiente. Si midieramos cuota por
// cuota, un solo atraso condenaria a todas las siguientes (cada una se cerraria
// tarde) y la racha no podria revivir nunca, aunque el cliente se ponga al dia.
// Con cortes acumulados, ponerse al dia vuelve a producir cortes puntuales.
//
// No escribe nada: se calcula al vuelo desde el calendario del ledger y los
// pagos. No hay puntos guardados que se puedan desincronizar.
// ══════════════════════════════════════════════════════════════════════════
(function(root){
  'use strict';

  var NIVELES = [
    {id:'bronce',  nom:'Bronce',  min:0,  cupo:0,   col:'#B87333', bg:'#FBF0E6'},
    {id:'plata',   nom:'Plata',   min:4,  cupo:60,  col:'#7C8AA0', bg:'#F1F4F9'},
    {id:'oro',     nom:'Oro',     min:12, cupo:150, col:'#C79100', bg:'#FFF7E0'},
    {id:'platino', nom:'Platino', min:20, cupo:150, col:'#2563EB', bg:'#EAF1FF'}
  ];

  var PTS_ADELANTADA = 15;   // pago antes del vencimiento: vale mas (mejora la caja)
  var PTS_PUNTUAL    = 10;   // pago dentro de los dias de gracia
  var PTS_TARDE      = 0;    // no se castiga con puntos negativos: el castigo es perder la racha

  function sumarDias(iso, n){
    var p = String(iso||'').slice(0,10).split('-');
    if(p.length !== 3) return '';
    var d = new Date(+p[0], +p[1]-1, +p[2]);
    if(isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + n);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0,10);
  }

  function hoyISO(){
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0,10);
  }

  // est   = resultado de CreditoLedger.generarEstadoCredito (necesita est.cuotas)
  // pagos = pagos del credito (se filtran los eliminados, no confirmados e iniciales)
  function calcularRacha(est, pagos, gracia, hoy){
    gracia = (gracia == null) ? 5 : (parseInt(gracia,10) || 0);
    hoy = hoy || hoyISO();

    var ps = (pagos || [])
      .filter(function(p){
        return p && !p.eliminado
          && (p.estado || 'confirmado') === 'confirmado'
          && !p.esInicial && p.tipoOperacion !== 'inicial_credito';
      })
      .map(function(p){ return {f: String(p.fecha||'').slice(0,10), m: parseFloat(p.monto) || 0}; })
      .filter(function(p){ return p.f; });

    function pagadoHasta(lim){
      if(!lim) return 0;
      return ps.reduce(function(a,p){ return a + (p.f <= lim ? p.m : 0); }, 0);
    }

    var evs = [], acum = 0;
    ((est && est.cuotas) || []).forEach(function(q){
      acum += (parseFloat(q.monto) || 0);
      var corte = sumarDias(q.fechaVence, gracia);
      if(!corte || corte > hoy) return;           // el corte todavia no llego
      var req = acum - 0.01;
      evs.push({
        numero: q.numero,
        fechaCorte: corte,
        puntual:    pagadoHasta(corte) >= req,
        adelantada: pagadoHasta(sumarDias(q.fechaVence, -1)) >= req
      });
    });

    var puntuales   = evs.filter(function(x){ return x.puntual; }).length;
    var adelantadas = evs.filter(function(x){ return x.adelantada; }).length;
    var puntos = adelantadas * PTS_ADELANTADA
               + (puntuales - adelantadas) * PTS_PUNTUAL
               + (evs.length - puntuales) * PTS_TARDE;

    // Racha = cortes puntuales consecutivos terminando en el ultimo corte vencido
    var racha = 0;
    for(var k = evs.length - 1; k >= 0; k--){
      if(evs[k].puntual) racha++; else break;
    }

    // El nivel se basa en el TOTAL de cortes puntuales, no en la racha: un
    // tropiezo no debe quitarle un beneficio que ya se gano.
    var nivel = NIVELES[0], sig = NIVELES[1] || null;
    for(var n = NIVELES.length - 1; n >= 0; n--){
      if(puntuales >= NIVELES[n].min){ nivel = NIVELES[n]; sig = NIVELES[n+1] || null; break; }
    }

    return {
      evs: evs,
      cortes: evs.length,
      puntuales: puntuales,
      adelantadas: adelantadas,
      tarde: evs.length - puntuales,
      puntos: puntos,
      racha: racha,
      nivel: nivel,
      siguiente: sig,
      faltan: sig ? Math.max(0, sig.min - puntuales) : 0
    };
  }

  var api = {
    NIVELES: NIVELES,
    calcularRacha: calcularRacha,
    sumarDias: sumarDias
  };

  root.Gamificacion = api;
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
