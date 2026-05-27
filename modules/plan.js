// Pagasi module: plan
PG.plan = function(){
  // Listas de planes (principal + extras)
  var todosPlanes = [{
    nombre: 'Plan ' + PLAN.plazo + ' Meses · Pagasi',
    plazo: PLAN.plazo, factor: PLAN.factor,
    inicial: PLAN.inicial, tasaMensual: PLAN.tasaMensual,
    principal: true
  }].concat(window._planesExtra || []);

  var planesHTML = todosPlanes.map(function(p, i){
    var esPrincipal = !!p.principal;
    var accentColor = esPrincipal ? 'var(--p1)' : 'var(--ink3)';
    var inicialPct = p.inicial ? Math.round(p.inicial * 100) : (p.inicial === 0 ? 0 : p.inicial);
    return '<div class="card" style="padding:16px 18px">'
      // Nombre + badge
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">'
        +'<div style="flex:1;font-weight:800;font-size:13.5px;color:var(--ink)">'+(p.nombre||('Plan '+p.plazo+' Meses'))+'</div>'
        +(esPrincipal?'<span style="background:var(--gs);color:var(--p1);border-radius:20px;padding:3px 9px;font-size:9.5px;font-weight:800">PRINCIPAL</span>':'')
      +'</div>'
      // 4 stats en grid 2x2
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">'
        +'<div style="background:var(--surf2);border-radius:9px;padding:9px 10px;text-align:center">'
          +'<div style="font-family:var(--fd);font-weight:900;font-size:20px;color:var(--ink)">'+p.plazo+'</div>'
          +'<div style="font-size:9.5px;color:var(--ink3);font-weight:700;margin-top:1px;text-transform:uppercase;letter-spacing:.3px">meses plazo</div>'
        +'</div>'
        +'<div style="background:var(--surf2);border-radius:9px;padding:9px 10px;text-align:center">'
          +'<div style="font-family:var(--fd);font-weight:900;font-size:20px;color:var(--ink)">'+p.factor+'x</div>'
          +'<div style="font-size:9.5px;color:var(--ink3);font-weight:700;margin-top:1px;text-transform:uppercase;letter-spacing:.3px">factor</div>'
        +'</div>'
        +'<div style="background:var(--surf2);border-radius:9px;padding:9px 10px;text-align:center">'
          +'<div style="font-family:var(--fd);font-weight:900;font-size:20px;color:var(--ink)">'+inicialPct+'%</div>'
          +'<div style="font-size:9.5px;color:var(--ink3);font-weight:700;margin-top:1px;text-transform:uppercase;letter-spacing:.3px">inicial mín.</div>'
        +'</div>'
        +'<div style="background:var(--surf2);border-radius:9px;padding:9px 10px;text-align:center">'
          +'<div style="font-family:var(--fd);font-weight:900;font-size:20px;color:var(--ink)">'+(p.tasaMensual||'—')+(p.tasaMensual?'%':'')+'</div>'
          +'<div style="font-size:9.5px;color:var(--ink3);font-weight:700;margin-top:1px;text-transform:uppercase;letter-spacing:.3px">tasa mensual</div>'
        +'</div>'
      +'</div>'
      // Botón
      +(esPrincipal
        ? '<button class="btn btn-p btn-sm" style="width:100%" onclick="nav(\'config\')">Editar plan principal</button>'
        : '<div style="display:flex;gap:6px;border-top:1px solid var(--rim2);padding-top:10px"><button class="btn btn-d btn-xs" style="flex:1" onclick="delPlanExtra('+(i-1)+')">Eliminar plan</button></div>'
      )
    +'</div>';
  }).join('');

  return`<div class="page">

  ${pageBanner(
    'Configuración · Planes y catálogo',
    'Planes Financieros',
    '<b>'+todosPlanes.length+'</b> plan'+(todosPlanes.length!==1?'es activos':' activo')+' · <b>'+CATALOGO.length+'</b> modelos en catálogo · Factor '+PLAN.factor+'x',
    [
      {label:'＋ Nuevo Plan', onclick:'openAddPlan()'},
      {label:'＋ Agregar Modelo', onclick:'openAddCatalogo()', primary:true}
    ]
  )}

  <!-- PLANES -->
  <div class="card" style="margin-bottom:14px">
    <div class="ch">
      <div><div class="ct">Planes Financieros</div><div class="cs">${todosPlanes.length} plan${todosPlanes.length!==1?'es':''} activo${todosPlanes.length!==1?'s':''}</div></div>
      <button class="btn btn-p btn-sm" onclick="openAddPlan()">＋ Nuevo Plan</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-top:12px">
      ${planesHTML}
    </div>
  </div>

  <!-- CATÁLOGO agrupado por SEDE -->
  ${(function(){
    var bySede = {};
    var ordenSedes = [];
    CATALOGO.forEach(function(c){
      var s = c.sede || 'Sin sede';
      if(!bySede[s]){ bySede[s] = []; ordenSedes.push(s); }
      bySede[s].push(c);
    });
    var filtroSede = window._planSedeFiltro || '_todas';

    var chipsHTML = '<button class="btn '+(filtroSede==='_todas'?'btn-p':'btn-g')+' btn-xs" onclick="setPlanSedeFiltro(\'_todas\')">Todas ('+CATALOGO.length+')</button>'
      + ordenSedes.map(function(s){
          return '<button class="btn '+(filtroSede===s?'btn-p':'btn-g')+' btn-xs" onclick="setPlanSedeFiltro('+JSON.stringify(s).replace(/"/g,'&quot;')+')">'+s+' ('+bySede[s].length+')</button>';
        }).join('');

    function tarjeta(c){
      var r = calcMoto(c.precio);
      var sedeBadge = c.sede ? '<span style="background:rgba(74,107,255,.10);color:var(--p1);border:1px solid rgba(74,107,255,.22);font-size:9px;font-weight:800;letter-spacing:.4px;text-transform:uppercase;padding:2px 7px;border-radius:50px;margin-left:auto;white-space:nowrap">'+c.sede+'</span>' : '';
      return '<div style="background:var(--surf2);border:1px solid var(--rim);border-radius:var(--r12);padding:14px;transition:border-color .15s" onmouseover="this.style.borderColor=\'var(--rim2)\'" onmouseout="this.style.borderColor=\'var(--rim)\'">'
        +'<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;padding-bottom:7px;border-bottom:1px solid var(--rim)">'
          +'<div style="font-family:var(--fd);font-weight:800;font-size:13px;color:var(--ink);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+c.modelo+'</div>'
          +sedeBadge
        +'</div>'
        +'<div class="mp-row"><span class="mp-l">Precio</span><span class="mp-v">'+fmt(c.precio)+'</span></div>'
        +'<div class="mp-row"><span class="mp-l">Inicial ('+(PLAN.inicial*100)+'%)</span><span class="mp-v">'+fmt(r.ini)+'</span></div>'
        +'<div class="mp-row"><span class="mp-l">Financiado</span><span class="mp-v">'+fmt(r.fin)+'</span></div>'
        +'<div class="mp-row"><span class="mp-l">Total (x'+PLAN.factor+')</span><span class="mp-v">'+fmt(r.total)+'</span></div>'
        +'<div style="background:var(--gs);border:1px solid var(--rim2);border-radius:8px;padding:9px 10px;margin-top:9px;display:flex;justify-content:space-between;align-items:center">'
          +'<div><div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;color:var(--p1);margin-bottom:2px">Cuota mensual</div>'
          +'<div style="font-family:var(--fd);font-weight:900;font-size:17px;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">'+fmt(r.cuotaM)+'</div></div>'
          +'<div style="text-align:right"><div style="font-size:9.5px;font-weight:700;color:var(--ink3);margin-bottom:2px">Quincenal</div>'
          +'<div style="font-weight:800;font-family:var(--fd);color:var(--ink)">'+fmt(r.cuotaQ)+'</div></div>'
        +'</div>'
        +'<div class="mp-row" style="margin-top:7px"><span class="mp-l">Total pagado</span><span class="mp-v">'+fmt(r.totalPagado)+'</span></div>'
        +'<div style="display:flex;gap:6px;margin-top:10px">'
          +'<button class="btn btn-p btn-xs" style="flex:1" onclick="openAddCredConMoto('+c.id+')">+ Solicitud</button>'
          +'<button class="btn btn-g btn-xs" onclick="openEditCatalogo('+c.id+')" title="Editar">Editar</button>'
          +'<button class="btn btn-d btn-xs" onclick="delCatalogo('+c.id+')" title="Eliminar">Eliminar</button>'
        +'</div>'
        +'</div>';
    }

    var sedesARender = (filtroSede === '_todas') ? ordenSedes : [filtroSede];
    var seccionesHTML = sedesARender.map(function(s){
      var motos = bySede[s] || [];
      if(!motos.length) return '';
      var precios = motos.map(function(c){ return parseFloat(c.precio)||0; });
      var minP = Math.min.apply(null, precios);
      var maxP = Math.max.apply(null, precios);
      var avgP = precios.reduce(function(a,b){return a+b;},0) / precios.length;
      return '<div style="margin-top:18px">'
        +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:10px 14px;background:linear-gradient(90deg,rgba(74,107,255,.10) 0%,transparent 100%);border-left:3px solid var(--p1);border-radius:8px">'
          +'<div style="flex:1">'
            +'<div style="font-size:14px;font-weight:800;color:var(--ink);letter-spacing:-.3px">'+s+'</div>'
            +'<div style="font-size:10.5px;color:var(--ink3);margin-top:2px;font-weight:600">'+motos.length+' modelo'+(motos.length!==1?'s':'')+' · Rango '+fmt(minP)+' – '+fmt(maxP)+' · Promedio '+fmt(avgP)+'</div>'
          +'</div>'
          +'<div style="background:var(--p1);color:#fff;font-family:var(--fd);font-weight:900;font-size:13px;padding:5px 11px;border-radius:50px">'+motos.length+'</div>'
        +'</div>'
        +'<div class="moto-plan-grid">'+motos.map(tarjeta).join('')+'</div>'
      +'</div>';
    }).join('');

    return '<div class="card">'
      +'<div class="ch">'
        +'<div><div class="ct">Catálogo de Motocicletas</div><div class="cs">'+CATALOGO.length+' modelos en '+ordenSedes.length+' sede'+(ordenSedes.length!==1?'s':'')+' · Factor '+PLAN.factor+'x</div></div>'
        +'<button class="btn btn-p btn-sm" onclick="openAddCatalogo()">＋ Agregar Modelo</button>'
      +'</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;padding-bottom:10px;border-bottom:1px solid var(--rim)">'+chipsHTML+'</div>'
      +seccionesHTML
    +'</div>';
  })()}

  </div>`;};

// Filtro de sede para la página de Plan & Precios
function setPlanSedeFiltro(s){
  window._planSedeFiltro = s;
  if(typeof nav==='function') nav('plan');
}

