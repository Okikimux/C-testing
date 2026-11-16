import type { ReactNode } from 'react';
import { BadgeCheck, MessageCircle, Tag } from 'lucide-react';

/** Two-panel layout shared by every /auth page: brand panel on the left (desktop), form on the right. */
export default function AuthShell({ children }: { children: ReactNode }) {
  return <main className="authShell">
    <aside className="authAside">
      <img src="/campora-app-icon.png" alt="CARTOMUX" />
      <div className="authCopy">
        <h2>Your campus.<br />Your marketplace.</h2>
        <p>Buy, sell and connect with students and vendors around your school.</p>
        <ul>
          <li><BadgeCheck aria-hidden="true" />Verified campus profiles</li>
          <li><MessageCircle aria-hidden="true" />Secure messaging</li>
          <li><Tag aria-hidden="true" />Easy selling</li>
        </ul>
      </div>
    </aside>
    <div className="authMain">{children}</div>
  </main>;
}
