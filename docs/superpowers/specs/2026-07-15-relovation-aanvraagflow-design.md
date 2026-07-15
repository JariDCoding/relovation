# Relovation: aanvraagflow op /aanvraag

**Datum:** 2026-07-15
**Status:** goedgekeurd, klaar voor implementatie
**Bron:** `Relovation_Developer_Briefing_v2.pdf` (versie 2.0, juli 2026)

## Doel

Een begeleide aanvraagflow voor live muziek op `/aanvraag`, in plaats van een klassiek
contactformulier. Drie stappen, elf vragen. Eerst het event en de muziekbeleving, dan de
praktische info, dan de contactgegevens.

Doel volgens de briefing: **maximaal kwalitatieve leads met minimale frictie.**

De site draait al als Cloudflare Worker (zie
`2026-07-15-relovation-workers-form-design.md`). Deze flow bouwt daarop voort.

## Uitgangssituatie (geverifieerd op 2026-07-15)

- Repo `/Users/jari/relovation`, branch `main`. Live op
  `https://relovation.jdcreations.workers.dev/`.
- `/aanvraag` bestaat nog niet — geeft nu HTTP 404.
- Site is vanilla HTML: 4 pagina's, elk met een eigen inline `<style>`, plus gedeelde
  `nav.css` / `nav.js` / `loader.css` / `loader.js`.
- `contact.html` heeft al een werkend formulier op `POST /api/contact` via Resend.
- Fonts staan al ingeladen: DM Sans (400/500/600) + EB Garamond (400/500/600/700).

## Beslissing: welk kleurenpalet geldt

De briefing (blz. 9) en het Figma-designsysteem spreken elkaar tegen. Uitgezocht:

| Rol | Briefing v2 | Figma + live site | Voorkomens op de site |
|---|---|---|---|
| Cream | `#FEE8C3` | `#f4edcf` | 26× |
| Groen | `#3E4F33` | `#4c6a57` | 8× |
| Goud | `#C2A14E` | `#af8f48` | 1× |

De kleuren uit de briefing komen **nergens** in de codebase voor. Het Figma-bestand stelt
expliciet: *"Every value here is extracted from the existing Relovation design — not
invented."* Figma en de live site zijn het dus eens; de briefing staat alleen.

**Besluit: Figma + live site zijn leidend.** De briefing-palette wordt genegeerd, zodat
`/aanvraag` niet uit de toon valt bij de rest van de site.

## Designtokens (uit Figma `PcanuLMtNgkoyLV2iYFNHL`, Cream mode)

```
bg/page          #f4edcf     text/primary     #4c6a57
bg/surface       #f7f2d5     text/secondary   #4f5f49
bg/inverse       #4c6a57     text/muted       #55715e
bg/accent        #af8f48     text/inverse     #f4edcf
border/default   #4f5f49     border/subtle    #c2c2ae
border/accent    #cca735
button/primary   bg #4c6a57 · hover #567d5c · label #f4edcf
button/secondary border #4c6a57 · label #4c6a57

spacing  4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128
radius   sm 8 · md 20 (kaarten) · lg 32 · pill 40 (knoppen)
elevatie Card = 0 4 4 #0000001A
type     EB Garamond (display) · DM Sans (interface) · line-height 150%,
         behalve knoplabel op 100%
```

De Figma-typeschaal is de desktopschaal (H1 96px, Body/M 24px). Die wordt vloeiend
geschaald met `clamp()` in plaats van letterlijk overgenomen — anders is de flow
onbruikbaar op mobiel.

## Architectuur

```
public/aanvraag.html       de pagina, met eigen inline <style> (zoals de andere 4)
public/aanvraag-form.js    stap-logica, validatie, verzenden
src/index.js               + route POST /api/aanvraag
```

Geen build-stap, geen framework — consistent met de rest van de site.

## Flow-vorm

**Eén vraag per scherm** — negen vraagschermen, gegroepeerd in de drie stappen uit de
briefing. Herzien op 2026-07-15 na de eerste oplevering: de eerste versie zette 3 tot 5
vragen per scherm, wat scrollen vereiste. Reden voor de wijziging (Jari): alles moet in
één viewport passen zonder te scrollen.

De twee eisen bijten elkaar niet, ze stapelen: `Stap X van 3 · hoofdstuktitel` staat altijd
in beeld, met daarnaast `Vraag N van 9` en een balk van drie segmenten die zich vult
naarmate je door de vragen van een stap gaat. Je ziet dus zowel waar je bent in het geheel
als hoever de huidige stap is.

