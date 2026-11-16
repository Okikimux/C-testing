import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/advertise/book',
        '/advertise/my-ads',
        '/auth/',
        '/profile/',
        '/settings/',
        '/favourites/',
        '/messages/',
        '/notifications/',
        '/my-listings/',
        '/transactions/',
        '/seller-analytics/',
        '/viewing-requests/',
        '/service-requests/',
        '/store/manage',
        '/sell/',
        '/verification/',
        '/appeals/',
        '/api/',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
