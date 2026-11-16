'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Megaphone, Plus } from 'lucide-react';
import { BackButton } from '../../../components/back-button';
import { useToast } from '../../../components/toast';
import { createClient } from '../../../lib/supabase';
import { PLACEMENT_LABELS, formatNaira, type Placement } from '../../../lib/ad-pricing';

type MyAd = { id: string; advertiser: string; title: string; body: string | null; image_url: string | null; status: 'draft' | 'active' | 'paused' | 'removed'; removed_reason: string | null };
type Order = { id: string; ad_id: string; placements: Placement[]; days: number; starts_at: string; ends_at: string; amount_kobo: number; status: 'pending' | 'paid' | 'failed' | 'refunded'; payment_reference: string | null; paid_at: string | null; created_at: string };
type Stats = Record<string, { views: number; clicks: number }>;

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
const places = (list: Placement[]) => list.map(p => PLACEMENT_LABELS[p]).join(', ');

export default function MyAds() {
  return <Suspense fallback={<main className="section"><div className="container"><div className="skeleton skeletonBlock" style={{ height: 240 }} /></div></main>}><MyAdsInner /></Suspense>;
}

function MyAdsInner() {
  const toast = useToast();
  const params = useSearchParams();
  const [ads, setAds] = useState<MyAd[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [verified, setVerified] = useState(true);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [adsRes, ordersRes, statsRes, verification] = await Promise.all([
      supabase.from('ads').select('id,advertiser,title,body,image_url,status,removed_reason').eq('owner_id', user.id).order('created_at', { ascending: false }),
      supabase.from('ad_orders').select('id,ad_id,placements,days,starts_at,ends_at,amount_kobo,status,payment_reference,paid_at,created_at').eq('owner_id', user.id).order('created_at', { ascending: false }),
      supabase.rpc('my_ad_stats'),
      supabase.from('student_verifications').select('id').eq('user_id', user.id).eq('status', 'approved').in('payment_status', ['paid', 'waived']).limit(1),
    ]);
    if (adsRes.error || ordersRes.error) { setMissing(true); setLoading(false); return; }
    setAds((adsRes.data || []) as MyAd[]);
    setOrders((ordersRes.data || []) as Order[]);
    const next: Stats = {};
    for (const row of (statsRes.data || []) as Array<{ ad_id: string; views: number | string; clicks: number | string }>) next[row.ad_id] = { views: Number(row.views), clicks: Number(row.clicks) };
    setStats(next);
    setVerified(Boolean(verification.data && verification.data.length));
    setLoading(false);
  }, []);

  // After Paystack sends the person back, confirm the payment (and settle any other recent unfinished ones).
  useEffect(() => {
    let alive = true;
    (async () => {
      const returned = params.get('reference') || params.get('trxref') || '';
      const refs = new Set<string>(returned ? [returned] : []);
      if (!returned) {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
          const { data } = await supabase.from('ad_orders').select('payment_reference').eq('owner_id', user.id).eq('status', 'pending').gte('created_at', since);
          (data || []).forEach((o: { payment_reference: string | null }) => { if (o.payment_reference) refs.add(o.payment_reference); });
        }
      }
      for (const reference of refs) {
        const response = await fetch('/api/ads/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference }) });
        const result = await response.json().catch(() => ({}));
        if (!alive) return;
        if (response.ok && result.paid && reference === returned) toast.success(result.message || 'Payment confirmed. Your ad is booked.');
        else if (!response.ok && reference === returned) toast.error(result.error || 'We could not confirm that payment yet.');
      }
      if (returned && alive) window.history.replaceState({}, '', '/advertise/my-ads');
      if (alive) await load();
    })();
    return () => { alive = false; };
  }, [params, load, toast]);

  if (loading) return <main className="section"><BackButton /><div className="container"><div className="skeleton skeletonBlock" style={{ height: 240 }} /></div></main>;
  if (missing) return <main className="section"><BackButton /><div className="container"><div className="panel gatePanel"><span className="advertiseIcon"><Megaphone size={22} /></span><h1>Ads are not set up yet</h1><p className="muted">Please check back soon.</p></div></div></main>;

  const now = Date.now();
  const paidFor = (adId: string) => orders.filter(o => o.ad_id === adId && o.status === 'paid');
  const stateOf = (ad: MyAd): { label: string; tone: string; detail: string } => {
    if (ad.status === 'removed') return { label: 'Removed', tone: 'bad', detail: ad.removed_reason ? `Removed by CARTOMUX: ${ad.removed_reason}` : 'Removed by CARTOMUX.' };
    if (ad.status === 'paused') return { label: 'Paused', tone: 'muted', detail: 'Paused by CARTOMUX. Contact support if you think this is a mistake.' };
    const paid = paidFor(ad.id);
    if (!paid.length) return { label: 'Not booked', tone: 'muted', detail: 'Choose pages and days, then pay to run this ad.' };
    const current = paid.filter(o => new Date(o.starts_at).getTime() <= now && new Date(o.ends_at).getTime() > now);
    if (current.length) {
      const end = Math.max(...current.map(o => new Date(o.ends_at).getTime()));
      const left = Math.max(1, Math.ceil((end - now) / 86400000));
      return { label: verified ? 'Live' : 'Paused: verification needed', tone: verified ? 'live' : 'bad', detail: verified ? `Running on ${places(Array.from(new Set(current.flatMap(o => o.placements))))}. ${left} day${left === 1 ? '' : 's'} left (until ${fmt(new Date(end).toISOString())}).` : 'Your account is no longer verified, so this ad is hidden until you are verified again.' };
    }
    const upcoming = paid.filter(o => new Date(o.starts_at).getTime() > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    if (upcoming) return { label: 'Scheduled', tone: 'info', detail: `Starts ${fmt(upcoming.starts_at)} on ${places(upcoming.placements)}.` };
    return { label: 'Ended', tone: 'muted', detail: `Last ran until ${fmt(paid.map(o => o.ends_at).sort().slice(-1)[0])}.` };
  };
  const spent = orders.filter(o => o.status === 'paid').reduce((sum, o) => sum + o.amount_kobo, 0);

  return <main className="section"><BackButton /><div className="container myAdsPage">
    <div className="sectionHead"><div><h1>My ads</h1><p className="muted" style={{ margin: 0 }}>{ads.length ? `${ads.length} ad${ads.length === 1 ? '' : 's'} · ${formatNaira(spent)} spent in total` : 'Run your business in front of students and vendors on campus.'}</p></div><Link href="/advertise/book" className="btn green"><Plus size={17} /> Book an ad</Link></div>

    {!verified && <div className="error">Your account is not currently verified. Ads from unverified accounts are hidden until you are verified again. <Link href="/verification" className="textLink">Check verification</Link></div>}

    {!ads.length ? <div className="empty"><Megaphone size={28} /><b>No ads yet</b><p>Build an ad, pick the pages and days, and pay. It goes live automatically.</p><Link href="/advertise/book" className="btn green" style={{ marginTop: 8 }}>Book your first ad</Link></div> :
      ads.map(ad => {
        const state = stateOf(ad);
        const s = stats[ad.id] || { views: 0, clicks: 0 };
        const ctr = s.views ? `${((s.clicks / s.views) * 100).toFixed(1)}%` : '–';
        const history = orders.filter(o => o.ad_id === ad.id && o.status === 'paid');
        return <section className="panel myAd" key={ad.id}>
          <div className="myAdTop">
            <span className="adImageThumb big" style={ad.image_url ? { backgroundImage: `url("${ad.image_url}")` } : undefined}>{!ad.image_url && <Megaphone size={22} />}</span>
            <div className="myAdCopy">
              <div className="adRowTop"><b>{ad.title}</b><span className={`adState ${state.tone}`}>{state.label}</span></div>
              <div className="muted">{ad.advertiser}</div>
              <p className="myAdDetail">{state.detail}</p>
              <div className="adNumbers"><span><b>{s.views}</b> views</span><span><b>{s.clicks}</b> clicks</span><span><b>{ctr}</b> click rate</span></div>
            </div>
          </div>
          {ad.status !== 'removed' && <div className="actionsRow">
            <Link className="btn green" href={`/advertise/book?ad=${ad.id}`}>{history.length ? 'Renew or add pages' : 'Choose pages and pay'}</Link>
            <Link className="btn light" href={`/advertise/book?ad=${ad.id}`}>Edit ad</Link>
          </div>}
          {history.length > 0 && <details className="orderHistory"><summary>Payment history ({history.length})</summary>
            {history.map(o => <div className="orderRow" key={o.id}><span><b>{places(o.placements)}</b><small>{o.days} days · {fmt(o.starts_at)} to {fmt(o.ends_at)}</small></span><span><b>{formatNaira(o.amount_kobo)}</b><small>Paid {o.paid_at ? fmt(o.paid_at) : ''}{o.payment_reference ? ` · ${o.payment_reference}` : ''}</small></span></div>)}
          </details>}
        </section>;
      })}
  </div></main>;
}
