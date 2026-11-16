import './globals.css';
import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import AppShell from '../components/app-shell';
import { themeInitScript } from '../lib/theme-script';
import { SITE_URL } from '../lib/site';

// Self-hosted at build time by next/font, so the existing CSP (font-src 'self') keeps working.
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Figtree({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

const TITLE = 'CARTOMUX — Your Campus. Your Marketplace.';
const DESCRIPTION = 'List It. Find It. Get It. A campus marketplace for commerce, accommodation and student services.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: 'CARTOMUX',
  title: TITLE,
  description: DESCRIPTION,
  // Google shows the favicon next to search results. It wants a square icon in a multiple of 48px
  // (48, 96, 192...) plus a normal /favicon.ico, all crawlable.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '48x48' },
      { url: '/icon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-96.png', sizes: '96x96', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/campora-app-icon.png',
  },
  manifest: '/manifest.webmanifest',
  openGraph: { type: 'website', siteName: 'CARTOMUX', title: TITLE, description: DESCRIPTION, url: SITE_URL, locale: 'en_NG', images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'CARTOMUX: List it. Find it. Get it.' }] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/og-image.png'] },
  // Optional Google Search Console "HTML tag" verification (not needed if you verify with the DNS record).
  ...(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION } } : {}),
  // Lets Google verify site ownership once AdSense is set up.
  ...(process.env.NEXT_PUBLIC_ADSENSE_CLIENT ? { other: { 'google-adsense-account': process.env.NEXT_PUBLIC_ADSENSE_CLIENT } } : {}),
};

// Tells Google the site's name and logo (used for the name and icon in results).
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'CARTOMUX', url: SITE_URL, logo: `${SITE_URL}/icon-512.png`, slogan: 'List It. Find It. Get It.', parentOrganization: { '@type': 'Organization', name: 'MUXLAB' } },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, url: SITE_URL, name: 'CARTOMUX', alternateName: 'Cartomux', inLanguage: 'en-NG', publisher: { '@id': `${SITE_URL}/#organization` } },
  ],
};
const structuredDataJson = JSON.stringify(structuredData).replace(/</g, '\\u003c');

// viewport-fit=cover lets the bottom tab bar respect the phone's safe area.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: [{ media: '(prefers-color-scheme: light)', color: '#ffffff' }, { media: '(prefers-color-scheme: dark)', color: '#0a1624' }] };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" className={`${display.variable} ${body.variable}`} suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredDataJson }} /></head><body><AppShell>{children}</AppShell></body></html>;
}
