/**
 * Gedeelde helpers voor de vertaalpijplijn.
 *
 * De site is handgeschreven HTML met inline <style> en <script>. Vertalen doen
 * we daarom op de ruwe HTML-string, maar met twee sloten erop:
 *
 *  1. Stijl-, script- en commentaarblokken worden overgeslagen.
 *  2. Binnen de rest raken we alleen echte tekst tussen de tags aan, plus een
 *     korte lijst attributen die de bezoeker leest (alt, aria-label, ...).
 *     Zonder dat tweede slot vervangt een sleutel als "ma" (maandag) vrolijk
 *     de "ma" in type="image/png".
 *
 * Sleutels die zélf tags bevatten (bijvoorbeeld "In <em>beeld</em>") worden
 * eerst en op de ruwe tekst toegepast, want die overspannen tagsgrenzen.
 */

const BLOCK_RE = /<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<!--[\s\S]*?-->/gi;

/** Attributen die zichtbare of voorgelezen tekst bevatten. */
const TEXT_ATTRS = ['alt', 'aria-label', 'aria-valuetext', 'aria-description', 'placeholder', 'title', 'data-cap'];

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

const WORDY = /[A-Za-z0-9À-ÿ]/;

/**
 * Zoekpatroon voor één Nederlandse zin.
 * - witruimte matcht elke witruimte, zodat een alinea die over meerdere regels
 *   staat gewoon gevonden wordt;
 * - begint of eindigt de zin op een letter of cijfer, dan mag er geen letter of
 *   cijfer tegenaan staan. Zo vindt "ma" wel het losse woord maar niet "maar".
 */
function toRegex(nl) {
  const core = nl.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  const before = WORDY.test(nl.trim()[0]) ? '(?<![A-Za-z0-9À-ÿ])' : '';
  const after = WORDY.test(nl.trim().slice(-1)) ? '(?![A-Za-z0-9À-ÿ])' : '';
  return new RegExp(before + core + after, 'g');
}

/**
 * Past [nl, en]-paren toe. Geeft per paar terug hoe vaak het raak was, zodat
 * de bouwstap kan melden welke vertaling nergens meer past.
 */
export function applyPairs(html, pairs) {
  const counts = pairs.map(() => 0);
  const res = pairs.map(([nl]) => toRegex(nl));

  // Langste zoekterm eerst: anders knipt "ons" de zin "Contacteer ons"
  // doormidden voordat de volledige zin aan de beurt is.
  const byLength = (a, b) => pairs[b][0].length - pairs[a][0].length;
  const markup = pairs.map((_, i) => i).filter((i) => pairs[i][0].includes('<')).sort(byLength);
  const plain = pairs.map((_, i) => i).filter((i) => !pairs[i][0].includes('<')).sort(byLength);

  const replace = (text, idx) =>
    text.replace(res[idx], () => {
      counts[idx] += 1;
      return pairs[idx][1];
    });

  const parts = segment(html);
  for (const part of parts) {
    if (!part.translatable) continue;

    // 1. Sleutels mét tags, op de ruwe tekst.
    for (const i of markup) part.text = replace(part.text, i);

    // 2. Sleutels zonder tags: enkel tekst tussen de tags, plus de attributen
    //    die de bezoeker leest.
    part.text = part.text
      .split(/(<[^>]*>)/)
      .map((piece) => {
        if (!piece.startsWith('<')) {
          for (const i of plain) piece = replace(piece, i);
          return piece;
        }
        // Binnen een tag: alleen de waarde van een tekst-attribuut.
        for (const a of TEXT_ATTRS) {
          piece = piece.replace(new RegExp(`(\\b${a}=")([^"]*)(")`), (m, open, val, close) => {
            let v = val;
            for (const i of plain) v = replace(v, i);
            return open + v + close;
          });
        }
        // <meta name="description"> heeft zijn eigen vertaling in head, dus
        // content= laten we hier bewust met rust.
        return piece;
      })
      .join('');
  }
  return { html: join(parts), counts };
}

/** Zichtbare tekstfragmenten en vertaalbare attributen, in volgorde van voorkomen. */
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
    for (const chunk of part.text.split(/<[^>]*>/)) push(chunk);
    for (const m of part.text.matchAll(/<[^>]+>/g)) {
      const tag = m[0];
      if (/^<meta/i.test(tag) && !/name="description"/i.test(tag)) continue;
      for (const a of [...TEXT_ATTRS, 'content']) {
        const am = tag.match(new RegExp(`\\b${a}="([^"]*)"`));
        if (am) push(am[1]);
      }
    }
    const tm = part.text.match(/<title>([\s\S]*?)<\/title>/i);
    if (tm) push(tm[1]);
  }
  return units;
}
