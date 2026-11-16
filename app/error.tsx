'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Home, MessageSquareText, RefreshCw } from 'lucide-react';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
 const [path,setPath]=useState('/'); useEffect(()=>{setPath(window.location.pathname)},[]);
 return <main className="notFoundPage"><section className="notFoundCard errorPageCard"><div className="feedbackIcon errorIcon"><AlertTriangle size={25}/></div><div className="eyebrow">Something went wrong</div><h1>This page did not load correctly.</h1><p className="muted">Your account and listings have not been deleted. You can try again or send the CARTOMUX team feedback so we can investigate.</p><div className="notFoundActions"><button className="btn light" onClick={()=>window.history.length>1?window.history.back():window.location.assign('/')}><ArrowLeft size={17}/> Go back</button><button className="btn primary" onClick={()=>reset()}><RefreshCw size={17}/> Try again</button><Link className="btn green" href="/"><Home size={17}/> Home</Link><Link className="btn light" href={`/feedback?source=${encodeURIComponent(path)}`}><MessageSquareText size={17}/> Send feedback</Link></div></section></main>;
}