Negen in plaats van elf schermen, omdat de contactgegevens samen op één scherm staan
(voornaam, achternaam, e-mail, telefoon). Dat volgt de briefing zelf, die Q7 en Q8 al als
één blok toont ("Q7 · Q8 — Naam & e-mailadres").

**Openingsscherm.** De titel "Vertel ons over uw event" en de intro krijgen een eigen
scherm met een Beginnen-knop. Anders kost die kop op elk van de negen schermen verticale
ruimte — precies het scrollprobleem dat we oplossen. De knop is bovendien zelf een micro-ja
(Cialdini, foot-in-the-door).

**Automatisch door bij enkele keuze.** Bij vraag 1, 6 en 8 springt de flow na 400 ms naar
de volgende vraag. Die pauze is bewust: je ziet je eigen keuze bevestigd worden. Bij
meerkeuzevragen kan dit niet — de flow weet niet wanneer je klaar bent — dus daar blijft
een Volgende-knop staan. Enter werkt overal, behalve in de textarea.

### Het no-scroll-contract

Vanaf **390px breed** past elke vraag binnen één viewport. Dat wordt per viewport gemeten
in `tests/aanvraag-flow.spec.ts`, niet aangenomen.

Op **320×568** (iPhone SE 1e generatie) is het fysiek onmogelijk: 492px bruikbare hoogte,
en zes keuzekaarten van 44px — de minimale tapdoelnorm — passen daar met vraag, voortgang
en knop niet in. Verder verkleinen zou de tapdoelen onder de toegankelijkheidsnorm duwen.
Dat scherm scrollt dus, en wordt apart getest op bruikbaarheid: geen horizontale overflow,
tapdoelen ≥ 44px, knop bereikbaar.

Om dit te halen krimpen de kaarten van 56px naar 48px zodra de opties onder elkaar staan
(≤ 640px breed) of het scherm laag is (≤ 780px), en naar 44px op zeer korte schermen.

## Exacte inhoud

### Stap 1 — Event & muziek
*"De bezoeker vertrekt vanuit wat hij of zij wil creëren."*

| # | Vraag | Type | Verplicht |
|---|---|---|---|
| Q1 | Wat organiseert u? | enkele keuze, kaarten | ja |
| Q2 | Voor welk moment zoekt u live muziek? | meerdere keuze, kaarten | ja |
| Q3 | Welke sfeer wilt u creëren? | max 2 keuzes, kaarten | ja |

- Q1: Trouwfeest · Bedrijfsfeest · Privéfeest · Publiek event / festival ·
  Horeca / opening / concept event · Ander event
- Q2: Ceremonie · Receptie / welkomstdrink · Diner / walking dinner · Avondfeest ·
  Voorprogramma / openingsmoment · Achtergrondmuziek doorheen het event ·
  Nog niet zeker, graag advies
- Q3: Warm en intiem · Stijlvol op de achtergrond · Classy en professioneel ·
  Interactief en energiek · Feestelijk en herkenbaar · Nog niet zeker, graag advies

### Stap 2 — Praktische info
*"Net genoeg info om beschikbaarheid en schaal in te schatten."*

| # | Vraag | Type | Verplicht |
|---|---|---|---|
| Q4 | Wanneer gaat het event door? | datum + checkbox | ja |
| Q5 | Waar gaat het event door? | tekstveld | ja |
| Q6 | Hoeveel gasten verwacht u ongeveer? | enkele keuze, kaarten | ja |

- Q4: datumkiezer + checkbox "De datum ligt nog niet definitief vast"
- Q5: placeholder "Locatie, gemeente of regio"; hulptekst "De gemeente of regio volstaat
  als de exacte locatie nog niet vastligt."
- Q6: Minder dan 30 · 30 – 80 · 80 – 150 · 150 – 300 · Meer dan 300 · Nog niet zeker

### Stap 3 — Uw gegevens
*"Vertrouwen behouden en opvolging makkelijk maken."*

| Scherm | Vraag | Type | Verplicht |
|---|---|---|---|
| 7 | Hoe bereiken we u? | vier tekstvelden op één scherm | ja |
| 8 | Hoe mogen we u het liefst contacteren? | enkele keuze | nee |
| 9 | Wil u nog iets kort meegeven? | lang tekstveld | nee |

- Scherm 7 bundelt voornaam, achternaam, e-mail en telefoon. Voor- en achternaam staan
  naast elkaar (aparte velden op verzoek van Jari), e-mail en telefoon eronder. Hulptekst:
  "We gebruiken deze gegevens enkel om uw aanvraag snel en persoonlijk op te volgen."
