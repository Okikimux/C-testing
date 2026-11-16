// The public address of the site. Used for the canonical URL, robots.txt and sitemap.xml.
// Set NEXT_PUBLIC_SITE_URL in your hosting environment when the CARTOMUX domain is live.
// If it is not set, it falls back to https://cartomux.com.ng.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://cartomux.com.ng').replace(/\/+$/, '');
