// Contrato v3 (financiamiento + Pagasi Protect): la matematica del 12 % y el
// documento. Lo importante: la cuota IMPRESA es la que el sistema cobra, el
// Protect se despeja de ella, y el cronograma cierra al centavo.
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
global.window=global;
const _els={};
const _mk=()=>({innerHTML:'',textContent:'',value:'',className:'',style:{},appendChild(){},querySelector(){return _mk();}});
global.$=id=>{ if(!_els[id]) _els[id]=_mk(); return _els[id]; };
global.document={getElementById:id=>global.$(id),querySelector:()=>null,querySelectorAll:()=>[],createElement:_mk,body:{appendChild(){},removeChild(){},style:{}}};
global.S={creds:[],clientes:[],motos:[],pagos:[],gps:[]};
global.toast=()=>{}; global.nav=()=>{}; global.getEmpresa=()=>({nombre:'PAGASI 18, C.A.',rif:'J-50829589-7'});
global._concGetById=id=>({nombre:'EMPIRE Bello Monte',rif:'J-11111111-1'});
global._pintarDoc=()=>{}; global._PAGASI_LOGO_BLUE='';
let pass=0, fail=0;
global.ok=(l,v)=>{ if(v){pass++;console.log('OK   '+l);} else {fail++;console.log('FALLA '+l);} };

const auto=new Proxy({},{has:()=>true,get:(t,k)=>{if(k===Symbol.unscopables)return undefined;if(k in t)return t[k];if(k in global)return global[k];return function(){return 0;};},set:(t,k,v)=>{t[k]=v;return true;}});
const SRC=['logic/contratos.js','logic/contratos-dra.js','logic/contratos-protect.js'].map(f=>fs.readFileSync(path.join(ROOT,f),'utf8')).join('\n;\n');
const API=eval('with(auto){'+SRC+'\n; ({_protectFinanzas,_protectDatos,_htmlContratoProtect,_contratoVersionDe,_CONTRATO_PROTECT_DESDE}) }');
const F=API._protectFinanzas;
const cerca=(a,b,tol)=>Math.abs(a-b)<=(tol==null?0.02:tol);

ok('vigente desde el 7 de septiembre de 2026', API._CONTRATO_PROTECT_DESDE==='2026-09-07');

// ── El ejemplo de la abogada, al reves: de su cuota se recupera su MF ──
// Moto 3.750 · Protect 300 · inicial 978 · 18 cuotas → MF 3.072 · cuota 178,89 · intereses 148
const ej=F({precio:3750, ini:978, cuotaQ:178.89, totalCuotas:18, fecha:'2026-09-07'});
ok('ejemplo abogada: MF vuelve a 3.072',       cerca(ej.MF, 3072, 0.10));
ok('ejemplo abogada: Protect vuelve a 300',    cerca(ej.protect, 300, 0.10));
ok('ejemplo abogada: intereses ~148',          cerca(ej.intereses, 148, 0.10));
ok('ejemplo abogada: MTA = cuota x 18',        cerca(ej.MTA, 178.89*18));

// ── La moto promedio de hoy: 1.724 / 813 / cuota 71,51 x 24 → Protect ~703 ──
const prom=F({precio:1723.67, ini:813.32, cuotaQ:71.51, totalCuotas:24, fecha:'2026-09-07'});
ok('moto promedio: Protect sale en ~703',      cerca(prom.protect, 703, 3));
ok('moto promedio: saldo precio = 910,35',     cerca(prom.saldoPrecio, 910.35));
ok('moto promedio: MF = saldo + Protect',      cerca(prom.MF, prom.saldoPrecio+prom.protect));

// ── El cronograma cierra al centavo ──
const filas=prom.filas;
const sum=k=>filas.reduce((a,r)=>a+r[k],0);
ok('24 filas',                                  filas.length===24);
ok('suma de capital = MF',                      cerca(sum('capital'), prom.MF));
ok('suma de intereses = intereses',             cerca(sum('interes'), prom.intereses));
ok('suma de cuotas = MTA',                      cerca(sum('cuota'), prom.MTA));
ok('el saldo final es exactamente 0',           filas[23].saldo===0);
ok('todas las cuotas menos la ultima = cuotaQ', filas.slice(0,-1).every(r=>cerca(r.cuota,71.51)));
ok('la ultima absorbe el redondeo (a lo sumo medio centavo por fila)', cerca(filas[23].cuota, 71.51, 24*0.005+0.01));
ok('el interes baja cada quincena',             filas.every((r,i)=>i===0||r.interes<=filas[i-1].interes));
ok('el capital sube cada quincena',             filas.slice(0,-1).every((r,i)=>i===0||r.capital>=filas[i-1].capital));
ok('primera cuota vence a los 15 dias',         filas[0].fecha.toISOString().slice(0,10)==='2026-09-22');
ok('interes de la 1a quincena = MF x 0,5 %',    cerca(filas[0].interes, prom.MF*0.005));

// ── Si la cuota fuera menor que el 12 %, Protect no se vuelve negativo ──
const bajo=F({precio:1000, ini:450, cuotaQ:20, totalCuotas:24, fecha:'2026-09-07'});
ok('Protect nunca negativo',                    bajo.protect===0);

