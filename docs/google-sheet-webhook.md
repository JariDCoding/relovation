# Form-inzendingen → Google Sheet (Apps Script webhook)

Elke contact- en aanvraaginzending wordt — naast de mail naar `relovation@robinmusic.be` —
als rij naar een Google Sheet geschreven. De Worker POST't de velden naar een Apps
Script-webhook; het script voegt de rij toe. Niet-blokkerend: als de sheet even niet
bereikbaar is, blijft de mail de betrouwbare weg.

## Eenmalige opzet (Google-kant)

1. Maak een nieuwe Google Sheet, bv. **"Relovation — Inzendingen"**.
2. **Extensies → Apps Script**.
3. Vervang alles door de code hieronder en **Save**.
4. **Deploy → New deployment** → type **Web app** →
   *Execute as:* **Me** · *Who has access:* **Anyone** → **Deploy**
   (autoriseer je Google-account als het daarom vraagt).
5. Kopieer de **Web app URL** (eindigt op `/exec`).

De tabbladen `Aanvragen` en `Contact` worden bij de eerste inzending automatisch
aangemaakt, met een vetgedrukte, bevroren kop-rij.

## De secret zetten + deployen (Worker-kant)

```bash
echo "PLAK_HIER_DE_WEB_APP_URL" | npx wrangler secret put SHEETS_WEBHOOK_URL
npx wrangler deploy
```

Verwijderen/uitzetten kan met `npx wrangler secret delete SHEETS_WEBHOOK_URL`
(de code valt dan stil terug: enkel mail, geen sheet).

## Apps Script

```javascript
// Relovation — form submissions -> Google Sheet
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var isAanvraag = data._form === 'aanvraag';
    var tabName = isAanvraag ? 'Aanvragen' : 'Contact';
    var sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
    var ts = new Date();
    var headers, row;
    if (isAanvraag) {
      headers = ['Datum', 'Type event', 'Moment', 'Sfeer', 'Wanneer', 'Locatie',
                 'Gasten', 'Naam', 'E-mail', 'Telefoon', 'Voorkeur contact', 'Bericht'];
      row = [ts, data.eventType, data.moment, data.sfeer, data.wanneer, data.locatie,
             data.gasten, data.naam, data.email, data.telefoon, data.voorkeur, data.bericht];
    } else {
      headers = ['Datum', 'Naam', 'E-mail', 'Telefoon', 'Bericht'];
      row = [ts, data.naam, data.email, data.tel, data.message];
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    sheet.appendRow(row);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
```

## Velden die de Worker stuurt

- **contact:** `_form:"contact"`, `naam`, `email`, `tel`, `message`
- **aanvraag:** `_form:"aanvraag"`, `eventType`, `moment`, `sfeer`, `wanneer`,
  `locatie`, `gasten`, `naam`, `email`, `telefoon`, `voorkeur`, `bericht`

De datum wordt door het script zelf toegevoegd (kolom "Datum"), in de tijdzone van de sheet.
