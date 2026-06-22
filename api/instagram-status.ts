import { activeInstagramAccountSql, ensureInstagramSchema, pool, requireAdmin, setNoStore } from './instagram-admin-utils.ts';

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
    const result = await pool.query(activeInstagramAccountSql(false), [admin.id]);
    if (result.rows.length === 0) return res.status(200).json({ connected: false });

    return res.status(200).json({
      connected: true,
      account: result.rows[0],
    });
  } catch (error: any) {
    console.error('Instagram status failed:', error?.message || error);
    return res.status(500).json({ error: 'Failed to check Instagram status' });
  }
}
