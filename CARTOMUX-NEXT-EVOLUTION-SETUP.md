# CARTOMUX Next Evolution — deployment notes

This update adds the first complete product layer for the three agreed pillars: **Trust, Discovery and Campus Experience**. Existing page styling and the current design system have been retained; new views reuse the existing buttons, cards, panels, typography and colours.

## 1. Required Supabase migration

Before deploying the code, open **Supabase → SQL Editor** and run the complete file:

`supabase/cartomux-next-evolution.sql`

The migration is idempotent for normal repeat runs. It creates:

- `campus_directory` and automatic campus directory population from listings.
- `saved_searches` and a listing-publish trigger that creates in-app notifications for matching searches.
- `sale_transactions` and `seller_reviews`, plus secure RPCs for seller-created sale records, buyer confirmation, buyer dispute, review submission and seller reopening.
- `viewing_requests` for accommodation inspections and notification triggers.
- `service_requests` for tutoring, laundry, design and other service listings.
- `vendor_storefronts` for public vendor pages.
- `listing_view_events` and seller analytics RPCs.

The migration adds Row Level Security policies and grants for the new tables. Transaction writes are performed through security-definer RPCs so a user cannot simply insert a fake review or mark another user's listing as sold.

## 2. New pages and entry points

- `/transactions` — selected buyers confirm or dispute a seller-reported transaction and submit one review after confirmation.
- `/seller-analytics` — signed-in seller views, inquiries and favourites by listing.
- `/viewing-requests` — landlords accept/decline accommodation inspection requests; tenants can see their requests.
- `/service-requests` — service providers manage booking requests.
- `/store/manage` — create/update a public vendor storefront.
- `/store/[slug]` — shareable vendor storefront.
- `/campus/[slug]` — campus-specific listings page.

Profile now links to these tools. My Listings lets a seller mark a listing as sold/rented by selecting the buyer from a CARTOMUX conversation. The buyer must confirm before a public review is enabled. Buyers can dispute a mistaken sale; sellers can reopen a pending sale.

## 3. Discovery and SEO

Marketplace search now supports title/description text, category, campus, price range, product condition, listing type, accommodation property type and sorting. Users can save a filtered search; matching newly-published listings create an in-app notification.

Public product pages now generate per-listing title, description, canonical URL and Open Graph/Twitter metadata, including the listing image where available. A share button uses the device share sheet or copies the URL. `sitemap.xml` now includes active product pages, campus pages and vendor storefronts.

The public campus directory is seeded from campus names already present in listings and is kept current when new listings are created. Admins can curate campus names/slugs and optional city/state fields in Supabase.

## 4. Trust and safety

- Seller reputation is calculated from buyer reviews linked to a confirmed transaction.
- The chat composer shows a non-blocking caution when text resembles an advance-payment request or contains a 10-digit account number. It does not block legitimate messages.
- Accommodation viewing and service booking requests are stored with participant-only read access and notify the other party in the in-app notifications table.

## 5. Environment variables

The server-side metadata and sitemap use the same public Supabase variables already used by this project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

No new API key is required for this update.

## 6. Important boundaries

This release does **not** hold buyer funds, provide escrow, or release payments. Escrow requires a payment provider arrangement that explicitly supports the flow and a Nigerian regulatory review; the existing Paystack checkout should not be treated as escrow. AI-generated listing copy/photo recognition also needs an approved AI API key and usage controls. Campus dispatch/delivery requires an operational partner. These are intentionally not simulated with fake buttons or insecure client-only logic.

## 7. Deployment order

1. Run the Supabase SQL migration.
2. Confirm the migration completes without errors.
3. Deploy the application code to Vercel.
4. Test one seller/buyer transaction end-to-end using two test accounts.
5. Test a saved search by saving a filter with a test account, then publishing a matching listing from a second account.
6. Test a viewing request and a service request with two accounts.
7. Create a storefront and check `/store/[slug]`, a campus page and a product link preview.
8. Check the seller analytics page with a signed-in test viewer.

**Build verification note:** dependency installation could not be completed in this environment because the npm registry was unreachable. TypeScript/TSX transpilation was run on the source tree and reported no syntax errors, but this is not a substitute for a full `next build`. Run `npm run build` in Vercel after applying the migration and review the build log before considering deployment complete.
