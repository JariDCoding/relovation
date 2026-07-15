import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Pages are auto-detected by scripts/detect-routes.mjs and written to tests/qa-routes.json.
const routesPath = join(__dirname, 'qa-routes.json');
const pages: string[] =
  existsSync(routesPath) && readFileSync(routesPath, 'utf8').trim()
    ? JSON.parse(readFileSync(routesPath, 'utf8'))
    : ['/'];

const viewports = [
  { name: 'iphone-se', width: 320, height: 568 },
  { name: 'iphone-13', width: 390, height: 844 },
  { name: 'iphone-pro-max', width: 430, height: 932 },
  { name: 'ipad-air-portrait', width: 820, height: 1180 },
];

const scales = ['112.5%', '125%', '150%'];

for (const pagePath of pages) {
  for (const viewport of viewports) {
    for (const scale of scales) {
      test(`${pagePath} remains usable at ${viewport.name} with text scale ${scale}`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        // networkidle can hang on sites with analytics, maps, chat widgets or animations,
        // so wait for DOM, then best-effort for network idle with a short timeout.
        await page.goto(pagePath, { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        await page.addStyleTag({
          content: `html { font-size: ${scale} !important; }`,
        });

        const hasHorizontalOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        expect(hasHorizontalOverflow).toBe(false);

        // Only flag REAL broken interactive controls — primary CTAs, form/nav buttons,
        // links styled as buttons — that actually CLIP their own text at this scale.
        // Deliberately NOT flagged: plain text links, footer links, skip links, hidden /
        // aria-hidden / off-screen links, icon-only controls and carousel dots. A short
        // height alone is not breakage; clipped content is.
        const brokenControls = await page.evaluate(() => {
          const out: { text: string; tag: string; width: number; height: number }[] = [];
          const candidates = document.querySelectorAll(
            'a, button, [role="button"], input[type="submit"], input[type="button"]'
          );

          candidates.forEach((el) => {
            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();

            // skip things that are not real, visible, on-screen controls
            if (rect.width === 0 || rect.height === 0) return;
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
            if (el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]')) return;
            if (rect.bottom < 0 || rect.right < 0 || rect.left >= window.innerWidth) return; // off-screen / skip links

            const text = (el.textContent || '').trim();
            if (!text) return; // icon-only controls, carousel dots

            // scope to button-like controls, not plain text links (footer/nav/inline)
            const bg = style.backgroundColor;
            const hasBg = !!bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
            const hasBorder =
              parseFloat(style.borderTopWidth) > 0 || parseFloat(style.borderBottomWidth) > 0;
            const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
            const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
            const isNativeButton =
              el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.getAttribute('role') === 'button';
            const looksLikeButton = isNativeButton || hasBg || hasBorder || (padX >= 16 && padY >= 8);
            if (!looksLikeButton) return;

            // the real failure signal: the control clips its own text at this scale
            if (el.clientHeight === 0) return; // inline element, cannot clip reliably
            const clipsY = style.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 1;
            const clipsX = style.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1;
            if (clipsY || clipsX) {
              out.push({
                text: text.slice(0, 60),
                tag: el.tagName.toLowerCase(),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              });
            }
          });

          return out;
        });

        expect(
          brokenControls,
          `Interactive controls clipping their text at ${scale}: ${JSON.stringify(brokenControls, null, 2)}`
        ).toEqual([]);
      });
    }
  }
}
