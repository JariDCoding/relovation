/**
 * Aanvraagflow -> POST /api/aanvraag
 *
 * Drie stappen, elf vragen. Zonder JS staan alle stappen onder elkaar en doet
 * het formulier een gewone POST naar hetzelfde endpoint; dit script maakt er
 * een begeleide flow van.
 *
 * Uitgangspunt uit de briefing: minimale frictie, nul verwarring. Daarom:
 * valideren pas bij "Volgende", fouten inline bij de vraag zelf, en de
 * verzendknop nooit uitgrijzen — klikken zegt altijd wat er nog ontbreekt.
 */
(function () {
  "use strict";

  var form = document.getElementById("aanvraag-form");
  if (!form) return;

  var OPSLAG = "relovation-aanvraag";
  var stappen = Array.prototype.slice.call(form.querySelectorAll(".step"));
  var doneEl = document.getElementById("aanvraag-done");
  var statusEl = form.querySelector(".form-status");
  var progressStep = document.getElementById("progress-step");
  var progressChapter = document.getElementById("progress-chapter");
  var progressAnnounce = document.getElementById("progress-announce");
  var segmenten = Array.prototype.slice.call(form.querySelectorAll(".progress__seg"));
  var huidig = 1;

  form.setAttribute("data-enhanced", "");

  // ── Fouten ──────────────────────────────────────────────

  function wisFouten(binnen) {
    var bron = binnen || form;
    bron.querySelectorAll(".field-error").forEach(function (el) {
      el.remove();
    });
    bron.querySelectorAll(".field-input--error, .field-textarea--error").forEach(function (el) {
      el.classList.remove("field-input--error", "field-textarea--error");
      el.removeAttribute("aria-invalid");
    });
    bron.querySelectorAll(".has-error").forEach(function (el) {
      el.classList.remove("has-error");
    });
  }

  function toonFout(qEl, tekst) {
    if (qEl.querySelector(".field-error")) return;

    var p = document.createElement("p");
    p.className = "field-error";
    p.textContent = tekst;
    qEl.appendChild(p);

    var veld = qEl.querySelector(".field-input, .field-textarea");
    if (veld) {
      veld.classList.add(
        veld.tagName === "TEXTAREA" ? "field-textarea--error" : "field-input--error"
      );
      veld.setAttribute("aria-invalid", "true");
    }
  }

  function vraagBlok(naam) {
    return form.querySelector('[data-q="' + naam + '"]');
  }

  function waarde(naam) {
    var el = form.querySelector('[name="' + naam + '"]');
    return el && typeof el.value === "string" ? el.value.trim() : "";
  }

  function gekozen(naam) {
    return Array.prototype.slice
      .call(form.querySelectorAll('[name="' + naam + '"]:checked'))
      .map(function (el) {
        return el.value;
      });
  }

  function isEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  // ── Validatie per stap ──────────────────────────────────

  var REGELS = {
    1: [
      ["event_type", function () { return gekozen("event_type").length > 0; }, "Kies wat u organiseert."],
      ["moment", function () { return gekozen("moment").length > 0; }, "Kies minstens één moment. Weet u het nog niet? Kies “Nog niet zeker, graag advies”."],
      ["sfeer", function () { return gekozen("sfeer").length > 0; }, "Kies minstens één sfeer. Weet u het nog niet? Kies “Nog niet zeker, graag advies”."]
    ],
    2: [
      ["datum", function () {
        var flexibel = form.querySelector("#datum_flexibel").checked;
        return flexibel ? gekozen("periode").length > 0 : waarde("datum") !== "";
      }, "Kies een datum, of vink aan dat de datum nog niet vastligt."],
      ["locatie", function () { return waarde("locatie") !== ""; }, "Vul in waar het event doorgaat — de gemeente of regio volstaat."],
      ["gasten", function () { return gekozen("gasten").length > 0; }, "Kies hoeveel gasten u ongeveer verwacht."]
    ],
    3: [
      ["naam", function () { return waarde("naam") !== ""; }, "Vul uw naam in."],
      ["email", function () { return waarde("email") !== ""; }, "Vul uw e-mailadres in."],
      ["email", function () { return isEmail(waarde("email")); }, "Dit lijkt geen geldig e-mailadres."],
      ["telefoon", function () { return waarde("telefoon") !== ""; }, "Vul uw telefoonnummer in."],
      ["privacy", function () { return form.querySelector("#privacy").checked; }, "Vink dit aan om uw aanvraag te kunnen versturen."]
    ]
  };

  function valideer(stap) {
    var stapEl = stappen[stap - 1];
    wisFouten(stapEl);

    var eerste = null;

    REGELS[stap].forEach(function (regel) {
      var qEl = vraagBlok(regel[0]);
      if (!qEl || qEl.querySelector(".field-error")) return; // één melding per vraag
      if (regel[1]()) return;

      toonFout(qEl, regel[2]);
      if (regel[0] === "privacy") {
        document.getElementById("privacy-blok").classList.add("has-error");
      }
      if (!eerste) eerste = qEl;
    });

    if (eerste) {
      var focusbaar = eerste.querySelector("input, textarea, select");
      if (focusbaar) focusbaar.focus({ preventScroll: true });
      eerste.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  // ── Stapnavigatie ───────────────────────────────────────

  function toon(stap) {
    huidig = stap;

    stappen.forEach(function (el, i) {
      el.classList.toggle("is-active", i + 1 === stap);
    });

    segmenten.forEach(function (seg, i) {
      seg.classList.toggle("is-done", i + 1 < stap);
      seg.classList.toggle("is-active", i + 1 === stap);
    });

    var titel = stappen[stap - 1].getAttribute("data-chapter");
    progressStep.textContent = "Stap " + stap + " van 3";
    progressChapter.innerHTML = titel;
    progressAnnounce.textContent = "Stap " + stap + " van 3: " + progressChapter.textContent;

    // Focus naar de staptitel, zodat toetsenbord en screenreader mee zijn.
    var kop = stappen[stap - 1].querySelector(".step__head-title");
    if (kop) kop.focus({ preventScroll: true });

    document.getElementById("progress").scrollIntoView({ behavior: "smooth", block: "start" });
    bewaar();
  }

  form.querySelectorAll("[data-next]").forEach(function (knop) {
    knop.addEventListener("click", function () {
      if (valideer(huidig)) toon(huidig + 1);
    });
  });

  form.querySelectorAll("[data-prev]").forEach(function (knop) {
    knop.addEventListener("click", function () {
      // Terug mag altijd — nooit valideren, niets wissen.
      toon(huidig - 1);
    });
  });

  // ── Q2/Q3: exclusieve optie + maximum ───────────────────

  form.querySelectorAll("[data-exclusive]").forEach(function (fs) {
    var exclusief = fs.getAttribute("data-exclusive");
    var max = parseInt(fs.getAttribute("data-max"), 10) || 0;
    var teller = fs.querySelector("[data-counter]");
    var vakjes = Array.prototype.slice.call(fs.querySelectorAll('input[type="checkbox"]'));

    function exclusiefVakje() {
      return vakjes.filter(function (v) { return v.value === exclusief; })[0];
    }

    function ververs() {
      var aangevinkt = vakjes.filter(function (v) { return v.checked; });

      if (teller) {
        teller.textContent = aangevinkt.length + " van " + max + " gekozen";
        teller.classList.toggle("is-full", aangevinkt.length >= max);
      }

      // Op het maximum: dim de rest, zodat zichtbaar is waaróm er niet meer bij kan.
      if (max) {
        var vol = aangevinkt.length >= max;
        vakjes.forEach(function (v) {
          var geblokkeerd = vol && !v.checked;
          v.closest(".opt").classList.toggle("is-blocked", geblokkeerd);
          v.disabled = geblokkeerd;
        });
      }
    }

    vakjes.forEach(function (vakje) {
      vakje.addEventListener("change", function () {
        var ex = exclusiefVakje();

        if (vakje.value === exclusief && vakje.checked) {
          // "Nog niet zeker" gekozen: de rest gaat uit.
          vakjes.forEach(function (v) {
            if (v !== vakje) {
              v.checked = false;
              v.closest(".opt").classList.remove("is-blocked");
              v.disabled = false;
            }
          });
        } else if (vakje.checked && ex && ex.checked) {
          // Iets anders gekozen: "Nog niet zeker" gaat uit.
          ex.checked = false;
        }

        ververs();
        wisFouten(fs);
        bewaar();
      });
    });

    ververs();
  });

  // ── Q4: datum of periode ────────────────────────────────

  var flexibel = document.getElementById("datum_flexibel");
  var periodeBlok = document.getElementById("periode-blok");
  var datumVeld = form.querySelector("[data-datum-veld]");
  var datumInput = document.getElementById("datum");

  function verversDatum() {
    var isFlexibel = flexibel.checked;
    periodeBlok.hidden = !isFlexibel;
    datumVeld.hidden = isFlexibel;

    if (isFlexibel) {
      datumInput.value = "";
    } else {
      form.querySelectorAll('[name="periode"]').forEach(function (r) {
        r.checked = false;
      });
    }
    wisFouten(vraagBlok("datum"));
  }

  flexibel.addEventListener("change", function () {
    verversDatum();
    bewaar();
  });

  // Geen events in het verleden.
  datumInput.min = new Date().toISOString().slice(0, 10);

  // ── Antwoorden bewaren ──────────────────────────────────

  function bewaar() {
    try {
      var data = { _stap: huidig };
      new FormData(form).forEach(function (v, k) {
        if (k === "website") return;
        if (data[k] === undefined) data[k] = v;
        else data[k] = [].concat(data[k], v);
      });
      sessionStorage.setItem(OPSLAG, JSON.stringify(data));
    } catch (e) {
      // sessionStorage kan geblokkeerd zijn (private mode). Niet erg: dan is
      // herstel na refresh gewoon weg, de flow zelf werkt onverminderd.
    }
  }

  function herstel() {
    var data;
    try {
      data = JSON.parse(sessionStorage.getItem(OPSLAG) || "null");
    } catch (e) {
      return;
    }
    if (!data) return;

    Object.keys(data).forEach(function (k) {
      if (k === "_stap") return;
      var waarden = [].concat(data[k]);
      form.querySelectorAll('[name="' + k + '"]').forEach(function (el) {
        if (el.type === "checkbox" || el.type === "radio") {
          if (waarden.indexOf(el.value) !== -1) el.checked = true;
        } else {
          el.value = waarden[0];
        }
      });
    });

    verversDatum();
    form.querySelectorAll("[data-exclusive]").forEach(function (fs) {
      fs.querySelectorAll('input[type="checkbox"]').forEach(function (v) {
        v.dispatchEvent(new Event("change", { bubbles: false }));
      });
    });

    var stap = parseInt(data._stap, 10);
    if (stap >= 1 && stap <= 3) {
      stappen.forEach(function (el, i) {
        el.classList.toggle("is-active", i + 1 === stap);
      });
      huidig = stap;
      segmenten.forEach(function (seg, i) {
        seg.classList.toggle("is-done", i + 1 < stap);
        seg.classList.toggle("is-active", i + 1 === stap);
      });
      progressStep.textContent = "Stap " + stap + " van 3";
      progressChapter.innerHTML = stappen[stap - 1].getAttribute("data-chapter");
    }
  }

  // Fout weghalen zodra de bezoeker het veld corrigeert.
  form.addEventListener("input", function (e) {
    var qEl = e.target.closest(".q");
    if (qEl) wisFouten(qEl);
    bewaar();
  });

  form.addEventListener("change", function (e) {
    var qEl = e.target.closest(".q");
    if (qEl) wisFouten(qEl);
    if (e.target.id === "privacy" && e.target.checked) {
      document.getElementById("privacy-blok").classList.remove("has-error");
    }
    bewaar();
  });

  // ── Status ──────────────────────────────────────────────

  function toonStatus(tekst, soort) {
    if (!statusEl) return;
    statusEl.textContent = tekst;
    statusEl.className = "form-status form-status--" + soort;
    statusEl.hidden = false;
  }

  function verbergStatus() {
    if (!statusEl) return;
    statusEl.hidden = true;
    statusEl.textContent = "";
  }

  // ── Verzenden ───────────────────────────────────────────

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    verbergStatus();

    // Alle drie de stappen controleren, niet alleen de laatste: wie via
    // sessionStorage midden in de flow terugkomt, kan stap 1 hebben overgeslagen.
    for (var s = 1; s <= 3; s++) {
      if (!valideer(s)) {
        if (s !== huidig) toon(s);
        toonStatus("Enkele vragen hebben nog aandacht nodig.", "error");
        return;
      }
    }

    var knop = form.querySelector('button[type="submit"]');
    var label = knop ? knop.textContent : "";
    form.setAttribute("data-sending", "");
    if (knop) knop.textContent = "Versturen…";

    var payload = {};
    new FormData(form).forEach(function (v, k) {
      if (payload[k] === undefined) payload[k] = v;
      else payload[k] = [].concat(payload[k], v).join(", ");
    });

    fetch(form.getAttribute("action") || "/api/aanvraag", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (body) {
          return { status: res.status, body: body };
        });
      })
      .then(function (res) {
        if (res.body && res.body.ok) {
          try { sessionStorage.removeItem(OPSLAG); } catch (e) { /* niet erg */ }
          form.hidden = true;
          // Ook de kop weg: "Beantwoord enkele korte vragen" spreekt
          // "Bedankt voor uw aanvraag" tegen. De bevestiging heeft een eigen titel.
          var kop = document.querySelector(".aanvraag__head");
          if (kop) kop.hidden = true;
          doneEl.hidden = false;
          doneEl.focus({ preventScroll: true });
          doneEl.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (res.body && res.body.errors) {
          Object.keys(res.body.errors).forEach(function (naam) {
            var qEl = vraagBlok(naam);
            if (qEl) toonFout(qEl, res.body.errors[naam]);
          });
          toonStatus("Enkele vragen hebben nog aandacht nodig.", "error");
          return;
        }
        toonStatus(
          "Het versturen lukte niet. Probeer het later opnieuw of mail ons rechtstreeks op info@relovation.be.",
          "error"
        );
      })
      .catch(function () {
        // Netwerkfout: alle antwoorden blijven staan, niemand hoeft opnieuw te typen.
        toonStatus(
          "Geen verbinding. Controleer uw internet en probeer opnieuw, of mail ons op info@relovation.be.",
          "error"
        );
      })
      .finally(function () {
        form.removeAttribute("data-sending");
        if (knop) knop.textContent = label;
      });
  });

  herstel();
})();
