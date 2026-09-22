// Grupo 3 de la lista del 18-sep-2026 — el dinero de las motos:
//  10) una solicitud de concesionario rechazada dejaba descontada la compra de la moto
//      y la moto "financiada" con el nombre del cliente;
//  11) el boton "Solicitud" de Inventario perdia la moto elegida y el wizard creaba
//      otra del catalogo, descontando la compra de nuevo;
//  12) Finanzas dejaba borrar el gasto de una moto por separado, y restaurar una moto
//      revivia gastos anulados por otra via;
//  22) si fallaba la creacion de la moto, el credito quedaba sin moto y sin aviso;
//  23) guardar una solicitud y abrir otra enseguida mezclaba los datos de la moto;
//  24) un doble clic en Guardar duplicaba motos y gastos.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (l, v) => { if (v) { pass++; console.log('OK   ' + l); } else { fail++; console.log('FALLA ' + l); } };
function elemento() {
  return { innerHTML:'', textContent:'', value:'', className:'', id:'', style:{}, dataset:{}, classList:{add(){},remove(){},contains(){return false;},toggle(){}},
    children:[], appendChild(){}, removeChild(){}, remove(){}, setAttribute(){}, getAttribute(){ return null; }, addEventListener(){}, removeEventListener(){},
    closest(){ return null; }, getBoundingClientRect(){ return {top:0,left:0,width:0,height:0}; }, querySelector(){ return null; }, querySelectorAll(){ return []; } };
}
// La pantalla de Configuracion: solo existe mientras "enConfig" es verdad
const form = {};
const enConfig = true;
const doc = { getElementById(id){ return (enConfig && form[id]) || null; }, querySelector(){ return null; }, querySelectorAll(){ return []; }, createElement(){ return elemento(); },
  head: elemento(), body: elemento(), documentElement: elemento(), addEventListener(){}, removeEventListener(){} };
const ctx = { console:{log(){},warn(){},error(){}}, setTimeout(){return 0;}, clearTimeout(){}, setInterval(){return 0;}, clearInterval(){}, requestAnimationFrame(){return 0;},
  document:doc, navigator:{userAgent:'node',language:'es'}, location:{href:'https://pagasi.io/admin.html',search:'',hash:'',pathname:'/admin.html'},
  localStorage:{getItem(){return null;},setItem(){},removeItem(){}}, sessionStorage:{getItem(){return null;},setItem(){},removeItem(){}},
  fetch(){ return Promise.resolve({ok:true,json:()=>Promise.resolve({})}); }, alert(){}, confirm(){return true;}, prompt(){return '';},
  open(){ return { document:{ write(){}, close(){} } }; },
  db:null, storage:null, firebase:undefined, innerWidth:1440, innerHeight:900, PG:{} };
ctx.MutationObserver=function(){return {observe(){},disconnect(){}};}; ctx.IntersectionObserver=function(){return {observe(){},disconnect(){},unobserve(){}};};
ctx.ResizeObserver=function(){return {observe(){},disconnect(){}};}; ctx.addEventListener=function(){}; ctx.removeEventListener=function(){};
ctx.matchMedia=function(){return {matches:false,addListener(){},addEventListener(){}};}; ctx.getComputedStyle=function(){return {getPropertyValue(){return '';}};};
ctx.scrollTo=function(){}; ctx.history={state:null,pushState(){},replaceState(){},back(){}}; ctx.window=ctx;
const html = fs.readFileSync(path.join(ROOT,'admin.html'),'utf8');
const archivos = [...html.matchAll(/src="((?:assets|logic|modules)\/[^"?]+\.js)/g)].map(m=>m[1]);
vm.createContext(ctx);
vm.runInContext(archivos.map(f=>fs.readFileSync(path.join(ROOT,f),'utf8')).join('\n;\n'), ctx, {filename:'app.js'});
const avisos = [];
ctx.toast = function(m, t){ avisos.push([t, m]); };
ctx.nav = function(){};
ctx.setMicon = function(){}; ctx.requireDeletePermission = function(){ return true; };
ctx.logActividad = function(){}; ctx.prompt = function(){ return 'No califica'; };
const el = (props) => Object.assign(elemento(), props || {});
const S = ctx.S;
// las cajitas del modal, para que closeM() y los modales reales funcionen
['mtt','msb','modal-box','mbd','mft','ov'].forEach(id => { form[id] = el({ style:{} }); });
S.currentUser = { uid:'u1', nombre:'Prueba', rol:'Administrador' };
ctx._cuentasBanc = [{ nombre:'Efectivo' }, { nombre:'Binance' }];
const saldo = c => ctx.saldoCuenta(c);

// ── 24) Doble clic en Guardar ──
let veces = 0;
S.saveFn = function(){ veces++; return true; };
ctx.saveM(); ctx.saveM(); ctx.saveM();
ok('un doble (o triple) clic en Guardar guarda UNA sola vez', veces === 1);
ctx.closeM();   // al cerrarse el modal se suelta el candado
veces = 0; S.saveFn = function(){ veces++; return false; };   // no paso la validacion
ctx.saveM(); ctx.saveM();
ok('si no pasa la validación, se puede volver a intentar enseguida', veces === 2);
ok('cerrar el modal suelta el candado para el siguiente registro', ctx.window._saveMEnCurso !== true || (ctx.closeM(), ctx.window._saveMEnCurso === false));
S.saveFn = null;

