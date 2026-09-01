// Arnes del modulo GPS: cobertura, enlace con el credito y el importador
// del Excel (que es por donde van a entrar los 500 equipos).
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
global.window=global;
const _els={};
const _mk=()=>({innerHTML:'',textContent:'',value:'',className:'',type:'text',style:{},appendChild(){},querySelector(){return _mk();}});
global.$=id=>{ if(!_els[id]) _els[id]=_mk(); return _els[id]; };
global.document={getElementById:id=>global.$(id),querySelector:()=>null,querySelectorAll:()=>[],createElement:_mk,head:{appendChild(){}},body:{appendChild(){},removeChild(){},style:{}}};
global.setMicon=()=>{}; global.closeM=()=>{}; global.nav=()=>{}; global.toast=()=>{};
global.logActividad=()=>{}; global.confirm=()=>true; global.pageBanner=()=>'';
global.guardados=[];
global.DB={ saveGps:o=>{ guardados.push(o); return Promise.resolve(true); } };
global.S={currentUser:{nombre:'Adam',rol:'Administrador'}, gps:[], creds:[], motos:[], clientes:[]};
let pass=0, fail=0;
global.ok=(l,v)=>{ if(v){pass++;console.log('OK   '+l);} else {fail++;console.log('FALLA '+l);} };

const auto=new Proxy({},{has:()=>true,get:(t,k)=>{if(k===Symbol.unscopables)return undefined;if(k in t)return t[k];if(k in global)return global[k];return function(){return 0;};},set:(t,k,v)=>{t[k]=v;return true;}});
const SRC=fs.readFileSync(path.join(ROOT,'logic/gps.js'),'utf8');
const API=eval('with(auto){'+SRC+'\n; ({_gpsCobertura,_gpsCredInfo,_gpsPorRecuperar,_gpsEstadoDef,_gpsLista,_gpsCredsVivos,_gpsImportarProcesar,_gpsById}) }');

// ── Escenario: 5 creditos, 3 con equipo ──
S.creds = [
  {id:'CRED-001', cli:'Ana',   modelo:'Bera',   placa:'AA1', estado:'activo',    mora:0,  eliminado:false},
  {id:'CRED-002', cli:'Beto',  modelo:'Empire', placa:'BB2', estado:'mora',      mora:12, eliminado:false},
  {id:'CRED-003', cli:'Caro',  modelo:'Toro',   placa:'CC3', estado:'activo',    mora:0,  eliminado:false},
  {id:'CRED-004', cli:'Dario', modelo:'Bera',   placa:'DD4', estado:'mora',      mora:45, eliminado:false},
  {id:'CRED-005', cli:'Elsa',  modelo:'Empire', placa:'EE5', estado:'cancelado', mora:0,  eliminado:false},
  {id:'CRED-006', cli:'Fabio', modelo:'Toro',   placa:'FF6', estado:'rechazado', mora:0,  eliminado:false},
];
S.gps = [
  {id:'G1', estado:'instalado', creditoId:'CRED-001', idGps:'111', imei:'imei1', linea:'0414', eliminado:false},
  {id:'G2', estado:'instalado', creditoId:'CRED-002', idGps:'222', imei:'imei2', linea:'0424', eliminado:false},
  {id:'G3', estado:'stock',     creditoId:'',         idGps:'333', imei:'imei3', linea:'0416', eliminado:false},
  {id:'G4', estado:'instalado', creditoId:'CRED-005', idGps:'444', imei:'imei4', linea:'0426', eliminado:false},
  {id:'G5', estado:'instalado', creditoId:'CRED-003', idGps:'555', imei:'imei5', linea:'0412', eliminado:true},
];

// ── Creditos vivos: se excluyen cancelado y rechazado ──
ok('creditos vivos = 4 (fuera cancelado y rechazado)', API._gpsCredsVivos().length===4);
ok('un eliminado no cuenta como equipo', API._gpsLista().length===4);

// ── Cobertura ──
const cob = API._gpsCobertura();
ok('cubiertos = 2 (CRED-001 y 002)', cob.cubiertos===2);
ok('sin equipo = 2 (CRED-003 y 004)', cob.sin.length===2);
ok('el G5 eliminado NO cuenta como cobertura de CRED-003',
   cob.sin.some(c=>c.id==='CRED-003'));
ok('en mora sin GPS = 1 (solo CRED-004)', cob.sinYMora.length===1);
ok('el que falta en mora es CRED-004', cob.sinYMora[0] && cob.sinYMora[0].id==='CRED-004');
ok('porcentaje de cobertura = 50%', cob.pct===50);
ok('CRED-002 esta en mora pero SI tiene equipo, no aparece',
   !cob.sinYMora.some(c=>c.id==='CRED-002'));

// ── Equipos montados en creditos muertos ──
const rec = API._gpsPorRecuperar();
ok('1 equipo por recuperar (G4 en credito cancelado)', rec.length===1);
ok('el equipo por recuperar es el G4', rec[0] && rec[0].id==='G4');

