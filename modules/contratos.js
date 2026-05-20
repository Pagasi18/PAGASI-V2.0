// Pagasi module: contratos
PG.contratos = function(){
  var credsActivos = S.creds.filter(function(c){return !c.eliminado && c.estado!=='cancelado' && c.estado!=='recuperado' && c.estado!=='recuperada';});
  var credsArchivados = S.creds.filter(function(c){return !c.eliminado && (c.estado==='cancelado' || c.estado==='recuperado' || c.estado==='recuperada');});

  // ═══════════ MÉTRICAS DE CONTRATOS ═══════════
  var totalContratos = credsActivos.length + credsArchivados.length;
  var enMora = credsActivos.filter(function(c){return c.mora>0;}).length;
  var porVencer30d = credsActivos.filter(function(c){
    if(!c.fecha) return false;
    var dias = Math.floor((new Date(c.fecha).getTime() + (c.plazo||12)*30*24*60*60*1000 - Date.now())/(1000*60*60*24));
    return dias>0 && dias<=30;
  }).length;

  // Valor total de contratos
  var valorActivos = credsActivos.reduce(function(a,c){return a+(parseFloat(c.total)||0);},0);
  var valorArchivados = credsArchivados.reduce(function(a,c){return a+(parseFloat(c.total)||0);},0);

  // Contratos del mes
  var hoy = new Date();
  var iniMes = fechaLocalISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  var nuevosMes = credsActivos.filter(function(c){return c.fecha && c.fecha >= iniMes;}).length;

  // Contratos por tipo de documento (contamos los 3 tipos)
  // Promedio de plazo y cuota
  var plazoProm = credsActivos.length ? Math.round(credsActivos.reduce(function(a,c){return a+(parseFloat(c.plazo)||0);},0)/credsActivos.length) : 0;
  var cuotaProm = credsActivos.length ? credsActivos.reduce(function(a,c){return a+(parseFloat(c.cuotaM)||0);},0)/credsActivos.length : 0;

  // Clientes recientes
  var credsRecientes = credsActivos.slice().sort(function(a,b){return (b.fecha||'').localeCompare(a.fecha||'');}).slice(0,6);

  // Distribución por estado
  var activos = credsActivos.filter(function(c){return c.estado==='activo' && (!c.mora||c.mora===0);}).length;
  var activosMora = credsActivos.filter(function(c){return c.mora>0;}).length;
  var completados = credsActivos.filter(function(c){return c.estado==='completado';}).length;
  var recuperados = credsArchivados.filter(function(c){return c.estado==='recuperado' || c.estado==='recuperada';}).length;
  var cancelados = credsArchivados.filter(function(c){return c.estado==='cancelado';}).length;

  return`<div class="page">

  ${pageBanner(
    'Gestión documental · Legal',
    'Contratos y Documentos',
    '<b>'+totalContratos+'</b> contratos · Valor cartera: <b>'+fmt(valorActivos)+'</b> · +'+nuevosMes+' este mes',
    [
      {label:'↓ Exportar CSV', onclick:"exportarCSV('creditos')"},
      {label:'Vista previa', onclick:'renderContrato()'},
      {label:'↓ Descargar PDF', onclick:'descargarContratoPDF()', primary:true}
    ]
  )}

  <!-- ═══ KPIs ═══ -->
  <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:14px">
    <div class="stat" style="border-top:3px solid var(--p1)">
      <div class="st-v" style="color:var(--p1);font-size:22px">${credsActivos.length}</div>
      <div class="st-l">Activos</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:3px">En vigencia</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--green)">
      <div class="st-v" style="color:var(--green);font-size:20px">${fmt(valorActivos)}</div>
      <div class="st-l">Valor cartera</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:3px">En contratos activos</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--amber)">
      <div class="st-v" style="color:var(--amber);font-size:22px">${nuevosMes}</div>
      <div class="st-l">Nuevos este mes</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:3px">Firmas recientes</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--red)">
      <div class="st-v" style="color:var(--red);font-size:22px">${enMora}</div>
      <div class="st-l">Con mora</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:3px">Requieren seguimiento</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--blue,#3b82f6)">
      <div class="st-v" style="color:var(--blue,#3b82f6);font-size:22px">${porVencer30d}</div>
      <div class="st-l">Por vencer 30d</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:3px">Próximas finalizaciones</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--ink3)">
      <div class="st-v" style="font-size:22px">${plazoProm}m</div>
      <div class="st-l">Plazo promedio</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:3px">Cuota: ${fmt(cuotaProm)}</div>
    </div>
  </div>

  <!-- ═══ ESTADO PORTFOLIO + TIPOS DE DOCUMENTO ═══ -->
  <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:12px;margin-bottom:14px">
    <div class="card">
      <div class="ch">
        <div>
          <div class="ct"> Estado del portfolio de contratos</div>
          <div class="cs">Distribución actual de ${totalContratos} contratos</div>
        </div>
      </div>
      <div style="margin-top:12px">
        <div style="display:flex;height:40px;border-radius:10px;overflow:hidden;background:var(--surf2)">
          ${activos>0?`<div style="flex:${activos};background:linear-gradient(135deg,#05a060,#10c878);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800;min-width:36px">${activos}</div>`:''}
          ${activosMora>0?`<div style="flex:${activosMora};background:linear-gradient(135deg,#e8980a,#ffa94d);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800;min-width:36px">${activosMora}</div>`:''}
          ${completados>0?`<div style="flex:${completados};background:linear-gradient(135deg,#2563EB,#60A5FA);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800;min-width:36px">${completados}</div>`:''}
          ${recuperados>0?`<div style="flex:${recuperados};background:linear-gradient(135deg,#d93b5a,#f04b6a);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800;min-width:36px">${recuperados}</div>`:''}
          ${cancelados>0?`<div style="flex:${cancelados};background:linear-gradient(135deg,#6b7280,#9ca3af);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800;min-width:36px">${cancelados}</div>`:''}
          ${totalContratos===0?`<div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--ink3);font-size:11px">Sin contratos</div>`:''}
        </div>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin-top:10px;font-size:10.5px">
          <div style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:#05a060"></span><span>Al día · ${activos}</span></div>
          <div style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:#e8980a"></span><span>Mora · ${activosMora}</span></div>
          <div style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:#2563EB"></span><span>Comp. · ${completados}</span></div>
          <div style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:#d93b5a"></span><span>Recup. · ${recuperados}</span></div>
          <div style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:3px;background:#6b7280"></span><span>Canc. · ${cancelados}</span></div>
        </div>
      </div>

      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--rim2);display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
        <div style="padding:10px 12px;background:rgba(5,160,96,.06);border-radius:8px;border-left:3px solid var(--green)">
          <div style="font-size:10px;color:var(--ink3);font-weight:700;text-transform:uppercase">Tasa de éxito</div>
          <div style="font-size:18px;font-weight:900;color:var(--green);margin-top:2px">${totalContratos?Math.round(completados/totalContratos*100):0}%</div>
        </div>
        <div style="padding:10px 12px;background:rgba(217,59,90,.06);border-radius:8px;border-left:3px solid var(--red)">
          <div style="font-size:10px;color:var(--ink3);font-weight:700;text-transform:uppercase">Tasa recuperación</div>
          <div style="font-size:18px;font-weight:900;color:var(--red);margin-top:2px">${totalContratos?Math.round(recuperados/totalContratos*100):0}%</div>
        </div>
        <div style="padding:10px 12px;background:rgba(37,99,235,.06);border-radius:8px;border-left:3px solid var(--p1)">
          <div style="font-size:10px;color:var(--ink3);font-weight:700;text-transform:uppercase">Vigentes</div>
          <div style="font-size:18px;font-weight:900;color:var(--p1);margin-top:2px">${totalContratos?Math.round(credsActivos.length/totalContratos*100):0}%</div>
        </div>
      </div>
    </div>

    <!-- Tipos de documentos disponibles -->
    <div class="card">
      <div class="ch">
        <div>
          <div class="ct"> Tipos de documentos</div>
          <div class="cs">Plantillas disponibles</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
        <div style="display:flex;align-items:center;gap:10px;padding:12px;background:linear-gradient(135deg,rgba(37,99,235,.08),rgba(124,109,255,.04));border:1px solid rgba(37,99,235,.2);border-radius:10px">
          <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,var(--p1),#60A5FA);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;flex-shrink:0"></div>
          <div style="flex:1">
            <div style="font-size:12.5px;font-weight:800">Contrato de Arrendamiento</div>
            <div style="font-size:10.5px;color:var(--ink3);margin-top:1px">Con Opción a Compra</div>
          </div>
          <span style="background:var(--green);color:#fff;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:800">ACTIVO</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--surf2);border:1px solid var(--rim2);border-radius:10px">
          <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,var(--amber),#ffa94d);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;flex-shrink:0"></div>
          <div style="flex:1">
            <div style="font-size:12.5px;font-weight:800">Pagaré</div>
            <div style="font-size:10.5px;color:var(--ink3);margin-top:1px">Documento ejecutivo de deuda</div>
          </div>
          <span style="background:var(--green);color:#fff;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:800">ACTIVO</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--surf2);border:1px solid var(--rim2);border-radius:10px">
          <div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,var(--blue,#3b82f6),#60a5fa);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;flex-shrink:0">️</div>
          <div style="flex:1">
            <div style="font-size:12.5px;font-weight:800">Carta de Instrucciones</div>
            <div style="font-size:10.5px;color:var(--ink3);margin-top:1px">Instrucciones de pago y cobro</div>
          </div>
          <span style="background:var(--green);color:#fff;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:800">ACTIVO</span>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ CONTRATOS RECIENTES (destacados) ═══ -->
  ${credsRecientes.length?`<div class="card" style="margin-bottom:14px">
    <div class="ch">
      <div>
        <div class="ct">🆕 Contratos recientes</div>
        <div class="cs">Los 6 últimos firmados · click para ver detalle</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px">
      ${credsRecientes.map(function(c){
        var estColor = c.mora>0 ? 'var(--red)' : c.estado==='completado' ? 'var(--green)' : 'var(--p1)';
        var estLabel = c.mora>0 ? 'En mora' : c.estado==='completado' ? 'Completado' : 'Activo';
        var estBg = c.mora>0 ? 'rgba(217,59,90,.08)' : c.estado==='completado' ? 'rgba(5,160,96,.08)' : 'rgba(37,99,235,.08)';
        return '<div style="padding:14px;background:'+estBg+';border:1px solid var(--rim2);border-radius:12px;cursor:pointer;transition:transform .15s" onmouseover="this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.transform=\'\'" onclick="openAmort(\''+c.id+'\')">'
          +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">'
          +'<span style="font-size:10.5px;font-weight:800;color:var(--p1);letter-spacing:.5px">'+c.id+'</span>'
          +'<span style="background:'+estColor+';color:#fff;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:800">'+estLabel+'</span>'
          +'</div>'
          +'<div style="font-size:13px;font-weight:800;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+c.cli+'</div>'
          +'<div style="font-size:10.5px;color:var(--ink3);margin-bottom:8px">'+c.modelo+'</div>'
          +'<div style="display:flex;justify-content:space-between;padding-top:8px;border-top:1px solid var(--rim2);font-size:10.5px">'
          +'<span><span style="color:var(--ink3)">Fecha:</span> <b>'+(c.fecha||'—')+'</b></span>'
          +'<span><span style="color:var(--ink3)">Total:</span> <b style="color:var(--green)">'+fmt(c.total||0)+'</b></span>'
          +'</div>'
          +'<div style="display:flex;gap:4px;margin-top:8px">'
          +'<button class="btn btn-g btn-xs" style="flex:1" onclick="event.stopPropagation();descargarContratoPDFById(\''+c.id+'\')">↓ PDF</button>'
          +'<button class="btn btn-p btn-xs" style="flex:1" onclick="event.stopPropagation();openAmort(\''+c.id+'\')">Ver</button>'
          +'</div>'
          +'</div>';
      }).join('')}
    </div>
  </div>`:''}

  <!-- ═══ GENERADOR + VISTA PREVIA ═══ -->
  <div style="display:grid;grid-template-columns:1fr 1.4fr;gap:12px">
    <div class="card">
      <div class="ch">
        <div>
          <div class="ct">️ Generador de Contrato</div>
          <div class="cs">Selecciona crédito y tipo de documento</div>
        </div>
      </div>
      <div class="fgr c1" style="gap:9px;margin-top:12px">
        <div class="fg"><label> Cliente / Crédito</label><select class="fs" id="sel-cred">${credsActivos.map(c=>`<option value="${c.id}">${c.id} — ${c.cli} · ${c.modelo}</option>`).join('')||'<option value="">— Sin créditos activos —</option>'}</select></div>
        <div class="fg"><label> Tipo de documento</label><select class="fs" id="sel-tipo-doc" onchange="renderContrato()"><option value="contrato"> Contrato de Arrendamiento con Opción a Compra</option><option value="pagare"> Pagaré</option><option value="carta">️ Carta de Instrucciones</option></select></div>
      </div>
      <div style="margin-top:12px;padding:12px 14px;background:linear-gradient(135deg,rgba(37,99,235,.06),rgba(124,109,255,.03));border:1px solid rgba(37,99,235,.15);border-radius:10px;font-size:11.5px;color:var(--ink2);line-height:1.5">
        <div style="display:flex;align-items:flex-start;gap:8px">
          <span style="font-size:14px"></span>
          <div><b style="color:var(--p1)">Autocompletado inteligente:</b> se toman los datos de la empresa (Configuración), del cliente asignado y de la moto del crédito. Verifica que toda la información esté actualizada antes de descargar.</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:11px">
        <button class="btn btn-p btn-sm" onclick="renderContrato()">️ Vista Previa</button>
        <button class="btn btn-g btn-sm" onclick="descargarContratoPDF()">↓ Descargar PDF</button>
      </div>

      <!-- Lista de contratos activos -->
      <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--rim)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div class="ct" style="margin:0"> Contratos Activos</div>
          <span style="background:var(--p1);color:#fff;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:800">${credsActivos.length}</span>
        </div>
        <div class="lst" style="max-height:260px;overflow-y:auto">${credsActivos.length?credsActivos.map(function(c){
          var col = c.mora>0?'var(--red)':'var(--green)';
          return '<div class="li" style="border-left:3px solid '+col+'">'
            +'<div class="li-ic" style="background:var(--gs)">CTR</div>'
            +'<div style="flex:1;min-width:0">'
            +'<div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+c.id+' — '+c.cli+'</div>'
            +'<div style="font-size:10.5px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+c.modelo+' · '+c.fecha+(c.mora>0?' · <span style="color:var(--red);font-weight:700">Mora '+c.mora+'d</span>':'')+'</div>'
            +'</div>'
            +'<button class="btn btn-g btn-xs" onclick="descargarContratoPDFById(\''+c.id+'\')" title="Descargar PDF">↓</button>'
            +'</div>';
        }).join(''):'<div style="text-align:center;padding:24px 10px;color:var(--ink3);font-size:12px"><span style="font-size:28px;display:block;margin-bottom:6px;opacity:.3"></span>Sin contratos activos</div>'}</div>
      </div>

      <!-- Archivados -->
      ${credsArchivados.length?`<div style="margin-top:12px">
        <details style="cursor:pointer">
          <summary style="font-size:11.5px;font-weight:700;color:var(--ink3);padding:8px 12px;background:var(--gs);border:1px solid var(--rim2);border-radius:8px;list-style:none;display:flex;justify-content:space-between;align-items:center">
            <span> Archivados · ${credsArchivados.length}</span>
            <span style="opacity:.6">▾</span>
          </summary>
          <div class="lst" style="max-height:200px;overflow-y:auto;margin-top:6px">${credsArchivados.map(function(c){
            var col = c.estado==='recuperado'||c.estado==='recuperada' ? 'var(--red)' : '#6b7280';
            return '<div class="li" style="background:var(--gs);opacity:.85;border-left:3px solid '+col+'">'
              +'<div class="li-ic" style="background:var(--rim)">ARC</div>'
              +'<div style="flex:1;min-width:0">'
              +'<div style="font-size:12px;font-weight:700;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+c.id+' — '+c.cli+'</div>'
              +'<div style="font-size:10.5px;color:var(--ink3)">'+c.modelo+' · '+c.fecha+' · <span style="color:'+col+';font-weight:700">'+c.estado+'</span></div>'
              +'</div>'
              +'<button class="btn btn-g btn-xs" onclick="descargarContratoPDFById(\''+c.id+'\')">↓</button>'
              +'</div>';
          }).join('')}</div>
        </details>
      </div>`:''}
    </div>

    <!-- Vista previa -->
    <div id="cz">
      <div class="card" style="padding:40px 24px;text-align:center">
        <div style="font-size:56px;margin-bottom:14px;opacity:.2"></div>
        <div style="font-size:17px;font-weight:800;margin-bottom:6px">Vista previa del contrato</div>
        <div style="font-size:12px;color:var(--ink3);max-width:360px;margin:0 auto 18px;line-height:1.6">
          Selecciona un crédito activo de la lista de la izquierda y haz clic en <b>"Vista Previa"</b> para ver el documento generado.
        </div>
        <div style="display:inline-flex;gap:6px;padding:8px 14px;background:var(--surf2);border-radius:100px;font-size:11px;color:var(--ink3)">
          <span></span>
          <span>Los datos se toman automáticamente de Configuración</span>
        </div>
      </div>

      <!-- Checklist legal -->
      <div class="card" style="margin-top:12px;padding:14px">
        <div style="font-size:12.5px;font-weight:800;margin-bottom:10px"> Checklist legal antes de firmar</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${['Verificar datos del cliente y de la moto','Revisar el plazo y cuotas acordados','Confirmar datos de la empresa y representante','Validar las condiciones especiales','Obtener firma y copia de cédula'].map(function(t){
            return '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surf2);border-radius:6px;font-size:11.5px"><span style="color:var(--green);font-weight:900">✓</span><span>'+t+'</span></div>';
          }).join('')}
        </div>
      </div>
    </div>

  </div>
  </div>`;
};

