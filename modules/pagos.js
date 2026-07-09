// Pagasi module: pagos
PG.pagos = function(){
  const allPagos = _concFiltrar(S.pagos||[]).filter(p=>!p.eliminado);
  const confs = allPagos.filter(p=>p.estado==='confirmado');
  const pends = allPagos.filter(p=>p.estado==='pendiente');
  const totalConf= confs.reduce((a,p)=>a+p.monto,0);
  const totalPend= pends.reduce((a,p)=>a+p.monto,0);

  // Mes actual
  const hoy = new Date();
  const mesKey = hoy.getFullYear()+'-'+String(hoy.getMonth()+1).padStart(2,'0');
  const pagosMes = confs.filter(p=>p.fecha && p.fecha.startsWith(mesKey));
  const totalMes = pagosMes.reduce((a,p)=>a+p.monto,0);
  const promMes = pagosMes.length ? totalMes/pagosMes.length : 0;

  // Por método/cuenta
  const porMetodo = {};
  confs.forEach(function(p){
    var k = p.metodo||'Sin especificar';
    if(!porMetodo[k]) porMetodo[k]={nombre:k,total:0,count:0};
    porMetodo[k].total += p.monto;
    porMetodo[k].count++;
  });
  const metodosList = Object.values(porMetodo).sort((a,b)=>b.total-a.total);
  const topMetodo = metodosList[0]||{nombre:'—',total:0};

  // Últimos 14 días para el mini chart
  const dias = [];
  for(let i=13;i>=0;i--){
    const d = new Date(hoy); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
    const k = fechaLocalISO(d);
    const tot = confs.filter(p=>p.fecha===k).reduce((a,p)=>a+p.monto,0);
    dias.push({k,d,tot,lbl:d.getDate()});
  }
  const maxDia = Math.max(1,...dias.map(d=>d.tot));

  // Filtro por tab
  const tab = S.pagosTab||'todos';
  const pagosEliminados = S.pagos.filter(p=>p.eliminado);
  let filtered = allPagos;
  if(tab==='confirmados') filtered = confs;
  if(tab==='pendientes') filtered = pends;
  if(tab==='archivados') filtered = pagosEliminados;

  // ─── Sort pagos ───
  var _ps = S.pagosSort||{col:'fecha',dir:'desc'};
  filtered = filtered.slice().sort(function(a,b){
    var col=_ps.col, dir=_ps.dir==='asc'?1:-1;
    if(col==='fecha'){return dir*((a.fecha||'').localeCompare(b.fecha||''));}
    if(col==='monto'){return dir*(parseFloat(a.monto||0)-parseFloat(b.monto||0));}
    if(col==='cli'){return dir*((a.cli||'').toLowerCase().localeCompare((b.cli||'').toLowerCase()));}
    if(col==='cred'){return dir*((a.cred||'').localeCompare(b.cred||''));}
    if(col==='metodo'){return dir*((a.metodo||'').localeCompare(b.metodo||''));}
    if(col==='cobrador'){return dir*((a.cobrador||'').localeCompare(b.cobrador||''));}
    if(col==='estado'){return dir*((a.estado||'').localeCompare(b.estado||''));}
    if(col==='id'){return dir*((a.id||'').localeCompare(b.id||''));}
    return 0;
  });

  // ─── Filtro por rango de fechas ───
  var _pDesde = S.pagosDesde||'';
  var _pHasta = S.pagosHasta||'';
  if(_pDesde) filtered = filtered.filter(function(p){ return (p.fecha||'') >= _pDesde; });
  if(_pHasta) filtered = filtered.filter(function(p){ return (p.fecha||'') <= _pHasta; });
  // ─── Buscador: cliente, crédito, cobrador, ID, método o monto ───
  var _pQ = String(S.pagosQ||'').toLowerCase().trim();
  if(_pQ) filtered = filtered.filter(function(p){
    return String(p.cli||'').toLowerCase().indexOf(_pQ)>-1
        || String(p.cred||'').toLowerCase().indexOf(_pQ)>-1
        || String(p.cobrador||'').toLowerCase().indexOf(_pQ)>-1
        || String(p.id||'').toLowerCase().indexOf(_pQ)>-1
        || String(p.metodo||p.cuenta||'').toLowerCase().indexOf(_pQ)>-1
        || String(p.monto||'').indexOf(_pQ)>-1;
  });

  // Cuotas próximas (mismo criterio que dashboard) — créditos activos con cuota próxima o vencida
  var _cuDesde = S.cuotasDesde||'';
  var _cuHasta = S.cuotasHasta||'';
  // Fuente canónica: el ledger de amortización (mismo que el Dashboard). Antes esto
  // (a) EXCLUÍA a los créditos con estado 'mora' y (b) calculaba el vencimiento a mano
  // con c.pagado, por lo que la lista mostraba muchos menos atrasados que el Dashboard.
  var _gracia=(typeof PLAN!=='undefined'&&PLAN.diasGracia!=null)?PLAN.diasGracia:5;
  var proximasCuotas = _concFiltrar(S.creds||[]).filter(function(c){
    return c && !c.eliminado && (c.estado==='activo'||c.estado==='mora') && c.fecha;
  }).map(function(c){
    var mora=0, cuotaNum, venceStr, diff, prox=null;
    if(typeof CreditoLedger!=='undefined' && CreditoLedger.generarEstadoCredito){
      try{
        var est=CreditoLedger.generarEstadoCredito(c, S.pagos, {diasGracia:_gracia});
        mora=est.moraDias||0;
        prox=(est.cuotas&&est.cuotas[est.cuotasPagadas])||null;
      }catch(e){ prox=null; }
    }
    if(prox && prox.fechaVence){
      cuotaNum=prox.numero;
      venceStr=prox.fechaVence;
      var v=parseFechaLocal(venceStr);
      diff=Math.round((v-new Date())/(24*60*60*1000));
    } else {
      var start=parseFechaLocal(c.fecha);
      cuotaNum=(c.pagado||0)+1;
      var vf=new Date(start.getTime()+(cuotaNum*15*24*60*60*1000));
      diff=Math.round((vf-new Date())/(24*60*60*1000));
      venceStr=fechaLocalISO(vf);
      if(!mora) mora=parseInt(c.mora||0,10)||0;
    }
    return { cred:c, cuotaNum:cuotaNum, diff:diff, venceStr:venceStr, mora:mora };
  }).filter(function(it){ return it.diff<=30 || it.mora>0; });
  // Filtro por fecha de vencimiento
  if(_cuDesde) proximasCuotas = proximasCuotas.filter(function(it){ return it.venceStr >= _cuDesde; });
  if(_cuHasta) proximasCuotas = proximasCuotas.filter(function(it){ return it.venceStr <= _cuHasta; });
  // Buscador: cliente, crédito o modelo
  var _cuQ = String(S.cuotasQ||'').toLowerCase().trim();
  if(_cuQ) proximasCuotas = proximasCuotas.filter(function(it){
    var c = it.cred;
    return String(c.cli||'').toLowerCase().indexOf(_cuQ)>-1
        || String(c.id||'').toLowerCase().indexOf(_cuQ)>-1
        || String(c.modelo||'').toLowerCase().indexOf(_cuQ)>-1;
  });
  // Filtro rápido Todos / Atrasados / Al día — con contadores del contexto actual
  var _cuAtras = proximasCuotas.filter(function(it){ return it.diff<0; }).length;
  var _cuAlDia = proximasCuotas.length - _cuAtras;
  // (Los gráficos de "Cobros" y "Próximas cuotas a cobrar" se movieron al módulo
  //  Finanzas para que los empleados/cobradores no vean los montos agregados.)
  var _cuF = S.cuotasFilter||'todos';
  if(_cuF==='atrasados') proximasCuotas = proximasCuotas.filter(function(it){ return it.diff<0; });
  else if(_cuF==='aldia') proximasCuotas = proximasCuotas.filter(function(it){ return it.diff>=0; });
  // Ordenamiento configurable (por defecto: más urgentes/atrasados primero)
  var _cu = S.cuotasSort||{col:'vence',dir:'asc'};
  proximasCuotas = proximasCuotas.slice().sort(function(a,b){
    var col=_cu.col, dir=_cu.dir==='asc'?1:-1;
    if(col==='cli'){return dir*((a.cred.cli||'').toLowerCase().localeCompare((b.cred.cli||'').toLowerCase()));}
    if(col==='id'){var na=parseInt(String(a.cred.id).replace(/\D/g,''),10)||0,nb=parseInt(String(b.cred.id).replace(/\D/g,''),10)||0;return dir*(na<nb?-1:na>nb?1:0);}
    if(col==='cuota'){return dir*((a.cuotaNum||0)-(b.cuotaNum||0));}
    if(col==='estado'){return dir*((a.diff||0)-(b.diff||0));}
    if(col==='monto'){return dir*(parseFloat(a.cred.cuotaQ||a.cred.cuota||0)-parseFloat(b.cred.cuotaQ||b.cred.cuota||0));}
    return dir*((a.diff||0)-(b.diff||0)); // 'vence'
  });

  return`<div class="page">

  ${pageBanner(
    'Cobranza · Cobros y pagos',
    'Cobranza',
    '<b>'+allPagos.length+'</b> pagos registrados · Cobrado total: <b>'+fmt(totalConf)+'</b> · Este mes: <b>'+fmt(totalMes)+'</b>',
    [
      {label:'↓ Exportar CSV', onclick:"exportarCSV('pagos')"},
      {label:'＋ Registrar Pago', onclick:'openAddPago()', primary:true}
    ]
  )}

  <!-- KPI cards -->
  <div class="sg" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:14px">
    <div class="stat">
      <div class="st-ic" style="background:var(--greens);color:var(--green);font-size:9px;font-weight:800">✓</div>
      <div class="st-v" style="color:var(--green);font-size:26px">${fmt(totalConf)}</div>
      <div class="st-l">Cobrado confirmado <span style="opacity:.6;font-size:10px">${confs.length}</span></div>
    </div>
    <div class="stat">
      <div class="st-ic" style="background:var(--ambers);color:var(--amber);font-size:9px;font-weight:800">PND</div>
      <div class="st-v" style="color:var(--amber);font-size:26px">${fmt(totalPend)}</div>
      <div class="st-l">Pendiente por confirmar <span style="opacity:.6;font-size:10px">${pends.length}</span></div>
    </div>
    <div class="stat">
      <div class="st-ic" style="background:var(--gs);color:var(--p1);font-size:9px;font-weight:800">MES</div>
      <div class="st-v" style="color:var(--p1);font-size:26px">${fmt(totalMes)}</div>
      <div class="st-l">Cobrado este mes <span style="opacity:.6;font-size:10px">${pagosMes.length} pagos</span></div>
    </div>
    <div class="stat">
      <div class="st-ic" style="background:var(--gs);color:var(--p1);font-size:9px;font-weight:800">AVG</div>
      <div class="st-v" style="color:var(--p1);font-size:26px">${fmt(promMes)}</div>
      <div class="st-l">Promedio por pago (mes)</div>
    </div>
    <div class="stat">
      <div class="st-ic" style="background:var(--greens);color:var(--green);font-size:9px;font-weight:800">TOP</div>
      <div class="st-v" style="color:var(--green);font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${topMetodo.nombre || '—'}</div>
      <div class="st-l">Método más usado · ${fmt(topMetodo.total)}</div>
    </div>
  </div>

  <!-- Cuotas Próximas -->
  <div class="card" style="margin-bottom:12px">
    <div class="ch" style="margin-bottom:10px">
      <div><div class="ct">Cuotas Próximas</div><div class="cs">Próximos 30 días + todos los atrasados · más urgentes primero</div></div>
      <span class="bdg ${proximasCuotas.length>0?'b-a':'b-g'}">${proximasCuotas.length}</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
      <input type="text" id="cuotasQ" value="${String(S.cuotasQ||'').replace(/</g,'&lt;').replace(/"/g,'&quot;')}" placeholder="Buscar cliente, crédito o modelo..." oninput="liveSearchCuotas(this.value)" style="flex:1;min-width:190px;border:1px solid var(--rim);border-radius:8px;padding:6px 10px;font-size:12px;font-family:var(--f);background:var(--surf);color:var(--ink)">
      <label style="font-size:11px;color:var(--ink3);font-weight:700">Vence desde:</label>
      <input type="date" value="${S.cuotasDesde||''}" onchange="S.cuotasDesde=this.value;pgSet('cuotas',1);nav('pagos')" style="border:1px solid var(--rim);border-radius:8px;padding:5px 8px;font-size:12px;font-family:var(--f);background:var(--surf);color:var(--ink)">
      <label style="font-size:11px;color:var(--ink3);font-weight:700">Hasta:</label>
      <input type="date" value="${S.cuotasHasta||''}" onchange="S.cuotasHasta=this.value;pgSet('cuotas',1);nav('pagos')" style="border:1px solid var(--rim);border-radius:8px;padding:5px 8px;font-size:12px;font-family:var(--f);background:var(--surf);color:var(--ink)">
      ${(S.cuotasDesde||S.cuotasHasta||S.cuotasQ)?`<button class="btn btn-g btn-sm" onclick="S.cuotasDesde='';S.cuotasHasta='';S.cuotasQ='';S.cuotasFilter='todos';pgSet('cuotas',1);nav('pagos')">✕ Limpiar</button>`:''}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      <button class="btn btn-sm ${_cuF==='todos'?'btn-p':'btn-g'}" onclick="setCuotasFilter('todos')">Todos <span style="opacity:.7;font-weight:800">${_cuAtras+_cuAlDia}</span></button>
      <button class="btn btn-sm ${_cuF==='atrasados'?'btn-p':'btn-g'}" onclick="setCuotasFilter('atrasados')">🔴 Atrasados <span style="opacity:.7;font-weight:800">${_cuAtras}</span></button>
      <button class="btn btn-sm ${_cuF==='aldia'?'btn-p':'btn-g'}" onclick="setCuotasFilter('aldia')">🟢 Al día / próximas <span style="opacity:.7;font-weight:800">${_cuAlDia}</span></button>
    </div>
    ${proximasCuotas.length===0 ? '<div style="text-align:center;padding:20px 0;color:var(--ink3);font-size:12px">Sin cuotas próximas ni atrasadas</div>' :
      `<div class="tw"><table>
      <thead><tr>
        ${_thSort(_cu,'setCuotasSort','cli','Cliente')}
        ${_thSort(_cu,'setCuotasSort','id','Crédito')}
        ${_thSort(_cu,'setCuotasSort','cuota','Cuota N°')}
        ${_thSort(_cu,'setCuotasSort','estado','Estado')}
        ${_thSort(_cu,'setCuotasSort','vence','Vence')}
        ${_thSort(_cu,'setCuotasSort','monto','Monto')}
        <th>Notas</th>
        <th>Gestión de cobro</th>
        <th></th>
      </tr></thead>
      <tbody>${(()=>{const _cp=pgGet('cuotas');return proximasCuotas.slice((_cp-1)*50,_cp*50).map(function(item){
        const c=item.cred, diff=item.diff;
        const col = diff<0?'var(--red)':diff<=1?'var(--amber)':'var(--green)';
        const lbl = diff<0?`${Math.abs(diff)}d de atraso`:diff===0?'Vence hoy':diff===1?'Vence mañana':`Vence en ${diff}d`;
        const badge = diff<0?'ATRASO':diff<=1?'URGENTE':'PRÓXIMO';
        const bcls = diff<0?'b-r':diff<=1?'b-a':'b-g';
        const _vd = (item.venceStr||'').split('-');
        const fechaFmt = _vd.length===3 ? new Date(+_vd[0],+_vd[1]-1,+_vd[2]).toLocaleDateString('es-VE',{weekday:'short',day:'numeric',month:'short'}) : '';
        return `<tr>
          <td class="tdm">${c.cli}</td>
          <td class="tds" style="font-family:var(--fd)">${c.id}</td>
          <td class="tds">${item.cuotaNum}/${c.totalCuotas||c.plazo*2||24}</td>
          <td><span class="bdg ${bcls}" style="font-size:9px">${badge}</span></td>
          <td class="tds"><div style="color:${col};font-weight:700">${lbl}</div>${fechaFmt?`<div style="font-size:10px;color:var(--ink3);font-weight:600;margin-top:2px;text-transform:capitalize">${fechaFmt}</div>`:''}</td>
          <td style="font-weight:800;font-family:var(--fd);color:var(--ink)">${fmt(c.cuotaQ||c.cuota)}</td>
          <td>${_cuotaNotaSelect(c)}</td>
          <td>${_gestionCobroCell(c)}</td>
          <td><div style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-p btn-xs" onclick="openAddPago('${c.id}')">Cobrar</button>
            <button class="btn btn-g btn-xs" onclick="avisarCuotaProxima('${c.id}')" title="Enviar recordatorio al cliente por WhatsApp">Avisar</button>
            <button class="btn btn-g btn-xs" onclick="llamarCliente('${c.id}')" title="Llamar al cliente">📞</button>
            ${diff<0?`<button class="btn btn-g btn-xs" onclick="confirmarRecuperacion('${c.id}')" title="Recuperar moto (cliente en mora)" style="color:var(--red);border-color:rgba(232,51,90,.28)">↩ Moto</button>`:''}
          </div></td>
        </tr>`;
      }).join('')})()}
      </tbody>
      </table></div>
      ${pgControls('cuotas',proximasCuotas.length,50,'pgNav')}`
    }
  </div>

  <!-- Filtro por fecha + buscador -->
  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
    <input type="text" id="pagosQ" value="${String(S.pagosQ||'').replace(/</g,'&lt;').replace(/"/g,'&quot;')}" placeholder="Buscar cliente, crédito, cobrador, monto..." oninput="liveSearchPagos(this.value)" style="flex:1;min-width:220px;border:1px solid var(--rim);border-radius:8px;padding:6px 10px;font-size:12px;font-family:var(--f);background:var(--surf);color:var(--ink)">
    <label style="font-size:11px;color:var(--ink3);font-weight:700">Desde:</label>
    <input type="date" value="${S.pagosDesde||''}" onchange="S.pagosDesde=this.value;pgSet('pagos',1);nav('pagos')" style="border:1px solid var(--rim);border-radius:8px;padding:5px 8px;font-size:12px;font-family:var(--f);background:var(--surf);color:var(--ink)">
    <label style="font-size:11px;color:var(--ink3);font-weight:700">Hasta:</label>
    <input type="date" value="${S.pagosHasta||''}" onchange="S.pagosHasta=this.value;pgSet('pagos',1);nav('pagos')" style="border:1px solid var(--rim);border-radius:8px;padding:5px 8px;font-size:12px;font-family:var(--f);background:var(--surf);color:var(--ink)">
    ${(S.pagosDesde||S.pagosHasta||S.pagosQ)?`<button class="btn btn-g btn-sm" onclick="S.pagosDesde='';S.pagosHasta='';S.pagosQ='';pgSet('pagos',1);nav('pagos')">✕ Limpiar</button>`:''}
  </div>

  <!-- Filter tabs -->
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
    ${[
      ['todos','Todos',allPagos.length,'var(--ink2)'],
      ['confirmados','Confirmados',confs.length,'var(--green)'],
      ['pendientes','Pendientes',pends.length,'var(--amber)'],
      ['archivados','Archivados',pagosEliminados.length,'var(--red)'],
    ].map(function(arr){
      var k=arr[0], l=arr[1], n=arr[2], col=arr[3];
      var isActive = tab===k;
      return '<button class="btn btn-sm'+(isActive?' btn-p':' btn-g')+'" onclick="setPagosTab(\''+k+'\')" style="gap:6px'+(isActive?'':';border-left:3px solid '+col)+'">'+l+' <span style="opacity:.75;font-size:10px;font-weight:900">'+n+'</span></button>';
    }).join('')}
  </div>

  <!-- Tabla / Lista -->
  ${tab==='archivados' ? `
  <div class="card">
    <div class="ch">
      <div><div class="ct" style="color:var(--red)">Pagos archivados</div><div class="cs">${pagosEliminados.length} pago${pagosEliminados.length!==1?'s':''} eliminado${pagosEliminados.length!==1?'s':''} · puedes restaurarlos si fueron eliminados por error</div></div>
    </div>
    ${pagosEliminados.length===0?`<div style="text-align:center;padding:40px 20px;color:var(--ink3)">
      <div style="font-size:13px;font-weight:700;color:var(--green)">Sin pagos archivados</div>
      <div style="font-size:11.5px;margin-top:4px">Todos los pagos registrados están activos</div>
    </div>`:`<div class="tw"><table>
    <thead><tr><th>ID</th><th>Cliente</th><th>Crédito</th><th>Fecha pago</th><th>Monto</th><th>Método</th><th>Eliminado por</th><th>Fecha eliminación</th><th>Razón</th><th>Modo</th><th></th></tr></thead>
    <tbody>${pagosEliminados.slice().sort(function(a,b){return (b.eliminadoEn||'').localeCompare(a.eliminadoEn||'');}).map(function(p){
      var fechaElim = p.eliminadoEn ? p.eliminadoEn.split('T')[0] : '—';
      var modoLbl = p.eliminadoModo==='mantener' ? 'Mantiene en amort.' : 'Eliminado completo';
      var modoCls = p.eliminadoModo==='mantener' ? 'b-a' : 'b-r';
      return '<tr style="opacity:.78">'
        +'<td class="tdm" style="font-family:var(--fd);text-decoration:line-through">'+p.id+'</td>'
        +'<td class="tdm" style="text-decoration:line-through">'+(p.cli||'—')+'</td>'
        +'<td class="tds">'+(p.cred||'—')+'</td>'
        +'<td class="tds">'+(p.fecha||'—')+'</td>'
        +'<td style="color:var(--red);font-weight:800;font-family:var(--fd);text-decoration:line-through">'+fmt(p.monto)+'</td>'
        +'<td class="tds">'+(p.metodo||'—')+'</td>'
        +'<td class="tds" style="color:var(--red);font-weight:700">'+(p.eliminadoPor||'Admin')+'</td>'
        +'<td class="tds">'+fechaElim+'</td>'
        +'<td class="tds" style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+(p.eliminadoRazon||'')+'">'+(p.eliminadoRazon||'Sin razón')+'</td>'
        +'<td><span class="bdg '+modoCls+'" style="font-size:9px">'+modoLbl+'</span></td>'
        +'<td><button class="btn btn-p btn-xs" onclick="restaurarPago(\''+p.id+'\')" title="Restaurar este pago">↺ Restaurar</button></td>'
        +'</tr>';
    }).join('')}
    </tbody>
    </table></div>`}
  </div>
  ` : `
  <div class="card">
    <div class="ch">
      <div><div class="ct">Registro de pagos</div><div class="cs">${filtered.length} resultado${filtered.length!==1?'s':''}</div></div>
      ${pagosEliminados.length>0?`<button class="btn btn-g btn-sm" onclick="setPagosTab('archivados')" style="">Ver archivados · ${pagosEliminados.length}</button>`:''}
    </div>
    <div class="tw"><table>
    <thead><tr>
      ${_thSort(_ps,'setPagosSort','id','ID')}
      ${_thSort(_ps,'setPagosSort','cli','Cliente')}
      ${_thSort(_ps,'setPagosSort','cred','Crédito')}
      ${_thSort(_ps,'setPagosSort','fecha','Fecha')}
      ${_thSort(_ps,'setPagosSort','monto','Monto')}
      ${_thSort(_ps,'setPagosSort','metodo','Recibido en')}
      ${_thSort(_ps,'setPagosSort','cobrador','Cobrador')}
      ${_thSort(_ps,'setPagosSort','estado','Estado')}
      <th>Factura</th><th></th>
    </tr></thead>
    <tbody>${(()=>{const _pp=pgGet('pagos');return filtered.slice((_pp-1)*50,_pp*50).map(p=>{
      var fac = (S.facturas||[]).find(function(f){ return f.pagoId === p.id; });
      var facCol = '';
      if(fac){
        if(fac.anulada){
          facCol = '<span class="bdg" style="background:rgba(255,71,87,.2);color:var(--red);font-size:9px;padding:2px 6px;border-radius:4px;font-weight:700">ANULADA</span>';
        } else {
          facCol = '<span class="bdg" style="background:rgba(0,184,118,.18);color:var(--green);font-size:9px;padding:2px 6px;border-radius:4px;font-weight:700;font-family:var(--fd)">'+fac.numero+'</span>';
        }
      } else if(p.estado==='confirmado'){
        facCol = '<span style="color:var(--ink3);font-size:10.5px">— sin factura —</span>';
      } else {
        facCol = '<span style="color:var(--ink3);font-size:10.5px">—</span>';
      }
      return `<tr style="cursor:pointer" onclick="abrirDetallePago('${p.id}')">
      <td class="tdm" style="font-family:var(--fd)">${p.id}</td>
      <td class="tdm">${p.cli}</td>
      <td class="tds">${p.cred}</td>
      <td class="tds">${p.fecha}</td>
      <td style="color:var(--green);font-weight:800;font-family:var(--fd)">${fmt(p.monto)}</td>
      <td class="tds">${p.metodo}</td>
      <td class="tds">${p.cobrador}</td>
      <td><span class="bdg ${sbg(p.estado)}">${p.estado}</span></td>
      <td>${facCol}</td>
      <td onclick="event.stopPropagation()"><div style="display:flex;gap:4px">${p.estado==='pendiente'?`<button class="btn btn-s btn-xs" onclick="confirmarPago('${p.id}')">✓</button>`:''}<button class="btn btn-p btn-xs" onclick="openEditPago('${p.id}')" title="Editar">Editar</button><button class="btn btn-d btn-xs" onclick="confirmarDelPago('${p.id}')" title="Eliminar">Eliminar</button></div></td>
    </tr>`;
    }).join('')})()}
    ${filtered.length===0?`<tr><td colspan="10" style="text-align:center;padding:30px 0;color:var(--ink3);font-size:13px">Sin pagos con este filtro</td></tr>`:''}
    </tbody>
  </table></div>
  </div>
  `}
  </div>`+(tab!=='archivados'?pgControls('pagos',filtered.length,50,'pgNav'):'');
};

