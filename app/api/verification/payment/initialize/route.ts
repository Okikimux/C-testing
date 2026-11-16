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
  if (!secret || !serviceKey || !supabaseUrl || !publishableKey) {
    return NextResponse.json({ error: 'Secure verification payments are not configured yet. Please contact CARTOMUX support.' }, { status: 503 });
  }
  const cookieStore = await cookies();
  const authClient = createServerClient(supabaseUrl, publishableKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: (values) => values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  let body: { couponCode?: string } = {};
  try { body = await request.json(); } catch { /* optional body */ }

  const admin = createSupabaseClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: verification, error: verificationError } = await admin.from('student_verifications').select('id,verification_type,status,payment_status').eq('user_id', user.id).eq('status', 'awaiting_payment').maybeSingle();
  if (verificationError) return NextResponse.json({ error: 'Could not load your approved application.' }, { status: 500 });
  if (!verification) return NextResponse.json({ error: 'A Stage 1-approved application awaiting payment is required.' }, { status: 400 });

  const baseNaira = verification.verification_type === 'student' ? 1500 : 2000;
  let amountNaira = baseNaira;
  let couponCode: string | null = null;
  if (body.couponCode) {
    couponCode = body.couponCode.trim().toUpperCase();
    const { data: coupon, error: couponError } = await admin.from('verification_coupons').select('id,discount_percent,expires_at,disabled_at,redeemed_at,reserved_at,user_id,verification_id').eq('coupon_code', couponCode).maybeSingle();
    if (couponError || !coupon || coupon.user_id !== user.id || coupon.verification_id !== verification.id || coupon.discount_percent !== 50 || !coupon.reserved_at || coupon.disabled_at || coupon.redeemed_at || new Date(coupon.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'The 50% coupon is invalid, expired, not reserved, or already used.' }, { status: 400 });
    }
    amountNaira = Math.ceil(baseNaira / 2);
  }
  const email = user.email;
  if (!email) return NextResponse.json({ error: 'Your account needs a valid email address for payment.' }, { status: 400 });
  const amountKobo = amountNaira * 100;
  const origin = new URL(request.url).origin;
  const callbackUrl = `${origin}/verification?payment=return`;
  const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, amount: amountKobo, currency: 'NGN', callback_url: callbackUrl, metadata: { user_id: user.id, verification_id: verification.id, coupon_code: couponCode, purpose: 'campora_verification' } }),
    cache: 'no-store',
  });
  const paystack = await paystackResponse.json().catch(() => null);
  if (!paystackResponse.ok || !paystack?.status || !paystack?.data?.reference || !paystack?.data?.authorization_url) {
    return NextResponse.json({ error: paystack?.message || 'Could not start payment. Please try again.' }, { status: 502 });
  }
  const { error: updateError } = await admin.from('student_verifications').update({ payment_status: 'pending', payment_amount_kobo: amountKobo, payment_reference: paystack.data.reference }).eq('id', verification.id).eq('user_id', user.id);
  if (updateError) return NextResponse.json({ error: 'Payment was initialised but could not be linked to your application. Contact support before retrying.' }, { status: 500 });
  if (couponCode) await admin.from('verification_coupons').update({ payment_reference: paystack.data.reference }).eq('coupon_code', couponCode).eq('user_id', user.id);
  return NextResponse.json({ authorizationUrl: paystack.data.authorization_url, reference: paystack.data.reference, amountNaira });
}
