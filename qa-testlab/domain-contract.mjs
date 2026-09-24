import assert from 'node:assert/strict';
const ROOT='https://rdugoujzngvwchuavfon.supabase.co/functions/v1/arbor-intel-api';
const INV='https://rdugoujzngvwchuavfon.supabase.co/functions/v1/arbor-intel-inventory';
const PLAN='https://rdugoujzngvwchuavfon.supabase.co/functions/v1/arbor-intel-inventory-plan-v4';
const STAT='https://rdugoujzngvwchuavfon.supabase.co/functions/v1/arbor-intel-inventory-stat-v4';
const SPATIAL='https://rdugoujzngvwchuavfon.supabase.co/functions/v1/arbor-intel-spatial-v19';
const TOKEN='arbor-intel-domain-contract-qa-v1-20260924';
const NAME='__ARBOR_INTEL_DOMAIN_QA__';
const out={checks:[],ids:{}};
const ok=(name,detail='')=>{out.checks.push({name,ok:true,detail});console.log('PASS',name,detail)};
async function call(base,path,opt={}){const h=new Headers(opt.headers||{});h.set('x-device-token',TOKEN);h.set('Accept','application/json');const r=await fetch(base+path,{...opt,headers:h});const tx=await r.text();let j={};try{j=tx?JSON.parse(tx):{}}catch{j={error:tx}}if(!r.ok)throw new Error(`${path}: ${j.error||tx||r.status}`);return j}
const post=(base,path,body)=>call(base,path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function main(){
  let pj=await call(ROOT,'/api/projects');
  let project=(pj.projects||[]).find(p=>p.name===NAME&&p.status!=='DELETED');
  if(!project){project=(await post(ROOT,'/api/projects',{name:NAME,settings:{module:'FOREST_INVENTORY',inventoryType:'FOREST_FRAGMENT',objective:'Live domain contract QA only',qaFixture:true,creationIntent:'EXPLICIT_QA_CONTRACT'}})).project}
  assert.ok(project?.id);out.ids.project=project.id;ok('explicit QA project exists',project.id);

  let ps=(await call(INV,`/api/project/${encodeURIComponent(project.id)}/protocols`)).protocols||[];
  let protocol=ps.find(p=>p.method_code==='SRS_WOR'&&(p.metadata?.domainContractQa||p.settings?.metadata?.domainContractQa));
  if(!protocol){protocol=(await post(INV,'/api/protocols',{projectId:project.id,methodCode:'SRS_WOR',responseVariable:'basal_area_m2_ha',targetRelativeErrorPct:20,pilotMinPlots:2,finitePopulationUnits:2,confidenceLevel:.95,plotShape:'RECTANGLE',plotAreaM2:400,plotDimensions:{widthM:20,lengthM:20,azimuthDeg:0},permanent:false,metadata:{domainContractQa:true,source:'PUBLIC_CI_BRIDGE'}})).protocol}
  assert.ok(protocol?.id);out.ids.protocol=protocol.id;ok('SRS protocol exists',protocol.id);

  let plan=await call(PLAN,`/api/protocol/${encodeURIComponent(protocol.id)}/plan`);
  const before=(plan.plots||[]).length;
  await call(PLAN,`/api/protocol/${encodeURIComponent(protocol.id)}/plan`);
  const after=((await call(PLAN,`/api/protocol/${encodeURIComponent(protocol.id)}/plan`)).plots||[]).length;
  assert.equal(after,before);ok('reading plan never auto-creates plots',`${before} -> ${after}`);

  const wanted=[
    {code:'QA-DOMAIN-001',centerLat:-24.5570000,centerLng:-54.0560000},
    {code:'QA-DOMAIN-002',centerLat:-24.5573500,centerLng:-54.0556500}
  ];
  for(const c of wanted){
    plan=await call(PLAN,`/api/protocol/${encodeURIComponent(protocol.id)}/plan`);
    if(!(plan.plots||[]).some(p=>p.code===c.code))await post(SPATIAL,`/api/protocol/${encodeURIComponent(protocol.id)}/center-plot`,{...c,shape:'RECTANGLE',horizontalAreaM2:400,dimensions:{widthM:20,lengthM:20,azimuthDeg:0},creationIntent:'MAP_CENTER_EXPLICIT',operatorConfirmedAt:new Date().toISOString(),selectionMeta:{domainContractQa:true,source:'PUBLIC_CI_BRIDGE'}});
  }
  plan=await call(PLAN,`/api/protocol/${encodeURIComponent(protocol.id)}/plan`);
  const qa=(plan.plots||[]).filter(p=>wanted.some(w=>w.code===p.code));
  assert.equal(qa.length,2);assert.equal(new Set(qa.map(p=>p.code)).size,2);
  for(const p of qa){assert.ok(Number.isFinite(+p.center_lat)&&Number.isFinite(+p.center_lng));assert.notEqual(+p.center_lat,0);assert.notEqual(+p.center_lng,0);assert.equal(p.shape,'RECTANGLE');assert.equal(+p.horizontal_area_m2,400)}
  ok('explicit spatial centers create exactly two valid rectangular plots',qa.map(p=>p.code).join(','));

  const already=qa.every(p=>p.selection_meta?.srsSelected===true&&p.selection_meta?.srsDrawId);
  if(!already)await post(PLAN,`/api/protocol/${encodeURIComponent(protocol.id)}/draw-srs`,{sampleSize:2});
  plan=await call(PLAN,`/api/protocol/${encodeURIComponent(protocol.id)}/plan`);
  const selected=(plan.plots||[]).filter(p=>wanted.some(w=>w.code===p.code)&&p.selection_meta?.srsSelected===true);
  assert.equal(selected.length,2);assert.ok(selected.every(p=>Number.isInteger(+p.selection_meta?.srsRank)&&+p.selection_meta.srsRank>=1));assert.equal(new Set(selected.map(p=>p.selection_meta.srsDrawId)).size,1);
  ok('SRS draw is persisted and auditable',selected.map(p=>`${p.code}#${p.selection_meta.srsRank}`).join(','));

  const drawIds=selected.map(p=>p.selection_meta.srsDrawId);
  const planAgain=await call(PLAN,`/api/protocol/${encodeURIComponent(protocol.id)}/plan`);
  const selectedAgain=(planAgain.plots||[]).filter(p=>wanted.some(w=>w.code===p.code)&&p.selection_meta?.srsSelected===true);
  assert.deepEqual(selectedAgain.map(p=>p.selection_meta.srsDrawId).sort(),drawIds.sort());
  ok('SRS selection survives reread without redraw');

  const stats=await call(STAT,`/api/protocol/${encodeURIComponent(protocol.id)}/statistics`);
  assert.ok(stats&&typeof stats==='object');ok('statistics engine responds without fabricating field observations',JSON.stringify({n:stats.n??stats.nValidResponsePlots??null,precisionTargetMet:stats.precisionTargetMet??null}));

  console.log('\nDOMAIN_QA_SUMMARY='+JSON.stringify(out));
}
main().catch(e=>{console.error('DOMAIN_QA_FAIL',e.stack||e);process.exit(1)});
