/**
 * Vercel Edge Middleware: превʼю посилань для месенджерів і соцмереж.
 *
 * Сайт — SPA: meta-теги кожної сторінки виставляє React. Боти Telegram, Facebook,
 * Viber, WhatsApp, LinkedIn JS не виконують і бачать лише index.html з тегами головної.
 * Тут для таких ботів віддаємо легку HTML-сторінку з правильними title / description /
 * og:image саме для запитаного URL. Google, Bing і звичайні користувачі не зачіпаються.
 */
import { PAGE_SEO, SITE_NAME } from './src/lib/seoPages';

export const config = {
  matcher: ['/', '/kids-4-7', '/juniors-7-12', '/teens-12-plus', '/women-karate', '/personal-training', '/encyclopedia']
};

const PREVIEW_BOT =
  /facebookexternalhit|facebookcatalog|Facebot|Twitterbot|TelegramBot|WhatsApp|LinkedInBot|Slackbot|Discordbot|Pinterest|vkShare|Viber|SkypeUriPreview|Applebot|redditbot|Embedly|Iframely|Snapchat|Threads/i;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export default function middleware(request: Request) {
  const ua = request.headers.get('user-agent') || '';
  if (!PREVIEW_BOT.test(ua)) return; // далі — звичайний index.html

  const { pathname } = new URL(request.url);
  const page = PAGE_SEO[pathname.replace(/\/+$/, '') || '/'];
  if (!page) return;

  const url = `https://shin-karate.kyiv.ua${page.path}`;
  const html = `<!doctype html>
<html lang="uk"><head>
<meta charset="utf-8">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:locale" content="uk_UA">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:image" content="${page.image}">
<meta property="og:image:secure_url" content="${page.image}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(page.imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<meta name="twitter:image" content="${page.image}">
<meta name="twitter:image:alt" content="${esc(page.imageAlt)}">
</head><body>
<h1>${esc(page.title)}</h1>
<p>${esc(page.description)}</p>
<p><a href="${url}">${url}</a></p>
</body></html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
      vary: 'User-Agent'
    }
  });
}
