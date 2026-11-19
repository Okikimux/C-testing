import Link from 'next/link';
import type { ReactNode } from 'react';
import { GraduationCap, Lock, Store } from 'lucide-react';
import { ACCOUNT_TYPES, VENDOR_FEATURE_COPY } from '../lib/account-type';
import type { AccountType, Feature } from '../lib/account-type';

/** Small "Student" / "Vendor" pill shown next to names. */
export function AccountBadge({ type, className = '' }: { type: AccountType | null | undefined; className?: string }) {
  if (!type) return null;
  const Icon = type === 'vendor' ? Store : GraduationCap;
  return <span className={`accountBadge ${type} ${className}`.trim()}><Icon size={13} aria-hidden="true" />{ACCOUNT_TYPES[type].label}</span>;
}

/** Shown instead of a vendor-only page when a student opens it. The route itself is unchanged. */
export function VendorOnlyGate({ feature, icon }: { feature: Feature; icon?: ReactNode }) {
  const copy = VENDOR_FEATURE_COPY[feature];
  return (
    <div className="lockCard">
      <span className="lockIcon">{icon || <Lock size={26} />}</span>
      <span className="eyebrow">Vendor feature</span>
      <h1>{copy.title}</h1>
      <p className="muted">{copy.text}</p>
      <ul className="lockPoints">
        {ACCOUNT_TYPES.vendor.points.map(point => <li key={point}>{point}</li>)}
      </ul>
      <div className="lockActions">
        <Link href="/settings#account-type" className="btn green"><Store size={17} /> Switch to a vendor account</Link>
        <Link href="/profile" className="btn light">Back to profile</Link>
      </div>
    </div>
  );
}
