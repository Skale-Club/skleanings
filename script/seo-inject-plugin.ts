import type { Plugin } from 'vite';
import pg from 'pg';

interface SEOData {
  title: string;
  description: string;
  ogImage: string | null;
  logoIcon: string | null;
  companyName: string;
  companyPhone: string | null;
  companyEmail: string | null;
  companyAddress: string | null;
  canonicalUrl: string | null;
  robotsTag: string;
  ogType: string;
  ogSiteName: string | null;
  twitterCard: string;
  twitterSite: string | null;
  twitterCreator: string | null;
}

const DEFAULT_SEO: SEOData = {
  title: 'Skleanings | Professional Cleaning Services',
  description: 'Professional and reliable residential cleaning services tailored to your schedule.',
  ogImage: 'https://skleanings.com/favicon.png',
  logoIcon: null,
  companyName: 'Skleanings',
  companyPhone: null,
  companyEmail: null,
  companyAddress: null,
  canonicalUrl: 'https://skleanings.com/',
  robotsTag: 'index, follow',
  ogType: 'website',
  ogSiteName: 'Skleanings',
  twitterCard: 'summary_large_image',
  twitterSite: null,
  twitterCreator: null,
};

async function fetchSEOData(): Promise<SEOData> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.warn('[SEO Inject] DATABASE_URL not set, using empty defaults');
    return DEFAULT_SEO;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    const result = await pool.query(`
      SELECT
        seo_title,
        seo_description,
        og_image,
        logo_icon,
        company_name,
        company_phone,
        company_email,
        company_address,
        seo_canonical_url,
        seo_robots_tag,
        og_type,
        og_site_name,
        twitter_card,
        twitter_site,
        twitter_creator
      FROM company_settings
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.warn('[SEO Inject] No company settings found, using empty defaults');
      return DEFAULT_SEO;
    }

    const row = result.rows[0];
    return {
      title: row.seo_title || '',
      description: row.seo_description || '',
      ogImage: row.og_image || null,
      logoIcon: row.logo_icon || null,
      companyName: row.company_name || '',
      companyPhone: row.company_phone || null,
      companyEmail: row.company_email || null,
      companyAddress: row.company_address || null,
      canonicalUrl: row.seo_canonical_url || null,
      robotsTag: row.seo_robots_tag || 'index, follow',
      ogType: row.og_type || 'website',
      ogSiteName: row.og_site_name || null,
      twitterCard: row.twitter_card || 'summary_large_image',
      twitterSite: row.twitter_site || null,
      twitterCreator: row.twitter_creator || null,
    };
  } catch (error) {
    console.error('[SEO Inject] Failed to fetch SEO data:', error);
    return DEFAULT_SEO;
  } finally {
    await pool.end();
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeUrl(url: string | null | undefined, fallback: string): string {
  if (!url || !url.trim()) return fallback;
  return url.endsWith('/') ? url : `${url}/`;
}

function resolveImageUrl(image: string | null | undefined, canonicalUrl: string): string {
  const fallback = `${canonicalUrl}favicon.png`;
  if (!image || !image.trim()) return fallback;
  if (image.startsWith('http://') || image.startsWith('https://')) return image;
  return `${canonicalUrl}${image.replace(/^\/+/, '')}`;
}

function replaceMetaByName(html: string, name: string, content: string): string {
  const pattern = new RegExp(`<meta\\s+name="${name}"\\s+content="[^"]*"\\s*/?>`, 'i');
  return html.replace(pattern, `<meta name="${name}" content="${escapeHtml(content)}" />`);
}

function replaceMetaByProperty(html: string, property: string, content: string): string {
  const pattern = new RegExp(`<meta\\s+property="${property}"\\s+content="[^"]*"\\s*/?>`, 'i');
  return html.replace(pattern, `<meta property="${property}" content="${escapeHtml(content)}" />`);
}

function replaceCanonical(html: string, href: string): string {
  return html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(href)}" />`,
  );
}

function replaceAlternateHrefLang(html: string, hrefLang: string, href: string): string {
  const pattern = new RegExp(`<link\\s+rel="alternate"\\s+hreflang="${hrefLang}"\\s+href="[^"]*"\\s*/?>`, 'i');
  return html.replace(pattern, `<link rel="alternate" hreflang="${hrefLang}" href="${escapeHtml(href)}" />`);
}

function replaceJsonLd(html: string, jsonLd: string): string {
  return html.replace(
    /<script\s+id="ld-localbusiness"\s+type="application\/ld\+json">[\s\S]*?<\/script>/i,
    `<script id="ld-localbusiness" type="application/ld+json">${jsonLd}</script>`,
  );
}

