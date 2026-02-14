import type { Plugin } from 'vite';
import pg from 'pg';

interface SEOData {
  title: string;
  description: string;
  ogImage: string | null;
  logoIcon: string | null;
  companyName: string;
}

const DEFAULT_SEO: SEOData = {
  title: '',
  description: '',
  ogImage: null,
  logoIcon: null,
  companyName: '',
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
        company_name
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

export function seoInjectPlugin(): Plugin {
  let seoData: SEOData = DEFAULT_SEO;

  return {
    name: 'seo-inject',

    async buildStart() {
      // Only fetch during production build
      if (process.env.NODE_ENV === 'production') {
        console.log('[SEO Inject] Fetching SEO data from database...');
        seoData = await fetchSEOData();
        if (seoData.title) {
          console.log(`[SEO Inject] Loaded: "${seoData.title}"`);
        } else {
          console.log('[SEO Inject] No SEO title configured in database');
        }
      }
    },

    transformIndexHtml(html) {
      // Replace placeholders with actual data
      let result = html;

      // Replace title - use data from DB or leave empty for client-side hydration
      if (seoData.title) {
        result = result.replace(
          /<title>.*?<\/title>/,
          `<title>${escapeHtml(seoData.title)}</title>`
        );
      }

      // Replace meta description
      if (seoData.description) {
        result = result.replace(
          /<meta name="description" content=".*?">/,
          `<meta name="description" content="${escapeHtml(seoData.description)}">`
        );
      }

      // Add OG tags if not present
      if (seoData.title && !result.includes('og:title')) {
        const ogTags = `
    <meta property="og:title" content="${escapeHtml(seoData.title)}">
    <meta property="og:description" content="${escapeHtml(seoData.description)}">
    ${seoData.ogImage ? `<meta property="og:image" content="${escapeHtml(seoData.ogImage)}">` : ''}
    <meta property="og:type" content="website">`;
        result = result.replace('</head>', `${ogTags}\n  </head>`);
      }

      // Replace favicon if logo icon is set
      if (seoData.logoIcon) {
        result = result.replace(
          /<link rel="icon"[^>]*>/,
          `<link rel="icon" type="image/png" href="${escapeHtml(seoData.logoIcon)}">`
        );
      }

      return result;
    },
  };
}
