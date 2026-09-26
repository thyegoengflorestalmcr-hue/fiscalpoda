import {test,expect} from '@playwright/test';

const TOKEN='ARBOR_INTEL_WEB_QA_TOKEN_20260924_V1';
const PROJECT='70024817-1d48-48bf-b90b-10a08a924677';
const TREE='69b72f61-13b3-4295-b09f-347fbdf1edd0';

function bindIdentity(page){
  return page.addInitScript(({token,project})=>{
    localStorage.setItem('arbor_intel_public_test_token_v1',token);
    localStorage.setItem('arbor_intel_project_v2',project);
  },{token:TOKEN,project:PROJECT});
}

for (const viewport of [
  {name:'android',width:412,height:915},
  {name:'desktop',width:1440,height:900}
]) {
  test(`live app boots and core controls work - ${viewport.name}`,async({page})=>{
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await bindIdentity(page);
    const pageErrors=[];
    page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
    await page.goto('/app.html',{waitUntil:'domcontentloaded',timeout:45000});
    await expect(page.locator('#map')).toBeVisible();
    await expect(page.locator('#dataBtn')).toBeVisible();
    await expect(page.locator('#cameraBtn')).toBeVisible();
    await page.waitForTimeout(3000);
    expect(pageErrors,`page errors: ${pageErrors.join('\n')}`).toEqual([]);
    await page.locator('#dataBtn').click();
    await expect(page.locator('#sheet')).toBeVisible();
    await page.locator('#sheetClose').click();
    await page.locator('#cameraBtn').click();
    await expect(page.locator('#pfc')).toBeVisible({timeout:10000});
    await expect(page.locator('#pfcFinish')).toBeVisible();
  });
}

for (const viewport of [
  {name:'android',width:412,height:915},
  {name:'desktop',width:1440,height:900}
]) {
  test(`final report is clean, readable and exportable - ${viewport.name}`,async({page})=>{
    await page.setViewportSize({width:viewport.width,height:viewport.height});
    await bindIdentity(page);
    const pageErrors=[];
    page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
    await page.goto(`/report.html?tree=${TREE}&lang=pt-BR`,{waitUntil:'domcontentloaded',timeout:45000});
    await expect(page.locator('.reportV10')).toBeVisible({timeout:20000});
    await page.waitForFunction(()=>window.__ARBOR_REPORT_FINAL_V14__===true,{timeout:20000});
    await page.waitForTimeout(800);
    expect(pageErrors,`page errors: ${pageErrors.join('\n')}`).toEqual([]);
    const dims=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
    expect(dims.sw).toBeLessThanOrEqual(dims.cw+3);
    await expect(page.locator('#pdfBtn')).toBeEnabled();
    await expect(page.locator('.reportPage').first()).toBeVisible();
    expect(await page.locator('.platePage .evidenceOverlay,.platePage .photoPin').count()).toBe(0);
    const firstPage=await page.locator('.platePage').first().innerText();
    expect(firstPage).not.toMatch(/RASCUNHO TÉCNICO|ANÁLISE AUTOGERADA|falha de leitura|gerado por IA/i);
    const visibleText=await page.locator('.reportV10').innerText();
    expect(visibleText).not.toMatch(/professional_field_measurement|AUTO_VISUAL_V[123]|MANUAL_V[12]/i);
  });
}

test('production serves final V14 assets and PWA V17',async({request})=>{
  const report=await request.get('/report.html');
  expect(report.ok()).toBeTruthy();
  const reportText=await report.text();
  expect(reportText).toContain('/report-final-v14.js?v=20260926-1');
  expect(reportText).toContain('/report-annotate-v10.js?v=20260926-1');
  expect(reportText).toContain('/report-pdf-v14.js?v=20260926-1');
  const sw=await request.get('/sw.js');
  expect(sw.ok()).toBeTruthy();
  const swText=await sw.text();
  expect(swText).toContain("arbor-intel-urban-mvp-v17-2026-09-26");
  expect(swText).toContain('/report-final-v14.js?v=20260926-1');
  expect(swText).toContain('/field-photo-first-v10.js?v=20260925-1');
});
