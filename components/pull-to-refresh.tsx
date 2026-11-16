'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

const THRESHOLD = 72; // how far (px) the page must be pulled before it refreshes
const MAX_PULL = 120;

// Pages where a pull could clash with scrolling or wipe typed text.
const EXCLUDED = [/^\/messages\/[^/]+/, /^\/sell/, /^\/auth/, /^\/verification/, /^\/feedback/, /^\/appeals/, /^\/settings/, /^\/admin/];

function isInstalledApp() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function insideScrolledArea(el: Element | null) {
  for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
    if (node.scrollTop > 0) return true;
  }
  return false;
}

/**
 * Pull-down-to-refresh for people who opened CARTOMUX from their home screen (no browser refresh button).
 * Does nothing in a normal browser tab.
 */
export default function PullToRefresh() {
  const pathname = usePathname();
  const enabled = !EXCLUDED.some(pattern => pattern.test(pathname));
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const gesture = useRef({ active: false, startY: 0, startX: 0, pull: 0 });

  useEffect(() => {
    if (!enabled || !isInstalledApp()) return;
    // Switch off the browser's own pull/bounce so only this one runs.
    document.documentElement.classList.add('ptrActive');

    const reset = () => { gesture.current = { active: false, startY: 0, startX: 0, pull: 0 }; setPull(0); };

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || window.scrollY > 0) return;
      const target = event.target as Element | null;
      if (target?.closest('input, textarea, select, [contenteditable], [data-no-ptr], .accountDropdown, .supportPanel, .messageInfoModalBackdrop, .catChips') || insideScrolledArea(target)) return;
      gesture.current = { active: true, startY: event.touches[0].clientY, startX: event.touches[0].clientX, pull: 0 };
    };

    const onMove = (event: TouchEvent) => {
      const g = gesture.current;
      if (!g.active) return;
      const dy = event.touches[0].clientY - g.startY;
      const dx = Math.abs(event.touches[0].clientX - g.startX);
      if (dy <= 0 || window.scrollY > 0 || dx > dy) { if (g.pull > 0 || dy <= 0) reset(); return; }
      g.pull = Math.min(MAX_PULL, dy * 0.5);
      setPull(g.pull);
      if (event.cancelable) event.preventDefault();
    };

    const onEnd = () => {
      const g = gesture.current;
      if (g.active && g.pull >= THRESHOLD) {
        gesture.current = { active: false, startY: 0, startX: 0, pull: 0 };
        setRefreshing(true);
        setPull(THRESHOLD);
        window.setTimeout(() => window.location.reload(), 250);
      } else {
        reset();
      }
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', reset);
    return () => {
      document.documentElement.classList.remove('ptrActive');
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', reset);
    };
  }, [enabled]);

  if (pull <= 0 && !refreshing) return null;
  const ready = pull >= THRESHOLD;
  return <div
    className={`ptr ${ready || refreshing ? 'ready' : ''} ${gesture.current.active ? 'dragging' : ''}`}
    style={{ ['--pull' as string]: `${pull}px`, opacity: Math.min(1, pull / 36) }}
    role="status"
    aria-label={refreshing ? 'Refreshing' : ready ? 'Release to refresh' : 'Pull to refresh'}
  >
    <RefreshCw size={20} className={refreshing ? 'spin' : ''} style={refreshing ? undefined : { transform: `rotate(${(pull / THRESHOLD) * 270}deg)` }} aria-hidden="true" />
  </div>;
}