- Scherm 8: E-mail · Telefoon · WhatsApp · Maakt niet uit. Springt automatisch door.
- Scherm 9 placeholder: "Bijvoorbeeld: gewenste muziekstijl, speciaal moment, timing,
  praktische info of de sfeer die u voor ogen heeft." De privacycheckbox staat op dit
  scherm, direct boven de verzendknop.
- Privacycheckbox (verplicht): "Ik heb de privacyverklaring gelezen en begrijp dat mijn
  gegevens gebruikt worden om mijn aanvraag te beantwoorden en, indien nodig, contact met
  mij op te nemen over dit event."

## Conditionele logica

Drie regels, alle drie uit de briefing:

1. **Q2** — "Nog niet zeker, graag advies" is exclusief. Wie die kiest, vinkt de rest uit;
   wie daarna een andere optie kiest, vinkt "Nog niet zeker" uit.
2. **Q3** — maximaal 2 keuzes. Bij 2 gekozen dimmen de overige kaarten zichtbaar
   (`aria-disabled`), met de teller "2 van 2 gekozen". Zo is te zien *waarom* er niet
   verder geklikt kan worden, in plaats van een dode klik. Zelfde exclusieve regel voor
   "Nog niet zeker, graag advies".
3. **Q4** — staat de datum-checkbox aan, dan verschijnt "In welke periode denkt u?"
   (Voorjaar / Zomer / Najaar / Winter / Nog niet zeker) en verdwijnt de datumkiezer.

## Teksten

Exact volgens de briefing, hoofdstuk 04:

| Element | Tekst |
|---|---|
| Titel boven formulier | Vertel ons over uw event |
| Intro | Beantwoord enkele korte vragen. Zo bekijken we persoonlijk welke muzikale formule het best past bij uw moment. |
| Knop na stap 1 | Volgende: praktische info |
| Knop na stap 2 | Volgende: uw gegevens |
| Submit-knop | Vraag uw voorstel aan |
| Bevestigingstitel | Bedankt voor uw aanvraag |
| Bevestigingstekst | We hebben uw aanvraag goed ontvangen. We bekijken persoonlijk welke muzikale formule het best past bij uw event en nemen binnenkort contact met u op met een voorstel op maat. |

Consequent de u-vorm.

## Conversieregels (uit `04 Resources/Conversie & Design Brein`)

- **Commitment & consistentie (Cialdini)** — *"Micro-ja's, kleine eerste stap
  (foot-in-the-door)"*. Q1 is de makkelijkste, meest visuele vraag. Wie één keer klikt,
  maakt af. Dit onderbouwt waarom de briefing met het event begint in plaats van met
  contactgegevens.
- **StoryBrand** — de klant is de held, Relovation is de gids. De copy gaat over het event
  van de bezoeker, niet over de band.
- **MWW / CRO-audit** — *"Onnodige stappen/keuzes/velden verwijderd?"* Elf vragen, maar
  slechts drie vrije tekstvelden. Elke "Nog niet zeker"-optie is een ontsnappingsluik dat
  frictie wegneemt bij wie het antwoord nog niet heeft.
- **Don't Make Me Think** — *"keuzes zo mindless mogelijk"*. Kaarten in plaats van
  dropdowns, één duidelijke actie per scherm.
- **Future-pacing (MWW)** — *"onduidelijkheid over de post-order-ervaring doodt verkoop"*.
  Het bevestigingsscherm toont niet alleen "Bedankt", maar ook wat er nu gebeurt: aanvraag
  bekeken → Robin neemt contact op → voorstel op maat. **Dit is een toevoeging op de
  briefing.**
- **Refactoring UI** — *"Labels weggelaten waar format/context volstaat"*. De vraag ís het
  label; geen dubbele labels boven de velden.

### Bewust niet gedaan

