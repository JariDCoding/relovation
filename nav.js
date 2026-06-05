(function () {
  var nav = document.getElementById('r-nav');
  var burger = document.getElementById('r-nav-burger');
  var overlay = document.getElementById('r-nav-overlay');
  if (!nav || !burger || !overlay) return;

  // ── Active link ──
  var links = nav.querySelectorAll('.r-nav__links a');
  var page = location.pathname.split('/').filter(Boolean).pop() || 'index.html';
  links.forEach(function (a) {
    var href = (a.getAttribute('href') || '').split('/').pop();
    if (href === page || (!page && href === 'index.html') || (page === '' && href === 'index.html')) {
      a.classList.add('r-active');
    }
  });

  // ── Scroll ──
  function tick() {
    if (window.scrollY > 58) {
      nav.classList.add('is-scrolled');
    } else {
      nav.classList.remove('is-scrolled');
    }
  }
  window.addEventListener('scroll', tick, { passive: true });
  tick();

  // ── Mobile menu ──
  var isOpen = false;

  function open() {
    isOpen = true;
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    burger.classList.add('is-open');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Menu sluiten');
    nav.classList.add('overlay-open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    isOpen = false;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    burger.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Menu openen');
    nav.classList.remove('overlay-open');
    document.body.style.overflow = '';
  }

  burger.addEventListener('click', function () { isOpen ? close() : open(); });

  overlay.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', close);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) close();
  });
})();
