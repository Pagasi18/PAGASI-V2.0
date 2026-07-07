// Logica de pagos, cobranza, mora y liquidaciones. Extraido mecanicamente de assets/pagasi-app.js.
function restaurarPago(id){
  if(!requireDeletePermission()) return;
  var p=S.pagos.find(function(x){return x.id===id;});
  if(!p||!p.eliminado){toast('Pago no encontrado o no está archivado','error');return;}
  if(!confirm('¿Restaurar el pago '+p.id+' ('+p.cli+' · '+fmt(p.monto)+')?')) return;
  var modoPrevio = p.eliminadoModo || 'completo';
  // Limpiar flags de eliminación
  delete p.eliminado;
  delete p.eliminadoPor;
  delete p.eliminadoPorUid;
  delete p.eliminadoEn;
  delete p.eliminadoRazon;
  delete p.eliminadoModo;
  p.mantenerEnAmortizacion = false;
  DB.savePago(p);
  // Si la eliminación era completa, recalcular crédito y restaurar el movimiento asociado
  if(modoPrevio==='completo'){
    // Restaurar movimiento asociado si existe
    var mi=S.movimientos.findIndex(function(m){
      return m.eliminado && (m.conceptoPago===p.id || (m.concepto&&m.concepto.includes(p.cred)&&m.monto===p.monto&&m.fecha===p.fecha));
    });
    if(mi>=0){
      delete S.movimientos[mi].eliminado;
      delete S.movimientos[mi].eliminadoPor;
      delete S.movimientos[mi].eliminadoEn;
      DB.saveMovimiento(S.movimientos[mi]);
    }
    // Recalcular crédito desde pagos
    if(typeof recalcularCreditoDesdePagos==='function') recalcularCreditoDesdePagos(p.cred);
  }
  nav('pagos');
  toast('Pago '+p.id+' restaurado','success');
}
window.restaurarPago=restaurarPago;

// ══════════════════════════════════════════════════════════════
// NUEVA SOLICITUD — Wizard estilo Indexa integrado en Pagasi
// 4 pasos: cliente → moto → perfil crediticio → resultado
// ══════════════════════════════════════════════════════════════

// ── Estado del wizard ──
// Logica de creditos y wizard de solicitudes movida a logic/creditos.js.

function openAddPago(preCredId){
  setMicon('pago');$('mtt').textContent='Registrar Pago';$('msb').textContent='Plan '+PLAN.plazo+' meses';
  $('modal-box').className='modal';
  $('mbd').innerHTML=`
    <div class="fgr c1" style="gap:9px"><div class="fg"><label>Crédito</label><select class="fs" id="p_cred" onchange="updPagoMonto(this)">${S.creds.filter(c=>c.estado==='activo'||c.estado==='mora').map(c=>`<option value="${c.id}" data-cuota="${c.cuota}" data-cuotaq="${c.cuotaQ}" ${preCredId&&String(c.id)===String(preCredId)?'selected':''}>${c.id} — ${c.cli} (${c.modelo})</option>`).join('')}</select></div></div>
    <div class="fgr" style="margin-top:9px">
      <div class="fg"><label>Frecuencia</label><input class="fi" value="Quincenal (cada 15 días)" readonly style="color:var(--p1);font-weight:700;background:var(--surf)"></div>
      <div class="fg"><label>Fecha de pago</label><input class="fi" id="p_fecha" type="date" value="${hoyLocalISO()}"></div>
      <div class="fg"><label>Monto ($)</label><input class="fi" id="p_monto" type="number" placeholder="0.00"></div>
<div class="fg"><label>Recibido en</label><select class="fs" id="p_forma">${(_cuentasBanc&&_cuentasBanc.length?_cuentasBanc:[]).map(c=>`<option value="${c.nombre}">${c.nombre}</option>`).join('')}${(!_cuentasBanc||!_cuentasBanc.length)?'<option value="">— Sin cuentas configuradas —</option>':''}</select></div>
      <div class="fg"><label>N° Referencia</label><input class="fi" id="p_ref" placeholder="Número de referencia o comprobante"></div>
      <div class="fg"><label>Cobrador</label><select class="fs" id="p_cobrador">${getCobradoresList().map(u=>`<option>${u}</option>`).join('')}</select></div>
    </div>`;
  setTimeout(()=>updPagoMonto($('p_cred')),50);
  // Insertar aviso de saldo a favor
  setTimeout(function(){
    var mbd=$('mbd');
    if(mbd&&!$('p_saldo_favor')){
      var div=document.createElement('div');
      div.id='p_saldo_favor';
      div.style.cssText='display:none;margin-top:8px;padding:9px 12px;background:rgba(0,184,118,0.12);border:1px solid rgba(0,184,118,0.3);border-radius:8px;font-size:12.5px;color:var(--green)';
      mbd.insertBefore(div,mbd.firstChild);
    }
  },60);
  S.saveFn=()=>{
    const credId=($('p_cred')&&$('p_cred').value);
    const cred=S.creds.find(function(x){return x.id===credId;});
    if(!cred){toast('Selecciona un crédito','error');return false;}
    const monto=parseFloat(($('p_monto')&&$('p_monto').value))||0;
    if(monto<=0){toast('Ingresa un monto válido','error');return false;}
    const newPago={
      id:'PAG-'+Date.now(),
      cli:cred.cli,cred:credId,
      fecha:($('p_fecha')&&$('p_fecha').value)||hoyLocalISO(),
      monto:monto,
      metodo:($('p_forma')&&$('p_forma').value)||'Efectivo USD',
      cuenta:($('p_forma')&&$('p_forma').value)||'—',
      cobrador:($('p_cobrador')&&$('p_cobrador').value)||'Admin',
      referencia:($('p_ref')&&$('p_ref').value)||'',
      estado:'confirmado',
      realizadoPor:(S.currentUser&&S.currentUser.nombre)||'Admin',
      tasaBs:window._tasaBsGlobal||1,
      concesionarioId: cred.concesionarioId || _concDefaultId()
    };
    S.pagos.push(newPago);
    DB.savePago(newPago);
    if(typeof logActividad==='function') logActividad('pago_registrado','pagos',newPago.id,{cliente:cred.cli, credito:credId, monto:monto, metodo:newPago.metodo});
    // Crear movimiento en Cuentas — usar nombre exacto de la cuenta seleccionada
    var pagoMetodo=($('p_forma')&&$('p_forma').value)||'';
    // Si no hay cuenta seleccionada pero hay cuentas configuradas, usar la primera
    if(!pagoMetodo && _cuentasBanc && _cuentasBanc.length>0) pagoMetodo=_cuentasBanc[0].nombre;
    if(pagoMetodo){
      var mov={
        id:'MOV-'+Date.now(),
        tipo:'deposito',
        concepto:'Pago cuota · '+cred.cli+' · '+credId,
        conceptoPago:newPago.id, // link al pago para evitar movimientos duplicados
        monto:monto,
        cuentaOrigen:null,
        cuentaDestino:pagoMetodo,
        fecha:newPago.fecha,
        referencia:newPago.referencia||'',
        realizadoPor:newPago.realizadoPor||'Admin',
        tasaBs:window._tasaBsGlobal||1,
        hora:new Date().toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit',hour12:false})
      };
      S.movimientos.push(mov);
      DB.saveMovimiento(mov);
    }

    // ── Lógica de cuotas con sobrante ──────────────────────────
    const ci=S.creds.findIndex(function(x){return x.id===credId;});
    if(ci>=0){
      var c2=S.creds[ci];
      var cuotaVal=parseFloat(c2.cuotaQ||c2.cuota||0);
      var totalCuotas=c2.totalCuotas||c2.plazo*2;

      // Leer historial desde memoria (ya actualizado por pagos anteriores en esta sesión)
      var historial=Array.isArray(c2.pagosRegistrados)
        ? JSON.parse(JSON.stringify(c2.pagosRegistrados))
        : [];

      // Reconstruir saldo por cuota desde el historial completo
      var saldoPorCuota=[];
      for(var qi=0;qi<totalCuotas;qi++) saldoPorCuota[qi]=cuotaVal;
      historial.forEach(function(h){
        var idx=h.cuota-1;
        if(idx>=0&&idx<totalCuotas)
          saldoPorCuota[idx]=Math.max(0,parseFloat((saldoPorCuota[idx]-h.montoPagado).toFixed(2)));
      });

      // Aplicar el nuevo monto secuencialmente cuota por cuota
      var montoRestante=monto;
      var fechaPago=newPago.fecha;
      var cuotasAfectadas=[];
      for(var qi=0;qi<totalCuotas&&montoRestante>0.001;qi++){
        if(saldoPorCuota[qi]>0.001){
          var aplicar=Math.min(montoRestante,saldoPorCuota[qi]);
          aplicar=parseFloat(aplicar.toFixed(2));
          historial.push({cuota:qi+1,montoPagado:aplicar,fecha:fechaPago,pagoId:newPago.id});
          saldoPorCuota[qi]=parseFloat((saldoPorCuota[qi]-aplicar).toFixed(2));
          montoRestante=parseFloat((montoRestante-aplicar).toFixed(2));
          cuotasAfectadas.push(qi+1);
        }
      }

      // Recalcular cuántas cuotas están 100% pagadas
      var cuotasPagadas=0;
      for(var qi=0;qi<totalCuotas;qi++){
        if(saldoPorCuota[qi]<=0.001) cuotasPagadas++;
        else break;
      }

      var proxCuotaIdx=cuotasPagadas;
      var saldoProxCuota=proxCuotaIdx<totalCuotas ? saldoPorCuota[proxCuotaIdx] : 0;

      // Actualizar en memoria PRIMERO para que el próximo pago lea datos correctos
      S.creds[ci].pagado=cuotasPagadas;
      S.creds[ci].pagosRegistrados=historial;
      S.creds[ci].saldoProxCuota=saldoProxCuota;
      if(S.creds[ci].mora>0){S.creds[ci].mora=0;S.creds[ci].estado='activo';}

      var recienCompletado = S.creds[ci].estado!=='completado' && cuotasPagadas>=totalCuotas;
      if(cuotasPagadas>=totalCuotas && S.creds[ci].estado!=='completado'){
        recienCompletado = true;
        S.creds[ci].estado='completado';
        S.creds[ci].fechaCompletado=hoyLocalISO();

        // ── Punto 2: Cambiar estado de la moto a 'propia' ──
        var mIdx=S.motos.findIndex(function(m){return String(m.id)===String(S.creds[ci].motoId);});
        if(mIdx>=0){
          S.motos[mIdx].estado='propia';
          S.motos[mIdx].propietario=S.creds[ci].cli;
          DB.saveMoto(S.motos[mIdx]);
        }

        // ── Punto 5: Marcar cliente como premium si pagó sin mora ──
        var cliIdx=S.clientes.findIndex(function(cl){return cl.nombre===S.creds[ci].cli;});
        if(cliIdx>=0){
          var tuvomora=(S.creds[ci].tuvoMoraHistorica===true)||S.pagos.some(function(p){return p.cred===credId&&p.mora>0;});
          if(!tuvomora && !(S.creds[ci].mora>0)){
            S.clientes[cliIdx].premium=true;
            S.clientes[cliIdx].premioPor=credId;
            DB.saveCliente(S.clientes[cliIdx]);
          }
          // Incrementar contador de créditos completados
          S.clientes[cliIdx].creditosCompletados=(S.clientes[cliIdx].creditosCompletados||0)+1;
          S.clientes[cliIdx].estado='solvente';
          DB.saveCliente(S.clientes[cliIdx]);
        }
        syncEstadoClientePorCredito(credId);
        syncTodosEstadosClientes();
      } else if(cuotasPagadas<totalCuotas){
        recienCompletado=false;
      }

      // Luego persistir en Firestore
      DB.updateCred(credId,{
        pagado:S.creds[ci].pagado,
        mora:S.creds[ci].mora,
        estado:S.creds[ci].estado,
        pagosRegistrados:historial,
        saldoProxCuota:saldoProxCuota
      });
      recalcularCreditoDesdePagos(credId);
      calcularMoraAuto();
      c2=S.creds[ci];
      cuotaVal=parseFloat(c2.cuotaQ||c2.cuota||0);
      saldoProxCuota=parseFloat(c2.saldoProxCuota||0)||0;
      cuotasPagadas=parseInt(c2.pagado||0,10)||0;
      recienCompletado = c2.estado==='completado' && !!c2.fechaCompletado;

      var msg='✓ Pago de '+fmt(monto)+' registrado';
      if(cuotasAfectadas.length>1) msg+=' · Cuotas '+cuotasAfectadas[0]+' a '+cuotasAfectadas[cuotasAfectadas.length-1]+' cubiertas';
      if(saldoProxCuota>0&&saldoProxCuota<cuotaVal) msg+=' · Próxima cuota: solo '+fmt(saldoProxCuota)+' pendiente';
      pgSet('pagos',1);
      toast(msg,'success');

      // ── Punto 1: Mostrar finiquito si se acaba de completar ──
      syncEstadoClientePorCredito(credId);
      if(recienCompletado){
        setTimeout(function(){ abrirFiniquito(credId); }, 600);
      }
    } else {
      pgSet('pagos',1);
      toast('✓ Pago registrado · '+fmt(monto),'success');
      // Ofrecer recibo
      setTimeout(function(){ ofrecerRecibo(newPago, cred); }, 400);
    }
    closeM();nav('pagos');return true;
  };
  $('mft').innerHTML=`<button class="btn btn-g" onclick="closeM()">Cancelar</button><button class="btn btn-p" onclick="saveM()">Registrar Pago</button>`;
  $('ov').style.display='flex';
}

