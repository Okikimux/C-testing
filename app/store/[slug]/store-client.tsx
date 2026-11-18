'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, GraduationCap, Package, Store } from 'lucide-react';
import { createClient } from '../../../lib/supabase';
import { Avatar } from '../../../components/avatar';
import { CardSkeleton } from '../../../components/skeleton';
import { EmptyState } from '../../../components/ui-bits';

export default function StoreClient({ slug }: { slug: string }) {
  const [store, setStore] = useState<any>(null), [items, setItems] = useState<any[]>([]), [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true; const s = createClient();
    (async () => {
      const { data } = await s.from('vendor_storefronts').select('*').eq('slug', slug).maybeSingle();
      if (!data) { if (live) setLoading(false); return; }
      const [{ data: profile }, { data: listings }] = await Promise.all([
        s.from('profiles').select('id,full_name,avatar_url,campus').eq('id', data.owner_id).maybeSingle(),
        s.from('listings').select('id,title,price,listing_type,payment_initial,category,campus,listing_images(url)').eq('seller_id', data.owner_id).eq('status', 'available').order('created_at', { ascending: false }),
      ]);
      if (live) { setStore({ ...data, profile }); setItems(listings || []); setLoading(false); }
    })();
    return () => { live = false; };
  }, [slug]);
  return <main className="section"><div className="container">
    <Link href="/marketplace" className="productBack"><ArrowLeft size={17} /> Marketplace</Link>
    {loading ? <div className="grid">{[1, 2, 3].map(x => <CardSkeleton key={x} />)}</div>
    : !store ? <EmptyState icon={<Store size={28} />} title="Store not found" text="This storefront may have been removed or the address may be incorrect." action={<Link href="/marketplace" className="btn green">Browse marketplace</Link>} />
    : <>
      <section className="heroCard">
        <div className="heroCardInner">
          <Avatar url={store.logo_url || store.profile?.avatar_url} name={store.store_name} size="lg" />
          <div className="heroCardCopy">
            <span className="eyebrow">CARTOMUX STOREFRONT</span>
            <h1>{store.store_name}</h1>
            {store.description && <p>{store.description}</p>}
            <div className="heroStats">
              <span className="heroStat"><GraduationCap size={15} />{store.profile?.campus || 'CARTOMUX vendor'}</span>
              <span className="heroStat"><Package size={15} />{items.length} active listing{items.length === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>
      </section>
      <div className="sectionHead"><div><h2>Available listings</h2><p className="muted">{items.length} active listing{items.length === 1 ? '' : 's'}</p></div></div>
      {items.length ? <div className="grid">{items.map(item => {
        const image = item.listing_images?.[0]?.url;
        const price = Number(item.listing_type === 'accommodation' ? (item.payment_initial ?? item.price ?? 0) : item.price || 0);
        return <Link className="card" href={`/product/${item.id}`} key={item.id}>
          <div className="pic" style={image ? { backgroundImage: `url(${image})` } : undefined}><span className="priceTag">₦{price.toLocaleString()}</span></div>
          <div className="cardbody"><h3>{item.title}</h3><div className="cardMeta">{item.category} · {item.campus}</div></div>
        </Link>;
      })}</div>
      : <EmptyState icon={<Package size={26} />} title="No active listings" text="This vendor has no active listings right now. Check back soon." />}
    </>}
  </div></main>;
}
