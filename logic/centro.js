// Logica del Centro de trabajo: tareas, filtros, kanban y modales.
// Extraido de logic/clientes.js sin cambiar comportamiento.

// CENTRO DE TRABAJO — v6 rediseño completo
// ══════════════════════════════════════════
var WT_LS_KEY='pagasi_workcenter_tasks_v3';
var WT_FILTER='kanban';
var WT_LOADED=false;
var WT_NOTIFIED=false;
var _wtDragId=null;

function wtEsc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m];}); }
function wtToday(){ return hoyLocalISO(); }
function wtDateAdd(days){ var d=new Date(); d.setDate(d.getDate()+days); return fechaLocalISO(d); }
function wtUserName(){ return (S.currentUser&&(S.currentUser.nombre||S.currentUser.email||S.currentUser.uid))||'Administrador'; }
function wtIsMine(t){ if(isAdminUser()) return true; var me=(S.currentUser&&S.currentUser.email)||wtUserName(); var ass=String(t.asignadoEmail||t.asignadoA||'').toLowerCase(); var meL=me.toLowerCase(); return !ass||ass===meL||ass.indexOf(meL)>=0||meL.indexOf(ass)>=0; }

function wtDemoTasks(){ var me=wtUserName(); return [
  {id:'WT-DEMO-1',titulo:'Llamar leads aprobados de hoy',descripcion:'Contactar a los clientes aprobados y empujarlos a reservar la moto con inicial.',asignadoA:me,fecha:wtToday(),prioridad:'alta',estado:'pendiente',tipo:'Seguimiento',checklist:[{txt:'Revisar leads aprobados',done:true},{txt:'Enviar WhatsApp de aprobación rápida',done:false},{txt:'Agendar visita o cierre',done:false}],comentarios:[{user:'Sistema',fecha:new Date().toISOString(),txt:'Tarea sugerida para comenzar el día.'}],createdAt:new Date().toISOString()},
  {id:'WT-DEMO-2',titulo:'Validar documentos pendientes',descripcion:'Revisar cédula, referencia, contrato y soporte de inicial antes de entregar.',asignadoA:me,fecha:wtToday(),prioridad:'media',estado:'proceso',tipo:'Documentos',checklist:[{txt:'Verificar cédula',done:true},{txt:'Confirmar comprobante de inicial',done:true},{txt:'Subir contrato firmado',done:false}],comentarios:[],createdAt:new Date().toISOString()},
  {id:'WT-DEMO-3',titulo:'Cobranza preventiva',descripcion:'Clientes con cuota próxima: enviar recordatorio suave por WhatsApp.',asignadoA:me,fecha:wtDateAdd(1),prioridad:'media',estado:'pendiente',tipo:'Cobranza',checklist:[{txt:'Filtrar cuotas próximas',done:false},{txt:'Enviar mensaje de recordatorio',done:false}],comentarios:[],createdAt:new Date().toISOString()},
  {id:'WT-DEMO-4',titulo:'Cerrar entrega de moto',descripcion:'Checklist final antes de entregar una unidad financiada.',asignadoA:me,fecha:wtDateAdd(-1),prioridad:'alta',estado:'pendiente',tipo:'Entrega',checklist:[{txt:'Pago inicial confirmado',done:true},{txt:'Seguro / póliza registrado',done:false},{txt:'Fotos de entrega',done:false}],comentarios:[{user:'Sistema',fecha:new Date().toISOString(),txt:'Esta tarea aparece vencida para probar la alerta.'}],createdAt:new Date().toISOString()}
]; }

function wtLoadLocal(){ try{ S.tareas=JSON.parse(localStorage.getItem(WT_LS_KEY)||'[]')||[]; }catch(e){ S.tareas=[]; } if(!S.tareas||!S.tareas.length){ S.tareas=wtDemoTasks(); wtSaveLocal(); } }
function wtSaveLocal(){ try{ localStorage.setItem(WT_LS_KEY,JSON.stringify(S.tareas||[])); }catch(e){} }
function wtLoadRemote(){ if(WT_LOADED) return; WT_LOADED=true; wtLoadLocal(); if(typeof DB!=='undefined'&&DB.getTareas){ DB.getTareas().then(function(arr){ if(Array.isArray(arr)&&arr.length){ S.tareas=arr; wtSaveLocal(); if(S.page==='centro') nav('centro'); updateBadge(); } }).catch(function(){}); } }
function wtPersist(t){ wtSaveLocal(); if(t&&typeof DB!=='undefined'&&DB.saveTarea) DB.saveTarea(t); updateBadge(); }

function wtStats(){
  var today=wtToday();
  var mine=(S.tareas||[]).filter(function(t){ return !t.eliminado&&wtIsMine(t); });
  var active=mine.filter(function(t){ return !t.archivado; });
  return {
    hoy:active.filter(function(t){ return t.estado!=='completada'&&(t.fecha===today||!t.fecha); }).length,
    vencidas:active.filter(function(t){ return t.estado!=='completada'&&t.fecha&&t.fecha<today; }).length,
    proceso:active.filter(function(t){ return t.estado==='proceso'; }).length,
    completadas:active.filter(function(t){ return t.estado==='completada'; }).length,
    archivadas:mine.filter(function(t){ return !!t.archivado; }).length,
    total:active.length
  };
}

function wtFiltered(){
  var today=wtToday();
  return (S.tareas||[]).filter(function(t){
    if(t.eliminado||!wtIsMine(t)) return false;
    if(WT_FILTER==='archivadas') return !!t.archivado;
    if(t.archivado) return false;
    if(WT_FILTER==='hoy') return t.estado!=='completada'&&(t.fecha===today||!t.fecha);
    if(WT_FILTER==='vencidas') return t.estado!=='completada'&&t.fecha&&t.fecha<today;
    if(WT_FILTER==='proceso') return t.estado==='proceso';
    if(WT_FILTER==='completadas') return t.estado==='completada';
    return true;
  }).sort(function(a,b){
    var pa={alta:0,media:1,baja:2}[a.prioridad||'media'];
    var pb={alta:0,media:1,baja:2}[b.prioridad||'media'];
    return (a.fecha||'9999').localeCompare(b.fecha||'9999')||pa-pb;
  });
}

function wtMaybeNotify(){
  if(WT_NOTIFIED) return;
  var st=wtStats(); var total=st.hoy+st.vencidas;
  if(!total) return;
  WT_NOTIFIED=true;
  setTimeout(function(){ if(typeof toast==='function') toast('Tienes '+total+' tarea(s) pendientes en Centro de trabajo','info'); },350);
}

function wtPrioColor(p){ return {alta:'#e24b4a',media:'#ef9f27',baja:'#639922'}[p||'media']||'#ef9f27'; }
function wtPrioBg(p){ return {alta:'rgba(226,75,74,.12)',media:'rgba(239,159,39,.12)',baja:'rgba(99,153,34,.12)'}[p||'media']; }
function wtPrioText(p){ return {alta:'#a32d2d',media:'#854f0b',baja:'#3b6d11'}[p||'media']; }
function wtPrioLabel(p){ return {alta:'Alta',media:'Media',baja:'Baja'}[p||'media']||'Media'; }
function wtTypeStyle(tipo){
  var map={'Seguimiento':'background:#eeedfe;color:#534ab7','Cobranza':'background:#faeeda;color:#854f0b','Documentos':'background:#e6f1fb;color:#185fa5','Entrega':'background:#eaf3de;color:#3b6d11','Interno':'background:#f1efe8;color:#5f5e5a','Operacional':'background:#eeedfe;color:#534ab7','Cliente':'background:#e6f1fb;color:#185fa5','Moto / crédito':'background:#eaf3de;color:#3b6d11'};
  return map[tipo]||'background:#f1efe8;color:#5f5e5a';
}

