/**
 * SEO-laag: Open Graph, Twitter-kaarten en JSON-LD, per pagina en per taal.
 *
 * Deze module is de enige bron. build-i18n.mjs spuit het blok in de Nederlandse
 * én de Engelse pagina's, tussen <!-- seo:start --> en <!-- seo:end -->.
 *
 * Regel uit het SEO-brein: markeer alleen wat ook op de pagina staat. Er staan
 * hier dus geen reviews, geen prijzen en geen adres dat de bezoeker niet ziet.
 */

export const SITE = 'https://relovation.be';

/** Sociale profielen. Leeg gelaten tot de echte URL's bekend zijn: een
 *  verkeerde sameAs verzwakt het entiteitssignaal meer dan geen sameAs. */
export const SAME_AS = [];

const ORG_ID = `${SITE}/#organization`;
const SITE_ID = `${SITE}/#website`;

const MUZIKANTEN = [
  { name: 'Robin Crauwels', role: 'Zang & saxofoon', roleEn: 'Vocals & saxophone' },
  { name: 'Lorenzo Nsumbi', role: 'Piano', roleEn: 'Piano' },
  { name: 'Tim Pensaert', role: 'Bas', roleEn: 'Bass' },
  { name: 'Joppe Van Noten', role: 'Drums', roleEn: 'Drums' },
];

/** De band als entiteit. Staat op elke pagina, altijd hetzelfde @id. */
function organization(lang) {
  const nl = lang === 'nl';
  return {
    '@type': ['MusicGroup', 'LocalBusiness'],
    '@id': ORG_ID,
    name: 'Relovation',
    legalName: 'Robin Crauwels',
    vatID: 'BE0773.507.001',
    url: nl ? `${SITE}/` : `${SITE}/en/`,
    logo: `${SITE}/assets/brand/round-512.png`,
    image: `${SITE}/assets/brand/og-${lang}.png`,
    email: 'relovation@robinmusic.be',
    foundingDate: '2018',
    genre: nl ? ['Jazz', 'Soul', 'Pop'] : ['Jazz', 'Soul', 'Pop'],
    description: nl
      ? 'Relovation speelt live muziek op trouwfeesten, bedrijfsevents en privéfeesten. Duo, trio of full band, met eigen geluidsinstallatie.'
      : 'Relovation plays live music at weddings, corporate events and private parties. Duo, trio or full band, with our own sound system.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Lier',
      addressRegion: nl ? 'Antwerpen' : 'Antwerp',
      addressCountry: 'BE',
    },
    areaServed: [
      { '@type': 'Country', name: nl ? 'België' : 'Belgium' },
      { '@type': 'AdministrativeArea', name: nl ? 'Vlaanderen' : 'Flanders' },
    ],
    member: MUZIKANTEN.map((m) => ({
      '@type': 'Person',
      name: m.name,
      jobTitle: nl ? m.role : m.roleEn,
    })),
    ...(SAME_AS.length ? { sameAs: SAME_AS } : {}),
  };
}

function website(lang) {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: `${SITE}/`,
    name: 'Relovation',
    inLanguage: lang === 'nl' ? 'nl-BE' : 'en',
    publisher: { '@id': ORG_ID },
  };
}

/** Diensten zoals ze op de dienstenpagina staan. */
const DIENSTEN = [
  {
    nl: { name: 'Live muziek voor trouwfeesten',
          desc: 'Van ceremonie en welkomstdrink tot het begin van de avond, met een bezetting op maat van uw dag.' },
    en: { name: 'Live music for weddings',
          desc: 'From ceremony and welcome drink to the start of the evening, with a line-up tailored to your day.' },
  },
  {
    nl: { name: 'Live muziek voor bedrijfsevents',
          desc: 'Recepties, walking dinners en netwerkmomenten, met bezetting en volume afgestemd op locatie en publiek.' },
    en: { name: 'Live music for corporate events',
          desc: 'Receptions, walking dinners and networking moments, with line-up and volume tuned to venue and audience.' },
  },
  {
    nl: { name: 'Live muziek voor privéfeesten en openingen',
          desc: 'Een warme muzikale laag die de sfeer draagt zonder te overstemmen, van opbouw tot laatste noot.' },
    en: { name: 'Live music for private parties and openings',
          desc: 'A warm musical layer that carries the mood without drowning it out, from set-up to the last note.' },
  },
];

function serviceNodes(lang) {
  return DIENSTEN.map((d, i) => ({
    '@type': 'Service',
    '@id': `${SITE}/#service-${i + 1}`,
    name: d[lang].name,
    description: d[lang].desc,
    serviceType: lang === 'nl' ? 'Live muziek' : 'Live music',
    provider: { '@id': ORG_ID },
    areaServed: { '@type': 'Country', name: lang === 'nl' ? 'België' : 'Belgium' },
  }));
}

function breadcrumb(trail) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: SITE + t.url,
    })),
  };
}

