// Logica de finiquitos, PDFs, CSV, paginacion y reportes. Extraido mecanicamente de assets/pagasi-app.js.
function abrirFiniquito(credId){
  var c=S.creds.find(function(x){return String(x.id)===String(credId);}); if(!c) return;
  var cl=S.clientes.find(function(x){return x.nombre===c.cli;})||{};
  var moto = S.motos.find(function(m){return String(m.id)===String(c.motoId);}) || {};
  var emp = (typeof getEmpresa==='function') ? getEmpresa() : {nombre:'Pagasi',rif:'',ciudad:'Caracas',tel:'',email:'',direccion:'',representante:'',repCI:''};
  var empresaUp = (emp.nombre||'PAGASI').toUpperCase();
  var totalPagado=getCreditoPagosConfirmados(c);
  var fechaFin=c.fechaCompletado||hoyLocalISO();
  var totalCuotas = c.totalCuotas||c.plazo*2;
  var mModelo = c.modelo || moto.modelo || '';
  var mVin = c.vin || moto.vin || '';
  var mColor = (c.color && c.color!=='—') ? c.color : (moto.color || '');
  var mAnio = c.anio || moto.anio || '';
  var mPlaca = (c.placa && c.placa!=='—') ? c.placa : (moto.placa || '');
  var mSerialChasis = c.serialChasis || moto.serialChasis || c.vin || moto.vin || '';
  var hoy = new Date().toLocaleDateString('es-VE',{day:'2-digit',month:'long',year:'numeric'});
  var purple = '#5E3BEE';
  var purpleDark = '#4C2ED0';
  var purpleLight = '#F2EEFF';

  setMicon('detalle');
  $('mtt').textContent='¡Contrato Finalizado!';
  $('msb').textContent=c.cli+' completó su arrendamiento';
  $('modal-box').className='modal modal-lg';
  $('mbd').innerHTML=`
    <div style="text-align:center;padding:16px 0 20px">
      <div style="font-size:18px;font-weight:900;color:var(--p1);margin-bottom:4px">${c.cli}</div>
      <div style="font-size:13px;color:var(--ink3)">ha cancelado la totalidad de los cánones del arrendamiento</div>
    </div>
    <div id="finiquito-doc" style="background:#fff;border:2px solid ${purple};border-radius:12px;padding:28px;font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#222;margin-bottom:16px;max-width:820px">

      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div style="font-size:22px;font-weight:900;color:${purple}">${empresaUp}</div>
        <div style="font-size:11px;color:#555"><strong>Ref. Contrato:</strong> <span style="border-bottom:1px solid #888;padding:0 24px 2px">${c.id||'________'}</span></div>
      </div>

      <!-- Título -->
      <div style="background:${purple};color:#fff;text-align:center;padding:12px 16px;border-radius:4px;margin-bottom:4px;border-bottom:4px solid #E8C842">
        <div style="font-size:15.5px;font-weight:900;letter-spacing:.3px">CONSTANCIA DE FINALIZACIÓN Y TRANSFERENCIA DE PROPIEDAD</div>
        <div style="font-size:10.5px;margin-top:3px;opacity:.9">Ejercicio de la Opción a Compra — Cláusula Séptima del Contrato</div>
      </div>

      <!-- Datos superiores -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:14px 0 10px;font-size:11.5px">
        <div><strong style="color:${purple}">Ciudad / Estado:</strong> ${emp.ciudad||'Caracas'}</div>
        <div><strong style="color:${purple}">Fecha de emisión:</strong> ${hoy}</div>
      </div>
      <div style="border-bottom:1px solid #ccc;margin-bottom:12px"></div>

      <!-- Texto principal -->
      <p style="font-size:11.5px;line-height:1.6;margin:10px 0;text-align:justify">Por medio del presente documento, <strong>${empresaUp}</strong>, inscrita bajo el RIF <strong>${emp.rif||''}</strong>, con domicilio en <strong>${emp.direccion||emp.ciudad||''}</strong>, en su condición de <strong>EL ARRENDADOR</strong>, deja formal constancia de que el(la) ciudadano(a) <strong>${c.cli}</strong>, titular de la cédula de identidad N° <strong>${cl.cedula||''}</strong>, en su condición de <strong>EL ARRENDATARIO</strong> del contrato de arrendamiento con opción a compra N° <strong>${c.id}</strong>, ha cancelado satisfactoriamente la totalidad de los <strong>${totalCuotas} cánones quincenales</strong> acordados, así como el pago simbólico de la opción a compra por USD 1.00.</p>

      <!-- Datos del vehículo -->
      <h3 style="color:${purple};font-weight:900;font-size:12.5px;text-transform:uppercase;letter-spacing:.3px;margin:16px 0 8px;padding-bottom:4px;border-bottom:2px solid ${purple}">VEHÍCULO OBJETO DEL CONTRATO</h3>
      <table style="width:100%;border-collapse:collapse;margin-top:6px;border:1px solid #EAE5F7">
        <tr><td style="background:${purpleLight};color:${purpleDark};font-weight:700;font-size:11.5px;padding:7px 10px;width:32%">Modelo:</td><td style="padding:7px 10px;font-size:11.5px;border-bottom:1px solid #EAE5F7">${mModelo||''}</td><td style="background:${purpleLight};color:${purpleDark};font-weight:700;font-size:11.5px;padding:7px 10px;width:32%">Color:</td><td style="padding:7px 10px;font-size:11.5px;border-bottom:1px solid #EAE5F7">${mColor||''}</td></tr>
        <tr><td style="background:${purpleLight};color:${purpleDark};font-weight:700;font-size:11.5px;padding:7px 10px">Año:</td><td style="padding:7px 10px;font-size:11.5px;border-bottom:1px solid #EAE5F7">${mAnio||''}</td><td style="background:${purpleLight};color:${purpleDark};font-weight:700;font-size:11.5px;padding:7px 10px">Placa:</td><td style="padding:7px 10px;font-size:11.5px;border-bottom:1px solid #EAE5F7">${mPlaca||''}</td></tr>
        <tr><td style="background:${purpleLight};color:${purpleDark};font-weight:700;font-size:11.5px;padding:7px 10px">Serial de Chasis / VIN:</td><td colspan="3" style="padding:7px 10px;font-size:11.5px;border-bottom:1px solid #EAE5F7">${mSerialChasis||''}</td></tr>
      </table>

      <!-- Resumen económico -->
      <h3 style="color:${purple};font-weight:900;font-size:12.5px;text-transform:uppercase;letter-spacing:.3px;margin:16px 0 8px;padding-bottom:4px;border-bottom:2px solid ${purple}">RESUMEN DEL ARRENDAMIENTO CANCELADO</h3>
      <table style="width:100%;border-collapse:collapse;margin-top:6px;border:1px solid #EAE5F7">
        <tr><td style="background:${purpleLight};color:${purpleDark};font-weight:700;font-size:11.5px;padding:7px 10px;width:55%">Depósito inicial pagado:</td><td style="padding:7px 10px;font-size:11.5px;border-bottom:1px solid #EAE5F7;text-align:right;font-weight:700">${fmt(c.ini)}</td></tr>
        <tr><td style="background:${purpleLight};color:${purpleDark};font-weight:700;font-size:11.5px;padding:7px 10px">Cánones quincenales cancelados:</td><td style="padding:7px 10px;font-size:11.5px;border-bottom:1px solid #EAE5F7;text-align:right;font-weight:700">${totalCuotas} de ${totalCuotas}</td></tr>
        <tr><td style="background:${purpleLight};color:${purpleDark};font-weight:700;font-size:11.5px;padding:7px 10px">Total abonado en cánones:</td><td style="padding:7px 10px;font-size:11.5px;border-bottom:1px solid #EAE5F7;text-align:right;font-weight:700">${fmt(totalPagado)}</td></tr>
        <tr><td style="background:${purpleLight};color:${purpleDark};font-weight:700;font-size:11.5px;padding:7px 10px">Monto total del contrato:</td><td style="padding:7px 10px;font-size:11.5px;border-bottom:1px solid #EAE5F7;text-align:right;font-weight:700">${fmt((parseFloat(c.ini)||0)+(parseFloat(c.total)||0))}</td></tr>
        <tr><td style="background:${purpleLight};color:${purpleDark};font-weight:700;font-size:11.5px;padding:7px 10px">Fecha de inicio del contrato:</td><td style="padding:7px 10px;font-size:11.5px;border-bottom:1px solid #EAE5F7;text-align:right">${c.fecha}</td></tr>
        <tr><td style="background:${purpleLight};color:${purpleDark};font-weight:700;font-size:11.5px;padding:7px 10px">Fecha de cancelación total:</td><td style="padding:7px 10px;font-size:11.5px;border-bottom:1px solid #EAE5F7;text-align:right;font-weight:700">${fechaFin}</td></tr>
        <tr style="background:${purpleLight}"><td style="padding:9px 10px;font-size:11.5px;font-weight:800;color:${purpleDark}">Pago de opción a compra (Cláusula Séptima):</td><td style="padding:9px 10px;text-align:right;font-weight:900;color:${purpleDark}">$ 1.00</td></tr>
      </table>

      <!-- Declaración formal -->
      <h3 style="color:${purple};font-weight:900;font-size:12.5px;text-transform:uppercase;letter-spacing:.3px;margin:16px 0 8px;padding-bottom:4px;border-bottom:2px solid ${purple}">DECLARACIÓN DE FINALIZACIÓN</h3>
      <div style="background:#F0FFF4;border:1px solid #4CAF50;border-left:4px solid #2E7D32;border-radius:4px;padding:12px 14px;margin-top:6px">
        <p style="font-size:11.5px;line-height:1.6;margin:0;text-align:justify">En virtud del cumplimiento íntegro de las obligaciones derivadas del contrato, y en ejercicio de la opción a compra prevista en la <strong>Cláusula Séptima</strong> del mismo, <strong>${empresaUp}</strong> declara resuelto el vínculo arrendaticio y procederá a realizar el <strong>traspaso legal de la propiedad</strong> del vehículo descrito a favor de <strong>${c.cli}</strong>, dentro de los <strong>treinta (30) días hábiles</strong> siguientes a la emisión del presente documento, previo cumplimiento de los trámites correspondientes ante el Instituto Nacional de Transporte Terrestre (INTT).</p>
      </div>
      <p style="font-size:11.5px;line-height:1.6;margin:10px 0;text-align:justify">En consecuencia, una vez perfeccionado el traspaso, <strong>${c.cli}</strong> quedará como <strong>único y legítimo propietario</strong> del vehículo, sin que subsistan obligaciones económicas o contractuales pendientes entre las partes derivadas del contrato N° ${c.id}.</p>

      <!-- Firmas -->
      <div style="margin-top:24px;border-top:2px solid ${purple};padding-top:18px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div style="background:${purpleLight};padding:14px 10px;border-radius:4px">
            <div style="background:${purple};color:#fff;font-weight:800;font-size:11.5px;padding:5px 8px;border-radius:3px;margin-bottom:56px;text-align:center">POR EL ARRENDADOR</div>
            <div style="border-top:1px solid #333;padding-top:6px;font-size:10.5px;text-align:center">
              <strong>${empresaUp}</strong><br>
              Representante Legal<br>
              ${emp.representante?'Nombre: '+emp.representante:''}<br>
              C.I.: ${emp.repCI||''}
            </div>
          </div>
          <div style="background:${purpleLight};padding:14px 10px;border-radius:4px">
            <div style="background:${purple};color:#fff;font-weight:800;font-size:11.5px;padding:5px 8px;border-radius:3px;margin-bottom:10px;text-align:center">EL EX-ARRENDATARIO / NUEVO PROPIETARIO</div>
            <div style="display:grid;grid-template-columns:1fr 60px;gap:8px;align-items:end">
              <div style="text-align:center;padding-top:46px">
                <div style="border-top:1px solid #333;padding-top:6px;font-size:10px;line-height:1.45">
                  Firma<br>
                  Nombre: ${c.cli||''}<br>
                  C.I.: ${cl.cedula||''}
                </div>
              </div>
              <div>
                <div style="border:1px dashed #666;background:#fff;height:70px;border-radius:3px"></div>
                <div style="text-align:center;font-size:9px;color:#555;margin-top:3px;font-weight:700">HUELLA</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="margin-top:22px;padding-top:10px;border-top:1px solid #ccc;text-align:center;font-size:9.5px;color:#888">
        ${empresaUp} · Constancia de Finalización de Arrendamiento y Traspaso de Propiedad · Documento N° FIN-${c.id} · Venezuela
      </div>
    </div>`;
  $('mft').innerHTML=`
    <button class="btn btn-g" onclick="closeM()">Cerrar</button>
    <button class="btn btn-p" onclick="imprimirFiniquito()">Imprimir / Guardar PDF</button>`;
  $('ov').style.display='flex';
}

