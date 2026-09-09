// Chart de concesionarios: los buckets, el agrupado por sede y el filtrado.
// Lo que importa: que no cuente creditos cancelados ni de sedes borradas, y
// que "monto" sume el precio real y no el numero de motos.
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
global.window=global;
const _el=()=>({innerHTML:'',textContent:'',value:'',style:{},appendChild(){},parentElement:null,getAttribute(){return null;}});
global.document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:_el,
                 documentElement:{getAttribute:()=>null},body:{appendChild(){},style:{}}};
global.nav=()=>{}; global.Chart=undefined;
let pass=0, fail=0;
global.ok=(l,v)=>{ if(v){pass++;console.log('OK   '+l);} else {fail++;console.log('FALLA '+l);} };
global.S={creds:[],concesionarios:[]};
const auto=new Proxy({},{has:()=>true,get:(t,k)=>{if(k===Symbol.unscopables)return undefined;if(k in t)return t[k];if(k in global)return global[k];return function(){return 0;};},set:(t,k,v)=>{t[k]=v;return true;}});
const SRC=fs.readFileSync(path.join(ROOT,'logic/concesionarios-chart.js'),'utf8');
const API=eval('with(auto){'+SRC+'\n; ({_concChartBuckets,_concChartCorte,_concChartDatos,_concChartHtml,_concChartSetPeriodo,_concChartSetModo}) }');

// ── Buckets ──
ok('30 dias', API._concChartBuckets('dia').length===30);
ok('12 meses', API._concChartBuckets('mes').length===12);
ok('5 anos', API._concChartBuckets('ano').length===5);
ok('el ultimo bucket de dias es hoy', (function(){
  const b=API._concChartBuckets('dia'), h=new Date();
  return b[29].clave===h.getFullYear()+'-'+String(h.getMonth()+1).padStart(2,'0')+'-'+String(h.getDate()).padStart(2,'0');
})());
ok('corte: dia=10, mes=7, ano=4', API._concChartCorte('dia')===10 && API._concChartCorte('mes')===7 && API._concChartCorte('ano')===4);

// ── Escenario ──
const hoy=new Date();
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const mesActual=iso(hoy).slice(0,7);
const haceMeses=n=>{ const d=new Date(hoy.getFullYear(),hoy.getMonth()-n,15); return iso(d); };
S.concesionarios=[
  {id:'C1',nombre:'EMPIRE Bello Monte'},
  {id:'C2',nombre:'ARI BENZA'},
  {id:'C3',nombre:'Sede borrada',eliminado:true},
  {id:'C4',nombre:'Sede sin ventas'}
];
S.creds=[
  {id:'A',fecha:iso(hoy),concesionarioId:'C1',precio:2000,estado:'activo'},
  {id:'B',fecha:iso(hoy),concesionarioId:'C1',precio:1000,estado:'activo'},
  {id:'C',fecha:iso(hoy),concesionarioId:'C2',precio:1500,estado:'mora'},
  {id:'D',fecha:iso(hoy),concesionarioId:'C1',precio:9999,estado:'cancelado'},   // no cuenta
  {id:'E',fecha:iso(hoy),concesionarioId:'C1',precio:9999,estado:'rechazado'},   // no cuenta
  {id:'F',fecha:iso(hoy),concesionarioId:'C1',precio:9999,eliminado:true},       // no cuenta
  {id:'G',fecha:iso(hoy),concesionarioId:'C3',precio:9999,estado:'activo'},      // sede borrada: no cuenta
  {id:'H',fecha:iso(hoy),concesionarioId:'',precio:9999,estado:'activo'},        // sin sede: no cuenta
  {id:'I',fecha:haceMeses(3),concesionarioId:'C2',precio:800,estado:'activo'},
  {id:'J',fecha:'2019-01-01',concesionarioId:'C1',precio:9999,estado:'activo'}   // fuera de rango
];

// ── Motos ──
API._concChartSetPeriodo('mes'); API._concChartSetModo('motos');
let D=API._concChartDatos();
ok('solo las sedes con movimiento',            D.sedes.length===2);
ok('ordenadas de mayor a menor',               D.sedes[0].id==='C1' && D.sedes[1].id==='C2');
ok('C1 = 2 motos (cancelado, rechazado y eliminado fuera)', D.totales.C1===2);
ok('C2 = 2 motos (una de hace 3 meses)',       D.totales.C2===2);
ok('la sede borrada no aparece',               !D.sedes.some(s=>s.id==='C3'));
ok('la sede sin ventas no aparece',            !D.sedes.some(s=>s.id==='C4'));
ok('las 2 de C1 caen en el mes actual',        D.series.C1[11]===2);
ok('C2 tiene 1 este mes y 1 hace 3 meses',     D.series.C2[11]===1 && D.series.C2[8]===1);
ok('el credito de 2019 no entra',              D.series.C1.reduce((a,b)=>a+b,0)===2);

// ── Monto ──
API._concChartSetModo('monto');
D=API._concChartDatos();
ok('C1 = 3000 en monto',                       D.totales.C1===3000);
ok('C2 = 2300 en monto',                       D.totales.C2===2300);
ok('en monto C1 sigue primero',                D.sedes[0].id==='C1');

// precioBaseReal manda sobre precio
S.creds.push({id:'K',fecha:iso(hoy),concesionarioId:'C2',precio:100,precioBaseReal:5000,estado:'activo'});
D=API._concChartDatos();
ok('usa precioBaseReal cuando existe',         D.totales.C2===7300);
S.creds.pop();

// ── Dias y anos ──
API._concChartSetModo('motos'); API._concChartSetPeriodo('dia');
D=API._concChartDatos();
ok('por dia: 30 columnas',                     D.buckets.length===30);
ok('por dia: lo de hoy en la ultima',          D.series.C1[29]===2);
API._concChartSetPeriodo('ano');
D=API._concChartDatos();
ok('por ano: 5 columnas',                      D.buckets.length===5);
ok('por ano: todo el ano actual junto',        D.series.C1[4]===2 && D.series.C2[4]===2);

// ── El HTML de los controles ──
API._concChartSetPeriodo('mes');
const h=API._concChartHtml();
ok('trae el canvas',                           h.includes('id="conc-chart"'));
ok('trae los tres periodos',                   h.includes("_concChartSetPeriodo('dia')") && h.includes("_concChartSetPeriodo('mes')") && h.includes("_concChartSetPeriodo('ano')"));
ok('trae motos y monto',                       h.includes("_concChartSetModo('motos')") && h.includes("_concChartSetModo('monto')"));
ok('marca el periodo activo',                  /btn-p btn-xs" onclick="_concChartSetPeriodo\('mes'\)/.test(h));
ok('trae la leyenda',                          h.includes('id="conc-chart-leyenda"'));

// ── Sin datos no revienta ──
S.creds=[]; D=API._concChartDatos();
ok('sin creditos: ninguna sede',               D.sedes.length===0);
ok('sin creditos: los buckets siguen',         D.buckets.length===12);
S.concesionarios=[]; D=API._concChartDatos();
ok('sin sedes tampoco revienta',               D.sedes.length===0);

console.log(''); console.log(pass+' pruebas OK, '+fail+' fallas');
if(fail) process.exitCode=1;
