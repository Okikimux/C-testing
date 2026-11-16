# CARTOMUX interface redesign and rename

Routes, data logic, Supabase queries and the navy/green colour theme are unchanged. Only the interface changed.

## What changed
- `app/globals.css` rewritten from scratch (readable, sectioned, no `!important` patch layers). Colour tokens are the same values as before.
- `app/layout.tsx`: loads Bricolage Grotesque (headings, prices) and Figtree (body) with `next/font/google`. Fonts are self-hosted at build time, so the existing CSP (`font-src 'self'`) still works. Also sets `viewport-fit=cover` so the phone tab bar respects the safe area.
- `components/app-shell.tsx`: new header (active-link state, richer account menu), footer, and a flat mobile tab bar with a raised Sell button.
- `components/auth-shell.tsx` (new): shared two-panel layout for login, register, forgot/reset password, complete profile.
- Rebuilt layouts: home, marketplace (category chips, price-tab cards), product, favourites, my listings, public profile, notifications. Every other page picks up the new look through the stylesheet.

## One database update to run (fixes three things)
Paste `supabase/cartomux-database-update.sql` into the Supabase SQL Editor and run it **once** (safe to run again). It contains:
1. the chat delete fix,
2. the apartment fix (the listings table did not allow the category `Accommodation`, so apartments could not be posted; the Sell page already sets it automatically),
3. the ads setup and the paid-ads setup (this removes "Ad booking is not set up yet").
After running it, bookings are still closed: sign in as admin, open `/admin`, go to **Ad prices and bookings**, set prices, tick **Available to book** and **Bookings are open**, and save.

## Legal pages completed
Terms, Privacy, Refunds and Cookies are now complete (the yellow "before launch" notices are gone). They describe how CARTOMUX really works: verification, Paystack payments, ads, messaging, accommodation listings, strikes and appeals, cookies and the ad-cookie choice. These are drafts I wrote, not legal advice. Decisions I made that you should confirm or change: users must be 18 or have a parent's permission; refund rules (verification fee refunded only for double charges or our error; ads refunded in full if asked before they start, for unused days if our error, and not refunded for rule-breaking removals); refund request window of 7 days and a 5 working-day reply target; deletion within 30 days of a request and verification documents within 90 days after rejection or withdrawal; Nigerian governing law; and that you operate under the name MUXLAB. If you have a registered company name or address, tell me and I will add it. Have a Nigerian lawyer review them before relying on them.

## Chat delete fix and plain-language errors
- **Delete message bug:** deleting a sent text message failed with "violates check constraint messages_body_length_check". Cause: deleting blanks the text, but the database rule did not allow a blank message even when it was marked deleted. This was already in your database setup. **Run `supabase/cartomux-fix-message-delete.sql` once in the Supabase SQL Editor to fix it** (the older `phase6-messaging-admin.sql` is updated too, for fresh installs). Until you run it, deleting shows "The message could not be deleted. Please try again."
- **No more database details on screen:** `lib/friendly-error.ts` turns database, permission, network and session errors into plain sentences. It is applied automatically to every popup and every message that goes through `useFlash`, and used directly in chat, settings, sell, notifications and the admin ad panels. The technical text is only written to the browser console for developers. Messages written for people (like "Invalid login credentials") are left as they are.

## Rename to CARTOMUX
- The brand name is now CARTOMUX everywhere people can see it: header, footer, page titles, legal pages, emails, install name, notifications and messages. The tagline "List It. Find It. Get It." stays.
- Footer: "An innovation by MUXLAB" with the MUXLAB logo (`public/muxlab-logo.png`, white, and `public/muxlab-logo-navy.png` for light backgrounds), and "(c) <year> CARTOMUX. All rights reserved." with the year filled in automatically.
- Left unchanged on purpose, because renaming them could break things: the environment variable names (`NEXT_PUBLIC_CAMPORA_SUPPORT_EMAIL`, `NEXT_PUBLIC_CAMPORA_SUPPORT_WHATSAPP`), database function names (`campora_*`), the payment purpose tag `campora_verification`, browser storage keys, SQL file names and image file names (`campora-app-icon.png`, `campora-logo.png`).
- The site address is now read from one place, `lib/site.ts`, from the `NEXT_PUBLIC_SITE_URL` environment variable. Until you set it, it falls back to `https://campora.com.ng`, which is what the sitemap, robots.txt and page metadata will say. Set it when the new domain is live.
- The sign-up and reset-password emails are rebuilt for CARTOMUX and read your Site URL from Supabase, so they need no domain edits. Update the email subject lines in Supabase too.
- Older setup notes in this folder (CAMPORA-*.md) still use the old name; they are history.
- Not touched: the database SQL files. If any stored text in your database (for example saved notification messages) still says CAMPORA, it will keep saying so until it is edited.
- The logo image still reads as a C with a cap and cart, so it fits CARTOMUX without changes.

