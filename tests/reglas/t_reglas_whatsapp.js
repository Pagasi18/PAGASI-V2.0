// Reglas de la cobranza por WhatsApp (18-oct-2026), contra el EMULADOR oficial.
// Las conversaciones las escribe el servidor; desde el navegador quien tiene el modulo
// 'whatsapp' las lee y solo cambia lo de atenderlas. Los mensajes no se escriben desde el
// navegador (salen por el endpoint /equipo). config/asistente lo edita solo administracion.
const fs = require('fs'), path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, addDoc } = require('firebase/firestore');

let pass = 0, fail = 0;
async function prueba(nombre, promesa) {
  try { await promesa; pass++; console.log('OK    ' + nombre); }
  catch (e) { fail++; console.log('FALLA ' + nombre + '\n        → ' + String(e && e.message || e).split('\n')[0]); }
}

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-pagasi',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'usuarios/admin1'), { rol: 'Administrador', nombre: 'Admin' });
    await setDoc(doc(db, 'usuarios/cob1'), { rol: 'Cobrador', nombre: 'Cobradora', email: 'cob1@x.com', permisos: ['dash', 'whatsapp', 'pagos'] });
    await setDoc(doc(db, 'usuarios/emp1'), { rol: 'Empleado', nombre: 'Empleada', email: 'emp1@x.com', permisos: ['dash', 'clientes'] });
    await setDoc(doc(db, 'usuarios/vc1'), { rol: 'Vendedor Concesionario', nombre: 'Vendedor', email: 'vc1@x.com', permisos: ['whatsapp'], concesionarios: ['C-EK'] });
    await setDoc(doc(db, 'conversaciones/wa:+584141234567'), { canal: 'whatsapp', telE164: '+584141234567', nombre: 'María', clienteId: 'C1', modo: 'bot', noLeidos: 2, atencion: 'queja', actualizado: '2026-10-18T10:00:00.000Z' });
    await setDoc(doc(db, 'conversaciones/wa:+584141234567/mensajes/wamid.1'), { autor: 'cliente', texto: 'hola', hora: '2026-10-18T10:00:00.000Z' });
    await setDoc(doc(db, 'config/asistente'), { instrucciones: 'x', datosPago: 'Pago Móvil' });
    await setDoc(doc(db, 'webhooks_meta/a1'), { crudo: '{}' });
    await setDoc(doc(db, 'recordatorios/26_M-1_2_hoy'), { cred: 'M-1', estado: 'enviado' });
    await setDoc(doc(db, 'recordatorios_corridas/r1'), { hoy: '2026-10-18' });
  });
  const ses = (uid, email) => env.authenticatedContext(uid, { email, firebase: { sign_in_provider: 'password' } }).firestore();
  const admin = ses('admin1', 'a@x.com'), cob = ses('cob1', 'cob1@x.com'), emp = ses('emp1', 'emp1@x.com'), vc = ses('vc1', 'vc1@x.com');
  const nadie = env.unauthenticatedContext().firestore();
  const CONV = 'conversaciones/wa:+584141234567';

  // ── Quien tiene el modulo ──
  await prueba('la cobradora con el módulo lee las conversaciones', assertSucceeds(getDoc(doc(cob, CONV))));
  await prueba('...y las lista', assertSucceeds(getDocs(collection(cob, 'conversaciones'))));
  await prueba('...y lee los mensajes', assertSucceeds(getDocs(collection(cob, CONV + '/mensajes'))));
  await prueba('...la toma (modo humano, atendida por ella, sin pendiente)', assertSucceeds(updateDoc(doc(cob, CONV), { modo: 'humano', atendidoPor: 'Cobradora', atencion: '', noLeidos: 0, actualizado: '2026-10-18T11:00:00.000Z' })));
  await prueba('...la devuelve al asistente', assertSucceeds(updateDoc(doc(cob, CONV), { modo: 'bot', atendidoPor: '', actualizado: '2026-10-18T11:01:00.000Z' })));
  await prueba('...y guarda el borrador de la promesa', assertSucceeds(updateDoc(doc(cob, CONV), { borrador: { tipo: 'promesa', fecha: '2026-10-24' } })));
  await prueba('el administrador también lee y atiende', assertSucceeds(updateDoc(doc(admin, CONV), { atencion: '', noLeidos: 0 })));
  await prueba('la cobradora lee los recordatorios mandados', assertSucceeds(getDoc(doc(cob, 'recordatorios/26_M-1_2_hoy'))));

  // ── Lo que no se hace desde el navegador ──
  await prueba('no cambia el teléfono ni el cliente de la conversación', assertFails(updateDoc(doc(cob, CONV), { telE164: '+580000000000' })));
  await prueba('no cambia el texto del último mensaje', assertFails(updateDoc(doc(cob, CONV), { ultimoMensaje: 'otro', noLeidos: 0 })));
  await prueba('no crea conversaciones', assertFails(setDoc(doc(cob, 'conversaciones/wa:+584160000000'), { canal: 'whatsapp', telE164: '+584160000000', modo: 'bot' })));
  await prueba('no las borra', assertFails(deleteDoc(doc(cob, CONV))));
  await prueba('no escribe mensajes directo (van por el endpoint /equipo)', assertFails(addDoc(collection(cob, CONV + '/mensajes'), { autor: 'equipo', texto: 'hola' })));
  await prueba('ni el administrador escribe mensajes directo', assertFails(setDoc(doc(admin, CONV + '/mensajes/x1'), { autor: 'equipo', texto: 'hola' })));
  await prueba('no toca los recordatorios', assertFails(setDoc(doc(cob, 'recordatorios/26_M-1_2_hoy'), { estado: 'fallo' })));

  // ── Quien NO tiene el modulo ──
  await prueba('la empleada sin el módulo no lee conversaciones', assertFails(getDoc(doc(emp, CONV))));
  await prueba('...ni mensajes', assertFails(getDocs(collection(emp, CONV + '/mensajes'))));
  await prueba('el vendedor de concesionario no las lee aunque le pongan el permiso', assertFails(getDoc(doc(vc, CONV))));
  await prueba('sin sesión nada', assertFails(getDoc(doc(nadie, CONV))));

  // ── config/asistente y lo del servidor ──
  await prueba('cualquiera del personal lee config/asistente (para saber si está conectado)', assertSucceeds(getDoc(doc(emp, 'config/asistente'))));
  await prueba('el administrador edita las instrucciones y los datos de pago', assertSucceeds(setDoc(doc(admin, 'config/asistente'), { instrucciones: 'nuevo', datosPago: 'Pago Móvil 0414' }, { merge: true })));
  await prueba('la cobradora no edita config/asistente', assertFails(setDoc(doc(cob, 'config/asistente'), { instrucciones: 'yo' }, { merge: true })));
  await prueba('la empleada tampoco', assertFails(setDoc(doc(emp, 'config/asistente'), { conectado: true }, { merge: true })));
  await prueba('los avisos crudos de Meta los lee solo administración', assertSucceeds(getDoc(doc(admin, 'webhooks_meta/a1'))));
  await prueba('...la cobradora no', assertFails(getDoc(doc(cob, 'webhooks_meta/a1'))));
  await prueba('...y nadie los escribe', assertFails(setDoc(doc(admin, 'webhooks_meta/a2'), { crudo: '{}' })));
  await prueba('las corridas de recordatorios: lee administración, no se escriben', assertSucceeds(getDoc(doc(admin, 'recordatorios_corridas/r1'))));
  await prueba('...ni el administrador las escribe', assertFails(setDoc(doc(admin, 'recordatorios_corridas/r2'), { hoy: 'x' })));

  await env.cleanup();
  console.log('\n' + pass + ' pruebas OK, ' + fail + ' fallas');
  if (fail) process.exit(1);
})().catch(e => { console.error('FALLA', e); process.exit(1); });
