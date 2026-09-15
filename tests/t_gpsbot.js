// Arnes del bot que trae posiciones de MiCODUS. No prueba la red: prueba las
// dos cosas donde un error pasa desapercibido y ensucia la base — el parseo
// de sus respuestas y el manejo de la zona horaria.
const path = require('path');
const B = require(path.join(__dirname, '..', 'bot', 'gps-micodus.js'));
let pass = 0, fail = 0;
const ok = (l, v) => { if (v) { pass++; console.log('OK   ' + l); } else { fail++; console.log('FALLA ' + l); } };

// ── Sus respuestas son JavaScript relajado, no JSON ───────────────
ok('null cuando viene vacio', B.abrir('') === null);
ok('null cuando viene {}', B.abrir('{}') === null);
ok('null cuando viene undefined', B.abrir(undefined) === null);

// Capturado de verdad de GetTracking, con las claves sin comillas
const CRUDO = '{acc:"0",battery:"100",course:0,dataType:1,'
  + 'deviceUtcDate:"2026-09-01 22:51:15",distance:"289.8531",dy:"14.6",'
  + 'isStop:0,latitude:"10.47486",longitude:"-66.55705",satellite:"9",'
  + 'signal:"26",speed:"48.00",status:"Move"}';
const p = B.abrir(CRUDO);
ok('parsea la respuesta real de GetTracking', p !== null);
ok('lee la latitud', p.latitude === '10.47486');
ok('lee la longitud', p.longitude === '-66.55705');
ok('lee la velocidad', p.speed === '48.00');
ok('lee el voltaje', p.dy === '14.6');
ok('numeros sin comillas tambien', p.dataType === 1 && p.course === 0);

// Un valor con dos puntos adentro no debe romper el parseo
const CONHORA = '{deviceUtcDate:"2026-09-01 22:51:15",status:"Move"}';
ok('la hora dentro del texto no confunde al parser',
   B.abrir(CONHORA).deviceUtcDate === '2026-09-01 22:51:15');

// Respuesta de GetDevices, anidada
const DEVS = '{nowPage:1,resSize:500,userID:139351,devices:[{num:1,id:521673,'
  + 'sn:"19210075442",model:"MV710G",carNum:"",state:1,lock:0}]}';
const d = B.abrir(DEVS);
ok('parsea GetDevices', d.resSize === 500 && d.devices.length === 1);
ok('lee el serial', d.devices[0].sn === '19210075442');
ok('lee el id interno, que es lo que pide GetTracking', d.devices[0].id === 521673);

// ── Zona horaria: sus marcas son UTC aunque no lo digan ───────────
const haceHoras = n => new Date(Date.now() - n * 3600000).toISOString().slice(0, 19).replace('T', ' ');
ok('hace 1 hora', B.horasDesde(haceHoras(1)) === 1);
ok('hace 50 horas', B.horasDesde(haceHoras(50)) === 50);
ok('sin fecha devuelve null', B.horasDesde('') === null);
ok('fecha basura devuelve null', B.horasDesde('no es fecha') === null);
ok('nunca devuelve negativo', B.horasDesde(haceHoras(-3)) === 0);

// El caso que importa: si se leyera como hora local, en Venezuela (UTC-4)
// una moto muda desde hace 4 horas figuraria como recien reportada.
const hace5 = haceHoras(5);
ok('5 horas se leen como 5, no como 1 ni como 9', B.horasDesde(hace5) === 5);
ok('el umbral de caido son 48 horas', B.HORAS_CAIDO === 48);
ok('49 horas ya pasa el umbral', B.horasDesde(haceHoras(49)) > B.HORAS_CAIDO);
ok('47 horas todavia no', B.horasDesde(haceHoras(47)) <= B.HORAS_CAIDO);

// ── numero(): lo que llega como texto y a veces vacio ─────────────
ok('convierte texto a numero', B.numero('10.47486') === 10.47486);
ok('convierte negativos', B.numero('-66.55705') === -66.55705);
ok('vacio da null, no 0', B.numero('') === null);
ok('null da null', B.numero(null) === null);
ok('texto no numerico da null', B.numero('abc') === null);
ok('el cero es un valor valido', B.numero('0') === 0);
ok('el cero como numero tambien', B.numero(0) === 0);

// ── GPS en Mi cuenta ─────────────────────────────────────────────
ok('sin pedidos: no hay pedido nuevo', B.hayPedidoNuevo([], 1000) === false);
ok('pedido anterior al último barrido: no cuenta', B.hayPedidoNuevo([{ id: 'CRED-1', pedidoMs: 900 }], 1000) === false);
ok('pedido posterior al último barrido: toca buscar', B.hayPedidoNuevo([{ id: 'CRED-1', pedidoMs: 900 }, { id: 'CRED-2', pedidoMs: 1500 }], 1000) === true);
ok('nunca hubo barrido: cualquier pedido cuenta', B.hayPedidoNuevo([{ id: 'CRED-1', pedidoMs: 5 }], 0) === true);
const INST = [
  { _id: 'G1', creditoId: 'CRED-523', lat: 10.1, lng: -66.1, ultimaSenal: '2026-09-14 10:00:00', pass: '123456', imei: '8665', linea: '4140000000' },
  { _id: 'G2', creditoId: 'CRED-600', lat: 10.2, lng: -66.2, ultimaSenal: '2026-09-14 09:00:00' },
  { _id: 'G3', creditoId: 'CRED-700', lat: 10.3, lng: -66.3, ultimaSenal: '2026-09-14 08:00:00' },
];
const PLAN = B.planFichas(['CRED-523', 'CRED-600', 'CRED-999'], INST,
  { G1: { lat: 10.5, lng: -66.5, ultimaSenal: '2026-09-14 12:00:00' } }, '2026-09-14T16:00:00.000Z', 'https://w.example');
