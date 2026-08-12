#!/usr/bin/env node
/**
 * Zet de content uit content/<taal>/ in de HTML.
 *
 *   node tools/build-content.mjs            content -> HTML
 *   node tools/build-content.mjs --extract  HTML -> content (eenmalig vullen)
 *
 * Draait ná tools/build-i18n.mjs: die bouwt public/en/ op, deze stap schrijft
 * in beide talen de teksten terug die via /admin bewerkt worden.
 *
 * De HTML blijft de terugval. Ontbreekt een sleutel in de JSON, dan blijft
 * gewoon staan wat er stond.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectContent, readFromHtml, extractKeys, flatten, nest } from './content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const CONTENT = path.join(ROOT, 'content');
const EXTRACT = process.argv.includes('--extract');

/** Welke contentbestanden een pagina voedt, en waar de Engelse versie staat. */
const PAGES = {
  'index.html': { en: 'en/index.html', seo: 'home', files: ['settings/global.json', 'pages/home.json'] },
  'diensten.html': { en: 'en/services.html', seo: 'diensten', files: ['settings/global.json', 'pages/diensten.json'] },
  'over.html': { en: 'en/about.html', seo: 'over', files: ['settings/global.json', 'pages/over.json'] },
  'gallerij.html': { en: 'en/gallery.html', seo: 'gallerij', files: ['settings/global.json', 'pages/gallerij.json'] },
  'contact.html': { en: 'en/contact.html', seo: 'contact', files: ['settings/global.json', 'pages/contact.json'] },
  'aanvraag.html': { en: 'en/request.html', seo: 'aanvraag', files: [] },
};

const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {});
const writeJson = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function setHead(html, seo) {
  if (seo?.title) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${seo.title}</title>`);
  if (seo?.description) {
    html = html.replace(/<meta name="description" content="[\s\S]*?">/,
      `<meta name="description" content="${esc(seo.description)}">`);
  }
  return html;
}

/* ─────────────────────────────────────────────────────────────
   Eenmalig vullen: de huidige site wordt de eerste contentversie
   ───────────────────────────────────────────────────────────── */

if (EXTRACT) {
  for (const lang of ['nl', 'en']) {
    const seo = {};
    const buckets = {};

    for (const [nlFile, cfg] of Object.entries(PAGES)) {
      const file = path.join(PUB, lang === 'nl' ? nlFile : cfg.en);
      const html = fs.readFileSync(file, 'utf8');
      const waarden = readFromHtml(html);

      seo[cfg.seo] = {
        title: (html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '',
        description: (html.match(/<meta name="description" content="([\s\S]*?)">/) || [])[1] || '',
      };

      for (const target of cfg.files) {
        buckets[target] ||= {};
        const prefix = target.startsWith('settings/') ? ['footer', 'social'] : null;
        for (const [k, v] of Object.entries(waarden)) {
          const hoortHier = prefix ? prefix.some((p) => k.startsWith(p + '.')) : !['footer', 'social'].some((p) => k.startsWith(p + '.'));
          if (hoortHier) buckets[target][k] = v;
        }
      }
    }

    writeJson(path.join(CONTENT, lang, 'seo.json'), seo);
    for (const [target, flat] of Object.entries(buckets)) {
      writeJson(path.join(CONTENT, lang, target), nest(flat));
    }
    console.log(`content/${lang}/ gevuld: seo.json + ${Object.keys(buckets).length} bestand(en)`);
  }
  process.exit(0);
}

/* ─────────────────────────────────────────────────────────────
   Normale build: content -> HTML
   ───────────────────────────────────────────────────────────── */

const problems = [];

for (const lang of ['nl', 'en']) {
  const seoAll = readJson(path.join(CONTENT, lang, 'seo.json'));

  for (const [nlFile, cfg] of Object.entries(PAGES)) {
    const rel = lang === 'nl' ? nlFile : cfg.en;
    const file = path.join(PUB, rel);
    let html = fs.readFileSync(file, 'utf8');

    let data = {};
    for (const target of cfg.files) {
      data = { ...data, ...flatten(readJson(path.join(CONTENT, lang, target))) };
    }

    const res = injectContent(html, data);
    html = setHead(res.html, seoAll[cfg.seo]);

    if (res.leeg.length) problems.push(`${rel}: geen tekst in de content voor ${res.leeg.join(', ')}`);
    if (res.ongebruikt.length) problems.push(`${rel}: content zonder plek in de HTML: ${res.ongebruikt.join(', ')}`);

    fs.writeFileSync(file, html, 'utf8');
    const n = extractKeys(html);
    console.log(`${rel.padEnd(22)} ${n.text.length + n.href.length} velden`);
  }
}

if (problems.length) {
  console.error(`\n${problems.length} aandachtspunt(en):`);
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('\nContent verwerkt.');
