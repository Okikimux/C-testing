# CARTOMUX accommodation and listing controls update

This update keeps the existing CARTOMUX interface and styling. No CSS or visual redesign files were changed.

## Supabase step required before deployment

1. Open the CARTOMUX Supabase project.
2. Open **SQL Editor** and create a new query.
3. Paste and run `supabase/cartomux-accommodation-listing-and-delete.sql`.
4. Confirm the query completes successfully, then deploy this project to Vercel.

The migration:
- Repairs existing accommodation listings whose `price` is zero by copying `payment_initial` into `price`.
- Allows listing owners to remove their own uploaded accommodation/product images from the `listing-images` bucket.
- Ensures dependent database rows do not prevent permanent listing deletion.

## Behaviour in this update

- Accommodation listings require an **Initial Payment**. This value is also saved as the listing `price` and is what marketplace cards display.
- The next-period amount is labelled **Subsequent Rent** and its frequency is labelled **Subsequent Payment Frequency**.
- No rent/fee breakdown is collected or displayed.
- Editing an accommodation price updates both `price` and `payment_initial`.
- Marking a product as sold or accommodation as rented changes its status to `sold`: it disappears from the public marketplace but remains in My Listings, where it can be restored to Available.
- Hide has been replaced by Delete. The user is asked to confirm, listing images are removed from Storage, and the listing is deleted from the database.
- Logout explicitly signs out the current Supabase Auth session.

## Authentication note

Supabase logout revokes the current refresh-token session. A previously copied access JWT can remain cryptographically valid until its expiry time. This is a Supabase JWT lifetime limitation; changing logout UI cannot make an already-issued JWT expire instantly. For stronger exposure limits, configure a shorter JWT expiry in Supabase Auth settings.

## Validation

The edited TSX files passed TypeScript transpilation/syntax checks. A full Next.js production build could not be completed in this environment because dependency installation timed out. Run `npm ci` and `npm run build` in CI/Vercel after applying the migration.