// ── Datos derivados del credito, no duplicados ──
const i2 = API._gpsCredInfo('CRED-002');
ok('el cliente sale del credito', i2.cliente==='Beto');
ok('la moto sale del credito', i2.modelo==='Empire' && i2.placa==='BB2');
ok('detecta mora por dias', i2.enMora===true && i2.diasMora===12);
const i1 = API._gpsCredInfo('CRED-001');
ok('sin mora no marca mora', i1.enMora===false);
const i5 = API._gpsCredInfo('CRED-005');
ok('un credito cancelado no esta vivo', i5.vivo===false);
ok('credito inexistente devuelve null', API._gpsCredInfo('CRED-999')===null);
ok('sin creditoId devuelve null', API._gpsCredInfo('')===null);

// ── Estados ──
ok('estado instalado se resuelve', API._gpsEstadoDef('instalado').l==='Instalado');
ok('estado desconocido cae a stock', API._gpsEstadoDef('cualquiera').v==='stock');

// ══════════════════════════════════════════════════════════════════
// IMPORTADOR — es por donde entran los 500 equipos, tiene que ser solido
// ══════════════════════════════════════════════════════════════════
const COLS = a => a.join('\t');
function importar(filas){
  guardados.length = 0;
  $('gps_imp').value = filas.join('\n');
  return API._gpsImportarProcesar();
}

const antes = S.gps.length;
importar([
  // estado, iccid, linea, idGps, pass, imei, cliente, cred, modelo, placa, conc, fecha, tecnico, micodus, verif, obs
  COLS(['INSTALADO','8958044200151','143557051','19210075478','141213','866557086115211','Ana','CRED-003','Bera','CC3','EK','29/08/2026','Francisco','ONLINE','Miguel','ok']),
  COLS(['STOCK','8958044200152','143557052','19210075479','141213','866557086115212','','','','','','','','','','']),
]);
ok('importa 2 filas nuevas', S.gps.length===antes+2);
ok('las 2 se mandaron a guardar', guardados.length===2);

const imp1 = S.gps.find(g=>g.idGps==='19210075478');
ok('mapea el estado INSTALADO', imp1 && imp1.estado==='instalado');
ok('enlaza el credito', imp1 && imp1.creditoId==='CRED-003');
ok('convierte la fecha 29/08/2026 -> 2026-08-29', imp1 && imp1.fechaInstalacion==='2026-08-29');
ok('guarda ICCID y linea', imp1 && imp1.iccid==='8958044200151' && imp1.linea==='143557051');
ok('guarda tecnico y verificado por', imp1 && imp1.tecnico==='Francisco' && imp1.verificadoPor==='Miguel');
ok('NO copia el cliente (sale del credito)', imp1 && imp1.cliente===undefined);

// ── Repetidos: no se duplican equipos ──
const n1 = S.gps.length;
const r = importar([COLS(['INSTALADO','8958044200151','143557051','19210075478','141213','866557086115211','Ana','CRED-003','','','','','','','',''])]);
ok('una fila ya cargada no se duplica', S.gps.length===n1);
ok('y devuelve false al no importar nada', r===false);

// ── Normalizacion del numero de credito ──
importar([COLS(['INSTALADO','','','88801','','imeiA','','CRED004','','','','','','','',''])]);
const impA = S.gps.find(g=>g.idGps==='88801');
ok('acepta "CRED004" sin guion y lo normaliza', impA && impA.creditoId==='CRED-004');

// ── Un credito que no existe no rompe la importacion ──
importar([COLS(['INSTALADO','','','88802','','imeiB','','CRED-777','','','','','','','',''])]);
const impB = S.gps.find(g=>g.idGps==='88802');
ok('credito inexistente entra sin enlace', impB && impB.creditoId==='');
ok('y baja a stock, porque instalado exige credito', impB && impB.estado==='stock');

// ── Fechas en otros formatos ──
importar([COLS(['STOCK','','','88803','','imeiC','','','','','','2026-07-15','','','',''])]);
ok('acepta fecha ISO', S.gps.find(g=>g.idGps==='88803').fechaInstalacion==='2026-07-15');
importar([COLS(['STOCK','','','88804','','imeiD','','','','','','5/3/26','','','',''])]);
ok('acepta 5/3/26 -> 2026-03-05', S.gps.find(g=>g.idGps==='88804').fechaInstalacion==='2026-03-05');
importar([COLS(['STOCK','','','88805','','imeiE','','','','','','no es fecha','','','',''])]);
ok('una fecha ilegible queda vacia, no rompe', S.gps.find(g=>g.idGps==='88805').fechaInstalacion==='');

// ── Filas basura ──
const n2 = S.gps.length;
importar(['', '   ', COLS(['','','','','','','','','','','','','','','',''])]);
ok('filas vacias no crean equipos', S.gps.length===n2);

// ── La cobertura se recalcula con lo importado ──
const cob2 = API._gpsCobertura();
ok('CRED-003 ya quedo cubierto tras importar', !cob2.sin.some(c=>c.id==='CRED-003'));
ok('CRED-004 tambien quedo cubierto: su fila decia CRED004 y se normalizo',
   !cob2.sin.some(c=>c.id==='CRED-004'));
ok('sin creditos descubiertos, la cobertura llega a 100%', cob2.pct===100);
ok('y ya no hay ninguno en mora sin GPS', cob2.sinYMora.length===0);

console.log('');
console.log(pass+' pruebas OK, '+fail+' fallas');
process.exit(fail?1:0);
