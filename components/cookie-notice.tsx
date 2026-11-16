'use client';

import { useEffect, useState } from 'react';
import { adsenseEnabled, readAdsConsent, writeAdsConsent } from '../lib/consent';

const SEEN_KEY = 'campusdrop-cookie-notice';

/**
 * Without AdSense: the original "essential cookies only" notice.
 * With AdSense switched on: asks whether Google ad cookies are allowed, and nothing from Google loads until the visitor accepts.
 */
export default function CookieNotice() {
  const [mode, setMode] = useState<'info' | 'choice' | null>(null);

  useEffect(() => {
    try {
      if (adsenseEnabled) setMode(readAdsConsent() === null ? 'choice' : null);
      else setMode(localStorage.getItem(SEEN_KEY) !== 'seen' ? 'info' : null);
    } catch { setMode(null); }
  }, []);

  if (!mode) return null;

  const close = (consent?: 'granted' | 'denied') => {
    try { localStorage.setItem(SEEN_KEY, 'seen'); } catch { /* ignore */ }
    if (consent) writeAdsConsent(consent);
    setMode(null);
  };

  if (mode === 'choice') return <div className="cookieNotice" role="dialog" aria-label="Cookie choices">
    <div><b>Cookies and ads</b><span>CARTOMUX uses essential storage to keep you signed in. With your permission, Google may also use cookies to show ads. You can change this any time on the Cookies page.</span></div>
    <div className="cookieActions">
      <button className="btn green" onClick={() => close('granted')}>Allow ad cookies</button>
      <button className="btn light" onClick={() => close('denied')}>Essential only</button>
    </div>
  </div>;

  return <div className="cookieNotice" role="status">
    <div><b>Essential cookies only</b><span>CARTOMUX uses essential session storage to keep accounts signed in. Optional tracking is not active.</span></div>
    <button className="btn green" onClick={() => close()}>Got it</button>
  </div>;
}