var _cuentas = ['Bancamiga Cta. 0172-xxxx','Banesco Cta. 0134-xxxx','Zelle: pagasi@email.com'];


function updPagoMonto(sel){
  const opt=(sel&&sel.options)&&sel.options[sel.selectedIndex];if(!opt)return;
  const cuotaBase=parseFloat(opt.dataset.cuotaq||opt.dataset.cuota)||0;
  var credId=sel&&sel.value;
  var cred=credId&&S.creds.find(function(x){return x.id===credId;});
  // Si tiene saldo pendiente parcial en la próxima cuota, mostrar ese monto
  var montoPendiente=cuotaBase;
  if(cred&&cred.saldoProxCuota>0&&cred.saldoProxCuota<cuotaBase){
    montoPendiente=cred.saldoProxCuota;
  }
  if($('p_monto')) $('p_monto').value=montoPendiente.toFixed(2);
  // Aviso si tiene cuota parcialmente pagada
  var saldoEl=$('p_saldo_favor');
  if(saldoEl){
    if(cred&&cred.saldoProxCuota>0&&cred.saldoProxCuota<cuotaBase){
      var yaAbono=parseFloat((cuotaBase-cred.saldoProxCuota).toFixed(2));
      saldoEl.style.display='block';
      saldoEl.innerHTML='$ Cuota parcialmente pagada: ya abonó <strong>'+fmt(yaAbono)+'</strong> — solo faltan <strong>'+fmt(cred.saldoProxCuota)+'</strong> para completarla.';
    } else {
      saldoEl.style.display='none';
    }
  }
}

