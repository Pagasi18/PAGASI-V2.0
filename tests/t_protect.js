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
const API=eval('with(auto){'+SRC+'\n; ({_protectFinanzas,_protectDatos,_htmlContratoProtect,_contratoVersionDe,_CONTRATO_PROTECT_DESDE,_docsRecaudosLista}) }');
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
ok('anexo A con capital, interes y saldo por cuota', /cap [\d.,]+ · int [\d.,]+ · saldo [\d.,]+/.test(html) && html.includes('TOTALES'));
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

// ── Documentos del contrato: sin guardar nada, todo en gris ──
S.clientes[0].fiador_nom='MARIA GARANTE'; S.clientes[0].fiador_ci='87654321';
const sinDocs=API._htmlContratoProtect('CRED-900');
ok('sin docs: recaudos todos en blanco',        (sinDocs.match(/Sí \(&nbsp;&nbsp;\) &nbsp; No \(&nbsp;&nbsp;\)/g)||[]).length>=14);
ok('sin docs: PEP marcado en NO por defecto',   (sinDocs.match(/NO ostentan \(&nbsp;X&nbsp;\)/g)||[]).length===2 && sinDocs.includes('SÍ ostentan (&nbsp;&nbsp;)'));

// ── Con documentos guardados: sale impreso ──
S.creds[0].docsContrato={facturaNum:'00012345',facturaFecha:'2026-09-07',certOrigenNum:'BB-998877',polizaCia:'Seguros Caracas',polizaNum:'POL-555',
  recaudos:{cedCli:true,rifCli:true,domCli:false,ingCli:true,refCli:true,cedFia:true,rifFia:false,domFia:true,ingFia:true,factura:true,finiquito:true,certOrigen:true,poliza:false,fotos:true,otros:false},
  otrosTexto:'',pep:'no',pepDetalle:'',actividad:'Comerciante',ingresoMensual:'450',verificado:true,verificadoFecha:'2026-09-07',analista:'Miguel',aprobadoPor:'Adam',actualizadoEn:'2026-09-07T12:00:00Z',actualizadoPor:'Adam'};
const conDocs=API._htmlContratoProtect('CRED-900');
ok('factura en el considerando',                conDocs.includes('según factura N° <strong>00012345</strong>'));
ok('certificado de origen en el considerando',  conDocs.includes('certificado de origen: <strong>BB-998877</strong>'));
ok('poliza en el anexo C',                      conDocs.includes('Seguros Caracas · POL-555'));
ok('recaudo entregado marcado Sí (X)',          (conDocs.match(/Sí \(&nbsp;X&nbsp;\)/g)||[]).length===11);
ok('recaudo NO entregado marcado No (X)',       (conDocs.match(/No \(&nbsp;X&nbsp;\)/g)||[]).length===4);
ok('PEP: NO marcado, SÍ vacio (x2: clausula 8 y anexo D)', (conDocs.match(/NO ostentan \(&nbsp;X&nbsp;\)/g)||[]).length===2 && conDocs.includes('SÍ ostentan (&nbsp;&nbsp;)'));
ok('origen de fondos con ingreso',              conDocs.includes('<strong>Comerciante</strong>') && conDocs.includes('US$ 450.00'));
ok('verificaciones con fecha y analista',       conDocs.includes('sin novedad') && conDocs.includes('<strong>Miguel</strong>') && conDocs.includes('<strong>Adam</strong>'));
ok('sin "undefined" con docs',                  !/undefined|NaN/.test(conDocs));

// ── La lista de recaudos es una sola para formulario y contrato ──
ok('recaudos con fiador = 14',                  API._docsRecaudosLista(true).length===14);
ok('recaudos sin fiador = 10',                  API._docsRecaudosLista(false).length===10);
ok('cada recaudo tiene clave y texto',          API._docsRecaudosLista(true).every(r=>r.length===2 && r[0] && r[1]));


// ── Sin cuadro: el papel se llena con lo que el sistema ya sabe ──
S.clientes[0].trabajo='Mecánico'; S.clientes[0].ingreso=520; S.creds[0].creadoPor='Miguel'; S.creds[0].aprobadoPor='Adam';
const auto_=(function(){ const d=S.creds[0].docsContrato; delete S.creds[0].docsContrato; const h=API._htmlContratoProtect('CRED-900'); S.creds[0].docsContrato=d; return h; })();
ok('actividad = trabajo del cliente',            auto_.includes('<strong>Mecánico</strong>'));
ok('ingreso = ingreso del cliente',              auto_.includes('US$ 520.00'));
ok('analista = quien creo el credito',           auto_.includes('Analista responsable: <strong>Miguel</strong>'));
ok('aprobado por = quien lo aprobo (Aprobaciones)', auto_.includes('aprobado por <strong>Adam</strong>'));
ok('recaudos en blanco para marcar a boligrafo', (auto_.match(/Sí \(&nbsp;&nbsp;\) &nbsp; No \(&nbsp;&nbsp;\)/g)||[]).length>=14);

// ── Lo que escribe un empleado se imprime escapado ──
S.creds[0].docsContrato.polizaCia='Seguros <La Previsora>'; S.creds[0].docsContrato.otrosTexto='<carta laboral>';
const esc=API._htmlContratoProtect('CRED-900');
ok('un < en la aseguradora sale como &lt; (no se come el Anexo C)', esc.includes('Seguros &lt;La Previsora&gt;') && !esc.includes('Seguros <La Previsora>'));
ok('un < en "otros" sale como &lt;',            esc.includes('&lt;carta laboral&gt;'));
S.creds[0].docsContrato.polizaCia='Seguros Caracas'; S.creds[0].docsContrato.otrosTexto='';

// ── Fecha de factura sin guardar = fecha del credito (como imprimia antes) ──
const sinFecha=Object.assign({},S.creds[0]); delete sinFecha.docsContrato; S.creds.push(Object.assign(sinFecha,{id:'CRED-901'}));
const h901=API._htmlContratoProtect('CRED-901');
ok('sin docs: la fecha de factura es la del credito', h901.includes('de fecha <strong>07/09/2026</strong>'));
S.creds.pop();

// ── Profesion del fiador ──
S.creds[0].docsContrato.fiadorProfesion='Enfermera';
ok('profesion del fiador impresa',               API._htmlContratoProtect('CRED-900').includes('oficio <strong>Enfermera</strong>'));

// ── B.4 con los valores de Adam ──
ok('horario L-V 9 a 5',                          esc.includes('lunes a viernes, de 9:00 a.m. a 5:00 p.m.'));
ok('respuesta ante robo: 1 a 5 horas',           esc.includes('entre una (1) y cinco (5) horas'));


// ── El router manda los creditos nuevos aqui ──
ok('credito sin firmar hoy -> protect',         API._contratoVersionDe({contratoFirmado:false})==='protect');
ok('firmado el 7-sep -> protect',               API._contratoVersionDe({contratoFirmado:true,fechaContratoFirmado:'2026-09-07'})==='protect');
ok('firmado el 6-sep -> dra (no retroactivo)',  API._contratoVersionDe({contratoFirmado:true,fechaContratoFirmado:'2026-09-06'})==='dra');
ok('version grabada manda sobre la fecha',      API._contratoVersionDe({contratoVersion:'dra',contratoFirmado:true,fechaContratoFirmado:'2026-09-20'})==='dra');

console.log(''); console.log(pass+' pruebas OK, '+fail+' fallas');
if(fail) process.exitCode=1;