function buildLocalBusinessJsonLd(seoData: SEOData): string {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: seoData.companyName || seoData.ogSiteName || 'Skleanings',
    description: seoData.description,
    url: seoData.canonicalUrl,
    image: seoData.ogImage,
  };

  if (seoData.companyPhone) schema.telephone = seoData.companyPhone;
  if (seoData.companyEmail) schema.email = seoData.companyEmail;
  if (seoData.companyAddress) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: seoData.companyAddress,
    };
  }

  return JSON.stringify(schema);
}

export function seoInjectPlugin(): Plugin {
  let seoData: SEOData = DEFAULT_SEO;

  return {
    name: 'seo-inject',

    async buildStart() {
      console.log('[SEO Inject] Fetching SEO data from database...');
      const data = await fetchSEOData();
      const canonicalUrl = normalizeUrl(data.canonicalUrl, DEFAULT_SEO.canonicalUrl!);
      const title = data.title || data.companyName || DEFAULT_SEO.title;
      const description = data.description || DEFAULT_SEO.description;

      seoData = {
        ...DEFAULT_SEO,
        ...data,
        title,
        description,
        canonicalUrl,
        robotsTag: data.robotsTag || DEFAULT_SEO.robotsTag,
        ogSiteName: data.ogSiteName || data.companyName || DEFAULT_SEO.ogSiteName,
        ogImage: resolveImageUrl(data.ogImage, canonicalUrl),
      };

      console.log(`[SEO Inject] Loaded title: "${seoData.title}"`);
      if (!data.ogImage) {
        console.log('[SEO Inject] og_image missing, using favicon fallback for og:image');
      }
    },

    transformIndexHtml(html) {
      let result = html.replace(
        /<title>.*?<\/title>/,
        `<title>${escapeHtml(seoData.title)}</title>`,
      );

      result = replaceMetaByName(result, 'description', seoData.description);
      result = replaceMetaByName(result, 'robots', seoData.robotsTag || 'index, follow');
      result = replaceMetaByName(
        result,
        'googlebot',
        'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
      );

      const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
      if (googleSiteVerification) {
        result = replaceMetaByName(result, 'google-site-verification', googleSiteVerification);
      }

      result = replaceCanonical(result, seoData.canonicalUrl!);
      result = replaceAlternateHrefLang(result, 'en-US', seoData.canonicalUrl!);
      result = replaceAlternateHrefLang(result, 'x-default', seoData.canonicalUrl!);

      result = replaceMetaByProperty(result, 'og:title', seoData.title);
      result = replaceMetaByProperty(result, 'og:description', seoData.description);
      result = replaceMetaByProperty(result, 'og:image', seoData.ogImage!);
      result = replaceMetaByProperty(
        result,
        'og:image:alt',
        `${seoData.ogSiteName || seoData.companyName || DEFAULT_SEO.ogSiteName} logo`,
      );
      result = replaceMetaByProperty(result, 'og:type', seoData.ogType || 'website');
      result = replaceMetaByProperty(result, 'og:locale', 'en_US');
      result = replaceMetaByProperty(
        result,
        'og:site_name',
        seoData.ogSiteName || seoData.companyName || DEFAULT_SEO.ogSiteName!,
      );
      result = replaceMetaByProperty(result, 'og:url', seoData.canonicalUrl!);

      result = replaceMetaByName(result, 'twitter:card', seoData.twitterCard || 'summary_large_image');
      result = replaceMetaByName(result, 'twitter:title', seoData.title);
      result = replaceMetaByName(result, 'twitter:description', seoData.description);
      result = replaceMetaByName(result, 'twitter:image', seoData.ogImage!);
      result = replaceMetaByName(
        result,
        'twitter:image:alt',
        `${seoData.ogSiteName || seoData.companyName || DEFAULT_SEO.ogSiteName} logo`,
      );
      if (seoData.twitterSite) {
        result = replaceMetaByName(result, 'twitter:site', seoData.twitterSite);
      }
      if (seoData.twitterCreator) {
        result = replaceMetaByName(result, 'twitter:creator', seoData.twitterCreator);
      }

      // Replace favicon if logo icon is set.
      if (seoData.logoIcon) {
        result = result.replace(
          /<link rel="icon"[^>]*>/,
          `<link rel="icon" type="image/png" href="${escapeHtml(seoData.logoIcon)}">`,
        );
      }

      result = replaceJsonLd(result, buildLocalBusinessJsonLd(seoData));

      return result;
    },
  };
}