// ── 12) El gasto de una moto no se borra desde Finanzas ──
S.movimientos = []; S.egresos = []; S.motos = []; S.creds = [];
S.movimientos.push({ id:'MOV-INI', tipo:'deposito', concepto:'Aporte', monto:5000, cuentaDestino:'Binance', fecha:'2026-09-01' });
const moto = { id: 7, modelo:'MOTO 150', precio: 1000, estado:'disponible' };
S.motos.push(moto);
ctx._mpagoCrearGastos(moto, [{ cuenta:'Binance', monto:900 }], { fecha:'2026-09-02' });
const egMoto = S.egresos.find(e => e.motoIdRef === 7);
const saldoTrasCompra = saldo('Binance');
avisos.length = 0;
ctx.toast = function(m, t){ avisos.push([t, m]); };
S.saveFn = null;
ctx.delEgreso(egMoto.id);
ok('Finanzas no deja borrar el gasto de la compra de una moto',
  typeof S.saveFn !== 'function' && !egMoto.eliminado && saldo('Binance') === saldoTrasCompra);
ok('...y explica por dónde se hace', avisos.some(a => a[0] === 'error' && /Motocicletas/.test(a[1])));
// un gasto normal sí se puede borrar
S.egresos.push({ id: 900, concepto:'Alquiler', monto:100, fecha:'2026-09-02', categoria:'operativos', forma:'Binance', eliminado:false });
S.saveFn = null; ctx.delEgreso(900);
ok('un gasto normal se sigue pudiendo borrar', typeof S.saveFn === 'function');

// ── 12) Restaurar una moto no revive gastos anulados por otra vía ──
const auditMoto = { eliminado:true, eliminadoPor:'Prueba', eliminadoEn:'2026-09-10T12:00:00Z', eliminadoRazon:'Moto duplicada', eliminacionReversaCuenta:true };
// un segundo gasto de la misma moto, anulado ANTES por otra via (p. ej. solicitud rechazada)
S.egresos.push({ id: 901, concepto:'Compra de moto · viejo', monto:50, fecha:'2026-09-03', categoria:'inventario', forma:'Binance',
  motoIdRef: 7, origenAuto:'compra_moto', eliminado:true, eliminadoEn:'2026-09-05T10:00:00Z', eliminadoRazon:'Otra cosa' });
Object.assign(moto, auditMoto);
ctx._mpagoReversarGastos(7, true, auditMoto);
ctx.restaurarMoto(7);
ok('al restaurar, vuelve el gasto que anuló el borrado de la moto', !S.egresos.find(e => e.id === egMoto.id).eliminado);
ok('...y NO revive el que estaba anulado por otra vía', S.egresos.find(e => e.id === 901).eliminado === true);

// ── 10) Solicitud de concesionario rechazada ──
S.movimientos = [{ id:'MOV-INI2', tipo:'deposito', concepto:'Aporte', monto:5000, cuentaDestino:'Binance', fecha:'2026-09-01' }];
S.egresos = []; S.motos = []; S.creds = [];
const motoSol = { id: 8, modelo:'MOTO 200', precio:1200, estado:'financiada', cliente:'CLIENTE SOLICITUD' };
S.motos.push(motoSol);
ctx._mpagoCrearGastos(motoSol, [{ cuenta:'Binance', monto:1000 }], { fecha:'2026-09-03' });
const saldoConSolicitud = saldo('Binance');
S.creds.push({ id:'CRED-900', cli:'CLIENTE SOLICITUD', motoId:8, estado:'pendiente_revision', ini:300, fecha:'2026-09-03' });
ctx._aprRechazar('CRED-900');
const credRech = S.creds[0];
ok('la solicitud queda cancelada con su razón', credRech.estado === 'cancelado' && !!credRech.razonRechazo);
ok('el dinero de la compra vuelve a la cuenta', saldo('Binance') === saldoConSolicitud + 1000);
ok('el gasto de la moto queda anulado', S.egresos.filter(e => e.motoIdRef === 8 && !e.eliminado).length === 0);
ok('la moto vuelve a estar disponible y sin cliente', motoSol.estado === 'disponible' && !motoSol.cliente);

// ── 11) El botón "Solicitud" de Inventario no pierde la moto ──
S.motos = [{ id: 11, modelo:'NEW HORSE 150', precio:1320, estado:'disponible' }];
S.clientes = []; S.creds = [];
const ov = el({ style:{} }); let htmlWz = '';
Object.defineProperty(ov, 'innerHTML', { get(){ return htmlWz; }, set(v){ htmlWz = v; } });
form['wz-overlay'] = ov;
ctx.document.body = el({ style:{}, appendChild(){} });
ctx.openAddCredConMoto(11);
ok('la moto elegida queda guardada en el wizard desde el paso 1', String(ctx.WZ.motoInvId) === '11');
ctx.WZ.step = 3;
let pedido = null;
ctx._wzPickMotoInv = function(sel){ pedido = sel.value; };
ctx.setTimeout = function(fn){ try { fn(); } catch(e) {} return 0; };
form['wz_moto_inv'] = el({ value:'', options:[], selectedIndex:0 });
try { ctx._wzRender(); } catch(e) {}
ok('al llegar al paso 3 la moto sigue elegida (antes se creaba otra del catálogo)', String(pedido) === '11');

console.log(''); console.log(pass + ' pruebas OK, ' + fail + ' fallas');
if (fail) process.exitCode = 1;