// AMORTIZACIÓN
function openAmort(id){
  const c=S.creds.find(x=>x.id===id);if(!c)return;
  window._currentAmortCredId = id; // para que descargarAmortPDF sepa qué crédito exportar
  const tasaMensualAmort = parseFloat((c&&((c.plan&&c.plan.tasaMensual)||c.tasaMensual))||PLAN.tasaMensual)||0;
  const tQ=tasaMensualAmort/100/2;
  const cuota=parseFloat(c.cuotaQ||c.cuota||0);
  const n=c.totalCuotas||(c.plazo*2);
  const pagado=Math.max(0, Math.min(getCreditoCuotasPagadas(c), n));
  const startDate=new Date((c.fecha||hoyLocalISO())+'T12:00:00');
  const historial=c.pagosRegistrados||[];
  const saldoProxCuota=(c.saldoProxCuota||0)<0.10?0:(c.saldoProxCuota||0);
  const infoLiquidacion=(c.tipoCierre==='liquidacion_anticipada') ? ('<div class="note" style="margin:8px 0 12px 0"><strong>Liquidación anticipada:</strong> saldo '+fmt(c.saldoOriginalLiquidacion||0)+' · descuento '+fmt(c.descuentoLiquidacion||0)+' · pago final '+fmt(c.montoLiquidado||0)+'</div>') : '';

  // Construir mapa cuota→pagos realizados
  var pagosPorCuota={};
  historial.forEach(function(h){
    if(!pagosPorCuota[h.cuota]) pagosPorCuota[h.cuota]=[];
    pagosPorCuota[h.cuota].push(h);
  });

  // Calcular saldo pendiente por cuota — aplicando excedentes a cuotas siguientes
  var saldoPorCuota=[];
  for(var qi=0;qi<n;qi++) saldoPorCuota[qi]=cuota;
  // Aplicar cada pago secuencialmente distribuido entre cuotas
  // y registrar en pagosPorCuota los abonos reales por cuota
  historial.forEach(function(h){
    var montoRestante=parseFloat(h.montoPagado)||0;
    var inicio=(h.cuota-1);
    for(var qi=inicio;qi<n&&montoRestante>0.001;qi++){
      var aplicar=Math.min(montoRestante,saldoPorCuota[qi]);
      aplicar=parseFloat(aplicar.toFixed(2));
      if(aplicar>0.001){
        saldoPorCuota[qi]=parseFloat((saldoPorCuota[qi]-aplicar).toFixed(2));
        montoRestante=parseFloat((montoRestante-aplicar).toFixed(2));
        // Registrar abono en pagosPorCuota para mostrarlo en la tabla
        var cuotaNum=qi+1;
        if(!pagosPorCuota[cuotaNum]) pagosPorCuota[cuotaNum]=[];
        // Solo agregar si no está ya registrado para esta cuota+pagoId
        var yaExiste=pagosPorCuota[cuotaNum].some(function(x){return x.pagoId===h.pagoId&&x.cuota===cuotaNum;});
        if(!yaExiste) pagosPorCuota[cuotaNum].push({cuota:cuotaNum,montoPagado:aplicar,fecha:h.fecha,pagoId:h.pagoId,tipo:h.tipo||'pago'});
      }
    }
  });
  // Redondear pequeños residuos
  for(var qi=0;qi<n;qi++) saldoPorCuota[qi]=saldoPorCuota[qi]<0.10?0:saldoPorCuota[qi];

  let sal=c.fin,rows='';
  const cols='.3fr 1fr .9fr 1fr 1fr .8fr .8fr .8fr';
  for(let i=1;i<=n;i++){
    const int=sal*tQ,cap=cuota-int;sal-=cap;
    const pd=saldoPorCuota[i-1]<=0.001;
    const parcial=!pd&&saldoPorCuota[i-1]<cuota-0.001;
    const esProx=!pd&&!parcial&&i===pagado+1;
    const fd=new Date(startDate.getTime()+(i*15*24*60*60*1000));
    const fechaStr=fd.toLocaleDateString('es-VE',{day:'2-digit',month:'2-digit',year:'numeric'});
    const fechaColor=pd?'#aaa':esProx?'var(--p1)':'var(--ink2)';

    // Pagos reales en esta cuota
    var histCuota=pagosPorCuota[i]||[];
    var pagoDetalle='';
    if(histCuota.length>0){
      pagoDetalle=histCuota.map(function(h){
        return '<div style="font-size:9px;color:'+(h.tipo==='descuento_liquidacion'?'var(--amber)':'var(--green)')+';font-weight:700">+'+fmt(h.montoPagado)+' · '+h.fecha+(h.tipo==='descuento_liquidacion'?' · desc.':'')+'</div>';
      }).join('');
    }

    // Monto pendiente real de esta cuota
    var montoPendienteReal=saldoPorCuota[i-1];
    var cuotaDisplay=pd
      ? '<span class="bdg b-g" style="font-size:9px">✓ Pagada</span>'
      : parcial
        ? '<span class="bdg b-a" style="font-size:9px">Parcial</span>'
        : esProx
          ? '<span class="bdg b-p" style="font-size:9px">Próxima</span>'
          : '<span class="bdg b-x" style="font-size:9px">Pendiente</span>';

    rows+=`<div class="ar ${pd?'pd':''}" style="grid-template-columns:${cols};${parcial?'background:rgba(245,166,35,0.07)':''}">
      <div style="font-weight:800;color:var(--ink3);font-size:11px">${i}</div>
      <div style="font-size:10px;font-weight:700;color:${fechaColor}">${fechaStr}</div>
      <div>${cuotaDisplay}</div>
      <div style="font-size:10px">${pagoDetalle||'—'}</div>
      <div style="font-weight:${pd||parcial?'700':'800'};color:${pd?'var(--ink3)':parcial?'var(--amber)':'var(--p1)'};font-size:${pd?'10':'12'}px">${pd?fmt(cuota):parcial?fmt(montoPendienteReal)+' pend.':fmt(cuota)}</div>
      <div style="color:var(--amber);font-size:10px">${fmt(Math.max(0,int))}</div>
      <div style="font-size:10px">${fmt(Math.max(0,cap))}</div>
      <div style="color:var(--ink3);font-size:10px">${fmt(Math.max(0,sal))}</div>
    </div>`;
  }

  // Próxima fecha y monto
  var proxIdx=pagado; // base 0
  const proxFd=new Date(startDate.getTime()+((proxIdx+1)*15*24*60*60*1000));
  const proxFecha=proxFd.toLocaleDateString('es-VE',{day:'2-digit',month:'long',year:'numeric'});
  var proxMonto=saldoProxCuota>0&&saldoProxCuota<cuota ? saldoProxCuota : cuota;

  // ─────────────── DATOS ADICIONALES DEL CRÉDITO ───────────────
  var cliente = S.clientes.find(function(x){return x.nombre===c.cli || (c.cliId && String(x.id)===String(c.cliId));}) || {};
  var totalCredito = parseFloat(c.total||0);
  var precioBase = parseFloat(c.precioBaseReal||c.precio||0);
  var inicial = parseFloat(c.ini||0);
  var spreadCredito = Math.max(0, totalCredito - precioBase);
  var cobradoReal = getCreditoPagosConfirmados(c);
  // Inicial REALMENTE pagada = suma de pagos iniciales confirmados (no el plan c.ini),
  // para que el KPI no oculte un descuadre entre lo pactado y lo recibido.
  var inicialPagada = (S.pagos||[]).filter(function(p){ return p && !p.eliminado && p.cred===c.id && p.estado==='confirmado' && (p.esInicial||p.tipoOperacion==='inicial_credito'||(p.concepto&&String(p.concepto).indexOf('Inicial · ')===0)); }).reduce(function(s,p){ return s+(parseFloat(p.monto)||0); },0);
  var inicialDiff = Math.round((inicial - inicialPagada)*100)/100;
  var saldoPendiente = getCreditoSaldoPendiente(c);
  var pctAvance = totalCredito>0 ? Math.round((cobradoReal/totalCredito)*100) : 0;
  var pctCuotas = n>0 ? Math.round((pagado/n)*100) : 0;

  // Fecha fin del contrato
  var fechaFin = new Date(startDate.getTime()+(n*15*24*60*60*1000));
  var fechaFinStr = fechaFin.toLocaleDateString('es-VE',{day:'2-digit',month:'long',year:'numeric'});
  var diasTranscurridos = Math.floor((new Date()-startDate)/(1000*60*60*24));
  var diasRestantes = Math.max(0, Math.floor((fechaFin-new Date())/(1000*60*60*24)));
  var duracionTotalDias = Math.floor((fechaFin-startDate)/(1000*60*60*24));

  // Estado del crédito con color
  var estadoCred = (c.estado||'activo');
  var estadoColor = estadoCred==='activo' ? (c.mora>0?'var(--red)':'var(--p1)') :
                    estadoCred==='completado' ? 'var(--green)' :
                    estadoCred==='cancelado' ? 'var(--ink3)' :
                    estadoCred==='recuperado'||estadoCred==='recuperada' ? 'var(--red)' : 'var(--ink3)';
  var estadoLbl = c.mora>0 && estadoCred==='activo' ? 'En mora · '+c.mora+'d' : estadoCred.charAt(0).toUpperCase()+estadoCred.slice(1);

  // Score cliente
  var scRaw = cliente.score_indexa;
  var scoreCli = 0;
  if(scRaw && typeof scRaw==='object') scoreCli = parseFloat(scRaw.total||0);
  else scoreCli = parseFloat(scRaw)||0;
  if(isNaN(scoreCli) || scoreCli<300 || scoreCli>850) scoreCli = 0;
  var scoreColor = scoreCli>=625?'var(--green)':scoreCli>=450?'var(--amber)':scoreCli>0?'var(--red)':'var(--ink3)';

  // Plazo en meses
  var plazoMeses = c.plazo || Math.ceil(n/2);

  // APY del crédito — misma lógica que el listado de créditos
  var apyCred = Number.isFinite(parseFloat(c.apy)) ? parseFloat(c.apy) : (Number.isFinite(parseFloat((c.plan||{}).apy)) ? parseFloat((c.plan||{}).apy) : parseFloat(PLAN.apy||0));

  // Cuota mensual (para display)
  var cuotaMensual = parseFloat(c.cuotaM||c.cuotaMensual||cuota*2);

  setMicon('detalle');$('mtt').textContent='Detalle del Crédito';$('msb').textContent=`${c.id} — ${c.cli}`;
  $('modal-box').className='modal modal-lg';
  $('mbd').innerHTML=`
    <!-- ═══════ HEADER: Cliente + Estado ═══════ -->
    <div style="background:linear-gradient(135deg,#2563EB 0%,#60A5FA 55%,#9788ff 100%);border-radius:12px;padding:16px 18px;margin-bottom:14px;color:#fff;position:relative;overflow:hidden">
      <div style="position:absolute;top:-30px;right:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,.08)"></div>
      <div style="position:relative;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:15px;letter-spacing:-.5px">${String(c.cli||'Cliente').split(' ').map(function(w){return w.charAt(0);}).join('').substring(0,2).toUpperCase()}</div>
          <div>
            <div style="font-size:10px;font-weight:800;opacity:.85;letter-spacing:1.2px;text-transform:uppercase">${c.id} · Crédito</div>
            <div style="font-size:19px;font-weight:900;letter-spacing:-.4px;line-height:1.1;margin-top:2px">${c.cli}</div>
            <div style="font-size:11.5px;opacity:.85;margin-top:3px">${c.modelo}${c.vin?' · VIN '+c.vin:''}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="background:rgba(255,255,255,.2);padding:5px 12px;border-radius:20px;display:inline-block;font-size:11px;font-weight:800;letter-spacing:.3px;border:1px solid rgba(255,255,255,.3)">${estadoLbl.toUpperCase()}</div>
          <div style="font-size:26px;font-weight:900;margin-top:6px;letter-spacing:-.5px;line-height:1">${fmt(saldoPendiente)}</div>
          <div style="font-size:10.5px;opacity:.85;margin-top:1px">Saldo pendiente</div>
        </div>
      </div>
    </div>

    <!-- ═══════ PROGRESO VISUAL ═══════ -->
    <div style="background:var(--surf);border:1px solid var(--rim);border-radius:12px;padding:14px 16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <div style="font-size:11px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px">Progreso del crédito</div>
          <div style="font-size:13px;font-weight:700;margin-top:2px">Cuota ${pagado} de ${n} completadas</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:22px;font-weight:900;color:var(--p1);letter-spacing:-.5px;line-height:1">${pctCuotas}%</div>
          <div style="font-size:10px;color:var(--ink3);margin-top:2px">pagado</div>
        </div>
      </div>
      <div style="height:10px;background:var(--surf2);border-radius:6px;overflow:hidden;position:relative">
        <div style="position:absolute;inset:0;width:${pctCuotas}%;background:linear-gradient(90deg,#2563EB,#60A5FA,#9788ff);border-radius:6px;transition:width .8s"></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px;padding-top:10px;border-top:1px solid var(--rim2)">
        <div><div style="font-size:9.5px;color:var(--ink3);font-weight:700;text-transform:uppercase">Cobrado</div><div style="font-size:14px;font-weight:900;color:var(--green);margin-top:2px">${fmt(cobradoReal)}</div></div>
        <div><div style="font-size:9.5px;color:var(--ink3);font-weight:700;text-transform:uppercase">Inicial pagada</div><div style="font-size:14px;font-weight:900;margin-top:2px;color:${Math.abs(inicialDiff)>0.01?'var(--red)':'inherit'}">${fmt(inicialPagada)}${Math.abs(inicialDiff)>0.01?`<span style="font-size:8.5px;font-weight:800;display:block;color:var(--red);line-height:1.2;margin-top:1px">plan ${fmt(inicial)} · ${inicialDiff>0?'falta '+fmt(inicialDiff):'sobra '+fmt(-inicialDiff)}</span>`:''}</div></div>
        <div><div style="font-size:9.5px;color:var(--ink3);font-weight:700;text-transform:uppercase">Cuotas restantes</div><div style="font-size:14px;font-weight:900;color:var(--p1);margin-top:2px">${n-pagado}</div></div>
        <div><div style="font-size:9.5px;color:var(--ink3);font-weight:700;text-transform:uppercase">Días restantes</div><div style="font-size:14px;font-weight:900;color:var(--amber);margin-top:2px">${diasRestantes}d</div></div>
      </div>
    </div>

    <!-- ═══════ DATOS CLIENTE + DATOS CRÉDITO (2 columnas) ═══════ -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">

      <!-- Info cliente -->
      <div style="background:var(--surf);border:1px solid var(--rim);border-radius:12px;padding:12px 14px">
        <div style="font-size:10.5px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">
          <span>Información del Cliente</span>
          ${scoreCli>0?`<span style="background:${scoreColor};color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:900;letter-spacing:.3px">SCORE ${scoreCli}</span>`:''}
        </div>
        <div style="display:flex;flex-direction:column;gap:7px;font-size:12px">
          <div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--ink3);font-weight:600">Cédula</span><span style="font-weight:700;font-family:var(--fd)">${cliente.cedula||'—'}</span></div>
          <div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--ink3);font-weight:600">Teléfono</span><span style="font-weight:700;font-family:var(--fd)">${cliente.tel||'—'}</span></div>
          <div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--ink3);font-weight:600">Ciudad</span><span style="font-weight:700">${cliente.ciudad||'—'}</span></div>
          <div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--ink3);font-weight:600">Empleo</span><span style="font-weight:700;text-align:right;max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${cliente.trabajo||'—'}</span></div>
          <div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--ink3);font-weight:600">Ingreso mensual</span><span style="font-weight:800;color:var(--green)">${cliente.ingreso?fmt(cliente.ingreso):'—'}</span></div>
          ${cliente.ingreso && cuotaMensual ? `<div style="display:flex;justify-content:space-between;gap:10px;padding-top:6px;border-top:1px dashed var(--rim2)"><span style="color:var(--ink3);font-weight:600">Ratio cuota/ingreso</span><span style="font-weight:800;color:${(cuotaMensual/cliente.ingreso)>0.4?'var(--red)':(cuotaMensual/cliente.ingreso)>0.25?'var(--amber)':'var(--green)'}">${Math.round(cuotaMensual/cliente.ingreso*100)}%</span></div>`:''}
        </div>
        <div style="display:flex;gap:5px;margin-top:10px;padding-top:10px;border-top:1px solid var(--rim2)">
          <button class="btn btn-g btn-xs" style="flex:1" onclick="verCliente('${cliente.id||''}')" ${!cliente.id?'disabled':''}>Ver perfil</button>
          <button class="btn btn-g btn-xs" style="flex:1" onclick="whatsappCliente('${c.id}')">WhatsApp</button>
          <button class="btn btn-g btn-xs" style="flex:1" onclick="llamarCliente('${c.id}')">Llamar</button>
        </div>
      </div>

      <!-- Info crédito -->
      <div style="background:var(--surf);border:1px solid var(--rim);border-radius:12px;padding:12px 14px">
        <div style="font-size:10.5px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Estructura del Crédito</div>
        <div style="display:flex;flex-direction:column;gap:7px;font-size:12px">
          <div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--ink3);font-weight:600">Precio moto</span><span style="font-weight:700">${fmt(precioBase)}</span></div>
          <div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--ink3);font-weight:600">Inicial (${Math.round((inicial/precioBase)*100)||0}%)</span><span style="font-weight:700">${fmt(inicial)}</span></div>
          <div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--ink3);font-weight:600">Total financiado</span><span style="font-weight:700">${fmt(precioBase-inicial)}</span></div>
          <div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--ink3);font-weight:600">Monto total a pagar</span><span style="font-weight:800;color:var(--p1)">${fmt(totalCredito)}</span></div>
          <div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--ink3);font-weight:600">Intereses (spread)</span><span style="font-weight:700;color:var(--amber)">${fmt(spreadCredito)}</span></div>
          <div style="display:flex;justify-content:space-between;gap:10px;padding-top:6px;border-top:1px dashed var(--rim2)"><span style="color:var(--ink3);font-weight:600">Plazo</span><span style="font-weight:700">${plazoMeses} meses (${n} cuotas)</span></div>
          <div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--ink3);font-weight:600">Cuota mensual</span><span style="font-weight:700">${fmt(cuotaMensual)}</span></div>
          <div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--ink3);font-weight:600">Cuota quincenal</span><span style="font-weight:800;color:var(--p1)">${fmt(cuota)}</span></div>
          ${apyCred>0?`<div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--ink3);font-weight:600">APY</span><span style="font-weight:700">${apyCred.toFixed(2)}%</span></div>`:''}
          ${(precioBase-inicial)>0?`<div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--ink3);font-weight:600">ROI</span><span style="font-weight:700;color:var(--green)">${((totalCredito-(precioBase-inicial))/(precioBase-inicial)*100).toFixed(2)}%</span></div>`:''}
        </div>
      </div>
    </div>

    <!-- ═══════ FECHAS CLAVE + PRÓX PAGO ═══════ -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:12px">
      <div style="background:var(--surf2);border-radius:10px;padding:11px 13px;border:1px solid var(--rim)">
        <div style="font-size:9.5px;color:var(--ink3);font-weight:800;text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px">Fecha inicio</div>
        <div style="font-weight:800;font-family:var(--fd);font-size:13px">${c.fecha||'—'}</div>
        <div style="font-size:10px;color:var(--ink3);margin-top:2px">Hace ${diasTranscurridos}d</div>
      </div>
      <div style="background:linear-gradient(135deg,rgba(37,99,235,.12),rgba(124,109,255,.05));border-radius:10px;padding:11px 13px;border:1px solid rgba(37,99,235,.25)">
        <div style="font-size:9.5px;color:var(--p1);font-weight:800;text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px">Próximo pago</div>
        <div style="font-weight:900;font-family:var(--fd);font-size:15px;color:var(--p1)">${fmt(proxMonto)}</div>
        <div style="font-size:10px;color:var(--ink3);margin-top:2px">${proxFecha}</div>
      </div>
      <div style="background:var(--surf2);border-radius:10px;padding:11px 13px;border:1px solid var(--rim)">
        <div style="font-size:9.5px;color:var(--ink3);font-weight:800;text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px">Fin contrato</div>
        <div style="font-weight:800;font-family:var(--fd);font-size:13px">${fechaFinStr}</div>
        <div style="font-size:10px;color:var(--ink3);margin-top:2px">En ${diasRestantes}d</div>
      </div>
      <div style="background:${c.mora>0?'var(--reds)':'var(--greens)'};border-radius:10px;padding:11px 13px;border:1px solid ${c.mora>0?'rgba(217,59,90,.25)':'rgba(5,160,96,.25)'}">
        <div style="font-size:9.5px;color:${c.mora>0?'var(--red)':'var(--green)'};font-weight:800;text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px">Estado de mora</div>
        <div style="font-weight:900;font-family:var(--fd);font-size:15px;color:${c.mora>0?'var(--red)':'var(--green)'}">${c.mora>0?c.mora+' días':'Al día'}</div>
        <div style="font-size:10px;color:var(--ink3);margin-top:2px">${c.mora>0?fmt(c.moraMonto||0)+' adeudado':'Sin atraso'}</div>
      </div>
    </div>

    ${infoLiquidacion}
    ${saldoProxCuota>0&&saldoProxCuota<cuota?`<div style="background:rgba(245,166,35,0.12);border:1px solid rgba(245,166,35,0.3);border-radius:8px;padding:9px 12px;font-size:12px;margin-bottom:10px">La cuota ${pagado+1} tiene un abono de <strong>${fmt(cuota-saldoProxCuota)}</strong> — solo quedan <strong>${fmt(saldoProxCuota)}</strong> por pagar.</div>`:''}

    <!-- ═══════ TABLA DE AMORTIZACIÓN ═══════ -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 8px">
      <div>
        <div style="font-size:14px;font-weight:800;margin-bottom:2px">Tabla de Amortización</div>
        <div style="font-size:11px;color:var(--ink3)">Cronograma completo de pagos quincenales</div>
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap">
        <span class="bdg b-b">Quincenal · 15 días</span>
        <span class="bdg b-g">✓ ${pagado} de ${n}</span>
        <span class="bdg b-p">Pend: ${n-pagado}</span>
      </div>
    </div>
    <div class="ah" style="grid-template-columns:${cols}">
      <div>#</div><div>Fecha</div><div>Estado</div><div>Abonos</div><div>Monto</div><div>Interés</div><div>Capital</div><div>Saldo</div>
    </div>
    <div style="max-height:280px;overflow-y:auto;margin-top:3px;border:1px solid var(--rim);border-radius:8px;padding:2px">${rows}</div>`;
  var _cliIdAmort = c.clienteId || c.cliId || '';
  var _cliAmort = S.clientes.find(function(x){return (c.clienteId&&String(x.id)===String(c.clienteId))||(c.cliId&&String(x.id)===String(c.cliId))||x.nombre===c.cli;});
  if(_cliAmort) _cliIdAmort = _cliAmort.id;
  $('mft').innerHTML='<button class="btn btn-g" onclick="closeM()">Cerrar</button>'+(_cliIdAmort?'<button class="btn btn-g" onclick="closeM();verCliente(\''+_cliIdAmort+'\')" >Ver perfil</button>':'')+(estadoCred==='activo'?'<button class="btn btn-g" onclick="closeM();openPagoRapido(\''+c.id+'\')" >Registrar pago</button>':'')+'<button class="btn btn-g" onclick="descargarEstadoPDF()">↓ Descargar estado</button><button class="btn btn-p" onclick="descargarAmortPDF()">↓ Descargar PDF</button>';
  $('ov').style.display='flex';
}

// ── COBRANZA: LLAMADA, WHATSAPP, RECUPERACION ──
function llamarCliente(credId){
  var c=S.creds.find(function(x){return x.id===credId;});
  if(!c){toast('Crédito no encontrado','error');return;}
  var cl=S.clientes.find(function(x){return x.nombre===c.cli;})||{};
  var tel=(cl.tel||'').replace(/\D/g,'');
  if(!tel){toast('Este cliente no tiene teléfono registrado','error');return;}
  window.open('tel:+58'+tel.replace(/^0/,''));
}

function whatsappCliente(credId){
  var c=S.creds.find(function(x){return x.id===credId;});
  if(!c){toast('Crédito no encontrado','error');return;}
  var cl=S.clientes.find(function(x){return x.nombre===c.cli;})||{};
  var tel=(cl.tel||'').replace(/\D/g,'').replace(/^0/,'');
  if(!tel){toast('Este cliente no tiene teléfono registrado','error');return;}
  var empresa=($('cfg_empresa')&&$('cfg_empresa').value)||'Pagasi';
  // Usar helpers canónicos para que los números coincidan con el resto del app
  var totalCuotas2 = getCreditoTotalCuotas(c);
  var cuotasPagadas2 = getCreditoCuotasPagadas(c);
  var totalPagado2 = getCreditoPagosConfirmados(c);
  var saldoPendiente = getCreditoSaldoPendiente(c);
  var cuotaNum2 = Math.min(cuotasPagadas2+1, totalCuotas2);
  var cuotasRest2 = totalCuotas2-cuotasPagadas2;
  var cuotaStr = fmt(c.cuotaQ||c.cuota||0);
  var pct2 = totalCuotas2>0?Math.round(cuotasPagadas2/totalCuotas2*100):0;
  var fechaProxima='', fechaVencFin2='';
  if(c.fecha){
    var sig2=new Date(parseFechaLocal(c.fecha).getTime()+((cuotasPagadas2+1)*15*24*60*60*1000));
    fechaProxima=sig2.toLocaleDateString('es-VE',{day:'2-digit',month:'2-digit',year:'numeric'});
    var fin2=new Date(parseFechaLocal(c.fecha).getTime()+(totalCuotas2*15*24*60*60*1000));
    fechaVencFin2=fin2.toLocaleDateString('es-VE',{day:'2-digit',month:'2-digit',year:'numeric'});
  }
  var sep2='--------------------------------';
  var lineas=[
    empresa.toUpperCase()+' — ESTADO DE CUENTA',
    '',
    'Estimado/a '+c.cli+':',
    '',
    'A continuacion le presentamos el estado actualizado de su cuenta:',
    '',
    sep2,
    'CUENTA N° : '+credId,
    'CLIENTE : '+c.cli,
    'VEHICULO : '+c.modelo,
    sep2,
    'Cuota N° : '+cuotaNum2+' de '+totalCuotas2,
    'Cuotas pag. : '+cuotasPagadas2+' ('+pct2+'%)',
    'Cuotas rest. : '+cuotasRest2,
    'Cuota quinc. : '+cuotaStr,
    fechaProxima ? 'Prox. vence : '+fechaProxima : '',
    'Saldo pend. : '+fmt(saldoPendiente),
    'Total pag. : '+fmt(totalPagado2),
    fechaVencFin2 ? 'Fin contrato : '+fechaVencFin2 : '',
    c.mora>0 ? 'Dias de mora : '+c.mora+' dia'+(c.mora!==1?'s':'') : 'Estado : Al dia',
    sep2,
    '',
    c.mora>0
      ? 'Su cuenta presenta '+c.mora+' dia'+(c.mora!==1?'s':'')+' de atraso. Le solicitamos que regularice su situacion a la brevedad para evitar cargos adicionales y acciones de recuperacion.'
      : 'Su cuenta se encuentra al dia. Su proxima cuota de '+cuotaStr+' vence el '+fechaProxima+'.',
    '',
    'Para realizar su pago o consultas, comuniquese con nuestra oficina.',
    '',
    empresa.toUpperCase()
  ].filter(Boolean).join('\n');
  var msg=encodeURIComponent(lineas);
  window.open('https://wa.me/58'+tel+'?text='+msg);
}

function confirmarRecuperacion(credId){
  var c=S.creds.find(function(x){return x.id===credId;});
  if(!c) return;
  setMicon('llave');
  $('mtt').textContent='Recuperar Unidad';
  $('msb').textContent=c.cli+' · '+c.modelo;
  $('modal-box').className='modal';
  $('mbd').innerHTML='<div style="text-align:center;padding:14px 0">'
    +'<div style="font-size:40px;margin-bottom:12px">MOT</div>'
    +'<div style="font-size:15px;font-weight:800;margin-bottom:6px">'+c.modelo+'</div>'
    +'<div style="color:var(--ink3);font-size:12px;margin-bottom:18px">Crédito '+credId+' · Cliente: '+c.cli+'</div>'
    +'<div style="background:var(--reds);border:1px solid rgba(240,75,106,0.2);border-radius:var(--r8);padding:12px;color:var(--red);font-size:13px;font-weight:700">'
    +' ¿Confirmas la recuperación de esta unidad? El crédito pasará a estado "recuperado" y la moto quedará disponible.</div></div>';
  S.saveFn=function(){
    var ci=S.creds.findIndex(function(x){return x.id===credId;});
    if(ci>=0){
      S.creds[ci].estado='recuperado';
      DB.updateCred(credId,{estado:'recuperado'});
      var mi=S.motos.findIndex(function(x){return String(x.id)===String(S.creds[ci].motoId);});
      if(mi>=0){S.motos[mi].estado='recuperada';S.motos[mi].cliente=null;DB.saveMoto(S.motos[mi]);}
    }
    toast('Unidad recuperada — crédito cerrado','info');
    closeM();nav('cobranza');return true;
  };
  $('mft').innerHTML='<button class="btn btn-g" onclick="closeM()">Cancelar</button><button class="btn btn-d" onclick="saveM()">Key Confirmar Recuperación</button>';
  $('ov').style.display='flex';
}

// ── PAGOS: CONFIRMAR PAGO PENDIENTE ──

function confirmarDelPago(id){
  var p=S.pagos.find(function(x){return x.id===id;});if(!p)return;
  window._delPagoId=id;
  window._delPagoRazon='';
  window._delPagoModo=(p.mantenerEnAmortizacion===true)?'mantener':'completo';
  setMicon('eliminar');$('mtt').textContent='Eliminar Pago';$('msb').textContent='El registro quedará auditado';
  $('modal-box').className='modal';
  $('mbd').innerHTML='<div style="text-align:left;padding:10px 0">'
    +'<div style="text-align:center;font-size:42px;margin-bottom:10px">PAG</div>'
    +'<div style="text-align:center;font-size:15px;font-weight:800">¿Cómo quieres eliminar el pago '+p.id+'?</div>'
    +'<div style="text-align:center;color:var(--ink3);font-size:13px;margin-top:6px">'+p.cli+' · '+fmt(p.monto)+' · '+p.fecha+'</div>'
    +'<div style="margin-top:14px;display:grid;gap:10px">'
    +'<label style="display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid var(--line);border-radius:10px;cursor:pointer">'
    +'<input type="radio" name="del_pago_modo" value="mantener" '+(window._delPagoModo==='mantener'?'checked':'')+' onchange="window._delPagoModo=this.value">'
    +'<div><div style="font-weight:800">Eliminar pero seguir contando en amortización</div>'
    +'<div style="font-size:12px;color:var(--ink3);margin-top:4px">El pago desaparece del flujo operativo, pero la cuota seguirá contando en la tabla de amortización. El registro queda auditado.</div></div></label>'
    +'<label style="display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid var(--line);border-radius:10px;cursor:pointer">'
    +'<input type="radio" name="del_pago_modo" value="completo" '+(window._delPagoModo!=='mantener'?'checked':'')+' onchange="window._delPagoModo=this.value">'
    +'<div><div style="font-weight:800">Eliminar por completo</div>'
    +'<div style="font-size:12px;color:var(--ink3);margin-top:4px">El pago deja de contar en la amortización, se recalcula el crédito y el movimiento en Cuentas también se marca como eliminado. El registro queda auditado.</div></div></label>'
    +'</div>'
    +'<div style="margin-top:10px;padding:9px;background:var(--ambers);border-radius:8px;font-size:12px;color:var(--ink)">'
    +' En ambos casos el pago no se borra de la base: queda con trazabilidad de quién lo eliminó, cuándo y por qué.</div></div>';
  $('mft').innerHTML='<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    +'<button class="btn btn-d" onclick="auditarYEliminarPago()">Confirmar eliminación</button>';
  $('ov').style.display='flex';
}


function auditarYEliminarPago(){
  if(!requireDeletePermission()) return;
  var id=window._delPagoId; var p=S.pagos.find(function(x){return x.id===id;});if(!p)return;
  closeM();
  confirmarEliminacion({
    titulo:'Eliminar Pago',
    descripcion:'Pago '+p.id+' · '+p.cli+' · '+fmt(p.monto),
    onConfirm:function(audit){
      window._delPagoRazon=audit.eliminadoRazon;
      ejecutarDelPago();
    }
  });
}

function ejecutarDelPago(){
  var id=window._delPagoId; if(!id)return;
  var pi=S.pagos.findIndex(function(x){return x.id===id;});
  if(pi<0){closeM();return;}
  var p=S.pagos[pi];
  var modo=(window._delPagoModo==='mantener')?'mantener':'completo';
  // Soft delete con auditoría
  S.pagos[pi].eliminadoPor=(S.currentUser&&S.currentUser.nombre)||'Admin';
  S.pagos[pi].eliminadoPorUid=(S.currentUser&&S.currentUser.uid)||'';
  S.pagos[pi].eliminadoEn=new Date().toISOString();
  S.pagos[pi].eliminadoRazon=window._delPagoRazon||'Sin especificar';
  S.pagos[pi].eliminado=true;
  S.pagos[pi].eliminadoModo=modo;
  S.pagos[pi].mantenerEnAmortizacion=(modo==='mantener');
  DB.savePago(S.pagos[pi]);

  // Si es eliminación completa, recalcular el crédito y eliminar el movimiento asociado.
  if(modo==='completo'){
    recalcularCreditoDesdePagos(p.cred);
    var mi=S.movimientos.findIndex(function(m){
      return !m.eliminado && (m.conceptoPago===p.id || (m.concepto&&m.concepto.includes(p.cred)&&m.monto===p.monto&&m.fecha===p.fecha));
    });
    if(mi>=0){
      S.movimientos[mi].eliminado=true;
      S.movimientos[mi].eliminadoPor=(S.currentUser&&S.currentUser.nombre)||'Admin';
      S.movimientos[mi].eliminadoEn=new Date().toISOString();
      DB.saveMovimiento(S.movimientos[mi]);
    }
  } else {
    // Mantener en amortización: preservar el efecto financiero en el crédito.
    recalcularCreditoDesdePagos(p.cred);
  }

  window._delPagoId=null;
  window._delPagoModo=null;
  closeM(); nav('pagos');
  toast(modo==='mantener' ? 'Pago eliminado del flujo, pero sigue contando en amortización' : 'Pago eliminado por completo y crédito recalculado','info');
}


function syncEstadoClientePorCredito(credId){
  var cred=S.creds.find(function(x){return x.id===credId;});
  if(!cred) return;
  var cliIdx=S.clientes.findIndex(function(cl){return cl.nombre===cred.cli;});
  if(cliIdx<0) return;
  var nombre=S.clientes[cliIdx].nombre;
  var tieneActivos=S.creds.some(function(cr){return !cr.eliminado && cr.cli===nombre && (cr.estado==='activo' || cr.estado==='mora');});
  var tieneCompletados=S.creds.some(function(cr){return !cr.eliminado && cr.cli===nombre && cr.estado==='completado';});
  var nuevoEstado=tieneActivos ? 'activo' : (tieneCompletados ? 'solvente' : (S.clientes[cliIdx].estado||'activo'));
  if(S.clientes[cliIdx].estado!==nuevoEstado){
    S.clientes[cliIdx].estado=nuevoEstado;
    DB.saveCliente(S.clientes[cliIdx]);
  }
}


function syncTodosEstadosClientes(){
  S.clientes.forEach(function(cl){
    if(!cl || cl.eliminado) return;
    var nombre=cl.nombre;
    var tieneActivos=S.creds.some(function(cr){return !cr.eliminado && cr.cli===nombre && (cr.estado==='activo' || cr.estado==='mora');});
    var tieneCompletados=S.creds.some(function(cr){return !cr.eliminado && cr.cli===nombre && cr.estado==='completado';});
    var nuevoEstado=tieneActivos ? 'activo' : (tieneCompletados ? 'solvente' : (cl.estado||'activo'));

    // ── AUTO-REPARAR SCORE ──
    // Si score_indexa es objeto corrupto, string no numérico, null, o 0, recalcular
    var scRaw = cl.score_indexa;
    var scoreNumero = 0;
    if(scRaw && typeof scRaw === 'object'){
      scoreNumero = scRaw.total || 0; // rescatar de objeto corrupto
    } else {
      scoreNumero = parseFloat(scRaw) || 0;
    }
    var scoreInvalido = !scoreNumero || scoreNumero < 300 || scoreNumero > 850 || (typeof scRaw === 'object');
    if(scoreInvalido && typeof recalcularScoreCliente === 'function'){
      try {
        scoreNumero = recalcularScoreCliente(cl, false); // calcular pero no persistir aquí
      } catch(e){ scoreNumero = 0; }
    }

    var debeGuardar = false;
    if(cl.estado !== nuevoEstado){ cl.estado = nuevoEstado; debeGuardar = true; }
    if(scoreInvalido && scoreNumero > 0 && scoreNumero !== scRaw){
      cl.score_indexa = scoreNumero;
      cl.score_actualizado = new Date().toISOString();
      debeGuardar = true;
    }
    if(debeGuardar) DB.saveCliente(cl);
  });
}


function getSaldoPendienteCredito(credId){
  var c=S.creds.find(function(x){return x.id===credId;});
  if(!c) return 0;
  var cuotaVal=parseFloat(c.cuotaQ||c.cuota||0);
  var totalCuotas=c.totalCuotas||((parseInt(c.plazo,10)||0)*2);
  var totalFinanciado=parseFloat((cuotaVal*totalCuotas).toFixed(2));
  var totalAbonado=0;
  if(Array.isArray(c.pagosRegistrados) && c.pagosRegistrados.length){
    totalAbonado=c.pagosRegistrados.reduce(function(a,h){ return a + (parseFloat(h.montoPagado)||0); },0);
  } else {
    totalAbonado=(parseFloat(c.pagado)||0)*cuotaVal;
  }
  var resultado=parseFloat((totalFinanciado-totalAbonado).toFixed(2));if(resultado<0.05)resultado=0;if(c.estado==='completado'||c.estado==='cancelado')resultado=0;return Math.max(0,resultado);
}

function openLiquidarAnticipado(credId){
  var c=S.creds.find(function(x){return x.id===credId;});
  if(!c) return;
  if(c.estado==='completado' || c.estado==='cancelado'){
    toast('Este crédito ya no se puede liquidar','info');
    return;
  }
  var saldo=getSaldoPendienteCredito(credId);
  if(saldo<=0){
    toast('Este crédito ya no tiene saldo pendiente','info');
    return;
  }
  $('mtt').innerHTML='Liquidación anticipada';
  $('mbd').innerHTML=''
    +'<div class="fgr" style="gap:10px">'
    + '<div class="fg"><label>Crédito</label><input class="fi" value="'+c.id+'" disabled></div>'
    + '<div class="fg"><label>Cliente</label><input class="fi" value="'+(c.cli||'')+'" disabled></div>'
    + '<div class="fg"><label>Saldo actual</label><input id="liq_saldo" class="fi" value="'+saldo.toFixed(2)+'" disabled></div>'
    + '<div class="fg"><label>Descuento</label><input id="liq_descuento" class="fi" type="number" min="0" step="0.01" value="0" oninput="updLiquidacionFinal()"></div>'
    + '<div class="fg"><label>Monto final a pagar</label><input id="liq_monto_final" class="fi" type="number" min="0" step="0.01" value="'+saldo.toFixed(2)+'" oninput="updLiquidacionDescuento()"></div>'
    + '<div class="fg"><label>Cuenta destino</label><select id="liq_cuenta" class="fs">'+((((window._cuentasBanc&&window._cuentasBanc.length)?window._cuentasBanc:[{nombre:'Caja principal'}]).map(function(ct){return '<option value="'+ct.nombre+'">'+ct.nombre+'</option>';}).join('')))+'</select></div>'
    + '<div class="fg"><label>Fecha</label><input id="liq_fecha" class="fi" type="date" value="'+hoyLocalISO()+'"></div>'
    + '<div class="fg"><label>Motivo del descuento</label><input id="liq_motivo" class="fi" placeholder="Negociación por pago anticipado"></div>'
    +'</div>'
    +'<div class="fgr" style="gap:10px;margin-top:10px">'
    + '<div class="fg"><label><input id="liq_obs" class="fi" placeholder="Observación interna del acuerdo"></label></div>'
    +'</div>'
    +'<div style="display:flex;gap:16px;margin-top:12px;padding:10px 12px;background:var(--surf2);border-radius:var(--r8)">'
    + '<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input id="liq_cerrar" type="checkbox" checked> Cerrar contrato</label>'
    + '<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input id="liq_finiquito" type="checkbox" checked> Generar finiquito</label>'
    + '<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input id="liq_moto_propia" type="checkbox" checked> Moto como propia</label>'
    +'</div>'
    +'<div class="note" style="margin-top:10px">Se registrará el cobro real y, si aplica, un descuento de cierre anticipado con auditoría.</div>';
  window._liqCredId=credId;
  $('mft').innerHTML='<button class="btn btn-g" onclick="closeM()">Cancelar</button><button class="btn btn-s" onclick="ejecutarLiquidacionAnticipada()">Liquidar ahora</button>';
  $('ov').style.display='flex';
}

function updLiquidacionFinal(){
  var saldo=parseFloat(($('liq_saldo')&&$('liq_saldo').value)||0)||0;
  var descuento=parseFloat(($('liq_descuento')&&$('liq_descuento').value)||0)||0;
  if(descuento<0) descuento=0;
  if(descuento>saldo) descuento=saldo;
  if($('liq_descuento')) $('liq_descuento').value=descuento.toFixed(2);
  var final=Math.max(0, parseFloat((saldo-descuento).toFixed(2)));
  if($('liq_monto_final')) $('liq_monto_final').value=final.toFixed(2);
}

function updLiquidacionDescuento(){
  var saldo=parseFloat(($('liq_saldo')&&$('liq_saldo').value)||0)||0;
  var montoFinal=parseFloat(($('liq_monto_final')&&$('liq_monto_final').value)||0)||0;
  if(montoFinal<0) montoFinal=0;
  if(montoFinal>saldo) montoFinal=saldo;
  if($('liq_monto_final')) $('liq_monto_final').value=montoFinal.toFixed(2);
  var descuento=Math.max(0, parseFloat((saldo-montoFinal).toFixed(2)));
  if($('liq_descuento')) $('liq_descuento').value=descuento.toFixed(2);
}

function ejecutarLiquidacionAnticipada(){
  try{
  var credId=window._liqCredId;
  var ci=S.creds.findIndex(function(x){return x.id===credId;});
  if(ci<0){ toast('Crédito no encontrado','error'); return; }
  var c=S.creds[ci];
  if(c.estado==='completado' || c.estado==='cancelado'){
    toast('Este crédito ya no se puede liquidar','info');
    return;
  }
  var saldo=getSaldoPendienteCredito(credId);
  var descuento=parseFloat(($('liq_descuento')&&$('liq_descuento').value)||0)||0;
  var montoFinal=parseFloat(($('liq_monto_final')&&$('liq_monto_final').value)||0)||0;
  if(descuento<0) descuento=0;
  if(descuento>saldo) descuento=saldo;
  if(montoFinal<0) montoFinal=0;
  if(parseFloat((montoFinal+descuento).toFixed(2))!==parseFloat(saldo.toFixed(2))){
    montoFinal=parseFloat((saldo-descuento).toFixed(2));
    if($('liq_monto_final')) $('liq_monto_final').value=montoFinal.toFixed(2);
  }
  if(montoFinal<=0 && descuento<=0){
    toast('Debes indicar un monto o un descuento válido','error');
    return;
  }
  if(descuento > saldo*0.4){
    if(!confirm('El descuento supera 40% del saldo pendiente. ¿Deseas continuar?')) return;
  }
  var fecha=(($('liq_fecha')&&$('liq_fecha').value)||hoyLocalISO());
  var cuenta=(($('liq_cuenta')&&$('liq_cuenta').value)||(((window._cuentasBanc&&window._cuentasBanc[0]&&window._cuentasBanc[0].nombre))||'Caja principal'));
  var motivo=(($('liq_motivo')&&$('liq_motivo').value)||'Liquidación anticipada').trim();
  var observacion=(($('liq_obs')&&$('liq_obs').value)||'').trim();
  var usuario=(S.currentUser&&S.currentUser.nombre)||'Admin';
  var cuotaVal=parseFloat(c.cuotaQ||c.cuota||0);
  var totalCuotas=c.totalCuotas||((parseInt(c.plazo,10)||0)*2);
  var historial=Array.isArray(c.pagosRegistrados)?JSON.parse(JSON.stringify(c.pagosRegistrados)):[];
  var saldoPorCuota=[];
  for(var qi=0;qi<totalCuotas;qi++) saldoPorCuota[qi]=cuotaVal;
  historial.forEach(function(h){
    var idx=(h.cuota||0)-1;
    if(idx>=0&&idx<totalCuotas) saldoPorCuota[idx]=Math.max(0,parseFloat((saldoPorCuota[idx]-(parseFloat(h.montoPagado)||0)).toFixed(2)));
  });

  var pagoId='P-LIQ-'+Date.now();
  if(montoFinal>0){
    var pago={
      id:pagoId,
      cred:credId,
      cli:c.cli,
      fecha:fecha,
      monto:parseFloat(montoFinal.toFixed(2)),
      metodo:cuenta,
      cobrador:usuario,
      estado:'confirmado',
      referencia:'LIQ-ANT',
      realizadoPor:usuario,
      tipo:'liquidacion',
      motivo:motivo,
      observacion:observacion,
      tasaBs:window._tasaBsGlobal||1
    };
    S.pagos.push(pago);
    DB.savePago(pago);
    var mov={
      id:'MOV-'+Date.now(),
      tipo:'deposito',
      concepto:'Liquidación anticipada · '+c.cli+' · '+credId,
      monto:parseFloat(montoFinal.toFixed(2)),
      cuentaOrigen:null,
      cuentaDestino:cuenta,
      fecha:fecha,
      referencia:'LIQ-ANT',
      realizadoPor:usuario,
      tasaBs:window._tasaBsGlobal||1,
      hora:new Date().toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit',hour12:false})
    };
    S.movimientos.push(mov);
    DB.saveMovimiento(mov);
  }

  var montoRestante=parseFloat(montoFinal.toFixed(2));
  for(var qi=0;qi<totalCuotas && montoRestante>0.001;qi++){
    if(saldoPorCuota[qi]>0.001){
      var aplicar=Math.min(montoRestante,saldoPorCuota[qi]);
      aplicar=parseFloat(aplicar.toFixed(2));
      historial.push({cuota:qi+1,montoPagado:aplicar,fecha:fecha,pagoId:pagoId,tipo:'liquidacion'});
      saldoPorCuota[qi]=parseFloat((saldoPorCuota[qi]-aplicar).toFixed(2));
      montoRestante=parseFloat((montoRestante-aplicar).toFixed(2));
    }
  }

  if(descuento>0){
    var descuentoRestante=parseFloat(descuento.toFixed(2));
    for(var qd=0;qd<totalCuotas && descuentoRestante>0.001;qd++){
      if(saldoPorCuota[qd]>0.001){
        var aplicarDesc=Math.min(descuentoRestante,saldoPorCuota[qd]);
        aplicarDesc=parseFloat(aplicarDesc.toFixed(2));
        historial.push({cuota:qd+1,montoPagado:aplicarDesc,fecha:fecha,pagoId:'DESC-'+pagoId,tipo:'descuento_liquidacion'});
        saldoPorCuota[qd]=parseFloat((saldoPorCuota[qd]-aplicarDesc).toFixed(2));
        descuentoRestante=parseFloat((descuentoRestante-aplicarDesc).toFixed(2));
      }
    }
  }

  var cuotasPagadas=0;
  for(var i=0;i<totalCuotas;i++){
    if(saldoPorCuota[i]<=0.001) cuotasPagadas++;
    else break;
  }
  var saldoProxCuota=cuotasPagadas<totalCuotas ? saldoPorCuota[cuotasPagadas] : 0;
  var liquidaciones=Array.isArray(c.liquidaciones)?JSON.parse(JSON.stringify(c.liquidaciones)):[];
  liquidaciones.push({
    id:'LQ-'+Date.now(),
    fecha:fecha,
    saldoOriginal:parseFloat(saldo.toFixed(2)),
    descuento:parseFloat(descuento.toFixed(2)),
    montoPagado:parseFloat(montoFinal.toFixed(2)),
    motivo:motivo,
    observacion:observacion,
    realizadoPor:usuario
  });

  S.creds[ci].pagado=cuotasPagadas;
  S.creds[ci].pagosRegistrados=historial;
  S.creds[ci].saldoProxCuota=saldoProxCuota;
  S.creds[ci].estado='completado';
  S.creds[ci].fechaCompletado=fecha;
  S.creds[ci].tipoCierre='liquidacion_anticipada';
  S.creds[ci].saldoOriginalLiquidacion=parseFloat(saldo.toFixed(2));
  S.creds[ci].descuentoLiquidacion=parseFloat(descuento.toFixed(2));
  S.creds[ci].montoLiquidado=parseFloat(montoFinal.toFixed(2));
  S.creds[ci].motivoLiquidacion=motivo;
  S.creds[ci].observacionLiquidacion=observacion;
  S.creds[ci].liquidaciones=liquidaciones;

  DB.updateCred(credId,{
    pagado:cuotasPagadas,
    pagosRegistrados:historial,
    saldoProxCuota:saldoProxCuota,
    estado:'completado',
    fechaCompletado:fecha,
    tipoCierre:'liquidacion_anticipada',
    saldoOriginalLiquidacion:parseFloat(saldo.toFixed(2)),
    descuentoLiquidacion:parseFloat(descuento.toFixed(2)),
    montoLiquidado:parseFloat(montoFinal.toFixed(2)),
    motivoLiquidacion:motivo,
    observacionLiquidacion:observacion,
    liquidaciones:liquidaciones
  });

  if($('liq_moto_propia') && $('liq_moto_propia').checked){
    var mIdx=S.motos.findIndex(function(m){return String(m.id)===String(c.motoId);});
    if(mIdx>=0){
      S.motos[mIdx].estado='propia';
      S.motos[mIdx].propietario=c.cli;
      DB.saveMoto(S.motos[mIdx]);
    }
  }
  var cliIdx=S.clientes.findIndex(function(cl){return cl.nombre===c.cli;});
  if(cliIdx>=0){
    S.clientes[cliIdx].estado='solvente';
    DB.saveCliente(S.clientes[cliIdx]);
  }
  syncEstadoClientePorCredito(credId);
  syncTodosEstadosClientes();
  closeM();
  nav('creditos');
  toast('Liquidación anticipada registrada por '+fmt(montoFinal)+(descuento>0?' con descuento de '+fmt(descuento):''),'success');
  if($('liq_finiquito') && $('liq_finiquito').checked){
    setTimeout(function(){ abrirFiniquito(credId); }, 500);
  }
  }catch(err){
    console.error('Error en liquidación anticipada', err);
    toast('No se pudo procesar la liquidación. Revisa consola o intenta de nuevo.','error');
  }
}
window.openLiquidarAnticipado=openLiquidarAnticipado;
window.ejecutarLiquidacionAnticipada=ejecutarLiquidacionAnticipada;
window.updLiquidacionFinal=updLiquidacionFinal;
window.updLiquidacionDescuento=updLiquidacionDescuento;

function recalcularCreditoDesdePagos(credId){
  var ci=S.creds.findIndex(function(x){return x.id===credId;});
  if(ci<0) return null;
  var c=S.creds[ci];
  var cuotaVal=parseFloat(c.cuotaQ||c.cuota||0);
  var totalCuotas=c.totalCuotas||((parseInt(c.plazo,10)||0)*2);
  if(totalCuotas<0) totalCuotas=0;

  var pagosAplicables=S.pagos
    .filter(function(p){
      return p.cred===credId
        && (p.estado||'confirmado')==='confirmado'
        && (!p.eliminado || p.mantenerEnAmortizacion===true)
        && !p.esInicial
        && p.tipoOperacion!=='inicial_credito';
    })
    .slice()
    .sort(function(a,b){
      var fa=(a.fecha||'').localeCompare(b.fecha||'');
      if(fa!==0) return fa;
      return String(a.id||'').localeCompare(String(b.id||''));
    });

  var historial=[];
  var saldoPorCuota=[];
  for(var qi=0;qi<totalCuotas;qi++) saldoPorCuota[qi]=cuotaVal;

  pagosAplicables.forEach(function(p){
    var montoRestante=parseFloat(p.monto)||0;
    if(montoRestante<=0) return;
    var fechaPago=p.fecha||hoyLocalISO();
    for(var qi=0;qi<totalCuotas && montoRestante>0.001;qi++){
      if(saldoPorCuota[qi]>0.001){
        var aplicar=Math.min(montoRestante,saldoPorCuota[qi]);
        aplicar=parseFloat(aplicar.toFixed(2));
        historial.push({cuota:qi+1,montoPagado:aplicar,fecha:fechaPago,pagoId:p.id,tipo:p.tipo||'pago'});
        saldoPorCuota[qi]=parseFloat((saldoPorCuota[qi]-aplicar).toFixed(2));
        montoRestante=parseFloat((montoRestante-aplicar).toFixed(2));
      }
    }
  });

  if(c.tipoCierre==='liquidacion_anticipada' && (parseFloat(c.descuentoLiquidacion)||0)>0){
    // Solo aplicar el descuento si aún existe el pago de liquidación activo (no eliminado)
    var liquidacionActiva=S.pagos.some(function(p){
      return p.cred===credId && (p.tipo==='liquidacion'||p.referencia==='LIQ-ANT') && !p.eliminado;
    });
    if(liquidacionActiva){
      var descRestante=parseFloat(c.descuentoLiquidacion)||0;
      var fechaDesc=c.fechaCompletado||hoyLocalISO();
      for(var qd=0;qd<totalCuotas && descRestante>0.001;qd++){
        if(saldoPorCuota[qd]>0.001){
          var aplicarDesc=Math.min(descRestante,saldoPorCuota[qd]);
          aplicarDesc=parseFloat(aplicarDesc.toFixed(2));
          historial.push({cuota:qd+1,montoPagado:aplicarDesc,fecha:fechaDesc,pagoId:'DESC-LIQ-'+credId,tipo:'descuento_liquidacion'});
          saldoPorCuota[qd]=parseFloat((saldoPorCuota[qd]-aplicarDesc).toFixed(2));
          descRestante=parseFloat((descRestante-aplicarDesc).toFixed(2));
        }
      }
    }
  }

  var cuotasPagadas=0;
  for(var i=0;i<totalCuotas;i++){
    if(saldoPorCuota[i]<=0.001) cuotasPagadas++;
    else break;
  }
  var proxCuotaIdx=cuotasPagadas;
  var saldoProxCuota=proxCuotaIdx<totalCuotas ? saldoPorCuota[proxCuotaIdx] : 0;
  var nuevoEstado=c.estado;
  if(nuevoEstado==='completado' && cuotasPagadas<totalCuotas) nuevoEstado='activo';
  if(cuotasPagadas>=totalCuotas && totalCuotas>0) nuevoEstado='completado';

  S.creds[ci].pagado=cuotasPagadas;
  S.creds[ci].pagosRegistrados=historial;
  S.creds[ci].saldoProxCuota=saldoProxCuota;
  S.creds[ci].estado=nuevoEstado;
  if(nuevoEstado==='completado' && !S.creds[ci].fechaCompletado) S.creds[ci].fechaCompletado=hoyLocalISO();
  if(nuevoEstado!=='completado' && S.creds[ci].fechaCompletado) S.creds[ci].fechaCompletado=null;

  // Si el crédito era liquidación anticipada pero ya no hay pago de liquidación activo,
  // limpiar los metadatos de liquidación para que el saldo vuelva al real original
  var extraClear={};
  if(c.tipoCierre==='liquidacion_anticipada'){
    var liquidacionSigueActiva=S.pagos.some(function(p){
      return p.cred===credId && (p.tipo==='liquidacion'||p.referencia==='LIQ-ANT') && !p.eliminado;
    });
    if(!liquidacionSigueActiva){
      S.creds[ci].tipoCierre=null;
      S.creds[ci].descuentoLiquidacion=0;
      S.creds[ci].montoLiquidado=0;
      S.creds[ci].saldoOriginalLiquidacion=0;
      S.creds[ci].fechaCompletado=null;
      extraClear={tipoCierre:null,descuentoLiquidacion:0,montoLiquidado:0,saldoOriginalLiquidacion:0,fechaCompletado:null};
    }
  }

  DB.updateCred(credId,Object.assign({
    pagado:cuotasPagadas,
    pagosRegistrados:historial,
    saldoProxCuota:saldoProxCuota,
    estado:nuevoEstado,
    fechaCompletado:S.creds[ci].fechaCompletado||null
  },extraClear));
  syncEstadoClientePorCredito(credId);
  syncTodosEstadosClientes();

  return {
    pagado:cuotasPagadas,
    pagosRegistrados:historial,
    saldoProxCuota:saldoProxCuota,
    estado:nuevoEstado
  };
}


function openPagoRapido(credId){
  openAddPago();
  setTimeout(function(){
    var sel=$('p_cred');
    if(sel){
      for(var i=0;i<sel.options.length;i++){
        if(sel.options[i].value===credId){sel.selectedIndex=i;break;}
      }
      updPagoMonto(sel);
    }
  },80);
}


function openEditPago(pagoId){
  var p = S.pagos.find(function(x){return x.id===pagoId;}); if(!p) return;
  setMicon('editar'); $('mtt').textContent='Editar Pago'; $('msb').textContent=pagoId+' · '+p.cli;
  $('modal-box').className='modal';
  var metOpts = (_cuentasBanc||[]).map(function(c){
    return '<option value="'+c.nombre+'" '+(p.metodo===c.nombre?'selected':'')+'>'+c.nombre+'</option>';
  }).join('');
  var cobrOpts = getCobradoresList().map(function(u){
    return '<option '+(p.cobrador===u?'selected':'')+'>'+u+'</option>';
  }).join('');
  $('mbd').innerHTML = '<div style="background:var(--surf2);border:1px solid var(--rim);border-radius:9px;padding:10px 12px;margin-bottom:12px;font-size:11px">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">'
    +'<div><span style="color:var(--ink3)">Cliente</span><div style="font-weight:700">'+p.cli+'</div></div>'
    +'<div><span style="color:var(--ink3)">Crédito</span><div style="font-weight:700">'+p.cred+'</div></div>'
    +'<div><span style="color:var(--ink3)">Estado actual</span><div style="font-weight:700">'+p.estado+'</div></div>'
    +'</div></div>'
    +'<div class="fgr" style="gap:8px">'
    +'<div class="fg"><label>Monto ($) *</label>'
    +'<input class="fi" id="ep_monto" type="number" step="0.01" value="'+(p.monto||0)+'"></div>'
    +'<div class="fg"><label>Fecha *</label>'
    +'<input class="fi" id="ep_fecha" type="date" value="'+(p.fecha||'')+'"></div>'
    +'</div>'
    +'<div class="fgr" style="gap:8px;margin-top:8px">'
    +'<div class="fg"><label>Recibido en</label>'
    +'<select class="fs" id="ep_metodo">'+(metOpts||'<option>'+p.metodo+'</option>')+'</select></div>'
    +'<div class="fg"><label>Estado</label>'
    +'<select class="fs" id="ep_estado">'
    +'<option value="confirmado" '+(p.estado==='confirmado'?'selected':'')+'>Confirmado</option>'
    +'<option value="pendiente" '+(p.estado==='pendiente'?'selected':'')+'>Pendiente</option>'
    +'</select></div>'
    +'</div>'
    +'<div class="fgr" style="gap:8px;margin-top:8px">'
    +'<div class="fg"><label>N° Referencia</label>'
    +'<input class="fi" id="ep_ref" value="'+(p.referencia||'')+'"></div>'
    +'<div class="fg"><label>Cobrador</label>'
    +'<select class="fs" id="ep_cobrador">'+(cobrOpts||'<option>'+p.cobrador+'</option>')+'</select></div>'
    +'</div>'
    +'<div style="margin-top:10px;padding:8px 11px;background:var(--okbg);border:1px solid var(--okbd);border-radius:8px;font-size:11.5px;color:var(--green)">'
    +'✓ El crédito se recalculará automáticamente al guardar cualquier cambio en el pago.</div>';
  S.saveFn = function(){
    var nuevoMonto = parseFloat(($('ep_monto')&&$('ep_monto').value))||0;
    if(nuevoMonto<=0){ toast('El monto debe ser mayor a 0','error'); return false; }
    var pi = S.pagos.findIndex(function(x){return x.id===pagoId;});
    if(pi<0){ toast('Pago no encontrado','error'); return false; }
    var credId = S.pagos[pi].cred;
    // Save who edited and when for audit trail
    S.pagos[pi].monto = nuevoMonto;
    S.pagos[pi].fecha = ($('ep_fecha')&&$('ep_fecha').value)||p.fecha;
    S.pagos[pi].metodo = ($('ep_metodo')&&$('ep_metodo').value)||p.metodo;
    S.pagos[pi].cuenta = S.pagos[pi].metodo;
    S.pagos[pi].estado = ($('ep_estado')&&$('ep_estado').value)||p.estado;
    S.pagos[pi].referencia = ($('ep_ref')&&$('ep_ref').value)||'';
    S.pagos[pi].cobrador = ($('ep_cobrador')&&$('ep_cobrador').value)||p.cobrador;
    S.pagos[pi].editadoPor = (S.currentUser&&S.currentUser.nombre)||'Admin';
    S.pagos[pi].editadoEn = new Date().toISOString();
    DB.savePago(S.pagos[pi]);

    var mi = (S.movimientos||[]).findIndex(function(m){ return !m.eliminado && m.conceptoPago===pagoId; });
    if(mi>=0){
      S.movimientos[mi].monto = nuevoMonto;
      S.movimientos[mi].fecha = S.pagos[pi].fecha;
      S.movimientos[mi].cuentaDestino = S.pagos[pi].metodo || S.movimientos[mi].cuentaDestino;
      S.movimientos[mi].referencia = S.pagos[pi].referencia || '';
      DB.saveMovimiento(S.movimientos[mi]);
    }

    recalcularCreditoDesdePagos(credId);
    calcularMoraAuto();
    closeM(); nav('pagos'); toast('Pago actualizado y crédito recalculado ✓','success'); return true;
  };
  $('mft').innerHTML='<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    +'<button class="btn btn-p" onclick="saveM()">Guardar cambios</button>';
  $('ov').style.display='flex';
}

function confirmarPago(pagoId){
  var pi=S.pagos.findIndex(function(x){return x.id===pagoId;});
  if(pi<0) return;
  var pago = S.pagos[pi];
  pago.estado='confirmado';
  DB.savePago(pago);

  // Crear o actualizar movimiento bancario vinculado al pago
  var movExistente = (S.movimientos||[]).find(function(m){
    return !m.eliminado && m.conceptoPago === pago.id;
  });
  if(!movExistente){
    var cuentaDest = pago.cuenta || pago.metodo || '';
    if(!cuentaDest && _cuentasBanc && _cuentasBanc.length>0) cuentaDest = _cuentasBanc[0].nombre;
    if(cuentaDest){
      var mov = {
        id: 'MOV-'+Date.now(),
        tipo: 'deposito',
        concepto: 'Pago cuota · '+pago.cli+' · '+pago.cred,
        conceptoPago: pago.id,
        monto: pago.monto,
        cuentaOrigen: null,
        cuentaDestino: cuentaDest,
        fecha: pago.fecha,
        referencia: pago.referencia||'',
        realizadoPor: (S.currentUser&&S.currentUser.nombre)||'Admin',
        tasaBs: pago.tasaBs || window._tasaBsGlobal || 1,
        hora: new Date().toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit',hour12:false})
      };
      if(!S.movimientos) S.movimientos = [];
      S.movimientos.push(mov);
      DB.saveMovimiento(mov);
    }
  }else{
    movExistente.monto = pago.monto;
    movExistente.fecha = pago.fecha;
    movExistente.cuentaDestino = pago.cuenta || pago.metodo || movExistente.cuentaDestino;
    movExistente.referencia = pago.referencia || '';
    DB.saveMovimiento(movExistente);
  }

  if(pago.cred){
    recalcularCreditoDesdePagos(pago.cred);
    calcularMoraAuto();
    syncEstadoClientePorCredito(pago.cred);
  }
  toast('✓ Pago confirmado · '+pagoId,'success');
  nav('pagos');
}

// ── MORA: CALCULAR DÍAS AUTOMÁTICAMENTE AL CARGAR ──
function calcularMoraAuto(){
  var hoy=new Date(); hoy.setHours(0,0,0,0);
  (S.creds||[]).forEach(function(c){
    if(!c || c.eliminado || !c.fecha) return;
    if(c.estado==='completado' || c.estado==='cancelado'){
      if(c.mora!==0){
        c.mora=0;
        DB.updateCred(c.id,{mora:0});
      } else {
        c.mora=0;
      }
      return;
    }
    var cuotasPagadas=parseInt(c.pagado||0,10)||0;
    var totalCuotas=getCreditoTotalCuotas(c);
    if(cuotasPagadas>=totalCuotas && totalCuotas>0){
      if(c.estado!=='completado' || c.mora!==0){
        c.estado='completado';
        c.mora=0;
        DB.updateCred(c.id,{mora:0,estado:'completado'});
      }else{
        c.mora=0;
      }
      return;
    }
    var inicio=parseFechaLocal(c.fecha);
    inicio.setHours(0,0,0,0);
    var cuotaSiguiente=cuotasPagadas+1;
    var fechaVence=new Date(inicio.getTime()+(cuotaSiguiente*15*24*60*60*1000));
    fechaVence.setHours(0,0,0,0);
    var diasAtraso=Math.floor((hoy-fechaVence)/(24*60*60*1000));
    var gracia=PLAN.diasGracia||5;
    var nuevaMora=diasAtraso>0?diasAtraso:0;
    var nuevoEstado=diasAtraso>gracia?'mora':'activo';
    if(c.estado==='mora' || nuevaMora>0) c.tuvoMoraHistorica=true;
    var cambio=(nuevaMora!==parseInt(c.mora||0,10)) || (c.estado!==nuevoEstado) || ((nuevaMora>0) && c.tuvoMoraHistorica!==true);
    c.mora=nuevaMora;
    c.estado=nuevoEstado;
    if(cambio){
      DB.updateCred(c.id,{mora:c.mora,estado:c.estado,tuvoMoraHistorica:!!c.tuvoMoraHistorica});
    }
  });
}

// NOTA COBRANZA
function openNota(id){
  setMicon('nota');$('mtt').textContent='Nota de Cobranza';$('msb').textContent=id;
  $('modal-box').className='modal modal-lg';
  $('mbd').innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
    +'<div>'
    +'<div class="fsec" style="margin-bottom:8px">Nueva gestión</div>'
    +'<div class="fgr c1" style="gap:9px">'
    +'<div class="fg"><label>Tipo de gestión</label>'
    +'<select class="fs" id="nota_tipo">'
    +'<option>Llamada telefónica</option><option>Visita domicilio</option>'
    +'<option>WhatsApp</option><option>Acuerdo de pago</option>'
    +'<option>Recuperación de unidad</option></select></div>'
    +'<div class="fg"><label>Resultado *</label>'
    +'<textarea class="fta" id="nota_result" placeholder="Describe el resultado..." rows="3"></textarea></div>'
    +'<div class="fgr" style="gap:8px">'
    +'<div class="fg"><label>Monto acordado ($)</label>'
    +'<input class="fi" id="nota_monto" type="number" placeholder="0.00"></div>'
    +'<div class="fg"><label>Fecha compromiso</label>'
    +'<input class="fi" id="nota_fecha" type="date"></div></div>'
    +'<div class="fg"><label>Próxima acción</label>'
    +'<input class="fi" id="nota_prox" placeholder="Qué hacer después..."></div>'
    +'</div></div>'
    +'<div>'
    +'<div class="fsec" style="margin-bottom:8px">Historial de gestiones</div>'
    +'<div id="nota_historial" class="lst" style="max-height:280px"><div style="color:var(--ink3);font-size:11px">Cargando...</div></div>'
    +'</div></div>';
  // Load previous notes for this credit
  setTimeout(function(){ _renderNotaHistorial(id); }, 60);

  S.saveFn=()=>{
    var tipo = ($('nota_tipo')&&$('nota_tipo').value)||'Gestión';
    var result = ($('nota_result')&&$('nota_result').value.trim())||'';
    var monto = ($('nota_monto')&&$('nota_monto').value)||'';
    var fechaComp = ($('nota_fecha')&&$('nota_fecha').value)||'';
    var prox = ($('nota_prox')&&$('nota_prox').value.trim())||'';
    if(!result){ toast('Describe el resultado de la gestión','error'); return false; }
    var _now = new Date();
    var nota = {
      id: 'NOTA-'+_now.getTime(),
      credId: id,
      tipo: tipo,
      resultado: result,
      montoAcordado: monto ? parseFloat(monto) : null,
      fechaCompromiso: fechaComp,
      proximaAccion: prox,
      fecha: hoyLocalISO(),
      hora: _fmtHora(_now),
      creadoEn: _now.toISOString(),
      cobrador: (S.currentUser&&S.currentUser.nombre)||'Admin'
    };
    if(typeof DB!=='undefined' && DB.addGestion){ DB.addGestion(id, nota); }
    if(typeof logActividad==='function'){ logActividad('Gestión de cobranza','cobranza',id,tipo); }
    toast('Gestión guardada ✓','success');
    closeM(); return true;
  };
  $('mft').innerHTML=`<button class="btn btn-g" onclick="closeM()">Cancelar</button><button class="btn btn-p" onclick="saveM()">Guardar</button>`;
  $('ov').style.display='flex';
}

function _fmtHora(d){ var h=d.getHours(), m=d.getMinutes(), ap=h<12?'am':'pm', h12=h%12; if(h12===0) h12=12; return h12+':'+String(m).padStart(2,'0')+' '+ap; }

// Render del historial de gestiones de un crédito (reutilizable: openNota + tras borrar)
function _renderNotaHistorial(id){
  var el=$('nota_historial'); if(!el) return;
  var c=(S.creds||[]).find(function(x){return String(x.id)===String(id);});
  var list=(c&&Array.isArray(c.gestiones))?c.gestiones.slice():[];
  list.sort(function(a,b){return String(b.creadoEn||b.fecha||'').localeCompare(String(a.creadoEn||a.fecha||''));});
  if(!list.length){ el.innerHTML='<div style="color:var(--ink3);font-size:11px;padding:8px 0">Sin gestiones previas para este crédito</div>'; return; }
  var esc=function(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};
  var admin=(typeof isAdminUser==='function')&&isAdminUser();
  el.innerHTML=list.map(function(n){
    var when=esc(n.fecha)+(n.hora?' · '+esc(n.hora):'');
    var del=admin?'<button onclick="borrarGestion(\''+esc(id)+'\',\''+esc(n.id)+'\')" title="Borrar gestión (solo admin)" style="border:none;background:none;color:var(--ink3);cursor:pointer;font-size:13px;line-height:1;padding:0 2px" onmouseover="this.style.color=\'var(--red)\'" onmouseout="this.style.color=\'var(--ink3)\'">✕</button>':'';
    return '<div style="padding:7px 0;border-bottom:1px solid var(--rim)">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:2px">'
      +'<span style="font-size:11px;font-weight:700;color:var(--p1)">'+esc(n.tipo)+'</span>'
      +'<span style="display:flex;align-items:center;gap:6px"><span style="font-size:10px;color:var(--ink3)">'+when+'</span>'+del+'</span></div>'
      +'<div style="font-size:11.5px;color:var(--ink)">'+esc(n.resultado)+'</div>'
      +(n.fechaCompromiso?'<div style="font-size:10px;color:var(--green);margin-top:2px">Compromiso: '+esc(n.fechaCompromiso)+'</div>':'')
      +(n.montoAcordado?'<div style="font-size:10px;color:var(--ink3)">Monto acordado: $'+esc(n.montoAcordado)+'</div>':'')
      +(n.proximaAccion?'<div style="font-size:10px;color:var(--amber);margin-top:2px">Próxima acción: '+esc(n.proximaAccion)+'</div>':'')
      +'<div style="font-size:10px;color:var(--ink3);margin-top:2px">'+esc(n.cobrador)+'</div>'
      +'</div>';
  }).join('');
}

// Borrar una gestión del historial — SOLO administradores
function borrarGestion(credId, gestionId){
  if(!(typeof isAdminUser==='function' && isAdminUser())){ if(typeof toast==='function') toast('Solo un administrador puede borrar gestiones','error'); return; }
  if(!confirm('¿Borrar esta gestión del historial? No se puede deshacer.')) return;
  if(typeof DB!=='undefined' && DB.delGestion){ DB.delGestion(credId, gestionId); }
  if(typeof logActividad==='function'){ logActividad('Borró gestión de cobranza','cobranza',credId,gestionId); }
  if(typeof toast==='function') toast('Gestión eliminada','success');
  _renderNotaHistorial(credId);
}

// CONTRATO - Dispatcher por tipo de documento

// ── Buscador de "Cuotas Próximas" ─────────────────────────────
// Debounce + re-render del módulo + restaurar el foco del input
// (nav() reconstruye todo el DOM del módulo, así que sin esto el
// usuario perdería el cursor en cada tecla).
function liveSearchCuotas(q){
  S.cuotasQ = q;
  pgSet('cuotas',1);
  clearTimeout(window._cuotasQTimer);
  window._cuotasQTimer = setTimeout(function(){
    nav('pagos');
    setTimeout(function(){
      var i = $('cuotasQ');
      if(i){ i.focus(); try{ var v=i.value; i.setSelectionRange(v.length, v.length); }catch(e){} }
    }, 40);
  }, 350);
}

// ── Buscador del "Registro de pagos" ──────────────────────────
// Debounce + re-render + restaurar foco (nav() reconstruye el DOM).
function liveSearchPagos(q){
  S.pagosQ = q;
  pgSet('pagos',1);
  clearTimeout(window._pagosQTimer);
  window._pagosQTimer = setTimeout(function(){
    nav('pagos');
    setTimeout(function(){
      var i = $('pagosQ');
      if(i){ i.focus(); try{ var v=i.value; i.setSelectionRange(v.length, v.length); }catch(e){} }
    }, 40);
  }, 350);
}

// Filtro rápido de "Cuotas Próximas": todos / atrasados / al día
function setCuotasFilter(f){ S.cuotasFilter = f; pgSet('cuotas',1); nav('pagos'); }
