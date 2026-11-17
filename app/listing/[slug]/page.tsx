import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import ProductClient from '../../product/[id]/product-client';
import { SITE_URL } from '../../../lib/site';

async function getListing(slug: string) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key) return null;
  const supabase=createSupabaseClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data}=await supabase.from('listings').select('id,slug,title,description,price,listing_type,payment_initial,listing_images(url)').eq('slug',slug).maybeSingle();
  return data;
}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;const item=await getListing(slug);
  if(!item)return {title:'Listing | CARTOMUX'};
  const description=(item.description||`Find ${item.title} on CARTOMUX.`).slice(0,155);
  const image=(item.listing_images as any[]|null)?.[0]?.url;const url=`${SITE_URL}/listing/${item.slug}`;
  return {title:`${item.title} | CARTOMUX`,description,alternates:{canonical:url},openGraph:{type:'website',url,title:`${item.title} | CARTOMUX`,description,siteName:'CARTOMUX',images:image?[{url:image,alt:item.title}]:undefined},twitter:{card:'summary_large_image',title:item.title,description,images:image?[image]:undefined}};
}
export default async function ListingSlugPage({params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;const item=await getListing(slug);if(!item)notFound();
  return <ProductClient listingId={item.id}/>;
}
