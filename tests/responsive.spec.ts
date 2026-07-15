import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Pages are auto-detected by scripts/detect-routes.mjs and written to tests/qa-routes.json.
// Falls back to the homepage if detection produced nothing.
const routesPath = join(__dirname, 'qa-routes.json');
const pages: string[] =
  existsSync(routesPath) && readFileSync(routesPath, 'utf8').trim()
    ? JSON.parse(readFileSync(routesPath, 'utf8'))
    : ['/'];

const viewports = [
  // Mobile
  { name: 'iphone-se', width: 320, height: 568 },
  { name: 'android-small', width: 360, height: 800 },
  { name: 'iphone-compact', width: 375, height: 812 },
  { name: 'iphone-13', width: 390, height: 844 },
  { name: 'android-common', width: 393, height: 873 },
  { name: 'iphone-large', width: 414, height: 896 },
  { name: 'iphone-pro-max', width: 430, height: 932 },

  // Tablet portrait
  { name: 'ipad-mini-portrait', width: 768, height: 1024 },
  { name: 'ipad-portrait', width: 810, height: 1080 },
  { name: 'ipad-air-portrait', width: 820, height: 1180 },
  { name: 'ipad-pro-11-portrait', width: 834, height: 1194 },
  { name: 'ipad-pro-12-9-portrait', width: 1024, height: 1366 },

  // Tablet landscape
  { name: 'ipad-mini-landscape', width: 1024, height: 768 },
  { name: 'ipad-landscape', width: 1080, height: 810 },
  { name: 'ipad-air-landscape', width: 1180, height: 820 },
  { name: 'ipad-pro-11-landscape', width: 1194, height: 834 },
  { name: 'ipad-pro-12-9-landscape', width: 1366, height: 1024 },

  // Desktop
  { name: 'desktop-1280', width: 1280, height: 720 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'desktop-1440-900', width: 1440, height: 900 },
  { name: 'desktop-1440-1024', width: 1440, height: 1024 },
  { name: 'desktop-1536', width: 1536, height: 864 },
  { name: 'desktop-1600', width: 1600, height: 900 },
  { name: 'desktop-1728', width: 1728, height: 1117 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
  { name: 'desktop-2560', width: 2560, height: 1440 },
];

for (const pagePath of pages) {
  for (const viewport of viewports) {
    test(`${pagePath} has no horizontal overflow at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      // networkidle can hang on sites with analytics, maps, chat widgets or animations,
      // so wait for DOM, then best-effort for network idle with a short timeout.
      await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      expect(hasHorizontalOverflow).toBe(false);
    });
  }
}
