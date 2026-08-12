#!/usr/bin/env node
/**
 * Bouwt de Engelse site (public/en/) uit de Nederlandse bronpagina's.
 *
 *   node tools/build-i18n.mjs          bouwt public/en/
 *   node tools/build-i18n.mjs --check  bouwt niets, meldt alleen problemen
 *
 * De Nederlandse pagina's blijven de enige bron. Wijzig je NL-copy, dan draai je
 * dit script opnieuw. Ontbreekt er een vertaling, dan stopt het script met een
 * foutmelding in plaats van stilletjes Nederlands in de Engelse site te laten staan.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyPairs, segment, join } from './i18n-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const OUT = path.join(PUB, 'en');
const CHECK_ONLY = process.argv.includes('--check');

const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/i18n/en.json'), 'utf8'));

/** NL-bestand -> Engelse bestandsnaam en de twee publieke URL's. */
export const PAGES = {
  'index.html': { file: 'index.html', nl: '/', en: '/en/' },
  'diensten.html': { file: 'services.html', nl: '/diensten', en: '/en/services' },
  'over.html': { file: 'about.html', nl: '/over', en: '/en/about' },
  'gallerij.html': { file: 'gallery.html', nl: '/gallerij', en: '/en/gallery' },
  'contact.html': { file: 'contact.html', nl: '/contact', en: '/en/contact' },
  'aanvraag.html': { file: 'request.html', nl: '/aanvraag', en: '/en/request' },
};

const SITE = 'https://relovation.be';
const problems = [];
const note = (m) => problems.push(m);

/* ─────────────────────────────────────────────────────────────
   Koppen met woord-voor-woord animatie
   ───────────────────────────────────────────────────────────── */

/**
 * De koppen zijn opgebouwd uit <span class="reveal-word">-blokjes met een
 * oplopende animation-delay. Woord-voor-woord vertalen kan dus niet: een
 * Engelse kop heeft een ander aantal woorden. Daarom vervangen we de hele kop.
 *
 * Notatie in het woordenboek:  "Live|played / for|your|*moment.*"
 *   " / " scheidt regels, "|" scheidt animatiestappen, *sterretjes* = cursief.
 */
function rebuildHeadings(html, pageName) {
  const HEADING_RE = /<(h[1-3])([^>]*)>([\s\S]*?)<\/\1>/g;

  return html.replace(HEADING_RE, (full, tag, attrs, inner) => {
    // Welke familie van animatiespans gebruikt deze kop? (reveal-word, quote-word, ...)
    const family = inner.match(/<span class="([a-z]+)-word\b/);
    if (!family) return full;
    const pre = family[1];

    const spanRe = new RegExp(`<span class="${pre}-word([^"]*)"([^>]*)>([\\s\\S]*?)</span>`, 'g');
    const spans = [...inner.matchAll(spanRe)];
    if (!spans.length) return full;

    const words = spans.map((m) => m[3].replace(/<\/?em>/g, '').trim());
    const nlText = (attrs.match(/aria-label="([^"]*)"/) || [null, words.join(' ')])[1];
    const enText = dict.headings[nlText];
    if (!enText) {
      note(`${pageName}: geen vertaling voor kop "${nlText}"`);
      return full;
    }

    // Structuur van het origineel overnemen: accentklasse, <em>, regelwikkel, timing.
    const accentClass = (spans.find((m) => m[1].trim())?.[1] || '').trim();
    const usesEm = spans.some((m) => /^<em>/.test(m[3].trim()));
    const lineOpen = inner.match(new RegExp(`<span class="${pre}-line"( aria-hidden="true")?>`));
    const delays = spans
      .map((m) => parseFloat((m[2].match(/animation-delay:\s*([\d.]+)s/) || [])[1]))
      .filter((n) => !Number.isNaN(n));
    const start = delays.length ? delays[0] : 0.04;
    const step = delays.length > 1 ? Math.round((delays[1] - delays[0]) * 1000) / 1000 : 0.06;

    const indentMatch = inner.match(new RegExp(`\\n([ \\t]*)<span class="${pre}-(?:line|word)`));
    const baseIndent = indentMatch ? indentMatch[1] : '  ';
    const wordIndent = lineOpen ? baseIndent + '  ' : baseIndent;
    const closeIndent = baseIndent.slice(0, -2);

    let i = 0;
    const mkSpan = (raw) => {
      const accent = raw.startsWith('*') && raw.endsWith('*');
      const text = accent ? raw.slice(1, -1) : raw;
      const delay = String(Math.round((start + i * step) * 1000) / 1000);
      i += 1;
      const cls = accent && accentClass ? `${pre}-word ${accentClass}` : `${pre}-word`;
      const body = accent && usesEm ? `<em>${text}</em>` : text;
      return `${wordIndent}<span class="${cls}" style="animation-delay: ${delay}s;">${body}</span>`;
    };

    let body;
    if (lineOpen) {
      body = enText
        .split(' / ')
        .map((line) => [
          baseIndent + lineOpen[0],
          ...line.split('|').map(mkSpan),
          `${baseIndent}</span>`,
        ].join('\n'))
        .join('\n');
    } else {
      body = enText.split(' / ').join('|').split('|').map(mkSpan).join('\n');
    }

    const newAttrs = attrs.replace(/aria-label="[^"]*"/, () => {
      const plain = enText.replace(/[*|]/g, ' ').replace(/ \/ /g, ' ')
        .replace(/\s+([?!.,])/g, '$1').replace(/\s+/g, ' ').trim();
      return `aria-label="${plain}"`;
    });

    return `<${tag}${newAttrs}>\n${body}\n${closeIndent}</${tag}>`;
  });
}