function wtHTML(){
  wtInjectStyle(); wtLoadRemote(); wtLoadUsers(); wtMaybeNotify();
  var st=wtStats(); var today=wtToday();
  var all=(S.tareas||[]).filter(function(t){ return !t.eliminado&&wtIsMine(t)&&!t.archivado; });
  var html='';
  html+=pageBanner('Centro de trabajo','Operación del equipo',
    '<b>'+st.total+'</b> activas · <b style="color:var(--red)">'+st.vencidas+'</b> vencidas · <b style="color:var(--amber)">'+st.proceso+'</b> en proceso',
    [{label:'+ Nueva tarea',onclick:'openWtTask()',primary:true}]);
  if(st.hoy+st.vencidas>0){
    html+='<div style="background:#FFF6E5;border:1px solid #FAEEDA;border-radius:14px;padding:14px 18px;display:flex;align-items:center;gap:12px;margin-bottom:18px">'
      +'<div style="width:38px;height:38px;background:#FAEEDA;border-radius:11px;display:flex;align-items:center;justify-content:center;color:#BA7517;flex-shrink:0"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg></div>'
      +'<div style="flex:1"><div style="font-weight:800;font-size:14px;color:#854F0B">'+(st.hoy+st.vencidas)+' tarea(s) requieren atención</div>'
      +'<div style="font-size:12px;color:#946F0B;margin-top:2px">'+st.hoy+' para hoy · '+st.vencidas+' vencidas</div></div>'
      +'<button class="btn btn-sm" style="background:#BA7517;color:#fff;border:none;font-weight:700;cursor:pointer" onclick="wtSetFilter(\'hoy\')">Ver</button></div>';
  }
  html+='<div class="sg" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">';
  html+=wtM6('Hoy',st.hoy,'',' #E6F1FB','#2563EB')+wtM6('Vencidas',st.vencidas,'','#FCEBEB','#E8335A')+wtM6('En proceso',st.proceso,'','#FAEEDA','#BA7517')+wtM6('Archivadas',st.archivadas,'','#E1F5EE','#00B876');
  html+='</div>';
  html+='<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px">';
  html+='<div style="display:flex;gap:6px;flex-wrap:wrap">';
  [['kanban','Kanban'],['hoy','Hoy'],['vencidas','Vencidas'],['proceso','En proceso'],['completadas','Completadas'],['todas','Todas'],['archivadas','Archivadas']].forEach(function(f){
    html+='<button class="btn '+(WT_FILTER===f[0]?'btn-p':'btn-g')+' btn-sm" onclick="wtSetFilter(\''+f[0]+'\')">'+f[1]+'</button>';
  });
  html+='</div><span style="font-size:11px;color:var(--ink3);font-weight:700">'+wtEsc(isAdminUser()?'Equipo completo':'Mis tareas')+'</span></div>';
  if(WT_FILTER==='kanban'||WT_FILTER==='todas'){
    var cols=[
      {id:'pendiente',label:'Pendiente',color:'#2563EB',bg:'#E6F1FB',tc:'#185FA5',tasks:all.filter(function(t){return t.estado==='pendiente';})},
      {id:'proceso',label:'En proceso',color:'#BA7517',bg:'#FAEEDA',tc:'#854F0B',tasks:all.filter(function(t){return t.estado==='proceso';})},
      {id:'completada',label:'Completada',color:'#00B876',bg:'#E1F5EE',tc:'#0F6E56',tasks:all.filter(function(t){return t.estado==='completada';})},
    ];
    html+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-items:start">';
    cols.forEach(function(col){
      var venc=col.tasks.filter(function(t){return t.fecha&&t.fecha<today&&t.estado!=='completada';}).length;
      html+='<div style="background:var(--surf2);border-radius:14px;padding:11px;min-height:200px;transition:background .15s" ondragover="event.preventDefault();this.style.background=\'var(--gs)\'" ondragleave="this.style.background=\'\'" ondrop="wtDrop(event,\''+col.id+'\')">';
      html+='<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
      html+='<div style="width:8px;height:8px;border-radius:50%;background:'+col.color+';flex-shrink:0"></div>';
      html+='<span style="font-size:13px;font-weight:800;color:var(--ink);flex:1">'+col.label+'</span>';
      html+='<span style="background:'+col.bg+';color:'+col.tc+';font-size:11px;font-weight:800;padding:2px 9px;border-radius:20px">'+col.tasks.length+'</span>';
      if(venc>0) html+='<span style="background:rgba(226,75,74,.12);color:#a32d2d;font-size:10px;font-weight:800;padding:2px 7px;border-radius:8px">'+venc+' venc.</span>';
      html+='</div>';
      html+='<div style="height:2px;border-radius:2px;background:'+col.bg+';margin-bottom:10px"></div>';
      col.tasks.forEach(function(t){ html+=wtKanbanCard(t,today); });
      html+='<button class="btn btn-g btn-sm" style="width:100%;margin-top:4px;opacity:.6" onclick="openWtTask()">+ Agregar</button>';
      html+='</div>';
    });
    html+='</div>';
  } else {
    var rows=wtFiltered();
    if(!rows.length){
      html+='<div class="empty"><div class="e-ic">✓</div><div class="e-tt">Sin tareas en esta vista</div><button class="btn btn-p" style="margin-top:14px" onclick="openWtTask()">+ Nueva tarea</button></div>';
    } else {
      html+='<div style="display:flex;flex-direction:column;gap:8px">';
      rows.forEach(function(t){ html+=wtListCard(t,today); });
      html+='</div>';
    }
  }
  return html;
}

function wtM6(label,val,icon,bg,color){
  var icons = {
    'hoy':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    'vencidas':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    'en proceso':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><path d="M21 12a9 9 0 1 1-6.2-8.5"/><path d="M21 3v6h-6"/></svg>',
    'archivadas':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:20px;height:20px"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>'
  };
  var svg = icons[label.toLowerCase()] || icon;
  return '<div class="stat"><div class="st-ic" style="background:'+bg+';color:'+color+'">'+svg+'</div>'
    +'<div class="st-l" style="margin-top:0;margin-bottom:6px">'+label+'</div>'
    +'<div class="st-v">'+val+'</div></div>';
}

function wtKanbanCard(t,today){
  var prioBdg={alta:'b-r',media:'b-a',baja:'b-g'}[t.prioridad||'media']||'b-a';
  var borderCol={alta:'var(--red)',media:'var(--amber)',baja:'var(--green)'}[t.prioridad||'media']||'var(--amber)';
  var total=(t.checklist||[]).length,done=(t.checklist||[]).filter(function(c){return c.done;}).length,pct=total?Math.round(done/total*100):0;
  var isVenc=t.fecha&&t.fecha<today&&t.estado!=='completada';
  var comments=(t.comentarios||[]).length;
  var isDone=t.estado==='completada';
  var tid=wtEsc(t.id);
  var html='<div class="card" style="padding:14px;margin-bottom:10px;cursor:pointer;user-select:none" draggable="true"'
    +' onclick="wtVerTarea(\''+tid+'\')"'
    +' ondragstart="event.stopPropagation();wtDragStart(event,\''+tid+'\')"'
    +' ondragend="document.querySelectorAll(\'[ondrop]\').forEach(function(c){c.style.background=\'\'})">';
  html+='<div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px">';
  html+='<div style="font-size:13px;font-weight:700;color:var(--ink);flex:1;line-height:1.35'+(isDone?';text-decoration:line-through;opacity:.5':'')+'">'+wtEsc(t.titulo||'Sin titulo')+'</div>';
  html+='<span class="bdg '+prioBdg+'">'+wtPrioLabel(t.prioridad)+'</span>';
  html+='</div>';
  html+='<div style="font-size:11px;color:var(--ink3);margin-bottom:8px">';
  html+=wtEsc(t.asignadoA||'Sin asignar');
  if(t.fecha) html+=' · <span style="color:'+(isVenc?'var(--red)':'var(--ink3)')+'">'+wtEsc(t.fecha)+(isVenc?' !':'')+'</span>';
  html+='</div>';
  if(total>0){
    html+='<div style="background:var(--lift);border-radius:3px;height:3px;overflow:hidden;margin-bottom:4px"><div style="height:100%;width:'+pct+'%;background:var(--p1);border-radius:3px"></div></div>';
    html+='<div style="font-size:10px;color:var(--ink3);margin-bottom:8px">'+done+'/'+total+' pasos</div>';
  }
  html+='<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center" onclick="event.stopPropagation()">';
  html+='<span class="bdg b-p">'+wtEsc(t.tipo||'—')+'</span>';
  if(!t.archivado){
    html+='<button class="btn btn-g btn-xs" onclick="event.stopPropagation();openWtTask(\''+tid+'\')">Editar</button>';
    html+='<button class="btn btn-g btn-xs" onclick="event.stopPropagation();wtNextStatus(\''+tid+'\')">Avanzar</button>';
    html+='<button class="btn btn-g btn-xs" onclick="event.stopPropagation();wtArchive(\''+tid+'\')">Archivar</button>';
  } else {
    html+='<button class="btn btn-g btn-xs" onclick="event.stopPropagation();wtRestore(\''+tid+'\')">Restaurar</button>';
  }
  if(comments>0) html+='<span style="font-size:11px;color:var(--ink3);margin-left:auto">💬 '+comments+'</span>';
  html+='</div></div>';
  return html;
}

