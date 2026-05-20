const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(ROOT, 'assets', 'pagasi-app.js'), 'utf8');
const finSource = fs.readFileSync(path.join(ROOT, 'logic', 'financiero.js'), 'utf8');
const pagosSource = fs.readFileSync(path.join(ROOT, 'logic', 'pagos.js'), 'utf8');

const PLAN = {
  plazo: 12,
  factor: 1.935483870967742,
  inicial: 0.45,
  tasaMensual: 12.26,
  apy: 413.34,
  diasGracia: 5,
  moraPct: 5
};

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function nearly(actual, expected, tolerance = 0.01, label = '') {
  assert(
    Math.abs(actual - expected) <= tolerance,
    `${label || 'value'} expected ${expected}, got ${actual}`
  );
}

function calcMoto(precio, planOverride = null) {
  const plan = planOverride || PLAN;
  const precioNum = parseFloat(precio) || 0;
  const inicialPct = parseFloat(plan && plan.inicial) || 0;
  const factor = parseFloat(plan && plan.factor) || 0;
  const plazo = parseInt(plan && plan.plazo, 10) || 0;
  const ini = precioNum * inicialPct;
  const fin = precioNum - ini;
  const total = fin * factor;
  const cuotaM = plazo > 0 ? (total / plazo) : 0;
  const cuotaQ = cuotaM / 2;
  const totalPagado = ini + total;
  return { ini, fin, total, cuotaM, cuotaQ, totalPagado };
}

function pmtRate(periodRate, nper, pv) {
  periodRate = parseFloat(periodRate) || 0;
  nper = parseInt(nper, 10) || 0;
  pv = parseFloat(pv) || 0;
  if (nper <= 0 || pv <= 0) return 0;
  if (Math.abs(periodRate) < 1e-9) return pv / nper;
  return (pv * periodRate) / (1 - Math.pow(1 + periodRate, -nper));
}

function solveQuincenalRate(montoFinanciado, cuotaQ, totalCuotas) {
  const pv = parseFloat(montoFinanciado) || 0;
  const pmt = parseFloat(cuotaQ) || 0;
  const n = parseInt(totalCuotas, 10) || 0;
  if (pv <= 0 || pmt <= 0 || n <= 0) return 0;
  const ratio = (pmt * n) / pv;
  if (ratio <= 1.000001) return 0;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 80; i++) {
    const test = pmtRate(high, n, pv);
    if (test >= pmt) break;
    high *= 2;
  }
  for (let j = 0; j < 80; j++) {
    const mid = (low + high) / 2;
    const val = pmtRate(mid, n, pv);
    if (Math.abs(val - pmt) < 1e-7) return mid;
    if (val > pmt) high = mid;
    else low = mid;
  }
  return (low + high) / 2;
}

function calcCustomPlan(precioBaseReal, inicialReal, cuotaQ, plazoMeses) {
  const precio = parseFloat(precioBaseReal) || 0;
  const ini = parseFloat(inicialReal) || 0;
  const cuota = parseFloat(cuotaQ) || 0;
  const plazo = parseInt(plazoMeses, 10) || 0;
  const totalCuotas = Math.max(0, plazo * 2);
  const fin = Math.max(0, precio - ini);
  const total = cuota * totalCuotas;
  const totalPagado = ini + total;
  const factor = fin > 0 ? total / fin : 0;
  const inicialPct = precio > 0 ? ini / precio : 0;
  const tasaQ = solveQuincenalRate(fin, cuota, totalCuotas);
  const tasaMensual = tasaQ * 2 * 100;
  const apy = (Math.pow(1 + tasaQ, 24) - 1) * 100;
  return { precioBaseReal: precio, ini, fin, total, cuotaQ: cuota, cuotaM: cuota * 2, totalPagado, plazo, totalCuotas, factor, inicialPct, tasaQuincenal: tasaQ * 100, tasaMensual, apy };
}

function calcApyPlan(precioBaseReal, inicialPct, apyObjetivo, plazoMeses) {
  const precio = parseFloat(precioBaseReal) || 0;
  const iniPct = parseFloat(inicialPct) || 0;
  const apy = parseFloat(apyObjetivo) || 0;
  const plazo = parseInt(plazoMeses, 10) || 0;
  const totalCuotas = Math.max(0, plazo * 2);
  const ini = precio * iniPct;
  const fin = Math.max(0, precio - ini);
  const tasaQ = Math.pow(1 + apy / 100, 1 / 24) - 1;
  const cuotaQ = pmtRate(tasaQ, totalCuotas, fin);
  const total = cuotaQ * totalCuotas;
  const totalPagado = ini + total;
  const factor = fin > 0 ? total / fin : 0;
  const tasaMensual = tasaQ * 2 * 100;
  return { precioBaseReal: precio, ini, fin, total, cuotaQ, cuotaM: cuotaQ * 2, totalPagado, plazo, totalCuotas, factor, inicialPct: iniPct, tasaQuincenal: tasaQ * 100, tasaMensual, apy };
}