/* ─────────────────────────────────────────────────────────────
   Paden en links
   ───────────────────────────────────────────────────────────── */

function rewriteLinks(html) {
  const parts = segment(html);
  const slugs = Object.entries(PAGES);

  for (const part of parts) {
    // Ook binnen inline scripts staan paden (fetch, data-img), dus die doen we mee.
    // Relatief "./x" wordt absoluut "/x": de Engelse pagina's staan een map dieper.
    part.text = part.text.replace(/(["'(])\.\//g, '$1/');
    for (const [nlFile, meta] of slugs) {
      part.text = part.text.replace(
        new RegExp(`(["'])/${nlFile.replace('.', '\\.')}((?:#|\\?)[^"']*)?\\1`, 'g'),
        (_m, q, tail) => `${q}${meta.en}${tail || ''}${q}`,
      );
    }
  }
  return join(parts);
}

/* ─────────────────────────────────────────────────────────────
   Head: taal, titel, beschrijving, hreflang
   ───────────────────────────────────────────────────────────── */

function rewriteHead(html, nlFile) {
  const meta = PAGES[nlFile];
  const head = dict.head[nlFile];
  if (!head) throw new Error(`geen head-vertaling voor ${nlFile}`);

  html = html.replace('<html lang="nl">', '<html lang="en">');
  // Verborgen veld voor de no-JS POST: zonder JavaScript is dit het enige
  // signaal waaraan de Worker ziet in welke taal hij moet antwoorden.
  html = html.replace(/name="lang" value="nl"/g, 'name="lang" value="en"');
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${head.title}</title>`);
  html = html.replace(
    /<meta name="description" content="[\s\S]*?">/,
    `<meta name="description" content="${head.description}">`,
  );
  return html;
}

function alternates(nlFile, lang) {
  const meta = PAGES[nlFile];
  return [
    `  <link rel="canonical" href="${SITE}${lang === 'nl' ? meta.nl : meta.en}">`,
    `  <link rel="alternate" hreflang="nl" href="${SITE}${meta.nl}">`,
    `  <link rel="alternate" hreflang="en" href="${SITE}${meta.en}">`,
    `  <link rel="alternate" hreflang="x-default" href="${SITE}${meta.nl}">`,
    '',
  ].join('\n');
}

function setAlternates(html, nlFile, lang) {
  const block = alternates(nlFile, lang);
  const existing = /(  <link rel="canonical"[\s\S]*?hreflang="x-default"[^>]*>\n)/;
  if (existing.test(html)) return html.replace(existing, block);
  return html.replace('  <link rel="manifest"', block + '  <link rel="manifest"');
}

/** Zet de actieve knop van de taalschakelaar op de juiste taal. */
function setActiveLang(html, lang) {
  const other = lang === 'nl' ? 'en' : 'nl';
  html = html.replace(
    new RegExp(`(<a class="r-nav__lang-opt)( is-active)?(" data-lang="${other}")([^>]*?)( aria-current="true")?>`, 'g'),
    '$1$3$4>',
  );
  html = html.replace(
    new RegExp(`(<a class="r-nav__lang-opt)( is-active)?(" data-lang="${lang}")([^>]*?)( aria-current="true")?>`, 'g'),
    '$1 is-active$3$4 aria-current="true">',
  );
  return html;
}

/* ─────────────────────────────────────────────────────────────
   Bouwen
   ───────────────────────────────────────────────────────────── */

// Alleen woorden die in het Engels niet bestaan: "over", "van", "met" en "die"
// staan er bewust niet in, die gaven vals alarm op correcte Engelse zinnen.
const DUTCH_TELLS = /\b(uw|onze|het|een|voor|niet|geen|maar|wij|ons|zijn|worden|waar|welke|deze|door|naar|bij|dat|aan|als|ook|nog|tot|wat|hoe|elke|zonder|muziek|muzikanten|avond|feest|gasten|bezetting|aanvraag|bericht|verzenden|versturen|vraag|kies|vul)\b/i;

function leftoverDutch(html) {
  const hits = [];
  for (const part of segment(html)) {
    if (!part.translatable) continue;
    for (const chunk of part.text.split(/<[^>]*>/)) {
      const t = chunk.replace(/\s+/g, ' ').trim();
      if (t.length > 3 && DUTCH_TELLS.test(t)) hits.push(t);
    }
  }
  return [...new Set(hits)];
}

const commonHits = new Map(dict.common.map(([nl]) => [nl, 0]));

fs.mkdirSync(OUT, { recursive: true });

for (const [nlFile, meta] of Object.entries(PAGES)) {
  const src = path.join(PUB, nlFile);
  let html = fs.readFileSync(src, 'utf8');

  // 1. De Nederlandse bron krijgt zijn eigen canonical + hreflang.
  const nlUpdated = setAlternates(setActiveLang(html, 'nl'), nlFile, 'nl');
  if (nlUpdated !== html && !CHECK_ONLY) fs.writeFileSync(src, nlUpdated, 'utf8');
  html = nlUpdated;

  // 2. Engelse versie opbouwen.
  let en = rebuildHeadings(html, nlFile);

  // Pagina- en gedeelde regels gaan samen in één lijst: applyPairs vervangt de
  // langste zoekterm eerst, en dat mag niet doorbroken worden door de volgorde
  // waarin de twee lijsten staan. Een paginaregel wint van een gedeelde regel.
  const pageDict = (dict.pages[nlFile] || []).map(([a, b]) => [a, b]);
  const pageKeys = new Set(pageDict.map(([nl]) => nl));
  const shared = dict.common.filter(([nl]) => !pageKeys.has(nl)).map(([a, b]) => [a, b]);
  const all = [...pageDict, ...shared];

  const res = applyPairs(en, all);
  en = res.html;
  res.counts.forEach((c, i) => {
    if (i < pageDict.length) {
      if (c === 0) note(`${nlFile}: paginaregel nooit gevonden -> ${JSON.stringify(all[i][0].slice(0, 70))}`);
    } else {
      commonHits.set(all[i][0], commonHits.get(all[i][0]) + c);
    }
  });

  en = rewriteHead(en, nlFile);
  en = rewriteLinks(en);
  en = setAlternates(setActiveLang(en, 'en'), nlFile, 'en');

  const left = leftoverDutch(en);
  if (left.length) note(`${nlFile}: mogelijk nog Nederlands -> ${JSON.stringify(left.slice(0, 8))}${left.length > 8 ? ` (+${left.length - 8})` : ''}`);

  if (!CHECK_ONLY) fs.writeFileSync(path.join(OUT, meta.file), en, 'utf8');
  console.log(`${nlFile.padEnd(15)} -> en/${meta.file}`);
}

for (const [nl, c] of commonHits) {
  if (c === 0) note(`gedeelde regel nooit gevonden -> ${JSON.stringify(nl.slice(0, 70))}`);
}

if (problems.length) {
  console.error(`\n${problems.length} probleem(en):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('\nEngelse site opgebouwd zonder problemen.');
