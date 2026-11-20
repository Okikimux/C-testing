-- Expose only the UUIDs of fully verified users for public badge rendering.
-- The underlying student_verifications table remains private and retains its RLS policies.
-- This view is owned by postgres and exposes no identity documents, NIN, payment,
-- or application fields.
CREATE OR REPLACE VIEW public.public_verified_users
WITH (security_barrier = true)
AS
SELECT user_id
FROM public.student_verifications
WHERE status = 'approved'
  AND payment_status IN ('paid', 'waived');

ALTER VIEW public.public_verified_users OWNER TO postgres;

REVOKE ALL ON public.public_verified_users FROM PUBLIC;
REVOKE ALL ON public.public_verified_users FROM anon, authenticated;
GRANT SELECT ON public.public_verified_users TO anon, authenticated;

COMMENT ON VIEW public.public_verified_users IS
'Public-safe projection of user IDs whose verification is approved and paid or waived. Never add private verification columns.';
