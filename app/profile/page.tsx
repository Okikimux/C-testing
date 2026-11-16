'use client';
import { BackButton } from '../../components/back-button';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Package, Settings, LogOut, MapPin, BadgeCheck, BarChart3, Store, CalendarDays, Receipt, CalendarClock } from 'lucide-react';
import { createClient } from '../../lib/supabase';
import { Avatar } from '../../components/avatar';
import { VerifiedName } from '../../components/verified-name';

export default function Profile(){
  const [profile,setProfile]=useState<any>(null); const [count,setCount]=useState(0); const [verified,setVerified]=useState(false);
  useEffect(()=>{
    const s=createClient(); let mounted=true; let profileChannel:any; let listingChannel:any; let verificationChannel:any; const channelSuffix=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    (async()=>{
      const {data:{user}}=await s.auth.getUser(); if(!user){window.location.assign('/auth/login');return}
      const load=async()=>{
        const [{data:p},{count:c},{data:v}]=await Promise.all([s.from('profiles').select('id,full_name,campus,location,avatar_url').eq('id',user.id).single(),s.from('listings').select('id',{count:'exact',head:true}).eq('seller_id',user.id).neq('status','hidden'),s.from('student_verifications').select('user_id').eq('user_id',user.id).eq('status','approved').maybeSingle()]);
        if(mounted){setProfile(p);setCount(c||0);setVerified(!!v)}
      };
      await load();
      profileChannel=s.channel(`profile-page-${user.id}-${channelSuffix}`).on('postgres_changes',{event:'*',schema:'public',table:'profiles',filter:`id=eq.${user.id}`},()=>load()).subscribe();
      listingChannel=s.channel(`profile-listings-${user.id}-${channelSuffix}`).on('postgres_changes',{event:'*',schema:'public',table:'listings',filter:`seller_id=eq.${user.id}`},()=>load()).subscribe();
      verificationChannel=s.channel(`profile-verification-${user.id}-${channelSuffix}`).on('postgres_changes',{event:'*',schema:'public',table:'student_verifications',filter:`user_id=eq.${user.id}`},()=>load()).subscribe();
    })();
    return()=>{mounted=false;if(profileChannel)s.removeChannel(profileChannel);if(listingChannel)s.removeChannel(listingChannel);if(verificationChannel)s.removeChannel(verificationChannel)};
  },[]);
  async function signout(){await createClient().auth.signOut({ scope: 'local' });window.location.assign('/')}
  return <main className="section"><BackButton /><div className="container">{!profile?<div className="empty">Loading profile...</div>:<><div className="profileHero panel"><div className="profileRow"><div className="row"><Avatar url={profile.avatar_url} name={profile.full_name} size="lg"/><div><h1 style={{margin:'0 0 5px'}}><VerifiedName userId={profile.id} name={profile.full_name} verified={verified}/></h1><div className="muted">{profile.campus||'Campus not set'}</div>{profile.location&&<div className="profilePublicMeta"><MapPin size={14}/>{profile.location}</div>}</div></div><div className="actionsRow"><Link className="btn light" href="/verification"><BadgeCheck size={17}/> Verification</Link><Link className="btn light" href="/settings"><Settings size={17}/> Settings</Link><button className="btn danger" onClick={signout}><LogOut size={17}/> Sign out</button></div></div></div><div className="grid profileTiles" style={{marginTop:16}}><Link className="panel" href="/my-listings"><Package/><h3>My listings</h3><p className="muted">{count} active listing{count===1?'':'s'}</p></Link><Link className="panel" href="/favourites"><Heart/><h3>Favourites</h3><p className="muted">Saved items</p></Link><Link className="panel" href="/messages"><MessageCircle/><h3>Messages</h3><p className="muted">Chat with buyers and sellers</p></Link><Link className="panel" href="/transactions"><Receipt/><h3>Transactions</h3><p className="muted">Confirm purchases and leave reviews</p></Link><Link className="panel" href="/seller-analytics"><BarChart3/><h3>Seller analytics</h3><p className="muted">Views, inquiries and favourites</p></Link><Link className="panel" href="/viewing-requests"><CalendarDays/><h3>Accommodation viewings</h3><p className="muted">Manage inspection requests</p></Link><Link className="panel" href="/service-requests"><CalendarClock/><h3>Service requests</h3><p className="muted">Manage service bookings</p></Link><Link className="panel" href="/store/manage"><Store/><h3>My storefront</h3><p className="muted">Create a shareable vendor shop</p></Link></div></>}</div></main>
}
