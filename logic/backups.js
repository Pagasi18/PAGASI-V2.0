// Pagasi logic: backups
function exportarBackupJSON(){
  var backup={
    version:1,
    fechaExport:new Date().toISOString(),
    clientes:S.clientes,
    creds:S.creds,
    pagos:S.pagos,
    egresos:S.egresos,
    movimientos:S.movimientos,
    motos:S.motos
  };
  var json=JSON.stringify(backup,null,2);
  var blob=new Blob([json],{type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  var fname='backup-pagasi-'+new Date().toISOString().split('T')[0]+'.json';
  a.href=url;a.download=fname;a.click();
  URL.revokeObjectURL(url);
  toast('Backup exportado: '+fname,'success');
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
      if(!confirm(' Esto reemplazará TODOS los datos actuales con el backup.\n\nClientes: '+data.clientes.length+
        '\nCréditos: '+data.creds.length+'\nPagos: '+data.pagos.length+
        '\n\n¿Continuar?')){input.value='';return;}

      // Aplicar en memoria
      S.clientes = data.clientes || [];
      S.creds = data.creds || [];
      S.pagos = data.pagos || [];
      S.egresos = data.egresos || [];
      S.movimientos = data.movimientos || [];
      S.motos = data.motos || [];

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
        Promise.all(ops.filter(Boolean)).then(function(){
          hideLoader();nav(S.page);toast('✓ Backup restaurado ('+S.clientes.length+' clientes, '+S.creds.length+' créditos)','success');
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
  var fecha = new Date().toISOString().split('T')[0];
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