function applyPayments(credit, payments, descuentoLiquidacion = 0) {
  const cuotaVal = parseFloat(credit.cuotaQ || credit.cuota || 0);
  const totalCuotas = credit.totalCuotas || ((parseInt(credit.plazo, 10) || 0) * 2);
  const saldoPorCuota = Array.from({ length: totalCuotas }, () => cuotaVal);
  const historial = [];

  payments
    .filter((p) => !p.eliminado && p.estado === 'confirmado' && !p.esInicial && p.tipoOperacion !== 'inicial_credito')
    .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')) || String(a.id || '').localeCompare(String(b.id || '')))
    .forEach((p) => {
      let montoRestante = parseFloat(p.monto) || 0;
      for (let qi = 0; qi < totalCuotas && montoRestante > 0.001; qi++) {
        if (saldoPorCuota[qi] > 0.001) {
          const aplicar = round2(Math.min(montoRestante, saldoPorCuota[qi]));
          historial.push({ cuota: qi + 1, montoPagado: aplicar, fecha: p.fecha, pagoId: p.id, tipo: p.tipo || 'pago' });
          saldoPorCuota[qi] = round2(saldoPorCuota[qi] - aplicar);
          montoRestante = round2(montoRestante - aplicar);
        }
      }
    });

  let descRestante = round2(descuentoLiquidacion);
  for (let qi = 0; qi < totalCuotas && descRestante > 0.001; qi++) {
    if (saldoPorCuota[qi] > 0.001) {
      const aplicar = round2(Math.min(descRestante, saldoPorCuota[qi]));
      historial.push({ cuota: qi + 1, montoPagado: aplicar, tipo: 'descuento_liquidacion' });
      saldoPorCuota[qi] = round2(saldoPorCuota[qi] - aplicar);
      descRestante = round2(descRestante - aplicar);
    }
  }

  let cuotasPagadas = 0;
  for (let i = 0; i < totalCuotas; i++) {
    if (saldoPorCuota[i] <= 0.001) cuotasPagadas++;
    else break;
  }

  const saldoProxCuota = cuotasPagadas < totalCuotas ? saldoPorCuota[cuotasPagadas] : 0;
  const totalPagos = historial.reduce((a, h) => a + h.montoPagado, 0);
  const saldoPendiente = Math.max(0, round2((cuotaVal * totalCuotas) - totalPagos));
  return { historial, cuotasPagadas, saldoProxCuota, saldoPendiente };
}

function moraDias(credit, todayISO) {
  const hoy = new Date(`${todayISO}T00:00:00`);
  const cuotasPagadas = parseInt(credit.pagado || 0, 10) || 0;
  const totalCuotas = credit.totalCuotas || ((parseInt(credit.plazo, 10) || 0) * 2);
  if (cuotasPagadas >= totalCuotas && totalCuotas > 0) return { mora: 0, estado: 'completado' };
  const inicio = new Date(`${credit.fecha}T00:00:00`);
  const cuotaSiguiente = cuotasPagadas + 1;
  const fechaVence = new Date(inicio.getTime() + cuotaSiguiente * 15 * 24 * 60 * 60 * 1000);
  const diasAtraso = Math.floor((hoy - fechaVence) / (24 * 60 * 60 * 1000));
  const mora = diasAtraso > PLAN.diasGracia ? diasAtraso : 0;
  return { mora, estado: mora > 0 ? 'mora' : 'activo' };
}