// Formato compacto para etiquetas de barras ($1.2M, $55k, $320)
function _fmtK(n){
  n=Math.round(n||0); var s=n<0?'-':''; n=Math.abs(n);
  if(n>=1000000) return s+'$'+(n/1000000).toFixed(n>=10000000?0:1)+'M';
  if(n>=1000) return s+'$'+Math.round(n/1000)+'k';
  return s+'$'+n;
}

// Agrupa [{fecha:'YYYY-MM-DD', monto}] en una serie de barras según el período elegido.
// dir='past' (hacia atrás desde hoy) o 'future' (hacia adelante desde hoy).
function _pgSerie(items, mode, dir){
  items = items || [];
  var out=[]; var today=new Date(); today.setHours(0,0,0,0);
  var iso=function(d){ return (typeof fechaLocalISO==='function')?fechaLocalISO(d):d.toISOString().slice(0,10); };
  var mk=function(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); };
  var MES=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var sum=function(pred){ return items.filter(pred).reduce(function(a,x){return a+(x.monto||0);},0); };
  if(mode==='total'){ out.push({lbl:'Total', tot:items.reduce(function(a,x){return a+(x.monto||0);},0)}); return out; }
  if(mode==='diario'){
    for(var i=0;i<14;i++){ var d=new Date(today); d.setDate(d.getDate()+(dir==='future'?i:-(13-i))); var k=iso(d);
      out.push({lbl:String(d.getDate()), tot:sum(function(x){return x.fecha===k;})}); }
    return out;
  }
  if(mode==='quincenal'){
    for(var i=0;i<8;i++){ var start,end;
      if(dir==='future'){ start=new Date(today); start.setDate(start.getDate()+i*15); end=new Date(start); end.setDate(end.getDate()+14); }
      else { end=new Date(today); end.setDate(end.getDate()-(7-i)*15); start=new Date(end); start.setDate(start.getDate()-14); }
      var ks=iso(start), ke=iso(end);
      out.push({lbl:String(start.getDate()).padStart(2,'0')+'/'+String(start.getMonth()+1).padStart(2,'0'), tot:sum(function(x){return x.fecha>=ks && x.fecha<=ke;})}); }
    return out;
  }
  if(mode==='mensual'){
    for(var i=0;i<12;i++){ var d=new Date(today.getFullYear(), today.getMonth()+(dir==='future'?i:-(11-i)), 1); var k=mk(d);
      out.push({lbl:MES[d.getMonth()], tot:sum(function(x){return String(x.fecha).slice(0,7)===k;})}); }
    return out;
  }
  if(mode==='anual'){
    var years={}; items.forEach(function(x){ var y=String(x.fecha).slice(0,4); years[y]=(years[y]||0)+(x.monto||0); });
    var ykeys=Object.keys(years).sort(); if(!ykeys.length) ykeys=[String(today.getFullYear())];
    ykeys.forEach(function(y){ out.push({lbl:y, tot:years[y]||0}); });
    return out;
  }
  return out;
}

