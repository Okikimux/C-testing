# CAMPORA changes included

Brand promise: **CAMPORA — List It. Find It. Get It.**

This folder contains the updated CAMPORA homepage copy, floating mobile navigation with a round raised Sell button, back-icon controls on secondary pages, custom not-found and runtime-error pages, a feedback submission page, and an admin feedback inbox section.

## Required Supabase setup for feedback

1. Open the CAMPORA Supabase project.
2. Open **SQL Editor**.
3. Run the full SQL in `supabase/campora-feedback.sql`.
4. Ensure your admin profile has `profiles.role = 'admin'`.
5. Start the project and test `/feedback`, then open `/admin` as an admin to see submissions.

The feedback table allows users to submit feedback but only admin profiles can read and update the inbox. Feedback is not emailed automatically; it appears in the CAMPORA admin dashboard.

## Local checks

Run `npm install`, then `npm run build` before pushing. This build could not be verified in the packaging environment because dependency installation timed out. Do not deploy until the local build passes and the SQL setup has been applied.


## UI refinements in this package
- Sign-in logo and form spacing respond better on small screens.
- The raised mobile Sell button keeps its circular plus button and hides its text label.
- Account menu closes when clicking outside or pressing Escape; menu links already close it.
- Product cards and product detail images support touch swipe and show image position indicators; product detail includes desktop arrows.
- Listing photo selection is limited to five images, with previews and removal before publishing.
- PWA manifest, Apple touch icon, and square app icon are included.

Run `npm run typecheck` and `npm run build` before deployment. This package does not automatically push changes to GitHub or apply database changes to Supabase.
