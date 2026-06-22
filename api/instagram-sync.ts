import fetch from 'node-fetch';
import { activeInstagramAccountSql, ensureInstagramSchema, pool, requireAdmin, setNoStore } from './instagram-admin-utils.ts';

const GRAPH_VERSION = 'v19.0';

async function fetchGraph(url: string, required = true) {
  const response = await fetch(url);
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    const message = data?.error?.message || `Graph API error ${response.status}`;
    if (required) throw new Error(message);
    console.warn('Optional Instagram Graph request failed:', message);
    return { data: [] };
  }
  return data;
}

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
    const accountRes = await pool.query(activeInstagramAccountSql(true), [admin.id]);
    if (accountRes.rows.length === 0) return res.status(404).json({ error: 'No account connected' });

    const account = accountRes.rows[0];
    const igId = account.instagram_business_account_id;
    const token = account.access_token;
    if (!igId || !token) return res.status(400).json({ error: 'Instagram account is incomplete' });

    const encodedToken = encodeURIComponent(token);
    const insightsUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${igId}/insights?metric=impressions,reach,follower_count&period=day&access_token=${encodedToken}`;
    const mediaUrl = `https://graph.facebook.com/${GRAPH_VERSION}/${igId}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&access_token=${encodedToken}`;

    const [insightsData, mediaData] = await Promise.all([
      fetchGraph(insightsUrl, false),
      fetchGraph(mediaUrl, true),
    ]);

    return res.status(200).json({
      success: true,
      username: account.username,
      account: {
        username: account.username,
        instagram_business_account_id: account.instagram_business_account_id,
        facebook_page_id: account.facebook_page_id,
        is_active: Boolean(account.is_active),
      },
      account_insights: Array.isArray(insightsData?.data) ? insightsData.data : [],
      media: Array.isArray(mediaData?.data) ? mediaData.data : [],
    });
  } catch (error: any) {
    console.error('Instagram Sync Error:', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Instagram sync failed' });
  }
}
