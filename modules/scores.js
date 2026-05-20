// Pagasi module: reportes
PG.reportes = function(){
  // Tab interno: 'resumen' (default), 'proyecciones', 'egresos', 'exportar'
  var tab = S.reportesTab || 'resumen';

  // Variables filtradas por concesionario activo
  var _SPAGOS = _concFiltrar(S.pagos||[]);
  var _SCREDS = _concFiltrar(S.creds||[]);
  var _SEGR = _concFiltrarEgresos(S.egresos||[]);
  var _SMOTOS = _concFiltrar(S.motos||[]);

  // ══════════ CÁLCULOS COMPARTIDOS ══════════
  const pagosConf = _SPAGOS.filter(p=>!p.eliminado&&p.estado==='confirmado');
  const pagosPend = _SPAGOS.filter(p=>!p.eliminado&&p.estado==='pendiente');
  const credsActivos= _SCREDS.filter(c=>!c.eliminado&&c.estado==='activo');
  const credsMora = _SCREDS.filter(c=>!c.eliminado&&c.mora>0);
  const credsComp = _SCREDS.filter(c=>!c.eliminado&&c.estado==='completado');
  const credsRec = _SCREDS.filter(c=>!c.eliminado&&(c.estado==='recuperada'||c.estado==='recuperado'));
  const totalCuotas= pagosConf.filter(p=>!p.esInicial&&p.tipoOperacion!=='inicial_credito').reduce((a,p)=>a+p.monto,0);
  const totalIniciales= getTotalInicialesCobradas();
  const totalEgresos= _SEGR.filter(e=>!e.eliminado).reduce((a,e)=>a+(e.monto||0),0);
  const totalIngresos=totalCuotas+totalIniciales;
  const utilidad = totalIngresos-totalEgresos;
  const margen = totalIngresos>0?Math.round(utilidad/totalIngresos*100):0;

  // Cartera y proyecciones (de conta)
  const creds = _SCREDS.filter(c=>!c.eliminado);
  const nTotal = creds.length;
  const cartera = credsActivos.reduce((a,c)=>a+(typeof getCreditoSaldoPendiente==='function'?getCreditoSaldoPendiente(c):0),0);
  const cuotaEsp = credsActivos.reduce((a,c)=>a+parseFloat(c.cuotaQ||c.cuota||0),0);
  const cuotaEspMes = cuotaEsp*2;
  const pctCobro = cuotaEsp>0?Math.min(100,Math.round(totalCuotas/cuotaEsp*100)):0;
  const tasaMora = credsActivos.length>0?Math.round(credsMora.length/credsActivos.length*100):0;
  const diasMoraProm = credsMora.length>0 ? Math.round(credsMora.reduce((a,c)=>a+(c.mora||0),0)/credsMora.length) : 0;
  const moraAcumulada = credsActivos.reduce((a,c)=>a+(c.moraMonto||0),0);

  const totalPrecioBase = creds.reduce((a,c)=>a+parseFloat(c.precioBaseReal||c.precio||0),0);
  const totalAFinanciar = creds.reduce((a,c)=>a+parseFloat(c.total||0),0);
  const spreadBrutoTotal = totalAFinanciar - totalPrecioBase;

  // Dinero en la calle
  const dineroCalle = credsActivos.reduce((a,c)=>{
    const cuotaV=parseFloat(c.cuotaQ||c.cuota||0);
    const totalC=c.totalCuotas||c.plazo*2;
    const pagado=c.pagado||0;
    return a+Math.max(0,cuotaV*(totalC-pagado));
  },0);

  // Inventario
  const valorInventario=_SMOTOS.filter(m=>!m.eliminado&&m.estado==='disponible').reduce((a,m)=>a+(m.precio||0),0);

  // ══════════ SERIE 12 MESES (para proyecciones) ══════════
  const now = new Date();
  const egresos = _SEGR.filter(e=>!e.eliminado);
  const serie = [];
  for(let i=11;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    const label = d.toLocaleDateString('es-VE',{month:'short'}).replace('.','') + (i===11||m===0?' '+String(y).slice(2):'');
    const ingMes = pagosConf.filter(p=>{
      if(!p.fecha) return false;
      const pd = new Date(p.fecha);
      return pd.getFullYear()===y && pd.getMonth()===m;
    }).reduce((a,p)=>a+(parseFloat(p.monto)||0),0);
    const egMes = egresos.filter(e=>{
      if(!e.fecha) return false;
      const ed = new Date(e.fecha);
      return ed.getFullYear()===y && ed.getMonth()===m;
    }).reduce((a,e)=>a+(e.monto||0),0);
    const nuevosMes = creds.filter(c=>{
      if(!c.fecha) return false;
      const cd = new Date(c.fecha);
      return cd.getFullYear()===y && cd.getMonth()===m;
    }).length;
    serie.push({label, y, m, ingresos:ingMes, egresos:egMes, utilidad:ingMes-egMes, nuevos:nuevosMes});
  }
  const mActual = serie[serie.length-1];
  const mAnterior = serie[serie.length-2] || {ingresos:0,egresos:0,utilidad:0,nuevos:0};
  const deltaIng = mAnterior.ingresos>0 ? Math.round((mActual.ingresos-mAnterior.ingresos)/mAnterior.ingresos*100) : (mActual.ingresos>0?100:0);
  const deltaEg = mAnterior.egresos>0 ? Math.round((mActual.egresos-mAnterior.egresos)/mAnterior.egresos*100) : (mActual.egresos>0?100:0);
  const deltaUt = mAnterior.utilidad!==0 ? Math.round((mActual.utilidad-mAnterior.utilidad)/Math.abs(mAnterior.utilidad)*100) : 0;
  const deltaNuev = mAnterior.nuevos>0 ? Math.round((mActual.nuevos-mAnterior.nuevos)/mAnterior.nuevos*100) : (mActual.nuevos>0?100:0);

  // Proyección futura 12 meses
  const hoyTs = Date.now();
  const MS_QUINCENA = 15*24*60*60*1000;
  const futMeses = [];
  for(let i=1;i<=12;i++){
    const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
    futMeses.push({y:d.getFullYear(), m:d.getMonth(), label:d.toLocaleDateString('es-VE',{month:'short'}).replace('.','')+' '+String(d.getFullYear()).slice(2), esperado:0, cuotas:0});
  }
  credsActivos.forEach(c=>{
    if(!c.fecha) return;
    const inicio = new Date(c.fecha);
    if(isNaN(inicio.getTime())) return;
    const totalCuotasCred = c.totalCuotas || (c.plazo*2) || 24;
    const pagadas = c.pagado || 0;
    const cuotaMonto = parseFloat(c.cuotaQ||c.cuota||0) || 0;
    if(cuotaMonto<=0) return;
    for(let k=pagadas+1; k<=totalCuotasCred; k++){
      const cuotaFecha = new Date(inicio.getTime() + k*MS_QUINCENA);
      if(cuotaFecha.getTime() < hoyTs - 90*24*60*60*1000) continue;
      const cy = cuotaFecha.getFullYear();
      const cm = cuotaFecha.getMonth();
      const bucket = futMeses.find(x=>x.y===cy && x.m===cm);
      if(bucket){
        bucket.esperado += cuotaMonto;
        bucket.cuotas += 1;
      }
    }
  });

  const proyRealmes = futMeses[0] ? futMeses[0].esperado : 0;
  const proy3Real = futMeses.slice(0,3).reduce((a,x)=>a+x.esperado,0);
  const proy6Real = futMeses.slice(0,6).reduce((a,x)=>a+x.esperado,0);
  const proy12Real = futMeses.slice(0,12).reduce((a,x)=>a+x.esperado,0);

  // Burn rate
  const ultimos3 = serie.slice(-3);
  const promIngHist = ultimos3.reduce((a,x)=>a+x.ingresos,0)/3;
  const promEg = ultimos3.reduce((a,x)=>a+x.egresos,0)/3;
  let acumulado = utilidad;
  let mesBreakeven = null;
  futMeses.forEach((fm)=>{
    acumulado += fm.esperado - promEg;
    if(mesBreakeven===null && acumulado>=0 && utilidad<0) mesBreakeven = fm.label;
  });

  const roi = totalEgresos>0 ? Math.round(utilidad/totalEgresos*100) : 0;
  const coberturaFuturaPct = promEg>0 ? Math.round(proyRealmes/promEg*100) : 0;

  // Top clientes / Cartera
  const topClientes=credsActivos.map(c=>{
    const cuotaV=parseFloat(c.cuotaQ||c.cuota||0);
    const totalC=c.totalCuotas||c.plazo*2;
    const saldo=Math.max(0,cuotaV*(totalC-(c.pagado||0)));
    return {cli:c.cli,modelo:c.modelo,saldo,mora:c.mora,id:c.id};
  }).sort((a,b)=>b.saldo-a.saldo).slice(0,8);

  const meses=[];
  for(let i=5;i>=0;i--){
    const d=new Date(); d.setMonth(d.getMonth()-i);
    const lbl=d.toLocaleDateString('es-VE',{month:'short',year:'2-digit'});
    const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    const tot=pagosConf.filter(p=>p.fecha&&p.fecha.startsWith(key)).reduce((a,p)=>a+p.monto,0);
    meses.push({lbl,tot,key});
  }
  const maxMes=Math.max(1,...meses.map(m=>m.tot));

  // Egresos por categoría
  const egresosCat={};
  egresos.forEach(e=>{
    const cat=e.categoria||e.forma||'Otros';
    egresosCat[cat]=(egresosCat[cat]||0)+(e.monto||0);
  });
  const catSorted = Object.entries(egresosCat).sort((a,b)=>b[1]-a[1]);
  const maxCatMonto = catSorted.length ? catSorted[0][1] : 1;

  // Helper chip comparativo
  const chip = (lbl, val, upGood) => {
    const positive = upGood ? val>=0 : val<=0;
    const color = positive ? 'green' : 'red';
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:12px;background:var(--${color}s);color:var(--${color});font-size:10.5px;font-weight:700">${val>=0?'▲':'▼'} ${Math.abs(val)}%  ${lbl}</span>`;
  };

  // ══════════ HTML ══════════
  var tabs = [
    {k:'resumen', lbl:'Resumen', sub:'Estado general · KPIs'},
    {k:'proyecciones', lbl:'Proyecciones', sub:'Flujo futuro · 12 meses'},
    {k:'egresos', lbl:'Egresos', sub:'Gastos · categorías'},
    {k:'exportar', lbl:'Exportar', sub:'Reportes · CSV · Backup'},
    {k:'libroseniat', lbl:'Libro SENIAT', sub:'Ventas · IVA · IGTF'}
  ];

  return`<div class="page">

  ${pageBanner(
    'Analytics · Finanzas y contabilidad',
    'Finanzas',
    '<b>'+fmt(totalIngresos)+'</b> ingresos · <b>'+fmt(totalEgresos)+'</b> egresos · Utilidad: <b>'+fmt(utilidad)+'</b> · Cartera: <b>'+fmt(cartera)+'</b>',
    [
      {label:'↻ Actualizar', onclick:"nav('reportes')"},
      {label:'＋ Registrar Egreso', onclick:'openAddEgreso()', primary:true}
    ]
  )}

  <!-- Tabs internas -->
  <div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:2px solid var(--rim);flex-wrap:wrap">
    ${tabs.map(function(t){
      var isActive = tab===t.k;
      return '<button onclick="setReportesTab(\''+t.k+'\')" style="background:none;border:none;padding:10px 18px;font-size:13px;font-weight:'+(isActive?'800':'600')+';color:'+(isActive?'var(--p1)':'var(--ink3)')+';border-bottom:3px solid '+(isActive?'var(--p1)':'transparent')+';margin-bottom:-2px;cursor:pointer;font-family:var(--f);display:flex;flex-direction:column;align-items:flex-start;gap:1px">'
        +'<span>'+t.lbl+'</span>'
        +'<span style="font-size:10px;font-weight:500;color:var(--ink3)">'+t.sub+'</span>'
        +'</button>';
    }).join('')}
  </div>

  ${tab==='resumen' ? `
  <!-- ════════ TAB: RESUMEN ════════ -->

  <!-- Banner salud operativa -->
  <div style="background:${utilidad>=0?'linear-gradient(135deg,var(--greens),rgba(6,176,106,.04))':'linear-gradient(135deg,rgba(37,99,235,.08),rgba(37,99,235,.02))'};border:1px solid ${utilidad>=0?'rgba(6,176,106,.25)':'rgba(37,99,235,.2)'};border-radius:14px;padding:16px 20px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
    <div>
      <div style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:${utilidad>=0?'var(--green)':'var(--p1)'};margin-bottom:4px">${utilidad>=0?'✓ Operación en positivo':'◐ Operación en fase de recuperación'}</div>
      <div style="font-size:14px;font-weight:700;margin-bottom:4px">${utilidad>=0?`Caja positiva — margen ${margen}%. Cobrado ${fmt(totalIngresos)} vs ${fmt(totalEgresos)} egresos.`:`Déficit de <span style="color:var(--red)">${fmt(Math.abs(utilidad))}</span> — normal en financiamiento. Capital en calle: <strong>${fmt(cartera)}</strong>`}</div>
      <div style="font-size:12px;color:var(--ink3)">Flujo esperado 12m: <strong style="color:var(--green)">${fmt(proy12Real)}</strong>${mesBreakeven?' · Break-even: <strong style="color:var(--p1)">'+mesBreakeven+'</strong>':''} · Spread bruto acumulado: <strong>${fmt(spreadBrutoTotal)}</strong></div>
    </div>
    <div style="text-align:right">
      <div style="font-size:10px;color:var(--ink3);font-weight:700;text-transform:uppercase">Utilidad proyectada 12m</div>
      <div style="font-size:26px;font-weight:900;font-family:var(--fd);color:${(utilidad+proy12Real-promEg*12)>=0?'var(--green)':'var(--red)'}">${fmt(utilidad+proy12Real-promEg*12)}</div>
      <div style="font-size:10px;color:var(--ink3)">Caja + cobranza futura − burn rate</div>
    </div>
  </div>

  <!-- ROW 1: KPIs financieros principales -->
  <div class="sg" style="grid-template-columns:repeat(4,1fr);margin-bottom:10px">
    <div class="stat"><div class="st-ic" style="background:var(--greens);color:var(--green);font-size:9px;font-weight:800">ING</div>
      <div class="st-v" style="color:var(--green)">${fmt(totalIngresos)}</div><div class="st-l">Ingresos totales</div>
      <div style="font-size:10px;margin-top:4px">${chip('vs mes ant.',deltaIng,true)}</div></div>
    <div class="stat"><div class="st-ic" style="background:var(--reds);color:var(--red);font-size:9px;font-weight:800">EGR</div>
      <div class="st-v" style="color:var(--red)">${fmt(totalEgresos)}</div><div class="st-l">Egresos totales</div>
      <div style="font-size:10px;margin-top:4px">${chip('vs mes ant.',deltaEg,false)}</div></div>
    <div class="stat"><div class="st-ic" style="background:var(--gs);color:var(--p1);font-size:9px;font-weight:800">UTL</div>
      <div class="st-v" style="color:${utilidad>=0?'var(--green)':'var(--red)'}">${fmt(utilidad)}</div><div class="st-l">Utilidad neta · ${margen}% margen</div>
      <div style="font-size:10px;margin-top:4px">${chip('vs mes ant.',deltaUt,true)}</div></div>
    <div class="stat"><div class="st-ic" style="background:var(--ambers);color:var(--amber);font-size:9px;font-weight:800">$↗</div>
      <div class="st-v" style="color:var(--amber)">${fmt(dineroCalle)}</div><div class="st-l">Dinero en la calle</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:4px">Cartera pendiente</div></div>
  </div>

  <!-- ROW 2: KPIs cartera -->
  <div class="sg" style="grid-template-columns:repeat(6,1fr);margin-bottom:14px">
    <div class="stat"><div class="st-v" style="font-size:20px">${credsActivos.length}</div><div class="st-l">Créditos activos</div></div>
    <div class="stat"><div class="st-v" style="font-size:20px;color:var(--red)">${credsMora.length}</div><div class="st-l">En mora <span style="font-size:10px;opacity:.6">${tasaMora}%</span></div></div>
    <div class="stat"><div class="st-v" style="font-size:20px;color:var(--green)">${credsComp.length}</div><div class="st-l">Completados</div></div>
    <div class="stat"><div class="st-v" style="font-size:20px">${pctCobro}%</div><div class="st-l">Efectividad cobro</div></div>
    <div class="stat"><div class="st-v" style="font-size:20px;color:var(--amber)">${fmt(valorInventario)}</div><div class="st-l">Val. inventario</div></div>
    <div class="stat"><div class="st-v" style="font-size:20px">${S.clientes.filter(c=>!c.eliminado).length}</div><div class="st-l">Clientes totales</div></div>
  </div>

  <!-- ROW 3: Charts Ingresos + Egresos por mes (12 meses) -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
    <div class="card">
      <div class="ch" style="margin-bottom:10px">
        <div><div class="ct">Ingresos</div><div class="cs" id="fin2-ing-sub">Últimos 30 días</div></div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-xs btn-p" id="fin2-ing-d" onclick="setFin2Periodo('ing','diario')"    style="font-size:10px;padding:4px 9px">Diario</button>
          <button class="btn btn-xs" id="fin2-ing-q" onclick="setFin2Periodo('ing','quincenal')" style="font-size:10px;padding:4px 9px">Quincenal</button>
          <button class="btn btn-xs" id="fin2-ing-m" onclick="setFin2Periodo('ing','mensual')"   style="font-size:10px;padding:4px 9px">Mensual</button>
          <button class="btn btn-g btn-sm" onclick="exportarCSV('pagos')" style="margin-left:2px">↓ CSV</button>
        </div>
      </div>
      <div id="fin2-ing-wrap" style="height:130px">
        ${(function(){
          var data=getDashData('ingresos','diario');
          var maxV=Math.max.apply(null,data.map(function(x){return x.total;}))||1;
          return '<div style="display:flex;align-items:flex-end;gap:3px;height:120px">'
            +data.map(function(b,i){
              var h=b.total>0?Math.max(4,Math.round(b.total/maxV*110)):2;
              var isLast=i===data.length-1;
              return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;height:100%;justify-content:flex-end">'
                +(isLast&&b.total>0?'<div style="font-size:8px;font-weight:700;color:var(--p1)">$'+Math.round(b.total/1000)+'k</div>':'')
                +'<div style="width:100%;background:'+(isLast?'var(--p1)':'rgba(37,99,235,0.3)')+';border-radius:3px 3px 0 0;height:'+h+'px;min-height:2px"></div>'
                +'<div style="font-size:7px;color:var(--ink3);white-space:nowrap">'+b.label+'</div>'
                +'</div>';
            }).join('')+'</div>';
        })()}
      </div>
    </div>
    <div class="card">
      <div class="ch" style="margin-bottom:10px">
        <div><div class="ct">Egresos</div><div class="cs" id="fin2-egr-sub">Últimos 30 días</div></div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-xs btn-p" id="fin2-egr-d" onclick="setFin2Periodo('egr','diario')"    style="font-size:10px;padding:4px 9px">Diario</button>
          <button class="btn btn-xs" id="fin2-egr-q" onclick="setFin2Periodo('egr','quincenal')" style="font-size:10px;padding:4px 9px">Quincenal</button>
          <button class="btn btn-xs" id="fin2-egr-m" onclick="setFin2Periodo('egr','mensual')"   style="font-size:10px;padding:4px 9px">Mensual</button>
          <button class="btn btn-g btn-sm" onclick="setReportesTab('egresos')" style="margin-left:2px">Ver detalle →</button>
        </div>
      </div>
      <div id="fin2-egr-wrap" style="height:130px">
        ${(function(){
          var data=getDashData('egresos','diario');
          var maxV=Math.max.apply(null,data.map(function(x){return x.total;}))||1;
          return '<div style="display:flex;align-items:flex-end;gap:3px;height:120px">'
            +data.map(function(b,i){
              var h=b.total>0?Math.max(4,Math.round(b.total/maxV*110)):2;
              var isLast=i===data.length-1;
              return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;height:100%;justify-content:flex-end">'
                +(isLast&&b.total>0?'<div style="font-size:8px;font-weight:700;color:var(--red)">$'+Math.round(b.total/1000)+'k</div>':'')
                +'<div style="width:100%;background:'+(isLast?'var(--red)':'rgba(217,59,90,0.28)')+';border-radius:3px 3px 0 0;height:'+h+'px;min-height:2px"></div>'
                +'<div style="font-size:7px;color:var(--ink3);white-space:nowrap">'+b.label+'</div>'
                +'</div>';
            }).join('')+'</div>';
        })()}
      </div>
    </div>
  </div>

  <!-- ROW 4: Resumen financiero + KPIs clave -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
    <div class="card">
      <div class="ch"><div class="ct">Resumen financiero</div></div>
      ${[
        ['Iniciales cobradas', fmt(totalIniciales), 'green'],
        ['Cuotas cobradas', fmt(totalCuotas), 'green'],
        ['Total ingresos', fmt(totalIngresos), 'green'],
        ['Egresos registrados', fmt(totalEgresos), 'red'],
        ['Utilidad neta', fmt(utilidad), utilidad>=0?'green':'red'],
        ['Cuota esperada/mes', fmt(cuotaEspMes), 'p1'],
        ['Spread bruto total', fmt(spreadBrutoTotal), 'p1'],
        ['Burn rate mensual', fmt(promEg), 'amber'],
      ].map(row=>{var l=row[0],v=row[1],c=row[2];return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--rim2);font-size:12.5px">
        <span style="color:var(--ink3)">${l}</span>
        <span style="font-weight:800;font-family:var(--fd);color:var(--${c})">${v}</span>
      </div>`;}).join('')}
    </div>
    <div class="card">
      <div class="ch"><div><div class="ct">Indicadores clave</div><div class="cs">KPIs de negocio y salud operativa</div></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${[
          ['Margen operativo', margen+'%', margen>=30?'green':margen>=10?'amber':'red'],
          ['ROI histórico', roi+'%', roi>=50?'green':roi>=0?'amber':'red'],
          ['Tasa de mora', tasaMora+'%', tasaMora<=5?'green':tasaMora<=15?'amber':'red'],
          ['Días mora prom.', diasMoraProm+'d', diasMoraProm<=7?'green':diasMoraProm<=20?'amber':'red'],
          ['Cobertura futura', coberturaFuturaPct+'%', coberturaFuturaPct>=100?'green':'amber'],
          ['Break-even', mesBreakeven||(utilidad>=0?'Ya':'>12m'), mesBreakeven?'p1':(utilidad>=0?'green':'red')],
        ].map(function(row){var l=row[0],v=row[1],c=row[2];return `<div style="padding:11px;background:var(--surf2);border-radius:10px;border-left:3px solid var(--${c})">
          <div style="font-size:10px;color:var(--ink3);font-weight:700;text-transform:uppercase;letter-spacing:.4px">${l}</div>
          <div style="font-size:18px;font-weight:900;font-family:var(--fd);color:var(--${c});margin-top:3px">${v}</div>
        </div>`;}).join('')}
      </div>
    </div>
  </div>

  <!-- ROW 5: Créditos más rentables + Egresos por categoría -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
    <div class="card">
      <div class="ch"><div><div class="ct">Créditos más rentables</div><div class="cs">Mayor spread generado por crédito</div></div></div>
      <div class="tw tw-compact"><table>
        <thead><tr><th>Cliente</th><th>Modelo</th><th>APY</th><th>Spread</th><th>Estado</th></tr></thead>
        <tbody>${(function(){
          var ranked = _SCREDS.filter(c=>!c.eliminado).map(function(c){
            var precio=parseFloat(c.precioBaseReal||c.precio||0);
            var total=parseFloat(c.total||0);
            var spread=total-precio;
            var apy=parseFloat(c.apy||(c.plan&&c.plan.apy)||0);
            return {c:c, spread:spread, apy:apy};
          }).filter(function(x){return x.spread>0;})
            .sort(function(a,b){return b.spread-a.spread;})
            .slice(0,8);
          return ranked.map(function(x){
            var c=x.c;
            var col=c.estado==='completado'?'b-g':c.mora>0?'b-r':'b-p';
            return '<tr onclick="openAmort('+JSON.stringify(c.id)+')" style="cursor:pointer">'
              +'<td class="tdm">'+c.cli+'</td>'
              +'<td class="tds">'+(c.modelo||'—')+'</td>'
              +'<td style="font-weight:800;font-family:var(--fd);color:var(--p1)">'+x.apy.toFixed(1)+'%</td>'
              +'<td style="font-weight:800;font-family:var(--fd);color:var(--green)">'+fmt(x.spread)+'</td>'
              +'<td><span class="bdg '+col+'">'+c.estado+'</span></td>'
              +'</tr>';
          }).join('');
        })()}</tbody>
      </table></div>
    </div>
    <div class="card">
      <div class="ch"><div><div class="ct">Egresos por categoría</div><div class="cs">Distribución del gasto total</div></div></div>
      ${(function(){
        var cats={};
        _SEGR.filter(function(e){return !e.eliminado&&e.monto;}).forEach(function(e){
          var k=e.categoria||e.tipo||'Sin categoría';
          cats[k]=(cats[k]||0)+(e.monto||0);
        });
        var arr=Object.keys(cats).map(function(k){return {k:k,v:cats[k]};}).sort(function(a,b){return b.v-a.v;});
        var total=arr.reduce(function(a,x){return a+x.v;},0)||1;
        var colors=['var(--red)','var(--amber)','var(--p1)','var(--green)','var(--ink3)'];
        if(!arr.length) return '<div style="text-align:center;padding:30px;color:var(--ink3);font-size:13px">Sin egresos registrados</div>';
        return arr.slice(0,6).map(function(x,i){
          var pct=Math.round(x.v/total*100);
          return '<div style="margin-bottom:10px">'
            +'<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">'
              +'<span style="color:var(--ink);font-weight:600">'+x.k+'</span>'
              +'<span style="font-weight:800;font-family:var(--fd);color:'+(colors[i]||'var(--ink)')+'">'+fmt(x.v)+' <span style="font-size:10px;opacity:.6">'+pct+'%</span></span>'
            +'</div>'
            +'<div style="height:7px;background:var(--rim);border-radius:4px;overflow:hidden">'
              +'<div style="height:100%;width:'+pct+'%;background:'+(colors[i]||'var(--ink3)')+';border-radius:4px;transition:width .5s"></div>'
            +'</div>'
          +'</div>';
        }).join('');
      })()}
    </div>
  </div>

  <!-- ROW 6: Top cartera + Mora detallada -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
    <div class="card">
      <div class="ch"><div><div class="ct">Top cartera activa</div><div class="cs">Mayores saldos pendientes</div></div></div>
      <div class="tw tw-compact"><table>
        <thead><tr><th>Cliente</th><th>Modelo</th><th>Saldo</th><th>Mora</th></tr></thead>
        <tbody>${topClientes.map(c=>`<tr onclick="openAmort('${c.id}')" style="cursor:pointer">
          <td class="tdm">${c.cli}</td>
          <td class="tds">${c.modelo}</td>
          <td style="font-weight:800;font-family:var(--fd);color:var(--p1)">${fmt(c.saldo)}</td>
          <td>${c.mora>0?`<span class="bdg b-r">${c.mora}d</span>`:'<span class="bdg b-g">Al día</span>'}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>
    <div class="card">
      <div class="ch"><div><div class="ct">Mora detallada</div><div class="cs">${credsMora.length} créditos · ${fmt(moraAcumulada)} acumulado</div></div>
        <button class="btn btn-g btn-sm" onclick="nav('cobranza')">→ Cobranza</button>
      </div>
      ${credsMora.length?`<div class="tw tw-compact"><table>
        <thead><tr><th>Cliente</th><th>Días</th><th>Cuota</th></tr></thead>
        <tbody>${credsMora.sort((a,b)=>b.mora-a.mora).slice(0,8).map(c=>`<tr onclick="openAmort('${c.id}')" style="cursor:pointer">
          <td><div class="tdm">${c.cli}</div><div class="tds">${c.modelo||'—'}</div></td>
          <td><span class="bdg ${c.mora>60?'b-r':c.mora>30?'b-a':'b-b'}">${c.mora}d</span></td>
          <td style="font-weight:700;color:var(--red)">${fmt(c.cuotaQ||c.cuota||0)}</td>
        </tr>`).join('')}</tbody>
      </table></div>`:`<div style="text-align:center;padding:28px;color:var(--green);font-size:13px;font-weight:700">✓ Sin créditos en mora</div>`}
    </div>
  </div>

  <!-- ROW 7: Ingresos por mes vs egresos (trend) + Inventario -->
  <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:12px;margin-bottom:12px">
    <div class="card">
      <div class="ch"><div><div class="ct">Tendencia ingresos vs egresos</div><div class="cs">12 meses · utilidad mensual</div></div></div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr>
            <th style="text-align:left;padding:5px 8px;color:var(--ink3);font-weight:700;font-size:10px;text-transform:uppercase">Mes</th>
            <th style="text-align:right;padding:5px 8px;color:var(--green);font-weight:700;font-size:10px">Ingresos</th>
            <th style="text-align:right;padding:5px 8px;color:var(--red);font-weight:700;font-size:10px">Egresos</th>
            <th style="text-align:right;padding:5px 8px;color:var(--p1);font-weight:700;font-size:10px">Utilidad</th>
            <th style="text-align:right;padding:5px 8px;color:var(--ink3);font-weight:700;font-size:10px">Créditos</th>
          </tr></thead>
          <tbody>${serie.map((s,i)=>`<tr style="border-bottom:1px solid var(--rim2);${i===serie.length-1?'background:var(--surf2);font-weight:700':''}">
            <td style="padding:6px 8px;color:var(--ink);font-weight:${i===serie.length-1?'800':'500'}">${s.label}</td>
            <td style="padding:6px 8px;text-align:right;color:var(--green);font-family:var(--fd)">${s.ingresos>0?fmt(s.ingresos):'—'}</td>
            <td style="padding:6px 8px;text-align:right;color:var(--red);font-family:var(--fd)">${s.egresos>0?fmt(s.egresos):'—'}</td>
            <td style="padding:6px 8px;text-align:right;color:${s.utilidad>=0?'var(--green)':'var(--red)'};font-family:var(--fd);font-weight:700">${s.ingresos>0||s.egresos>0?fmt(s.utilidad):'—'}</td>
            <td style="padding:6px 8px;text-align:right;color:var(--ink3)">${s.nuevos>0?s.nuevos:'—'}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
    <div class="card">
      <div class="ch"><div class="ct">Inventario de motos</div><div class="cs">${_SMOTOS.filter(m=>!m.eliminado).length} unidades totales</div></div>
      ${[
        ['Disponibles', _SMOTOS.filter(m=>!m.eliminado&&m.estado==='disponible').length, 'green'],
        ['Financiadas', _SMOTOS.filter(m=>!m.eliminado&&m.estado==='financiada').length, 'p1'],
        ['Recuperadas', _SMOTOS.filter(m=>!m.eliminado&&(m.estado==='recuperada'||m.estado==='recuperado')).length, 'amber'],
        ['Inventario', _SMOTOS.filter(m=>!m.eliminado&&m.estado==='inventario').length, 'ink3'],
      ].map(row=>{var l=row[0],n=row[1],c=row[2];
        const tot=Math.max(1,_SMOTOS.filter(m=>!m.eliminado).length);
        const pct=Math.round(n/tot*100);
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;margin-bottom:4px">
            <span style="color:var(--ink3)">${l}</span>
            <span style="color:var(--${c});font-weight:800">${n} <span style="opacity:.5;font-size:10px">${pct}%</span></span>
          </div>
          <div style="height:6px;background:var(--rim);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:var(--${c});border-radius:3px;transition:width .6s"></div>
          </div>
        </div>`;
      }).join('')}
      <div style="margin-top:10px;padding:10px;background:var(--gs);border-radius:9px;border:1px solid var(--rim2);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12px;font-weight:700;color:var(--ink3)">Valor en stock disponible</span>
        <span style="font-weight:900;font-family:var(--fd);color:var(--p1)">${fmt(valorInventario)}</span>
      </div>
    </div>
  </div>

  <!-- ROW 8: Top modelos por rentabilidad + Pagos recientes -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
    <div class="card">
      <div class="ch"><div><div class="ct">Modelos más vendidos</div><div class="cs">Por cantidad de créditos otorgados</div></div></div>
      ${(function(){
        var mods={};
        _SCREDS.filter(function(c){return !c.eliminado&&c.modelo;}).forEach(function(c){
          var k=c.modelo;
          if(!mods[k]) mods[k]={n:0,ingreso:0,spread:0};
          mods[k].n++;
          mods[k].ingreso+=parseFloat(c.total||0);
          mods[k].spread+=parseFloat(c.total||0)-parseFloat(c.precioBaseReal||c.precio||0);
        });
        var arr=Object.keys(mods).map(function(k){return {k:k,n:mods[k].n,ingreso:mods[k].ingreso,spread:mods[k].spread};})
          .sort(function(a,b){return b.n-a.n;}).slice(0,6);
        var maxN=arr.length?arr[0].n:1;
        if(!arr.length) return '<div style="text-align:center;padding:30px;color:var(--ink3)">Sin datos</div>';
        return '<div style="display:flex;flex-direction:column;gap:9px">'
          +arr.map(function(x){
            var pct=Math.round(x.n/maxN*100);
            return '<div>'
              +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">'
                +'<span style="font-size:12.5px;font-weight:700;color:var(--ink)">'+x.k+'</span>'
                +'<div style="text-align:right">'
                  +'<span style="font-size:12px;font-weight:800;color:var(--p1)">'+x.n+' ud.</span>'
                  +' <span style="font-size:10px;color:var(--green)">+'+fmt(x.spread)+'</span>'
                +'</div>'
              +'</div>'
              +'<div style="height:5px;background:var(--rim);border-radius:3px;overflow:hidden">'
                +'<div style="height:100%;width:'+pct+'%;background:var(--p1);border-radius:3px;transition:width .5s"></div>'
              +'</div>'
            +'</div>';
          }).join('')+'</div>';
      })()}
    </div>
    <div class="card">
      <div class="ch"><div><div class="ct">Pagos recientes</div><div class="cs">Últimos 10 confirmados</div></div>
        <button class="btn btn-g btn-sm" onclick="nav('pagos')">Ver todos →</button>
      </div>
      <div class="tw tw-compact"><table>
        <thead><tr><th>Cliente</th><th>Fecha</th><th>Monto</th><th>Tipo</th></tr></thead>
        <tbody>${(function(){
          var recientes=pagosConf.filter(function(p){return p.fecha;})
            .sort(function(a,b){return (b.fecha||'')>(a.fecha||'')?1:-1;}).slice(0,10);
          return recientes.map(function(p){
            var esIni=p.esInicial||p.tipoOperacion==='inicial_credito';
            return '<tr>'
              +'<td class="tdm">'+(p.cli||p.cred||'—')+'</td>'
              +'<td class="tds">'+(p.fecha||'').slice(0,10)+'</td>'
              +'<td style="font-weight:800;font-family:var(--fd);color:var(--green)">'+fmt(p.monto||0)+'</td>'
              +'<td><span class="bdg '+(esIni?'b-a':'b-g')+'">'+(esIni?'Inicial':'Cuota')+'</span></td>'
              +'</tr>';
          }).join('');
        })()}</tbody>
      </table></div>
    </div>
  </div>
  ` : tab==='proyecciones' ? `
  <!-- ════════ TAB: PROYECCIONES ════════ -->

  <!-- Resumen proyección -->
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
    <div class="stat" style="border-top:3px solid var(--p1)">
      <div class="st-v" style="color:var(--p1);font-size:22px">${fmt(proyRealmes)}</div>
      <div class="st-l">Próximo mes</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:2px">${futMeses[0]?futMeses[0].cuotas:0} cuotas esperadas</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--green)">
      <div class="st-v" style="color:var(--green);font-size:22px">${fmt(proy3Real)}</div>
      <div class="st-l">Próximos 3 meses</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:2px">${futMeses.slice(0,3).reduce((a,x)=>a+x.cuotas,0)} cuotas</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--amber)">
      <div class="st-v" style="color:var(--amber);font-size:22px">${fmt(proy6Real)}</div>
      <div class="st-l">Próximos 6 meses</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:2px">${futMeses.slice(0,6).reduce((a,x)=>a+x.cuotas,0)} cuotas</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--green)">
      <div class="st-v" style="color:var(--green);font-size:22px">${fmt(proy12Real)}</div>
      <div class="st-l">Próximos 12 meses</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:2px">${futMeses.slice(0,12).reduce((a,x)=>a+x.cuotas,0)} cuotas</div>
    </div>
  </div>

  <!-- Serie histórica 12 meses (barras) -->
  <div class="card" style="margin-bottom:12px">
    <div class="ch"><div><div class="ct">Serie histórica · últimos 12 meses</div><div class="cs">Ingresos vs egresos · utilidad neta mensual</div></div></div>
    <div style="display:flex;align-items:flex-end;gap:6px;height:180px;margin-top:14px;padding:0 4px">
      ${(function(){
        var maxVal = Math.max(1, Math.max.apply(null, serie.map(function(s){return Math.max(s.ingresos, s.egresos);})));
        return serie.map(function(s){
          var hIng = s.ingresos>0 ? Math.max(6, Math.round(s.ingresos/maxVal*150)) : 2;
          var hEg = s.egresos>0 ? Math.max(6, Math.round(s.egresos/maxVal*150)) : 2;
          return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0">'
            +'<div style="font-size:9px;font-weight:800;color:'+(s.utilidad>=0?'var(--green)':'var(--red)')+';height:12px;white-space:nowrap">'+(s.utilidad!==0?fmt(s.utilidad).slice(0,7):'')+'</div>'
            +'<div style="flex:1;width:100%;display:flex;align-items:flex-end;gap:2px">'
            +'<div style="flex:1;background:linear-gradient(180deg,var(--green),#10c878);border-radius:3px 3px 0 0;height:'+hIng+'px" title="Ingresos: '+fmt(s.ingresos)+'"></div>'
            +'<div style="flex:1;background:linear-gradient(180deg,var(--red),#ef4e6f);border-radius:3px 3px 0 0;height:'+hEg+'px" title="Egresos: '+fmt(s.egresos)+'"></div>'
            +'</div>'
            +'<div style="font-size:9px;color:var(--ink3);font-weight:600">'+s.label+'</div>'
            +'</div>';
        }).join('');
      })()}
    </div>
    <div style="display:flex;gap:14px;margin-top:14px;padding-top:10px;border-top:1px solid var(--rim2);font-size:11px;flex-wrap:wrap">
      <span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:2px;background:var(--green)"></span>Ingresos</span>
      <span style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:2px;background:var(--red)"></span>Egresos</span>
      <span style="color:var(--ink3)">Promedio ingresos últimos 3m: <b style="color:var(--green)">${fmt(promIngHist)}</b></span>
      <span style="color:var(--ink3)">Burn promedio: <b style="color:var(--red)">${fmt(promEg)}/mes</b></span>
    </div>
  </div>

  <!-- Comparativa mes actual vs anterior -->
  <div class="card" style="margin-bottom:12px">
    <div class="ch"><div><div class="ct">Comparativa · ${mActual.label} vs ${mAnterior.label||'—'}</div><div class="cs">Variación intermensual</div></div></div>
    <table style="width:100%;margin-top:10px">
      <thead style="border-bottom:1px solid var(--rim2)">
        <tr>
          <th style="text-align:left;padding:8px 6px;font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase">Métrica</th>
          <th style="text-align:right;padding:8px 6px;font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase">Mes anterior</th>
          <th style="text-align:right;padding:8px 6px;font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase">Mes actual</th>
          <th style="text-align:right;padding:8px 6px;font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase">Diferencia</th>
          <th style="text-align:right;padding:8px 6px;font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase">Variación</th>
        </tr>
      </thead>
      <tbody>
        ${[
          ['Ingresos cobrados', mAnterior.ingresos, mActual.ingresos, deltaIng, 'green', true],
          ['Egresos', mAnterior.egresos, mActual.egresos, deltaEg, 'red', false],
          ['Utilidad neta', mAnterior.utilidad, mActual.utilidad, deltaUt, mActual.utilidad>=0?'green':'red', true],
          ['Créditos nuevos', mAnterior.nuevos, mActual.nuevos, deltaNuev, 'p1', true],
        ].map(function(row){
          var l=row[0],prev=row[1],curr=row[2],d=row[3],c=row[4],upGood=row[5];
          const positive = upGood ? d>=0 : d<=0;
          const diff = curr-prev;
          return `<tr style="border-bottom:1px solid var(--rim2)">
            <td style="padding:11px 6px;font-weight:600">${l}</td>
            <td style="padding:11px 6px;text-align:right;font-family:var(--fd);color:var(--ink3)">${l==='Créditos nuevos'?prev:fmt(prev)}</td>
            <td style="padding:11px 6px;text-align:right;font-family:var(--fd);font-weight:800;color:var(--${c})">${l==='Créditos nuevos'?curr:fmt(curr)}</td>
            <td style="padding:11px 6px;text-align:right;font-family:var(--fd);color:${diff>=0?'var(--green)':'var(--red)'};font-weight:700">${diff>=0?'+':''}${l==='Créditos nuevos'?diff:fmt(diff)}</td>
            <td style="padding:11px 6px;text-align:right;font-family:var(--fd);font-weight:800;color:${positive?'var(--green)':'var(--red)'}">${d>=0?'+':''}${d}%</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>

  <!-- Proyección futura 12 meses -->
  <div class="card">
    <div class="ch"><div><div class="ct">Proyección futura · próximos 12 meses</div><div class="cs">Cobros esperados según cronogramas firmados</div></div>
      <div style="font-weight:900;font-size:18px;color:var(--green);font-family:var(--fd)">${fmt(proy12Real)}</div>
    </div>
    <div style="display:flex;align-items:flex-end;gap:5px;height:150px;margin-top:14px;padding:0 4px">
      ${(function(){
        var maxE = Math.max(1, Math.max.apply(null, futMeses.map(function(f){return f.esperado;})));
        return futMeses.map(function(f){
          var h = f.esperado>0 ? Math.max(8, Math.round(f.esperado/maxE*130)) : 3;
          return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">'
            +'<div style="font-size:9px;font-weight:800;color:var(--p1);height:12px;white-space:nowrap">'+(f.esperado>0?fmt(f.esperado).slice(0,7):'')+'</div>'
            +'<div style="flex:1;width:100%;display:flex;align-items:flex-end">'
            +'<div style="width:100%;background:linear-gradient(180deg,var(--p1),#60A5FA);border-radius:3px 3px 0 0;height:'+h+'px" title="'+f.label+': '+fmt(f.esperado)+' ('+f.cuotas+' cuotas)"></div>'
            +'</div>'
            +'<div style="font-size:9px;color:var(--ink3);font-weight:600">'+f.label.split(' ')[0]+'</div>'
            +'</div>';
        }).join('');
      })()}
    </div>
    <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--rim2);display:flex;gap:16px;flex-wrap:wrap;font-size:11.5px">
      <span style="color:var(--ink3)">Total cuotas esperadas: <b>${futMeses.reduce((a,x)=>a+x.cuotas,0)}</b></span>
      <span style="color:var(--ink3)">Promedio mensual: <b style="color:var(--green)">${fmt(proy12Real/12)}</b></span>
      <span style="color:var(--ink3)">Cobertura vs burn: <b style="color:${coberturaFuturaPct>=100?'var(--green)':'var(--amber)'}">${coberturaFuturaPct}%</b></span>
    </div>
  </div>

  ` : tab==='egresos' ? `
  <!-- ════════ TAB: EGRESOS ════════ -->

  <!-- Totales -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
    <div class="stat" style="border-top:3px solid var(--red)">
      <div class="st-v" style="color:var(--red);font-size:22px">${fmt(totalEgresos)}</div>
      <div class="st-l">Total egresos</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:2px">${egresos.length} registros</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--amber)">
      <div class="st-v" style="color:var(--amber);font-size:22px">${Object.keys(egresosCat).length}</div>
      <div class="st-l">Categorías</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:2px">Distintas categorías de gasto</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--p1)">
      <div class="st-v" style="color:var(--p1);font-size:22px">${fmt(promEg)}</div>
      <div class="st-l">Promedio mensual</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:2px">Últimos 3 meses (burn rate)</div>
    </div>
  </div>

  <!-- Categorías -->
  <div style="display:grid;grid-template-columns:1fr 1.3fr;gap:12px;margin-bottom:12px">
    <div class="card">
      <div class="ch"><div><div class="ct">Egresos por categoría</div><div class="cs">Distribución del gasto</div></div></div>
      ${catSorted.length ? catSorted.map(function(row){
        var cat=row[0], tot=row[1];
        var pct = Math.round(tot/maxCatMonto*100);
        var pctTot = Math.round(tot/totalEgresos*100);
        return '<div style="margin-bottom:10px">'
          +'<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">'
          +'<span style="font-weight:700">'+cat+'</span>'
          +'<span style="font-family:var(--fd);font-weight:800;color:var(--red)">'+fmt(tot)+' <span style="opacity:.6;font-size:10px;color:var(--ink3)">'+pctTot+'%</span></span>'
          +'</div>'
          +'<div style="height:7px;background:var(--rim);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:linear-gradient(90deg,var(--red),#ef4e6f);border-radius:3px"></div></div>'
          +'</div>';
      }).join('') : '<div style="text-align:center;padding:30px 0;color:var(--ink3);font-size:12.5px">Sin egresos registrados</div>'}
    </div>

    <div class="card">
      <div class="ch">
        <div><div class="ct">Historial de egresos</div><div class="cs">${egresos.length} registro${egresos.length===1?'':'s'}</div></div>
        <button class="btn btn-p btn-sm" onclick="openAddEgreso()">＋ Nuevo Egreso</button>
      </div>
      <div style="max-height:360px;overflow-y:auto;margin:0 -4px;padding:0 4px">
        ${egresos.length?egresos.slice().sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||'')).map(e=>`
          <div style="display:flex;align-items:center;gap:10px;padding:10px 6px;border-bottom:1px solid var(--rim2)">
            <div style="width:36px;height:36px;border-radius:8px;background:var(--reds);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:var(--red);flex-shrink:0">${(e.categoria||'$').substring(0,3).toUpperCase()}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.concepto}</div>
              <div style="font-size:10.5px;color:var(--ink3);margin-top:2px">
                <span style="padding:1px 6px;border-radius:4px;background:var(--surf2);margin-right:4px">${e.categoria||'Sin categoría'}</span>
                ${e.forma||'—'} · ${e.fecha||'—'}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
              <span style="font-weight:800;font-family:var(--fd);color:var(--red);font-size:14px">-${fmt(e.monto)}</span>
              <button class="btn btn-d btn-xs btn-ic" onclick="delEgreso(${e.id})" title="Eliminar">✕</button>
            </div>
          </div>`).join(''):`<div style="text-align:center;padding:40px 0;color:var(--ink3)">
            <div style="font-size:13px;font-weight:600;margin-bottom:4px">Sin egresos registrados</div>
            <div style="font-size:11.5px">Haz clic en "Nuevo Egreso" para comenzar</div>
          </div>`}
      </div>
      ${egresos.length?`<div style="margin-top:12px;background:var(--reds);border:1px solid rgba(217,59,90,.2);border-radius:10px;padding:11px 13px;display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:700;font-size:13px">Total egresos acumulados</span>
        <span style="color:var(--red);font-weight:900;font-family:var(--fd);font-size:16px">-${fmt(totalEgresos)}</span>
      </div>`:''}
    </div>
  </div>

  ` : `
  <!-- ════════ TAB: EXPORTAR ════════ -->

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">

    <!-- Ver / Generar reportes con formato -->
    <div class="card">
      <div class="ch"><div><div class="ct">Ver reportes</div><div class="cs">Abrir reporte con formato · imprimir o guardar PDF</div></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px">
        ${[
          ['Ingresos','ingresos'],
          ['Créditos','creditos'],
          ['Mora','mora'],
          ['Inventario','inventario'],
          ['P&L','pyl'],
          ['Flujo de caja','flujo'],
          ['Plan','plan'],
        ].map(row=>{var l=row[0],t=row[1];return `<button class="btn btn-g btn-sm" style="justify-content:flex-start" onclick="generarReporte('${t}')">
          ${l}
        </button>`;}).join('')}
      </div>
    </div>

    <!-- Exportar CSV / Backup -->
    <div class="card">
      <div class="ch"><div><div class="ct">Exportar datos</div><div class="cs">CSV para Excel · Backup JSON</div></div></div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">
      ${[
        ['Cartera completa (CSV)', "exportarCSV('creditos')", 'btn-g'],
        ['Clientes (CSV)', "exportarCSV('clientes')", 'btn-g'],
        ['Pagos confirmados (CSV)', "exportarCSV('pagos')", 'btn-g'],
        ['Egresos (CSV)', "exportarCSV('egresos')", 'btn-g'],
        ['Backup completo (JSON)', 'exportarBackupJSON()', 'btn-p'],
      ].map(row=>{var l=row[0],fn=row[1],cls=row[2];return `<button class="btn ${cls} btn-sm" style="justify-content:flex-start" onclick="${fn}">
        <span style="font-family:var(--fm);font-size:9px;opacity:.6;margin-right:6px">↓</span>${l}
      </button>`;}).join('')}
      </div>
      <div style="margin-top:14px;padding:11px;background:var(--gs);border-radius:9px;border:1px solid var(--rim2)">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--p1);margin-bottom:8px">Resumen rápido</div>
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0">
          <span style="color:var(--ink3)">Pagos por confirmar</span>
          <span style="font-weight:800;color:var(--amber)">${pagosPend.length}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0">
          <span style="color:var(--ink3)">Monto pendiente</span>
          <span style="font-weight:800;color:var(--amber)">${fmt(pagosPend.reduce((a,p)=>a+p.monto,0))}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0">
          <span style="color:var(--ink3)">Motos recuperadas</span>
          <span style="font-weight:800;color:var(--red)">${credsRec.length}</span>
        </div>
      </div>
    </div>
  </div>
  `}

  ${tab==='libroseniat' ? _renderLibroSeniat() : ''}

  </div>`;
};