## Paid, self-serve ads (verified accounts, automatic)
**Set-up, in this order**
1. Run `supabase/campora-ads.sql` (if you have not), then `supabase/cartomux-paid-ads.sql` in the Supabase SQL Editor.
2. In Vercel/your host, make sure `PAYSTACK_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are set (your verification payments already use them). Test first with Paystack test keys.
3. Sign in as admin, open `/admin`, find **Ad prices and bookings**. Set the price per day for each page, how many ads can run at once on each page, tick **Available to book**, set minimum and maximum days and how far ahead people can book, add any longer-booking discounts, then tick **Bookings are open** and press Save. Everything starts closed with prices at 0; nothing is for sale until you do this. I did not choose any prices.

**How it works for an advertiser**
- `/advertise` shows the live prices. **Book an ad** (`/advertise/book`) is for verified accounts only (approved verification with the fee paid or waived). Others see a "Get verified" page. A 100% verification coupon from you is how you waive the fee.
- They write the ad, pick pages, days and a start date, see the price, tick the advertising rules, and pay with Paystack. The ad goes live automatically as soon as payment is confirmed and stops after the days paid. There is no approval step.
- **My ads** (`/advertise/my-ads`) shows each ad's status, days left, views, clicks and click rate, payment history, and a Renew / add pages button. They can edit the ad text, image and link at any time.
- If someone stops being verified, their ads stop showing automatically.

**Your controls (admin)**
- Prices, capacity, limits, discounts and bookings open/closed, plus a list of recent bookings with the total taken.
- In the Advertising list, self-serve ads show "Self-serve". You can **Pause**, or **Remove** an ad with a reason (the advertiser sees the reason), and **Restore** it. Removing is instant and is how you handle a bad ad.

**Safety built in**
- The price, dates, minimum days and capacity are all worked out on the server. The browser only sends the ad, pages, days and start date.
- After Paystack, the server checks the payment itself: successful, same amount, naira, and the same booking and user. Confirming twice cannot double-apply. Only the server can create or confirm orders.
- A booking needs at least the minimum days, at most the maximum, and cannot start in the past or too far ahead.

**Things to know**
- **Payment confirmation:** like your verification payments, an ad is switched on when the advertiser returns from Paystack. If they pay and close the tab, the ad starts the next time they open My ads (it re-checks recent payments each time). A Paystack webhook would make this instant; ask me if you want it.
- **Capacity is a soft limit:** two people paying at the same moment for the last slot can both get in. The overlap count is simple and a little cautious.
- **Refunds** are done by you in the Paystack dashboard. The default rules I wrote say: ads you remove for breaking the rules are not refunded; ads removed by mistake are refunded for unused days. Please confirm or change that wording on `/advertise` (the "Advertising rules" box).
- **VAT, receipts and terms of sale:** not handled here. Please ask an accountant and a lawyer.
- Ads that advertisers edit after paying go live without review. That is the "automatic" choice you made, so rely on the Remove button and, if you want, ask me later for a "Report this ad" link.

## Advertising (local vendor ads + Google AdSense)
**One-time setup**
1. Run `supabase/campora-ads.sql` in the Supabase SQL Editor. It creates the `ads` and `ad_events` tables, view/click counting, the `ad-images` storage bucket and the admin-only rules.
2. Sign in as an admin, open `/admin`, and scroll to the new **Advertising** panel at the bottom. Create an ad: advertiser, headline, optional description and image, https link, button text, where it appears, and start/end dates. You can edit, pause, resume or delete ads and see views, clicks and click rate for each.

**Where ads appear** (never on chat, auth, verification, settings, admin or legal pages)
- Marketplace: a full-width "Sponsored" row after every 8 listings, or at the end of a short list of 3 to 7. Several booked ads rotate between the rows.
- Home page: a banner above the "Ready to make your first listing?" band.
- Product page: a block under the description.

**What a slot shows, in order:** a live local ad booked for that place, then a Google AdSense unit (only if AdSense is set up and the visitor accepted ad cookies), then a small "Advertise with CARTOMUX" prompt linking to the new `/advertise` page (home and marketplace only, never on product pages). A footer link "Advertise" also points there.

**Counting:** a view is counted once per session after an ad has been at least half visible for a second; a click is counted when the ad link is pressed. No cookies and no user IDs are stored. Anyone can call the counting function, so numbers can be inflated by someone who tries; treat them as a guide, not an invoice.

**Turning on AdSense later** (leave everything blank until Google approves your live domain)
1. Apply at adsense.google.com with your live domain (not localhost). Approval can take days or weeks.
2. Create three display ad units (home, marketplace, product).
3. Add `NEXT_PUBLIC_ADSENSE_CLIENT` (ca-pub-...) and the three `NEXT_PUBLIC_ADSENSE_SLOT_*` values in your hosting environment (see `.env.example`) and redeploy.
4. That switches on: the cookie notice asks "Allow ad cookies / Essential only" and nothing from Google loads until someone accepts; the Google domains are added to the security policy in `next.config.ts` (and only then); `/ads.txt` is served; the site-verification meta tag is added.
5. Visitors can change their choice on the Cookies page. If Google changes the domains it needs, check Google's AdSense content-security-policy guidance.
6. Google's ads appear on a light background in dark mode. Local ads follow the theme.

**Legal:** I updated the Cookies and Privacy pages with a short advertising section (dated 8 November 2026). Please have both reviewed against the Nigeria Data Protection Act and Google's AdSense policies before launch.

## Pull down to refresh
Only for people who opened CARTOMUX from the home screen (installed app mode, including iPhone). A normal browser tab is untouched. Pull down from the top of the page past the circle and release to reload. It is switched off in chat, sell, sign-in and registration, verification, settings, feedback, appeals and admin so it cannot clash with scrolling or wipe typed text. Code: `components/pull-to-refresh.tsx`.

## Dark mode
- Three choices: Light, Dark, System (default). System follows the phone or laptop setting and switches live when the device does. The picker is under "Appearance" in the account menu, so signed-out visitors follow their device setting.
- The choice is saved in the browser (`localStorage`, key `campora-theme`; no value means System). A tiny script in `<head>` (`lib/theme-script.ts`) applies it before the first paint, so there is no white flash. Your existing CSP already allows inline scripts, so no security setting had to change.
- Code: `components/theme.tsx` (hook + picker), `lib/theme-script.ts`, `app/layout.tsx` (script, `suppressHydrationWarning` on `<html>`, light/dark browser theme colour), and the account menu in `components/app-shell.tsx`.
- Styling: `app/globals.css` now has a "16 · Dark theme" block that overrides the colour variables. About 30 hard-coded colours were converted to variables. Brand navy is still the hero, footer, chat header and price tabs. In dark mode buttons and active chips use a lighter navy (`--ctrl`) so they stand out, headings use `--heading`, and the logo sits on a light tile because it is dark navy.
- Light mode is unchanged: I compared 22 screens before and after and they matched pixel for pixel.
- New colours should use the variables (`var(--surface)`, `var(--ink)`, `var(--heading)`...) instead of hex codes, otherwise they will not follow the theme.

## Verified badge
- New `lib/verified.ts` looks up approved verifications for a list of user IDs (same query and RLS policy the messages inbox already used).
- The badge now shows beside seller names on marketplace cards, the product page (plus a "Verified seller" chip), public profiles and the chat header. Before, it only appeared in the header menu, your profile and the inbox.
- Your existing badge artwork is unchanged. The verification page's "verified" state now shows it too, and the long fee explanation is collapsed under "How verification works".
- Note: the database policy that exposes approved verifications is `to authenticated`, so signed-out visitors will not see badges. Change that policy if you want them visible to everyone.

## Popup messages (toasts)
- New `components/toast.tsx`: one shared popup system, mounted in `components/app-shell.tsx`. It appears at the top of the screen under the header, on laptop and phone.
- Success and info popups close after 4 seconds, errors after 8 seconds. Each has a close button and a thin countdown bar. The countdown pauses while a finger or mouse is on it. The same message twice shows one popup and restarts its timer. At most 4 are stacked.
- Pages use `const [error, setError] = useFlash('error')` and `useFlash('notice')` instead of `useState('')`. Calling `setError('...')` now also shows a popup, even if the text is the same as last time.
- Converted: product, settings, verification, appeals, admin, chat, sell, feedback, login, register, forgot/reset password, complete profile, and the push-notification card.
- Errors on login, register, forgot/reset password, complete profile, sell and feedback also stay on the form. Register and password-reset instructions also stay on the page.
- Left as they were on purpose: confirmation prompts with buttons (report listing, delete message), the admin coupon code with its Copy button, the "Retry" notice in the inbox, the support panel messages, progress text while publishing a listing, and status notices on the verification page.

## Small fixes found along the way
- Category links on Home (`/marketplace?category=...`) were ignored by the marketplace page. It now reads `?category=` and `?q=`; the Home search box submits to it.
- Favourites and My listings showed blank grey image boxes because listing images were never queried. They now select `listing_images(url)`. Favourites also handles `listings` returned as an object or an array.
- Chat: the support button covered Send on phones, and the message edit box squeezed the bubble. Both fixed.
- `app/admin/page.tsx` printed a literal `\n` between sections. Removed.
- About 20 classes used in JSX (Google button, public profile, message info modal, upload previews, private contact box...) had no CSS in the old build. They are all styled now.
- The three unused stylesheets (`globals_cc.css`, `globals_cor.css`, `globalscv.css`) were deleted; none were imported.

## Not verified here
Dependencies could not be installed in the editing environment, so I did not run `next build`. Pages were rendered through a test harness with mocked data and checked on laptop and phone widths. Run `npm install && npm run build` and look through the pages once before deploying.
