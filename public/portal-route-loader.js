(() => {
  const loaded = new Set();
  let scheduled = 0;

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

  const loadForCurrentRoute = () => {
    const path = location.pathname;

    if (path === '/parent' || path.startsWith('/parent/')) {
      loadScript('/mono-parent-payments.js');
      loadScript('/parent-dashboard-priority.js');
      loadScript('/parent-athlete-upgrades.js');
      return;
    }

    if (path === '/admin' || path.startsWith('/admin/')) {
      loadScript('/admin-payment-settings.js');
      loadScript('/admin-role-cleanup.js');
      loadScript('/admin-instagram-fix.js');
      loadScript('/admin-instagram-account-picker.js');
      loadScript('/admin-smm-repair.js');
    }
  };

  const scheduleRouteLoad = () => {
    window.clearTimeout(scheduled);
    scheduled = window.setTimeout(() => afterFirstPaint(loadForCurrentRoute), 40);
  };

  const patchHistory = (method) => {
    const original = history[method];
    if (typeof original !== 'function' || original.__bbPatched) return;
    const patched = function (...args) {
      const result = original.apply(this, args);
      scheduleRouteLoad();
      return result;
    };
    patched.__bbPatched = true;
    history[method] = patched;
  };

  patchHistory('pushState');
  history.replaceState && patchHistory('replaceState');
  window.addEventListener('popstate', scheduleRouteLoad);
  window.addEventListener('pageshow', scheduleRouteLoad);
  scheduleRouteLoad();
})();
