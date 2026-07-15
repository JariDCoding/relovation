# Relovation: migratie naar Cloudflare Workers + contactformulier

**Datum:** 2026-07-15
**Status:** goedgekeurd, klaar voor implementatie

## Doel

De bestaande statische Relovation-site (nu op Cloudflare Pages, `relovation.pages.dev`)
overzetten naar Cloudflare Workers, zodat er een backend aan gekoppeld kan worden. Het
contactformulier op `contact.html` moet aanvragen via Resend naar de mailbox van
Relovation sturen.

Het visuele ontwerp verandert niet. De migratie is 1-op-1.

## Uitgangssituatie (geverifieerd op 2026-07-15)

- Repo: `/Users/jari/relovation`, remote `github.com/JariDCoding/relovation.git`, branch `main`, schone tree.
- Site: statische HTML/CSS/JS, 4 pagina's (`index`, `over`, `diensten`, `contact`), ~22 MB.
- Live op `relovation.pages.dev` (HTTP 200), auto-deploy vanuit GitHub via Pages.
- `contact.html` bevat al een compleet formulier met `action="#"` — nog niet aangesloten.
  Velden: `first_name`, `last_name`, `email`, `country_code`, `phone_number`, `message`.

### Blokkade: domein bestaat niet

`relovation.be` is **niet geregistreerd** (whois: `AVAILABLE`; geen NS, geen MX, geen SOA —
geverifieerd via 8.8.8.8, 1.1.1.1 en de `.be`-whois). De site linkt wel naar
`hello@relovation.be` en `info@relovation.be`; die adressen bestaan niet en mail bounct.

Gevolg: mail kan pas definitief werken als het domein er is. Daarom wordt de bestemming
een configuratiewaarde (secret/var), niet iets in code. Omschakelen kost later nul
codewijzigingen.

### Gebroken frontend-referenties (5)

Audit van alle 41 lokale referenties: 36 correct, 5 gebroken.

| Pagina | Gebroken referentie | Bron van de fix |
|---|---|---|
| `index.html` | `video.mp4` | `~/Desktop/ClaudeCode/Relovation.be/video.mp4` (12 MB, geldige MP4) |
| `diensten.html` | `contact-relovation-1.html` | moet `./contact.html` zijn |
| `contact.html` | `assets/social/facebook-icon.svg` | `Facebook icon.svg` in repo-root |
| `contact.html` | `assets/social/instagram-icon.svg` | `Instagram icon.svg` in repo-root |
| `contact.html` | `assets/social/linkedin-icon.svg` | `LinkedIn icon.svg` in repo-root |

Deze zijn op de live site nu daadwerkelijk stuk: Pages maskeert elke 404 met een
HTML-fallback (`200 text/html`), waardoor het lijkt alsof ze laden. Social-iconen en de
hero-video werken vandaag niet.

## Architectuur

```
relovation/
├── public/                    # statische assets (1-op-1 uit huidige root)
│   ├── index.html  over.html  diensten.html  contact.html
│   ├── assets/social/{facebook,instagram,linkedin}-icon.svg
│   ├── video.mp4
│   ├── nav.css  nav.js  loader.css  loader.js
│   └── *.svg  *.png
├── src/
│   └── index.js               # Worker: /api/* → code, rest → ASSETS
├── docs/superpowers/specs/
├── wrangler.jsonc
└── package.json
```

Statische bestanden worden door Cloudflare's asset-laag geserveerd zonder de Worker aan te
roepen. Alleen `/api/*` raakt code. Dat houdt de Worker klein en de site snel.

### wrangler.jsonc

```jsonc
{
  "name": "relovation",
  "main": "src/index.js",
  "compatibility_date": "2026-07-15",
  "assets": {
    "directory": "./public",
    "binding": "ASSETS",
    "html_handling": "auto-trailing-slash",
    "not_found_handling": "none"
  },
  "observability": { "enabled": true }
}
```

`html_handling: auto-trailing-slash` reproduceert het huidige Pages-gedrag exact:
`/contact` serveert `contact.html`; `/contact.html` geeft 308 naar `/contact`. Bestaande
links blijven werken.

`not_found_handling: none` geeft echte 404's op onbekende URL's. Dit is een bewuste
afwijking van het huidige gedrag (200 + HTML op alles), goedgekeurd door de gebruiker:
beter voor SEO, onzichtbaar voor bezoekers van bestaande pagina's.

