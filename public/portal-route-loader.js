(() => {
  const loaded = new Set();

  const loadScript = (src) => {
    if (loaded.has(src) || document.querySelector(`script[src="${src}"]`)) return;
    loaded.add(src);
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    document.body.appendChild(script);
  };

  const afterFirstPaint = (callback) => {
    const run = () => {
      if ('requestIdleCallback' in window) window.requestIdleCallback(callback, { timeout: 1200 });
      else window.setTimeout(callback, 180);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
  };

  afterFirstPaint(() => {
    const path = location.pathname;

    if (path === '/parent' || path.startsWith('/parent/')) {
      loadScript('/mono-parent-payments.js');
      loadScript('/parent-dashboard-priority.js');
      loadScript('/parent-athlete-upgrades.js');
      return;
    }

    if (path === '/admin' || path.startsWith('/admin/')) {
      loadScript('/admin-payment-settings.js');
    }
  });
})();
