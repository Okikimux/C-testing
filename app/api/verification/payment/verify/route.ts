import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!secret || !serviceKey || !supabaseUrl || !publishableKey) return NextResponse.json({ error: 'Secure verification payments are not configured yet.' }, { status: 503 });
  const cookieStore = await cookies();
  const authClient = createServerClient(supabaseUrl, publishableKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: (values) => values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  let reference = '';
  try { reference = String((await request.json()).reference || '').trim(); } catch { /* handled below */ }
  if (!reference) return NextResponse.json({ error: 'Payment reference is required.' }, { status: 400 });
  const admin = createSupabaseClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verification, error: lookupError } = await admin.from('student_verifications').select('id,user_id,status,payment_status,payment_amount_kobo,payment_reference').eq('user_id', user.id).eq('payment_reference', reference).maybeSingle();
  if (lookupError || !verification) return NextResponse.json({ error: 'This payment reference does not belong to your account.' }, { status: 404 });
  if (verification.status === 'approved' && verification.payment_status === 'paid') return NextResponse.json({ verified: true, message: 'Payment was already confirmed.' });
  if (verification.status !== 'awaiting_payment' || verification.payment_status !== 'pending' || !verification.payment_amount_kobo) return NextResponse.json({ error: 'This application is not awaiting this payment.' }, { status: 400 });

  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` }, cache: 'no-store' });
  const result = await response.json().catch(() => null);
  const transaction = result?.data;
  if (!response.ok || !result?.status || transaction?.status !== 'success') return NextResponse.json({ error: 'Payment has not been confirmed as successful yet.' }, { status: 400 });
  if (Number(transaction.amount) !== Number(verification.payment_amount_kobo) || transaction.currency !== 'NGN' || transaction.metadata?.user_id !== user.id || transaction.metadata?.verification_id !== verification.id || transaction.metadata?.purpose !== 'campora_verification') {
    return NextResponse.json({ error: 'Payment details do not match this verification application. Contact CARTOMUX support.' }, { status: 400 });
  }
  const { error: updateError } = await admin.from('student_verifications').update({ status: 'approved', payment_status: 'paid', payment_reference: reference, application_stage: 2, verified_at: new Date().toISOString() }).eq('id', verification.id).eq('user_id', user.id).eq('payment_reference', reference);
  if (updateError) return NextResponse.json({ error: 'Payment was confirmed, but verification could not be updated. Contact CARTOMUX support with your payment reference.' }, { status: 500 });
  const couponCode = transaction.metadata?.coupon_code;
  if (couponCode) {
    const { error: couponError } = await admin.from('verification_coupons').update({ redeemed_at: new Date().toISOString(), payment_reference: reference }).eq('coupon_code', couponCode).eq('user_id', user.id).eq('verification_id', verification.id).is('redeemed_at', null).is('disabled_at', null);
    if (couponError) return NextResponse.json({ verified: true, message: 'Payment was confirmed and verification is complete. Coupon bookkeeping needs administrator review.' });
  }
  return NextResponse.json({ verified: true, message: 'Payment confirmed. Your CARTOMUX verification is complete.' });
}
