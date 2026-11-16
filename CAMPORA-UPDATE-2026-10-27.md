# CAMPORA implementation update — 27 October 2026

## Changed in this source update

- Registration now requires users to accept the Terms and Conditions and Privacy Policy before email registration or Google sign-in.
- Google OAuth and email sign-up carry/record the current terms version when the accompanying Supabase migration has been applied.
- Terms now cover student and non-student vendors, honest listings, prohibited conduct, verification stages and fees, reports, three-strike moderation, and appeals.
- Privacy text now explains verification documents, NIN, payment references, moderation records, and the need for documented retention periods.
- The selling page checks the five-active-listing limit for unverified users; the database trigger in the migration is the authoritative enforcement layer.
- Verification applications display the ₦1,500 student fee and ₦2,000 vendor fee and separate Stage 1 approval from final verification.
- Admin approval moves a new application to `awaiting_payment`; a rejection requires a specific reason.
- The verification page supports generating a five-minute serial, entering a coupon, applying a 50% discount, or redeeming a 100% waiver.
- Paystack initialization and verification run in server-side API routes. The server checks the transaction status, NGN currency, exact amount, reference, user, and application before granting the verified state.
- The admin dashboard can generate and disable 50% / 100% coupons, issue documented three-strike actions, and review appeals.
- A user-facing `/appeals` page is added.
- New Supabase migration: `supabase/campora-marketplace-safety-and-verification.sql`.

## Required before use

1. Apply the new SQL migration to the correct Supabase project after backing it up.
2. Set `PAYSTACK_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` as server-only deployment environment variables. Never prefix these secrets with `NEXT_PUBLIC_` or commit them to Git.
3. Test with Paystack test credentials before accepting live payments.
4. Test RLS and storage access using separate applicant, verified seller, unverified seller, and admin accounts.

## Validation status

- TypeScript/TSX syntax transpilation passed for all changed TypeScript files.
- A full Next.js build/typecheck was not completed because dependency installation (`npm ci`) timed out in this environment; the dependencies were not installed here.
- The SQL migration has not been run against the live Supabase project, so it must be reviewed and applied before these features can work against the database.
- Payment and coupon workflows require environment configuration and end-to-end tests before production use.

## Important limits

The three-strike records, admin actions, appeal workflow, and listing-publish restrictions are implemented as a foundation. Before launch, test and extend account restrictions to every sensitive write path, including messaging and other account actions. The legal terms/privacy pages are product drafts and need CAMPORA's operator details, retention policy, support/appeal contact, and a Nigerian legal/privacy review before launch.
