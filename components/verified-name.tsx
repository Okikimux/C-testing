'use client';

export function VerifiedBadge({ size = 17 }: { size?: number }) {
  return <img className="verifiedBadge" src="/campusdrop-verification-badge.png" width={size} height={size} alt="Verified" title="Verified on CARTOMUX" />;
}

export function VerifiedName({ userId, name, className = '', verified = false }: { userId?: string | null; name?: string | null; className?: string; verified?: boolean }) {
  return <span className={`verifiedName ${className}`}><span>{name || 'CARTOMUX student'}</span>{verified && <VerifiedBadge />}</span>;
}
