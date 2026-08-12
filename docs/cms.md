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
| Home | Hero, "Wat is Relovation", de drie gelegenheden, "Waarom Relovation" met vier punten, de drie bezettingen, het slotblok |
| Diensten | Inleiding, de drie diensten met hun opsomming, de drie bezettingen, de afsluitende noot, het slotblok |
| Over ons | Openingstekst, inhoudsopgave, de drie verhaalalinea's, het citaat, "De kunst van aanwezigheid", de vier muzikanten, "Hoe wij werken", het slotblok |
| Gallerij | Inleiding, de dertien bijschriften, het ensemble met de vier muzikanten, het citaat, "Hoe wij spelen", het slotblok |
| Contact | De inleiding, de tekst bij het formulier en de tekst bij sociale media |
| Google-teksten | Titel en omschrijving per pagina, ook voor het aanvraagformulier |

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
npm run build:site       # Engelse pagina's + sitemap + content in de HTML + CMS-config
npm run content:extract  # de huidige HTML terugschrijven naar de JSON
npm run dev              # lokaal draaien (poort 8787)
```

**Een veld bijzetten**

1. Zet `data-cms="pad.naar.veld"` op het element in de Nederlandse pagina.
2. `npm run i18n` (de Engelse pagina erft het attribuut).
3. `npm run content:extract` vult de huidige tekst in beide talen in.
4. `npm run cms:config` genereert `public/admin/config.yml` opnieuw uit de JSON.
5. `npm run build:site` en controleer dat er niets veranderd is.

`public/admin/config.yml` wordt gegenereerd door `tools/build-cms-config.mjs`.
Pas het niet met de hand aan: bij de eerstvolgende build wordt het overschreven.
Nette Nederlandse labels komen uit de `LABELS`-tabel in dat script.

**Uitrollen** gebeurt door GitHub Actions (`.github/workflows/deploy.yml`) bij
elke push naar `main`. Daarvoor moeten in de repo-instellingen twee secrets
staan: `CLOUDFLARE_API_TOKEN` en `CLOUDFLARE_ACCOUNT_ID`.
