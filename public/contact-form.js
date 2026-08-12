/**
 * Contactformulier -> POST /api/contact
 *
 * Progressive enhancement: zonder JS doet het formulier een gewone POST naar
 * hetzelfde endpoint. Met JS blijft de bezoeker op de pagina en zie je de
 * status inline.
 */
(function () {
  "use strict";

  var form = document.querySelector(".contact-form");
  if (!form) return;

  // Tijdsval (anti-bot): de server negeert inzendingen die minder dan een
  // paar seconden na het laden binnenkomen. _t = ms op de pagina.
  var LAADTIJD = Date.now();

  var status = form.querySelector(".form-status");
  var button = form.querySelector('button[type="submit"]');
  var buttonLabel = button ? button.textContent : "Verstuur";

  // De Engelse pagina's staan onder /en/ en dragen lang="en".
  var EN = document.documentElement.lang === "en";
  var T = EN
    ? {
        sending: "Sending…",
        ok: "Thank you, your message has been sent. We will get back to you as soon as possible.",
        invalid: "A few fields still need attention.",
        failed: "Sending failed. Please try again later or email us directly at relovation@robinmusic.be.",
        offline: "No connection. Check your internet and try again, or email us at relovation@robinmusic.be.",
      }
    : {
        sending: "Versturen…",
        ok: "Bedankt, uw bericht is verstuurd. We nemen zo snel mogelijk contact met u op.",
        invalid: "Enkele velden hebben nog aandacht nodig.",
        failed: "Het versturen lukte niet. Probeer het later opnieuw of mail ons rechtstreeks op relovation@robinmusic.be.",
        offline: "Geen verbinding. Controleer uw internet en probeer opnieuw, of mail ons op relovation@robinmusic.be.",
      };

  var VELD_KLASSE = {
    message: "field-textarea--error",
  };

  function veldEl(naam) {
    return form.querySelector('[name="' + naam + '"]');
  }

  function wisFouten() {
    form.querySelectorAll(".field-error").forEach(function (el) {
      el.remove();
    });
    form.querySelectorAll(".field-input--error, .field-textarea--error").forEach(function (el) {
      el.classList.remove("field-input--error", "field-textarea--error");
      el.removeAttribute("aria-invalid");
    });
  }

  function toonFouten(errors) {
    var eerste = null;
    Object.keys(errors).forEach(function (naam) {
      var el = veldEl(naam);
      if (!el) return;
      el.classList.add(VELD_KLASSE[naam] || "field-input--error");
      el.setAttribute("aria-invalid", "true");

      var p = document.createElement("p");
      p.className = "field-error";
      p.textContent = errors[naam];
      (el.parentNode || el).appendChild(p);

      if (!eerste) eerste = el;
    });
    if (eerste) eerste.focus({ preventScroll: false });
  }

  function toonStatus(tekst, soort) {
    if (!status) return;
    status.textContent = tekst;
    status.className = "form-status form-status--" + soort;
    status.hidden = false;
  }

  function verbergStatus() {
    if (!status) return;
    status.hidden = true;
    status.textContent = "";
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    wisFouten();
    verbergStatus();

    form.setAttribute("data-sending", "");
    if (button) button.textContent = T.sending;

    var payload = {};
    new FormData(form).forEach(function (waarde, sleutel) {
      payload[sleutel] = waarde;
    });
    payload._t = Date.now() - LAADTIJD;
    payload.lang = EN ? "en" : "nl";

    fetch(form.getAttribute("action") || "/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { status: res.status, body: body };
        });
      })
      .then(function (res) {
        if (res.body && res.body.ok) {
          form.reset();
          toonStatus(T.ok, "ok");
          return;
        }
        if (res.body && res.body.errors) {
          toonFouten(res.body.errors);
          toonStatus(T.invalid, "error");
          return;
        }
        toonStatus(T.failed, "error");
      })
      .catch(function () {
        // Netwerkfout: de ingevulde velden blijven staan, zodat niemand
        // opnieuw hoeft te typen.
        toonStatus(T.offline, "error");
      })
      .finally(function () {
        form.removeAttribute("data-sending");
        if (button) button.textContent = buttonLabel;
      });
  });
})();
