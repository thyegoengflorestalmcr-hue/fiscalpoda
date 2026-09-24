import assert from'node:assert/strict';
const ROOT='https://rdugoujzngvwchuavfon.supabase.co/functions/v1/arbor-intel-report-v10';
const TOKEN='arbor-intel-domain-contract-qa-v1-20260924';
const TREE='46799552-3d9f-41f8-a3f0-a2ac390b08c5';
const r=await fetch(`${ROOT}/api/tree/${TREE}`,{headers:{'x-device-token':TOKEN,Accept:'application/json'}});
const text=await r.text();let j={};try{j=JSON.parse(text)}catch{throw Error(`non-json ${r.status}: ${text.slice(0,300)}`)}
assert.equal(r.status,200,JSON.stringify(j));
assert.equal(j.tree?.id,TREE);
assert.equal(j.tree?.client_tree_id,'__REPORT_V10_QA_TREE__');
assert.ok(Array.isArray(j.tree?.measurements));
assert.ok(j.tree.measurements.some(x=>x.key==='circumference'&&+x.value===90&&x.is_confirmed===true));
assert.ok(j.tree.measurements.some(x=>x.key==='height'&&+x.value===7.5&&x.is_confirmed===true));
assert.ok(Array.isArray(j.photos));
assert.equal(j.reportAuthorized,false);
assert.equal(j.professional,null);
assert.equal(j.review,null);
console.log('PASS report v10 endpoint contract',JSON.stringify({tree:j.tree.id,measurements:j.tree.measurements.length,photos:j.photos.length,reportAuthorized:j.reportAuthorized}));
