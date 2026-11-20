// A user is verified only after approval and confirmed payment (or a valid waiver).
export const VERIFIED_PAYMENT_STATUSES = ['paid', 'waived'] as const;

// Short-lived in-memory cache avoids repeating the same public lookup during navigation.
const VERIFIED_CACHE_TTL = 60_000;
const verifiedCache = new Map<string, { verified: boolean; expiresAt: number }>();
const verifiedRequests = new Map<string, Promise<boolean>>();

// Public-safe lookup: this view exposes only user IDs, never identity documents or
// private verification/application fields. The view applies the approval + payment
// rule centrally so every public badge uses one source of truth.
export async function fetchVerifiedIds(
  supabase: any,
  ids: Array<string | null | undefined>,
): Promise<Set<string>> {
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (!unique.length) return new Set();

  const now = Date.now();
  const result = new Set<string>();
  const pending: string[] = [];

  for (const id of unique) {
    const cached = verifiedCache.get(id);
    if (cached && cached.expiresAt > now) {
      if (cached.verified) result.add(id);
    } else {
      pending.push(id);
    }
  }

  if (!pending.length) return result;

  const requestKey = pending.slice().sort().join(',');
  let request = verifiedRequests.get(requestKey);
  if (!request) {
    request = (async () => {
      const { data, error } = await supabase
        .from('public_verified_users')
        .select('user_id')
        .in('user_id', pending);

      if (error) {
        console.warn('CARTOMUX: public verification lookup failed', error.message);
        return false;
      }

      const found = new Set((data || []).map((row: { user_id: string }) => row.user_id));
      const expiresAt = Date.now() + VERIFIED_CACHE_TTL;
      for (const id of pending) verifiedCache.set(id, { verified: found.has(id), expiresAt });
      return true;
    })();
    verifiedRequests.set(requestKey, request);
  }

  await request;
  verifiedRequests.delete(requestKey);
  for (const id of pending) if (verifiedCache.get(id)?.verified) result.add(id);
  return result;
}
