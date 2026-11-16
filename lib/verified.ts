// Looks up which of the given user IDs hold an approved (final) verification.
// Uses the same query the messages inbox already uses, so it follows the same RLS policy
// ("Approved verifications are publicly visible", signed-in users).
export async function fetchVerifiedIds(supabase: any, ids: Array<string | null | undefined>): Promise<Set<string>> {
  const unique = Array.from(new Set(ids.filter(Boolean))) as string[];
  if (!unique.length) return new Set();
  const { data, error } = await supabase.from('student_verifications').select('user_id').in('user_id', unique).eq('status', 'approved');
  if (error) { console.warn('CARTOMUX: verification lookup failed', error.message); return new Set(); }
  return new Set((data || []).map((row: any) => row.user_id as string));
}
