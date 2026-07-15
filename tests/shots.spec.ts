import { test, Page } from "@playwright/test";

/**
 * Screenshots voor de visuele review. Geen assertions: de automatische suites
 * bewijzen dat niets overloopt, deze shots laten zien of het er ook goed uitziet.
 * Bron van waarheid: 430x932 (mobiel) en 1440x1024 (desktop).
 */

const DIR = process.env.QA_SHOTS_DIR || "qa-shots";

async function open(page: Page) {
  await page.goto("/aanvraag");
  await page.locator(".r-loader.is-done, .r-loader.is-gone").waitFor({ timeout: 10_000 });
}

async function kies(page: Page, naam: string, waarde: string) {
  await page.locator(`input[name="${naam}"][value="${waarde}"] + .opt__card`).click();
}

const viewports = [
  { name: "mobiel-430x932", width: 430, height: 932 },
  { name: "mobiel-klein-320x568", width: 320, height: 568 },
  { name: "desktop-1440x1024", width: 1440, height: 1024 },
];

for (const vp of viewports) {
  test(`shots ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);

    await page.screenshot({ path: `${DIR}/${vp.name}-stap1.png`, fullPage: true });

    // Q3 op zijn maximum: laat zien dat de rest zichtbaar dimt.
    await kies(page, "sfeer", "Warm en intiem");
    await kies(page, "sfeer", "Classy en professioneel");
    await page.screenshot({ path: `${DIR}/${vp.name}-stap1-max2.png`, fullPage: true });

    await kies(page, "event_type", "Trouwfeest");
    await kies(page, "moment", "Ceremonie");
    await page.getByRole("button", { name: /Volgende: praktische info/ }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/${vp.name}-stap2.png`, fullPage: true });

    // Conditionele periodekeuze.
    await page.locator("#datum_flexibel").check();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${DIR}/${vp.name}-stap2-periode.png`, fullPage: true });

    await page.locator("#datum_flexibel").uncheck();
    await page.locator("#datum").fill("2026-09-14");
    await page.locator("#locatie").fill("Antwerpen");
    await kies(page, "gasten", "80 – 150");
    await page.getByRole("button", { name: /Volgende: uw gegevens/ }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/${vp.name}-stap3.png`, fullPage: true });

    // Validatiefouten in beeld.
    await page.getByRole("button", { name: "Vraag uw voorstel aan" }).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/${vp.name}-stap3-fouten.png`, fullPage: true });

    // Bevestiging met de future-pacing stappen.
    await page.evaluate(() => {
      document.getElementById("aanvraag-form")!.setAttribute("hidden", "");
      document.getElementById("aanvraag-done")!.removeAttribute("hidden");
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${DIR}/${vp.name}-bevestiging.png`, fullPage: true });
  });
}
