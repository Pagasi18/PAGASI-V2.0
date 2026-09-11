// Finanzas › Cobrado en el período › Cuotas cobradas: el reporte en PDF y en
// Excel lleva la columna "Recibido en" (cómo se cobró cada cuota). Adam,
// 11-sep-2026: "no aparece cómo fue cobrada la cuota".
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
global.window=global; global.PG={};
const _els={};
const _mkEl=()=>({innerHTML:'',textContent:'',value:'',className:'',style:{},click(){},appendChild(){},removeChild(){}});
global.$=id=>{ if(!_els[id]) _els[id]=_mkEl(); return _els[id]; };
global.document={getElementById:id=>global.$(id),querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>_mkEl(),body:{appendChild(){},removeChild(){},style:{}},addEventListener(){}};
global.S={currentUser:{rol:'Administrador',nombre:'Prueba'},dfDesde:'2026-09-01',dfHasta:'2026-09-30',clientes:[],movimientos:[],
  creds:[
    {id:'CRED-1',cli:'ANA',fecha:'2026-08-01',estado:'activo',precio:1500,ini:600,total:1800},
    {id:'CRED-2',cli:'LUIS',fecha:'2026-08-05',estado:'activo',precio:1000,ini:400,total:1200},
  ],
  pagos:[
    {id:'P-1',cred:'CRED-1',cli:'ANA', fecha:'2026-09-03',monto:50,estado:'confirmado',metodo:'Binance Pagos'},
    {id:'P-2',cred:'CRED-2',cli:'LUIS',fecha:'2026-09-04',monto:40,estado:'confirmado',cuenta:'100% Banco Bs'},   // sin metodo: usa la cuenta
    {id:'P-3',cred:'CRED-1',cli:'ANA', fecha:'2026-09-05',monto:30,estado:'confirmado'},                         // sin nada: guion
    {id:'P-4',cred:'CRED-1',cli:'ANA', fecha:'2026-09-06',monto:600,estado:'confirmado',esInicial:true,metodo:'Efectivo'},   // inicial: no va
    {id:'P-5',cred:'CRED-2',cli:'LUIS',fecha:'2026-09-07',monto:40,estado:'pendiente',metodo:'Pago movil'},       // sin confirmar: no va
  ]};
global.PLAN={factor:2,plazo:12};
global._concFiltrar=a=>a;
global.getCreditoSaldoPendiente=()=>0;
global.hoyLocalISO=()=>'2026-09-11';
global.fmt=n=>'$'+Number(n||0).toFixed(2);
global.toast=()=>{};
let pass=0, fail=0;
const ok=(l,v)=>{ if(v){pass++;console.log('OK   '+l);} else {fail++;console.log('FALLA '+l);} };
const auto=new Proxy({},{has:()=>true,get:(t,k)=>{if(k===Symbol.unscopables)return undefined;if(k in t)return t[k];if(k in global)return global[k];return function(){return 0;};},set:(t,k,v)=>{t[k]=v;return true;}});
const L=fs.readFileSync(path.join(ROOT,'logic/reportes.js'),'utf8');
// Capturar lo que se descargaría, sin abrir ventanas ni bajar archivos. El
// reemplazo va DENTRO del mismo bloque: las funciones del archivo se llaman
// entre sí por ese bloque, no por el Proxy, así que asignarlo afuera no sirve.
let excel=null, pdf=null;
global.__capturarExcel=(nombre, hojas)=>{ excel={nombre, filas:hojas[0].rows}; };
global.__capturarPdf=(titulo, html)=>{ pdf={titulo, html}; };
const API=eval('with(auto){'+L+'\n; _xlsxDownload = __capturarExcel; _abrirVentanaImpresion = __capturarPdf; ({dfReporte}) }');
const correr=(formato)=>{ try { API.dfReporte('cuotas', formato); return null; } catch(e){ return e.message; } };

// ── Excel ──
const errExcel=correr('excel');
ok('el Excel se genera sin errores', errExcel===null || console.log('      error: '+errExcel));
ok('se generó el Excel', !!excel && Array.isArray(excel.filas));
const filas=(excel&&excel.filas)||[];
const iTit=filas.findIndex(r=>r && r[0] && String(r[0]).indexOf('Detalle de cuotas cobradas')===0);
const encabezado=filas[iTit+1]||[];
ok('el Excel tiene la columna "Recibido en" después de Cliente', encabezado[3]==='Cliente' && encabezado[4]==='Recibido en' && encabezado[5]==='Monto');
const datos=filas.slice(iTit+2, iTit+5);
const porPago=Object.fromEntries(datos.map(r=>[r[1], r]));
ok('solo las 3 cuotas confirmadas (sin inicial ni pendiente)', datos.length===3 && !porPago['P-4'] && !porPago['P-5'] && filas[iTit+5][0]==='TOTAL');
ok('P-1 cobrada en Binance Pagos', porPago['P-1'] && porPago['P-1'][4]==='Binance Pagos');
ok('P-2 sin método usa la cuenta: 100% Banco Bs', porPago['P-2'] && porPago['P-2'][4]==='100% Banco Bs');
ok('P-3 sin dato: guion', porPago['P-3'] && porPago['P-3'][4]==='—');
ok('los montos siguen siendo números en su columna', porPago['P-1'] && porPago['P-1'][5]===50 && typeof porPago['P-1'][6]==='number');
const total=filas[iTit+5]||[];
ok('la fila TOTAL cuadra con la columna nueva (celda vacía y monto 120)', total[4]==='' && total[5]===120);

// ── PDF ──
const errPdf=correr('pdf');
ok('el PDF se genera sin errores', errPdf===null || console.log('      error: '+errPdf));
const html=(pdf&&pdf.html)||'';
ok('se generó el PDF', html.length>0);
ok('el PDF tiene el título "Recibido en"', html.indexOf('<th>Cliente</th><th>Recibido en</th><th>Monto</th>')>=0);
ok('el PDF muestra la forma de cobro como texto (no como $)', html.indexOf('<td>Binance Pagos</td>')>=0 && html.indexOf('<td>100% Banco Bs</td>')>=0 && html.indexOf('$NaN')<0);
ok('el monto sigue con formato de dinero', html.indexOf('<td>$50.00</td>')>=0);
ok('el TOTAL del PDF cuadra', html.indexOf('<td style="font-weight:900">$120.00</td>')>=0);

console.log(''); console.log(pass+' pruebas OK, '+fail+' fallas');
if(fail) process.exitCode=1;
