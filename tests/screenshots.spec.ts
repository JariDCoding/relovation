import { test } from '@playwright/test';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// Full-page screenshots of every route at a representative set of viewports, for the visual optimiser
// loop (see qa-visual-optimise-workflow.js). Output dir is configurable via QA_SHOTS_DIR so a loop can
// write "before" and "after" runs to different folders.

const routesPath = join(__dirname, 'qa-routes.json');
const pages: string[] =
  existsSync(routesPath) && readFileSync(routesPath, 'utf8').trim()
    ? JSON.parse(readFileSync(routesPath, 'utf8'))
    : ['/'];

const outDir = process.env.QA_SHOTS_DIR || 'qa-screenshots';

// One representative width per media-query band, plus the two source-of-truth viewports (430, 1440).
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '390x844', width: 390, height: 844 },
  { name: '430x932', width: 430, height: 932 }, // mobile source of truth
  { name: '768x1024', width: 768, height: 1024 },
  { name: '820x1180', width: 820, height: 1180 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1440x1024', width: 1440, height: 1024 }, // desktop source of truth
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '2560x1440', width: 2560, height: 1440 },
];

function safe(route: string): string {
  return route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '_');
}

mkdirSync(outDir, { recursive: true });

for (const pagePath of pages) {
  for (const vp of viewports) {
    test(`screenshot ${pagePath} @ ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      // Reduce flakiness: wait for fonts to settle (font swaps shift layout) before capturing.
      await page.evaluate(() => (document as any).fonts?.ready).catch(() => {});
      await page.screenshot({
        path: join(outDir, `${safe(pagePath)}__${vp.name}.png`),
        fullPage: true,
        animations: 'disabled', // freeze CSS animations/transitions for a stable, comparable shot
      });
    });
  }
}
