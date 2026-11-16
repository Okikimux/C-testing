'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { friendlyError } from '../lib/friendly-error';
import { ImagePlus, Megaphone, Pause, Pencil, Play, Trash2, X } from 'lucide-react';
import { createClient } from '../lib/supabase';
import { compressImage } from '../lib/image-compress';
import { PLACEMENTS, type Ad, type AdPlacement } from '../lib/ads';
import { useToast } from './toast';

type Stats = Record<string, { views: number; clicks: number }>;
type FormState = {
  id: string; advertiser: string; title: string; body: string; link_url: string; cta_label: string;
  placements: AdPlacement[]; starts: string; ends: string; image_url: string;
};
const EMPTY: FormState = { id: '', advertiser: '', title: '', body: '', link_url: 'https://', cta_label: 'Learn more', placements: ['marketplace'], starts: '', ends: '', image_url: '' };
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// <input type="datetime-local"> works in local time, the database stores UTC.
const toInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function adState(ad: Ad) {
  if (ad.status === 'removed') return { label: 'Removed', tone: 'bad' };
  if (ad.status === 'draft') return { label: 'Draft (unpaid)', tone: 'muted' };
  if (ad.status === 'paused') return { label: 'Paused', tone: 'muted' };
  const now = Date.now();
  if (new Date(ad.starts_at).getTime() > now) return { label: 'Scheduled', tone: 'info' };
  if (ad.ends_at && new Date(ad.ends_at).getTime() <= now) return { label: 'Ended', tone: 'muted' };
  return { label: 'Live', tone: 'live' };
}

