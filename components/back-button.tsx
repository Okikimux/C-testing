'use client';
import { ArrowLeft } from 'lucide-react';
export function BackButton({ fallback = '/' }: { fallback?: string }) {
  return <button type="button" className="backButton" onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.assign(fallback); }}><ArrowLeft size={18} aria-hidden="true"/><span>Back</span></button>;
}
