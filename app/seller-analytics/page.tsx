'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BackButton } from '../../components/back-button';
import { createClient } from '../../lib/supabase';
import { EmptyState, PageHeader, Pill } from '../../components/ui-bits';
import type { PillTone } from '../../components/ui-bits';
import { Skeleton } from '../../components/skeleton';
import { BarChart3, Eye, Heart, MessageCircle, Package } from 'lucide-react';

function statusTone(status:string):PillTone{
  if(status==='available')return 'ok';
  if(status==='sold')return 'bad';
  return 'plain';
}

function Metric({icon,value,max,tone,label}:{icon:React.ReactNode;value:number;max:number;tone:string;label:string}){
  const pct=max>0?Math.max(0,Math.min(100,Math.round((value/max)*100))):0;
  return <div className={`metric ${value===0?'zero':''}`}>
    <div className="metricTop">{icon}<span>{value.toLocaleString()}</span><small>{label}</small></div>
    <div className={`metricBar ${tone}`.trim()} aria-hidden="true"><i style={{width:`${pct}%`}}/></div>
  </div>;
}

export default function SellerAnalytics(){
  const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true);
  useEffect(()=>{const s=createClient();(async()=>{const {data:{user}}=await s.auth.getUser();if(!user){location.assign('/auth/login?next=/seller-analytics');return}const [{data:stats},{data:listings}]=await Promise.all([s.rpc('get_my_listing_analytics'),s.from('listings').select('id,title,status').eq('seller_id',user.id).order('created_at',{ascending:false})]);const map=new Map((stats||[]).map((x:any)=>[x.listing_id,x]));setRows((listings||[]).map((x:any)=>({...x,...(map.get(x.id)||{views:0,inquiries:0,favourites:0})})));setLoading(false)})();},[]);
  const total=rows.reduce((a,x)=>({views:a.views+x.views,inquiries:a.inquiries+x.inquiries,favourites:a.favourites+x.favourites}),{views:0,inquiries:0,favourites:0});
  const max={views:Math.max(0,...rows.map(x=>x.views)),inquiries:Math.max(0,...rows.map(x=>x.inquiries)),favourites:Math.max(0,...rows.map(x=>x.favourites))};
  const inquiryRate=total.views>0?Math.round((total.inquiries/total.views)*100):null;
  return <main className="section"><BackButton/><div className="container">
    <PageHeader eyebrow="Seller tools" title="Seller analytics" actions={<Link href="/my-listings" className="btn light"><Package size={16}/> My listings</Link>}>Understand how buyers discover and interact with your listings.</PageHeader>

    {loading?<><div className="statGrid"><Skeleton className="skeletonTile"/><Skeleton className="skeletonTile"/><Skeleton className="skeletonTile"/></div><Skeleton className="skeletonRow"/></>
    :<>
      <div className="statGrid">
        <div className="statTile"><span className="statIcon navy"><Eye size={22}/></span><div className="statBody"><span className="statValue">{total.views.toLocaleString()}</span><span className="statLabel">Listing views</span></div></div>
        <div className="statTile"><span className="statIcon"><MessageCircle size={22}/></span><div className="statBody"><span className="statValue">{total.inquiries.toLocaleString()}</span><span className="statLabel">Buyer inquiries</span>{inquiryRate!==null&&<span className="statHint">{inquiryRate}% of viewers messaged you</span>}</div></div>
        <div className="statTile"><span className="statIcon amber"><Heart size={22}/></span><div className="statBody"><span className="statValue">{total.favourites.toLocaleString()}</span><span className="statLabel">Favourites</span></div></div>
      </div>

      {rows.length?<section className="panel perfCard" aria-label="Listing performance">
        <div className="perfHead"><h2>Listing performance</h2><Pill tone="plain">{rows.length} listing{rows.length===1?'':'s'}</Pill></div>
        <div className="perfRow labels" aria-hidden="true"><span>Listing</span><span>Views</span><span>Inquiries</span><span>Favourites</span></div>
        {rows.map(x=><div className="perfRow" key={x.id}>
          <div className="perfItem"><Link href={`/product/${x.id}`}>{x.title}</Link><span><Pill tone={statusTone(x.status)}>{x.status==='available'?'Available':x.status==='sold'?'Sold':x.status==='hidden'?'Hidden':x.status}</Pill></span></div>
          <Metric icon={<Eye size={15}/>} value={x.views} max={max.views} tone="navy" label="Views"/>
          <Metric icon={<MessageCircle size={15}/>} value={x.inquiries} max={max.inquiries} tone="" label="Inquiries"/>
          <Metric icon={<Heart size={15}/>} value={x.favourites} max={max.favourites} tone="amber" label="Saves"/>
        </div>)}
      </section>
      :<EmptyState icon={<BarChart3 size={26}/>} title="No listings to analyse yet" text="Publish a listing and your views, inquiries and favourites will show up here." action={<Link href="/sell" className="btn green">Create a listing</Link>}/>}
    </>}
  </div></main>
}
