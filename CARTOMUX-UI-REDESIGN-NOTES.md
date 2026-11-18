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
