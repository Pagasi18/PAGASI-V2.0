// Logica de creditos y wizard de solicitudes. Extraido mecanicamente de assets/pagasi-app.js.
var WZ = {
  step: 1,
  totalSteps: 4,
// score: 0,
  f1:0, f2:0, f3:0, f4:0, f5:0,
  cuota:0, ratio:0, monto:0, precio:0, plazo:0, ini:0, ing:0
};

function openAddCred(motoId=null){
  // Overlay fullscreen — reemplaza el modal estándar
  var overlay = document.getElementById('wz-overlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'wz-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2000;background:var(--bg);overflow-y:auto;display:none';
    document.body.appendChild(overlay);
  }
  WZ = { step:1, totalSteps:4, score:0, f1:0,f2:0,f3:0,f4:0,f5:0, cuota:0,ratio:0,monto:0,precio:0,plazo:0,ini:0,ing:0 };
  // Si hay datos precargados desde editarCredSinFirma, restaurarlos después del reset
  if(window._wzPreload){
    Object.assign(WZ, window._wzPreload);
    window._wzPreload = null;
  }
  overlay.style.display = 'block';
  document.body.style.overflow = 'hidden';
  _wzRender(motoId);
}

function _wzClose(){
  var ov = document.getElementById('wz-overlay');
  if(ov) ov.style.display = 'none';
  document.body.style.overflow = '';
  window._wzEditando = null; // limpiar modo edición al cerrar
}

function _wzRender(motoId){
  sincronizarInventarioConCreditos({save:true});
  var ov = document.getElementById('wz-overlay');
  var motosDisp = S.motos.filter(function(m){ return !m.eliminado && m.estado==='disponible'; });

  // ── Colores del score ──
  function scoreCol(s){ return s>=625?'var(--green)':s>=450?'var(--amber)':'var(--red)'; }
  function scoreLbl(s){ return s>=750?'Excelente':s>=625?'Bueno':s>=450?'Regular':'Bajo'; }

  // ── HTML de pasos ──
  var stepsTpl = [
    '① Cliente',
    '② Perfil',
    '③ Moto',
    '④ Resultado'
  ].map(function(l,i){
    var on = WZ.step === i+1;
    var done = WZ.step > i+1;
    return '<div style="display:flex;align-items:center;gap:4px;font-size:11px;font-weight:'+(on?'700':'500')+';color:'+(on?'var(--p1)':done?'var(--green)':'var(--ink3)')+'">'+
      '<div style="width:20px;height:20px;border-radius:50%;background:'+(on?'var(--p1)':done?'var(--green)':'var(--rim2)')+';color:'+(on||done?'#fff':'var(--ink3)')+';display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;flex-shrink:0">'+(done?'✓':(i+1))+'</div>'+
      '<span style="white-space:nowrap">'+l.slice(2)+'</span></div>' +
      (i<3?'<div style="height:1px;background:var(--rim);flex:1;min-width:8px"></div>':'');
  }).join('');

  // ── Score pill ──
  var scorePill = WZ.score>0
    ? '<div style="display:flex;align-items:center;gap:10px;background:var(--surf);border:1.5px solid var(--rim2);border-radius:50px;padding:7px 16px">'
        +'<div style="font-size:22px;font-weight:900;letter-spacing:-1px;color:'+scoreCol(WZ.score)+'">'+WZ.score+'</div>'
        +'<div><div style="font-size:10px;font-weight:700;color:'+scoreCol(WZ.score)+'">'+scoreLbl(WZ.score)+'</div>'
        +'<div style="font-size:9px;color:var(--ink3)">Score Indexa /850</div></div>'
        +(WZ.cuota>0?'<div style="width:1px;height:28px;background:var(--rim);margin:0 4px"></div><div><div style="font-size:13px;font-weight:800;color:var(--p1)">$'+WZ.cuota.toFixed(2)+'</div><div style="font-size:9px;color:var(--ink3)">cuota quincenal</div></div>':'')
        +'</div>'
    : '<div style="font-size:12px;color:var(--ink3);padding:7px 16px;background:var(--surf2);border-radius:50px;border:1px solid var(--rim)">Score aparece al completar datos</div>';

  // ── PASO 1: Datos del cliente ──
  var step1 = '<div class="fg" style="margin-bottom:10px"><label class="fsec" style="display:block;margin-bottom:5px">Cliente registrado</label>'
    + '<div id="wz_cli_search_wrap" style="position:relative">'
    + '<div id="wz_cli_chip" style="display:none;align-items:center;gap:8px;padding:9px 11px;background:rgba(74,107,255,.1);border:1.5px solid var(--p1);border-radius:9px">'
    + '<span style="width:8px;height:8px;border-radius:50%;background:var(--p1);flex-shrink:0"></span>'
    + '<div style="flex:1;min-width:0"><div id="wz_cli_chip_nom" style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div><div id="wz_cli_chip_ci" style="font-size:11px;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></div></div>'
    + '<button type="button" onclick="_wzCliClear()" style="border:none;background:rgba(255,71,87,.12);color:var(--red);width:26px;height:26px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:700">x</button>'
    + '</div>'
    + '<input type="text" class="fi" id="wz_cli_search" autocomplete="off" placeholder="Buscar cliente por nombre o cédula..." oninput="_wzCliSearch()" onfocus="_wzCliSearch()" onblur="setTimeout(_wzCliBlur,200)">'
    + '<input type="hidden" id="wz_cliente_sel" value="">'
    + '<div id="wz_cli_dd" style="display:none;position:absolute;top:100%;left:0;right:0;margin-top:4px;background:var(--surf);border:1px solid var(--rim);border-radius:9px;max-height:280px;overflow-y:auto;box-shadow:0 10px 30px rgba(0,0,0,.12);z-index:100"></div>'
    + '</div>'
    + '<div style="font-size:11px;color:var(--ink3);margin-top:6px">Busca un cliente existente o deja vacío para crear uno nuevo con los datos de abajo.</div></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    + _wzFg('Nombre completo *','wz_nom','text','Ej: Carlos Pérez','',true)
    + _wzFg('N° Cédula *','wz_ci','text','V-12345678','oninput="_wzCedulaInput(event)" autocapitalize="characters"',true)
    + _wzFg('Teléfono *','wz_tel','tel','0412-0000000','',true)
    + _wzFg('WhatsApp','wz_wa','tel','0412-0000000')
    + _wzFg('Correo','wz_email','email','correo@ejemplo.com')
    + _wzFg('Ciudad','wz_ciudad','text','Ej: Caracas')
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">'
    + '<div class="fg"><label class="fsec" style="display:block;margin-bottom:5px">Tipo de empleo *</label>'
    + '<select class="fs" id="wz_emp" onchange="_wzScore()">'
    + '<option value="">Seleccionar...</option>'
    + '<option value="formal">Formal / Empleado</option>'
    + '<option value="publico">Empleado Público</option>'
    + '<option value="delivery">Delivery / Motorizado</option>'
    + '<option value="independiente">Independiente</option>'
    + '<option value="comerciante">Comercio / Negocio</option>'
    + '<option value="remesas">Remesas</option>'
    + '<option value="informal">Informal</option>'
    + '</select></div>'
    + '<div class="fg"><label class="fsec" style="display:block;margin-bottom:5px">Antigüedad laboral</label>'
    + '<select class="fs" id="wz_ant" onchange="_wzScore()">'
    + '<option value="">Seleccionar...</option>'
    + '<option value="1">Menos de 6 meses</option>'
    + '<option value="2">6 meses – 1 año</option>'
    + '<option value="3">1 a 3 años</option>'
    + '<option value="5">Más de 3 años</option>'
    + '</select></div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">'
    + _wzFg('Ingreso mensual (USD) *','wz_ing','number','0','oninput="_wzScore()"',true)
    + _wzFg('Ingreso familiar total (USD)','wz_ifam','number','0','oninput="_wzScore()"')
    + '</div>'
    + '<div style="margin-top:10px"><label class="fsec" style="display:block;margin-bottom:5px">¿Cómo nos conoció?</label>'
    + '<select class="fs" id="wz_conocio" onchange="_wzScore()">'
    + '<option value="">Seleccionar...</option>'
    + '<option value="referido">Referido por cliente</option>'
    + '<option value="redes">Redes sociales</option>'
    + '<option value="vitrina">Vitrina / local</option>'
    + '<option value="google">Google / internet</option>'
    + '<option value="anterior">Cliente anterior</option>'
    + '<option value="otro">Otro</option>'
    + '</select></div>';

  // ── PASO 2: Moto ──
  var motoOptions = motosDisp.length
    ? motosDisp.map(function(m){ return '<option value="'+m.id+'" data-precio="'+m.precio+'"'+(motoId===m.id?' selected':'')+'>'+m.modelo+' — $'+m.precio.toFixed(2)+'</option>'; }).join('')
    : '<option value="">— No hay motos disponibles —</option>';

  // Catálogo completo, organizado: sin duplicados (mismo modelo+precio) y ordenado A→Z por modelo
  var _catVistos = {};
  var _catOrdenado = (CATALOGO||[]).filter(function(c){
    if(!c || !c.modelo) return false;
    var k = (c.modelo+'|'+c.precio).toUpperCase();
    if(_catVistos[k]) return false;
    _catVistos[k] = true;
    return true;
  }).slice().sort(function(a,b){
    return String(a.modelo).localeCompare(String(b.modelo),'es',{numeric:true,sensitivity:'base'});
  });
  var catOptions = _catOrdenado.map(function(c){
    return '<option value="'+c.precio+'" data-modelo="'+c.modelo+'">'+c.modelo+' — $'+c.precio.toFixed(2)+'</option>';
  }).join('') + '<option value="__wz_new_cat__">＋ Agregar nueva moto al catálogo...</option>';

  var step2 = '<div style="background:var(--surf2);border:1px solid var(--rim);border-radius:12px;padding:14px;margin-bottom:12px">'
    + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--p1);margin-bottom:10px">Moto del inventario disponible</div>'
    + '<div class="fg"><label class="fsec" style="display:block;margin-bottom:5px">Seleccionar unidad disponible</label>'
    + '<select class="fs" id="wz_moto_inv" onchange="_wzPickMotoInv(this)">'
    + '<option value="">— Sin asignar del inventario —</option>'
    + motoOptions
    + '</select></div>'
    + '</div>'
    + '<div style="text-align:center;font-size:11px;color:var(--ink3);margin:8px 0">— o usa el catálogo de precios —</div>'
    + '<div class="fg"><label class="fsec" style="display:block;margin-bottom:5px">Modelo del catálogo</label>'
    + '<select class="fs" id="wz_moto_cat" onchange="_wzPickMotoCat(this)">'
    + '<option value="">Seleccionar modelo...</option>'
    + catOptions
    + '</select></div>'
    + '<div id="wz_new_cat_div" style="display:none;background:var(--surf2);border:1px solid var(--rim);border-radius:10px;padding:12px;margin-top:8px">'
    + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--p1);margin-bottom:8px">Nueva moto al catálogo</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">'
    + '<div class="fg"><label class="fsec" style="display:block;margin-bottom:4px">Marca</label><input class="fi" id="wz_cat_marca" placeholder="Ej: Empire, Bera..."></div>'
    + '<div class="fg"><label class="fsec" style="display:block;margin-bottom:4px">Modelo *</label><input class="fi" id="wz_cat_modelo" placeholder="Ej: NEW HORSE 150" oninput="_wzCatPrecioSync()"></div>'
    + '<div class="fg"><label class="fsec" style="display:block;margin-bottom:4px">Precio USD *</label><input class="fi" id="wz_cat_precio" type="number" placeholder="0.00" oninput="_wzCatPrecioSync()"></div>'
    + '</div>'
    + '<div style="font-size:11px;color:var(--ink3);margin-top:6px">Se guardará en el catálogo y se usará en este crédito.</div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">'
    + _wzFg('Precio (USD)','wz_precio','number','0','oninput="_wzActualizarPrecioBaseDesdePrecio();_wzActualizarFinPreview(this.value);_wzMpagoSync();_wzScore()"',true)
    + '<div class="fg"><label class="fsec" style="display:block;margin-bottom:5px">Uso de la moto *</label>'
    + '<select class="fs" id="wz_uso" onchange="_wzScore()">'
    + '<option value="personal">Personal</option>'
    + '<option value="delivery">Delivery / Trabajo</option>'
    + '<option value="negocio">Negocio</option>'
    + '</select></div>'
    + '</div>'
    + '<div style="background:var(--surf);border:1px solid var(--rim);border-radius:12px;padding:14px;margin-top:12px">'
    + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--p1);margin-bottom:10px">Plan del crédito</div>'
    + '<div class="fgr">'
    + '<div class="fg"><label>Tipo de plan</label><select class="fs" id="wz_plan_mode" onchange="_wzTogglePlanMode(this.value)"><option value="global">Plan principal</option><option value="custom">Plan personalizado</option><option value="apy">APY / Meses</option></select></div>'
    + '<div class="fg"><label>Precio base real (USD)</label><input class="fi" id="wz_precio_base_real" type="number" placeholder="0.00" oninput="_wzActualizarFinPreview(WZ.precio||0);_wzMpagoSync();_wzScore()"></div>'
    + '</div>'
    + '<div id="wz_plan_custom_box" style="display:none;margin-top:10px">'
    + '<div class="fgr">'
    + '<div class="fg"><label>Inicial real (USD)</label><input class="fi" id="wz_ini_real" type="number" placeholder="0.00" oninput="_wzActualizarFinPreview(WZ.precio||0);_wzMpagoSync();_wzScore()"></div>'
    + '<div class="fg"><label>Cuota quincenal (USD)</label><input class="fi" id="wz_cuota_q_custom" type="number" placeholder="0.00" oninput="_wzActualizarFinPreview(WZ.precio||0);_wzScore()"></div>'
    + '<div class="fg"><label>Plazo (meses)</label><input class="fi" id="wz_plazo_custom" type="number" min="1" step="1" placeholder="12" oninput="_wzActualizarFinPreview(WZ.precio||0);_wzScore()"></div>'
    + '</div>'
    + '<div style="font-size:11px;color:var(--ink3);margin-top:6px">Solo indicas precio base real, inicial real, cuota quincenal y plazo. El sistema calcula factor y tasa automáticamente.</div>'
    + '</div>'
    + '<div id="wz_plan_apy_box" style="display:none;margin-top:10px">'
    + '<div class="fgr">'
    + '<div class="fg"><label>APY objetivo (%)</label><input class="fi" id="wz_apy_objetivo" type="number" step="0.01" placeholder="413.34" oninput="_wzApyCompare()"></div>'
    + '<div class="fg"><label>Plazo (meses)</label><input class="fi" id="wz_apy_plazo" type="number" min="1" step="1" placeholder="12" oninput="_wzApyCompare()"></div>'
    + '</div>'
    + '<div id="wz_apy_compare" style="display:none;margin-top:12px;background:var(--surf2);border:1px solid var(--rim);border-radius:10px;padding:12px">'
    + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--p1);margin-bottom:8px">Comparativo de iniciales</div>'
    + '<div id="wz_apy_compare_grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px"></div>'
    + '<div style="font-size:11px;color:var(--ink3);margin-top:8px">Selecciona la opción que deseas aplicar:</div>'
    + '<div class="fg" style="margin-top:6px"><select class="fs" id="wz_apy_inicial_sel" onchange="_wzActualizarFinPreview(WZ.precio||0);_wzMpagoSync();_wzScore()">'
    + '<option value="0.45">Inicial 45%</option>'
    + '<option value="0.50" selected>Inicial 50%</option>'
    + '<option value="0.55">Inicial 55%</option>'
    + '<option value="custom">Inicial personalizada</option>'
    + '</select></div>'
    + '<button type="button" class="btn btn-g btn-sm" style="margin-top:8px" onclick="_wzGuardarPlanApy()">Guardar como plan nuevo</button>'
    + '</div>'
    + '<div style="font-size:11px;color:var(--ink3);margin-top:6px">Indicas APY objetivo y plazo. El sistema calcula la cuota quincenal para iniciales de 45%, 50% y 55%.</div>'
    + '</div>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px">'
    + _wzFg('Marca','wz_marca','text','Ej: Empire, Bera...')
    + _wzFg('VIN / Serial','wz_vin','text','Ej: 8LBCF...')
    + _wzFg('Color','wz_color','text','Ej: Negro')
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px">'
    + _wzFg('Año','wz_anio','number',new Date().getFullYear())
    + _wzFg('Placa (si aplica)','wz_placa','text','AA123BC')
    + _wzFg('N° de GPS','wz_gps_num','text','Ej: GPS-12345')
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">'
    + _wzFg('Serial de Motor','wz_serial_motor','text','Ej: 162FMJ-...')
    + _wzFg('Serial de Chasis','wz_serial_chasis','text','Ej: 8LBCF...')
    + '</div>'
    + '<div id="wz-fin-preview" style="margin-top:14px;display:none;background:var(--gs);border:1px solid var(--rim2);border-radius:12px;padding:14px">'
    + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--p1);margin-bottom:10px">Plan de crédito automático</div>'
    + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px" id="wz-fin-cells"></div>'
    + '</div>'
    // ── Bloque de pago de la moto (solo cuando se elige del catálogo, no del inventario) ──
    + '<div id="wz-mpago-wrap" style="display:none;margin-top:14px">'
    +   _mpagoBloqueHtml('wzmpago','Forma de pago de la moto (compra)','Esta moto se está agregando nueva al sistema desde el catálogo. Indica de cuál(es) cuenta(s) o efectivo sale el dinero del costo (precio base real). Puedes dividir el pago entre varias cuentas.')
    + '</div>';

  // ── PASO 3: Perfil crediticio ──
  // helper para secciones
  function _s(title){ return '<div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:var(--p1);margin:18px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--rim)">'+title+'</div>'; }
  function _s2(title){ return '<div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--ink3);margin:12px 0 6px">'+title+'</div>'; }
  function _row2(a,b){ return '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'+a+b+'</div>'; }
  function _fg(label,inner){ return '<div class="fg"><label class="fsec" style="display:block;margin-bottom:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ink3)">'+label+'</label>'+inner+'</div>'; }
  function _sel(id,opts,onch){ return '<select class="fs" id="'+id+'" onchange="'+(onch||'')+'">'+opts+'</select>'; }
  function _inp(id,type,ph,extra){ return '<input class="fi" id="'+id+'" type="'+(type||'text')+'" placeholder="'+(ph||'')+'" '+(extra||'')+' style="width:100%">'; }
  function _chip(label,group,val,onch){ return '<label style="flex:1;min-width:72px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;background:var(--surf2);border:1.5px solid var(--rim);border-radius:10px;padding:9px 6px;cursor:pointer;text-align:center;font-size:12px;font-weight:700;transition:.15s" onclick="_wzChip(this,\''+group+'\',\''+val+'\')">'+label+'</label>'; }

  var step3 =

  // ── RESIDENCIA ──
  _s('Residencia')
  +'<div class="fg" style="margin-bottom:10px"><label class="fsec" style="display:block;margin-bottom:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--ink3)">Dirección</label>'
  +'<div style="position:relative">'
  +'<input class="fi" id="wz_dir_q" type="text" placeholder=" Busca tu dirección en Venezuela..." autocomplete="off" oninput="_wzAddrBuscar(this.value)" onblur="setTimeout(function(){var d=document.getElementById(\'wz_addr_drop\');if(d)d.style.display=\'none\';},220)" style="width:100%">'
  +'<div id="wz_addr_drop" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 3px);background:var(--surf);border:1.5px solid var(--p1);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:500;max-height:180px;overflow-y:auto"></div>'
  +'</div></div>'
  +_row2(
    _fg('Estado',_sel('wz_estado','<option value="">Seleccionar...</option><option>Caracas (D.C.)</option><option>Miranda</option><option>Carabobo</option><option>Aragua</option><option>Zulia</option><option>Lara</option><option>Bolívar</option><option>Anzoátegui</option><option>Mérida</option><option>Táchira</option><option>Monagas</option><option>Sucre</option><option>Falcón</option><option>Barinas</option><option>Apure</option><option>Otro</option>')),
    _fg('Ciudad / Municipio',_inp('wz_ciudad_res','text','Se completa al buscar'))
  )
  +'<div style="margin-bottom:10px">'+_fg('Detalle (apto, piso, referencia)','<textarea class="fta" id="wz_dir_det" placeholder="Piso 3, apto 3-A, frente al Banco..." style="min-height:50px;width:100%"></textarea>')+'</div>'
  +_row2(
    _fg('Tiempo en esta dirección',_sel('wz_tdir','<option value="0">Seleccionar...</option><option value="1">Menos de 1 año</option><option value="2">1–3 años</option><option value="3">3–5 años</option><option value="4">Más de 5 años</option>','_wzScore()')),
    _fg('Tipo de vivienda',_sel('wz_viv','<option value="propia">Propia</option><option value="alquilada">Alquilada</option><option value="familiar">Familiar / prestada</option><option value="otro">Otro</option>','_wzScore()'))
  )

  // ── EMPLEO E INGRESOS ──
  +_s('Empleo e Ingresos')
  +'<div style="margin-bottom:10px">'+_fg('Tipo de empleo *',
    '<div style="display:flex;flex-wrap:wrap;gap:7px" id="wz_emp_g">'
    +[['Formal','formal'],['Público','publico'],['Delivery','delivery'],['Independ.','independiente'],['Comercio','comerciante'],['Remesas','remesas'],['Informal','informal']]
    .map(function(x){ return _chip(x[0],'wz_emp_g',x[1],'_wzScore()'); }).join('')
    +'</div>'
  )+'</div>'
  +_row2(
    _fg('Empresa / Negocio',_inp('wz_empresa','text','Nombre del empleador')),
    _fg('Cargo / Actividad',_inp('wz_cargo','text','Ej: Motorizado, Vendedor'))
  )
  +_row2(
    _fg('Ingreso mensual propio (USD) *',_inp('wz_ing','number','0','oninput="_wzScore()" min="0" step="10"')),
    _fg('Antigüedad laboral',_sel('wz_ant','<option value="">Seleccionar...</option><option value="1">Menos de 6 meses</option><option value="2">6m – 1 año</option><option value="3">1 a 3 años</option><option value="5">Más de 3 años</option>','_wzScore()'))
  )
  +_row2(
    _fg('¿Recibe remesas / otros ingresos?',_sel('wz_rem','<option value="no">No</option><option value="si">Sí (USD, criptos, etc.)</option>','_wzScore()')),
    _fg('Ingreso familiar total (USD)',_inp('wz_ifam','number','0','oninput="_wzScore()" min="0" step="10"'))
  )
  +'<div style="margin-bottom:10px">'+_fg('Dependientes económicos',
    '<div style="display:flex;gap:7px" id="wz_dep_g">'
    +[['Ninguno','0'],['1','1'],['2','2'],['3+','3']]
    .map(function(x){ return _chip(x[0],'wz_dep_g',x[1],'_wzScore()'); }).join('')
    +'</div>'
  )+'</div>'

  // ── HISTORIAL CREDITICIO ──
  +_s('Historial Crediticio')
  +'<div style="margin-bottom:10px">'+_fg('Créditos anteriores *',
    '<div style="display:flex;flex-wrap:wrap;gap:7px" id="wz_hist_g">'
    +[['Sin historial','ninguno'],['Puntual ','bueno'],['Mora leve ️','mora_leve'],['Mora grave ','malo']]
    .map(function(x){ return _chip(x[0],'wz_hist_g',x[1],'_wzScore()'); }).join('')
    +'</div>'
  )+'</div>'
  +'<div style="margin-bottom:10px">'+_fg('Deudas activas actualmente',
    '<div style="display:flex;gap:7px" id="wz_deuda_g">'
    +[['Sin deudas','no'],['Menores','menores'],['Importantes','graves']]
    .map(function(x){ return _chip(x[0],'wz_deuda_g',x[1],'_wzScore()'); }).join('')
    +'</div>'
  )+'</div>'
  +_row2(
    _fg('Cuenta bancaria',_sel('wz_banco','<option value="activa">Activa con movimientos</option><option value="poca">Poco movimiento</option><option value="no">Sin cuenta bancaria</option>','_wzScore()')),
    _fg('Banco(s)',_inp('wz_banco_nm','text','Ej: Banesco, Mercantil'))
  )
  +'<div style="margin-bottom:10px">'+_fg('Banco para cobro de cuotas',_sel('wz_banco_cobro','<option value="">Seleccionar...</option><option value="bdv">Banco de Venezuela</option><option value="banesco">Banesco</option><option value="mercantil">Mercantil</option><option value="provincial">BBVA Provincial</option><option value="bicentenario">Bicentenario</option><option value="venezolano">Venezolano de Crédito</option><option value="exterior">Banco Exterior</option><option value="otro">Otro</option>'))+'</div>'
  +_row2(
    _fg('Número de cuenta (últimos 4 dígitos)',_inp('wz_cuenta','text','XXXX','maxlength="4"')),
    _fg('¿Tiene ahorros?',_sel('wz_ahorro','<option value="no">No</option><option value="usd">Sí, en USD</option><option value="bs">Sí, en Bs</option>'))
  )

  // ── CASHEA ──
  +_s('Cashea')
  +'<div style="margin-bottom:10px">'+_fg('¿Tiene cuenta Cashea?',
    '<div style="display:flex;gap:8px">'
    +'<label style="flex:1;display:flex;align-items:center;gap:8px;background:var(--surf2);border:1.5px solid var(--rim);border-radius:10px;padding:10px 12px;cursor:pointer">'
    +'<input type="radio" name="wz_cashea" value="no" checked onchange="_wzToggleCashea(\'no\')" style="accent-color:var(--p1)"> Sin Cashea</label>'
    +'<label style="flex:1;display:flex;align-items:center;gap:8px;background:var(--surf2);border:1.5px solid var(--rim);border-radius:10px;padding:10px 12px;cursor:pointer">'
    +'<input type="radio" name="wz_cashea" value="si" onchange="_wzToggleCashea(\'si\')" style="accent-color:var(--p1)"> Tiene Cashea</label>'
    +'</div>'
  )+'</div>'
  +'<div id="wz_cashea_det" style="display:none;background:var(--surf2);border:1px solid var(--rim);border-radius:12px;padding:12px">'
  +_row2(
    _fg('Nivel Cashea',_sel('wz_cashea_nivel','<option value="">Seleccionar...</option><option value="1">Nivel 1 — Básico</option><option value="2">Nivel 2 — Bronce</option><option value="3">Nivel 3 — Plata</option><option value="4">Nivel 4 — Oro</option>','_wzScore()')),
    _fg('Estado con Cashea',_sel('wz_cashea_estado','<option value="">Seleccionar...</option><option value="al_dia">Al día</option><option value="mora_leve">Mora < 30 días</option><option value="mora_grave">Mora > 30 días</option><option value="completado">Ya canceló todo</option>','_wzScore()'))
  )
  +_row2(
    _fg('¿Tiene deuda activa con Cashea?',_sel('wz_cashea_deuda','<option value="no">No</option><option value="si">Sí</option>','_wzToggleCasheaDeuda(this.value)')),
    _fg('Fecha último pago Cashea',_inp('wz_cashea_pago','date',''))
  )
  +'<div id="wz_cashea_deuda_det" style="display:none">'
  +_row2(
    _fg('Monto deuda actual (USD)',_inp('wz_cashea_monto','number','Ej: 350','_wzScore()')),
    _fg('Cuotas pendientes',_inp('wz_cashea_cuotas_pend','number','Ej: 4'))
  )+'</div>'
  +_s2('Historial de compras Cashea')
  +_row2(
    _fg('Último artículo comprado',_inp('wz_cashea_ultimo_art','text','Ej: Nevera LG, iPhone 13, TV Samsung...')),
    _fg('Monto último artículo (USD)',_inp('wz_cashea_ultimo_monto','number','Ej: 450'))
  )
  +_row2(
    _fg('Fecha de compra',_inp('wz_cashea_ultima_fecha','date','')),
    _fg('Total compras con Cashea',_sel('wz_cashea_total_compras','<option value="">—</option><option value="1">1 producto</option><option value="2-3">2 a 3 productos</option><option value="4-5">4 a 5 productos</option><option value="6+">6 o más</option>','_wzScore()'))
  )
  +_fg('Observaciones sobre Cashea',_inp('wz_cashea_obs','text','Ej: Cliente con buen historial, pagó iPhone sin atrasos...'))
  +'</div>'

  // ── REFERENCIAS PERSONALES ──
  +_s('Referencias Personales')
  +'<div style="background:var(--surf2);border:1px solid var(--rim);border-radius:12px;padding:12px;margin-bottom:10px">'
  +'<div style="font-size:11px;font-weight:700;color:var(--ink3);margin-bottom:10px">Referencia 1</div>'
  +_row2(
    _fg('Nombre',_inp('wz_r1n','text','Nombre y apellido')),
    _fg('Teléfono',_inp('wz_r1t','tel','0412-0000000'))
  )
  +_row2(
    _fg('Relación',_sel('wz_r1r','<option>Familiar directo</option><option>Amigo/a</option><option>Colega</option><option>Vecino/a</option>')),
    _fg('Observación',_inp('wz_r1obs','text','Notas...'))
  )+'</div>'
  +'<div style="background:var(--surf2);border:1px solid var(--rim);border-radius:12px;padding:12px;margin-bottom:10px">'
  +'<div style="font-size:11px;font-weight:700;color:var(--ink3);margin-bottom:10px">Referencia 2</div>'
  +_row2(
    _fg('Nombre',_inp('wz_r2n','text','Nombre y apellido')),
    _fg('Teléfono',_inp('wz_r2t','tel','0412-0000000'))
  )
  +_row2(
    _fg('Relación',_sel('wz_r2r','<option>Familiar directo</option><option>Amigo/a</option><option>Colega</option><option>Vecino/a</option>')),
    _fg('Observación',_inp('wz_r2obs','text','Notas...'))
  )+'</div>'

  // ── FIADOR ──
  +_s('Fiador / Garante')
  +'<div style="margin-bottom:10px">'+_fg('¿Presenta fiador?',
    '<div style="display:flex;gap:8px">'
    +'<label style="flex:1;display:flex;align-items:center;gap:8px;background:var(--surf2);border:1.5px solid var(--rim);border-radius:10px;padding:10px 12px;cursor:pointer">'
    +'<input type="radio" name="wz_fiador" value="no" checked onchange="_wzToggleFiador(\'no\');_wzScore()" style="accent-color:var(--p1)"> Sin fiador</label>'
    +'<label style="flex:1;display:flex;align-items:center;gap:8px;background:var(--surf2);border:1.5px solid var(--rim);border-radius:10px;padding:10px 12px;cursor:pointer">'
    +'<input type="radio" name="wz_fiador" value="si" onchange="_wzToggleFiador(\'si\');_wzScore()" style="accent-color:var(--p1)"> Tiene fiador</label>'
    +'</div>'
  )+'</div>'
  +'<div id="wz_fiador_det" style="display:none">'
  +_row2(
    _fg('Nombre del fiador',_inp('wz_fiador_nom','text','Nombre y apellido')),
    _fg('Teléfono',_inp('wz_fiador_tel','tel','0412-0000000'))
  )
  +_row2(
    _fg('Cédula del fiador',_inp('wz_fiador_ci','text','V-12345678','oninput="_wzCedulaInput(event)" autocapitalize="characters"')),
    _fg('Relación',_sel('wz_fiador_rel','<option value="familiar">Familiar directo</option><option value="conyuge">Cónyuge / pareja</option><option value="amigo">Amigo/a</option><option value="colega">Colega / socio</option>'))
  )+'</div>'

  // ── DOCUMENTOS ──
  +_s('Documentos del Expediente')
  +_docLibreWizardHtml()

  // ── NOTAS DEL VENDEDOR ──
  +_s('Notas del Vendedor')
  +'<div style="margin-bottom:10px">'+_fg('Impresión general',
    '<div style="display:flex;gap:7px" id="wz_impresion_g">'
    +[['Positiva ','positiva'],['Neutral ','neutral'],['Dudosa ','dudosa']]
    .map(function(x){ return _chip(x[0],'wz_impresion_g',x[1],''); }).join('')
    +'</div>'
  )+'</div>'
  +'<div style="margin-bottom:6px">'+_fg('Observaciones adicionales','<textarea class="fta" id="wz_obs" rows="3" placeholder="Detalles de la visita, condiciones especiales, actitud del cliente..." style="min-height:80px;width:100%"></textarea>')+'</div>';

  // ── PASO 4: Resultado ──
  var step4 = '<div id="wz-resultado-contenido">Calculando...</div>';

  var steps = [step1, step3, step2, step4];
  var current = steps[WZ.step-1];

  var btnBack = WZ.step > 1
    ? '<button onclick="_wzPrev()" style="padding:11px 20px;border-radius:12px;border:1.5px solid var(--rim);background:var(--surf2);color:var(--ink2);font-family:var(--f);font-weight:700;font-size:13px;cursor:pointer">← Atrás</button>'
    : '<button onclick="_wzClose()" style="padding:11px 20px;border-radius:12px;border:1.5px solid var(--rim);background:var(--surf2);color:var(--ink2);font-family:var(--f);font-weight:700;font-size:13px;cursor:pointer">Cancelar</button>';

  var btnNext = WZ.step < 4
    ? '<button onclick="_wzNext()" style="padding:11px 24px;border-radius:12px;background:var(--p1);color:#fff;font-family:var(--f);font-weight:700;font-size:13px;border:none;cursor:pointer;box-shadow:0 2px 10px rgba(37,99,235,.25)">'+(WZ.step===3?'Calcular Score →':'Siguiente →')+'</button>'
    : '<button onclick="_wzGuardar()" style="padding:11px 24px;border-radius:12px;background:var(--green);color:#fff;font-family:var(--f);font-weight:700;font-size:13px;border:none;cursor:pointer"> Guardar Solicitud</button>';

  ov.innerHTML =
    // Header
    '<div style="position:sticky;top:0;z-index:10;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border-bottom:1px solid var(--rim);padding:0 20px">'
    + '<div style="max-width:680px;margin:0 auto;display:flex;align-items:center;gap:12px;height:56px">'
    + '<button onclick="_wzClose()" style="width:32px;height:32px;border-radius:50%;border:1px solid var(--rim);background:var(--surf2);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;color:var(--ink3);flex-shrink:0">✕</button>'
    + '<div style="flex:1"><div style="font-size:15px;font-weight:800;letter-spacing:-.3px">Nueva Solicitud</div><div style="font-size:11px;color:var(--ink3)">Paso '+WZ.step+' de 4</div></div>'
    + '<div data-wz-header>'
    + scorePill
    + '</div>'
    + '</div>'
    // Steps indicator
    + '<div style="max-width:680px;margin:0 auto;display:flex;align-items:center;gap:6px;padding:10px 0">'
    + stepsTpl
    + '</div></div>'
    // Body
    + '<div style="max-width:680px;margin:0 auto;padding:20px 20px 100px">'
    + '<div style="font-size:16px;font-weight:800;margin-bottom:4px;letter-spacing:-.3px">'+['Datos del Cliente','Perfil Crediticio','Motocicleta','Resultado'][WZ.step-1]+'</div>'
    + '<div style="font-size:12px;color:var(--ink3);margin-bottom:18px">'+['Información personal y laboral','Historial y capacidad de pago','¿Qué moto quiere financiar?','Score Indexa y resumen'][WZ.step-1]+'</div>'
    + current
    + '</div>'
    // Footer fijo
    + '<div style="position:fixed;bottom:0;left:0;right:0;background:var(--surf);border-top:1px solid var(--rim);padding:12px 20px;display:flex;justify-content:space-between;align-items:center;z-index:11">'
    + btnBack
    + '<div style="font-size:11px;color:var(--ink3)">'+WZ.step+' / 4</div>'
    + btnNext
    + '</div>';

  setTimeout(function(){ _wzHydrate(); _wzHydrateDocsUI(); }, 0);
  // Inicializar preview financiero si hay precio (ahora en paso 3 = moto)
  if(WZ.step===3 && WZ.precio>0){
    setTimeout(function(){ _wzActualizarFinPreview(WZ.precio); }, 50);
  }
  // Restaurar bloque de pago de moto si veníamos del catálogo (no inventario)
  if(WZ.step===3 && WZ.precio>0 && !WZ.motoInvId && WZ.motoModelo){
    setTimeout(function(){
      var wrap = document.getElementById('wz-mpago-wrap');
      if(wrap){
        wrap.style.display='block';
        var pBaseInp = document.getElementById('wz_precio_base_real');
        var costoBase = pBaseInp && parseFloat(pBaseInp.value)>0 ? parseFloat(pBaseInp.value) : (WZ.precio||0);
        // Solo precargar si NO hay filas previas (caso primera entrada al paso)
        if(!Array.isArray(WZ._pagosMoto) || !WZ._pagosMoto.length){
          var iniReal = 0;
          try { var pc = getWzPlanConfig(); iniReal = parseFloat(pc&&pc.ini)||0; } catch(e){}
          _mpagoSetCosto('wzmpago', costoBase, iniReal>0 ? iniReal : null);
        } else {
          _mpagoSetCosto('wzmpago', costoBase);
        }
        // Restaurar filas previas si existen
        if(Array.isArray(WZ._pagosMoto) && WZ._pagosMoto.length){
          var cont = document.getElementById('wzmpago-rows');
          if(cont){
            cont.innerHTML='';
            WZ._pagosMoto.forEach(function(p, idx){
              cont.insertAdjacentHTML('beforeend', _mpagoFilaHtml('wzmpago', idx));
              var rows = cont.querySelectorAll('.mpago-row');
              var row = rows[rows.length-1];
              if(row){
                row.setAttribute('data-touched','1');
                var c = row.querySelector('.wzmpago-cuenta');
                var mt = row.querySelector('.wzmpago-monto');
                if(c) c.value = p.cuenta;
                if(mt) mt.value = p.monto;
              }
            });
            _mpagoActualizarTotales('wzmpago');
          }
        }
      }
    }, 80);
  }
  // Renderizar resultado si es paso 4
  if(WZ.step===4){
    setTimeout(function(){ _wzRenderResultado(); }, 50);
  }
  // Si hay moto preseleccionada en paso 3 (moto)
  if(WZ.step===3 && motoId){
    setTimeout(function(){
      var sel = document.getElementById('wz_moto_inv');
      if(sel) { sel.value = motoId; _wzPickMotoInv(sel); }
    }, 60);
  }
  // Si la moto viene del catálogo (sin inventario), restaurar modelo
  if(WZ.step===3 && !motoId && WZ.motoModelo){
    setTimeout(function(){
      // Intentar encontrar en el selector de catálogo por modelo
      var catSel = document.getElementById('wz_moto_cat');
      if(catSel){
        var opts = Array.from(catSel.options);
        var match = opts.find(function(o){ return (o.getAttribute('data-modelo')||o.text.split(' —')[0].trim())===WZ.motoModelo; });
        if(match){ catSel.value = match.value; _wzPickMotoCat(catSel); }
        else {
          // Moto no está en catálogo — mostrar como entrada manual
          WZ.motoInvId = null;
          var pInp = document.getElementById('wz_precio');
          if(pInp && WZ.precio>0) pInp.value = WZ.precio;
          if(WZ.precio>0 && typeof _wzActualizarFinPreview==='function') _wzActualizarFinPreview(WZ.precio);
        }
      }
    }, 65);
  }
}

