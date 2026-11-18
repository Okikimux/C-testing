'use client';
import { BackButton } from '../../components/back-button';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Package, Settings, LogOut, MapPin, BadgeCheck, BarChart3, Store, CalendarDays, Receipt, CalendarClock, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { createClient } from '../../lib/supabase';
import { Avatar } from '../../components/avatar';
import { VerifiedName } from '../../components/verified-name';

function Tile({href,icon,title,text}:{href:string;icon:ReactNode;title:string;text:string}){
  return <Link className="hubTile" href={href}><span className="hubTileIcon">{icon}</span><span className="hubTileBody"><b>{title}</b><span>{text}</span></span><ChevronRight className="hubTileGo" size={18}/></Link>;
}

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
  return <main className="section"><BackButton /><div className="container">{!profile?<div className="empty">Loading profile...</div>:<>
    <section className="panel hubHero">
      <div className="hubBanner" aria-hidden="true"/>
      <div className="hubHeroBody">
        <div className="hubIdent">
          <Avatar url={profile.avatar_url} name={profile.full_name} size="lg"/>
          <div className="hubIdentCopy"><h1><VerifiedName userId={profile.id} name={profile.full_name} verified={verified}/></h1><div className="muted">{profile.campus||'Campus not set'}</div>{profile.location&&<div className="profilePublicMeta"><MapPin size={14}/>{profile.location}</div>}</div>
        </div>
        <div className="hubActions"><Link className="btn light" href="/verification"><BadgeCheck size={17}/> Verification</Link><Link className="btn light" href="/settings"><Settings size={17}/> Settings</Link><button className="btn danger" onClick={signout}><LogOut size={17}/> Sign out</button></div>
      </div>
    </section>

    <section className="hubGroup" aria-labelledby="hub-buy-sell"><div className="hubGroupHead"><h2 id="hub-buy-sell">Buying &amp; selling</h2></div><div className="hubGrid">
      <Tile href="/my-listings" icon={<Package size={22}/>} title="My listings" text={`${count} active listing${count===1?'':'s'}`}/>
      <Tile href="/favourites" icon={<Heart size={22}/>} title="Favourites" text="Saved items"/>
      <Tile href="/messages" icon={<MessageCircle size={22}/>} title="Messages" text="Chat with buyers and sellers"/>
      <Tile href="/transactions" icon={<Receipt size={22}/>} title="Transactions" text="Confirm purchases and leave reviews"/>
    </div></section>

    <section className="hubGroup" aria-labelledby="hub-seller"><div className="hubGroupHead"><h2 id="hub-seller">Seller tools</h2></div><div className="hubGrid">
      <Tile href="/seller-analytics" icon={<BarChart3 size={22}/>} title="Seller analytics" text="Views, inquiries and favourites"/>
      <Tile href="/store/manage" icon={<Store size={22}/>} title="My storefront" text="Create a shareable vendor shop"/>
    </div></section>

    <section className="hubGroup" aria-labelledby="hub-campus"><div className="hubGroupHead"><h2 id="hub-campus">Campus services</h2></div><div className="hubGrid">
      <Tile href="/viewing-requests" icon={<CalendarDays size={22}/>} title="Accommodation viewings" text="Manage inspection requests"/>
      <Tile href="/service-requests" icon={<CalendarClock size={22}/>} title="Service requests" text="Manage service bookings"/>
    </div></section>
  </>}</div></main>
}
