// Logica de comisiones. Extraido mecanicamente de assets/pagasi-app.js.
var COMISIONES_DEFAULT = {
  activo: true,
  venta: { tipo: 'fijo', valor: 5 },         // $5 por moto vendida
  cobranza: { tipo: 'fijo', valor: 1 }       // $1 por cobranza
};

// Lee la configuraciÛn de comisiones de un usuario, retornando defaults si est· activado pero sin config
function _comGetConfig(u){
  if(!u || !u.comisiones || !u.comisiones.activo) return null;
  var c = u.comisiones;
  return {
    activo: true,
    venta: {
      tipo: (c.venta && c.venta.tipo) || 'fijo',
      valor: parseFloat(c.venta && c.venta.valor != null ? c.venta.valor : COMISIONES_DEFAULT.venta.valor)
    },
    cobranza: {
      tipo: (c.cobranza && c.cobranza.tipo) || 'fijo',
      valor: parseFloat(c.cobranza && c.cobranza.valor != null ? c.cobranza.valor : COMISIONES_DEFAULT.cobranza.valor)
    }
  };
}

// Devuelve la lista de usuarios con comisiones activas
function _comGetUsuariosActivos(){
  var lista = (typeof _usersCache !== 'undefined' && Array.isArray(_usersCache)) ? _usersCache : [];
  return lista.filter(function(u){
    return u && u.comisiones && u.comisiones.activo === true;
  });
}

// ‚îÄ‚îÄ C·lculo de comisiones generadas por un usuario ‚îÄ‚îÄ
// Retorna { porVenta, porCobranza, ventas:[...], cobranzas:[...] }
function _comCalcGenerado(u){
  var cfg = _comGetConfig(u);
  if(!cfg) return { porVenta:0, porCobranza:0, ventas:[], cobranzas:[] };
  var nombre = (u.nombre || u.email || '').trim();
  if(!nombre) return { porVenta:0, porCobranza:0, ventas:[], cobranzas:[] };
  var nombreLow = nombre.toLowerCase();
  // Por venta: crÈditos creados por este usuario
  var ventas = [];
  (S.creds || []).forEach(function(c){
    if(c.eliminado) return;
    if(c.estado === 'cancelado') return; // crÈditos cancelados no pagan comisiÛn
    var creador = (c.creadoPor || '').trim().toLowerCase();
    if(creador !== nombreLow) return;
    var precio = parseFloat(c.precioFinanciado || c.precio || 0) || 0;
    var monto = cfg.venta.tipo === 'porc'
      ? precio * (cfg.venta.valor/100)
      : cfg.venta.valor;
    ventas.push({
      credId: c.id,
      cliente: c.cli,
      modelo: c.modelo || '',
      fecha: c.fecha || c.creadoEn || '',
      precio: precio,
      comision: monto,
      concesionarioId: c.concesionarioId || null
    });
  });
  // Por cobranza: pagos confirmados registrados por este usuario
  var cobranzas = [];
  (S.pagos || []).forEach(function(p){
    if(p.eliminado) return;
    if(p.estado !== 'confirmado') return;
    var quien = (p.cobrador || '').trim().toLowerCase();
    if(quien !== nombreLow) return;
    var monto = cfg.cobranza.tipo === 'porc'
      ? (parseFloat(p.monto)||0) * (cfg.cobranza.valor/100)
      : cfg.cobranza.valor;
    cobranzas.push({
      pagoId: p.id,
      cliente: p.cli,
      fecha: p.fecha || '',
      monto: parseFloat(p.monto)||0,
      comision: monto,
      concesionarioId: p.concesionarioId || null
    });
  });
  return {
    porVenta: ventas.reduce(function(a,v){return a+v.comision;}, 0),
    porCobranza: cobranzas.reduce(function(a,c){return a+c.comision;}, 0),
    ventas: ventas,
    cobranzas: cobranzas
  };
}

// Devuelve desglose de comisiones generadas por concesionario para un usuario
// Retorna un objeto: { 'CONC-XXX': { nombre, porVenta, porCobranza, total, nVentas, nCobranzas }, 'sinAsignar': {...} }
function _comDesglosePorSede(u){
  var gen = _comCalcGenerado(u);
  var out = {};
  function getEntry(concId){
    var key = concId || '_sin';
    if(!out[key]){
      var nombre;
      if(!concId) nombre = 'Sin concesionario';
      else {
        var c = _concGetById ? _concGetById(concId) : null;
        nombre = c ? c.nombre : '(eliminado)';
      }
      out[key] = { id: concId, nombre: nombre, porVenta:0, porCobranza:0, nVentas:0, nCobranzas:0, total:0 };
    }
    return out[key];
  }
  gen.ventas.forEach(function(v){
    var e = getEntry(v.concesionarioId);
    e.porVenta += v.comision;
    e.nVentas += 1;
    e.total += v.comision;
  });
  gen.cobranzas.forEach(function(cb){
    var e = getEntry(cb.concesionarioId);
    e.porCobranza += cb.comision;
    e.nCobranzas += 1;
    e.total += cb.comision;
  });
  // Convertir a array ordenado por total descendente
  return Object.values(out).sort(function(a,b){ return b.total - a.total; });
}

// Devuelve los pagos de comisiones que ya se le hicieron a un usuario (egresos categorÌa 'comisiones')
function _comGetPagosRealizados(u){
  var nombre = (u.nombre || u.email || '').trim().toLowerCase();
  if(!nombre) return [];
  return (S.egresos || []).filter(function(e){
    return !e.eliminado
      && e.categoria === 'comisiones'
      && e.usuarioComisionNombre
      && String(e.usuarioComisionNombre).trim().toLowerCase() === nombre;
  }).sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });
}

// Devuelve TOTAL adeudado al usuario (generado - pagado)
function _comGetSaldo(u){
  var gen = _comCalcGenerado(u);
  var pagado = _comGetPagosRealizados(u).reduce(function(a,e){ return a + (parseFloat(e.monto)||0); }, 0);
  var total = gen.porVenta + gen.porCobranza;
  return {
    generado: total,
    porVenta: gen.porVenta,
    porCobranza: gen.porCobranza,
    pagado: pagado,
    saldo: total - pagado,
    nVentas: gen.ventas.length,
    nCobranzas: gen.cobranzas.length,
    ventas: gen.ventas,
    cobranzas: gen.cobranzas
  };
}

// EstadÌsticas de perÌodo: semana actual, mes actual
function _comStatsRango(u){
  var gen = _comCalcGenerado(u);
  var hoy = new Date();
  var hoyYmd = fechaLocalISO(hoy);
  // Inicio de semana (lunes)
  var diaSem = hoy.getDay() || 7; // domingo = 7
  var lunes = new Date(hoy.getTime() - (diaSem-1)*86400000);
  var lunesYmd = fechaLocalISO(lunes);
  // Inicio de mes
  var primMesYmd = hoy.getFullYear()+'-'+String(hoy.getMonth()+1).padStart(2,'0')+'-01';
  var totalPeriodo = function(items, desde){
    return items.filter(function(it){
      return (it.fecha||'') >= desde && (it.fecha||'') <= hoyYmd;
    }).reduce(function(a,it){ return a + it.comision; }, 0);
  };
  return {
    semana: totalPeriodo(gen.ventas, lunesYmd) + totalPeriodo(gen.cobranzas, lunesYmd),
    mes:    totalPeriodo(gen.ventas, primMesYmd) + totalPeriodo(gen.cobranzas, primMesYmd)
  };
}

// ‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê RENDER PRINCIPAL ‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê
function _comisionesRender(){
  if((typeof _usersCache === 'undefined' || !_usersCache.length) && typeof usersReload === 'function'){
    setTimeout(function(){ usersReload(); setTimeout(function(){ if(S.page==='comisiones') nav('comisiones'); },600); },50);
  }
  var usuarios = _comGetUsuariosActivos();
  var tab = window._comTab || 'vendedores';
  var totalDebe=0, totalPagado=0, totalGenerado=0;
  usuarios.forEach(function(u){ var s=_comGetSaldo(u); totalDebe+=s.saldo; totalPagado+=s.pagado; totalGenerado+=s.generado; });
  var historial = (S.egresos||[]).filter(function(e){ return !e.eliminado && e.categoria==='comisiones'; })
    .sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });

  // Todas las comisiones generadas (ventas + cobranzas) de todos los usuarios
  var todasGeneradas = [];
  usuarios.forEach(function(u){
    var gen = _comCalcGenerado(u);
    var nombre = u.nombre || u.email || 'Usuario';
    gen.ventas.forEach(function(v){
      todasGeneradas.push({ tipo:'venta', usuario:nombre, uid:u.uid, fecha:v.fecha, ref:v.credId, cliente:v.cliente, detalle:v.modelo, base:v.precio, comision:v.comision });
    });
    gen.cobranzas.forEach(function(cb){
      todasGeneradas.push({ tipo:'cobranza', usuario:nombre, uid:u.uid, fecha:cb.fecha, ref:cb.pagoId, cliente:cb.cliente, detalle:'Pago cuota', base:cb.monto, comision:cb.comision });
    });
  });
  todasGeneradas.sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });

  var html = '<div class="page">'
    + pageBanner('Vendedores y cobradores ∑ Pago de comisiones','Comisiones',
        '<b>'+usuarios.length+'</b> usuarios ∑ Por pagar: <b style="color:var(--green)">'+fmt(totalDebe)+'</b> ∑ Pagado: <b>'+fmt(totalPagado)+'</b>',
        [{label:'‚Üì Exportar CSV', onclick:'_comExportarCSV()'},{label:'Actualizar', onclick:'nav(&quot;comisiones&quot;)'}]);

  // KPIs
  html += '<div class="sg" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin-bottom:16px">'
    + '<div class="stat"><div class="st-v" style="color:var(--green);font-size:26px">'+fmt(totalDebe)+'</div><div class="st-l">Por pagar</div></div>'
    + '<div class="stat"><div class="st-v" style="font-size:26px">'+fmt(totalGenerado)+'</div><div class="st-l">Total generado</div></div>'
    + '<div class="stat"><div class="st-v" style="color:var(--amber);font-size:26px">'+fmt(totalPagado)+'</div><div class="st-l">Pagado total</div></div>'
    + '<div class="stat"><div class="st-v" style="font-size:26px">'+todasGeneradas.length+'</div><div class="st-l">Transacciones</div></div>'
    + '</div>';

  // Tab bar
  html += '<div style="display:flex;gap:0;border-bottom:2px solid var(--rim);margin-bottom:16px">'
    + [['vendedores','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;vertical-align:-3px;margin-right:5px"><circle cx="12" cy="8" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/></svg>Vendedores'],['generadas','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;vertical-align:-3px;margin-right:5px"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>Generadas'],['historial','<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;vertical-align:-3px;margin-right:5px"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>Pagos realizados']].map(function(t){
        var act = tab===t[0];
        return '<button onclick="window._comTab=&quot;'+t[0]+'&quot;nav(&quot;comisiones&quot;)" style="background:none;border:none;padding:11px 18px;font-size:13px;font-weight:'+(act?'800':'600')+';color:'+(act?'var(--p1)':'var(--ink3)')+';border-bottom:3px solid '+(act?'var(--p1)':'transparent')+';margin-bottom:-2px;cursor:pointer;font-family:var(--f);transition:color .15s">'+t[1]+'</button>';
      }).join('')
    + '</div>';

  // ‚îÄ‚îÄ Tab: Vendedores ‚îÄ‚îÄ
  if(tab === 'vendedores'){
    html += '<div style="margin-bottom:14px"><div class="srch"><span class="srch-i"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:15px;height:15px"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg></span><input type="text" id="com-search" placeholder="Buscar vendedor..." oninput="_comFiltrar()"></div></div>';
    if(!usuarios.length){
      html += '<div class="empty"><div class="e-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px;opacity:.4"><circle cx="12" cy="8" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/></svg></div><div class="e-tt">Sin usuarios con comisiones activas</div><button class="btn btn-p btn-sm" style="margin-top:14px" onclick="nav(&quot;users&quot;)">Ir a Usuarios</button></div>';
    } else {
      html += '<div id="com-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">';
      usuarios.forEach(function(u){ html += _comTarjetaHtml(u); });
      html += '</div>';
    }

  // ‚îÄ‚îÄ Tab: Comisiones Generadas ‚îÄ‚îÄ
  } else if(tab === 'generadas'){
    if(!todasGeneradas.length){
      html += '<div class="empty"><div class="e-ic"></div><div class="e-tt">Sin comisiones generadas</div><div style="font-size:12px;color:var(--ink3);margin-top:4px">Las comisiones aparecer·n aquÌ cuando se registren ventas y cobranzas.</div></div>';
    } else {
      // Filtro por usuario
      var usuariosUnicos = [];
      var _uSeen = {};
      todasGeneradas.forEach(function(g){ if(!_uSeen[g.uid]){ _uSeen[g.uid]=1; usuariosUnicos.push({uid:g.uid,nombre:g.usuario}); } });
      var filtroU = window._comFiltroUsuario || '';
      var genFiltradas = filtroU ? todasGeneradas.filter(function(g){return g.uid===filtroU;}) : todasGeneradas;
      var totalGenFilt = genFiltradas.reduce(function(a,g){return a+g.comision;},0);
      var totalVentasFilt = genFiltradas.filter(function(g){return g.tipo==='venta';}).reduce(function(a,g){return a+g.comision;},0);
      var totalCobFilt = genFiltradas.filter(function(g){return g.tipo==='cobranza';}).reduce(function(a,g){return a+g.comision;},0);

      // Mini KPIs del filtro
      html += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">'
        + '<select class="fs" style="min-width:180px;font-weight:700;color:var(--p1);border-color:rgba(37,99,235,0.3)" onchange="window._comFiltroUsuario=this.value;nav(&quot;comisiones&quot;)">'
        + '<option value="">Todos los vendedores</option>'
        + usuariosUnicos.map(function(u){ return '<option value="'+u.uid+'" '+(filtroU===u.uid?'selected':'')+'>'+u.nombre+'</option>'; }).join('')
        + '</select>'
        + '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:12px">'
        + '<span style="background:var(--gs);border-radius:20px;padding:5px 12px;font-weight:800;color:var(--p1)">Total: '+fmt(totalGenFilt)+'</span>'
        + '<span style="background:var(--greens);border-radius:20px;padding:5px 12px;font-weight:700;color:var(--green)">Ventas: '+fmt(totalVentasFilt)+'</span>'
        + '<span style="background:var(--blues);border-radius:20px;padding:5px 12px;font-weight:700;color:var(--blue)">Cobranzas: '+fmt(totalCobFilt)+'</span>'
        + '</div>'
        + '</div>'
        + '<div class="card" style="padding:0;overflow:hidden">'
        + '<div class="ch" style="padding:13px 16px;border-bottom:1px solid var(--rim2)">'
        + '<div><div class="ct">Comisiones generadas</div><div class="cs">'+genFiltradas.length+' transacciÛn'+(genFiltradas.length!==1?'es':'')+' ∑ todas las sedes</div></div>'
        + '</div>'
        + '<div style="overflow-x:auto"><table class="tbl"><thead><tr>'
        + '<th style="width:36px"></th>'
        + '<th>Fecha</th>'
        + '<th>Vendedor</th>'
        + '<th>Cliente</th>'
        + '<th>Detalle</th>'
        + '<th style="text-align:right">Base</th>'
        + '<th style="text-align:right">ComisiÛn</th>'
        + '</tr></thead><tbody>'
        + genFiltradas.map(function(g){
            var esVenta = g.tipo === 'venta';
            var iconBg = esVenta ? 'var(--greens)' : 'var(--blues)';
            var iconColor = esVenta ? 'var(--green)' : 'var(--blue)';
            var iconLbl = esVenta ? '∑' : '';
            var inics = g.usuario.split(' ').slice(0,2).map(function(w){return (w[0]||'').toUpperCase();}).join('');
            return '<tr>'
              +'<td><div style="width:32px;height:32px;border-radius:9px;background:'+iconBg+';display:flex;align-items:center;justify-content:center;font-size:14px">'+iconLbl+'</div></td>'
              +'<td style="font-size:11.5px;color:var(--ink3);white-space:nowrap">'+(g.fecha||'ó')+'</td>'
              +'<td><div style="display:flex;align-items:center;gap:7px">'
                +'<div style="width:26px;height:26px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:8.5px;font-weight:900;color:#fff;flex-shrink:0">'+inics+'</div>'
                +'<span style="font-weight:700;font-size:12.5px">'+g.usuario+'</span>'
              +'</div></td>'
              +'<td style="font-size:12px;color:var(--ink2)">'+(g.cliente||'ó')+'</td>'
              +'<td style="font-size:11.5px;color:var(--ink3)">'+(g.detalle||'ó')+'<br><span style="font-size:10px;background:'+iconBg+';color:'+iconColor+';border-radius:10px;padding:1px 7px;font-weight:700">'+(esVenta?'Venta':'Cobranza')+'</span></td>'
              +'<td style="text-align:right;font-size:12px;color:var(--ink3);font-family:var(--fd)">'+fmt(g.base)+'</td>'
              +'<td style="text-align:right;font-family:var(--fd);font-weight:900;font-size:14px;color:var(--green)">+'+fmt(g.comision)+'</td>'
              +'</tr>';
          }).join('')
        + '</tbody></table></div></div>';
    }

  // ‚îÄ‚îÄ Tab: Historial de pagos ‚îÄ‚îÄ
  } else {
    if(!historial.length){
      html += '<div class="empty"><div class="e-ic"></div><div class="e-tt">Sin pagos de comisiones registrados</div><div style="font-size:12px;color:var(--ink3);margin-top:4px">Los pagos aparecer·n aquÌ cuando uses el botÛn "$ Pagar" en cada tarjeta.</div></div>';
    } else {
      // Mini KPIs del historial
      var totalHistorial = historial.reduce(function(a,e){return a+(parseFloat(e.monto)||0);},0);
      var mesActual = new Date().toISOString().slice(0,7);
      var pagosMes = historial.filter(function(e){return (e.fecha||'').startsWith(mesActual);});
      var totalMes = pagosMes.reduce(function(a,e){return a+(parseFloat(e.monto)||0);},0);

      html += '<div class="sg" style="grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">'
        + '<div class="stat"><div class="st-v" style="font-size:26px;color:var(--amber)">'+fmt(totalHistorial)+'</div><div class="st-l">Total pagado histÛrico</div></div>'
        + '<div class="stat"><div class="st-v" style="font-size:26px;color:var(--p1)">'+fmt(totalMes)+'</div><div class="st-l">Pagado este mes</div></div>'
        + '<div class="stat"><div class="st-v" style="font-size:26px">'+historial.length+'</div><div class="st-l">Pagos realizados</div></div>'
        + '</div>'
        + '<div class="card" style="padding:0;overflow:hidden">'
        + '<div class="ch" style="padding:13px 16px;border-bottom:1px solid var(--rim2)">'
        + '<div><div class="ct">Historial de pagos</div><div class="cs">'+historial.length+' pago'+(historial.length!==1?'s':'')+' realizados</div></div>'
        + '<button class="btn btn-g btn-sm" onclick="_comExportarCSV()">‚Üì Exportar CSV</button>'
        + '</div>'
        + '<div style="overflow-x:auto"><table class="tbl"><thead><tr>'
        + '<th style="width:36px"></th>'
        + '<th>Fecha</th>'
        + '<th>Vendedor</th>'
        + '<th style="text-align:right">Monto</th>'
        + '<th>Cuenta / Forma</th>'
        + '<th>Registrado por</th>'
        + '<th>Notas</th>'
        + '<th style="width:36px"></th>'
        + '</tr></thead><tbody>'
        + historial.map(function(e){
            var inics=(e.usuarioComisionNombre||'?').split(' ').slice(0,2).map(function(w){return (w[0]||'').toUpperCase();}).join('');
            var u=(_usersCache||[]).find(function(x){return (x.nombre||x.email||'').toLowerCase()===(e.usuarioComisionNombre||'').toLowerCase();});
            return '<tr>'
              +'<td><div style="width:32px;height:32px;border-radius:9px;background:var(--ambers);display:flex;align-items:center;justify-content:center;font-size:14px"></div></td>'
              +'<td style="font-size:11.5px;color:var(--ink3);white-space:nowrap;font-family:var(--fd)">'+(e.fecha||'ó')+'</td>'
              +'<td><div style="display:flex;align-items:center;gap:7px">'
                +'<div style="width:26px;height:26px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:8.5px;font-weight:900;color:#fff;flex-shrink:0">'+inics+'</div>'
                +'<span style="font-weight:700;font-size:12.5px">'+(e.usuarioComisionNombre||'ó')+'</span>'
              +'</div></td>'
              +'<td style="text-align:right;font-family:var(--fd);font-weight:900;font-size:15px;color:var(--amber)">'+fmt(parseFloat(e.monto)||0)+'</td>'
              +'<td style="font-size:11.5px;color:var(--ink2)">'+(e.forma||e.cuenta||'ó')+'</td>'
              +'<td style="font-size:11px;color:var(--ink3)">'+(e.creadoPor||'ó')+'</td>'
              +'<td style="font-size:11px;color:var(--ink3);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+(e.notas||'ó')+'</td>'
              +'<td><button class="btn btn-d btn-xs" onclick="_comAbrirEliminarPago('+e.id+',&quot;'+(u&&u.uid||'')+'&quot;)">x</button></td>'
              +'</tr>';
          }).join('')
        + '</tbody></table></div></div>';
    }
  }

  html += '</div>';
  return html;
}

