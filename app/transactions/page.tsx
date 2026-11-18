'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BackButton } from '../../components/back-button';
import { createClient } from '../../lib/supabase';
import { EmptyState, PageHeader, Pill, Tabs } from '../../components/ui-bits';
import type { PillTone } from '../../components/ui-bits';
import { Skeleton } from '../../components/skeleton';
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Check, CheckCircle2, Clock3, Info, MapPin, Package, Receipt, Star, Truck } from 'lucide-react';

type Tx = {
  id:string; listing_id:string; seller_id:string; buyer_id:string; status:string; created_at:string;
  fulfilment_method:string|null; fulfilment_status:string; fulfilment_details:string|null; fulfilment_requested_for:string|null;
  admin_resolution:string|null; admin_resolution_note:string|null; title:string; sellerName:string; buyerName:string;
};
type Bucket = 'all' | 'awaiting_buyer' | 'confirmed' | 'disputed';

const fulfilmentLabels:Record<string,string>={not_arranged:'Not arranged',proposed:'Awaiting buyer response',changes_requested:'Changes requested',accepted:'Arrangement accepted',in_transit:'On the way',ready_for_pickup:'Ready for collection',completed:'Received'};
const stepIndex:Record<string,number>={not_arranged:0,proposed:0,changes_requested:0,accepted:1,in_transit:2,ready_for_pickup:2,completed:3};
const rateLabels=['','Poor','Fair','Good','Very good','Excellent'];

function fulfilmentTone(status:string):PillTone{
  if(status==='completed')return 'ok';
  if(status==='proposed'||status==='changes_requested')return 'pending';
  if(status==='not_arranged')return 'plain';
  return 'info';
}

function Stepper({status,method}:{status:string;method:string|null}){
  const current=stepIndex[status]??0;
  const labels=['Arrange',method==='pickup'||method==='delivery'?'Agreed':'Agree',method==='pickup'?'Ready to collect':method==='delivery'?'On the way':'Delivery / pickup','Received'];
  return <ol className="stepper" aria-label="Delivery progress">{labels.map((label,i)=>{
    const done=status==='completed'||i<current;
    const state=done?'done':i===current?'current':'';
    return <li key={label} className={state} aria-current={state==='current'?'step':undefined}><span className="stepDot">{done?<Check size={14} strokeWidth={3}/>:i+1}</span>{label}</li>;
  })}</ol>;
}

