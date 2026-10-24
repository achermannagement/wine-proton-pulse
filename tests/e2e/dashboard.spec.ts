import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

fs.mkdirSync('test-results/screenshots', { recursive: true });

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

function seriousViolations(
  violations: Awaited<ReturnType<AxeBuilder['analyze']>>['violations'],
) {
  return violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
}

test('feed loads with live status, releases, pulse and source health', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');

  await expect(page).toHaveTitle(/Wine & Proton Pulse/);
  await expect(
    page.getByRole('heading', { level: 1, name: /The pulse of Linux gaming compatibility/i }),
  ).toBeVisible();
  await expect(page.getByText('Live', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Compatibility pulse' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Latest releases' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Source health' })).toBeVisible();
  await expect(page.getByText('HELLDIVERS™ 2').first()).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'GE-Proton11-11 Released' }).first(),
  ).toBeVisible();
  await expect(page.getByTestId('feed-tab-all')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('main article').first()).toBeVisible();

  await page.screenshot({ path: 'test-results/screenshots/home.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('feed tabs, source filters and time ranges update the query', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');

  const tabs = page.getByTestId('feed-tabs');
  await tabs.getByRole('button', { name: /Game fixes/ }).click();
  await expect(page).toHaveURL(/category=gamefix/);
  await expect(page.getByTestId('feed-tab-gamefix')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('main article').first()).toBeVisible();
  await expect(page.getByText('Game fix').first()).toBeVisible();
  await expect(
    page.locator('main article').filter({ hasText: 'r/linux_gaming' }),
  ).toHaveCount(0);

  await tabs.getByRole('button', { name: /^Releases/ }).click();
  await expect(page).toHaveURL(/category=release/);
  await expect(page.getByText('Wine 11.20').first()).toBeVisible();

  await tabs.getByRole('button', { name: /^All/ }).click();
  await expect(page).not.toHaveURL(/category=/);

  const sidebar = page.locator('aside').first();
  await sidebar.getByRole('button', { name: /WineHQ/ }).click();
  await expect(page).toHaveURL(/source=winehq/);
  await expect(page.locator('main article').filter({ hasText: 'Wine 11.20' }).first()).toBeVisible();
  await expect(
    page.locator('main article').filter({ hasText: 'GamingOnLinux' }),
  ).toHaveCount(0);

  await sidebar.getByRole('button', { name: '7 days' }).click();
  await expect(page).toHaveURL(/range=7d/);
  await sidebar.getByRole('button', { name: /Reset filters/ }).click();
  await expect(page).not.toHaveURL(/category=|source=|range=/);

  expect(errors).toEqual([]);
});

test('feed search updates results and can be cleared', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');

  const search = page.locator('aside').getByPlaceholder('Search titles…');
  await search.fill('Proton');
  await expect(page).toHaveURL(/q=Proton/);
  await expect(page.getByText(/stories matching “Proton”/)).toBeVisible();
  await expect(page.locator('main article').first()).toBeVisible();

  await page.locator('aside').getByRole('button', { name: 'Clear search' }).click();
  await expect(page).not.toHaveURL(/q=/);

  expect(errors).toEqual([]);
});