function wtListCard(t,today){
  var prioBdg={alta:'b-r',media:'b-a',baja:'b-g'}[t.prioridad||'media']||'b-a';
  var borderCol={alta:'var(--red)',media:'var(--amber)',baja:'var(--green)'}[t.prioridad||'media']||'var(--amber)';
  var isVenc=t.fecha&&t.fecha<today&&t.estado!=='completada';
  var total=(t.checklist||[]).length,done=(t.checklist||[]).filter(function(c){return c.done;}).length,pct=total?Math.round(done/total*100):0;
  var comments=(t.comentarios||[]).length;
  var tid=wtEsc(t.id);
  var statusPill=t.archivado?'<span class="bdg b-x">Archivada</span>':(t.estado==='completada'?'<span class="bdg b-g">Completada</span>':(isVenc?'<span class="bdg b-r">Vencida</span>':(t.estado==='proceso'?'<span class="bdg b-a">En proceso</span>':'<span class="bdg b-p">Pendiente</span>')));
  var act=t.archivado
    ?'<button class="btn btn-g btn-sm" onclick="event.stopPropagation();wtRestore(\''+tid+'\')">Restaurar</button>'
    :'<button class="btn btn-g btn-sm" onclick="event.stopPropagation();wtNextStatus(\''+tid+'\')">Avanzar</button><button class="btn btn-g btn-sm" onclick="event.stopPropagation();openWtTask(\''+tid+'\')">Editar</button><button class="btn btn-g btn-sm" onclick="event.stopPropagation();wtArchive(\''+tid+'\')">Archivar</button>';
  return '<div class="card" style="padding:14px;cursor:pointer" onclick="wtVerTarea(\''+tid+'\')">'
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">'
    +'<div style="flex:1;min-width:0">'
    +'<div style="font-weight:700;font-size:14px;margin-bottom:4px;color:var(--ink)">'+wtEsc(t.titulo)+'</div>'
    +'<div style="font-size:11px;color:var(--ink3);margin-bottom:4px">'
    +'<span class="bdg b-p" style="margin-right:4px">'+wtEsc(t.tipo||'—')+'</span>'
    +wtEsc(t.asignadoA||'Sin asignar')
    +(t.fecha?' · <span style="color:'+(isVenc?'var(--red)':'var(--ink3)')+'">'+wtEsc(t.fecha)+(isVenc?' !':'')+'</span>':'')
    +'</div>'
    +(t.descripcion?'<div style="font-size:12px;color:var(--ink2);margin-top:4px;line-height:1.4">'+wtEsc(t.descripcion.slice(0,120))+(t.descripcion.length>120?'...':'')+'</div>':'')
    +(total>0?'<div style="margin-top:8px"><div style="background:var(--lift);border-radius:3px;height:3px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:var(--p1);border-radius:3px"></div></div><div style="font-size:10px;color:var(--ink3);margin-top:3px">'+done+'/'+total+' pasos · '+pct+'%</div></div>':'')
    +'</div>'
    +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0">'
    +statusPill
    +'<span class="bdg '+prioBdg+'">'+wtPrioLabel(t.prioridad)+'</span>'
    +(comments>0?'<span style="font-size:11px;color:var(--ink3)">💬 '+comments+'</span>':'')
    +'<div style="display:flex;gap:5px;margin-top:3px">'+act+'</div>'
    +'</div></div></div>';
}

function wtDragStart(e,id){ _wtDragId=id; e.dataTransfer.effectAllowed='move'; var el=e.currentTarget; el.style.opacity='.5'; setTimeout(function(){el.style.opacity='1';},0); }
function wtDrop(e,nuevoEstado){ e.preventDefault(); e.currentTarget.style.background=''; if(!_wtDragId) return; var t=(S.tareas||[]).find(function(x){return x.id===_wtDragId;}); _wtDragId=null; if(!t||t.estado===nuevoEstado) return; t.estado=nuevoEstado; t.updatedAt=new Date().toISOString(); wtPersist(t); nav('centro'); toast('Movida a '+nuevoEstado,'ok'); }
function wtNextStatus(id){ var t=(S.tareas||[]).find(function(x){return x.id===id;}); if(!t) return; t.estado=t.estado==='pendiente'?'proceso':(t.estado==='proceso'?'completada':'pendiente'); t.updatedAt=new Date().toISOString(); wtPersist(t); nav('centro'); }
function wtArchive(id){ var t=(S.tareas||[]).find(function(x){return x.id===id;}); if(!t) return; if(!confirm('Archivar esta tarea?')) return; t.archivado=true; t.archivedAt=new Date().toISOString(); t.updatedAt=new Date().toISOString(); wtPersist(t); closeM(); nav('centro'); toast('Tarea archivada','info'); }
function wtRestore(id){ var t=(S.tareas||[]).find(function(x){return x.id===id;}); if(!t) return; t.archivado=false; t.updatedAt=new Date().toISOString(); wtPersist(t); nav('centro'); toast('Tarea restaurada','ok'); }
function wtSetFilter(k){ WT_FILTER=k; nav('centro'); }
function wtResetDemo(){ S.tareas=wtDemoTasks(); wtSaveLocal(); updateBadge(); nav('centro'); toast('Data demo cargada','ok'); }

function wtLoadUsers(){
  // Use existing _usersCache if available (populated by Configuracion > Usuarios)
  if(typeof _usersCache !== 'undefined' && _usersCache.length){
    S._wtUsers = _usersCache;
    return;
  }
  if(!S._wtUsers || !S._wtUsers.length){
    S._wtUsers=[];
    if(typeof DB!=='undefined'&&DB.getUsuarios){
      DB.getUsuarios().then(function(u){
        S._wtUsers=Array.isArray(u)?u:[];
        if(typeof _usersCache!=='undefined') _usersCache=S._wtUsers;
      }).catch(function(){});
    }
  }
}

function wtUserOptions(selected){
  var opts='<option value="">— Sin asignar —</option>';
  var users=S._wtUsers||[];
  if(!users.length){
    var me=wtUserName(); var meEmail=(S.currentUser&&S.currentUser.email)||me;
    opts+='<option value="'+wtEsc(meEmail)+'" '+((!selected||selected===meEmail||selected===me)?'selected':'')+'>'+wtEsc(me)+'</option>';
  } else {
    users.forEach(function(u){
      var em=u.email||u.uid||''; var nm=u.nombre||u.displayName||em;
      var sel=selected&&(selected===em||selected===nm||selected.indexOf(nm)>=0||nm.indexOf(selected)>=0);
      opts+='<option value="'+wtEsc(em)+'" '+(sel?'selected':'')+'>'+wtEsc(nm)+(u.rol?' · '+wtEsc(u.rol):'')+'</option>';
    });
  }
  return opts;
}