// ─── NOTAS DE COBRANZA (status del cliente en Cuotas Próximas) ───
var NOTA_COBRANZA = [
  {v:'',               t:'— Sin nota',            c:'#64748B', bg:'#F1F5F9'},
  {v:'revision',       t:'En revisión',           c:'#1D4ED8', bg:'#EFF6FF'},
  {v:'promesa',        t:'Promesa de pago',       c:'#A16207', bg:'#FEF9C3'},
  {v:'acuerdo',        t:'Acuerdo de pago',       c:'#7C3AED', bg:'#F3E8FF'},
  {v:'pago_verificar', t:'Pagó — verificar',      c:'#047857', bg:'#D1FAE5'},
  {v:'avisado',        t:'Avisado / recordado',   c:'#0369A1', bg:'#E0F2FE'},
  {v:'no_contesta',    t:'No contesta',           c:'#B45309', bg:'#FFEDD5'},
  {v:'reprogramado',   t:'Reprogramado',          c:'#0F766E', bg:'#CCFBF1'},
  {v:'gestion',        t:'En gestión de cobro',   c:'#BE185D', bg:'#FCE7F3'},
  {v:'ilocalizable',   t:'Ilocalizable',          c:'#991B1B', bg:'#FEE2E2'},
  {v:'problema',       t:'Cliente con problema',  c:'#991B1B', bg:'#FEE2E2'}
];
function _notaCobranzaOpt(v){
  for(var i=0;i<NOTA_COBRANZA.length;i++){ if(NOTA_COBRANZA[i].v===(v||'')) return NOTA_COBRANZA[i]; }
  return NOTA_COBRANZA[0];
}
function _cuotaNotaSelect(c){
  var cur = c.cobranzaStatus || '';
  var sel = _notaCobranzaOpt(cur);
  var opts = NOTA_COBRANZA.map(function(o){
    return '<option value="'+o.v+'"'+(o.v===cur?' selected':'')+'>'+o.t+'</option>';
  }).join('');
  return '<select onchange="setCuotaNota(\''+c.id+'\',this)" '
    + 'style="font-family:var(--f);font-size:10.5px;font-weight:700;border:1.5px solid '+sel.c+'40;'
    + 'background:'+sel.bg+';color:'+sel.c+';border-radius:8px;padding:5px 8px;cursor:pointer;'
    + 'max-width:160px;outline:none;-webkit-appearance:none;appearance:none">'
    + opts + '</select>';
}
window.setCuotaNota = function(credId, selEl){
  var val = selEl.value;
  var opt = _notaCobranzaOpt(val);
  // Recolorear el select en vivo
  selEl.style.background = opt.bg;
  selEl.style.color = opt.c;
  selEl.style.borderColor = opt.c + '40';
  // Actualizar en memoria
  if(S && S.creds){
    for(var i=0;i<S.creds.length;i++){ if(S.creds[i].id===credId){ S.creds[i].cobranzaStatus = val; break; } }
  }
  // Persistir en Firestore
  if(typeof DB!=='undefined' && DB.updateCred){ DB.updateCred(credId, {cobranzaStatus: val}); }
  if(typeof logActividad==='function'){ logActividad('Nota de cobranza', 'pagos', credId, opt.t); }
  if(typeof toast==='function'){ toast('Nota: '+opt.t, 'success'); }
};