### Worker

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === "/api/contact" && request.method === "POST") {
      return handleContact(request, env)
    }
    if (url.pathname.startsWith("/api/")) {
      return json({ ok: false, error: "not_found" }, 404)
    }
    return env.ASSETS.fetch(request)
  }
}
```

## Fasering

### Fase 1 — Migratie (geen designwijziging)

1. `git mv` van alle statische bestanden naar `public/` (behoudt geschiedenis).
2. `wrangler.jsonc`, `package.json`, `src/index.js` (alleen de ASSETS-fallback).
3. `wrangler dev` — lokaal verifiëren dat alle 4 pagina's identiek renderen.
4. `wrangler deploy` → `relovation.<subdomein>.workers.dev`.
5. Vergelijken met `relovation.pages.dev`. Pas afkoppelen van Pages als de Worker bewezen
   goed draait. Geen downtime.

### Fase 2 — Frontend afwerken

1. `assets/social/` aanmaken; de drie iconen daarheen met de namen die `contact.html` al
   verwacht (`facebook-icon.svg` etc.). **De HTML wordt niet aangepast** — die had altijd
   al gelijk, de bestanden stonden verkeerd.
2. `video.mp4` vanaf Desktop naar `public/` en committen.
3. In `diensten.html`: `contact-relovation-1.html` → `./contact.html`. Dit is de enige
   HTML-wijziging in deze fase.
4. Verifiëren: audit opnieuw draaien, 0 gebroken referenties.

### Fase 3 — Contactformulier

**Endpoint:** `POST /api/contact`

**Verwerking:**
1. Honeypot-veld controleren (verborgen input; ingevuld → stil `200 ok`, geen mail).
2. Valideren: `first_name`, `email`, `message` verplicht; e-mailformaat; lengtelimieten.
3. Mail via Resend (`POST https://api.resend.com/emails`, kale `fetch`, geen SDK).
4. `Reply-To` = e-mailadres van de aanvrager, zodat Relovation direct kan antwoorden.
5. Antwoord: `{ ok: true }` of `{ ok: false, errors: {...} }` met status 400.

**Configuratie (geen code):**

| Naam | Type | Nu | Later |
|---|---|---|---|
| `RESEND_API_KEY` | secret | key van Jari's Resend-account | ongewijzigd |
| `CONTACT_FROM` | var | `onboarding@resend.dev` (Resend-testafzender) | `formulier@relovation.be` |
| `CONTACT_TO` | var | Jari's eigen adres | mailbox van Relovation |

Zo is het formulier vandaag testbaar zonder domein. Als `relovation.be` live gaat: DNS-
records bij Resend, twee vars wijzigen. Nul codewijzigingen.

**Frontend:** `contact.html` krijgt een klein `fetch`-script dat het formulier submit en
inline succes/fout toont. Geen paginaherlaad. Foutmeldingen bij de velden zelf.

### Waarom Resend

Volledig zonder API-key kan niet: mail versturen vereist altijd een dienst die de afzender
verifieert. Afwegingen:

- **Resend** (gekozen) — 1 key, kale `fetch`, en testbaar zónder domein via
  `onboarding@resend.dev`. Past bij "bouw nu, domein later".
- **SendGrid** (oorspronkelijk idee) — werkt ook, maar stroevere API en slechte
  deliverability vanaf een geverifieerd Gmail-adres.
- **Cloudflare Email Routing** (0 keys) — vereist het domein al ín Cloudflare. Nu onmogelijk.

## Foutafhandeling

- Resend down/error → `502`, gebruiker ziet "probeer later opnieuw of mail ons direct".
  De ingevulde velden blijven staan.
- Validatiefout → `400` met veld-specifieke meldingen.
- Worker-exception → `500`, gelogd via observability.
- Formulier werkt ook zonder JS niet stil kapot: submit-knop toont een duidelijke status.

## Spam

Honeypot (gratis, geen key). Turnstile pas als er echt spam binnenkomt — dat is weer een
key en extra setup.

## Testen

- Fase 1: alle 4 pagina's naast elkaar (Pages vs Worker) — visueel identiek, zelfde
  statuscodes op `/`, `/contact`, `/contact.html`.
- Fase 2: referentie-audit → 0 gebroken.
- Fase 3: happy path (mail komt aan, Reply-To klopt), validatiefouten, honeypot,
  Resend-fout (key tijdelijk ongeldig).

## Openstaande punten

- `wrangler login` moet door Jari interactief gedraaid worden.
- Auto-deploy: Workers Builds (GitHub-koppeling in dashboard) of GitHub Actions. Te
  beslissen bij fase 1, stap 5. Eerst handmatige `wrangler deploy` om te verifiëren.
- Pages-project blijft live tot de Worker bewezen goed draait.
- Domeinregistratie `relovation.be` — buiten scope vandaag, wel randvoorwaarde voor
  definitieve mail.
- Optioneel later: gebrande 404-pagina (nu een kale 404).
