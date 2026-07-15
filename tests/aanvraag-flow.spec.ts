import { test, expect, Page } from "@playwright/test";

/**
 * De aanvraagflow op /aanvraag. De generieke QA-suites zien alleen stap 1,
 * omdat stap 2 en 3 pas verschijnen na "Volgende". Deze spec loopt de flow
 * echt door en test daarnaast de conditionele logica uit de briefing.
 */

const viewports = [
  { name: "iphone-se", width: 320, height: 568 },
  { name: "iphone-13", width: 390, height: 844 },
  { name: "iphone-pro-max", width: 430, height: 932 },
  { name: "ipad-portrait", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 1024 },
  { name: "ultrawide", width: 2560, height: 1440 },
];

/**
 * De loader ligt als `position:fixed; inset:0; z-index:9999` over de pagina en
 * vangt minstens 1,1s lang elke klik op. Zonder deze wait klikt elke test op
 * de loader in plaats van op het formulier.
 */
async function wachtOpLoader(page: Page) {
  await page.locator(".r-loader.is-done, .r-loader.is-gone").waitFor({ timeout: 10_000 });
}

async function open(page: Page, pad = "/aanvraag") {
  await page.goto(pad);
  await wachtOpLoader(page);
}

/**
 * Klikt op de zichtbare keuzekaart. De input zelf is 1px en opacity:0 — daar
 * rechtstreeks op klikken raakt het label eroverheen.
 */
async function kies(page: Page, naam: string, waarde: string) {
  await page.locator(`input[name="${naam}"][value="${waarde}"] + .opt__card`).click();
}

async function geenHorizontaleScroll(page: Page, waar: string) {
  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    return { scroll: d.scrollWidth, client: d.clientWidth };
  });
  expect(
    overflow.scroll,
    `${waar}: horizontale overflow (${overflow.scroll}px in ${overflow.client}px)`
  ).toBeLessThanOrEqual(overflow.client + 1);
}

/** Vult stap 1 volledig in. */
async function vulStap1(page: Page) {
  await kies(page, "event_type", "Trouwfeest");
  await kies(page, "moment", "Ceremonie");
  await kies(page, "sfeer", "Warm en intiem");
}

/** Vult stap 2 volledig in. */
async function vulStap2(page: Page) {
  await page.locator("#datum").fill("2026-09-14");
  await page.locator("#locatie").fill("Antwerpen");
  await kies(page, "gasten", "80 – 150");
}

