// A user is "verified" only when the application is approved AND the verification payment has been
// confirmed (or a 100% waiver was redeemed). Stage 1 approval alone ("awaiting payment") never counts.
export const VERIFIED_PAYMENT_STATUSES = ['paid', 'waived'];

// Looks up which of the given user IDs are fully verified.
// Follows the existing RLS policy ("Approved verifications are publicly visible", signed-in users).
export async function fetchVerifiedIds(supabase: any, ids: Array<string | null | undefined>): Promise<Set<string>> {
  const unique = Array.from(new Set(ids.filter(Boolean))) as string[];
  if (!unique.length) return new Set();
  const { data, error } = await supabase.from('student_verifications').select('user_id').in('user_id', unique).eq('status', 'approved').in('payment_status', VERIFIED_PAYMENT_STATUSES);
  if (error) { console.warn('CARTOMUX: verification lookup failed', error.message); return new Set(); }
  return new Set((data || []).map((row: any) => row.user_id as string));
}