// ── Estilos inyectados una sola vez ──────────────────────────
function wtInjectStyle(){
  if(document.getElementById('wt-v7-style')) return;
  var st=document.createElement('style'); st.id='wt-v7-style';
  st.textContent=[
    '.wt7-modal{max-width:920px!important;width:calc(100vw - 28px)!important;border-radius:18px!important;overflow:hidden!important;}',
    '.wt7-body{padding:0!important;overflow:auto!important;max-height:calc(92vh - 80px)!important;}',
    '.wt7-tipo-bar{display:flex;gap:0;border-bottom:1px solid var(--rim,#e8e6f5);padding:0 22px;background:var(--surf2,#f7f6ff);overflow-x:auto;}',
    '.wt7-tab{padding:10px 15px;font-size:13px;color:var(--ink3,#7b7a94);cursor:pointer;border-bottom:2.5px solid transparent;white-space:nowrap;display:flex;align-items:center;gap:6px;flex-shrink:0;}',
    '.wt7-tab.on{color:var(--p1,#534ab7);border-bottom-color:var(--p1,#534ab7);font-weight:800;}',
    '.wt7-body-inner{display:grid;grid-template-columns:1fr 272px;background:var(--bg,#fff);}',
    '.wt7-left{padding:20px 22px;border-right:1px solid var(--rim,#e8e6f5);}',
    '.wt7-right{padding:18px 16px;background:var(--surf2,#f7f6ff);}',
    '.wt7-label{display:block;font-size:11px;font-weight:900;color:var(--ink3,#7b7a94);text-transform:uppercase;letter-spacing:.7px;margin-bottom:6px;}',
    '.wt7-input{width:100%;height:42px;border-radius:10px;padding:0 13px;background:var(--bg,#fff);color:var(--ink,#15142b);border:1px solid var(--rim,#e8e6f5);font-size:14px;outline:none;transition:border-color .15s;}',
    '.wt7-input:focus{border-color:var(--p1,#534ab7);}',
    '.wt7-input.big{height:48px;font-size:15px;font-weight:700;}',
    '.wt7-textarea{width:100%;border-radius:10px;padding:11px 13px;background:var(--bg,#fff);color:var(--ink,#15142b);border:1px solid var(--rim,#e8e6f5);font-size:14px;outline:none;resize:vertical;line-height:1.5;transition:border-color .15s;}',
    '.wt7-textarea:focus{border-color:var(--p1,#534ab7);}',
    '.wt7-select{width:100%;height:42px;border-radius:10px;padding:0 13px;background:var(--bg,#fff);color:var(--ink,#15142b);border:1px solid var(--rim,#e8e6f5);font-size:14px;cursor:pointer;outline:none;}',
    '.wt7-g2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}',
    '.wt7-g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}',
    '.wt7-field{margin-bottom:14px;}',
    '.wt7-prio-wrap{display:flex;gap:8px;}',
    '.wt7-prio-opt{flex:1;padding:9px 6px;border-radius:10px;text-align:center;cursor:pointer;border:1px solid var(--rim,#e8e6f5);background:var(--bg,#fff);font-size:12px;font-weight:700;color:var(--ink3,#7b7a94);}',
    '.wt7-prio-opt.alta{background:#fcebeb;border-color:#f09595;color:#791f1f;}',
    '.wt7-prio-opt.media{background:#faeeda;border-color:#fac775;color:#633806;}',
    '.wt7-prio-opt.baja{background:#eaf3de;border-color:#c0dd97;color:#27500a;}',
    '.wt7-estado-wrap{display:flex;gap:6px;}',
    '.wt7-estado-opt{flex:1;padding:8px 4px;border-radius:9px;text-align:center;cursor:pointer;border:1px solid var(--rim,#e8e6f5);background:var(--bg,#fff);font-size:12px;color:var(--ink3,#7b7a94);}',
    '.wt7-estado-opt.on{background:#eeedfe;border-color:#afa9ec;color:#3c3489;font-weight:800;}',
    '.wt7-divider{height:1px;background:var(--rim,#e8e6f5);margin:16px 0;}',
    '.wt7-ck-row{display:grid;grid-template-columns:20px 1fr 28px;gap:8px;align-items:center;margin-bottom:7px;}',
    '.wt7-ck-row input[type=checkbox]{width:17px;height:17px;accent-color:var(--p1,#534ab7);cursor:pointer;}',
    '.wt7-ck-del{width:26px;height:26px;border-radius:7px;border:1px solid var(--rim,#e8e6f5);background:transparent;color:var(--ink3,#7b7a94);cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;}',
    '.wt7-ck-del:hover{background:#fee2e2;border-color:#fca5a5;color:#dc2626;}',
    '.wt7-add-ck{width:100%;background:transparent;border:1px dashed var(--rim2,#ccc);border-radius:9px;padding:8px;font-size:12px;color:var(--ink3,#7b7a94);cursor:pointer;margin-top:3px;}',
    '.wt7-pbar{height:3px;background:var(--gs,#eeedf8);border-radius:2px;overflow:hidden;margin:8px 0 3px;}',
    '.wt7-pfill{height:100%;background:var(--p1,#534ab7);border-radius:2px;}',
    '.wt7-pbtext{font-size:10px;color:var(--ink3,#7b7a94);margin-bottom:8px;}',
    '.wt7-rcard{background:var(--bg,#fff);border:1px solid var(--rim,#e8e6f5);border-radius:12px;padding:13px;margin-bottom:10px;}',
    '.wt7-rcard-head{display:flex;align-items:center;gap:9px;margin-bottom:10px;}',
    '.wt7-rcard-ico{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}',
    '.wt7-rcard-title{font-size:13px;font-weight:800;color:var(--ink,#15142b);}',
    '.wt7-rcard-sub{font-size:11px;color:var(--ink3,#7b7a94);margin-top:1px;}',
    '.wt7-remind-wrap{display:flex;gap:5px;}',
    '.wt7-remind-opt{flex:1;padding:7px 3px;border-radius:8px;border:1px solid var(--rim,#e8e6f5);background:transparent;font-size:11px;color:var(--ink3,#7b7a94);cursor:pointer;text-align:center;}',
    '.wt7-remind-opt.on{background:#eeedfe;border-color:#afa9ec;color:#3c3489;font-weight:800;}',
    '.wt7-comment-empty{font-size:12px;color:var(--ink3,#7b7a94);padding:13px;text-align:center;border:1px dashed var(--rim2,#ccc);border-radius:9px;margin-bottom:9px;}',
    '.wt7-comment{background:var(--surf2,#f7f6ff);border-radius:10px;padding:10px 12px;margin-bottom:7px;}',
    '.wt7-cmeta{font-size:10.5px;color:var(--ink3,#7b7a94);font-weight:800;margin-bottom:3px;}',
    '.wt7-ctxt{font-size:13px;color:var(--ink2,#4a4760);line-height:1.45;}',
  ].join('');
  document.head.appendChild(st);
}

function wtAddCheckRow(){
  var box=$('wtchecks'); if(!box) return;
  var i=Date.now();
  var d=document.createElement('div'); d.className='wt-ck-row'; d.style.cssText='display:grid;grid-template-columns:24px 1fr 28px;gap:8px;align-items:center;margin-bottom:8px';
  d.innerHTML='<input type="checkbox" id="wtck_'+i+'" style="width:17px;height:17px;accent-color:var(--p1);cursor:pointer">'
    +'<input class="fi" id="wtcktxt_'+i+'" placeholder="Siguiente paso...">'
    +'<button type="button" style="width:26px;height:26px;border-radius:7px;border:1px solid var(--rim);background:transparent;color:var(--ink3);cursor:pointer;font-size:15px" onclick="this.closest(\'.wt-ck-row\').remove()">x</button>';
  box.appendChild(d);
  var inp=d.querySelector('.fi'); if(inp) inp.focus();
}