// ── Helper: campo de formulario ──
function _wzFg(label, id, type, placeholder, extra, required){
  var val = (WZ && WZ[id] != null) ? String(WZ[id]).replace(/"/g,'&quot;') : '';
  return '<div class="fg"><label class="fsec" style="display:block;margin-bottom:5px">'+label+'</label>'
    +'<input class="fi" id="'+id+'" type="'+type+'" placeholder="'+placeholder+'" value="'+val+'" '+(extra||'')+' '+(required?'required':'')+' style="width:100%"></div>';
}

function _wzClienteOptions(){
  var list = (S.clientes||[]).filter(function(c){ return c && !c.eliminado; });
  return '<option value="">Nuevo cliente</option>' + list.map(function(c){
    return '<option value="'+c.id+'">'+(c.nombre||'Sin nombre')+' — C.I. '+(c.cedula||'—')+'</option>';
  }).join('');
}

// ── Buscador de cliente (reemplaza el viejo select) ──
// Filtra en vivo S.clientes por nombre o cédula y muestra dropdown
function _wzCliSearch(){
  var inp = document.getElementById('wz_cli_search');
  var dd = document.getElementById('wz_cli_dd');
  if(!inp || !dd) return;
  var q = (inp.value||'').toLowerCase().trim();
  // Normalizar: quitar puntos, guiones, espacios, V/E (para que cédulas se busquen libremente)
  var qNorm = q.replace(/[.\-\s]/g,'').replace(/^[ve]/,'');
  // Ordenar TODA la lista por fecha de creación DESC (más recientes primero)
  var list = (S.clientes||[]).filter(function(c){ return c && !c.eliminado; })
    .slice().sort(function(a,b){
      var fa = a.creado || a.editadoEn || '';
      var fb = b.creado || b.editadoEn || '';
      if(!fa && !fb) return 0;
      if(!fa) return 1;
      if(!fb) return -1;
      return fb < fa ? -1 : fb > fa ? 1 : 0;
    });
  // Si no hay texto, mostrar primeros 8 (más recientes)
  var resultados;
  if(!q){
    resultados = list.slice(0, 8);
  } else {
    resultados = list.filter(function(c){
      var nombre = (c.nombre||'').toLowerCase();
      var ced = (c.cedula||'').toLowerCase().replace(/[.\-\s]/g,'').replace(/^[ve]/,'');
      var tel = (c.tel||'').replace(/[.\-\s]/g,'');
      return nombre.indexOf(q) !== -1
        || (qNorm && ced.indexOf(qNorm) !== -1)
        || (qNorm && tel.indexOf(qNorm) !== -1);
    }).slice(0, 30);
  }
  if(resultados.length === 0){
    dd.innerHTML = '<div style="padding:14px;color:var(--ink3);font-size:12px;text-align:center">'
      + (q ? 'Sin resultados — el cliente se creará como nuevo' : 'Sin clientes registrados')
      + '</div>';
  } else {
    // Helper para fecha relativa
    function fechaRel(s){
      if(!s) return '';
      try {
        var d = new Date(s);
        if(isNaN(d.getTime())) return '';
        var diff = Math.floor((Date.now() - d.getTime()) / 86400000);
        if(diff <= 0) return 'hoy';
        if(diff === 1) return 'ayer';
        if(diff < 7) return diff+'d';
        if(diff < 30) return Math.floor(diff/7)+'sem';
        if(diff < 365) return Math.floor(diff/30)+'mes';
        return Math.floor(diff/365)+'a';
      } catch(e){ return ''; }
    }
    // Detectar si un cliente es lead (sin créditos activos ni historial)
    function esCliLead(c){
      var creds = (S.creds||[]).filter(function(x){
        if(x.eliminado) return false;
        if(x.cliId!=null && String(x.cliId)!==''){ return String(x.cliId)===String(c.id); }
        var xnom=(x.cli||'').trim(), cnom=(c.nombre||'').trim();
        return xnom && cnom && xnom===cnom;
      });
      return creds.length === 0;
    }
    dd.innerHTML = resultados.map(function(c){
      var nombreEsc = (c.nombre||'(sin nombre)').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
      var esLead = esCliLead(c);
      var esLeadWeb = c.origen === 'web';
      var bg = esLead ? 'background:rgba(37,99,235,.06);border-left:3px solid var(--p1)' : 'background:none';
      var leadBadge = esLeadWeb
        ? '<span style="background:rgba(37,99,235,.14);color:var(--p1);font-size:9px;font-weight:800;padding:2px 7px;border-radius:50px;margin-left:6px;letter-spacing:.04em;text-transform:uppercase;border:1px solid rgba(37,99,235,.25)">Lead web</span>'
        : (esLead ? '<span style="background:rgba(37,99,235,.10);color:var(--p1);font-size:9px;font-weight:800;padding:2px 7px;border-radius:50px;margin-left:6px;letter-spacing:.04em;text-transform:uppercase;border:1px solid rgba(37,99,235,.20)">Lead</span>' : '');
      var rel = fechaRel(c.creado);
      var fechaTag = rel ? '<span style="font-size:10px;color:var(--ink3);font-weight:600;margin-left:auto;font-family:var(--fd)">'+rel+'</span>' : '';
      var bgHoverOut = esLead ? 'rgba(37,99,235,.06)' : 'none';
      var bgHoverIn = esLead ? 'rgba(37,99,235,.12)' : 'var(--gs)';
      return '<button type="button" onmousedown="event.preventDefault();_wzCliPick(\''+String(c.id).replace(/'/g,'')+'\')" '
        + 'style="display:block;width:100%;text-align:left;padding:9px 12px;'+bg+';border:none;border-bottom:1px solid var(--rim2);cursor:pointer;font-family:var(--f);transition:background .15s" '
        + 'onmouseover="this.style.background=\''+bgHoverIn+'\'" onmouseout="this.style.background=\''+bgHoverOut+'\'">'
        + '<div style="display:flex;align-items:center;gap:6px"><span style="font-size:13px;font-weight:700;color:var(--ink)">'+nombreEsc+'</span>'+leadBadge+fechaTag+'</div>'
        + '<div style="font-size:11px;color:var(--ink3);margin-top:2px">C.I.: '+(c.cedula||'—')+(c.tel?' · '+c.tel:'')+(c.ciudad?' · '+c.ciudad:'')+'</div>'
        + '</button>';
    }).join('');
  }
  dd.style.display = 'block';
}

// Cuando el input pierde foco, ocultar el dropdown (con un delay para permitir click en opción)
function _wzCliBlur(){
  var dd = document.getElementById('wz_cli_dd');
  if(dd) dd.style.display = 'none';
}

// Cuando el usuario elige un cliente del dropdown
function _wzCliPick(id){
  // Cerrar dropdown
  var dd = document.getElementById('wz_cli_dd');
  if(dd) dd.style.display = 'none';
  // Buscar cliente
  var c = (S.clientes||[]).find(function(x){ return String(x.id) === String(id); });
  if(!c){ if(typeof toast === 'function') toast('Cliente no encontrado','error'); return; }
  // Mostrar el chip con el cliente seleccionado, ocultar input
  var inp = document.getElementById('wz_cli_search');
  var chip = document.getElementById('wz_cli_chip');
  var chipNom = document.getElementById('wz_cli_chip_nom');
  var chipCi = document.getElementById('wz_cli_chip_ci');
  var hidden = document.getElementById('wz_cliente_sel');
  if(inp){ inp.style.display='none'; inp.value=''; }
  if(chip){ chip.style.display='flex'; }
  if(chipNom){ chipNom.textContent = c.nombre || '(sin nombre)'; }
  if(chipCi){ chipCi.textContent = 'C.I.: '+(c.cedula||'—')+(c.tel?' · '+c.tel:''); }
  if(hidden){ hidden.value = String(id); }
  // Invocar la lógica existente que hidrata los demás campos
  if(typeof _wzPickCliente === 'function'){
    _wzPickCliente({ value: String(id) });
  }
}

// Limpiar la selección de cliente (volver al modo búsqueda)
function _wzCliClear(){
  var inp = document.getElementById('wz_cli_search');
  var chip = document.getElementById('wz_cli_chip');
  var hidden = document.getElementById('wz_cliente_sel');
  if(inp){ inp.style.display=''; inp.value=''; setTimeout(function(){ try{ inp.focus(); }catch(e){} }, 50); }
  if(chip){ chip.style.display='none'; }
  if(hidden){ hidden.value=''; }
  // Limpiar campos como hace _wzPickCliente con valor vacío
  if(typeof _wzPickCliente === 'function'){
    _wzPickCliente({ value: '' });
  }
}

// Hidratar el chip si ya había un cliente seleccionado (al volver al paso 1)
function _wzCliHidratar(){
  var hidden = document.getElementById('wz_cliente_sel');
  if(!hidden) return;
  var id = WZ.clienteSel || '';
  if(!id){
    // Asegurar input visible, chip oculto
    var inp = document.getElementById('wz_cli_search');
    var chip = document.getElementById('wz_cli_chip');
    if(inp) inp.style.display='';
    if(chip) chip.style.display='none';
    hidden.value = '';
    return;
  }
  var c = (S.clientes||[]).find(function(x){ return String(x.id) === String(id); });
  if(!c){
    hidden.value = '';
    return;
  }
  hidden.value = String(id);
  var inp = document.getElementById('wz_cli_search');
  var chip = document.getElementById('wz_cli_chip');
  var chipNom = document.getElementById('wz_cli_chip_nom');
  var chipCi = document.getElementById('wz_cli_chip_ci');
  if(inp){ inp.style.display='none'; }
  if(chip){ chip.style.display='flex'; }
  if(chipNom){ chipNom.textContent = c.nombre || '(sin nombre)'; }
  if(chipCi){ chipCi.textContent = 'C.I.: '+(c.cedula||'—')+(c.tel?' · '+c.tel:''); }
}

function _wzHydrate(){
  var ids=['wz_cliente_sel','wz_nom','wz_ci','wz_tel','wz_wa','wz_email','wz_ciudad','wz_emp','wz_ant','wz_ing','wz_ifam','wz_conocio','wz_estado','wz_ciudad_res','wz_dir_det','wz_dir_q','wz_tdir','wz_viv','wz_empresa','wz_cargo','wz_rem','wz_banco','wz_banco_nm','wz_banco_cobro','wz_cuenta','wz_ahorro','wz_cashea_nivel','wz_cashea_pago','wz_cashea_estado','wz_cashea_deuda','wz_cashea_monto','wz_cashea_cuotas_pend','wz_cashea_ultimo_art','wz_cashea_ultimo_monto','wz_cashea_ultima_fecha','wz_cashea_total_compras','wz_cashea_obs','wz_r1n','wz_r1t','wz_r1r','wz_r1obs','wz_r2n','wz_r2t','wz_r2r','wz_r2obs','wz_fiador_nom','wz_fiador_tel','wz_fiador_ci','wz_fiador_rel','wz_obs',
    // Paso 3: moto
    'wz_vin','wz_color','wz_marca','wz_anio','wz_placa','wz_serial_motor','wz_serial_chasis','wz_gps_num','wz_uso',
    // Paso 3: plan financiero
    'wz_precio','wz_precio_base_real','wz_ini_real','wz_cuota_q_custom','wz_plazo_custom',
    'wz_apy_objetivo','wz_apy_plazo','wz_apy_inicial_sel',
    // Selector moto inventario
    'wz_moto_inv'];
  ids.forEach(function(id){
    var el=document.getElementById(id);
    if(!el) return;
    if(id==='wz_cliente_sel' && WZ.clienteSel!=null && WZ.clienteSel!==''){ el.value=String(WZ.clienteSel); return; }
    if(WZ[id]!=null && WZ[id]!=='') el.value=WZ[id];
  });
  ['wz_emp','wz_ant','wz_conocio','wz_estado','wz_tdir','wz_viv','wz_rem','wz_banco','wz_banco_cobro','wz_ahorro','wz_cashea_nivel','wz_cashea_estado','wz_cashea_deuda','wz_cashea_total_compras','wz_r1r','wz_r2r','wz_fiador_rel'].forEach(function(id){ var el=document.getElementById(id); if(el && WZ[id]!=null && WZ[id]!=='') el.value=WZ[id]; });
  var cashea = WZ.cashea||'no';
  var casheaRadio=document.querySelector('input[name="wz_cashea"][value="'+cashea+'"]'); if(casheaRadio) casheaRadio.checked=true; if(document.getElementById('wz_cashea_det')) _wzToggleCashea(cashea); if(WZ.cashea_deuda==='si') _wzToggleCasheaDeuda('si');
  var fiador = WZ.fiador_tiene||'no';
  var fiadorRadio=document.querySelector('input[name="wz_fiador"][value="'+fiador+'"]'); if(fiadorRadio) fiadorRadio.checked=true; if(document.getElementById('wz_fiador_det')) _wzToggleFiador(fiador);
  function pick(group,val){ if(val==null || val==='') return; var container=document.getElementById(group); if(container){ Array.from(container.children).forEach(function(el){ if((el.getAttribute('onclick')||'').indexOf("'"+String(val)+"'")>=0) _wzChip(el,group,String(val)); }); } }
  pick('wz_emp_g', WZ.emp||WZ['_chip_wz_emp_g']);
  pick('wz_hist_g', WZ.hist||WZ['_chip_wz_hist_g']);
  pick('wz_deuda_g', WZ.deuda||WZ['_chip_wz_deuda_g']);
  pick('wz_impresion_g', WZ.impresion||WZ['_chip_wz_impresion_g']);
  pick('wz_dep_g', String(WZ.dep||WZ['_chip_wz_dep_g']||''));
  if(WZ.step===3 && WZ.precio){ var pInp=document.getElementById('wz_precio'); if(pInp) pInp.value=WZ.precio; }
  // Restaurar campos del plan financiero (paso 3)
  if(WZ.step===3){
    // Activar panel del modo correcto
    var _planModeVal = WZ['wz_plan_mode']||WZ.planMode||'global';
    var _pm = document.getElementById('wz_plan_mode');
    if(_pm){ _pm.value=_planModeVal; }
    if(typeof _wzTogglePlanMode==='function') _wzTogglePlanMode(_planModeVal);
    if(WZ.precio>0 && typeof _wzActualizarFinPreview==='function') setTimeout(function(){ _wzActualizarFinPreview(WZ.precio); },80);
  }
  // Restaurar radios de cashea y fiador desde WZ al editar
  (function(){
    var casheaVal = WZ.cashea||'no';
    var casheaRadio = document.querySelector('input[name="wz_cashea"][value="'+casheaVal+'"]');
    if(casheaRadio){ casheaRadio.checked=true; if(typeof _wzToggleCashea==='function') _wzToggleCashea(casheaVal); }
    var fiadorVal = WZ.fiador_tiene||'no';
    var fiadorRadio = document.querySelector('input[name="wz_fiador"][value="'+fiadorVal+'"]');
    if(fiadorRadio){ fiadorRadio.checked=true; if(typeof _wzToggleFiador==='function') _wzToggleFiador(fiadorVal); }
    // Restaurar documentos en lista visual
    if(Array.isArray(WZ.documentos) && WZ.documentos.length){
      WZ.documentos.forEach(function(d){ if(d&&d.id) _wzDocsUp[d.id]=d; });
      if(typeof _docLibreWizardRefreshList==='function') setTimeout(_docLibreWizardRefreshList,50);
    }
  })();
  _wzScore();
  // Sincronizar el buscador de cliente (mostrar chip si ya había selección)
  if(typeof _wzCliHidratar === 'function') _wzCliHidratar();
}

function _wzCollectVisibleValues(){
  var ov = document.getElementById('wz-overlay');
  if(!ov || !WZ) return;
  var alias = {
    wz_cliente_sel:'clienteSel',
    wz_nom:'nom', wz_ci:'ci', wz_tel:'tel', wz_wa:'wa', wz_email:'email', wz_ciudad:'ciudad',
    wz_emp:'emp', wz_ant:'ant', wz_ing:'ing', wz_ifam:'ifam', wz_conocio:'conocio',
    wz_estado:'estado_ubi', wz_ciudad_res:'ciudad_res', wz_dir_det:'dir_det', wz_dir_q:'dir_q',
    wz_tdir:'tdir', wz_viv:'viv', wz_empresa:'empresa', wz_cargo:'cargo', wz_rem:'rem',
    wz_banco:'banco', wz_banco_nm:'banco_nm', wz_banco_cobro:'banco_cobro', wz_cuenta:'cuenta',
    wz_ahorro:'ahorro', wz_cashea_nivel:'cashea_nivel', wz_cashea_pago:'cashea_pago',
    wz_cashea_estado:'cashea_estado', wz_cashea_deuda:'cashea_deuda', wz_cashea_monto:'cashea_monto',
    wz_cashea_cuotas_pend:'cashea_cuotas_pend', wz_cashea_ultimo_art:'cashea_ultimo_art',
    wz_cashea_ultimo_monto:'cashea_ultimo_monto', wz_cashea_ultima_fecha:'cashea_ultima_fecha',
    wz_cashea_total_compras:'cashea_total_compras', wz_cashea_obs:'cashea_obs',
    wz_r1n:'r1n', wz_r1t:'r1t', wz_r1r:'r1r', wz_r1obs:'r1obs',
    wz_r2n:'r2n', wz_r2t:'r2t', wz_r2r:'r2r', wz_r2obs:'r2obs',
    wz_fiador_nom:'fiador_nom', wz_fiador_tel:'fiador_tel', wz_fiador_ci:'fiador_ci',
    wz_fiador_rel:'fiador_rel', wz_obs:'obs',
    wz_vin:'vin', wz_color:'color', wz_marca:'marca', wz_anio:'anio', wz_placa:'placa',
    wz_serial_motor:'serialMotor', wz_serial_chasis:'serialChasis', wz_gps_num:'gpsNum',
    wz_uso:'uso', wz_precio:'precio', wz_precio_base_real:'precioBaseReal',
    wz_ini_real:'ini', wz_cuota_q_custom:'cuota', wz_plazo_custom:'plazo',
    wz_plan_mode:'planMode', wz_apy_objetivo:'apyObjetivo', wz_apy_plazo:'apyPlazo',
    wz_apy_inicial_sel:'apyInicialSel', wz_moto_inv:'motoInvId', wz_concesionario_id:'concesionarioId',
    wz_cat_marca:'catMarca', wz_cat_modelo:'catModelo', wz_cat_precio:'catPrecio'
  };
  Array.from(ov.querySelectorAll('input[id^="wz_"],select[id^="wz_"],textarea[id^="wz_"]')).forEach(function(el){
    var id = el.id;
    if(!id || el.type==='radio' || el.type==='checkbox') return;
    var val = (el.value!=null) ? el.value : '';
    WZ[id] = val;
    if(alias[id]) WZ[alias[id]] = (el.type==='number') ? (parseFloat(val)||0) : val;
  });
  var cashea = ov.querySelector('input[name="wz_cashea"]:checked');
  if(cashea){ WZ.cashea = cashea.value; WZ.wz_cashea = cashea.value; }
  var fiador = ov.querySelector('input[name="wz_fiador"]:checked');
  if(fiador){ WZ.fiador_tiene = fiador.value; WZ.wz_fiador_tiene = fiador.value; }
  [['wz_emp_g','emp'],['wz_hist_g','hist'],['wz_deuda_g','deuda'],['wz_impresion_g','impresion'],['wz_dep_g','dep']].forEach(function(pair){
    var v = _wzChipVal(pair[0]);
    if(v!==undefined && v!==null && v!==''){
      WZ['_chip_'+pair[0]] = v;
      WZ[pair[1]] = pair[1]==='dep' ? (parseInt(v,10)||0) : v;
    }
  });
}

function _wzDraftSnapshot(){
  _wzCollectVisibleValues();
  var out = {};
  Object.keys(WZ||{}).forEach(function(k){
    var v = WZ[k];
    if(typeof v === 'function' || v === undefined) return;
    try { JSON.stringify(v); out[k] = v; } catch(e){}
  });
  if(window._wzCustomPct!==undefined && window._wzCustomPct!==null) out._wzCustomPct = window._wzCustomPct;
  return out;
}

function _wzPickCliente(sel){
  var id = String((sel&&sel.value)!=null ? sel.value : '').trim();
  WZ.clienteSel = id || '';
  if(!id){
    // Limpiar TODOS los campos al deseleccionar
    var keys = ['nom','ci','tel','wa','email','ciudad','emp','ant','ing','ifam','conocio','viv','tdir','estado_ubi','ciudad_res','dir_det','dir_q','empresa','cargo','rem','dep','hist','deuda','banco','banco_nm','banco_cobro','cuenta','ahorro','cashea','cashea_nivel','cashea_pago','cashea_estado','cashea_deuda','cashea_monto','cashea_cuotas_pend','cashea_ultimo_art','cashea_ultimo_monto','cashea_ultima_fecha','cashea_total_compras','cashea_obs','fiador_tiene','fiador_nom','fiador_tel','fiador_ci','fiador_rel','r1n','r1t','r1r','r1obs','r2n','r2t','r2r','r2obs','impresion','obs'];
    keys.forEach(function(k){ WZ[k]=''; });
    // Limpiar también todos los aliases wz_*
    var wzKeys = ['wz_nom','wz_ci','wz_tel','wz_wa','wz_email','wz_ciudad','wz_emp','wz_ant','wz_ing','wz_ifam','wz_conocio','wz_viv','wz_tdir','wz_estado','wz_ciudad_res','wz_dir_det','wz_dir_q','wz_empresa','wz_cargo','wz_rem','wz_banco','wz_banco_nm','wz_banco_cobro','wz_cuenta','wz_ahorro','wz_cashea_nivel','wz_cashea_pago','wz_cashea_estado','wz_cashea_deuda','wz_cashea_monto','wz_cashea_cuotas_pend','wz_cashea_ultimo_art','wz_cashea_ultimo_monto','wz_cashea_ultima_fecha','wz_cashea_total_compras','wz_cashea_obs','wz_fiador_nom','wz_fiador_tel','wz_fiador_ci','wz_fiador_rel','wz_r1n','wz_r1t','wz_r1r','wz_r1obs','wz_r2n','wz_r2t','wz_r2r','wz_r2obs','wz_impresion','wz_obs'];
    wzKeys.forEach(function(k){ WZ[k]=''; });
    // Limpiar chips
    WZ['_chip_wz_emp_g']=WZ['_chip_wz_dep_g']=WZ['_chip_wz_hist_g']=WZ['_chip_wz_deuda_g']=WZ['_chip_wz_impresion_g']='';
    _wzDocsUp={}; WZ.documentos=[]; WZ.docsCount=0;
    return _wzRender();
  }
  var c = (S.clientes||[]).find(function(x){ return String((x&&x.id)!=null ? x.id : '').trim()===id; });
  if(!c) return;
  // Datos personales
  WZ.nom = WZ.wz_nom = c.nombre || '';
  WZ.ci = WZ.wz_ci = _wzFmtCedula(c.cedula || '');
  WZ.tel = WZ.wz_tel = c.tel || '';
  WZ.wa = WZ.wz_wa = c.wa || c.tel || '';
  WZ.email = WZ.wz_email = c.email || '';
  WZ.ciudad = WZ.wz_ciudad = c.ciudad || '';
  WZ.conocio = WZ.wz_conocio = c.conocio || '';
  // Residencia
  WZ.viv = WZ.wz_viv = c.vivienda || '';
  WZ.tdir = WZ.wz_tdir = c.tiempo_dir || '';
  WZ.estado_ubi = WZ.wz_estado = c.estado_ubi || '';
  WZ.ciudad_res = WZ.wz_ciudad_res = c.ciudad || '';
  WZ.dir_det = WZ.wz_dir_det = c.dir || '';
  WZ.dir_q = WZ.wz_dir_q = c.dir || '';
  // Empleo / Ingresos
  WZ.emp = WZ.wz_emp = c.trabajo || '';
  WZ.empresa = WZ.wz_empresa = c.empresa || '';
  WZ.cargo = WZ.wz_cargo = c.cargo || '';
  WZ.ing = WZ.wz_ing = c.ingreso || '';
  WZ.ifam = WZ.wz_ifam = c.ingreso_familiar || '';
  WZ.ant = WZ.wz_ant = c.antiguedad || '';
  WZ.rem = WZ.wz_rem = c.remesas || '';
  WZ.dep = c.dependientes || 0;
  WZ.hist = c.historial || '';
  WZ.deuda = c.deudas || '';
  // Banco / Ahorro
  WZ.banco = WZ.wz_banco = c.banco_estado || '';
  WZ.banco_nm = WZ.wz_banco_nm = c.banco_nombre || '';
  WZ.banco_cobro = WZ.wz_banco_cobro = c.banco_cobro || '';
  WZ.cuenta = WZ.wz_cuenta = c.cuenta_digitos || '';
  WZ.ahorro = WZ.wz_ahorro = c.ahorro || '';
  // Cashea
  WZ.cashea = c.cashea || 'no';
  WZ.cashea_nivel = WZ.wz_cashea_nivel = c.cashea_nivel || '';
  WZ.cashea_pago = WZ.wz_cashea_pago = c.cashea_pago || '';
  WZ.cashea_estado = WZ.wz_cashea_estado = c.cashea_estado || '';
  WZ.cashea_deuda = WZ.wz_cashea_deuda = c.cashea_deuda || 'no';
  WZ.cashea_monto = WZ.wz_cashea_monto = c.cashea_monto || '';
  WZ.cashea_cuotas_pend = WZ.wz_cashea_cuotas_pend = c.cashea_cuotas_pend || '';
  WZ.cashea_ultimo_art = WZ.wz_cashea_ultimo_art = c.cashea_ultimo_art || '';
  WZ.cashea_ultimo_monto = WZ.wz_cashea_ultimo_monto = c.cashea_ultimo_monto || '';
  WZ.cashea_ultima_fecha = WZ.wz_cashea_ultima_fecha = c.cashea_ultima_fecha || '';
  WZ.cashea_total_compras = WZ.wz_cashea_total_compras = c.cashea_total_compras || '';
  WZ.cashea_obs = WZ.wz_cashea_obs = c.cashea_obs || '';
  // Fiador
  WZ.fiador_tiene = c.fiador || 'no';
  WZ.fiador_nom = WZ.wz_fiador_nom = c.fiador_nom || '';
  WZ.fiador_tel = WZ.wz_fiador_tel = c.fiador_tel || '';
  WZ.fiador_ci = WZ.wz_fiador_ci = _wzFmtCedula(c.fiador_ci || '');
  WZ.fiador_rel = WZ.wz_fiador_rel = c.fiador_rel || '';
  // Referencias personales (con aliases wz_* que es lo que _wzHydrate lee)
  WZ.r1n = WZ.wz_r1n = (c.ref1&&c.ref1.nom) || '';
  WZ.r1t = WZ.wz_r1t = (c.ref1&&c.ref1.tel) || '';
  WZ.r1r = WZ.wz_r1r = (c.ref1&&c.ref1.rel) || '';
  WZ.r1obs = WZ.wz_r1obs = (c.ref1&&c.ref1.obs) || '';
  WZ.r2n = WZ.wz_r2n = (c.ref2&&c.ref2.nom) || '';
  WZ.r2t = WZ.wz_r2t = (c.ref2&&c.ref2.tel) || '';
  WZ.r2r = WZ.wz_r2r = (c.ref2&&c.ref2.rel) || '';
  WZ.r2obs = WZ.wz_r2obs = (c.ref2&&c.ref2.obs) || '';
  // Documentos / impresión / observaciones
  _wzLoadDocsUpFromCliente(c);
  WZ.docsCount = (c.documentos&&c.documentos.length) || c.docs_count || 0;
  WZ.impresion = WZ.wz_impresion = c.impresion || '';
  WZ.obs = WZ.wz_obs = c.notas || c.obs || '';
  // Score / factores (si el cliente ya tenía un score guardado)
  WZ.score = c.score_indexa || WZ.score || 0;
  WZ.f1 = c.f1 || WZ.f1 || 0;
  WZ.f2 = c.f2 || WZ.f2 || 0;
  WZ.f3 = c.f3 || WZ.f3 || 0;
  WZ.f4 = c.f4 || WZ.f4 || 0;
  WZ.f5 = c.f5 || WZ.f5 || 0;
  // Chips (la hidratación los lee de estos para pintarlos)
  WZ['_chip_wz_emp_g'] = WZ.emp || '';
  WZ['_chip_wz_dep_g'] = String(WZ.dep || 0);
  WZ['_chip_wz_hist_g'] = WZ.hist || '';
  WZ['_chip_wz_deuda_g'] = WZ.deuda || '';
  WZ['_chip_wz_impresion_g'] = WZ.impresion || '';
  _wzRender();
}

function _wzActualizarPrecioBaseDesdePrecio(){
  var pInp=document.getElementById('wz_precio');
  var baseInp=document.getElementById('wz_precio_base_real');
  if(!baseInp) return;
  if((!baseInp.value || parseFloat(baseInp.value||0)<=0) && pInp && parseFloat(pInp.value||0)>0){ baseInp.value=parseFloat(pInp.value).toFixed(2); }
}

// ── Sincronizar costo objetivo del bloque de pago de moto del wizard ──
function _wzMpagoSync(){
  var wrap = document.getElementById('wz-mpago-wrap');
  if(!wrap || wrap.style.display==='none') return;
  var pBaseInp = document.getElementById('wz_precio_base_real');
  var pInp = document.getElementById('wz_precio');
  var costo = pBaseInp && parseFloat(pBaseInp.value)>0
    ? parseFloat(pBaseInp.value)
    : (pInp && parseFloat(pInp.value)>0 ? parseFloat(pInp.value) : 0);
  // Si la primera fila aún está vacía, precargar con inicial real
  var iniReal = 0;
  try { var pc = getWzPlanConfig(); iniReal = parseFloat(pc&&pc.ini)||0; } catch(e){}
  _mpagoSetCosto('wzmpago', costo, iniReal>0 ? iniReal : null);
}

// ── Selección de moto del inventario ──
function _wzPickMotoInv(sel){
  var wrap = document.getElementById('wz-mpago-wrap');
  if(!sel.value){
    WZ.precio=0; WZ.motoInvId=null;
    if(wrap) wrap.style.display='none';
    _wzScore(); return;
  }
  var opt = sel.options[sel.selectedIndex];
  var precio = parseFloat(opt.getAttribute('data-precio')||0);
  var moto = S.motos.find(function(m){ return String(m.id)===String(sel.value); });
  var catSel = document.getElementById('wz_moto_cat');
  if(catSel) catSel.value = '';
  var pInp = document.getElementById('wz_precio');
  if(pInp){ pInp.value = precio; }
  WZ.precio = precio;
  _wzActualizarPrecioBaseDesdePrecio();
  WZ.motoInvId = sel.value;
  WZ.motoModelo = moto ? moto.modelo : opt.text.split(' —')[0].trim();
  // Precargar campos de la moto en WZ para que _wzFg los muestre
  if(moto){
    WZ.wz_marca        = moto.marca        || '';
    WZ.wz_color        = moto.color        || '';
    WZ.wz_vin          = moto.vin          || '';
    WZ.wz_placa        = moto.placa        || '';
    WZ.wz_anio         = moto.anio         || '';
    WZ.wz_serial_motor = moto.serialMotor  || '';
    WZ.wz_serial_chasis= moto.serialChasis || '';
    WZ.wz_gps_num      = moto.gpsNum       || '';
    // También en las claves cortas que usa _wzValidar paso 3
    WZ.marca        = moto.marca        || '';
    WZ.color        = moto.color        || '';
    WZ.vin          = moto.vin          || '';
    WZ.placa        = moto.placa        || '';
    WZ.anio         = moto.anio         || '';
    WZ.serialMotor  = moto.serialMotor  || '';
    WZ.serialChasis = moto.serialChasis || '';
    WZ.gpsNum       = moto.gpsNum       || '';
  }
  // Rellenar los inputs visibles si ya están en el DOM
  function _setInp(id, val){ var el=document.getElementById(id); if(el && val) el.value=val; }
  if(moto){
    _setInp('wz_marca',         moto.marca);
    _setInp('wz_color',         moto.color);
    _setInp('wz_vin',           moto.vin);
    _setInp('wz_placa',         moto.placa);
    _setInp('wz_anio',          moto.anio);
    _setInp('wz_serial_motor',  moto.serialMotor);
    _setInp('wz_serial_chasis', moto.serialChasis);
    _setInp('wz_gps_num',       moto.gpsNum);
  }
  // Inventario existente: NO mostrar bloque de pago (la moto ya fue pagada al ingresarla)
  if(wrap) wrap.style.display='none';
  _wzActualizarFinPreview(precio);
  _wzScore();
}

// ── Selección de moto del catálogo ──
function _wzPickMotoCat(sel){
  var wrap = document.getElementById('wz-mpago-wrap');
  var newCatDiv = document.getElementById('wz_new_cat_div');
  if(!sel.value){
    if(wrap) wrap.style.display='none';
    if(newCatDiv) newCatDiv.style.display='none';
    return;
  }
  if(sel.value === '__wz_new_cat__'){
    if(newCatDiv) newCatDiv.style.display='block';
    if(wrap) wrap.style.display='none';
    WZ.precio = 0;
    WZ.motoInvId = null;
    WZ.motoModelo = '';
    return;
  }
  if(newCatDiv) newCatDiv.style.display='none';
  var precio = parseFloat(sel.value);
  var opt = sel.options[sel.selectedIndex];
  var invSel = document.getElementById('wz_moto_inv');
  if(invSel) invSel.value = '';
  var pInp = document.getElementById('wz_precio');
  if(pInp){ pInp.value = precio; }
  WZ.precio = precio;
  _wzActualizarPrecioBaseDesdePrecio();
  WZ.motoInvId = null;
  WZ.motoModelo = opt.getAttribute('data-modelo')||opt.text.split(' —')[0].trim();
  // Catálogo: SÍ mostrar bloque de pago (se está creando una moto nueva)
  if(wrap){
    wrap.style.display='block';
    var pBaseInp = document.getElementById('wz_precio_base_real');
    var costoBase = pBaseInp && parseFloat(pBaseInp.value)>0 ? parseFloat(pBaseInp.value) : precio;
    // Precargar primera fila con la inicial real del wizard (si está disponible)
    var iniReal = 0;
    try { var pc = getWzPlanConfig(); iniReal = parseFloat(pc&&pc.ini)||0; } catch(e){}
    _mpagoSetCosto('wzmpago', costoBase, iniReal>0 ? iniReal : null);
  }
  _wzActualizarFinPreview(precio);
  _wzScore();
}

// Sincroniza el precio del campo nueva-cat-wizard con los campos del wizard
function _wzCatPrecioSync(){
  var catPrecio = parseFloat((document.getElementById('wz_cat_precio')||{}).value)||0;
  var catModelo = ((document.getElementById('wz_cat_modelo')||{}).value||'').trim();
  var pInp = document.getElementById('wz_precio');
  if(pInp && catPrecio){ pInp.value = catPrecio; }
  WZ.precio = catPrecio;
  WZ.motoModelo = catModelo;
  WZ.motoInvId = null;
  // Mostrar/poblar el bloque de forma de pago igual que al elegir del catálogo
  var wrap = document.getElementById('wz-mpago-wrap');
  if(wrap){
    if(catPrecio > 0){
      wrap.style.display='block';
      _wzActualizarPrecioBaseDesdePrecio();
      var pBaseInp = document.getElementById('wz_precio_base_real');
      var costoBase = pBaseInp && parseFloat(pBaseInp.value)>0 ? parseFloat(pBaseInp.value) : catPrecio;
      var iniReal = 0;
      try { var pc = getWzPlanConfig(); iniReal = parseFloat(pc&&pc.ini)||0; } catch(e){}
      _mpagoSetCosto('wzmpago', costoBase, iniReal>0 ? iniReal : null);
    } else {
      wrap.style.display='none';
    }
  }
  if(catPrecio){ _wzActualizarFinPreview(catPrecio); _wzScore(); }
}

// ── Preview financiero ──
function _wzActualizarFinPreview(precio){
  precio = parseFloat(precio)||0;
  var prev = document.getElementById('wz-fin-preview');
  var cells = document.getElementById('wz-fin-cells');
  if(!cells||!prev) return;
  if(!precio){ prev.style.display='none'; return; }
  _wzActualizarPrecioBaseDesdePrecio();
  var planCfg=getWzPlanConfig();
  prev.style.display = 'block';
  var titleEl=prev.querySelector('div');
  if(titleEl) titleEl.textContent=planCfg.mode==='custom' ? 'Plan de crédito personalizado' : 'Plan de crédito automático';
  var inicialLabel=planCfg.mode==='custom' ? 'Inicial real' : ('Inicial ('+((planCfg.inicialPct||0)*100).toFixed(0)+'%)');
  cells.innerHTML = [
    ['Modo',planCfg.mode==='custom'?'Personalizado':'Principal'],
    ['Precio catálogo','$'+precio.toFixed(2)],
    ['Precio base real','$'+(parseFloat(planCfg.precioBaseReal)||0).toFixed(2)],
    [inicialLabel,'$'+(parseFloat(planCfg.ini)||0).toFixed(2)],
    ['Monto a financiar','$'+(parseFloat(planCfg.fin)||0).toFixed(2)],
    ['Cuota quincenal','$'+(parseFloat(planCfg.cuotaQ)||0).toFixed(2)],
    ['Plazo',(planCfg.plazo||0)+' meses'],
    ['Total a pagar','$'+(parseFloat(planCfg.totalPagado)||0).toFixed(2)],
  ].map(function(pair){
    return '<div style="background:var(--surf);border-radius:10px;padding:10px 12px;border:1px solid var(--rim)">'
      +'<div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--ink3);font-weight:700;margin-bottom:3px">'+pair[0]+'</div>'
      +'<div style="font-size:16px;font-weight:900;letter-spacing:-.5px;color:var(--p1)">'+pair[1]+'</div></div>';
  }).join('');
  WZ.planMode=planCfg.mode;
  WZ.precioBaseReal=planCfg.precioBaseReal;
  WZ.cuota = planCfg.cuotaQ;
  WZ.ini = planCfg.ini;
  WZ.monto = planCfg.fin;
  WZ.plazo = planCfg.plazo;
}

// ── Chip selector (pill buttons) ──
function _wzChip(el, group, val){
  var container = el.parentElement;
  Array.from(container.children).forEach(function(c){
    c.style.background='var(--surf2)'; c.style.borderColor='var(--rim)'; c.style.color='var(--ink)';
  });
  el.style.background='rgba(37,99,235,.12)'; el.style.borderColor='var(--p1)'; el.style.color='var(--p1)';
  WZ['_chip_'+group] = val;
  _wzScore();
}
function _wzChipVal(group){ return WZ['_chip_'+group]||''; }

// ── Toggle Cashea ──
function _wzToggleCashea(v){
  var el=document.getElementById('wz_cashea_det');
  if(el) el.style.display=v==='si'?'block':'none';
  _wzScore();
}

function _wzToggleCasheaDeuda(v){
  var el=document.getElementById('wz_cashea_deuda_det');
  if(el) el.style.display=v==='si'?'block':'none';
  _wzScore();
}

// ── Toggle Fiador ──
function _wzToggleFiador(v){
  var el=document.getElementById('wz_fiador_det');
  if(el) el.style.display=v==='si'?'block':'none';
}

// ── Address autocomplete (Nominatim) ──
var _wzAddrTimer=null;
function _wzAddrBuscar(q){
  clearTimeout(_wzAddrTimer);
  var drop=document.getElementById('wz_addr_drop');
  if(!q||q.length<4){ if(drop)drop.style.display='none'; return; }
  drop.innerHTML='<div style="padding:10px 14px;font-size:12px;color:var(--ink3);font-style:italic">Buscando...</div>';
  drop.style.display='block';
  _wzAddrTimer=setTimeout(function(){
    var url='https://nominatim.openstreetmap.org/search?q='+encodeURIComponent(q+', Venezuela')+'&countrycodes=ve&format=json&addressdetails=1&limit=5&accept-language=es';
    var xhr=new XMLHttpRequest();
    xhr.open('GET',url,true);
    xhr.onreadystatechange=function(){
      if(xhr.readyState!==4)return;
      if(xhr.status!==200){drop.innerHTML='<div style="padding:10px 14px;font-size:12px;color:var(--ink3)">Sin conexión</div>';return;}
      var res=JSON.parse(xhr.responseText);
      drop._results=res;
      if(!res.length){drop.innerHTML='<div style="padding:10px 14px;font-size:12px;color:var(--ink3)">Sin resultados en Venezuela</div>';return;}
      drop.innerHTML=res.map(function(r,i){
        var txt=r.display_name.replace(', República Bolivariana de Venezuela','').replace(', Venezuela','');
        var pts=txt.split(',');
        return '<div onmousedown="_wzAddrSelect('+i+')" style="padding:10px 14px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--rim2)">'
          +'<strong style="color:var(--p1)">'+pts[0].trim()+'</strong>'
          +(pts[1]?'<br><span style="font-size:11px;color:var(--ink3)">'+pts.slice(1,3).join(',').trim()+'</span>':'')
          +'</div>';
      }).join('');
    };
    xhr.send();
  },480);
}
function _wzAddrSelect(i){
  var drop=document.getElementById('wz_addr_drop');
  if(!drop||!drop._results)return;
  var r=drop._results[i];
  drop.style.display='none';
  var full=r.display_name.replace(', República Bolivariana de Venezuela','').replace(', Venezuela','');
  var q=document.getElementById('wz_dir_q'); if(q)q.value=full.split(',')[0].trim();
  var det=document.getElementById('wz_dir_det'); if(det)det.value=full;
  var a=r.address||{};
  var city=a.city||a.town||a.municipality||a.county||'';
  var state=a.state||'';
  var cityEl=document.getElementById('wz_ciudad_res'); if(cityEl&&city)cityEl.value=city;
  if(state){
    var sel=document.getElementById('wz_estado');
    if(sel)for(var j=0;j<sel.options.length;j++){
      if(sel.options[j].text.toLowerCase().indexOf(state.toLowerCase().slice(0,5))>=0){sel.selectedIndex=j;break;}
    }
  }
}

// ── Documento handler ──

function _wzScore(){
  var g=function(id){var el=document.getElementById(id);return el?el.value:'';};
  var ing = parseFloat(g('wz_ing'))||0;
  var ifam = parseFloat(g('wz_ifam'))||0;
  var emp = _wzChipVal('wz_emp_g')||g('wz_emp')||'';
  var ant = g('wz_ant');
  var hist = _wzChipVal('wz_hist_g')||'ninguno';
  var deuda = _wzChipVal('wz_deuda_g')||'no';
  var dep = parseInt(_wzChipVal('wz_dep_g')||0);
  var banco = g('wz_banco')||'activa';
  var viv = g('wz_viv')||'propia';
  var rem = g('wz_rem')||'no';
  var uso = g('wz_uso')||'personal';
  var conocio = g('wz_conocio')||'';
  var cashea = (document.querySelector('input[name="wz_cashea"]:checked')||{value:'no'}).value;
  var casheaNivel = parseInt(g('wz_cashea_nivel'))||0;
  var casheaEstado = g('wz_cashea_estado')||'';
  var casheaDeuda = g('wz_cashea_deuda')||'no';
  var casheaTotalCompras = g('wz_cashea_total_compras')||'';
  var fiador = (document.querySelector('input[name="wz_fiador"]:checked')||{value:'no'}).value==='si';
  var precio = WZ.precio||parseFloat(g('wz_precio'))||0;
  var planCfg = precio>0 ? getWzPlanConfig() : null;
  var cuotaQ = planCfg ? (parseFloat(planCfg.cuotaQ)||0) : 0;
  var ingEf = Math.max(ing,ifam);
  var ratio = (cuotaQ>0&&ingEf>0)?cuotaQ/ingEf:0;

  var f1={ninguno:50,bueno:100,mora_leve:35,malo:5}[hist]||50;
  if(deuda==='menores')f1=Math.max(0,f1-12);
  else if(deuda==='graves')f1=Math.max(0,f1-35);
  if(banco==='activa')f1=Math.min(100,f1+10);
  else if(banco==='no')f1=Math.max(0,f1-10);
  // Cashea: nivel base + estado actual + historial
  if(cashea==='si'){
    // Bonus por nivel (cliente activo Cashea)
    f1=Math.min(100,f1+(casheaNivel>=3?12:casheaNivel>=2?7:3));
    // Estado de pago con Cashea: señal crediticia directa y fuerte
    if(casheaEstado==='completado') f1=Math.min(100,f1+15); // canceló todo ok
    else if(casheaEstado==='al_dia') f1=Math.min(100,f1+10); // al día
    else if(casheaEstado==='mora_leve') f1=Math.max(0,f1-15); // mora leve
    else if(casheaEstado==='mora_grave') f1=Math.max(0,f1-35);// mora grave (equivale a hist malo)
    // Historial de compras: cuantas más compras sin problema = más confianza
    if(casheaEstado!=='mora_leve' && casheaEstado!=='mora_grave'){
      if(casheaTotalCompras==='6+') f1=Math.min(100,f1+10);
      else if(casheaTotalCompras==='4-5') f1=Math.min(100,f1+6);
      else if(casheaTotalCompras==='2-3') f1=Math.min(100,f1+3);
    }
    // Deuda activa alta con Cashea = señal de sobreendeudamiento
    if(casheaDeuda==='si'){
      var casheaMonto = parseFloat(g('wz_cashea_monto'))||0;
      if(casheaMonto>500) f1=Math.max(0,f1-8);
      else if(casheaMonto>200) f1=Math.max(0,f1-4);
    }
  }
  f1=Math.max(0,Math.min(100,f1));

  var ingBase={formal:80,publico:70,independiente:60,comerciante:65,delivery:70,remesas:55,informal:30};
  // f2 usa ingreso base configurable
  var _minB=(SCORE_CFG&&SCORE_CFG.ingreso&&SCORE_CFG.ingreso.minBase)||100;
  var _maxB=(SCORE_CFG&&SCORE_CFG.ingreso&&SCORE_CFG.ingreso.maxBase)||3000;
  var f2= (ingEf>=_minB) ? Math.min(100, ((ingEf-_minB)/(_maxB-_minB))*100) : 0;
  if(emp)f2=Math.min(100,f2*(ingBase[emp]||50)/70);
  if(dep===1)f2=Math.max(0,f2-8);
  else if(dep===2)f2=Math.max(0,f2-18);
  else if(dep>=3)f2=Math.max(0,f2-28);
  if(viv==='propia')f2=Math.min(100,f2+10);
  else if(viv==='alquilada')f2=Math.max(0,f2-8);
  if(ratio>0){
    var _rIdeal=(SCORE_CFG&&SCORE_CFG.ratios&&SCORE_CFG.ratios.ideal)||0.20;
    var _rAce=(SCORE_CFG&&SCORE_CFG.ratios&&SCORE_CFG.ratios.aceptable)||0.30;
    var _rAlto=(SCORE_CFG&&SCORE_CFG.ratios&&SCORE_CFG.ratios.alto)||0.40;
    var _rMuy=(SCORE_CFG&&SCORE_CFG.ratios&&SCORE_CFG.ratios.muyAlto)||0.50;
    if(ratio<=_rIdeal)f2=Math.min(100,f2+12);
    else if(ratio<=_rAce){}
    else if(ratio<=_rAlto)f2=Math.max(0,f2-18);
    else if(ratio<=_rMuy)f2=Math.max(0,f2-38);
    else f2=Math.max(0,f2-60);
  }
  f2=Math.max(0,Math.min(100,f2));

  var empBase={formal:78,publico:70,independiente:65,comerciante:68,delivery:70,remesas:60,informal:38};
  var antBase={'1':0,'2':10,'3':22,'5':35};
  var f3=Math.min(100,(empBase[emp]||30)+(antBase[ant]||0));
  if(uso==='delivery')f3=Math.min(100,f3+15);
  else if(uso==='negocio')f3=Math.min(100,f3+7);
  if(rem==='si'&&emp!=='remesas')f3=Math.min(100,f3+8);
  f3=Math.max(0,Math.min(100,f3));

  var f4=25;
  if(fiador)f4=Math.min(100,f4+45);
  if(viv==='propia')f4=Math.min(100,f4+15);
  else if(viv==='familiar')f4=Math.min(100,f4+5);
  if(banco==='activa')f4=Math.min(100,f4+10);
  else if(banco==='no')f4=Math.max(0,f4-10);
  f4=Math.max(0,Math.min(100,f4));

  var f5=50;
  if(conocio==='referido')f5=Math.min(100,f5+30);
  else if(conocio==='anterior')f5=Math.min(100,f5+22);
  else if(conocio==='redes')f5=Math.min(100,f5+5);
  if(deuda==='no')f5=Math.min(100,f5+10);
  else if(deuda==='graves')f5=Math.max(0,f5-15);
  if(rem==='si')f5=Math.min(100,f5+8);
  f5=Math.max(0,Math.min(100,f5));

  // Hard rejects con SCORE_CFG
  var _hr = (SCORE_CFG&&SCORE_CFG.hardReject)||{};
  var _ingMin = _hr.ingresoMinimo||100;
  var _ratioMax = _hr.ratioCuotaMax||0.55;
  // nota: ratio aquí es cuota quincenal/ingreso mensual; convertimos para que sea mensual/mensual
  var _ratioMensual = ratio*2;
  var hardReject = (ingEf>0 && ingEf<_ingMin)
    || (_ratioMensual>_ratioMax)
    || (_hr.historialMaloConDeuda && hist==='malo' && deuda==='graves');
  // Pesos configurables
  var _p = (SCORE_CFG&&SCORE_CFG.pesos)||{f1:30,f2:30,f3:20,f4:15,f5:5};
  var _totalPeso = (_p.f1+_p.f2+_p.f3+_p.f4+_p.f5)||100;
  var raw=Math.round((f1*_p.f1+f2*_p.f2+f3*_p.f3+f4*_p.f4+f5*_p.f5)/_totalPeso*10);
  var score=hardReject?300:Math.max(300,Math.min(850,Math.round(300+(raw/1000)*550)));

  WZ.score=score;WZ.f1=Math.round(f1);WZ.f2=Math.round(f2);
  WZ.f3=Math.round(f3);WZ.f4=Math.round(f4);WZ.f5=Math.round(f5);
  WZ.ratio=ratio;WZ.ingEf=ingEf;WZ.precio=precio;
  if(cuotaQ>0){WZ.cuota=cuotaQ;WZ.monto=planCfg ? (parseFloat(planCfg.fin)||0) : calcMoto(precio).fin; }
  _wzActualizarPill();
}

function _wzActualizarPill(){
  var s = WZ.score;
  if(!s) return;
  function scoreCol(s){ return s>=625?'var(--green)':s>=450?'var(--amber)':'var(--red)'; }
  function scoreLbl(s){ return s>=750?'Excelente':s>=625?'Bueno':s>=450?'Regular':'Bajo'; }
  var pills = document.querySelectorAll('#wz-overlay [data-wz-pill]');
  // rebuild pill inline
  var header = document.querySelector('#wz-overlay [data-wz-header]');
  if(header){
    header.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;background:var(--surf);border:1.5px solid var(--rim2);border-radius:50px;padding:7px 16px">'
      +'<div style="font-size:22px;font-weight:900;letter-spacing:-1px;color:'+scoreCol(s)+'">'+s+'</div>'
      +'<div><div style="font-size:10px;font-weight:700;color:'+scoreCol(s)+'">'+scoreLbl(s)+'</div>'
      +'<div style="font-size:9px;color:var(--ink3)">Score Indexa /850</div></div>'
      +(WZ.cuota>0?'<div style="width:1px;height:28px;background:var(--rim);margin:0 4px"></div><div><div style="font-size:13px;font-weight:800;color:var(--p1)">$'+WZ.cuota.toFixed(2)+'</div><div style="font-size:9px;color:var(--ink3)">cuota quincenal</div></div>':'')
      +'</div>';
  }
}

// ── Validaciones por paso ──
function _wzValidar(){
  _wzCollectVisibleValues();
  var s = WZ.step;
  var g = function(id){ var el=document.getElementById(id); return el?el.value.trim():''; };
  // En modo edición sin firma, las validaciones de paso 1 y precio son opcionales
  var _modoEdicion = !!window._wzEditando;
  if(s===1 && !_modoEdicion){
    if(!g('wz_nom')){ toast('El nombre es obligatorio','error'); return false; }
    if(!g('wz_ci')){ toast('La cédula es obligatoria','error'); return false; }
    if(!g('wz_tel')){ toast('El teléfono es obligatorio','error'); return false; }
    if(!g('wz_emp')){ toast('Selecciona el tipo de empleo','error'); return false; }
    var ing = parseFloat((document.getElementById('wz_ing')||{}).value)||0;
    if(ing<=0){ toast('El ingreso mensual es obligatorio','error'); return false; }
  }
  if(s===3){
    var precio = parseFloat((document.getElementById('wz_precio')||{}).value)||0;
    if(precio<=0 && !_modoEdicion){ toast('Selecciona una moto o ingresa el precio','error'); return false; }
    if(precio<=0) precio = WZ.precio||0; // en edición usar precio guardado
    WZ.precio = precio;
    var planMode=((document.getElementById('wz_plan_mode')||{}).value)||'global';
    if(planMode==='custom'){
      var iniReal=parseFloat((document.getElementById('wz_ini_real')||{}).value)||0;
      var cuotaReal=parseFloat((document.getElementById('wz_cuota_q_custom')||{}).value)||0;
      var plazoReal=parseInt((document.getElementById('wz_plazo_custom')||{}).value,10)||0;
      if(iniReal<0){ toast('La inicial real no puede ser negativa','error'); return false; }
      if(cuotaReal<=0){ toast('La cuota quincenal es obligatoria en plan personalizado','error'); return false; }
      if(plazoReal<=0){ toast('El plazo es obligatorio en plan personalizado','error'); return false; }
      var precioBase=parseFloat((document.getElementById('wz_precio_base_real')||{}).value)||precio;
      if(precioBase<=0){ toast('El precio base real es obligatorio','error'); return false; }
      if(iniReal>precioBase){ toast('La inicial real no puede ser mayor al precio base real','error'); return false; }
      // Guardar en WZ para que getWzPlanConfig() los encuentre aunque el DOM ya no esté
      WZ.plazo = plazoReal;
      WZ.cuota = cuotaReal;
      WZ.ini = iniReal;
      WZ.precioBaseReal = precioBase;
      WZ.planMode = 'custom';
    }
    if(planMode==='apy'){
      var apyObj=parseFloat((document.getElementById('wz_apy_objetivo')||{}).value)||0;
      var plazoApy=parseInt((document.getElementById('wz_apy_plazo')||{}).value,10)||0;
      if(apyObj<=0){ toast('El APY objetivo es obligatorio','error'); return false; }
      if(plazoApy<=0){ toast('El plazo es obligatorio en plan APY','error'); return false; }
      var iniSelEl=document.getElementById('wz_apy_inicial_sel');
      var iniSelRaw=iniSelEl?iniSelEl.value:'0.50';
      var iniSel=iniSelRaw==='custom'?(parseFloat(window._wzCustomPct)||0.50):parseFloat(iniSelRaw);
      if(!(iniSel>0)) iniSel=0.50;
      var precioBaseApy=parseFloat((document.getElementById('wz_precio_base_real')||{}).value)||precio;
      // Guardar en WZ para que getWzPlanConfig() los encuentre aunque el DOM ya no esté
      WZ.plazo = plazoApy;
      WZ.precioBaseReal = precioBaseApy;
      WZ.planMode = 'apy';
      window._wzCustomPct = iniSel; // asegurar que el pct quede guardado
    }
    // Validar pago de la moto SOLO si el bloque está visible (moto del catálogo)
    // y NO estamos en modo edición de solicitud sin firma
    var _mpagoWrap = document.getElementById('wz-mpago-wrap');
    var _mpagoVisible = _mpagoWrap && _mpagoWrap.style.display !== 'none';
    if(_mpagoVisible && !_modoEdicion){
      var _precioBase = parseFloat((document.getElementById('wz_precio_base_real')||{}).value)||precio;
      var _val = _mpagoValidarContraCosto('wzmpago', _precioBase);
      if(!_val.ok){ toast(_val.error,'error'); return false; }
      WZ._pagosMoto = _val.pagos;
    } else {
      WZ._pagosMoto = null; // inventario, precio manual o edición: no se cobra de nuevo
    }
    _wzActualizarFinPreview(precio);
  }
  // Guardar valores antes de avanzar
  if(s===1){
    WZ.clienteSel = g('wz_cliente_sel');
    WZ.nom = g('wz_nom'); WZ.ci = _wzFmtCedula(g('wz_ci')); WZ.tel = g('wz_tel');
    WZ.wa = g('wz_wa'); WZ.email = g('wz_email'); WZ.ciudad = g('wz_ciudad');
    WZ.emp = g('wz_emp'); WZ.ant = g('wz_ant');
    WZ.ing = parseFloat((document.getElementById('wz_ing')||{}).value)||0;
    WZ.conocio = g('wz_conocio');
    WZ.wz_nom = WZ.nom; WZ.wz_ci = WZ.ci; WZ.wz_tel = WZ.tel; WZ.wz_wa = WZ.wa; WZ.wz_email = WZ.email; WZ.wz_ciudad = WZ.ciudad;
    WZ.wz_emp = WZ.emp; WZ.wz_ant = WZ.ant; WZ.wz_ing = WZ.ing; WZ.wz_conocio = WZ.conocio;
  }
  if(s===3){
    WZ.uso = g('wz_uso');
    WZ.vin = g('wz_vin'); WZ.color = g('wz_color'); WZ.placa = g('wz_placa');
    WZ.marca = g('wz_marca'); WZ.anio = g('wz_anio');
    WZ.serialMotor = g('wz_serial_motor'); WZ.serialChasis = g('wz_serial_chasis');
    WZ.gpsNum = g('wz_gps_num');
  }
  if(s===2){
    WZ.obs = g('wz_obs'); WZ.wz_obs = WZ.obs;
    WZ.viv = g('wz_viv'); WZ.wz_viv = WZ.viv;
    WZ.tdir = g('wz_tdir'); WZ.wz_tdir = WZ.tdir;
    WZ.estado_ubi = g('wz_estado'); WZ.wz_estado = WZ.estado_ubi;
    WZ.ciudad_res = g('wz_ciudad_res'); WZ.wz_ciudad_res = WZ.ciudad_res;
    WZ.dir_det = g('wz_dir_det'); WZ.wz_dir_det = WZ.dir_det;
    WZ.dir_q = g('wz_dir_q'); WZ.wz_dir_q = WZ.dir_q;
    WZ.emp = _wzChipVal('wz_emp_g')||g('wz_emp')||'';
    WZ.empresa = g('wz_empresa'); WZ.wz_empresa = WZ.empresa;
    WZ.cargo = g('wz_cargo'); WZ.wz_cargo = WZ.cargo;
    WZ.ing = parseFloat(g('wz_ing'))||0;
    WZ.ifam = parseFloat(g('wz_ifam'))||0;
    WZ.ant = g('wz_ant');
    WZ.rem = g('wz_rem');
    WZ.dep = parseInt(_wzChipVal('wz_dep_g')||0);
    WZ.hist = _wzChipVal('wz_hist_g')||'ninguno';
    WZ.deuda = _wzChipVal('wz_deuda_g')||'no';
    WZ.banco = g('wz_banco');
    WZ.banco_nm = g('wz_banco_nm');
    WZ.banco_cobro = g('wz_banco_cobro');
    WZ.cuenta = g('wz_cuenta');
    WZ.ahorro = g('wz_ahorro');
    WZ.cashea = (document.querySelector('input[name="wz_cashea"]:checked')||{value:'no'}).value;
    WZ.cashea_nivel = g('wz_cashea_nivel');
    WZ.cashea_pago = g('wz_cashea_pago');
    WZ.cashea_estado = g('wz_cashea_estado');
    WZ.cashea_deuda = g('wz_cashea_deuda');
    WZ.cashea_monto = g('wz_cashea_monto');
    WZ.cashea_cuotas_pend = g('wz_cashea_cuotas_pend');
    WZ.cashea_ultimo_art = g('wz_cashea_ultimo_art');
    WZ.cashea_ultimo_monto = g('wz_cashea_ultimo_monto');
    WZ.cashea_ultima_fecha = g('wz_cashea_ultima_fecha');
    WZ.cashea_total_compras = g('wz_cashea_total_compras');
    WZ.cashea_obs = g('wz_cashea_obs');
    WZ.fiador_tiene = (document.querySelector('input[name="wz_fiador"]:checked')||{value:'no'}).value;
    WZ.fiador_nom = g('wz_fiador_nom');
    WZ.fiador_tel = g('wz_fiador_tel');
    WZ.fiador_ci = g('wz_fiador_ci');
    WZ.fiador_rel = g('wz_fiador_rel');
    WZ.r1n = g('wz_r1n'); WZ.r1t = g('wz_r1t'); WZ.r1r = g('wz_r1r'); WZ.r1obs = g('wz_r1obs');
    WZ.r2n = g('wz_r2n'); WZ.r2t = g('wz_r2t'); WZ.r2r = g('wz_r2r'); WZ.r2obs = g('wz_r2obs');
    WZ.documentos = _wzGetClientDocsArray();
    WZ.docsCount = WZ.documentos.length;
    WZ.impresion = _wzChipVal('wz_impresion_g')||'';
  }
  return true;
}

// ── Siguiente / Anterior ──
function _wzNext(){
  if(!_wzValidar()) return;
  _wzScore();
  WZ.step = Math.min(WZ.totalSteps, WZ.step+1);
  _wzRender();
}
function _wzPrev(){
  _wzCollectVisibleValues();
  WZ.step = Math.max(1, WZ.step-1);
  _wzRender();
}

// ── Renderizar resultado (paso 4) ──
function _wzRenderResultado(){
  var s = WZ.score;
  var el = document.getElementById('wz-resultado-contenido');
  if(!el) return;

  function col(s){ return s>=625?'var(--green)':s>=450?'var(--amber)':'var(--red)'; }
  function lbl(s){ return s>=750?'Excelente ':s>=625?'Bueno ':s>=450?'Regular ':'Bajo '; }

  var decClass = s>=625?'var(--greens)':s>=450?'var(--ambers)':'var(--reds)';
  var decBorder = s>=625?'rgba(6,176,106,.3)':s>=450?'rgba(232,152,10,.3)':'rgba(217,59,90,.3)';
  var decIco = s>=625?'':s>=450?'️':'';
  var decTxt = s>=625?'Crédito Aprobado':s>=450?'Revisión Manual':'Crédito Rechazado';
  var decSub = s>=625?'El solicitante cumple los criterios. Puedes proceder con el contrato.'
    :s>=450?'Perfil con factores de riesgo moderados. Verificar documentos y condiciones.'
    :'El perfil no cumple los requisitos mínimos.';

  var r = WZ.precio>0 ? getWzPlanConfig() : {mode:'global',precioBaseReal:0,ini:0,fin:0,total:0,cuotaQ:0,totalPagado:0,plazo:PLAN.plazo,inicialPct:PLAN.inicial};
  var ratioColor = WZ.ratio<=0.30?'var(--green)':WZ.ratio<=0.40?'var(--amber)':'var(--red)';

  el.innerHTML =
    // Decisión
    '<div style="background:'+decClass+';border:1.5px solid '+decBorder+';border-radius:16px;padding:20px;text-align:center;margin-bottom:14px">'
    +'<div style="font-size:36px;margin-bottom:6px">'+decIco+'</div>'
    +'<div style="font-size:19px;font-weight:900;color:'+col(s)+';margin-bottom:5px">'+decTxt+'</div>'
    +'<div style="font-size:12.5px;opacity:.8;max-width:340px;margin:0 auto;line-height:1.55">'+decSub+'</div>'
    +'</div>'
    // Score ring (simplificado)
    +'<div style="background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:18px;display:flex;align-items:center;gap:16px;margin-bottom:12px">'
    +'<div style="text-align:center;flex-shrink:0">'
    +'<div style="font-size:48px;font-weight:900;letter-spacing:-2px;color:'+col(s)+'">'+s+'</div>'
    +'<div style="font-size:10px;color:var(--ink3);font-weight:700">/850 · '+lbl(s)+'</div>'
    +'</div>'
    +'<div style="flex:1">'
    // Barras de factores
    +[['Intención de pago',WZ.f1],['Capacidad de pago',WZ.f2],['Estabilidad',WZ.f3],['Garantías',WZ.f4],['Perfil',WZ.f5]].map(function(f){
      var c=f[1]>=70?'var(--green)':f[1]>=45?'var(--amber)':'var(--red)';
      return '<div style="margin-bottom:6px">'
        +'<div style="display:flex;justify-content:space-between;font-size:10px;font-weight:600;color:var(--ink3);margin-bottom:2px"><span>'+f[0]+'</span><span style="color:'+c+'">'+f[1]+'/100</span></div>'
        +'<div style="height:5px;background:var(--rim);border-radius:3px;overflow:hidden"><div style="height:100%;width:'+f[1]+'%;background:'+c+';border-radius:3px;transition:width .8s"></div></div>'
        +'</div>';
    }).join('')
    +'</div></div>'
    // Resumen del cliente
    +'<div style="background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:16px;margin-bottom:12px">'
    +'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--p1);margin-bottom:10px">Resumen del Solicitante</div>'
    +[
      ['Cliente', WZ.nom||'—'],
      ['Cédula', WZ.ci||'—'],
      ['Teléfono', WZ.tel||'—'],
      ['Ciudad', WZ.ciudad||'—'],
      ['Empleo', WZ.emp||'—'],
      ['Ingreso', '$'+(WZ.ing||0)+'/mes'],
    ].map(function(row){
      return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--rim2);font-size:12.5px"><span style="color:var(--ink3)">'+row[0]+'</span><span style="font-weight:700">'+row[1]+'</span></div>';
    }).join('')
    +'</div>'
    // Plan de financiamiento
    +(WZ.precio>0?
      '<div style="background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:16px;margin-bottom:12px">'
      +'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--p1);margin-bottom:10px">Plan de Crédito · Pagasi</div>'
      +[
        ['Modelo', WZ.motoModelo||'—'],
        ['Precio catálogo', '$'+WZ.precio.toFixed(0)],
        ['Precio base real', '$'+(parseFloat(r.precioBaseReal)||0).toFixed(0)],
        [r.mode==='custom'?'Inicial real':'Inicial ('+((r.inicialPct||0)*100).toFixed(0)+'%)', '$'+r.ini.toFixed(0)],
        ['Monto a financiar', '$'+r.fin.toFixed(0)],
        ['Cuota quincenal', '$'+r.cuotaQ.toFixed(2)],
        ['Cuota / Ingreso', WZ.ratio>0?(WZ.ratio*100).toFixed(0)+'%':'—'],
        ['Plazo', (r.plazo||0)+' meses'],
        ['Total a pagar', '$'+r.totalPagado.toFixed(0)],
      ].map(function(row){
        var col2color = (row[0]==='Cuota / Ingreso') ? ratioColor : 'var(--ink)';
        return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--rim2);font-size:12.5px"><span style="color:var(--ink3)">'+row[0]+'</span><span style="font-weight:700;color:'+col2color+'">'+row[1]+'</span></div>';
      }).join('')
      +'</div>'
      +'<div style="background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:16px;margin-bottom:12px">'
      +'<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--p1);margin-bottom:10px">Cobro de Inicial</div>'
      +'<div class="fgr">'
      +'<div class="fg"><label>Método de pago inicial *</label><select class="fs" id="wz_ini_metodo" onchange="WZ.iniMetodo=this.value">'
      +(((_cuentasBanc&&_cuentasBanc.length?_cuentasBanc:[]).map(function(c){ return '<option value="'+c.nombre+'"'+(WZ.iniMetodo&&WZ.iniMetodo===c.nombre?' selected':'')+'>'+c.nombre+'</option>'; }).join('')) || '<option value="Efectivo USD">Efectivo USD</option>')
      +'</select></div>'
      +'<div class="fg"><label>Referencia / Comprobante</label><input class="fi" id="wz_ini_ref" placeholder="N° de referencia (opcional)"></div>'
      +'</div>'
      +'<div style="font-size:11px;color:var(--ink3);margin-top:6px">La inicial se acreditará a la cuenta seleccionada al guardar el crédito.</div>'
      +'</div>'
    :'')
    // Selector de concesionario (siempre visible en el último paso, si hay concesionarios creados)
    + (function(){
        var u = S.currentUser || {};
        var asignados = u.concesionarios || [];
        var todasSedes = (S.concesionarios||[]).filter(function(c){return !c.eliminado && c.activo!==false;});
        if(!todasSedes.length) return ''; // sin concesionarios creados, no mostrar
        // Determinar qué sedes puede ver: si tiene asignaciones específicas → solo esas; si no → todas
        var disponibles;
        if(asignados.length){
          disponibles = todasSedes.filter(function(c){ return asignados.indexOf(c.id) !== -1; });
        } else {
          disponibles = todasSedes; // admin total
        }
        if(!disponibles.length) return '';
        // Si tiene UNA sola sede asignada → input oculto (forzado a esa)
        if(disponibles.length === 1){
          // Pre-asignar en WZ
          WZ.concesionarioId = disponibles[0].id;
          return '<div style="background:var(--surf);border:1px solid var(--rim);border-radius:14px;padding:14px 16px;margin-bottom:12px">'
            + '<div style="display:flex;justify-content:space-between;align-items:center">'
            + '<div><div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--p1)">Concesionario</div>'
            + '<div style="font-size:13.5px;font-weight:700;margin-top:3px">'+disponibles[0].nombre+(disponibles[0].ciudad?' · '+disponibles[0].ciudad:'')+'</div></div>'
            + '<span style="background:rgba(0,184,118,.15);color:var(--green);padding:3px 10px;border-radius:10px;font-size:10px;font-weight:700">SEDE ÚNICA</span>'
            + '</div>'
            + '<input type="hidden" id="wz_concesionario_id" value="'+disponibles[0].id+'">'
            + '</div>';
        }
        // Selector cuando puede elegir entre varias
        // Pre-seleccionado: el del switcher si está dentro de sus disponibles, sino el primero
        var preSel = S.concesionarioActivo;
        if(preSel && !disponibles.find(function(c){return c.id===preSel;})){ preSel = disponibles[0].id; }
        if(!preSel) preSel = disponibles[0].id;
        WZ.concesionarioId = preSel;
        return '<div style="background:var(--surf);border:1.5px solid var(--p1);border-radius:14px;padding:14px 16px;margin-bottom:12px">'
          + '<div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--p1);margin-bottom:9px">¿En qué concesionario se hace este crédito?</div>'
          + '<select class="fs" id="wz_concesionario_id" onchange="WZ.concesionarioId=this.value" style="font-size:13px;font-weight:700">'
          + disponibles.map(function(c){
              return '<option value="'+c.id+'" '+(preSel===c.id?'selected':'')+'>'+c.nombre+(c.ciudad?' · '+c.ciudad:'')+'</option>';
            }).join('')
          + '</select>'
          + '<div style="font-size:11px;color:var(--ink3);margin-top:6px;line-height:1.5">El crédito quedará registrado en esta sede. Predeterminado: el concesionario activo en el switcher de arriba.</div>'
          + '</div>';
      })();
}

