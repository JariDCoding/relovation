import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Pages are auto-detected by scripts/detect-routes.mjs and written to tests/qa-routes.json.
const routesPath = join(__dirname, 'qa-routes.json');
const pages: string[] =
  existsSync(routesPath) && readFileSync(routesPath, 'utf8').trim()
    ? JSON.parse(readFileSync(routesPath, 'utf8'))
    : ['/'];

// Widths on BOTH sides of common breakpoints. The point of this suite is to catch layouts that
// switch one pixel too early or too late — e.g. a grid that overflows at 1023 but is fine at 1024.
const edgeWidths = [
  319, 320, 374, 375, 389, 390, 429, 430, // phones
  767, 768, 819, 820, 1023, 1024,         // tablets
  1279, 1280, 1439, 1440, 1535, 1536, 1919, 1920, // laptops / desktop
];

// Pick a realistic height for each width band so the viewport resembles a real device of that class.
function heightFor(width: number): number {
  if (width <= 430) return 900; // phones
  if (width <= 1024) return 1024; // tablets
  return 900; // laptops / desktop
}

for (const pagePath of pages) {
  for (const width of edgeWidths) {
    test(`${pagePath} has no horizontal overflow at ${width}px (breakpoint edge)`, async ({ page }) => {
      await page.setViewportSize({ width, height: heightFor(width) });
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
