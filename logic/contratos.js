// Logica de contratos y documentos legales. Extraido mecanicamente de assets/pagasi-app.js.
function renderContrato(){
  var tipo = ($('sel-tipo-doc')&&$('sel-tipo-doc').value) || 'contrato';
  if(tipo==='pagare') return _renderPagare();
  if(tipo==='carta') return _renderCartaInstrucciones();
  return _renderContratoArrendamiento();
}

// Helper: arma el contexto común (datos y estilos) para todos los documentos
function _docCtx(){
  var credId=($('sel-cred')&&$('sel-cred').value);
  var c=S.creds.find(function(x){return String(x.id)===String(credId);})||S.creds[0];
  if(!c){ return null; }
  var logoSrc=(typeof _PAGASI_LOGO_BLUE!=='undefined'&&_PAGASI_LOGO_BLUE)||(document.querySelector('.sb-logo img')||{}).src||'';
  var emp = getEmpresa();
  var empresaUp = (emp.nombre||'PAGASI').toUpperCase();
  var cli = S.clientes.find(function(x){return x.nombre===c.cli;}) || S.clientes.find(function(x){return String(x.id)===String(c.clienteId);}) || {};
  var moto = S.motos.find(function(m){return String(m.id)===String(c.motoId);}) || {};
  var hoy = new Date().toLocaleDateString('es-VE',{day:'2-digit',month:'long',year:'numeric'});
  var fechaContrato = c.fecha
    ? new Date(c.fecha+'T12:00:00').toLocaleDateString('es-VE',{day:'2-digit',month:'long',year:'numeric'})
    : hoy;
  var V = function(x){ return (x!=null && String(x).trim()!=='') ? String(x).trim() : ''; };
  var Vm = function(n){ return (n!=null && !isNaN(parseFloat(n))) ? '$ '+parseFloat(n).toFixed(2) : ''; };
  var mModelo = c.modelo || moto.modelo || '';
  var mVin = c.vin || moto.vin || '';
  var mColor = (c.color && c.color!=='—') ? c.color : (moto.color || '');
  var mAnio = c.anio || moto.anio || '';
  var mPlaca = (c.placa && c.placa!=='—') ? c.placa : (moto.placa || '');
  var mMarca = c.marca || moto.marca || '';
  var mSerialMotor = c.serialMotor || moto.serialMotor || '';
  var mSerialChasis = c.serialChasis || moto.serialChasis || c.vin || moto.vin || '';
  var mGpsNum = c.gpsNum || moto.gpsNum || moto.gps_id || '';
  var mConcesionario = (c.concesionarioId && typeof _concGetById==='function') ? ((_concGetById(c.concesionarioId)||{}).nombre||'') : '';
  // Identidad Pagasi: azul de marca (las variables conservan el nombre 'purple'
  // por compatibilidad, pero el color es el azul #2563EB del sistema)
  var purple = '#2563EB';
  var purpleDark = '#1D4ED8';
  var purpleLight = '#EFF6FF';
  var rowStyle = 'padding:8px 12px;border-bottom:1px solid #DBEAFE;font-size:11.5px';
  var tableHdr = 'background:'+purple+';color:#fff;font-size:12px;font-weight:800;text-align:center;padding:9px 10px;letter-spacing:.3px;text-transform:uppercase';
  var clausH = 'color:'+purple+';font-weight:900;font-size:12.5px;text-transform:uppercase;letter-spacing:.3px;margin:18px 0 8px;padding-bottom:4px;border-bottom:2px solid '+purple;
  var p = 'font-size:11.5px;line-height:1.55;color:#222;margin:6px 0;text-align:justify';
  var li = 'font-size:11.5px;line-height:1.55;color:#222;margin:3px 0;text-align:justify';
  var lblCell = 'background:'+purpleLight+';color:'+purpleDark+';font-weight:700;font-size:11.5px;padding:7px 10px;width:22%';
  var valCell = 'padding:7px 10px;font-size:11.5px;border-bottom:1px solid #DBEAFE;width:28%';
  return { c:c, cli:cli, moto:moto, emp:emp, empresaUp:empresaUp, logoSrc:logoSrc, hoy:hoy, fechaContrato:fechaContrato, V:V, Vm:Vm,
           mModelo:mModelo, mVin:mVin, mColor:mColor, mAnio:mAnio, mPlaca:mPlaca, mMarca:mMarca, mConcesionario:mConcesionario,
           mSerialMotor:mSerialMotor, mSerialChasis:mSerialChasis, mGpsNum:mGpsNum,
           purple:purple, purpleDark:purpleDark, purpleLight:purpleLight,
           rowStyle:rowStyle, tableHdr:tableHdr, clausH:clausH, p:p, li:li, lblCell:lblCell, valCell:valCell };
}