test('release notes drawer opens, groups changes and closes with Escape', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/releases');

  await expect(
    page.getByRole('heading', { level: 1, name: /Release notes, decoded/i }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Read notes/ }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('link', { name: /Open original/ })).toBeVisible();
  await expect(dialog.getByRole('heading', { level: 3 }).first()).toBeVisible();
  await expect(dialog.getByText(/parsed/i).first()).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.screenshot({ path: 'test-results/screenshots/releases.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('games page filters, opens a detail drawer and keeps a watchlist', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/games');

  await expect(page.getByRole('heading', { level: 1, name: /Will it run on Linux/i })).toBeVisible();
  await expect(page.getByTestId('game-card-1245620')).toBeVisible();

  await page.getByRole('button', { name: 'Platinum' }).click();
  await expect(page).toHaveURL(/tier=platinum/);
  await expect(page.getByTestId('game-card-730')).toBeVisible();

  await page.getByRole('button', { name: 'All tiers' }).click();
  await page.getByTestId('game-card-553850').click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Compatibility history')).toBeVisible();
  await expect(dialog.getByText('Recent changes')).toBeVisible();
  await expect(dialog.getByText('Anti-cheat').first()).toBeVisible();
  await expect(dialog.getByText('Running').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await page.getByRole('button', { name: /Add HELLDIVERS/ }).click();
  await expect(page.getByRole('button', { name: /Remove HELLDIVERS/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: /Watchlist/ }).click();
  await expect(page).toHaveURL(/watch=1/);
  await expect(page.getByRole('heading', { name: 'Your watchlist' })).toBeVisible();
  await expect(page.getByTestId('game-card-553850')).toBeVisible();

  await page.screenshot({ path: 'test-results/screenshots/games.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('Steam search finds a game and prioritizes the base result', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/games');

  await page.getByLabel('Search Steam games').fill('Elden Ring');
  await page.getByRole('button', { name: 'Search Steam' }).click();
  await expect(page.getByRole('heading', { name: /Steam results for/ })).toBeVisible();

  const remoteSection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: /Steam results for/ }) });
  const remoteCards = remoteSection.locator('[data-testid^="game-card-"]');
  await expect(remoteCards.first()).toHaveAttribute('data-testid', 'game-card-1245620');

  await remoteSection.getByTestId('game-card-1245620').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');

  expect(errors).toEqual([]);
});

test('sources page shows all sources and can trigger a live refresh', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/sources');

  await expect(
    page.getByRole('heading', { level: 1, name: /Where the pulse comes from/i }),
  ).toBeVisible();
  await expect(page.getByText('WineHQ').first()).toBeVisible();
  await expect(page.getByText('ProtonDB').first()).toBeVisible();
  await expect(page.getByText('Are We Anti-Cheat Yet').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How the aggregator works' })).toBeVisible();
  await expect(page.getByText('Attribution')).toBeVisible();

  await page.getByRole('button', { name: 'Refresh now' }).click();
  await expect(
    page.getByRole('main').getByRole('button', { name: /Refreshing sources/ }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh now' })).toBeEnabled({ timeout: 20_000 });

  await page.screenshot({ path: 'test-results/screenshots/sources.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('feed error state shows a retry that recovers', async ({ page }) => {
  const errors = trackErrors(page);
  await page.route('**/api/feed?**', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'simulated feed failure' }),
    }),
  );
  await page.goto('/');
  await expect(page.getByText('simulated feed failure')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

  await page.unroute('**/api/feed?**');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('main article').first()).toBeVisible();
  expect(errors.filter((error) => !error.includes('status of 500'))).toEqual([]);
});

test('has no serious accessibility violations', async ({ page }) => {
  for (const path of ['/', '/games', '/releases', '/sources']) {
    await page.goto(path);
    await page.waitForTimeout(400);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    const serious = seriousViolations(results.violations);
    expect(
      serious,
      `${path}: ${serious.map((violation) => `${violation.id} — ${violation.help}`).join('\n')}`,
    ).toEqual([]);
  }

  await page.goto('/games?game=553850');
  await expect(page.getByRole('dialog')).toBeVisible();
  const dialogResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(seriousViolations(dialogResults.violations)).toEqual([]);
});

test.describe('mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('home and games pages do not overflow horizontally', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: /The pulse of Linux gaming compatibility/i }),
    ).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();

    await page.getByText('Filters', { exact: true }).click();
    await expect(page.locator('details').getByRole('searchbox')).toBeVisible();

    const homeOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(homeOverflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: 'test-results/screenshots/mobile.png', fullPage: true });

    await page.goto('/games');
    await expect(page.getByRole('heading', { level: 1, name: /Will it run on Linux/i })).toBeVisible();
    const gamesOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(gamesOverflow).toBeLessThanOrEqual(1);

    expect(errors).toEqual([]);
  });
});
