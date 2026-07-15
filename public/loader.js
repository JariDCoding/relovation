(function () {
  var loader = document.getElementById('r-loader');
  if (!loader) return;

  var minMs = 1100;
  var t0 = Date.now();

  function dismiss() {
    var wait = Math.max(0, minMs - (Date.now() - t0));
    setTimeout(function () {
      loader.classList.add('is-done');
      setTimeout(function () {
        loader.classList.add('is-gone');
        loader.removeAttribute('role');
      }, 680);
    }, wait);
  }

  if (document.readyState === 'complete') {
    dismiss();
  } else {
    window.addEventListener('load', dismiss, { once: true });
  }
})();
