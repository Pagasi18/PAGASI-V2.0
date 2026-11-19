// 18-nov-2026: el abogado mandó el contrato v3 revisado («Aceptación Anticipada»): sale Pagasi Protect
// y todo lo del GPS, entra el Gasto Administrativo (cláusula 2 y Anexo B) y la 3.20 de ajuste de cuotas.
// Adam: "¿la podrías ajustar a nuestro sistema pero solo una foto a ver cómo quedaría?". Por eso
// logic/contratos-ga.js existe pero NO está conectado: ningún crédito lo imprime todavía.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (l, v) => { if (v) { pass++; console.log('OK   ' + l); } else { fail++; console.log('FALLA ' + l); } };
function elemento(){ return { innerHTML:'', textContent:'', value:'', className:'', id:'', style:{}, dataset:{}, checked:false, classList:{add(){},remove(){},contains(){return false;},toggle(){}}, children:[], appendChild(){}, removeChild(){}, remove(){}, setAttribute(){}, getAttribute(){ return null; }, addEventListener(){}, removeEventListener(){}, focus(){}, closest(){ return null; }, querySelector(){ return null; }, querySelectorAll(){ return []; }, click(){} }; }
const els = {};
const doc = { getElementById(id){ return els[id] || (els[id] = elemento()); }, querySelector(){ return null; }, querySelectorAll(){ return []; }, createElement(){ return elemento(); }, head:elemento(), body:elemento(), documentElement:elemento(), addEventListener(){}, removeEventListener(){} };
const ctx = { console:{log(){},warn(){},error(){}}, setTimeout(){return 0;}, clearTimeout(){}, setInterval(){return 0;}, clearInterval(){}, requestAnimationFrame(){return 0;},
  document:doc, navigator:{userAgent:'node',language:'es'}, location:{href:'https://pagasi.io/admin.html',search:'',hash:'',pathname:'/admin.html'},
  localStorage:{getItem(){return null;},setItem(){},removeItem(){}}, sessionStorage:{getItem(){return null;},setItem(){},removeItem(){}},
  fetch(){ return Promise.resolve({ok:true,json:()=>Promise.resolve({})}); }, alert(){}, prompt(){ return ''; }, confirm(){ return true; },
  open(){ return { document:{ write(){}, close(){} } }; }, db:null, storage:null, firebase:undefined, innerWidth:1440, innerHeight:900, PG:{} };
ctx.MutationObserver=function(){return {observe(){},disconnect(){}};}; ctx.IntersectionObserver=function(){return {observe(){},disconnect(){},unobserve(){}};};
ctx.ResizeObserver=function(){return {observe(){},disconnect(){}};}; ctx.addEventListener=function(){}; ctx.removeEventListener=function(){};
ctx.matchMedia=function(){return {matches:false,addListener(){},addEventListener(){}};}; ctx.getComputedStyle=function(){return {getPropertyValue(){return '';}};};
ctx.scrollTo=function(){}; ctx.history={state:null,pushState(){},replaceState(){},back(){}}; ctx.window=ctx;
const archivos = [...fs.readFileSync(path.join(ROOT,'admin.html'),'utf8').matchAll(/src="((?:assets|logic|modules)\/[^"?]+\.js)/g)].map(m=>m[1]);
vm.createContext(ctx); vm.runInContext(archivos.map(f=>fs.readFileSync(path.join(ROOT,f),'utf8')).join('\n;\n'), ctx, {filename:'app.js'});
ctx.toast = () => {};
const admin = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
ok('el contrato nuevo todavía no se carga en el sistema (admin.html no lo nombra)', admin.indexOf('contratos-ga.js') < 0);
ok('...ni lo conoce el selector de versiones: un crédito nuevo sigue imprimiendo el v3', ctx._contratoVersionDe({ id:'X', fecha:'2026-12-01', contratoFirmado:false }) === 'protect' && typeof ctx._htmlContratoGA === 'undefined');
vm.runInContext(fs.readFileSync(path.join(ROOT, 'logic/contratos-ga.js'), 'utf8'), ctx, { filename:'contratos-ga.js' });