// ── El documento ──
S.clientes=[{id:'CLI-1',nombre:'JOSE PRUEBA',cedula:'12345678',direccion:'Av. Principal, Caracas',ciudad:'Caracas',tel:'0414-0000000',email:'jose@x.com',
             fiador_nom:'MARIA GARANTE',fiador_ci:'87654321',fiador_dir:'Calle 2, Caracas',fiador_tel:'0424-0000000'}];
S.motos=[{id:14,marca:'EMPIRE',modelo:'MATRIX 150',anio:2026,color:'Negro',placa:'AL9T94J',vin:'8Z53ADCK9TM006007',serialMotor:'MTR-1'}];
S.gps=[{creditoId:'CRED-900',idGps:'19210076409',imei:'866557087286946',fechaInstalacion:'2026-09-07',tecnico:'Francisco',estado:'instalado'}];
S.creds=[{id:'CRED-900',cli:'JOSE PRUEBA',clienteId:'CLI-1',motoId:14,concesionarioId:'C1',fecha:'2026-09-07',precio:1723.67,ini:813.32,cuotaQ:71.51,totalCuotas:24,plazo:12,uso_moto:'personal',contratoFirmado:false}];

const html=API._htmlContratoProtect('CRED-900');
ok('genera el documento',                       typeof html==='string' && html.length>20000);
ok('titulo del contrato nuevo',                 html.includes('PRESTACIÓN DE SERVICIOS «PAGASI PROTECT»'));
ok('nombre del cliente',                        html.includes('JOSE PRUEBA'));
ok('nombre del fiador',                         html.includes('MARIA GARANTE'));
ok('clausula 14 FIANZA presente con fiador',    html.includes('14. FIANZA'));
ok('tasa del 12 % anual',                       html.includes('doce por ciento (12%) anual'));
ok('mora del 3 % anual desde el dia 6',         html.includes('tres por ciento (3%) anual') && html.includes('sexto (6°) día'));
ok('protocolo de apagado: no por mora',         html.includes('no activarla por razón de mora'));
ok('instalacion en 30 dias en centro autorizado', html.includes('treinta (30) días continuos siguientes a la Fecha de Celebración, para lo cual'));
ok('sin letras de cambio (alternativa 1)',      html.includes('NO se han emitido letras de cambio'));
ok('los dispositivos pasan al comprador',       html.includes('pasarán en propiedad al Comprador sin contraprestación adicional'));
ok('medios: 100% Banco y Binance',              html.includes('100% Banco Universal') && html.includes('Binance'));
ok('canal +58 424-2177798',                     html.includes('+58 424-2177798'));
ok('la cuota impresa es la del sistema',        html.includes('US$ 71.51'));
ok('el Protect impreso es el despejado',        html.includes('US$ '+prom.protect.toFixed(2)));
ok('anexo A con las 4 columnas',                html.includes('Capital') && html.includes('Intereses') && html.includes('Saldo Insoluto'));
ok('anexos B, C y D',                           html.includes('ANEXO “B”') && html.includes('ANEXO “C”') && html.includes('ANEXO “D”'));
ok('GPS del modulo en el anexo B',              html.includes('19210076409') && html.includes('866557087286946'));
ok('sin "undefined" ni "NaN" en el documento',  !/undefined|NaN/.test(html));
ok('sin placeholders crudos del Word',          !/\[_{4,}\]|\[NOMBRE|\[DIRECCI|\[CARGO\]/.test(html));
ok('la hipoteca mobiliaria (6.4) quedo fuera',  !/6\.4\t/.test(html) && !html.includes('Hipoteca Mobiliaria'));

// ── Sin fiador: se cae la clausula 14 y las firmas son 2 ──
S.clientes[0].fiador_nom=''; S.clientes[0].fiador_ci='';
const sinF=API._htmlContratoProtect('CRED-900');
ok('sin fiador: no hay clausula 14',            !sinF.includes('14. FIANZA'));
ok('sin fiador: no hay "Por el Fiador"',        !sinF.includes('Por el Fiador'));
ok('sin fiador: "dos (2) ejemplares"',          sinF.includes('dos (2) ejemplares'));

// ── El router manda los creditos nuevos aqui ──
ok('credito sin firmar hoy -> protect',         API._contratoVersionDe({contratoFirmado:false})==='protect');
ok('firmado el 7-sep -> protect',               API._contratoVersionDe({contratoFirmado:true,fechaContratoFirmado:'2026-09-07'})==='protect');
ok('firmado el 6-sep -> dra (no retroactivo)',  API._contratoVersionDe({contratoFirmado:true,fechaContratoFirmado:'2026-09-06'})==='dra');
ok('version grabada manda sobre la fecha',      API._contratoVersionDe({contratoVersion:'dra',contratoFirmado:true,fechaContratoFirmado:'2026-09-20'})==='dra');

console.log(''); console.log(pass+' pruebas OK, '+fail+' fallas');
if(fail) process.exitCode=1;