function openWtTask(id){
  wtLoadUsers();
  var isNew=!id;
  var t=isNew
    ?{id:'T'+Date.now(),titulo:'',descripcion:'',asignadoA:wtUserName(),asignadoEmail:(S.currentUser&&S.currentUser.email)||'',
      fecha:wtToday(),prioridad:'media',estado:'pendiente',tipo:'Operacional',recordatorio:'vencer',
      checklist:[{txt:'',done:false}],comentarios:[]}
    :((S.tareas||[]).find(function(x){return x.id===id;})||{});
  S._wtEditing=t;

  // Usuarios
  var users=S._wtUsers||[];
  var selEmail=t.asignadoEmail||(S.currentUser&&S.currentUser.email)||'';
  var selName=t.asignadoA||wtUserName();
  var userOpts='<option value="">— Sin asignar —</option>';
  if(users.length){
    users.forEach(function(u){
      var em=u.email||u.uid||''; var nm=u.nombre||u.displayName||em;
      var sel=(selEmail&&em===selEmail)||(!selEmail&&(nm===selName||nm.indexOf(selName)>=0||selName.indexOf(nm)>=0));
      userOpts+='<option value="'+wtEsc(em)+'" '+(sel?'selected':'')+'>'+wtEsc(nm)+(u.rol?' · '+wtEsc(u.rol):'')+'</option>';
    });
  } else {
    userOpts+='<option value="'+wtEsc(selEmail||selName)+'" selected>'+wtEsc(selName)+'</option>';
    if(typeof DB!=='undefined'&&DB.getUsers){ DB.getUsers().then(function(arr){ if(Array.isArray(arr)&&arr.length) S._wtUsers=arr; }).catch(function(){}); }
  }

  // Checklist
  var ck=(t.checklist&&t.checklist.length?t.checklist:[{txt:'',done:false}]).map(function(c,i){
    return '<div style="display:grid;grid-template-columns:24px 1fr 28px;gap:8px;align-items:center;margin-bottom:8px" class="wt-ck-row">'
      +'<input type="checkbox" id="wtck_'+i+'" '+(c.done?'checked':'')+' style="width:17px;height:17px;accent-color:var(--p1);cursor:pointer">'
      +'<input class="fi" id="wtcktxt_'+i+'" value="'+wtEsc(c.txt||'')+'" placeholder="Paso...">'
      +'<button type="button" style="width:26px;height:26px;border-radius:7px;border:1px solid var(--rim);background:transparent;color:var(--ink3);cursor:pointer;font-size:15px" onclick="this.closest(\'.wt-ck-row\').remove()">×</button>'
      +'</div>';
  }).join('');
  var ckDone=(t.checklist||[]).filter(function(c){return c.done;}).length;
  var ckTotal=(t.checklist||[]).length;
  var ckPct=ckTotal?Math.round(ckDone/ckTotal*100):0;

  // Comentarios
  var comments=(t.comentarios||[]).map(function(c){
    return '<div style="background:var(--surf2);border-radius:10px;padding:10px 12px;margin-bottom:7px">'
      +'<div style="font-size:10.5px;color:var(--ink3);font-weight:800;margin-bottom:3px">'+wtEsc(c.user||'Usuario')+' · '+(typeof fmtFechaHora==='function'?fmtFechaHora(c.fecha):wtEsc((c.fecha||'').slice(0,16).replace('T',' ')))+'</div>'
      +'<div style="font-size:13px;color:var(--ink2);line-height:1.45">'+wtEsc(c.txt)+'</div>'
      +'</div>';
  }).join('')||'<div style="font-size:12px;color:var(--ink3);padding:14px;text-align:center;border:1px dashed var(--rim);border-radius:9px;margin-bottom:9px">Sin comentarios</div>';

  // Header del modal — igual al sistema
  var titleEl=$('mtt')||$('mttl'); if(titleEl) titleEl.textContent=isNew?'Nueva tarea':'Editar tarea';
  var subEl=$('msb'); if(subEl) subEl.textContent='Centro de trabajo · checklist · comentarios';
  var ic=$('mic'); if(ic){ ic.textContent='WK'; ic.style.cssText='font-family:var(--fm);font-size:10px;font-weight:700;color:var(--p1)'; }
  var modal=document.querySelector('#ov .modal')||document.querySelector('#ov [class*=modal]');
  if(modal){ modal.style.maxWidth='900px'; modal.style.width='calc(100vw - 28px)'; }
  var mbd=$('mbd'); if(mbd) mbd.style.padding='0';

  // Tabs de tipo
  var tipos=['Operacional','Cliente','Moto / credito','Cobranza','Documentos','Interno'];
  var tipoActivo=t.tipo||'Operacional';
  var tipoTabs=tipos.map(function(tp){
    var on=tp===tipoActivo;
    return '<button type="button" onclick="wtSetTipoTab(this,\''+wtEsc(tp)+'\')" data-tipo="'+wtEsc(tp)+'" style="padding:10px 15px;font-size:13px;color:'+(on?'var(--p1)':'var(--ink3)')+';cursor:pointer;border:none;border-bottom:2.5px solid '+(on?'var(--p1)':'transparent')+';white-space:nowrap;background:transparent;font-weight:'+(on?'800':'400')+'">'+wtEsc(tp)+'</button>';
  }).join('');

  // Campos contextuales
  var ctxFields='';
  if(tipoActivo==='Cliente'){
    ctxFields='<div class="fg" style="margin-bottom:14px"><label>Cliente vinculado</label><input class="fi" id="wt7-ctx-cliente" value="'+wtEsc(t.ctxCliente||'')+'" placeholder="Buscar cliente..."></div>';
  } else if(tipoActivo==='Moto / credito'){
    ctxFields='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">'
      +'<div class="fg"><label>Cliente</label><input class="fi" id="wt7-ctx-cliente" value="'+wtEsc(t.ctxCliente||'')+'" placeholder="Cliente..."></div>'
      +'<div class="fg"><label>Credito / moto</label><input class="fi" id="wt7-ctx-credito" value="'+wtEsc(t.ctxCredito||'')+'" placeholder="# credito o placa"></div>'
      +'</div>';
  } else if(tipoActivo==='Cobranza'){
    ctxFields='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">'
      +'<div class="fg"><label>Cliente en mora</label><input class="fi" id="wt7-ctx-cliente" value="'+wtEsc(t.ctxCliente||'')+'" placeholder="Cliente..."></div>'
      +'<div class="fg"><label>Monto a cobrar</label><input class="fi" id="wt7-ctx-monto" value="'+wtEsc(t.ctxMonto||'')+'" placeholder="$0.00"></div>'
      +'</div>';
  }

  $('mbd').innerHTML='<input type="hidden" id="wt7-tipo-val" value="'+wtEsc(tipoActivo)+'">'
    // Barra de tabs
    +'<div style="display:flex;gap:0;border-bottom:1px solid var(--rim);padding:0 22px;background:var(--surf2);overflow-x:auto">'+tipoTabs+'</div>'
    // Body en 2 columnas
    +'<div style="display:grid;grid-template-columns:1fr 272px">'
    // Columna izquierda
    +'<div data-wtcol="left" style="padding:20px 22px;border-right:1px solid var(--rim)">'
    +'<div class="fg" data-wtfield="titulo" style="margin-bottom:14px"><label>Que hay que hacer?</label>'
    +'<input class="fi" id="wttitulo" value="'+wtEsc(t.titulo||'')+'" placeholder="Ej: Llamar al banco, pedir documento..." style="font-size:15px;font-weight:700;padding:10px 12px"></div>'
    +'<div class="fg" data-wtfield="desc" style="margin-bottom:14px"><label>Descripcion / notas</label>'
    +'<textarea class="fta" id="wtdesc" rows="2" placeholder="Contexto, links o detalles...">'+wtEsc(t.descripcion||'')+'</textarea></div>'
    +ctxFields
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">'
    +'<div class="fg"><label>Asignar a</label><select class="fs" id="wtasig">'+userOpts+'</select></div>'
    +'<div class="fg"><label>Sede</label><select class="fs" id="wt7-sede">'
    +'<option value="" '+((!t.sede)?'selected':'')+'>Todas las sedes</option>'
    +'<option value="Empire" '+(t.sede==='Empire'?'selected':'')+'>Empire</option>'
    +'<option value="Toro" '+(t.sede==='Toro'?'selected':'')+'>Toro</option>'
    +'</select></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">'
    +'<div class="fg"><label>Fecha limite</label><input class="fi" id="wtfecha" type="date" value="'+wtEsc(t.fecha||'')+'"></div>'
    +'<div class="fg"><label>Hora (opcional)</label><input class="fi" id="wt7-hora" type="time" value="'+wtEsc(t.hora||'')+'"></div></div>'
    +'<div class="fg" style="margin-bottom:14px"><label>Prioridad</label>'
    +'<div style="display:flex;gap:8px">'
    +'<button type="button" data-prio="alta" id="wt7-prio-alta" onclick="wtSetPrio(\'alta\')" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--rim);background:'+(t.prioridad==='alta'?'#fee2e2':'var(--surf)')+';color:'+(t.prioridad==='alta'?'#991b1b':'var(--ink3)')+';cursor:pointer;font-size:13px;font-weight:600">Alta</button>'
    +'<button type="button" data-prio="media" id="wt7-prio-media" onclick="wtSetPrio(\'media\')" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--rim);background:'+(!t.prioridad||t.prioridad==='media'?'#fef3c7':'var(--surf)')+';color:'+(!t.prioridad||t.prioridad==='media'?'#92400e':'var(--ink3)')+';cursor:pointer;font-size:13px;font-weight:600">Media</button>'
    +'<button type="button" data-prio="baja" id="wt7-prio-baja" onclick="wtSetPrio(\'baja\')" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--rim);background:'+(t.prioridad==='baja'?'#dcfce7':'var(--surf)')+';color:'+(t.prioridad==='baja'?'#166534':'var(--ink3)')+';cursor:pointer;font-size:13px;font-weight:600">Baja</button>'
    +'<input type="hidden" id="wt7-prio-val" value="'+wtEsc(t.prioridad||'media')+'">'
    +'</div></div>'
    +'<div class="fg" style="margin-bottom:14px"><label>Estado</label>'
    +'<div style="display:flex;gap:6px">'
    +'<button type="button" data-estado="pendiente" onclick="wtSetEstado(\'pendiente\')" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--rim);background:'+(!t.estado||t.estado==='pendiente'?'var(--gb)':'var(--surf)')+';color:'+(!t.estado||t.estado==='pendiente'?'var(--p1)':'var(--ink3)')+';cursor:pointer;font-size:13px;font-weight:'+(!t.estado||t.estado==='pendiente'?'800':'400')+'">Pendiente</button>'
    +'<button type="button" data-estado="proceso" onclick="wtSetEstado(\'proceso\')" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--rim);background:'+(t.estado==='proceso'?'var(--ambers)':'var(--surf)')+';color:'+(t.estado==='proceso'?'var(--amber)':'var(--ink3)')+';cursor:pointer;font-size:13px;font-weight:'+(t.estado==='proceso'?'800':'400')+'">En proceso</button>'
    +'<button type="button" data-estado="completada" onclick="wtSetEstado(\'completada\')" style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--rim);background:'+(t.estado==='completada'?'var(--greens)':'var(--surf)')+';color:'+(t.estado==='completada'?'var(--green)':'var(--ink3)')+';cursor:pointer;font-size:13px;font-weight:'+(t.estado==='completada'?'800':'400')+'">Completada</button>'
    +'<input type="hidden" id="wt7-estado-val" value="'+wtEsc(t.estado||'pendiente')+'">'
    +'</div></div>'
    +'<div style="height:1px;background:var(--rim);margin:4px 0 16px"></div>'
    +'<div class="fg"><label>Checklist de pasos</label>'
    +'<div id="wtchecks">'+ck+'</div>'
    +(ckTotal>0?'<div style="background:var(--gs);border-radius:3px;height:3px;overflow:hidden;margin:6px 0 3px"><div style="height:100%;width:'+ckPct+'%;background:var(--p1);border-radius:3px"></div></div>'
      +'<div style="font-size:10px;color:var(--ink3);margin-bottom:8px">'+ckDone+' de '+ckTotal+' pasos · '+ckPct+'%</div>':'')
    +'<button type="button" class="btn btn-g btn-sm" style="width:100%;margin-top:4px" onclick="wtAddCheckRow()">+ Agregar paso</button>'
    +'</div>'
    +'</div>'
    // Columna derecha
    +'<div style="padding:18px 16px;background:var(--surf2)">'
    +'<div class="card" style="margin-bottom:12px">'
    +'<div style="font-size:13px;font-weight:800;color:var(--ink);margin-bottom:3px">Recordatorio</div>'
    +'<div style="font-size:11px;color:var(--ink3);margin-bottom:10px">Notifica al responsable</div>'
    +'<div style="display:flex;gap:5px">'
    +'<button type="button" data-remind="vencer" onclick="wtSetRemind(this,\'vencer\')" style="flex:1;padding:7px 3px;border-radius:8px;border:1px solid var(--rim);background:'+(!t.recordatorio||t.recordatorio==='vencer'?'var(--gb)':'var(--surf)')+';font-size:11px;color:'+(!t.recordatorio||t.recordatorio==='vencer'?'var(--p1)':'var(--ink3)')+';cursor:pointer;font-weight:'+(!t.recordatorio||t.recordatorio==='vencer'?'800':'400')+'">Al vencer</button>'
    +'<button type="button" data-remind="1dia" onclick="wtSetRemind(this,\'1dia\')" style="flex:1;padding:7px 3px;border-radius:8px;border:1px solid var(--rim);background:'+(t.recordatorio==='1dia'?'var(--gb)':'var(--surf)')+';font-size:11px;color:'+(t.recordatorio==='1dia'?'var(--p1)':'var(--ink3)')+';cursor:pointer;font-weight:'+(t.recordatorio==='1dia'?'800':'400')+'">1 dia antes</button>'
    +'<button type="button" data-remind="no" onclick="wtSetRemind(this,\'no\')" style="flex:1;padding:7px 3px;border-radius:8px;border:1px solid var(--rim);background:'+(t.recordatorio==='no'?'var(--gb)':'var(--surf)')+';font-size:11px;color:'+(t.recordatorio==='no'?'var(--p1)':'var(--ink3)')+';cursor:pointer;font-weight:'+(t.recordatorio==='no'?'800':'400')+'">Sin aviso</button>'
    +'<input type="hidden" id="wt7-remind-val" value="'+wtEsc(t.recordatorio||'vencer')+'">'
    +'</div></div>'
    +'<div class="card">'
    +'<div style="font-size:13px;font-weight:800;color:var(--ink);margin-bottom:3px">Comentarios internos</div>'
    +'<div style="font-size:11px;color:var(--ink3);margin-bottom:10px">Historial del equipo</div>'
    +'<div style="max-height:200px;overflow-y:auto;margin-bottom:10px">'+comments+'</div>'
    +'<div class="fg"><label>Agregar comentario</label>'
    +'<textarea class="fta" id="wtcomment" rows="2" placeholder="Escribe algo para el equipo..."></textarea></div>'
    +'</div>'
    +'</div>'
    +'</div>';

  $('mft').innerHTML='<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    +(!isNew&&!t.archivado?'<button class="btn" style="color:var(--red);border-color:var(--red)" onclick="wtArchive(\''+wtEsc(t.id)+'\')">Archivar</button>':'')
    +'<button class="btn btn-p" onclick="saveWtTask(\''+wtEsc(t.id)+'\')">Guardar tarea</button>';

  $('ov').style.display='flex';
  if(isNew){ setTimeout(function(){ var ti=$('wttitulo'); if(ti) ti.focus(); },80); }
}


