import type { NextConfig } from 'next';

const cspScript = process.env.NODE_ENV === 'development' ? "'self' 'unsafe-inline' 'unsafe-eval'" : "'self' 'unsafe-inline'";
// Google AdSense needs a few extra domains. They are added ONLY when NEXT_PUBLIC_ADSENSE_CLIENT is set,
// so a site without AdSense keeps the strict policy. Check Google's AdSense CSP guidance if ads do not render.
const adsenseOn = (process.env.NEXT_PUBLIC_ADSENSE_CLIENT || '').startsWith('ca-pub-');
const adScript = adsenseOn ? ' https://pagead2.googlesyndication.com https://partner.googleadservices.com https://tpc.googlesyndication.com https://www.googletagservices.com https://adservice.google.com https://www.google.com' : '';
const adImg = adsenseOn ? ' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com https://*.gstatic.com' : '';
const adConnect = adsenseOn ? ' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com' : '';
const adFrame = adsenseOn ? 'frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com; ' : '';
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Content-Security-Policy', value: `default-src 'self'; img-src 'self' data: blob: https://*.supabase.co${adImg}; style-src 'self' 'unsafe-inline'; script-src ${cspScript}${adScript}; connect-src 'self' https://*.supabase.co wss://*.supabase.co${adConnect}; ${adFrame}font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() { return [{ source: '/(.*)', headers: securityHeaders }]; },
};

export default nextConfig;
