// Server-only helpers for the paid-ads API routes.
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

type AdminClient = SupabaseClient<any>;

type Context =
  | { ok: true; user: { id: string; email: string | null }; admin: AdminClient; secret: string }
  | { ok: false; response: NextResponse };

/** Signed-in user + a service-role client + the Paystack key, or a ready-made error response. */
export async function getAdsContext(): Promise<Context> {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!secret || !serviceKey || !supabaseUrl || !publishableKey) {
    return { ok: false, response: NextResponse.json({ error: 'Ad booking is not configured yet. Please contact CARTOMUX support.' }, { status: 503 }) };
  }
  const cookieStore = await cookies();
  const authClient = createServerClient(supabaseUrl, publishableKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: (values) => values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: 'Sign in required.' }, { status: 401 }) };
  const admin: AdminClient = createSupabaseClient<any>(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { ok: true, user: { id: user.id, email: user.email ?? null }, admin, secret };
}

/** Verified = approved verification with the fee paid or waived (same rule the database uses). */
export async function isVerifiedAdvertiser(admin: AdminClient, userId: string) {
  const { data, error } = await admin.from('student_verifications').select('id').eq('user_id', userId).eq('status', 'approved').in('payment_status', ['paid', 'waived']).limit(1);
  if (error) return false;
  return Boolean(data && data.length);
}

export const notVerifiedResponse = () => NextResponse.json({ error: 'Only verified accounts can advertise. Verify your account first.' }, { status: 403 });
