'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, GraduationCap, Package, Search } from 'lucide-react';
import { createClient } from '../../../lib/supabase';
import { CardSkeleton } from '../../../components/skeleton';
import { EmptyState } from '../../../components/ui-bits';

const CATEGORIES = ['Phones & Gadgets', 'Laptops', 'Fashion', 'Books', 'Gaming', 'Services', 'Accommodation'];

export default function CampusClient({ slug }: { slug: string }) {
  const [name, setName] = useState(slug.replace(/-/g, ' ')), [items, setItems] = useState<any[]>([]), [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true; const s = createClient();
    (async () => {
      const { data: campus } = await s.from('campus_directory').select('name,description,city,state').eq('slug', slug).maybeSingle();
      const campusName = campus?.name || slug.replace(/-/g, ' ');
      if (live) setName(campusName);
      const { data } = await s.from('listings').select('id,title,price,listing_type,payment_initial,category,campus,listing_images(url)').eq('status', 'available').ilike('campus', campusName).order('created_at', { ascending: false }).limit(100);
      if (live) { setItems(data || []); setLoading(false); }
    })();
    return () => { live = false; };
  }, [slug]);
  return <main className="section"><div className="container">
    <Link href="/marketplace" className="productBack"><ArrowLeft size={17} /> All marketplace</Link>
    <section className="heroCard">
      <div className="heroCardInner">
        <span className="heroMark"><GraduationCap size={34} /></span>
        <div className="heroCardCopy">
          <span className="eyebrow">CARTOMUX CAMPUS</span>
          <h1>{name}</h1>
          <p>Products, accommodation and services around your campus.</p>
          {!loading && <div className="heroStats"><span className="heroStat"><Package size={15} />{items.length} active listing{items.length === 1 ? '' : 's'}</span></div>}
        </div>
        <Link className="btn green" href={`/marketplace?campus=${encodeURIComponent(name)}`}>Explore listings</Link>
      </div>
    </section>
    <div className="catChips quickChips" role="group" aria-label="Browse this campus by category">
      {CATEGORIES.map(c => <Link key={c} className="chip" href={`/marketplace?campus=${encodeURIComponent(name)}&category=${encodeURIComponent(c)}`}>{c}</Link>)}
    </div>
    <div className="sectionHead"><div><h2>Available around {name}</h2><p className="muted">Discover what your campus community is offering.</p></div></div>
    {loading ? <div className="grid">{[1, 2, 3, 4].map(n => <CardSkeleton key={n} />)}</div>
    : items.length ? <div className="grid">{items.map(item => {
      const image = item.listing_images?.[0]?.url;
      const price = Number(item.listing_type === 'accommodation' ? (item.payment_initial ?? item.price ?? 0) : item.price || 0);
      return <Link className="card" href={`/product/${item.id}`} key={item.id}>
        <div className="pic" style={image ? { backgroundImage: `url(${image})` } : undefined}><span className="priceTag">₦{price.toLocaleString()}</span></div>
        <div className="cardbody"><h3>{item.title}</h3><div className="cardMeta">{item.category} · {item.campus}</div></div>
      </Link>;
    })}</div>
    : <EmptyState icon={<Search size={26} />} title="No active listings yet" text={`Be the first to list something for ${name}.`} action={<Link href="/sell" className="btn green">Create a listing</Link>} />}
  </div></main>;
}
