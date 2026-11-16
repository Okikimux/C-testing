'use client';
import { BackButton } from '../../components/back-button';
import {useEffect,useState} from 'react';
import {Bell,Check} from 'lucide-react';
import {createClient} from '../../lib/supabase';

export default function Notifications(){
  const [items,setItems]=useState<any[]>([]);
  useEffect(()=>{
    const s=createClient(); let mounted=true; let channel:any; const channelSuffix=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    (async()=>{
      const {data:{user}}=await s.auth.getUser();
      if(!user){window.location.assign('/auth/login');return}
      const load=async()=>{const {data}=await s.from('notifications').select('*').eq('user_id',user.id).order('created_at',{ascending:false});if(mounted)setItems(data||[])};
      await load();
      channel=s.channel(`notifications-page-${user.id}-${channelSuffix}`).on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`user_id=eq.${user.id}`},()=>load()).subscribe();
    })();
    return()=>{mounted=false;if(channel)s.removeChannel(channel)};
  },[]);
  async function read(id:string){const now=new Date().toISOString();await createClient().from('notifications').update({read_at:now}).eq('id',id);setItems(x=>x.map(n=>n.id===id?{...n,read_at:now}:n))}
  return <main className="section"><BackButton /><div className="container"><div className="sectionHead"><div><h1>Notifications</h1><p className="muted" style={{margin:0}}>Updates about your listings, messages and account.</p></div></div><div className="panel noticesPanel">{!items.length?<div className="empty"><Bell size={28}/><b>You are all caught up</b><p>New updates will appear here.</p></div>:items.map(n=><div className={`noticeRow ${n.read_at?'':'unread'}`} key={n.id}><Bell size={20}/><div style={{flex:1}}><b>{n.title}</b><div className="muted">{n.body}</div></div>{!n.read_at&&<button className="iconBtn" onClick={()=>read(n.id)} aria-label="Mark as read" title="Mark as read"><Check size={17}/></button>}</div>)}</div></div></main>
}