function _comExportarCSV(){
  var usuarios = _comGetUsuariosActivos();
  var esc=function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"';};
  var row=function(arr){return arr.map(esc).join(',')+'\n';};
  var rows=[];
  // Resumen
  rows.push(row(['Vendedor','Email','Generado','Por venta','Por cobranza','Pagado','Saldo pendiente','N∫ ventas','N∫ cobranzas']));
  usuarios.forEach(function(u){
    var s=_comGetSaldo(u);
    rows.push(row([u.nombre||u.email||'',u.email||'',s.generado.toFixed(2),s.porVenta.toFixed(2),s.porCobranza.toFixed(2),s.pagado.toFixed(2),s.saldo.toFixed(2),s.nVentas,s.nCobranzas]));
  });
  rows.push(row([]));
  // Historial
  rows.push(row(['=== HISTORIAL DE PAGOS ===']));
  rows.push(row(['Fecha','Vendedor','Monto','Cuenta','Pagado por','Notas']));
  (S.egresos||[]).filter(function(e){return !e.eliminado&&e.categoria==='comisiones';})
    .sort(function(a,b){return (b.fecha||'').localeCompare(a.fecha||'');})
    .forEach(function(e){ rows.push(row([e.fecha||'',e.usuarioComisionNombre||'',(parseFloat(e.monto)||0).toFixed(2),e.forma||e.cuenta||'',e.creadoPor||'',e.notas||''])); });
  rows.push(row([]));
  // Detalle ventas
  rows.push(row(['=== DETALLE DE VENTAS ===']));
  rows.push(row(['Vendedor','CrÈdito','Cliente','Modelo','Fecha','Precio','ComisiÛn']));
  usuarios.forEach(function(u){
    var gen=_comCalcGenerado(u);
    gen.ventas.forEach(function(v){ rows.push(row([u.nombre||u.email||'',v.credId,v.cliente,v.modelo,v.fecha,(v.precio||0).toFixed(2),(v.comision||0).toFixed(2)])); });
  });
  var csv=rows.join('');
  var blob=new Blob(['Ôªø'+csv],{type:'text/csv;charset=utf-8;'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download='comisiones-'+hoyLocalISO()+'.csv'; a.click();
  URL.revokeObjectURL(url);
  toast('CSV descargado','success');
}
// Tarjeta individual de usuario ó compacta, igual estilo que cards de cuentas
function _comTarjetaHtml(u){
  var cfg = _comGetConfig(u);
  if(!cfg) return '';
  var s = _comGetSaldo(u);
  var st = _comStatsRango(u);
  var nombre = (u.nombre || u.email || 'Usuario');
  var nombreEsc = nombre.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  var inics = nombre.split(' ').slice(0,2).map(function(w){return (w[0]||'').toUpperCase();}).join('');
  var ventaLbl = cfg.venta.tipo === 'porc' ? cfg.venta.valor+'%' : '$'+cfg.venta.valor;
  var cobroLbl = cfg.cobranza.tipo === 'porc' ? cfg.cobranza.valor+'%' : '$'+cfg.cobranza.valor;
  var debeColor = s.saldo > 0 ? 'var(--green)' : 'var(--ink3)';
  var accentColor = s.saldo > 0 ? 'var(--green)' : 'var(--p1)';
  var pctPagado = s.generado > 0 ? Math.round((s.pagado/s.generado)*100) : 0;

  // Desglose por sede para mostrar en la card
  var desglose = (typeof _comDesglosePorSede === 'function') ? _comDesglosePorSede(u) : [];
  var desgloseHtml = '';
  if(desglose.length > 1){
    desgloseHtml = '<div style="border-top:1px solid var(--rim2);margin:10px 0;padding-top:10px">'
      + '<div style="font-size:9px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:7px">Por sede</div>'
      + '<div style="display:flex;flex-direction:column;gap:5px">'
      + desglose.map(function(d){
          var pctSede = s.generado > 0 ? Math.round((d.total/s.generado)*100) : 0;
          return '<div style="display:flex;align-items:center;gap:8px">'
            + '<div style="font-size:11px;font-weight:700;color:var(--ink2);min-width:0;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+d.nombre+'</div>'
            + '<div style="font-size:10px;color:var(--ink3);flex-shrink:0">'+d.nVentas+'V ∑ '+d.nCobranzas+'C</div>'
            + '<div style="font-family:var(--fd);font-weight:800;font-size:11.5px;color:var(--ink1);flex-shrink:0;min-width:52px;text-align:right">$'+d.total.toFixed(2)+'</div>'
          + '</div>'
          + '<div style="height:3px;background:var(--rim);border-radius:2px;overflow:hidden;margin-top:2px">'
            + '<div style="height:100%;width:'+pctSede+'%;background:var(--grad);border-radius:2px"></div>'
          + '</div>';
        }).join('')
      + '</div></div>';
  }

  return '<div class="com-card card" data-nombre="'+nombreEsc.toLowerCase()+'" style="cursor:default;padding:16px 18px">'

    // Fila 1: avatar + nombre + "por pagar" prominente
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">'
      + '<div style="width:40px;height:40px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#fff;flex-shrink:0">'+inics+'</div>'
      + '<div style="flex:1;min-width:0">'
        + '<div style="font-weight:800;font-size:13.5px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+nombre+'</div>'
        + '<div style="display:flex;gap:4px;margin-top:3px;flex-wrap:wrap">'
          + '<span style="background:var(--gs);color:var(--p1);padding:2px 7px;border-radius:10px;font-size:9.5px;font-weight:800">∑ '+ventaLbl+'</span>'
          + '<span style="background:var(--greens);color:var(--green);padding:2px 7px;border-radius:10px;font-size:9.5px;font-weight:800"> '+cobroLbl+'</span>'
        + '</div>'
      + '</div>'
    + '</div>'

    // Total por pagar ó protagonista
    + '<div style="background:'+(s.saldo>0?'rgba(0,184,118,0.08)':'var(--gs)')+';border:1px solid '+(s.saldo>0?'rgba(0,184,118,0.25)':'var(--rim)')+';border-radius:10px;padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">'
      + '<div>'
        + '<div style="font-size:9px;color:var(--ink3);font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">Total por pagar</div>'
        + '<div style="font-family:var(--fd);font-size:24px;font-weight:900;color:'+debeColor+';line-height:1;letter-spacing:-1px">'+fmt(s.saldo)+'</div>'
      + '</div>'
      + '<div style="text-align:right">'
        + '<div style="font-size:9px;color:var(--ink3);font-weight:700;text-transform:uppercase;letter-spacing:.4px">Generado</div>'
        + '<div style="font-family:var(--fd);font-weight:800;font-size:13px">'+fmt(s.generado)+'</div>'
        + '<div style="font-size:9px;color:var(--amber);font-weight:700;margin-top:2px">Pagado: '+fmt(s.pagado)+'</div>'
      + '</div>'
    + '</div>'

    // Stats r·pidas
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:10px">'
      + '<div style="background:var(--surf2);border-radius:8px;padding:7px 9px;text-align:center">'
        + '<div style="font-size:9px;color:var(--ink3);font-weight:700;text-transform:uppercase;letter-spacing:.3px">Ventas</div>'
        + '<div style="font-weight:900;font-size:15px;color:var(--p1)">'+s.nVentas+'</div>'
      + '</div>'
      + '<div style="background:var(--surf2);border-radius:8px;padding:7px 9px;text-align:center">'
        + '<div style="font-size:9px;color:var(--ink3);font-weight:700;text-transform:uppercase;letter-spacing:.3px">Cobros</div>'
        + '<div style="font-weight:900;font-size:15px;color:var(--green)">'+s.nCobranzas+'</div>'
      + '</div>'
      + '<div style="background:var(--surf2);border-radius:8px;padding:7px 9px;text-align:center">'
        + '<div style="font-size:9px;color:var(--ink3);font-weight:700;text-transform:uppercase;letter-spacing:.3px">Este mes</div>'
        + '<div style="font-weight:900;font-size:15px;color:var(--amber)">'+fmt(st.mes)+'</div>'
      + '</div>'
    + '</div>'

    // Barra de progreso global
    + '<div style="height:4px;background:var(--rim);border-radius:2px;overflow:hidden;margin-bottom:2px">'
      + '<div style="height:100%;width:'+pctPagado+'%;background:var(--grad);border-radius:2px;transition:width .4s"></div>'
    + '</div>'
    + '<div style="font-size:10px;color:var(--ink3);text-align:right;margin-bottom:8px">'+pctPagado+'% pagado</div>'

    // Desglose por sede (si hay m·s de una)
    + desgloseHtml

    // Botones
    + '<div style="display:flex;gap:6px;border-top:1px solid var(--rim2);padding-top:10px">'
      + '<button class="btn btn-g btn-sm" style="flex:1" onclick="_comAbrirDetalle(\''+u.uid+'\')">Ver detalle</button>'
      + '<button class="btn btn-p btn-sm" style="flex:1" onclick="_comAbrirPagar(\''+u.uid+'\')" '+(s.saldo<=0?'disabled style="opacity:.4;cursor:not-allowed"':'')+'>$ Pagar</button>'
    + '</div>'
  + '</div>';
}
// Filtrado por buscador
function _comFiltrar(){
  var q = (($('com-search')&&$('com-search').value)||'').toLowerCase().trim();
  document.querySelectorAll('.com-card').forEach(function(card){
    var nm = (card.getAttribute('data-nombre')||'');
    card.style.display = (!q || nm.indexOf(q) !== -1) ? '' : 'none';
  });
}

// ‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê MODAL: PAGAR COMISI”N ‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê
function _comAbrirPagar(uid){
  var u = (_usersCache||[]).find(function(x){return x.uid===uid;});
  if(!u){ toast('Usuario no encontrado','error'); return; }
  var s = _comGetSaldo(u);
  if(s.saldo <= 0){ toast('Este usuario no tiene saldo pendiente','info'); return; }
  var cuentas = (typeof _cuentasBanc !== 'undefined' && _cuentasBanc) ? _cuentasBanc : [];
  if(!cuentas.length){ toast('No hay cuentas bancarias configuradas','error'); return; }
  setMicon('comision');
  $('mtt').textContent='Pagar ComisiÛn';
  $('msb').textContent=u.nombre || u.email;
  $('modal-box').className='modal';
  // Lista de cuentas con saldos
  var cuentasOpts = cuentas.map(function(c){
    var saldo = (typeof saldoCuenta === 'function') ? saldoCuenta(c.nombre) : 0;
    var mon = (c.moneda||'USD').toUpperCase()==='BS' ? 'Bs' : '$';
    return '<option value="'+c.nombre.replace(/"/g,'&quot;')+'" data-saldo="'+saldo+'">'
      + c.nombre + ' (' + mon + ' ' + saldo.toFixed(2) + ')'
      + '</option>';
  }).join('');
  $('mbd').innerHTML = ''
    + '<div style="background:rgba(0,184,118,0.08);border:1px solid rgba(0,184,118,0.25);border-radius:9px;padding:11px 13px;margin-bottom:14px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center">'
    + '<div><div style="font-size:10px;font-weight:800;color:var(--ink3);text-transform:uppercase;letter-spacing:.5px">Saldo a pagar</div>'
    + '<div style="font-family:var(--fd);font-weight:800;font-size:22px;color:var(--green)">$ '+s.saldo.toFixed(2)+'</div></div>'
    + '<div style="text-align:right;font-size:10.5px;color:var(--ink3)">Generado: $'+s.generado.toFixed(2)+'<br>Pagado: $'+s.pagado.toFixed(2)+'</div>'
    + '</div></div>'
    + '<div class="fgr c1" style="gap:10px">'
    + '<div class="fg"><label>Monto a pagar <span style="color:var(--red)">*</span></label>'
    + '<input class="fi" type="number" step="0.01" min="0.01" max="'+s.saldo+'" id="comp_monto" value="'+s.saldo.toFixed(2)+'" oninput="_comValidarPago()">'
    + '<div style="font-size:10.5px;color:var(--ink3);margin-top:3px">Puedes pagar parcial o total. M·ximo: $'+s.saldo.toFixed(2)+'</div></div>'
    + '<div class="fg"><label>Cuenta de origen <span style="color:var(--red)">*</span></label>'
    + '<select class="fs" id="comp_cuenta" onchange="_comValidarPago()">'+cuentasOpts+'</select>'
    + '<div id="comp_saldo_warn" style="font-size:10.5px;margin-top:3px;color:var(--ink3)"></div></div>'
    + '<div class="fg"><label>Fecha</label>'
    + '<input class="fi" type="date" id="comp_fecha" value="'+(hoyLocalISO())+'"></div>'
    + '<div class="fg"><label>Notas (opcional)</label>'
    + '<textarea class="fi" id="comp_notas" rows="2" placeholder="Ej: Pago de comisiones primera quincena"></textarea></div>'
    + '</div>';
  $('mft').innerHTML = '<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    + '<button class="btn btn-p" id="comp_btn_save" onclick="_comGuardarPago(\''+uid+'\')">Pagar comisiÛn</button>';
  $('ov').style.display='flex';
  setTimeout(_comValidarPago, 50);
}

// ValidaciÛn en vivo del modal de pago
function _comValidarPago(){
  var monto = parseFloat(($('comp_monto')&&$('comp_monto').value)||0)||0;
  var sel = $('comp_cuenta');
  var btn = $('comp_btn_save');
  var warn = $('comp_saldo_warn');
  if(!sel || !btn) return;
  var opt = sel.options[sel.selectedIndex];
  var saldoCta = parseFloat(opt && opt.getAttribute('data-saldo') || 0)||0;
  if(monto <= 0){
    if(warn){ warn.textContent='Ingresa un monto v·lido'; warn.style.color='var(--red)'; }
    btn.disabled = true; btn.style.opacity='.5';
    return;
  }
  if(monto > saldoCta){
    if(warn){ warn.innerHTML='‚ö† Saldo insuficiente ∑ Cuenta tiene <b>$'+saldoCta.toFixed(2)+'</b>'; warn.style.color='var(--red)'; }
    btn.disabled = true; btn.style.opacity='.5';
    return;
  }
  if(warn){ warn.innerHTML='Saldo disponible: <b>$'+saldoCta.toFixed(2)+'</b>'; warn.style.color='var(--ink3)'; }
  btn.disabled = false; btn.style.opacity='1';
}

// Guardar pago de comisiÛn
function _comGuardarPago(uid){
  var u = (_usersCache||[]).find(function(x){return x.uid===uid;});
  if(!u){ toast('Usuario no encontrado','error'); return; }
  var monto = parseFloat(($('comp_monto')&&$('comp_monto').value)||0)||0;
  var cuenta = ($('comp_cuenta')&&$('comp_cuenta').value)||'';
  var fecha = ($('comp_fecha')&&$('comp_fecha').value)||hoyLocalISO();
  var notas = ($('comp_notas')&&$('comp_notas').value)||'';
  if(monto <= 0){ toast('Monto inv·lido','error'); return; }
  if(!cuenta){ toast('Selecciona una cuenta','error'); return; }
  // Validar saldo
  var saldoCta = (typeof saldoCuenta === 'function') ? saldoCuenta(cuenta) : 0;
  if(monto > saldoCta + 0.001){ toast('Saldo insuficiente en '+cuenta,'error'); return; }
  // Validar saldo del usuario
  var s = _comGetSaldo(u);
  if(monto > s.saldo + 0.001){ toast('El monto excede lo adeudado ($'+s.saldo.toFixed(2)+')','error'); return; }
  var hora = new Date().toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit',hour12:false});
  var quien = (S.currentUser&&S.currentUser.nombre)||'Admin';
  // 1) Crear egreso
  var newEgId = (S.egresos&&S.egresos.length)
    ? Math.max.apply(null, S.egresos.map(function(x){return parseInt(x.id)||0;}))+1
    : 1;
  var concepto = 'Pago de comisiÛn ∑ '+(u.nombre||u.email);
  var newEg = {
    id: newEgId,
    concepto: concepto,
    monto: monto,
    fecha: fecha,
    categoria: 'comisiones',
    forma: cuenta,
    notas: notas,
    usuarioComisionUid: uid,
    usuarioComisionNombre: u.nombre || u.email || '',
    origenAuto: 'comision',
    eliminado: false,
    creadoPor: quien,
    creadoEn: new Date().toISOString()
  };
  if(S.egresos) S.egresos.push(newEg);
  if(DB && DB.saveEgreso) DB.saveEgreso(newEg);
  // 2) Crear movimiento de retiro
  var mov = {
    id: 'MOV-COM-'+uid+'-'+Date.now(),
    tipo: 'retiro',
    tipoOperacion: 'comision',
    concepto: 'Egreso ∑ ' + concepto,
    monto: monto,
    cuentaOrigen: cuenta,
    cuentaDestino: null,
    fecha: fecha,
    referencia: notas,
    realizadoPor: quien,
    tasaBs: window._tasaBsGlobal||1,
    hora: hora,
    usuarioComisionUid: uid,
    usuarioComisionNombre: u.nombre || u.email || '',
    conceptoEgreso: newEg.id
  };
  if(S.movimientos) S.movimientos.push(mov);
  if(DB && DB.saveMovimiento) DB.saveMovimiento(mov);
  closeM();
  toast('ComisiÛn pagada ∑ $'+monto.toFixed(2),'success');
  if(S.page === 'comisiones') nav('comisiones');
}

// ‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê MODAL: DETALLE ‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê
function _comAbrirDetalle(uid){
  var u = (_usersCache||[]).find(function(x){return x.uid===uid;});
  if(!u){ toast('Usuario no encontrado','error'); return; }
  var s = _comGetSaldo(u);
  var pagosRealizados = _comGetPagosRealizados(u);
  setMicon('detalle');
  $('mtt').textContent='Detalle ∑ '+(u.nombre||u.email);
  $('msb').textContent='Comisiones generadas y pagos';
  $('modal-box').className='modal modal-lg';
  // PestaÒas internas: ventas / cobranzas / pagos
  var tabActual = window._comDetalleTab || 'ventas';
  var tabBtn = function(id, label, count){
    var act = tabActual === id;
    return '<button onclick="_comDetalleSetTab(\''+id+'\',\''+uid+'\')" style="background:none;border:none;padding:9px 16px;font-size:12px;font-weight:'+(act?'800':'600')+';color:'+(act?'var(--p1)':'var(--ink3)')+';border-bottom:3px solid '+(act?'var(--p1)':'transparent')+';margin-bottom:-2px;cursor:pointer;font-family:var(--f)">'
      + label + ' <span style="background:var(--gs);color:var(--ink2);font-size:10px;padding:1px 7px;border-radius:9px;margin-left:4px">'+count+'</span>'
      + '</button>';
  };
  var contenido = '';
  if(tabActual === 'ventas'){
    contenido = s.ventas.length === 0
      ? '<div style="padding:40px;text-align:center;color:var(--ink3);font-size:12.5px">Sin ventas registradas</div>'
      : '<div class="tw" style="overflow-x:auto"><table style="font-size:11.5px;min-width:600px">'
        + '<thead><tr style="background:var(--gs)"><th style="padding:8px;text-align:left">Fecha</th><th style="padding:8px;text-align:left">CrÈdito</th><th style="padding:8px;text-align:left">Cliente</th><th style="padding:8px;text-align:left">Modelo</th><th style="padding:8px;text-align:right">Precio</th><th style="padding:8px;text-align:right">ComisiÛn</th></tr></thead>'
        + '<tbody>' + s.ventas.map(function(v){
          return '<tr style="border-bottom:1px solid var(--rim2)">'
            + '<td style="padding:6px 8px">'+(v.fecha||'').slice(0,10)+'</td>'
            + '<td style="padding:6px 8px;font-family:var(--fd);font-size:10.5px">'+v.credId+'</td>'
            + '<td style="padding:6px 8px">'+v.cliente+'</td>'
            + '<td style="padding:6px 8px;color:var(--ink3);font-size:10.5px">'+v.modelo+'</td>'
            + '<td style="padding:6px 8px;text-align:right;font-family:var(--fd)">$'+v.precio.toFixed(2)+'</td>'
            + '<td style="padding:6px 8px;text-align:right;font-family:var(--fd);color:var(--p1);font-weight:700">$'+v.comision.toFixed(2)+'</td>'
            + '</tr>';
        }).join('') + '</tbody></table></div>';
  } else if(tabActual === 'cobranzas'){
    contenido = s.cobranzas.length === 0
      ? '<div style="padding:40px;text-align:center;color:var(--ink3);font-size:12.5px">Sin cobranzas registradas</div>'
      : '<div class="tw" style="overflow-x:auto"><table style="font-size:11.5px;min-width:600px">'
        + '<thead><tr style="background:var(--gs)"><th style="padding:8px;text-align:left">Fecha</th><th style="padding:8px;text-align:left">Pago</th><th style="padding:8px;text-align:left">Cliente</th><th style="padding:8px;text-align:right">Monto pagado</th><th style="padding:8px;text-align:right">ComisiÛn</th></tr></thead>'
        + '<tbody>' + s.cobranzas.map(function(c){
          return '<tr style="border-bottom:1px solid var(--rim2)">'
            + '<td style="padding:6px 8px">'+(c.fecha||'').slice(0,10)+'</td>'
            + '<td style="padding:6px 8px;font-family:var(--fd);font-size:10.5px">'+c.pagoId+'</td>'
            + '<td style="padding:6px 8px">'+c.cliente+'</td>'
            + '<td style="padding:6px 8px;text-align:right;font-family:var(--fd)">$'+c.monto.toFixed(2)+'</td>'
            + '<td style="padding:6px 8px;text-align:right;font-family:var(--fd);color:var(--green);font-weight:700">$'+c.comision.toFixed(2)+'</td>'
            + '</tr>';
        }).join('') + '</tbody></table></div>';
  } else { // pagos
    contenido = pagosRealizados.length === 0
      ? '<div style="padding:40px;text-align:center;color:var(--ink3);font-size:12.5px">A˙n no se le ha pagado ninguna comisiÛn</div>'
      : '<div class="tw" style="overflow-x:auto"><table style="font-size:11.5px;min-width:700px">'
        + '<thead><tr style="background:var(--gs)"><th style="padding:8px;text-align:left">Fecha</th><th style="padding:8px;text-align:left">Cuenta</th><th style="padding:8px;text-align:right">Monto</th><th style="padding:8px;text-align:left">Notas</th><th style="padding:8px;text-align:left">Pagado por</th><th style="padding:8px;text-align:center">AcciÛn</th></tr></thead>'
        + '<tbody>' + pagosRealizados.map(function(e){
          return '<tr style="border-bottom:1px solid var(--rim2)">'
            + '<td style="padding:6px 8px">'+(e.fecha||'').slice(0,10)+'</td>'
            + '<td style="padding:6px 8px">'+(e.forma||'ó')+'</td>'
            + '<td style="padding:6px 8px;text-align:right;font-family:var(--fd);color:var(--p1);font-weight:700">$'+(parseFloat(e.monto)||0).toFixed(2)+'</td>'
            + '<td style="padding:6px 8px;color:var(--ink3);font-size:10.5px">'+(e.notas||'ó')+'</td>'
            + '<td style="padding:6px 8px;color:var(--ink3);font-size:10.5px">'+(e.creadoPor||'ó')+'</td>'
            + '<td style="padding:6px 8px;text-align:center"><button class="btn btn-d btn-xs" onclick="_comAbrirEliminarPago('+e.id+',\''+uid+'\')">Eliminar</button></td>'
            + '</tr>';
        }).join('') + '</tbody></table></div>';
  }
  $('mbd').innerHTML = ''
    // Resumen arriba
    + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">'
    + '<div style="background:var(--gs);padding:10px;border-radius:8px"><div style="font-size:9px;font-weight:800;color:var(--ink3);text-transform:uppercase">Generado</div><div style="font-family:var(--fd);font-weight:800;font-size:14px;margin-top:2px">$'+s.generado.toFixed(2)+'</div></div>'
    + '<div style="background:var(--gs);padding:10px;border-radius:8px"><div style="font-size:9px;font-weight:800;color:var(--ink3);text-transform:uppercase">Pagado</div><div style="font-family:var(--fd);font-weight:800;font-size:14px;color:var(--p1);margin-top:2px">$'+s.pagado.toFixed(2)+'</div></div>'
    + '<div style="background:var(--gs);padding:10px;border-radius:8px"><div style="font-size:9px;font-weight:800;color:var(--ink3);text-transform:uppercase">Por pagar</div><div style="font-family:var(--fd);font-weight:800;font-size:14px;color:var(--green);margin-top:2px">$'+s.saldo.toFixed(2)+'</div></div>'
    + '<div style="background:var(--gs);padding:10px;border-radius:8px"><div style="font-size:9px;font-weight:800;color:var(--ink3);text-transform:uppercase">Operaciones</div><div style="font-family:var(--fd);font-weight:800;font-size:14px;margin-top:2px">'+(s.nVentas+s.nCobranzas)+'</div></div>'
    + '</div>'
    // Desglose por sede (OpciÛn C ó siempre visible si hay sedes)
    + (function(){
        var desglose = _comDesglosePorSede(u);
        if(!desglose.length) return '';
        return '<div style="background:rgba(74,107,255,0.05);border:1px solid rgba(74,107,255,0.18);border-radius:12px;padding:13px 15px;margin-bottom:16px">'
          + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
            + '<div style="font-size:10px;font-weight:800;color:var(--p1);text-transform:uppercase;letter-spacing:.5px">Desglose por sede</div>'
            + '<div style="font-size:10px;color:var(--ink3)">Total: <b style="color:var(--ink1)">$'+s.saldo.toFixed(2)+'</b></div>'
          + '</div>'
          + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px">'
          + desglose.map(function(d){
              var pctSede = s.generado > 0 ? Math.round((d.total/s.generado)*100) : 0;
              return '<div style="background:var(--surf);border:1px solid var(--rim2);border-radius:9px;padding:10px 12px">'
                + '<div style="font-weight:800;font-size:12px;color:var(--ink1);margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+d.nombre+'</div>'
                + '<div style="font-family:var(--fd);font-size:18px;font-weight:900;color:var(--p1);line-height:1;margin-bottom:6px">$'+d.total.toFixed(2)+'</div>'
                + '<div style="display:flex;gap:8px;margin-bottom:7px">'
                  + '<span style="font-size:10px;color:var(--ink3)">∑ <b>'+d.nVentas+'</b> venta'+(d.nVentas===1?'':'s')+' ∑ $'+d.porVenta.toFixed(2)+'</span>'
                + '</div>'
                + '<div style="font-size:10px;color:var(--ink3);margin-bottom:7px"> <b>'+d.nCobranzas+'</b> cobro'+(d.nCobranzas===1?'':'s')+' ∑ $'+d.porCobranza.toFixed(2)+'</div>'
                + '<div style="height:3px;background:var(--rim);border-radius:2px;overflow:hidden">'
                  + '<div style="height:100%;width:'+pctSede+'%;background:var(--grad);border-radius:2px"></div>'
                + '</div>'
                + '<div style="font-size:9px;color:var(--ink3);margin-top:3px;text-align:right">'+pctSede+'% del total</div>'
              + '</div>';
            }).join('')
          + '</div>'
          + '<div style="font-size:10px;color:var(--ink3);margin-top:10px;font-style:italic;text-align:center">El pago se realiza en un solo desembolso sobre el total adeudado, independientemente de la sede.</div>'
          + '</div>';
      })()
    // Tabs
    + '<div style="display:flex;border-bottom:2px solid var(--rim);margin-bottom:12px">'
    + tabBtn('ventas', 'Ventas', s.nVentas)
    + tabBtn('cobranzas', 'Cobranzas', s.nCobranzas)
    + tabBtn('pagos', 'Pagos realizados', pagosRealizados.length)
    + '</div>'
    // Contenido
    + contenido;
  $('mft').innerHTML = '<button class="btn btn-g" onclick="closeM()">Cerrar</button>'
    + (s.saldo > 0 ? '<button class="btn btn-p" onclick="closeM();_comAbrirPagar(\''+uid+'\')">$ Pagar $'+s.saldo.toFixed(2)+'</button>' : '');
  $('ov').style.display='flex';
}

function _comDetalleSetTab(tab, uid){
  window._comDetalleTab = tab;
  _comAbrirDetalle(uid);
}

// ‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê MODAL: ELIMINAR PAGO DE COMISI”N ‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê
function _comAbrirEliminarPago(egId, uid){
  var eg = (S.egresos||[]).find(function(x){return x.id === egId || x.id === Number(egId);});
  if(!eg){ toast('Egreso no encontrado','error'); return; }
  setMicon('eliminar');
  $('mtt').textContent='Eliminar Pago de ComisiÛn';
  $('msb').textContent='$'+(parseFloat(eg.monto)||0).toFixed(2);
  $('modal-box').className='modal';
  $('mbd').innerHTML = ''
    + '<div style="background:rgba(255,71,87,0.08);border:1px solid rgba(255,71,87,0.25);border-radius:9px;padding:11px 13px;margin-bottom:14px;font-size:12px;line-height:1.55">'
    + '<strong style="color:var(--red)">‚ö† AtenciÛn:</strong> Est·s a punto de eliminar el pago de comisiÛn de <b>'+(eg.usuarioComisionNombre||'usuario')+'</b> '
    + 'realizado el <b>'+eg.fecha+'</b> desde la cuenta <b>'+eg.forma+'</b> por <b>$'+(parseFloat(eg.monto)||0).toFixed(2)+'</b>.'
    + '</div>'
    + '<div class="fg"><label>RazÛn <span style="color:var(--red)">*</span></label>'
    + '<textarea class="fi" id="cdel_razon" rows="2" placeholder="Ej: Error en el monto, pago duplicado, etc."></textarea></div>'
    + '<div style="margin-top:14px">'
    + '<div style="font-size:11px;font-weight:800;color:var(--ink2);margin-bottom:8px">øQuÈ hacer con el dinero?</div>'
    + '<label style="display:flex;align-items:flex-start;gap:9px;padding:11px;border:2px solid var(--green);border-radius:10px;cursor:pointer;background:rgba(0,184,118,.05);margin-bottom:7px">'
    + '<input type="radio" name="cdel_dev" value="si" checked style="margin-top:3px;accent-color:var(--green);flex-shrink:0">'
    + '<div><div style="font-size:13px;font-weight:700;color:var(--green)">Devolver el dinero a la cuenta</div>'
    + '<div style="font-size:11px;color:var(--ink3);margin-top:2px;line-height:1.5">Se hace reverso del retiro y la deuda con el vendedor se vuelve a cargar (volver· a aparecer "se le debe").</div></div>'
    + '</label>'
    + '<label style="display:flex;align-items:flex-start;gap:9px;padding:11px;border:2px solid var(--rim);border-radius:10px;cursor:pointer">'
    + '<input type="radio" name="cdel_dev" value="no" style="margin-top:3px;accent-color:var(--ink2);flex-shrink:0">'
    + '<div><div style="font-size:13px;font-weight:700;color:var(--ink1)">No devolver ó solo eliminar el registro</div>'
    + '<div style="font-size:11px;color:var(--ink3);margin-top:2px;line-height:1.5">El egreso queda contabilizado pero sin asociarse al usuario. La deuda sigue saldada (no le debes al vendedor).</div></div>'
    + '</label>'
    + '</div>';
  $('mft').innerHTML = '<button class="btn btn-g" onclick="_comAbrirDetalle(\''+uid+'\')">Cancelar</button>'
    + '<button class="btn btn-d" onclick="_comConfirmarEliminarPago('+eg.id+',\''+uid+'\')">Eliminar pago</button>';
  $('ov').style.display='flex';
}

function _comConfirmarEliminarPago(egId, uid){
  var idx = (S.egresos||[]).findIndex(function(x){return x.id === egId || x.id === Number(egId);});
  if(idx < 0){ toast('Egreso no encontrado','error'); return; }
  var razon = ($('cdel_razon')&&$('cdel_razon').value||'').trim();
  if(!razon){ toast('Indica la razÛn de eliminaciÛn','error'); return; }
  var devolver = (document.querySelector('input[name="cdel_dev"]:checked')||{}).value === 'si';
  var eg = S.egresos[idx];
  var quien = (S.currentUser&&S.currentUser.nombre)||'Admin';
  var ahora = new Date().toISOString();
  // Marcar egreso como eliminado
  eg.eliminado = true;
  eg.eliminadoPor = quien;
  eg.eliminadoEn = ahora;
  eg.eliminadoRazon = razon;
  eg.devolvioDinero = devolver;
  if(!devolver){
    // Si no se devuelve el dinero, "desasociar" del usuario para que no afecte su saldo
    // pero conservamos el egreso (el dinero ya saliÛ de la caja)
    eg.usuarioComisionDesasociado = true;
    eg.usuarioComisionUid = '';
    eg.usuarioComisionNombre = '';
    // Cambiar categorÌa para que no aparezca como comisiÛn activa
    eg.categoria = 'comisiones_anulada';
  }
  if(DB && DB.saveEgreso) DB.saveEgreso(eg);
  // Buscar y manejar el movimiento asociado
  var mov = (S.movimientos||[]).find(function(m){
    return !m.eliminado && m.tipoOperacion === 'comision' && m.conceptoEgreso === egId;
  });
  if(mov){
    mov.eliminado = true;
    mov.eliminadoPor = quien;
    mov.eliminadoEn = ahora;
    mov.eliminadoRazon = razon;
    if(DB && DB.saveMovimiento) DB.saveMovimiento(mov);
    if(devolver){
      // Crear movimiento de reverso (depÛsito a la cuenta original)
      var rev = {
        id: 'MOV-COMREV-'+egId+'-'+Date.now(),
        tipo: 'deposito',
        tipoOperacion: 'comision_reverso',
        concepto: 'Reverso ∑ ' + (mov.concepto||''),
        monto: parseFloat(eg.monto)||0,
        cuentaOrigen: null,
        cuentaDestino: mov.cuentaOrigen,
        fecha: hoyLocalISO(),
        referencia: 'Reverso por eliminaciÛn ∑ ' + razon,
        realizadoPor: quien,
        tasaBs: window._tasaBsGlobal||1,
        hora: new Date().toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit',hour12:false}),
        reversoDe: 'comision:'+egId,
        usuarioComisionUid: uid
      };
      if(S.movimientos) S.movimientos.push(rev);
      if(DB && DB.saveMovimiento) DB.saveMovimiento(rev);
    }
  }
  closeM();
  toast(devolver ? 'Pago eliminado y dinero devuelto a la cuenta' : 'Pago eliminado (dinero no devuelto)', devolver?'success':'info');
  if(S.page === 'comisiones') nav('comisiones');
}

// ‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê INTEGRACI”N CON PERFIL DE USUARIO ‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê
// Esta funciÛn se llama desde el modal "Editar Permisos" para guardar la config de comisiones
function _comGuardarConfigUsuario(uid, config){
  if(!DB || !DB.updateUsuario) return;
  DB.updateUsuario(uid, { comisiones: config });
  // Actualizar cache local
  try{
    if(typeof _usersCache !== 'undefined' && Array.isArray(_usersCache)){
      var cached = _usersCache.find(function(x){ return x.uid === uid; });
      if(cached){ cached.comisiones = config; }
    }
  }catch(e){}
}

// Toggle del checkbox "Gana comisiones" en el modal de editar usuario
function _euComToggle(){
  var box = $('eu_com_box');
  var chk = $('eu_com_activo');
  if(box && chk){
    box.style.display = chk.checked ? 'block' : 'none';
  }
}


// ‚ïî‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ïó
// ‚ïë  M”DULO CONCESIONARIOS                                    ‚ïë
// ‚ïë  - CRUD de sedes/puntos de venta                          ‚ïë
// ‚ïë  - AsignaciÛn de usuarios a m˙ltiples concesionarios      ‚ïë
// ‚ïë  - Switcher en header para alternar concesionario activo  ‚ïë
// ‚ïë  ENTREGA 2: Filtros autom·ticos + asignaciÛn histÛrica.   ‚ïë
// ‚ïë  Modo Concesionario y Bandeja Aprobaciones ‚Üí Entrega 3.   ‚ïë
// ‚ïö‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ê‚ï¬ù

// ‚îÄ‚îÄ Helpers ‚îÄ‚îÄ

// Devuelve un concesionario por id (Û null)
