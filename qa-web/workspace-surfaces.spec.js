import { test, expect } from '@playwright/test';

const QA_TOKEN = 'ARBOR_INTEL_WEB_QA_TOKEN_20260924_V1';
const QA_PROJECT_ID = '70024817-1d48-48bf-b90b-10a08a924677';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ token, projectId }) => {
    localStorage.setItem('arbor_intel_public_test_token_v1', token);
    localStorage.setItem('arbor_intel_project_v2', projectId);
  }, { token: QA_TOKEN, projectId: QA_PROJECT_ID });
  await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
});

test('layers and data use the standard sheet surface', async ({ page }) => {
  for (const selector of ['#layersBtn', '#dataBtn']) {
    await page.locator(selector).click();
    await expect(page.locator('#sheet')).toBeVisible();
    await expect(page.locator('#sheet')).not.toHaveClass(/hidden/);
    await expect(page.locator('#sheetTitle')).not.toHaveText('');
    await page.locator('#sheetClose').click();
    await expect(page.locator('#sheet')).toHaveClass(/hidden/);
  }
});

test('brand opens the dedicated Projects and modules workspace overlay', async ({ page }) => {
  await page.locator('#brandBtn').click();
  const overlay = page.locator('.aiOverlay');
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('h2')).toContainText(/Projetos e módulos/i);
  await expect(overlay).toContainText(/Avaliação de árvores urbanas/i);
  await expect(overlay).toContainText(/Inventário florestal/i);
  await overlay.locator('.aiClose').click();
  await expect(page.locator('.aiOverlay')).toHaveCount(0);
});
