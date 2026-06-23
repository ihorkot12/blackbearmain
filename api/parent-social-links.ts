import pkg from 'pg';
import { clean } from './telegram-parent-utils';

const { Pool } = pkg;

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    })
  : null;

const isHttpUrl = (value: unknown) => {
  const raw = clean(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
};

async function readSetting(keys: string[]) {
  if (!pool) return '';

  for (const table of ['site_content', 'settings']) {
    try {
      const result = await pool.query(
        `SELECT value FROM ${table} WHERE key = ANY($1::text[]) ORDER BY array_position($1::text[], key) LIMIT 1`,
        [keys]
      );
      const value = isHttpUrl(result.rows[0]?.value);
      if (value) return value;
    } catch (error) {
      // Some older deployments may not have both settings tables yet.
    }
  }

  return '';
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'public, max-age=300');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const instagramUrl =
      isHttpUrl(process.env.CLUB_INSTAGRAM_URL) ||
      await readSetting(['CLUB_INSTAGRAM_URL', 'club_instagram_url', 'social_instagram', 'instagram_url']);

    const facebookUrl =
      isHttpUrl(process.env.CLUB_FACEBOOK_URL) ||
      await readSetting(['CLUB_FACEBOOK_URL', 'club_facebook_url', 'social_facebook', 'facebook_url']);

    res.status(200).json({ instagramUrl, facebookUrl });
  } catch (error) {
    console.error('Failed to read parent social links:', error);
    res.status(200).json({ instagramUrl: '', facebookUrl: '' });
  }
}
