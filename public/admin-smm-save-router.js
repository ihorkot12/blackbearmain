(() => {
  if (window.__bbSmmSaveRouterInstalled) return;
  window.__bbSmmSaveRouterInstalled = true;

  const originalFetch = window.fetch.bind(window);
  const isRepairSaveUrl = (input) => {
    try {
      const rawUrl = typeof input === 'string' ? input : input?.url;
      if (!rawUrl) return false;
      return new URL(rawUrl, location.href).pathname === '/api/smm-repair-post';
    } catch (_) {
      return false;
    }
  };

  window.fetch = async (input, init = {}) => {
    if (!isRepairSaveUrl(input)) return originalFetch(input, init);

    try {
      await originalFetch('/api/social/ig/status', {
        method: 'GET',
        headers: init?.headers || {},
        cache: 'no-store',
      });
    } catch (_) {
      // The main save request below will surface any real authorization or DB error.
    }

    return originalFetch('/api/smm/posts', init);
  };
})();
