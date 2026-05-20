// â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—
// â•‘ FIREBASE â€” PEGA TU CONFIG AQUÃ â•‘
// â•‘ 1. console.firebase.google.com â•‘
// â•‘ 2. Engranaje â†’ ConfiguraciÃ³n del proyecto â•‘
// â•‘ 3. Tu app Web â†’ copia el objeto firebaseConfig â•‘
// â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
var FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDt07EYdmvIqjU5a9CGPMQdYz8iBJ69Su8',
  authDomain: 'pagasi-v2.firebaseapp.com',
  projectId: 'pagasi-v2',
  storageBucket: 'pagasi-v2.firebasestorage.app',
  messagingSenderId: '951911859002',
  appId: '1:951911859002:web:1eb8f0af7bcbd508474603'
};

// â”€â”€ Notas de Firestore (consola â†’ Firestore â†’ Reglas): â”€â”€â”€â”€â”€â”€
// rules_version = '2';
// service cloud.firestore {
// match /databases/{database}/documents {
// match /{document=**} {
// allow read, write: if request.auth != null;
//     }
//   }
// }
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

var db = null;
var auth = null;
var storage = null;
var FIREBASE_READY = false;


function getCreditoTotalCuotas(c){
  return parseInt((c&&c.totalCuotas) || ((c&&c.plazo) ? c.plazo*2 : 20), 10) || 20;
}
function getCreditoCuotaBase(c){
  return parseFloat((c&&(c.cuotaQ||c.cuota)) || 0) || 0;
}
function getCreditoPagosConfirmados(c){
  if(!c) return 0;
  var pagosDelCred = (S&&Array.isArray(S.pagos))
    ? S.pagos.filter(function(p){
        return p && !p.eliminado && p.estado==='confirmado' && p.cred===c.id && !p.esInicial && p.tipoOperacion!=='inicial_credito';
      })
    : [];
  if(pagosDelCred.length){
    return pagosDelCred.reduce(function(a,p){ return a + (parseFloat(p.monto)||0); }, 0);
  }
  if(Array.isArray(c.pagosRegistrados) && c.pagosRegistrados.length){
    return c.pagosRegistrados.reduce(function(a,h){ return a + (parseFloat(h.montoPagado)||0); }, 0);
  }
  return (parseInt(c.pagado,10)||0) * getCreditoCuotaBase(c);
}
function getCreditoCuotasPagadas(c){
  if(!c) return 0;
  var totalCuotas = getCreditoTotalCuotas(c);
  var cuotaBase = getCreditoCuotaBase(c);
  var pagadoRegistrado = parseInt(c.pagado,10) || 0;
  var pagadoPorMonto = cuotaBase>0 ? Math.floor((getCreditoPagosConfirmados(c)+0.000001)/cuotaBase) : pagadoRegistrado;
  return Math.max(0, Math.min(totalCuotas, Math.max(pagadoRegistrado, pagadoPorMonto)));
}
function getCreditoSaldoPendiente(c){
  return Math.max(0, (parseFloat((c&&c.total) || 0)||0) - getCreditoPagosConfirmados(c));
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// nextCredId: Genera el siguiente ID de crÃ©dito MONOTÃ“NICAMENTE.
// Toma el mÃ¡ximo nÃºmero existente (incluyendo eliminados y cancelados)
// y le suma 1 â€” asÃ­ un ID nunca se repite aunque se borre uno anterior.
// Esto preserva la trazabilidad contable: si tenÃ­as CRED-001, CRED-002
// y CRED-003, y luego eliminas el 002, el siguiente serÃ¡ CRED-004 (no 003).
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function nextCredId(){
  var max = 0;
  var all = (S && Array.isArray(S.creds)) ? S.creds : [];
  all.forEach(function(c){
    if(!c || !c.id) return;
    var m = String(c.id).match(/CRED-(\d+)/);
    if(m){
      var n = parseInt(m[1], 10);
      if(!isNaN(n) && n > max) max = n;
    }
  });
  return 'CRED-' + String(max + 1).padStart(3, '0');
}

function esMovimientoInicialCredito(m){
  if(!m || m.eliminado) return false;
  var concepto = (m.concepto||'');
  return m.tipoOperacion==='inicial_credito' || concepto.indexOf('Inicial Â· ')===0;
}
function getTotalInicialesCobradas(){
  return (S&&Array.isArray(S.movimientos) ? S.movimientos : []).filter(esMovimientoInicialCredito).reduce(function(a,m){
    return a + (parseFloat(m.monto)||0);
  }, 0);
}
function marcarInicialCreditoEliminada(credId, motivo){
  if(!credId || !Array.isArray(S.movimientos)) return;
  var ahora = new Date().toISOString();
  var actor = (S.currentUser&&S.currentUser.nombre)||'Admin';
  S.movimientos.forEach(function(m){
    if(!m || m.eliminado) return;
    var esDeEsteCredito = m.creditoId===credId || m.conceptoCredito===credId || ((m.concepto||'').indexOf('Inicial Â· ')===0 && (m.concepto||'').indexOf(credId)>=0);
    if(!esDeEsteCredito) return;
    m.eliminado = true;
    m.eliminadoPor = actor;
    m.eliminadoEn = ahora;
    if(motivo) m.eliminadoRazon = motivo;
    DB.saveMovimiento(m);
  });
}

try {
  if(typeof firebase === 'undefined'){
    console.warn('SDK de Firebase no cargado');
  } else if(FIREBASE_CONFIG.apiKey !== 'TU_API_KEY'){
    var _existingApp;
    try { _existingApp = firebase.app(); } catch(ex) {}
    if(!_existingApp) firebase.initializeApp(FIREBASE_CONFIG);
    if(typeof firebase.firestore !== 'function'){
      throw new Error('Firestore bundle no cargado. Habilita Firestore Database en Firebase Console.');
    }
    db = firebase.firestore();

    if(typeof firebase.auth === 'function') auth = firebase.auth();
    if(typeof firebase.storage === 'function') storage = firebase.storage();
    FIREBASE_READY = true;
    console.log('Firebase inicializado correctamente');
  } else {
    console.warn('Firebase no configurado');
  }
} catch(e){ console.warn('Firebase init:', e.message); }

// Loader
function showLoader(msg,sub){
  var w=$('ld-wrap'),m=$('ld-msg'),s=$('ld-sub');
  if(w)w.style.display='flex';
  if(m)m.textContent=msg||'Cargando...';
  if(s)s.textContent=sub||'';
}
function hideLoader(){var w=$('ld-wrap');if(w)w.style.display='none';}

// Firebase guarda el mismo objeto â€” sin conversiÃ³n necesaria
function mapMoto(r){return r;}
function mapCred(r){return r;}
function mapPago(r){return r;}

// Limpia undefined antes de guardar en Firestore
function clean(o){
  var r={};
  Object.keys(o).forEach(function(k){if(o[k]!==undefined)r[k]=o[k]===null?null:o[k];});
  return r;
}

// Cache local especÃ­fica para motos â€” evita perder unidades nuevas entre sesiones
var MOTOS_CACHE_KEY='pagasi_motos_cache_v1';
function loadMotosCache(){
  try{
    var raw=localStorage.getItem(MOTOS_CACHE_KEY);
    var arr=raw?JSON.parse(raw):[];
    return Array.isArray(arr)?arr:[];
  }catch(e){ return []; }
}
function saveMotosCache(arr){
  try{ localStorage.setItem(MOTOS_CACHE_KEY, JSON.stringify(Array.isArray(arr)?arr:[])); }catch(e){}
}
function upsertMotoCache(moto){
  try{
    var arr=loadMotosCache();
    var i=arr.findIndex(function(x){ return String(x.id)===String(moto.id); });
    if(i>=0) arr[i]=clean(moto); else arr.push(clean(moto));
    saveMotosCache(arr);
  }catch(e){}
}
function delMotoCache(id){
  try{
    var arr=loadMotosCache().filter(function(x){ return String(x.id)!==String(id); });
    saveMotosCache(arr);
  }catch(e){}
}
// Estrategia de merge:
// - Union de motos remotas y locales.
// - En caso de conflicto de id, gana la versiÃ³n local (puede tener cambios aÃºn no subidos a Firebase).
// - Si el cachÃ© local quedÃ³ "sucio" (motos borradas de Firebase que reaparecen), el usuario puede
// usar el botÃ³n "âŸ³ Resincronizar" del mÃ³dulo de motos para limpiar el cachÃ© local.
function mergeMotosPreferLocal(remote, local){
  var map={};
  (Array.isArray(remote)?remote:[]).forEach(function(x){ if(x&&x.id!=null) map[String(x.id)]=x; });
  (Array.isArray(local)?local:[]).forEach(function(x){ if(x&&x.id!=null) map[String(x.id)]=x; });
  return Object.keys(map).map(function(k){ return map[k]; });
}

// â”€â”€ DB â€” persistencia con Firestore â”€â”€
// Cola offline: guarda operaciones pendientes cuando no hay conexiÃ³n
var _dbQueue = [];
var _dbOnline = true;
window.addEventListener('online', function(){ _dbOnline=true; _flushDbQueue(); });
window.addEventListener('offline', function(){ _dbOnline=false; });

function _dbSilent(fn){
  // Ejecuta fn() y silencia errores de red (WebChannel transport errors)
  try {
    var p = fn();
    if(p && p.catch) p.catch(function(e){
      var msg = e.message||'';
      // Ignorar errores de transporte â€” la persistencia offline los reintenta
      if(msg.includes('transport') || msg.includes('WebChannel') || msg.includes('network') || e.code==='unavailable') return;
      console.warn('DB write error:', msg);
    });
  } catch(e){ console.warn('DB error:', e.message); }
}

function _flushDbQueue(){
  var q=_dbQueue.slice(); _dbQueue=[];
  q.forEach(function(fn){ _dbSilent(fn); });
}

var DB = {
  load: function(){
    var motosCacheLocal = loadMotosCache();
    if(!db){
      if(motosCacheLocal.length) S.motos = mergeMotosPreferLocal(S.motos, motosCacheLocal);
      return Promise.resolve();
    }
    showLoader('Cargando datos...','Conectando con Firebase');
    return Promise.all([
      db.collection('motos').get(),
      db.collection('clientes').get(),
      db.collection('creditos').get(),
      db.collection('pagos').get(),
      db.collection('egresos').get(),
      Promise.resolve({docs:[]}),
      db.collection('movimientos').get(),
      db.collection('cuentasPendientes').get(),
      db.collection('config').doc('plan').get(),
      db.collection('config').doc('catalogo').get(),
      db.collection('config').doc('planes').get(),
      db.collection('facturas').get(),
      db.collection('concesionarios').get(),
    ]).then(function(snaps){
      function read(snap, withId){return snap.docs.map(function(d){return withId ? Object.assign({id:d.id}, d.data()) : d.data();});}
      var m=read(snaps[0], true),cl=read(snaps[1], true),cr=read(snaps[2]),p=read(snaps[3]),e=read(snaps[4]),_skip=snaps[5],mv=read(snaps[6]),pnd=read(snaps[7]);
      var planDoc = snaps[8], catalogoDoc = snaps[9], planesDoc = snaps[10];
      var fac = snaps[11] ? read(snaps[11]) : [];
      var conc = snaps[12] ? read(snaps[12], true) : [];
      if(planDoc && planDoc.exists){
        var pd = planDoc.data() || {};
        if(Object.prototype.hasOwnProperty.call(pd,'factor')) PLAN.factor = pd.factor;
        if(Object.prototype.hasOwnProperty.call(pd,'inicial')) PLAN.inicial = pd.inicial;
        if(Object.prototype.hasOwnProperty.call(pd,'tasaMensual')) PLAN.tasaMensual = pd.tasaMensual;
        if(Object.prototype.hasOwnProperty.call(pd,'plazo')) PLAN.plazo = pd.plazo;
        if(Object.prototype.hasOwnProperty.call(pd,'apy')) PLAN.apy = pd.apy;
        var graciaCfg = Object.prototype.hasOwnProperty.call(pd,'diasGracia') ? pd.diasGracia : pd.gracia;
        if(typeof graciaCfg !== 'undefined' && graciaCfg !== null) PLAN.diasGracia = graciaCfg;
        var moraCfg = Object.prototype.hasOwnProperty.call(pd,'moraPct') ? pd.moraPct : pd.mora_pct;
        if(typeof moraCfg !== 'undefined' && moraCfg !== null) PLAN.moraPct = moraCfg;
      }
      if(catalogoDoc && catalogoDoc.exists){
        var catData = catalogoDoc.data() || {};
        if(Array.isArray(catData.items) && catData.items.length){
          CATALOGO.splice(0, CATALOGO.length);
          catData.items.forEach(function(item){ CATALOGO.push(item); });
        }
      }
      if(planesDoc && planesDoc.exists){
        var extraData = planesDoc.data() || {};
        window._planesExtra = Array.isArray(extraData.items) ? extraData.items : [];
      } else {
        window._planesExtra = window._planesExtra || [];
      }
      S.motos = mergeMotosPreferLocal(m.map(mapMoto), motosCacheLocal);
      saveMotosCache(S.motos);

      // â•â•â•â•â•â• SANEAR score_indexa corrupto â•â•â•â•â•â•
      // En algunos clientes se guardÃ³ el objeto completo del score en lugar del nÃºmero
      var _scoreCorruptos = 0;
      cl.forEach(function(cli){
        if(!cli) return;
        var sr = cli.score_indexa;
        // Caso 1: objeto â†’ rescatar total/score/valor
        if(sr && typeof sr === 'object' && sr !== null){
          _scoreCorruptos++;
          if(_scoreCorruptos <= 2) console.log('[SCORE CORRUPTO]', cli.nombre, 'tenÃ­a:', sr);
          var t = parseFloat(sr.total || sr.score || sr.valor || sr.value || 0);
          cli.score_indexa = (t >= 300 && t <= 850) ? t : 0;
          cli._scoreFueCorrupto = true;
        } else {
          var n = parseFloat(sr);
          if(isNaN(n) || n < 300 || n > 850) cli.score_indexa = 0;
          else cli.score_indexa = n;
        }

        // Fallback: si no hay score pero hay ingreso, calcular uno estimado simple
        if(!cli.score_indexa && cli.ingreso){
          var ing = parseFloat(cli.ingreso) || 0;
          var emp = (cli.trabajo || '').toLowerCase();
          // Score base por ingreso (300 a 750 segÃºn rango)
          var base = 300;
          if(ing >= 2000) base = 720;
          else if(ing >= 1000) base = 650;
          else if(ing >= 500) base = 580;
          else if(ing >= 300) base = 500;
          else if(ing >= 150) base = 430;
          else base = 380;
          // Bonus/penalizaciÃ³n por tipo de empleo
          if(emp.indexOf('formal')>=0 || emp.indexOf('pÃºblico')>=0 || emp.indexOf('publico')>=0) base += 40;
          else if(emp.indexOf('informal')>=0 || emp.indexOf('indepen')>=0) base -= 20;
          // Limitar 300-850
          cli.score_indexa = Math.max(300, Math.min(850, base));
          cli._scoreEstimado = true;
        }
      });
      if(_scoreCorruptos > 0){
        console.log('[SCORE] Se sanearon '+_scoreCorruptos+' scores corruptos de Firestore');
      }

      S.clientes = cl;

      // Persistir en background los scores saneados â€” sobrescribe el objeto corrupto en Firestore
      setTimeout(function(){
        if(!db) return;
        var fixed = 0;
        cl.forEach(function(cli){
          if(cli._scoreFueCorrupto && cli.id){
            delete cli._scoreFueCorrupto;
            try {
              db.collection('clientes').doc(String(cli.id)).update({
                score_indexa: cli.score_indexa || 0,
                score_saneado: new Date().toISOString()
              }).then(function(){ fixed++; }).catch(function(){});
            } catch(e){}
          }
        });
        if(fixed>0) console.log('[SCORE] Persistidos '+fixed+' scores saneados en Firestore');
      }, 1500);
      S.creds = cr.map(mapCred);
      S.pagos = p.map(mapPago);
      S.egresos = e;
      S.movimientos = mv;
      S.cuentasPendientes = pnd;
      S.facturas = fac;
      S.concesionarios = conc;
      // Restaurar el concesionario activo desde localStorage si existe
      try{
        var savedConc = localStorage.getItem('concesionarioActivo');
        if(savedConc && conc.find(function(c){return c.id === savedConc;})){
          S.concesionarioActivo = savedConc;
        }
      }catch(e){}
      // Si el usuario tiene UNA sola sede asignada, forzarla como activa (no permitir "Todos")
      try{
        if(S.currentUser){
          var asignados = S.currentUser.concesionarios || [];
          if(asignados.length === 1){
            S.concesionarioActivo = asignados[0];
            try{ localStorage.setItem('concesionarioActivo', asignados[0]); }catch(e){}
          } else if(asignados.length > 1){
            // Si tiene varias y el savedConc no estÃ¡ en su lista, usar la primera
            if(!S.concesionarioActivo || asignados.indexOf(S.concesionarioActivo) === -1){
              S.concesionarioActivo = asignados[0];
              try{ localStorage.setItem('concesionarioActivo', asignados[0]); }catch(e){}
            }
          }
        }
      }catch(e){}
      calcularMoraAuto();
      cargarCuentasBanc();
      cargarEmpresa();
      hideLoader();
      // Re-render charts now that data is available
      setTimeout(function(){
        if(typeof renderDashChart==='function') renderDashChart();
        if(typeof renderCredChart==='function') renderCredChart();
        if(typeof renderMoraChart==='function') renderMoraChart();
        if(typeof renderFinIngChart==='function') renderFinIngChart();
        // Re-render egresos chart if on dashboard
        if(typeof renderDashEgrChart==='function') renderDashEgrChart();
      }, 300);
      setTimeout(mostrarAlertaMora, 800); // pequeÃ±o delay para que el dashboard cargue
    }).catch(function(e){
      hideLoader();
      // Si es error de red, trabajar con datos locales sin avisar con error
      if(e.code==='unavailable'||( e.message&&e.message.includes('network'))){
        if(motosCacheLocal.length) S.motos = mergeMotosPreferLocal(S.motos, motosCacheLocal);
        toast('Sin conexiÃ³n â€” modo offline activo','info');
      } else {
        if(motosCacheLocal.length) S.motos = mergeMotosPreferLocal(S.motos, motosCacheLocal);
        toast('Error al cargar datos: '+e.message,'error');
      }
    });
  },
  saveMoto: function(o){ upsertMotoCache(o); if(!db)return; _dbSilent(function(){ return db.collection('motos').doc(String(o.id)).set(clean(o)); }); },
  delMoto: function(id){ delMotoCache(id); if(!db)return; _dbSilent(function(){ return db.collection('motos').doc(String(id)).delete(); }); },
  saveCliente: function(o){ if(!db)return; _dbSilent(function(){ return db.collection('clientes').doc(String(o.id)).set(clean(o), {merge:true}); }); },
  delCliente: function(id){ if(!db)return; _dbSilent(function(){ return db.collection('clientes').doc(String(id)).delete(); }); },
  saveCred: function(o){ if(!db)return; _dbSilent(function(){ return db.collection('creditos').doc(o.id).set(clean(o)); }); },
  updateCred: function(id,u){ if(!db)return; _dbSilent(function(){ return db.collection('creditos').doc(id).update(u); }); },
  savePago: function(o){ if(!db)return; _dbSilent(function(){ return db.collection('pagos').doc(o.id).set(clean(o)); }); },
  saveEgreso: function(o){ if(!db)return; _dbSilent(function(){ return db.collection('egresos').doc(String(o.id)).set(clean(o)); }); },
  delEgreso: function(id){ if(!db)return; _dbSilent(function(){ return db.collection('egresos').doc(String(id)).delete(); }); },
  saveFactura: function(o){ if(!db)return; _dbSilent(function(){ return db.collection('facturas').doc(String(o.id)).set(clean(o)); }); },
  saveConcesionario: function(o){ if(!db)return; _dbSilent(function(){ return db.collection('concesionarios').doc(String(o.id)).set(clean(o)); }); },
  delConcesionario: function(id){ if(!db)return; _dbSilent(function(){ return db.collection('concesionarios').doc(String(id)).delete(); }); },
};

// Usuarios e invitaciones en Firestore
DB.getUsuarios = function(){ if(!db) return Promise.resolve([]); return db.collection('usuarios').get().then(function(s){return s.docs.map(function(d){return Object.assign({uid:d.id},d.data());});}); };
DB.saveUsuario = function(uid,data){ if(!db) return Promise.resolve(); return db.collection('usuarios').doc(uid).set(data,{merge:true}); };
DB.updateUsuario = function(uid,data){ if(!db) return; _dbSilent(function(){ return db.collection('usuarios').doc(uid).update(data); }); };
DB.deleteUsuario = function(uid){ if(!db) return; _dbSilent(function(){ return db.collection('usuarios').doc(uid).delete(); }); };
DB.saveInvitacion = function(token,data){ if(!db) return; return db.collection('invitaciones').doc(token).set(data); };
DB.getInvitacion = function(token){ if(!db) return Promise.resolve(null); return db.collection('invitaciones').doc(token).get(); };
DB.usarInvitacion = function(token,uid){ if(!db) return; _dbSilent(function(){ return db.collection('invitaciones').doc(token).update({usado:true,uid:uid,fechaUso:new Date().toISOString()}); }); };
DB.saveCuenta = function(o){ if(!db)return; _dbSilent(function(){ return db.collection('cuentas').doc(String(o.id)).set(clean(o)); }); };
DB.delCuenta = function(id){ if(!db)return; _dbSilent(function(){ return db.collection('cuentas').doc(String(id)).delete(); }); };
DB.updateCuenta = function(id,u){ if(!db)return; _dbSilent(function(){ return db.collection('cuentas').doc(String(id)).update(u); }); };
DB.saveMovimiento = function(o){ if(!db)return; _dbSilent(function(){ return db.collection('movimientos').doc(o.id).set(clean(o)); }); };
DB.delMovimiento = function(id){ if(!db)return; _dbSilent(function(){ return db.collection('movimientos').doc(id).delete(); }); };
DB.saveTarea = function(o){ if(!db)return; _dbSilent(function(){ return db.collection('tareas').doc(String(o.id)).set(clean(o),{merge:true}); }); };
DB.delTarea = function(id){ if(!db)return; _dbSilent(function(){ return db.collection('tareas').doc(String(id)).delete(); }); };
DB.getTareas = function(){ if(!db) return Promise.resolve([]); return db.collection('tareas').get().then(function(s){return s.docs.map(function(d){return Object.assign({id:d.id},d.data());});}); };


// â”€â”€ Lista de mÃ³dulos disponibles â”€â”€
var MODULOS = [
  {id:'dash', label:'Dashboard', grupo:'Principal'},
  {id:'centro', label:'Centro de trabajo', grupo:'Principal'},
  {id:'clientes', label:'Clientes', grupo:'GestiÃ³n'},
  {id:'motos', label:'Motocicletas', grupo:'GestiÃ³n'},
  {id:'creditos', label:'CrÃ©ditos', grupo:'GestiÃ³n'},
  {id:'pagos', label:'Pagos', grupo:'GestiÃ³n'},
  {id:'cobranza', label:'Cobranza', grupo:'Operaciones'},
  {id:'contratos', label:'Contratos', grupo:'Operaciones'},
  {id:'notif', label:'Notificaciones', grupo:'Operaciones'},
  {id:'reportes', label:'Finanzas', grupo:'AnÃ¡lisis'},
  {id:'cuentas', label:'Cuentas', grupo:'AnÃ¡lisis'},
  {id:'comisiones', label:'Comisiones', grupo:'AnÃ¡lisis'},
  {id:'concesionarios', label:'Concesionarios', grupo:'Sistema'},
  {id:'aprobaciones', label:'Aprobaciones', grupo:'Operaciones'},
  {id:'plan', label:'Plan & Precios', grupo:'Sistema'},
  {id:'config', label:'ConfiguraciÃ³n', grupo:'Sistema'},
  {id:'users', label:'Usuarios', grupo:'Sistema'},
];

// (S.currentUser se inicializa despuÃ©s de declarar S)

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CATÃLOGO OFICIAL PAGASI â€” PLAN GLOBAL CONFIGURABLE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const PLAN = {plazo:12, factor:1.935483870967742, inicial:0.45, tasaMensual:12.26, apy:413.34, diasGracia:5, moraPct:5};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SCORE CFG â€” PolÃ­tica de riesgo configurable
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const SCORE_CFG_DEFAULT = {
  // Pesos de los factores (deben sumar 100)
  pesos: { f1:30, f2:30, f3:20, f4:15, f5:5 },
  // Umbrales de aprobaciÃ³n
  umbrales: {
    excelente:700, // â‰¥ â†’ aprobaciÃ³n automÃ¡tica
    bueno: 600, // â‰¥ â†’ aprobar
    regular: 500, // â‰¥ â†’ revisar manualmente
    // < regular â†’ rechazar
  },
  // Hard rejects: condiciones que fuerzan rechazo sin importar el resto
  hardReject: {
    ingresoMinimo: 250, // rechazar si ingreso efectivo < este valor (USD/mes)
    ratioCuotaMax: 0.35, // rechazar si cuota/ingreso > 35%
    historialMaloConDeuda:true,// rechazar si hist=malo y deuda=graves
    sinTelefono: false, // rechazar si no tiene telÃ©fono
    sinReferencias: false, // rechazar si no tiene referencia alguna
  },
  // Ratio cuota/ingreso: polÃ­ticas
  ratios: {
    ideal: 0.20, // â‰¤ â†’ bonus
    aceptable: 0.30,
    alto: 0.40,
    muyAlto: 0.50,
  },
  // Ingreso base (para normalizar f2)
  ingreso: {
    minBase: 250, // ingresos por debajo de este valor reciben 0 puntos de base
    maxBase: 3000, // ingresos desde este valor reciben el mÃ¡ximo de base
  }
};
var SCORE_CFG = JSON.parse(JSON.stringify(SCORE_CFG_DEFAULT));
try{
  var _scLs = JSON.parse(localStorage.getItem('pagasi_config_score')||'null');
  if(_scLs && typeof _scLs==='object'){
    if(_scLs.pesos) Object.assign(SCORE_CFG.pesos, _scLs.pesos);
    if(_scLs.umbrales) Object.assign(SCORE_CFG.umbrales, _scLs.umbrales);
    if(_scLs.hardReject) Object.assign(SCORE_CFG.hardReject, _scLs.hardReject);
    if(_scLs.ratios) Object.assign(SCORE_CFG.ratios, _scLs.ratios);
    if(_scLs.ingreso) Object.assign(SCORE_CFG.ingreso, _scLs.ingreso);
  }
}catch(_e){}


try {
  var _catLs = JSON.parse(localStorage.getItem('pagasi_catalogo_config')||'null');
  if(Array.isArray(_catLs) && _catLs.length){ CATALOGO.splice(0, CATALOGO.length); _catLs.forEach(function(item){ CATALOGO.push(item); }); }
  var _planLs = JSON.parse(localStorage.getItem('pagasi_config_plan')||'null');
  if(_planLs && typeof _planLs==='object'){
    if(Object.prototype.hasOwnProperty.call(_planLs,'factor')) PLAN.factor = _planLs.factor;
    if(Object.prototype.hasOwnProperty.call(_planLs,'inicial')) PLAN.inicial = _planLs.inicial;
    if(Object.prototype.hasOwnProperty.call(_planLs,'tasaMensual')) PLAN.tasaMensual = _planLs.tasaMensual;
    if(Object.prototype.hasOwnProperty.call(_planLs,'plazo')) PLAN.plazo = _planLs.plazo;
    if(Object.prototype.hasOwnProperty.call(_planLs,'apy')) PLAN.apy = _planLs.apy;
    var _gr = Object.prototype.hasOwnProperty.call(_planLs,'diasGracia') ? _planLs.diasGracia : _planLs.gracia;
    if(typeof _gr!=='undefined' && _gr!==null) PLAN.diasGracia = _gr;
    var _mp = Object.prototype.hasOwnProperty.call(_planLs,'moraPct') ? _planLs.moraPct : _planLs.mora_pct;
    if(typeof _mp!=='undefined' && _mp!==null) PLAN.moraPct = _mp;
  }
  window._planesExtra = JSON.parse(localStorage.getItem('pagasi_planes_extra')||'[]') || [];
} catch(_cfgErr) { window._planesExtra = window._planesExtra || []; }


const CATALOGO = [
  {id:1,modelo:'NEW HORSE 150',precio:1320.00},
  {id:2,modelo:'EK XPRESS 150',precio:1090.00},
  {id:3,modelo:'EK XPRESS II 150',precio:1126.00},
  {id:4,modelo:'EK XPRESS 200S',precio:1360.00},
  {id:5,modelo:'EK XPRESS 150 LITE',precio:1020.00},
  {id:6,modelo:'NEW OWEN II 150',precio:1255.00},
  {id:7,modelo:'OWEN 200S',precio:1550.00},
  {id:8,modelo:'RK 200',precio:1750.00},
  {id:9,modelo:'RK 250',precio:2075.00},
  {id:10,modelo:'TX 250 GS',precio:2599.00},
  {id:11,modelo:'MATRIX 150 LITE',precio:1290.00},
  {id:12,modelo:'MATRIX 150',precio:1499.00},
  {id:13,modelo:'NEW OUTLOOK 175',precio:2450.00},
  {id:14,modelo:'OUTLOOK XL PALETA',precio:4851.00},
  {id:15,modelo:'ATLAS 200HD',precio:4600.00},
];

// Calculos financieros y helpers de planes movidos a logic/financiero.js.

const S = {
  motos: [],
  clientes: [],
  creds: [],
  pagos: [],
  egresos: [],
  cuentas: [],
  movimientos:[],
  cuentasPendientes:[],
  facturas: [],
  concesionarios: [],
  concesionarioActivo: null, // null = "Todos" / id = trabajando en un concesionario
  page:'dash', mTab:'todas', credTab:'todos', pagosTab:'todos', saveFn:null, clienteFiltro:'',
  credSort:{col:'id',dir:'asc'}, cliSort:{col:'nombre',dir:'asc'}, pagosSort:{col:'fecha',dir:'desc'}, motosSort:{col:'modelo',dir:'asc'}, credFiltro:'',
  pagosDesde:'', pagosHasta:'',
  currentUser: null,
  tareas: []
};

const $=id=>document.getElementById(id);
const fmt=n=>'$'+parseFloat(n).toLocaleString('es-VE',{minimumFractionDigits:2,maximumFractionDigits:2});
window.S = S;
window.$ = $;
window.fmt = fmt;

// Formatea una fecha ISO o timestamp como "DD/MM/YYYY HH:MM"
function fmtFechaHora(iso){
  if(!iso) return '';
  try{
    var d = new Date(iso);
    if(isNaN(d.getTime())) return '';
    var dd = String(d.getDate()).padStart(2,'0');
    var mm = String(d.getMonth()+1).padStart(2,'0');
    var yy = d.getFullYear();
    var hh = String(d.getHours()).padStart(2,'0');
    var mn = String(d.getMinutes()).padStart(2,'0');
    return dd+'/'+mm+'/'+yy+' '+hh+':'+mn;
  }catch(e){ return ''; }
}
function fmtFecha(iso){
  if(!iso) return '';
  try{
    var d = new Date(iso);
    if(isNaN(d.getTime())) return '';
    return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
  }catch(e){ return ''; }
}
const ini=n=>n.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
const sbg=s=>({activo:'b-g',mora:'b-r',recuperada:'b-a',recuperado:'b-a',disponible:'b-p',financiada:'b-p',inventario:'b-b',confirmado:'b-g',pendiente:'b-a',completado:'b-g',propia:'b-g',cancelado:'b-r'}[s]||'b-x');
const PGL={dash:'Dashboard',centro:'Centro de trabajo',clientes:'Clientes',motos:'Motocicletas',creditos:'CrÃ©ditos',pagos:'Pagos',cobranza:'Cobranza',contratos:'Contratos',notif:'Notificaciones',reportes:'Finanzas',cuentas:'Cuentas',comisiones:'Comisiones',conta:'Finanzas',plan:'Plan & Precios',config:'ConfiguraciÃ³n',scores:'Scores',users:'Usuarios',concesionarios:'Concesionarios',aprobaciones:'Aprobaciones'};

const EXTRA_PERMS={perm_delete:'Permiso para eliminar'};
function getCurrentPerms(){ return (S.currentUser&&Array.isArray(S.currentUser.permisos)) ? S.currentUser.permisos : []; }
function isAdminUser(){ return !!(S.currentUser && S.currentUser.rol==='Administrador'); }
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PERMISOS POR ROL â€” presets automÃ¡ticos
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
var ROL_PERMISOS = {
  // Acceso total: dueÃ±o del sistema
  Administrador: ['dash','centro','clientes','motos','creditos','pagos','cobranza','contratos','notif','reportes','cuentas','plan','config','users','perm_delete'],
  // Supervisa operaciones, ve reportes, NO toca config ni usuarios
  Gerente: ['dash','centro','clientes','motos','creditos','pagos','cobranza','contratos','notif','reportes','cuentas'],
  // Cobra en la oficina: ve todos los clientes, registra pagos, ve cobranza y deudores
  Cobrador: ['dash','centro','clientes','cobranza','pagos','creditos'],
  // Capta clientes, hace solicitudes, NO toca pagos ni cobranza
  Vendedor: ['dash','centro','clientes','creditos','motos'],
  // Solo finanzas: reportes, pagos, cuentas y contabilidad
  Contador: ['dash','centro','pagos','reportes','cuentas'],
  // Empleado general: hace casi todo excepto config/users
  Empleado: ['dash','centro','clientes','motos','creditos','pagos','cobranza','contratos','notif'],
  // Vendedor Concesionario: solo calculadora (motos), clientes y solicitudes (creditos)
  // Los crÃ©ditos que crea quedan en estado 'pendiente_revision' hasta que admin apruebe
  'Vendedor Concesionario': ['motos','clientes','creditos'],
};

// Roles disponibles para invitar (el nombre visible y su descripciÃ³n)
var ROLES_INFO = {
  Administrador: { desc:'Control total. Puede gestionar usuarios, configuraciÃ³n y todos los mÃ³dulos.', color:'#2563EB', icon:'ADM' },
  Gerente: { desc:'Supervisa operaciones y ve reportes. No puede cambiar configuraciÃ³n del sistema.', color:'#e8980a', icon:'GER' },
  Cobrador: { desc:'Cobra y registra pagos. Ve todos los clientes y la cartera de cobranza.', color:'#06b06a', icon:'COB' },
  Vendedor: { desc:'Capta clientes y crea solicitudes de crÃ©dito. No ve cobranza ni pagos.', color:'#2194ff', icon:'VEN' },
  Contador: { desc:'Acceso exclusivo a pagos, reportes financieros, cuentas y contabilidad.', color:'#9c64ff', icon:'CNT' },
  Empleado: { desc:'Empleado general. Hace casi todo menos configuraciÃ³n y gestiÃ³n de usuarios.', color:'#ff6b6b', icon:'EMP' },
  'Vendedor Concesionario': { desc:'Vendedor de un concesionario externo. Solo calculadora, clientes y solicitudes. Los crÃ©ditos requieren aprobaciÃ³n del admin.', color:'#0ea5e9', icon:'VCO' }
};

// Helper: devuelve true si el usuario es un Empleado (o legacy Cobrador/Vendedor)
function isEmpleadoRole(){
  if(!S.currentUser) return false;
  var r = S.currentUser.rol;
  return r === 'Empleado' || r === 'Cobrador' || r === 'Vendedor';
}

// Vendedor Concesionario: rol especial con sidebar reducido (solo 3 mÃ³dulos)
function isVendedorConcesionarioRole(){
  if(!S.currentUser) return false;
  return S.currentUser.rol === 'Vendedor Concesionario';
}

// Permisos efectivos del usuario actual
function getPermsEfectivos(){
  if(isAdminUser()) return Object.keys(PGL).concat(['perm_delete']);
  // Todos los demÃ¡s roles (incluido Empleado / Cobrador / Vendedor):
  // respetar los permisos configurados por el administrador
  return getCurrentPerms();
}

function hasModuleAccess(key){
  if(isAdminUser()) return true;
  // Vendedor Concesionario: solo 3 mÃ³dulos permitidos
  if(isVendedorConcesionarioRole()){
    return key === 'motos' || key === 'clientes' || key === 'creditos';
  }
  return getPermsEfectivos().includes(key);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// LISTENER EN TIEMPO REAL DEL USUARIO ACTUAL
// Cuando el admin cambia rol/permisos en Firestore, el usuario afectado
// recibe la actualizaciÃ³n al instante: sidebar se redibuja, mÃ³dulos
// nuevos aparecen y los retirados desaparecen sin necesidad de re-login.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
window._currentUserUnsub = null;
function _detachCurrentUserListener(){
  if(typeof window._currentUserUnsub === 'function'){
    try{ window._currentUserUnsub(); }catch(e){}
    window._currentUserUnsub = null;
  }
}
function _attachCurrentUserListener(uid){
  if(!db || !uid) return;
  _detachCurrentUserListener();
  try{
    window._currentUserUnsub = db.collection('usuarios').doc(uid).onSnapshot(function(doc){
      if(!doc || !doc.exists) return;
      if(!S.currentUser || S.currentUser.uid !== uid) return;
      var data = doc.data() || {};
      var prevRol = S.currentUser.rol;
      var prevPerms = (S.currentUser.permisos||[]).slice().sort().join('|');
      var nuevoRol = data.rol || S.currentUser.rol;
      var nuevosPerms = Array.isArray(data.permisos) ? data.permisos.slice() : (S.currentUser.permisos||[]);
      var newPermsKey = nuevosPerms.slice().sort().join('|');
      // Si nada cambiÃ³, salir
      if(prevRol === nuevoRol && prevPerms === newPermsKey){
        // Solo actualizar nombre si cambiÃ³
        if(data.nombre && data.nombre !== S.currentUser.nombre){
          S.currentUser.nombre = data.nombre;
          if(typeof updateSidebarFooter === 'function') updateSidebarFooter();
        }
        return;
      }
      // Si fue suspendido por admin, cerrar sesiÃ³n
      if(data.suspendido === true && typeof auth !== 'undefined' && auth){
        try{ toast('Tu cuenta ha sido suspendida','error'); }catch(e){}
        setTimeout(function(){ try{ auth.signOut(); }catch(e){} }, 1200);
        return;
      }
      // Aplicar cambios al usuario en memoria
      S.currentUser.rol = nuevoRol;
      S.currentUser.permisos = nuevosPerms;
      if(data.nombre) S.currentUser.nombre = data.nombre;
      S.currentUser.concesionarios = data.concesionarios || [];
      S.currentUser.comisiones = data.comisiones || null;
      // Auto-set sede activa si tiene 1 sola asignada
      try{
        var _asgn = S.currentUser.concesionarios || [];
        if(_asgn.length === 1){
          S.concesionarioActivo = _asgn[0];
          try{ localStorage.setItem('concesionarioActivo', _asgn[0]); }catch(e){}
        } else if(_asgn.length > 1 && _asgn.indexOf(S.concesionarioActivo) === -1){
          S.concesionarioActivo = _asgn[0];
          try{ localStorage.setItem('concesionarioActivo', _asgn[0]); }catch(e){}
        }
      }catch(e){}
      if(typeof _renderConcSwitcher === 'function') _renderConcSwitcher();
      // Avisar al usuario
      try{
        if(prevRol !== nuevoRol){
          toast('Tu rol fue actualizado a '+nuevoRol,'info');
        } else {
          toast('Tus permisos fueron actualizados','info');
        }
      }catch(e){}
      // Redibujar sidebar (mostrarÃ¡/ocultarÃ¡ mÃ³dulos segÃºn los nuevos permisos)
      if(typeof renderSidebar === 'function') renderSidebar();
      if(typeof updateSidebarFooter === 'function') updateSidebarFooter();
      // Si la pÃ¡gina actual ya no es accesible, mover al dashboard (o primer mÃ³dulo permitido)
      if(S.page && typeof hasModuleAccess === 'function' && !hasModuleAccess(S.page)){
        var fallback = ['dash','centro','clientes','creditos','pagos','cobranza'].find(function(k){ return hasModuleAccess(k); });
        if(fallback && typeof nav === 'function') nav(fallback);
      } else if(S.page && typeof nav === 'function'){
        // Repintar la pÃ¡gina actual por si depende de permisos (ej. botones de eliminar)
        try{ nav(S.page); }catch(e){}
      }
    }, function(err){
      // Errores silenciosos: el usuario ya verÃ¡ los cambios al refrescar
      console&&console.warn&&console.warn('Listener usuario:', err && err.message);
    });
  }catch(e){
    // Si falla, no rompemos nada â€” la sesiÃ³n continÃºa funcionando
  }
}

// â”€â”€ Sidebar dinÃ¡mico: solo muestra mÃ³dulos con acceso â”€â”€
function renderSidebar(){
  var sb = document.querySelector('.sb-nav');
  if(!sb) return;
  if(!S.currentUser){ return; }

  // Empleado (o legacy Cobrador/Vendedor): sidebar especializado con Nueva Solicitud
  // pero respetando los permisos configurados por el administrador
  if(isEmpleadoRole()){
    var permsEmp = getCurrentPerms();
    var grposEmp = [
      {label:'Mi Trabajo', keys:['dash','centro']},
      {label:'GestiÃ³n', keys:['clientes','motos','creditos','pagos']},
      {label:'Operaciones',keys:['cobranza','contratos','notif']},
      {label:'AnÃ¡lisis', keys:['reportes','cuentas','comisiones']},
      {label:'Sistema', keys:['plan','config','scores','users']},
    ];
    var iconMapEmp = {
      dash:'DB',centro:'WK',clientes:'CLI',motos:'MOT',creditos:'SOL',pagos:'PAG',
      cobranza:'COB',contratos:'CTR',notif:'NOT',reportes:'RPT',
      cuentas:'CTA',comisiones:'CMS',conta:'CNT',plan:'PLN',config:'CFG',scores:'SCR',users:'USR'
    };
    var nameMapEmp = { dash:'Mi Dashboard', creditos:'Solicitudes' };
    var extraMapEmp = {cobranza:'<span class="si-bx" id="sb-badge-cob"></span>', centro:'<span class="si-bx" id="sb-badge-wt"></span>'};

    var sidebarEmp = '<div style="padding:10px 8px">'
      +'<div style="margin-bottom:6px">'
      +'<button type="button" style="display:flex;align-items:center;gap:9px;padding:11px 12px;border-radius:12px;background:var(--p1);color:#fff;border:none;cursor:pointer;font-family:var(--f);font-size:13px;font-weight:700;width:100%" onclick="openAddCred()">'
      +'<span style="font-size:16px;font-weight:900;line-height:1">ï¼‹</span><span>Nueva Solicitud</span></button>'
      +'</div>'
      + grposEmp.map(function(g){
          var items = g.keys.filter(function(k){ return permsEmp.includes(k); });
          if(!items.length) return '';
          return '<div class="sb-grp"><div class="sb-lbl">'+g.label+'</div>'
            +items.map(function(k){
              var label = nameMapEmp[k] || PGL[k];
              return '<button type="button" class="si" data-nav="'+k+'" onclick="nav(\''+k+'\')">'
                +'<span class="sic nav-ic">'+iconMapEmp[k]+'</span><span>'+label+'</span>'+(extraMapEmp[k]||'')+'</button>';
            }).join('')
            +'</div>';
        }).join('')
      +'</div>';
    sb.innerHTML = sidebarEmp;
    updateSidebarFooter();
    return;
  }

  // Vendedor Concesionario: sidebar MUY reducido (solo 3 mÃ³dulos esenciales)
  // No ve admin, finanzas, GPS, otros concesionarios â€” nada de eso
  if(isVendedorConcesionarioRole()){
    var sidebarVC = '<div style="padding:10px 8px">'
      +'<div style="margin-bottom:6px">'
      +'<button type="button" style="display:flex;align-items:center;gap:9px;padding:11px 12px;border-radius:12px;background:var(--p1);color:#fff;border:none;cursor:pointer;font-family:var(--f);font-size:13px;font-weight:700;width:100%" onclick="openAddCred()">'
      +'<span style="font-size:16px;font-weight:900;line-height:1">ï¼‹</span><span>Nueva Solicitud</span></button>'
      +'</div>'
      +'<div class="sb-grp"><div class="sb-lbl">Mi Trabajo</div>'
      +'<button type="button" class="si" data-nav="motos" onclick="nav(\'motos\')"><span class="sic nav-ic">CAL</span><span>Calculadora</span></button>'
      +'<button type="button" class="si" data-nav="clientes" onclick="nav(\'clientes\')"><span class="sic nav-ic">CLI</span><span>Clientes</span></button>'
      +'<button type="button" class="si" data-nav="creditos" onclick="nav(\'creditos\')"><span class="sic nav-ic">SOL</span><span>Solicitudes</span></button>'
      +'</div>'
      +'</div>';
    sb.innerHTML = sidebarVC;
    updateSidebarFooter();
    return;
  }

  // Otros roles: filtrar mÃ³dulos segÃºn permisos
  var perms = getCurrentPerms();
  var grupos = [
    {label:'Principal', keys:['dash','centro']},
    {label:'GestiÃ³n', keys:['clientes','motos','creditos','pagos']},
    {label:'Operaciones',keys:['cobranza','contratos','notif','aprobaciones']},
    {label:'AnÃ¡lisis', keys:['reportes','cuentas','comisiones']},
    {label:'Sistema', keys:['plan','config','concesionarios','scores','users']},
  ];
  var iconMap = {
    dash:'DB',centro:'WK',clientes:'CLI',motos:'MOT',creditos:'FIN',pagos:'PAG',
    cobranza:'COB',contratos:'CTR',notif:'NOT',reportes:'RPT',aprobaciones:'APR',
    cuentas:'CTA',comisiones:'CMS',conta:'CNT',plan:'PLN',config:'CFG',scores:'SCR',users:'USR',concesionarios:'CNC'
  };
  var extraMap = {cobranza:'<span class="si-bx" id="sb-badge-cob"></span>', centro:'<span class="si-bx" id="sb-badge-wt"></span>'};

  sb.innerHTML = grupos.map(function(g){
    var items = g.keys.filter(function(k){ return isAdminUser() || perms.includes(k); });
    if(!items.length) return '';
    return '<div class="sb-grp"><div class="sb-lbl">'+g.label+'</div>'
      +items.map(function(k){
        return '<button type="button" class="si" data-nav="'+k+'" onclick="nav(\''+k+'\')">'
          +'<span class="sic nav-ic">'+iconMap[k]+'</span><span>'+PGL[k]+'</span>'+(extraMap[k]||'')+'</button>';
      }).join('')
      +'</div>';
  }).join('');
  updateSidebarFooter();
}

function updateSidebarFooter(){
  if(!S.currentUser) return;
  var nombre = S.currentUser.nombre || S.currentUser.email || 'Usuario';
  var rol = S.currentUser.rol || 'Usuario';
  var inics = nombre.split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase()||'U';
  var rolColors = {Administrador:'var(--p1)',Gerente:'var(--p2)',Empleado:'var(--green)',Vendedor:'var(--green)',Cobrador:'var(--green)',Contador:'var(--ink3)'};
  var rolColor = rolColors[rol] || 'var(--p1)';

  var sbUn = document.querySelector('.sb-un');
  var sbAv = document.querySelector('.sb-av');
  var sbUr = document.querySelector('.sb-ur');
  var mobAv = document.getElementById('mob-av');

  if(sbUn) sbUn.textContent = nombre;
  if(sbAv){ sbAv.textContent = inics; sbAv.style.background = rolColor; }
  if(sbUr){ sbUr.textContent = rol; sbUr.style.background = rolColor; sbUr.style.webkitTextFillColor = '#fff'; sbUr.style.webkitBackgroundClip = 'unset'; sbUr.style.backgroundClip = 'unset'; sbUr.style.color = '#fff'; sbUr.style.fontSize = '10px'; sbUr.style.fontWeight = '700'; sbUr.style.padding = '2px 8px'; sbUr.style.borderRadius = '20px'; }
  if(mobAv){ mobAv.textContent = inics; mobAv.style.background = rolColor; }

  // Also update the footer card to be clickable for all roles
  var sbFoot = document.querySelector('.sb-foot');
  if(sbFoot && !sbFoot.querySelector('.sb-usr[onclick]')){
    var usr = sbFoot.querySelector('.sb-usr');
    if(usr) usr.setAttribute('onclick','showAdminProfile()');
  }

  // â”€â”€ Badge de mora automÃ¡tico â”€â”€
  actualizarBadgeMora();
}

function actualizarBadgeMora(){
  try{
    var cob = document.getElementById('sb-badge-cob');
    if(!cob) return;
    var enMora = _concFiltrar(S.creds||[]).filter(function(c){return !c.eliminado && c.mora>0 && c.estado==='activo';}).length;
    if(enMora>0){
      cob.textContent = enMora;
      cob.style.display='flex';
      cob.style.background='var(--red)';
      cob.style.color='#fff';
      cob.style.fontSize='10px';
      cob.style.fontWeight='900';
      cob.style.minWidth='18px';
      cob.style.height='18px';
      cob.style.borderRadius='9px';
      cob.style.alignItems='center';
      cob.style.justifyContent='center';
      cob.style.padding='0 5px';
    } else {
      cob.textContent='';
      cob.style.display='none';
    }
    // Toast de alerta si hay crÃ©ditos nuevos en mora (mora entre 1-3 dÃ­as)
    var _moraKey = 'pagasi_mora_alert_'+new Date().toISOString().slice(0,10);
    if(enMora>0 && !sessionStorage.getItem(_moraKey)){
      var nuevosEnMora = _concFiltrar(S.creds||[]).filter(function(c){return !c.eliminado && c.mora>0 && c.mora<=3 && c.estado==='activo';});
      if(nuevosEnMora.length>0){
        sessionStorage.setItem(_moraKey,'1');
        setTimeout(function(){
          toast('âš ï¸ '+nuevosEnMora.length+' crÃ©dito'+(nuevosEnMora.length>1?'s':'')+(nuevosEnMora.length>1?' entraron':' entrÃ³')+' en mora hoy','warning',6000);
        }, 1500);
      }
    }
  }catch(e){}
}
function canDeleteAction(){ return isAdminUser() || getCurrentPerms().includes('perm_delete'); }

// â”€â”€ Pantalla de bienvenida para Vendedor â”€â”€
function requireDeletePermission(){
  if(canDeleteAction()) return true;
  toast('No tienes permiso para eliminar','error');
  return false;
}

// Variables globales de configuraciÃ³n
var _cuentasBanc = [];
var _cobradores = ['Juan Admin'];
// Datos de la empresa (nombre, RIF, ciudad, tel, email) â€” se usan en contratos y reportes
// Fuente Ãºnica de verdad que NO depende del DOM (Config solo existe cuando estÃ¡s en esa pÃ¡gina)
var _empresa = { nombre:'Pagasi', rif:'J-00000000-0', ciudad:'Caracas', tel:'', email:'', direccion:'', representante:'', repCI:'' };

// Helper global para leer empresa de forma consistente.
// Primero intenta el DOM (por si estÃ¡ en Config editÃ¡ndose), si no usa la variable cacheada.
function getEmpresa(){
  var nombre = ($('cfg_empresa')&&$('cfg_empresa').value) || _empresa.nombre || 'Pagasi';
  var rif = ($('cfg_rif') &&$('cfg_rif').value) || _empresa.rif || 'J-00000000-0';
  var ciudad = ($('cfg_ciudad') &&$('cfg_ciudad').value) || _empresa.ciudad || 'Caracas';
  var tel = ($('cfg_tel') &&$('cfg_tel').value) || _empresa.tel || '';
  var email = ($('cfg_email2') &&$('cfg_email2').value) || _empresa.email || '';
  var direccion = ($('cfg_direccion') &&$('cfg_direccion').value) || _empresa.direccion || '';
  var representante= ($('cfg_representante')&&$('cfg_representante').value)|| _empresa.representante|| '';
  var repCI = ($('cfg_rep_ci') &&$('cfg_rep_ci').value) || _empresa.repCI || '';
  return { nombre:nombre.trim(), rif:rif.trim(), ciudad:ciudad.trim(), tel:tel.trim(), email:email.trim(), direccion:direccion.trim(), representante:representante.trim(), repCI:repCI.trim() };
}

// Cargar datos de empresa desde Firebase al iniciar

function updateBadge(){
  const b=$('mora-badge');
  if(b) b.textContent=S.creds.filter(c=>c.mora>0).length;
  var wb=$('sb-badge-wt');
  if(wb){
    var n=(S.tareas||[]).filter(function(t){return !t.eliminado && t.estado!=='completada' && (typeof wtIsMine!=='function' || wtIsMine(t));}).length;
    wb.textContent=n||'';
    wb.style.display=n?'inline-flex':'none';
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// HISTORY / BACK BUTTON HANDLING
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Evita que el botÃ³n "atrÃ¡s" del navegador saque al usuario del sistema.
// Cada navegaciÃ³n interna (nav) hace pushState; el popstate navega
// internamente o cierra modales abiertos.
window._navFromPop = false; // flag: evita push cuando venimos de popstate

function _isModalOpen(){
  try {
    var ov = document.getElementById('ov');
    if(!ov) return false;
    var d = ov.style.display;
    return d && d !== 'none';
  } catch(e){ return false; }
}

function _pushNavState(p){
  try {
    window.history.pushState({app:'pagasi', page:p, t:Date.now()}, '', window.location.href);
  } catch(e){}
}

function _replaceNavState(p){
  try {
    window.history.replaceState({app:'pagasi', page:p, t:Date.now()}, '', window.location.href);
  } catch(e){}
}

window.addEventListener('popstate', function(ev){
  // Si hay un modal abierto, ciÃ©rralo y vuelve a poner el estado
  // (no dejamos que el back "navegue" cuando hay un diÃ¡logo).
  if(_isModalOpen()){
    try { if(typeof closeM==='function') closeM(); } catch(e){}
    // Reponer el estado para que quedemos en la misma pÃ¡gina
    _pushNavState(S.page || 'dash');
    return;
  }
  // Si el usuario aÃºn no ha iniciado sesiÃ³n, no hacemos nada raro
  if(!S.currentUser){
    // Reponer para que no se salga
    _pushNavState('login');
    return;
  }
  // Navegar a la pÃ¡gina del estado (si existe) o al dashboard
  var target = (ev.state && ev.state.page) ? ev.state.page : 'dash';
  window._navFromPop = true;
  try { nav(target); } finally { window._navFromPop = false; }
});

function nav(p){
  if(typeof closeMobileMenu==='function') closeMobileMenu();
  // Verificar permiso
  if(S.currentUser){
    if(!hasModuleAccess(p)){
      document.querySelectorAll('.si').forEach(function(e){e.classList.remove('on');});
      $('pgT').textContent = 'Sin acceso'; if($('pgT-mob')) $('pgT-mob').textContent='Sin acceso';
      $('cnt').innerHTML = '<div class="empty" style="padding:80px 20px;text-align:center"><div style="font-size:48px;margin-bottom:14px;opacity:0.4">ðŸ”’</div><div class="e-tt" style="font-size:18px;font-weight:800;margin-bottom:8px">Acceso restringido</div><div style="font-size:13px;color:var(--ink3);line-height:1.6;max-width:380px;margin:0 auto">No tienes permiso para ver este mÃ³dulo.<br>Contacta al administrador.</div></div>';
      return;
    }
  }
  // Registrar en el history del navegador (solo si NO venimos de popstate,
  // para evitar duplicados infinitos al dar back).
  if(!window._navFromPop){
    // Si es la primera navegaciÃ³n de la sesiÃ³n, reemplazamos el estado base;
    // en las siguientes, hacemos push.
    if(!window.history.state || !window.history.state.app){
      _replaceNavState(p);
    } else if(window.history.state.page !== p){
      _pushNavState(p);
    }
  }
  S.page=p;
  S.clienteFiltro='';
  window._pages={}; // reset pagination on module change
  if(p !== 'cuentas') window._cuentasDetalle = null; // reset account detail view
  document.querySelectorAll('.si').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.si[data-nav]').forEach(e=>{if(e.dataset.nav===p)e.classList.add('on');});
  $('pgT').textContent=PGL[p]||p; if($('pgT-mob')) $('pgT-mob').textContent=PGL[p]||p;
  updateTopbar();
  if(typeof _renderConcSwitcher === 'function') _renderConcSwitcher();
  if(window.innerWidth<=820) updateMobileNav();
  const fn=PG[p];
  if(fn){
    if(p==='dash'){
      showSkeleton();
      setTimeout(function(){
        $('cnt').innerHTML=fn();
        updateBadge();
        if(!isEmpleadoRole()){
          if(typeof renderDashChart==='function') renderDashChart();
          setTimeout(function(){ if(typeof renderCredChart==='function') renderCredChart(); }, 50);
          setTimeout(function(){ if(typeof renderMoraChart==='function') renderMoraChart(); }, 80);
          setTimeout(function(){ if(typeof renderDashEgrChart==='function') renderDashEgrChart(); }, 200);
          setTimeout(function(){
            if(typeof renderCredChart==='function') renderCredChart();
            if(typeof renderDashChart==='function' && !_dashChart) renderDashChart();
            if(typeof renderDashEgrChart==='function') renderDashEgrChart();
          }, 900);
          setTimeout(function(){
            if(typeof renderDashEgrChart==='function') renderDashEgrChart();
          }, 2500);
        }
      },80);
    }
    else {
      $('cnt').innerHTML=fn(); wtInjectDataLabels();
      if(p==='finanzas'){
        setTimeout(function(){ if(typeof renderFinIngChart==='function') renderFinIngChart(); }, 150);
        setTimeout(function(){ if(typeof renderFinIngChart==='function') renderFinIngChart(); }, 600);
        setTimeout(function(){ if(typeof renderFinIngChart==='function') renderFinIngChart(); }, 1500);
      }
    }
  } else {
    $('cnt').innerHTML=`<div class="empty"><span class="e-ic" style="font-size:28px;opacity:0.3;display:block;margin-bottom:10px">Â·Â·Â·</span><div class="e-tt">En desarrollo</div></div>`;
  }
  updateBadge();
  wtInjectDataLabels();
}

// â”€â”€ Mobile: inyectar data-label en celdas de tabla para CSS card layout â”€â”€
// Logica de graficos Chart.js movida a logic/charts.js.

const PG = {};
window.PG = PG;

function showSkeleton(){
  var cnt = $('cnt');
  if(!cnt) return;
  var skCards = Array(4).fill(0).map(()=>
    '<div class="sk-card" style="flex:1">'+
      '<div class="sk sk-line" style="width:35%;height:10px"></div>'+
      '<div class="sk sk-val"></div>'+
      '<div class="sk sk-line" style="width:70%"></div>'+
      '<div class="sk sk-line" style="width:50%;margin-top:12px"></div>'+
    '</div>'
  ).join('');
  cnt.innerHTML = '<div class="page">'+
    '<div style="background:var(--surf2);border-radius:12px;height:80px;margin-bottom:18px" class="sk"></div>'+
    '<div style="display:flex;gap:12px;margin-bottom:14px">'+skCards+'</div>'+
    '<div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px">'+
      '<div class="sk-card"><div class="sk sk-title"></div><div class="sk" style="height:110px;border-radius:8px"></div></div>'+
      '<div class="sk-card"><div class="sk sk-title"></div>'+Array(3).fill('<div class="sk sk-line"></div>').join('')+'</div>'+
    '</div>'+
  '</div>';
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MOTO CARD
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Helpers de pago/egreso para compra de motos movidos a logic/moto-pagos.js.

function setCredTab(t){S.credTab=t;S.credFiltro='';window._pages={};nav('creditos');}
function setCredSort(col){var cur=S.credSort||{col:'id',dir:'asc'};S.credSort={col:col,dir:(cur.col===col&&cur.dir==='asc')?'desc':'asc'};window._pages={};nav('creditos');}
function liveSearchCred(q){S.credFiltro=q||'';pgSet('creditos',1);nav('creditos');}
function setCliSort(col){var cur=S.cliSort||{col:'nombre',dir:'asc'};S.cliSort={col:col,dir:(cur.col===col&&cur.dir==='asc')?'desc':'asc'};window._pages={};nav('clientes');}
function setPagosSort(col){var cur=S.pagosSort||{col:'fecha',dir:'desc'};S.pagosSort={col:col,dir:(cur.col===col&&cur.dir==='asc')?'desc':'asc'};window._pages={};nav('pagos');}
function setMotosSort(col){var cur=S.motosSort||{col:'modelo',dir:'asc'};S.motosSort={col:col,dir:(cur.col===col&&cur.dir==='asc')?'desc':'asc'};window._pages={};nav('motos');}
function _thSort(sortState,setFn,col,label){var isActive=sortState.col===col;var arrow=isActive?(sortState.dir==='asc'?'â†‘':'â†“'):'';return '<th onclick="'+setFn+'(\''+col+'\')" style="cursor:pointer;user-select:none;white-space:nowrap">'+label+(arrow?' <span style="color:var(--p1);font-size:10px">'+arrow+'</span>':'<span style="color:var(--ink3);font-size:9px;opacity:.4"> â‡…</span>')+'</th>';}
function getCuotasVencidas(c){
  // Devuelve cuÃ¡ntas cuotas estÃ¡n vencidas sin pagar
  if(!c||c.estado==='completado'||c.estado==='cancelado') return 0;
  var mora = parseInt(c.mora||0,10);
  if(mora<=0) return 0;
  return Math.ceil(mora/15); // 1 cuota cada 15 dÃ­as
}
function setPagosTab(t){S.pagosTab=t;window._pages={};nav('pagos');}
function setReportesTab(t){S.reportesTab=t;nav('reportes');}
window.setReportesTab=setReportesTab;

// Resincroniza S.motos con Firebase, descartando el cachÃ© local.
// Ãštil cuando el cachÃ© local tiene motos "fantasma" que ya no existen en Firebase
// (p.ej. duplicados creados por un bug antiguo, o motos borradas manualmente desde la consola de Firebase).

function confirmarEliminacion(opts){
  // opts: { titulo, descripcion, onConfirm }
  window._delAuditCallback = opts.onConfirm;
  $('mic').textContent='Del';
  $('mtt').textContent = opts.titulo || 'Eliminar registro';
  $('msb').textContent = 'Esta acciÃ³n quedarÃ¡ registrada con tu nombre';
  $('modal-box').className='modal';
  $('mbd').innerHTML = '<div style="text-align:center;padding:8px 0 14px">'
    +'<div style="font-size:40px;margin-bottom:10px"></div>'
    +'<div style="font-size:14px;font-weight:800;margin-bottom:6px">'+(opts.descripcion||'Â¿Confirmar eliminaciÃ³n?')+'</div>'
    +'<div style="color:var(--ink3);font-size:12px;margin-bottom:14px">QuedarÃ¡ registrado como eliminado por <strong>'+((S.currentUser&&S.currentUser.nombre)||'Administrador')+'</strong></div>'
    +'</div>'
    +'<div class="fg"><label>RazÃ³n de la eliminaciÃ³n (obligatorio)</label>'
    +'<select class="fs" id="del_razon">'
    +'<option value="">â€” Seleccionar â€”</option>'
    +'<option>Error de captura</option>'
    +'<option>Pago duplicado</option>'
    +'<option>Cliente solicitÃ³ reverso</option>'
    +'<option>Monto incorrecto</option>'
    +'<option>OperaciÃ³n cancelada</option>'
    +'<option>Orden del administrador</option>'
    +'<option>Otro</option>'
    +'</select></div>'
    +'<div class="fg" style="margin-top:8px" id="del_otro_wrap" style="display:none">'
    +'<label>Especifica la razÃ³n</label>'
    +'<input class="fi" id="del_otro" placeholder="Describe la razÃ³n..."></div>';
  // Show text input when "Otro" selected
  setTimeout(function(){
    var sel = $('del_razon');
    if(sel) sel.onchange = function(){
      var wrap = $('del_otro_wrap');
      if(wrap) wrap.style.display = sel.value==='Otro' ? 'block' : 'none';
    };
  }, 50);
  $('mft').innerHTML='<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    +'<button class="btn btn-d" onclick="ejecutarEliminacionAuditada()">Eliminar</button>';
  $('ov').style.display='flex';
}

function ejecutarEliminacionAuditada(){
  if(!requireDeletePermission()) return;
  var razon = ($('del_razon')&&$('del_razon').value)||'';
  if(razon==='Otro') razon = ($('del_otro')&&$('del_otro').value.trim())||'Otro';
  if(!razon){ toast('Debes seleccionar una razÃ³n','error'); return; }
  var auditInfo = {
    eliminado: true,
    eliminadoPor: (S.currentUser&&S.currentUser.nombre)||'Administrador',
    eliminadoPorUid: (S.currentUser&&S.currentUser.uid)||'',
    eliminadoEn: new Date().toISOString(),
    eliminadoRazon: razon
  };
  closeM();
  if(window._delAuditCallback) window._delAuditCallback(auditInfo);
  window._delAuditCallback = null;
}

function auditBadge(item){
  if(!item||!item.eliminado) return '';
  var por = item.eliminadoPor || 'Admin';
  var razon = item.eliminadoRazon || '';
  var fecha = item.eliminadoEn ? item.eliminadoEn.split('T')[0] : '';
  return '<div style="background:var(--reds);border:1px solid rgba(240,75,106,0.3);border-radius:6px;padding:4px 9px;font-size:10px;display:flex;align-items:center;gap:6px;margin-top:4px">'
    +'<span style="font-weight:900;color:var(--red)">Del ELIMINADO</span>'
    +'<span style="color:var(--ink3)">por <strong>'+por+'</strong>'+(fecha?' Â· '+fecha:'')+(razon?' Â· '+razon:'')+'</span>'
    +'</div>';
}

// CLIENTE CRUD
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â•â•â• RESTAURAR PAGO ELIMINADO â•â•â•
// Logica de pagos, cobranza, mora y liquidaciones movida a logic/pagos.js.

// Logica de contratos y documentos legales movida a logic/contratos.js.

// Logica de egresos movida a logic/egresos.js.

// Logica de alertas, recibos, facturas y libro SENIAT movida a logic/facturacion.js.

// Logica de comisiones movida a logic/comisiones.js.

function closeM(){
  $('ov').style.display='none';
  $('modal-box').className='modal';
  $('mft').style.display='';
  if($('mbd')) $('mbd').style.padding='';
  $('mft').innerHTML=`<button class="btn btn-g" onclick="closeM()">Cancelar</button><button class="btn btn-p" onclick="saveM()">Guardar</button>`;
}
function saveM(){if(S.saveFn)S.saveFn();}
function topAct(){
  var p=S.page;
  // Solicitud es el punto de entrada Ãºnico para clientes + motos + financiamientos
  if(p==='dash') openAddCred();
  else if(p==='centro') openWtTask();
  else if(p==='clientes') openAddCred();
  else if(p==='creditos') openAddCred();
  // Inventario de motos: sÃ­ se pueden agregar unidades sueltas al stock
  else if(p==='motos') openAddMoto();
  // Operaciones
  else if(p==='pagos') openAddPago();
  else if(p==='conta') openAddEgreso();
  else if(p==='cuentas') openDeposito(null);
  else if(p==='plan') openAddCatalogo();
  else if(p==='cobranza') openAddPago();
  else if(p==='contratos') openAddCred();
}

// Map pages to button labels (empty = hide button)
var TOP_BTN_LABELS = {
  dash: 'Nueva Solicitud',
  centro: 'Nueva tarea',
  clientes: 'Nueva Solicitud',
  creditos: 'Nueva Solicitud',
  contratos: 'Nueva Solicitud',
  motos: 'Nueva Unidad al Inventario',
  pagos: 'Registrar Pago',
  conta: 'Nuevo Egreso',
  cuentas: 'Depositar',
  plan: 'Agregar Modelo',
  cobranza: 'Registrar Pago',
};

function updateTopbar(){
  var p = S.page;
  // + Nuevo button
  var btn = $('topNewBtn');
  var label = $('topNewLabel');
  var lbl = TOP_BTN_LABELS[p];
  if(btn){
    if(lbl){ btn.style.display=''; label.textContent=lbl; }
    else { btn.style.display='none'; }
  }
  // Notification dot
  var mora = S.creds.filter(function(c){return c.mora>0;}).length;
  var pend = S.pagos.filter(function(p){return p.estado==='pendiente';}).length;
  var dot = $('notif-dot');
  if(dot){
    dot.style.display = (mora+pend>0) ? '' : 'none';
    dot.textContent = '';
  }
  // Notification bell badge in mobile
  updateBadge();
}
function toast(msg,type='info'){
  const c=$('toasts'),t=document.createElement('div');t.className=`toast ${type}`;
  const ic={success:'âœ“',error:'OFF',info:'â„¹ï¸',warn:''};
  t.innerHTML=`<span>${ic[type]||'â„¹ï¸'}</span><span>${msg}</span>`;c.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(12px)';t.style.transition='all .26s';},3000);
  setTimeout(()=>t.remove(),3300);
}

// GUARDAR CONFIGURACIÃ“N


// Mora auto recalculation â€” refresh every 5 minutes while app is open
(function(){
  function autoMora(){ if(typeof calcularMoraAuto==='function' && S.creds && S.creds.length) calcularMoraAuto(); }
  setInterval(autoMora, 5*60*1000);
})();

function recargarDesdeFirebase(){
  if(!db){
    toast('Firebase no estÃ¡ configurado','error');
    return;
  }
  if(!confirm('Â¿Limpiar el cachÃ© local y recargar todos los valores desde Firebase?\n\nSe descartarÃ¡n los cambios sin guardar en pantalla.')) return;

  toast('Sincronizando con Firebase...','info');

  // 1) Limpiar cachÃ© en memoria de configuraciÃ³n
  try {
    _empresa = { nombre:'Pagasi', rif:'J-00000000-0', ciudad:'Caracas', tel:'', email:'', direccion:'', representante:'', repCI:'' };
    _cuentasBanc = [];
    _cobradores = ['Juan Admin'];
    window._tasaBsGlobal = 1;
    window._planesExtra = [];
  } catch(e){ /* variables pueden no estar definidas todavÃ­a */ }

  // 2) Limpiar cachÃ© de motos en localStorage para forzar lectura limpia
  try {
    if(typeof localStorage !== 'undefined'){
      localStorage.removeItem('motosCache');
      localStorage.removeItem('motosCacheV2');
    }
  } catch(e){}

  // 3) Recargar configuraciones especÃ­ficas desde Firestore
  var tareas = [];

  // Empresa
  tareas.push(
    db.collection('config').doc('empresa').get().then(function(doc){
      if(doc.exists){
        var d = doc.data() || {};
        _empresa = {
          nombre: d.nombre || 'Pagasi',
          rif: d.rif || 'J-00000000-0',
          ciudad: d.ciudad || 'Caracas',
          tel: d.tel || '',
          email: d.email || '',
          direccion: d.direccion || '',
          representante: d.representante || '',
          repCI: d.repCI || ''
        };
      }
    })
  );

  // Tasa Bs
  tareas.push(
    db.collection('config').doc('tasa').get().then(function(doc){
      if(doc.exists && doc.data().tasaBs) window._tasaBsGlobal = doc.data().tasaBs;
    })
  );

  // Cuentas bancarias
  tareas.push(
    db.collection('config').doc('cuentasBanc').get().then(function(doc){
      var lista = (doc.exists && doc.data().lista) ? doc.data().lista : [];
      if(typeof renderCuentasBanc === 'function') renderCuentasBanc(lista);
      else _cuentasBanc = lista;
    })
  );

  // Cobradores
  tareas.push(
    db.collection('config').doc('cobradores').get().then(function(doc){
      var lista = (doc.exists && doc.data().lista) ? doc.data().lista : ['Juan Admin'];
      if(typeof renderCobradores === 'function') renderCobradores(lista);
      else _cobradores = lista;
    })
  );

  // Score config
  tareas.push(
    db.collection('config').doc('score').get().then(function(doc){
      if(doc.exists && typeof SCORE_CFG !== 'undefined'){
        var d = doc.data() || {};
        Object.keys(d).forEach(function(k){ SCORE_CFG[k] = d[k]; });
      }
    }).catch(function(){})
  );

  // Roles y permisos personalizados
  tareas.push(
    db.collection('config').doc('rolesPermisos').get().then(function(doc){
      if(doc.exists && typeof ROL_PERMISOS !== 'undefined'){
        var d = doc.data() || {};
        Object.keys(d).forEach(function(rol){
          if(Array.isArray(d[rol])) ROL_PERMISOS[rol] = d[rol];
        });
      }
    }).catch(function(){})
  );

  // 4) Recargar todos los datos principales (motos, clientes, crÃ©ditos, pagos, etc.)
  // a travÃ©s de DB.load() â€” recarga PLAN, CATALOGO, planes extra, etc.
  tareas.push(
    (typeof DB !== 'undefined' && DB.load) ? DB.load() : Promise.resolve()
  );

  Promise.all(tareas).then(function(){
    toast('âœ“ Datos recargados desde Firebase','success');
    // Re-render de la pÃ¡gina actual para reflejar los nuevos valores
    if(typeof nav === 'function' && S && S.page){
      nav(S.page);
    } else if(typeof nav === 'function'){
      nav('config');
    }
  }).catch(function(e){
    toast('Error al sincronizar: '+(e&&e.message||e),'error');
  });
}

// PUNTO 1 â€” FINIQUITO DE CONTRATO
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Logica de finiquitos, PDFs, CSV, paginacion y reportes movida a logic/reportes.js.

// Logica de cuentas, movimientos, historial y pendientes movida a logic/cuentas.js.

function init() {
  // Mostrar el contenedor principal
  var appRoot = $('app-root');
  if (appRoot) appRoot.style.display = 'flex';

  // Defensa: cerrar cualquier overlay de perfil que haya quedado abierto
  var profOverlay = document.getElementById('profile-overlay');
  if(profOverlay) profOverlay.style.display = 'none';
  document.body.style.overflow = '';

  cargarHistorialNotificaciones();

  // Cargar datos desde Firebase o usar datos locales de demostraciÃ³n
  DB.load().then(function() {
    // â”€â”€ MigraciÃ³n Ãºnica: crÃ©ditos existentes (sin contratoFirmado) â†’ confirmados automÃ¡ticamente â”€â”€
    // Los crÃ©ditos creados ANTES de esta versiÃ³n ya tienen historial contable,
    // asÃ­ que se marcan como firmados sin tocar nada mÃ¡s.
    (function _migrarContratoFirmado(){
      try {
        (S.creds||[]).forEach(function(c){
          if(c && !c.eliminado && c.contratoFirmado === undefined){
            c.contratoFirmado = true;
            c.fechaContratoFirmado = c.fecha || (c.creado||'').split('T')[0] || '';
            if(DB && DB.updateCred) DB.updateCred(c.id, { contratoFirmado: true, fechaContratoFirmado: c.fechaContratoFirmado });
          }
        });
      } catch(e){ console.warn('migrarContratoFirmado error:', e); }
    })();
    renderSidebar();
    // Vendedor Concesionario â†’ calculadora (motos). Otros roles â†’ dashboard.
    var paginaInicial = isVendedorConcesionarioRole() ? 'motos' : 'dash';
    if(!hasModuleAccess(paginaInicial)){
      // Fallback: ir al primer mÃ³dulo accesible
      var candidatos = ['motos','clientes','creditos','dash','centro'];
      paginaInicial = candidatos.find(function(p){ return hasModuleAccess(p); }) || 'dash';
    }
    nav(paginaInicial);
    updateBadge();
    iniciarListenerSolicitudes();
    var isMob = window.innerWidth <= 820;
    var mobBar = $('mobile-topbar');
    var deskBar = $('desktop-topbar');
    if (mobBar) mobBar.style.display = isMob ? 'flex' : 'none';
    if (deskBar) deskBar.style.display = isMob ? 'none' : 'flex';
  }).catch(function(e) {
    console.warn('Error cargando datos:', e);
    renderSidebar();
    var paginaInicial = isVendedorConcesionarioRole() ? 'motos' : 'dash';
    nav(paginaInicial);
    updateBadge();
    iniciarListenerSolicitudes();
  });
}

// â”€â”€ AUTENTICACIÃ“N â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
var _doLoginInProgress = false;
async function doLogin() {
  // Guard: prevent concurrent/loop calls
  if (_doLoginInProgress) return;
  _doLoginInProgress = true;
  setTimeout(function(){ _doLoginInProgress = false; }, 4000);

  // Read from whichever login form is visible
  var loginScreen = $('login-screen');
  var inviteScreen = $('invite-screen');
  var usingInvite = inviteScreen && inviteScreen.style.display !== 'none';
  var email = usingInvite
    ? (($('l_user_inv') || {}).value || '').trim()
    : (($('l_user') || {}).value || '').trim();
  var pass = usingInvite
    ? (($('l_pass_inv') || {}).value || '').trim()
    : (($('l_pass') || {}).value || '').trim();
  var errEl = usingInvite ? $('login-err-inv') : $('login-err');
  if (errEl) errEl.style.display = 'none';

  // Validate email before hitting Firebase
  if (auth && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (errEl) { errEl.textContent = 'El email no tiene un formato vÃ¡lido.'; errEl.style.display = 'block'; }
    _doLoginInProgress = false;
    return;
  }

  if (!email || !pass) {
    if (errEl) { errEl.textContent = 'Ingresa tu email y contraseÃ±a.'; errEl.style.display = 'block'; }
    _doLoginInProgress = false;
    return;
  }

  if (!auth) {
    if (errEl) {
      errEl.textContent = 'Firebase Auth no esta disponible. Revisa la configuracion de Firebase.';
      errEl.style.display = 'block';
    }
    _doLoginInProgress = false;
    return;
  }
  showLoader('Iniciando sesiÃ³n...', '');
  auth.signInWithEmailAndPassword(email, pass)
    .then(function(cred) {
      hideLoader();
      _doLoginInProgress = false;
      setTimeout(function(){
        var appRoot = $('app-root');
        if(window._appInited || (appRoot && appRoot.style.display !== 'none')) return;
        var u = (cred && cred.user) || (auth && auth.currentUser);
        if(!u) return;
        S.currentUser = {
          uid: u.uid,
          email: u.email,
          nombre: u.displayName || (u.email||'').split('@')[0] || 'Usuario',
          rol: 'Administrador',
          permisos: ['dash','centro','clientes','motos','creditos','pagos','cobranza','contratos','notif','reportes','cuentas','comisiones','conta','plan','config','concesionarios','scores','users','aprobaciones','perm_delete'],
          concesionarios: [],
          comisiones: null
        };
        var login = $('login-screen');
        if(login) login.style.display = 'none';
        window._appInited = true;
        init();
      }, 700);
    })
    .catch(function(e) {
      hideLoader();
      _doLoginInProgress = false;
      if (errEl) {
        if (e.code === 'auth/network-request-failed') {
          errEl.textContent = 'Sin conexiÃ³n a internet. Verifica tu red e intenta de nuevo.';
          errEl.style.background = 'rgba(232,152,10,0.08)';
          errEl.style.borderColor = 'rgba(232,152,10,0.3)';
          errEl.style.color = 'var(--amber)';
        } else if (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
          errEl.textContent = 'Usuario o contraseÃ±a incorrectos.';
          errEl.style.background = '';
          errEl.style.borderColor = '';
          errEl.style.color = '';
        } else {
          errEl.textContent = 'Error: ' + (e.message || e.code);
          errEl.style.background = '';
          errEl.style.borderColor = '';
          errEl.style.color = '';
        }
        errEl.style.display = 'block';
      }
      console.warn('Login error:', e.code, e.message);
    });
}
window.doLogin = doLogin;


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// BACKUP â€” Exportar e Importar datos
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•


function showAdminProfile() {
  var user = S.currentUser || {};
  var nombre = user.nombre || user.email || 'Usuario';
  var email = (auth && auth.currentUser) ? auth.currentUser.email : (user.email || 'â€”');
  var rol = user.rol || 'Administrador';
  var inicial = nombre.charAt(0).toUpperCase();

  // â”€â”€ Stats del usuario actual â”€â”€
  var solCreadas = S.creds.filter(function(c){ return c.creadoPor === nombre; }).length;
  var misPagos = S.pagos.filter(function(p){ return !p.eliminado && p.cobrador === nombre; });
  var misPagosConf = misPagos.filter(function(p){ return p.estado==='confirmado'; });
  var pagosReg = misPagos.length;
  var totalCobrado = misPagosConf.reduce(function(a,p){ return a+(parseFloat(p.monto)||0); }, 0);
  var credsActivos = S.creds.filter(function(c){ return !c.eliminado && c.estado === 'activo'; }).length;
  var misClientes= new Set(misPagosConf.map(function(p){ return p.cli; })).size;

  // â”€â”€ Chart: actividad Ãºltimas 12 semanas (pagos cobrados por el user) â”€â”€
  var hoyProf = new Date(); hoyProf.setHours(0,0,0,0);
  var semProf = [];
  for(var i=11;i>=0;i--){
    var ini = new Date(hoyProf); ini.setDate(hoyProf.getDate() - (i*7 + hoyProf.getDay()));
    var fin = new Date(ini); fin.setDate(ini.getDate()+6);
    var iniS = ini.toISOString().slice(0,10);
    var finS = fin.toISOString().slice(0,10);
    var tot = misPagosConf
      .filter(function(p){ return p.fecha>=iniS && p.fecha<=finS; })
      .reduce(function(a,p){ return a+p.monto; }, 0);
    semProf.push({lbl: String(ini.getDate()).padStart(2,'0')+'/'+String(ini.getMonth()+1).padStart(2,'0'), tot:tot});
  }
  var maxSemProf = Math.max(1, ...semProf.map(function(s){ return s.tot; }));

  // â”€â”€ Top 5 clientes mÃ¡s atendidos â”€â”€
  var topClientesMap = {};
  misPagosConf.forEach(function(p){
    if(!topClientesMap[p.cli]) topClientesMap[p.cli] = {nombre:p.cli, total:0, count:0};
    topClientesMap[p.cli].total += p.monto;
    topClientesMap[p.cli].count++;
  });
  var topClientesList = Object.values(topClientesMap).sort(function(a,b){ return b.total-a.total; }).slice(0,5);

  // â”€â”€ Actividad mes actual vs mes anterior â”€â”€
  var mesAct = hoyProf.getFullYear()+'-'+String(hoyProf.getMonth()+1).padStart(2,'0');
  var mesAnt = new Date(hoyProf.getFullYear(), hoyProf.getMonth()-1, 1);
  var mesAntK = mesAnt.getFullYear()+'-'+String(mesAnt.getMonth()+1).padStart(2,'0');
  var pagosMesAct = misPagosConf.filter(function(p){ return p.fecha && p.fecha.startsWith(mesAct); });
  var pagosMesAnt = misPagosConf.filter(function(p){ return p.fecha && p.fecha.startsWith(mesAntK); });
  var cobradoMesAct = pagosMesAct.reduce(function(a,p){return a+p.monto;}, 0);
  var cobradoMesAnt = pagosMesAnt.reduce(function(a,p){return a+p.monto;}, 0);
  var pctCrecimiento = cobradoMesAnt > 0 ? Math.round((cobradoMesAct-cobradoMesAnt)/cobradoMesAnt*100) : (cobradoMesAct>0?100:0);

  // Rol color
  var rolColors = {Administrador:'var(--p1)',Gerente:'var(--p2)',Empleado:'var(--green)',Vendedor:'var(--green)',Cobrador:'var(--green)',Contador:'var(--ink3)'};
  var rolColor = rolColors[rol] || 'var(--p1)';

  // MÃ³dulos accesibles
  var perms = isAdminUser() ? Object.keys(PGL) : (user.permisos || []);
  var modList = perms.filter(function(k){ return PGL[k]; }).map(function(k){ return PGL[k]; });

  // Overlay fullscreen
  var overlay = document.getElementById('profile-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'profile-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2000;background:var(--bg);overflow-y:auto;display:none';
    document.body.appendChild(overlay);
  }
  document.body.style.overflow = 'hidden';
  overlay.style.display = 'block';

  overlay.innerHTML =
    // Header
    '<div style="position:sticky;top:0;z-index:10;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border-bottom:1px solid var(--rim);padding:0 20px;height:56px;display:flex;align-items:center;gap:12px">'
    + '<button onclick="document.getElementById(\'profile-overlay\').style.display=\'none\';document.body.style.overflow=\'\'" style="width:32px;height:32px;border-radius:50%;border:1px solid var(--rim);background:var(--surf2);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;color:var(--ink3);flex-shrink:0">âœ•</button>'
    + '<div style="font-size:15px;font-weight:800;letter-spacing:-.3px;flex:1">Mi Perfil</div>'
    + '<button class="btn btn-d btn-sm" onclick="doLogout()" style="gap:6px">Cerrar sesiÃ³n</button>'
    + '</div>'

    // Body
    + '<div style="max-width:900px;margin:0 auto;padding:24px 20px 80px">'

    // Avatar card con gradient
    + '<div style="background:var(--grad);border-radius:16px;padding:24px;margin-bottom:14px;display:flex;align-items:center;gap:20px;color:#fff;box-shadow:0 10px 40px rgba(37,99,235,.2)">'
      + '<div style="width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,.25);backdrop-filter:blur(10px);border:3px solid rgba(255,255,255,.3);display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;color:#fff;flex-shrink:0">'+ inicial +'</div>'
      + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:22px;font-weight:900;letter-spacing:-.4px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+ nombre +'</div>'
        + '<div style="font-size:13px;opacity:.85;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+ email +'</div>'
        + '<span style="display:inline-block;background:rgba(255,255,255,.25);color:#fff;font-size:11px;font-weight:800;padding:4px 14px;border-radius:20px;letter-spacing:.3px;backdrop-filter:blur(10px)">'+ rol.toUpperCase() +'</span>'
      + '</div>'
    + '</div>'

    // 6 KPI stats
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px;margin-bottom:14px">'
      + _profKpi('Cobrado total', fmt(totalCobrado), 'var(--green)', 'TOT')
      + _profKpi('Este mes', fmt(cobradoMesAct), pctCrecimiento>=0?'var(--p1)':'var(--red)', (pctCrecimiento>=0?'â†‘':'â†“')+' '+Math.abs(pctCrecimiento)+'%')
      + _profKpi('Pagos registrados', pagosReg, 'var(--p1)', 'PAG')
      + _profKpi('Solicitudes creadas', solCreadas, 'var(--amber)', 'SOL')
      + _profKpi('Clientes atendidos', misClientes, 'var(--green)', 'CLI')
      + _profKpi('CrÃ©ditos activos', credsActivos, 'var(--p1)', 'ACT')
    + '</div>'

    // Chart: cobros Ãºltimas 12 semanas
    + '<div style="background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:18px;margin-bottom:14px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">'
        + '<div><div style="font-size:14px;font-weight:800">Mi actividad de cobros</div><div style="font-size:11.5px;color:var(--ink3)">Ãšltimas 12 semanas</div></div>'
        + '<div style="font-weight:900;font-size:15px;color:var(--green)">'+ fmt(semProf.reduce(function(a,s){return a+s.tot;}, 0)) +'</div>'
      + '</div>'
      + (misPagosConf.length > 0
        ? '<div style="display:flex;align-items:flex-end;gap:4px;height:140px">'
          + semProf.map(function(s,i){
              return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">'
                + '<div style="font-size:9px;font-weight:800;color:'+(s.tot>0?'var(--green)':'var(--ink3)')+';height:14px">'+(s.tot>0?fmt(s.tot).replace('$','$').slice(0,7):'')+'</div>'
                + '<div style="flex:1;width:100%;display:flex;align-items:flex-end">'
                  + '<div style="width:100%;background:'+(i===semProf.length-1?'var(--p1)':s.tot>0?'var(--green)':'var(--rim)')+';border-radius:4px 4px 0 0;height:'+(s.tot>0?Math.max(8,Math.round(s.tot/maxSemProf*110)):4)+'px"></div>'
                + '</div>'
                + '<div style="font-size:9px;color:var(--ink3);font-weight:600">'+s.lbl+'</div>'
              + '</div>';
            }).join('')
        + '</div>'
        : '<div style="text-align:center;padding:40px 0;color:var(--ink3);font-size:12.5px">AÃºn no tienes pagos registrados a tu nombre</div>')
    + '</div>'

    // Top clientes
    + (topClientesList.length > 0
      ? '<div style="background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:18px;margin-bottom:14px">'
        + '<div style="font-size:14px;font-weight:800;margin-bottom:12px">Tus top 5 clientes <span style="color:var(--ink3);font-weight:500;font-size:11.5px">Â· por monto cobrado</span></div>'
        + topClientesList.map(function(c,i){
            var pct = totalCobrado>0 ? Math.round(c.total/totalCobrado*100) : 0;
            return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--rim2)">'
              + '<div style="width:28px;height:28px;border-radius:8px;background:var(--grad);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;flex-shrink:0">'+(i+1)+'</div>'
              + '<div style="flex:1;min-width:0">'
                + '<div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+c.nombre+'</div>'
                + '<div style="font-size:10.5px;color:var(--ink3)">'+c.count+' pago'+(c.count!==1?'s':'')+'</div>'
              + '</div>'
              + '<div style="text-align:right;flex-shrink:0">'
                + '<div style="font-size:13.5px;font-weight:900;color:var(--green)">'+fmt(c.total)+'</div>'
                + '<div style="font-size:10.5px;color:var(--ink3)">'+pct+'% de total</div>'
              + '</div>'
            + '</div>';
          }).join('')
      + '</div>'
      : '')

    // MÃ³dulos accesibles
    + '<div style="background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:18px;margin-bottom:14px">'
      + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--ink3);margin-bottom:12px">MÃ³dulos con acceso</div>'
      + (isAdminUser()
          ? '<div style="display:flex;flex-wrap:wrap;gap:6px"><span style="background:var(--gs);color:var(--p1);font-size:11.5px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid var(--rim2)">Acceso total al sistema</span></div>'
          : (modList.length
            ? '<div style="display:flex;flex-wrap:wrap;gap:6px">'
              + modList.map(function(m){ return '<span style="background:var(--surf2);color:var(--ink2);font-size:11.5px;font-weight:600;padding:4px 11px;border-radius:20px;border:1px solid var(--rim)">'+m+'</span>'; }).join('')
              + '</div>'
            : '<div style="color:var(--ink3);font-size:13px">Solo nueva solicitud</div>'))
    + '</div>'

    // Info de sesiÃ³n
    + '<div style="background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:18px;margin-bottom:14px">'
      + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--ink3);margin-bottom:12px">InformaciÃ³n de sesiÃ³n</div>'
      + [
          ['Firebase', db ? 'â— Conectado Â· pagasi-b859b' : 'â— Sin conexiÃ³n', db ? 'var(--green)' : 'var(--red)'],
          ['Email', email, 'var(--ink)'],
          ['UID', (auth && auth.currentUser && auth.currentUser.uid) ? auth.currentUser.uid.slice(0,20)+'â€¦' : '--', 'var(--ink3)'],
          ['Ãšltimo acceso', (auth && auth.currentUser && auth.currentUser.metadata && auth.currentUser.metadata.lastSignInTime) ? new Date(auth.currentUser.metadata.lastSignInTime).toLocaleString('es-VE') : 'â€”', 'var(--ink3)'],
        ].map(function(row){
          return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--rim2)">'
            + '<span style="font-size:12.5px;color:var(--ink3)">'+ row[0] +'</span>'
            + '<span style="font-size:12.5px;font-weight:600;color:'+ row[2] +'">'+ row[1] +'</span>'
            + '</div>';
        }).join('')
    + '</div>'

    // Cambiar contraseÃ±a
    + '<div style="background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:18px;margin-bottom:14px">'
      + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--ink3);margin-bottom:14px">Cambiar ContraseÃ±a</div>'
      + '<div style="display:flex;flex-direction:column;gap:10px">'
        + '<div class="fg"><label>ContraseÃ±a actual</label><input id="prof-pass-current" type="password" class="fi" placeholder="Tu contraseÃ±a actual" autocomplete="current-password" style="width:100%"></div>'
        + '<div class="fg"><label>Nueva contraseÃ±a</label><input id="prof-pass1" type="password" class="fi" placeholder="MÃ­nimo 6 caracteres" autocomplete="new-password" style="width:100%"></div>'
        + '<div class="fg"><label>Confirmar contraseÃ±a</label><input id="prof-pass2" type="password" class="fi" placeholder="Repetir contraseÃ±a" autocomplete="new-password" style="width:100%"></div>'
        + '<div id="prof-msg" style="display:none;font-size:12px;padding:9px 12px;border-radius:9px"></div>'
        + '<button class="btn btn-p btn-sm" onclick="cambiarPasswordPerfil()" style="align-self:flex-start">Actualizar contraseÃ±a</button>'
      + '</div>'
    + '</div>'

    // Cerrar sesiÃ³n
    + '<button class="btn btn-d" onclick="doLogout()" style="width:100%;justify-content:center;padding:12px;border-radius:12px;font-size:13.5px">Cerrar sesiÃ³n</button>'

    + '</div>'; // end body
}

