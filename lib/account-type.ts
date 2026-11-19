/* Student vs vendor accounts.

   `profiles.role` is the permission role (student / admin) and is never used here.
   `profiles.account_type` says what kind of seller someone is. To change which features
   each type can use, edit FEATURES below. Nothing else needs to change. */

export type AccountType = 'student' | 'vendor';

export const ACCOUNT_TYPES: Record<AccountType, { label: string; plural: string; tagline: string; points: string[] }> = {
  student: {
    label: 'Student',
    plural: 'students',
    tagline: 'Buy, sell and rent around campus.',
    points: ['Sell your own items and services', 'Find rooms, gadgets and books', 'Student verification badge'],
  },
  vendor: {
    label: 'Vendor',
    plural: 'vendors',
    tagline: 'Run a shop or business for the campus community.',
    points: ['Your own shareable storefront', 'Seller analytics for every listing', 'Vendor verification badge'],
  },
};

/** The same list the verification form uses, so business details carry across. */
export const BUSINESS_CATEGORIES = ['Retail / shop', 'Food and groceries', 'Fashion', 'Repairs / artisan', 'Accommodation', 'Services', 'Other'] as const;

/** Which account types can use each feature. */
export const FEATURES = {
  storefront: ['vendor'],
  analytics: ['vendor'],
} as const satisfies Record<string, readonly AccountType[]>;

export type Feature = keyof typeof FEATURES;

export const normaliseAccountType = (value: unknown): AccountType => (value === 'vendor' ? 'vendor' : 'student');

/**
 * `accountType === null` means "unknown" (for example the database update has not been applied yet).
 * Unknown never locks anyone out, so the app keeps working during the rollout.
 */
export function canUse(feature: Feature, accountType: AccountType | null): boolean {
  if (accountType === null) return true;
  return (FEATURES[feature] as readonly AccountType[]).includes(accountType);
}

export const VENDOR_FEATURE_COPY: Record<Feature, { title: string; text: string }> = {
  storefront: {
    title: 'Storefronts are for vendor accounts',
    text: 'A storefront gives your business its own shareable page with all of your active listings. Switch to a vendor account to create one.',
  },
  analytics: {
    title: 'Seller analytics are for vendor accounts',
    text: 'See views, inquiries and favourites for every listing. Switch to a vendor account to unlock analytics.',
  },
};

/** True when the error means the account-type columns / functions are not in the database yet. */
export const isMissingAccountSchema = (error: { code?: string; message?: string } | null | undefined) =>
  !!error && (error.code === '42703' || error.code === '42883' || /account_type|business_name|business_category|set_account_type/i.test(error.message || ''));

export type AccountInfo = { accountType: AccountType; businessName: string | null; businessCategory: string | null };

/** Looks up the account type (and business name) of other users, e.g. the seller of a listing. Never throws. */
export async function fetchAccountInfo(supabase: any, ids: Array<string | null | undefined>): Promise<Map<string, AccountInfo>> {
  const unique = Array.from(new Set(ids.filter(Boolean))) as string[];
  const result = new Map<string, AccountInfo>();
  if (!unique.length) return result;
  const { data, error } = await supabase.from('profiles').select('id,account_type,business_name,business_category').in('id', unique);
  if (error) { console.warn('CARTOMUX: account type lookup failed', error.message); return result; }
  for (const row of data || []) result.set(row.id, { accountType: normaliseAccountType(row.account_type), businessName: row.business_name || null, businessCategory: row.business_category || null });
  return result;
}
