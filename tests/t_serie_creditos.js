// Cada compañía tiene su propia serie de créditos: PAGASI 18 lleva CRED-001 desde
// siempre y PAGASI 26 arranca la suya con otra letra (Adam, 22-sep-2026). El prefijo
// vive en UN solo sitio (CRED_PREFIJO, arriba de assets/pagasi-app.js) y el resto del
// sistema lo lee de ahí, para que nadie tenga que buscar "CRED-" por los archivos.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (l, v) => { if (v) { pass++; console.log('OK   ' + l); } else { fail++; console.log('FALLA ' + l); } };
const app = fs.readFileSync(path.join(ROOT, 'assets', 'pagasi-app.js'), 'utf8');

function conPrefijo(prefijo, creds) {
  const G = { console:{log(){},warn(){}}, Math, String, Number, parseInt, parseFloat, isNaN, RegExp, Array, Object, JSON, Date,
    S: { creds: creds || [] }, window: {}, db: null };
  G.window = G; vm.createContext(G);
  // el bloque del prefijo y las dos funciones que numeran
  vm.runInContext(app.slice(app.indexOf('var CRED_PREFIJO'), app.indexOf('// ══════════════════════════════════════════════════════════════════\n// LA MEMORIA')), G);
  vm.runInContext(app.slice(app.indexOf('function nextCredId()'), app.indexOf('// ════════════════════════════════════════════════════════════════════\n// RESERVA ATOMICA')), G);
  if (prefijo) G.CRED_PREFIJO = prefijo;
  return G;
}

// ── PAGASI 18: lo de siempre, sin tocar ───────────────────────────────────────
let G = conPrefijo(null, []);
ok('18. sin configurar nada, el prefijo sigue siendo CRED', G.credPrefijo() === 'CRED');
ok('18. el primer crédito es CRED-001', G.nextCredId() === 'CRED-001');
G = conPrefijo(null, [{ id: 'CRED-001' }, { id: 'CRED-047' }]);
ok('18. sigue por el más alto: CRED-048', G.nextCredId() === 'CRED-048');
ok('18. tres cifras, para que ordenen bien', G.credNum(7) === 'CRED-007');
ok('18. y no se recorta cuando pasa de 999', G.credNum(1042) === 'CRED-1042');

// ── PAGASI 26: su propia serie ────────────────────────────────────────────────
G = conPrefijo('M', []);
ok('26. con la serie M, el primer crédito es M-001', G.nextCredId() === 'M-001');
G = conPrefijo('M', [{ id: 'M-001' }, { id: 'M-002' }]);
ok('26. y sigue M-003', G.nextCredId() === 'M-003');

// ── Que una serie no lea los números de la otra ───────────────────────────────
G = conPrefijo('M', [{ id: 'CRED-580' }]);
ok('26. un CRED-580 heredado NO arrastra la serie M al 581', G.nextCredId() === 'M-001');
G = conPrefijo(null, [{ id: 'M-900' }]);
ok('18. y al revés tampoco', G.nextCredId() === 'CRED-001');

// ── El prefijo está en un solo sitio ──────────────────────────────────────────
ok('el prefijo se declara una sola vez', (app.match(/var CRED_PREFIJO/g) || []).length === 1);
ok('las funciones que numeran ya no llevan "CRED-" escrito a mano',
  !/return 'CRED-' \+ String/.test(app) && !/match\(\/CRED-\\\(d\+\)\//.test(app));
const gps = fs.readFileSync(path.join(ROOT, 'logic', 'gps.js'), 'utf8');
ok('el importador del Excel de GPS también usa el prefijo de la compañía',
  /credPrefijo\(\)/.test(gps) && /_pre \+ '-'/.test(gps));
ok('...y si no puede leerlo, se queda con CRED en vez de inventar uno',
  /var _pre = 'CRED';/.test(gps) && /typeof _p === 'string' && _p/.test(gps));

console.log(''); console.log(pass + ' pruebas OK, ' + fail + ' fallas');
if (fail) process.exitCode = 1;
