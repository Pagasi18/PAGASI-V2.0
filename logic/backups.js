// Pagasi logic: backups
function exportarBackupJSON(){
  // Recolectar config docs desde Firebase antes de exportar
  var configKeys = ['plan','catalogo','planes','empresa','tasa','cobradores','score','rolesPermisos'];
  var configPromises = db
    ? configKeys.map(function(k){ return db.collection('config').doc(k).get().then(function(d){ return {key:k, data:d.exists?d.data():null}; }).catch(function(){ return {key:k,data:null}; }); })
    : configKeys.map(function(k){ return Promise.resolve({key:k,data:null}); });
  var usuariosPromise = db
    ? db.collection('usuarios').get().then(function(s){ return s.docs.map(function(d){ return Object.assign({uid:d.id},d.data()); }); }).catch(function(){ return []; })
    : Promise.resolve([]);
  var tareasPromise = db
    ? db.collection('tareas').get().then(function(s){ return s.docs.map(function(d){ return Object.assign({id:d.id},d.data()); }); }).catch(function(){ return []; })
    : Promise.resolve(S.tareas||[]);

  toast('Preparando backup completo...','info');
  Promise.all([usuariosPromise, tareasPromise].concat(configPromises)).then(function(results){
    var usuarios = results[0];
    var tareas   = results[1];
    var configData = {};
    results.slice(2).forEach(function(r){ if(r.data) configData[r.key] = r.data; });

    var backup={
      version:2,
      fechaExport:new Date().toISOString(),
      // Colecciones principales
      clientes:     S.clientes     || [],
      creds:        S.creds        || [],
      pagos:        S.pagos        || [],
      egresos:      S.egresos      || [],
      movimientos:  S.movimientos  || [],
      motos:        S.motos        || [],
      concesionarios: S.concesionarios || [],
      cuentasPendientes: S.cuentasPendientes || [],
      facturas:     S.facturas     || [],
      tareas:       tareas,
      usuarios:     usuarios,
      // Configuración
      config:       configData
    };
    var json=JSON.stringify(backup,null,2);
    var blob=new Blob([json],{type:'application/json'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    var fname='backup-pagasi-completo-'+hoyLocalISO()+'.json';
    a.href=url;a.download=fname;a.click();
    URL.revokeObjectURL(url);
    toast('Backup completo exportado: '+fname,'success');
  }).catch(function(err){
    toast('Error al exportar: '+(err&&err.message||err),'error');
  });
}

function importarBackupJSON(input){
  var file=input.files&&input.files[0];
  if(!file){return;}
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var data=JSON.parse(e.target.result);
      if(!data.version||!data.clientes){
        toast('Archivo inválido — no parece un backup de Pagasi','error');return;
      }
      var resumen = ' Esto reemplazará TODOS los datos actuales con el backup.\n\n'
        + 'Clientes: '+(data.clientes||[]).length+'\n'
        + 'Créditos: '+(data.creds||[]).length+'\n'
        + 'Pagos: '+(data.pagos||[]).length+'\n'
        + 'Motos: '+(data.motos||[]).length+'\n'
        + 'Concesionarios: '+(data.concesionarios||[]).length+'\n'
        + 'Tareas: '+(data.tareas||[]).length+'\n'
        + (data.config ? 'Config: '+Object.keys(data.config).join(', ')+'\n' : '')
        + '\n¿Continuar?';
      if(!confirm(resumen)){input.value='';return;}

      // Aplicar en memoria
      S.clientes          = data.clientes          || [];
      S.creds             = data.creds             || [];
      S.pagos             = data.pagos             || [];
      S.egresos           = data.egresos           || [];
      S.movimientos       = data.movimientos       || [];
      S.motos             = data.motos             || [];
      S.concesionarios    = data.concesionarios    || [];
      S.cuentasPendientes = data.cuentasPendientes || [];
      S.facturas          = data.facturas          || [];
      S.tareas            = data.tareas            || [];

      // Guardar en Firebase si está conectado
      if(db){
        showLoader('Restaurando backup...','Guardando datos en Firebase');
        var ops=[];
        S.clientes.forEach(function(o){ops.push(DB.saveCliente(o)||Promise.resolve());});
        S.creds.forEach(function(o){ops.push(DB.saveCred&&DB.saveCred(o)||Promise.resolve());});
        S.pagos.forEach(function(o){ops.push(DB.savePago(o)||Promise.resolve());});
        S.egresos.forEach(function(o){ops.push(DB.saveEgreso(o)||Promise.resolve());});
        S.movimientos.forEach(function(o){ops.push(DB.saveMovimiento(o)||Promise.resolve());});
        S.motos.forEach(function(o){ops.push(DB.saveMoto(o)||Promise.resolve());});
        S.concesionarios.forEach(function(o){ops.push(DB.saveConcesionario&&DB.saveConcesionario(o)||Promise.resolve());});
        S.cuentasPendientes.forEach(function(o){ops.push(DB.saveCuentaPendiente&&DB.saveCuentaPendiente(o)||Promise.resolve());});
        S.facturas.forEach(function(o){ops.push(DB.saveFactura&&DB.saveFactura(o)||Promise.resolve());});
        S.tareas.forEach(function(o){ops.push(DB.saveTarea&&DB.saveTarea(o)||Promise.resolve());});
        // Restaurar config docs
        if(data.config && db){
          Object.keys(data.config).forEach(function(k){
            if(data.config[k]) ops.push(db.collection('config').doc(k).set(data.config[k],{merge:true}));
          });
        }
        // Restaurar usuarios (no sobreescribe auth, solo datos de perfil)
        if(data.usuarios && data.usuarios.length && db){
          data.usuarios.forEach(function(u){
            if(u.uid) ops.push(db.collection('usuarios').doc(u.uid).set(u,{merge:true}));
          });
        }
        Promise.all(ops.filter(Boolean)).then(function(){
          hideLoader();nav(S.page);
          toast('✓ Backup restaurado — '+S.clientes.length+' clientes, '+S.creds.length+' créditos, '+S.concesionarios.length+' concesionarios','success');
        }).catch(function(err){hideLoader();toast('Error parcial al guardar: '+err.message,'error');});
      } else {
        nav(S.page);toast('✓ Backup cargado en memoria (sin Firebase)','success');
      }
    } catch(err){
      toast('Error leyendo archivo: '+err.message,'error');
    }
    input.value='';
  };
  reader.readAsText(file);
}

