# CAMPORA safety and verification update

This update adds registration terms acceptance, a fuller marketplace code of conduct, a database-enforced five-active-listing limit for unverified users, a Stage 1 / Stage 2 verification flow, coupon serials and 50% / 100% coupons, Paystack server routes, and a three-strike moderation and appeals foundation.

## 1. Apply the Supabase migration

1. Back up the CAMPORA Supabase project.
2. Open Supabase SQL Editor for the correct project.
3. Review and run `supabase/campora-marketplace-safety-and-verification.sql`.
4. Verify that the migration completed before deploying the application code.

The migration preserves existing `approved` verification records as legacy verified accounts. New Stage 1 approvals move to `awaiting_payment`; a confirmed payment or valid 100% coupon moves the application to `approved`.

## 2. Configure payment secrets on the server

Set these environment variables in the hosting provider's server environment:

- `PAYSTACK_SECRET_KEY` — the Paystack secret key, never a public/client-side variable.
- `SUPABASE_SERVICE_ROLE_KEY` — the Supabase service-role key, server-only and never exposed with a `NEXT_PUBLIC_` prefix.

The app already needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Use Paystack test credentials for test transactions first. Confirm the production callback URL and payment settings in Paystack before accepting real verification payments. Do not share or commit secret keys.

## 3. Coupon workflow

- A Stage 1-approved applicant generates a serial from the verification screen.
- The serial is bound to the applicant and expires after five minutes.
- An admin uses the Admin dashboard to generate a 50% or 100% coupon and sends the code privately to the applicant.
- The coupon expires five minutes after generation and is bound to the applicant/application.
- A 100% waiver completes verification. A 50% coupon calculates the remaining fee and requires Paystack payment confirmation.

## 4. Moderation workflow

- Do not issue a strike just because someone submits a report. Review evidence first.
- The Admin dashboard records a confirmed violation, the finding, evidence references, the strike number, and resulting action.
- Strike one records a warning, strike two records a final warning, and strike three records a permanent ban in the moderation state.
- Users can visit `/appeals` to appeal a confirmed violation. Admins can uphold or overturn an appeal.

This migration and UI establish moderation records and enforce listing restrictions for restricted/banned accounts. Before launch, test and extend restrictions to every sensitive write path (including messaging, reporting, and other account actions) according to CAMPORA's final enforcement policy.

## 5. Test checklist

- Register by email and Google; confirm terms acceptance is recorded.
- Confirm an unverified account can publish five active listings but cannot publish a sixth, including by direct API request.
- Confirm verified accounts can publish beyond the limit.
- Submit a student and a non-student vendor application; verify Stage 1 approval does not show a badge.
- Confirm a 100% coupon completes verification, while a 50% coupon requires the correct remaining Paystack payment.
- Test invalid, expired, reused, disabled, and other-user coupon codes.
- Test successful, failed, amount-mismatched, and wrong-user Paystack references.
- Issue strikes in a test account and test appeal submission, uphold, and overturn.
- Verify private verification documents are accessible only to the applicant and authorised admins.

The legal text is a product draft, not legal advice. Add CAMPORA's legal operator identity, support contact, final retention periods, and payment terms and obtain an appropriate Nigerian legal/privacy review before launch.