function imprimirFiniquito(){
  var doc=$('finiquito-doc');
  if(!doc){window.print();return;}
  var w=window.open('','_blank','width=800,height=600');
  w.document.write('<html><head><title>Constancia de Finalización</title><style>body{font-family:\'Segoe UI\',Roboto,Arial,sans-serif;padding:30px;color:#222;background:#fff}@media print{body{padding:12px}}</style></head><body>'+doc.outerHTML+'<script>window.onload=function(){window.print();}<\/script></body></html>');
  w.document.close();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GENERACIÓN DE REPORTES (imprime como PDF)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function _abrirVentanaImpresion(titulo, htmlContenido){
  var estilos = `
    body{font-family:Georgia,serif;padding:32px;color:#111;font-size:12px;line-height:1.7}
    h2{text-align:center;font-size:16px;letter-spacing:1px;margin-bottom:4px}
    h3{font-size:13px;margin-top:18px;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;font-size:11.5px}
    td,th{padding:5px 6px;border-bottom:1px solid #eee;vertical-align:top}
    th{background:#f5f5f5;font-weight:800;font-size:10.5px;text-transform:uppercase;letter-spacing:0.5px}
    .ar{display:grid;padding:5px 0;border-bottom:1px solid #eee;font-size:11px}
    .ah{display:grid;padding:5px 0;border-bottom:2px solid #111;font-weight:800;font-size:10.5px;text-transform:uppercase}
    .pd{opacity:0.45;text-decoration:line-through}
    @media print{body{padding:12px}button{display:none!important}}
  `;
  var w = window.open('','_blank','width=860,height=700');
  w.document.write('<html><head><title>'+titulo+'</title><style>'+estilos+'</style></head><body>'+htmlContenido+'<br><button onclick="window.print()" style="background:#2563EB;color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;margin-top:16px">Imprimir / Guardar PDF</button><script>setTimeout(function(){window.print();},400);<\/script></body></html>');
  w.document.close();
}

function descargarAmortPDF(){
  var credId = window._currentAmortCredId;
  if(!credId){ toast('Abre primero la tabla de amortización','error'); return; }
  var c = S.creds.find(function(x){return x.id===credId;});
  if(!c){ toast('Crédito no encontrado','error'); return; }
  var cl = S.clientes.find(function(x){return x.nombre===c.cli;}) || {};
  var emp = (typeof getEmpresa==='function') ? getEmpresa() : {nombre:'Pagasi',rif:'',ciudad:'Caracas',tel:'',email:'',direccion:''};

  // Datos canónicos
  var totalCuotas = getCreditoTotalCuotas(c);
  var cuota = getCreditoCuotaBase(c);
  var cuotasPag = getCreditoCuotasPagadas(c);
  var cuotasRest = Math.max(0, totalCuotas - cuotasPag);
  var pagosConf = getCreditoPagosConfirmados(c);
  var saldoPend = getCreditoSaldoPendiente(c);
  var pctPagado = (c.total||0) > 0 ? Math.round((pagosConf/(c.total))*100) : 0;

  // Fechas
  var fechaInicio = c.fecha || '—';
  var startDate = new Date((c.fecha||hoyLocalISO())+'T12:00:00');
  var fechaFin = new Date(startDate.getTime() + (totalCuotas*15*24*60*60*1000));
  var fechaFinStr = fechaFin.toLocaleDateString('es-VE',{day:'2-digit',month:'long',year:'numeric'});
  var proxFd = new Date(startDate.getTime() + ((cuotasPag+1)*15*24*60*60*1000));
  var proxFecha = cuotasPag<totalCuotas ? proxFd.toLocaleDateString('es-VE',{day:'2-digit',month:'long',year:'numeric'}) : '—';
  var hoy = new Date().toLocaleDateString('es-VE',{day:'numeric',month:'long',year:'numeric'});

  // Historial de pagos confirmados (desde S.pagos)
  var pagosDelCred = S.pagos.filter(function(p){ return !p.eliminado && p.cred===c.id; })
    .sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); });

  // Tabla de amortización
  var tQ = PLAN.tasaMensual/100/2;
  var historial = c.pagosRegistrados||[];
  var pagosPorCuota = {};
  historial.forEach(function(h){
    if(!pagosPorCuota[h.cuota]) pagosPorCuota[h.cuota]=[];
    pagosPorCuota[h.cuota].push(h);
  });
  var saldoPorCuota=[];
  for(var qi=0;qi<totalCuotas;qi++){
    var pagadoEnCuota = (pagosPorCuota[qi+1]||[]).reduce(function(a,h){return a+h.montoPagado;},0);
    var sp = Math.max(0, parseFloat((cuota-pagadoEnCuota).toFixed(2)));
    saldoPorCuota[qi] = sp<0.10 ? 0 : sp;
  }
  var sal = c.fin||0;
  var amortRows = '';
  for(var i=1;i<=totalCuotas;i++){
    var intMontoRaw = sal*tQ;
    var capMonto = cuota - intMontoRaw;
    sal = sal - capMonto;
    var pd = i<=cuotasPag;
    var fd = new Date(startDate.getTime()+(i*15*24*60*60*1000));
    var fechaStr = fd.toLocaleDateString('es-VE',{day:'2-digit',month:'2-digit',year:'numeric'});
    var estado = pd ? '✓ Pagada' : (i===cuotasPag+1 ? 'Próxima' : 'Pendiente');
    amortRows += '<tr style="'+(pd?'opacity:.55;background:#fafafa':'')+'">'
      + '<td style="text-align:center;font-weight:700">'+i+'</td>'
      + '<td>'+fechaStr+'</td>'
      + '<td style="font-weight:'+(pd?'600':'700')+';color:'+(pd?'#999':i===cuotasPag+1?'#2563EB':'#111')+'">'+estado+'</td>'
      + '<td style="text-align:right;font-weight:700">'+fmt(cuota)+'</td>'
      + '<td style="text-align:right;color:#b78a14">'+fmt(Math.max(0,intMontoRaw))+'</td>'
      + '<td style="text-align:right">'+fmt(Math.max(0,capMonto))+'</td>'
      + '<td style="text-align:right;color:#666">'+fmt(Math.max(0,sal))+'</td>'
      + '</tr>';
  }

  // Filas del historial de pagos
  var pagosHistHTML = pagosDelCred.length ? pagosDelCred.map(function(p){
    var estColor = p.estado==='confirmado' ? '#0a7a3f' : '#b78a14';
    return '<tr>'
      + '<td style="font-family:monospace;font-size:10.5px">'+p.id+'</td>'
      + '<td>'+(p.fecha||'—')+'</td>'
      + '<td style="text-align:right;font-weight:700;color:#0a7a3f">'+fmt(p.monto||0)+'</td>'
      + '<td>'+(p.metodo||'—')+'</td>'
      + '<td>'+(p.cobrador||'—')+'</td>'
      + '<td style="font-family:monospace;font-size:10.5px">'+(p.referencia||'—')+'</td>'
      + '<td style="color:'+estColor+';font-weight:700">'+(p.estado||'—')+'</td>'
      + '</tr>';
  }).join('') : '<tr><td colspan="7" style="text-align:center;color:#999;padding:14px">Sin pagos registrados aún</td></tr>';

  // Info chips helper
  function infoChip(label, value, color){
    return '<div style="background:#fafafa;border:1px solid #e8e8e8;border-radius:6px;padding:8px 10px;min-width:0">'
      + '<div style="font-size:9px;color:#999;font-weight:700;text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">'+label+'</div>'
      + '<div style="font-size:12.5px;font-weight:700;color:'+(color||'#111')+';word-break:break-word">'+(value||'—')+'</div>'
    + '</div>';
  }

  var estadoBadge = c.mora>0
    ? '<span style="background:#fde7ec;color:#c22;padding:3px 10px;border-radius:12px;font-weight:700;font-size:10.5px">â— EN MORA · '+c.mora+' día'+(c.mora!==1?'s':'')+'</span>'
    : c.estado==='completado'
      ? '<span style="background:#e7f7ec;color:#0a7a3f;padding:3px 10px;border-radius:12px;font-weight:700;font-size:10.5px">â— COMPLETADO</span>'
      : c.estado==='cancelado'
        ? '<span style="background:#eee;color:#666;padding:3px 10px;border-radius:12px;font-weight:700;font-size:10.5px">â— CANCELADO</span>'
        : '<span style="background:#eaf4ff;color:#1f5a9e;padding:3px 10px;border-radius:12px;font-weight:700;font-size:10.5px">â— '+(c.estado||'activo').toUpperCase()+'</span>';

  var html = `
    <!-- Cabecera empresa -->
    <div style="text-align:center;margin-bottom:6px;padding-bottom:12px;border-bottom:2px solid #111">
      <div style="font-size:18px;font-weight:900;letter-spacing:1.5px;color:#111">${emp.nombre.toUpperCase()}</div>
      <div style="font-size:10px;color:#666;margin-top:3px">
        RIF ${emp.rif||'—'}${emp.ciudad?' · '+emp.ciudad:''}${emp.tel?' · Tel: '+emp.tel:''}${emp.email?' · '+emp.email:''}
      </div>
    </div>

    <!-- Título ficha + fecha -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin:14px 0 4px 0">
      <div>
        <div style="font-size:15px;font-weight:900;letter-spacing:.3px">FICHA DE CRÉDITO · ${c.id}</div>
        <div style="font-size:10.5px;color:#666;margin-top:2px">Documento generado el ${hoy}</div>
      </div>
      <div>${estadoBadge}</div>
    </div>

    <!-- DATOS DEL CLIENTE -->
    <h3 style="margin-top:18px">DATOS DEL CLIENTE</h3>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px">
      ${infoChip('Nombre completo', c.cli)}
      ${infoChip('Cédula', cl.cedula)}
      ${infoChip('Teléfono', cl.tel)}
      ${infoChip('Email', cl.email)}
      ${infoChip('Ciudad', cl.ciudad)}
      ${infoChip('Trabajo', cl.trabajo)}
      ${infoChip('Ingreso mensual', cl.ingreso ? fmt(cl.ingreso) : '—')}
      ${infoChip('Contacto emergencia', cl.emergencia)}
      ${infoChip('Estado del cliente', cl.estado)}
    </div>

    <!-- VEHÍCULO -->
    <h3>VEHÍCULO FINANCIADO</h3>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px">
      ${infoChip('Modelo / Marca', c.modelo)}
      ${infoChip('VIN / Serial', c.vin, '#444')}
      ${infoChip('Color', c.color)}
      ${infoChip('Año', c.anio)}
      ${infoChip('Placa', c.placa && c.placa!=='—' ? c.placa : 'Sin placa')}
      ${infoChip('GPS activo', c.gps ? 'Sí' : 'No')}
    </div>

    <!-- RESUMEN FINANCIERO -->
    <h3>RESUMEN FINANCIERO</h3>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:6px">
      ${infoChip('Cuenta N°', c.id, '#2563EB')}
      ${infoChip('Fecha inicio', fechaInicio)}
      ${infoChip('Fecha vencimiento final', fechaFinStr)}
      ${infoChip('Plazo', totalCuotas+' cuotas quincenales')}
      ${infoChip('Precio de venta', fmt(c.precio||0))}
      ${infoChip('Inicial pagada', fmt(c.ini||0), '#0a7a3f')}
      ${infoChip('Monto financiado', fmt(c.fin||0))}
      ${infoChip('Total a pagar', fmt(c.total||0), '#111')}
      ${infoChip('Cuota quincenal', fmt(cuota), '#2563EB')}
      ${infoChip('Tasa mensual', (PLAN.tasaMensual||'—')+'%')}
      ${infoChip('Factor', (PLAN.factor||'—')+'x')}
      ${infoChip('% Inicial requerida', ((PLAN.inicial||0)*100)+'%')}
    </div>

    <!-- ESTADO ACTUAL -->
    <h3>ESTADO ACTUAL DE LA CUENTA</h3>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:6px">
      ${infoChip('Cuotas pagadas', cuotasPag+' de '+totalCuotas, '#0a7a3f')}
      ${infoChip('Cuotas pendientes', String(cuotasRest), cuotasRest>0?'#b78a14':'#0a7a3f')}
      ${infoChip('Total abonado', fmt(pagosConf), '#0a7a3f')}
      ${infoChip('Saldo pendiente', fmt(saldoPend), saldoPend>0?'#c22':'#0a7a3f')}
      ${infoChip('Progreso pago', pctPagado+'%', '#2563EB')}
      ${infoChip('Próximo vencimiento', proxFecha)}
      ${infoChip('Monto próxima cuota', cuotasRest>0 ? fmt(cuota) : 'Completado')}
      ${infoChip('Días de mora', c.mora>0 ? (c.mora+' días') : 'Al día', c.mora>0?'#c22':'#0a7a3f')}
    </div>

    <!-- HISTORIAL DE PAGOS -->
    <h3>HISTORIAL DE PAGOS REGISTRADOS</h3>
    <table>
      <thead>
        <tr>
          <th style="text-align:left">ID Pago</th>
          <th style="text-align:left">Fecha</th>
          <th style="text-align:right">Monto</th>
          <th style="text-align:left">Método</th>
          <th style="text-align:left">Cobrador</th>
          <th style="text-align:left">Referencia</th>
          <th style="text-align:left">Estado</th>
        </tr>
      </thead>
      <tbody>${pagosHistHTML}</tbody>
    </table>
    ${pagosDelCred.length ? '<div style="text-align:right;margin-top:6px;font-size:11.5px"><strong>Total pagos confirmados: '+fmt(pagosConf)+'</strong> · '+pagosDelCred.filter(function(p){return p.estado==='confirmado';}).length+' operación(es)</div>' : ''}

    <!-- TABLA DE AMORTIZACIÓN -->
    <h3 style="page-break-before:always">TABLA DE AMORTIZACIÓN COMPLETA</h3>
    <table>
      <thead>
        <tr>
          <th style="text-align:center">Cuota #</th>
          <th style="text-align:left">Fecha venc.</th>
          <th style="text-align:left">Estado</th>
          <th style="text-align:right">Monto</th>
          <th style="text-align:right">Interés</th>
          <th style="text-align:right">Capital</th>
          <th style="text-align:right">Saldo</th>
        </tr>
      </thead>
      <tbody>${amortRows}</tbody>
    </table>

    <!-- Pie -->
    <div style="margin-top:30px;padding-top:14px;border-top:1px solid #ccc;display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div>
        <div style="font-size:10.5px;color:#666;line-height:1.6">
          <strong>Notas:</strong> ${(c.notas||cl.notas||'Sin notas adicionales.').replace(/</g,'&lt;')}
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:10.5px;color:#666">Documento emitido por ${emp.nombre.toUpperCase()}</div>
        <div style="font-size:9.5px;color:#999;margin-top:4px">Generado el ${hoy} · Cuenta N° ${c.id}</div>
      </div>
    </div>
  `;

  _abrirVentanaImpresion('Ficha de Crédito '+c.id+' — '+c.cli, html);
}

