import { SESSION_COOKIE, readCookie, verifySession } from './auth.js';
import { originAllowed, resolveAdmin } from './admin-auth.js';
import { pool } from './db.js';
import { HttpError, RawReply, Reply, readJsonBody, type Ctx, type Profile, type Route } from './http.js';
import { adminRoutes } from './routes-admin.js';
import { publicRoutes } from './routes-public.js';
import { getProfileById } from './store.js';

const routes: Route[] = [...publicRoutes, ...adminRoutes];

/** Rewrite у vercel.json передає хвіст шляху в ?path=..., запасний варіант — розбір URL. */
function pathSegments(req: any): string[] {
  let raw = req.query?.path;
  if (Array.isArray(raw)) raw = raw.join('/');
  if (typeof raw !== 'string' || !raw) {
    try {
      raw = new URL(req.url || '', 'http://localhost').pathname.replace(/^\/api\/shingi\/?/, '');
    } catch {
      raw = '';
    }
  }
  return raw.split('/').filter(Boolean);
}

function match(route: Route, segments: string[]): Record<string, string> | null {
  const pattern = route.path.split('/');
  if (pattern.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i].startsWith(':')) params[pattern[i].slice(1)] = decodeURIComponent(segments[i]);
    else if (pattern[i] !== segments[i]) return null;
  }
  return params;
}

const flatQuery = (req: any): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'path') continue;
    out[key] = String(Array.isArray(value) ? value[0] : value ?? '');
  }
  return out;
};

const sendJson = (res: any, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
};

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  try {
    if (!pool) throw new HttpError(503, 'База даних не налаштована', 'no_database');

    const segments = pathSegments(req);
    const method = String(req.method || 'GET').toUpperCase();
    const byPath = routes.map((route) => ({ route, params: match(route, segments) })).filter((x) => x.params);
    if (byPath.length === 0) throw new HttpError(404, 'Маршрут не знайдено');
    const found = byPath.find((x) => x.route.method === method);
    if (!found) {
      res.setHeader('Allow', byPath.map((x) => x.route.method).join(', '));
      throw new HttpError(405, 'Метод не підтримується');
    }
    const { route, params } = found as { route: Route; params: Record<string, string> };

    // сесія тренера (cookie); невалідна сесія = гість
    let profile: Profile | null = null;
    const token = readCookie(req.headers?.cookie, SESSION_COOKIE);
    const profileId = token ? verifySession(token) : null;
    if (profileId !== null) profile = await getProfileById(profileId).catch(() => null);

    let admin: string | null = null;
    if (route.auth === 'admin') {
      admin = await resolveAdmin(req, profile);
      if (!admin) throw new HttpError(profile ? 403 : 401, 'Потрібні права адміністратора');
    } else if (route.auth === 'session' || route.auth === 'member') {
      if (!profile) throw new HttpError(401, 'Потрібен вхід через Telegram', 'unauthorized');
      if (route.auth === 'member' && !profile.role) throw new HttpError(403, 'Спершу заповніть анкету', 'profile_incomplete');
      if (method !== 'GET' && !originAllowed(req)) throw new HttpError(403, 'Запит з невідомого джерела', 'bad_origin');
    }

    const ctx: Ctx = {
      req,
      res,
      params,
      query: flatQuery(req),
      body: method === 'GET' ? {} : await readJsonBody(req),
      profile,
      admin,
      setHeader: (name, value) => res.setHeader(name, value),
    };

    const result = await route.handler(ctx);
    if (res.writableEnded) return;

    if (result instanceof RawReply) {
      res.statusCode = result.status;
      for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
      res.end(result.body);
      return;
    }
    if (result instanceof Reply) return sendJson(res, result.status, result.body);
    return sendJson(res, 200, result ?? { ok: true });
  } catch (error: any) {
    if (error instanceof HttpError) return sendJson(res, error.status, { error: error.message, code: error.code });
    if (error?.code === '23505') return sendJson(res, 409, { error: 'Такий запис уже існує', code: 'duplicate' });
    if (error?.code === '23503') return sendJson(res, 409, { error: 'Пов’язаний запис не знайдено', code: 'reference' });
    if (error?.code === '22P02' || error?.code === '22007' || error?.code === '22008') {
      return sendJson(res, 400, { error: 'Некоректні дані', code: 'bad_input' });
    }
    console.error('shingi error:', error?.message || error);
    return sendJson(res, 500, { error: 'Внутрішня помилка сервера' });
  }
}
