'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BadgeCheck, ImagePlus, Lock, Megaphone, X } from 'lucide-react';
import { BackButton } from '../../../components/back-button';
import { AdCard } from '../../../components/ad-slot';
import { useToast } from '../../../components/toast';
import { createClient } from '../../../lib/supabase';
import { compressImage } from '../../../lib/image-compress';
import {
  PLACEMENT_HINTS, PLACEMENT_KEYS, PLACEMENT_LABELS, bookingProblem, bookingWindow, contentProblem, formatNaira, lagosToday, quote,
  type AdDiscountRow, type AdPriceRow, type AdSettings, type Placement,
} from '../../../lib/ad-pricing';

type Availability = Partial<Record<Placement, { used: number; capacity: number }>>;
type Form = { advertiser: string; title: string; body: string; link_url: string; cta_label: string; placements: Placement[]; days: number; startDate: string; agree: boolean };

const fmtDate = (d: Date) => d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

export default function BookAd() {
  return <Suspense fallback={<main className="section"><div className="container"><div className="skeleton skeletonBlock" style={{ height: 320 }} /></div></main>}><BookAdInner /></Suspense>;
}

function BookAdInner() {
  const toast = useToast();
  const params = useSearchParams();
  const editingId = params.get('ad') || '';

  const [loading, setLoading] = useState(true);
  const [setupMissing, setSetupMissing] = useState(false);
  const [verified, setVerified] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [settings, setSettings] = useState<AdSettings | null>(null);
  const [prices, setPrices] = useState<AdPriceRow[]>([]);
  const [discounts, setDiscounts] = useState<AdDiscountRow[]>([]);
  const [availability, setAvailability] = useState<Availability>({});
  const [adId, setAdId] = useState(editingId);
  const [existingImage, setExistingImage] = useState('');
  const [removeImage, setRemoveImage] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState('');
  const [busy, setBusy] = useState<'' | 'save' | 'pay'>('');
  const [form, setForm] = useState<Form>({ advertiser: '', title: '', body: '', link_url: 'https://', cta_label: 'Learn more', placements: [], days: 7, startDate: lagosToday(), agree: false });
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(current => ({ ...current, [key]: value }));

  // Load who you are, whether you are verified, the prices and (when renewing) the existing ad.
  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const [{ data: verification }, settingsRes, pricesRes, discountsRes, { data: profile }] = await Promise.all([
        supabase.from('student_verifications').select('id').eq('user_id', user.id).eq('status', 'approved').in('payment_status', ['paid', 'waived']).limit(1),
        supabase.from('ad_settings').select('bookings_open,min_days,max_days,max_advance_days').eq('id', 1).maybeSingle(),
        supabase.from('ad_prices').select('placement,price_per_day_kobo,max_concurrent,enabled'),
        supabase.from('ad_discounts').select('min_days,percent').order('min_days'),
        supabase.from('profiles').select('full_name,role').eq('id', user.id).maybeSingle(),
      ]);
      if (!alive) return;
      setVerified(Boolean(verification && verification.length));
      setIsAdmin(profile?.role === 'admin');
      if (settingsRes.error || pricesRes.error) setSetupMissing(true);
      const s = (settingsRes.data as AdSettings | null) || null;
      setSettings(s);
      setPrices((pricesRes.data || []) as AdPriceRow[]);
      setDiscounts((discountsRes.data || []) as AdDiscountRow[]);
      let next: Partial<Form> = { advertiser: profile?.full_name || '' };
      if (s) next.days = Math.max(s.min_days, Math.min(7, s.max_days));
      if (editingId) {
        const { data: ad } = await supabase.from('ads').select('*').eq('id', editingId).eq('owner_id', user.id).maybeSingle();
        if (ad && ad.status !== 'removed') {
          next = { ...next, advertiser: ad.advertiser, title: ad.title, body: ad.body || '', link_url: ad.link_url, cta_label: ad.cta_label };
          setExistingImage(ad.image_url || '');
          // Renewing: suggest starting when the current booking ends.
          const { data: orders } = await supabase.from('ad_orders').select('ends_at').eq('ad_id', ad.id).eq('status', 'paid').order('ends_at', { ascending: false }).limit(1);
          const last = orders?.[0]?.ends_at ? new Date(orders[0].ends_at) : null;
          if (last && last.getTime() > Date.now()) next.startDate = lagosToday(last);
        } else { setAdId(''); toast.error('That ad could not be found.'); }
      }
      setForm(current => ({ ...current, ...next }));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [editingId, toast]);

  // Local preview of a newly chosen image.
  useEffect(() => {
    if (!file) { setFilePreview(''); return; }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const window_ = useMemo(() => bookingWindow(form.startDate, form.days), [form.startDate, form.days]);
  const priced = useMemo(() => {
    if (!form.placements.length) return { quote: null, error: '' };
    try { return { quote: quote(prices, discounts, form.placements, form.days), error: '' }; }
    catch (error) { return { quote: null, error: (error as Error).message }; }
  }, [prices, discounts, form.placements, form.days]);

  // How full is each page on the chosen dates?
  const checkAvailability = useCallback(async () => {
    if (!verified || !settings) return;
    const { data } = await createClient().rpc('ad_availability', { p_placements: PLACEMENT_KEYS, p_start: window_.startsAt.toISOString(), p_end: window_.endsAt.toISOString() });
    const next: Availability = {};
    for (const row of (data || []) as Array<{ placement: Placement; used: number; capacity: number }>) next[row.placement] = { used: row.used, capacity: row.capacity };
    setAvailability(next);
  }, [verified, settings, window_]);
  useEffect(() => { const t = window.setTimeout(() => { void checkAvailability(); }, 250); return () => window.clearTimeout(t); }, [checkAvailability]);

  const imageShown = removeImage ? '' : (filePreview || existingImage);
  const maxDate = settings ? lagosToday(new Date(Date.now() + settings.max_advance_days * 86400000)) : undefined;
  const isFull = (p: Placement) => { const a = availability[p]; return Boolean(a && a.used >= a.capacity); };
  const sellable = (p: Placement) => { const row = prices.find(x => x.placement === p); return Boolean(row && row.enabled && row.price_per_day_kobo > 0); };
  const anySellable = PLACEMENT_KEYS.some(sellable);
  const quickDays = settings ? Array.from(new Set([settings.min_days, 7, 14, 30].filter(d => d >= settings.min_days && d <= settings.max_days))).sort((a, b) => a - b) : [];

  async function saveContent(): Promise<string | null> {
    const problem = contentProblem(form);
    if (problem) { toast.error(problem); return null; }
    const body = new FormData();
    if (adId) body.set('adId', adId);
    (['advertiser', 'title', 'body', 'link_url', 'cta_label'] as const).forEach(key => body.set(key, form[key]));
    if (removeImage) body.set('remove_image', '1');
    if (file) {
      try { body.set('image', await compressImage(file, 1000, 0.82)); } catch { body.set('image', file); }
    }
    const response = await fetch('/api/ads/save', { method: 'POST', body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { toast.error(result.error || 'Could not save your ad.'); return null; }
    setAdId(result.ad.id);
    setExistingImage(result.ad.image_url || '');
    setFile(null); setRemoveImage(false);
    return result.ad.id as string;
  }

  async function saveOnly() {
    setBusy('save');
    try { if (await saveContent()) toast.success('Your ad was updated.'); } finally { setBusy(''); }
  }

  async function pay() {
    if (!settings) return;
    const problem = bookingProblem(settings, form.days, window_.startsAt) || priced.error || (!form.placements.length ? 'Choose at least one place for your ad.' : '');
    if (problem) { toast.error(problem); return; }
    if (!form.agree) { toast.error('Please confirm the advertising rules to continue.'); return; }
    setBusy('pay');
    try {
      const id = await saveContent();
      if (!id) return;
      const response = await fetch('/api/ads/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adId: id, placements: form.placements, days: form.days, startDate: form.startDate }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.authorizationUrl) { toast.error(result.error || 'Could not start payment.'); return; }
      window.location.assign(result.authorizationUrl);
    } finally { setBusy(''); }
  }

  if (loading) return <main className="section"><BackButton /><div className="container"><div className="skeleton skeletonBlock" style={{ height: 360 }} /></div></main>;

  const gate = (icon: React.ReactNode, title: string, text: string, action?: React.ReactNode) => <main className="section"><BackButton /><div className="container"><div className="panel gatePanel"><span className="advertiseIcon">{icon}</span><h1>{title}</h1><p className="muted">{text}</p>{action}</div></div></main>;
  if (setupMissing) return gate(<Megaphone size={22} />, 'Ad booking is not set up yet', isAdmin ? 'Admin: the paid-ads database update has not been run. Open supabase/cartomux-database-update.sql, paste it into the Supabase SQL Editor, run it once, then reload this page.' : 'Ad booking is being set up. Please check back soon.');
  if (!verified) return gate(<BadgeCheck size={22} />, 'Only verified accounts can advertise', 'Verifying your account tells people a real person or business is behind the ad. Once your verification is approved, you can come back here and book your ad.', <Link href="/verification" className="btn green">Get verified</Link>);
  if (!settings?.bookings_open || !anySellable) return gate(<Megaphone size={22} />, 'Ad booking opens soon', isAdmin ? 'Admin: set a price for at least one page and turn on "Bookings are open" in Admin > Ad prices and bookings, then save.' : 'Prices are not published yet. Check back shortly, or message us about a custom ad.', isAdmin ? <Link href="/admin" className="btn green">Open admin</Link> : <Link href="/advertise" className="btn light">Back to advertising</Link>);

  const q = priced.quote;
  const problem = settings ? bookingProblem(settings, form.days, window_.startsAt) : '';
  const canPay = Boolean(q) && !problem && form.agree && !form.placements.some(isFull) && busy === '';

  return <main className="section bookPage"><BackButton /><div className="container">
    <div className="sectionHead"><div><h1>{adId ? 'Book or update your ad' : 'Book an ad'}</h1><p className="muted" style={{ margin: 0 }}>Build your ad, pick where and how long, and pay. It goes live automatically once payment is confirmed.</p></div><Link href="/advertise/my-ads" className="btn light">My ads</Link></div>

    <div className="bookLayout">
      <div className="bookForm">
        <section className="panel">
          <h2>1. Your ad</h2>
          <div className="split">
            <div className="field"><label htmlFor="b-adv">Business name</label><input id="b-adv" maxLength={80} value={form.advertiser} onChange={e => set('advertiser', e.target.value)} placeholder="e.g. Campus Print Hub" /></div>
            <div className="field"><label htmlFor="b-title">Headline</label><input id="b-title" maxLength={80} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Printing from ₦20 a page" /></div>
          </div>
          <div className="field"><label htmlFor="b-body">Description (optional)</label><textarea id="b-body" rows={2} maxLength={200} value={form.body} onChange={e => set('body', e.target.value)} placeholder="One short line about your offer." /><small>{form.body.length}/200</small></div>
          <div className="split">
            <div className="field"><label htmlFor="b-link">Link (https only)</label><input id="b-link" inputMode="url" value={form.link_url} onChange={e => set('link_url', e.target.value)} /></div>
            <div className="field"><label htmlFor="b-cta">Button text</label><input id="b-cta" maxLength={24} value={form.cta_label} onChange={e => set('cta_label', e.target.value)} /></div>
          </div>
          <div className="field">
            <label htmlFor="b-img">Image (optional, JPG, PNG or WebP)</label>
            <div className="adImagePick">
              {imageShown ? <span className="adImageThumb" style={{ backgroundImage: `url("${imageShown}")` }} /> : <span className="adImageThumb blank"><ImagePlus size={22} /></span>}
              <input id="b-img" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { setFile(e.target.files?.[0] || null); setRemoveImage(false); }} />
              {imageShown && <button type="button" className="btn light" onClick={() => { setFile(null); setRemoveImage(true); }}><X size={15} /> Remove</button>}
            </div>
            <small>Square images work best. Large images are resized for you.</small>
          </div>
          <div className="adPreview"><span className="muted">Preview</span><AdCard preview variant="row" ad={{ title: form.title, body: form.body, advertiser: form.advertiser, image_url: imageShown || null, link_url: form.link_url, cta_label: form.cta_label }} /></div>
        </section>

        <section className="panel">
          <h2>2. Where it appears</h2>
          <div className="placementChoices">
            {PLACEMENT_KEYS.map(p => {
              const row = prices.find(x => x.placement === p);
              const unavailable = !sellable(p);
              const full = !unavailable && isFull(p);
              const on = form.placements.includes(p);
              return <label key={p} className={`placementChoice ${on ? 'on' : ''} ${unavailable || full ? 'off' : ''}`}>
                <input type="checkbox" checked={on} disabled={unavailable || full} onChange={() => set('placements', on ? form.placements.filter(x => x !== p) : [...form.placements, p])} />
                <span><b>{PLACEMENT_LABELS[p]}</b><small>{PLACEMENT_HINTS[p]}</small><em>{unavailable ? 'Not available yet' : full ? 'Fully booked for these dates' : `${formatNaira(row!.price_per_day_kobo)} per day`}</em></span>
              </label>;
            })}
          </div>
        </section>

        <section className="panel">
          <h2>3. How long</h2>
          <div className="split">
            <div className="field">
              <label htmlFor="b-days">Number of days</label>
              <input id="b-days" type="number" min={settings!.min_days} max={settings!.max_days} value={form.days} onChange={e => set('days', Math.round(Number(e.target.value)) || 0)} />
              <div className="dayChips">{quickDays.map(d => <button type="button" key={d} className={`chip ${form.days === d ? 'active' : ''}`} onClick={() => set('days', d)}>{d} days</button>)}</div>
              <small>Between {settings!.min_days} and {settings!.max_days} days.{discounts.length > 0 && ` ${discounts.map(d => `${d.min_days}+ days: ${d.percent}% off`).join(' · ')}`}</small>
            </div>
            <div className="field"><label htmlFor="b-start">Start date</label><input id="b-start" type="date" min={lagosToday()} max={maxDate} value={form.startDate} onChange={e => set('startDate', e.target.value)} /><small>Starting today begins as soon as payment is confirmed.</small></div>
          </div>
        </section>
      </div>

      <aside className="panel bookSummary">
        <h2>Summary</h2>
        {q ? <>
          {q.lines.map(line => <div className="sumRow" key={line.placement}><span>{PLACEMENT_LABELS[line.placement]}<small>{formatNaira(line.perDayKobo)} × {line.days} days</small></span><b>{formatNaira(line.totalKobo)}</b></div>)}
          {q.discountPercent > 0 && <div className="sumRow discount"><span>{q.discountPercent}% longer-booking discount</span><b>−{formatNaira(q.discountKobo)}</b></div>}
          <div className="sumTotal"><span>Total</span><b>{formatNaira(q.totalKobo)}</b></div>
          {!problem && <p className="muted sumRuns">Runs {fmtDate(window_.startsAt)} to {fmtDate(window_.endsAt)}</p>}
        </> : <p className="muted">{priced.error || 'Choose where your ad should appear to see the price.'}</p>}
        {problem && <div className="error">{problem}</div>}
        <label className="agreeRow"><input type="checkbox" checked={form.agree} onChange={e => set('agree', e.target.checked)} /><span>I confirm my ad follows the <Link href="/advertise#rules" target="_blank" className="textLink">advertising rules</Link>, and that CARTOMUX can remove ads that break them.</span></label>
        <button type="button" className="btn green full" disabled={!canPay} onClick={pay}><Lock size={16} /> {busy === 'pay' ? 'Please wait…' : q ? `Pay ${formatNaira(q.totalKobo)}` : 'Pay'}</button>
        {adId && <button type="button" className="btn light full" disabled={busy !== ''} onClick={saveOnly} style={{ marginTop: 10 }}>{busy === 'save' ? 'Saving…' : 'Save changes without booking'}</button>}
        <p className="muted sumNote">Payments are processed by Paystack. Your ad goes live automatically as soon as payment is confirmed. The price is always checked again on our servers.</p>
      </aside>
    </div>
  </div></main>;
}