// ── Guardar solicitud ──
function _wzGuardar(){
  _wzCollectVisibleValues();
  var btn = document.querySelector('#wz-overlay button[onclick="_wzGuardar()"]');
  if(btn){ btn.textContent='Guardando...'; btn.disabled=true; }

  // ── Si se eligió "Agregar nueva moto al catálogo" en el wizard, guardarla primero ──
  var _wzCatSel = document.getElementById('wz_moto_cat');
  if(_wzCatSel && _wzCatSel.value === '__wz_new_cat__'){
    var _wzCatModelo = ((document.getElementById('wz_cat_modelo')||{}).value||'').trim();
    var _wzCatPrecio = parseFloat((document.getElementById('wz_cat_precio')||{}).value)||0;
    var _wzCatMarca  = ((document.getElementById('wz_cat_marca')||{}).value||'').trim();
    if(!_wzCatModelo || !_wzCatPrecio){
      toast('Ingresa el modelo y precio de la nueva moto','error');
      if(btn){ btn.textContent='Guardar Solicitud'; btn.disabled=false; }
      return;
    }
    var _wzNewCatId = CATALOGO.length ? Math.max.apply(null,CATALOGO.map(function(c){return c.id||0;}))+1 : 1;
    var _wzCatEntry = {id:_wzNewCatId, modelo:_wzCatModelo, precio:_wzCatPrecio};
    if(_wzCatMarca) _wzCatEntry.marca = _wzCatMarca;
    CATALOGO.push(_wzCatEntry);
    if(db){ db.collection('config').doc('catalogo').set({items:CATALOGO}).then(function(){ try{localStorage.setItem('pagasi_catalogo_config',JSON.stringify(CATALOGO));}catch(e){} }).catch(function(){}); }
    WZ.motoModelo = _wzCatModelo;
    WZ.precio = _wzCatPrecio;
    if(_wzCatMarca) WZ.marca = _wzCatMarca;
    var _pInp = document.getElementById('wz_precio');
    if(_pInp) _pInp.value = _wzCatPrecio;
    toast('Moto agregada al catálogo: '+_wzCatModelo,'success');
  }

  // Leer concesionario seleccionado en el último paso (si existe)
  var _selConc = document.getElementById('wz_concesionario_id');
  if(_selConc && _selConc.value){
    WZ.concesionarioId = _selConc.value;
  }

  var _wizardDraft = _wzDraftSnapshot();
  var r = WZ.precio>0 ? getWzPlanConfig() : {mode:'global',precioBaseReal:0,ini:0,fin:0,total:0,cuotaQ:0,totalPagado:0,cuotaM:0,plazo:PLAN.plazo,totalCuotas:PLAN.plazo*2,factor:PLAN.factor,inicialPct:PLAN.inicial,tasaMensual:PLAN.tasaMensual,apy:PLAN.apy,sourcePlan:{plazo:PLAN.plazo, factor:PLAN.factor, inicial:PLAN.inicial, tasaMensual:PLAN.tasaMensual, apy:PLAN.apy}};

  // Crear cliente
  nextClienteIdAsync().then(function(_nextCliId){
  var cliId = _nextCliId;
  // Verificar si ya existe por selector o por cédula
  var existing = null;
  if(WZ.clienteSel){
    existing = S.clientes.find(function(c){ return !c.eliminado && String(c.id)===String(WZ.clienteSel); }) || null;
  }
  if(!existing){
    existing = S.clientes.find(function(c){ return !c.eliminado && c.cedula && c.cedula.replace(/\s/g,'').toLowerCase()===(WZ.ci||'').replace(/\s/g,'').toLowerCase(); }) || null;
  }
  if(existing){
    cliId = existing.id;
    // Actualizar el cliente existente con los datos del wizard (incluyendo nombre corregido)
    if(WZ.nom) existing.nombre = WZ.nom;
    if(WZ.ci) existing.cedula = WZ.ci;
    if(WZ.rif) existing.rif = WZ.rif;
    if(WZ.nacionalidad) existing.nacionalidad = WZ.nacionalidad;
    if(WZ.tel) existing.tel = WZ.tel;
    if(WZ.wa) existing.wa = WZ.wa;
    if(WZ.email) existing.email = WZ.email;
    if(WZ.ciudad_res||WZ.ciudad) existing.ciudad = WZ.ciudad_res||WZ.ciudad||existing.ciudad;
    if(WZ.estado_ubi) existing.estado_ubi = WZ.estado_ubi;
    if(WZ.dir_det) existing.dir = WZ.dir_det;
    if(WZ.emp) existing.trabajo = WZ.emp;
    if(WZ.empresa) existing.empresa = WZ.empresa;
    if(WZ.cargo) existing.cargo = WZ.cargo;
    if(WZ.dir_trabajo) existing.dir_trabajo = WZ.dir_trabajo;
    if(WZ.tel_trabajo) existing.tel_trabajo = WZ.tel_trabajo;
    if(WZ.ing) existing.ingreso = WZ.ing;
    if(WZ.ifam) existing.ingreso_familiar = WZ.ifam;
    if(WZ.ant) existing.antiguedad = WZ.ant;
    if(WZ.score) existing.score_indexa = WZ.score;
    if(WZ.r1n){ existing.ref1 = {nom:WZ.r1n||'',ci:WZ.r1ci||'',tel:WZ.r1t||'',rel:WZ.r1r||'',obs:WZ.r1obs||''}; }
    if(WZ.r2n){ existing.ref2 = {nom:WZ.r2n||'',ci:WZ.r2ci||'',tel:WZ.r2t||'',rel:WZ.r2r||'',obs:WZ.r2obs||''}; }
    if(WZ.fiador_nom){ existing.fiador = WZ.fiador_tiene||existing.fiador; existing.fiador_nom = WZ.fiador_nom; existing.fiador_ci = WZ.fiador_ci; existing.fiador_tel = WZ.fiador_tel; existing.fiador_rif = WZ.fiador_rif; existing.fiador_dir = WZ.fiador_dir; existing.fiador_email = WZ.fiador_email; }
    DB.saveCliente(existing);
  }

  var cliente = existing || {
    id: cliId,
    nombre: WZ.nom||'',
    cedula: WZ.ci||'',
    rif: WZ.rif||'',
    nacionalidad: WZ.nacionalidad||'',
    tel: WZ.tel||'',
    wa: WZ.wa||'',
    email: WZ.email||'',
    ciudad: WZ.ciudad_res||WZ.ciudad||'',
    estado_ubi: WZ.estado_ubi||'',
    dir: WZ.dir_det||'',
    trabajo: WZ.emp||'',
    empresa: WZ.empresa||'',
    cargo: WZ.cargo||'',
    dir_trabajo: WZ.dir_trabajo||'',
    tel_trabajo: WZ.tel_trabajo||'',
    ingreso: WZ.ing||0,
    ingreso_familiar: WZ.ifam||0,
    antiguedad: WZ.ant||'',
    remesas: WZ.rem||'no',
    dependientes: WZ.dep||0,
    vivienda: WZ.viv||'',
    tiempo_dir: WZ.tdir||'',
    historial: WZ.hist||'',
    deudas: WZ.deuda||'',
    banco_estado: WZ.banco||'',
    banco_nombre: WZ.banco_nm||'',
    banco_cobro: WZ.banco_cobro||'',
    cuenta_digitos: WZ.cuenta||'',
    ahorro: WZ.ahorro||'',
    cashea: WZ.cashea||'no',
    cashea_nivel: WZ.cashea_nivel||'',
    cashea_pago: WZ.cashea_pago||'',
    cashea_estado: WZ.cashea_estado||'',
    cashea_deuda: WZ.cashea_deuda||'no',
    cashea_monto: parseFloat(WZ.cashea_monto)||0,
    cashea_cuotas_pend: parseInt(WZ.cashea_cuotas_pend)||0,
    cashea_ultimo_art: WZ.cashea_ultimo_art||'',
    cashea_ultimo_monto: parseFloat(WZ.cashea_ultimo_monto)||0,
    cashea_ultima_fecha: WZ.cashea_ultima_fecha||'',
    cashea_total_compras: WZ.cashea_total_compras||'',
    cashea_obs: WZ.cashea_obs||'',
    fiador: WZ.fiador_tiene||'no',
    fiador_nom: WZ.fiador_nom||'',
    fiador_tel: WZ.fiador_tel||'',
    fiador_ci: WZ.fiador_ci||'',
    fiador_rel: WZ.fiador_rel||'',
    ref1: {nom:WZ.r1n||'',tel:WZ.r1t||'',rel:WZ.r1r||'',obs:WZ.r1obs||''},
    ref2: {nom:WZ.r2n||'',tel:WZ.r2t||'',rel:WZ.r2r||'',obs:WZ.r2obs||''},
    docs_count: WZ.docsCount||0,
    documentos: _wzGetClientDocsArray(),
    impresion: WZ.impresion||'',
    conocio: WZ.conocio||'',
    score_indexa: WZ.score||0,
    estado: 'activo',
    creado: new Date().toISOString()
  };
  if(!existing){
    cliente.concesionarioId = (WZ.concesionarioId !== undefined ? WZ.concesionarioId : _concDefaultId());
    S.clientes.push(cliente);
    DB.saveCliente(cliente);
  }

  // ── Si estamos editando un crédito sin firma, actualizar en lugar de crear ──
  if(window._wzEditando){
    var _editId = window._wzEditando;
    window._wzEditando = null;
    var _ei = S.creds.findIndex(function(x){ return x.id===_editId; });
    if(_ei>=0){
      var _r = getWzPlanConfig();
      var _finUpd = _wzCredPlanFields(_r, S.creds[_ei]);
      var _upd = {
        cli: WZ.nom||(existing&&existing.nombre)||S.creds[_ei].cli||'',
        modelo: WZ.motoModelo||S.creds[_ei].modelo||'',
        motoId: WZ.motoInvId||S.creds[_ei].motoId||null,
        marca: WZ.marca||S.creds[_ei].marca||'',
        vin: WZ.vin||S.creds[_ei].vin||'',
        color: WZ.color||S.creds[_ei].color||'',
        anio: WZ.anio||S.creds[_ei].anio||'',
        placa: WZ.placa||S.creds[_ei].placa||'',
        serialMotor: WZ.serialMotor||S.creds[_ei].serialMotor||'',
        serialChasis: WZ.serialChasis||S.creds[_ei].serialChasis||'',
        gpsNum: WZ.gpsNum||S.creds[_ei].gpsNum||'',
        precio: WZ.precio||S.creds[_ei].precio||0,
        precioBaseReal: _finUpd.precioBaseReal,
        ini: _finUpd.ini,
        fin: _finUpd.fin,
        total: _finUpd.total,
        cuota: _finUpd.cuota,
        cuotaQ: _finUpd.cuotaQ,
        cuotaM: _finUpd.cuotaM,
        plazo: _finUpd.plazo,
        totalCuotas: _finUpd.totalCuotas,
        factor: _finUpd.factor,
        inicialPct: _finUpd.inicialPct,
        tasaMensual: _finUpd.tasaMensual,
        planModo: _finUpd.planModo,
        plan: _finUpd.plan,
        uso_moto: WZ.uso||S.creds[_ei].uso_moto||'',
        notas: WZ.obs||S.creds[_ei].notas||'',
        conocio: WZ.conocio||S.creds[_ei].conocio||'',
        emp_tipo: WZ.emp||S.creds[_ei].emp_tipo||'',
        viv: WZ.viv||S.creds[_ei].viv||'', tdir: WZ.tdir||S.creds[_ei].tdir||'',
        estado_ubi: WZ.estado_ubi||S.creds[_ei].estado_ubi||'',
        ciudad_res: WZ.ciudad_res||S.creds[_ei].ciudad_res||'',
        dir_det: WZ.dir_det||S.creds[_ei].dir_det||'',
        dir_q: WZ.dir_q||S.creds[_ei].dir_q||'',
        empresa: WZ.empresa||S.creds[_ei].empresa||'',
        cargo: WZ.cargo||S.creds[_ei].cargo||'',
        ing: WZ.ing||S.creds[_ei].ing||0,
        ifam: WZ.ifam||S.creds[_ei].ifam||0,
        ant: WZ.ant||S.creds[_ei].ant||'',
        rem: WZ.rem||S.creds[_ei].rem||'no',
        dep: WZ.dep||S.creds[_ei].dep||0,
        hist: WZ.hist||S.creds[_ei].hist||'ninguno',
        deuda: WZ.deuda||S.creds[_ei].deuda||'no',
        banco: WZ.banco||S.creds[_ei].banco||'activa',
        banco_nm: WZ.banco_nm||S.creds[_ei].banco_nm||'',
        banco_cobro: WZ.banco_cobro||S.creds[_ei].banco_cobro||'',
        cuenta: WZ.cuenta||S.creds[_ei].cuenta||'',
        ahorro: WZ.ahorro||S.creds[_ei].ahorro||'no',
        cashea: WZ.cashea||S.creds[_ei].cashea||'no',
        cashea_nivel: WZ.cashea_nivel||S.creds[_ei].cashea_nivel||'',
        cashea_pago: WZ.cashea_pago||S.creds[_ei].cashea_pago||'',
        fiador_tiene: WZ.fiador_tiene||S.creds[_ei].fiador_tiene||'no',
        fiador_nom: WZ.fiador_nom||S.creds[_ei].fiador_nom||'',
        fiador_tel: WZ.fiador_tel||S.creds[_ei].fiador_tel||'',
        fiador_ci: WZ.fiador_ci||S.creds[_ei].fiador_ci||'',
        fiador_rel: WZ.fiador_rel||S.creds[_ei].fiador_rel||'',
        fiador_rif: WZ.fiador_rif||S.creds[_ei].fiador_rif||'',
        fiador_dir: WZ.fiador_dir||S.creds[_ei].fiador_dir||'',
        fiador_email: WZ.fiador_email||S.creds[_ei].fiador_email||'',
        r1n: WZ.r1n||S.creds[_ei].r1n||'', r1ci: WZ.r1ci||S.creds[_ei].r1ci||'',
        r1t: WZ.r1t||S.creds[_ei].r1t||'',
        r1r: WZ.r1r||S.creds[_ei].r1r||'', r1obs: WZ.r1obs||S.creds[_ei].r1obs||'',
        r2n: WZ.r2n||S.creds[_ei].r2n||'', r2ci: WZ.r2ci||S.creds[_ei].r2ci||'',
        r2t: WZ.r2t||S.creds[_ei].r2t||'',
        r2r: WZ.r2r||S.creds[_ei].r2r||'', r2obs: WZ.r2obs||S.creds[_ei].r2obs||'',
        documentos: (Array.isArray(WZ.documentos)&&WZ.documentos.length)?WZ.documentos:(S.creds[_ei].documentos||[]),
        docsCount: (Array.isArray(WZ.documentos)?WZ.documentos.length:(S.creds[_ei].docsCount||0)),
        impresion: WZ.impresion||S.creds[_ei].impresion||'',
        cashea_estado: WZ.cashea_estado||S.creds[_ei].cashea_estado||'',
        cashea_deuda: WZ.cashea_deuda||S.creds[_ei].cashea_deuda||'no',
        cashea_monto: WZ.cashea_monto||S.creds[_ei].cashea_monto||0,
        cashea_cuotas_pend: WZ.cashea_cuotas_pend||S.creds[_ei].cashea_cuotas_pend||0,
        cashea_ultimo_art: WZ.cashea_ultimo_art||S.creds[_ei].cashea_ultimo_art||'',
        cashea_ultimo_monto: WZ.cashea_ultimo_monto||S.creds[_ei].cashea_ultimo_monto||0,
        cashea_ultima_fecha: WZ.cashea_ultima_fecha||S.creds[_ei].cashea_ultima_fecha||'',
        cashea_total_compras: WZ.cashea_total_compras||S.creds[_ei].cashea_total_compras||'',
        cashea_obs: WZ.cashea_obs||S.creds[_ei].cashea_obs||'',
        score: WZ.score||S.creds[_ei].score||0,
        concesionarioId: WZ.concesionarioId||S.creds[_ei].concesionarioId||'',
        f1: WZ.f1||S.creds[_ei].f1||'',
        f2: WZ.f2||S.creds[_ei].f2||'',
        f3: WZ.f3||S.creds[_ei].f3||'',
        f4: WZ.f4||S.creds[_ei].f4||'',
        f5: WZ.f5||S.creds[_ei].f5||'',
        wizardDraft: _wizardDraft,
        wizardData: _wizardDraft
      };
      // Actualizar cliente si hay datos nuevos
      if(existing && WZ.nom){
        var _cliUpd = {};
        if(WZ.nom) _cliUpd.nombre = WZ.nom;
        if(WZ.ci) _cliUpd.cedula = WZ.ci;
        if(WZ.tel) _cliUpd.tel = WZ.tel;
        if(WZ.wa) _cliUpd.wa = WZ.wa;
        if(WZ.email) _cliUpd.email = WZ.email;
        if(WZ.emp) _cliUpd.emp = WZ.emp;
        if(WZ.ing) _cliUpd.ing = WZ.ing;
        if(Object.keys(_cliUpd).length && DB.updateCliente) DB.updateCliente(existing.id, _cliUpd);
        else if(Object.keys(_cliUpd).length){ Object.assign(existing, _cliUpd); DB.saveCliente(existing); }
      }
      Object.assign(S.creds[_ei], _upd);
      DB.updateCred(_editId, _upd);
      syncEstadoClientePorCredito && syncEstadoClientePorCredito(_editId);
    }
    _wzClose();
    toast('Solicitud actualizada correctamente','success');
    if(typeof nav==='function') nav('creditos');
    return;
  }

  // Crear crédito — ID monotónico (no se recicla aunque haya eliminaciones)
  nextCredIdAsync().then(function(credId){
  var _finNew = _wzCredPlanFields(r, null);
  var newCred = {
    id: credId,
    cli: WZ.nom||(existing&&existing.nombre)||'',
    clienteId: cliId,
    modelo: WZ.motoModelo||'',
    motoId: WZ.motoInvId||null,
    marca: WZ.marca||'',
    vin: WZ.vin||'',
    color: WZ.color||'',
    anio: WZ.anio||'',
    placa: WZ.placa||'',
    serialMotor: WZ.serialMotor||'',
    serialChasis: WZ.serialChasis||'',
    gpsNum: WZ.gpsNum||'',
    precio: WZ.precio||0,
    precioBaseReal: _finNew.precioBaseReal,
    ini: _finNew.ini,
    fin: _finNew.fin,
    total: _finNew.total,
    cuota: _finNew.cuota,
    cuotaQ: _finNew.cuotaQ,
    cuotaM: _finNew.cuotaM || _finNew.cuotaQ*2,
    plazo: _finNew.plazo,
    totalCuotas: _finNew.totalCuotas,
    factor: _finNew.factor,
    inicialPct: _finNew.inicialPct,
    tasaMensual: _finNew.tasaMensual,
    planModo: _finNew.planModo,
    plan: _finNew.plan,
    frecuencia: 'quincenal',
    fecha: hoyLocalISO(),
    estado: ((S.currentUser&&S.currentUser.rol)==='Vendedor Concesionario') ? 'pendiente_revision' : 'activo',
    pagado: 0,
    mora: 0,
    cobrador: (function(){ var l = getCobradoresList(); return (l && l[0]) || 'Admin'; })(),
    score_indexa: WZ.score||0,
    f1:WZ.f1, f2:WZ.f2, f3:WZ.f3, f4:WZ.f4, f5:WZ.f5,
    emp_tipo: WZ.emp||'',
    uso_moto: WZ.uso||'',
    notas: WZ.obs||'',
    concesionarioId: (WZ.concesionarioId !== undefined ? WZ.concesionarioId : _concDefaultId()),
    creadoPor: (S.currentUser&&S.currentUser.nombre)||'Admin',
    creado: new Date().toISOString(),
    contratoFirmado: false,
    wizardDraft: _wizardDraft,
    wizardData: _wizardDraft,
    // ── Paso 2: Residencia ──
    viv: WZ.viv||'', tdir: WZ.tdir||'',
    estado_ubi: WZ.estado_ubi||'', ciudad_res: WZ.ciudad_res||'',
    dir_det: WZ.dir_det||'', dir_q: WZ.dir_q||'',
    // ── Paso 2: Empleo e ingresos ──
    empresa: WZ.empresa||'', cargo: WZ.cargo||'',
    ing: WZ.ing||0, ifam: WZ.ifam||0,
    ant: WZ.ant||'', rem: WZ.rem||'no',
    dep: WZ.dep||0,
    // ── Paso 2: Historial ──
    hist: WZ.hist||'ninguno', deuda: WZ.deuda||'no',
    banco: WZ.banco||'activa', banco_nm: WZ.banco_nm||'',
    banco_cobro: WZ.banco_cobro||'', cuenta: WZ.cuenta||'',
    ahorro: WZ.ahorro||'no',
    // ── Paso 2: Cashea ──
    cashea: WZ.cashea||'no', cashea_nivel: WZ.cashea_nivel||'',
    cashea_pago: WZ.cashea_pago||'',
    cashea_estado: WZ.cashea_estado||'', cashea_deuda: WZ.cashea_deuda||'no',
    cashea_monto: WZ.cashea_monto||0, cashea_cuotas_pend: WZ.cashea_cuotas_pend||0,
    cashea_ultimo_art: WZ.cashea_ultimo_art||'', cashea_ultimo_monto: WZ.cashea_ultimo_monto||0,
    cashea_ultima_fecha: WZ.cashea_ultima_fecha||'',
    cashea_total_compras: WZ.cashea_total_compras||'', cashea_obs: WZ.cashea_obs||'',
    // ── Paso 2: Fiador ──
    fiador_tiene: WZ.fiador_tiene||'no', fiador_nom: WZ.fiador_nom||'',
    fiador_tel: WZ.fiador_tel||'', fiador_ci: WZ.fiador_ci||'', fiador_rel: WZ.fiador_rel||'',
    fiador_rif: WZ.fiador_rif||'', fiador_dir: WZ.fiador_dir||'', fiador_email: WZ.fiador_email||'',
    // ── Paso 2: Referencias ──
    r1n: WZ.r1n||'', r1ci: WZ.r1ci||'', r1t: WZ.r1t||'', r1r: WZ.r1r||'', r1obs: WZ.r1obs||'',
    r2n: WZ.r2n||'', r2ci: WZ.r2ci||'', r2t: WZ.r2t||'', r2r: WZ.r2r||'', r2obs: WZ.r2obs||'',
    // ── Paso 2: Documentos y notas ──
    documentos: WZ.documentos||[], docsCount: WZ.docsCount||0,
    impresion: WZ.impresion||'',
    conocio: WZ.conocio||''
  };
  S.creds.push(newCred);
  DB.saveCred(newCred);
  if(typeof logActividad==='function') logActividad('credito_creado','creditos',newCred.id,{cliente:newCred.cli, modelo:newCred.modelo||'', total:newCred.total||newCred.fin||0});

  // Marcar moto como financiada o crearla desde catálogo
  if(WZ.motoInvId){
    var mi = S.motos.findIndex(function(m){ return String(m.id)===String(WZ.motoInvId); });
    if(mi>=0){
      S.motos[mi].estado='financiada';
      S.motos[mi].cliente=((existing&&existing.nombre)||WZ.nom);
      if(WZ.vin) S.motos[mi].vin=WZ.vin;
      if(WZ.color) S.motos[mi].color=WZ.color;
      if(WZ.placa) S.motos[mi].placa=WZ.placa;
      if(WZ.marca) S.motos[mi].marca=WZ.marca;
      if(WZ.anio) S.motos[mi].anio=WZ.anio;
      if(WZ.serialMotor) S.motos[mi].serialMotor=WZ.serialMotor;
      if(WZ.serialChasis) S.motos[mi].serialChasis=WZ.serialChasis;
      if(WZ.gpsNum) S.motos[mi].gpsNum=WZ.gpsNum;
      // Si la moto del inventario tenía concesionarioId, el crédito lo hereda
      if(S.motos[mi].concesionarioId && !newCred.concesionarioId){
        newCred.concesionarioId = S.motos[mi].concesionarioId;
        DB.saveCred(newCred);
      }
      DB.saveMoto(S.motos[mi]);
    }
  } else if(WZ.motoModelo){
    var newMotoId = S.motos.length ? Math.max.apply(null, S.motos.map(function(x){ return x.id||0; })) + 1 : 1;
    var motoInvNueva = {
      id:newMotoId,
      modelo:WZ.motoModelo||'',
      precio:parseFloat(WZ.precio)||0,
      precioBaseReal:r.precioBaseReal||parseFloat(WZ.precio)||0,
      planModo:r.mode||'global',
      marca:WZ.marca||'',
      color:WZ.color||'',
      anio:WZ.anio||'',
      vin:WZ.vin||'',
      placa:WZ.placa||'',
      serialMotor:WZ.serialMotor||'',
      serialChasis:WZ.serialChasis||'',
      gpsNum:WZ.gpsNum||'',
      estado:'financiada',
      cliente:((existing&&existing.nombre)||WZ.nom)||null,
      gps:false,
      notas:'Creada automáticamente desde catálogo al registrar financiamiento '+credId,
      ini:r.ini,
      fin:r.fin,
      total:r.total,
      cuotaQ:r.cuotaQ,
      cuotaM:r.cuotaM||r.cuotaQ*2,
      totalPagado:r.totalPagado||0,
      concesionarioId: newCred.concesionarioId || _concDefaultId()
    };
    S.motos.push(motoInvNueva);
    DB.saveMoto(motoInvNueva);
    newCred.motoId = motoInvNueva.id;
    DB.saveCred(newCred);
    // ── Crear egresos + movimientos por la compra de la moto (catálogo) ──
    if(WZ._pagosMoto && WZ._pagosMoto.length){
      _mpagoCrearGastos(motoInvNueva, WZ._pagosMoto, {fecha: newCred.fecha});
    }
  }

  // Si el crédito quedó como pendiente_revision (Vendedor Concesionario),
  // NO crear pago de inicial ni movimientos — eso se hará al aprobar
  if(newCred.estado === 'pendiente_revision'){
    _wzClose();
    toast('Solicitud enviada para revisión','success');
    if(typeof nav==='function') nav('creditos');
    return;
  }

  // Registrar la inicial también en Pagos
  var iniMetodo = ($('wz_ini_metodo')&&$('wz_ini_metodo').value) || (_cuentasBanc&&_cuentasBanc.length?_cuentasBanc[0].nombre:'Efectivo USD');
  var iniRef = ($('wz_ini_ref')&&$('wz_ini_ref').value) || '';
  var pagoIniId = 'PAG-'+Date.now();
  var pagoIni = {
    id:pagoIniId,
    cli:newCred.cli,
    cred:credId,
    fecha:newCred.fecha,
    monto:r.ini,
    metodo:iniMetodo,
    cuenta:iniMetodo,
    cobrador:(S.currentUser&&S.currentUser.nombre)||'Admin',
    referencia:iniRef,
    estado:'confirmado',
    tipoOperacion:'inicial_credito',
    esInicial:true,
    realizadoPor:(S.currentUser&&S.currentUser.nombre)||'Admin',
    tasaBs:window._tasaBsGlobal||1,
    concesionarioId: newCred.concesionarioId || _concDefaultId()
  };
  S.pagos.push(pagoIni);
  DB.savePago(pagoIni);

  // Movimiento de inicial
  var movIni = {
    id:'MOV-'+Date.now(),
    tipo:'deposito',
    tipoOperacion:'inicial_credito',
    conceptoPago:pagoIniId,
    creditoId:credId,
    conceptoCredito:credId,
    concepto:'Inicial · '+newCred.cli+' · '+credId+' ('+newCred.modelo+')',
    monto:r.ini,
    cuentaDestino:iniMetodo,
    fecha:newCred.fecha,
    referencia:iniRef,
    realizadoPor:(S.currentUser&&S.currentUser.nombre)||'Admin',
    hora:new Date().toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit',hour12:false})
  };
  S.movimientos.push(movIni);
  DB.saveMovimiento(movIni);

  _wzClose();
  nav('creditos');
  toast(' Solicitud creada · '+credId+' · Inicial '+fmt(r.ini)+' → '+iniMetodo,'success');
  }); // end nextCredIdAsync
  }); // end nextClienteIdAsync
}