/**
 * Per pagina: de deelkaart en de extra JSON-LD-knopen.
 * De titel en beschrijving van de deelkaart mogen afwijken van de <title>:
 * een deelkaart wordt gelezen, geen zoekresultaat gescand.
 */
export const PAGE_SEO = {
  'index.html': {
    nl: {
      ogTitle: 'Live muziek voor uw event | Relovation',
      ogDescription: 'Duo, trio of full band voor trouwfeesten, bedrijfsevents en recepties. Eigen geluidsinstallatie, muzikanten van conservatoriumniveau.',
      breadcrumb: [{ name: 'Home', url: '/' }],
    },
    en: {
      ogTitle: 'Live music for your event | Relovation',
      ogDescription: 'Duo, trio or full band for weddings, corporate events and receptions. Our own sound system, conservatoire-trained musicians.',
      breadcrumb: [{ name: 'Home', url: '/en/' }],
    },
    services: true,
  },
  'diensten.html': {
    nl: {
      ogTitle: 'Live muziek boeken: duo, trio of full band | Relovation',
      ogDescription: 'Welke bezetting past bij uw trouwfeest, bedrijfsevent of receptie? Ontdek wat inbegrepen is en vraag een voorstel op maat.',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Diensten', url: '/diensten' }],
    },
    en: {
      ogTitle: 'Book live music: duo, trio or full band | Relovation',
      ogDescription: 'Which line-up suits your wedding, corporate event or reception? See what is included and request a tailored proposal.',
      breadcrumb: [{ name: 'Home', url: '/en/' }, { name: 'Services', url: '/en/services' }],
    },
    services: true,
  },
  'over.html': {
    nl: {
      ogTitle: 'De muzikanten achter Relovation | Relovation',
      ogDescription: 'Een vast collectief uit Lier dat sinds 2018 samen speelt. Robin, Lorenzo, Tim en Joppe, en hoe wij werken.',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Over ons', url: '/over' }],
    },
    en: {
      ogTitle: 'The musicians behind Relovation | Relovation',
      ogDescription: 'A settled collective from Lier playing together since 2018. Robin, Lorenzo, Tim and Joppe, and how we work.',
      breadcrumb: [{ name: 'Home', url: '/en/' }, { name: 'About us', url: '/en/about' }],
    },
  },
  'gallerij.html': {
    nl: {
      ogTitle: 'Relovation in beeld | Live muziek op events',
      ogDescription: 'Beeld en geluid van onze avonden: trouwfeesten, bedrijfsevents en privéfeesten, van eerste applaus tot laatste akkoord.',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Gallerij', url: '/gallerij' }],
    },
    en: {
      ogTitle: 'Relovation in pictures | Live music at events',
      ogDescription: 'Sight and sound from our evenings: weddings, corporate events and private parties, from first applause to last chord.',
      breadcrumb: [{ name: 'Home', url: '/en/' }, { name: 'Gallery', url: '/en/gallery' }],
    },
  },
  'contact.html': {
    nl: {
      ogTitle: 'Contact | Boek live muziek van Relovation',
      ogDescription: 'Vertel ons over uw event. We antwoorden persoonlijk, meestal binnen één werkdag.',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Contact', url: '/contact' }],
    },
    en: {
      ogTitle: 'Contact | Book live music from Relovation',
      ogDescription: 'Tell us about your event. We answer personally, usually within one working day.',
      breadcrumb: [{ name: 'Home', url: '/en/' }, { name: 'Contact', url: '/en/contact' }],
    },
    contactPage: true,
  },
  'aanvraag.html': {
    nl: {
      ogTitle: 'Vraag uw voorstel aan | Relovation',
      ogDescription: 'Negen korte vragen over uw event. U krijgt een vrijblijvend voorstel op maat.',
      breadcrumb: [{ name: 'Home', url: '/' }, { name: 'Aanvraag', url: '/aanvraag' }],
    },
    en: {
      ogTitle: 'Request your proposal | Relovation',
      ogDescription: 'Nine short questions about your event. You get a no-obligation proposal, tailored to you.',
      breadcrumb: [{ name: 'Home', url: '/en/' }, { name: 'Request', url: '/en/request' }],
    },
    noindex: false,
  },
};

/** Bouwt de volledige graph voor één pagina in één taal. */
export function graphFor(nlFile, lang) {
  const cfg = PAGE_SEO[nlFile];
  const meta = cfg[lang];
  const nodes = [organization(lang), website(lang), breadcrumb(meta.breadcrumb)];
  if (cfg.services) nodes.push(...serviceNodes(lang));
  if (cfg.contactPage) {
    nodes.push({
      '@type': 'ContactPage',
      name: meta.ogTitle,
      url: SITE + meta.breadcrumb[meta.breadcrumb.length - 1].url,
      about: { '@id': ORG_ID },
    });
  }
  return { '@context': 'https://schema.org', '@graph': nodes };
}
