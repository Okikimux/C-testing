'use client';

import { useEffect, useState } from 'react';
import { adsenseEnabled, onAdsConsentChange, readAdsConsent, writeAdsConsent, type AdsConsent } from '../lib/consent';

/** Lets a visitor see and change their advertising-cookie choice. Renders nothing unless AdSense is switched on. */
export default function AdsConsentControl() {
  const [consent, setConsent] = useState<AdsConsent>(null);
  useEffect(() => {
    if (!adsenseEnabled) return;
    setConsent(readAdsConsent());
    return onAdsConsentChange(() => setConsent(readAdsConsent()));
  }, []);
  if (!adsenseEnabled) return null;
  return <div className="consentControl">
    <b>Your advertising choice</b>
    <p className="muted">{consent === 'granted' ? 'You allow Google ad cookies.' : consent === 'denied' ? 'You use essential cookies only. No Google ads are loaded.' : 'You have not chosen yet.'}</p>
    <div className="actionsRow">
      <button type="button" className={`btn ${consent === 'granted' ? 'green' : 'light'}`} onClick={() => writeAdsConsent('granted')}>Allow ad cookies</button>
      <button type="button" className={`btn ${consent === 'denied' ? 'primary' : 'light'}`} onClick={() => writeAdsConsent('denied')}>Essential only</button>
    </div>
  </div>;
}
