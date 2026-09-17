// Concesionarios: lo que se le descuenta a una sede por cada moto es LO FINANCIADO
// (precio − inicial), no el precio completo. Es la cuenta que lleva la oficina en
// su Excel de saldos (Adam, 16-sep-2026): el cliente paga la inicial en la tienda y
// Pagasi manda solo el resto. Antes el módulo decía "consumido" casi el doble.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (l, v) => { if (v) { pass++; console.log('OK   ' + l); } else { fail++; console.log('FALLA ' + l); } };
function elemento() {
  return { innerHTML:'', textContent:'', value:'', className:'', id:'', style:{}, dataset:{}, classList:{add(){},remove(){},contains(){return false;},toggle(){}},
    children:[], appendChild(){}, removeChild(){}, remove(){}, setAttribute(){}, getAttribute(){ return null; }, addEventListener(){}, removeEventListener(){},
    closest(){ return null; }, getBoundingClientRect(){ return {top:0,left:0,width:0,height:0}; }, querySelector(){ return null; }, querySelectorAll(){ return []; } };
}
const doc = { getElementById(){ return null; }, querySelector(){ return null; }, querySelectorAll(){ return []; }, createElement(){ return elemento(); },
  head: elemento(), body: elemento(), documentElement: elemento(), addEventListener(){}, removeEventListener(){} };
const ctx = { console:{log(){},warn(){},error(){}}, setTimeout(){return 0;}, clearTimeout(){}, setInterval(){return 0;}, clearInterval(){}, requestAnimationFrame(){return 0;},
  document:doc, navigator:{userAgent:'node',language:'es'}, location:{href:'https://pagasi.io/admin.html',search:'',hash:'',pathname:'/admin.html'},
  localStorage:{getItem(){return null;},setItem(){},removeItem(){}}, sessionStorage:{getItem(){return null;},setItem(){},removeItem(){}},
  fetch(){ return Promise.resolve({ok:true,json:()=>Promise.resolve({})}); }, alert(){}, confirm(){return true;}, prompt(){return '';},
  db:null, storage:null, firebase:undefined, innerWidth:1440, innerHeight:900, PG:{} };
ctx.MutationObserver=function(){return {observe(){},disconnect(){}};}; ctx.IntersectionObserver=function(){return {observe(){},disconnect(){},unobserve(){}};};
ctx.ResizeObserver=function(){return {observe(){},disconnect(){}};}; ctx.addEventListener=function(){}; ctx.removeEventListener=function(){};
ctx.matchMedia=function(){return {matches:false,addListener(){},addEventListener(){}};}; ctx.getComputedStyle=function(){return {getPropertyValue(){return '';}};};
ctx.scrollTo=function(){}; ctx.history={state:null,pushState(){},replaceState(){},back(){}}; ctx.window=ctx;
const html = fs.readFileSync(path.join(ROOT,'admin.html'),'utf8');
const archivos = [...html.matchAll(/src="((?:assets|logic|modules)\/[^"?]+\.js)/g)].map(m=>m[1]);
vm.createContext(ctx);
vm.runInContext(archivos.map(f=>fs.readFileSync(path.join(ROOT,f),'utf8')).join('\n;\n'), ctx, {filename:'app.js'});

ctx.S.concesionarios = [
  { id:'CONC-A', nombre:'Sede A', anticipos:[ {id:'ANT-1', fecha:'2026-06-01', monto:1000, metodo:'Binance'}, {id:'ANT-2', fecha:'2026-06-02', monto:500, metodo:'Binance', eliminado:true} ] },
  { id:'CONC-B', nombre:'Sede B', anticipos:[] },
];
ctx.S.creds = [
  { id:'CRED-1', concesionarioId:'CONC-A', fecha:'2026-06-03', estado:'activo', precio:1500, precioBaseReal:1500, ini:900, fin:600 },
  { id:'CRED-2', concesionarioId:'CONC-A', fecha:'2026-06-04', estado:'mora',   precio:1200, precioBaseReal:1200, ini:500 },            // sin fin: precio − inicial
  { id:'CRED-3', concesionarioId:'CONC-A', fecha:'2026-06-05', estado:'activo', precio:900,  precioBaseReal:900,  ini:600, fin:'300' }, // fin guardado como texto
  { id:'CRED-4', concesionarioId:'CONC-A', fecha:'2026-06-06', estado:'cancelado', precio:2000, ini:0, fin:2000 },                       // cancelado: no consume
  { id:'CRED-5', concesionarioId:'CONC-A', fecha:'2026-06-07', estado:'activo', precio:2000, ini:0, fin:2000, eliminado:true },          // borrado: no consume
  { id:'CRED-6', concesionarioId:'CONC-B', fecha:'2026-06-08', estado:'activo', precio:1000, ini:400, fin:600 },
];
ctx.S.clientes=[]; ctx.S.pagos=[];

ok('financiado = fin cuando existe', ctx._concFinanciadoDe(ctx.S.creds[0]) === 600);
ok('sin fin: precio − inicial', ctx._concFinanciadoDe(ctx.S.creds[1]) === 700);
ok('fin como texto también sirve', ctx._concFinanciadoDe(ctx.S.creds[2]) === 300);
ok('un crédito sin nada da 0, no NaN', ctx._concFinanciadoDe({}) === 0 && ctx._concFinanciadoDe(null) === 0);
const f = ctx._concFinanzasDe('CONC-A');
ok('enviado: solo los anticipos no borrados (1000)', f.enviado === 1000);
ok('consumido = 600 + 700 + 300 = 1600 (no el precio completo 3600)', f.consumido === 1600);
ok('el cancelado y el borrado no consumen', f.creds.length === 3);
ok('saldo = enviado − financiado = −600', f.saldo === -600);
ok('la otra sede no se mezcla', ctx._concFinanzasDe('CONC-B').consumido === 600 && ctx._concFinanzasDe('CONC-B').saldo === -600);
ctx._concChartModo = 'monto';
ok('el gráfico por monto usa lo financiado', ctx._concChartValor(ctx.S.creds[0]) === 600);
ctx._concChartModo = 'motos';
ok('el gráfico por motos sigue contando 1 por moto', ctx._concChartValor(ctx.S.creds[0]) === 1);
console.log(''); console.log(pass + ' pruebas OK, ' + fail + ' fallas');
if (fail) process.exitCode = 1;
