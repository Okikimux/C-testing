# CARTOMUX Phase 1 + Phase 2 completion

This package completes the agreed marketplace features in an isolated development copy. It does not change the live CARTOMUX deployment, existing Paystack integration, or production Supabase database.

## Included

### Trust and safety
- Existing verified transaction and buyer-review foundation retained.
- Seller reputation is surfaced on product pages and public profiles: average rating, verified review count and confirmed trades.
- Admin dispute queue with evidence-based resolution notes. Outcomes are recorded and visible to the transaction participants; the UI explicitly does not claim to issue refunds or move funds.
- Existing listing reports and moderation queue retained.

### Delivery and pickup coordination
- Seller proposes delivery or self-collection, with instructions/address and an optional date/time.
- Buyer accepts or requests changes.
- Seller marks delivery as dispatched or pickup as ready.
- Buyer confirms receipt.
- Participants receive in-app notifications for each transition.
- Disputed transactions cannot be updated through the normal fulfilment flow.

### CARTOMUX photo watermark
- Seller listing photos are branded in the browser before upload with the existing CARTOMUX logo and the word CARTOMUX.
- The wordmark uses the site's existing Bricolage Grotesque display Google Font.
- A small, semi-transparent navy capsule is placed at the bottom-right so the mark remains legible on light and dark photographs.
- The branded output is converted to WebP and remains subject to the existing 1.5 MB upload limit. Animated GIFs retain their animation and are not watermarked.
- This applies to new listing uploads; existing stored photos are not modified.

### Discovery
- Listings receive readable, unique URLs such as `/listing/used-dell-laptop-1234abcd`.
- Existing `/product/<uuid>` URLs remain compatible and redirect to the readable URL once the migration is applied.
- Readable product URLs are canonical and included in the sitemap.
- Existing saved searches, matching notifications, filters, campus pages and storefronts remain in place.

### Campus experience
- Existing campus pages, vendor storefronts, accommodation viewing requests and service booking requests remain in place.

## Supabase migration order

In the isolated TEST Supabase project only:

1. Apply `supabase/cartomux-next-evolution.sql` if it has not already been applied.
2. Apply `supabase/cartomux-phase12-completion.sql`.
3. Confirm both migrations finish without errors.

The second migration adds listing slugs, fulfilment coordination fields/RPCs, and admin dispute-resolution fields/RPCs. It does not add payment processing, escrow, automatic payouts or Paystack changes.

## Application checks

Run locally with the TEST Supabase URL and publishable key:

```bash
npm ci
npm run typecheck
npm run build
npm run dev
```

Test using two non-production accounts:

1. Seller marks a listing as sold to the correct buyer from an existing CARTOMUX conversation.
2. Seller proposes delivery and enters instructions; test the pickup option separately.
3. Buyer accepts, or requests changes; seller re-proposes.
4. Seller marks delivery dispatched / pickup ready.
5. Buyer confirms receipt.
6. Buyer confirms the transaction and submits a review; verify the rating appears on the seller profile and product page.
7. Buyer disputes a transaction; admin reviews it and records a resolution note.
8. Open a legacy UUID product URL and verify it redirects to its `/listing/<slug>` URL.
9. Check sitemap output contains the readable listing URL.
10. Test saved search notifications, accommodation viewing requests, service requests, vendor storefronts and campus pages.
11. Publish a test listing with light and dark photos and confirm the logo + CARTOMUX wordmark appear at the bottom-right. Check the watermark is visible without obscuring the item. Confirm animated GIFs remain animated and unwatermarked.

## Important boundaries

- Do not run these migrations against production until the test run is approved.
- Do not merge or deploy this copy automatically.
- This delivery workflow coordinates the parties; it is not escrow and does not hold, transfer or refund money.
- Buyer confirmation in this marketplace feature is a transaction record and review gate only. It does not authorise a Paystack payout.
- Admin dispute outcomes are moderation records only. Refunds and payment actions must continue to follow the existing approved payment process.
- The project must be configured with test Supabase credentials before local testing. Do not copy production secrets into a shared archive.

