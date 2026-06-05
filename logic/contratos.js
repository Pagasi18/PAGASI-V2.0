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
  var logoSrc=(document.querySelector('.sb-logo img')||{}).src||'';
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
  var purple = '#5E3BEE';
  var purpleDark = '#4C2ED0';
  var purpleLight = '#F2EEFF';
  var rowStyle = 'padding:8px 12px;border-bottom:1px solid #EAE5F7;font-size:11.5px';
  var tableHdr = 'background:'+purple+';color:#fff;font-size:12px;font-weight:800;text-align:center;padding:9px 10px;letter-spacing:.3px;text-transform:uppercase';
  var clausH = 'color:'+purple+';font-weight:900;font-size:12.5px;text-transform:uppercase;letter-spacing:.3px;margin:18px 0 8px;padding-bottom:4px;border-bottom:2px solid '+purple;
  var p = 'font-size:11.5px;line-height:1.55;color:#222;margin:6px 0;text-align:justify';
  var li = 'font-size:11.5px;line-height:1.55;color:#222;margin:3px 0;text-align:justify';
  var lblCell = 'background:'+purpleLight+';color:'+purpleDark+';font-weight:700;font-size:11.5px;padding:7px 10px;width:22%';
  var valCell = 'padding:7px 10px;font-size:11.5px;border-bottom:1px solid #EAE5F7;width:28%';
  return { c:c, cli:cli, moto:moto, emp:emp, empresaUp:empresaUp, logoSrc:logoSrc, hoy:hoy, fechaContrato:fechaContrato, V:V, Vm:Vm,
           mModelo:mModelo, mVin:mVin, mColor:mColor, mAnio:mAnio, mPlaca:mPlaca, mMarca:mMarca,
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
  var c=ctx.c, cli=ctx.cli, emp=ctx.emp, empresaUp=ctx.empresaUp, logoSrc=ctx.logoSrc, hoy=ctx.hoy, fechaContrato=ctx.fechaContrato, V=ctx.V, Vm=ctx.Vm;
  var mModelo=ctx.mModelo, mColor=ctx.mColor, mAnio=ctx.mAnio, mPlaca=ctx.mPlaca, mMarca=ctx.mMarca, mSerialMotor=ctx.mSerialMotor, mSerialChasis=ctx.mSerialChasis;
  var purple=ctx.purple, purpleDark=ctx.purpleDark, purpleLight=ctx.purpleLight;
  var clausH=ctx.clausH, p=ctx.p, li=ctx.li, lblCell=ctx.lblCell, valCell=ctx.valCell;

  // Datos financieros
  var nCuotas = c.totalCuotas || (c.plazo ? c.plazo*2 : 24);
  var cuotaMonto = parseFloat(c.cuotaQ||c.cuota||0);
  var iniMonto = parseFloat(c.ini||0);
  var saldoCuotas = parseFloat(c.total||c.fin||0);
  var fechaInicio = c.fecha ? new Date(c.fecha+'T12:00:00') : new Date();
  var fechaPrimeraCuota = new Date(fechaInicio.getTime() + 15*24*60*60*1000);
  var fechaUltimaCuota = new Date(fechaInicio.getTime() + nCuotas*15*24*60*60*1000);
  var fmtFecha = function(d){ return d.toLocaleDateString('es-VE',{day:'2-digit',month:'long',year:'numeric'}); };
  var meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  // Datos del cliente
  var cliNom = V(cli.nombre||c.cli);
  var cliCi = V(cli.cedula);
  var cliRif = V(cli.rif);
  var cliNac = V(cli.nacionalidad||'Venezolano/a');
  var cliTel = V(cli.tel);
  var cliEmail = V(cli.email);
  var cliDir = V(cli.dir||cli.ciudad||'');
  var cliEmpresa = V(cli.empresa);
  var cliCargo = V(cli.cargo);
  var cliIngreso = V(cli.ingreso ? '$ '+parseFloat(cli.ingreso).toFixed(2) : '');
  var cliTelTrab = V(cli.tel_trabajo);
  var cliDirTrab = V(cli.dir_trabajo);

  // Referencias
  var r1 = cli.ref1||{};
  var r2 = cli.ref2||{};

  // Fiador
  var tieneFiador = cli.fiador==='si' || cli.fiador===true;
  var fiadNom = V(cli.fiador_nom);
  var fiadCi = V(cli.fiador_ci);
  var fiadRif = V(cli.fiador_rif);
  var fiadDir = V(cli.fiador_dir);
  var fiadTel = V(cli.fiador_tel);
  var fiadEmail = V(cli.fiador_email);

  // Línea en blanco helper
  var blank = function(val, len){ len=len||30; var v=val||''; return v ? '<strong>'+v+'</strong>' : '<span style="display:inline-block;border-bottom:1px solid #888;min-width:'+(len*6)+'px;vertical-align:bottom">&nbsp;</span>'; };

  $('cz').innerHTML = `<div class="cdoc" style="font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#222;max-width:820px;margin:0 auto;padding:20px 28px">

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>${logoSrc?`<img src="${logoSrc}" style="height:46px;object-fit:contain">`:`<div style="font-size:22px;font-weight:900;color:${purple}">${empresaUp}</div>`}</div>
      <div style="font-size:11px;color:#555;text-align:right"><strong>N° de Contrato:</strong> ${c.id||'________'}<br><span style="color:#888">${fechaContrato}</span></div>
    </div>

    <!-- Título -->
    <div style="background:${purple};color:#fff;text-align:center;padding:12px 16px;border-radius:4px;margin-bottom:4px;border-bottom:4px solid #E8C842">
      <div style="font-size:15.5px;font-weight:900;letter-spacing:.3px">CONTRATO DE VENTA DE MOTOCICLETA EN CUOTAS</div>
      <div style="font-size:11px;opacity:.85;margin-top:3px;font-weight:600">CON RESERVA DE DOMINIO</div>
    </div>

    <!-- Intro partes -->
    <p style="${p};margin-top:14px">Entre <strong>${empresaUp}</strong>, sociedad mercantil domiciliada en la República Bolivariana de Venezuela, identificada con RIF <strong>${V(emp.rif)||'J-50829589-7'}</strong>, quien en lo sucesivo se denominará <strong>LA VENDEDORA</strong>; y por la otra parte, el ciudadano/la ciudadana <strong>${cliNom||blank(null,30)}</strong>, de nacionalidad ${blank(cliNac,16)}, mayor de edad, titular de la cédula de identidad N° ${blank(cliCi,14)}, RIF N° ${blank(cliRif,14)}, domiciliado(a) en ${blank(cliDir,35)}, teléfono N° ${blank(cliTel,14)}, correo electrónico ${blank(cliEmail,24)}, quien en lo sucesivo se denominará <strong>EL COMPRADOR</strong>; se ha convenido celebrar el presente Contrato de Venta de Motocicleta en Cuotas con Reserva de Dominio, sujeto a las siguientes cláusulas:</p>

    <!-- PRIMERA -->
    <h3 style="${clausH}">PRIMERA: OBJETO</h3>
    <p style="${p}">LA VENDEDORA da en venta a EL COMPRADOR, quien acepta comprar, una motocicleta identificada de la siguiente manera:</p>
    <table style="width:100%;border-collapse:collapse;margin:8px 0;border:1px solid #EAE5F7">
      <tr><td style="${lblCell}">Marca:</td><td style="${valCell}">${blank(mMarca)}</td><td style="${lblCell}">Modelo:</td><td style="${valCell}">${blank(mModelo)}</td></tr>
      <tr><td style="${lblCell}">Año:</td><td style="${valCell}">${blank(mAnio)}</td><td style="${lblCell}">Color:</td><td style="${valCell}">${blank(mColor)}</td></tr>
      <tr><td style="${lblCell}">Serial de carrocería / VIN:</td><td style="${valCell}">${blank(mSerialChasis)}</td><td style="${lblCell}">Serial de motor:</td><td style="${valCell}">${blank(mSerialMotor)}</td></tr>
      <tr><td style="${lblCell}">Placa (si aplica):</td><td style="${valCell}">${blank(mPlaca)}</td><td style="${lblCell}">Condición:</td><td style="${valCell}">Nueva</td></tr>
    </table>

    <!-- SEGUNDA -->
    <h3 style="${clausH}">SEGUNDA: PRECIO Y CONDICIONES DE PAGO</h3>
    <p style="${p}">El precio y las condiciones de pago de la motocicleta serán los siguientes:</p>
    <table style="width:100%;border-collapse:collapse;margin:8px 0;border:1px solid #EAE5F7">
      <tr><td style="${lblCell}">Inicial (USD $):</td><td style="${valCell};font-weight:700">${blank(iniMonto?'$ '+iniMonto.toFixed(2):null)}</td><td style="${lblCell}">Cuotas quincenales (USD $):</td><td style="${valCell};font-weight:700">${blank(cuotaMonto?'$ '+cuotaMonto.toFixed(2):null)}</td></tr>
      <tr><td style="${lblCell}">Número de cuotas:</td><td style="${valCell};font-weight:700">${blank(nCuotas?String(nCuotas):null)}</td><td style="${lblCell}">Precio total motocicleta:</td><td style="${valCell};font-weight:700">${blank(c.precio?'$ '+parseFloat(c.precio).toFixed(2):null)}</td></tr>
    </table>
    <p style="${p}">Todas las obligaciones de pago se expresan y serán cumplidas en <strong>Dólares de los Estados Unidos de América (USD)</strong>, salvo acuerdo expreso por escrito.</p>

    <!-- TERCERA -->
    <h3 style="${clausH}">TERCERA: SALDO A PAGAR</h3>
    <p style="${p}">Luego del pago inicial indicado en la cláusula anterior, EL COMPRADOR se obliga a pagar el saldo pendiente mediante las cuotas quincenales pactadas.</p>
    <p style="${p}"><strong>Saldo total a pagar en cuotas: USD $ ${blank(saldoCuotas?saldoCuotas.toFixed(2):null,16)}</strong></p>

    <!-- CUARTA -->
    <h3 style="${clausH}">CUARTA: FORMA DE PAGO EN CUOTAS</h3>
    <table style="width:100%;border-collapse:collapse;margin:8px 0;border:1px solid #EAE5F7">
      <tr><td style="${lblCell}">Número total de cuotas:</td><td style="${valCell}">${blank(nCuotas?String(nCuotas):null)}</td><td style="${lblCell}">Monto de cada cuota quincenal:</td><td style="${valCell};font-weight:700">${blank(cuotaMonto?'$ '+cuotaMonto.toFixed(2):null)}</td></tr>
      <tr><td style="${lblCell}">Fecha primera cuota:</td><td style="${valCell}">${blank(fmtFecha(fechaPrimeraCuota))}</td><td style="${lblCell}">Fecha última cuota (est.):</td><td style="${valCell}">${blank(fmtFecha(fechaUltimaCuota))}</td></tr>
      <tr><td style="${lblCell}">Día(s) de pago:</td><td style="${valCell}" colspan="3">Cada quince (15) días a partir de la fecha de suscripción</td></tr>
    </table>
    <p style="${p}">El incumplimiento en el pago oportuno de cualquiera de las cuotas dará derecho a LA VENDEDORA a ejercer las acciones previstas en el presente contrato y en la legislación aplicable.</p>

    <!-- CRONOGRAMA -->
    <h3 style="${clausH}">CRONOGRAMA DE PAGOS QUINCENALES</h3>
    ${(function(){
      var cols=4; var cuotaMonto2=cuotaMonto;
      var cellWrap='display:flex;align-items:center;gap:7px;padding:7px 9px;background:var(--surf);border:1px solid var(--rim);border-radius:5px';
      var numBadge='display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;background:'+purple+';color:#fff;font-size:10px;font-weight:800;border-radius:50%;flex-shrink:0';
      var fechaStyle='font-size:10.5px;color:#444;font-weight:600;flex:1;line-height:1.2';
      var montoStyle='font-size:10.5px;font-weight:800;color:'+purpleDark+';white-space:nowrap';
      var html='<div style="background:'+purpleLight+';border:1px solid #DDD2F5;border-radius:6px;padding:10px">';
      html+='<div style="display:grid;grid-template-columns:repeat('+cols+',1fr);gap:6px">';
      for(var i=0;i<nCuotas;i++){
        var fd=new Date(fechaInicio.getTime()+((i+1)*15*24*60*60*1000));
        var d=fd.getDate(), m=meses[fd.getMonth()], y=String(fd.getFullYear()).slice(-2);
        html+='<div style="'+cellWrap+'">';
        html+='<span style="'+numBadge+'">'+(i+1)+'</span>';
        html+='<span style="'+fechaStyle+'">'+d+' '+m+' '+y+'</span>';
        html+='<span style="'+montoStyle+'">$'+cuotaMonto2.toFixed(2)+'</span>';
        html+='</div>';
      }
      html+='</div></div>';
      html+='<p style="font-size:10.5px;color:#666;margin:8px 0 0;font-style:italic;text-align:center">Fechas estimadas a partir del inicio del contrato ('+fmtFecha(fechaInicio)+'). Las cuotas vencen cada quince (15) días.</p>';
      return html;
    })()}

    <!-- QUINTA -->
    <h3 style="${clausH}">QUINTA: RESERVA DE DOMINIO</h3>
    <p style="${p}">LA VENDEDORA se reserva el dominio y propiedad de la motocicleta descrita en la Cláusula Primera hasta tanto EL COMPRADOR haya pagado la totalidad del precio, incluyendo cuotas, cargos, penalidades, gastos o cualquier otra obligación pendiente derivada de este contrato. EL COMPRADOR reconoce que adquirirá la propiedad plena de la motocicleta únicamente una vez pagada la última cuota y cumplidas todas sus obligaciones contractuales.</p>

    <!-- SEXTA -->
    <h3 style="${clausH}">SEXTA: ENTREGA Y RIESGO</h3>
    <p style="${p}">LA VENDEDORA entrega la motocicleta a EL COMPRADOR en fecha ${blank(fechaContrato,20)}. Desde el momento de la entrega material, EL COMPRADOR asume la guarda, custodia, uso, mantenimiento, riesgo de pérdida, robo, hurto, daño, accidente, multas, infracciones, sanciones y cualquier otra responsabilidad relacionada con la motocicleta.</p>

    <!-- SÉPTIMA -->
    <h3 style="${clausH}">SÉPTIMA: USO, CONSERVACIÓN Y PROHIBICIONES</h3>
    <p style="${p}">Mientras exista saldo pendiente de pago, EL COMPRADOR se obliga a:</p>
    <ul style="margin:6px 0 6px 18px;padding:0">
      <li style="${li}">Usar la motocicleta de forma diligente y conforme a la ley.</li>
      <li style="${li}">Mantenerla en buen estado de funcionamiento y conservación.</li>
      <li style="${li}">No vender, ceder, donar, traspasar, gravar, arrendar ni entregar la motocicleta a terceros sin autorización previa y por escrito de LA VENDEDORA.</li>
      <li style="${li}">No utilizarla para actividades ilícitas.</li>
      <li style="${li}">Informar inmediatamente a LA VENDEDORA en caso de accidente, robo, hurto, retención, decomiso, daño grave o cualquier situación que afecte la motocicleta.</li>
      <li style="${li}">Permitir inspecciones razonables de la motocicleta cuando LA VENDEDORA lo solicite.</li>
    </ul>

    <!-- OCTAVA -->
    <h3 style="${clausH}">OCTAVA: MORA</h3>
    <p style="${p}">EL COMPRADOR incurrirá en mora de pleno derecho, sin necesidad de notificación judicial o extrajudicial, por el solo vencimiento de cualquiera de las cuotas sin que haya sido pagada oportunamente. En caso de mora, EL COMPRADOR deberá pagar un cargo por mora equivalente al <strong>dos coma cinco por ciento mensual (2,5% mensual)</strong> calculado sobre el monto vencido y no pagado. La aceptación de pagos tardíos no implicará renuncia a los derechos de LA VENDEDORA ni modificación de las fechas de pago originalmente pactadas.</p>

    <!-- NOVENA -->
    <h3 style="${clausH}">NOVENA: INCUMPLIMIENTO</h3>
    <p style="${p}">Se considerará incumplimiento grave: falta de pago de una o más cuotas; suministro de información falsa; venta, cesión u ocultamiento no autorizado de la motocicleta; uso para actividades ilícitas; daño grave o abandono. En caso de incumplimiento, LA VENDEDORA podrá exigir el pago inmediato del saldo pendiente, resolver el contrato, solicitar la restitución de la motocicleta y reclamar daños, perjuicios, gastos de cobranza y honorarios profesionales.</p>

    <!-- DÉCIMA -->
    <h3 style="${clausH}">DÉCIMA: RESTITUCIÓN DE LA MOTOCICLETA</h3>
    <p style="${p}">En caso de resolución del contrato por incumplimiento, EL COMPRADOR se obliga a restituir inmediatamente la motocicleta a LA VENDEDORA en el lugar que esta indique. La restitución no limitará el derecho de LA VENDEDORA a reclamar cuotas vencidas, cargos por mora, daños, gastos, honorarios legales o cualquier otra cantidad adeudada.</p>

    <!-- DÉCIMA PRIMERA -->
    <h3 style="${clausH}">DÉCIMA PRIMERA: GASTOS, MULTAS E IMPUESTOS</h3>
    <p style="${p}">Serán por cuenta exclusiva de EL COMPRADOR, desde la fecha de entrega: gastos de mantenimiento y reparación; combustible, lubricantes y repuestos; multas, infracciones y sanciones administrativas; impuestos, tasas o aranceles relacionados con el uso o circulación de la motocicleta; y gastos de cobranza, recuperación o traslado en caso de incumplimiento.</p>

    <!-- DÉCIMA SEGUNDA -->
    <h3 style="${clausH}">DÉCIMA SEGUNDA: DECLARACIONES DE EL COMPRADOR</h3>
    <p style="${p}">EL COMPRADOR declara que: ha inspeccionado la motocicleta y la recibe a su entera satisfacción; conoce y acepta su estado físico, mecánico y legal; tiene capacidad económica suficiente para cumplir con las cuotas pactadas; la información suministrada a LA VENDEDORA es verdadera, completa y verificable; y autoriza a LA VENDEDORA a verificar sus datos personales, laborales, comerciales, referencias y capacidad de pago.</p>

    <!-- DÉCIMA TERCERA -->
    <h3 style="${clausH}">DÉCIMA TERCERA: DATOS Y REFERENCIAS DE EL COMPRADOR</h3>
    <table style="width:100%;border-collapse:collapse;margin:8px 0;border:1px solid #EAE5F7">
      <tr><td style="${lblCell}">Dirección de habitación:</td><td style="${valCell}" colspan="3">${blank(cliDir,40)}</td></tr>
      <tr><td style="${lblCell}">Dirección de trabajo:</td><td style="${valCell}" colspan="3">${blank(cliDirTrab,40)}</td></tr>
      <tr><td style="${lblCell}">Empresa donde trabaja:</td><td style="${valCell}">${blank(cliEmpresa)}</td><td style="${lblCell}">Cargo:</td><td style="${valCell}">${blank(cliCargo)}</td></tr>
      <tr><td style="${lblCell}">Ingreso mensual aprox.:</td><td style="${valCell}">${blank(cliIngreso)}</td><td style="${lblCell}">Teléfono laboral:</td><td style="${valCell}">${blank(cliTelTrab)}</td></tr>
      <tr><td style="${lblCell}">Teléfono personal:</td><td style="${valCell}">${blank(cliTel)}</td><td style="${lblCell}">Correo electrónico:</td><td style="${valCell}">${blank(cliEmail)}</td></tr>
    </table>
    <p style="${p};font-weight:700;margin-top:10px">Referencia personal 1:</p>
    <table style="width:100%;border-collapse:collapse;margin:4px 0 10px;border:1px solid #EAE5F7">
      <tr><td style="${lblCell}">Nombre:</td><td style="${valCell}">${blank(V(r1.nom))}</td><td style="${lblCell}">Cédula:</td><td style="${valCell}">${blank(V(r1.ci))}</td></tr>
      <tr><td style="${lblCell}">Teléfono:</td><td style="${valCell}">${blank(V(r1.tel))}</td><td style="${lblCell}">Relación:</td><td style="${valCell}">${blank(V(r1.rel))}</td></tr>
    </table>
    <p style="${p};font-weight:700">Referencia personal 2:</p>
    <table style="width:100%;border-collapse:collapse;margin:4px 0;border:1px solid #EAE5F7">
      <tr><td style="${lblCell}">Nombre:</td><td style="${valCell}">${blank(V(r2.nom))}</td><td style="${lblCell}">Cédula:</td><td style="${valCell}">${blank(V(r2.ci))}</td></tr>
      <tr><td style="${lblCell}">Teléfono:</td><td style="${valCell}">${blank(V(r2.tel))}</td><td style="${lblCell}">Relación:</td><td style="${valCell}">${blank(V(r2.rel))}</td></tr>
    </table>

    <!-- DÉCIMA CUARTA -->
    <h3 style="${clausH}">DÉCIMA CUARTA: FIADOR O GARANTE${tieneFiador?'':' (SI APLICA)'}</h3>
    ${tieneFiador ? `
    <p style="${p}">En caso de requerirse fiador, comparece el ciudadano/la ciudadana:</p>
    <table style="width:100%;border-collapse:collapse;margin:8px 0;border:1px solid #EAE5F7">
      <tr><td style="${lblCell}">Nombre:</td><td style="${valCell}">${blank(fiadNom)}</td><td style="${lblCell}">Cédula:</td><td style="${valCell}">${blank(fiadCi)}</td></tr>
      <tr><td style="${lblCell}">RIF:</td><td style="${valCell}">${blank(fiadRif)}</td><td style="${lblCell}">Teléfono:</td><td style="${valCell}">${blank(fiadTel)}</td></tr>
      <tr><td style="${lblCell}">Dirección:</td><td style="${valCell}" colspan="3">${blank(fiadDir,40)}</td></tr>
      <tr><td style="${lblCell}">Correo:</td><td style="${valCell}" colspan="3">${blank(fiadEmail,30)}</td></tr>
    </table>
    <p style="${p}">El fiador se constituye en responsable solidario de todas las obligaciones asumidas por EL COMPRADOR bajo el presente contrato.</p>
    <p style="${p}">Firma del fiador: <span style="display:inline-block;border-bottom:1px solid #888;min-width:200px;vertical-align:bottom">&nbsp;</span></p>
    ` : `
    <p style="${p}">Nombre: <span style="display:inline-block;border-bottom:1px solid #888;min-width:200px;vertical-align:bottom">&nbsp;</span> &nbsp;&nbsp; Cédula: <span style="display:inline-block;border-bottom:1px solid #888;min-width:140px;vertical-align:bottom">&nbsp;</span></p>
    <p style="${p}">RIF: <span style="display:inline-block;border-bottom:1px solid #888;min-width:160px;vertical-align:bottom">&nbsp;</span> &nbsp;&nbsp; Dirección: <span style="display:inline-block;border-bottom:1px solid #888;min-width:200px;vertical-align:bottom">&nbsp;</span></p>
    <p style="${p}">Teléfono: <span style="display:inline-block;border-bottom:1px solid #888;min-width:140px;vertical-align:bottom">&nbsp;</span> &nbsp;&nbsp; Correo: <span style="display:inline-block;border-bottom:1px solid #888;min-width:180px;vertical-align:bottom">&nbsp;</span></p>
    <p style="${p}">Firma del fiador: <span style="display:inline-block;border-bottom:1px solid #888;min-width:200px;vertical-align:bottom">&nbsp;</span></p>
    `}

    <!-- DÉCIMA QUINTA -->
    <h3 style="${clausH}">DÉCIMA QUINTA: NOTIFICACIONES</h3>
    <table style="width:100%;border-collapse:collapse;margin:8px 0;border:1px solid #EAE5F7">
      <tr><td style="${lblCell}">Correo de EL COMPRADOR:</td><td style="${valCell}">${blank(cliEmail,25)}</td><td style="${lblCell}">Tel / WhatsApp EL COMPRADOR:</td><td style="${valCell}">${blank(cliTel,14)}</td></tr>
      <tr><td style="${lblCell}">Correo de LA VENDEDORA:</td><td style="${valCell}">${blank(V(emp.email),25)}</td><td style="${lblCell}">Tel / WhatsApp LA VENDEDORA:</td><td style="${valCell}">${blank(V(emp.tel),14)}</td></tr>
    </table>

    <!-- DÉCIMA SEXTA -->
    <h3 style="${clausH}">DÉCIMA SEXTA: JURISDICCIÓN</h3>
    <p style="${p}">Para todos los efectos derivados del presente contrato, las partes eligen como domicilio especial, excluyente de cualquier otro, la ciudad de <strong>${emp.ciudad||'Caracas'}</strong>, República Bolivariana de Venezuela, a cuyos tribunales competentes declaran someterse.</p>

    <!-- DÉCIMA SÉPTIMA -->
    <h3 style="${clausH}">DÉCIMA SÉPTIMA: ACEPTACIÓN</h3>
    <p style="${p}">Leído el presente contrato por las partes, y estando conformes con su contenido, lo firman en dos ejemplares de un mismo tenor y a un solo efecto, en la ciudad de <strong>${emp.ciudad||'Caracas'}</strong>, a los _____ días del mes de __________________ de ______.</p>

    <!-- FIRMAS -->
    <table style="width:100%;border-collapse:collapse;margin-top:32px;border:1px solid #EAE5F7">
      <tr>
        <th style="background:${purple};color:#fff;padding:10px;text-align:center;width:50%;font-size:12px">LA VENDEDORA<br>${empresaUp}<br>RIF ${V(emp.rif)||'J-50829589-7'}</th>
        <th style="background:${purple};color:#fff;padding:10px;text-align:center;width:50%;font-size:12px">EL COMPRADOR</th>
      </tr>
      <tr>
        <td style="padding:40px 20px 16px;vertical-align:bottom;border-right:1px solid #EAE5F7">
          <div style="border-top:1px solid #444;padding-top:6px;font-size:11px;color:#555;text-align:center">Firma autorizada</div>
        </td>
        <td style="padding:16px 20px;vertical-align:bottom">
          <div style="font-size:11px;margin-bottom:4px">Nombre: <strong>${cliNom}</strong></div>
          <div style="font-size:11px;margin-bottom:4px">C.I.: <strong>${cliCi}</strong></div>
          <div style="font-size:11px;margin-bottom:20px">RIF: <strong>${cliRif}</strong></div>
          <div style="border-top:1px solid #444;padding-top:6px;font-size:11px;color:#555;text-align:center">Firma del comprador</div>
        </td>
      </tr>
      ${tieneFiador ? `<tr>
        <td colspan="2" style="padding:16px 20px;border-top:1px solid #EAE5F7">
          <div style="font-weight:700;font-size:11px;margin-bottom:8px;color:${purple}">FIADOR / GARANTE</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;margin-bottom:20px">
            <div>Nombre: <strong>${fiadNom}</strong></div>
            <div>C.I.: <strong>${fiadCi}</strong></div>
            <div>RIF: <strong>${fiadRif}</strong></div>
            <div></div>
          </div>
          <div style="border-top:1px solid #444;padding-top:6px;font-size:11px;color:#555;text-align:center;max-width:250px">Firma del fiador</div>
        </td>
      </tr>` : ''}
    </table>

    <div style="text-align:center;font-size:10px;color:#999;margin-top:18px;padding-top:10px;border-top:1px solid #eee">
      ${empresaUp} · Contrato de Venta de Motocicleta en Cuotas · ${emp.ciudad||'Venezuela'}
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
    <div style="background:${purple};color:#fff;text-align:center;padding:12px 16px;border-radius:4px;margin-bottom:4px;border-bottom:4px solid #E8C842">
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
    <table style="width:100%;border-collapse:collapse;margin-top:6px;border:1px solid #EAE5F7">
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
    <table style="width:100%;border-collapse:collapse;margin-top:6px;border:1px solid #EAE5F7">
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
        <div style="background:#F6EEFC;padding:14px 10px;border-radius:4px">
          <div style="background:#8B5BC9;color:#fff;font-weight:800;font-size:11.5px;padding:5px 8px;border-radius:3px;margin-bottom:10px;text-align:center">EL AVALISTA / FIADOR</div>
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
  var mModelo=ctx.mModelo, mColor=ctx.mColor, mAnio=ctx.mAnio, mPlaca=ctx.mPlaca, mSerialChasis=ctx.mSerialChasis;
  var purple=ctx.purple, purpleDark=ctx.purpleDark, purpleLight=ctx.purpleLight;
  var clausH=ctx.clausH, p=ctx.p, li=ctx.li, lblCell=ctx.lblCell, valCell=ctx.valCell;

  $('cz').innerHTML = `<div class="cdoc" style="font-family:'Segoe UI',Roboto,Arial,sans-serif;color:#222;max-width:820px;margin:0 auto;padding:20px 28px">

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>${logoSrc?`<img src="${logoSrc}" style="height:46px;object-fit:contain">`:`<div style="font-size:22px;font-weight:900;color:${purple}">${empresaUp}</div>`}</div>
      <div style="font-size:11px;color:#555"><strong>Ref. Contrato:</strong> <span style="border-bottom:1px solid #888;padding:0 24px 2px">${c.id||'________'}</span></div>
    </div>

    <!-- Título principal -->
    <div style="background:${purple};color:#fff;text-align:center;padding:12px 16px;border-radius:4px;margin-bottom:4px;border-bottom:4px solid #E8C842">
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
    <table style="width:100%;border-collapse:collapse;margin-top:6px;border:1px solid #EAE5F7">
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
    <table style="width:100%;border-collapse:collapse;margin-top:6px;border:1px solid #EAE5F7">
      <tr><td style="${lblCell}">Modelo:</td><td style="${valCell}">${V(mModelo)}</td><td style="${lblCell}">Color:</td><td style="${valCell}">${V(mColor)}</td></tr>
      <tr><td style="${lblCell}">Año:</td><td style="${valCell}">${V(mAnio)}</td><td style="${lblCell}">Placa:</td><td style="${valCell}">${V(mPlaca)}</td></tr>
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
          <div style="background:${purple};color:#fff;font-weight:800;font-size:11.5px;padding:5px 8px;border-radius:3px;margin-bottom:56px;text-align:center">RECIBIDO POR ${empresaUp}</div>
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
