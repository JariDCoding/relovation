/**
 * Content-laag tussen het CMS en de HTML.
 *
 * De HTML blijft handgeschreven. Elementen die de klant via /admin mag wijzigen
 * dragen een `data-cms="sleutel"`; links een `data-cms-href="sleutel"`. Bij de
 * build wordt de inhoud van die elementen vervangen door de waarde uit
 * content/<taal>/... — is er geen waarde, dan blijft wat in de HTML staat.
 *
 * Zo hoeft er geen enkele pagina omgebouwd te worden naar templates, en is een
 * lege of half ingevulde JSON nooit een kapotte pagina.
 *
 *   extractKeys(html)          -> alle sleutels op een pagina
 *   readFromHtml(html)         -> huidige waarden, om de JSON mee te vullen
 *   injectContent(html, data)  -> waarden terugschrijven
 */

const OPEN_TAG = '[A-Za-z][A-Za-z0-9]*';

function elementRe(key) {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Globaal: dezelfde sleutel mag meermaals op een pagina staan (denk aan het
  // e-mailadres in de footer en in het overlaymenu).
  return new RegExp(`<(${OPEN_TAG})([^>]*\\bdata-cms="${k}"[^>]*)>([\\s\\S]*?)</\\1>`, 'g');
}

function hrefRe(key) {
  const k = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<(${OPEN_TAG})([^>]*\\bdata-cms-href="${k}"[^>]*)>`, 'g');
}

export function extractKeys(html) {
  return {
    text: [...new Set([...html.matchAll(/\bdata-cms="([^"]+)"/g)].map((m) => m[1]))],
    href: [...new Set([...html.matchAll(/\bdata-cms-href="([^"]+)"/g)].map((m) => m[1]))],
  };
}

/** Haalt de huidige waarden uit de HTML, zodat de eerste JSON exact de site is. */
export function readFromHtml(html) {
  const out = {};
  const keys = extractKeys(html);
  for (const key of keys.text) {
    const m = elementRe(key).exec(html);
    if (m) out[key] = m[3].trim().replace(/\s*\n\s*/g, ' ');
  }
  for (const key of keys.href) {
    const m = hrefRe(key).exec(html);
    if (m) {
      const h = m[2].match(/\bhref="([^"]*)"/);
      if (h) out[key] = h[1];
    }
  }
  return out;
}

/**
 * Schrijft waarden terug. Geeft terug welke sleutels op de pagina stonden maar
 * geen waarde hadden, en welke waarden nergens pasten: allebei zijn een teken
 * dat de JSON en de HTML uit elkaar gelopen zijn.
 */
export function injectContent(html, data) {
  const keys = extractKeys(html);
  const ongebruikt = new Set(Object.keys(data));
  const leeg = [];

  for (const key of keys.text) {
    const val = data[key];
    if (val === undefined || val === null || val === '') { leeg.push(key); continue; }
    ongebruikt.delete(key);
    html = html.replace(elementRe(key), (_m, tag, attrs) => `<${tag}${attrs}>${val}</${tag}>`);
  }

  for (const key of keys.href) {
    const val = data[key];
    if (val === undefined || val === null || val === '') { leeg.push(key); continue; }
    ongebruikt.delete(key);
    html = html.replace(hrefRe(key), (m, tag, attrs) => {
      const next = attrs.includes('href="')
        ? attrs.replace(/\bhref="[^"]*"/, `href="${val}"`)
        : `${attrs} href="${val}"`;
      return `<${tag}${next}>`;
    });
  }

  return { html, leeg, ongebruikt: [...ongebruikt] };
}

/** Plat object uit een geneste JSON: { hero: { sub: "x" } } -> { "hero.sub": "x" } */
export function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      // Een lijst van losse teksten (bijvoorbeeld opsommingspunten) mag niet
      // per letter uit elkaar vallen: alleen objecten gaan een niveau dieper.
      v.forEach((item, i) => {
        if (item && typeof item === 'object') flatten(item, `${key}.${i}`, out);
        else out[`${key}.${i}`] = item;
      });
    } else if (v && typeof v === 'object') {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

/** Omgekeerd: { "hero.sub": "x" } -> { hero: { sub: "x" } }, met arrays op cijfers. */
export function nest(flat) {
  const root = {};
  for (const [key, val] of Object.entries(flat)) {
    const parts = key.split('.');
    let node = root;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) { node[p] = val; return; }
      const nextIsIndex = /^\d+$/.test(parts[i + 1]);
      if (node[p] === undefined) node[p] = nextIsIndex ? [] : {};
      node = node[p];
    });
  }
  return root;
}
