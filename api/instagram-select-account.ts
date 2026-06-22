import { ensureInstagramSchema, pool, readJsonBody, requireAdmin, setNoStore } from './instagram-admin-utils.ts';

export default async function handler(req: any, res: any) {
  setNoStore(res);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!pool) return res.status(500).json({ error: 'Database not configured' });

  const admin = await requireAdmin(req);
  if (!admin) return res.status(403).json({ error: 'Доступ тільки для головного адміна' });

  try {
    await ensureInstagramSchema();
    const body = await readJsonBody(req);
    const instagramBusinessAccountId = String(
      body?.instagram_business_account_id ||
      body?.instagramBusinessAccountId ||
      body?.id ||
      ''
    ).trim();

    if (!instagramBusinessAccountId) {
      return res.status(400).json({ error: 'Instagram account id is required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const accountRes = await client.query(
        `SELECT id, username, instagram_business_account_id, facebook_page_id
         FROM instagram_accounts
         WHERE admin_user_id = $1 AND instagram_business_account_id = $2
         LIMIT 1`,
        [admin.id, instagramBusinessAccountId]
      );

      if (accountRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Цей Instagram акаунт не знайдений у підключених акаунтах адміна' });
      }

      await client.query('UPDATE instagram_accounts SET is_active = FALSE WHERE admin_user_id = $1', [admin.id]);
      const updated = await client.query(
        `UPDATE instagram_accounts
         SET is_active = TRUE,
             updated_at = CURRENT_TIMESTAMP
         WHERE admin_user_id = $1 AND instagram_business_account_id = $2
         RETURNING id, username, instagram_business_account_id, facebook_page_id, updated_at, is_active`,
        [admin.id, instagramBusinessAccountId]
      );
      await client.query('COMMIT');

      return res.status(200).json({ success: true, account: updated.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Instagram select account failed:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Failed to select Instagram account' });
  }
}
