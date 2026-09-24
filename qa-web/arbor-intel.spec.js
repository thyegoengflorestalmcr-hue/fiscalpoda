import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE = process.env.ARBOR_BASE_URL || 'https://arbor-intel.vercel.app';
const ORIGIN = new URL(BASE).origin;

function runtimeProbe(page) {
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  page.on('pageerror', e => pageErrors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('requestfailed', r => failedRequests.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText || 'failed'}`));
  return { pageErrors, consoleErrors, failedRequests };
}

async function settle(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1800);
}

async function attachDiagnostics(testInfo, name, value) {
  await testInfo.attach(name, { body: Buffer.from(JSON.stringify(value, null, 2)), contentType: 'application/json' });
}

async function screenshot(page, testInfo, name) {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
}

async function assertNoHorizontalOverflow(page) {
  const m = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));
  expect(m.scrollWidth, JSON.stringify(m)).toBeLessThanOrEqual(m.innerWidth + 2);
  expect(m.bodyScrollWidth, JSON.stringify(m)).toBeLessThanOrEqual(m.innerWidth + 2);
}

async function primaryControlAudit(page, selectors) {
  return await page.evaluate((sels) => sels.map(selector => {
    const el = document.querySelector(selector);
    if (!el) return { selector, missing: true };
    const r = el.getBoundingClientRect();
    const cx = Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2));
    const cy = Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2));
    const top = document.elementFromPoint(cx, cy);
    const covered = !!top && top !== el && !el.contains(top);
    return {
      selector,
      missing: false,
      visible: !!(r.width && r.height),
      width: Math.round(r.width), height: Math.round(r.height),
      left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom),
      inViewport: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
      covered,
      coveringTag: top?.tagName || null,
      coveringId: top?.id || null
    };
  }), selectors);
}

test.describe('Urban shell · layout, usability and runtime', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await settle(page);
  });

  test('core shell renders, fits viewport and controls are not covered', async ({ page }, testInfo) => {
    const probe = runtimeProbe(page);
    await expect(page.locator('#map')).toBeVisible();
    const mapBox = await page.locator('#map').boundingBox();
    expect(mapBox?.width || 0).toBeGreaterThan(200);
    expect(mapBox?.height || 0).toBeGreaterThan(200);

    const selectors = ['#brandBtn','#langBtn','#layersBtn','#dataBtn','#cameraBtn','#locateBtn'];
    for (const s of selectors) await expect(page.locator(s)).toBeVisible();
    await assertNoHorizontalOverflow(page);

    const audit = await primaryControlAudit(page, selectors);
    await attachDiagnostics(testInfo, 'primary-control-audit.json', audit);
    for (const x of audit) {
      expect(x.missing, `${x.selector} missing`).toBeFalsy();
      expect(x.visible, `${x.selector} invisible`).toBeTruthy();
      expect(x.inViewport, `${x.selector} outside viewport: ${JSON.stringify(x)}`).toBeTruthy();
      expect(x.covered, `${x.selector} covered by ${x.coveringTag}#${x.coveringId}`).toBeFalsy();
      expect(x.width, `${x.selector} touch width`).toBeGreaterThanOrEqual(40);
      expect(x.height, `${x.selector} touch height`).toBeGreaterThanOrEqual(40);
    }
    await screenshot(page, testInfo, 'urban-shell.png');
    await attachDiagnostics(testInfo, 'runtime.json', probe);
    expect(probe.pageErrors, probe.pageErrors.join('\n')).toEqual([]);
  });

  test('layers, data and project/module surfaces open and close', async ({ page }, testInfo) => {
    const probe = runtimeProbe(page);
    for (const selector of ['#layersBtn','#dataBtn','#brandBtn']) {
      await page.locator(selector).click();
      await expect(page.locator('#sheet')).toBeVisible();
      await expect(page.locator('#sheet')).not.toHaveClass(/hidden/);
      const title = (await page.locator('#sheetTitle').innerText()).trim();
      expect(title.length).toBeGreaterThan(0);
      await screenshot(page, testInfo, `surface-${selector.slice(1)}.png`);
      await page.locator('#sheetClose').click();
      await expect(page.locator('#sheet')).toHaveClass(/hidden/);
    }
    await attachDiagnostics(testInfo, 'surface-runtime.json', probe);
    expect(probe.pageErrors, probe.pageErrors.join('\n')).toEqual([]);
  });

  test('language switch changes visible language state without breaking shell', async ({ page }, testInfo) => {
    const before = (await page.locator('#langBtn').innerText()).trim();
    await page.locator('#langBtn').click();
    await page.waitForTimeout(400);
    const after = (await page.locator('#langBtn').innerText()).trim();
    expect(after).not.toBe(before);
    await expect(page.locator('#map')).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await screenshot(page, testInfo, 'language-switched.png');
  });

  test('valid geolocation updates HUD and never becomes 0,0', async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name.includes('webkit'), 'WebKit permission behavior is covered by mobile shell tests');
    await context.grantPermissions(['geolocation'], { origin: ORIGIN });
    await context.setGeolocation({ latitude: -24.5563, longitude: -54.0567, accuracy: 8 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.locator('#locateBtn').click();
    await page.waitForTimeout(1500);
    const coords = (await page.locator('#hudCoords').innerText()).trim();
    await attachDiagnostics(testInfo, 'geolocation.json', { coords, gps: await page.locator('#hudGps').innerText() });
    expect(coords).not.toBe('—');
    expect(coords).not.toMatch(/0[.,]0+\s*[,;/ ]\s*0[.,]0+/);
    await expect(page.locator('#map')).toBeVisible();
  });

  test('denied geolocation degrades gracefully without blanking app', async ({ page, context }, testInfo) => {
    const probe = runtimeProbe(page);
    await context.clearPermissions();
    await page.locator('#locateBtn').click();
    await page.waitForTimeout(900);
    await expect(page.locator('#brandBtn')).toBeVisible();
    await expect(page.locator('#map')).toBeVisible();
    await attachDiagnostics(testInfo, 'gps-denied-runtime.json', probe);
    expect(probe.pageErrors, probe.pageErrors.join('\n')).toEqual([]);
  });

  test('camera denial/fallback does not crash navigation', async ({ page, context }, testInfo) => {
    const probe = runtimeProbe(page);
    await context.clearPermissions();
    await page.locator('#cameraBtn').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('body')).toContainText('Arbor Intel');
    await expect(page.locator('#cameraBtn')).toBeVisible();
    await attachDiagnostics(testInfo, 'camera-denied-runtime.json', probe);
    expect(probe.pageErrors, probe.pageErrors.join('\n')).toEqual([]);
  });
});

