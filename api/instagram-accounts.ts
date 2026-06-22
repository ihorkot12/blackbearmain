import { ensureInstagramSchema, pool, requireAdmin, setNoStore } from './instagram-admin-utils.ts';

export default async function handler(req: any, res: any) {
  setNoStore(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  const admin = await requireAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Доступ тільки для головного адміна' });

  try {
    await ensureInstagramSchema();
    const result = await pool.query(
      `SELECT id,
              username,
              instagram_business_account_id,
              facebook_page_id,
              updated_at,
              COALESCE(is_active, FALSE) AS is_active
       FROM instagram_accounts
       WHERE admin_user_id = $1
       ORDER BY COALESCE(is_active, FALSE) DESC, updated_at DESC NULLS LAST, id DESC`,
      [admin.id]
    );

    return res.status(200).json({ accounts: result.rows });
  } catch (error: any) {
    console.error('Instagram accounts failed:', error?.message || error);
    return res.status(500).json({ error: 'Failed to load Instagram accounts' });
  }
}
