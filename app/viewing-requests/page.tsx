'use client';
import { useEffect, useState } from 'react';
import { BackButton } from '../../components/back-button';
import { createClient } from '../../lib/supabase';
import { EmptyState, PageHeader, RequestCard, Tabs, requestBucket } from '../../components/ui-bits';
import type { RequestBucket } from '../../components/ui-bits';
import { Skeleton } from '../../components/skeleton';
import { CalendarDays, Check, Info, X } from 'lucide-react';

export default function ViewingRequests(){
  const [rows,setRows]=useState<any[]>([]),[uid,setUid]=useState(''),[notice,setNotice]=useState(''),[loaded,setLoaded]=useState(false),[tab,setTab]=useState<RequestBucket>('all');
  async function load(){
    try{
      const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user){location.assign('/auth/login?next=/viewing-requests');return}setUid(user.id);
      const {data}=await s.from('viewing_requests').select('*').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order('requested_for',{ascending:true});
      const list=data||[];
      const [{data:ls},{data:ps}]=await Promise.all([s.from('listings').select('id,title').in('id',list.map(x=>x.listing_id)),s.from('profiles').select('id,full_name').in('id',[...new Set(list.flatMap(x=>[x.buyer_id,x.seller_id]))])]);
      const lm=new Map((ls||[]).map(x=>[x.id,x.title]));const pm=new Map((ps||[]).map(x=>[x.id,x.full_name]));
      setRows(list.map(x=>({...x,title:lm.get(x.listing_id)||'Accommodation',buyerName:pm.get(x.buyer_id)||'Student',sellerName:pm.get(x.seller_id)||'Landlord'})))
    }finally{setLoaded(true)}
  }
  useEffect(()=>{load()},[]);
  async function update(id:string,status:string){let query=createClient().from('viewing_requests').update({status}).eq('id',id);query=status==='cancelled'?query.eq('buyer_id',uid):query.eq('seller_id',uid);const {error}=await query;setNotice(error?.message||`Viewing request ${status}.`);if(!error)load()}

  const count=(b:RequestBucket)=>b==='all'?rows.length:rows.filter(x=>requestBucket(x.status)===b).length;
  const visible=tab==='all'?rows:rows.filter(x=>requestBucket(x.status)===tab);

  return <main className="section"><BackButton/><div className="container">
    <PageHeader eyebrow="Campus tools" title="Accommodation viewings">Manage inspection requests and your upcoming visits.</PageHeader>
    {notice&&<div className="notice" role="status"><Info size={17}/><span>{notice}</span></div>}
    {!loaded?<div className="stack"><Skeleton className="skeletonRow"/><Skeleton className="skeletonRow"/></div>
    :rows.length?<>
      <Tabs<RequestBucket> value={tab} onChange={setTab} items={[{id:'all',label:'All',count:count('all')},{id:'pending',label:'Pending',count:count('pending')},{id:'accepted',label:'Accepted',count:count('accepted')},{id:'closed',label:'Closed',count:count('closed')}]}/>
      {visible.length?<div className="stack">{visible.map(x=>{
        const incoming=x.seller_id===uid;
        return <RequestCard key={x.id} whenISO={x.requested_for} title={x.title} incoming={incoming} who={x.buyer_id===uid?`Landlord: ${x.sellerName}`:`Requested by: ${x.buyerName}`} status={x.status} note={x.message} href={`/product/${x.listing_id}`} linkLabel="View accommodation" actions={<>
          {x.seller_id===uid&&x.status==='pending'&&<><button className="btn green" onClick={()=>update(x.id,'accepted')}><Check size={16}/> Accept</button><button className="btn danger" onClick={()=>update(x.id,'declined')}><X size={16}/> Decline</button></>}
          {x.buyer_id===uid&&x.status==='pending'&&<button className="btn light" onClick={()=>update(x.id,'cancelled')}>Cancel request</button>}
          {x.seller_id===uid&&x.status==='accepted'&&<button className="btn light" onClick={()=>update(x.id,'completed')}><Check size={16}/> Mark completed</button>}
        </>}/>})}</div>
      :<EmptyState icon={<CalendarDays size={26}/>} title="Nothing in this view" text="Try another tab to see your other viewing requests."/>}
    </>
    :<EmptyState icon={<CalendarDays size={28}/>} title="No viewing requests" text="Requests for your accommodation listings will appear here."/>}
  </div></main>
}
