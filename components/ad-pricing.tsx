'use client';

import { useEffect, useState } from 'react';
import { Home as HomeIcon, ShoppingBag, Tag } from 'lucide-react';
import { createClient } from '../lib/supabase';
import { PLACEMENT_HINTS, PLACEMENT_KEYS, PLACEMENT_LABELS, formatNaira, type AdDiscountRow, type AdPriceRow, type AdSettings, type Placement } from '../lib/ad-pricing';

const ICONS: Record<Placement, typeof Tag> = { home: HomeIcon, marketplace: ShoppingBag, product: Tag };

/** The three ad spots with today's prices. Prices come from the admin settings, so they are always current. */
export default function AdPricing() {
  const [state, setState] = useState<{ settings: AdSettings | null; prices: AdPriceRow[]; discounts: AdDiscountRow[] } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const [s, p, d] = await Promise.all([
        supabase.from('ad_settings').select('bookings_open,min_days,max_days,max_advance_days').eq('id', 1).maybeSingle(),
        supabase.from('ad_prices').select('placement,price_per_day_kobo,max_concurrent,enabled'),
        supabase.from('ad_discounts').select('min_days,percent').order('min_days'),
      ]);
      if (alive) setState({ settings: s.error ? null : (s.data as AdSettings | null), prices: (p.data || []) as AdPriceRow[], discounts: (d.data || []) as AdDiscountRow[] });
    })();
    return () => { alive = false; };
  }, []);

  const open = Boolean(state?.settings?.bookings_open);
  return <>
    <div className="advertiseGrid">
      {PLACEMENT_KEYS.map(placement => {
        const Icon = ICONS[placement];
        const row = state?.prices.find(r => r.placement === placement);
        const priced = Boolean(open && row && row.enabled && row.price_per_day_kobo > 0);
        return <div className="panel advertiseCard" key={placement}>
          <span className="advertiseIcon"><Icon size={22} aria-hidden="true" /></span>
          <h3>{PLACEMENT_LABELS[placement]}</h3>
          <p className="muted">{PLACEMENT_HINTS[placement]}.</p>
          <p className="advertisePrice">{!state ? '\u00A0' : priced ? <><b>{formatNaira(row!.price_per_day_kobo)}</b> per day</> : <span className="muted">Pricing coming soon</span>}</p>
        </div>;
      })}
    </div>
    {state?.settings && open && <p className="muted advertiseNote">Book for {state.settings.min_days} to {state.settings.max_days} days at a time.{state.discounts.length > 0 && ` Longer bookings cost less: ${state.discounts.map(d => `${d.min_days}+ days get ${d.percent}% off`).join(', ')}.`}</p>}
  </>;
}
