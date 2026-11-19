'use client';
import { useEffect, useState } from 'react';
import { GraduationCap, Store, X } from 'lucide-react';
import { createClient } from '../lib/supabase';
import { ACCOUNT_TYPES } from '../lib/account-type';
import type { AccountType } from '../lib/account-type';
import { ACCOUNT_CHANGED_EVENT } from '../lib/use-account';
import { VendorFields } from './account-type-picker';

/** Confirmation dialog for switching between a student and a vendor account (uses the set_account_type function). */
export function SwitchAccountSheet({ current, initialBusinessName = '', initialCategory = '', onClose, onDone }: {
  current: AccountType;
  initialBusinessName?: string;
  initialCategory?: string;
  onClose: () => void;
  onDone: (next: AccountType, details: { businessName: string; businessCategory: string }) => void;
}) {
  const target: AccountType = current === 'vendor' ? 'student' : 'vendor';
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [category, setCategory] = useState(initialCategory);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const Icon = target === 'vendor' ? Store : GraduationCap;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, [busy, onClose]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const cleanName = businessName.trim();
    if (target === 'vendor' && cleanName.length < 2) { setError('Enter your business or shop name (at least 2 characters).'); return; }
    setBusy(true);
    setError('');
    const { error: rpcError } = await createClient().rpc('set_account_type', {
      p_account_type: target,
      p_business_name: target === 'vendor' ? cleanName : null,
      p_business_category: target === 'vendor' && category ? category : null,
    });
    if (rpcError) { setError(rpcError.message || 'Your account type could not be changed. Please try again.'); setBusy(false); return; }
    window.dispatchEvent(new Event(ACCOUNT_CHANGED_EVENT));
    onDone(target, { businessName: target === 'vendor' ? cleanName : businessName, businessCategory: target === 'vendor' ? category : initialCategory });
  }

  return (
    <div className="sheetOverlay" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="switch-account-title" onSubmit={submit}>
        <div className="sheetHead">
          <span className="sheetIcon"><Icon size={22} /></span>
          <div className="sheetTitle"><h3 id="switch-account-title">Switch to a {ACCOUNT_TYPES[target].label.toLowerCase()} account</h3><p>{ACCOUNT_TYPES[target].tagline}</p></div>
          <button type="button" className="iconBtn" aria-label="Close" onClick={onClose} disabled={busy}><X size={18} /></button>
        </div>

        {target === 'vendor' ? <>
          <ul className="switchPoints">{ACCOUNT_TYPES.vendor.points.map(point => <li key={point}>{point}</li>)}</ul>
          <VendorFields idPrefix="switch" businessName={businessName} onBusinessName={setBusinessName} category={category} onCategory={setCategory} />
          <p className="switchNote">Verification is separate. You can apply for the vendor badge from the Verification page.</p>
        </> : <>
          <ul className="switchPoints warn">
            <li>Your storefront page is hidden from the public (it is not deleted).</li>
            <li>Seller analytics are hidden.</li>
            <li>Your listings, chats and transactions stay exactly as they are.</li>
            <li>Your business details are kept, so switching back is instant.</li>
          </ul>
          <p className="switchNote">Verification is separate and is not changed by this switch.</p>
        </>}

        {error && <div className="error" role="alert">{error}</div>}
        <div className="sheetActions">
          <button type="button" className="btn light" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn green" disabled={busy}>{busy ? 'Switching...' : `Switch to ${ACCOUNT_TYPES[target].label.toLowerCase()}`}</button>
        </div>
      </form>
    </div>
  );
}