function _profKpi(label, val, color, badge){
  return '<div class="stat" style="border-left:3px solid '+color+'">'
    + '<div class="st-ic" style="background:var(--gs);color:'+color+';font-size:9px;font-weight:800">'+badge+'</div>'
    + '<div class="st-v" style="color:'+color+';font-size:17px">'+val+'</div>'
    + '<div class="st-l">'+label+'</div>'
  + '</div>';
}

function cambiarPasswordPerfil() {
  var pCur = ($('prof-pass-current') || {}).value || '';
  var p1 = ($('prof-pass1') || {}).value || '';
  var p2 = ($('prof-pass2') || {}).value || '';
  var msg = $('prof-msg');
  function showMsg(txt, ok) {
    if (!msg) return;
    msg.style.display = 'block';
    msg.style.background = ok ? 'rgba(39,174,96,0.12)' : 'rgba(231,76,60,0.12)';
    msg.style.color = ok ? '#27ae60' : '#e74c3c';
    msg.textContent = txt;
  }
  if (!pCur) return showMsg(' IngresÃ¡ tu contraseÃ±a actual', false);
  if (p1.length < 6) return showMsg(' La contraseÃ±a debe tener al menos 6 caracteres', false);
  if (p1 !== p2) return showMsg('Las contraseÃ±as no coinciden', false);
  var user = auth && auth.currentUser;
  if (!user) return showMsg(' No hay sesiÃ³n activa', false);
  if (!user.email) return showMsg(' El usuario no tiene email asociado', false);

  showMsg('Verificandoâ€¦', true);

  // Reautenticar con la contraseÃ±a actual y luego actualizar
  var credential = firebase.auth.EmailAuthProvider.credential(user.email, pCur);
  user.reauthenticateWithCredential(credential)
    .then(function() {
      return user.updatePassword(p1);
    })
    .then(function() {
      showMsg('âœ“ ContraseÃ±a actualizada correctamente', true);
      if ($('prof-pass-current')) $('prof-pass-current').value = '';
      if ($('prof-pass1')) $('prof-pass1').value = '';
      if ($('prof-pass2')) $('prof-pass2').value = '';
    })
    .catch(function(e) {
      var code = e && e.code;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        showMsg(' La contraseÃ±a actual es incorrecta', false);
      } else if (code === 'auth/too-many-requests') {
        showMsg(' Demasiados intentos. EsperÃ¡ un momento e intentÃ¡ de nuevo.', false);
      } else if (code === 'auth/weak-password') {
        showMsg(' La nueva contraseÃ±a es demasiado dÃ©bil', false);
      } else if (code === 'auth/network-request-failed') {
        showMsg(' Error de conexiÃ³n. VerificÃ¡ tu internet.', false);
      } else {
        showMsg(' ' + (e.message || 'Error al actualizar'), false);
      }
    });
}

