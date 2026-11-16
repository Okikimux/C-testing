import { NextResponse } from 'next/server';
import { getAdsContext, isVerifiedAdvertiser, notVerifiedResponse } from '../../../../lib/ads-server';
import { PLACEMENT_LABELS, bookingProblem, bookingWindow, isPlacement, quote, type AdDiscountRow, type AdPriceRow, type AdSettings, type Placement } from '../../../../lib/ad-pricing';

export const runtime = 'nodejs';

/**
 * Starts a Paystack payment for an ad booking. The price, the dates and the capacity are all
 * decided here on the server. Nothing the browser sends can lower the price.
 */
export async function POST(request: Request) {
  const ctx = await getAdsContext();
  if (!ctx.ok) return ctx.response;
  const { user, admin, secret } = ctx;
  if (!(await isVerifiedAdvertiser(admin, user.id))) return notVerifiedResponse();
  if (!user.email) return NextResponse.json({ error: 'Your account needs a valid email address for payment.' }, { status: 400 });

  let body: { adId?: string; placements?: unknown; days?: unknown; startDate?: string } = {};
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  const days = Number(body.days);
  const placements = Array.isArray(body.placements) ? Array.from(new Set(body.placements.filter(isPlacement))) as Placement[] : [];

  const { data: ad, error: adError } = await admin.from('ads').select('id,owner_id,source,status,title').eq('id', String(body.adId || '')).maybeSingle();
  if (adError || !ad || ad.owner_id !== user.id || ad.source !== 'self') return NextResponse.json({ error: 'Ad not found.' }, { status: 404 });
  if (ad.status === 'removed') return NextResponse.json({ error: 'This ad was removed by CARTOMUX and cannot be booked.' }, { status: 403 });

  const [{ data: settings }, { data: prices }, { data: discounts }] = await Promise.all([
    admin.from('ad_settings').select('bookings_open,min_days,max_days,max_advance_days').eq('id', 1).maybeSingle(),
    admin.from('ad_prices').select('placement,price_per_day_kobo,max_concurrent,enabled'),
    admin.from('ad_discounts').select('min_days,percent'),
  ]);
  if (!settings || !prices) return NextResponse.json({ error: 'Ad prices are not set up yet. Please try again later.' }, { status: 503 });

  const now = new Date();
  const { startsAt, endsAt } = bookingWindow(body.startDate, days, now);
  const problem = bookingProblem(settings as AdSettings, days, startsAt, now);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  let priced;
  try { priced = quote(prices as AdPriceRow[], (discounts || []) as AdDiscountRow[], placements, days); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  if (priced.totalKobo <= 0) return NextResponse.json({ error: 'This booking has no price. Please contact support.' }, { status: 400 });

  // Capacity: stop selling a page once its limit of overlapping bookings is reached.
  const { data: availability, error: availabilityError } = await admin.rpc('ad_availability', { p_placements: placements, p_start: startsAt.toISOString(), p_end: endsAt.toISOString() });
  if (availabilityError) return NextResponse.json({ error: 'Could not check availability. Please try again.' }, { status: 500 });
  const full = ((availability || []) as Array<{ placement: Placement; used: number; capacity: number }>).filter(row => row.used >= row.capacity).map(row => PLACEMENT_LABELS[row.placement]);
  if (full.length) return NextResponse.json({ error: `${full.join(' and ')} ${full.length > 1 ? 'are' : 'is'} fully booked for those dates. Try other dates or another page.` }, { status: 409 });

  const { data: order, error: orderError } = await admin.from('ad_orders').insert({
    ad_id: ad.id, owner_id: user.id, placements, days,
    starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
    subtotal_kobo: priced.subtotalKobo, discount_percent: priced.discountPercent, amount_kobo: priced.totalKobo,
    price_snapshot: { lines: priced.lines, discountPercent: priced.discountPercent },
    status: 'pending',
  }).select('id').single();
  if (orderError || !order) return NextResponse.json({ error: 'Could not create your booking. Please try again.' }, { status: 500 });

  const origin = new URL(request.url).origin;
  const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, amount: priced.totalKobo, currency: 'NGN', callback_url: `${origin}/advertise/my-ads?payment=return`, metadata: { user_id: user.id, order_id: order.id, ad_id: ad.id, purpose: 'cartomux_ad' } }),
    cache: 'no-store',
  });
  const paystack = await paystackResponse.json().catch(() => null);
  if (!paystackResponse.ok || !paystack?.status || !paystack?.data?.reference || !paystack?.data?.authorization_url) {
    await admin.from('ad_orders').update({ status: 'failed' }).eq('id', order.id);
    return NextResponse.json({ error: paystack?.message || 'Could not start payment. Please try again.' }, { status: 502 });
  }
  const { error: linkError } = await admin.from('ad_orders').update({ payment_reference: paystack.data.reference }).eq('id', order.id);
  if (linkError) return NextResponse.json({ error: 'Payment was started but could not be linked to your booking. Contact support before paying.' }, { status: 500 });

  return NextResponse.json({ authorizationUrl: paystack.data.authorization_url, reference: paystack.data.reference, amountKobo: priced.totalKobo, orderId: order.id });
}
