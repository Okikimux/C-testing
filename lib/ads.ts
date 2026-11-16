import { createClient } from './supabase';

export type AdPlacement = 'home' | 'marketplace' | 'product';
export type Ad = {
  id: string;
  advertiser: string;
  title: string;
  body: string | null;
  image_url: string | null;
  link_url: string;
  cta_label: string;
  placements: AdPlacement[];
  status: 'draft' | 'active' | 'paused' | 'removed';
  starts_at: string;
  ends_at: string | null;
  created_at?: string;
  owner_id?: string | null;
  source?: 'admin' | 'self';
  removed_reason?: string | null;
};

export const PLACEMENTS: Array<{ value: AdPlacement; label: string; hint: string }> = [
  { value: 'marketplace', label: 'Marketplace', hint: 'A row between listings' },
  { value: 'home', label: 'Home page', hint: 'Banner above the final call to action' },
  { value: 'product', label: 'Product page', hint: 'Block under the description' },
];

// One fetch per placement is shared by every slot on the page (60 second cache).
const cache = new Map<AdPlacement, { at: number; promise: Promise<Ad[]> }>();

export function fetchLiveAds(placement: AdPlacement): Promise<Ad[]> {
  const hit = cache.get(placement);
  if (hit && Date.now() - hit.at < 60_000) return hit.promise;
  const promise = (async () => {
    try {
      const supabase = createClient();
      // Preferred: the database decides what is live (admin ads, plus paid self-serve ads).
      let rows: Ad[] | null = null;
      const viaRpc = await supabase.rpc('live_ads', { p_placement: placement });
      if (!viaRpc.error && Array.isArray(viaRpc.data)) rows = viaRpc.data as Ad[];
      else {
        // The paid-ads SQL has not been run yet: fall back to reading admin ads from the table.
        const { data, error } = await supabase
          .from('ads')
          .select('id, advertiser, title, body, image_url, link_url, cta_label, placements, status, starts_at, ends_at')
          .eq('status', 'active')
          .contains('placements', [placement]);
        if (error) return [];
        rows = (data || []) as Ad[];
      }
      const now = Date.now();
      // The database already filters by date; this is a second safety check.
      return rows.filter(ad =>
        /^https:\/\//i.test(ad.link_url) &&
        new Date(ad.starts_at).getTime() <= now &&
        (!ad.ends_at || new Date(ad.ends_at).getTime() > now));
    } catch {
      return [];
    }
  })();
  cache.set(placement, { at: Date.now(), promise });
  return promise;
}

export function recordAdEvent(adId: string, event: 'view' | 'click') {
  try {
    void Promise.resolve(createClient().rpc('record_ad_event', { p_ad_id: adId, p_event: event })).catch(() => {});
  } catch { /* counting must never break the page */ }
}
