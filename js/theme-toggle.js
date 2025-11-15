// Theme toggle: gestisce tema light/dark e persistenza in localStorage
(function(){
  const root = document.documentElement;
  const btn = document.getElementById('theme-toggle');

  function applyTheme(t){
    root.setAttribute('data-theme', t);
    if(btn) btn.textContent = t === 'dark' ? '🌙' : '☀️';
    updateMetaThemeColor(t);
  }

  // Safe localStorage getter (may throw in some private modes)
  function getStoredTheme(){
    try { return localStorage.getItem('theme'); } catch(e) { return null; }
  }

  // Find or create meta[name="theme-color"]
  function ensureMetaTag(){
    let m = document.querySelector('meta[name="theme-color"]');
    if(!m){
      m = document.createElement('meta');
      m.setAttribute('name', 'theme-color');
      document.head.appendChild(m);
    }
    return m;
  }

  const themeMeta = ensureMetaTag();

  function updateMetaThemeColor(theme){
    try{
      const styles = getComputedStyle(document.documentElement);
      const dark = styles.getPropertyValue('--bg-dark') || '#0d0d0d';
      const light = styles.getPropertyValue('--bg-light') || '#ffffff';
      const color = (theme === 'dark' ? dark : light).trim();
      if(color) themeMeta.setAttribute('content', color);
    }catch(e){
      // fallback
      themeMeta.setAttribute('content', theme === 'dark' ? '#0d0d0d' : '#ffffff');
    }
  }

  const stored = getStoredTheme();
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = stored || (prefersDark ? 'dark' : 'light');
  applyTheme(initial);

  window.toggleTheme = function(){
    const current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('theme', next); } catch(e) {}

    // If the cube is busy (scramble/animations running), defer heavy rebuild of stickers/geometries.
    try {
      if (window.cubeIsBusy && window.cubeIsBusy()) {
        window._pendingThemeChange = true;
      }
    } catch (e) { /* ignore */ }
  };

  // Listen to system theme changes, but only apply them when user has NOT set a preference
  const mql = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  function systemChangeHandler(e){
    const userStored = getStoredTheme();
    if(userStored) return; // respect user choice
    const next = (e && e.matches) ? 'dark' : (mql && mql.matches) ? 'dark' : 'light';
    applyTheme(next);
  }
  if(mql){
    if(typeof mql.addEventListener === 'function'){
      mql.addEventListener('change', systemChangeHandler);
    } else if(typeof mql.addListener === 'function'){
      mql.addListener(systemChangeHandler);
    }
  }

  // Attach listeners only to the visible button (#theme-toggle).
  // Removed invisible hotspots and coordinate-based fallbacks to avoid accidental toggles.
  if (btn) {
    let lastToggleAt = 0;
    // Click handler with debounce to avoid double toggles after touch
    btn.addEventListener('click', function (e) {
      const now = Date.now();
      if (now - lastToggleAt < 600) return;
      window.toggleTheme();
    });

    // Touchend handler: prevents the default to avoid a follow-up click, then toggles
    btn.addEventListener('touchend', function (e) {
      try { e.preventDefault(); } catch (err) {}
      lastToggleAt = Date.now();
      window.toggleTheme();
    }, { passive: false });

    // Keyboard accessibility
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.toggleTheme(); }
    });
  }
})();
