(() => {
  const ADMIN_PATH_RE = /^\/admin(?:\/|$)/;
  const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

  const isAdminPath = () => ADMIN_PATH_RE.test(window.location.pathname);
  const currentRole = () => window.localStorage.getItem('admin_role') || '';

  const toPath = (input) => {
    try {
      const raw = typeof input === 'string' ? input : input?.url || '';
      return new URL(raw, window.location.origin).pathname;
    } catch (_) {
      return '';
    }
  };

  const jsonResponse = (payload, status = 200) =>
    new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });

  const blockedCoachPayload = (path) => {
    if (path.startsWith('/api/instagram') || path.startsWith('/api/auth/instagram')) {
      return jsonResponse({ connected: false, hidden: true, role: 'coach' });
    }

    return jsonResponse({
      error: 'Ця дія доступна тільки адміністратору клубу.',
      hidden: true,
      role: 'coach'
    }, 403);
  };

  const isCoachAdminOnlyRequest = (path) => {
    if (!isAdminPath() || currentRole() !== 'coach') return false;
    if (path.startsWith('/api/instagram')) return true;
    if (path.startsWith('/api/auth/instagram')) return true;
    if (path.startsWith('/api/smm')) return true;
    if (path === '/api/participants/export') return true;
    if (path === '/api/participants/import') return true;
    return false;
  };

  const rememberAuthShape = (path, response) => {
    if (path !== '/api/login' && path !== '/api/check-auth') return;

    response.clone().json().then((data) => {
      if (!data || typeof data !== 'object') return;
      if (data.role) window.localStorage.setItem('admin_role', data.role);
      if (data.name) window.localStorage.setItem('admin_name', data.name);
      if (data.coach_id !== undefined && data.coach_id !== null) {
        window.localStorage.setItem('admin_coach_id', String(data.coach_id));
      }
    }).catch(() => {});
  };

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const path = toPath(input);

    if (isCoachAdminOnlyRequest(path)) {
      return blockedCoachPayload(path);
    }

    const response = await originalFetch(input, init);
    rememberAuthShape(path, response);
    return response;
  };
})();
