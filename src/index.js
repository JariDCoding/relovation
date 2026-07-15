/**
 * Relovation - Cloudflare Worker
 *
 * Serveert de statische site en handelt het contactformulier af.
 *
 * Statische bestanden worden door Cloudflare's asset-laag afgehandeld zonder
 * deze Worker aan te roepen. Deze code draait dus alleen voor /api/* en voor
 * URL's waarvoor geen asset bestaat.
 *
 * Configuratie (nooit in code):
 *   RESEND_API_KEY  secret  - wrangler secret put RESEND_API_KEY
 *   CONTACT_FROM    var     - afzender (moet een bij Resend geverifieerd domein zijn)
 *   CONTACT_TO      var     - bestemming (mailbox van Relovation)
 */

const MAX_MESSAGE = 5000;
const MAX_FIELD = 200;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request, env, url);
    }

    // Geen /api-route: laat de asset-laag beslissen (levert een echte 404
    // als het bestand niet bestaat).
    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request, env, url) {
  if (url.pathname === "/api/contact") {
    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }
    return handleContact(request, env);
  }
  if (url.pathname === "/api/aanvraag") {
    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405);
    }
    return handleAanvraag(request, env);
  }
  return json({ ok: false, error: "not_found" }, 404);
}

async function handleContact(request, env) {
  let data;
  try {
    data = await parseBody(request);
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  // Honeypot: een verborgen veld dat mensen nooit zien, maar bots wel invullen.
  // Stil een 200 teruggeven, zodat de bot denkt dat het gelukt is.
  if (str(data.website)) {
    return json({ ok: true });
  }

  const first = str(data.first_name).slice(0, MAX_FIELD);
  const last = str(data.last_name).slice(0, MAX_FIELD);
  const email = str(data.email).slice(0, MAX_FIELD);
  const phone = str(data.phone_number).slice(0, MAX_FIELD);
  const country = str(data.country_code).slice(0, MAX_FIELD);
  const message = str(data.message).slice(0, MAX_MESSAGE + 1);

  const errors = {};
  if (!first) errors.first_name = "Vul uw voornaam in.";
  if (!email) errors.email = "Vul uw e-mailadres in.";
  else if (!isEmail(email)) errors.email = "Dit lijkt geen geldig e-mailadres.";
  if (!message) errors.message = "Schrijf hier uw bericht.";
  else if (message.length > MAX_MESSAGE) errors.message = "Uw bericht is te lang.";

  if (Object.keys(errors).length > 0) {
    return json({ ok: false, errors }, 400);
  }

  const naam = [first, last].filter(Boolean).join(" ");
  const tel = [country, phone].filter(Boolean).join(" ").trim();

  const text = [
    `Nieuwe aanvraag via relovation.be`,
    ``,
    `Naam:      ${naam}`,
    `E-mail:    ${email}`,
    `Telefoon:  ${tel || "-"}`,
    ``,
    `Bericht:`,
    message,
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#1a1a1a;line-height:1.6">
      <h2 style="margin:0 0 16px">Nieuwe aanvraag via de website</h2>
      <table style="border-collapse:collapse;margin-bottom:20px">
        <tr><td style="padding:4px 16px 4px 0;color:#666">Naam</td><td style="padding:4px 0"><strong>${esc(naam)}</strong></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">E-mail</td><td style="padding:4px 0"><a href="mailto:${esc(email)}">${esc(email)}</a></td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#666">Telefoon</td><td style="padding:4px 0">${esc(tel) || "-"}</td></tr>
      </table>
      <div style="padding:16px;background:#f6f6f4;border-radius:8px;white-space:pre-wrap">${esc(message)}</div>
      <p style="margin-top:20px;color:#888;font-size:13px">
        Antwoord gewoon op deze mail om ${esc(first)} direct te bereiken.
      </p>
    </div>`;

  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM,
        to: [env.CONTACT_TO],
        reply_to: email, // zo kan Relovation gewoon op 'beantwoorden' klikken
        subject: `Nieuwe aanvraag van ${naam}`,
        text,
        html,
      }),
    });
  } catch (err) {
    console.error("resend_unreachable", err?.message);
    return json({ ok: false, error: "send_failed" }, 502);
  }

  if (!res.ok) {
    // Alleen de foutmelding van Resend loggen, nooit de key.
    const detail = await res.text().catch(() => "");
    console.error("resend_error", res.status, detail.slice(0, 300));
    return json({ ok: false, error: "send_failed" }, 502);
  }

  return json({ ok: true });
}

/**
 * Aanvraagflow (/aanvraag) — drie stappen, elf vragen.
 * Velden en volgorde van de mail volgen de developer briefing v2, hoofdstuk 06.
 */
async function handleAanvraag(request, env) {
  let data;
  try {
    data = await parseBody(request);
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  if (str(data.website)) {
    return json({ ok: true });
  }

  const eventType = str(data.event_type).slice(0, MAX_FIELD);
  const moment = str(data.moment).slice(0, MAX_FIELD);
  const sfeer = str(data.sfeer).slice(0, MAX_FIELD);
  const datum = str(data.datum).slice(0, MAX_FIELD);
  const datumFlexibel = str(data.datum_flexibel) === "ja";
  const periode = str(data.periode).slice(0, MAX_FIELD);
  const locatie = str(data.locatie).slice(0, MAX_FIELD);
  const gasten = str(data.gasten).slice(0, MAX_FIELD);
  const voornaam = str(data.voornaam).slice(0, MAX_FIELD);
  const achternaam = str(data.achternaam).slice(0, MAX_FIELD);
  const naam = [voornaam, achternaam].filter(Boolean).join(" ");
  const email = str(data.email).slice(0, MAX_FIELD);
  const telefoon = str(data.telefoon).slice(0, MAX_FIELD);
  const voorkeur = str(data.voorkeur_contact).slice(0, MAX_FIELD);
  const bericht = str(data.bericht).slice(0, MAX_MESSAGE + 1);
  const privacy = str(data.privacy) === "ja";

  // De sleutels komen overeen met de data-q attributen in aanvraag.html, zodat
  // de frontend de melding bij de juiste vraag kan zetten.
  const errors = {};
  if (!eventType) errors.event_type = "Kies wat u organiseert.";
  if (!moment) errors.moment = "Kies minstens één moment.";
  if (!sfeer) errors.sfeer = "Kies minstens één sfeer.";
  if (datumFlexibel) {
    if (!periode) errors.datum = "Kies in welke periode u denkt.";
  } else if (!datum) {
    errors.datum = "Kies een datum, of vink aan dat de datum nog niet vastligt.";
  }
  if (!locatie) errors.locatie = "Vul in waar het event doorgaat.";
  if (!gasten) errors.gasten = "Kies hoeveel gasten u ongeveer verwacht.";
  if (!voornaam) errors.voornaam = "Vul uw voornaam in.";
  if (!achternaam) errors.achternaam = "Vul uw achternaam in.";
  if (!email) errors.email = "Vul uw e-mailadres in.";
  else if (!isEmail(email)) errors.email = "Dit lijkt geen geldig e-mailadres.";
  if (!telefoon) errors.telefoon = "Vul uw telefoonnummer in.";
  if (!privacy) errors.privacy = "Vink dit aan om uw aanvraag te kunnen versturen.";
  if (bericht.length > MAX_MESSAGE) errors.bericht = "Uw bericht is te lang.";

  if (Object.keys(errors).length > 0) {
    return json({ ok: false, errors }, 400);
  }

  const wanneer = datumFlexibel ? periode : formatDatum(datum);
  const subject = `Nieuwe aanvraag – ${eventType} – ${wanneer} – ${locatie}`;

  const blokken = [
    ["Event & muziek", [
      ["Type event", eventType],
      ["Moment muziek", moment],
      ["Gewenste sfeer", sfeer],
    ]],
    ["Praktische info", [
      [datumFlexibel ? "Periode" : "Datum", wanneer],
      ["Locatie", locatie],
      ["Aantal gasten", gasten],
    ]],
    ["Contactgegevens", [
      ["Naam", naam],
      ["E-mail", email],
      ["Telefoon", telefoon],
      ["Voorkeur contact", voorkeur || "Niet opgegeven"],
    ]],
    ["Extra info", [
      ["Vrij bericht", bericht || "-"],
    ]],
  ];

  const text = [
    subject,
    "",
    ...blokken.flatMap(([titel, rijen]) => [
      titel.toUpperCase(),
      ...rijen.map(([label, v]) => `  ${label.padEnd(18)}${v}`),
      "",
    ]),
  ].join("\n");

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#4c6a57;line-height:1.6;max-width:640px">
      <h2 style="margin:0 0 4px;font-size:20px">Nieuwe aanvraag via de website</h2>
      <p style="margin:0 0 24px;color:#55715e;font-size:14px">${esc(eventType)} &middot; ${esc(wanneer)} &middot; ${esc(locatie)}</p>
      ${blokken
        .map(
          ([titel, rijen]) => `
        <h3 style="margin:24px 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#af8f48">${esc(titel)}</h3>
        <table style="border-collapse:collapse;width:100%">
          ${rijen
            .map(
              ([label, v]) => `
            <tr>
              <td style="padding:6px 16px 6px 0;color:#55715e;vertical-align:top;white-space:nowrap">${esc(label)}</td>
              <td style="padding:6px 0;white-space:pre-wrap"><strong>${esc(v)}</strong></td>
            </tr>`
            )
            .join("")}
        </table>`
        )
        .join("")}
      <p style="margin-top:28px;color:#55715e;font-size:13px">
        Antwoord gewoon op deze mail om ${esc(naam)} direct te bereiken.
      </p>
    </div>`;

  return verstuur(env, { subject, text, html, replyTo: email });
}

/** 2026-09-14 -> 14/09/2026. Ongeldige invoer geeft de oorspronkelijke string terug. */
function formatDatum(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Verstuurt via Resend. Deelt de configuratie met het contactformulier. */
async function verstuur(env, { subject, text, html, replyTo }) {
  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM,
        to: [env.CONTACT_TO],
        reply_to: replyTo,
        subject,
        text,
        html,
      }),
    });
  } catch (err) {
    console.error("resend_unreachable", err?.message);
    return json({ ok: false, error: "send_failed" }, 502);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("resend_error", res.status, detail.slice(0, 300));
    return json({ ok: false, error: "send_failed" }, 502);
  }

  return json({ ok: true });
}

async function parseBody(request) {
  const ct = request.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await request.json();
  const fd = await request.formData();
  return Object.fromEntries(fd.entries());
}

const str = (v) => (typeof v === "string" ? v.trim() : "");

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

const esc = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
