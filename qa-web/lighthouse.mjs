import fs from 'node:fs';
import path from 'node:path';
import lighthouse from 'lighthouse';
import { launch } from 'chrome-launcher';
import { chromium } from '@playwright/test';

const base = process.env.ARBOR_BASE_URL || 'https://arbor-intel.vercel.app';
const outDir = path.resolve('lighthouse-results');
fs.mkdirSync(outDir, { recursive: true });

const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu']
});
const pages = [
  ['app', `${base}/app.html`],
  ['inventory', `${base}/inventory.html`]
];

const summary = {};
for (const [name, url] of pages) {
  const result = await lighthouse(url, {
    port: chrome.port,
    output: ['html','json'],
    logLevel: 'error',
    onlyCategories: ['performance','accessibility','best-practices','seo']
  });
  const [html, json] = result.report;
  fs.writeFileSync(path.join(outDir, `${name}.html`), html);
  fs.writeFileSync(path.join(outDir, `${name}.json`), json);
  const c = result.lhr.categories;
  summary[name] = Object.fromEntries(Object.entries(c).map(([k,v]) => [k, Math.round(v.score * 100)]));
}
await chrome.kill();
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