function descargarEstadoPDF(){
  var credId = window._currentAmortCredId;
  if(!credId){ toast('Abre primero la tabla de amortización','error'); return; }
  var c = S.creds.find(function(x){return x.id===credId;});
  if(!c){ toast('Crédito no encontrado','error'); return; }
  var emp = (typeof getEmpresa==='function') ? getEmpresa() : {nombre:'Pagasi',rif:'',ciudad:'',tel:'',email:''};

  var totalCuotas = getCreditoTotalCuotas(c);
  var cuota = getCreditoCuotaBase(c);
  var cuotasPag = getCreditoCuotasPagadas(c);
  var hoy = new Date().toLocaleDateString('es-VE',{day:'numeric',month:'long',year:'numeric'});

  var fechaInicio = c.fecha || '—';
  var startDate = new Date((c.fecha||hoyLocalISO())+'T12:00:00');

  // Pagos por cuota (para columna Abonos)
  var historial = c.pagosRegistrados||[];
  var pagosPorCuota = {};
  historial.forEach(function(h){
    if(!pagosPorCuota[h.cuota]) pagosPorCuota[h.cuota]=[];
    pagosPorCuota[h.cuota].push(h);
  });

  // Construir filas solo con #, Fecha, Estado, Abonos, Monto
  var rowsHTML = '';
  for(var i=1;i<=totalCuotas;i++){
    var pd = i<=cuotasPag;
    var esProx = i===cuotasPag+1;
    var fd = new Date(startDate.getTime()+(i*15*24*60*60*1000));
    var fechaStr = fd.toLocaleDateString('es-VE',{day:'2-digit',month:'2-digit',year:'numeric'});

    var estadoTxt = pd ? '✓ Pagada' : (esProx ? 'Próxima' : 'Pendiente');
    var estadoColor = pd ? '#0a7a3f' : (esProx ? '#2563EB' : '#888');

    var histCuota = pagosPorCuota[i]||[];
    var abonosTxt = '—';
    if(histCuota.length>0){
      abonosTxt = histCuota.map(function(h){
        return '+'+fmt(h.montoPagado)+' · '+h.fecha;
      }).join('<br>');
    }

    rowsHTML += '<tr style="'+(pd?'opacity:.6;background:#fafafa':'')+'">'
      + '<td style="text-align:center;font-weight:700">'+i+'</td>'
      + '<td>'+fechaStr+'</td>'
      + '<td style="font-weight:700;color:'+estadoColor+'">'+estadoTxt+'</td>'
      + '<td style="font-size:10.5px;color:'+(histCuota.length>0?'#0a7a3f':'#999')+'">'+abonosTxt+'</td>'
      + '<td style="text-align:right;font-weight:700;color:'+(pd?'#888':esProx?'#2563EB':'#111')+'">'+fmt(cuota)+'</td>'
      + '</tr>';
  }

  var html = `
    <!-- Cabecera empresa -->
    <div style="text-align:center;margin-bottom:6px;padding-bottom:12px;border-bottom:2px solid #111">
      <div style="font-size:18px;font-weight:900;letter-spacing:1.5px;color:#111">${emp.nombre.toUpperCase()}</div>
      <div style="font-size:10px;color:#666;margin-top:3px">
        RIF ${emp.rif||'—'}${emp.ciudad?' · '+emp.ciudad:''}${emp.tel?' · Tel: '+emp.tel:''}${emp.email?' · '+emp.email:''}
      </div>
    </div>

    <!-- Título -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin:14px 0 10px 0">
      <div>
        <div style="font-size:15px;font-weight:900;letter-spacing:.3px">ESTADO DE CUENTA · ${c.id}</div>
        <div style="font-size:11px;color:#666;margin-top:2px">${c.cli} · Inicio ${fechaInicio} · ${totalCuotas} cuotas quincenales</div>
        <div style="font-size:10.5px;color:#666;margin-top:2px">Documento generado el ${hoy}</div>
      </div>
      <div style="text-align:right;font-size:11px;color:#666">
        <div><strong>Cuota:</strong> ${fmt(cuota)}</div>
        <div><strong>Progreso:</strong> ${cuotasPag} de ${totalCuotas}</div>
      </div>
    </div>

    <!-- TABLA DE AMORTIZACIÓN -->
    <table>
      <thead>
        <tr>
          <th style="text-align:center;width:40px">#</th>
          <th style="text-align:left">Fecha</th>
          <th style="text-align:left">Estado</th>
          <th style="text-align:left">Abonos</th>
          <th style="text-align:right">Monto</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}</tbody>
    </table>

    <!-- Pie -->
    <div style="margin-top:24px;padding-top:12px;border-top:1px solid #ccc;text-align:right;font-size:10.5px;color:#666">
      Documento emitido por ${emp.nombre.toUpperCase()} · Generado el ${hoy} · Cuenta N° ${c.id}
    </div>
  `;

  _abrirVentanaImpresion('Estado de Cuenta '+c.id+' — '+c.cli, html);
}

