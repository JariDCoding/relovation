import { test, expect, Page } from "@playwright/test";

/**
 * De aanvraagflow op /aanvraag: negen vragen, één per scherm, gegroepeerd in
 * de drie stappen uit de briefing. De generieke QA-suites zien alleen het
 * openingsscherm, dus deze spec loopt de flow echt door.
 *
 * De kerneis van Jari: elke vraag past binnen één viewport, zonder scrollen.
 * Dat wordt hieronder gemeten, niet aangenomen.
 */

/**
 * Het no-scroll-contract geldt vanaf 390px breed — elke telefoon van de
 * afgelopen jaren. Op een 320x568-scherm (iPhone SE 1e generatie) is het
 * fysiek onmogelijk: 492px bruikbare hoogte, en zes keuzekaarten van 44px
 * (de minimale tapdoelnorm) passen daar met vraag, voortgang en knop niet in.
 * Kleiner maken zou de tapdoelen onder de toegankelijkheidsnorm duwen. Dat
 * scherm wordt hieronder apart getest op bruikbaarheid in plaats van op fit.
 */
const viewports = [
  { name: "iphone-13", width: 390, height: 844 },
  { name: "iphone-pro-max", width: 430, height: 932 },
  { name: "ipad-portrait", width: 768, height: 1024 },
  { name: "laptop", width: 1440, height: 900 },
  { name: "desktop", width: 1440, height: 1024 },
  { name: "ultrawide", width: 2560, height: 1440 },
];

/**
 * De loader ligt als `position:fixed; inset:0; z-index:9999` over de pagina en
 * vangt minstens 1,1s lang elke klik op. Zonder deze wait klikt elke test op
 * de loader in plaats van op het formulier.
 */
async function open(page: Page, pad = "/aanvraag") {
  await page.goto(pad);
  await page.locator(".r-loader.is-done, .r-loader.is-gone").waitFor({ timeout: 10_000 });
}

/** Klikt op de zichtbare keuzekaart; de input zelf is 1px en opacity:0. */
async function kies(page: Page, naam: string, waarde: string) {
  await page.locator(`input[name="${naam}"][value="${waarde}"] + .opt__card`).click();
}

/**
 * Kiest een datum in de gebrande kalender. Het native #datum-veld is met JS
 * verborgen (het draagt alleen nog de waarde), dus daar rechtstreeks in vullen
 * kan niet meer.
 */
async function kiesDatum(page: Page) {
  await page.locator(".kal__dag:not(:disabled)").first().click();
}

async function volgende(page: Page) {
  await page.locator(".screen.is-active [data-next]").click();
}

async function geenScroll(page: Page, waar: string) {
  const m = await page.evaluate(() => {
    const d = document.documentElement;
    return {
      scrollH: d.scrollHeight,
      clientH: d.clientHeight,
      scrollW: d.scrollWidth,
      clientW: d.clientWidth,
    };
  });
  expect(m.scrollW, `${waar}: horizontale overflow`).toBeLessThanOrEqual(m.clientW + 1);
  return m;
}

