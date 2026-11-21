// 21-nov-2026, Adam: "cuando están armando una solicitud nueva viene por default un fiador".
// La solicitud en blanco no trae fiador; lo trae la ficha del cliente (lo que anotó en la web o
// le dijo a Paola) y sale marcado «Tiene fiador». El fallo: si el vendedor lo pasaba a «Sin
// fiador», el nombre se quedaba en el crédito y en la ficha, y el contrato, que decidía por el
// nombre, salía con fiador y cláusula de fianza (13 créditos de PAGASI 26 hasta ese día).
//  1. «Sin fiador» manda en los contratos (primero el crédito; si no dice nada, la ficha).
//  2. Con «Sin fiador» el crédito no guarda nada del fiador; la ficha queda en «no» y lo que
//     escribió el cliente no se borra.
//  3. Lo demás sigue igual: con fiador, el contrato lo imprime como siempre.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (l, v) => { if (v) { pass++; console.log('OK   ' + l); } else { fail++; console.log('FALLA ' + l); } };
const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
process.on('unhandledRejection', e => { fail++; console.log('FALLA promesa rechazada: ' + (e && e.message)); });
function elemento(v){ return Object.assign({ innerHTML:'', textContent:'', value:'', className:'', style:{}, classList:{add(){},remove(){},contains(){return false;},toggle(){}}, children:[], options:[], appendChild(){}, remove(){}, setAttribute(){}, getAttribute(){ return null; }, addEventListener(){}, focus(){ this._foco = true; }, closest(){ return null; }, querySelector(){ return null; }, querySelectorAll(){ return []; } }, v || {}); }
const form = {};
const base = () => { Object.keys(form).forEach(k => delete form[k]); ['mic','mtt','msb','modal-box','mbd','mft','ov','wz-overlay'].forEach(id => form[id] = elemento()); };
base();
const doc = { getElementById(id){ return form[id] || null; }, querySelector(){ return null; }, querySelectorAll(){ return []; }, createElement(){ return elemento(); }, head:elemento(), body:elemento(), documentElement:elemento(), addEventListener(){}, removeEventListener(){} };
const avisos = [], preguntas = [];
let respuesta = true;
const ctx = { console:{log(){},warn(){},error(){}}, setTimeout(){return 0;}, clearTimeout(){}, setInterval(){return 0;}, clearInterval(){}, requestAnimationFrame(){return 0;}, document:doc, navigator:{userAgent:'node',language:'es'}, location:{href:'https://pagasi.io/admin.html',search:'',hash:'',pathname:'/admin.html'}, localStorage:{getItem(){return null;},setItem(){},removeItem(){}}, sessionStorage:{getItem(){return null;},setItem(){},removeItem(){}}, fetch(){ return Promise.resolve({ok:true,json:()=>Promise.resolve({})}); }, alert(){}, prompt(){return '';}, confirm(m){ preguntas.push(String(m)); return respuesta; }, open(){ return {document:{write(){},close(){}}}; }, db:null, storage:null, firebase:undefined, innerWidth:1440, innerHeight:900, PG:{} };
ctx.MutationObserver=function(){return {observe(){},disconnect(){}};}; ctx.IntersectionObserver=function(){return {observe(){},disconnect(){},unobserve(){}};}; ctx.ResizeObserver=function(){return {observe(){},disconnect(){}};}; ctx.addEventListener=function(){}; ctx.removeEventListener=function(){}; ctx.matchMedia=function(){return {matches:false,addListener(){},addEventListener(){}};}; ctx.getComputedStyle=function(){return {getPropertyValue(){return '';}};}; ctx.scrollTo=function(){}; ctx.history={state:null,pushState(){},replaceState(){},back(){}}; ctx.window=ctx;
const archivos = [...src('admin.html').matchAll(/src="((?:assets|logic|modules)\/[^"?]+\.js)/g)].map(m=>m[1]);
vm.createContext(ctx); vm.runInContext(archivos.map(f=>src(f)).join('\n;\n'), ctx, {filename:'app.js'});
ctx.toast = m => avisos.push(String(m)); ctx.nav = function(){}; ctx.closeM = function(){}; ctx.setMicon = function(){};
ctx._puedeVender = () => true;
const guardados = [], creditos = [];
ctx.DB.saveCliente = o => { guardados.push(JSON.parse(JSON.stringify(o))); return Promise.resolve(); };
ctx.DB.crearCred = o => { creditos.push(JSON.parse(JSON.stringify(o))); return Promise.resolve(); };
const S = ctx.S;
const WZ = () => ctx.WZ;
const html = () => form['wz-overlay'].innerHTML;
const espera = () => new Promise(r => setTimeout(r, 30));

