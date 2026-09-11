// ترجمان — مدیریت تم
(function () {
  function resolveTheme(pref) {
    if (pref !== 'system') return pref;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function apply(pref) {
    const resolved = resolveTheme(pref);
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-pref', pref);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const map = { light: '#FBF8F2', dark: '#14120F', amber: '#1C1408', turquoise: '#08302E' };
      meta.setAttribute('content', map[resolved] || map.light);
    }
  }

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      const pref = window.Tarjoman.storage.getSettings().theme;
      if (pref === 'system') apply('system');
    });
  }

  window.Tarjoman = window.Tarjoman || {};
  window.Tarjoman.theme = { apply, resolveTheme };
})();
