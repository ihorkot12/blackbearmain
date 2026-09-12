import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';

import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '../lib/seoPages';
export { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE };

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  imageAlt?: string;
  /** Канонічна адреса сторінки. Без неї всі лендінги канонікалізувались на головну. */
  url?: string;
  /** Структуровані дані schema.org — обʼєкт або масив обʼєктів. */
  jsonLd?: object | object[];
  noindex?: boolean;
}

const SEO: React.FC<SEOProps> = ({ title, description, keywords, image, imageAlt, url, jsonLd, noindex }) => {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const canonical = url || `${SITE_URL}/`;
  const ogImage = image || DEFAULT_OG_IMAGE;
  const ld = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  // Статичні SEO-теги з index.html (позначені data-rh) — лише для ботів без JS.
  // Після рендера React вони дублюють актуальні теги сторінки — прибираємо, щоб у <head> був один title/description/og:image.
  useEffect(() => {
    document.head.querySelectorAll('[data-rh]').forEach((el) => el.remove());
  }, []);

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noindex ? <meta name="robots" content="noindex, nofollow" /> : <meta name="robots" content="index, follow" />}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="uk_UA" />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:secure_url" content={ogImage} />
      <meta property="og:image:type" content="image/jpeg" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={imageAlt || fullTitle} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={imageAlt || fullTitle} />

      <link rel="canonical" href={canonical} />

      {/* Geo */}
      <meta name="geo.region" content="UA-30" />
      <meta name="geo.placename" content="Kyiv" />
      <meta name="geo.position" content="50.451051;30.445565" />
      <meta name="ICBM" content="50.451051, 30.445565" />

      {ld.map((item, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(item)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEO;
