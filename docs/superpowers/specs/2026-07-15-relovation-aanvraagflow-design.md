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

**Drie schermen, elk met 3 tot 5 vragen** — letterlijk zoals de briefing. Overwogen en
verworpen: één-vraag-per-scherm (klassiek Typeform). Dat botst met de eis uit de briefing
om `Stap 1 van 3` te tonen, en met de wens dat de bezoeker overzicht houdt.

Geen paginaherlaad tussen stappen. `Stap X van 3` + de hoofdstuktitel staan altijd in
beeld.

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

| # | Vraag | Type | Verplicht |
|---|---|---|---|
| Q7 | Naam | tekstveld | ja |
| Q8 | E-mailadres | e-mailveld | ja |
| Q9 | Telefoonnummer | telefoonveld | ja |
| Q10 | Hoe mogen we u het liefst contacteren? | enkele keuze | nee |
| Q11 | Wil u nog iets kort meegeven? | lang tekstveld | nee |

- Q9 hulptekst: "We gebruiken uw telefoonnummer enkel om uw aanvraag snel en persoonlijk
  op te volgen."
- Q10: E-mail · Telefoon · WhatsApp · Maakt niet uit
- Q11 placeholder: "Bijvoorbeeld: gewenste muziekstijl, speciaal moment, timing,
  praktische info of de sfeer die u voor ogen heeft."
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
2. Valideren: Q1–Q9 + privacycheckbox verplicht, e-mailformaat, lengtelimieten.
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
| Contactgegevens | Naam / E-mail / Telefoon / Voorkeur contact |
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

## Openstaande punten

- **Opslag + dashboard** — de briefing vraagt erom, staat nu bewust buiten scope. Volgende
  fase: D1-tabel + afgeschermde `/admin`.
- **`relovation.be` bestaat nog steeds niet** (zie het vorige ontwerpdoc). Mail loopt tot
  die tijd via `onboarding@resend.dev` naar Jari's eigen adres. De secundaire CTA uit de
  briefing wijst naar `relovation@robinmusic.be` — dat adres is niet geverifieerd en wordt
  volgens de briefing toch niet actief gepromoot, dus blijft buiten de flow.
- **Sociaal bewijs bij de CTA** — kan alsnog, zodra er echte cijfers of quotes zijn.
- **Privacyverklaring** — de checkbox verwijst ernaar, maar er is nog geen privacypagina op
  de site. Voorlopig linkt de checkbox naar `contact.html`; te vervangen zodra de pagina er
  is.
