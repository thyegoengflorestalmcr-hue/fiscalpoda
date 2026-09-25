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

test('live report is mobile-readable and export is non-blocking',async({page})=>{
  await page.setViewportSize({width:412,height:915});
  await bindIdentity(page);
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e?.stack||e)));
  await page.goto(`/report.html?tree=${TREE}&lang=pt-BR`,{waitUntil:'domcontentloaded',timeout:45000});
  await expect(page.locator('.reportV10')).toBeVisible({timeout:20000});
  await page.waitForTimeout(2500);
  expect(pageErrors,`page errors: ${pageErrors.join('\n')}`).toEqual([]);
  const dims=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
  expect(dims.sw).toBeLessThanOrEqual(dims.cw+3);
  await expect(page.locator('#pdfBtn')).toBeEnabled();
  await expect(page.locator('.reportPage').first()).toBeVisible();
});
