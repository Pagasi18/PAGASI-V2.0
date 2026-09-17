// Carga en config de cada sede (concesionarios/{id}.anticipos[]) los anticipos que
// la oficina llevaba en su Excel de saldos: la apertura por sede y cada abono, con
// fecha, monto, metodo y nota. Idempotente: cada anticipo trae un id fijo y si ya
// esta en la sede no se vuelve a meter. Por defecto SOLO SIMULA (GUARDAR distinto
// de "true" no escribe nada) y muestra el saldo que quedaria con la regla del
// modulo (financiado = precio − inicial). SOLO_SEDE limita a una sede para probar.
// El plan llega en PLAN_B64 (JSON gzip+base64) para no dejarlo en el repo publico.
// El log es publico: el plan no trae nombres de clientes.
const { Firestore } = require('@google-cloud/firestore');
const zlib = require('zlib');

const GUARDAR = String(process.env.GUARDAR || '').trim() === 'true';
const SOLO_SEDE = String(process.env.SOLO_SEDE || '').trim();
const PLAN_B64 = String(process.env.PLAN_B64 || '').trim();

function financiadoDe(cr){
  if(!cr) return 0;
  const f = parseFloat(cr.fin);
  if(isFinite(f) && f >= 0) return f;
  const p = parseFloat(cr.precio)||0, i = parseFloat(cr.ini)||0;
  return Math.max(0, p - i);
}
const n2 = x => Math.round((Number(x)||0)*100)/100;

(async () => {
  if(!PLAN_B64){ console.log('RESULTADO ERROR: falta PLAN_B64'); process.exit(1); }
  let plan;
  try { plan = JSON.parse(zlib.gunzipSync(Buffer.from(PLAN_B64, 'base64')).toString('utf8')); }
  catch(e){ console.log('RESULTADO ERROR: PLAN_B64 no es JSON gzip+base64 (' + e.message + ')'); process.exit(1); }
  if(!Array.isArray(plan) || !plan.length){ console.log('RESULTADO ERROR: plan vacio'); process.exit(1); }
  for(const a of plan){
    if(!a || !a.sede || !a.id || !/^\d{4}-\d{2}-\d{2}$/.test(String(a.fecha||'')) || !isFinite(parseFloat(a.monto))){
      console.log('RESULTADO ERROR: entrada invalida en el plan: ' + JSON.stringify(a).slice(0,120)); process.exit(1);
    }
  }
  const db = new Firestore({ projectId: 'pagasi-v2' });
  const credSnap = await db.collection('creditos').get();
  const consumido = {};
  credSnap.forEach(d => { const c = d.data() || {}; if(c.eliminado || c.estado === 'cancelado' || !c.concesionarioId) return;
    consumido[c.concesionarioId] = n2((consumido[c.concesionarioId] || 0) + financiadoDe(c)); });
  const porSede = {};
  plan.forEach(a => { (porSede[a.sede] = porSede[a.sede] || []).push(a); });
  console.log((GUARDAR ? 'MODO: GUARDAR' : 'MODO: SIMULACION (no se escribe nada)') + (SOLO_SEDE ? ' · solo sede ' + SOLO_SEDE : '') + ' · plan: ' + plan.length + ' anticipos en ' + Object.keys(porSede).length + ' sedes');
  let nuevosTot = 0, yaTot = 0, escritas = 0;
  for(const sid of Object.keys(porSede)){
    if(SOLO_SEDE && sid !== SOLO_SEDE) continue;
    const ref = db.collection('concesionarios').doc(sid);
    const doc = await ref.get();
    if(!doc.exists){ console.log('SEDE ' + sid + ' NO EXISTE: se salta'); continue; }
    const c = doc.data() || {};
    const actuales = Array.isArray(c.anticipos) ? c.anticipos.slice() : [];
    const ids = new Set(actuales.map(a => a && a.id));
    const nuevos = porSede[sid].filter(a => !ids.has(a.id)).map(a => ({
      id: a.id, fecha: a.fecha, monto: n2(a.monto), metodo: a.metodo || 'Otro', ref: '', nota: String(a.nota || '').slice(0, 160),
      creadoPor: 'Robot cuadre Excel', creadoEn: new Date().toISOString() }));
    const ya = porSede[sid].length - nuevos.length;
    const enviadoAntes = n2(actuales.filter(a => a && !a.eliminado).reduce((s, a) => s + (parseFloat(a.monto)||0), 0));
    const enviadoDespues = n2(enviadoAntes + nuevos.reduce((s, a) => s + a.monto, 0));
    const cons = consumido[sid] || 0;
    console.log('SEDE ' + sid + ' · ' + (c.nombre || '') + ' · nuevos ' + nuevos.length + ' · ya estaban ' + ya
      + ' · enviado ' + enviadoAntes + ' -> ' + enviadoDespues + ' · consumido ' + cons + ' · saldo quedaria ' + n2(enviadoDespues - cons));
    nuevosTot += nuevos.length; yaTot += ya;
    if(GUARDAR && nuevos.length){
      await ref.update({ anticipos: actuales.concat(nuevos), updatedAt: new Date().toISOString() });
      escritas++;
    }
  }
  console.log('RESULTADO ' + (GUARDAR ? 'GUARDADO' : 'SIMULADO') + ' nuevos=' + nuevosTot + ' ya_estaban=' + yaTot + ' sedes_escritas=' + escritas);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