const FIADOR = { fiador:'si', fiador_nom:'CARMEN RUIZ PRUEBA', fiador_ci:'V-9876543', fiador_tel:'0412-7654321', fiador_dir:'CATIA', fiador_rel:'familiar', fiador_rif:'V-98765432', fiador_email:'carmen@example.com' };
const WEB = Object.assign({ id:'WEB-14567890', nombre:'JOSE RAMON PEREZ', cedula:'V-14567890', tel:'0414-1234567', trabajo:'delivery', ingreso:225, estado:'lead', origen:'web', creado:'2026-11-20T10:00:00.000Z' }, FIADOR);
function reiniciar(clientes){
  base(); avisos.length = 0; preguntas.length = 0; respuesta = true; guardados.length = 0; creditos.length = 0;
  S.creds = []; S.motos = [];
  S.clientes = (clientes || [WEB]).map(c => JSON.parse(JSON.stringify(c)));
  S.currentUser = { uid:'u-liz', nombre:'Liz', rol:'Administrador', permisos:[] };
  ctx.window._wzEditando = null;
  ctx.openAddCred();
}
const CAMPOS = ['fiador_nom','fiador_tel','fiador_ci','fiador_rel','fiador_dir','fiador_rif','fiador_email'];
const sinNada = o => CAMPOS.every(k => !o[k]) && !o.fiador_ing;