ctx._empresa = { nombre:'PAGASI 26, C.A.', rif:'J-50856275-5', ciudad:'Caracas', tel:'0414-0000000', email:'contacto@ejemplo.com', direccion:'Av. de Ejemplo', rm:'Séptimo', rmEstado:'Distrito Capital', rmNum:'8', rmTomo:'58-A', rmFecha:'14/07/2026', bancoUsd:'BANCO', cuentaUsd:'0000', cuentaBs:'0001', pagoMovil:'0414', billetera:'Binance', billeteraCuenta:'x@y' };
const S = ctx.S;
S.concesionarios = [{ id:'CO', nombre:'CONCESIONARIO, C.A.', rif:'J-00000000-0' }];
S.motos = [{ id:1, marca:'EMPIRE', modelo:'OWEN 200S', anio:'2026', color:'NEGRO', placa:'AA0A00A', serialChasis:'CH1', serialMotor:'MO1' }];
S.gps = [{ creditoId:'M-1', idGps:'GPS-SERIAL-9', imei:'123456789012345' }];
const cli = extra => Object.assign({ id:'K1', nombre:'CLIENTE DE PRUEBA', cedula:'V-12345678', dir:'CALLE 1', ciudad:'CARACAS', cargo:'MECANICO', ingreso:600, email:'c@e.com', tel:'0412-0000000' }, extra || {});
S.clientes = [cli(), cli({ id:'K2', nombre:'CLIENTE CON FIADOR', fiador_nom:'FIADOR DE PRUEBA', fiador_ci:'V-87654321', fiador_dir:'CALLE 2' })];
const cred = (id, k) => ({ id, clienteId:k, cli:'X', motoId:1, concesionarioId:'CO', fecha:'2026-11-18', creado:'2026-11-18T14:30:00.000Z', precio:1700, ini:700, cuotaQ:97, totalCuotas:20, plazo:10, estado:'activo', uso_moto:'personal' });
S.creds = [cred('M-1', 'K1'), cred('M-2', 'K2')];
const limpio = h => h.replace(/<\/?(strong|span|b)\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

// ════════ 1. La cuenta: la misma del v3, con otro nombre ════════
const D = ctx._gaDatos('M-1'), F = D.F;
ok('el Gasto Administrativo es lo que la cuota tiene por encima del 12 %: monto financiado − saldo del precio', F.MF === 1841.78 && F.saldoPrecio === 1000 && F.protect === 841.78 && /US\$ 841\.78/.test(D.gasto));
ok('...y la cuota y el total no cambian: 20 × 97 = 1.940', F.n === 20 && F.cuota === 97 && F.MTA === 1940 && F.intereses === 98.22);

// ════════ 2. El texto: lo que salió y lo que entró ════════
const h = ctx._htmlContratoGA('M-1'), t = limpio(h);
ok('el título es el del abogado', /CONTRATO DE FINANCIAMIENTO PARA LA ADQUISICIÓN DE VEHÍCULO AUTOMOTOR, CON GARANTÍAS Y GASTO ADMINISTRATIVO/.test(t));
ok('no queda nada de Pagasi Protect', !/Protect|PROTECT|Programa/.test(t));
ok('ni del GPS: dispositivos, apagado remoto, geolocalización', !/GPS|Dispositivo|apagado remoto|geolocalizaci|GPS-SERIAL-9/i.test(t));
ok('la cláusula 2 es el Gasto Administrativo, con su monto', /2\. GASTO ADMINISTRATIVO/.test(t) && /2\.1 Concepto\. El Gasto Administrativo corresponde a los costos administrativos/.test(t) && /2\.2 Monto\. El monto único y total del Gasto Administrativo es la cantidad de US\$ 841\.78/.test(t));
ok('la 3.3 arma el monto financiado con el saldo del vehículo y el gasto', /3\.3 Monto Financiado\. El monto total financiado por Pagasi asciende a US\$ 1,841\.78/.test(t) && /esto es, US\$ 1,000\.00, desembolsado conforme a la Sección 1\.2; y \(b\) el Gasto Administrativo, esto es, US\$ 841\.78/.test(t));
ok('la 3.8 trae las cuotas en número y en letras', /mediante 20 \(VEINTE\) cuotas quincenales consecutivas, cada una por el monto de US\$ 97\.00/i.test(t));
ok('la 3.16 dice que el gasto no se descuenta por pago anticipado', /El Gasto Administrativo no será objeto de descuento por pago anticipado, en la medida en que corresponda a gastos efectivamente causados y legalmente exigibles/.test(t));
ok('entra la 3.20 con sus cuatro literales', /3\.20 Ajuste de Cuotas y Preservación del Equilibrio Económico Contractual/.test(t) && /\(a\) Criterios objetivos\./.test(t) && /\(b\) Proporcionalidad del ajuste\./.test(t) && /\(c\) Notificación, aceptación anticipada y aplicación\./.test(t) && /\(d\) Revisión extraordinaria\./.test(t) && /CPI-U/.test(t));
ok('la 9.4 habla del gasto efectivamente causado', /el Gasto Administrativo efectivamente causado y legalmente exigible, y los daños y perjuicios acreditados/.test(t));
ok('salieron la 11.3 y la 11.7, y el título 11 quedó sin la geolocalización', /11\. TRATAMIENTO DE DATOS 11\.1/.test(t) && !/11\.3 /.test(t) && !/11\.7 /.test(t) && /11\.6 Derechos del Comprador/.test(t));
ok('lo que no cambió sigue igual: 12 % anual, mora 3 % desde el día 6, 5 días de gracia, sin letras de cambio', /doce por ciento \(12%\) anual/.test(t) && /tres por ciento \(3%\) anual/.test(t) && /período de gracia de cinco \(5\) días/.test(t) && /NO se han emitido letras de cambio ni pagarés/.test(t));
ok('se llena con los datos del sistema: empresa, cliente, concesionario y moto', /PAGASI 26, C\.A\./.test(t) && /Registro Mercantil Séptimo/.test(t) && /CLIENTE DE PRUEBA/.test(t) && /V-12345678/.test(t) && /CONCESIONARIO, C\.A\./.test(t) && /OWEN 200S/.test(t) && /AA0A00A/.test(t));

// ════════ 3. Los anexos ════════
ok('Anexo A: el resumen nombra el Gasto Administrativo y el cronograma cierra en cero', /Gasto Administrativo: US\$ 841\.78/.test(t) && /La porción del Gasto Administrativo financiada se encuentra incluida dentro de “cap”/.test(t) && F.filas.length === 20 && F.filas[19].saldo === 0);
ok('Anexo B: detalle del gasto, con el monto, los renglones para el desglose y el total', /ANEXO “B” — DETALLE DEL GASTO ADMINISTRATIVO/.test(t) && /B\.1 Monto US\$ 841\.78, incluido en el Monto Financiado\./.test(t) && /B\.2 Desglose de gastos administrativos efectivamente causados/.test(t) && /Total del Gasto Administrativo US\$ 841\.78/.test(t) && /B\.3 Declaración del Comprador/.test(t));
ctx._empresa.gastoAdmDetalle = [{ concepto:'Gestión <b>y</b> trámite', monto:500 }, { concepto:'Otro concepto', monto:341.78 }];
const conDet = ctx._htmlContratoGA('M-1');
ok('...y si la ficha de la empresa trae el desglose, lo imprime (sin dejar pasar código)', /Gestión &lt;b&gt;y&lt;\/b&gt; trámite/.test(conDet) && /US\$ 500\.00/.test(conDet) && /US\$ 341\.78/.test(conDet));
delete ctx._empresa.gastoAdmDetalle;
ok('Anexo C: la constancia de recepción ya no lleva las filas del GPS', /ANEXO “C” — CONSTANCIA DE RECEPCIÓN DEL VEHÍCULO/.test(t) && /Llaves recibidas/.test(t) && !/apagado remoto instalado/.test(t));
ok('Anexo D: recaudos y conocimiento del cliente, como antes', /ANEXO “D” — RECAUDOS Y DECLARACIÓN DE CONOCIMIENTO DEL CLIENTE/.test(t) && /D\.3 Declaración PEP/.test(t));

// ════════ 4. Con fiador (el documento del abogado no trae la fianza: se conserva la del v3 mientras responde) ════════
const tf = limpio(ctx._htmlContratoGA('M-2'));
ok('con fiador, el título y la cláusula 14 de fianza siguen saliendo', /CON GARANTÍAS, FIANZA Y GASTO ADMINISTRATIVO/.test(tf) && /14\. FIANZA/.test(tf) && /FIADOR DE PRUEBA/.test(tf) && /las Cuotas Quincenales, el Gasto Administrativo, los Intereses Financieros/.test(tf) && !/Protect/.test(tf));
ok('sin fiador, no', !/14\. FIANZA/.test(t) && !/Fiador/.test(t.replace(/Y DEL FIADOR/g, '')));

// ════════ 5. El v3 no se tocó ════════
const v3 = limpio(ctx._htmlContratoProtect('M-1'));
ok('el contrato v3 sigue imprimiendo Pagasi Protect y el GPS, igual que antes', /PAGASI PROTECT/.test(v3) && /2\.7 Protocolo de Apagado Remoto/.test(v3) && /GPS-SERIAL-9/.test(v3) && !/3\.20 /.test(v3));

console.log('\n' + pass + ' pruebas OK, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