// ══════════════════════════════════════════
// CRÉDITO MODAL (original — se mantiene para edición)
// ══════════════════════════════════════════
function cancelarCred(credId){
  if(!requireDeletePermission()) return;
  var c = S.creds.find(function(x){return x.id===credId;}); if(!c) return;
  window._cancelCredId = credId;
  window._cancelCredModo = 'mantener';
  setMicon('eliminar'); $('mtt').textContent='Eliminar Crédito'; $('msb').textContent='El registro quedará auditado';
  $('modal-box').className='modal';
  $('mbd').innerHTML = '<div style="text-align:left;padding:10px 0">'
    +'<div style="text-align:center;font-size:42px;margin-bottom:10px">FIN</div>'
    +'<div style="text-align:center;font-size:15px;font-weight:800">¿Cómo quieres eliminar el crédito '+c.id+'?</div>'
    +'<div style="text-align:center;color:var(--ink3);font-size:13px;margin-top:6px">'+c.cli+' · '+c.modelo+' · '+fmt(getCreditoPagosConfirmados(c))+' cobrados</div>'
    +'<div style="margin-top:14px;display:grid;gap:10px">'
    +'<label style="display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid var(--line);border-radius:10px;cursor:pointer">'
    +'<input type="radio" name="del_cred_modo" value="mantener" checked onchange="window._cancelCredModo=this.value">'
    +'<div><div style="font-weight:800">Eliminar pero seguir contando pagos y cuentas</div>'
    +'<div style="font-size:12px;color:var(--ink3);margin-top:4px">El crédito pasa a cancelado y la moto vuelve al inventario, pero los pagos y movimientos en Cuentas permanecen para trazabilidad operativa.</div></div></label>'
    +'<label style="display:flex;gap:10px;align-items:flex-start;padding:10px;border:1px solid var(--line);border-radius:10px;cursor:pointer">'
    +'<input type="radio" name="del_cred_modo" value="completo" onchange="window._cancelCredModo=this.value">'
    +'<div><div style="font-weight:800">Eliminar por completo</div>'
    +'<div style="font-size:12px;color:var(--ink3);margin-top:4px">Además de cancelar el crédito, los pagos ligados a este crédito y sus movimientos en Cuentas también se marcan como eliminados. El registro queda auditado.</div></div></label>'
    +'</div>'
    +'<div style="margin-top:10px;padding:9px;background:var(--ambers);border-radius:8px;font-size:12px;color:var(--ink)">'
    +' En ambos casos el crédito no se borra de la base: queda con trazabilidad de quién lo eliminó, cuándo y por qué.</div></div>';
  $('mft').innerHTML='<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    +'<button class="btn btn-d" onclick="auditarYEliminarCred()">Confirmar eliminación</button>';
  $('ov').style.display='flex';
}

