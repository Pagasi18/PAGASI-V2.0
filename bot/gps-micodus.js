/* Posiciones de los GPS — MiCODUS → Firestore.

   El navegador no puede consultar a MiCODUS desde pagasi.io (CORS), asi que
   este job es la unica forma de que el mapa se actualice solo.

   Solo consulta la posicion de los equipos que en PAGASI estan marcados como
   instalados: son los unicos que estan en una moto. Preguntar por los 500
   seria 500 llamadas para nada.

   Credenciales: MICODUS_USER y MICODUS_PASS, de los secretos del repo. Debe
   ser una SUBCUENTA DE SOLO LECTURA, no la cuenta principal — MiCODUS manda
   la clave en la query string de la URL, donde queda en logs y proxies.

   Uso local sin escribir nada:  node gps-micodus.js --dry                */

const DRY  = process.argv.includes('--dry');
const BASE = 'https://www.micodus.net';
const USER = process.env.MICODUS_USER || '';
const PASS = process.env.MICODUS_PASS || '';

// Cuantas horas sin reportar antes de considerarlo caido
const HORAS_CAIDO = 48;

// Hora de Venezuela del barrido diario. Temprano, para que cobranza arranque
// el dia con las posiciones frescas.
const HORA_BARRIDO = 6;

// ── Sesion ────────────────────────────────────────────────────────
// Su login es un GET con las credenciales en la URL. Guardamos las cookies
// a mano porque fetch de Node no las persiste entre llamadas.
let COOKIES = {};

function guardarCookies(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie()
            : (res.headers.raw ? res.headers.raw()['set-cookie'] || [] : []);
  for (const c of raw) {
    const [par] = c.split(';');
    const i = par.indexOf('=');
    if (i > 0) COOKIES[par.slice(0, i).trim()] = par.slice(i + 1).trim();
  }
}

function cabeceraCookie() {
  return Object.entries(COOKIES).map(([k, v]) => k + '=' + v).join('; ');
}

async function pedir(url, opts = {}) {
  const res = await fetch(BASE + url, {
    ...opts,
    redirect: 'manual',
    headers: { 'Cookie': cabeceraCookie(), ...(opts.headers || {}) },
  });
  guardarCookies(res);
  return res;
}

async function entrar() {
  if (!USER || !PASS) throw new Error('faltan MICODUS_USER / MICODUS_PASS');

  // Su login es un formulario ASP.NET WebForms: hay que traer __VIEWSTATE y
  // __EVENTVALIDATION de la pagina y devolverlos en el POST, o el servidor lo
  // rechaza. UrlLoginGet.aspx, que parecia el camino corto, es solo el enlace
  // de la cuenta demo.
  const pag = await pedir('/Login2.aspx?v=2');
  const html = await pag.text();

  const oculto = (n) => {
    const re = new RegExp('name="' + n + '"[^>]*value="([^"]*)"');
    const re2 = new RegExp('value="([^"]*)"[^>]*name="' + n + '"');
    const m = html.match(re) || html.match(re2);
    return m ? m[1] : '';
  };

  const form = new URLSearchParams({
    __VIEWSTATE:          oculto('__VIEWSTATE'),
    __VIEWSTATEGENERATOR: oculto('__VIEWSTATEGENERATOR'),
    __EVENTVALIDATION:    oculto('__EVENTVALIDATION'),
    // 0 = entrar por cuenta; 1 es por numero de ID, que es lo que trae la
    // pagina por defecto. Mandar 1 hace que ignore usuario y clave.
    LType:                '0',
    hidGMT:               '0',
    hidLanguage:          'en-us',
    hidYiwenGUID2:        oculto('hidYiwenGUID2'),
    txtUserName:          USER,
    txtAccountPassword:   PASS,
    txtImeiNo:            '',
    txtImeiPassword:      '',
    btnLogin:             'Login',
  });

  if (!form.get('__VIEWSTATE')) throw new Error('no se pudo leer el formulario de login');

  const res = await pedir('/Login2.aspx?v=2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': BASE + '/Login2.aspx?v=2',
    },
    body: form.toString(),
  });

  // Un login bueno responde con redireccion; uno malo vuelve a pintar el
  // formulario con HTTP 200.
  if (res.status >= 300 && res.status < 400) {
    const destino = res.headers.get('location');
    if (destino) await pedir(destino.startsWith('http') ? destino.replace(BASE, '') : destino);
  }

  // Comprobar de verdad: con la clave mala MiCODUS devuelve HTTP 200 y el job
  // seguiria "sin errores" sin escribir nada, que es la peor forma de fallar.
  const uid = await miUserID();
  if (!uid) throw new Error('no se pudo iniciar sesion en MiCODUS (revisa usuario y clave)');
  return uid;
}

