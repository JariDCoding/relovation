#!/usr/bin/env node
/**
 * Schrijft public/admin/config.yml uit de bestanden in content/nl/.
 *
 * Zo kan het CMS niet achterlopen op de site: markeer een element met
 * data-cms, draai `npm run content:extract`, draai dit script, en het veld
 * staat in /admin. Handmatig YAML bijhouden hoeft niet meer.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NL = path.join(ROOT, 'content/nl');

/** Nette labels; wat hier niet in staat wordt netjes afgeleid uit de sleutel. */
const LABELS = {
  footer: 'Footer', social: 'Sociale media', tagline: 'Tekst onder het logo',
  email: 'E-mailadres', regio: 'Regio', ctaTitel: 'Titel bij de knop', btw: 'Btw-nummer',
  instagram: 'Instagram-link', linkedin: 'LinkedIn-link', facebook: 'Facebook-link',
  hero: 'Hero', eyebrow: 'Bovenschrift', subtitel: 'Tekst onder de titel',
  tekst: 'Tekst', titel: 'Titel', naam: 'Naam', rol: 'Rol', bio: 'Biografie',
  intro: 'Inleiding', lede: 'Openingstekst', citaat: 'Citaat', noot: 'Voetnoot',
  slotnoot: 'Afsluitende noot', over: 'Wat is Relovation', gelegenheden: 'Gelegenheden',
  waarom: 'Waarom Relovation', punten: 'Punten', bezettingen: 'Bezettingen',
  instrumenten: 'Instrumenten', cta: 'Slotblok', diensten: 'Diensten',
  index: 'Inhoudsopgave', verhaal: 'Ons verhaal', visie: 'De kunst van aanwezigheid',
  muzikanten: 'Onze muzikanten', leden: 'Leden', werkwijze: 'Hoe wij werken',
  bijschriften: 'Bijschriften bij de foto\'s', ensemble: 'Het ensemble',
  instrument: 'Instrument', spelen: 'Hoe wij spelen', formulierIntro: 'Tekst bij het formulier',
  socialIntro: 'Tekst bij sociale media', title: 'Titel', description: 'Omschrijving',
  home: 'Home', contact: 'Contact', gallerij: 'Gallerij', aanvraag: 'Aanvraag',
};

const label = (key) => LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1').toLowerCase();
const widgetFor = (v) => (String(v).length > 90 || /[.!?]\s/.test(String(v)) ? 'text' : 'string');
const q = (s) => `"${String(s).replace(/"/g, '\\"')}"`;

/** Bouwt de veldenlijst voor één JSON-object. */
function fields(obj, indent) {
  const pad = ' '.repeat(indent);
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      const first = v[0];
      out.push(`${pad}- label: ${q(label(k))}`);
      out.push(`${pad}  name: ${q(k)}`);
      out.push(`${pad}  widget: "list"`);
      out.push(`${pad}  i18n: true`);
      out.push(`${pad}  allow_add: false`);   // vaste lijsten: de site verwacht dit aantal
      out.push(`${pad}  allow_delete: false`);
      if (first && typeof first === 'object') {
        out.push(`${pad}  fields:`);
        out.push(...fields(first, indent + 4));
      } else {
        out.push(`${pad}  field: { label: ${q(label(k))}, name: "item", widget: ${q(widgetFor(first))}, i18n: true }`);
      }
    } else if (v && typeof v === 'object') {
      out.push(`${pad}- label: ${q(label(k))}`);
      out.push(`${pad}  name: ${q(k)}`);
      out.push(`${pad}  widget: "object"`);
      out.push(`${pad}  i18n: true`);
      out.push(`${pad}  fields:`);
      out.push(...fields(v, indent + 4));
    } else {
      // Adressen en links horen in beide talen hetzelfde te zijn.
      const dup = ['email', 'btw', 'instagram', 'linkedin', 'facebook'].includes(k);
      out.push(`${pad}- { label: ${q(label(k))}, name: ${q(k)}, widget: ${q(widgetFor(v))}, i18n: ${dup ? 'duplicate' : 'true'} }`);
    }
  }
  return out;
}

function fileBlock(name, labelText, relPath, indent, description) {
  const data = JSON.parse(fs.readFileSync(path.join(NL, relPath), 'utf8'));
  const pad = ' '.repeat(indent);
  return [
    `${pad}- name: ${q(name)}`,
    `${pad}  label: ${q(labelText)}`,
    `${pad}  file: ${q('content/' + relPath)}`,
    `${pad}  i18n: true`,
    ...(description ? [`${pad}  description: ${q(description)}`] : []),
    `${pad}  fields:`,
    ...fields(data, indent + 4),
  ].join('\n');
}

const PAGINAS = [
  ['home', 'Home', 'pages/home.json'],
  ['diensten', 'Diensten', 'pages/diensten.json'],
  ['over', 'Over ons', 'pages/over.json'],
  ['gallerij', 'Gallerij', 'pages/gallerij.json'],
  ['contact', 'Contact', 'pages/contact.json'],
];

const yaml = `# Sveltia CMS — Relovation
#
# LET OP: dit bestand wordt gegenereerd door tools/build-cms-config.mjs uit de
# bestanden in content/nl/. Wijzig het niet met de hand; markeer een element in
# de HTML met data-cms, draai \`npm run content:extract\` en daarna
# \`npm run cms:config\`.
#
# Git-backend: opslaan is een commit naar GitHub, en die commit deployt.
# Geen enkel secret aan de site-kant; het OAuth-secret staat op de gedeelde
# Worker auth.jdcreations.co.
backend:
  name: github
  repo: JariDCoding/relovation
  branch: main
  base_url: https://auth.jdcreations.co
  commit_messages:
    update: "Content: {{collection}} · {{slug}} bijgewerkt via CMS"

locale: nl

# Nederlands en Engels naast elkaar in hetzelfde scherm. multiple_folders zet
# de bestanden in content/nl/... en content/en/..., waar de build ze verwacht.
i18n:
  structure: multiple_folders
  locales: [nl, en]
  default_locale: nl

media_folder: "public/uploads"
public_folder: "/uploads"

# Allemaal \`files\`-collecties: Robin bewerkt bestaande teksten en kan geen
# pagina's bijmaken of verwijderen. De structuur van de site blijft intact.
collections:
  - name: "instellingen"
    label: "Site-instellingen"
    i18n: true
    files:
${fileBlock('global', 'Footer & sociale media', 'settings/global.json', 6, 'Staat op elke pagina.')}

  - name: "paginas"
    label: "Pagina's"
    i18n: true
    files:
${PAGINAS.map(([n, l, p]) => fileBlock(n, l, p, 6)).join('\n\n')}

  - name: "seo"
    label: "Google-teksten"
    i18n: true
    files:
${fileBlock('seo', 'Titel & omschrijving per pagina', 'seo.json', 6, 'Dit is wat Google in de zoekresultaten toont. Houd de titel onder 60 tekens en de omschrijving onder 160.')}
`;

fs.writeFileSync(path.join(ROOT, 'public/admin/config.yml'), yaml, 'utf8');
const velden = (yaml.match(/widget:/g) || []).length;
console.log(`public/admin/config.yml geschreven — ${velden} velden`);
