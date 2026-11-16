-- CAMPORA marketplace condition and vendor verification extension
-- Review the existing RLS policies before applying in production.

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS condition text;
ALTER TABLE public.listings
  DROP CONSTRAINT IF EXISTS listings_condition_check;
ALTER TABLE public.listings
  ADD CONSTRAINT listings_condition_check CHECK (condition IS NULL OR condition IN ('new','used'));

ALTER TABLE public.student_verifications
  ADD COLUMN IF NOT EXISTS verification_type text NOT NULL DEFAULT 'student',
  ADD COLUMN IF NOT EXISTS nin_number text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS business_category text,
  ADD COLUMN IF NOT EXISTS business_address text,
  ADD COLUMN IF NOT EXISTS business_document_path text;
ALTER TABLE public.student_verifications
  DROP CONSTRAINT IF EXISTS student_verifications_verification_type_check;
ALTER TABLE public.student_verifications
  ADD CONSTRAINT student_verifications_verification_type_check CHECK (verification_type IN ('student','vendor'));

-- IMPORTANT: NIN data and documents are highly sensitive. Keep the verification-documents
-- bucket private, limit reads to the owner and authorised verification administrators,
-- and never expose these columns through public profile/listing queries. Do not apply a broad
-- authenticated SELECT policy to this table. Review existing policies before deployment.
-- Support form submissions use the existing user_feedback table and its existing RLS policies.
