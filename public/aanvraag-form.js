/**
 * Aanvraagflow -> POST /api/aanvraag
 *
 * Eén vraag per scherm, in de geest van Typeform: negen vragen, gegroepeerd in
 * de drie stappen uit de briefing. Elk scherm past binnen één viewport, zodat
 * niemand hoeft te scrollen om de knop te vinden.
 *
 * Zonder JS staan alle vragen onder elkaar en doet het formulier een gewone
 * POST naar hetzelfde endpoint.
 *
 * Uitgangspunt uit de briefing: minimale frictie, nul verwarring. Daarom:
 * valideren pas bij Volgende, fouten inline bij de vraag zelf, en de
 * verzendknop nooit uitgrijzen — klikken zegt altijd wat er nog ontbreekt.
 */
(function () {
  "use strict";

  var form = document.getElementById("aanvraag-form");
  if (!form) return;

  // Tijdsval (anti-bot): de server negeert inzendingen die minder dan een
  // paar seconden na het laden binnenkomen. _t = ms op de pagina.
  var LAADTIJD = Date.now();

  var OPSLAG = "relovation-aanvraag";
  var AUTO_MS = 400; // even je vinkje zien voor het scherm doorspringt

  var schermen = Array.prototype.slice.call(form.querySelectorAll(".screen"));
  var doneEl = document.getElementById("aanvraag-done");
  var statusEl = form.querySelector(".form-status");
  var progressEl = document.getElementById("progress");
  var chapterEl = document.getElementById("progress-chapter");
  var countEl = document.getElementById("progress-count");
  var announceEl = document.getElementById("progress-announce");
  var segmenten = Array.prototype.slice.call(document.querySelectorAll(".progress__seg"));

  // De Engelse pagina staat op /en/request en draagt lang="en".
  var EN = document.documentElement.lang === "en";

  var T = EN
    ? {
        hoofdstuk: { 1: "Event & music", 2: "Practical details", 3: "Your details" },
        stap: function (h, naam) { return "Step <b>" + h + "</b> of 3 · " + naam; },
        vraag: function (nr, tot) { return "Question " + nr + " of " + tot; },
        announce: function (h, naam, nr, tot) {
          return "Step " + h + " of 3, " + naam + ". Question " + nr + " of " + tot + ".";
        },
        gekozen: "Chosen",
        versturen: "Sending…",
        aandacht: "This question still needs attention.",
        aandachtMeer: "Some answers still need attention.",
        mislukt: "Sending failed. Please try again later or email us directly at relovation@robinmusic.be.",
        offline: "No connection. Check your internet and try again, or email us at relovation@robinmusic.be.",
        maanden: ["January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"],
        dagen: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        regels: {
          event_type: "Choose what you are organising.",
          moment: "Choose at least one moment. Not sure yet? Choose \u201cNot sure yet, advice welcome\u201d.",
          sfeer: "Choose at least one atmosphere. Not sure yet? Choose \u201cNot sure yet, advice welcome\u201d.",
          datum: "Choose a date, or tick that the date is not settled yet.",
          locatie: "Tell us where the event takes place. The town or region is enough.",
          gasten: "Choose roughly how many guests you expect.",
          voornaam: "Fill in your first name.",
          achternaam: "Fill in your last name.",
          email: "Fill in your email address.",
          emailOngeldig: "This does not look like a valid email address.",
          telefoon: "Fill in your phone number.",
          privacy: "Tick this to be able to send your request.",
        },
      }
    : {
        hoofdstuk: { 1: "Event & muziek", 2: "Praktische info", 3: "Uw gegevens" },
        stap: function (h, naam) { return "Stap <b>" + h + "</b> van 3 · " + naam; },
        vraag: function (nr, tot) { return "Vraag " + nr + " van " + tot; },
        announce: function (h, naam, nr, tot) {
          return "Stap " + h + " van 3, " + naam + ". Vraag " + nr + " van " + tot + ".";
        },
        gekozen: "Gekozen",
        versturen: "Versturen\u2026",
        aandacht: "Deze vraag heeft nog aandacht nodig.",
        aandachtMeer: "Enkele antwoorden hebben nog aandacht nodig.",
        mislukt: T.mislukt,
        offline: T.offline,
        maanden: ["januari", "februari", "maart", "april", "mei", "juni",
                  "juli", "augustus", "september", "oktober", "november", "december"],
        dagen: ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"],
        regels: {
          event_type: "Kies wat u organiseert.",
          moment: "Kies minstens \u00e9\u00e9n moment. Weet u het nog niet? Kies \u201cNog niet zeker, graag advies\u201d.",
          sfeer: "Kies minstens \u00e9\u00e9n sfeer. Weet u het nog niet? Kies \u201cNog niet zeker, graag advies\u201d.",
          datum: "Kies een datum, of vink aan dat de datum nog niet vastligt.",
          locatie: "Vul in waar het event doorgaat. De gemeente of regio volstaat.",
          gasten: "Kies hoeveel gasten u ongeveer verwacht.",
          voornaam: "Vul uw voornaam in.",
          achternaam: "Vul uw achternaam in.",
          email: "Vul uw e-mailadres in.",
          emailOngeldig: "Dit lijkt geen geldig e-mailadres.",
          telefoon: "Vul uw telefoonnummer in.",
          privacy: "Vink dit aan om uw aanvraag te kunnen versturen.",
        },
      };

  var HOOFDSTUK = T.hoofdstuk;

  // Geen openingsscherm: elk scherm is een vraag. De bezoeker landt meteen op
  // de eerste, makkelijkste vraag.
  var vragen = schermen;
  var TOTAAL = vragen.length;

  var index = 0;
  var autoTimer = null;

  form.setAttribute("data-enhanced", "");

  function scherm() {
    return schermen[index];
  }

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

  /**
   * Zet de melding in `container`. Die moet zichtbaar zijn — een fout in een
   * verborgen blok (zoals het datumveld als de datum nog niet vastligt) ziet
   * niemand.
   */
  function toonFout(container, tekst, veldId) {
    if (!container || container.querySelector(".field-error")) return;

    var p = document.createElement("p");
    p.className = "field-error";
    p.textContent = tekst;
    container.appendChild(p);

    var veld = veldId ? document.getElementById(veldId) : null;
    if (veld) {
      veld.classList.add(veld.tagName === "TEXTAREA" ? "field-textarea--error" : "field-input--error");
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

  // ── Validatie per scherm ────────────────────────────────
  // [veldId of null, check, melding]

  var REGELS = {
    event_type: [[null, function () { return gekozen("event_type").length > 0; }, T.regels.event_type]],
    moment: [[null, function () { return gekozen("moment").length > 0; }, T.regels.moment]],
    sfeer: [[null, function () { return gekozen("sfeer").length > 0; }, T.regels.sfeer]],
    datum: [[null, function () {
      return document.getElementById("datum_flexibel").checked
        ? gekozen("periode").length > 0
        : waarde("datum") !== "";
    }, T.regels.datum]],
    locatie: [["locatie", function () { return waarde("locatie") !== ""; }, T.regels.locatie]],
    gasten: [[null, function () { return gekozen("gasten").length > 0; }, T.regels.gasten]],
    contact: [
      ["voornaam", function () { return waarde("voornaam") !== ""; }, T.regels.voornaam],
      ["achternaam", function () { return waarde("achternaam") !== ""; }, T.regels.achternaam],
      ["email", function () { return waarde("email") !== ""; }, T.regels.email],
      ["email", function () { return isEmail(waarde("email")); }, T.regels.emailOngeldig],
      ["telefoon", function () { return waarde("telefoon") !== ""; }, T.regels.telefoon],
    ],
    voorkeur_contact: [], // optioneel
    bericht: [[null, function () { return document.getElementById("privacy").checked; }, T.regels.privacy]],
  };

  /**
   * Waar de melding van dit scherm hoort. Altijd een zichtbaar blok — anders
   * staat de fout er wel, maar ziet niemand hem.
   */
  function foutContainer(s, naam, veldId) {
    if (naam === "bericht") return vraagBlok("privacy");
    if (naam === "datum") {
      // De melding hoort bij het blok dat op dat moment zichtbaar is: de
      // kalender, of de periodekeuze die ervoor in de plaats komt.
      return document.getElementById("datum_flexibel").checked
        ? document.getElementById("periode-blok")
        : document.getElementById("kalender");
    }
    if (veldId) return document.getElementById(veldId).closest("div");
    return s;
  }

  /** Valideert één scherm. `stil` = geen focus (bij de eindcontrole). */
  function valideer(s, stil) {
    var naam = s.getAttribute("data-q");
    var regels = REGELS[naam];
    if (!regels) return true;

    wisFouten(s);
    var eerste = null;
    var gehad = {};

    regels.forEach(function (r) {
      var veldId = r[0];
      var sleutel = veldId || naam;
      if (gehad[sleutel]) return; // één melding per veld
      if (r[1]()) return;

      toonFout(foutContainer(s, naam, veldId), r[2], veldId);
      if (naam === "bericht") {
        document.getElementById("privacy-blok").classList.add("has-error");
      }

      gehad[sleutel] = true;
      if (!eerste) eerste = veldId ? document.getElementById(veldId) : s.querySelector("input, textarea");
    });

    if (Object.keys(gehad).length === 0) return true;

    if (!stil && eerste) eerste.focus({ preventScroll: true });
    return false;
  }

  // ── Voortgang ───────────────────────────────────────────

  function verversVoortgang() {
    var s = scherm();
    var hoofdstuk = parseInt(s.getAttribute("data-chapter"), 10);
    var nr = vragen.indexOf(s) + 1;

    chapterEl.innerHTML = T.stap(hoofdstuk, HOOFDSTUK[hoofdstuk]);
    countEl.textContent = T.vraag(nr, TOTAAL);
    announceEl.textContent = T.announce(hoofdstuk, HOOFDSTUK[hoofdstuk], nr, TOTAAL);

    // Elk segment vult zich naar rato van de vragen die in die stap af zijn.
    segmenten.forEach(function (seg, i) {
      var h = i + 1;
      var inStap = vragen.filter(function (v) {
        return parseInt(v.getAttribute("data-chapter"), 10) === h;
      });
      var klaar = inStap.filter(function (v) {
        return vragen.indexOf(v) < nr - 1;
      }).length;
      var actief = h === hoofdstuk;
      var pct = h < hoofdstuk ? 100 : actief ? (klaar / inStap.length) * 100 : 0;

      seg.classList.toggle("is-done", h < hoofdstuk);
      seg.querySelector(".progress__fill").style.width = pct + "%";
    });
  }

  // ── Navigatie ───────────────────────────────────────────

  function toon(nieuw, richting) {
    clearTimeout(autoTimer);
    index = Math.max(0, Math.min(schermen.length - 1, nieuw));

    schermen.forEach(function (el, i) {
      var actief = i === index;
      el.classList.toggle("is-active", actief);
      if (actief && richting) el.setAttribute("data-dir", richting);
      else el.removeAttribute("data-dir");
    });

    verversVoortgang();
    bewaar();

    var s = scherm();

    // Focus naar het eerste invulveld, zodat je meteen kunt typen. Bij
    // keuzevragen zou dat het eerste rondje selecteren op sommige browsers —
    // daar focussen we de vraag zelf.
    var tekstveld = s.querySelector('.field-input:not([type="date"]), .field-textarea');
    if (tekstveld && !s.hasAttribute("data-auto")) {
      tekstveld.focus({ preventScroll: true });
    } else {
      var kop = s.querySelector(".q__title");
      if (kop && kop.hasAttribute("tabindex")) kop.focus({ preventScroll: true });
    }

    // De flow vult het scherm; terug naar boven zodat de vraag in beeld staat.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function volgende() {
    if (!valideer(scherm())) return;
    if (index < schermen.length - 1) toon(index + 1, "vooruit");
  }

  function vorige() {
    // Terug mag altijd — nooit valideren, niets wissen.
    if (index > 0) toon(index - 1, "terug");
  }

  form.querySelectorAll("[data-next]").forEach(function (k) {
    k.addEventListener("click", volgende);
  });
  form.querySelectorAll("[data-prev]").forEach(function (k) {
    k.addEventListener("click", vorige);
  });

  // Enter = volgende, behalve in de textarea (daar hoort een nieuwe regel).
  form.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    if (e.target.tagName === "TEXTAREA") return;
    if (e.target.type === "submit") return;
    e.preventDefault();
    if (index < schermen.length - 1) volgende();
  });

  // ── Automatisch door bij enkele keuze ───────────────────

  form.querySelectorAll("[data-auto]").forEach(function (s) {
    s.querySelectorAll('input[type="radio"]').forEach(function (radio) {
      radio.addEventListener("change", function () {
        if (!radio.checked) return;
        wisFouten(s);
        clearTimeout(autoTimer);
        // Korte pauze: je ziet je eigen keuze bevestigd worden.
        autoTimer = setTimeout(function () {
          if (scherm() === s) volgende();
        }, AUTO_MS);
      });
    });
  });

  // ── Exclusieve optie + maximum (vraag 2 en 3) ───────────

  form.querySelectorAll("[data-exclusive]").forEach(function (s) {
    var exclusief = s.getAttribute("data-exclusive");
    var max = parseInt(s.getAttribute("data-max"), 10) || 0;
    var teller = s.querySelector("[data-counter]");
    var vakjes = Array.prototype.slice.call(s.querySelectorAll('input[type="checkbox"]'));

    function exVakje() {
      return vakjes.filter(function (v) { return v.value === exclusief; })[0];
    }

    function ververs() {
      var aan = vakjes.filter(function (v) { return v.checked; });

      if (teller) {
        teller.textContent = aan.length + " van " + max + " gekozen";
        teller.classList.toggle("is-full", aan.length >= max);
      }

      // Op het maximum: dim de rest, zodat zichtbaar is waaróm er niet meer bij kan.
      if (max) {
        var vol = aan.length >= max;
        vakjes.forEach(function (v) {
          var blok = vol && !v.checked;
          v.closest(".opt").classList.toggle("is-blocked", blok);
          v.disabled = blok;
        });
      }
    }

    vakjes.forEach(function (vakje) {
      vakje.addEventListener("change", function () {
        var ex = exVakje();

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
        wisFouten(s);
        bewaar();
      });
    });

    ververs();
  });

  // ── Datum of periode (vraag 4) ──────────────────────────

  var flexibel = document.getElementById("datum_flexibel");
  var periodeBlok = document.getElementById("periode-blok");
  var datumVeld = form.querySelector("[data-datum-veld]");
  var datumInput = document.getElementById("datum");

  // ── Gebrande kalender ───────────────────────────────────
  // De native datumkiezer is systeem-UI: blauw/wit, niet te stylen, en hij
  // valt op een vergrendelde viewport buiten beeld. Vandaar een eigen
  // kalender. Het native veld blijft de waarde dragen (en submit gewoon mee,
  // ook verborgen), zodat de flow zonder JS blijft werken.

  var MAANDEN = T.maanden;
  var DAGEN = T.dagen;

  var kalEl = document.getElementById("kalender");
  var kalGrid = kalEl.querySelector("[data-kal-grid]");
  var kalMaand = kalEl.querySelector("[data-kal-maand]");
  var kalUitkomst = kalEl.querySelector("[data-kal-uitkomst]");
  var kalVorige = kalEl.querySelector("[data-kal-vorige]");
  var kalVolgende = kalEl.querySelector("[data-kal-volgende]");

  var vandaag = nulUur(new Date());
  var toonMaand = new Date(vandaag.getFullYear(), vandaag.getMonth(), 1);
  var gekozenDatum = null;

  function nulUur(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /** Lokale ISO-datum. toISOString() zou in UTC omrekenen en een dag verschuiven. */
  function naarISO(d) {
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var dag = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + dag;
  }

  function uitISO(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }

  function zelfdeDag(a, b) {
    return a && b && a.getTime() === b.getTime();
  }

  function tekenKalender() {
    kalMaand.textContent = MAANDEN[toonMaand.getMonth()] + " " + toonMaand.getFullYear();

    // Niet terug voorbij de huidige maand: het event ligt in de toekomst.
    kalVorige.disabled =
      toonMaand.getFullYear() === vandaag.getFullYear() && toonMaand.getMonth() === vandaag.getMonth();

    kalGrid.textContent = "";

    // De week begint hier op maandag; getDay() geeft zondag als 0.
    var eerste = new Date(toonMaand.getFullYear(), toonMaand.getMonth(), 1);
    var offset = (eerste.getDay() + 6) % 7;
    var aantal = new Date(toonMaand.getFullYear(), toonMaand.getMonth() + 1, 0).getDate();

    for (var i = 0; i < offset; i++) {
      var leeg = document.createElement("span");
      leeg.className = "kal__leeg";
      kalGrid.appendChild(leeg);
    }

    for (var d = 1; d <= aantal; d++) {
      var datum = new Date(toonMaand.getFullYear(), toonMaand.getMonth(), d);
      var knop = document.createElement("button");
      knop.type = "button";
      knop.className = "kal__dag";
      knop.textContent = String(d);
      knop.setAttribute("data-datum", naarISO(datum));

      if (datum < vandaag) {
        knop.disabled = true;
      }
      if (zelfdeDag(datum, vandaag)) knop.classList.add("is-vandaag");
      if (zelfdeDag(datum, gekozenDatum)) {
        knop.classList.add("is-gekozen");
        knop.setAttribute("aria-current", "date");
      }

      knop.setAttribute(
        "aria-label",
        DAGEN[datum.getDay()] + " " + d + " " + MAANDEN[datum.getMonth()] + " " + datum.getFullYear()
      );

      kalGrid.appendChild(knop);
    }
  }

  function toonUitkomst() {
    if (!gekozenDatum) {
      kalUitkomst.textContent = "";
      return;
    }
    kalUitkomst.innerHTML =
      T.gekozen + ": <b>" +
      DAGEN[gekozenDatum.getDay()] +
      " " +
      gekozenDatum.getDate() +
      " " +
      MAANDEN[gekozenDatum.getMonth()] +
      " " +
      gekozenDatum.getFullYear() +
      "</b>";
  }

  kalGrid.addEventListener("click", function (e) {
    var knop = e.target.closest(".kal__dag");
    if (!knop || knop.disabled) return;

    gekozenDatum = uitISO(knop.getAttribute("data-datum"));
    datumInput.value = knop.getAttribute("data-datum");

    tekenKalender();
    toonUitkomst();
    wisFouten(form.querySelector('[data-q="datum"]'));
    bewaar();
  });

  kalVorige.addEventListener("click", function () {
    sluitKiezer();
    toonMaand = new Date(toonMaand.getFullYear(), toonMaand.getMonth() - 1, 1);
    tekenKalender();
  });

  kalVolgende.addEventListener("click", function () {
    sluitKiezer();
    toonMaand = new Date(toonMaand.getFullYear(), toonMaand.getMonth() + 1, 1);
    tekenKalender();
  });

  // ── Maand/jaar-kiezer ───────────────────────────────────
  // Het maand-label opent een snelkiezer: jaar-steppers + 12 maand-chips, zodat
  // je in enkele klikken naar elk toekomstig jaar/maand springt (i.p.v. de maand
  // twaalf keer vooruit te klikken).
  var kalMaandBtn = kalEl.querySelector("[data-kal-toggle]");
  var kalKiezer = kalEl.querySelector("[data-kal-kiezer]");
  var kalKiezerJaar = kalEl.querySelector("[data-kal-jaar]");
  var kalMaandenGrid = kalEl.querySelector("[data-kal-maanden]");
  var kalJaarVorige = kalEl.querySelector("[data-kal-jaar-vorige]");
  var kalJaarVolgende = kalEl.querySelector("[data-kal-jaar-volgende]");
  var kiezerJaar = toonMaand.getFullYear();

  function tekenKiezer() {
    kalKiezerJaar.textContent = kiezerJaar;
    kalJaarVorige.disabled = kiezerJaar <= vandaag.getFullYear();
    kalMaandenGrid.textContent = "";

    MAANDEN.forEach(function (naam, idx) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "kal__maand-chip";
      chip.textContent = naam.slice(0, 3);
      chip.setAttribute("aria-label", naam + " " + kiezerJaar);

      // Verleden maanden in het huidige jaar liggen niet in de toekomst.
      if (kiezerJaar === vandaag.getFullYear() && idx < vandaag.getMonth()) {
        chip.disabled = true;
      }
      if (kiezerJaar === toonMaand.getFullYear() && idx === toonMaand.getMonth()) {
        chip.classList.add("is-actief");
        chip.setAttribute("aria-current", "true");
      }

      chip.addEventListener("click", function () {
        toonMaand = new Date(kiezerJaar, idx, 1);
        sluitKiezer();
        tekenKalender();
      });

      kalMaandenGrid.appendChild(chip);
    });
  }

  function openKiezer() {
    kiezerJaar = toonMaand.getFullYear();
    kalEl.classList.add("is-kiezer");
    kalKiezer.hidden = false;
    kalMaandBtn.setAttribute("aria-expanded", "true");
    tekenKiezer();
  }

  function sluitKiezer() {
    kalEl.classList.remove("is-kiezer");
    kalKiezer.hidden = true;
    kalMaandBtn.setAttribute("aria-expanded", "false");
  }

  kalMaandBtn.addEventListener("click", function () {
    if (kalKiezer.hidden) openKiezer();
    else sluitKiezer();
  });

  kalJaarVorige.addEventListener("click", function () {
    if (kiezerJaar > vandaag.getFullYear()) {
      kiezerJaar--;
      tekenKiezer();
    }
  });

  kalJaarVolgende.addEventListener("click", function () {
    kiezerJaar++;
    tekenKiezer();
  });

  /** Zet de kalender in de plaats van het native veld. */
  function kalenderAan() {
    datumVeld.hidden = true;
    kalEl.hidden = false;
    tekenKalender();
    toonUitkomst();
  }

  function verversDatum() {
    var isFlex = flexibel.checked;
    periodeBlok.hidden = !isFlex;

    // Met JS staat het native veld altijd verborgen; de kalender neemt het
    // over. Ligt de datum niet vast, dan verdwijnt ook de kalender.
    datumVeld.hidden = true;
    kalEl.hidden = isFlex;

    if (isFlex) {
      datumInput.value = "";
      gekozenDatum = null;
      toonUitkomst();
    } else {
      form.querySelectorAll('[name="periode"]').forEach(function (r) {
        r.checked = false;
      });
      tekenKalender();
    }
    wisFouten(form.querySelector('[data-q="datum"]'));
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
      var data = { _index: index };
      new FormData(form).forEach(function (v, k) {
        if (k === "website") return;
        if (data[k] === undefined) data[k] = v;
        else data[k] = [].concat(data[k], v);
      });
      sessionStorage.setItem(OPSLAG, JSON.stringify(data));
    } catch (e) {
      // sessionStorage kan geblokkeerd zijn (private mode). Niet erg: dan is
      // herstel na refresh weg, de flow zelf werkt onverminderd.
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
      if (k === "_index") return;
      var waarden = [].concat(data[k]);
      form.querySelectorAll('[name="' + k + '"]').forEach(function (el) {
        if (el.type === "checkbox" || el.type === "radio") {
          if (waarden.indexOf(el.value) !== -1) el.checked = true;
        } else {
          el.value = waarden[0];
        }
      });
    });

    // Een herstelde datum moet ook in de kalender terugkomen.
    gekozenDatum = uitISO(datumInput.value);
    if (gekozenDatum) toonMaand = new Date(gekozenDatum.getFullYear(), gekozenDatum.getMonth(), 1);

    verversDatum();
    toonUitkomst();

    form.querySelectorAll("[data-exclusive]").forEach(function (s) {
      s.querySelectorAll('input[type="checkbox"]').forEach(function (v) {
        v.dispatchEvent(new Event("change", { bubbles: false }));
      });
    });

    var i = parseInt(data._index, 10);
    if (i >= 0 && i < schermen.length) {
      index = i;
      schermen.forEach(function (el, n) {
        el.classList.toggle("is-active", n === index);
      });
      verversVoortgang();
    }
  }

  // Fout weghalen zodra de bezoeker het veld corrigeert.
  form.addEventListener("input", function (e) {
    var veld = e.target.closest(".field-input, .field-textarea");
    if (veld) {
      veld.classList.remove("field-input--error", "field-textarea--error");
      veld.removeAttribute("aria-invalid");
      var fout = veld.parentNode && veld.parentNode.querySelector(".field-error");
      if (fout) fout.remove();
    }
    bewaar();
  });

  form.addEventListener("change", function (e) {
    if (e.target.id === "privacy" && e.target.checked) {
      document.getElementById("privacy-blok").classList.remove("has-error");
      wisFouten(vraagBlok("privacy"));
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

    // Alle vragen controleren, niet alleen de laatste: wie via sessionStorage
    // midden in de flow terugkomt, kan een vraag hebben overgeslagen.
    for (var i = 0; i < vragen.length; i++) {
      if (!valideer(vragen[i], true)) {
        var doel = schermen.indexOf(vragen[i]);
        if (doel !== index) toon(doel, "terug");
        valideer(vragen[i]);
        toonStatus(T.aandacht, "error");
        return;
      }
    }

    var knop = form.querySelector('button[type="submit"]');
    var label = knop ? knop.textContent : "";
    form.setAttribute("data-sending", "");
    if (knop) knop.textContent = T.versturen;

    var payload = {};
    new FormData(form).forEach(function (v, k) {
      if (payload[k] === undefined) payload[k] = v;
      else payload[k] = [].concat(payload[k], v).join(", ");
    });
    payload._t = Date.now() - LAADTIJD;
    payload.lang = EN ? "en" : "nl";

    fetch(form.getAttribute("action") || "/api/aanvraag", {
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
          try { sessionStorage.removeItem(OPSLAG); } catch (e) { /* niet erg */ }
          form.hidden = true;
          progressEl.hidden = true;
          doneEl.hidden = false;
          doneEl.classList.add("is-active");
          doneEl.focus({ preventScroll: true });
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        if (res.body && res.body.errors) {
          // Serverfouten: spring naar het eerste scherm dat een melding krijgt.
          var eerste = null;
          Object.keys(res.body.errors).forEach(function (veld) {
            var s = form.querySelector('[data-q="' + veld + '"]') ||
              (document.getElementById(veld) && document.getElementById(veld).closest(".screen"));
            if (s && !eerste) eerste = s.classList.contains("screen") ? s : s.closest(".screen");
          });
          if (eerste && schermen.indexOf(eerste) !== -1) toon(schermen.indexOf(eerste), "terug");

          Object.keys(res.body.errors).forEach(function (veld) {
            var el = document.getElementById(veld);
            var blok = el ? el.closest("div") : vraagBlok(veld);
            if (blok) toonFout(blok, res.body.errors[veld], el ? veld : null);
          });
          toonStatus(T.aandachtMeer, "error");
          return;
        }
        toonStatus(
          T.mislukt,
          "error"
        );
      })
      .catch(function () {
        // Netwerkfout: alle antwoorden blijven staan, niemand hoeft opnieuw te typen.
        toonStatus(
          T.offline,
          "error"
        );
      })
      .finally(function () {
        form.removeAttribute("data-sending");
        if (knop) knop.textContent = label;
      });
  });

  kalenderAan();
  herstel();
  verversVoortgang();
})();