function auditarYEliminarCred(){
  if(!requireDeletePermission()) return;
  var credId = window._cancelCredId;
  var c = S.creds.find(function(x){return x.id===credId;}); if(!c) return;
  closeM();
  confirmarEliminacion({
    titulo:'Eliminar Crédito',
    descripcion:'Crédito '+c.id+' · '+c.cli+' · '+c.modelo,
    onConfirm:function(audit){
      ejecutarDelCred(audit);
    }
  });
}

function marcarPagosYCuentasCreditoEliminados(credId, motivo){
  var ahora = new Date().toISOString();
  var actor = (S.currentUser&&S.currentUser.nombre)||'Admin';
  (S.pagos||[]).forEach(function(p){
    if(!p || p.eliminado || p.cred!==credId) return;
    p.eliminado = true;
    p.eliminadoModo = 'completo';
    p.mantenerEnAmortizacion = false;
    p.eliminadoPor = actor;
    p.eliminadoPorUid = (S.currentUser&&S.currentUser.uid)||'';
    p.eliminadoEn = ahora;
    if(motivo) p.eliminadoRazon = motivo;
    DB.savePago(p);
  });
  (S.movimientos||[]).forEach(function(m){
    if(!m || m.eliminado) return;
    var mismoCredito = m.creditoId===credId || m.conceptoCredito===credId || m.cred===credId || (m.concepto&&m.concepto.indexOf(credId)>=0);
    if(!mismoCredito) return;
    m.eliminado = true;
    m.eliminadoPor = actor;
    m.eliminadoEn = ahora;
    if(motivo) m.eliminadoRazon = motivo;
    DB.saveMovimiento(m);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// RESTAURAR CRÉDITO ARCHIVADO
// Revierte cancelación: el crédito vuelve a 'activo' o 'completado' según
// corresponda, la moto regresa a 'financiada', y si se eliminaron en modo
// completo los pagos/movimientos ligados se restauran también.
// ═══════════════════════════════════════════════════════════════════════
function restaurarCred(credId){
  if(!requireDeletePermission()) return;
  var c = S.creds.find(function(x){return x.id===credId;});
  if(!c){ toast('Crédito no encontrado','error'); return; }
  if(c.estado!=='cancelado' && c.estado!=='recuperado' && c.estado!=='recuperada'){
    toast('Este crédito no está archivado','info'); return;
  }
  var modoOriginal = c.eliminadoModo || 'mantener';
  var pagosEliminadosLigados = (S.pagos||[]).filter(function(p){
    return p && p.eliminado && p.cred===credId && p.eliminadoModo==='completo';
  });

  setMicon('restaurar'); $('mtt').textContent='Restaurar Crédito'; $('msb').textContent=c.id+' · '+c.cli;
  $('modal-box').className='modal';
  $('mbd').innerHTML = '<div style="text-align:center;padding:12px 0">'
    +'<div style="font-size:42px;margin-bottom:10px;color:var(--p1)"></div>'
    +'<div style="font-size:15px;font-weight:800;margin-bottom:6px">¿Restaurar el crédito '+c.id+'?</div>'
    +'<div style="color:var(--ink3);font-size:13px;margin-bottom:14px">'+c.cli+' · '+c.modelo+'</div>'
    +'<div style="background:var(--gs);border:1px solid var(--rim2);border-radius:10px;padding:12px;text-align:left;font-size:12.5px;color:var(--ink2);line-height:1.55">'
    +'Al restaurar:<br>'
    +'• El crédito vuelve a estado <strong>activo</strong> (o <strong>completado</strong> si ya tenía todas las cuotas pagadas).<br>'
    +'• La moto asociada regresa a <strong>financiada</strong>.<br>'
    + (pagosEliminadosLigados.length>0
       ? '• Se restaurarán <strong>'+pagosEliminadosLigados.length+' pago(s)</strong> y sus movimientos en Cuentas que se habían eliminado con el crédito.<br>'
       : '')
    +'• Se guarda auditoría de quién lo restauró y cuándo.'
    +'</div></div>';
  $('mft').innerHTML = '<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    +'<button class="btn btn-p" onclick="ejecutarRestaurarCred(\''+credId+'\')">Confirmar restauración</button>';
  $('ov').style.display='flex';
}

function ejecutarRestaurarCred(credId){
  var c = S.creds.find(function(x){return x.id===credId;});
  if(!c){ closeM(); toast('Crédito no encontrado','error'); return; }
  var ahora = new Date().toISOString();
  var actor = (S.currentUser&&S.currentUser.nombre)||'Admin';

  // 1) Determinar estado nuevo: si todas las cuotas estaban pagadas → completado, sino → activo
  var totalCuotas = getCreditoTotalCuotas(c);
  var pagadas = parseInt(c.pagado,10)||0;
  var nuevoEstado = (pagadas>=totalCuotas && totalCuotas>0) ? 'completado' : 'activo';

  // 2) Restaurar el crédito
  c.estado = nuevoEstado;
  c.eliminado = false;
  c.restauradoPor = actor;
  c.restauradoPorUid = (S.currentUser&&S.currentUser.uid)||'';
  c.restauradoEn = ahora;
  // Conservamos el historial de cancelación como auditoría, no lo borramos
  DB.updateCred(credId, {
    estado: nuevoEstado,
    eliminado: false,
    restauradoPor: c.restauradoPor,
    restauradoPorUid: c.restauradoPorUid,
    restauradoEn: c.restauradoEn
  });

  // 3) Restaurar la moto → financiada (si existe y estaba recuperada)
  if(c.motoId){
    var mi = S.motos.findIndex(function(x){return String(x.id)===String(c.motoId);});
    if(mi>=0){
      S.motos[mi].estado = 'financiada';
      S.motos[mi].cliente = c.cli;
      S.motos[mi].creditoId = c.id;
      DB.saveMoto(S.motos[mi]);
    }
  }

  // 4) Si se eliminaron en modo completo, restaurar pagos y movimientos ligados
  var pagosRest = 0, movsRest = 0;
  (S.pagos||[]).forEach(function(p){
    if(!p || !p.eliminado || p.cred!==credId) return;
    if(p.eliminadoModo!=='completo') return;
    p.eliminado = false;
    p.restauradoPor = actor;
    p.restauradoEn = ahora;
    delete p.eliminadoModo;
    DB.savePago(p);
    pagosRest++;
  });
  (S.movimientos||[]).forEach(function(m){
    if(!m || !m.eliminado) return;
    var mismoCredito = m.creditoId===credId || m.conceptoCredito===credId || m.cred===credId || (m.concepto&&m.concepto.indexOf(credId)>=0);
    if(!mismoCredito) return;
    m.eliminado = false;
    m.restauradoPor = actor;
    m.restauradoEn = ahora;
    DB.saveMovimiento(m);
    movsRest++;
  });

  syncTodosEstadosClientes();
  closeM();
  nav('creditos');
  var detalle = pagosRest>0 ? ' ('+pagosRest+' pago(s) y '+movsRest+' movimiento(s) restaurados)' : '';
  toast('✓ Crédito '+credId+' restaurado a '+nuevoEstado+detalle,'success');
}

function ejecutarDelCred(audit){
  var credId = window._cancelCredId; if(!credId) return;
  var modo = (window._cancelCredModo==='completo') ? 'completo' : 'mantener';
  var ci = S.creds.findIndex(function(x){return x.id===credId;});
  if(ci>=0){
    if(typeof logActividad==='function') logActividad('credito_eliminado','creditos',credId,{cliente:S.creds[ci].cli, modo:modo, razon:(audit&&audit.eliminadoRazon)||''});
    S.creds[ci].estado='cancelado';
    S.creds[ci].canceladoPor = (S.currentUser&&S.currentUser.nombre)||'Admin';
    S.creds[ci].canceladoEn = new Date().toISOString();
    S.creds[ci].canceladoRazon= (audit&&audit.eliminadoRazon)||'Sin especificar';
    S.creds[ci].canceladoNotas= '';
    S.creds[ci].eliminadoModo = modo;
    if(audit) Object.assign(S.creds[ci], audit);
    // El financiamiento debe seguir visible como cancelado en la tabla.
    // Aunque se audite la eliminación y se borren pagos/cuentas en modo completo,
    // el crédito NO debe marcarse como eliminado lógico para no desaparecer del listado.
    S.creds[ci].eliminado = false;
    DB.updateCred(credId,{
      estado:'cancelado',
      canceladoPor:S.creds[ci].canceladoPor,
      canceladoEn:S.creds[ci].canceladoEn,
      canceladoRazon:S.creds[ci].canceladoRazon,
      canceladoNotas:S.creds[ci].canceladoNotas,
      eliminado: false,
      eliminadoPor: audit&&audit.eliminadoPor,
      eliminadoPorUid: audit&&audit.eliminadoPorUid,
      eliminadoEn: audit&&audit.eliminadoEn,
      eliminadoRazon: audit&&audit.eliminadoRazon,
      eliminadoModo: modo
    });

    if(modo==='completo'){
      marcarPagosYCuentasCreditoEliminados(credId, 'Financiamiento eliminado por completo: '+S.creds[ci].canceladoRazon);
    }

    var mi = S.motos.findIndex(function(x){return String(x.id)===String(S.creds[ci].motoId);});
    if(mi>=0 && (S.motos[mi].estado==='financiada' || S.motos[mi].estado==='recuperada')){
      S.motos[mi].estado='recuperada';
      S.motos[mi].cliente=null;
      S.motos[mi].creditoId=null;
      DB.saveMoto(S.motos[mi]);
    }
  }
  syncTodosEstadosClientes();
  window._cancelCredId = null;
  window._cancelCredModo = null;
  closeM(); nav('creditos');
  toast(modo==='completo' ? 'Crédito eliminado por completo: pagos y cuentas también fueron eliminados' : 'Crédito cancelado: pagos y cuentas se conservaron','info');
}

function openEditCred(credId){
  var c = S.creds.find(function(x){return x.id===credId;}); if(!c) return;
  setMicon('editar'); $('mtt').textContent='Editar Crédito'; $('msb').textContent=c.id+' · '+c.cli;
  $('modal-box').className='modal';
  $('mbd').innerHTML = '<div class="fgr c1" style="gap:9px">'
    // Info only (read-only)
    +'<div style="background:var(--surf2);border:1px solid var(--rim);border-radius:9px;padding:11px;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">'
    +'<div><span style="color:var(--ink3)">Cliente</span><div style="font-weight:700">'+c.cli+'</div></div>'
    +'<div><span style="color:var(--ink3)">Moto</span><div style="font-weight:700">'+c.modelo+'</div></div>'
    +'<div><span style="color:var(--ink3)">Cuota quincenal</span><div style="font-weight:800;color:var(--p1)">'+fmt(c.cuotaQ||c.cuota)+'</div></div>'
    +'<div><span style="color:var(--ink3)">Avance</span><div style="font-weight:700">'+(c.pagado||0)+'/'+(c.totalCuotas||c.plazo*2)+' cuotas</div></div>'
    +'</div>'
    // Editable fields
    +'<div class="fgr" style="gap:8px">'
    +'<div class="fg"><label>Estado</label><select class="fs" id="ec_estado">'
    +['activo','mora','completado','recuperado','cancelado'].map(function(s){return '<option value="'+s+'" '+(c.estado===s?'selected':'')+'>'+s.charAt(0).toUpperCase()+s.slice(1)+'</option>';}).join('')
    +'</select></div>'
    +'<div class="fg"><label>Cobrador asignado</label><select class="fs" id="ec_cobrador">'
    +getCobradoresList().map(function(u){return '<option '+(c.cobrador===u?'selected':'')+'>'+u+'</option>';}).join('')
    +'</select></div>'
    +'</div>'
    +'<div class="fgr" style="gap:8px">'
    +'<div class="fg"><label>Fecha de inicio</label><input class="fi" id="ec_fecha" type="date" value="'+(c.fecha||'')+'"></div>'
    +'<div class="fg"><label>GPS instalado</label><select class="fs" id="ec_gps"><option value="si" '+(c.gps?'selected':'')+'>Sí</option><option value="no" '+(!c.gps?'selected':'')+'>No</option></select></div>'
    +'</div>'
    +'<div class="fg"><label>Notas del crédito</label><textarea class="fta" id="ec_notas" rows="3">'+(c.notas||'')+'</textarea></div>'
    +'</div>';
  S.saveFn = function(){
    var upd = {
      estado: ($('ec_estado')&&$('ec_estado').value)||c.estado,
      cobrador: ($('ec_cobrador')&&$('ec_cobrador').value)||c.cobrador,
      fecha: ($('ec_fecha')&&$('ec_fecha').value)||c.fecha,
      gps: ($('ec_gps')&&$('ec_gps').value)==='si',
      notas: ($('ec_notas')&&$('ec_notas').value)||''
    };
    var ci = S.creds.findIndex(function(x){return x.id===credId;});
    if(ci>=0){ Object.assign(S.creds[ci], upd); DB.updateCred(credId, upd); }
    closeM(); nav('creditos'); toast('Crédito actualizado','success'); return true;
  };
  $('mft').innerHTML='<button class="btn btn-g" onclick="closeM()">Cancelar</button>'
    +'<button class="btn btn-p" onclick="saveM()">Guardar cambios</button>';
  $('ov').style.display='flex';
}

function openAddCredConMoto(motoId){openAddCred(motoId);}
// ══════════════════════════════════════════════════════════════════
// CONFIRMAR CONTRATO FIRMADO
// ══════════════════════════════════════════════════════════════════
function confirmarContratoFirmado(credId){
  var c = (S.creds||[]).find(function(x){ return x.id===credId; });
  if(!c){ toast('Crédito no encontrado','error'); return; }

  // Validar campos obligatorios antes de confirmar
  var errores = [];
  if(!(c.cli||'').trim()) errores.push('Nombre del cliente');
  if(!(c.vin||'').trim()) errores.push('VIN / Serial de chasis');
  if(!c.precio || parseFloat(c.precio)<=0) errores.push('Precio de la moto');
  if(!c.cuotaQ || parseFloat(c.cuotaQ)<=0) errores.push('Cuota quincenal');
  if(!c.plazo || parseInt(c.plazo)<=0) errores.push('Plazo');
  if(!c.ini && c.ini!==0) errores.push('Inicial');

  if(errores.length>0){
    // Buscar cliente para cédula y teléfono
    var cli = (S.clientes||[]).find(function(x){ return String(x.id)===String(c.clienteId||c.cliId); });
    if(cli){
      if(!(cli.cedula||cli.ci||'').trim()) errores.push('Cédula del cliente');
      if(!(cli.tel||'').trim()) errores.push('Teléfono del cliente');
    }
  }

  if(errores.length>0){
    var msg = 'Faltan los siguientes campos obligatorios para confirmar el contrato:\n\n\u2022 ' + errores.join('\n\u2022 ');
    alert(msg);
    return;
  }

  if(!confirm('¿Confirmar que el contrato de ' + (c.cli||credId) + ' fue firmado?\n\nA partir de este momento el crédito contará contablemente.')) return;

  var ci = S.creds.findIndex(function(x){ return x.id===credId; });
  if(ci<0) return;
  S.creds[ci].contratoFirmado = true;
  S.creds[ci].fechaContratoFirmado = hoyLocalISO();
  DB.updateCred(credId, { contratoFirmado: true, fechaContratoFirmado: S.creds[ci].fechaContratoFirmado });
  toast('Contrato confirmado. El crédito está activo contablemente.','success');
  nav('creditos');
}

// ══════════════════════════════════════════════════════════════════
// EDITAR CRÉDITO SIN FIRMA — abre el wizard con datos precargados
// ══════════════════════════════════════════════════════════════════
function editarCredSinFirma(credId){
  var c = (S.creds||[]).find(function(x){ return x.id===credId; });
  if(!c){ toast('Crédito no encontrado','error'); return; }

  // Buscar cliente asociado
  var cli = (S.clientes||[]).find(function(x){ return String(x.id)===String(c.clienteId||c.cliId); });

  // Construir preload con los nombres que _wzFg espera (WZ['wz_nom'] etc.)
  // Los creditos sin firma guardan una foto completa del wizard para restaurar campos no mapeados.
  var _draftPreload = (c && (c.wizardDraft || c.wizardData)) || {};
  var preload = Object.assign({}, _draftPreload, { step:1 });
  if(_draftPreload._wzCustomPct!==undefined && _draftPreload._wzCustomPct!==null){
    window._wzCustomPct = _draftPreload._wzCustomPct;
  }

  // Datos del cliente — usar claves wz_XXX que son las que lee _wzFg
  var nomVal  = (cli&&cli.nombre) || c.cli || '';
  var ciVal   = (cli&&(cli.cedula||cli.ci)) || '';
  var telVal  = (cli&&cli.tel) || '';
  var waVal   = (cli&&cli.wa)  || '';
  var emailVal= (cli&&cli.email)|| '';
  var ciudadVal=(cli&&cli.ciudad)||'';
  var empVal  = (cli&&cli.emp) || c.emp_tipo || '';
  var ingVal  = parseFloat((cli&&cli.ing)||0);
  var antVal  = (cli&&cli.ant) || '';

  // _wzFg lee WZ['wz_nom'], WZ['wz_ci'], etc.
  preload['wz_nom']    = nomVal;
  preload['wz_ci']     = ciVal;
  preload['wz_tel']    = telVal;
  preload['wz_wa']     = waVal;
  preload['wz_email']  = emailVal;
  preload['wz_ciudad'] = ciudadVal;
  preload['wz_emp']    = empVal;
  preload['wz_ing']    = ingVal;
  preload['wz_ant']    = antVal;
  // También los alias sin prefijo (usados por _wzValidar y _wzGuardar)
  preload.nom  = nomVal;  preload.ci  = ciVal;   preload.tel = telVal;
  preload.wa   = waVal;   preload.email= emailVal;preload.ciudad=ciudadVal;
  preload.emp  = empVal;  preload.ing = ingVal;   preload.ant = antVal;
  if(cli) preload.clienteSel = cli.id;

  // Datos de la moto — _wzFg lee WZ['wz_vin'] etc.
  preload['wz_vin']          = c.vin||'';
  preload['wz_color']        = c.color||'';
  preload['wz_marca']        = c.marca||'';
  preload['wz_anio']         = c.anio||'';
  preload['wz_placa']        = c.placa||'';
  preload['wz_serial_motor'] = c.serialMotor||'';
  preload['wz_serial_chasis']= c.serialChasis||'';
  preload['wz_gps_num']      = c.gpsNum||'';
  preload['wz_obs']          = c.notas||'';
  preload['wz_uso']          = c.uso_moto||'';
  // alias sin prefijo
  preload.vin         = c.vin||'';
  preload.color       = c.color||'';
  preload.marca       = c.marca||'';
  preload.anio        = c.anio||'';
  preload.placa       = c.placa||'';
  preload.serialMotor = c.serialMotor||'';
  preload.serialChasis= c.serialChasis||'';
  preload.gpsNum      = c.gpsNum||'';
  preload.obs         = c.notas||'';
  preload.uso         = c.uso_moto||'';
  preload.conocio     = c.conocio||'';
  preload['wz_conocio']= c.conocio||'';

  // Plan / precio
  preload.motoModelo    = c.modelo||'';
  preload.motoInvId     = c.motoId||null;
  preload.precio        = parseFloat(c.precio||0);
  preload['wz_precio']  = preload.precio;
  preload.plazo         = c.plazo||0;
  preload.cuota         = c.cuotaQ||0;
  preload.ini           = parseFloat(c.ini||0);
  preload.precioBaseReal= parseFloat(c.precioBaseReal||c.precio||0);
  preload.planMode       = c.planModo||preload.planMode||'global';
  preload['wz_plan_mode']= c.planModo||preload['wz_plan_mode']||preload.planMode||'global';
  preload.apy            = c.plan ? (c.plan.apy||0) : 0;
  preload.factor         = c.factor||0;
  preload.tasaMensual    = c.tasaMensual||0;
  preload.inicialPct     = c.inicialPct||0;
  // Precio base real
  preload['wz_precio_base_real'] = parseFloat(c.precioBaseReal||c.precio||0)||0;
  // Plan personalizado
  preload['wz_ini_real']        = parseFloat(c.ini||0)||0;
  preload['wz_cuota_q_custom']  = parseFloat(c.cuotaQ||c.cuota||0)||0;
  preload['wz_plazo_custom']    = parseInt(c.plazo||0)||0;
  // Plan APY
  preload['wz_apy_objetivo']    = c.plan ? (c.plan.apy||0) : 0;
  preload['wz_apy_plazo']       = parseInt(c.plazo||0)||0;
  preload['wz_apy_inicial_sel'] = c.plan ? String(c.plan.inicial||'0.50') : '0.50';
  // Selector moto inventario
  preload['wz_moto_inv']        = c.motoId ? String(c.motoId) : '';
  // Cliente sel
  preload['wz_cliente_sel']     = c.clienteId ? String(c.clienteId) : '';

  // ── Paso 2: con fallback al objeto cliente para créditos anteriores ──
  // Helper: busca primero en el crédito, luego en el cliente
  var _f = function(credKey, cliKey, def){
    var v = c[credKey];
    if(v!==undefined && v!==null && v!=='') return v;
    v = cli && cli[cliKey];
    if(v!==undefined && v!==null && v!=='') return v;
    return (def!==undefined ? def : '');
  };

  // Residencia
  preload['wz_viv'] = _f('viv','vivienda',''); preload.viv = preload['wz_viv'];
  preload['wz_tdir'] = _f('tdir','tiempo_dir',''); preload.tdir = preload['wz_tdir'];
  preload['wz_estado'] = _f('estado_ubi','estado_ubi',''); preload.estado_ubi = preload['wz_estado'];
  preload['wz_ciudad_res'] = _f('ciudad_res','ciudad',''); preload.ciudad_res = preload['wz_ciudad_res'];
  preload['wz_dir_det'] = _f('dir_det','dir',''); preload.dir_det = preload['wz_dir_det'];
  preload['wz_dir_q'] = _f('dir_q','dir_q',''); preload.dir_q = preload['wz_dir_q'];
  // Empleo
  preload['wz_empresa'] = _f('empresa','empresa',''); preload.empresa = preload['wz_empresa'];
  preload['wz_cargo'] = _f('cargo','cargo',''); preload.cargo = preload['wz_cargo'];
  preload['wz_ing'] = parseFloat(_f('ing','ingreso',0))||0; preload.ing = preload['wz_ing'];
  preload['wz_ifam'] = parseFloat(_f('ifam','ingreso_familiar',0))||0; preload.ifam = preload['wz_ifam'];
  preload['wz_ant'] = _f('ant','antiguedad',''); preload.ant = preload['wz_ant'];
  preload['wz_rem'] = _f('rem','remesas','no'); preload.rem = preload['wz_rem'];
  preload['wz_dep'] = parseInt(_f('dep','dependientes',0))||0; preload.dep = preload['wz_dep'];
  preload['wz_emp'] = c.emp_tipo || (cli&&(cli.trabajo||cli.emp)) || ''; preload.emp = preload['wz_emp'];
  // Historial
  preload['wz_banco'] = _f('banco','banco_estado','activa'); preload.banco = preload['wz_banco'];
  preload['wz_banco_nm'] = _f('banco_nm','banco_nombre',''); preload.banco_nm = preload['wz_banco_nm'];
  preload['wz_banco_cobro'] = _f('banco_cobro','banco_cobro',''); preload.banco_cobro = preload['wz_banco_cobro'];
  preload['wz_cuenta'] = _f('cuenta','cuenta_digitos',''); preload.cuenta = preload['wz_cuenta'];
  preload['wz_ahorro'] = _f('ahorro','ahorro','no'); preload.ahorro = preload['wz_ahorro'];
  preload['wz_hist'] = _f('hist','historial','ninguno'); preload.hist = preload['wz_hist'];
  preload['wz_deuda'] = _f('deuda','deudas','no'); preload.deuda = preload['wz_deuda'];
  // Cashea
  preload['wz_cashea'] = _f('cashea','cashea','no'); preload.cashea = preload['wz_cashea'];
  preload['wz_cashea_nivel'] = _f('cashea_nivel','cashea_nivel',''); preload.cashea_nivel = preload['wz_cashea_nivel'];
  preload['wz_cashea_pago'] = _f('cashea_pago','cashea_pago',''); preload.cashea_pago = preload['wz_cashea_pago'];
  preload['wz_cashea_estado'] = _f('cashea_estado','cashea_estado',''); preload.cashea_estado = preload['wz_cashea_estado'];
  preload['wz_cashea_deuda'] = _f('cashea_deuda','cashea_deuda','no'); preload.cashea_deuda = preload['wz_cashea_deuda'];
  preload['wz_cashea_monto'] = _f('cashea_monto','cashea_monto',0); preload.cashea_monto = preload['wz_cashea_monto'];
  preload['wz_cashea_cuotas_pend'] = _f('cashea_cuotas_pend','cashea_cuotas_pend',0); preload.cashea_cuotas_pend = preload['wz_cashea_cuotas_pend'];
  preload['wz_cashea_ultimo_art'] = _f('cashea_ultimo_art','cashea_ultimo_art',''); preload.cashea_ultimo_art = preload['wz_cashea_ultimo_art'];
  preload['wz_cashea_ultimo_monto'] = _f('cashea_ultimo_monto','cashea_ultimo_monto',0); preload.cashea_ultimo_monto = preload['wz_cashea_ultimo_monto'];
  preload['wz_cashea_ultima_fecha'] = _f('cashea_ultima_fecha','cashea_ultima_fecha',''); preload.cashea_ultima_fecha = preload['wz_cashea_ultima_fecha'];
  preload['wz_cashea_total_compras'] = _f('cashea_total_compras','cashea_total_compras',''); preload.cashea_total_compras = preload['wz_cashea_total_compras'];
  preload['wz_cashea_obs'] = _f('cashea_obs','cashea_obs',''); preload.cashea_obs = preload['wz_cashea_obs'];
  // Fiador
  preload.fiador_tiene = _f('fiador_tiene','fiador','no');
  preload['wz_fiador_nom'] = _f('fiador_nom','fiador_nom',''); preload.fiador_nom = preload['wz_fiador_nom'];
  preload['wz_fiador_tel'] = _f('fiador_tel','fiador_tel',''); preload.fiador_tel = preload['wz_fiador_tel'];
  preload['wz_fiador_ci'] = _f('fiador_ci','fiador_ci',''); preload.fiador_ci = preload['wz_fiador_ci'];
  preload['wz_fiador_rel'] = _f('fiador_rel','fiador_rel',''); preload.fiador_rel = preload['wz_fiador_rel'];
  preload['wz_fiador_rif'] = _f('fiador_rif','fiador_rif',''); preload.fiador_rif = preload['wz_fiador_rif'];
  preload['wz_fiador_dir'] = _f('fiador_dir','fiador_dir',''); preload.fiador_dir = preload['wz_fiador_dir'];
  preload['wz_fiador_email'] = _f('fiador_email','fiador_email',''); preload.fiador_email = preload['wz_fiador_email'];
  // Referencias
  var _ref1 = cli&&cli.ref1 || {};
  var _ref2 = cli&&cli.ref2 || {};
  preload['wz_r1n'] = c.r1n||_ref1.nom||''; preload.r1n = preload['wz_r1n'];
  preload['wz_r1ci'] = c.r1ci||_ref1.ci||''; preload.r1ci = preload['wz_r1ci'];
  preload['wz_r1t'] = c.r1t||_ref1.tel||''; preload.r1t = preload['wz_r1t'];
  preload['wz_r1r'] = c.r1r||_ref1.rel||''; preload.r1r = preload['wz_r1r'];
  preload['wz_r1obs'] = c.r1obs||_ref1.obs||''; preload.r1obs = preload['wz_r1obs'];
  preload['wz_r2n'] = c.r2n||_ref2.nom||''; preload.r2n = preload['wz_r2n'];
  preload['wz_r2ci'] = c.r2ci||_ref2.ci||''; preload.r2ci = preload['wz_r2ci'];
  preload['wz_r2t'] = c.r2t||_ref2.tel||''; preload.r2t = preload['wz_r2t'];
  preload['wz_r2r'] = c.r2r||_ref2.rel||''; preload.r2r = preload['wz_r2r'];
  preload['wz_r2obs'] = c.r2obs||_ref2.obs||''; preload.r2obs = preload['wz_r2obs'];
  // Documentos — buscar en crédito, luego en cliente
  var _docs = (Array.isArray(c.documentos)&&c.documentos.length) ? c.documentos
              : (cli&&Array.isArray(cli.documentos)&&cli.documentos.length) ? cli.documentos : [];
  preload.documentos = _docs.slice(); preload.docsCount = _docs.length;
  // Notas e impresion
  preload.impresion = c.impresion||(cli&&cli.impresion)||''; preload['wz_impresion_g'] = preload.impresion;
  preload['wz_obs'] = c.notas||(cli&&cli.notas)||''; preload.obs = preload['wz_obs'];
  preload['wz_conocio'] = c.conocio||(cli&&cli.conocio)||''; preload.conocio = preload['wz_conocio'];
  preload['wz_score'] = c.score||0; preload.score = preload['wz_score'];
  preload['wz_concesionarioId'] = c.concesionarioId||''; preload.concesionarioId = preload['wz_concesionarioId'];
  preload['wz_f1'] = c.f1||''; preload.f1 = preload['wz_f1'];
  preload['wz_f2'] = c.f2||''; preload.f2 = preload['wz_f2'];
  preload['wz_f3'] = c.f3||''; preload.f3 = preload['wz_f3'];
  preload['wz_f4'] = c.f4||''; preload.f4 = preload['wz_f4'];
  preload['wz_f5'] = c.f5||''; preload.f5 = preload['wz_f5'];

  Object.keys(_draftPreload||{}).forEach(function(k){
    var v = _draftPreload[k];
    if(v===undefined || v===null || v==='') return;
    if(preload[k]===undefined || preload[k]===null || preload[k]==='') preload[k] = v;
  });
  preload.step = 1;

  // Guardar flag y preload ANTES de openAddCred (que resetea WZ)
  window._wzEditando = credId;
  window._wzPreload  = preload;

  // openAddCred resetea WZ, luego restaura _wzPreload antes de _wzRender
  openAddCred(c.motoId||null);
}
