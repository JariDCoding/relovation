(function () {
  var nav = document.getElementById('r-nav');
  var btn = document.getElementById('r-nav-burger');
  var overlay = document.getElementById('r-nav-overlay');
  if (!nav || !btn || !overlay) return;

  var img = document.getElementById('r-nav-ovl-img');
  var cap = document.getElementById('r-nav-ovl-cap');
  var links = overlay.querySelectorAll('.r-nav__ovl-list a');

  // De Engelse pagina's staan onder /en/ en dragen lang="en".
  var EN = document.documentElement.lang === 'en';
  var T = {
    open: EN ? 'Open menu' : 'Menu openen',
    close: EN ? 'Close menu' : 'Menu sluiten'
  };

  // ── Active link (normalise clean URLs) ──
  function norm(u) {
    var s = (u || '').split(/[?#]/)[0].split('/').filter(Boolean).pop() || '';
    s = s.replace(/\.html$/, '');
    return s === '' || s === 'index' ? 'index' : s;
  }
  var page = norm(location.pathname);
  var activeLink = null;
  links.forEach(function (a) {
    if (norm(a.getAttribute('href')) === page) {
      a.classList.add('r-active');
      activeLink = a;
    }
  });

  // ── Media preview ──
  function setMedia(a) {
    if (!a || !img) return;
    var src = a.getAttribute('data-img');
    var c = a.getAttribute('data-cap');
    if (src && img.getAttribute('src') !== src) img.src = src;
    if (cap && c) cap.innerHTML = c;
  }
  var fallback = activeLink || links[0];
  setMedia(fallback);

  links.forEach(function (a) {
    a.addEventListener('mouseenter', function () { setMedia(a); });
  });
  var list = overlay.querySelector('.r-nav__ovl-list');
  if (list) list.addEventListener('mouseleave', function () { setMedia(fallback); });

  // ── Scroll ──
  function tick() { nav.classList.toggle('is-scrolled', window.scrollY > 24); }
  window.addEventListener('scroll', tick, { passive: true });
  tick();

  // ── Toggle ──
  var isOpen = false;

  function open() {
    isOpen = true;
    setMedia(fallback);
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    btn.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    btn.setAttribute('aria-label', T.close);
    nav.classList.add('overlay-open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    isOpen = false;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    btn.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', T.open);
    nav.classList.remove('overlay-open');
    document.body.style.overflow = '';
  }

  btn.addEventListener('click', function () { isOpen ? close() : open(); });

  overlay.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', close);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) close();
  });
})();