(async () => {
  // ══ 1. La regla de los contratos ══
  const L = ctx._ctrLlevaFiador;
  ok('sin nombre de fiador en la ficha no hay fiador, diga lo que diga la marca', L({ fiador_tiene:'si' }, {}) === false && L({ fiador_tiene:'si' }, { fiador:'si', fiador_nom:'  ' }) === false && L(null, null) === false);
  ok('con nombre y crédito «si» hay fiador', L({ fiador_tiene:'si' }, FIADOR) === true);
  ok('con nombre pero crédito «Sin fiador» NO hay fiador', L({ fiador_tiene:'no' }, FIADOR) === false && L({ fiador_tiene:' NO ' }, FIADOR) === false);
  ok('el crédito manda sobre la ficha: «si» en el crédito aunque la ficha haya quedado en «no»', L({ fiador_tiene:'si' }, Object.assign({}, FIADOR, { fiador:'no' })) === true);
  ok('si el crédito no dice nada, decide la ficha', L({}, Object.assign({}, FIADOR, { fiador:'no' })) === false && L({ fiador_tiene:'' }, FIADOR) === true);
  ok('...y sin marca en ninguno de los dos, como antes: el nombre basta', L({}, { fiador_nom:'CARMEN RUIZ PRUEBA' }) === true);
  const ficha = Object.assign({ id:'F1', nombre:'JOSE' }, FIADOR), antes = JSON.stringify(ficha);
  const copia = ctx._ctrClienteParaContrato({ fiador_tiene:'no' }, ficha);
  ok('para el contrato la ficha sale sin ningún dato del fiador', copia !== ficha && sinNada(copia) && copia.nombre === 'JOSE' && copia.fiador === 'si');
  ok('...y la ficha de verdad no se toca', JSON.stringify(ficha) === antes);
  ok('cuando sí lleva fiador se usa la misma ficha, sin copiar', ctx._ctrClienteParaContrato({ fiador_tiene:'si' }, ficha) === ficha);
  ok('una ficha sin fiador pasa tal cual', (() => { const f = { id:'F2', nombre:'ANA' }; return ctx._ctrClienteParaContrato({ fiador_tiene:'no' }, f) === f; })());

  // ══ 2. Los tres contratos leen la ficha por esa regla ══
  const cred = (id, marca) => ({ id, cli:'JOSE RAMON PEREZ', clienteId:'WEB-14567890', estado:'activo', fecha:'2026-11-21', precio:1432, ini:645, fin:787, total:1494, cuotaQ:83, totalCuotas:18, plazo:9, pagado:0, modelo:'MATRIX 150', fiador_tiene:marca });
  S.clientes = [JSON.parse(JSON.stringify(WEB))]; S.motos = []; S.pagos = []; S.concesionarios = [];
  S.creds = [cred('M-SI', 'si'), cred('M-NO', 'no'), cred('M-VACIO', '')];
  const P = id => ctx._protectDatos(id), D = id => ctx._draDatos(id), X = id => ctx._docCtx(id);
  ok('contrato Protect: con fiador lo imprime', P('M-SI').hayFiador === true && /CARMEN RUIZ PRUEBA/.test(P('M-SI').fiaNom));
  ok('contrato Protect: con «Sin fiador» no hay fiador ni fianza', P('M-NO').hayFiador === false && !/CARMEN/.test(P('M-NO').fiaNom));
  ok('contrato Protect: sin marca en el crédito, como antes (decide la ficha)', P('M-VACIO').hayFiador === true);
  ok('...y los recaudos del fiador solo salen cuando hay fiador', ctx._docsRecaudosLista(P('M-SI').hayFiador).some(r => /Fiador/.test(r[1])) && !ctx._docsRecaudosLista(P('M-NO').hayFiador).some(r => /Fiador/.test(r[1])));
  ok('contrato de reserva de dominio: con fiador interviene; con «Sin fiador» no', /fiador solidario/.test(ctx._draPreambuloFiador(D('M-SI'))) && ctx._draPreambuloFiador(D('M-NO')) === '' && D('M-NO').cli.fiador_nom === '');
  ok('los documentos de antes (pagaré, aval): igual', X('M-SI').cli.fiador_nom === 'CARMEN RUIZ PRUEBA' && X('M-NO').cli.fiador_nom === '' && X('M-NO').cli.fiador_ci === '');
  ok('la ficha guardada sigue con lo que escribió el cliente', S.clientes[0].fiador_nom === 'CARMEN RUIZ PRUEBA' && S.clientes[0].fiador_tel === '0412-7654321');
  // El caso real: ficha que quedó en «no» con el nombre pegado y crédito «no»
  S.clientes[0].fiador = 'no';
  ok('los 13 créditos de la 26 (crédito «no», ficha «no» con el nombre pegado) salen sin fiador', P('M-NO').hayFiador === false && P('M-VACIO').hayFiador === false && P('M-SI').hayFiador === true);

  // ══ 3. La solicitud: el fiador precargado y «Sin fiador» ══
  reiniciar();
  ok('una solicitud en blanco no trae fiador', !WZ().fiador_tiene && !WZ().fiador_nom && ctx._wzFiadorValor() === '');
  ctx._wzCliPick('WEB-14567890');
  ok('al escoger un cliente de la web sale su fiador, marcado', WZ().fiador_tiene === 'si' && WZ().fiador_nom === 'CARMEN RUIZ PRUEBA' && WZ().fiador_tel === '0412-7654321');
  // el vendedor lo pasa a «Sin fiador» (los datos siguen en las casillas escondidas) y guarda
  vm.runInContext("WZ.fiador_tiene='no'; WZ.step = 4; WZ.precio = 0;", ctx);
  ok('con «Sin fiador» no se guarda ningún dato del fiador', CAMPOS.concat(['fiador_ing']).every(k => ctx._wzFiadorDato(k) === ''));
  ctx._wzGuardar(); await espera();
  let g = guardados.find(o => o.id === 'WEB-14567890');
  ok('el crédito queda «Sin fiador» y SIN el nombre que venía precargado', creditos.length === 1 && creditos[0].fiador_tiene === 'no' && sinNada(creditos[0]));
  ok('la ficha queda en «no»', !!g && g.fiador === 'no');
  ok('...y lo que escribió el cliente en la web no se borra', !!g && g.fiador_nom === 'CARMEN RUIZ PRUEBA' && g.fiador_tel === '0412-7654321' && g.fiador_ci === 'V-9876543');
  S.creds = creditos.map(c => JSON.parse(JSON.stringify(c))); S.clientes = [JSON.parse(JSON.stringify(g))];
  ok('...y el contrato de ese crédito sale sin fiador', ctx._protectDatos(creditos[0].id).hayFiador === false);
  ok('Cumplimiento tampoco revisa a esa persona como fiador', ctx.amlFiadoresDe(S.clientes[0]).length === 0);

  // el vendedor borra el nombre y marca «Sin fiador»: antes la ficha seguía diciendo «si»
  reiniciar(); ctx._wzCliPick('WEB-14567890');
  vm.runInContext("WZ.fiador_tiene='no'; WZ.fiador_nom=''; WZ.wz_fiador_nom=''; WZ.fiador_tel=''; WZ.step = 4; WZ.precio = 0;", ctx);
  ctx._wzGuardar(); await espera();
  g = guardados.find(o => o.id === 'WEB-14567890');
  ok('si además borra el nombre, la ficha igual pasa a «no»', !!g && g.fiador === 'no' && creditos[0].fiador_tiene === 'no' && sinNada(creditos[0]));

  // con fiador, todo como antes
  reiniciar(); ctx._wzCliPick('WEB-14567890');
  vm.runInContext("WZ.step = 4; WZ.precio = 0;", ctx);
  ctx._wzGuardar(); await espera();
  g = guardados.find(o => o.id === 'WEB-14567890');
  ok('si el vendedor deja el fiador, se guarda igual que antes en el crédito', creditos.length === 1 && creditos[0].fiador_tiene === 'si' && creditos[0].fiador_nom === 'CARMEN RUIZ PRUEBA' && creditos[0].fiador_tel === '0412-7654321' && creditos[0].fiador_ci === 'V-9876543' && creditos[0].fiador_dir === 'CATIA' && creditos[0].fiador_rel === 'familiar');
  ok('...y en la ficha', !!g && g.fiador === 'si' && g.fiador_nom === 'CARMEN RUIZ PRUEBA');
  S.creds = creditos.map(c => JSON.parse(JSON.stringify(c))); S.clientes = [JSON.parse(JSON.stringify(g))];
  ok('...y el contrato lo imprime', ctx._protectDatos(creditos[0].id).hayFiador === true);

  // cliente nuevo escrito a mano: escribió un fiador y después marcó «Sin fiador»
  reiniciar([]);
  vm.runInContext("WZ.nom='NUEVA PRUEBA'; WZ.wz_nom='NUEVA PRUEBA'; WZ.ci='V-20111222'; WZ.wz_ci='V-20111222'; WZ.tel='0414-5550000'; WZ.wz_tel='0414-5550000'; WZ.fiador_tiene='no'; WZ.fiador_nom='ALGUIEN PRUEBA'; WZ.fiador_tel='0412-0001111'; WZ.fiador_ci='V-1234567'; WZ.step = 4; WZ.precio = 0;", ctx);
  ctx._wzGuardar(); await espera();
  g = guardados.find(o => o.nombre === 'NUEVA PRUEBA');
  ok('en una ficha nueva, «Sin fiador» no deja ningún fiador anotado', !!g && g.fiador === 'no' && sinNada(g) && creditos.length === 1 && creditos[0].fiador_tiene === 'no' && sinNada(creditos[0]));

  // ══ 4. Editar un crédito sin firmar y pasarlo a «Sin fiador» ══
  const fuente = src('logic/creditos.js');
  ok('al editar, «Sin fiador» vacía el fiador del crédito en vez de conservar el viejo', /\.\.\.\(WZ\.fiador_tiene === 'no'\s*\? \{ fiador_nom:'', fiador_tel:'', fiador_ci:'', fiador_rel:'', fiador_rif:'', fiador_dir:'', fiador_ing:0, fiador_email:'' \}/.test(fuente));
  ok('ningún guardado copia ya el nombre del fiador sin mirar la marca', !/fiador_nom: WZ\.fiador_nom\|\|''/.test(fuente));

  console.log('\n' + pass + ' OK · ' + fail + ' fallas');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FALLA la prueba se cayó: ' + (e && e.stack || e)); process.exit(1); });
