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

  // El formulario trae un GUID que hay que devolver al iniciar sesion.
  const login = await pedir('/Login2.aspx?v=2');
  const html = await login.text();
  const m = html.match(/id="hidYiwenGUID2"[^>]*value="([^"]*)"/)
         || html.match(/name="hidYiwenGUID2"[^>]*value="([^"]*)"/);
  const guid = m ? m[1] : '';

  const url = '/UrlLoginGet.aspx?loginType=0'
    + '&txtUserName=' + encodeURIComponent(USER)
    + '&txtAccountPassword=' + encodeURIComponent(PASS)
    + '&hidYiwenGUID2=' + encodeURIComponent(guid);
  await pedir(url);

  // Comprobar de verdad: si la clave esta mal, MiCODUS devuelve la pagina de
  // login con HTTP 200 y el job seguiria "sin errores" escribiendo nada.
  const prueba = await pedir('/Ajax/UsersAjax.asmx/GetOnlineCount', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const txt = await prueba.text();
  if (!prueba.ok || /login|iniciar sesion/i.test(txt.slice(0, 300))) {
    throw new Error('no se pudo iniciar sesion en MiCODUS (revisa usuario y clave)');
  }
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
    const snap = await db.collection('gps').get();
    instalados = snap.docs
      .map(d => ({ _id: d.id, ...d.data() }))
      .filter(g => !g.eliminado && g.estado === 'instalado' && g.idGps);
    if (!instalados.length) {
      console.log('No hay equipos instalados en PAGASI. Nada que consultar.');
      return;
    }
  }

  try {
    await entrar();
  } catch (e) {
    // Transitorio o clave mala: no reventar el workflow, el proximo cron reintenta.
    console.log('WARN ' + e.message);
    process.exit(0);
  }

  const cuenta = await llamar('UsersAjax.asmx/GetLowerUsers2', { UserID: 0, PageNo: 1, PageCount: 1 });
  const userID = (cuenta && cuenta.userID) || Number(process.env.MICODUS_USERID || 0);

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

  let ok = 0, sinPos = 0, noEstan = 0, caidos = 0;
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

  await lote.commit();
  console.log('Actualizados ' + ok + ' equipos'
    + (sinPos   ? ' · ' + sinPos   + ' sin posicion' : '')
    + (noEstan  ? ' · ' + noEstan  + ' no estan en MiCODUS' : '')
    + (caidos   ? ' · ' + caidos   + ' sin señal hace mas de ' + HORAS_CAIDO + 'h' : ''));
})().catch(e => { console.error('ERROR', e); process.exit(1); });
