/**
 * Gedeelde helpers voor de vertaalpijplijn.
 *
 * De site is handgeschreven HTML met inline <style> en <script>. Vertalen doen
 * we daarom op de ruwe HTML-string, maar alleen in de stukken die geen stijl,
 * script of commentaar zijn. Zo kan een korte zin als "Meer weten" nooit per
 * ongeluk een CSS-selector of een stukje JavaScript raken.
 */

const BLOCK_RE = /<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<!--[\s\S]*?-->/gi;

/** Splitst HTML in stukken; alleen stukken met translatable:true mogen vertaald worden. */
export function segment(html) {
  const parts = [];
  let last = 0;
  for (const m of html.matchAll(BLOCK_RE)) {
    if (m.index > last) parts.push({ text: html.slice(last, m.index), translatable: true });
    parts.push({ text: m[0], translatable: false });
    last = m.index + m[0].length;
  }
  if (last < html.length) parts.push({ text: html.slice(last), translatable: true });
  return parts;
}

export function join(parts) {
  return parts.map((p) => p.text).join('');
}

/**
 * Past [nl, en]-paren toe op de vertaalbare stukken.
 *
 * De zoekterm is ongevoelig voor regelafbrekingen: elke reeks witruimte in de
 * Nederlandse tekst matcht elke reeks witruimte in het bestand. Zo blijft een
 * lange alinea vindbaar, ook als die over meerdere regels staat.
 */
export function applyPairs(html, pairs) {
  const parts = segment(html);
  const counts = pairs.map(() => 0);
  const res = pairs.map(([nl]) =>
    new RegExp(nl.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'g'));

  // Langste zoekterm eerst: anders knipt "ons" de zin "Contacteer ons" doormidden
  // voordat de volledige zin aan de beurt is.
  const order = pairs.map((_, i) => i).sort((a, b) => pairs[b][0].length - pairs[a][0].length);

  for (const part of parts) {
    if (!part.translatable) continue;
    for (const i of order) {
      part.text = part.text.replace(res[i], () => {
        counts[i] += 1;
        return pairs[i][1];
      });
    }
  }
  return { html: join(parts), counts };
}

/** Zichtbare tekstfragmenten en vertaalbare attributen, in volgorde van voorkomen. */
const ATTRS = ['alt', 'aria-label', 'placeholder', 'data-cap', 'title', 'aria-valuetext', 'content'];

export function extractUnits(html) {
  const units = [];
  const seen = new Set();
  const push = (t) => {
    const v = t.replace(/\s+/g, ' ').trim();
    if (!v || !/[A-Za-zÀ-ÿ]/.test(v)) return;
    if (seen.has(v)) return;
    seen.add(v);
    units.push(v);
  };

  for (const part of segment(html)) {
    if (!part.translatable) continue;
    // Tekst tussen tags.
    for (const chunk of part.text.split(/<[^>]*>/)) push(chunk);
    // Vertaalbare attributen.
    for (const m of part.text.matchAll(/<[^>]+>/g)) {
      const tag = m[0];
      if (/^<meta/i.test(tag) && !/name="description"/i.test(tag)) continue;
      for (const a of ATTRS) {
        const am = tag.match(new RegExp(`\\b${a}="([^"]*)"`));
        if (am) push(am[1]);
      }
    }
    // <title>
    const tm = part.text.match(/<title>([\s\S]*?)<\/title>/i);
    if (tm) push(tm[1]);
  }
  return units;
}
