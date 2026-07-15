/**
 * Relovation - Cloudflare Worker
 *
 * Serveert de statische site en (vanaf fase 3) het contactformulier.
 *
 * Statische bestanden worden door Cloudflare's asset-laag afgehandeld zonder
 * deze Worker aan te roepen. Deze code draait dus alleen voor /api/* en voor
 * URL's waarvoor geen asset bestaat.
 */

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
  // Fase 3 hangt hier POST /api/contact onder.
  return json({ ok: false, error: "not_found" }, 404);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
