// Serves /ads.txt for Google AdSense once NEXT_PUBLIC_ADSENSE_CLIENT is set (for example ca-pub-1234567890123456).
// Without it the file does not exist, which is the correct behaviour before AdSense is enabled.
export const dynamic = 'force-static';

export function GET() {
  const publisher = (process.env.NEXT_PUBLIC_ADSENSE_CLIENT || '').replace(/^ca-/, '');
  if (!publisher.startsWith('pub-')) return new Response('Not found', { status: 404 });
  return new Response(`google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