function test(name, fn) {
  try {
    fn();
    console.log(`OK ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

test('formula global calcMoto', () => {
  const r = calcMoto(1000);
  nearly(r.ini, 450, 0.001, 'ini');
  nearly(r.fin, 550, 0.001, 'fin');
  nearly(r.total, 1064.516129, 0.001, 'total');
  nearly(r.cuotaQ, 44.3548387, 0.001, 'cuotaQ');
  nearly(r.totalPagado, 1514.516129, 0.001, 'totalPagado');
});

test('plan personalizado derives factor and rates', () => {
  const r = calcCustomPlan(1000, 400, 60, 10);
  nearly(r.fin, 600, 0.001, 'fin');
  nearly(r.total, 1200, 0.001, 'total');
  nearly(r.factor, 2, 0.001, 'factor');
  nearly(r.inicialPct, 0.4, 0.001, 'inicialPct');
  assert(r.tasaMensual > 0, 'tasaMensual should be positive');
  assert(r.apy > 0, 'apy should be positive');
});

test('APY plan reconstructs target APY', () => {
  const r = calcApyPlan(1000, 0.5, 120, 12);
  nearly(r.ini, 500, 0.001, 'ini');
  nearly(r.fin, 500, 0.001, 'fin');
  nearly(r.apy, 120, 0.001, 'apy');
  assert(r.cuotaQ > 0, 'cuotaQ should be positive');
});

test('partial payment keeps next cuota balance', () => {
  const credit = { cuotaQ: 50, plazo: 2, totalCuotas: 4 };
  const r = applyPayments(credit, [{ id: 'P1', fecha: '2026-01-01', monto: 25, estado: 'confirmado' }]);
  assert.strictEqual(r.cuotasPagadas, 0);
  nearly(r.saldoProxCuota, 25, 0.001, 'saldoProxCuota');
  nearly(r.saldoPendiente, 175, 0.001, 'saldoPendiente');
});

test('double payment completes two cuotas', () => {
  const credit = { cuotaQ: 50, plazo: 2, totalCuotas: 4 };
  const r = applyPayments(credit, [{ id: 'P1', fecha: '2026-01-01', monto: 100, estado: 'confirmado' }]);
  assert.strictEqual(r.cuotasPagadas, 2);
  nearly(r.saldoProxCuota, 50, 0.001, 'saldoProxCuota');
  nearly(r.saldoPendiente, 100, 0.001, 'saldoPendiente');
});

test('overpayment is capped at total cuotas in amortization', () => {
  const credit = { cuotaQ: 50, plazo: 2, totalCuotas: 4 };
  const r = applyPayments(credit, [{ id: 'P1', fecha: '2026-01-01', monto: 260, estado: 'confirmado' }]);
  assert.strictEqual(r.cuotasPagadas, 4);
  nearly(r.saldoProxCuota, 0, 0.001, 'saldoProxCuota');
  nearly(r.saldoPendiente, 0, 0.001, 'saldoPendiente');
});

test('deleted payment is ignored', () => {
  const credit = { cuotaQ: 50, plazo: 2, totalCuotas: 4 };
  const r = applyPayments(credit, [{ id: 'P1', fecha: '2026-01-01', monto: 50, estado: 'confirmado', eliminado: true }]);
  assert.strictEqual(r.cuotasPagadas, 0);
  nearly(r.saldoPendiente, 200, 0.001, 'saldoPendiente');
});

test('liquidation discount closes remaining balance when combined with payment', () => {
  const credit = { cuotaQ: 50, plazo: 2, totalCuotas: 4 };
  const r = applyPayments(credit, [{ id: 'P-LIQ', fecha: '2026-01-01', monto: 150, estado: 'confirmado', tipo: 'liquidacion' }], 50);
  assert.strictEqual(r.cuotasPagadas, 4);
  nearly(r.saldoPendiente, 0, 0.001, 'saldoPendiente');
});

test('mora respects grace days', () => {
  const credit = { fecha: '2026-01-01', pagado: 0, plazo: 2, totalCuotas: 4 };
  assert.deepStrictEqual(moraDias(credit, '2026-01-20'), { mora: 0, estado: 'activo' });
  assert.deepStrictEqual(moraDias(credit, '2026-01-22'), { mora: 6, estado: 'mora' });
});

test('Firebase wrapper has expected collections and operations', () => {
  const expectedCollections = [
    'motos', 'clientes', 'creditos', 'pagos', 'egresos', 'movimientos',
    'cuentasPendientes', 'facturas', 'concesionarios', 'usuarios',
    'invitaciones', 'cuentas', 'tareas'
  ];
  for (const name of expectedCollections) {
    assert(appSource.includes(`collection('${name}')`) || appSource.includes(`collection("${name}")`) || fs.readFileSync(path.join(ROOT, 'logic', 'usuarios.js'), 'utf8').includes(`collection('${name}')`), `missing collection ${name}`);
  }
  assert(appSource.includes('firebase.initializeApp(FIREBASE_CONFIG)'), 'firebase init missing');
  assert(appSource.includes('db = firebase.firestore()'), 'firestore init missing');
  assert(appSource.includes('auth = firebase.auth()'), 'auth init missing');
  assert(appSource.includes('storage = firebase.storage()'), 'storage init missing');
});

test('source still contains critical app formulas', () => {
  for (const token of [
    'function calcMoto',
    'function calcCustomPlan',
    'function calcApyPlan',
    'function getWzPlanConfig',
    'function recalcularCreditoDesdePagos',
    'function calcularMoraAuto'
  ]) {
    assert(finSource.includes(token) || pagosSource.includes(token), `missing ${token}`);
  }
});

console.log('\nFinancial audit tests passed.');