function doLogout() {
  // Cerrar perfil overlay si estÃ¡ abierto
  var overlay = document.getElementById('profile-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
  if (auth) {
    auth.signOut();
  } else {
    location.reload();
  }
}

// â”€â”€ Mobile Menu â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openMobileMenu(){
  var sidebarEl = document.querySelector('.sb') || document.querySelector('.sidebar');
  var ov = $('sb-overlay');
  if(sidebarEl) { sidebarEl.classList.add('mob-open'); sidebarEl.classList.add('open'); }
  if(ov) { ov.style.display = 'block'; ov.classList.add('open'); }
  document.body.style.overflow = 'hidden';
}
function closeMobileMenu(){
  var sidebarEl = document.querySelector('.sb') || document.querySelector('.sidebar');
  var ov = $('sb-overlay');
  if(sidebarEl) { sidebarEl.classList.remove('mob-open'); sidebarEl.classList.remove('open'); }
  if(ov) { ov.style.display = 'none'; ov.classList.remove('open'); }
  document.body.style.overflow = '';
}

// Cerrar menÃº automÃ¡ticamente al navegar en mÃ³vil
(function(){
  if(typeof window.nav !== 'function') return;
  var _origNav = window.nav;
  window.nav = function(){
    var r = _origNav.apply(this, arguments);
    if(window.innerWidth <= 820) closeMobileMenu();
    return r;
  };
})();

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MOBILE BOTTOM NAV & SEARCH
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function mbbSelect(page){
  document.querySelectorAll('.mbb-btn').forEach(function(b){ b.classList.remove('on'); });
  var btn = $('mbb-'+page);
  if(btn) btn.classList.add('on');
}

