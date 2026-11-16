'use client';
import {useEffect,useState} from 'react';
import {WifiOff} from 'lucide-react';
export default function NetworkStatus(){const [offline,setOffline]=useState(false);useEffect(()=>{const update=()=>setOffline(!navigator.onLine);update();window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update)}},[]);if(!offline)return null;return <div className="offlineBanner" role="status"><WifiOff size={15} style={{verticalAlign:'middle',marginRight:7}}/>You’re offline. Some CARTOMUX features are unavailable. <a href="/offline" style={{textDecoration:'underline',marginLeft:5}}>Help</a></div>}
