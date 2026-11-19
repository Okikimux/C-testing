# CARTOMUX – new pages UI redesign

No routes, database calls, RPC names or business logic were changed. Only markup and styling.

## What changed
- `app/globals.css`: the old minified "Next Evolution" block (it used undefined variables and had no dark mode) is replaced by a structured section 17 built on the existing tokens. Dark mode and mobile are covered.
- `components/ui-bits.tsx` (new): shared PageHeader, Pill, EmptyState, Tabs and RequestCard.
- Redesigned: /transactions, /seller-analytics, /viewing-requests, /service-requests, /store/manage, /store/[slug], /campus/[slug], /my-listings, /profile, /users/[id], product page, marketplace filters, admin dispute queue, chat safety banner, sell photo picker.
- Product page buttons: Chat seller (full width) -> Request inspection / Request service (full width) -> Price alert, Save, Share, Report (one even row).
- Request inspection / Request service forms now open as a bottom sheet on phones and a centred dialog on desktop (Esc and tap-outside close).

## Small UI-only additions
Status tabs on transactions and requests, loading skeletons, delivery stepper, live storefront preview, active-filter count badge, campus category chips.

## Photos: square crop + new watermark
- `components/image-cropper.tsx` (new): square (1:1) cropper. Drag to position, pinch / mouse wheel / slider to zoom, "Fill square" or "Fit whole photo" (soft blurred sides), arrow keys and +/- for keyboard users. Output is up to 1200x1200.
- `lib/image-tools.ts` (new): crop maths, canvas export (WebP, falling back to JPEG when a browser cannot encode WebP).
- `lib/cartomux-watermark.ts` (redesigned): small, translucent white logo + wordmark in the bottom-right over a very soft halo. No solid badge. Tunable in `WATERMARK_STYLE` (markOpacity, shadeOpacity, sizeRatio).
- `app/sell/page.tsx`: photos are cropped one by one as they are chosen, watermarked immediately (thumbnails show the real result), can be re-cropped from the original with the crop button, and are never watermarked twice. Animated GIFs are left untouched.
- `app/globals.css`: product image is always square (the old max-height could break the ratio on wide screens); the card photo counter moved to the top-left so it never covers the watermark.
- Photos already uploaded keep their old watermark; they are only centre-cropped by the square frame, as before.

## Student & Vendor accounts
See `CARTOMUX-ACCOUNT-TYPES-SETUP.md`. Run `supabase/cartomux-account-types.sql` before deploying.
