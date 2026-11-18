'use client';
import { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Send, X } from 'lucide-react';
import { createClient } from '../lib/supabase';

export default function ViewingRequestButton({ listingId, sellerId }: { listingId: string; sellerId: string }) {
  const [open, setOpen] = useState(false), [when, setWhen] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey); };
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const s = createClient();
    const { data: { user } } = await s.auth.getUser();
    if (!user) { location.assign(`/auth/login?next=/product/${listingId}`); return; }
    if (!when || new Date(when).getTime() <= Date.now()) { setNotice('Choose a future date and time.'); setSent(false); return; }
    setBusy(true);
    const { error } = await s.from('viewing_requests').insert({ listing_id: listingId, seller_id: sellerId, buyer_id: user.id, requested_for: new Date(when).toISOString(), message: message.trim() || null });
    setNotice(error?.message || 'Viewing request sent to the landlord.');
    setSent(!error);
    if (!error) { setOpen(false); setWhen(''); setMessage(''); }
    setBusy(false);
  }

  return <>
    <button className="btn light actionWide" type="button" onClick={() => { setNotice(''); setOpen(true); }}><CalendarDays size={17} /> Request inspection</button>
    {!open && notice && <div className="inlineNote" role="status">{sent && <CheckCircle2 size={16} />}<span>{notice}</span></div>}
    {open && <div className="sheetOverlay" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <form className="sheet" role="dialog" aria-modal="true" aria-labelledby="viewing-sheet-title" onSubmit={submit}>
        <div className="sheetHead">
          <span className="sheetIcon"><CalendarDays size={22} /></span>
          <div className="sheetTitle"><h3 id="viewing-sheet-title">Request a viewing</h3><p>Pick a time that suits you. The landlord will accept or suggest another.</p></div>
          <button type="button" className="iconBtn" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <div className="field"><label htmlFor="viewing-when">Preferred date and time</label><input id="viewing-when" type="datetime-local" required value={when} min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} onChange={e => setWhen(e.target.value)} /></div>
        <div className="field"><label htmlFor="viewing-note">Message (optional)</label><textarea id="viewing-note" maxLength={500} value={message} onChange={e => setMessage(e.target.value)} placeholder="Add a note for the landlord..." /></div>
        {notice && <div className="error" role="status">{notice}</div>}
        <div className="sheetActions"><button className="btn light" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="btn green" disabled={busy}><Send size={16} />{busy ? 'Sending...' : 'Send request'}</button></div>
      </form>
    </div>}
  </>;
}
