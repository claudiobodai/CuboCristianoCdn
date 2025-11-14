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

  if(btn){
    btn.addEventListener('click', window.toggleTheme);
    btn.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.toggleTheme(); } });
  }

  // Mobile fallback: create an invisible touch hotspot in the top-right
  // This ensures users can toggle theme even if other elements capture touches.
  try{
    const isTouch = ('ontouchstart' in window) || (navigator && navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    if(isTouch){
      const hotspot = document.createElement('div');
      hotspot.id = 'theme-toggle-hotspot';
      hotspot.setAttribute('aria-hidden', 'true');
      Object.assign(hotspot.style, {
        position: 'fixed',
        top: 'calc(12px + env(safe-area-inset-top))',
        right: 'calc(12px + env(safe-area-inset-right))',
        width: '64px',
        height: '64px',
        zIndex: '100000',
        background: 'transparent',
        pointerEvents: 'auto',
        touchAction: 'manipulation'
      });
      hotspot.addEventListener('click', function(e){ e.preventDefault(); window.toggleTheme(); });
      hotspot.addEventListener('touchstart', function(e){ e.preventDefault(); window.toggleTheme(); }, {passive: false});
      document.body.appendChild(hotspot);
    }
  }catch(e){ /* ignore on very old browsers */ }

  // Coordinate-based fallback: listen for touches/clicks in the top-right corner
  // Useful when other DOM elements capture pointer events and hotspot can't be used.
  (function(){
    let lastTrigger = 0;
    function inTopRight(x, y){
      const w = window.innerWidth || document.documentElement.clientWidth;
      const TH = 140; // touch region size in px
      return (x >= w - TH) && (y <= TH);
    }

    function tryTrigger(coordX, coordY, ev){
      const now = Date.now();
      if(now - lastTrigger < 600) return; // debounce
      if(inTopRight(coordX, coordY)){
        lastTrigger = now;
        try{ ev && ev.preventDefault(); }catch(e){}
        window.toggleTheme();
      }
    }

    document.addEventListener('touchend', function(ev){
      try{
        const t = ev.changedTouches && ev.changedTouches[0];
        if(t) tryTrigger(t.clientX, t.clientY, ev);
      }catch(e){}
    }, {passive: true});

    // Also listen for clicks as a fallback (some WebViews send clicks)
    document.addEventListener('click', function(ev){
      try{
        const x = ev.clientX, y = ev.clientY;
        if(typeof x === 'number') tryTrigger(x, y, ev);
      }catch(e){}
    }, true);
  })();

  // Create a visible floating mobile toggle button as a last-resort fallback
  try{
    const isTouch = ('ontouchstart' in window) || (navigator && navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
    if(isTouch){
      const showMobileButton = window.innerWidth <= 900; // show on phones / small tablets
      if(showMobileButton){
        const mobileBtn = document.createElement('button');
        mobileBtn.id = 'theme-toggle-mobile';
        mobileBtn.setAttribute('aria-label', 'Toggle theme');
        mobileBtn.type = 'button';
        mobileBtn.textContent = root.getAttribute('data-theme') === 'dark' ? '🌙' : '☀️';
        Object.assign(mobileBtn.style, {
          position: 'fixed',
          top: '18px',
          left: '18px',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          zIndex: '200000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '26px',
          boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
          pointerEvents: 'auto',
          touchAction: 'manipulation'
        });
        mobileBtn.addEventListener('click', function(e){ e.preventDefault(); window.toggleTheme(); mobileBtn.textContent = root.getAttribute('data-theme') === 'dark' ? '🌙' : '☀️'; });
        mobileBtn.addEventListener('touchstart', function(e){ e.preventDefault(); window.toggleTheme(); mobileBtn.textContent = root.getAttribute('data-theme') === 'dark' ? '🌙' : '☀️'; }, {passive:false});
        document.body.appendChild(mobileBtn);
      }
    }
  }catch(e){ /* ignore */ }
})();
