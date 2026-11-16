// Advertising-cookie choice. Only used when Google AdSense is switched on
// (NEXT_PUBLIC_ADSENSE_CLIENT is set). 'granted' | 'denied' | null (not asked yet).
export type AdsConsent = 'granted' | 'denied' | null;
const KEY = 'campora-ads-consent';
const EVENT = 'campora-consent-change';

export const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || '';
export const adsenseEnabled = adsenseClient.startsWith('ca-pub-');

export function readAdsConsent(): AdsConsent {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function writeAdsConsent(value: Exclude<AdsConsent, null>) {
  try { localStorage.setItem(KEY, value); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Calls back whenever the choice changes (this tab or another). Returns an unsubscribe function. */
export function onAdsConsentChange(callback: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === KEY) callback(); };
  window.addEventListener(EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(EVENT, callback); window.removeEventListener('storage', onStorage); };
}
