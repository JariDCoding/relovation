import { test, Page } from "@playwright/test";

/**
 * Screenshots voor de visuele review. Geen assertions: de suites bewijzen dat
 * niets overloopt, deze shots laten zien of het er ook goed uitziet.
 * Bewust géén fullPage — de belofte is juist dat één vraag het scherm vult.
 */

const DIR = process.env.QA_SHOTS_DIR || "qa-shots";

async function open(page: Page) {
  await page.goto("/aanvraag");
  await page.locator(".r-loader.is-gone").waitFor({ state: "attached", timeout: 10_000 });
  await page.waitForTimeout(250);
}

async function kies(page: Page, naam: string, waarde: string) {
  await page.locator(`input[name="${naam}"][value="${waarde}"] + .opt__card`).click();
}

async function volgende(page: Page) {
  await page.locator(".screen.is-active [data-next]").click();
  await page.waitForTimeout(500);
}

const viewports = [
  { name: "mobiel-390x844", width: 390, height: 844 },
  { name: "desktop-1440x1024", width: 1440, height: 1024 },
];

for (const vp of viewports) {
  test(`shots ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);

    const shot = (naam: string) => page.screenshot({ path: `${DIR}/${vp.name}-${naam}.png` });

    await shot("00-opening");

    await page.getByRole("button", { name: /Beginnen/ }).click();
    await page.waitForTimeout(500);
    await shot("01-event");

    await kies(page, "event_type", "Trouwfeest");
    await page.waitForTimeout(700); // auto-advance
    await shot("02-moment");

    await kies(page, "moment", "Ceremonie");
    await kies(page, "moment", "Receptie / welkomstdrink");
    await volgende(page);
    await shot("03-sfeer");

    // Op het maximum: de rest dimt zichtbaar.
    await kies(page, "sfeer", "Warm en intiem");
    await kies(page, "sfeer", "Classy en professioneel");
    await shot("03-sfeer-max2");

    await volgende(page);
    await shot("04-datum");

    await page.locator("#datum_flexibel").check();
    await page.waitForTimeout(400);
    await shot("04-datum-periode");

    await page.locator("#datum_flexibel").uncheck();
    await page.locator("#datum").fill("2026-09-14");
    await volgende(page);
    await shot("05-locatie");

    await page.locator("#locatie").fill("Antwerpen");
    await volgende(page);
    await shot("06-gasten");

    await kies(page, "gasten", "80 – 150");
    await page.waitForTimeout(700);
    await shot("07-contact");

    // Validatiefouten in beeld.
    await volgende(page);
    await page.waitForTimeout(300);
    await shot("07-contact-fouten");

    await page.locator("#voornaam").fill("Jan");
    await page.locator("#achternaam").fill("Janssen");
    await page.locator("#email").fill("jan@example.com");
    await page.locator("#telefoon").fill("+32 470 12 34 56");
    await volgende(page);
    await shot("08-voorkeur");

    await kies(page, "voorkeur_contact", "WhatsApp");
    await page.waitForTimeout(700);
    await shot("09-bericht");

    // Bevestiging met de future-pacing stappen.
    await page.route("**/api/aanvraag", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' })
    );
    await page.locator("#privacy").check();
    await page.getByRole("button", { name: "Vraag uw voorstel aan" }).click();
    await page.waitForTimeout(700);
    await shot("10-bevestiging");
  });
}
