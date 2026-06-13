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

  // Cuotas próximas (mismo criterio que dashboard) — créditos activos con cuota próxima o vencida
  var _cuDesde = S.cuotasDesde||'';
  var _cuHasta = S.cuotasHasta||'';
  var proximasCuotas = _concFiltrar(S.creds||[]).filter(function(c){
    if(c.eliminado) return false;
    if(c.estado!=='activo'||!c.fecha) return false;
    const start=parseFechaLocal(c.fecha);
    const cuotaNum=(c.pagado||0)+1;
    const vence=new Date(start.getTime()+(cuotaNum*15*24*60*60*1000));
    const diff=Math.round((vence-new Date())/(24*60*60*1000));
    return diff<=30 && diff>=-30; // muestra hasta 30 días de atraso y próximas 30 días
  }).map(function(c){
    const start=parseFechaLocal(c.fecha);
    const cuotaNum=(c.pagado||0)+1;
    const vence=new Date(start.getTime()+(cuotaNum*15*24*60*60*1000));
    const diff=Math.round((vence-new Date())/(24*60*60*1000));
    return { cred:c, cuotaNum:cuotaNum, diff:diff, venceStr:fechaLocalISO(vence) };
  });
  // Filtro por fecha de vencimiento
  if(_cuDesde) proximasCuotas = proximasCuotas.filter(function(it){ return it.venceStr >= _cuDesde; });
  if(_cuHasta) proximasCuotas = proximasCuotas.filter(function(it){ return it.venceStr <= _cuHasta; });
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
    'Transacciones · Cobros',
    'Pagos',
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

  <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:12px;margin-bottom:12px">

    <!-- Chart últimos 14 días -->
    <div class="card">
      <div class="ch"><div><div class="ct">Cobros últimos 14 días</div><div class="cs">Pagos confirmados por día</div></div></div>
      <div style="display:flex;align-items:flex-end;gap:4px;height:120px;margin-top:10px">
        ${dias.map(d=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
          <div style="font-size:8.5px;font-weight:700;color:var(--ink3);height:12px">${d.tot>0?fmt(d.tot).replace('$','$').slice(0,6):''}</div>
          <div style="flex:1;width:100%;display:flex;align-items:flex-end">
            <div style="width:100%;background:${d.tot>0?'var(--p1)':'var(--rim)'};border-radius:3px 3px 0 0;height:${d.tot>0?Math.max(6,Math.round(d.tot/maxDia*90)):3}px;transition:height .3s"></div>
          </div>
          <div style="font-size:9px;color:var(--ink3);font-weight:600">${d.lbl}</div>
        </div>`).join('')}
      </div>
    </div>

    <!-- Métodos de pago -->
    <div class="card">
      <div class="ch"><div><div class="ct">Por método / cuenta</div><div class="cs">Cobros confirmados totales</div></div></div>
      ${metodosList.length ? metodosList.slice(0,6).map(function(m){
        var pct = totalConf>0 ? Math.round(m.total/totalConf*100) : 0;
        return `<div style="margin-bottom:9px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
            <span style="font-weight:700">${m.nombre}</span>
            <span style="color:var(--ink3)">${fmt(m.total)} <span style="opacity:.6;font-size:10px">${pct}%</span></span>
          </div>
          <div style="height:6px;background:var(--rim);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:var(--p1);border-radius:3px"></div>
          </div>
        </div>`;
      }).join('') : '<div style="color:var(--ink3);font-size:12px;text-align:center;padding:20px 0">Sin pagos registrados aún</div>'}
    </div>
  </div>

  <!-- Cuotas Próximas -->
  <div class="card" style="margin-bottom:12px">
    <div class="ch" style="margin-bottom:10px">
      <div><div class="ct">Cuotas Próximas</div><div class="cs">Clientes a cobrar en los próximos 30 días · atrasados primero</div></div>
      <span class="bdg ${proximasCuotas.length>0?'b-a':'b-g'}">${proximasCuotas.length}</span>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
      <label style="font-size:11px;color:var(--ink3);font-weight:700">Vence desde:</label>
      <input type="date" value="${S.cuotasDesde||''}" onchange="S.cuotasDesde=this.value;pgSet('cuotas',1);nav('pagos')" style="border:1px solid var(--rim);border-radius:8px;padding:5px 8px;font-size:12px;font-family:var(--f);background:var(--surf);color:var(--ink)">
      <label style="font-size:11px;color:var(--ink3);font-weight:700">Hasta:</label>
      <input type="date" value="${S.cuotasHasta||''}" onchange="S.cuotasHasta=this.value;pgSet('cuotas',1);nav('pagos')" style="border:1px solid var(--rim);border-radius:8px;padding:5px 8px;font-size:12px;font-family:var(--f);background:var(--surf);color:var(--ink)">
      ${(S.cuotasDesde||S.cuotasHasta)?`<button class="btn btn-g btn-sm" onclick="S.cuotasDesde='';S.cuotasHasta='';pgSet('cuotas',1);nav('pagos')">✕ Limpiar</button>`:''}
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
          <td><div style="display:flex;gap:4px">
            <button class="btn btn-p btn-xs" onclick="openAddPago('${c.id}')">Cobrar</button>
            <button class="btn btn-g btn-xs" onclick="avisarCuotaProxima('${c.id}')" title="Enviar recordatorio al cliente por WhatsApp">Avisar</button>
          </div></td>
        </tr>`;
      }).join('')})()}
      </tbody>
      </table></div>
      ${pgControls('cuotas',proximasCuotas.length,50,'pgNav')}`
    }
  </div>

  <!-- Filtro por fecha -->
  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
    <label style="font-size:11px;color:var(--ink3);font-weight:700">Desde:</label>
    <input type="date" value="${S.pagosDesde||''}" onchange="S.pagosDesde=this.value;pgSet('pagos',1);nav('pagos')" style="border:1px solid var(--rim);border-radius:8px;padding:5px 8px;font-size:12px;font-family:var(--f);background:var(--surf);color:var(--ink)">
    <label style="font-size:11px;color:var(--ink3);font-weight:700">Hasta:</label>
    <input type="date" value="${S.pagosHasta||''}" onchange="S.pagosHasta=this.value;pgSet('pagos',1);nav('pagos')" style="border:1px solid var(--rim);border-radius:8px;padding:5px 8px;font-size:12px;font-family:var(--f);background:var(--surf);color:var(--ink)">
    ${(S.pagosDesde||S.pagosHasta)?`<button class="btn btn-g btn-sm" onclick="S.pagosDesde='';S.pagosHasta='';nav('pagos')">✕ Limpiar</button>`:''}
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

// ─── GESTIÓN DE COBRO: resumen por crédito (gestiones guardadas en el crédito) ───
function _gestionCobroCell(c){
  var esc = function(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  var addBtn = function(txt){ return '<button class="btn btn-g btn-xs" onclick="openNota(\''+c.id+'\')" title="Registrar llamada / gestión de cobro" style="margin-top:6px;white-space:nowrap">'+txt+'</button>'; };
  var list = (Array.isArray(c.gestiones) ? c.gestiones.slice() : []).sort(function(a,b){ return String(b.fecha||'').localeCompare(String(a.fecha||'')); });
  if(!list.length){ return '<div style="font-size:10.5px;color:var(--ink3)">Sin gestiones aún</div>'+addBtn('＋ Gestión'); }
  var empleados = {}; list.forEach(function(n){ if(n.cobrador) empleados[n.cobrador]=(empleados[n.cobrador]||0)+1; });
  var empNames = Object.keys(empleados);
  var nContactos = list.length;
  var nLlamadas = list.filter(function(n){ return /llamada/i.test(n.tipo||''); }).length;
  var u = list[0];
  var ultTxt = esc((u.resultado||'').trim()); if(ultTxt.length>96) ultTxt = ultTxt.slice(0,96)+'…';
  var empChips = empNames.slice(0,3).map(function(nm){
    var ini = nm.split(/\s+/).filter(Boolean).slice(0,2).map(function(w){return w[0];}).join('').toUpperCase()||'?';
    return '<span title="'+esc(nm)+'" style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:var(--gs);color:var(--p1);font-size:9px;font-weight:800;border:1.5px solid var(--surf);margin-left:-5px">'+ini+'</span>';
  }).join('');
  if(empNames.length>3) empChips += '<span style="font-size:9px;color:var(--ink3);margin-left:4px">+'+(empNames.length-3)+'</span>';
  return '<div style="min-width:210px;max-width:300px">'
    +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
      +'<div style="display:flex;padding-left:5px">'+empChips+'</div>'
      +'<span style="font-size:10px;color:var(--ink3);font-weight:700">'+nContactos+' contacto'+(nContactos!==1?'s':'')+(nLlamadas?' · '+nLlamadas+' llam.':'')+'</span>'
    +'</div>'
    +'<div style="font-size:10.5px;color:var(--ink2);line-height:1.45"><span style="color:var(--p1);font-weight:700">'+esc(u.tipo||'Gestión')+':</span> "'+ultTxt+'" <span style="color:var(--ink3)">· '+esc(u.fecha||'')+(u.cobrador?' · '+esc(u.cobrador):'')+'</span></div>'
    +(u.proximaAccion?'<div style="font-size:10px;color:var(--amber);font-weight:700;margin-top:2px">→ '+esc(u.proximaAccion)+'</div>':'')
    +(u.fechaCompromiso?'<div style="font-size:10px;color:var(--green);font-weight:700;margin-top:1px">Compromiso: '+esc(u.fechaCompromiso)+'</div>':'')
    +addBtn('Ver / ＋ gestión')
  +'</div>';
}
