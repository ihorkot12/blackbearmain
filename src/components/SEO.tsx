import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  url?: string;
}

const SEO: React.FC<SEOProps> = ({ title, description, keywords, image, url }) => {
  const siteName = "Black Bear Dojo | Карате Кіокушинкай Київ";
  const fullTitle = `${title} | ${siteName}`;
  const defaultImage = "https://images.unsplash.com/photo-1552072092-7f9b8d63efcb?q=80&w=1200&auto=format&fit=crop";
  const defaultUrl = "https://ais-pre-52dzs75wldpn6rggyas75b-286910022589.europe-west2.run.app";

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url || defaultUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image || defaultImage} />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url || defaultUrl} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image || defaultImage} />

      {/* Canonical URL */}
      <link rel="canonical" href={url || defaultUrl} />

      {/* Geo Tags */}
      <meta name="geo.region" content="UA-30" />
      <meta name="geo.placename" content="Kyiv" />
      <meta name="geo.position" content="50.4501;30.5234" />
      <meta name="ICBM" content="50.4501, 30.5234" />
    </Helmet>
  );
};

export default SEO;