test.describe("aanvraagflow — alle drie de stappen", () => {
  for (const vp of viewports) {
    test(`${vp.name} (${vp.width}x${vp.height}): flow doorlopen zonder overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await open(page);

      // Stap 1
      await expect(page.locator('.step[data-step="1"]')).toBeVisible();
      await expect(page.locator('.step[data-step="2"]')).toBeHidden();
      await geenHorizontaleScroll(page, `${vp.name} stap 1`);

      await vulStap1(page);
      await page.getByRole("button", { name: /Volgende: praktische info/ }).click();

      // Stap 2
      await expect(page.locator('.step[data-step="2"]')).toBeVisible();
      await expect(page.locator('.step[data-step="1"]')).toBeHidden();
      await expect(page.locator("#progress-step")).toHaveText("Stap 2 van 3");
      await geenHorizontaleScroll(page, `${vp.name} stap 2`);

      await vulStap2(page);
      await page.getByRole("button", { name: /Volgende: uw gegevens/ }).click();

      // Stap 3
      await expect(page.locator('.step[data-step="3"]')).toBeVisible();
      await expect(page.locator("#progress-step")).toHaveText("Stap 3 van 3");
      await geenHorizontaleScroll(page, `${vp.name} stap 3`);

      // De verzendknop moet volledig zichtbaar en aanklikbaar zijn.
      const submit = page.getByRole("button", { name: "Vraag uw voorstel aan" });
      await expect(submit).toBeVisible();
      const box = await submit.boundingBox();
      expect(box, `${vp.name}: verzendknop heeft geen afmeting`).not.toBeNull();
      expect(box!.height, `${vp.name}: verzendknop te klein voor een tapdoel`).toBeGreaterThanOrEqual(44);
      expect(box!.x, `${vp.name}: verzendknop links buiten beeld`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `${vp.name}: verzendknop rechts buiten beeld`).toBeLessThanOrEqual(vp.width + 1);
    });
  }
});

test.describe("validatie", () => {
  test("stap 1 blokkeert bij lege verplichte vragen en toont de reden", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: /Volgende: praktische info/ }).click();

    await expect(page.locator('.step[data-step="1"]')).toBeVisible();
    await expect(page.locator('.step[data-step="2"]')).toBeHidden();
    await expect(page.locator(".field-error").first()).toBeVisible();
    await expect(page.locator('[data-q="event_type"] .field-error')).toHaveText("Kies wat u organiseert.");
  });

  test("fout verdwijnt zodra de vraag beantwoord wordt", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: /Volgende: praktische info/ }).click();
    await expect(page.locator('[data-q="event_type"] .field-error')).toBeVisible();

    await kies(page, "event_type", "Trouwfeest");
    await expect(page.locator('[data-q="event_type"] .field-error')).toHaveCount(0);
  });

  test("verzendknop is nooit uitgegrijsd — klikken zegt wat er ontbreekt", async ({ page }) => {
    await open(page);
    await vulStap1(page);
    await page.getByRole("button", { name: /Volgende: praktische info/ }).click();
    await vulStap2(page);
    await page.getByRole("button", { name: /Volgende: uw gegevens/ }).click();

    const submit = page.getByRole("button", { name: "Vraag uw voorstel aan" });
    await expect(submit).toBeEnabled();

    await submit.click();
    await expect(page.locator('[data-q="naam"] .field-error')).toHaveText("Vul uw naam in.");
    await expect(page.locator('[data-q="privacy"] .field-error')).toBeVisible();
  });
});

test.describe("conditionele logica uit de briefing", () => {
  test('Q2: "Nog niet zeker" is exclusief en werkt beide kanten op', async ({ page }) => {
    await open(page);

    const ceremonie = page.locator('input[name="moment"][value="Ceremonie"]');
    const advies = page.locator('input[name="moment"][value="Nog niet zeker, graag advies"]');

    await kies(page, "moment", "Ceremonie");
    await kies(page, "moment", "Nog niet zeker, graag advies");
    await expect(ceremonie, "Nog niet zeker moet de rest uitvinken").not.toBeChecked();

    await kies(page, "moment", "Ceremonie");
    await expect(advies, "een gewone optie moet Nog niet zeker uitvinken").not.toBeChecked();
  });

  test("Q3: maximaal 2 keuzes, de rest dimt zichtbaar", async ({ page }) => {
    await open(page);

    const teller = page.locator('[data-q="sfeer"] [data-counter]');
    await expect(teller).toHaveText("0 van 2 gekozen");

    await kies(page, "sfeer", "Warm en intiem");
    await expect(teller).toHaveText("1 van 2 gekozen");

    await kies(page, "sfeer", "Classy en professioneel");
    await expect(teller).toHaveText("2 van 2 gekozen");

    // Op het maximum: niet-gekozen kaarten zijn geblokkeerd en zichtbaar gedimd.
    const geblokkeerd = page.locator('[data-q="sfeer"] .opt.is-blocked');
    await expect(geblokkeerd).toHaveCount(4);
    await expect(page.locator('input[name="sfeer"][value="Feestelijk en herkenbaar"]')).toBeDisabled();

    // Eentje weghalen geeft de rest weer vrij.
    await kies(page, "sfeer", "Warm en intiem");
    await expect(teller).toHaveText("1 van 2 gekozen");
    await expect(page.locator('[data-q="sfeer"] .opt.is-blocked')).toHaveCount(0);
  });

  test("Q4: datum-checkbox wisselt naar de periodekeuze", async ({ page }) => {
    await open(page);
    await vulStap1(page);
    await page.getByRole("button", { name: /Volgende: praktische info/ }).click();

    await expect(page.locator("#periode-blok")).toBeHidden();
    await expect(page.locator("#datum")).toBeVisible();

    await page.locator("#datum").fill("2026-09-14");
    await page.locator("#datum_flexibel").check();

    await expect(page.locator("#periode-blok")).toBeVisible();
    await expect(page.locator("#datum")).toBeHidden();
    await expect(page.locator("#datum"), "datum moet gewist worden bij flexibel").toHaveValue("");

    // Zonder periode mag stap 2 niet door.
    await page.locator("#locatie").fill("Gent");
    await kies(page, "gasten", "Nog niet zeker");
    await page.getByRole("button", { name: /Volgende: uw gegevens/ }).click();
    await expect(page.locator('[data-q="datum"] .field-error')).toBeVisible();

    await kies(page, "periode", "Najaar");
    await page.getByRole("button", { name: /Volgende: uw gegevens/ }).click();
    await expect(page.locator('.step[data-step="3"]')).toBeVisible();
  });
});

test.describe("terug en herstel", () => {
  test("terug behoudt de antwoorden", async ({ page }) => {
    await open(page);
    await vulStap1(page);
    await page.getByRole("button", { name: /Volgende: praktische info/ }).click();
    await page.getByRole("button", { name: /Terug/ }).click();

    await expect(page.locator('.step[data-step="1"]')).toBeVisible();
    await expect(page.locator('input[name="event_type"][value="Trouwfeest"]')).toBeChecked();
    await expect(page.locator('input[name="moment"][value="Ceremonie"]')).toBeChecked();
  });

  test("na een refresh staan de antwoorden en de stap er nog", async ({ page }) => {
    await open(page);
    await vulStap1(page);
    await page.getByRole("button", { name: /Volgende: praktische info/ }).click();
    await page.locator("#locatie").fill("Antwerpen");

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("#progress-step")).toHaveText("Stap 2 van 3");
    await expect(page.locator("#locatie")).toHaveValue("Antwerpen");
    await expect(page.locator('.step[data-step="2"]')).toBeVisible();
  });
});

test.describe("verzenden", () => {
  /** Vult stap 3 en verstuurt. Het endpoint wordt gemockt: geen echte mail. */
  async function totEnMetVerzenden(page: Page, antwoord: object, status = 200) {
    await page.route("**/api/aanvraag", (route) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(antwoord) })
    );
    await open(page);
    await vulStap1(page);
    await page.getByRole("button", { name: /Volgende: praktische info/ }).click();
    await vulStap2(page);
    await page.getByRole("button", { name: /Volgende: uw gegevens/ }).click();
    await page.locator("#naam").fill("Jan Janssen");
    await page.locator("#email").fill("jan@example.com");
    await page.locator("#telefoon").fill("+32 470 12 34 56");
    await page.locator("#privacy").check();
    await page.getByRole("button", { name: "Vraag uw voorstel aan" }).click();
  }

  test("succes toont de bevestiging en verbergt de tegenstrijdige kop", async ({ page }) => {
    await totEnMetVerzenden(page, { ok: true });

    await expect(page.locator("#aanvraag-done")).toBeVisible();
    await expect(page.locator("#aanvraag-form")).toBeHidden();
    await expect(
      page.locator(".aanvraag__head"),
      '"Beantwoord enkele korte vragen" mag niet boven "Bedankt" blijven staan'
    ).toBeHidden();
    await expect(page.locator(".done__title")).toHaveText("Bedankt voor uw aanvraag");
    await expect(page.locator(".done__next li")).toHaveCount(3);
  });

  test("de verstuurde payload bevat alle antwoorden", async ({ page }) => {
    let payload: any = null;
    await page.route("**/api/aanvraag", async (route) => {
      payload = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
    });
    await open(page);
    await vulStap1(page);
    await page.getByRole("button", { name: /Volgende: praktische info/ }).click();
    await vulStap2(page);
    await page.getByRole("button", { name: /Volgende: uw gegevens/ }).click();
    await page.locator("#naam").fill("Jan Janssen");
    await page.locator("#email").fill("jan@example.com");
    await page.locator("#telefoon").fill("+32 470 12 34 56");
    await page.locator("#privacy").check();
    await page.getByRole("button", { name: "Vraag uw voorstel aan" }).click();
    await expect(page.locator("#aanvraag-done")).toBeVisible();

    expect(payload).toMatchObject({
      event_type: "Trouwfeest",
      moment: "Ceremonie",
      sfeer: "Warm en intiem",
      datum: "2026-09-14",
      locatie: "Antwerpen",
      gasten: "80 – 150",
      naam: "Jan Janssen",
      email: "jan@example.com",
      privacy: "ja",
    });
  });

  test("serverfout laat de antwoorden staan en legt uit wat te doen", async ({ page }) => {
    await totEnMetVerzenden(page, { ok: false, error: "send_failed" }, 502);

    await expect(page.locator(".form-status")).toBeVisible();
    await expect(page.locator(".form-status")).toContainText("info@relovation.be");
    await expect(page.locator("#aanvraag-done")).toBeHidden();
    await expect(page.locator("#naam"), "ingevulde velden mogen niet gewist worden").toHaveValue("Jan Janssen");
  });

  test("veldfouten van de server komen bij de juiste vraag terecht", async ({ page }) => {
    await totEnMetVerzenden(page, { ok: false, errors: { email: "Dit lijkt geen geldig e-mailadres." } }, 400);

    await expect(page.locator('[data-q="email"] .field-error')).toHaveText("Dit lijkt geen geldig e-mailadres.");
    await expect(page.locator("#aanvraag-done")).toBeHidden();
  });
});

test.describe("zonder JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("alle drie de stappen staan onder elkaar en het formulier is verzendbaar", async ({ page }) => {
    // Geen open() hier: zonder JS draait loader.js niet, dus de overlay krijgt
    // nooit is-done. De <noscript>-regel verbergt hem — dat testen we hieronder.
    await page.goto("/aanvraag");

    await expect(
      page.locator(".r-loader"),
      "de loader-overlay moet zonder JS verborgen zijn, anders is de pagina onbereikbaar"
    ).toBeHidden();

    await expect(page.locator('.step[data-step="1"]')).toBeVisible();
    await expect(page.locator('.step[data-step="2"]')).toBeVisible();
    await expect(page.locator('.step[data-step="3"]')).toBeVisible();

    // Voortgang en stapknoppen zijn zinloos zonder JS en moeten weg zijn.
    await expect(page.locator("#progress")).toBeHidden();
    await expect(page.locator(".step__nav").first()).toBeHidden();
    await expect(page.getByRole("button", { name: "Vraag uw voorstel aan" })).toBeVisible();

    await geenHorizontaleScroll(page, "zonder JS");
  });
});