function updateMobileNav(){
  var page = S.page;

  // Empleado (incluye legacy Cobrador/Vendedor): bottom nav especializado
  var mbb = $('mob-bottom-bar');
  if(mbb){
    if(isEmpleadoRole()){
      mbb.innerHTML = ''
        +'<button class="mbb-btn'+(page==='dash'?' on':'')+'" onclick="nav(\'dash\');mbbSelect(\'dash\')">'
        +'<span class="mbb-ic">DB</span><span>Inicio</span></button>'
        +'<button class="mbb-btn'+(page==='cobranza'?' on':'')+'" onclick="nav(\'cobranza\');mbbSelect(\'cobranza\')">'
        +'<span class="mbb-ic">COB</span><span>Cobranza</span></button>'
        +'<button class="mbb-btn" onclick="openAddCred()" style="color:var(--p1)">'
        +'<span class="mbb-ic" style="background:var(--p1);color:#fff">ï¼‹</span><span>Solicitud</span></button>'
        +'<button class="mbb-btn'+(page==='creditos'?' on':'')+'" onclick="nav(\'creditos\');mbbSelect(\'creditos\')">'
        +'<span class="mbb-ic">SOL</span><span>Solicitudes</span></button>';
      return;
    }
  }

  var mapped = {dash:'dash', clientes:'clientes', creditos:'creditos'};
  mbbSelect(mapped[page] || 'more');
}

