'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BackButton } from '../../../components/back-button';
import { createClient } from '../../../lib/supabase';
import { CheckCircle2, ExternalLink, Info, Store } from 'lucide-react';
import { VendorOnlyGate } from '../../../components/account-badge';
import { useMyAccount } from '../../../lib/use-account';
import { canUse } from '../../../lib/account-type';

function initialsOf(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

export default function ManageStore() {
  const [userId, setUserId] = useState(''), [name, setName] = useState(''), [slug, setSlug] = useState(''), [savedSlug, setSavedSlug] = useState(''), [description, setDescription] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [ok, setOk] = useState(false), [storeChecked, setStoreChecked] = useState(false);
  const account = useMyAccount();
  useEffect(() => {
    const s = createClient();
    s.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { location.assign('/auth/login?next=/store/manage'); return; }
      setUserId(user.id);
      const { data } = await s.from('vendor_storefronts').select('*').eq('owner_id', user.id).maybeSingle();
      if (data) { setName(data.store_name); setSlug(data.slug); setSavedSlug(data.slug); setDescription(data.description || ''); }
      setStoreChecked(true);
    });
  }, []);
  // First visit: start from the business name chosen at registration.
  useEffect(() => {
    if (!storeChecked || savedSlug || !account.businessName) return;
    setName(current => current || account.businessName);
    setSlug(current => current || account.businessName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  }, [storeChecked, savedSlug, account.businessName]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setNotice(''); setOk(false);
    const clean = slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (clean.length < 3) { setNotice('Store address must be at least 3 characters.'); setBusy(false); return; }
    const { error } = await createClient().from('vendor_storefronts').upsert({ owner_id: userId, store_name: name.trim(), slug: clean, description: description.trim() || null, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
    setNotice(error?.message || 'Your storefront has been saved.');
    if (!error) { setSlug(clean); setSavedSlug(clean); setOk(true); }
    setBusy(false);
  }
  const shownSlug = slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'your-store';
  if (!account.loading && !canUse('storefront', account.accountType)) return <main className="section"><BackButton /><div className="container"><VendorOnlyGate feature="storefront" icon={<Store size={26} />} locked={account.typeLocked} /></div></main>;
  return <main className="section"><BackButton /><div className="container"><div className="manageLayout">
    <div className="formCard">
      <span className="eyebrow">VENDOR STOREFRONT</span>
      <h1><Store size={23} /> Set up your store</h1>
      <p className="muted">Create a shareable page for your CARTOMUX business.</p>
      <form onSubmit={save}>
        <div className="field"><label htmlFor="store-name">Store name</label><input id="store-name" required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. TechWorld" /></div>
        <div className="field"><label htmlFor="store-slug">Store address</label>
          <div className="urlField"><span className="urlPrefix">cartomux.com.ng/store/</span><input id="store-slug" required minLength={3} maxLength={70} value={slug} onChange={e => setSlug(e.target.value)} placeholder="techworld" autoCapitalize="none" autoCorrect="off" spellCheck={false} /></div>
          <small>Letters, numbers and dashes only. Your page: cartomux.com.ng/store/{shownSlug}</small>
        </div>
        <div className="field"><label htmlFor="store-about">About your store <span className="charCount">{description.length}/800</span></label><textarea id="store-about" maxLength={800} value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell customers what you sell..." /></div>
        {notice && <div className={ok ? 'notice' : 'error'} role="status">{ok ? <CheckCircle2 size={17} /> : <Info size={17} />}<span>{notice}</span></div>}
        <button className="btn green full" disabled={busy}>{busy ? 'Saving...' : 'Save storefront'}</button>
      </form>
      {savedSlug && <div className="manageSaved"><span>Your storefront is live.</span><Link href={`/store/${savedSlug}`} className="textLink"><ExternalLink size={14} style={{ verticalAlign: '-2px', marginRight: 5 }} />View storefront</Link></div>}
    </div>

    <aside className="previewCard" aria-label="Storefront preview">
      <span className="previewLabel">Live preview</span>
      <div className="previewBanner" />
      <div className="previewBody">
        <div className="previewLogo">{initialsOf(name) || <Store size={26} />}</div>
        <h3>{name.trim() || 'Your store name'}</h3>
        <div className="previewUrl">cartomux.com.ng/store/{shownSlug}</div>
        {description.trim() ? <p>{description.trim()}</p> : <p className="muted">Your store description will appear here.</p>}
      </div>
    </aside>
  </div></div></main>;
}