// Monto en letras (simple, para pagarés)
function _numALetras(n){
  n = parseFloat(n)||0;
  if(n===0) return 'CERO DÓLARES AMERICANOS';
  var entero = Math.floor(n);
  var cents = Math.round((n-entero)*100);
  var un = ['','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISEIS','DIECISIETE','DIECIOCHO','DIECINUEVE','VEINTE','VEINTIUNO','VEINTIDOS','VEINTITRES','VEINTICUATRO','VEINTICINCO','VEINTISEIS','VEINTISIETE','VEINTIOCHO','VEINTINUEVE'];
  var dec = ['','','','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
  var cen = ['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
  function bajo1000(num){
    if(num===0) return '';
    if(num===100) return 'CIEN';
    var c = Math.floor(num/100), r = num%100;
    var s = cen[c];
    if(r===0) return s;
    if(r<30) return (s?s+' ':'')+un[r];
    var d = Math.floor(r/10), u = r%10;
    return (s?s+' ':'')+dec[d]+(u?' Y '+un[u]:'');
  }
  var txt = '';
  if(entero>=1000000){
    var mill = Math.floor(entero/1000000);
    txt += (mill===1?'UN MILLÓN':bajo1000(mill)+' MILLONES')+' ';
    entero = entero%1000000;
  }
  if(entero>=1000){
    var mil = Math.floor(entero/1000);
    txt += (mil===1?'MIL':bajo1000(mil)+' MIL')+' ';
    entero = entero%1000;
  }
  if(entero>0) txt += bajo1000(entero);
  txt = txt.trim()+' DÓLARES AMERICANOS';
  if(cents>0) txt += ' CON '+(cents<10?'0'+cents:cents)+'/100';
  return txt;
}

function _renderContratoArrendamiento(){
  var ctx = _docCtx();
  if(!ctx){ $('cz').innerHTML='<div class="empty" style="margin-top:60px"><span class="e-ic">CTR</span><div class="e-tt">No hay créditos</div><div style="font-size:11.5px">Registra un crédito primero</div></div>'; return; }
  var c=ctx.c, cli=ctx.cli, emp=ctx.emp, empresaUp=ctx.empresaUp, logoSrc=ctx.logoSrc, fechaContrato=ctx.fechaContrato, V=ctx.V;
  var mModelo=ctx.mModelo, mColor=ctx.mColor, mAnio=ctx.mAnio, mPlaca=ctx.mPlaca, mMarca=ctx.mMarca, mSerialMotor=ctx.mSerialMotor, mSerialChasis=ctx.mSerialChasis;
  var purple=ctx.purple, purpleDark=ctx.purpleDark, purpleLight=ctx.purpleLight;
  var clausH=ctx.clausH, p=ctx.p;

  // ── Datos financieros ────────────────────────────────────────────────────
  // El sistema cobra quincenal (cuotaQ x 2 por mes). El Contrato define un
  // CANON MENSUAL, que la Sección 2.2(a) permite pagar en abonos parciales
  // dentro del mes; por eso el canon mensual = cuota quincenal x 2.
  var cuotaQ = parseFloat(c.cuotaQ||c.cuota||0);
  var canonMensual = Math.round(cuotaQ*2*100)/100;
  var plazoMeses = parseInt(c.plazo||0) || ((typeof PLAN!=='undefined'&&PLAN.plazo)||12);
  var precioEjercicio = canonMensual; // Sección 4.3: UN (1) CANON MENSUAL

  var fmtUSD = function(n){ return (parseFloat(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); };
  var enLetrasUSD = function(n){
    var t = (typeof _numALetras==='function') ? _numALetras(n) : '';
    return t.replace('DÓLARES AMERICANOS','DÓLARES DE LOS ESTADOS UNIDOS DE AMÉRICA');
  };
  var ENT = ['CERO','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE','VEINTE','VEINTIUNO','VEINTIDÓS','VEINTITRÉS','VEINTICUATRO','VEINTICINCO','VEINTISÉIS','VEINTISIETE','VEINTIOCHO','VEINTINUEVE','TREINTA','TREINTA Y UNO','TREINTA Y DOS','TREINTA Y TRES','TREINTA Y CUATRO','TREINTA Y CINCO','TREINTA Y SEIS'];
  var numTexto = function(n){ n=parseInt(n)||0; return ENT[n] || String(n); };

  // ── Cuadro de cánones ────────────────────────────────────────────────────
  // Sección 2.1: el canon se paga "a partir del primer mes completo en que se
  // encuentre en posesión del Vehículo". Sección 2.2(a): vence el último Día
  // Hábil de cada mes. No se consideran feriados nacionales (solo sáb/dom).
  var MESES_L = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var ultimoDiaHabil = function(y, m){
    var d = new Date(y, m+1, 0);
    while(d.getDay()===0 || d.getDay()===6){ d.setDate(d.getDate()-1); }
    return d;
  };
  var fIni = c.fecha ? new Date(c.fecha+'T12:00:00') : new Date();
  // Si no arranca el día 1, el primer mes completo es el mes siguiente
  var mes0 = fIni.getDate()===1 ? fIni.getMonth() : fIni.getMonth()+1;
  var canonRows = '';
  var totalCanones = 0;
  for(var i=0; i<plazoMeses; i++){
    var dv = ultimoDiaHabil(fIni.getFullYear(), mes0+i);
    totalCanones += canonMensual;
    canonRows += '<tr>'
      + '<td style="padding:5px 8px;border:1px solid #DBEAFE;text-align:center">'+(i+1)+'</td>'
      + '<td style="padding:5px 8px;border:1px solid #DBEAFE;text-transform:capitalize">'+MESES_L[dv.getMonth()]+' '+dv.getFullYear()+'</td>'
      + '<td style="padding:5px 8px;border:1px solid #DBEAFE;text-align:center">'+String(dv.getDate()).padStart(2,'0')+'/'+String(dv.getMonth()+1).padStart(2,'0')+'/'+dv.getFullYear()+'</td>'
      + '<td style="padding:5px 8px;border:1px solid #DBEAFE;text-align:right;font-weight:700">US$ '+fmtUSD(canonMensual)+'</td>'
      + '</tr>';
  }

  // ── Datos del Arrendatario ───────────────────────────────────────────────
  var cliNom = V(cli.nombre||c.cli);
  var cliCi = V(cli.cedula);
  var cliRif = V(cli.rif);
  var cliTel = V(cli.tel);
  var cliEmail = V(cli.email);
  var cliDir = V(cli.dir||cli.ciudad||'');
  var mUso = V(c.uso||ctx.moto.uso||'PARTICULAR');
  var mTipo = V(c.tipo||ctx.moto.tipo||'');

  // Campo vacío -> línea para llenar a mano
  var blank = function(val, len){ len=len||30; var v=val||'';
    return v ? '<strong>'+v+'</strong>' : '<span style="display:inline-block;border-bottom:1px solid #888;min-width:'+(len*6)+'px;vertical-align:bottom">&nbsp;</span>'; };

  var sub = 'font-size:11.5px;line-height:1.6;color:#222;margin:7px 0;text-align:justify';
  var subN = 'font-weight:800;color:'+purpleDark;

  $('cz').innerHTML = `<div class="cdoc" style="font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#222;max-width:820px;margin:0 auto;padding:20px 28px">

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>${logoSrc?`<img src="${logoSrc}" style="height:46px;object-fit:contain">`:`<div style="font-size:22px;font-weight:900;color:${purple}">${empresaUp}</div>`}</div>
      <div style="font-size:11px;color:#555;text-align:right"><strong>Referencia:</strong> ${c.id||'________'}<br><span style="color:#888">${fechaContrato}</span></div>
    </div>

    <!-- Título -->
    <div style="background:${purple};color:#fff;text-align:center;padding:12px 16px;border-radius:4px;margin-bottom:4px;border-bottom:4px solid ${purpleDark}">
      <div style="font-size:15.5px;font-weight:900;letter-spacing:.3px">CONTRATO DE ARRIENDO-VENTA DE VEHÍCULO AUTOMOTOR</div>
    </div>

    <!-- Preámbulo -->
    <p style="${p};margin-top:14px">El presente <strong>CONTRATO DE ARRIENDO-VENTA DE VEHÍCULO AUTOMOTOR</strong> (en lo sucesivo, el “Contrato”) se celebra en la fecha indicada al final del presente instrumento (la “Fecha de Celebración”), entre: (i) <strong>PAGASI 18, C.A.</strong>, sociedad mercantil domiciliada en Caracas, inscrita en el Registro Único de Información Fiscal (“RIF”) bajo el N° <strong>J-50.829.589-7</strong>, con domicilio fiscal en Avenida Los Chorros, Quinta Miramar, Urbanización Sebucán, Caracas, Estado Miranda, Zona Postal 1071 (en adelante, el “<strong>Arrendador</strong>”); y (ii) ${blank(cliNom,34)}, venezolano(a), mayor de edad, titular de la cédula de identidad N° ${blank(cliCi,14)}, con RIF N° ${blank(cliRif,14)}, domiciliado(a) en ${blank(cliDir,40)} (en lo sucesivo, el “<strong>Arrendatario</strong>” y, conjuntamente con el Arrendador, las “Partes”); de conformidad con los artículos aplicables del Código Civil, la Ley de Transporte Terrestre y demás normativa venezolana vigente, sujeto a los términos y condiciones siguientes:</p>

    <p style="${p}"><strong>CONSIDERANDO QUE</strong> el establecimiento vendedor o concesionario que entrega el Vehículo es una agencia distribuidora de motocicletas y actúa únicamente como proveedor o punto de entrega, sin adquirir por este Contrato la condición de Parte ni obligación de firma.</p>

    <p style="${p}"><strong>CONSIDERANDO QUE</strong> el Arrendador adquirió el vehículo automotor cuyas características se identifican a continuación: marca: ${blank(mMarca,14)}, modelo: ${blank(mModelo,16)}, año: ${blank(mAnio,7)}, clase: <strong>MOTO</strong>, tipo: ${blank(mTipo,12)}, color: ${blank(mColor,12)}, placa: ${blank(mPlaca,12)}, serial de carrocería o chasis N° ${blank(mSerialChasis,20)}, serial de motor N° ${blank(mSerialMotor,20)}, uso: ${blank(mUso,12)} (el “<strong>Vehículo</strong>”).</p>

    <p style="${p}"><strong>CONSIDERANDO QUE</strong> el Arrendatario, conociendo el estado, situación y condición general del Vehículo, desea arrendar el Vehículo con opción a su compra, y el Arrendador está dispuesto a la arriendo-venta del mismo.</p>

    <p style="${p}">Las Partes, por medio del presente Contrato, expresamente establecen lo siguiente:</p>

    <!-- 1. OBJETO -->
    <h3 style="${clausH}">1. Objeto del Contrato</h3>
    <p style="${sub}"><span style="${subN}">1.1 Arrendamiento del Vehículo.</span> Por medio del presente, el Arrendador da en arrendamiento al Arrendatario, quien declara recibir en tal concepto, el Vehículo, para su uso lícito y conforme a los términos y condiciones establecidos en este Contrato.</p>
    <p style="${sub}"><span style="${subN}">1.2 Entrega del Vehículo.</span> El Arrendador hace entrega material del Vehículo al Arrendatario en este acto, conjuntamente con sus llaves, manuales y accesorios, en la misma forma que han sido recibidos del Concesionario. Desde la entrega material, el Arrendatario asume la posesión, uso, guarda, custodia, conservación, mantenimiento ordinario y responsabilidad civil, administrativa y de tránsito del Vehículo.</p>
    <p style="${sub}"><span style="${subN}">1.3 Estado del Vehículo; Ausencia de Saneamiento.</span> El Arrendatario declara que ha revisado e inspeccionado directa y personalmente el Vehículo a su entera satisfacción, y que conoce su estado físico, mecánico, eléctrico, documental y de conservación. En consecuencia, el Arrendatario acepta recibir el Vehículo en el estado en que se encuentra, sin que el Arrendador asuma obligación alguna de saneamiento, garantía o responsabilidad por vicios ocultos, defectos mecánicos, eléctricos, estructurales o de funcionamiento del Vehículo; salvo por la responsabilidad del Arrendador respecto de la inexistencia de gravámenes no declarados sobre el Vehículo. Cualquier garantía de fabricante, Concesionario, taller, proveedor o tercero relacionada con el Vehículo (la “Garantía del Fabricante”) será exigible únicamente frente al garante correspondiente, sin que el Arrendador asuma obligación o responsabilidad alguna por la existencia, alcance, vigencia, cumplimiento o ejecución de dicha Garantía del Fabricante.</p>
    <p style="${sub}"><span style="${subN}">1.4 Uso y Mantenimiento del Vehículo.</span> Durante el Período de Vigencia el Arrendatario deberá usar el Vehículo de forma prudente, lícita y conforme a su destino natural, con la diligencia de un buen padre de familia, obligándose a mantenerlo en buen estado de funcionamiento y conservación, realizar oportunamente el mantenimiento preventivo y correctivo ordinario, abstenerse de modificar seriales, placas, piezas esenciales o características de identificación, ni destinarlo a actividades ilícitas o distintas de las autorizadas; en estricto cumplimiento del Reglamento LTT—Motos y el ordenamiento jurídico venezolano. El Arrendatario asumirá los costos de combustible, lubricantes, consumibles, mantenimiento, reparaciones (independientemente de su cuantía), neumáticos, accesorios, estacionamiento, multas, impuestos, tasas, daños o indemnizaciones a terceros derivadas de accidentes en los que haya estado involucrado el Vehículo, la Póliza de Seguro aludida en la Sección 1.5 del Contrato, y demás gastos, costos, cargas u obligaciones derivadas del uso, tenencia, circulación y custodia del Vehículo.</p>
    <p style="${sub}"><span style="${subN}">1.5 Póliza de Seguro.</span> Durante el Período de Vigencia el Arrendatario se obliga a mantener a su propia costa debidamente pagada y vigente la Póliza de Garantía y Responsabilidad Civil o cualquier póliza sustancialmente equivalente, en cumplimiento con la Ley de Transporte Terrestre, el Reglamento LTT—Motos y el ordenamiento jurídico venezolano (la “Póliza de Seguro”).</p>
    <p style="${sub}"><span style="${subN}">1.6 Dispositivo de Rastreo y Geolocalización; Tratamiento de Datos.</span></p>
    <p style="${sub};margin-left:14px">(a) El Arrendatario declara, reconoce y acepta que el Arrendador, directamente o por medio de un proveedor especializado, incluyendo al Concesionario, podrá instalar, mantener, activar, operar, revisar, sustituir o retirar en el Vehículo un dispositivo de rastreo, geolocalización, telemetría o sistema GPS, visible u oculto (el “Dispositivo”), con la finalidad de proteger la propiedad y seguridad del Vehículo, verificar su ubicación en caso de mora, incumplimiento, accidente, hurto, robo, retención, pérdida, abandono, uso no autorizado, riesgo para la conservación del Vehículo o requerimiento de autoridad competente, así como para facilitar la recuperación del Vehículo y la administración ordinaria de este Contrato. Salvo autorización expresa y separada del Arrendatario, dicho Dispositivo no deberá utilizarse para grabar audio, video o comunicaciones privadas.</p>
    <p style="${sub};margin-left:14px">(b) El Arrendatario se obliga a no remover, desconectar, alterar, bloquear, inhibir, manipular, dañar ni interferir de cualquier forma con el Dispositivo, su tarjeta, batería, antena, cableado, software o señal, ni permitir que terceros lo hagan, salvo autorización previa y por escrito del Arrendador o intervención técnica autorizada. Cualquier manipulación no autorizada del Dispositivo constituirá incumplimiento grave de este Contrato y dará derecho al Arrendador a exigir la reparación o reposición correspondiente, reclamar daños y perjuicios, suspender la aceptación del ejercicio de la Opción de Compra mientras subsista el incumplimiento, o terminar anticipadamente el Contrato conforme a sus términos. Los costos derivados de mantenimiento extraordinario, reposición, reparación, reinstalación o sustitución causados por daño, pérdida, manipulación, desconexión, negligencia o uso indebido del Dispositivo, serán asumidos por el Arrendatario.</p>
    <p style="${sub};margin-left:14px">(c) El Arrendatario autoriza de manera expresa, libre, informada, específica e inequívoca al Arrendador y a los proveedores que éste designe para recolectar, consultar, almacenar, conservar, procesar y utilizar la información generada por el dispositivo, incluyendo datos de ubicación, rutas, fechas, horas, eventos de encendido o apagado, alertas de movimiento, desconexión, manipulación, batería u otros datos técnicos asociados al Vehículo, únicamente para las finalidades previstas en este Contrato y en la medida necesaria para la protección de los derechos del Arrendador, la ejecución del Contrato, la seguridad del Vehículo y el cumplimiento de obligaciones legales o requerimientos de autoridad competente. El Arrendador deberá tratar dicha información con carácter confidencial y adoptar medidas razonables para protegerla contra acceso, uso, divulgación, alteración o pérdida no autorizados; en el entendido que podrá compartir la información únicamente con sus asesores, aseguradoras, proveedores de rastreo, talleres, autoridades administrativas, policiales o judiciales, tribunales competentes, o terceros que intervengan razonablemente en la protección, recuperación, defensa, ejecución o cumplimiento de este Contrato. La información se conservará durante la vigencia del Contrato y por el tiempo adicional que el Arrendador estime razonable y prudente, para atender reclamos, investigaciones, obligaciones legales, procedimientos judiciales o administrativos, cobranza, recuperación del Vehículo o defensa de derechos de las Partes.</p>
    <p style="${sub}"><span style="${subN}">1.7 Cadena de Propiedad del Vehículo.</span> El Arrendador declara que, a la Fecha de Celebración, el Vehículo no ha sido objeto de venta, cesión, transferencia, acto de disposición o gravamen no informado al Arrendatario. El Arrendador mantendrá la titularidad del Vehículo durante el Período de Vigencia, hasta que se ejerza válidamente la Opción de Compra y se cumplan las condiciones previstas en este Contrato.</p>

    <!-- 2. CANON Y CUOTAS -->
    <h3 style="${clausH}">2. Canon y Cuotas</h3>
    <p style="${sub}"><span style="${subN}">2.1 Canon Mensual.</span> El Arrendatario pagará al Arrendador de forma mensual durante el Período de Vigencia, a partir del primer mes completo en que se encuentre en posesión del Vehículo, el monto de <strong>${enLetrasUSD(canonMensual)}</strong> (<strong>US$ ${fmtUSD(canonMensual)}</strong>) (dicho monto, el “Canon Mensual”).</p>
    <p style="${sub}"><span style="${subN}">2.2 Pago del Canon Mensual.</span></p>
    <p style="${sub};margin-left:14px">(a) El Canon Mensual de cada mes podrá ser pagado en cualquier momento durante el mes calendario en curso, mediante uno o varios pagos parciales o abonos, y vencerá el último Día Hábil de dicho mes.</p>
    <p style="${sub};margin-left:14px">(b) Si vencido dicho período el(los) pago(s) parcial(es) efectuado(s) por el Arrendatario no alcanza(n) el monto del Canon Mensual, el saldo insoluto causará intereses moratorios desde el primer Día Hábil siguiente y hasta la fecha en que el pago se haga efectivo, calculados sobre el saldo pendiente del canon insoluto a la Tasa de Intereses Moratorios indicada en la Sección 2.4.</p>
    <p style="${sub};margin-left:14px">(c) Si el(los) pago(s) efectuado(s) durante un mes exceden el monto del Canon Mensual, el excedente se imputará automáticamente al Canon Mensual del mes calendario inmediatamente siguiente.</p>
    <p style="${sub}"><span style="${subN}">2.3 Imputación de los Pagos.</span> Todo pago recibido del Arrendatario se imputará en el siguiente orden: (i) en primer lugar, al capital pendiente de cánones de meses anteriores que se encuentren en mora; (ii) en segundo lugar, a los intereses moratorios causados sobre dichos meses anteriores en mora, calculados hasta la fecha en que el pago se haga efectivo a favor del Arrendador; (iii) y en tercer lugar, al canon correspondiente al mes en curso. Una vez cubiertos esos conceptos, cualquier excedente se imputará al canon del mes siguiente conforme a lo establecido precedentemente en la Sección 2.2(c).</p>
    <p style="${sub}"><span style="${subN}">2.4 Intereses Moratorios.</span> Los montos vencidos e insolutos del Canon Mensual causarán intereses moratorios a una tasa de <strong>dos coma cinco por ciento (2,5%) mensual</strong>, calculada en forma simple y proporcional por cada día calendario de mora sobre el saldo vencido y pendiente de pago (la “Tasa de Intereses Moratorios”), sin exceder el máximo permitido por la legislación venezolana aplicable.</p>
    <p style="${sub}"><span style="${subN}">2.5 Forma de Pago.</span> Todo pago a favor del Arrendador podrá efectuarse mediante cualquiera de los siguientes medios:</p>
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin:6px 0 8px">
      <tr><td style="padding:6px 9px;border:1px solid #DBEAFE;background:${purpleLight};font-weight:700;width:26%">a) Pago Móvil</td><td style="padding:6px 9px;border:1px solid #DBEAFE">100% Banco · RIF J-50.829.589-7 · teléfono 0424-2177798</td></tr>
      <tr><td style="padding:6px 9px;border:1px solid #DBEAFE;background:${purpleLight};font-weight:700">b) Binance</td><td style="padding:6px 9px;border:1px solid #DBEAFE">pagos@pagasi.io</td></tr>
      <tr><td style="padding:6px 9px;border:1px solid #DBEAFE;background:${purpleLight};font-weight:700">c) Transferencia o depósito en dólares</td><td style="padding:6px 9px;border:1px solid #DBEAFE">100% Banco, Banco Universal · titular PAGASI 18, C.A. · RIF J-50.829.589-7 · cuenta N° 0156-0030-61-0301030586</td></tr>
      <tr><td style="padding:6px 9px;border:1px solid #DBEAFE;background:${purpleLight};font-weight:700">d) Transferencia o depósito en bolívares</td><td style="padding:6px 9px;border:1px solid #DBEAFE">100% Banco, Banco Universal · titular PAGASI 18, C.A. · RIF J-50.829.589-7 · cuenta N° 0156-0030-62-0301030594</td></tr>
    </table>
    <p style="${sub}">El Arrendatario deberá enviar el comprobante de pago por WhatsApp al <strong>+58 424-217-7798</strong>. Cuando un pago sea realizado en bolívares, se aplicará el tipo de cambio oficial publicado por el Banco Central de Venezuela vigente en la fecha de recepción efectiva del pago, salvo acuerdo escrito distinto.</p>

    <!-- Cuadro referencial de cánones (informativo) -->
    <div style="margin:14px 0 6px;page-break-inside:avoid">
      <div style="background:${purple};color:#fff;text-align:center;padding:7px 10px;font-size:11px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;border-radius:3px 3px 0 0">Cuadro Referencial de Cánones</div>
      <table style="width:100%;border-collapse:collapse;font-size:10.5px">
        <tr>
          <th style="padding:5px 8px;border:1px solid #BFDBFE;background:${purpleLight};color:${purpleDark};font-size:9.5px;text-transform:uppercase;width:8%">N°</th>
          <th style="padding:5px 8px;border:1px solid #BFDBFE;background:${purpleLight};color:${purpleDark};font-size:9.5px;text-transform:uppercase;text-align:left">Mes del canon</th>
          <th style="padding:5px 8px;border:1px solid #BFDBFE;background:${purpleLight};color:${purpleDark};font-size:9.5px;text-transform:uppercase;width:24%">Vence (último día hábil)</th>
          <th style="padding:5px 8px;border:1px solid #BFDBFE;background:${purpleLight};color:${purpleDark};font-size:9.5px;text-transform:uppercase;text-align:right;width:22%">Canon Mensual</th>
        </tr>
        ${canonRows}
        <tr>
          <td colspan="3" style="padding:6px 8px;border:1px solid #BFDBFE;background:${purpleLight};text-align:right;font-weight:800;color:${purpleDark}">Total de Cánones (${plazoMeses} meses)</td>
          <td style="padding:6px 8px;border:1px solid #BFDBFE;background:${purpleLight};text-align:right;font-weight:900;color:${purpleDark}">US$ ${fmtUSD(totalCanones)}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:6px 8px;border:1px solid #DBEAFE;text-align:right;font-weight:700">Precio de Ejercicio de la Opción de Compra (Sección 4.3)</td>
          <td style="padding:6px 8px;border:1px solid #DBEAFE;text-align:right;font-weight:800">US$ ${fmtUSD(precioEjercicio)}</td>
        </tr>
      </table>
      <div style="font-size:9.5px;color:#666;line-height:1.5;margin-top:5px;text-align:justify">
        Cuadro <strong>referencial e informativo</strong>, elaborado a partir de las Secciones 2.1 y 3.1 de este Contrato; no modifica, sustituye ni amplía los términos allí previstos. Conforme a la <strong>Sección 2.2(a)</strong>, cada Canon Mensual puede pagarse en uno o varios abonos parciales dentro del mes calendario correspondiente. Las fechas de vencimiento indicadas no consideran feriados nacionales; de coincidir el último día hábil con un feriado, se aplicará lo previsto en la definición de “Día Hábil”. El Precio de Ejercicio es adicional a los Cánones Mensuales, conforme a la Sección 4.5.
      </div>
    </div>

    <!-- 3. PERÍODO DE VIGENCIA -->
    <h3 style="${clausH}">3. Período de Vigencia</h3>
    <p style="${sub}"><span style="${subN}">3.1 Período de Vigencia.</span> El Contrato estará vigente desde la Fecha de Celebración, hasta (a) el último día del mes que corresponda, <strong>${numTexto(plazoMeses)} (${plazoMeses}) meses</strong> (el “Plazo”) con posterioridad a la Fecha de Celebración (el “Día de Vencimiento Previsto”); o (b) la fecha posterior al Día de Vencimiento Previsto, en la que el Arrendatario cumpla con cualquier obligación de pago pendiente bajo la Cláusula 2, en caso que al Día de Vencimiento Previsto el Arrendatario se encuentre en mora de sus obligaciones bajo dicha cláusula; o (c) la fecha anterior al Día de Vencimiento Previsto, en la que el Arrendatario haya (i) cumplido con el pago adelantado íntegro de las sumas debidas como Canon Mensual bajo la Cláusula 2 para la totalidad del Plazo arriba señalado; y, adicionalmente, (ii) ejercido la Opción de Compra, en cumplimiento de lo establecido en la Cláusula 4 (en todos los casos anteriores, el “Período de Vigencia”).</p>
    <p style="${sub}"><span style="${subN}">3.2 No-Prorrogable.</span> El Período de Vigencia no será prorrogable en ningún caso, salvo que medie acuerdo expreso y por escrito de las Partes.</p>
    <p style="${sub}"><span style="${subN}">3.3 Efectos de la Terminación.</span> Terminado el Contrato por cualquier causa (incluyendo bajo la Sección 8.1(c)), cuando no se haya perfeccionado la Opción de Compra y transferencia de la propiedad del Vehículo, el Arrendatario deberá restituir de inmediato el Vehículo al Arrendador, junto con sus llaves, documentos y accesorios, en condiciones razonables de uso y conservación, salvo el desgaste ordinario derivado del uso normal del mismo durante el Período de Vigencia.</p>

    <!-- 4. OPCIÓN A COMPRA -->
    <h3 style="${clausH}">4. Opción a Compra</h3>
    <p style="${sub}"><span style="${subN}">4.1 Opción a Compra.</span> El Arrendador concede al Arrendatario una opción de compra sobre el Vehículo (la “Opción de Compra”), la cual podrá ser ejercida en cualquier momento durante la vigencia del presente Contrato, en la forma prevista en esta Cláusula 4; siempre y cuando el Arrendatario no se encuentre en mora respecto de sus obligaciones previstas en este Contrato al momento del ejercicio de dicha Opción de Compra.</p>
    <p style="${sub}"><span style="${subN}">4.2 Ejercicio.</span> Para ejercer la Opción de Compra, el Arrendatario deberá (a) enviar al Arrendador una comunicación escrita manifestando su intención expresa de ejercer dicha Opción de Compra; acompañada de (b) evidencia de pago del Precio de Ejercicio, a favor del Arrendador, realizado en la forma prevista en la Sección 2.5; sin perjuicio que el Arrendatario deba pagar simultáneamente cualquier Canon Mensual en mora o intereses moratorios existente para el momento de ejercicio de la Opción de Compra. Recibido lo anterior, el Arrendador aceptará el ejercicio de la Opción de Compra mediante cualquier manifestación escrita de aceptación al Arrendatario.</p>
    <p style="${sub}"><span style="${subN}">4.3 Precio de Ejercicio.</span> El precio para ejercer la Opción de Compra será equivalente a <strong>UN (1) CANON MENSUAL</strong> (<strong>US$ ${fmtUSD(precioEjercicio)}</strong>) (el “Precio de Ejercicio”), más los Impuestos que correspondan.</p>
    <p style="${sub}"><span style="${subN}">4.4 Transferencia de la Propiedad.</span> Una vez aceptada la Opción de Compra por el Arrendador, se entenderá materializada la transferencia de la propiedad del Vehículo a favor del Arrendatario, en los términos y con las limitaciones previstas en la Cláusula 5 y este Contrato en general. Quedará habilitado el Arrendatario, a partir de ese momento, a realizar los actos, trámites y diligencias para la inscripción y/o registro del título de propiedad correspondiente; lo cual deberá realizar en estricto cumplimiento de lo previsto en las Cláusulas 9 y 5.3 del Contrato.</p>
    <p style="${sub}"><span style="${subN}">4.5 Efectos de la Opción de Compra.</span> Las Partes expresamente declaran, manifiestan y reconocen que, una vez ejecutada y perfeccionada la Opción de Compra, el resto de las disposiciones, términos y condiciones del Contrato mantienen su plena vigencia, incluyendo las obligaciones del Arrendatario bajo las Cláusulas 1, 2, 5, 6 y 7, así como del resto del Contrato en general. Específicamente, y para evitar dudas, expresamente se reconoce que las obligaciones de continuar pagando el Canon Mensual aplicable para la totalidad del Plazo, durante el Período de Vigencia, continúa plenamente vigente, exactamente en los términos previstos en la Cláusula 2, incluso cuando se haga ejercicio de la Opción de Compra. Es decir, incluso si el Arrendatario ejerciera la Opción de Compra en la propia Fecha de Celebración, se mantendrá exactamente igual su obligación de pagar los Cánones Mensuales correspondientes a todo el Plazo, en el entendido que en ese caso los Cánones Mensuales tendrán el carácter de cuota del precio, a tenor de lo previsto en el artículo 1.579 del Código Civil.</p>

    <!-- 5. INALIENABILIDAD -->
    <h3 style="${clausH}">5. Inalienabilidad del Vehículo</h3>
    <p style="${sub}"><span style="${subN}">5.1 Prohibición de Enajenar y Gravar el Vehículo.</span> Durante el Período de Vigencia el Arrendatario se obliga a no ceder, vender, transferir la propiedad ni la posesión, subarrendar, dar en usufruto, ni trasladar fuera del territorio de la República Bolivariana de Venezuela, el Vehículo; en el entendido que hasta que se cumplan todas las obligaciones previstas bajo la Cláusula 2 de este Contrato, el Vehículo tendrá, para todos los efectos legales, una prohibición de enajenar y gravar, oponible a terceros (la “Prohibición de Enajenar y Gravar”). La Prohibición de Enajenar y Gravar se mantendrá vigente hasta el levantamiento de la misma, realizada en la forma prevista en la Sección 9.2.</p>
    <p style="${sub}"><span style="${subN}">5.2 Razonabilidad de la Prohibición de Enajenar y Gravar.</span> La Prohibición de Enajenar y Gravar prevista precedentemente en la Sección 5.1 constituye una medida razonable, racional y debidamente justificada en su causa contractual, por cuanto la misma persigue facilitar el derecho de crédito del Arrendador, en caso de mora o incumplimiento contractual del Arrendatario de sus obligaciones de pago previstas bajo este Contrato, para facilitar el ejercicio de cualquier acción o pretensión de cobro; incluyendo lo establecido en la Sección 8.2 del Contrato. Además, la Prohibición de Enajenar y Gravar es una medida voluntaria estrictamente limitada en el tiempo al Período de Vigencia.</p>
    <p style="${sub}"><span style="${subN}">5.3 Nota de Registro.</span> En caso de ejercicio de la Opción de Compra por el Arrendatario, cualquier inscripción o registro del título de propiedad ante el Instituto Nacional de Transporte Terrestre (“INTT”) o cualesquiera otras autoridades competentes, deberá necesariamente incluir una nota, observación o mención sobre la Prohibición de Enajenar y Gravar e inalienabilidad del Vehículo, a favor del Arrendador, la cual deberá estar reflejada en el título de propiedad, según lo dispuesto en la Sección 9.2.</p>

    <!-- 6. IMPUESTOS -->
    <h3 style="${clausH}">6. Impuestos</h3>
    <p style="${sub}"><span style="${subN}">6.1 Carga de las Partes.</span> Cada Parte tendrá la carga de pagar los impuestos, tasas o tributos, nacionales, locales o municipales (los “Impuestos”), que correspondan a cada una bajo las transacciones previstas en este Contrato, conforme a la legislación aplicable.</p>
    <p style="${sub}"><span style="${subN}">6.2 Impuestos Específicos.</span> Cuando así corresponda según lo establecido en el ordenamiento jurídico vigente, a los montos a ser pagados bajo este Contrato por concepto de Canon Mensual, Precio de Ejercicio y/o intereses moratorios, deberá aplicarse (a) el Impuesto al Valor Agregado (“IVA”), (b) el Impuesto a las Grandes Transacciones Financieras (“IGTF”), y/o (c) cualquier otro Impuesto; los cuales deberán ser pagados por el Arrendatario al Arrendador, en la forma prevista legalmente.</p>
    <p style="${sub}"><span style="${subN}">6.3 Emisión de Facturas.</span> El Arrendador emitirá al Arrendatario las facturas que correspondan bajo el ordenamiento jurídico venezolano, las cuales deberán reflejar los Impuestos aplicables.</p>

    <!-- 7. RESPONSABILIDAD LEGAL -->
    <h3 style="${clausH}">7. Responsabilidad Legal</h3>
    <p style="${sub}"><span style="${subN}">7.1 Responsabilidad del Arrendatario.</span> Las multas, infracciones de tránsito, impuestos, tasas, daños, accidentes, hechos ilícitos, responsabilidades civiles, penales, administrativas o de cualquier otra naturaleza que se originen con posterioridad a la fecha y hora de entrega material del Vehículo en la Fecha de Celebración, serán por cuenta exclusiva del Arrendatario.</p>
    <p style="${sub}"><span style="${subN}">7.2 Oponibilidad a Terceros.</span> Lo previsto en la Sección 7.1 precedente es oponible a terceros, inclusive antes de cualquier registro del derecho de propiedad a favor del Arrendatario que se realice bajo las Cláusulas 5 y 9 del Contrato.</p>
    <p style="${sub}"><span style="${subN}">7.3 Indemnidad.</span> El Arrendatario se obliga a indemnizar y mantener indemne al Arrendador ante cualquier hecho, reclamación, indemnización o daño de un tercero, por el cual se pretendiera o debiera responder el Arrendador en contravención a lo previsto precedentemente en esta Cláusula 7.</p>

    <!-- 8. INCUMPLIMIENTOS -->
    <h3 style="${clausH}">8. Incumplimientos Contractuales</h3>
    <p style="${sub}"><span style="${subN}">8.1 Remedios Contractuales en Caso de Incumplimiento.</span> Ante cualquier incumplimiento de las obligaciones asumidas bajo este Contrato por el Arrendatario (“Incumplimientos del Arrendatario”), el Arrendador podrá (a) exigir y demandar el pago inmediato de (i) las sumas vencidas; (ii) intereses moratorios; y/o (iii) daños y perjuicios; y/o (b) suspender su obligación de aceptar el ejercicio de la Opción de Compra mientras subsista la mora; y/o (c) dar por terminado anticipadamente el Contrato mediante comunicación escrita dada al Arrendatario, sin perjuicio de las acciones legales que correspondan.</p>
    <p style="${sub}"><span style="${subN}">8.2 Ejecución del Vehículo.</span> En caso de Incumplimientos del Arrendatario, quedará automáticamente habilitado el Arrendador para cobrar sus derechos de crédito mediante la ejecución judicial del Vehículo, para lo cual podrá solicitar y hacer ejecutar medidas cautelares, asegurativas o anticipadas, incluyendo de embargo del Vehículo, ante cualquier tribunal de Venezuela en el que estuviere ubicado el Vehículo; sin perjuicio de lo previsto en la Sección 11.1(b) del Contrato.</p>

    <!-- 9. ACTOS DE REGISTRO -->
    <h3 style="${clausH}">9. Actos de Registro</h3>
    <p style="${sub}"><span style="${subN}">9.1 Registro del Título.</span> Una vez ejercida válidamente la Opción de Compra, el Arrendador se obliga a realizar, tramitar, gestionar, suscribir y presentar, inmediatamente con posterioridad a la aceptación de la Opción de Compra, todos los documentos, planillas, solicitudes, declaraciones y recaudos que sean necesarios para formalizar el traspaso de propiedad del Vehículo ante el INTT o cualquier otra autoridad competente en la República Bolivariana de Venezuela.</p>
    <p style="${sub}"><span style="${subN}">9.2 Nota de Prohibición de Enajenar y Gravar; Levantamiento.</span> El título de propiedad del Vehículo a favor del Arrendatario, emitido por el INTT o cualquier otra autoridad competente en la República Bolivariana de Venezuela, deberá incluir una nota, observación o mención expresa en el mismo, con relación a la existencia de la Prohibición de Enajenar y Gravar a favor del Arrendador bajo este Contrato. En caso de cualquier duda sobre cómo realizar dicha nota, puede subsumirse la misma como sinónimo a “reserva de dominio” o cualquier otro término equivalente, usado por el INTT o la autoridad correspondiente. En ese mismo sentido, una vez expirado el Período de Vigencia y terminado el Contrato, se podrá proceder a levantar la Prohibición de Enajenar y Gravar y eliminar dicha observación del título de propiedad del Vehículo, ante el INTT o la autoridad que corresponda.</p>
    <p style="${sub}"><span style="${subN}">9.3 Gastos y Formalización.</span> La celebración, validez y eficacia de este Contrato no estarán condicionadas a su autenticación, reconocimiento de firmas o protocolización ante notaría. El Arrendatario asumirá únicamente los gastos que legalmente correspondan para el trámite del título de propiedad ante el INTT u otra autoridad competente, incluyendo, cuando proceda, la inscripción o levantamiento de la Prohibición de Enajenar y Gravar sobre el Vehículo.</p>
    <p style="${sub}"><span style="${subN}">9.4 Colaboración de Buena Fe.</span> Las Partes actuarán de forma coordinada y colaborarán razonablemente de buena fe, en los trámites previstos en esta Cláusula 9.</p>

    <!-- 10. NOTIFICACIONES -->
    <h3 style="${clausH}">10. Notificaciones</h3>
    <p style="${sub}"><span style="${subN}">10.1 Forma de las Notificaciones.</span> Las notificaciones y comunicaciones entre las Partes, a efectos de este Contrato, se tendrán como válidas y perfeccionadas cuando se realicen por escrito, y sean remitidas:</p>
    <p style="${sub};margin-left:14px">(a) a las direcciones de correo electrónico (“E-Mail”) abajo indicadas en la Sección 10.2; en el entendido de que, en este caso, las mismas se entenderán perfeccionadas, válidas y efectivamente realizadas al día hábil siguiente (a partir de las 00:00 am (hora de Venezuela), de ese día); o</p>
    <p style="${sub};margin-left:14px">(b) a las direcciones físicas de oficina abajo indicadas en la Sección 10.2; en el entendido de que, en este caso, las mismas se entenderán perfeccionadas, válidas y efectivamente realizadas única y exclusivamente si la Parte a quien se dirige la comunicación continúa laborando o prestando servicios en la oficina a la cual se dirige la comunicación. En este caso la notificación se entenderá recibida al día hábil siguiente de la fecha de recepción (a partir de las 00:00 am (hora de Venezuela), de ese día).</p>
    <p style="${sub}"><span style="${subN}">10.2 Direcciones y Destino de las Notificaciones.</span> Las Partes escogen como destino válido para practicar las notificaciones, comunicaciones, citaciones y/o entregas bajo este Contrato, las siguientes direcciones físicas y de E-Mail:</p>
    <p style="${sub};margin-left:14px">(a) Al Arrendatario: (i) E-Mail: ${blank(cliEmail,26)}; (ii) Dirección: ${blank(cliDir,34)}; (iii) Teléfono: ${blank(cliTel,16)}.</p>
    <p style="${sub};margin-left:14px">(b) Al Arrendador: (i) E-Mail: <strong>info@pagasi.io</strong>; (ii) Dirección: Avenida Los Chorros, Quinta Miramar, Urbanización Sebucán, Caracas, Estado Miranda, Zona Postal 1071; (iii) Teléfono/WhatsApp: <strong>+58 424-217-7798</strong>.</p>
    <p style="${sub}">Cualquier modificación de estas direcciones físicas, de E-Mail y de datos de contacto telefónicos, será comunicada entre las Partes de inmediato.</p>

    <!-- 11. MISCELÁNEAS -->
    <h3 style="${clausH}">11. Interpretación del Acuerdo y Misceláneas</h3>
    <p style="${sub}"><span style="${subN}">11.1 Ley Aplicable; Jurisdicción.</span></p>
    <p style="${sub};margin-left:14px">(a) El presente Contrato se regirá e interpretará de conformidad con las leyes de la República Bolivariana de Venezuela.</p>
    <p style="${sub};margin-left:14px">(b) Para todos los efectos derivados de la interpretación, ejecución, cumplimiento, terminación o liquidación del presente Contrato, las Partes eligen como domicilio especial, único y excluyente la ciudad de Caracas, República Bolivariana de Venezuela, a la jurisdicción de cuyos tribunales declaran someterse, con renuncia expresa a cualquier otro fuero o domicilio que pudiera corresponderles, salvo para efectos de lo previsto en la Sección 8.2.</p>
    <p style="${sub}"><span style="${subN}">11.2 Confidencialidad.</span> Las Partes se obligan a mantener confidencialidad sobre los términos y condiciones de este Contrato y no podrán comunicarlos a terceros sin consentimiento previo y por escrito de la otra Parte, salvo cuando la divulgación sea requerida por ley, autoridad competente, tribunal, asesor legal, contable o financiero, aseguradora, entidad bancaria, proveedor necesario para la ejecución del Contrato, o cuando sea razonablemente necesaria para ejercer derechos, cumplir obligaciones o defender intereses derivados de este Contrato.</p>
    <p style="${sub}"><span style="${subN}">11.3 Acuerdo Definitivo, Adhesión y Vigencia.</span> El presente Contrato es definitivo y vinculante. El Arrendador emite sus términos como oferta contractual y el Arrendatario manifiesta su aceptación íntegra mediante su firma. Para su validez entre las Partes no se requerirá firma adicional del Arrendador, del concesionario o establecimiento vendedor, ni autenticación, reconocimiento de firmas o protocolización notarial. La entrega del Vehículo, la recepción de pagos o la ejecución de las obligaciones previstas en este Contrato constituirán, además, actos inequívocos de ejecución por parte del Arrendador.</p>
    <p style="${sub}"><span style="${subN}">11.4 Títulos y Encabezados.</span> Los encabezados y/o títulos de las cláusulas que forman parte del presente Contrato se establecen únicamente para facilitar la lectura, interpretación e implementación del mismo, pero no constituyen parte integrante del Contrato.</p>
    <p style="${sub}"><span style="${subN}">11.5 Separabilidad.</span> Las Partes convienen que en caso de que cualquier parte o sección del presente Contrato fuera declarada nula, inválida o inoperante, el mismo deberá ser interpretado omitiendo única y exclusivamente las disposiciones declaradas nulas, inválidas o inoperantes; procurando preservar la validez y eficacia del resto del Contrato, obedeciendo a la intención de las Partes manifestada en el presente Contrato, así como a la buena fe mediante la cual entran en el presente Contrato. Las obligaciones declaradas total o parcialmente nulas, de ser el caso, subsistirán como obligaciones de derecho natural, susceptibles de su cumplimiento por las Partes en base a la buena fe, sin que corresponda la acción de repetición, de enriquecimiento sin causa, de pago de lo indebido ni por responsabilidad contractual o extracontractual alguna, en dicho caso.</p>
    <p style="${sub}"><span style="${subN}">11.6 Términos Definidos.</span> Para efectos de la lectura e interpretación del presente Contrato, a menos que el contexto requiera algo distinto:</p>
    <div style="font-size:10.5px;line-height:1.55;color:#333;margin:4px 0 8px 14px;column-count:2;column-gap:22px">
      <div>“Arrendador” tiene el significado dado en el preámbulo del mismo.</div>
      <div>“Arrendatario” tiene el significado dado en el preámbulo del mismo.</div>
      <div>“Bolívar(es)” significa la moneda de curso legal en Venezuela.</div>
      <div>“Canon Mensual” tiene el significado dado en la Sección 2.1.</div>
      <div>“Concesionario” o “establecimiento vendedor” significa exclusivamente el proveedor o punto de entrega del Vehículo, sin condición de Parte ni obligación de firma bajo este Contrato.</div>
      <div>“Contrato” tiene el significado dado en el preámbulo del mismo.</div>
      <div>“Día de Vencimiento Previsto” tiene el significado dado en la Sección 3.1.</div>
      <div>“Día Hábil” significa un día (i) diferente al sábado o el domingo o un feriado nacional, y (ii) en el que los bancos comerciales están abiertos y ofrecen servicios en Venezuela.</div>
      <div>“Dispositivo” tiene el significado dado en la Sección 1.6(a).</div>
      <div>“Dólar(es)” significa Dólares de los Estados Unidos de América.</div>
      <div>“E-Mail” tiene el significado dado en la Sección 10.1(a).</div>
      <div>“Fecha de Celebración” tiene el significado dado en el preámbulo del mismo.</div>
      <div>“Garantía del Fabricante” tiene el significado dado en la Sección 1.3.</div>
      <div>“IGTF” tiene el significado dado en la Sección 6.2.</div>
      <div>“Impuestos” tiene el significado dado en la Sección 6.1.</div>
      <div>“Incumplimientos del Arrendatario” tiene el significado dado en la Sección 8.1.</div>
      <div>“INTT” tiene el significado dado en la Sección 5.3.</div>
      <div>“IVA” tiene el significado dado en la Sección 6.2.</div>
      <div>“Opción de Compra” tiene el significado dado en la Sección 4.1.</div>
      <div>“Partes” tiene el significado dado en el preámbulo del mismo.</div>
      <div>“Período de Vigencia” tiene el significado dado en la Sección 3.1.</div>
      <div>“Plazo” tiene el significado dado en la Sección 3.1.</div>
      <div>“Póliza de Seguro” tiene el significado dado en la Sección 1.5.</div>
      <div>“Precio de Ejercicio” tiene el significado dado en la Sección 4.3.</div>
      <div>“Prohibición de Enajenar y Gravar” tiene el significado dado en la Sección 5.1.</div>
      <div>“Reglamento LTT—Motos” tiene el significado dado en los “Considerandos” del mismo.</div>
      <div>“RIF” tiene el significado dado en el preámbulo del mismo.</div>
      <div>“Tasa de Intereses Moratorios” tiene el significado dado en la Sección 2.4.</div>
      <div>“Vehículo” tiene el significado dado en los “Considerandos” del mismo.</div>
      <div>“Venezuela” significa la República Bolivariana de Venezuela.</div>
    </div>
    <p style="${sub}"><span style="${subN}">11.7 Debida Asistencia Legal.</span> El Arrendatario declara, manifiesta, reconoce y acepta que, durante la negociación del presente Contrato, ha estado en todo momento asesorado por abogados de su elección y confianza. Cada Parte correrá con los gastos de sus abogados y asesores legales, según corresponda.</p>
    <p style="${sub}"><span style="${subN}">11.8 Ejemplares.</span> Este Contrato se extiende en dos (2) ejemplares de igual tenor y valor: uno para el Arrendatario y otro para el Arrendador.</p>

    <p style="${p};margin-top:16px">El Arrendatario firma el presente Contrato en señal de aceptación íntegra de sus términos, en la Fecha de Celebración indicada a continuación.</p>

    <!-- Firma -->
    <div style="margin-top:34px;page-break-inside:avoid">
      <div style="font-weight:800;font-size:11.5px;color:${purpleDark};margin-bottom:30px">POR EL ARRENDATARIO</div>
      <div style="border-top:1px solid #444;max-width:330px;padding-top:6px;font-size:11.5px;line-height:1.8">
        <strong>${cliNom||'________________________________'}</strong><br>
        C.I. ${cliCi||'________________________'}<br>
        FECHA: _____ / _____ / __________
      </div>
    </div>

    <!-- ANEXO -->
    <div style="page-break-before:always;margin-top:34px;padding-top:18px;border-top:2px solid ${purple}">
      <div style="text-align:center;font-weight:900;font-size:12.5px;color:${purpleDark};letter-spacing:.3px;margin-bottom:4px">ANEXO AL CONTRATO DE ARRIENDO-VENTA DE VEHÍCULO AUTOMOTOR</div>
      <div style="text-align:center;font-weight:800;font-size:11.5px;color:${purple};margin-bottom:18px">COMUNICACIÓN DE EJERCICIO DE OPCIÓN DE COMPRA Y ACEPTACIÓN</div>

      <p style="${sub}">Caracas, _____ de ________________ de __________.</p>
      <p style="${sub}"><strong>Señores</strong><br><strong>PAGASI 18, C.A.</strong><br>Presente.-</p>
      <p style="${sub}">Yo, ${blank(cliNom,32)}, titular de la cédula de identidad N° ${blank(cliCi,14)}, en mi carácter de Arrendatario bajo el Contrato de Arriendo-Venta de Vehículo Automotor celebrado en fecha ${blank(fechaContrato,20)} (el “Contrato”), notifico formal e irrevocablemente mi decisión de ejercer la Opción de Compra sobre la motocicleta identificada en dicho contrato como marca ${blank(mMarca,12)}, modelo ${blank(mModelo,14)}, año ${blank(mAnio,7)}, placa N° ${blank(mPlaca,11)}, serial de carrocería o chasis N° ${blank(mSerialChasis,18)} y serial de motor N° ${blank(mSerialMotor,18)}.</p>
      <p style="${sub}">A tales efectos, en esta misma fecha realizo el pago del Precio de Ejercicio por la cantidad de <strong>US$ ${fmtUSD(precioEjercicio)}</strong>, mediante ____________________________. Solicito al Arrendador registrar y procesar el ejercicio de la Opción de Compra conforme al Contrato.</p>
      <p style="${sub}">Atentamente,</p>
      <div style="margin-top:34px;border-top:1px solid #444;max-width:330px;padding-top:6px;font-size:11.5px;line-height:1.8">
        <strong>${cliNom||'________________________________'}</strong><br>
        C.I. ${cliCi||'________________________'}<br>
        Fecha: _____ / _____ / __________
      </div>
    </div>

    <div style="text-align:center;font-size:10px;color:#999;margin-top:18px;padding-top:10px;border-top:1px solid #eee">
      ${empresaUp} · Contrato de Arriendo-Venta de Vehículo Automotor · Ref. ${c.id||''}
    </div>
  </div>`;
}

function _renderPagare(){
  var ctx = _docCtx();
  if(!ctx){ $('cz').innerHTML='<div class="empty" style="margin-top:60px"><span class="e-ic">CTR</span><div class="e-tt">No hay créditos</div><div style="font-size:11.5px">Registra un crédito primero</div></div>'; return; }
  var c=ctx.c, cli=ctx.cli, emp=ctx.emp, empresaUp=ctx.empresaUp, logoSrc=ctx.logoSrc, hoy=ctx.hoy, fechaContrato=ctx.fechaContrato, V=ctx.V, Vm=ctx.Vm;
  var purple=ctx.purple, purpleDark=ctx.purpleDark, purpleLight=ctx.purpleLight;
  var tableHdr=ctx.tableHdr, clausH=ctx.clausH, p=ctx.p, lblCell=ctx.lblCell, valCell=ctx.valCell;
  // El pagaré cubre el monto sujeto a canon (lo que financia) — si prefieres el total, cambia c.fin por c.total
  var monto = parseFloat(c.fin)||parseFloat(c.total)||0;
  var montoLetras = _numALetras(monto);
  var plazoMeses = c.plazo || 12;
  var cuotaQ = parseFloat(c.cuotaQ||c.cuota)||0;
  var totalCuotas = c.totalCuotas || (plazoMeses*2);
  // Fecha de vencimiento (estimación: fecha inicio + plazo en meses)
  var fechaBase = c.fecha ? parseFechaLocal(c.fecha) : new Date();
  var fechaVenc = new Date(fechaBase); fechaVenc.setMonth(fechaVenc.getMonth()+plazoMeses);
  var fechaVencStr = fechaVenc.toLocaleDateString('es-VE',{day:'2-digit',month:'long',year:'numeric'});

  $('cz').innerHTML = `<div class="cdoc" style="font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#222;max-width:820px;margin:0 auto;padding:20px 28px">

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>${logoSrc?`<img src="${logoSrc}" style="height:46px;object-fit:contain">`:`<div style="font-size:22px;font-weight:900;color:${purple}">${empresaUp}</div>`}</div>
      <div style="font-size:11px;color:#555"><strong>N° de Pagaré:</strong> <span style="border-bottom:1px solid #888;padding:0 24px 2px">PAG-${c.id||'________'}</span></div>
    </div>

    <!-- Título principal -->
    <div style="background:${purple};color:#fff;text-align:center;padding:12px 16px;border-radius:4px;margin-bottom:4px;border-bottom:4px solid #1D4ED8">
      <div style="font-size:15.5px;font-weight:900;letter-spacing:.3px">PAGARÉ A LA ORDEN</div>
    </div>

    <!-- Datos superiores -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin:14px 0 10px;font-size:11.5px">
      <div><strong style="color:${purple}">Ciudad / Estado:</strong> ${emp.ciudad||'Caracas'}</div>
      <div><strong style="color:${purple}">Fecha de emisión:</strong> ${fechaContrato}</div>
      <div><strong style="color:${purple}">Contrato asociado:</strong> ${c.id||'—'}</div>
    </div>
    <div style="border-bottom:1px solid #ccc;margin-bottom:6px"></div>

    <!-- Monto destacado -->
    <div style="background:${purpleLight};border:2px solid ${purple};border-radius:8px;padding:16px 20px;margin:14px 0;text-align:center">
      <div style="font-size:11px;color:${purpleDark};font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Valor del pagaré</div>
      <div style="font-size:28px;font-weight:900;color:${purpleDark};letter-spacing:-.5px">${Vm(monto)}</div>
      <div style="font-size:11.5px;color:#444;margin-top:6px;font-style:italic">${montoLetras}</div>
    </div>

    <!-- Texto principal del pagaré -->
    <h3 style="${clausH}">DECLARACIÓN DE PAGO</h3>
    <p style="${p}">Yo, <strong>${V(cli.nombre||c.cli)}</strong>, venezolano(a), mayor de edad, titular de la cédula de identidad N° <strong>${V(cli.cedula)}</strong>, domiciliado(a) en <strong>${V(cli.dir||cli.ciudad)}</strong>, declaro por medio del presente <strong>PAGARÉ</strong> que debo y pagaré sin aviso y sin protesto a la orden de <strong>${empresaUp}</strong>, inscrita bajo el RIF <strong>${V(emp.rif)}</strong>, con domicilio en ${V(emp.direccion)}, la cantidad de <strong>${Vm(monto)}</strong> (<em>${montoLetras}</em>), derivada del contrato de arrendamiento con opción a compra N° <strong>${c.id}</strong>.</p>

    <!-- Condiciones de pago -->
    <h3 style="${clausH}">CONDICIONES DE PAGO</h3>
    <table style="width:100%;border-collapse:collapse;margin-top:6px;border:1px solid #DBEAFE">
      <tr><td style="${lblCell}">Monto total adeudado:</td><td style="${valCell};font-weight:700">${Vm(monto)}</td></tr>
      <tr><td style="${lblCell}">Forma de pago:</td><td style="${valCell}">${totalCuotas} cuotas quincenales consecutivas</td></tr>
      <tr><td style="${lblCell}">Monto de cada cuota:</td><td style="${valCell};font-weight:700">${Vm(cuotaQ)}</td></tr>
      <tr><td style="${lblCell}">Fecha de inicio:</td><td style="${valCell}">${c.fecha||hoy}</td></tr>
      <tr><td style="${lblCell}">Fecha de vencimiento final:</td><td style="${valCell};font-weight:700">${fechaVencStr}</td></tr>
      <tr><td style="${lblCell}">Moneda:</td><td style="${valCell};font-weight:700">Dólares Americanos (USD) — exclusivamente</td></tr>
      <tr><td style="${lblCell}">Lugar de pago:</td><td style="${valCell}">${V(emp.direccion||emp.ciudad)}</td></tr>
    </table>

    <!-- Cláusula de mora -->
    <h3 style="${clausH}">MORA Y CONSECUENCIAS DEL INCUMPLIMIENTO</h3>
    <p style="${p}">El atraso en el pago de cualquier cuota por más de <strong>cuatro (4) días</strong> contados desde la fecha de vencimiento, generará un recargo de mora equivalente al <strong>5% sobre el monto de la cuota vencida</strong>, adicional al capital adeudado, conforme a lo establecido en la Cláusula Sexta del contrato principal.</p>
    <p style="${p}">En caso de incumplimiento del pago de <strong>cuatro (4) o más cuotas consecutivas</strong>, o de atraso superior a <strong>sesenta (60) días</strong>, la totalidad del saldo adeudado se considerará de <strong>plazo vencido</strong>, quedando facultado el tenedor del presente pagaré para exigir el pago inmediato e íntegro de la suma pendiente por la vía judicial o extrajudicial que estime conveniente.</p>

    <!-- Renuncia de aviso y protesto -->
    <h3 style="${clausH}">RENUNCIA DE AVISO Y PROTESTO</h3>
    <p style="${p}">El suscriptor renuncia expresamente a los beneficios de notificación, aviso y protesto por falta de aceptación o pago, así como a cualquier otra formalidad exigida por el Código de Comercio venezolano para el ejercicio de las acciones cambiarias derivadas del presente pagaré.</p>

    <!-- Fiador solidario -->
    <h3 style="${clausH}">AVAL / FIADOR SOLIDARIO</h3>
    <p style="${p}">Se constituye como <strong>avalista y principal pagador solidario</strong> de las obligaciones aquí contenidas, renunciando al beneficio de excusión y de división:</p>
    <table style="width:100%;border-collapse:collapse;margin-top:6px;border:1px solid #DBEAFE">
      <tr><td style="${lblCell}">Nombre y Apellido:</td><td style="${valCell}">${V(cli.fiador_nom)}</td></tr>
      <tr><td style="${lblCell}">Cédula de Identidad:</td><td style="${valCell}">${V(cli.fiador_ci)}</td></tr>
      <tr><td style="${lblCell}">Teléfono:</td><td style="${valCell}">${V(cli.fiador_tel)}</td></tr>
      <tr><td style="${lblCell}">Parentesco / Relación:</td><td style="${valCell}">${V(cli.fiador_rel)}</td></tr>
    </table>

    <!-- Domicilio especial -->
    <h3 style="${clausH}">DOMICILIO ESPECIAL</h3>
    <p style="${p}">Para todos los efectos legales derivados del presente pagaré, el suscriptor elige como domicilio especial la ciudad de <strong>${emp.ciudad||'Caracas'}</strong>, sometiéndose a la jurisdicción de sus tribunales competentes, renunciando a cualquier otro fuero que pudiera corresponderle.</p>

    <!-- Firmas -->
    <div style="margin-top:28px;border-top:2px solid ${purple};padding-top:18px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div style="background:${purpleLight};padding:14px 10px;border-radius:4px">
          <div style="background:${purple};color:#fff;font-weight:800;font-size:11.5px;padding:5px 8px;border-radius:3px;margin-bottom:10px;text-align:center">EL DEUDOR (SUSCRIPTOR)</div>
          <div style="display:grid;grid-template-columns:1fr 60px;gap:8px;align-items:end">
            <div style="text-align:center;padding-top:46px">
              <div style="border-top:1px solid #333;padding-top:6px;font-size:10px;line-height:1.45">
                Firma<br>
                Nombre: ${cli.nombre||c.cli||''}<br>
                C.I.: ${cli.cedula||''}
              </div>
            </div>
            <div>
              <div style="border:1px dashed #666;background:#fff;height:70px;border-radius:3px"></div>
              <div style="text-align:center;font-size:9px;color:#555;margin-top:3px;font-weight:700">HUELLA</div>
            </div>
          </div>
        </div>
        <div style="background:#EFF6FF;padding:14px 10px;border-radius:4px">
          <div style="background:#3B82F6;color:#fff;font-weight:800;font-size:11.5px;padding:5px 8px;border-radius:3px;margin-bottom:10px;text-align:center">EL AVALISTA / FIADOR</div>
          <div style="display:grid;grid-template-columns:1fr 60px;gap:8px;align-items:end">
            <div style="text-align:center;padding-top:46px">
              <div style="border-top:1px solid #333;padding-top:6px;font-size:10px;line-height:1.45">
                Firma<br>
                Nombre: ${cli.fiador_nom||''}<br>
                C.I.: ${cli.fiador_ci||''}
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
      ${empresaUp} · Pagaré a la Orden · Instrumento complementario al Contrato N° ${c.id} · Venezuela
    </div>
  </div>`;
}

// CARTA DE INSTRUCCIONES — autorización del cliente al arrendador
function _renderCartaInstrucciones(){
  var ctx = _docCtx();
  if(!ctx){ $('cz').innerHTML='<div class="empty" style="margin-top:60px"><span class="e-ic">CTR</span><div class="e-tt">No hay créditos</div><div style="font-size:11.5px">Registra un crédito primero</div></div>'; return; }
  var c=ctx.c, cli=ctx.cli, emp=ctx.emp, empresaUp=ctx.empresaUp, logoSrc=ctx.logoSrc, hoy=ctx.hoy, V=ctx.V;
  var mModelo=ctx.mModelo, mColor=ctx.mColor, mAnio=ctx.mAnio, mPlaca=ctx.mPlaca, mSerialChasis=ctx.mSerialChasis, mConcesionario=ctx.mConcesionario;
  var purple=ctx.purple, purpleDark=ctx.purpleDark, purpleLight=ctx.purpleLight;
  var clausH=ctx.clausH, p=ctx.p, li=ctx.li, lblCell=ctx.lblCell, valCell=ctx.valCell;

  $('cz').innerHTML = `<div class="cdoc" style="font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#222;max-width:820px;margin:0 auto;padding:20px 28px">

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>${logoSrc?`<img src="${logoSrc}" style="height:46px;object-fit:contain">`:`<div style="font-size:22px;font-weight:900;color:${purple}">${empresaUp}</div>`}</div>
      <div style="font-size:11px;color:#555"><strong>Ref. Contrato:</strong> <span style="border-bottom:1px solid #888;padding:0 24px 2px">${c.id||'________'}</span></div>
    </div>

    <!-- Título principal -->
    <div style="background:${purple};color:#fff;text-align:center;padding:12px 16px;border-radius:4px;margin-bottom:4px;border-bottom:4px solid #1D4ED8">
      <div style="font-size:15.5px;font-weight:900;letter-spacing:.3px">CARTA DE INSTRUCCIONES Y AUTORIZACIONES</div>
    </div>

    <!-- Ciudad y Fecha -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:14px 0 4px;font-size:11.5px">
      <div><strong style="color:${purple}">Ciudad / Estado:</strong> ${emp.ciudad||'Caracas'}</div>
      <div><strong style="color:${purple}">Fecha:</strong> ${hoy}</div>
    </div>
    <div style="border-bottom:1px solid #ccc;margin-bottom:6px"></div>

    <!-- Destinatario y remitente -->
    <p style="${p}margin-top:14px"><strong>Señores:</strong><br><strong>${empresaUp}</strong><br>RIF: ${V(emp.rif)}<br>${V(emp.direccion)}<br>Presente.—</p>

    <p style="${p}"><strong>Referencia:</strong> Contrato de Arrendamiento con Opción a Compra N° <strong>${c.id}</strong>.</p>

    <p style="${p}">Quien suscribe, <strong>${V(cli.nombre||c.cli)}</strong>, venezolano(a), mayor de edad, titular de la cédula de identidad N° <strong>${V(cli.cedula)}</strong>, domiciliado(a) en <strong>${V(cli.dir||cli.ciudad)}</strong>, actuando en mi propio nombre y en mi carácter de <strong>ARRENDATARIO</strong> del contrato arriba referenciado, mediante la presente carta manifiesto mi conformidad y autorizo expresamente a <strong>${empresaUp}</strong> para lo siguiente:</p>

    <!-- Bloque de autorizaciones -->
    <h3 style="${clausH}">PRIMERA: AUTORIZACIÓN DE MONITOREO GPS</h3>
    <p style="${p}">Autorizo de manera expresa e irrevocable el monitoreo continuo de la ubicación del vehículo arrendado durante toda la vigencia del contrato, mediante el dispositivo GPS instalado en la motocicleta. Reconozco que esta autorización es condición esencial del arrendamiento y que cualquier intento de desactivación, bloqueo o manipulación del GPS facultará al arrendador para recuperar la unidad de forma inmediata.</p>

    <h3 style="${clausH}">SEGUNDA: AUTORIZACIÓN DE RECUPERACIÓN EXTRAJUDICIAL</h3>
    <p style="${p}">Autorizo expresamente a ${empresaUp}, o a los representantes que ésta designe, para recuperar la motocicleta objeto del arrendamiento, sin necesidad de notificación previa ni intervención judicial, en cualquiera de los supuestos de resolución contemplados en la Cláusula Novena del contrato, especialmente en caso de falta de pago de cuatro (4) o más cánones quincenales consecutivos, manipulación del GPS, uso ilícito del vehículo o traslado del mismo fuera del territorio nacional sin autorización.</p>

    <h3 style="${clausH}">TERCERA: AUTORIZACIÓN DE CONSULTA Y REPORTE CREDITICIO</h3>
    <p style="${p}">Autorizo a ${empresaUp} a consultar, procesar, conservar y reportar mi información crediticia y comercial ante cualquier central de riesgo, buró de crédito o base de datos financiera pública o privada, en Venezuela o en el exterior, durante la vigencia del contrato y por el tiempo que la legislación permita con posterioridad a su terminación.</p>

    <h3 style="${clausH}">CUARTA: MEDIOS DE CONTACTO Y NOTIFICACIÓN</h3>
    <p style="${p}">Declaro como mis medios válidos de contacto y notificación, a los efectos del contrato y de cualquier gestión de cobranza, los siguientes:</p>
    <table style="width:100%;border-collapse:collapse;margin-top:6px;border:1px solid #DBEAFE">
      <tr><td style="${lblCell}">Teléfono principal:</td><td style="${valCell}">${V(cli.tel)}</td></tr>
      <tr><td style="${lblCell}">WhatsApp:</td><td style="${valCell}">${V(cli.wa||cli.tel)}</td></tr>
      <tr><td style="${lblCell}">Correo electrónico:</td><td style="${valCell}">${V(cli.email)}</td></tr>
      <tr><td style="${lblCell}">Dirección física:</td><td style="${valCell}">${V(cli.dir||cli.ciudad)}</td></tr>
    </table>
    <p style="${p}">Acepto que cualquier notificación remitida por ${empresaUp} a través de estos medios se considerará válidamente efectuada para todos los efectos contractuales y legales. Me comprometo a informar por escrito cualquier cambio en mis datos de contacto dentro de los cinco (5) días siguientes a la modificación.</p>

    <h3 style="${clausH}">QUINTA: INSTRUCCIONES DE PAGO</h3>
    <p style="${p}">Acepto que todos los pagos derivados del contrato se realizarán exclusivamente en <strong>Dólares Americanos (USD)</strong>, mediante los medios de pago que ${empresaUp} tenga habilitados (transferencia, pago móvil, Zelle, efectivo u otros autorizados). Reconozco que los pagos parciales se aplicarán primero a la cuota más antigua pendiente y luego a la mora generada, y que solo se detendrá el cómputo de mora cuando la cuota vencida quede totalmente cubierta.</p>

    <h3 style="${clausH}">SEXTA: DATOS DE LA UNIDAD ARRENDADA</h3>
    <p style="${p}">Declaro haber recibido a mi entera satisfacción, en buen estado de funcionamiento, limpieza y conservación, la unidad que se describe a continuación:</p>
    <table style="width:100%;border-collapse:collapse;margin-top:6px;border:1px solid #DBEAFE">
      <tr><td style="${lblCell}">Modelo:</td><td style="${valCell}">${V(mModelo)}</td><td style="${lblCell}">Color:</td><td style="${valCell}">${V(mColor)}</td></tr>
      <tr><td style="${lblCell}">Año:</td><td style="${valCell}">${V(mAnio)}</td><td style="${lblCell}">Placa:</td><td style="${valCell}">${V(mPlaca)}</td></tr>
      <tr><td style="${lblCell}">Concesionario / Punto de venta:</td><td style="${valCell}" colspan="3">${V(mConcesionario)}</td></tr>
      <tr><td style="${lblCell}">Serial de Chasis:</td><td style="${valCell}" colspan="3">${V(mSerialChasis)}</td></tr>
    </table>

    <h3 style="${clausH}">SÉPTIMA: DECLARACIÓN DE VERACIDAD</h3>
    <p style="${p}">Declaro bajo juramento que toda la información suministrada a ${empresaUp} para la evaluación y suscripción del contrato es veraz, exacta y actualizada, y asumo la responsabilidad civil y penal por cualquier falsedad o información incompleta.</p>

    <!-- Cierre formal -->
    <p style="${p};margin-top:18px">La presente carta se emite en <strong>${emp.ciudad||'Caracas'}</strong>, a los <strong>${hoy}</strong>, a los efectos y consecuencias legales que correspondan.</p>
    <p style="${p}">Atentamente,</p>

    <!-- Firma -->
    <div style="margin-top:28px;border-top:2px solid ${purple};padding-top:18px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div style="background:${purpleLight};padding:14px 10px;border-radius:4px">
          <div style="background:${purple};color:#fff;font-weight:800;font-size:11.5px;padding:5px 8px;border-radius:3px;margin-bottom:10px;text-align:center">EL ARRENDATARIO</div>
          <div style="display:grid;grid-template-columns:1fr 60px;gap:8px;align-items:end">
            <div style="text-align:center;padding-top:46px">
              <div style="border-top:1px solid #333;padding-top:6px;font-size:10px;line-height:1.45">
                Firma<br>
                Nombre: ${cli.nombre||c.cli||''}<br>
                C.I.: ${cli.cedula||''}
              </div>
            </div>
            <div>
              <div style="border:1px dashed #666;background:#fff;height:70px;border-radius:3px"></div>
              <div style="text-align:center;font-size:9px;color:#555;margin-top:3px;font-weight:700">HUELLA</div>
            </div>
          </div>
        </div>
        <div style="background:${purpleLight};padding:14px 10px;border-radius:4px">
          <div style="background:${purple};color:#fff;font-weight:800;font-size:11.5px;padding:5px 8px;border-radius:3px;margin-bottom:10px;text-align:center">RECIBIDO POR ${empresaUp}</div>
          <div style="text-align:center;height:44px"><img src="data:image/png;base64,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" alt="Firma autorizada" style="height:50px;max-width:72%;object-fit:contain;margin-bottom:-12px"></div>
          <div style="border-top:1px solid #333;padding-top:6px;font-size:10.5px;text-align:center">
            <strong>${empresaUp}</strong><br>
            Representante Legal<br>
            ${emp.representante?'Nombre: '+emp.representante:''}<br>
            C.I.: ${emp.repCI||''}<br>
            Fecha de recepción: ____________
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="margin-top:22px;padding-top:10px;border-top:1px solid #ccc;text-align:center;font-size:9.5px;color:#888">
      ${empresaUp} · Carta de Instrucciones · Instrumento complementario al Contrato N° ${c.id} · Venezuela
    </div>
  </div>`;
}


// EGRESOS

// Ver el CONTRATO de un crédito desde el listado: selecciona el crédito, lo
// renderiza en la vista previa (#cz) y lleva la pantalla ahí. (El botón "Ver"
// antes abría el detalle del crédito con openAmort — no el contrato.)
function verContratoById(credId){
  function go(){
    var sel = document.getElementById('sel-cred');
    if(sel){
      var has = Array.prototype.some.call(sel.options||[], function(o){ return String(o.value)===String(credId); });
      if(!has){
        var c = (S.creds||[]).find(function(x){ return String(x.id)===String(credId); });
        var o = document.createElement('option');
        o.value = credId;
        o.textContent = credId + (c ? (' — '+(c.cli||'')+' · '+(c.modelo||'')) : '');
        sel.appendChild(o);
      }
      sel.value = credId;
    }
    var td = document.getElementById('sel-tipo-doc');
    if(td) td.value = 'contrato';
    if(typeof renderContrato==='function') renderContrato();
    var cz = document.getElementById('cz');
    var html = cz ? cz.innerHTML : '<div style="padding:40px;text-align:center;color:#888">No se pudo generar el contrato</div>';
    _mostrarContratoOverlay(credId, html);
  }
  if(!document.getElementById('cz')){ if(typeof nav==='function') nav('contratos'); setTimeout(go, 160); }
  else { go(); }
}

// Overlay a pantalla completa que muestra el contrato ya renderizado.
function _mostrarContratoOverlay(credId, html){
  var ov = document.getElementById('contrato-overlay');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'contrato-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(15,23,42,.6);display:none;overflow-y:auto;padding:20px 16px';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(e){ if(e.target===ov) cerrarContratoOverlay(); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape') cerrarContratoOverlay(); });
  }
  ov.innerHTML =
    '<div style="max-width:920px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.35)">'
    + '<div style="position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;background:#0B1F3A;color:#fff">'
    +   '<div style="font-weight:800;font-size:14px">Contrato · ' + String(credId).replace(/[<>]/g,'') + '</div>'
    +   '<div style="display:flex;gap:8px">'
    +     '<button onclick="descargarContratoPDFById(\'' + credId + '\')" style="background:#2563EB;color:#fff;border:0;border-radius:8px;padding:8px 14px;font-weight:700;font-size:12px;cursor:pointer">↓ Descargar PDF</button>'
    +     '<button onclick="cerrarContratoOverlay()" style="background:rgba(255,255,255,.16);color:#fff;border:0;border-radius:8px;padding:8px 13px;font-weight:700;font-size:12px;cursor:pointer">✕ Cerrar</button>'
    +   '</div>'
    + '</div>'
    + '<div style="padding:14px 8px;background:#eef2f7">' + html + '</div>'
    + '</div>';
  ov.style.display = 'block';
  document.body.style.overflow = 'hidden';
}
function cerrarContratoOverlay(){
  var ov = document.getElementById('contrato-overlay');
  if(ov) ov.style.display = 'none';
  document.body.style.overflow = '';
}