test.describe("vergrendelde viewport: de pagina scrollt nooit", () => {
  for (const vp of viewports) {
    test(`${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await open(page);

      const meting: string[] = [];

      for (let n = 1; n <= 9; n++) {
        const actief = page.locator(".screen.is-active");
        await expect(actief).toHaveAttribute("data-screen", String(n));

        const m = await geenScroll(page, `${vp.name} vraag ${n}`);

        // 1. De pagina zelf mag nooit scrollen — dat is de vergrendeling.
        expect(
          m.scrollH,
          `${vp.name} vraag ${n}: de pagina is ${m.scrollH}px hoog in een venster van ${m.clientH}px — de vergrendeling lekt`
        ).toBeLessThanOrEqual(m.clientH + 1);

        // 2. Het vraaggebied mag zijn vangnet niet nodig hebben: op deze
        //    schermen hoort alles gewoon te passen.
        const stage = await page.locator("#stage").evaluate((el) => ({
          scroll: el.scrollHeight,
          client: el.clientHeight,
        }));
        meting.push(`  vraag ${n}: vraaggebied ${stage.scroll}px / ${stage.client}px`);

        expect(
          stage.scroll,
          `${vp.name} vraag ${n}: het vraaggebied is ${stage.scroll}px in ${stage.client}px — er moet gescrold worden`
        ).toBeLessThanOrEqual(stage.client + 1);

        // Vullen en door.
        if (n === 1) await kies(page, "event_type", "Trouwfeest");
        else if (n === 2) { await kies(page, "moment", "Ceremonie"); await volgende(page); }
        else if (n === 3) { await kies(page, "sfeer", "Warm en intiem"); await volgende(page); }
        else if (n === 4) { await kiesDatum(page); await volgende(page); }
        else if (n === 5) { await page.locator("#locatie").fill("Antwerpen"); await volgende(page); }
        else if (n === 6) await kies(page, "gasten", "80 – 150");
        else if (n === 7) {
          await page.locator("#voornaam").fill("Jan");
          await page.locator("#achternaam").fill("Janssen");
          await page.locator("#email").fill("jan@example.com");
          await page.locator("#telefoon").fill("+32 470 12 34 56");
          await volgende(page);
        } else if (n === 8) await kies(page, "voorkeur_contact", "WhatsApp");
        else if (n === 9) {
          await page.locator("#privacy").check();
          await expect(page.getByRole("button", { name: "Vraag uw voorstel aan" })).toBeVisible();
        }
      }

      console.log(`\n${vp.name} (${vp.width}x${vp.height}):\n${meting.join("\n")}`);
    });
  }
});

test.describe("iPhone SE (320x568) — scrollt, maar blijft bruikbaar", () => {
  test("geen horizontale scroll en alle tapdoelen halen 44px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page);

    for (let n = 1; n <= 3; n++) {
      await geenScroll(page, `iphone-se vraag ${n}`);

      // Tapdoelen mogen nooit onder de norm zakken, ook niet om te laten passen.
      const kaarten = page.locator(".screen.is-active .opt__card");
      const aantal = await kaarten.count();
      for (let i = 0; i < aantal; i++) {
        const box = await kaarten.nth(i).boundingBox();
        expect(
          box!.height,
          `iphone-se vraag ${n}, kaart ${i + 1}: ${Math.round(box!.height)}px is onder de 44px-tapdoelnorm`
        ).toBeGreaterThanOrEqual(44);
      }

      if (n === 1) await kies(page, "event_type", "Trouwfeest");
      else if (n === 2) { await kies(page, "moment", "Ceremonie"); await volgende(page); }
      else if (n === 3) { await kies(page, "sfeer", "Warm en intiem"); await volgende(page); }
    }

    await expect(page.locator('.screen[data-screen="4"]')).toBeVisible();
  });

  test("de knop blijft bereikbaar via de interne overloop van het vraaggebied", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page);
    await kies(page, "event_type", "Trouwfeest");
    await expect(page.locator('.screen[data-screen="2"]')).toBeVisible();

    // De pagina blijft vergrendeld; het vraaggebied vangt de overloop op.
    const m = await geenScroll(page, "iphone-se vangnet");
    expect(m.scrollH, "de pagina mag ook hier niet scrollen").toBeLessThanOrEqual(m.clientH + 1);

    const knop = page.locator(".screen.is-active [data-next]");
    await knop.scrollIntoViewIfNeeded();
    await expect(knop).toBeInViewport();
  });
});

test.describe("automatisch door bij enkele keuze", () => {
  test("vraag 1 springt vanzelf naar vraag 2", async ({ page }) => {
    await open(page);
    await kies(page, "event_type", "Trouwfeest");

    // Even zichtbaar blijven, dan door — daar is de pauze voor.
    await expect(page.locator('.screen[data-screen="2"]')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.screen[data-screen="1"]')).toBeHidden();
  });

  test("vraag 2 en 3 springen NIET vanzelf door — daar mag je meerdere kiezen", async ({ page }) => {
    await open(page);
    await kies(page, "event_type", "Trouwfeest");
    await expect(page.locator('.screen[data-screen="2"]')).toBeVisible();

    await kies(page, "moment", "Ceremonie");
    await page.waitForTimeout(900);
    await expect(
      page.locator('.screen[data-screen="2"]'),
      "meerkeuze mag niet wegspringen: je bent misschien nog niet klaar"
    ).toBeVisible();
  });
});

test.describe("voortgang", () => {
  test("toont de juiste stap en telling per vraag", async ({ page }) => {
    await open(page);
    await expect(page.locator("#progress"), "voortgang staat er meteen").toBeVisible();
    await expect(page.locator("#progress-chapter")).toContainText("Stap 1 van 3");
    await expect(page.locator("#progress-chapter")).toContainText("Event & muziek");
    await expect(page.locator("#progress-count")).toHaveText("Vraag 1 van 9");

    await kies(page, "event_type", "Trouwfeest");
    await expect(page.locator("#progress-count")).toHaveText("Vraag 2 van 9");

    await kies(page, "moment", "Ceremonie");
    await volgende(page);
    await kies(page, "sfeer", "Warm en intiem");
    await volgende(page);

    await expect(page.locator("#progress-chapter")).toContainText("Stap 2 van 3");
    await expect(page.locator("#progress-chapter")).toContainText("Praktische info");
    await expect(page.locator("#progress-count")).toHaveText("Vraag 4 van 9");
    await expect(page.locator('.progress__seg[data-seg="1"]')).toHaveClass(/is-done/);
  });
});

test.describe("validatie", () => {
  test("vraag 2 blokkeert bij geen keuze en zegt waarom", async ({ page }) => {
    await open(page);
    await kies(page, "event_type", "Trouwfeest");
    await expect(page.locator('.screen[data-screen="2"]')).toBeVisible();

    await volgende(page);
    await expect(page.locator('.screen[data-screen="2"]')).toBeVisible();
    await expect(page.locator('.screen[data-screen="2"] .field-error')).toContainText("Kies minstens één moment");
  });

  test("contactscherm meldt per veld wat er ontbreekt", async ({ page }) => {
    await open(page);
    await kies(page, "event_type", "Trouwfeest");
    await kies(page, "moment", "Ceremonie");
    await volgende(page);
    await kies(page, "sfeer", "Warm en intiem");
    await volgende(page);
    await kiesDatum(page);
    await volgende(page);
    await page.locator("#locatie").fill("Antwerpen");
    await volgende(page);
    await kies(page, "gasten", "80 – 150");
    await expect(page.locator('.screen[data-screen="7"]')).toBeVisible();

    await page.locator("#email").fill("nietgeldig");
    await volgende(page);

    await expect(page.locator('.screen[data-screen="7"]')).toBeVisible();
    await expect(page.locator(".field-error").first()).toContainText("Vul uw voornaam in");
  });

  test("fout verdwijnt zodra je het veld corrigeert", async ({ page }) => {
    await open(page);
    await kies(page, "event_type", "Trouwfeest");
    await kies(page, "moment", "Ceremonie");
    await volgende(page);
    await kies(page, "sfeer", "Warm en intiem");
    await volgende(page);
    await kiesDatum(page);
    await volgende(page);

    await volgende(page); // locatie leeg
    await expect(page.locator(".field-error")).toBeVisible();
    await page.locator("#locatie").fill("Gent");
    await expect(page.locator(".field-error")).toHaveCount(0);
  });
});

test.describe("conditionele logica uit de briefing", () => {
  test('vraag 2: "Nog niet zeker" is exclusief en werkt beide kanten op', async ({ page }) => {
    await open(page);
    await kies(page, "event_type", "Trouwfeest");

    const ceremonie = page.locator('input[name="moment"][value="Ceremonie"]');
    const advies = page.locator('input[name="moment"][value="Nog niet zeker, graag advies"]');

    await kies(page, "moment", "Ceremonie");
    await kies(page, "moment", "Nog niet zeker, graag advies");
    await expect(ceremonie).not.toBeChecked();

    await kies(page, "moment", "Ceremonie");
    await expect(advies).not.toBeChecked();
  });

  test("vraag 3: maximaal 2 keuzes, de rest dimt zichtbaar", async ({ page }) => {
    await open(page);
    await kies(page, "event_type", "Trouwfeest");
    await kies(page, "moment", "Ceremonie");
    await volgende(page);

    const teller = page.locator("[data-counter]");
    await expect(teller).toHaveText("0 van 2 gekozen");

    await kies(page, "sfeer", "Warm en intiem");
    await expect(teller).toHaveText("1 van 2 gekozen");
    await kies(page, "sfeer", "Classy en professioneel");
    await expect(teller).toHaveText("2 van 2 gekozen");

    await expect(page.locator('.screen[data-screen="3"] .opt.is-blocked')).toHaveCount(4);
    await expect(page.locator('input[name="sfeer"][value="Feestelijk en herkenbaar"]')).toBeDisabled();

    await kies(page, "sfeer", "Warm en intiem");
    await expect(teller).toHaveText("1 van 2 gekozen");
    await expect(page.locator('.screen[data-screen="3"] .opt.is-blocked')).toHaveCount(0);
  });

  test("vraag 4: datum-checkbox wisselt naar de periodekeuze", async ({ page }) => {
    await open(page);
    await kies(page, "event_type", "Trouwfeest");
    await kies(page, "moment", "Ceremonie");
    await volgende(page);
    await kies(page, "sfeer", "Warm en intiem");
    await volgende(page);

    await expect(page.locator("#periode-blok")).toBeHidden();
    await expect(page.locator("#kalender"), "de gebrande kalender staat er, niet de native kiezer").toBeVisible();
    await expect(page.locator("#datum"), "het native veld is met JS alleen nog waardehouder").toBeHidden();

    await kiesDatum(page);
    await expect(page.locator("#datum")).not.toHaveValue("");

    await page.locator("#datum_flexibel").check();
    await expect(page.locator("#periode-blok")).toBeVisible();
    await expect(page.locator("#kalender"), "kalender verdwijnt als de datum niet vastligt").toBeHidden();
    await expect(page.locator("#datum"), "datum moet gewist worden bij flexibel").toHaveValue("");

    await volgende(page);
    await expect(page.locator(".field-error"), "zonder periode mag je niet door").toBeVisible();

    await kies(page, "periode", "Najaar");
    await volgende(page);
    await expect(page.locator('.screen[data-screen="5"]')).toBeVisible();
  });
});

test.describe("gebrande kalender", () => {
  async function naarDatum(page: Page) {
    await open(page);
    await kies(page, "event_type", "Trouwfeest");
    await kies(page, "moment", "Ceremonie");
    await volgende(page);
    await kies(page, "sfeer", "Warm en intiem");
    await volgende(page);
    await expect(page.locator('.screen[data-screen="4"]')).toBeVisible();
  }

  test("de native systeemkiezer is vervangen door de eigen kalender", async ({ page }) => {
    await naarDatum(page);
    await expect(page.locator("#kalender")).toBeVisible();
    await expect(
      page.locator("#datum"),
      "het native veld mag niet zichtbaar zijn: dat is de blauw/witte systeem-UI"
    ).toBeHidden();
    await expect(page.locator(".kal__dag").first()).toBeVisible();
  });

  test("data in het verleden zijn geblokkeerd en vandaag is gemarkeerd", async ({ page }) => {
    await naarDatum(page);

    // De eerste maand is de huidige: alles vóór vandaag moet uit staan.
    const vandaag = new Date().getDate();
    const uitgeschakeld = await page.locator(".kal__dag:disabled").count();
    expect(uitgeschakeld, "alle dagen vóór vandaag horen uitgeschakeld te zijn").toBe(vandaag - 1);

    await expect(page.locator(".kal__dag.is-vandaag")).toHaveCount(1);
    await expect(
      page.locator("[data-kal-vorige]"),
      "je kunt niet terug naar een maand die al voorbij is"
    ).toBeDisabled();
  });

  test("een dag kiezen markeert hem en toont de datum voluit", async ({ page }) => {
    await naarDatum(page);
    await expect(page.locator("[data-kal-uitkomst]")).toBeEmpty();

    await kiesDatum(page);

    await expect(page.locator(".kal__dag.is-gekozen")).toHaveCount(1);
    await expect(page.locator("[data-kal-uitkomst]")).toContainText("Gekozen:");
    // Nederlandse maandnaam, geen "July".
    await expect(page.locator("[data-kal-maand]")).toHaveText(
      /januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december/
    );
  });

  test("de gekozen dag is groen, ook met de muis erop", async ({ page }) => {
    await naarDatum(page);
    const dag = page.locator(".kal__dag:not(:disabled)").nth(2);
    await dag.click();
    await dag.hover();

    // `.kal__dag:hover:not(:disabled)` is specifieker dan `.kal__dag.is-gekozen`.
    // Zonder expliciete hover-regel kreeg je keuze de tan hover-tint.
    const kleur = await dag.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(kleur, "de gekozen dag hoort diepgroen te zijn, niet de hover-tint").toBe("rgb(76, 106, 87)");
  });

  test("bladeren naar een volgende maand werkt en houdt de keuze vast", async ({ page }) => {
    await naarDatum(page);
    await kiesDatum(page);
    const maand = await page.locator("[data-kal-maand]").textContent();

    await page.locator("[data-kal-volgende]").click();
    await expect(page.locator("[data-kal-maand]")).not.toHaveText(maand!);
    await expect(page.locator("[data-kal-vorige]"), "terug mag nu wel").toBeEnabled();

    // In een andere maand staat de keuze niet gemarkeerd, maar ze is niet weg.
    await expect(page.locator(".kal__dag.is-gekozen")).toHaveCount(0);
    await page.locator("[data-kal-vorige]").click();
    await expect(page.locator(".kal__dag.is-gekozen")).toHaveCount(1);
  });

  test("zonder datum mag je niet door", async ({ page }) => {
    await naarDatum(page);
    await volgende(page);
    await expect(page.locator('.screen[data-screen="4"]')).toBeVisible();
    await expect(page.locator("#kalender .field-error")).toBeVisible();
  });
});

test.describe("terug en herstel", () => {
  test("vraag 1 heeft geen Terug-knop — er is niets om naar terug te gaan", async ({ page }) => {
    await open(page);
    await expect(page.locator('.screen[data-screen="1"]')).toBeVisible();
    await expect(
      page.locator('.screen[data-screen="1"] [data-prev]'),
      "een knop die niets doet is verwarring"
    ).toHaveCount(0);

    // Vanaf vraag 2 hoort hij er wél te staan.
    await kies(page, "event_type", "Trouwfeest");
    await expect(page.locator('.screen[data-screen="2"] [data-prev]')).toBeVisible();
  });

  test("terug behoudt de antwoorden", async ({ page }) => {
    await open(page);
    await kies(page, "event_type", "Trouwfeest");
    await expect(page.locator('.screen[data-screen="2"]')).toBeVisible();

    await page.locator(".screen.is-active [data-prev]").click();
    await expect(page.locator('.screen[data-screen="1"]')).toBeVisible();
    await expect(page.locator('input[name="event_type"][value="Trouwfeest"]')).toBeChecked();
  });

  test("na een refresh sta je nog op dezelfde vraag met je antwoorden", async ({ page }) => {
    await open(page);
    await kies(page, "event_type", "Trouwfeest");
    await kies(page, "moment", "Ceremonie");
    await volgende(page);
    await kies(page, "sfeer", "Warm en intiem");
    await volgende(page);
    await kiesDatum(page);
    await volgende(page);
    await page.locator("#locatie").fill("Antwerpen");

    await page.reload();
    await page.locator(".r-loader.is-done, .r-loader.is-gone").waitFor();

    await expect(page.locator("#progress-count")).toHaveText("Vraag 5 van 9");
    await expect(page.locator("#locatie")).toHaveValue("Antwerpen");
  });
});

test.describe("verzenden", () => {
  async function totHetEind(page: Page) {
    await open(page);
    await kies(page, "event_type", "Trouwfeest");
    await kies(page, "moment", "Ceremonie");
    await volgende(page);
    await kies(page, "sfeer", "Warm en intiem");
    await volgende(page);
    await kiesDatum(page);
    await volgende(page);
    await page.locator("#locatie").fill("Antwerpen");
    await volgende(page);
    await kies(page, "gasten", "80 – 150");
    await expect(page.locator('.screen[data-screen="7"]')).toBeVisible();
    await page.locator("#voornaam").fill("Jan");
    await page.locator("#achternaam").fill("Janssen");
    await page.locator("#email").fill("jan@example.com");
    await page.locator("#telefoon").fill("+32 470 12 34 56");
    await volgende(page);
    await kies(page, "voorkeur_contact", "WhatsApp");
    await expect(page.locator('.screen[data-screen="9"]')).toBeVisible();
    await page.locator("#privacy").check();
  }

  test("succes toont de bevestiging; de payload heeft voor- en achternaam apart", async ({ page }) => {
    let payload: any = null;
    await page.route("**/api/aanvraag", async (route) => {
      payload = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
    });

    await totHetEind(page);
    await page.getByRole("button", { name: "Vraag uw voorstel aan" }).click();

    await expect(page.locator("#aanvraag-done")).toBeVisible();
    await expect(page.locator("#aanvraag-form")).toBeHidden();
    await expect(page.locator("#progress")).toBeHidden();
    await expect(page.locator(".done__next li")).toHaveCount(3);

    expect(payload).toMatchObject({
      event_type: "Trouwfeest",
      moment: "Ceremonie",
      sfeer: "Warm en intiem",
      locatie: "Antwerpen",
      gasten: "80 – 150",
      voornaam: "Jan",
      achternaam: "Janssen",
      email: "jan@example.com",
      voorkeur_contact: "WhatsApp",
      privacy: "ja",
    });

    // kiesDatum() pakt de eerste selecteerbare dag; dat is vandaag, want de
    // kalender blokkeert alles ervoor. Geen vaste datum in de assertie: die
    // zou over een jaar stilletjes iets anders betekenen.
    const vandaag = new Date();
    const iso =
      vandaag.getFullYear() +
      "-" +
      String(vandaag.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(vandaag.getDate()).padStart(2, "0");
    expect(payload.datum, "de kalender levert een lokale ISO-datum, niet UTC").toBe(iso);
  });

  test("privacy niet aangevinkt: knop blijft klikbaar en zegt wat er mist", async ({ page }) => {
    await open(page);
    await kies(page, "event_type", "Trouwfeest");
    await kies(page, "moment", "Ceremonie");
    await volgende(page);
    await kies(page, "sfeer", "Warm en intiem");
    await volgende(page);
    await kiesDatum(page);
    await volgende(page);
    await page.locator("#locatie").fill("Antwerpen");
    await volgende(page);
    await kies(page, "gasten", "80 – 150");
    await page.locator("#voornaam").fill("Jan");
    await page.locator("#achternaam").fill("Janssen");
    await page.locator("#email").fill("jan@example.com");
    await page.locator("#telefoon").fill("+32 470 12 34 56");
    await volgende(page);
    await kies(page, "voorkeur_contact", "WhatsApp");

    const knop = page.getByRole("button", { name: "Vraag uw voorstel aan" });
    await expect(knop, "nooit uitgrijzen zonder uitleg").toBeEnabled();
    await knop.click();

    await expect(page.locator('[data-q="privacy"] .field-error')).toBeVisible();
    await expect(page.locator("#aanvraag-done")).toBeHidden();
  });

  test("serverfout laat alles staan en wijst naar een adres dat bestaat", async ({ page }) => {
    await page.route("**/api/aanvraag", (route) =>
      route.fulfill({ status: 502, contentType: "application/json", body: '{"ok":false,"error":"send_failed"}' })
    );
    await totHetEind(page);
    await page.getByRole("button", { name: "Vraag uw voorstel aan" }).click();

    await expect(page.locator(".form-status")).toContainText("relovation@robinmusic.be");
    await expect(page.locator("#aanvraag-done")).toBeHidden();
    await expect(page.locator("#privacy")).toBeChecked();
  });
});

test.describe("zonder JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("alle vragen staan onder elkaar en het formulier is verzendbaar", async ({ page }) => {
    await page.goto("/aanvraag");

    await expect(
      page.locator(".r-loader"),
      "de loader-overlay moet zonder JS verborgen zijn, anders is de pagina onbereikbaar"
    ).toBeHidden();

    await expect(page.locator('.screen[data-screen="1"]')).toBeVisible();
    await expect(page.locator('.screen[data-screen="9"]')).toBeVisible();
    await expect(page.locator("#progress")).toBeHidden();
    await expect(page.getByRole("button", { name: "Vraag uw voorstel aan" })).toBeVisible();
    await expect(page.locator("#voornaam")).toBeVisible();
    await expect(page.locator("#achternaam")).toBeVisible();
    await expect(
      page.locator("#datum"),
      "zonder JS moet de native datumkiezer terugvallen, anders is er geen datum te kiezen"
    ).toBeVisible();
    await expect(page.locator("#kalender")).toBeHidden();

    await geenScroll(page, "zonder JS");
  });
});
