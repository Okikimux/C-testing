import type {Metadata} from 'next';import StoreClient from './store-client';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const name=slug.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());return {title:`${name} Store | CARTOMUX`,description:`Shop products and services from ${name} on CARTOMUX.`,alternates:{canonical:`/store/${slug}`}}}
export default async function StorePage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <StoreClient slug={slug}/>}
