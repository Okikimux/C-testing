'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { friendlyError } from '../lib/friendly-error';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { createClient } from '../lib/supabase';
import { PLACEMENT_KEYS, PLACEMENT_LABELS, formatNaira, type AdDiscountRow, type AdPriceRow, type AdSettings, type Placement } from '../lib/ad-pricing';
import { useToast } from './toast';

type PriceForm = Record<Placement, { naira: string; max_concurrent: string; enabled: boolean }>;
type OrderRow = { id: string; placements: Placement[]; days: number; starts_at: string; ends_at: string; amount_kobo: number; status: string; paid_at: string | null; created_at: string; payment_reference: string | null; ads: { title: string; advertiser: string } | null; profiles: { full_name: string | null } | null };

const blankPrices = (): PriceForm => ({ home: { naira: '0', max_concurrent: '5', enabled: false }, marketplace: { naira: '0', max_concurrent: '5', enabled: false }, product: { naira: '0', max_concurrent: '5', enabled: false } });

export default function AdminAdPricing() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState('');
  const [open, setOpen] = useState(false);
  const [limits, setLimits] = useState({ min_days: '3', max_days: '30', max_advance_days: '60' });
  const [prices, setPrices] = useState<PriceForm>(blankPrices());
  const [discounts, setDiscounts] = useState<Array<{ min_days: string; percent: string }>>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [settingsRes, pricesRes, discountsRes, ordersRes] = await Promise.all([
      supabase.from('ad_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('ad_prices').select('*'),
      supabase.from('ad_discounts').select('*').order('min_days'),
      supabase.from('ad_orders').select('id,placements,days,starts_at,ends_at,amount_kobo,status,paid_at,created_at,payment_reference,ads(title,advertiser),profiles(full_name)').order('created_at', { ascending: false }).limit(50),
    ]);
    if (settingsRes.error || pricesRes.error) { console.warn('CARTOMUX ad pricing load failed:', (settingsRes.error || pricesRes.error)!.message); setSetupError('missing'); setLoading(false); return; }
    setSetupError('');
    const s = settingsRes.data as AdSettings | null;
    if (s) { setOpen(s.bookings_open); setLimits({ min_days: String(s.min_days), max_days: String(s.max_days), max_advance_days: String(s.max_advance_days) }); }
    const next = blankPrices();
    for (const row of (pricesRes.data || []) as AdPriceRow[]) next[row.placement] = { naira: String(row.price_per_day_kobo / 100), max_concurrent: String(row.max_concurrent), enabled: row.enabled };
    setPrices(next);
    setDiscounts(((discountsRes.data || []) as AdDiscountRow[]).map(d => ({ min_days: String(d.min_days), percent: String(d.percent) })));
    setOrders((ordersRes.data || []) as unknown as OrderRow[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const revenue = useMemo(() => orders.filter(o => o.status === 'paid').reduce((sum, o) => sum + o.amount_kobo, 0), [orders]);
  const paidCount = orders.filter(o => o.status === 'paid').length;

  async function save() {
    const min = Number(limits.min_days), max = Number(limits.max_days), adv = Number(limits.max_advance_days);
    if (!Number.isInteger(min) || min < 1) { toast.error('Minimum days must be 1 or more.'); return; }
    if (!Number.isInteger(max) || max < min) { toast.error('Maximum days must be at least the minimum.'); return; }
    if (!Number.isInteger(adv) || adv < 0) { toast.error('Days ahead must be 0 or more.'); return; }
    const priceRows: AdPriceRow[] = [];
    for (const p of PLACEMENT_KEYS) {
      const naira = Number(prices[p].naira), cap = Number(prices[p].max_concurrent);
      if (!Number.isFinite(naira) || naira < 0) { toast.error(`${PLACEMENT_LABELS[p]}: enter a price of 0 or more.`); return; }
      if (!Number.isInteger(cap) || cap < 1) { toast.error(`${PLACEMENT_LABELS[p]}: capacity must be 1 or more.`); return; }
      if (prices[p].enabled && naira <= 0) { toast.error(`${PLACEMENT_LABELS[p]}: set a price above 0 before enabling it.`); return; }
      priceRows.push({ placement: p, price_per_day_kobo: Math.round(naira * 100), max_concurrent: cap, enabled: prices[p].enabled });
    }
    const discountRows: AdDiscountRow[] = [];
    for (const d of discounts) {
      const m = Number(d.min_days), pct = Number(d.percent);
      if (!d.min_days && !d.percent) continue;
      if (!Number.isInteger(m) || m < 2 || !Number.isInteger(pct) || pct < 1 || pct > 90) { toast.error('Each discount needs 2 or more days and a percent from 1 to 90.'); return; }
      discountRows.push({ min_days: m, percent: pct });
    }
    if (new Set(discountRows.map(d => d.min_days)).size !== discountRows.length) { toast.error('Two discounts use the same number of days.'); return; }
    if (open && !priceRows.some(r => r.enabled && r.price_per_day_kobo > 0)) { toast.error('Enable at least one page with a price before opening bookings.'); return; }

    setSaving(true);
    try {
      const supabase = createClient();
      const a = await supabase.from('ad_settings').upsert({ id: 1, bookings_open: open, min_days: min, max_days: max, max_advance_days: adv });
      if (a.error) { toast.error(friendlyError(a.error)); return; }
      const b = await supabase.from('ad_prices').upsert(priceRows);
      if (b.error) { toast.error(friendlyError(b.error)); return; }
      const old = await supabase.from('ad_discounts').select('min_days');
      const keep = new Set(discountRows.map(d => d.min_days));
      const remove = ((old.data || []) as Array<{ min_days: number }>).map(r => r.min_days).filter(m => !keep.has(m));
      if (remove.length) { const del = await supabase.from('ad_discounts').delete().in('min_days', remove); if (del.error) { toast.error(friendlyError(del.error)); return; } }
      if (discountRows.length) { const c = await supabase.from('ad_discounts').upsert(discountRows); if (c.error) { toast.error(friendlyError(c.error)); return; } }
      toast.success('Ad prices and rules saved.');
      await load();
    } finally { setSaving(false); }
  }

  const setPrice = (p: Placement, patch: Partial<PriceForm[Placement]>) => setPrices(cur => ({ ...cur, [p]: { ...cur[p], ...patch } }));

  return <section className="panel adminQueue adminAds adminPricing">
    <div className="sectionHead"><div><h2>Ad prices and bookings</h2><p className="muted" style={{ margin: 0 }}>Verified advertisers book and pay here. Ads run automatically for the days paid. {paidCount > 0 && `${paidCount} paid booking${paidCount === 1 ? '' : 's'}, ${formatNaira(revenue)} in the latest 50 orders.`}</p></div></div>
    {setupError ? <div className="notice adsSetup"><Wallet size={18} /><span>Paid ads are not set up in the database yet. Run <b>supabase/cartomux-paid-ads.sql</b> in the Supabase SQL Editor, then reload.</span></div> : loading ? <p className="muted" style={{ padding: '0 24px 24px' }}>Loading…</p> : <>
      <div className="adForm">
        <label className="agreeRow bookingsSwitch"><input type="checkbox" checked={open} onChange={e => setOpen(e.target.checked)} /><span><b>Bookings are {open ? 'open' : 'closed'}</b><small>When closed, nobody can buy ads, but paid ads already running keep running.</small></span></label>
        <h3>Price per day, by page</h3>
        <div className="priceGrid">
          {PLACEMENT_KEYS.map(p => <div className="priceCard" key={p}>
            <b>{PLACEMENT_LABELS[p]}</b>
            <div className="field"><label htmlFor={`pp-${p}`}>Price per day (₦)</label><input id={`pp-${p}`} type="number" min="0" step="1" inputMode="decimal" value={prices[p].naira} onChange={e => setPrice(p, { naira: e.target.value })} /></div>
            <div className="field"><label htmlFor={`pc-${p}`}>Most ads at once</label><input id={`pc-${p}`} type="number" min="1" value={prices[p].max_concurrent} onChange={e => setPrice(p, { max_concurrent: e.target.value })} /></div>
            <label className="agreeRow"><input type="checkbox" checked={prices[p].enabled} onChange={e => setPrice(p, { enabled: e.target.checked })} /><span>Available to book</span></label>
          </div>)}
        </div>
        <div className="split three">
          <div className="field"><label htmlFor="al-min">Minimum days</label><input id="al-min" type="number" min="1" value={limits.min_days} onChange={e => setLimits({ ...limits, min_days: e.target.value })} /></div>
          <div className="field"><label htmlFor="al-max">Maximum days per booking</label><input id="al-max" type="number" min="1" value={limits.max_days} onChange={e => setLimits({ ...limits, max_days: e.target.value })} /></div>
          <div className="field"><label htmlFor="al-adv">Book up to … days ahead</label><input id="al-adv" type="number" min="0" value={limits.max_advance_days} onChange={e => setLimits({ ...limits, max_advance_days: e.target.value })} /></div>
        </div>
        <h3>Longer-booking discounts</h3>
        <p className="muted">The biggest discount whose number of days the booking reaches is applied to the whole booking.</p>
        {discounts.map((d, i) => <div className="discountRow" key={i}>
          <div className="field"><label htmlFor={`dm-${i}`}>From (days)</label><input id={`dm-${i}`} type="number" min="2" value={d.min_days} onChange={e => setDiscounts(cur => cur.map((x, j) => j === i ? { ...x, min_days: e.target.value } : x))} /></div>
          <div className="field"><label htmlFor={`dp-${i}`}>Discount (%)</label><input id={`dp-${i}`} type="number" min="1" max="90" value={d.percent} onChange={e => setDiscounts(cur => cur.map((x, j) => j === i ? { ...x, percent: e.target.value } : x))} /></div>
          <button type="button" className="btn light" aria-label="Remove discount" onClick={() => setDiscounts(cur => cur.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
        </div>)}
        <div className="actionsRow">
          <button type="button" className="btn light" onClick={() => setDiscounts(cur => [...cur, { min_days: '', percent: '' }])}><Plus size={15} /> Add discount</button>
          <button type="button" className="btn green" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save prices and rules'}</button>
        </div>
      </div>

      <div className="adList">
        <h3>Recent bookings</h3>
        {!orders.length ? <p className="muted">No bookings yet.</p> : orders.map(o => <div className="orderRow adminOrder" key={o.id}>
          <span><b>{o.ads?.title || 'Deleted ad'}</b><small>{o.profiles?.full_name || 'Advertiser'} · {o.placements.map(p => PLACEMENT_LABELS[p]).join(', ')} · {o.days} days</small><small>{new Date(o.starts_at).toLocaleDateString()} to {new Date(o.ends_at).toLocaleDateString()}{o.payment_reference ? ` · ${o.payment_reference}` : ''}</small></span>
          <span><b>{formatNaira(o.amount_kobo)}</b><small className={`orderStatus ${o.status}`}>{o.status}</small></span>
        </div>)}
      </div>
    </>}
  </section>;
}