export default function AdminAds() {
  const toast = useToast();
  const [ads, setAds] = useState<Ad[]>([]);
  const [stats, setStats] = useState<Stats>({});
  const [form, setForm] = useState<FormState>(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState('');
  const editing = Boolean(form.id);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from('ads').select('*').order('created_at', { ascending: false });
    if (error) { console.warn('CARTOMUX ads load failed:', error.message); setSetupError('missing'); setLoading(false); return; }
    setSetupError('');
    setAds((data || []) as Ad[]);
    const { data: rows } = await supabase.rpc('ad_stats');
    const next: Stats = {};
    for (const row of (rows || []) as Array<{ ad_id: string; views: number | string; clicks: number | string }>) {
      next[row.ad_id] = { views: Number(row.views), clicks: Number(row.clicks) };
    }
    setStats(next);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Local preview of the chosen image.
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(current => ({ ...current, [key]: value }));
  const togglePlacement = (value: AdPlacement) => setForm(current => ({
    ...current,
    placements: current.placements.includes(value) ? current.placements.filter(p => p !== value) : [...current.placements, value],
  }));
  const reset = () => { setForm(EMPTY); setFile(null); };

  function validate(): string {
    if (form.advertiser.trim().length < 2 || form.advertiser.trim().length > 80) return 'Advertiser name must be 2 to 80 characters.';
    if (form.title.trim().length < 3 || form.title.trim().length > 80) return 'Headline must be 3 to 80 characters.';
    if (form.body.trim().length > 200) return 'Description can be at most 200 characters.';
    if (form.cta_label.trim().length < 2 || form.cta_label.trim().length > 24) return 'Button text must be 2 to 24 characters.';
    try {
      const url = new URL(form.link_url.trim());
      if (url.protocol !== 'https:') return 'The link must start with https://';
    } catch { return 'Enter a valid link starting with https://'; }
    if (!form.placements.length) return 'Choose at least one place for the ad.';
    if (form.starts && form.ends && new Date(form.ends) <= new Date(form.starts)) return 'The end date must be after the start date.';
    return '';
  }

  async function save() {
    const problem = validate();
    if (problem) { toast.error(problem); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Sign in again to continue.'); return; }

      let imageUrl = form.image_url || null;
      if (file) {
        const compressed = await compressImage(file, 1000, 0.82);
        if (compressed.size > MAX_IMAGE_BYTES) { toast.error('That image is still over 2 MB after compression. Choose a smaller one.'); return; }
        const ext = compressed.type === 'image/webp' ? 'webp' : compressed.type === 'image/png' ? 'png' : 'jpg';
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('ad-images').upload(path, compressed, { contentType: compressed.type, cacheControl: '31536000' });
        if (uploadError) { toast.error(friendlyError(uploadError, 'Image upload failed. Please try again.')); return; }
        imageUrl = supabase.storage.from('ad-images').getPublicUrl(path).data.publicUrl;
      }

      const row = {
        advertiser: form.advertiser.trim(),
        title: form.title.trim(),
        body: form.body.trim() || null,
        link_url: form.link_url.trim(),
        cta_label: form.cta_label.trim(),
        placements: form.placements,
        image_url: imageUrl,
        starts_at: form.starts ? new Date(form.starts).toISOString() : new Date().toISOString(),
        ends_at: form.ends ? new Date(form.ends).toISOString() : null,
      };
      const { error } = editing
        ? await supabase.from('ads').update(row).eq('id', form.id)
        : await supabase.from('ads').insert({ ...row, created_by: user.id });
      if (error) { toast.error(friendlyError(error)); return; }
      toast.success(editing ? 'Ad updated.' : 'Ad created.');
      reset();
      await load();
    } finally {
      setSaving(false);
    }
  }

  function edit(ad: Ad) {
    setForm({
      id: ad.id, advertiser: ad.advertiser, title: ad.title, body: ad.body || '', link_url: ad.link_url, cta_label: ad.cta_label,
      placements: ad.placements, starts: toInput(ad.starts_at), ends: toInput(ad.ends_at), image_url: ad.image_url || '',
    });
    setFile(null);
    document.getElementById('ad-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function togglePause(ad: Ad) {
    const { error } = await createClient().from('ads').update({ status: ad.status === 'active' ? 'paused' : 'active' }).eq('id', ad.id);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success(ad.status === 'active' ? 'Ad paused.' : 'Ad resumed.');
    await load();
  }

  async function takeDown(ad: Ad) {
    const reason = window.prompt('Why is this ad being removed? The advertiser will see this reason.');
    if (reason === null) return;
    if (reason.trim().length < 3) { toast.error('Please give a short reason.'); return; }
    const { error } = await createClient().from('ads').update({ status: 'removed', removed_reason: reason.trim().slice(0, 300) }).eq('id', ad.id);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success('Ad removed. It no longer shows anywhere.');
    await load();
  }

  async function restore(ad: Ad) {
    const { error } = await createClient().from('ads').update({ status: 'paused', removed_reason: null }).eq('id', ad.id);
    if (error) { toast.error(friendlyError(error)); return; }
    toast.success('Ad restored as paused. Press Resume to show it again.');
    await load();
  }

  async function remove(ad: Ad) {
    if (!window.confirm(`Delete "${ad.title}" and its view and click counts? This cannot be undone.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('ads').delete().eq('id', ad.id);
    if (error) { toast.error(ad.source === 'self' ? 'This ad has bookings and cannot be deleted. Use Remove instead.' : friendlyError(error)); return; }
    // Best effort: remove the stored image too.
    const marker = '/ad-images/';
    if (ad.image_url?.includes(marker)) void supabase.storage.from('ad-images').remove([decodeURIComponent(ad.image_url.split(marker)[1].split('?')[0])]);
    toast.success('Ad deleted.');
    if (form.id === ad.id) reset();
    await load();
  }

  const shownImage = preview || form.image_url;
  const totals = useMemo(() => Object.values(stats).reduce((sum, s) => ({ views: sum.views + s.views, clicks: sum.clicks + s.clicks }), { views: 0, clicks: 0 }), [stats]);

  return <section className="panel adminQueue adminAds">
    <div className="sectionHead"><div><h2>Advertising</h2><p className="muted" style={{ margin: 0 }}>Local vendor ads shown as “Sponsored”. {ads.length > 0 && `${totals.views} views and ${totals.clicks} clicks in total.`}</p></div></div>

    {setupError ? <div className="notice adsSetup"><Megaphone size={18} /><span>Ads are not set up in the database yet. Run <b>supabase/campora-ads.sql</b> in the Supabase SQL Editor, then reload this page.</span></div> : <>
      <div className="adForm" id="ad-form">
        <h3>{editing ? 'Edit ad' : 'New ad'}</h3>
        <div className="split">
          <div className="field"><label htmlFor="ad-advertiser">Advertiser</label><input id="ad-advertiser" maxLength={80} value={form.advertiser} onChange={e => set('advertiser', e.target.value)} placeholder="e.g. Campus Print Hub" /></div>
          <div className="field"><label htmlFor="ad-title">Headline</label><input id="ad-title" maxLength={80} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Printing from ₦20 a page" /></div>
        </div>
        <div className="field"><label htmlFor="ad-body">Description (optional)</label><textarea id="ad-body" maxLength={200} rows={2} value={form.body} onChange={e => set('body', e.target.value)} placeholder="One short line about the offer." /><small>{form.body.length}/200</small></div>
        <div className="split">
          <div className="field"><label htmlFor="ad-link">Link (https only)</label><input id="ad-link" inputMode="url" value={form.link_url} onChange={e => set('link_url', e.target.value)} /></div>
          <div className="field"><label htmlFor="ad-cta">Button text</label><input id="ad-cta" maxLength={24} value={form.cta_label} onChange={e => set('cta_label', e.target.value)} /></div>
        </div>
        <div className="field">
          <label>Where it appears</label>
          <div className="placementChoices">
            {PLACEMENTS.map(p => <label key={p.value} className={`placementChoice ${form.placements.includes(p.value) ? 'on' : ''}`}><input type="checkbox" checked={form.placements.includes(p.value)} onChange={() => togglePlacement(p.value)} /><span><b>{p.label}</b><small>{p.hint}</small></span></label>)}
          </div>
        </div>
        <div className="split">
          <div className="field"><label htmlFor="ad-start">Starts (blank = now)</label><input id="ad-start" type="datetime-local" value={form.starts} onChange={e => set('starts', e.target.value)} /></div>
          <div className="field"><label htmlFor="ad-end">Ends (blank = no end date)</label><input id="ad-end" type="datetime-local" value={form.ends} onChange={e => set('ends', e.target.value)} /></div>
        </div>
        <div className="field">
          <label htmlFor="ad-image">Image (optional, JPG, PNG or WebP)</label>
          <div className="adImagePick">
            {shownImage ? <span className="adImageThumb" style={{ backgroundImage: `url("${shownImage}")` }} /> : <span className="adImageThumb blank"><ImagePlus size={22} /></span>}
            <input id="ad-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { setFile(e.target.files?.[0] || null); }} />
            {(file || form.image_url) && <button type="button" className="btn light" onClick={() => { setFile(null); set('image_url', ''); }}><X size={15} /> Remove image</button>}
          </div>
          <small>Square images work best. Large images are resized automatically.</small>
        </div>
        <div className="actionsRow">
          <button type="button" className="btn green" disabled={saving} onClick={save}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create ad'}</button>
          {editing && <button type="button" className="btn light" onClick={reset}>Cancel edit</button>}
        </div>
      </div>

      <div className="adList">
        <h3>All ads</h3>
        {loading ? <p className="muted">Loading…</p> : !ads.length ? <div className="empty"><Megaphone size={28} /><b>No ads yet</b><p>Create the first one above. Until then, visitors see a small “Advertise with CARTOMUX” prompt.</p></div> : ads.map(ad => {
          const state = adState(ad);
          const s = stats[ad.id] || { views: 0, clicks: 0 };
          const ctr = s.views ? `${((s.clicks / s.views) * 100).toFixed(1)}%` : '–';
          return <div className="adRowAdmin" key={ad.id}>
            <span className="adImageThumb" style={ad.image_url ? { backgroundImage: `url("${ad.image_url}")` } : undefined}>{!ad.image_url && <Megaphone size={20} />}</span>
            <div className="adRowCopy">
              <div className="adRowTop"><b>{ad.title}</b><span className={`adState ${state.tone}`}>{state.label}</span></div>
              <div className="muted">{ad.source === 'self' ? 'Self-serve · ' : ''}{ad.advertiser} · {ad.placements.map(p => PLACEMENTS.find(x => x.value === p)?.label || p).join(', ')}</div>
              <div className="muted">{new Date(ad.starts_at).toLocaleDateString()} → {ad.ends_at ? new Date(ad.ends_at).toLocaleDateString() : 'no end date'}</div>
              {ad.status === 'removed' && ad.removed_reason && <div className="muted">Reason: {ad.removed_reason}</div>}
              <div className="adNumbers"><span><b>{s.views}</b> views</span><span><b>{s.clicks}</b> clicks</span><span><b>{ctr}</b> click rate</span></div>
            </div>
            <div className="adRowActions">
              {ad.source !== 'self' && <button type="button" className="btn light" onClick={() => edit(ad)}><Pencil size={15} /> Edit</button>}
              {ad.status === 'removed' ? <button type="button" className="btn light" onClick={() => restore(ad)}><Play size={15} /> Restore</button> : ad.status !== 'draft' && <button type="button" className="btn light" onClick={() => togglePause(ad)}>{ad.status === 'active' ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Resume</>}</button>}
              {ad.source === 'self' && ad.status !== 'removed' && <button type="button" className="btn danger" onClick={() => takeDown(ad)}><X size={15} /> Remove</button>}
              {ad.source !== 'self' && <button type="button" className="btn danger" onClick={() => remove(ad)}><Trash2 size={15} /> Delete</button>}
            </div>
          </div>;
        })}
      </div>
    </>}
  </section>;
}