**Geen sociaal bewijs bij de CTA.** De vault raadt het aan ("plaats sociaal bewijs dicht
bij het beslismoment") maar stelt ook een harde grens: *"Cijfers, reviews en getuigenissen
moeten écht zijn."* Er zijn geen geverifieerde aantallen of quotes beschikbaar. Verzinnen
is geen optie. Op verzoek van Jari blijft de flow puur het formulier. Kan later terug op
tafel als er echte cijfers zijn.

## Kleurcorrectie na de a11y-audit

De goud-tokens uit het designsysteem zijn niet bruikbaar als tekstkleur:

| Combinatie | Gemeten | WCAG AA |
|---|---|---|
| `bg/accent` #af8f48 op cream #f4edcf | 2.61:1 | 4.5:1 — faalt |
| `border/accent` #cca735 op groen #4c6a57 | 2.61:1 | 4.5:1 — faalt |

Goud AA-proof maken vraagt ~#7d6432 op cream (zichtbaar bruiner) of ~#f2e2b4 op groen
(dan is het goud weg). Beide zijn ontwerpingrepen, geen technische fixes.

**Besluit (Jari): geen nieuwe kleuren.** Kleine tekst — eyebrows, vraagnummers,
stap-labels — gebruikt `--text-muted` (#55715e, 4.57:1) op cream en `--text-inverse`
(cream, 5.09:1) op groen. De ondertitel in de groene header ging van 78% naar 94% cream,
placeholders van 60% naar 100% `--text-muted`.

Goud blijft onaangeroerd waar het decoratief is: de voortgangsbalk, kaartranden, de
vinkjesvulling, de rand van het conditionele blok en de streepjes bij de bevestiging. Daar
geldt de tekstnorm niet.

## Loader-overlay zonder JavaScript

`loader.js` haalt de overlay weg; zonder JS gebeurt dat nooit en blijft
`.r-loader { position: fixed; inset: 0; z-index: 9999 }` eeuwig over de pagina liggen. De
progressive-enhancement-belofte hierboven was daardoor onwaar. Opgelost met een
`<noscript>`-blok dat de loader verbergt.

**Dit geldt site-breed:** `index`, `over`, `diensten` en `contact` hebben dezelfde loader
en zijn dus zonder JS een leeg cream scherm. Alleen `/aanvraag` is gefixt; de rest staat
open (zie openstaande punten).

## Zero confusion

Expliciete eis van Jari. Concreet:

- Validatie pas bij "Volgende", nooit tijdens het typen. Fouten inline bij het veld zelf,
  focus springt naar het eerste foute veld.
- De verzendknop wordt nooit uitgegrijsd. Klikken zegt altijd wat er nog ontbreekt — een
  uitgegrijsde knop zonder uitleg is precies de verwarring die we willen vermijden.
- Terug kan altijd; antwoorden blijven staan. Ook na een refresh, via `sessionStorage`.
- `Stap X van 3` en de hoofdstuktitel staan altijd in beeld.
- Bij het wisselen van stap springt de focus naar de nieuwe staptitel (screenreaders en
  toetsenbord).

## Backend

**Route:** `POST /api/aanvraag`

1. Honeypot (`website`-veld) — ingevuld → stil `200 ok`, geen mail.
2. Valideren: alles behalve voorkeur en bericht is verplicht, plus de privacycheckbox;
   e-mailformaat en lengtelimieten. De Worker ontvangt `voornaam` en `achternaam` apart en
   plakt ze samen voor de onderwerpregel.
3. Mail via Resend (kale `fetch`, geen SDK), `Reply-To` = e-mailadres van de aanvrager.
4. Antwoord `{ ok: true }` of `{ ok: false, errors: {...} }` met status 400.

Hergebruikt de bestaande config: `RESEND_API_KEY` (secret), `CONTACT_FROM`, `CONTACT_TO`.

**Onderwerpregel:** `Nieuwe aanvraag – [type event] – [datum/periode] – [locatie]`
Voorbeeld: `Nieuwe aanvraag – Trouwfeest – 14/09/2026 – Antwerpen`

**Mailinhoud**, in deze volgorde:

| Blok | Velden |
|---|---|
| Event & muziek | Type event / Moment muziek / Gewenste sfeer |
| Praktische info | Datum of periode / Locatie / Aantal gasten |
| Contactgegevens | Naam (voornaam + achternaam) / E-mail / Telefoon / Voorkeur contact |
| Extra info | Vrij bericht |

**Opslag:** nu niet. De briefing vraagt "inzending opslaan in backend/dashboard", maar dat
wordt een aparte fase. Vandaag alleen mail — dat werkt en levert de lead. Zie openstaande
punten.

## Navigatie

Volledige site-nav + footer, zoals de andere pagina's. Overwogen: focus-modus zonder nav
(MWW: *"onnodige stappen/keuzes verwijderd"*). Jari kiest bewust voor consistentie en
herkenbaarheid boven het afsluiten van uitgangen.

De primaire CTA op `index`, `over`, `diensten` en `contact` wordt omgezet van
"Ontvang offerte" → `contact.html` naar **"Vertel ons over uw event" → `/aanvraag`**, in
header, mobiele overlay en footer. De briefing: *"De primaire CTA leidt altijd naar deze
flow."*

`contact.html` en zijn formulier blijven bestaan en werken.

## Responsive

Mobiel eerst — de briefing: *"Elke stap moet vlot invulbaar zijn op smartphone."*

- Kaartkeuzes: 2 koloms op desktop, 1 kolom op mobiel.
- Tapdoelen minimaal 44px.
- Vloeiende typeschaal met `clamp()` tussen de mobiele en de Figma-desktopschaal.
- Na het bouwen: een `QA-Webdesign`- en `responsive-design`-pass (Playwright over
  viewports, tekstschaling 112,5–150%, axe-a11y), daarna fixes.

## Foutafhandeling

- Validatiefout → `400`, veld-specifieke meldingen, focus naar het eerste foute veld.
- Resend down → `502`, "probeer later opnieuw of mail ons direct". Alle antwoorden blijven
  staan.
- Netwerkfout → zelfde behandeling, niets gaat verloren.
- Worker-exception → `500`, gelogd via observability.
- Zonder JS: het formulier doet een gewone POST naar hetzelfde endpoint. Alle drie de
  stappen staan dan onder elkaar op één pagina (progressive enhancement).

## Testen

- Happy path: alle 11 vragen → mail komt aan bij `CONTACT_TO`, onderwerp klopt met het
  format, `Reply-To` is de aanvrager.
- Conditionele logica: Q2 exclusief, Q3 max 2, Q4 periode verschijnt.
- Validatie: elke verplichte vraag leeg laten, controleren dat de melding klopt.
- Honeypot: ingevuld → 200, geen mail.
- Terug/vooruit: antwoorden blijven staan; na refresh ook.
- Viewports: 360, 390, 768, 1024, 1440, 1920, 2560.

## Bestemming van de mail

Aanvragen moeten naar **`relovation@robinmusic.be`**. Dat domein heeft Google-MX en kan dus
ontvangen.

`relovation.be` blijkt inmiddels wél geregistreerd en staat op Jari's Cloudflare-
nameservers — het vorige ontwerpdoc van vanochtend klopt op dat punt niet meer.

**Blokkade:** het Resend-account heeft nul geverifieerde domeinen. Daardoor mag
`onboarding@resend.dev` uitsluitend naar `contact@jdcreations.co` sturen; elke andere
ontvanger geeft een 403. Geverifieerd met een echte API-call — er is dus geen testmail bij
Robin beland.

Aanpak: `relovation.be` verifiëren bij Resend (domein staat aangemaakt, id
`164473d4-75d7-4fb9-8283-b79befa0e483`). De drie DNS-records staan in
`docs/resend-dns-records.md` en moeten door Jari in Cloudflare gezet worden.

`wrangler.jsonc` staat al op de eindwaarden:

```
CONTACT_FROM = "Relovation <aanvraag@relovation.be>"
CONTACT_TO   = "relovation@robinmusic.be"
```

**Niet deployen voor de verificatie rond is** — anders geeft elke inzending een 502. Lokaal
overschrijft `.dev.vars` deze waarden zodat testen wél kan.

## Openstaande punten

- **DNS-records toevoegen + verifiëren** — randvoorwaarde voor livegang. Zie
  `docs/resend-dns-records.md`.
- **Opslag + dashboard** — de briefing vraagt erom, staat nu bewust buiten scope. Volgende
  fase: D1-tabel + afgeschermde `/admin`. Extra reden om dit te doen: zolang mail de enige
  bestemming is, is een bounce gelijk aan een verloren lead.
- **Loader zonder JS op de andere 4 pagina's** — dezelfde bug, alleen `/aanvraag` is gefixt.
- **Contrast in de gedeelde nav en footer** — 8 tot 11 axe-fouten (footer-links 2.42:1),
  aanwezig op alle pagina's. Zit in `nav.css`, dus een site-brede ingreep. Buiten scope
  gehouden; niet veroorzaakt door deze flow.
- **Sociaal bewijs bij de CTA** — kan alsnog, zodra er echte cijfers of quotes zijn.
- **Privacyverklaring** — de checkbox verwijst ernaar, maar er is nog geen privacypagina op
  de site. Voorlopig linkt de checkbox naar `contact.html`; te vervangen zodra de pagina er
  is.
- **Secundaire CTA** — de briefing noemt "Vraag uw voorstel aan" naar
  `relovation@robinmusic.be`, maar zegt er zelf bij dat die niet actief gepromoot wordt.
  Bewust niet gebouwd: de flow is de gewenste route.
- **In-body CTA's** — vijf knoppen op `index` en `over` heten nog "Ontvang offerte" en
  linken naar `#contact` / `index.html#contact`. Die scrollen naar een sectie op dezelfde
  pagina, dus omzetten verandert paginagedrag. Niet aangeraakt zonder overleg.
