'use client';
import { useEffect, useState } from 'react';
import { BackButton } from '../../components/back-button';
import { createClient } from '../../lib/supabase';
import { EmptyState, PageHeader, RequestCard, Tabs, requestBucket } from '../../components/ui-bits';
import type { RequestBucket } from '../../components/ui-bits';
import { Skeleton } from '../../components/skeleton';
import { CalendarClock, Check, Info, X } from 'lucide-react';

export default function ServiceRequests(){
  const [rows,setRows]=useState<any[]>([]),[uid,setUid]=useState(''),[notice,setNotice]=useState(''),[loaded,setLoaded]=useState(false),[tab,setTab]=useState<RequestBucket>('all');
  async function load(){
    try{
      const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user){location.assign('/auth/login?next=/service-requests');return}setUid(user.id);
      const {data}=await s.from('service_requests').select('*').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order('requested_for',{ascending:true});
      const list=data||[];
      const [{data:ls},{data:ps}]=await Promise.all([s.from('listings').select('id,title').in('id',list.map(x=>x.listing_id)),s.from('profiles').select('id,full_name').in('id',[...new Set(list.flatMap(x=>[x.buyer_id,x.seller_id]))])]);
      const lm=new Map((ls||[]).map(x=>[x.id,x.title]));const pm=new Map((ps||[]).map(x=>[x.id,x.full_name]));
      setRows(list.map(x=>({...x,title:lm.get(x.listing_id)||'Service',buyerName:pm.get(x.buyer_id)||'Customer',sellerName:pm.get(x.seller_id)||'Provider'})))
    }finally{setLoaded(true)}
  }
  useEffect(()=>{load()},[]);
  async function update(id:string,status:string){let query=createClient().from('service_requests').update({status}).eq('id',id);query=status==='cancelled'?query.eq('buyer_id',uid):query.eq('seller_id',uid);const {error}=await query;setNotice(error?.message||`Service request ${status}.`);if(!error)load()}

  const count=(b:RequestBucket)=>b==='all'?rows.length:rows.filter(x=>requestBucket(x.status)===b).length;
  const visible=tab==='all'?rows:rows.filter(x=>requestBucket(x.status)===tab);

  return <main className="section"><BackButton/><div className="container">
    <PageHeader eyebrow="Campus tools" title="Service requests">Manage requests for tutoring, laundry, design and other campus services.</PageHeader>
    {notice&&<div className="notice" role="status"><Info size={17}/><span>{notice}</span></div>}
    {!loaded?<div className="stack"><Skeleton className="skeletonRow"/><Skeleton className="skeletonRow"/></div>
    :rows.length?<>
      <Tabs<RequestBucket> value={tab} onChange={setTab} items={[{id:'all',label:'All',count:count('all')},{id:'pending',label:'Pending',count:count('pending')},{id:'accepted',label:'Accepted',count:count('accepted')},{id:'closed',label:'Closed',count:count('closed')}]}/>
      {visible.length?<div className="stack">{visible.map(x=>{
        const incoming=x.seller_id===uid;
        return <RequestCard key={x.id} whenISO={x.requested_for} title={x.title} incoming={incoming} who={x.buyer_id===uid?`Provider: ${x.sellerName}`:`Requested by: ${x.buyerName}`} status={x.status} note={x.details} href={`/product/${x.listing_id}`} linkLabel="View service" actions={<>
          {x.seller_id===uid&&x.status==='pending'&&<><button className="btn green" onClick={()=>update(x.id,'accepted')}><Check size={16}/> Accept</button><button className="btn danger" onClick={()=>update(x.id,'declined')}><X size={16}/> Decline</button></>}
          {x.buyer_id===uid&&x.status==='pending'&&<button className="btn light" onClick={()=>update(x.id,'cancelled')}>Cancel request</button>}
          {x.seller_id===uid&&x.status==='accepted'&&<button className="btn light" onClick={()=>update(x.id,'completed')}><Check size={16}/> Mark completed</button>}
        </>}/>})}</div>
      :<EmptyState icon={<CalendarClock size={26}/>} title="Nothing in this view" text="Try another tab to see your other service requests."/>}
    </>
    :<EmptyState icon={<CalendarClock size={28}/>} title="No service requests" text="Requests for your services will appear here."/>}
  </div></main>
}
