import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Pages are auto-detected by scripts/detect-routes.mjs and written to tests/qa-routes.json.
const routesPath = join(__dirname, 'qa-routes.json');
const pages: string[] =
  existsSync(routesPath) && readFileSync(routesPath, 'utf8').trim()
    ? JSON.parse(readFileSync(routesPath, 'utf8'))
    : ['/'];

// Some a11y issues (mobile menus, hidden nav, accordions, sticky CTAs) only surface at mobile width,
// so run axe on both a mobile and a desktop viewport instead of the default only.
const viewports = [
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'desktop-1440x1024', width: 1440, height: 1024 },
];

for (const pagePath of pages) {
  for (const viewport of viewports) {
    test(`${pagePath} has no serious accessibility violations at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      // networkidle can hang on sites with analytics, maps, chat widgets or animations,
      // so wait for DOM, then best-effort for network idle with a short timeout.
      await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const seriousViolations = results.violations.filter((violation) =>
        ['serious', 'critical'].includes(violation.impact || '')
      );

      expect(seriousViolations).toEqual([]);
    });
  }
}