test.describe('Accessibility and PWA resilience', () => {
  test('urban shell has no serious or critical axe violations', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('chromium-desktop'), 'Single canonical accessibility scan');
    await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
    await settle(page);
    const result = await new AxeBuilder({ page }).analyze();
    const severe = result.violations.filter(v => ['serious','critical'].includes(v.impact));
    await attachDiagnostics(testInfo, 'axe-urban.json', result.violations);
    expect(severe, severe.map(v => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
  });

  test('manifest exists and offline reload keeps a usable shell after warm load', async ({ page, context, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'Offline/PWA canonical check uses Chromium service worker semantics');
    const manifest = await page.request.get(`${BASE}/manifest.webmanifest`);
    expect(manifest.ok()).toBeTruthy();
    await page.goto('/app.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    const sw = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false, controlled: false };
      try {
        await Promise.race([navigator.serviceWorker.ready, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 4000))]);
      } catch {}
      return { supported: true, controlled: !!navigator.serviceWorker.controller, registrations: (await navigator.serviceWorker.getRegistrations()).length };
    });
    await attachDiagnostics(testInfo, 'service-worker.json', sw);
    expect(sw.supported).toBeTruthy();
    expect(sw.registrations || 0).toBeGreaterThan(0);
    await context.setOffline(true);
    try { await page.reload({ waitUntil: 'domcontentloaded', timeout: 12000 }); } catch {}
    await page.waitForTimeout(600);
    await expect(page.locator('body')).toContainText('Arbor Intel');
    await expect(page.locator('#brandBtn')).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe('Inventory product contract', () => {
  test('inventory entry is project-first and does not drop directly into field', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('chromium-desktop'), 'Canonical contract only needs one browser to diagnose');
    await page.goto('/inventory.html', { waitUntil: 'domcontentloaded' });
    await settle(page);
    await screenshot(page, testInfo, 'inventory-entry.png');
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Defina o projeto de inventário|Primeiro o projeto\. Depois o desenho amostral/i);
    expect(body).not.toMatch(/Nenhuma parcela selecionada[\s\S]*Nova árvore/i);
  });

  test('direct field URL is guarded by explicit project/protocol authorization', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('chromium-desktop'), 'Canonical guard contract');
    await page.goto('/inventory-field.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    expect(page.url()).toMatch(/\/inventory\.html\?reason=project-required|\/inventory\.html$/);
  });

  test('inventory mobile shell never overflows horizontally', async ({ page }) => {
    await page.goto('/inventory.html', { waitUntil: 'domcontentloaded' });
    await settle(page);
    await assertNoHorizontalOverflow(page);
  });
});