// ─── GESTIÓN DE COBRO: resumen compacto por crédito (gestiones en el crédito) ───
function _gestionCobroCell(c){
  var esc = function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  var btn = function(txt){ return '<button class="btn btn-g btn-xs" onclick="openNota(\''+c.id+'\')" title="Ver historial y registrar gestión" style="padding:3px 9px;white-space:nowrap">'+txt+'</button>'; };
  var list = (Array.isArray(c.gestiones) ? c.gestiones.slice() : []).sort(function(a,b){ return String(b.creadoEn||b.fecha||'').localeCompare(String(a.creadoEn||a.fecha||'')); });
  if(!list.length){ return '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:10.5px;color:var(--ink3)">Sin gestiones</span>'+btn('＋ Gestión')+'</div>'; }
  var empNames = Object.keys(list.reduce(function(o,n){ if(n.cobrador) o[n.cobrador]=1; return o; },{}));
  var nLlamadas = list.filter(function(n){ return /llamada/i.test(n.tipo||''); }).length;
  var u = list[0];
  var snippet = esc((u.resultado||'').trim()); if(snippet.length>34) snippet = snippet.slice(0,34)+'…';
  var when = esc(u.fecha||'')+(u.hora?' '+esc(u.hora):'');
  var full = esc((u.tipo?u.tipo+': ':'')+(u.resultado||'')+(u.proximaAccion?'  →  Próxima acción: '+u.proximaAccion:'')+(u.fechaCompromiso?'  ·  Compromiso: '+u.fechaCompromiso:''));
  var chips = empNames.slice(0,3).map(function(nm){
    var ini = nm.split(/\s+/).filter(Boolean).slice(0,2).map(function(w){return w[0];}).join('').toUpperCase()||'?';
    return '<span title="'+esc(nm)+'" style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--gs);color:var(--p1);font-size:8.5px;font-weight:800;border:1.5px solid var(--surf);margin-left:-5px">'+ini+'</span>';
  }).join('');
  if(empNames.length>3) chips += '<span style="font-size:8.5px;color:var(--ink3);margin-left:3px">+'+(empNames.length-3)+'</span>';
  return '<div title="'+full+'" style="min-width:180px;max-width:240px;display:flex;flex-direction:column;gap:3px">'
    +'<div style="display:flex;align-items:center;gap:8px">'
      +'<div style="display:flex;padding-left:5px">'+chips+'</div>'
      +'<span style="font-size:10px;color:var(--ink2);font-weight:700;white-space:nowrap">'+list.length+' gest.'+(nLlamadas?' · '+nLlamadas+' llam.':'')+'</span>'
      +btn('Ver / ＋')
    +'</div>'
    +'<div style="font-size:10px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Últ: "'+snippet+'" · '+when+'</div>'
  +'</div>';
}