function exportarBackup(){
  var data = {
    version: 1,
    fecha: new Date().toISOString(),
    empresa: ($('cfg_empresa')&&$('cfg_empresa').value)||'Pagasi',
    clientes: S.clientes,
    motos: S.motos,
    creditos: S.creds,
    pagos: S.pagos,
    egresos: S.egresos,
    movimientos: S.movimientos
  };
  var json = JSON.stringify(data, null, 2);
  var blob = new Blob([json], {type:'application/json'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  var fecha = hoyLocalISO();
  a.href = url; a.download = 'backup-pagasi-'+fecha+'.json'; a.click();
  URL.revokeObjectURL(url);
  toast('✓ Backup exportado · '+
    data.clientes.length+' clientes, '+
    data.creditos.length+' créditos, '+
    data.pagos.length+' pagos','success');
}

function importarBackup(){
  if(!db){toast('Necesitas Firebase configurado para restaurar','error');return;}
  var input = document.createElement('input');
  input.type='file'; input.accept='.json';
  input.onchange = function(e){
    var file = e.target.files[0];
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(ev){
      try{
        var data = JSON.parse(ev.target.result);
        if(!data.version || !data.clientes){
          toast('Archivo inválido — no es un backup de Pagasi','error'); return;
        }
        var total = (data.clientes||[]).length + (data.creditos||[]).length +
                    (data.pagos||[]).length + (data.movimientos||[]).length;
        if(!confirm('¿Restaurar backup del '+data.fecha.split('T')[0]+'? Registros: '+total+'\n\nEsto NO borrará datos actuales, solo agregará registros faltantes.')){return;}
        showLoader('Restaurando backup...','Subiendo datos a Firebase');
        var ops = [];
        (data.clientes||[]).forEach(function(o){if(o&&o.id) ops.push(db.collection('clientes').doc(String(o.id)).set(o));});
        (data.motos||[]).forEach(function(o){if(o&&o.id) ops.push(db.collection('motos').doc(String(o.id)).set(o));});
        (data.creditos||[]).forEach(function(o){if(o&&o.id) ops.push(db.collection('creditos').doc(String(o.id)).set(o));});
        (data.pagos||[]).forEach(function(o){if(o&&o.id) ops.push(db.collection('pagos').doc(String(o.id)).set(o));});
        (data.egresos||[]).forEach(function(o){if(o&&o.id) ops.push(db.collection('egresos').doc(String(o.id)).set(o));});
        (data.movimientos||[]).forEach(function(o){if(o&&o.id) ops.push(db.collection('movimientos').doc(String(o.id)).set(o));});
        Promise.all(ops).then(function(){
          hideLoader();
          toast('✓ Backup restaurado · '+ops.length+' registros subidos','success');
          setTimeout(function(){DB.load().then(function(){nav(S.page);});},1000);
        }).catch(function(err){
          hideLoader();
          toast('Error al restaurar: '+err.message,'error');
        });
      }catch(err){
        toast('Error al leer el archivo: '+err.message,'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}
