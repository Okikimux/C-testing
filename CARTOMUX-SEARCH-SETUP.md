# Getting CARTOMUX into Google (domain: cartomux.com.ng)

## 1. Connect the domain
1. In your hosting dashboard (for example Vercel > Project > Settings > Domains) add `cartomux.com.ng` and `www.cartomux.com.ng`.
2. Add the DNS records the host shows (usually an A record for `@` and a CNAME for `www`) where you manage the domain's DNS. Wait until HTTPS works.
3. Make `cartomux.com.ng` (no www) the main address and redirect `www` to it.

## 2. Tell the site its address
Set this in the hosting environment variables and redeploy:
`NEXT_PUBLIC_SITE_URL=https://cartomux.com.ng`
It controls the canonical links, `/sitemap.xml`, `/robots.txt` and the share links. Open `https://cartomux.com.ng/sitemap.xml` and `/robots.txt` afterwards to check they show the new address.

## 3. Login and payment settings
- Supabase > Authentication > URL Configuration: Site URL = `https://cartomux.com.ng`; add `https://cartomux.com.ng/**` to Redirect URLs (keep the old and localhost ones for now). The sign-up and reset emails follow the Site URL automatically.
- Google sign-in (if you use it): Google Cloud > OAuth consent screen and credentials: add `https://cartomux.com.ng` as an authorised domain/origin and set the app name and logo to CARTOMUX.
- Paystack dashboard: update your website address to the new domain.

## 4. Google Search Console
1. Open search.google.com/search-console and add a **Domain** property: `cartomux.com.ng`.
2. Google gives a TXT record. Add it in your DNS and press Verify. Keep the record forever.
   (No DNS access? Choose "URL prefix" with `https://cartomux.com.ng/`, pick the HTML tag method, set the code in `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, redeploy, then Verify.)
3. Sitemaps > add `sitemap.xml`.
4. URL inspection > paste `https://cartomux.com.ng/` > Request indexing.

## 5. The logo in search results
Google shows your site icon next to the result. It needs a square icon in a multiple of 48px, a normal `/favicon.ico`, and permission to crawl it. These are in place now (`favicon.ico`, `icon-48/96/192/512.png`, and a note in the page head). After you deploy, request indexing of the home page again. Google updates icons slowly, usually days to a few weeks. The old CAMPORA entry will not carry over to the new name; the new site starts fresh.

## 6. Share image and structured data
`og-image.png` (1200x630) is used when the link is shared on WhatsApp and social media. The page head also tells Google the site name and logo (Organization and WebSite data).

## If campora.com.ng was live and indexed
Redirect each old page to the same path on cartomux.com.ng (301), verify both domains in Search Console, then use Settings > Change of address on the old one.