export default function Transactions(){
 const [rows,setRows]=useState<Tx[]>([]),[userId,setUserId]=useState(''),[busy,setBusy]=useState(''),[ratings,setRatings]=useState<Record<string,number>>({}),[reviews,setReviews]=useState<Record<string,string>>({}),[reviewed,setReviewed]=useState<Set<string>>(new Set()),[notice,setNotice]=useState(''),[loaded,setLoaded]=useState(false),[tab,setTab]=useState<Bucket>('all');
 const [method,setMethod]=useState<Record<string,string>>({}),[details,setDetails]=useState<Record<string,string>>({}),[when,setWhen]=useState<Record<string,string>>({});
 async function load(){
  try{
   const s=createClient();const {data:{user}}=await s.auth.getUser();if(!user){location.assign('/auth/login?next=/transactions');return}setUserId(user.id);
   const {data,error}=await s.from('sale_transactions').select('id,listing_id,seller_id,buyer_id,status,created_at,confirmed_at,fulfilment_method,fulfilment_status,fulfilment_details,fulfilment_requested_for,admin_resolution,admin_resolution_note').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order('created_at',{ascending:false});
   if(error){setNotice(error.message);return}const list=data||[];if(!list.length){setRows([]);return}const ids=[...new Set(list.flatMap(x=>[x.listing_id,x.seller_id,x.buyer_id]))];const [{data:listings},{data:profiles},{data:reviewData}]=await Promise.all([s.from('listings').select('id,title').in('id',list.map(x=>x.listing_id)),s.from('profiles').select('id,full_name').in('id',ids.filter(Boolean)),s.from('seller_reviews').select('transaction_id').in('transaction_id',list.map(x=>x.id))]);
   const lm=new Map((listings||[]).map(x=>[x.id,x.title]));const pm=new Map((profiles||[]).map(x=>[x.id,x.full_name]));setReviewed(new Set((reviewData||[]).map(x=>x.transaction_id)));setRows(list.map(x=>({...x,title:lm.get(x.listing_id)||'Listing',sellerName:pm.get(x.seller_id)||'Seller',buyerName:pm.get(x.buyer_id)||'Buyer'} as Tx)));
  }finally{setLoaded(true)}
 }
 useEffect(()=>{load()},[]);
 async function act(tx:Tx,action:string){setBusy(tx.id);setNotice('');const s=createClient();const {error}=await s.rpc('update_transaction_fulfilment',{p_transaction_id:tx.id,p_action:action,p_method:action==='propose'?method[tx.id]||'delivery':null,p_details:action==='propose'?details[tx.id]||'':null,p_requested_for:action==='propose'&&when[tx.id]?new Date(when[tx.id]).toISOString():null});if(error)setNotice(error.message);else{if(action==='complete'&&tx.status==='awaiting_buyer'){const {error:confirmError}=await s.rpc('confirm_listing_sale',{p_transaction_id:tx.id});if(confirmError)setNotice(`Receipt recorded, but transaction confirmation needs attention: ${confirmError.message}`);else setNotice('Receipt and transaction confirmed. You can now leave a seller review.')}else setNotice('Delivery arrangement updated.');await load()}setBusy('')}
 async function confirm(id:string){setBusy(id);const {error}=await createClient().rpc('confirm_listing_sale',{p_transaction_id:id});setNotice(error?.message||'Transaction confirmed. You can now leave a review.');if(!error)await load();setBusy('')}
 async function reject(id:string){if(!window.confirm('Confirm that this purchase did not happen? The listing will become available again.'))return;setBusy(id);const {error}=await createClient().rpc('reject_listing_sale',{p_transaction_id:id});setNotice(error?.message||'Transaction disputed.');if(!error)await load();setBusy('')}
 async function review(id:string){setBusy(id);const {error}=await createClient().rpc('submit_seller_review',{p_transaction_id:id,p_rating:ratings[id]||5,p_review:reviews[id]||null});setNotice(error?.message||'Thank you for reviewing this seller.');if(!error)await load();setBusy('')}

 const count=(b:Bucket)=>b==='all'?rows.length:rows.filter(x=>x.status===b).length;
 const visible=tab==='all'?rows:rows.filter(x=>x.status===tab);

 return <main className="section"><BackButton/><div className="container">
  <PageHeader eyebrow="Trust & safety" title="Transactions">Coordinate delivery or collection, confirm completed trades and build trusted seller reputations.</PageHeader>
  {notice&&<div className="notice" role="status"><Info size={17}/><span>{notice}</span></div>}
  {!loaded?<div className="stack"><Skeleton className="skeletonRow"/><Skeleton className="skeletonRow"/></div>
  :!rows.length?<EmptyState icon={<Package size={28}/>} title="No recorded transactions yet" text="When a seller marks a listing as sold to you, it will appear here." action={<Link href="/marketplace" className="btn green">Browse marketplace</Link>}/>
  :<>
   <Tabs<Bucket> value={tab} onChange={setTab} items={[{id:'all',label:'All',count:count('all')},{id:'awaiting_buyer',label:'Pending',count:count('awaiting_buyer')},{id:'confirmed',label:'Confirmed',count:count('confirmed')},{id:'disputed',label:'Disputed',count:count('disputed')}]}/>
   {!visible.length?<EmptyState icon={<Receipt size={26}/>} title="Nothing in this view" text="Try another tab to see your other transactions."/>
   :<div className="stack">{visible.map(x=>{
    const isBuyer=x.buyer_id===userId,isSeller=x.seller_id===userId,isBusy=busy===x.id,disputed=x.status==='disputed';
    const chosenMethod=method[x.id]||x.fulfilment_method||'delivery';
    const canArrange=isSeller&&['not_arranged','changes_requested','proposed'].includes(x.fulfilment_status)&&!disputed;
    return <article className="txCard" key={x.id}>
     <header className="txHead">
      <span className="txIcon"><Package size={22}/></span>
      <div className="txHeadCopy">
       <h3 className="txTitle">{x.title}</h3>
       <div className="txMeta"><span className="roleChip">{isBuyer?<ArrowDownLeft size={12}/>:<ArrowUpRight size={12}/>}{isBuyer?'You bought':'You sold'}</span><span>{isBuyer?`Seller: ${x.sellerName}`:`Buyer: ${x.buyerName}`}</span><span>·</span><span>{new Date(x.created_at).toLocaleDateString()}</span></div>
      </div>
      <Pill tone={x.status==='confirmed'?'ok':disputed?'bad':'pending'}>{x.status==='confirmed'?'Transaction confirmed':disputed?'Disputed':'Awaiting buyer confirmation'}</Pill>
     </header>

     <div className="txBody">
      <section className="txSection" aria-label="Delivery and collection">
       <div className="txSectionHead"><Truck size={18}/>Delivery &amp; collection<Pill tone={fulfilmentTone(x.fulfilment_status)}>{fulfilmentLabels[x.fulfilment_status]||x.fulfilment_status}</Pill></div>
       <Stepper status={x.fulfilment_status} method={x.fulfilment_method}/>
       {(x.fulfilment_method||x.fulfilment_requested_for)&&<div className="metaRow">
        {x.fulfilment_method&&<span className="metaChip">{x.fulfilment_method==='pickup'?<MapPin size={14}/>:<Truck size={14}/>}{x.fulfilment_method==='pickup'?'Self collection':'Delivery'}</span>}
        {x.fulfilment_requested_for&&<span className="metaChip"><Clock3 size={14}/>{new Date(x.fulfilment_requested_for).toLocaleString()}</span>}
       </div>}
       {x.fulfilment_details&&<p className="txDetails">{x.fulfilment_details}</p>}

       {canArrange&&<div className="arrangeForm">
        <div className="field"><label>Arrange with buyer</label>
         <div className="segmented" role="group" aria-label="Delivery method">
          <button type="button" className={chosenMethod==='delivery'?'active':''} onClick={()=>setMethod(v=>({...v,[x.id]:'delivery'}))}><Truck size={16}/> Delivery</button>
          <button type="button" className={chosenMethod==='pickup'?'active':''} onClick={()=>setMethod(v=>({...v,[x.id]:'pickup'}))}><MapPin size={16}/> Self collection</button>
         </div>
        </div>
        <div className="field"><label>Address, collection point or instructions</label><textarea value={details[x.id]??x.fulfilment_details??''} onChange={e=>setDetails(v=>({...v,[x.id]:e.target.value}))} maxLength={1000} placeholder="Enter delivery address, collection point or instructions"/></div>
        <div className="field"><label>Date and time (optional)</label><input type="datetime-local" value={when[x.id]||''} onChange={e=>setWhen(v=>({...v,[x.id]:e.target.value}))}/></div>
        <button className="btn green" disabled={isBusy} onClick={()=>act(x,'propose')}>{isBusy?'Sending...':'Send arrangement'}</button>
       </div>}

       {isBuyer&&['proposed','changes_requested'].includes(x.fulfilment_status)&&!disputed&&<div className="txActions"><button className="btn green" disabled={isBusy} onClick={()=>act(x,'accept')}><Check size={16}/> Accept arrangement</button><button className="btn light" disabled={isBusy} onClick={()=>act(x,'request_change')}>Request changes</button></div>}
       {isSeller&&x.fulfilment_status==='accepted'&&x.fulfilment_method==='delivery'&&<div className="txActions"><button className="btn green" disabled={isBusy} onClick={()=>act(x,'dispatch')}><Truck size={16}/> Mark as dispatched</button></div>}
       {isSeller&&x.fulfilment_status==='accepted'&&x.fulfilment_method==='pickup'&&<div className="txActions"><button className="btn green" disabled={isBusy} onClick={()=>act(x,'ready')}><MapPin size={16}/> Ready for collection</button></div>}
       {isBuyer&&['in_transit','ready_for_pickup','accepted'].includes(x.fulfilment_status)&&<div className="txActions"><button className="btn green" disabled={isBusy} onClick={()=>act(x,'complete')}><CheckCircle2 size={16}/> Confirm I received the item</button></div>}
      </section>

      {isBuyer&&x.status==='awaiting_buyer'&&<div className="txConfirmBar">
       <p><b>Did you buy this item?</b>Confirm to record the trade and unlock your seller review.</p>
       <div className="actionsRow"><button className="btn green" disabled={isBusy} onClick={()=>confirm(x.id)}><CheckCircle2 size={16}/> Confirm transaction</button><button className="btn light" disabled={isBusy} onClick={()=>reject(x.id)}>I did not buy this</button></div>
      </div>}

      {disputed&&<div className="disputeNotice"><AlertTriangle size={18}/><div>This transaction is under review.{x.admin_resolution&&<><b>Admin outcome: {x.admin_resolution.replaceAll('_',' ')}</b><p>{x.admin_resolution_note}</p></>}</div></div>}

      {isBuyer&&x.status==='confirmed'&&!reviewed.has(x.id)&&<div className="reviewBox">
       <div className="reviewBoxHead"><b>Rate your seller</b><span className="rateLabel">{rateLabels[ratings[x.id]||5]}</span></div>
       <div className="rateStars" role="group" aria-label="Rating">{[1,2,3,4,5].map(n=><button type="button" key={n} className={(ratings[x.id]||5)>=n?'selected':''} onClick={()=>setRatings(v=>({...v,[x.id]:n}))} aria-label={`${n} star${n===1?'':'s'}`}><Star size={26} fill="currentColor"/></button>)}</div>
       <textarea maxLength={600} value={reviews[x.id]||''} onChange={e=>setReviews(v=>({...v,[x.id]:e.target.value}))} placeholder="Share a short, honest review (optional)."/>
       <button className="btn green" disabled={isBusy} onClick={()=>review(x.id)}>{isBusy?'Submitting...':'Submit review'}</button>
      </div>}
      {isBuyer&&reviewed.has(x.id)&&<p className="reviewDone"><CheckCircle2 size={17}/> You have reviewed this seller. Thank you.</p>}
     </div>
    </article>})}</div>}
  </>}
 </div></main>;
}