// Helpers UI del modal
function wtSetTipoTab(el,tipo){
  // Update tabs visual
  document.querySelectorAll('[data-tipo]').forEach(function(btn){
    var on=btn.getAttribute('data-tipo')===tipo;
    btn.style.color=on?'var(--p1)':'var(--ink3)';
    btn.style.borderBottomColor=on?'var(--p1)':'transparent';
    btn.style.fontWeight=on?'800':'400';
  });
  // Update hidden input
  var h=$('wt7-tipo-val'); if(h) h.value=tipo;
  // Update ctx fields
  var ctxWrap=document.getElementById('wt7-ctx-wrap');
  var leftCol=document.querySelector('[data-wtcol="left"]');
  if(!leftCol) return;
  if(ctxWrap) ctxWrap.remove();
  if(tipo==='Cliente'||tipo==='Moto / credito'||tipo==='Cobranza'){
    var t=S._wtEditing||{};
    var wrap=document.createElement('div'); wrap.id='wt7-ctx-wrap'; wrap.style.marginBottom='14px';
    if(tipo==='Cliente'){
      wrap.innerHTML='<div class="fg"><label>Cliente vinculado</label><input class="fi" id="wt7-ctx-cliente" value="'+wtEsc(t.ctxCliente||'')+'" placeholder="Buscar cliente..."></div>';
    } else if(tipo==='Moto / credito'){
      wrap.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
        +'<div class="fg"><label>Cliente</label><input class="fi" id="wt7-ctx-cliente" value="'+wtEsc(t.ctxCliente||'')+'" placeholder="Cliente..."></div>'
        +'<div class="fg"><label>Credito / moto</label><input class="fi" id="wt7-ctx-credito" value="'+wtEsc(t.ctxCredito||'')+'" placeholder="# credito o placa"></div>'
        +'</div>';
    } else {
      wrap.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'
        +'<div class="fg"><label>Cliente en mora</label><input class="fi" id="wt7-ctx-cliente" value="'+wtEsc(t.ctxCliente||'')+'" placeholder="Cliente..."></div>'
        +'<div class="fg"><label>Monto a cobrar</label><input class="fi" id="wt7-ctx-monto" value="'+wtEsc(t.ctxMonto||'')+'" placeholder="$0.00"></div>'
        +'</div>';
    }
    // Insert after descripcion field
    var fgs=leftCol.querySelectorAll('[data-wtfield]');
    var after=fgs[1]||fgs[0];
    if(after&&after.nextSibling) leftCol.insertBefore(wrap,after.nextSibling);
    else leftCol.appendChild(wrap);
  }
}
function wtSetPrio(p){
  var h=$('wt7-prio-val'); if(h) h.value=p;
  document.querySelectorAll('[data-prio]').forEach(function(btn){
    var x=btn.getAttribute('data-prio');
    var on=x===p;
    btn.style.fontWeight=on?'700':'400';
    if(on){
      if(p==='alta'){btn.style.background='#fee2e2';btn.style.borderColor='#fca5a5';btn.style.color='#991b1b';}
      else if(p==='media'){btn.style.background='#fef3c7';btn.style.borderColor='#fcd34d';btn.style.color='#92400e';}
      else{btn.style.background='#dcfce7';btn.style.borderColor='#86efac';btn.style.color='#166534';}
    } else {
      btn.style.background='var(--surf)'; btn.style.borderColor='var(--rim)'; btn.style.color='var(--ink3)';
    }
  });
}
function wtSetEstado(e){
  var h=$('wt7-estado-val'); if(h) h.value=e;
  document.querySelectorAll('[data-estado]').forEach(function(btn){
    var on=btn.getAttribute('data-estado')===e;
    btn.style.background=on?'var(--gb)':'var(--surf)';
    btn.style.color=on?'var(--p1)':'var(--ink3)';
    btn.style.fontWeight=on?'800':'400';
    btn.style.borderColor=on?'var(--p1)':'var(--rim)';
  });
}
function wtSetRemind(el,v){
  var h=$('wt7-remind-val'); if(h) h.value=v;
  document.querySelectorAll('[data-remind]').forEach(function(btn){
    var on=btn.getAttribute('data-remind')===v;
    btn.style.background=on?'var(--gb)':'var(--surf)';
    btn.style.color=on?'var(--p1)':'var(--ink3)';
    btn.style.fontWeight=on?'800':'400';
    btn.style.borderColor=on?'var(--p1)':'var(--rim)';
  });
}

