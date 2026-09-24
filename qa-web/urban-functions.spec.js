import {test,expect} from '@playwright/test';
const QA_TOKEN='ARBOR_INTEL_WEB_QA_TOKEN_20260924_V1';
const QA_PROJECT_ID='70024817-1d48-48bf-b90b-10a08a924677';
const API='https://rdugoujzngvwchuavfon.supabase.co/functions/v1/arbor-intel-api';

test.beforeEach(async({page},testInfo)=>{
  test.skip(!testInfo.project.name.startsWith('chromium-desktop'),'Canonical file-function checks use Chromium desktop');
  await page.addInitScript(({token,project})=>{localStorage.setItem('arbor_intel_public_test_token_v1',token);localStorage.setItem('arbor_intel_project_v2',project)},{token:QA_TOKEN,project:QA_PROJECT_ID});
});

test('CSV import parses coordinates and prepares the correct FeatureCollection without writing to DB',async({page})=>{
  let captured=null;
  await page.route(`${API}/api/project/${QA_PROJECT_ID}/import`,async route=>{
    captured=route.request().postDataJSON();
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({imported:captured?.featureCollection?.features?.length||0})});
  });
  await page.goto('/app.html',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1600);
  const csv='codigo;latitude;longitude;especie\nQA-IMP-01;-24,55700;-54,05600;Sibipiruna\nQA-IMP-02;-24,55735;-54,05565;Ipê\n';
  await page.locator('#importInput').setInputFiles({name:'qa-import.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await expect.poll(()=>captured,{timeout:10000}).not.toBeNull();
  const f=captured.featureCollection.features;
  expect(f).toHaveLength(2);
  expect(f[0].geometry.type).toBe('Point');
  expect(f[0].geometry.coordinates[0]).toBeCloseTo(-54.056,5);
  expect(f[0].geometry.coordinates[1]).toBeCloseTo(-24.557,5);
  expect(f[1].geometry.coordinates[0]).not.toBe(0);expect(f[1].geometry.coordinates[1]).not.toBe(0);
});

test('GeoJSON polygon import is routed to a GIS layer rather than converted into trees',async({page})=>{
  let layerBody=null,pointImportCalls=0;
  await page.route(`${API}/api/project/${QA_PROJECT_ID}/import`,async route=>{pointImportCalls++;await route.fulfill({status:200,contentType:'application/json',body:'{"imported":0}'})});
  await page.route(`${API}/api/project/${QA_PROJECT_ID}/layers`,async route=>{
    if(route.request().method()==='POST'){layerBody=route.request().postDataJSON();await route.fulfill({status:200,contentType:'application/json',body:'{"layer":{"id":"qa-layer"}}'});return}
    await route.continue();
  });
  await page.goto('/app.html',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1600);
  const fc={type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Área QA'},geometry:{type:'Polygon',coordinates:[[[-54.057,-24.558],[-54.055,-24.558],[-54.055,-24.556],[-54.057,-24.556],[-54.057,-24.558]]]}}]};
  await page.locator('#importInput').setInputFiles({name:'area-qa.geojson',mimeType:'application/geo+json',buffer:Buffer.from(JSON.stringify(fc))});
  await expect.poll(()=>layerBody,{timeout:10000}).not.toBeNull();
  expect(pointImportCalls).toBe(0);
  expect(layerBody.geojson.features).toHaveLength(1);expect(layerBody.geojson.features[0].geometry.type).toBe('Polygon');
});

test('GeoJSON, CSV, KML and GPX exports download non-empty project data',async({page})=>{
  const trees=[
    {id:'qa1',publicCode:'QA-001',lat:-24.557,lng:-54.056,commonName:'Sibipiruna',scientificName:'Cenostigma pluviosum',visualStatus:'done',riskRating:'LOW',capturedAt:'2026-09-24T00:00:00Z'},
    {id:'qa2',publicCode:'QA-002',lat:-24.55735,lng:-54.05565,commonName:'Ipê',scientificName:'Handroanthus sp.',visualStatus:'review',riskRating:'MODERATE',capturedAt:'2026-09-24T00:00:00Z'}
  ];
  await page.route(`${API}/api/trees?projectId=${QA_PROJECT_ID}`,r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({trees})}));
  await page.goto('/app.html',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);
  await page.locator('#dataBtn').click();await page.locator('#exportBtn').click();
  for(const fmt of ['geojson','csv','kml','gpx']){
    const dl=page.waitForEvent('download');await page.locator(`.exp[data-f="${fmt}"]`).click();const d=await dl;const stream=await d.createReadStream();let size=0;for await(const chunk of stream)size+=chunk.length;expect(size,`${fmt} export should be non-empty`).toBeGreaterThan(50);
  }
});
