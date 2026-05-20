// Pagasi module: config
PG.config = function(){
  setTimeout(function(){
    if(!db) return;
    db.collection('config').doc('empresa').get().then(function(doc){
      if(!doc.exists) return;
      var d=doc.data();
      if($('cfg_empresa'))$('cfg_empresa').value=d.nombre||'';
      if($('cfg_rif')) $('cfg_rif').value=d.rif||'';
      if($('cfg_ciudad')) $('cfg_ciudad').value=d.ciudad||'';
      if($('cfg_tel')) $('cfg_tel').value=d.tel||'';
      if($('cfg_email2')) $('cfg_email2').value=d.email||'';
      if($('cfg_direccion')) $('cfg_direccion').value=d.direccion||'';
      if($('cfg_representante'))$('cfg_representante').value=d.representante||'';
      if($('cfg_rep_ci')) $('cfg_rep_ci').value=d.repCI||'';
    });
    db.collection('config').doc('plan').get().then(function(doc){
      if(!doc.exists) return;
      var d=doc.data();
      if(Object.prototype.hasOwnProperty.call(d,'factor')){PLAN.factor=d.factor;if($('cfg_factor'))$('cfg_factor').value=d.factor;}
      if(Object.prototype.hasOwnProperty.call(d,'inicial')){PLAN.inicial=d.inicial;if($('cfg_ini'))$('cfg_ini').value=(d.inicial*100);}
      if(Object.prototype.hasOwnProperty.call(d,'tasaMensual')){PLAN.tasaMensual=d.tasaMensual;if($('cfg_tasa_mensual'))$('cfg_tasa_mensual').value=d.tasaMensual;}
      if(Object.prototype.hasOwnProperty.call(d,'plazo')){PLAN.plazo=d.plazo;if($('cfg_plazo'))$('cfg_plazo').value=d.plazo;}
      if(Object.prototype.hasOwnProperty.call(d,'apy')){PLAN.apy=d.apy;}
      var graciaCfg=Object.prototype.hasOwnProperty.call(d,'diasGracia')?d.diasGracia:d.gracia;
      if(typeof graciaCfg!=='undefined'&&graciaCfg!==null){PLAN.diasGracia=graciaCfg;if($('cfg_gracia'))$('cfg_gracia').value=graciaCfg;}
      var moraCfg=Object.prototype.hasOwnProperty.call(d,'moraPct')?d.moraPct:d.mora_pct;
      if(typeof moraCfg!=='undefined'&&moraCfg!==null){PLAN.moraPct=moraCfg;if($('cfg_mora'))$('cfg_mora').value=moraCfg;}
    });
    db.collection('config').doc('tasa').get().then(function(doc){
      if(doc.exists&&doc.data().tasaBs){window._tasaBsGlobal=doc.data().tasaBs;if($('cfg_tasa_bs'))$('cfg_tasa_bs').value=doc.data().tasaBs;}
    });
    db.collection('config').doc('cuentasBanc').get().then(function(doc){
      renderCuentasBanc(doc.exists&&doc.data().lista?doc.data().lista:[]);
    }).catch(function(){renderCuentasBanc([]);});
    db.collection('config').doc('cobradores').get().then(function(doc){
      renderCobradores(doc.exists?doc.data().lista:['Juan Admin']);
    });
  },80);

  var cfgTab = window._cfgTab || 'empresa';

  return`<div class="page">

  ${pageBanner(
    'Sistema · Configuración general',
    'Configuración',
    'Empresa, plan financiero, cuentas, cobradores y sistema',
    [{label:'↻ Sincronizar', onclick:'recargarDesdeFirebase()'}]
  )}

  <!-- Estado Firebase — stat compacto -->
  <div class="sg" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
    <div class="stat" style="border-top:3px solid ${db?'var(--green)':'var(--red)'}">
      <div class="st-v" style="color:${db?'var(--green)':'var(--red)'};font-size:20px">${db?'✓ Online':'✕ Local'}</div>
      <div class="st-l">Firebase</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:2px">${db?'Datos en la nube':'Sin sincronización'}</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--p1)">
      <div class="st-v" style="font-size:20px;color:var(--p1)">${PLAN.factor}x</div>
      <div class="st-l">Factor activo</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:2px">Plan ${PLAN.plazo} meses</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--amber)">
      <div class="st-v" style="font-size:20px;color:var(--amber)">${window._tasaBsGlobal||1} Bs</div>
      <div class="st-l">Tasa de cambio</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:2px">por dólar</div>
    </div>
    <div class="stat" style="border-top:3px solid var(--ink3)">
      <div class="st-v" style="font-size:20px">${PLAN.inicial*100}% ini · ${PLAN.moraPct||5}% mora</div>
      <div class="st-l">Parámetros clave</div>
      <div style="font-size:10px;color:var(--ink3);margin-top:2px">${PLAN.diasGracia||5}d de gracia</div>
    </div>
  </div>

  <!-- Tabs de configuración -->
  <div style="display:flex;gap:0;border-bottom:2px solid var(--rim);margin-bottom:16px">
    ${[
      ['empresa','🏢 Empresa'],
      ['financiero','📊 Plan Financiero'],
      ['pagos','💳 Cuentas y Cobros'],
      ['sistema','⚙️ Sistema'],
    ].map(([k,l])=>'<button onclick="window._cfgTab=\''+k+'\';nav(\'config\')" style="background:none;border:none;padding:11px 18px;font-size:13px;font-weight:'+(cfgTab===k?800:600)+';color:'+(cfgTab===k?'var(--p1)':'var(--ink3)')+';border-bottom:'+(cfgTab===k?'3px solid var(--p1)':'3px solid transparent')+';margin-bottom:-2px;cursor:pointer;font-family:var(--f);transition:color .15s">'+l+'</button>').join('')}
  </div>

  <!-- TAB: EMPRESA -->
  <div id="cfg-tab-empresa" style="display:${cfgTab==='empresa'?'block':'none'}">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

      <div class="card">
        <div class="ch"><div><div class="ct">Datos de la Empresa</div><div class="cs">Aparecen en contratos, reportes y documentos</div></div></div>
        <div style="display:flex;flex-direction:column;gap:9px;margin-top:6px">
          <div class="fg"><label>Nombre de la empresa *</label><input class="fi" id="cfg_empresa" placeholder="Pagasi — Financiamiento de Motos"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div class="fg"><label>RIF</label><input class="fi" id="cfg_rif" placeholder="J-00000000-0"></div>
            <div class="fg"><label>Ciudad</label><input class="fi" id="cfg_ciudad" placeholder="Caracas"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div class="fg"><label>Teléfono</label><input class="fi" id="cfg_tel" placeholder="0212-555-0000"></div>
            <div class="fg"><label>Email</label><input class="fi" id="cfg_email2" type="email" placeholder="info@pagasi.com"></div>
          </div>
          <div class="fg"><label>Domicilio fiscal</label><input class="fi" id="cfg_direccion" placeholder="Av. Principal, Edif. X, Piso Y, Caracas"></div>
          <div style="padding-top:8px;border-top:1px solid var(--rim2)">
            <button class="btn btn-p btn-sm" onclick="guardarEmpresa()">Guardar empresa</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="ch"><div><div class="ct">Representante Legal</div><div class="cs">Firma los contratos y documentos legales</div></div></div>
        <div style="display:flex;flex-direction:column;gap:9px;margin-top:6px">
          <div class="fg"><label>Nombre completo *</label><input class="fi" id="cfg_representante" placeholder="Juan Pérez García"></div>
          <div class="fg"><label>Cédula de Identidad</label><input class="fi" id="cfg_rep_ci" placeholder="V-00.000.000"></div>
          <div style="background:var(--gs);border-radius:9px;padding:11px 13px;font-size:11.5px;color:var(--ink2);line-height:1.55">
            <b style="color:var(--p1)">Tip:</b> Estos datos se insertan automáticamente en los contratos de venta en cuotas y documentos notariales.
          </div>
          <div style="padding-top:8px;border-top:1px solid var(--rim2)">
            <button class="btn btn-p btn-sm" onclick="guardarEmpresa()">Guardar representante</button>
          </div>
        </div>
      </div>

    </div>
  </div>

  <!-- TAB: PLAN FINANCIERO -->
  <div id="cfg-tab-financiero" style="display:${cfgTab==='financiero'?'block':'none'}">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

      <div class="card">
        <div class="ch"><div><div class="ct">Plan Financiero Principal</div><div class="cs">Parámetros base del sistema de crédito</div></div></div>
        <!-- Preview actual -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0 14px">
          ${[['Factor',PLAN.factor+'x','var(--p1)'],['Inicial',PLAN.inicial*100+'%','var(--blue)'],['Tasa/mes',PLAN.tasaMensual+'%','var(--amber)'],['Plazo',PLAN.plazo+'m','var(--green)']].map(([l,v,c])=>`
          <div style="background:var(--surf2);border-radius:9px;padding:9px;text-align:center;border:1px solid var(--rim)">
            <div style="font-family:var(--fd);font-weight:900;font-size:18px;color:${c}">${v}</div>
            <div style="font-size:9.5px;color:var(--ink3);font-weight:700;text-transform:uppercase;letter-spacing:.3px;margin-top:2px">${l}</div>
          </div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="fg"><label>Factor de financiamiento (×)</label><input class="fi" id="cfg_factor" type="number" step="0.0001" value="${PLAN.factor}"></div>
          <div class="fg"><label>Inicial mínima (%)</label><input class="fi" id="cfg_ini" type="number" step="0.01" value="${PLAN.inicial*100}"></div>
          <div class="fg"><label>Tasa mensual (%)</label><input class="fi" id="cfg_tasa_mensual" type="number" step="0.01" value="${PLAN.tasaMensual}"></div>
          <div class="fg"><label>Plazo en meses</label><input class="fi" id="cfg_plazo" type="number" min="1" step="1" value="${PLAN.plazo}"></div>
        </div>
        <div style="padding-top:10px;border-top:1px solid var(--rim2);margin-top:4px">
          <button class="btn btn-p btn-sm" onclick="guardarPlan()">Guardar plan financiero</button>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px">

        <div class="card">
          <div class="ch"><div><div class="ct">Mora y Gracia</div><div class="cs">Penalización por atraso</div></div></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
            <div class="fg"><label>Días de gracia</label><input class="fi" id="cfg_gracia" type="number" value="${PLAN.diasGracia||5}"><div style="font-size:10px;color:var(--ink3);margin-top:3px">Días sin penalización tras vencer</div></div>
            <div class="fg"><label>% mora mensual</label><input class="fi" id="cfg_mora" type="number" step="0.1" value="${PLAN.moraPct||5}"><div style="font-size:10px;color:var(--ink3);margin-top:3px">Se aplica tras días de gracia</div></div>
          </div>
          <div style="padding-top:8px;border-top:1px solid var(--rim2);margin-top:4px">
            <button class="btn btn-p btn-sm" onclick="guardarPlan()">Guardar</button>
          </div>
        </div>

        <div class="card">
          <div class="ch"><div><div class="ct">Tasa de Cambio Bs./$</div><div class="cs">Usada en cobros y historial</div></div></div>
          <div style="display:flex;gap:8px;align-items:flex-end;margin-top:6px">
            <div class="fg" style="flex:1"><label>Tasa actual (Bs. por $1)</label><input class="fi" id="cfg_tasa_bs" type="number" step="0.01" min="1" placeholder="Ej: 478.58" value="${window._tasaBsGlobal||1}"></div>
            <button class="btn btn-p btn-sm" style="margin-bottom:1px;flex-shrink:0" onclick="guardarTasaBs()">Guardar</button>
          </div>
          <div style="font-size:11px;color:var(--ink3);margin-top:8px;padding:9px 11px;background:var(--surf2);border-radius:8px">
            Actualiza esta tasa diariamente o cuando el tipo de cambio varíe significativamente para que los reportes en bolívares sean precisos.
          </div>
        </div>

      </div>
    </div>
  </div>

  <!-- TAB: CUENTAS Y COBROS -->
  <div id="cfg-tab-pagos" style="display:${cfgTab==='pagos'?'block':'none'}">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

      <div class="card">
        <div class="ch">
          <div><div class="ct">Cuentas Bancarias</div><div class="cs">Métodos disponibles para cobros y pagos</div></div>
          <button class="btn btn-p btn-sm" onclick="agregarCuentaBanc()">＋ Agregar</button>
        </div>
        <div id="cuentasBanc-list" style="display:flex;flex-direction:column;gap:6px;margin-top:10px">
          <div style="color:var(--ink3);font-size:12px;padding:8px 0">Cargando...</div>
        </div>
      </div>

      <div class="card">
        <div class="ch">
          <div><div class="ct">Cobradores</div><div class="cs">Usuarios asignables a créditos y cobros</div></div>
          <button class="btn btn-p btn-sm" onclick="agregarCobrador()">＋ Agregar</button>
        </div>
        <div id="cobradores-list" style="margin-top:10px">
          <div style="color:var(--ink3);font-size:12px;padding:8px 0">Cargando...</div>
        </div>
      </div>

    </div>
  </div>

  <!-- TAB: SISTEMA -->
  <div id="cfg-tab-sistema" style="display:${cfgTab==='sistema'?'block':'none'}">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
      <!-- Sincronización Firebase -->
      <div class="card" style="border-top:3px solid var(--p1)">
        <div class="ch"><div><div class="ct">Sincronización Firebase</div><div class="cs">Estado de conexión y caché local</div></div></div>
        <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:${db?'var(--greens)':'var(--reds)'};border-radius:9px;margin:8px 0;border:1px solid ${db?'rgba(0,184,118,.2)':'rgba(217,59,90,.2)'}">
          <div style="width:10px;height:10px;border-radius:50%;background:${db?'var(--green)':'var(--red)'};flex-shrink:0"></div>
          <div>
            <div style="font-weight:700;font-size:13px;color:${db?'var(--green)':'var(--red)'}">${db?'Firebase conectado':'Sin conexión Firebase'}</div>
            <div style="font-size:11px;color:var(--ink3)">${db?'pagasi-b859b · datos en la nube':'Los datos son locales y temporales'}</div>
          </div>
          <a href="https://console.firebase.google.com" target="_blank" rel="noopener" class="btn btn-g btn-xs" style="margin-left:auto">Consola →</a>
        </div>
        <div style="font-size:12px;color:var(--ink2);line-height:1.55;margin-bottom:12px">Limpia el caché local y vuelve a cargar todos los datos desde Firebase: empresa, plan, tasa, cuentas, cobradores, clientes, créditos y pagos.</div>
        <button class="btn btn-p btn-sm" onclick="recargarDesdeFirebase()">↻ Limpiar caché y recargar</button>
      </div>

      <!-- Reglas Firestore -->
      <div class="card" style="border-top:3px solid var(--amber)">
        <div class="ch">
          <div><div class="ct">Reglas de Seguridad Firestore</div><div class="cs">Copia en Firebase Console → Firestore → Reglas</div></div>
          <a href="https://console.firebase.google.com" target="_blank" rel="noopener" class="btn btn-g btn-sm">Abrir →</a>
        </div>
        <pre style="font-family:monospace;font-size:11px;background:var(--surf2);border:1px solid var(--rim);padding:12px 14px;border-radius:9px;overflow-x:auto;color:var(--ink);margin:10px 0 0;line-height:1.7">rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}</pre>
      </div>

      <!-- Backup -->
      <div class="card" style="border-top:3px solid var(--green)">
        <div class="ch"><div><div class="ct">Backup y Restauración</div><div class="cs">Exporta o importa todos los datos</div></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:10px">
          <div>
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--ink3);margin-bottom:8px">Exportar</div>
            <div style="display:flex;flex-direction:column;gap:5px">
              <button class="btn btn-p btn-sm" onclick="exportarBackupJSON()" style="justify-content:flex-start">↓ Backup completo (JSON)</button>
              <button class="btn btn-g btn-sm" onclick="exportarCSV('clientes')" style="justify-content:flex-start">↓ CSV Clientes</button>
              <button class="btn btn-g btn-sm" onclick="exportarCSV('creditos')" style="justify-content:flex-start">↓ CSV Créditos</button>
              <button class="btn btn-g btn-sm" onclick="exportarCSV('pagos')" style="justify-content:flex-start">↓ CSV Pagos</button>
              <button class="btn btn-g btn-sm" onclick="exportarCSV('egresos')" style="justify-content:flex-start">↓ CSV Egresos</button>
            </div>
          </div>
          <div>
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:var(--ink3);margin-bottom:8px">Importar</div>
            <div style="background:var(--ambers);border:1px solid rgba(232,152,10,.3);border-radius:8px;padding:9px 11px;font-size:11.5px;color:var(--amber);font-weight:600;margin-bottom:9px">La importación reemplaza todos los datos actuales.</div>
            <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer" class="btn btn-g btn-sm">
              ↑ Cargar archivo JSON
              <input type="file" accept=".json" onchange="importarBackupJSON(this)" style="display:none">
            </label>
          </div>
        </div>
      </div>

    </div>
  </div>

  </div>`;};