function wtVerTarea(id){
  var t=(S.tareas||[]).find(function(x){ return x.id===id; });
  if(!t) return;

  var today=wtToday();
  var isVenc=t.fecha&&t.fecha<today&&t.estado!=='completada';
  var prioBdg={alta:'b-r',media:'b-a',baja:'b-g'}[t.prioridad||'media']||'b-a';
  var borderCol={alta:'var(--red)',media:'var(--amber)',baja:'var(--green)'}[t.prioridad||'media']||'var(--amber)';
  var total=(t.checklist||[]).length;
  var done=(t.checklist||[]).filter(function(c){return c.done;}).length;
  var pct=total?Math.round(done/total*100):0;

  // Status badge
  var statusBdg;
  if(t.archivado) statusBdg='<span class="bdg b-x">Archivada</span>';
  else if(t.estado==='completada') statusBdg='<span class="bdg b-g">Completada</span>';
  else if(isVenc) statusBdg='<span class="bdg b-r">Vencida</span>';
  else if(t.estado==='proceso') statusBdg='<span class="bdg b-a">En proceso</span>';
  else statusBdg='<span class="bdg b-p">Pendiente</span>';

  // Modal header
  var ic=$('mic'); if(ic){ ic.textContent='WK'; ic.style.cssText='font-family:var(--fm);font-size:10px;font-weight:700;color:var(--p1)'; }
  var mtt=$('mtt'); if(mtt) mtt.textContent=t.titulo||'Tarea';
  var msb=$('msb'); if(msb) msb.textContent=(t.tipo||'Operacional')+' · '+(t.asignadoA||'Sin asignar');

  // Checklist
  var ckHTML='';
  if(t.checklist&&t.checklist.length){
    ckHTML='<div class="fg" style="margin-bottom:16px"><label>Checklist &middot; '+done+'/'+total+' ('+pct+'%)</label>'
      +'<div style="background:var(--lift);border-radius:3px;height:4px;overflow:hidden;margin-bottom:10px">'
        +'<div class="pf p-p" style="width:'+pct+'%"></div>'
      +'</div>';
    t.checklist.forEach(function(c,i){
      var checked=c.done?'checked':'';
      var strike=c.done?'text-decoration:line-through;opacity:.5':'';
      ckHTML+='<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--rim)">'
        +'<input type="checkbox" '+checked+' data-task-id="'+wtEsc(id)+'" data-idx="'+i+'" onchange="wtToggleCheckById(this)" style="width:16px;height:16px;accent-color:var(--p1);cursor:pointer;flex-shrink:0">'
        +'<span style="font-size:13px;color:var(--ink);'+strike+'">'+wtEsc(c.txt||'')+'</span>'
        +'</div>';
    });
    ckHTML+='</div>';
  }

  // Comentarios
  var cmHTML='';
  if(t.comentarios&&t.comentarios.length){
    cmHTML='<div class="fg" style="margin-bottom:16px"><label>Comentarios ('+t.comentarios.length+')</label>';
    t.comentarios.forEach(function(c){
      cmHTML+='<div style="background:var(--surf2);border-radius:10px;padding:10px 12px;margin-bottom:7px">'
        +'<div style="font-size:10.5px;color:var(--ink3);font-weight:800;margin-bottom:3px">'+(c.user||'—')+' &middot; '+(c.fecha||'').slice(0,10)+'</div>'
        +'<div style="font-size:13px;color:var(--ink2)">'+wtEsc(c.txt||'')+'</div>'
        +'</div>';
    });
    cmHTML+='</div>';
  }

  // Contexto
  var ctxHTML='';
  if(t.ctxCliente) ctxHTML+='<div class="fg" style="margin-bottom:10px"><label>Cliente</label><div style="font-size:13px;padding:5px 0">'+wtEsc(t.ctxCliente)+'</div></div>';
  if(t.ctxCredito) ctxHTML+='<div class="fg" style="margin-bottom:10px"><label>Crédito / Moto</label><div style="font-size:13px;padding:5px 0">'+wtEsc(t.ctxCredito)+'</div></div>';
  if(t.ctxMonto)   ctxHTML+='<div class="fg" style="margin-bottom:10px"><label>Monto</label><div style="font-size:13px;padding:5px 0">'+wtEsc(t.ctxMonto)+'</div></div>';

  $('mbd').innerHTML=
    '<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid var(--rim);margin-bottom:16px">'
      +statusBdg
      +'<span class="bdg '+prioBdg+'">'+wtPrioLabel(t.prioridad)+'</span>'
      +'<span class="bdg b-p">'+(t.tipo||'—')+'</span>'
      +(t.sede?'<span class="bdg b-b">'+wtEsc(t.sede)+'</span>':'')
    +'</div>'
    +(t.descripcion?'<div class="fg" style="margin-bottom:16px"><label>Descripción</label>'
      +'<div style="font-size:13px;color:var(--ink2);line-height:1.6;padding:10px 12px;background:var(--surf2);border-radius:9px">'+wtEsc(t.descripcion)+'</div></div>':'')
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">'
      +'<div class="fg"><label>Asignado a</label><div style="font-size:13px;font-weight:700;padding:5px 0">'+(t.asignadoA||'Sin asignar')+'</div></div>'
      +'<div class="fg"><label>Fecha límite</label><div style="font-size:13px;font-weight:700;color:'+(isVenc?'var(--red)':'var(--ink)')+';padding:5px 0">'+(t.fecha||'Sin fecha')+(t.hora?' &middot; '+t.hora:'')+'</div></div>'
      +'<div class="fg"><label>Creada por</label><div style="font-size:12px;color:var(--ink3);padding:5px 0">'+(t.creadaPor||'—')+'</div></div>'
      +'<div class="fg"><label>Creada el</label><div style="font-size:12px;color:var(--ink3);padding:5px 0">'+((t.createdAt||'').slice(0,10)||'—')+'</div></div>'
    +'</div>'
    +ctxHTML
    +ckHTML
    +cmHTML
    +'<div class="fg" style="margin-top:8px"><label>Agregar comentario</label>'
      +'<textarea class="fta" id="wt-view-comment" rows="2" placeholder="Escribe algo..." data-task-id="'+wtEsc(id)+'"></textarea>'
    +'</div>';

  $('mft').innerHTML=
    '<button class="btn btn-g" onclick="closeM()">Cerrar</button>'
    +(!t.archivado?'<button class="btn btn-g" data-task-id="'+wtEsc(id)+'" onclick="var tid=this.dataset.taskId;closeM();setTimeout(function(){openWtTask(tid);},50)">✏ Editar</button>':'')
    +'<button class="btn btn-p" onclick="wtAddViewComment()">Guardar comentario</button>';

  $('ov').style.display='flex';
}

