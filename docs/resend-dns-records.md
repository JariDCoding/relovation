# Resend DNS-records voor relovation.be

Aangemaakt op 2026-07-15. Domein-id bij Resend: `164473d4-75d7-4fb9-8283-b79befa0e483`,
regio `eu-west-1`.

Zolang deze records niet in Cloudflare staan, weigert Resend elke mail naar een ander adres
dan `contact@jdcreations.co` met een 403. Daarna mag de flow naar
`relovation@robinmusic.be` sturen.

## Toe te voegen in Cloudflare (relovation.be → DNS → Add record)

Cloudflare vult het domein zelf aan. Vul bij "Naam" dus `resend._domainkey` in, niet
`resend._domainkey.relovation.be`.

| Type | Naam | Waarde | Prioriteit | Proxy |
|---|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDUV3/lx/KrkeRrHwi4V7NZVRNtGh8CTSLz3RXFiLpc5ci4kdGOcVGOIh7MkYxIiTU+SGSKY8G1S6mVOdYvSgRuFz9dhmtJE/5XSSrqVLUHI/zTGriYmBu9vAaHmmR52ZKZCnqeWw83nNc7BBN8WgKfD5OmRYtgMLvUuYKXnCC/0QIDAQAB` | — | DNS only |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` | 10 | DNS only |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — | DNS only |

De MX op `send` raakt de mailontvangst van `relovation.be` zelf niet: die staat op een
subdomein, niet op de apex.

## Daarna verifiëren

```bash
KEY=$(grep RESEND_API_KEY .dev.vars | cut -d= -f2-)

# Verificatie starten
curl -s -X POST \
  https://api.resend.com/domains/164473d4-75d7-4fb9-8283-b79befa0e483/verify \
  -H "authorization: Bearer $KEY"

# Status opvragen (wachten tot "verified")
curl -s https://api.resend.com/domains/164473d4-75d7-4fb9-8283-b79befa0e483 \
  -H "authorization: Bearer $KEY" | python3 -m json.tool
```

## Pas deployen als het domein geverifieerd is

`wrangler.jsonc` staat al op de eindconfiguratie:

```
CONTACT_FROM = "Relovation <aanvraag@relovation.be>"
CONTACT_TO   = "relovation@robinmusic.be"
```

Deployen vóór de verificatie rond is, betekent een formulier dat 502 geeft bij elke
inzending. Eerst verifiëren, dan `npx wrangler deploy`.

Voor lokaal testen zonder geverifieerd domein: zet in `.dev.vars` (gitignored)

```
CONTACT_FROM=Relovation <onboarding@resend.dev>
CONTACT_TO=contact@jdcreations.co
```

Die overschrijven de vars uit `wrangler.jsonc` in `wrangler dev`.
