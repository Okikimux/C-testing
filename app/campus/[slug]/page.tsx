import type { Metadata } from 'next';
import CampusClient from './campus-client';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const name=decodeURIComponent(slug).replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());return {title:`${name} Campus Marketplace | CARTOMUX`,description:`Buy, sell and find student accommodation around ${name}. Discover campus vendors, products and services on CARTOMUX.`,alternates:{canonical:`/campus/${slug}`}}}
export default async function CampusPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <CampusClient slug={slug}/>}
