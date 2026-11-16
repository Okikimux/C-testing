'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Package, MapPin, Star, Store } from 'lucide-react';
import { useParams } from 'next/navigation';
import { createClient } from '../../../lib/supabase';
import { Avatar } from '../../../components/avatar';
import { VerifiedName } from '../../../components/verified-name';
import { fetchVerifiedIds } from '../../../lib/verified';

type Profile = { id: string; full_name: string | null; campus: string | null; location: string | null; avatar_url: string | null; created_at: string | null };
type Listing = { id: string; title: string; price: number | null; listing_type: 'product' | 'accommodation' | null; payment_initial: number | null; campus: string | null; status: string; created_at: string; listing_images?: { url: string | null; storage_path: string }[] };

export default function PublicUserProfile() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [reviewStats, setReviewStats] = useState({ average: 0, count: 0, completed: 0 });
  const [storeSlug, setStoreSlug] = useState('');
  const [reviewsList, setReviewsList] = useState<any[]>([]);

  useEffect(() => {
    const supabase=createClient(); let mounted=true; let channel:any;
    const load=async()=>{
      const [{data:p,error:profileError},{data:l},{data:reviews},{data:store},{data:trust}]=await Promise.all([
        supabase.from('profiles').select('id,full_name,campus,location,avatar_url,created_at').eq('id',id).maybeSingle(),
        supabase.from('listings').select('id,title,price,listing_type,payment_initial,campus,status,created_at,listing_images(url,storage_path)').eq('seller_id',id).eq('status','available').order('created_at',{ascending:false}),
        supabase.from('seller_reviews').select('rating,review,buyer_id,created_at').eq('seller_id',id).order('created_at',{ascending:false}),
        supabase.from('vendor_storefronts').select('slug').eq('owner_id',id).maybeSingle(),
        supabase.rpc('get_seller_trust_stats',{p_seller_id:id})
      ]);
      if(!mounted)return;
      if(profileError||!p)setError('This profile could not be found.'); else {setError('');setProfile(p)}
      const reviewRows=reviews||[];setReviewStats({average:Number(trust?.[0]?.average_rating??(reviewRows.length?reviewRows.reduce((sum:number,x:any)=>sum+x.rating,0)/reviewRows.length:0)),count:Number(trust?.[0]?.review_count??reviewRows.length),completed:Number(trust?.[0]?.completed_transactions??0)});const buyerIds=[...new Set(reviewRows.map((x:any)=>x.buyer_id))];const {data:buyers}=buyerIds.length?await supabase.from('profiles').select('id,full_name').in('id',buyerIds):{data:[] as any[]};const buyerNames=new Map((buyers||[]).map((x:any)=>[x.id,x.full_name||'CARTOMUX buyer']));setReviewsList(reviewRows.map((x:any)=>({...x,buyerName:buyerNames.get(x.buyer_id)||'CARTOMUX buyer'})));setStoreSlug(store?.slug||'');
      setListings((l||[]) as Listing[]); setVerified((await fetchVerifiedIds(supabase,[id])).has(id)); setLoading(false);
    };
    load();
    channel=supabase.channel(`public-profile-${id}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'profiles',filter:`id=eq.${id}`},()=>load())
      .on('postgres_changes',{event:'*',schema:'public',table:'listings',filter:`seller_id=eq.${id}`},()=>load())
      .subscribe();
    return()=>{mounted=false;if(channel)supabase.removeChannel(channel)};
  }, [id]);

  if (loading) return <main className="section"><div className="container"><div className="skeletonBlock"><span className="skeleton skeletonAvatar"/><span className="skeleton skeletonLine"/><span className="skeleton skeletonLine medium"/></div></div></main>;
  if (error || !profile) return <main className="section"><div className="container"><div className="empty">{error || 'Profile not found.'}</div></div></main>;

  return (
    <main className="section">
      <div className="container publicProfile">
        <Link href="/marketplace" className="productBack"><ArrowLeft size={17}/> Back to marketplace</Link>
        <div className="panel publicProfileHero">
          <div className="row">
            <Avatar url={profile.avatar_url} name={profile.full_name || 'Student'} size="lg" />
            <div>
              <h1><VerifiedName userId={profile.id} name={profile.full_name} verified={verified}/></h1>
              <p className="muted">{profile.campus || 'Campus not set'}</p>
              {profile.location && <p className="profilePublicMeta"><MapPin size={15}/> {profile.location}</p>}
            </div>
          </div>
          <div className="publicProfileMeta">
            <Package size={16}/> {listings.length} active listing{listings.length === 1 ? '' : 's'}
            {reviewStats.count>0&&<span className="profileRating"><Star size={15} fill="currentColor"/> {reviewStats.average.toFixed(1)} ({reviewStats.count} reviews)</span>}<span className="muted">{reviewStats.completed} completed trade{reviewStats.completed===1?'':'s'}</span>
            {storeSlug&&<Link className="btn light" href={`/store/${storeSlug}`}><Store size={15}/> Visit storefront</Link>}
          </div>
        </div>

        {reviewsList.length>0&&<section className="sellerReviewsSection"><div className="sectionHead"><h2>Buyer reviews</h2><span className="muted">Verified transactions only</span></div><div className="sellerReviewsGrid">{reviewsList.map((review:any)=><div className="panel sellerReviewCard" key={review.buyer_id+'-'+review.created_at}><div className="row"><b>{review.buyerName}</b><span className="profileRating">★ {review.rating}/5</span></div>{review.review&&<p>{review.review}</p>}<small className="muted">{new Date(review.created_at).toLocaleDateString()}</small></div>)}</div></section>}

        <div className="sectionHead" style={{ marginTop: 36 }}>
          <h2>Active listings</h2>
        </div>

        {listings.length ? (
          <div className="grid">
            {listings.map(item => {
              const image = item.listing_images?.[0]?.url || '';
              return <Link key={item.id} href={`/product/${item.id}`} className="card">
                <div className="pic" style={image ? { backgroundImage: `url(${image})` } : undefined}><span className="priceTag">₦{Number(item.listing_type==='accommodation'?(item.payment_initial??item.price??0):item.price).toLocaleString()}</span></div>
                <div className="cardbody">
                  <h3>{item.title}</h3>
                  <div className="cardMeta">{item.campus || 'Campus'} · {new Date(item.created_at).toLocaleDateString()}</div>
                </div>
              </Link>;
            })}
          </div>
        ) : <div className="empty">This user has no active listings.</div>}
      </div>
    </main>
  );
}
