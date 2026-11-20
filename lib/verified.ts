// A user is verified only after approval and confirmed payment (or a valid waiver).
export const VERIFIED_PAYMENT_STATUSES = ['paid', 'waived'] as const;

// Public-safe lookup: this view exposes only user IDs, never identity documents or
// private verification/application fields. The view applies the approval + payment
// rule centrally so every public badge uses one source of truth.
export async function fetchVerifiedIds(
  supabase: any,
  ids: Array<string | null | undefined>,
): Promise<Set<string>> {
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (!unique.length) return new Set();

  const { data, error } = await supabase
    .from('public_verified_users')
    .select('user_id')
    .in('user_id', unique);

  if (error) {
    console.warn('CARTOMUX: public verification lookup failed', error.message);
    return new Set();
  }

  return new Set((data || []).map((row: { user_id: string }) => row.user_id));
}
