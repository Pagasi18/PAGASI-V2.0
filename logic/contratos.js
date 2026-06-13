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
        <td style="padding:16px 20px 16px;vertical-align:bottom;border-right:1px solid #EAE5F7">
          <div style="text-align:center;height:46px"><img src="data:image/png;base64,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" alt="Firma autorizada" style="height:52px;max-width:78%;object-fit:contain;margin-bottom:-12px"></div>
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