function openMobSearch(){
  var el = $('mob-search-overlay');
  if(el){ el.classList.add('open'); setTimeout(function(){ var inp=$('mob-srch-input'); if(inp) inp.focus(); },100); }
}

function closeMobSearch(){
  var el = $('mob-search-overlay');
  if(el) el.classList.remove('open');
  var inp = $('mob-srch-input');
  if(inp) inp.value = '';
  var res = $('mob-srch-results');
  if(res) res.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--ink3);font-size:13px">Escribe para buscar en todo el sistema</div>';
}

function mobSearch(q){
  var val = q.trim().toLowerCase();
  var res = $('mob-srch-results');
  if(!res) return;
  if(!val){
    res.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--ink3);font-size:13px">Escribe para buscar en todo el sistema</div>';
    return;
  }
  var results = [];
  S.clientes.filter(c=>!c.eliminado).forEach(function(c){
    if((c.nombre+' '+c.cedula+' '+c.tel).toLowerCase().includes(val))
      results.push({icon:'CLI',titulo:c.nombre,sub:c.cedula+' Â· '+c.tel,fn:function(){ closeMobSearch(); nav('clientes'); setTimeout(function(){verCliente(c.id);},100); }});
  });
  S.creds.filter(c=>!c.eliminado).forEach(function(c){
    if((c.id+' '+c.cli+' '+c.modelo).toLowerCase().includes(val))
      results.push({icon:'â‰¡',titulo:c.cli+' â€” '+c.modelo,sub:c.id+' Â· '+c.estado,fn:function(){ closeMobSearch(); nav('creditos'); setTimeout(function(){openAmort(c.id);},100); }});
  });
  S.motos.filter(m=>!m.eliminado).forEach(function(m){
    if((m.modelo+' '+(m.vin||'')+' '+(m.cliente||'')).toLowerCase().includes(val))
      results.push({icon:'MOT',titulo:m.modelo,sub:(m.vin||'Sin VIN')+' Â· '+m.estado,fn:function(){ closeMobSearch(); nav('motos'); }});
  });
  S.pagos.filter(p=>!p.eliminado).forEach(function(p){
    if((p.cli+' '+p.id).toLowerCase().includes(val))
      results.push({icon:'PAG',titulo:p.cli,sub:fmt(p.monto)+' Â· '+p.fecha,fn:function(){ closeMobSearch(); nav('pagos'); }});
  });
  window._mobSrchFns = results.map(function(r){ return r.fn; });
  if(!results.length){
    res.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--ink3);font-size:13px">Sin resultados para "'+q+'"</div>';
    return;
  }
  res.innerHTML = results.slice(0,15).map(function(r,i){
    return '<div onclick="window._mobSrchFns['+i+']()" style="display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--rim);cursor:pointer;-webkit-tap-highlight-color:transparent" onmousedown="event.preventDefault()">'+
      '<div style="width:36px;height:36px;border-radius:10px;background:var(--gs);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--p1);font-family:var(--fm);flex-shrink:0">'+r.icon+'</div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:14px;font-weight:600;color:var(--ink)">'+r.titulo+'</div>'+
        '<div style="font-size:11.5px;color:var(--ink3);margin-top:1px">'+r.sub+'</div>'+
      '</div>'+
      '<span style="color:var(--ink3);font-size:18px;font-weight:200">â€º</span>'+
    '</div>';
  }).join('');
}

// Responsive: ajustar topbars en resize
window.addEventListener('resize', function(){
  if (!$('app-root') || $('app-root').style.display === 'none') return;
  var isMob = window.innerWidth <= 820;
  var mobBar = $('mobile-topbar');
  var deskBar = $('desktop-topbar');
  if (mobBar) mobBar.style.display = isMob ? 'flex' : 'none';
  if (deskBar) deskBar.style.display = isMob ? 'none' : 'flex';
});

setTimeout(function(){ try{ if(window.S && Array.isArray(S.clientes) && Array.isArray(S.creds)) syncTodosEstadosClientes(); }catch(e){} }, 1200);
