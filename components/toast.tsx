'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { friendlyMessage } from '../lib/friendly-error';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
type ToastItemData = { id: number; kind: Kind; message: string; bump: number };
type ToastApi = { push: (kind: Kind, message: string) => void; dismiss: (id: number) => void };

// Success and info messages close quickly; errors stay longer so they can be read.
const DURATION: Record<Kind, number> = { success: 4000, info: 4000, error: 8000 };
const MAX_VISIBLE = 4;

const ToastContext = createContext<ToastApi>({ push() {}, dismiss() {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItemData[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts(current => current.filter(t => t.id !== id)), []);
  const push = useCallback((kind: Kind, message: string) => {
    const text = kind === 'error' ? (String(message || '').trim() ? friendlyMessage(message) : '') : String(message || '').trim();
    if (!text) return;
    setToasts(current => {
      // Same message already on screen: keep one popup and restart its timer.
      const existing = current.find(t => t.kind === kind && t.message === text);
      if (existing) return current.map(t => (t.id === existing.id ? { ...t, bump: t.bump + 1 } : t));
      seq.current += 1;
      return [...current, { id: seq.current, kind, message: text, bump: 0 }].slice(-MAX_VISIBLE);
    });
  }, []);

  const api = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return <ToastContext.Provider value={api}>
    {children}
    <div className="toastStack" role="region" aria-label="Notifications">
      {toasts.map(t => <ToastItem key={t.id} toast={t} onClose={dismiss} />)}
    </div>
  </ToastContext.Provider>;
}

function ToastItem({ toast, onClose }: { toast: ToastItemData; onClose: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(DURATION[toast.kind]);
  const startedAt = useRef(0);

  // A repeated message starts a fresh countdown.
  useEffect(() => { remaining.current = DURATION[toast.kind]; }, [toast.bump, toast.kind]);

  // The countdown stops while the person is hovering, touching or focusing the popup.
  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onClose(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(1000, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, toast.bump, toast.id, onClose]);

  const Icon = toast.kind === 'success' ? CheckCircle2 : toast.kind === 'error' ? AlertTriangle : Info;
  return <div
    className={`toast ${toast.kind}`}
    role={toast.kind === 'error' ? 'alert' : 'status'}
    onMouseEnter={() => setPaused(true)}
    onMouseLeave={() => setPaused(false)}
    onTouchStart={() => setPaused(true)}
    onTouchEnd={() => setPaused(false)}
    onFocus={() => setPaused(true)}
    onBlur={() => setPaused(false)}
  >
    <Icon className="toastIcon" size={20} aria-hidden="true" />
    <span className="toastText">{toast.message}</span>
    <button type="button" className="toastClose" aria-label="Dismiss message" onClick={() => onClose(toast.id)}><X size={16} /></button>
    <span key={toast.bump} className="toastBar" style={{ animationDuration: `${DURATION[toast.kind]}ms`, animationPlayState: paused ? 'paused' : 'running' }} aria-hidden="true" />
  </div>;
}

export function useToast() {
  const { push, dismiss } = useContext(ToastContext);
  return useMemo(() => ({
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
    info: (message: string) => push('info', message),
    dismiss,
  }), [push, dismiss]);
}

/**
 * Drop-in replacement for useState('') for message/error state.
 * Setting a non-empty value also shows a popup, even if the text is the same as last time.
 *   const [error, setError] = useFlash('error');
 *   const [notice, setNotice] = useFlash('notice');
 */
export function useFlash(kind: 'error' | 'notice' | 'info', initial = ''): [string, (value: string | null | undefined) => void] {
  const { push } = useContext(ToastContext);
  const [value, setValue] = useState(initial);
  const set = useCallback((next: string | null | undefined) => {
    const text = next ? friendlyMessage(next) : '';
    setValue(text);
    if (text) push(kind === 'error' ? 'error' : kind === 'info' ? 'info' : 'success', text);
  }, [push, kind]);
  return [value, set];
}