function descargarContratoPDF(){
  // Renderiza el contrato del crédito seleccionado en el módulo contratos
  renderContrato();
  setTimeout(function(){
    var cz = $('cz');
    if(!cz){ toast('Selecciona un crédito primero','error'); return; }
    var credId = ($('sel-cred')&&$('sel-cred').value)||'contrato';
    _abrirVentanaImpresion('Contrato '+credId, cz.innerHTML);
  }, 200);
}

function descargarContratoPDFById(credId){
  // Selecciona el crédito en el dropdown y usa renderContrato() para generar el HTML
  var sel = $('sel-cred');
  if(sel){
    // Asegurarnos de que la opción existe en el select antes de asignar
    var opt = Array.prototype.find.call(sel.options||[], function(o){return String(o.value)===String(credId);});
    if(opt) sel.value = credId;
  }
  // Si no estamos en la página de contratos, navegar brevemente para que #cz exista
  if(!$('cz')){ nav('contratos'); }
  setTimeout(function(){
    // Forzar que renderContrato use el credId correcto: si el select no existe o no coincide,
    // guardamos temporalmente y restauramos
    var prevSel = sel ? sel.value : null;
    if(sel) sel.value = credId;
    renderContrato();
    var cz = $('cz');
    if(!cz){ toast('No se pudo generar el contrato','error'); return; }
    _abrirVentanaImpresion('Contrato '+credId, cz.innerHTML);
    if(sel && prevSel!==null) sel.value = prevSel;
  }, 150);
}
// EXPORTAR CSV
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function exportarCSV(tipo){
  var rows=[], filename='';
  function esc(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; }
  function row(arr){ return arr.map(esc).join(','); }

  if(tipo==='clientes'){
    filename='clientes-'+hoyLocalISO()+'.csv';
    rows.push(row(['ID','Nombre','Cédula','Teléfono','Email','Ciudad','Trabajo','Ingreso mensual','Estado','Emergencia','Notas']));
    S.clientes.filter(function(c){return !c.eliminado;}).forEach(function(c){
      rows.push(row([c.id,c.nombre,c.cedula,c.tel,c.email||'',c.ciudad,c.trabajo,c.ingreso,c.estado,c.emergencia||'',c.notas||'']));
    });
  } else if(tipo==='creditos'){
    filename='creditos-'+hoyLocalISO()+'.csv';
    rows.push(row(['ID','Cliente','Modelo','Precio','Inicial','Financiado','Total','Cuota mensual','Cuota quincenal','Plazo','Fecha','Estado','Cuotas pagadas','En mora']));
    S.creds.filter(function(c){return !c.eliminado;}).forEach(function(c){
      rows.push(row([c.id,c.cli,c.modelo,c.precio,c.ini,c.fin,c.total,c.cuota,c.cuotaQ||'',c.plazo,c.fecha,c.estado,c.pagado,c.mora||0]));
    });
  } else if(tipo==='pagos'){
    filename='pagos-'+hoyLocalISO()+'.csv';
    rows.push(row(['ID','Cliente','Crédito','Fecha','Monto','Método/Cuenta','Cobrador','Estado','Referencia','Tasa Bs','Realizado por']));
    S.pagos.filter(function(p){return !p.eliminado;}).forEach(function(p){
      rows.push(row([p.id,p.cli,p.cred,p.fecha,p.monto,p.metodo,p.cobrador,p.estado,p.referencia||'',p.tasaBs||'',p.realizadoPor||'']));
    });
  } else if(tipo==='egresos'){
    filename='egresos-'+hoyLocalISO()+'.csv';
    rows.push(row(['ID','Concepto','Monto','Fecha','Categoría','Forma de pago','Referencia']));
    S.egresos.filter(function(e){return !e.eliminado;}).forEach(function(e){
      rows.push(row([e.id,e.concepto,e.monto,e.fecha,e.categoria||'',e.forma||'',e.referencia||'']));
    });
  } else if(tipo==='motos'){
    filename='motos-'+hoyLocalISO()+'.csv';
    rows.push(row(['ID','Modelo','Año','VIN','Color','Precio','Estado','Cliente','GPS','Notas']));
    S.motos.filter(function(m){return !m.eliminado;}).forEach(function(m){
      rows.push(row([m.id,m.modelo,m.anio||'',m.vin||'',m.color||'',m.precio||0,m.estado,m.cliente||'',m.gps?'Si':'No',m.notas||'']));
    });
  } else if(tipo==='movimientos'){
    filename='movimientos-cuentas-'+hoyLocalISO()+'.csv';
    rows.push(row(['ID','Fecha','Hora','Concepto','Tipo','Cuenta Origen','Cuenta Destino','Monto','Referencia','Realizado por','Estado']));
    (S.movimientos||[]).forEach(function(m){
      var estado = m.eliminado ? 'Anulado' : 'Activo';
      rows.push(row([
        m.id,
        m.fecha||'',
        m.hora||'',
        m.concepto||m.descripcion||'',
        m.tipo||'',
        m.cuentaOrigen||'',
        m.cuentaDestino||'',
        m.monto||0,
        m.referencia||'',
        m.realizadoPor||'',
        estado
      ]));
    });
  } else if(tipo==='cobranza'){
    filename='cobranza-mora-'+hoyLocalISO()+'.csv';
    rows.push(row(['ID Crédito','Cliente','Modelo','Días mora','Cuotas vencidas','Monto mora estimado','Cuota quincenal','Saldo pendiente','Teléfono']));
    var _cobCreds = _concFiltrar(S.creds||[]).filter(function(c){return !c.eliminado && c.mora>0 && c.estado==='activo';});
    _cobCreds.forEach(function(c){
      var cli = (S.clientes||[]).find(function(x){return String(x.id)===String(c.cliId)||(x.nombre||'')===(c.cli||'');});
      var cuotasV = Math.ceil((c.mora||0)/15);
      var montoMora = cuotasV * parseFloat(c.cuotaQ||c.cuota||0);
      rows.push(row([c.id,c.cli,c.modelo||'',c.mora||0,cuotasV,montoMora,c.cuotaQ||c.cuota||0,getCreditoSaldoPendiente(c),(cli&&cli.tel)||'']));
    });
  } else {
    toast('Tipo de export desconocido','error'); return;
  }

  if(rows.length<=1){toast('No hay datos para exportar','info');return;}
  var blob=new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download=filename;a.click();
  URL.revokeObjectURL(url);
  toast('Exportado: '+filename,'success');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EXPORTAR CSV DE UNA CUENTA ESPECÍFICA
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function exportarCSVCuenta(nombre){
  function esc(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; }
  function row(arr){ return arr.map(esc).join(','); }
  var movs = (S.movimientos||[]).filter(function(m){
    return m.cuentaOrigen===nombre || m.cuentaDestino===nombre;
  }).sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||'') || (b.hora||'').localeCompare(a.hora||''); });
  if(!movs.length){ toast('No hay movimientos para exportar','info'); return; }
  var rows = [];
  rows.push(row(['ID','Fecha','Hora','Concepto','Tipo','Dirección','Contraparte','Monto','Referencia','Realizado por','Estado']));
  movs.forEach(function(m){
    var esIng = m.cuentaDestino === nombre;
    var contraparte = esIng ? (m.cuentaOrigen||'Externo') : (m.cuentaDestino||'Externo');
    var direccion = esIng ? 'Ingreso' : 'Egreso';
    var estado = m.eliminado ? 'Anulado' : 'Activo';
    rows.push(row([
      m.id,
      m.fecha||'',
      m.hora||'',
      m.concepto||m.descripcion||'',
      m.tipo||'',
      direccion,
      contraparte,
      (esIng ? 1 : -1) * (m.monto||0),
      m.referencia||'',
      m.realizadoPor||'',
      estado
    ]));
  });
  var slug = nombre.replace(/[^a-zA-Z0-9]/g,'-').toLowerCase();
  var filename = 'cuenta-'+slug+'-'+hoyLocalISO()+'.csv';
  var blob = new Blob(['\uFEFF'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a'); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
  toast('Exportado: '+filename,'success');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// BACKUP JSON COMPLETO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PAGINACIÓN — helper genérico
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
window._pages = {}; // { pagos: 1, clientes: 1, creditos: 1 }

function pgGet(key){ return window._pages[key]||1; }
function pgSet(key,n){ window._pages[key]=n; }

function pgControls(key, total, perPage, navFn){
  var pages = Math.ceil(total/perPage) || 1;
  var cur = pgGet(key);
  if(cur > pages) { pgSet(key,1); cur=1; }
  var from = (cur-1)*perPage+1;
  var to = Math.min(cur*perPage,total);
  if(total===0) return '';
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 4px 2px;font-size:12px;color:var(--ink3)">'
    +'<span>'+from+' – '+to+' de '+total+' registros</span>'
    +'<div style="display:flex;gap:6px">'
    +(cur>1?'<button class="btn btn-g btn-xs" onclick="'+navFn+'(\''+key+'\','+(cur-1)+')">‹ Anterior</button>':'')
    +(cur<pages?'<button class="btn btn-g btn-xs" onclick="'+navFn+'(\''+key+'\','+(cur+1)+')">Siguiente ›</button>':'')
    +'<span style="background:var(--surf2);border-radius:6px;padding:3px 8px;font-weight:700;color:var(--ink2)">'+cur+'/'+pages+'</span>'
    +'</div></div>';
}

function pgNav(key, n){ pgSet(key,n); nav(S.page); }

function generarReporte(tipo){
  try{
  var titulo, html_content;
  var empresa = ($('cfg_empresa')&&$('cfg_empresa').value)||'Pagasi';
  var fecha = new Date().toLocaleDateString('es-VE',{day:'2-digit',month:'long',year:'numeric'});
  var estilos = '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:24px}h1{font-size:18px;font-weight:900;margin-bottom:4px}h2{font-size:13px;color:#555;font-weight:400;margin-bottom:16px}table{width:100%;border-collapse:collapse;margin-top:12px}th{background:#2563EB;color:#fff;padding:7px 9px;text-align:left;font-size:11px}td{padding:6px 9px;border-bottom:1px solid #eee;font-size:11px}tr:nth-child(even){background:#f9f9ff}.total-row{font-weight:900;background:#ede8ff!important}.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700}.green{background:#d4f5e9;color:#0a7a50}.red{background:#fde8ec;color:#b5162d}.blue{background:#e0d9ff;color:#4834d4}.gray{background:#f0f0f0;color:#555}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #2563EB}.logo-area{}.meta{text-align:right;color:#666;font-size:11px}.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.stat-box{background:#f8f7ff;border:1px solid #e0d9ff;border-radius:8px;padding:12px;text-align:center}.stat-v{font-size:18px;font-weight:900;color:#2563EB}.stat-l{font-size:10px;color:#888;margin-top:2px}@media print{button{display:none!important}}</style>';

  if(tipo==='ingresos'){
    titulo = 'Reporte de Ingresos Mensuales';
    var pagosConf = S.pagos.filter(function(p){return !p.eliminado&&p.estado==='confirmado';});
    var pagosElim = S.pagos.filter(function(p){return p.eliminado&&p.estado==='confirmado';});
    var totalCobrado = pagosConf.reduce(function(a,p){return a+p.monto;},0);
    var totalIni = getTotalInicialesCobradas();
    // Group by month
    var byMonth = {};
    pagosConf.forEach(function(p){
      var mes = p.fecha ? p.fecha.substr(0,7) : 'Sin fecha';
      if(!byMonth[mes]) byMonth[mes]={mes:mes,cant:0,total:0};
      byMonth[mes].cant++; byMonth[mes].total+=p.monto;
    });
    var rows = Object.values(byMonth).sort(function(a,b){return b.mes.localeCompare(a.mes);})
      .map(function(m){ return '<tr><td>'+m.mes+'</td><td>'+m.cant+' pagos</td><td>$'+m.total.toFixed(2)+'</td></tr>'; }).join('');
    html_content = '<div class="stat-grid">'
      +'<div class="stat-box"><div class="stat-v">$'+totalCobrado.toFixed(2)+'</div><div class="stat-l">Total cobrado</div></div>'
      +'<div class="stat-box"><div class="stat-v">'+pagosConf.length+'</div><div class="stat-l">Pagos registrados</div></div>'
      +'<div class="stat-box"><div class="stat-v">$'+totalIni.toFixed(2)+'</div><div class="stat-l">Iniciales recibidas</div></div>'
      +'<div class="stat-box"><div class="stat-v">$'+totalCobrado.toFixed(2)+'</div><div class="stat-l">Ingreso total</div></div>'
      +'</div>'
      +'<table><thead><tr><th>Mes</th><th>Cantidad</th><th>Monto</th></tr></thead><tbody>'+rows
      +'<tr class="total-row"><td>TOTAL</td><td>'+pagosConf.length+' pagos</td><td>$'+totalCobrado.toFixed(2)+'</td></tr>'
      +'</tbody></table>'
      +(function(){
        var byMetodo={};
        pagosConf.forEach(function(p){
          var k=(p.metodo||'Sin especificar'); 
          if(!byMetodo[k])byMetodo[k]={metodo:k,cant:0,total:0};
          byMetodo[k].cant++; byMetodo[k].total+=p.monto;
        });
        var mrows=Object.values(byMetodo).sort(function(a,b){return b.total-a.total;})
          .map(function(m){return '<tr><td>'+m.metodo+'</td><td>'+m.cant+'</td><td>$'+m.total.toFixed(2)+'</td><td>'+(m.total/totalCobrado*100).toFixed(1)+'%</td></tr>';}).join('');
        return '<h2 style="margin-top:20px;border-top:1px solid #eee;padding-top:14px">Por método / cuenta</h2>'
          +'<table><thead><tr><th>Cuenta / Método</th><th>Cantidad</th><th>Monto</th><th>% del total</th></tr></thead><tbody>'+mrows+'</tbody></table>';
      })()
      +'<h2 style="margin-top:20px;border-top:1px solid #eee;padding-top:14px">Detalle de pagos</h2>'
      +'<table><thead><tr><th>ID</th><th>Cliente</th><th>Crédito</th><th>Fecha</th><th>Monto</th><th>Recibido en</th><th>Referencia</th><th>Cobrador</th></tr></thead><tbody>'
      +pagosConf.map(function(p){
        return '<tr><td>'+p.id+'</td><td>'+p.cli+'</td><td>'+p.cred+'</td><td>'+(p.fecha||'—')+'</td><td>$'+p.monto.toFixed(2)+'</td><td><strong>'+(p.metodo||'—')+'</strong></td><td>'+(p.referencia||'—')+'</td><td>'+(p.cobrador||'—')+'</td></tr>';
      }).join('')
      +(pagosElim.length?'<tr><td colspan="8" style="background:#fde8ec;color:#b5162d;font-weight:700;padding:6px 9px"> Registros eliminados (no cuentan en totales)</td></tr>'
        +pagosElim.map(function(p){
          return '<tr style="opacity:0.6;text-decoration:line-through;background:#fff5f5"><td>'+p.id+'</td><td>'+p.cli+'</td><td>'+p.cred+'</td><td>'+(p.fecha||'—')+'</td><td>$'+p.monto.toFixed(2)+'</td><td>'+(p.metodo||'—')+'</td><td>'+(p.referencia||'—')+'</td><td>'+( p.eliminadoRazon||'Eliminado')+'</td></tr>';
        }).join(''):'')
      +'</tbody></table>';

  } else if(tipo==='creditos'){
    titulo = 'Reporte de Créditos Activos';
    var activos = S.creds.filter(function(c){return !c.eliminado&&c.estado==='activo';});
    var totalCartera = activos.reduce(function(a,c){return a+getCreditoSaldoPendiente(c);},0);
    html_content = '<div class="stat-grid">'
      +'<div class="stat-box"><div class="stat-v">'+activos.length+'</div><div class="stat-l">Créditos activos</div></div>'
      +'<div class="stat-box"><div class="stat-v">$'+totalCartera.toFixed(2)+'</div><div class="stat-l">Cartera vigente</div></div>'
      +'<div class="stat-box"><div class="stat-v">'+S.creds.filter(function(c){return !c.eliminado&&c.estado==='completado';}).length+'</div><div class="stat-l">Completados</div></div>'
      +'<div class="stat-box"><div class="stat-v">'+S.creds.filter(function(c){return !c.eliminado&&c.mora>0;}).length+'</div><div class="stat-l">En mora</div></div>'
      +'</div>'
      +'<table><thead><tr><th>ID</th><th>Cliente</th><th>Moto</th><th>Fecha</th><th>Cuota Q.</th><th>Pagadas</th><th>Estado</th></tr></thead><tbody>'
      +activos.map(function(c){
        var est = c.mora>0?'<span class="badge red">Mora</span>':'<span class="badge green">Al día</span>';
        return '<tr><td>'+c.id+'</td><td>'+c.cli+'</td><td>'+c.modelo+'</td><td>'+(c.fecha||'—')+'</td><td>$'+(c.cuotaQ||c.cuota||0).toFixed(2)+'</td><td>'+(c.pagado||0)+' / '+((c.totalCuotas||20))+'</td><td>'+est+'</td></tr>';
      }).join('')
      +'</tbody></table>';

  } else if(tipo==='mora'){
    titulo = 'Reporte de Mora';
    var enMora = S.creds.filter(function(c){return !c.eliminado&&(c.mora>0||c.estado==='vencido');});
    html_content = '<div class="stat-grid">'
      +'<div class="stat-box"><div class="stat-v">'+enMora.length+'</div><div class="stat-l">Clientes en mora</div></div>'
      +'<div class="stat-box"><div class="stat-v">$'+enMora.reduce(function(a,c){return a+(c.cuotaQ||c.cuota||0);},0).toFixed(2)+'</div><div class="stat-l">Cuotas pendientes</div></div>'
      +'</div>'
      +'<table><thead><tr><th>Crédito</th><th>Cliente</th><th>Moto</th><th>Cuotas vencidas</th><th>Cuota</th><th>Cobrador</th></tr></thead><tbody>'
      +enMora.map(function(c){
        return '<tr><td>'+c.id+'</td><td>'+c.cli+'</td><td>'+c.modelo+'</td><td><span class="badge red">'+c.mora+' vencidas</span></td><td>$'+(c.cuotaQ||c.cuota||0).toFixed(2)+'</td><td>'+(c.cobrador||'—')+'</td></tr>';
      }).join('')
      +'</tbody></table>';

  } else if(tipo==='inventario'){
    titulo = 'Inventario de Motocicletas';
    html_content = '<div class="stat-grid">'
      +'<div class="stat-box"><div class="stat-v">'+S.motos.filter(function(m){return !m.eliminado&&m.estado==='disponible';}).length+'</div><div class="stat-l">Disponibles</div></div>'
      +'<div class="stat-box"><div class="stat-v">'+S.motos.filter(function(m){return !m.eliminado&&m.estado==='financiada';}).length+'</div><div class="stat-l">Financiadas</div></div>'
      +'<div class="stat-box"><div class="stat-v">'+S.motos.filter(function(m){return !m.eliminado&&m.estado==='recuperada';}).length+'</div><div class="stat-l">Recuperadas</div></div>'
      +'<div class="stat-box"><div class="stat-v">'+S.motos.filter(function(m){return !m.eliminado;}).length+'</div><div class="stat-l">Total</div></div>'
      +'</div>'
      +'<table><thead><tr><th>ID</th><th>Modelo</th><th>Año</th><th>VIN</th><th>Color</th><th>Precio</th><th>Estado</th><th>Cliente</th><th>GPS</th></tr></thead><tbody>'
      +S.motos.filter(function(m){return !m.eliminado;}).map(function(m){
        var est={'disponible':'<span class="badge green">Disponible</span>','financiada':'<span class="badge blue">Financiada</span>','recuperada':'<span class="badge red">Recuperada</span>','inventario':'<span class="badge gray">Inventario</span>'}[m.estado]||m.estado;
        return '<tr><td>'+m.id+'</td><td>'+m.modelo+'</td><td>'+(m.anio||'—')+'</td><td>'+(m.vin||'—')+'</td><td>'+(m.color||'—')+'</td><td>$'+Number(m.precio||0).toFixed(2)+'</td><td>'+est+'</td><td>'+(m.cliente||'—')+'</td><td>'+(m.gps?'✓':'—')+'</td></tr>';
      }).join('')
      +'</tbody></table>';

  } else if(tipo==='pyl'){
    titulo = 'Estado de Resultados (P&L)';
    var tIni = getTotalInicialesCobradas();
    var tPagos = S.pagos.filter(function(p){return !p.eliminado&&p.estado==='confirmado';}).reduce(function(a,p){return a+p.monto;},0);
    var tIngresos = tIni + tPagos;
    var egresosActPyl = S.egresos.filter(function(e){return !e.eliminado;});
    var egresosElimPyl = S.egresos.filter(function(e){return e.eliminado;});
    var tEgresos = egresosActPyl.reduce(function(a,e){return a+(e.monto||0);},0);
    var utilidad = tIngresos - tEgresos;
    html_content = '<div class="stat-grid">'
      +'<div class="stat-box"><div class="stat-v" style="color:#0a7a50">$'+tIngresos.toFixed(2)+'</div><div class="stat-l">Ingresos totales</div></div>'
      +'<div class="stat-box"><div class="stat-v" style="color:#b5162d">$'+tEgresos.toFixed(2)+'</div><div class="stat-l">Egresos totales</div></div>'
      +'<div class="stat-box"><div class="stat-v" style="color:'+(utilidad>=0?'#0a7a50':'#b5162d')+'">$'+Math.abs(utilidad).toFixed(2)+'</div><div class="stat-l">'+(utilidad>=0?'Utilidad neta':'Pérdida neta')+'</div></div>'
      +'<div class="stat-box"><div class="stat-v">'+S.creds.filter(function(c){return !c.eliminado&&c.estado==='activo';}).length+'</div><div class="stat-l">Créditos activos</div></div>'
      +'</div>'
      +'<table><thead><tr><th>Concepto</th><th>Monto</th></tr></thead><tbody>'
      +'<tr><td>Iniciales cobradas</td><td>$'+tIni.toFixed(2)+'</td></tr>'
      +'<tr><td>Pagos de cuotas</td><td>$'+tPagos.toFixed(2)+'</td></tr>'
      +'<tr class="total-row"><td>TOTAL INGRESOS</td><td>$'+tIngresos.toFixed(2)+'</td></tr>'
      +egresosActPyl.map(function(e){return '<tr><td>(-) '+e.concepto+'</td><td>$'+(e.monto||0).toFixed(2)+'</td></tr>';}).join('')
      +'<tr class="total-row"><td>TOTAL EGRESOS</td><td>$'+tEgresos.toFixed(2)+'</td></tr>'
      +'<tr class="total-row" style="background:#2563EB!important;color:#fff"><td>UTILIDAD NETA</td><td>$'+utilidad.toFixed(2)+'</td></tr>'
      +(egresosElimPyl.length?'<tr><td colspan="2" style="background:#fde8ec;color:#b5162d;font-weight:700;padding:6px 9px"> Egresos eliminados (no cuentan en totales)</td></tr>'
        +egresosElimPyl.map(function(e){return '<tr style="opacity:0.5;text-decoration:line-through;background:#fff5f5"><td>(-) '+e.concepto+' <em style="font-size:10px">['+( e.eliminadoRazon||'Eliminado')+']</em></td><td>$'+(e.monto||0).toFixed(2)+'</td></tr>';}).join(''):'')
      +'</tbody></table>';

  } else if(tipo==='flujo'){
    titulo = 'Flujo de Caja';
    var allPagos = S.pagos.filter(function(p){return !p.eliminado&&p.estado==='confirmado';});
    var pagosElimFlujo = S.pagos.filter(function(p){return p.eliminado&&p.estado==='confirmado';});
    var egresosActivos = S.egresos.filter(function(e){return !e.eliminado;});
    var egresosElim = S.egresos.filter(function(e){return e.eliminado;});
    html_content = '<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Entrada</th><th>Salida</th><th>Forma</th><th>Cuenta</th></tr></thead><tbody>'
      +allPagos.map(function(p){
        return '<tr><td>'+(p.fecha||'—')+'</td><td><span class="badge green">Ingreso</span></td><td>'+p.cli+' · '+p.cred+'</td><td>$'+p.monto.toFixed(2)+'</td><td>—</td><td>'+(p.metodo||'—')+'</td><td>'+(p.cuenta||'—')+'</td></tr>';
      }).join('')
      +egresosActivos.map(function(e){
        return '<tr><td>'+(e.fecha||'—')+'</td><td><span class="badge red">Egreso</span></td><td>'+e.concepto+'</td><td>—</td><td>$'+e.monto.toFixed(2)+'</td><td>—</td><td>—</td></tr>';
      }).join('')
      +(pagosElimFlujo.length||egresosElim.length?'<tr><td colspan="7" style="background:#fde8ec;color:#b5162d;font-weight:700;padding:6px 9px"> Registros eliminados (no cuentan en totales)</td></tr>':'')
      +pagosElimFlujo.map(function(p){
        return '<tr style="opacity:0.5;text-decoration:line-through;background:#fff5f5"><td>'+(p.fecha||'—')+'</td><td><span class="badge gray">Eliminado</span></td><td>'+p.cli+' · '+p.cred+'</td><td>$'+p.monto.toFixed(2)+'</td><td>—</td><td>'+(p.metodo||'—')+'</td><td>'+(p.eliminadoRazon||'Eliminado')+'</td></tr>';
      }).join('')
      +egresosElim.map(function(e){
        return '<tr style="opacity:0.5;text-decoration:line-through;background:#fff5f5"><td>'+(e.fecha||'—')+'</td><td><span class="badge gray">Eliminado</span></td><td>'+e.concepto+'</td><td>—</td><td>$'+e.monto.toFixed(2)+'</td><td>—</td><td>'+(e.eliminadoRazon||'Eliminado')+'</td></tr>';
      }).join('')
      +'</tbody></table>';

  } else if(tipo==='plan'){
    titulo = 'Reporte del Plan Financiero';
    html_content = '<div class="stat-grid">'
      +'<div class="stat-box"><div class="stat-v">'+PLAN.plazo+'</div><div class="stat-l">Meses plazo</div></div>'
      +'<div class="stat-box"><div class="stat-v">'+PLAN.factor+'x</div><div class="stat-l">Factor</div></div>'
      +'<div class="stat-box"><div class="stat-v">'+(PLAN.inicial*100)+'%</div><div class="stat-l">Inicial mínima</div></div>'
      +'<div class="stat-box"><div class="stat-v">'+PLAN.tasaMensual+'%</div><div class="stat-l">Tasa mensual</div></div>'
      +'</div>'
      +'<table><thead><tr><th>Modelo</th><th>Precio</th><th>Inicial ${PLAN.inicial*100}%</th><th>Financiado</th><th>Cuota mensual</th><th>Cuota quincenal</th><th>Total pagado</th></tr></thead><tbody>'
      +CATALOGO.map(function(c){
        var r = calcMoto(c.precio);
        return '<tr><td>'+c.modelo+'</td><td>$'+c.precio.toFixed(2)+'</td><td>$'+r.ini.toFixed(2)+'</td><td>$'+r.fin.toFixed(2)+'</td><td>$'+r.cuotaM.toFixed(2)+'</td><td>$'+r.cuotaQ.toFixed(2)+'</td><td>$'+r.totalPagado.toFixed(2)+'</td></tr>';
      }).join('')
      +'</tbody></table>';
  } else {
    toast('Reporte no implementado aún','info'); return;
  }

  var doc = window.open('about:blank','_blank');
  if(!doc){ toast('No se pudo abrir el reporte. Permite ventanas emergentes para pagasi.io','error'); return; }
  doc.document.open();
  doc.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+titulo+' — '+empresa+'</title>'+estilos+'</head><body>'
    +'<div class="header"><div class="logo-area"><h1>'+empresa+'</h1><h2>'+titulo+'</h2></div>'
    +'<div class="meta">'+fecha+'<br><button onclick="window.print()" style="margin-top:8px;background:#2563EB;color:#fff;border:none;padding:6px 16px;border-radius:6px;cursor:pointer;font-size:12px">Imprimir / Guardar PDF</button></div>'
    +'</div>'+html_content+'</body></html>');
  doc.document.close();
  }catch(err){
    console.error('Error generando reporte', err);
    toast('No se pudo generar el reporte','error');
  }
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MÓDULO CUENTAS — Gestión contable por cuentas
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
