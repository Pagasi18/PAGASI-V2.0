// SOLO LECTURA. Que hay dentro de los egresos de un dia (o de un rango): cuanto
// suma cada categoria y cada origen, y para los egresos automaticos de compra de
// moto, si el monto se parece al PRECIO de la moto (o sea, incluiria la inicial
// que paga el cliente en la tienda) o a lo FINANCIADO (lo que Pagasi manda).
// El log de GitHub es publico: sin nombres de clientes ni de empleados.
const { Firestore } = require('@google-cloud/firestore');

const DESDE = String(process.env.DESDE || '').trim();
const HASTA = String(process.env.HASTA || DESDE).trim();

function dia(v) { if (!v) return ''; if (typeof v.toDate === 'function') return v.toDate().toISOString().slice(0, 10); return String(v).slice(0, 10); }
const n2 = x => Math.round((parseFloat(x) || 0) * 100) / 100;
const money = x => '$' + n2(x).toFixed(2);
function financiado(c) { const f = parseFloat(c.fin); if (isFinite(f) && f >= 0) return f; return Math.max(0, (parseFloat(c.precio) || 0) - (parseFloat(c.ini) || 0)); }

(async () => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(DESDE)) { console.log('RESULTADO ERROR: DESDE debe ser AAAA-MM-DD'); process.exit(1); }
  const db = new Firestore({ projectId: 'pagasi-v2' });
  const [egSnap, motoSnap, credSnap] = await Promise.all([
    db.collection('egresos').get(), db.collection('motos').get(), db.collection('creditos').get(),
  ]);
  const motos = {}; motoSnap.forEach(d => motos[d.id] = d.data() || {});
  const credPorMoto = {};
  credSnap.forEach(d => { const c = d.data() || {}; if (c.motoId && !c.eliminado && c.estado !== 'cancelado') credPorMoto[String(c.motoId)] = Object.assign({ id: d.id }, c); });

  const enRango = [];
  egSnap.forEach(d => { const e = d.data() || {}; const f = dia(e.fecha); if (!e.eliminado && f >= DESDE && f <= HASTA) enRango.push(Object.assign({ _id: d.id, _f: f }, e)); });
  enRango.sort((a, b) => (a._f + String(a.monto)).localeCompare(b._f + String(b.monto)));

  const total = enRango.reduce((s, e) => s + n2(e.monto), 0);
  console.log('EGRESOS del ' + DESDE + (HASTA !== DESDE ? ' al ' + HASTA : '') + ': ' + enRango.length + ' · total ' + money(total));

  const por = (campo) => {
    const m = {};
    enRango.forEach(e => { const k = String(e[campo] || '(sin ' + campo + ')'); m[k] = m[k] || { n: 0, s: 0 }; m[k].n++; m[k].s += n2(e.monto); });
    return Object.entries(m).sort((a, b) => b[1].s - a[1].s);
  };
  console.log('POR CATEGORIA:'); por('categoria').forEach(([k, v]) => console.log('  ' + k + ' · ' + v.n + ' · ' + money(v.s)));
  console.log('POR ORIGEN:');    por('origenAuto').forEach(([k, v]) => console.log('  ' + k + ' · ' + v.n + ' · ' + money(v.s)));

  console.log('DETALLE (los de compra de moto se comparan con la moto y su credito):');
  let sumaPrecio = 0, sumaFin = 0, sumaIni = 0, conCredito = 0;
  enRango.forEach(e => {
    let extra = '';
    if (e.motoIdRef != null) {
      const m = motos[String(e.motoIdRef)] || {};
      const c = credPorMoto[String(e.motoIdRef)];
      const precio = n2(m.precio);
      extra = ' · moto #' + e.motoIdRef + ' precio ' + money(precio);
      if (c) {
        const ini = n2(c.ini), fin = n2(financiado(c));
        conCredito++; sumaPrecio += precio; sumaFin += fin; sumaIni += ini;
        const cerca = (a, b) => Math.abs(a - b) <= 1;
        extra += ' · credito ' + c.id + ' inicial ' + money(ini) + ' financiado ' + money(fin)
          + ' -> el egreso se parece a: ' + (cerca(n2(e.monto), precio) ? 'EL PRECIO COMPLETO (incluye la inicial)' : cerca(n2(e.monto), fin) ? 'lo financiado' : 'ninguno de los dos');
      } else { extra += ' · sin credito (moto en inventario)'; }
    }
    console.log('  ' + e._f + ' · ' + money(e.monto) + ' · ' + (e.categoria || '—') + ' · ' + (e.origenAuto || 'manual') + ' · forma ' + (e.forma || '—') + extra);
  });
  if (conCredito) console.log('SUMA de los que tienen credito: precio ' + money(sumaPrecio) + ' · inicial ' + money(sumaIni) + ' · financiado ' + money(sumaFin));
  console.log('RESULTADO OK egresos=' + enRango.length + ' total=' + n2(total));
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
