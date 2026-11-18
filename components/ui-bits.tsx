'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight, Inbox, Send } from 'lucide-react';

/* Small presentational building blocks shared by the transactions, request,
   analytics, storefront and campus pages. They hold no data logic. */

export type PillTone = 'ok' | 'pending' | 'info' | 'bad' | 'plain' | '';

export function Pill({ tone = '', children }: { tone?: PillTone; children: ReactNode }) {
  return <span className={`pill ${tone}`.trim()}>{children}</span>;
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: ReactNode; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="pageHead">
      <div className="pageHeadCopy">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {children && <p className="muted">{children}</p>}
      </div>
      {actions && <div className="pageHeadActions">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="emptyIcon">{icon}</span>
      <b>{title}</b>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (value: T) => void; items: { id: T; label: string; count: number }[] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(tab => (
        <button key={tab.id} type="button" role="tab" aria-selected={value === tab.id} className={`tab ${value === tab.id ? 'active' : ''}`} onClick={() => onChange(tab.id)}>
          {tab.label}
          <span className="tabCount">{tab.count}</span>
        </button>
      ))}
    </div>
  );
}

/* viewing + service requests share one status vocabulary */
export type RequestBucket = 'all' | 'pending' | 'accepted' | 'closed';

export function requestBucket(status: string): Exclude<RequestBucket, 'all'> {
  if (status === 'pending') return 'pending';
  if (status === 'accepted') return 'accepted';
  return 'closed';
}

export function requestTone(status: string): PillTone {
  if (status === 'pending') return 'pending';
  if (status === 'accepted') return 'ok';
  if (status === 'completed') return 'info';
  if (status === 'declined') return 'bad';
  return 'plain';
}

export function titleCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

export function RequestCard({ whenISO, title, who, incoming, status, note, href, linkLabel, actions }: {
  whenISO: string; title: string; who: string; incoming: boolean; status: string; note?: string | null; href: string; linkLabel: string; actions?: ReactNode;
}) {
  const date = new Date(whenISO);
  const valid = !Number.isNaN(date.getTime());
  return (
    <article className="reqCard">
      <div className="dateBlock" aria-label={valid ? date.toLocaleString() : undefined}>
        <b>{valid ? date.getDate() : '–'}</b>
        <span>{valid ? date.toLocaleString(undefined, { month: 'short' }) : ''}</span>
        <small>{valid ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''}</small>
      </div>
      <div className="reqMain">
        <div className="reqTop">
          <div>
            <h3 className="reqTitle">{title}</h3>
            <div className="reqWho">
              <span className="roleChip">{incoming ? <Inbox size={12} /> : <Send size={12} />}{incoming ? 'Received' : 'Sent'}</span>
              <span>{who}</span>
            </div>
          </div>
          <Pill tone={requestTone(status)}>{titleCase(status)}</Pill>
        </div>
        {note && <p className="reqNote">{note}</p>}
        <div className="reqFoot">
          {actions && <div className="reqActions">{actions}</div>}
          <Link href={href} className="reqLink">{linkLabel}<ChevronRight size={15} /></Link>
        </div>
      </div>
    </article>
  );
}