// ── Sus respuestas ────────────────────────────────────────────────
// Vienen envueltas en {"d": "..."} y lo de adentro es JavaScript relajado,
// con las claves sin comillas. JSON.parse directo falla.
function abrir(d) {
  if (!d || d === '' || d === '{}') return null;
  return JSON.parse(d.replace(/([{,])\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":'));
}

async function llamar(metodo, cuerpo) {
  const res = await pedir('/Ajax/' + metodo, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  if (!res.ok) throw new Error(metodo + ' HTTP ' + res.status);
  const j = await res.json();
  return abrir(j.d);
}

async function listarEquipos(userID) {
  const r = await llamar('DevicesAjax.asmx/GetDevices', {
    UserID: userID, PageNo: 1, PageCount: 1000, SN: '', TimeZones: '', ExpDays: 0,
  });
  return (r && r.devices) || [];
}

// TimeZone 0 para que las marcas vengan en UTC, que es como las guardamos.
async function posicionDe(deviceID) {
  return llamar('DevicesAjax.asmx/GetTracking', { DeviceID: deviceID, TimeZone: '0' });
}

// El UserID de la cuenta con la que entramos. Antes salia de GetLowerUsers2,
// que lista SUBCUENTAS: una cuenta End User no tiene, asi que devolvia vacio y
// el job se quedaba sin saber a quien preguntarle. La plataforma deja el id en
// un campo oculto de su propia pagina, y eso funciona para los dos tipos.
async function miUserID() {
  if (process.env.MICODUS_USERID) return Number(process.env.MICODUS_USERID);
  // Monitor.aspx existe para los dos tipos de cuenta; Distributor.aspx no.
  for (const pag of ['/Monitor.aspx', '/Distributor.aspx', '/Main.aspx']) {
    try {
      const r = await pedir(pag);
      if (r.status >= 300 && r.status < 400) continue;   // rebote al login
      const html = await r.text();
      const m = html.match(/id="hidUserID"[^>]*value="(\d+)"/)
             || html.match(/name="hidUserID"[^>]*value="(\d+)"/)
             || html.match(/hidUserID"?\s*value="(\d+)"/);
      if (m && Number(m[1]) > 0) return Number(m[1]);
    } catch (e) { /* siguiente */ }
  }
  // Ultimo recurso: si es distribuidor, GetLowerUsers2 devuelve su propio id
  try {
    const r = await llamar('UsersAjax.asmx/GetLowerUsers2',
      { UserID: 0, PageNo: 1, PageCount: 1, UserType: -1, IsChildUser: false, Key: '' });
    if (r && r.userID) return Number(r.userID);
  } catch (e) { /* nada */ }
  return 0;
}

function numero(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function horasDesde(utc) {
  if (!utc) return null;
  const d = new Date(String(utc).replace(' ', 'T') + 'Z');
  return isNaN(d) ? null : Math.max(0, Math.round((Date.now() - d.getTime()) / 3600000));
}

// Exportado para las pruebas; el job solo corre si se invoca directo.
module.exports = { abrir, horasDesde, numero, HORAS_CAIDO };

// ── Principal ─────────────────────────────────────────────────────
if (require.main !== module) return;

(async () => {
  let db = null, instalados = [];

  if (!DRY) {
    const { Firestore } = require('@google-cloud/firestore');
    db = new Firestore({ projectId: 'pagasi-v2' });

    // El job corre seguido pero casi siempre no hace nada: solo lee un
    // documento para ver si toca. Trabaja cuando alguien pidio refresco desde
    // el app, o una vez al dia a la hora del barrido.
    const cfgRef = db.collection('config').doc('gps');
    const cfg = (await cfgRef.get()).data() || {};
    const hora = Number(new Date().toLocaleString('en-US',
      { timeZone: 'America/Caracas', hour: '2-digit', hour12: false }));
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Caracas' });

    const pidieron = !!cfg.refrescoPedido;
    const tocaBarrido = hora === HORA_BARRIDO && cfg.ultimoBarrido !== hoy;

    if (!pidieron && !tocaBarrido) {
      console.log('Nada que hacer (sin refresco pedido, y el barrido de hoy ya se hizo)');
      return;
    }
    console.log(pidieron ? 'Refresco pedido desde el app' : 'Barrido diario');

    // Se limpia la bandera de una: si el job falla mas adelante, el proximo
    // barrido igual lo cubre, y asi un boton mal apretado no deja el job
    // trabajando en cada corrida para siempre.
    await cfgRef.set({
      refrescoPedido: false,
      ultimoIntento: new Date().toISOString(),
      ...(tocaBarrido ? { ultimoBarrido: hoy } : {}),
    }, { merge: true });
    // Se piden SOLO los instalados. Leer la coleccion entera costaba 500
    // lecturas por corrida —36.000 al dia— para vigilar dos motos.
    const snap = await db.collection('gps').where('estado', '==', 'instalado').get();
    instalados = snap.docs
      .map(d => ({ _id: d.id, ...d.data() }))
      .filter(g => !g.eliminado && g.idGps);
    if (!instalados.length) {
      console.log('No hay equipos instalados en PAGASI. Nada que consultar.');
      return;
    }
  }

  let userID = 0;
  try {
    userID = await entrar();
  } catch (e) {
    // Transitorio o clave mala: no reventar el workflow, el proximo cron reintenta.
    console.log('WARN ' + e.message);
    process.exit(0);
  }
  console.log('MiCODUS: entramos como UserID ' + userID);

  const equipos = await listarEquipos(userID);
  console.log('MiCODUS: ' + equipos.length + ' equipos en la cuenta');
  if (!equipos.length) { console.log('WARN la cuenta no devolvio equipos'); process.exit(0); }

  const porSerial = {};
  equipos.forEach(e => { if (e.sn) porSerial[String(e.sn)] = e; });

  if (DRY) {
    const conPlaca = equipos.filter(e => e.carNum);
    console.log('(dry-run) ' + conPlaca.length + ' con placa asignada');
    for (const e of conPlaca.slice(0, 5)) {
      const p = await posicionDe(e.id);
      console.log('  ' + e.sn + ' ' + (e.carNum || '') + ' → '
        + (p ? p.latitude + ', ' + p.longitude + '  ' + p.deviceUtcDate
             + '  bat ' + p.battery + '%  ' + p.status
             : 'sin posicion'));
    }
    return;
  }

  let ok = 0, sinPos = 0, noEstan = 0, caidos = 0, sinCambio = 0;
  const lote = db.batch();

  for (const g of instalados) {
    const eq = porSerial[String(g.idGps)];
    if (!eq) { noEstan++; console.log('  ' + g.idGps + ' no esta en la cuenta de MiCODUS'); continue; }

    let p = null;
    try { p = await posicionDe(eq.id); }
    catch (e) { console.log('  ' + g.idGps + ' error: ' + e.message); continue; }
    if (!p) { sinPos++; continue; }

    const lat = numero(p.latitude), lng = numero(p.longitude);
    if (lat === null || lng === null || (lat === 0 && lng === 0)) { sinPos++; continue; }

    const horas = horasDesde(p.deviceUtcDate);
    const caido = horas !== null && horas > HORAS_CAIDO;
    if (caido) caidos++;

    // Una moto estacionada manda la misma posicion cada vez. Reescribirla es
    // pagar por no cambiar nada: la mayoria de las motos estan quietas la
    // mayor parte del dia.
    const igual = g.ultimaSenal === (p.deviceUtcDate || '')
      && Math.abs((g.lat || 0) - lat) < 0.00002
      && Math.abs((g.lng || 0) - lng) < 0.00002;
    if (igual) { sinCambio++; continue; }

    lote.set(db.collection('gps').doc(g._id), {
      lat, lng,
      ultimaSenal:  p.deviceUtcDate || '',
      bateria:      numero(p.battery),
      voltaje:      p.dy || '',
      acc:          numero(p.acc),
      velocidad:    numero(p.speed),
      rumbo:        numero(p.course),
      dataType:     numero(p.dataType),
      satelites:    numero(p.satellite),
      senal:        numero(p.signal),
      odometro:     numero(p.distance),
      // La placa la manda MiCODUS y sirve para cotejar contra el credito.
      placaMicodus: eq.carNum || '',
      estadoMicodus: caido ? 'SIN SEÑAL RECIENTE' : (p.status || 'ONLINE / OK'),
      sincronizadoEn: new Date().toISOString(),
    }, { merge: true });
    ok++;
  }

  if (ok) await lote.commit();
  await db.collection('config').doc('gps').set({
    ultimaSync: new Date().toISOString(),
    ultimaSyncEquipos: ok,
    ultimaSyncSinCambio: sinCambio,
  }, { merge: true });
  console.log('Actualizados ' + ok + ' equipos'
    + (sinCambio ? ' · ' + sinCambio + ' sin moverse (no se reescriben)' : '')
    + (sinPos   ? ' · ' + sinPos   + ' sin posicion' : '')
    + (noEstan  ? ' · ' + noEstan  + ' no estan en MiCODUS' : '')
    + (caidos   ? ' · ' + caidos   + ' sin señal hace mas de ' + HORAS_CAIDO + 'h' : ''));
})().catch(e => { console.error('ERROR', e); process.exit(1); });