function wtToggleCheckById(el){
  var taskId=el.dataset.taskId, idx=parseInt(el.dataset.idx), checked=el.checked;
  var t=(S.tareas||[]).find(function(x){ return x.id===taskId; });
  if(!t||!t.checklist||!t.checklist[idx]) return;
  t.checklist[idx].done=checked;
  t.updatedAt=new Date().toISOString();
  wtPersist(t);
  // Update progress bar
  var done=t.checklist.filter(function(c){return c.done;}).length;
  var pct=t.checklist.length?Math.round(done/t.checklist.length*100):0;
  var bar=document.querySelector('#mbd .pf');
  if(bar) bar.style.width=pct+'%';
}

function wtAddViewComment(){
  var inp=$('wt-view-comment');
  if(!inp) return;
  var taskId=inp.dataset.taskId;
  var t=(S.tareas||[]).find(function(x){ return x.id===taskId; });
  if(!t) return;
  var txt=(inp.value||'').trim();
  if(!txt){ toast('Escribe algo primero','info'); return; }
  if(!t.comentarios) t.comentarios=[];
  t.comentarios.push({txt:txt, user:wtUserName(), fecha:new Date().toISOString()});
  t.updatedAt=new Date().toISOString();
  wtPersist(t);
  toast('Comentario guardado','ok');
  wtVerTarea(taskId);
}


function saveWtTask(id){
  var old=S._wtEditing||{}; var t=Object.assign({},old);
  t.id=id||old.id||('T'+Date.now());
  t.titulo=(($('wttitulo')||{}).value||'Tarea sin título').trim();
  t.descripcion=(($('wtdesc')||{}).value)||'';
  t.tipo=($('wt7-tipo-val')||{}).value||old.tipo||'Operacional';
  t.sede=($('wt7-sede')||{}).value||'';
  t.hora=($('wt7-hora')||{}).value||'';
  t.recordatorio=($('wt7-remind-val')||{}).value||'vencer';
  // Contexto
  t.ctxCliente=($('wt7-ctx-cliente')||{}).value||'';
  t.ctxCredito=($('wt7-ctx-credito')||{}).value||'';
  t.ctxMonto=($('wt7-ctx-monto')||{}).value||'';
  var sel=$('wtasig'); var opt=sel&&sel.options?sel.options[sel.selectedIndex]:null;
  t.asignadoEmail=(sel&&sel.value)||'';
  t.asignadoA=(opt&&opt.textContent?opt.textContent.split(' · ')[0].trim():'') || t.asignadoEmail || wtUserName();
  t.fecha=(($('wtfecha')||{}).value)||'';
  t.prioridad=($('wt7-prio-val')||{}).value||'media';
  t.estado=($('wt7-estado-val')||{}).value||'pendiente';
  t.archivado=!!old.archivado;
  t.updatedAt=new Date().toISOString();
  if(!t.createdAt) t.createdAt=new Date().toISOString();
  t.creadaPor=old.creadaPor||wtUserName();
  t.checklist=[];
  var box=$('wtchecks');
  if(box){ box.querySelectorAll('.wt-ck-row').forEach(function(row){
    var inputs=row.querySelectorAll('input');
    var txt=''; var ck=false;
    inputs.forEach(function(inp){ if(inp.type==='checkbox') ck=inp.checked; else if(inp.type!=='hidden') txt=(inp.value||'').trim(); });
    if(txt) t.checklist.push({txt:txt,done:ck});
  }); }
  t.comentarios=Array.isArray(old.comentarios)?old.comentarios.slice():[];
  var cm=(($('wtcomment')||{}).value||'').trim();
  if(cm) t.comentarios.push({txt:cm,user:wtUserName(),fecha:new Date().toISOString()});
  var idx=(S.tareas||[]).findIndex(function(x){return x.id===t.id;});
  if(idx>=0) S.tareas[idx]=t; else S.tareas.push(t);
  wtPersist(t); closeM(); nav('centro'); toast('Tarea guardada y asignada a '+t.asignadoA,'ok');
}
