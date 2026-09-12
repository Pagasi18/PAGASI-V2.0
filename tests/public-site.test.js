/* Contract/regression checks against the last deployed implementation.
   Runs offline. No real Firebase calls, SMS, customer records or payments. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const baseline=file=>execFileSync('git',['show','4585bcf:'+file],{cwd:root,encoding:'utf8',maxBuffer:4*1024*1024});
const scripts=html=>[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
const catalog=require('../assets/public/catalog.js');
const oldSim=scripts(baseline('simulador.html'))[0];
const oldCatalog=scripts(baseline('catalogo.html'))[0];
const oldRequest=scripts(baseline('solicitar.html')).at(-1);
let checks=0;
function check(name,fn){fn();checks++;console.log('OK '+name);}
const oldContext={};vm.createContext(oldContext);
vm.runInContext(oldSim.slice(0,oldSim.indexOf('window.addEventListener'))+';this.models=CATALOG;',oldContext);
const originalModels={};vm.createContext(originalModels);
vm.runInContext(oldCatalog.slice(0,oldCatalog.indexOf('function calcMoto'))+';this.models=MOTOS;',originalModels);
check('46 stable model IDs, prices, dealerships and original simulator results',()=>{
  assert.equal(catalog.motos.length,46);assert.equal(new Set(catalog.motos.map(m=>m.id)).size,46);
  for(const m of catalog.motos){const old=originalModels.models.find(x=>x.id===m.id);assert.ok(old);assert.equal(m.precio,old.precio);assert.equal(m.modelo,old.modelo);assert.equal(m.sedeName,old.sedeName);assert.deepEqual(catalog.plan(m.id),JSON.parse(JSON.stringify(oldContext.calcPlan(m.precio,12))));}
  assert.equal(catalog.get(0),undefined);assert.equal(catalog.plan(999),null);
});
check('catalog image files exist; unknown photos do not impersonate another model',()=>{for(const m of catalog.motos)if(m.image)assert.ok(fs.existsSync(path.join(root,m.image)),m.image);for(let id=42;id<=46;id++)assert.equal(catalog.get(id).image,'');});
check('customer portal script and dependencies unchanged',()=>{
  const before=scripts(baseline('micuenta.html')),after=scripts(read('micuenta.html'));
  before.forEach((script,i)=>assert.equal(after[i],script,'account script '+i));
  const sources=html=>[...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(x=>x[1]);
  for(const src of sources(baseline('micuenta.html')))assert.ok(sources(read('micuenta.html')).includes(src));
});
check('all original request and portal control IDs are present exactly once',()=>{
  for(const page of ['solicitar.html','micuenta.html']){
    const ids=html=>[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
    const before=ids(baseline(page)),after=ids(read(page));
    for(const id of before.filter(x=>page==='micuenta.html'||/^(wz_|fs|pd|btn)/.test(x)||['fM','fOK','okText'].includes(x)))assert.equal(after.filter(x=>x===id).length,1,page+' '+id);
    assert.equal(new Set(after).size,after.length,page+' duplicate IDs');
  }
});
check('original request input names, select options and defaults preserved',()=>{
  const selects=html=>new Map([...html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)].map(m=>[m[1],[...m[2].matchAll(/<option[^>]*value="([^"]*)"/g)].map(x=>x[1])]));
  const before=selects(baseline('solicitar.html')),after=selects(read('solicitar.html'));
  for(const [id,values]of before)assert.deepEqual(after.get(id),values,id);
});
check('Firebase SDKs used by the public request are byte-identical',()=>{const original=scripts(baseline('solicitar.html')).slice(0,3);const updated=scripts(read('solicitar.html')).filter(x=>x.trim());original.forEach((s,i)=>assert.equal(updated[i],s));});
const oldHtml=baseline('solicitar.html');
function context(source){
  const elements=new Map(),calls=[],alerts=[];
  function node(id){if(elements.has(id))return elements.get(id);const classes=new Set();if(id==='fs1'||id==='pd1')classes.add('on');const el={id,value:'',textContent:'',style:{},disabled:false,appendChild(){},addEventListener(){},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)}};elements.set(id,el);return el;}
  for(const m of oldHtml.matchAll(/<(?:input|select|textarea)\b[^>]*id="([^"]+)"[^>]*>/g))node(m[1]);
  for(const m of oldHtml.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>[\s\S]*?<option\b[^>]*value="([^"]*)"/g))node(m[1]).value=m[2];
  for(const id of ['fs1','fs2','pd1','pd2','fOK','okText','btnContinuarSolicitud','btnAtrasSolicitud','btnGuardarSolicitud'])node(id);
  const auth={currentUser:null,signInAnonymously:async()=>{calls.push('signIn');auth.currentUser={uid:'offline-test'};},signOut:async()=>{calls.push('signOut');auth.currentUser=null;}};
  const db={collection:name=>{calls.push(['collection',name]);return {doc:id=>({set:async data=>{calls.push(['write',id,JSON.parse(JSON.stringify(data))]);if(ctx.failWrite)throw new Error('offline failure');}})};}};
  const ctx={PagasiCatalog:catalog,PagasiSite:{populateModels(){}},URLSearchParams,location:{search:''},console:{log(){},error(){}},alert:message=>alerts.push(message),IntersectionObserver:function(){this.observe=()=>{};},Date:class extends Date{constructor(...args){super(...(args.length?args:['2026-09-12T12:00:00Z']));}static now(){return 1789214400000;}},document:{readyState:'complete',createElement:()=>({appendChild(){}}),getElementById:node,querySelectorAll:selector=>selector==='.fs'?[node('fs1'),node('fs2')]:selector==='.prog .ps'?[node('pd1'),node('pd2')]:selector==='#fs2 .btn'?[node('btnAtrasSolicitud'),node('btnGuardarSolicitud')]:[]},addEventListener(){},firebase:{apps:[],initializeApp:()=>({}),auth:()=>auth,firestore:()=>db}};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,elements,calls,alerts,node};
}
const newSource=read('assets/public/request.js');
check('credit score and complete payload match original across varied profiles',()=>{
  const scenarios=[{wz_nom:'Prueba offline',wz_ci:'V-00000000',wz_tel:'00000000000',wz_emp:'formal',wz_ing:'600',fM:'5'},{wz_nom:'Cliente <prueba>',wz_ci:'0',wz_tel:'0',wz_emp:'delivery',wz_ing:'95',wz_ifam:'200',wz_cashea:'si',wz_cashea_nivel:'3',wz_viv:'alquilada',wz_dep_g:'2',fM:'41'},{wz_nom:'Caso offline',wz_ci:'0',wz_tel:'0',wz_emp:'informal',wz_hist_g:'malo',wz_deuda_g:'graves',wz_fiador:'si',wz_terremoto:'si',wz_terremoto_danos:'graves',fM:''}];
  for(const values of scenarios){const old=context(oldRequest),current=context(newSource);for(const[id,value]of Object.entries(values)){old.node(id).value=value;current.node(id).value=value;}assert.deepEqual(JSON.parse(JSON.stringify(current.ctx.calcCrediScore())),JSON.parse(JSON.stringify(old.ctx.calcCrediScore())));assert.deepEqual(JSON.parse(JSON.stringify(current.ctx.buildClientePayload())),JSON.parse(JSON.stringify(old.ctx.buildClientePayload())));}
});
check('all 46 model IDs reach the request payload including Benmo',()=>{const test=context(newSource);for(const m of catalog.motos){test.node('fM').value=String(m.id);const p=test.ctx.buildClientePayload();assert.equal(p.moto_interes_id,m.id);assert.equal(p.moto_interes_modelo,m.modelo);assert.equal(p.moto_interes_precio,m.precio);assert.equal(p.moto_interes_sede,m.sedeName);}});
check('empty required data cannot advance the wizard',()=>{const t=context(newSource);t.ctx.goS(2);assert.ok(t.node('fs1').classList.contains('on'));assert.equal(t.alerts.length,1);assert.equal(t.calls.length,0);});
check('valid data advances and going back preserves values',()=>{const t=context(newSource);for(const[id,v]of Object.entries({wz_nom:'Offline',wz_ci:'0',wz_tel:'0',wz_emp:'formal',wz_ing:'500'}))t.node(id).value=v;t.ctx.goS(2);assert.ok(t.node('fs2').classList.contains('on'));t.ctx.goS(1);assert.equal(t.node('wz_nom').value,'Offline');assert.ok(t.node('fs1').classList.contains('on'));});
(async()=>{
  const fill=t=>{for(const[id,value]of Object.entries({wz_nom:'Offline synthetic test',wz_ci:'0',wz_tel:'0',wz_emp:'formal',wz_ing:'500',fM:'42'}))t.node(id).value=value;};
  const empty=context(newSource);await empty.ctx.submitF();assert.equal(empty.calls.length,0);assert.equal(empty.ctx.__submittingSolicitud,false);checks++;console.log('OK empty request cannot submit');
  const good=context(newSource);fill(good);await Promise.all([good.ctx.submitF(),good.ctx.submitF()]);assert.equal(good.calls.filter(c=>Array.isArray(c)&&c[0]==='write').length,1);assert.equal(good.calls.filter(c=>Array.isArray(c)&&c[0]==='collection')[0][1],'clientes');assert.equal(good.calls.at(-1),'signOut');assert.equal(good.node('fOK').style.display,'block');assert.equal(good.ctx.__submittingSolicitud,false);checks++;console.log('OK one lead write, duplicate-click guard, logout and success state');
  const failed=context(newSource);fill(failed);failed.ctx.failWrite=true;await failed.ctx.submitF();assert.equal(failed.node('fOK').style.display,undefined);assert.equal(failed.ctx.__submittingSolicitud,false);assert.equal(failed.node('btnGuardarSolicitud').disabled,false);failed.ctx.failWrite=false;await failed.ctx.submitF();assert.equal(failed.node('fOK').style.display,'block');checks++;console.log('OK failed request restores controls and can retry');
  console.log('\n'+checks+' public-site contract checks passed. No network calls.');
})().catch(e=>{console.error(e);process.exitCode=1;});