const F523 = PLAN.sets.find(x => x.credId === 'CRED-523');
ok('la ficha toma la posición recién leída', !!F523 && F523.data.lat === 10.5 && F523.data.lng === -66.5 && F523.data.ultimaSenal === '2026-09-14 12:00:00');
ok('la ficha marca la hora de revisión y la dirección del botón', F523.data.revisado === '2026-09-14T16:00:00.000Z' && F523.data.workerUrl === 'https://w.example');
ok('la ficha NUNCA lleva la clave, el IMEI ni la línea', Object.keys(F523.data).sort().join() === 'credId,lat,lng,revisado,ultimaSenal,workerUrl');
ok('otro crédito con equipo y ficha: se pone al día con lo que ya se sabía', !!PLAN.sets.find(x => x.credId === 'CRED-600' && x.data.lat === 10.2));
ok('solo se borra la ficha del crédito que ya no tiene equipo', PLAN.deletes.length === 1 && PLAN.deletes[0] === 'CRED-999');
ok('crédito sin equipo instalado: se borra su ficha', PLAN.deletes.includes('CRED-999'));
ok('solo se tocan las fichas que existen (CRED-700 no tiene)', !PLAN.sets.some(x => x.credId === 'CRED-700'));
const SRC_BOT = require('fs').readFileSync(require('path').join(__dirname, '..', 'bot', 'gps-micodus.js'), 'utf8');
ok('el robot ACTUALIZA fichas (update): nunca revive una que el admin quitó', SRC_BOT.indexOf(".doc(x.credId).update(x.data)") > -1 && !/ubicacion_cliente'\)\.doc\([^)]*\)\.set\(/.test(SRC_BOT));
const PLAN2 = B.planFichas(['CRED-523'], INST, {}, 'T', '');
ok('si esta vez no se pudo leer la posición, queda la última conocida', PLAN2.sets[0].data.lat === 10.1 && PLAN2.sets[0].data.ultimaSenal === '2026-09-14 10:00:00');
ok('sin posición conocida: lat y lng nulos, no inventados', B.planFichas(['CRED-X'], [{ _id: 'GX', creditoId: 'CRED-X' }], {}, 'T', '').sets[0].data.lat === null);

// ── Una vez al día a las 8 am de Venezuela + el botón (Adam, 14-sep-2026) ──
const VE = (dia, h, m) => Date.UTC(2026, 8, dia, h + 4, m || 0);   // hora de Venezuela → ms
const dec = (ultimo, ahora, extra) => B.decidirBarrido(Object.assign({ ultimoMs: ultimo, ahoraMs: ahora }, extra || {}));
ok('las 8:00 am de Venezuela son las 12:00 UTC', B.HORA_BARRIDO_UTC === 12 && B.anclaDiaria(VE(15, 8, 1)) === VE(15, 8, 0));
ok('antes de las 8 el ancla es la de ayer', B.anclaDiaria(VE(15, 7, 59)) === VE(14, 8, 0));
ok('pasada la medianoche UTC (20:30 de Venezuela) sigue siendo la de hoy', B.anclaDiaria(VE(15, 20, 30)) === VE(15, 8, 0));
ok('barrido de ayer 8:02 → hoy 8:01 toca el del día', dec(VE(14, 8, 2), VE(15, 8, 1)).motivo === 'diario');
ok('botón ayer a las 20:00 → hoy 8:01 SÍ barre (la ventana de 20 h lo anulaba)', dec(VE(14, 20, 0), VE(15, 8, 1)).barrer === true);
ok('botón ayer a las 12:05 → hoy 8:01 barre', dec(VE(14, 12, 5), VE(15, 8, 1)).barrer === true);
ok('botón ayer a las 23:30 → hoy 8:01 barre', dec(VE(14, 23, 30), VE(15, 8, 1)).barrer === true);
ok('barrido de las 8:02 → el respaldo de las 10:01 no repite', dec(VE(15, 8, 2), VE(15, 10, 1)).motivo === 'nada');
ok('respaldo atrasado hasta las 13:00: tampoco repite', dec(VE(15, 8, 2), VE(15, 13, 0)).barrer === false);
ok('si el de las 8 no corrió, el respaldo de las 10 recupera el día', dec(VE(14, 8, 2), VE(15, 10, 1)).motivo === 'diario');
ok('un disparo suelto a las 3 am sin pedido no barre', dec(VE(14, 8, 2), VE(15, 3, 0)).barrer === false);
ok('botón hoy a las 7:30 → a las 8:01 igual toca el del día', dec(VE(15, 7, 30), VE(15, 8, 1)).barrer === true);
ok('botón hoy a las 9:00 → el respaldo de las 10 no repite', dec(VE(15, 9, 0), VE(15, 10, 1)).barrer === false);
ok('nunca hubo barrido: barre', dec(0, VE(15, 3, 0)).barrer === true);
ok('fechas dañadas: barre (mejor de más que de menos)', dec(NaN, VE(15, 3, 0)).barrer === true && B.decidirBarrido({ ultimoMs: VE(15, 8, 2) }).barrer === true);
ok('botón del módulo: barre aunque haya barrido hace 5 min', dec(VE(15, 8, 2), VE(15, 8, 7), { refrescoPedido: true }).motivo === 'app');
ok('botón de Mi cuenta: barre aunque haya barrido hace 5 min', dec(VE(15, 8, 2), VE(15, 8, 7), { pidioCliente: true }).motivo === 'cliente');
ok('barrido fallido: MiCODUS no contestó ninguna posición', B.barridoFallido({ errores: 3, ok: 0, sinCambio: 0 }) === true);
ok('si falla la mitad o más, tampoco cuenta como hecho', B.barridoFallido({ errores: 2, ok: 1, sinCambio: 0 }) === true && B.barridoFallido({ errores: 250, ok: 0, sinCambio: 250 }) === true);
ok('con la mayoría bien, sí cuenta', B.barridoFallido({ errores: 1, ok: 2, sinCambio: 0 }) === false && B.barridoFallido({ errores: 1, ok: 0, sinCambio: 2 }) === false);
ok('botón del módulo tocado MIENTRAS corría el barrido: la corrida que espera lo atiende', dec(VE(15, 8, 1), VE(15, 8, 3), { refrescoPedido: false, refrescoPedidoEnMs: VE(15, 8, 2) }).motivo === 'app');
ok('botón tocado antes de que empezara el último barrido: ya quedó atendido', dec(VE(15, 8, 1), VE(15, 9, 0), { refrescoPedido: false, refrescoPedidoEnMs: VE(15, 7, 59) }).barrer === false);
ok('sin errores no es fallido (aunque no haya posiciones nuevas)', B.barridoFallido({ errores: 0, ok: 0, sinCambio: 0 }) === false);
const FS8 = require('fs'), PATH8 = require('path');
const BOT8 = FS8.readFileSync(PATH8.join(__dirname, '..', 'bot', 'gps-micodus.js'), 'utf8');
const TOML8 = FS8.readFileSync(PATH8.join(__dirname, '..', 'bot', 'wrangler.toml'), 'utf8');
const YML8 = FS8.readFileSync(PATH8.join(__dirname, '..', '.github', 'workflows', 'gps-micodus.yml'), 'utf8');
ok('el Worker dispara una vez al día a las 8:00 am de Venezuela (12:00 UTC)', /crons\s*=\s*\["0 12 \* \* \*"\]/.test(TOML8));
ok('el respaldo de GitHub corre una vez al día, a las 10 am de Venezuela', /cron:\s*'0 14 \* \* \*'/.test(YML8) && !/\*\/6/.test(YML8));
ok('un barrido a la vez (el que llega espera, no se cancela)', /concurrency:\s*\n\s*group:\s*gps-micodus\s*\n\s*cancel-in-progress:\s*false/.test(YML8));
ok('ultimaSync guarda la hora de INICIO del barrido', /ultimaSync:\s*inicioBarrido/.test(BOT8));
ok('la bandera del módulo se apaga al terminar bien, no al empezar', /refrescoPedido:\s*false/.test(BOT8.slice(BOT8.indexOf('barridoFallido({ errores'))) && !/refrescoPedido:\s*false,\s*\n\s*ultimoIntento/.test(BOT8));
ok('si MiCODUS falla entero, sale antes de marcar el barrido y las fichas', BOT8.indexOf('process.exit(1)', BOT8.indexOf('barridoFallido({ errores')) < BOT8.indexOf('ultimaSync: inicioBarrido') && BOT8.indexOf('ultimaSync: inicioBarrido') < BOT8.indexOf("collection('ubicacion_cliente').get()"));

ok('las fichas de Mi cuenta llevan la hora de INICIO como revisado', /planFichas\([^;]*inicioBarrido/.test(BOT8));
ok('si falla el login de MiCODUS: se anota el error y sale en rojo', /No se pudo entrar a MiCODUS[\s\S]{0,120}process\.exit\(1\)/.test(BOT8));
ok('el robot mira la hora del botón del módulo', /refrescoPedidoEnMs:\s*cfg\.refrescoPedidoEn/.test(BOT8));
ok('en un barrido fallido se guardan las posiciones buenas antes de salir', /barridoFallido\(\{ errores, ok, sinCambio \}\)\) \{\s*\n\s*if \(ok\) await lote\.commit\(\);/.test(BOT8));

console.log('');
console.log(pass + ' pruebas OK, ' + fail + ' fallas');
process.exit(fail ? 1 : 0);
