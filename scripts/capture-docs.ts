import fs from 'node:fs';
import { chromium } from '@playwright/test';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:4322';

async function waitForImages(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll('article img')] as HTMLImageElement[];
    return images.length === 0 || images.slice(0, 6).every((image) => image.complete && image.naturalWidth > 0);
  }, { timeout: 15_000 });
}

async function main(): Promise<void> {
  fs.mkdirSync('docs', { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { level: 1, name: /The pulse of Linux gaming compatibility/i }).waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'docs/screenshot.png' });

  await page.goto(`${baseUrl}/games`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { level: 1, name: /Will it run on Linux/i }).waitFor();
  await waitForImages(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/games.png' });

  await browser.close();
  console.log('[docs] wrote docs/screenshot.png and docs/games.png');
}

main().catch((error) => {
  console.error('[docs] screenshot capture failed:', error);
  process.exit(1);
});
