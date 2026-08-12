# Content beheren via /admin

De site draait op Sveltia CMS, git-backed. Opslaan in `/admin` maakt een commit
op `main`, en die commit rolt de site automatisch uit. Er staat geen enkel
secret in deze repo; het OAuth-secret leeft op de gedeelde Worker
`auth.jdcreations.co`.

## Voor Robin

1. Ga naar <https://relovation.be/admin/>.
2. Klik op **Sign in with GitHub** en log in met je GitHub-account.
3. Kies links een onderdeel, pas de tekst aan, klik **Save**.
4. Binnen ongeveer een minuut staat het live.

Bovenaan elk veld staat een taalkeuze: **NL** en **EN**. De Engelse site is een
aparte tekst, geen automatische vertaling. Pas je iets in het Nederlands aan,
werk dan ook de Engelse versie bij.

## Wat je kan bewerken

| Onderdeel | Wat |
|---|---|
| Site-instellingen | Footer-tekst, e-mailadres, regio, btw-nummer, links naar Instagram, LinkedIn en Facebook |
| Home | Bovenschrift en tekst in de hero, "Wat is Relovation", de drie gelegenheden, "Waarom Relovation" met vier punten, de drie bezettingen, het slotblok |
| Diensten | De inleiding |
| Contact | De inleiding, de tekst bij het formulier en de tekst bij sociale media |
| Google-teksten | Titel en omschrijving per pagina, zoals ze in de zoekresultaten verschijnen |

Titels die woord voor woord animeren (de grote koppen) staan bewust niet in het
CMS: die hebben hun eigen regelindeling en timing.

## Voor ontwikkelaars

**Hoe het werkt.** De HTML blijft handgeschreven. Elk bewerkbaar element draagt
een `data-cms="sleutel"` (of `data-cms-href="sleutel"` voor een link). Bij de
build vervangt `tools/build-content.mjs` de inhoud van die elementen door de
waarde uit `content/<taal>/...`. Staat een sleutel niet in de JSON, dan blijft
gewoon staan wat in de HTML stond: een lege of half ingevulde JSON kan de site
dus niet breken.

```
content/
  nl/  seo.json · settings/global.json · pages/{home,diensten,contact}.json
  en/  idem
```

**Commando's**

```bash
npm run build:site       # Engelse pagina's + sitemap + content in de HTML
npm run content:extract  # de huidige HTML terugschrijven naar de JSON
npm run dev              # lokaal draaien (poort 8787)
```

**Een veld bijzetten**

1. Zet `data-cms="pad.naar.veld"` op het element in de Nederlandse pagina.
2. `npm run i18n` (de Engelse pagina erft het attribuut).
3. `npm run content:extract` vult de huidige tekst in beide talen in.
4. Zet het veld in `public/admin/config.yml` met `i18n: true`.
5. `npm run build:site` en controleer dat er niets veranderd is.

**Uitrollen** gebeurt door GitHub Actions (`.github/workflows/deploy.yml`) bij
elke push naar `main`. Daarvoor moeten in de repo-instellingen twee secrets
staan: `CLOUDFLARE_API_TOKEN` en `CLOUDFLARE_ACCOUNT_ID`.
