import { NextResponse } from 'next/server';
import { getAdsContext, isVerifiedAdvertiser, notVerifiedResponse } from '../../../../lib/ads-server';
import { contentProblem } from '../../../../lib/ad-pricing';

export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const clean = (value: FormDataEntryValue | null, max: number) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);

/** Creates or updates the content of the signed-in advertiser's own ad. Does not take payment. */
export async function POST(request: Request) {
  const ctx = await getAdsContext();
  if (!ctx.ok) return ctx.response;
  const { user, admin } = ctx;
  if (!(await isVerifiedAdvertiser(admin, user.id))) return notVerifiedResponse();

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: 'Could not read the form.' }, { status: 400 }); }

  const content = {
    advertiser: clean(form.get('advertiser'), 80),
    title: clean(form.get('title'), 80),
    body: clean(form.get('body'), 200),
    link_url: clean(form.get('link_url'), 500),
    cta_label: clean(form.get('cta_label'), 24) || 'Learn more',
  };
  const problem = contentProblem(content);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const adId = clean(form.get('adId'), 64);
  let existing: { id: string; image_url: string | null; status: string } | null = null;
  if (adId) {
    const { data, error } = await admin.from('ads').select('id,owner_id,source,status,image_url').eq('id', adId).maybeSingle();
    if (error || !data || data.owner_id !== user.id || data.source !== 'self') return NextResponse.json({ error: 'Ad not found.' }, { status: 404 });
    if (data.status === 'removed') return NextResponse.json({ error: 'This ad was removed by CARTOMUX and cannot be edited.' }, { status: 403 });
    existing = data;
  }

  let imageUrl: string | null = existing?.image_url ?? null;
  if (form.get('remove_image') === '1') imageUrl = null;
  const file = form.get('image');
  if (file && typeof file !== 'string' && file.size > 0) {
    const ext = IMAGE_TYPES[file.type];
    if (!ext) return NextResponse.json({ error: 'Use a JPG, PNG or WebP image.' }, { status: 400 });
    if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'The image is over 2 MB. Choose a smaller one.' }, { status: 400 });
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage.from('ad-images').upload(path, await file.arrayBuffer(), { contentType: file.type, cacheControl: '31536000' });
    if (uploadError) return NextResponse.json({ error: 'Could not upload the image. Please try again.' }, { status: 500 });
    imageUrl = admin.storage.from('ad-images').getPublicUrl(path).data.publicUrl;
  }

  const row = { advertiser: content.advertiser, title: content.title, body: content.body || null, link_url: content.link_url, cta_label: content.cta_label, image_url: imageUrl };
  if (existing) {
    const { data, error } = await admin.from('ads').update(row).eq('id', existing.id).eq('owner_id', user.id).select('*').single();
    if (error) return NextResponse.json({ error: 'Could not save your ad.' }, { status: 500 });
    return NextResponse.json({ ad: data });
  }
  const { data, error } = await admin.from('ads').insert({ ...row, owner_id: user.id, source: 'self', status: 'draft', placements: ['marketplace'], starts_at: new Date().toISOString(), ends_at: null }).select('*').single();
  if (error) return NextResponse.json({ error: 'Could not save your ad.' }, { status: 500 });
  return NextResponse.json({ ad: data });
}
