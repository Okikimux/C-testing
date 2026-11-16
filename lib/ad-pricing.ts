// Shared by the booking page (to show a price) and the server (the authoritative price).
// The server always recomputes the price itself; the browser's number is only a preview.

export type Placement = 'home' | 'marketplace' | 'product';
export const PLACEMENT_KEYS: Placement[] = ['home', 'marketplace', 'product'];
export const PLACEMENT_LABELS: Record<Placement, string> = { home: 'Home page', marketplace: 'Marketplace', product: 'Product pages' };
export const PLACEMENT_HINTS: Record<Placement, string> = {
  home: 'Banner on the first page every visitor sees',
  marketplace: 'A row between listings',
  product: 'A block under the description of a listing',
};

export type AdSettings = { bookings_open: boolean; min_days: number; max_days: number; max_advance_days: number };
export type AdPriceRow = { placement: Placement; price_per_day_kobo: number; max_concurrent: number; enabled: boolean };
export type AdDiscountRow = { min_days: number; percent: number };

export type QuoteLine = { placement: Placement; perDayKobo: number; days: number; totalKobo: number };
export type Quote = { lines: QuoteLine[]; subtotalKobo: number; discountPercent: number; discountKobo: number; totalKobo: number };

export const isPlacement = (value: unknown): value is Placement => PLACEMENT_KEYS.includes(value as Placement);

export function formatNaira(kobo: number) {
  const naira = kobo / 100;
  return `\u20A6${naira.toLocaleString('en-NG', { minimumFractionDigits: Number.isInteger(naira) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** The biggest discount whose minimum number of days the booking reaches. */
export function discountFor(discounts: AdDiscountRow[], days: number) {
  return discounts.filter(d => days >= d.min_days).reduce((best, d) => Math.max(best, d.percent), 0);
}

/** Price for the chosen pages and days. Throws a readable Error if something cannot be sold. */
export function quote(prices: AdPriceRow[], discounts: AdDiscountRow[], placements: Placement[], days: number): Quote {
  if (!placements.length) throw new Error('Choose at least one place for your ad.');
  if (!Number.isInteger(days) || days < 1) throw new Error('Choose how many days the ad should run.');
  const lines: QuoteLine[] = placements.map(placement => {
    const row = prices.find(p => p.placement === placement);
    if (!row || !row.enabled || row.price_per_day_kobo <= 0) throw new Error(`${PLACEMENT_LABELS[placement]} is not available to book right now.`);
    return { placement, perDayKobo: row.price_per_day_kobo, days, totalKobo: row.price_per_day_kobo * days };
  });
  const subtotalKobo = lines.reduce((sum, line) => sum + line.totalKobo, 0);
  const discountPercent = discountFor(discounts, days);
  const totalKobo = Math.round((subtotalKobo * (100 - discountPercent)) / 100);
  return { lines, subtotalKobo, discountPercent, discountKobo: subtotalKobo - totalKobo, totalKobo };
}

const LAGOS_OFFSET_MS = 60 * 60 * 1000; // Nigeria is UTC+1 all year

/** 'YYYY-MM-DD' for today in Nigeria. */
export function lagosToday(now = new Date()) {
  return new Date(now.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today starts immediately; a later date starts at midnight Nigerian time. */
export function bookingWindow(startDate: string | null | undefined, days: number, now = new Date()) {
  const today = lagosToday(now);
  const date = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : today;
  const startsAt = date <= today ? now : new Date(`${date}T00:00:00+01:00`);
  const endsAt = new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);
  return { startsAt, endsAt };
}

/** Returns a readable problem, or '' when the booking rules are met. */
export function bookingProblem(settings: AdSettings, days: number, startsAt: Date, now = new Date()): string {
  if (!settings.bookings_open) return 'Ad booking is not open yet. Please check back soon.';
  if (!Number.isInteger(days) || days < settings.min_days) return `Ads must run for at least ${settings.min_days} days.`;
  if (days > settings.max_days) return `Ads can run for at most ${settings.max_days} days at a time.`;
  if (Number.isNaN(startsAt.getTime())) return 'Choose a valid start date.';
  if (startsAt.getTime() < now.getTime() - 5 * 60 * 1000) return 'The start date cannot be in the past.';
  if (startsAt.getTime() > now.getTime() + settings.max_advance_days * 24 * 60 * 60 * 1000) return `You can book at most ${settings.max_advance_days} days ahead.`;
  return '';
}

// Ad content rules (same limits as the database).
export type AdContent = { advertiser: string; title: string; body: string; link_url: string; cta_label: string };
export function contentProblem(c: AdContent): string {
  const advertiser = c.advertiser.trim(), title = c.title.trim(), cta = c.cta_label.trim();
  if (advertiser.length < 2 || advertiser.length > 80) return 'Business name must be 2 to 80 characters.';
  if (title.length < 3 || title.length > 80) return 'Headline must be 3 to 80 characters.';
  if (c.body.trim().length > 200) return 'Description can be at most 200 characters.';
  if (cta.length < 2 || cta.length > 24) return 'Button text must be 2 to 24 characters.';
  try {
    const url = new URL(c.link_url.trim());
    if (url.protocol !== 'https:') return 'The link must start with https://';
  } catch { return 'Enter a valid link starting with https://'; }
  return '';
}
