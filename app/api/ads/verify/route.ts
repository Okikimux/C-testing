import { NextResponse } from 'next/server';
import { getAdsContext } from '../../../../lib/ads-server';

export const runtime = 'nodejs';

/** Confirms an ad payment with Paystack and switches the ad on. Safe to call more than once. */
export async function POST(request: Request) {
  const ctx = await getAdsContext();
  if (!ctx.ok) return ctx.response;
  const { user, admin, secret } = ctx;

  let reference = '';
  try { reference = String((await request.json()).reference || '').trim(); } catch { /* handled below */ }
  if (!reference) return NextResponse.json({ error: 'Payment reference is required.' }, { status: 400 });

  const { data: order, error: lookupError } = await admin.from('ad_orders').select('*').eq('payment_reference', reference).eq('owner_id', user.id).maybeSingle();
  if (lookupError || !order) return NextResponse.json({ error: 'This payment reference does not belong to your account.' }, { status: 404 });
  if (order.status === 'paid') return NextResponse.json({ paid: true, startsAt: order.starts_at, endsAt: order.ends_at, message: 'Payment was already confirmed.' });
  if (order.status !== 'pending') return NextResponse.json({ error: 'This booking is not waiting for a payment.' }, { status: 400 });

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' });
  const result = await response.json().catch(() => null);
  const transaction = result?.data;
  if (!response.ok || !result?.status || transaction?.status !== 'success') return NextResponse.json({ error: 'Payment has not been confirmed as successful yet.' }, { status: 400 });
  if (Number(transaction.amount) !== Number(order.amount_kobo) || transaction.currency !== 'NGN' || transaction.metadata?.user_id !== user.id || transaction.metadata?.order_id !== order.id || transaction.metadata?.purpose !== 'cartomux_ad') {
    return NextResponse.json({ error: 'Payment details do not match this booking. Contact CARTOMUX support.' }, { status: 400 });
  }

  // Only the first caller flips pending -> paid, so a double call cannot double-apply.
  const { data: updated, error: payError } = await admin.from('ad_orders').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', order.id).eq('status', 'pending').select('id');
  if (payError) return NextResponse.json({ error: 'Payment was confirmed, but your booking could not be updated. Contact CARTOMUX support with your payment reference.' }, { status: 500 });
  if (!updated || !updated.length) return NextResponse.json({ paid: true, startsAt: order.starts_at, endsAt: order.ends_at, message: 'Payment was already confirmed.' });

  // The ad runs automatically for the paid days. Keep the ad's own summary dates in step (admin view).
  const { data: paidOrders } = await admin.from('ad_orders').select('placements,starts_at,ends_at').eq('ad_id', order.ad_id).eq('status', 'paid');
  const rows = paidOrders && paidOrders.length ? paidOrders : [order];
  const placements = Array.from(new Set(rows.flatMap((row: { placements: string[] }) => row.placements)));
  const startsAt = rows.map((row: { starts_at: string }) => row.starts_at).sort()[0];
  const endsAt = rows.map((row: { ends_at: string }) => row.ends_at).sort().slice(-1)[0];
  const { error: adError } = await admin.from('ads').update({ status: 'active', placements, starts_at: startsAt, ends_at: endsAt }).eq('id', order.ad_id).eq('owner_id', user.id).neq('status', 'removed');
  if (adError) return NextResponse.json({ error: 'Payment was confirmed, but your ad could not be switched on. Contact CARTOMUX support with your payment reference.' }, { status: 500 });

  // Best-effort in-app confirmation.
  await admin.from('notifications').insert({ user_id: user.id, type: 'system', title: 'Your ad is booked', body: `Payment received. Your ad runs from ${new Date(order.starts_at).toLocaleDateString('en-NG')} to ${new Date(order.ends_at).toLocaleDateString('en-NG')}.` });

  return NextResponse.json({ paid: true, startsAt: order.starts_at, endsAt: order.ends_at, message: 'Payment confirmed. Your ad is booked.' });
}
