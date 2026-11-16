'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Megaphone } from 'lucide-react';
import { fetchLiveAds, recordAdEvent, type Ad, type AdPlacement } from '../lib/ads';
import { adsenseClient, adsenseEnabled, onAdsConsentChange, readAdsConsent, type AdsConsent } from '../lib/consent';

export type AdVariant = 'row' | 'banner' | 'block';

// Written out one by one so Next.js can inline them at build time.
const ADSENSE_SLOTS: Record<AdPlacement, string> = {
  home: process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME || '',
  marketplace: process.env.NEXT_PUBLIC_ADSENSE_SLOT_MARKETPLACE || '',
  product: process.env.NEXT_PUBLIC_ADSENSE_SLOT_PRODUCT || '',
};

const variantClass = (variant: AdVariant) => (variant === 'banner' ? 'adBanner' : variant === 'block' ? 'adBlock' : 'adRow');

/**
 * One advertising slot. Order of preference:
 *   1. a live local vendor ad booked for this placement,
 *   2. a Google AdSense unit (only if AdSense is configured AND the visitor accepted ad cookies),
 *   3. a small "Advertise with CARTOMUX" prompt (first slot on a page only).
 * `index` lets several slots on one page show different ads.
 */
export default function AdSlot({ placement, variant = 'row', index = 0, house = true }: { placement: AdPlacement; variant?: AdVariant; index?: number; house?: boolean }) {
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [consent, setConsent] = useState<AdsConsent>(null);

  useEffect(() => {
    let alive = true;
    fetchLiveAds(placement).then(list => { if (alive) setAds(list); });
    return () => { alive = false; };
  }, [placement]);

  useEffect(() => {
    if (!adsenseEnabled) return;
    setConsent(readAdsConsent());
    return onAdsConsentChange(() => setConsent(readAdsConsent()));
  }, []);

  if (ads === null) return null;
  if (ads.length) return <SponsoredAd ad={ads[index % ads.length]} variant={variant} />;
  if (adsenseEnabled && consent === 'granted' && ADSENSE_SLOTS[placement]) return <AdSenseUnit placement={placement} variant={variant} />;
  if (house && index === 0) return <HouseAd variant={variant} />;
  return null;
}

function SponsoredAd({ ad, variant }: { ad: Ad; variant: AdVariant }) {
  const linkRef = useRef<HTMLAnchorElement>(null);

  // Count a view once per session, after the ad has been at least half visible for a second.
  useEffect(() => {
    const el = linkRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const key = `campora-ad-view-${ad.id}`;
    try { if (sessionStorage.getItem(key)) return; } catch { /* ignore */ }
    let timer: number | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (timer === undefined) timer = window.setTimeout(() => {
          try { sessionStorage.setItem(key, '1'); } catch { /* ignore */ }
          recordAdEvent(ad.id, 'view');
          observer.disconnect();
        }, 1000);
      } else if (timer !== undefined) { window.clearTimeout(timer); timer = undefined; }
    }, { threshold: 0.5 });
    observer.observe(el);
    return () => { observer.disconnect(); if (timer !== undefined) window.clearTimeout(timer); };
  }, [ad.id]);

  return <AdCard ad={ad} variant={variant} linkRef={linkRef} onClick={() => recordAdEvent(ad.id, 'click')} />;
}

/** The visual card. Used for live ads and for the preview on the booking page. */
export function AdCard({ ad, variant, linkRef, onClick, preview = false }: { ad: Pick<Ad, 'title' | 'body' | 'advertiser' | 'image_url' | 'link_url' | 'cta_label'>; variant: AdVariant; linkRef?: React.Ref<HTMLAnchorElement>; onClick?: () => void; preview?: boolean }) {
  return <aside className={`adSlot ${variantClass(variant)}`} aria-label="Sponsored">
    <a ref={linkRef} className="adLink" href={preview ? undefined : ad.link_url} target={preview ? undefined : '_blank'} rel="sponsored noopener noreferrer" onClick={preview ? (event) => event.preventDefault() : onClick}>
      {ad.image_url && <span className="adMedia" style={{ backgroundImage: `url("${ad.image_url.replace(/"/g, '%22')}")` }} aria-hidden="true" />}
      <span className="adCopy">
        <span className="adLabel">Sponsored</span>
        <b className="adTitle">{ad.title || 'Your headline'}</b>
        {ad.body && <span className="adBody">{ad.body}</span>}
        <span className="adAdvertiser">{ad.advertiser || 'Your business'}</span>
      </span>
      <span className="adCta">{ad.cta_label || 'Learn more'}<ExternalLink size={15} aria-hidden="true" /></span>
    </a>
  </aside>;
}

function HouseAd({ variant }: { variant: AdVariant }) {
  return <aside className={`adSlot adHouse ${variantClass(variant)}`} aria-label="Advertise with CARTOMUX">
    <Link className="adLink" href="/advertise">
      <span className="adHouseIcon"><Megaphone size={22} aria-hidden="true" /></span>
      <span className="adCopy">
        <b className="adTitle">Advertise your business on CARTOMUX</b>
        <span className="adBody">Put your shop, service or event in front of students and vendors on campus.</span>
      </span>
      <span className="adCta">See how</span>
    </Link>
  </aside>;
}

function loadAdSenseScript() {
  if (document.querySelector('script[data-campora-adsense]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClient)}`;
  script.setAttribute('data-campora-adsense', '1');
  document.head.appendChild(script);
}

function AdSenseUnit({ placement, variant }: { placement: AdPlacement; variant: AdVariant }) {
  const pushed = useRef(false);
  useEffect(() => {
    loadAdSenseScript();
    if (pushed.current) return;
    pushed.current = true;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch { /* an ad blocker or script error must not break the page */ }
  }, []);
  return <aside className={`adSlot adSense ${variantClass(variant)}`} aria-label="Advertisement">
    <span className="adLabel">Advertisement</span>
    <div className="adSenseFrame">
      <ins className="adsbygoogle" style={{ display: 'block' }} data-ad-client={adsenseClient} data-ad-slot={ADSENSE_SLOTS[placement]} data-ad-format="auto" data-full-width-responsive="true" />
    </div>
  </aside>;
}
