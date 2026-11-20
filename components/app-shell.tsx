'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ToastProvider } from './toast';
import CookieNotice from './cookie-notice';
import PullToRefresh from './pull-to-refresh';
import { ThemeSwitch } from './theme';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Bell, Home, MessageCircle, Plus, ShoppingBag, ChevronDown, Settings, LogOut, UserRound, Package, Heart, Store } from 'lucide-react';
import { createClient } from '../lib/supabase';
import { Avatar } from './avatar';
import { VerifiedName } from './verified-name';
import { AccountBadge } from './account-badge';
import { useMyAccount } from '../lib/use-account';
import ContactSupport from './contact-support';
import NetworkStatus from './network-status';
import ServiceWorkerRegister from './service-worker-register';


export default function AppShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [verified, setVerified] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const account = useMyAccount();
  const pathname = usePathname();
  const [unreadMessages, setUnreadMessages] = useState(0);
  useEffect(() => { if (!menuOpen) return; const close = (event: MouseEvent) => { const target = event.target as Element | null; if (target && !target.closest('.accountMenu')) setMenuOpen(false); }; const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); }; document.addEventListener('click', close); document.addEventListener('keydown', key); return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', key); }; }, [menuOpen]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;
    let profileChannel: any;
    let verificationChannel: any;
    let messagesChannel: any;
    let notificationsChannel: any;
    let loadSequence = 0;

    const refreshCounts = async (currentUser: any) => {
      if (!currentUser) {
        if (mounted) { setUnreadMessages(0); setUnreadNotifications(0); }
        return;
      }
      const [{ count: messageCount }, { count: notificationCount }] = await Promise.all([
        supabase.from('messages').select('id', { count: 'exact', head: true }).neq('sender_id', currentUser.id).is('read_at', null),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', currentUser.id).is('read_at', null),
      ]);
      if (mounted) {
        setUnreadMessages(messageCount || 0);
        setUnreadNotifications(notificationCount || 0);
      }
    };

    const removeChannels = () => {
      for (const channel of [profileChannel, verificationChannel, messagesChannel, notificationsChannel]) {
        if (channel) void supabase.removeChannel(channel);
      }
      profileChannel = verificationChannel = messagesChannel = notificationsChannel = null;
    };

    const loadProfile = async (currentUser: any) => {
      const sequence = ++loadSequence;
      // Tear down the previous generation even when the same user emits another auth event.
      removeChannels();

      if (!currentUser) {
        if (mounted) { setUser(null); setProfile(null); setVerified(false); }
        await refreshCounts(null);
        return;
      }
      if (mounted) setUser(currentUser);

      const [{ data }, { data: verification }] = await Promise.all([
        supabase.from('profiles').select('id,full_name,campus,avatar_url,role').eq('id', currentUser.id).maybeSingle(),
        supabase.from('student_verifications').select('user_id').eq('user_id', currentUser.id).eq('status', 'approved').in('payment_status', ['paid', 'waived']).maybeSingle(),
      ]);
      if (!mounted || sequence !== loadSequence) return;
      if (mounted) { setProfile(data || null); setVerified(!!verification); }
      await refreshCounts(currentUser);
      if (!mounted || sequence !== loadSequence) return;

      // Every auth load gets a fresh topic. Supabase returns the existing channel
      // for a duplicate topic, which must not receive handlers after subscribe().
      const channelSuffix = `${sequence}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      profileChannel = supabase.channel(`app-profile-${currentUser.id}-${channelSuffix}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${currentUser.id}` }, (payload) => {
          if (payload.eventType === 'DELETE') {
            if (mounted) setProfile(null);
          } else if (mounted) {
            setProfile(payload.new);
          }
        })
        .subscribe();

      verificationChannel = supabase.channel(`app-verification-${currentUser.id}-${channelSuffix}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'student_verifications', filter: `user_id=eq.${currentUser.id}` }, async () => {
          const { data: fresh } = await supabase.from('student_verifications').select('user_id').eq('user_id', currentUser.id).eq('status', 'approved').in('payment_status', ['paid', 'waived']).maybeSingle();
          if (mounted) setVerified(!!fresh);
        })
        .subscribe();

      messagesChannel = supabase.channel(`app-unread-messages-${currentUser.id}-${channelSuffix}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => { void refreshCounts(currentUser); })
        .subscribe();

      notificationsChannel = supabase.channel(`app-unread-notifications-${currentUser.id}-${channelSuffix}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUser.id}` }, (payload) => {
          void refreshCounts(currentUser);
          if (payload.eventType === 'INSERT') {
            const n: any = payload.new;
            void supabase.functions.invoke('push-notify', { body: { user_ids: [currentUser.id], title: n.title || 'CARTOMUX', body: n.body || 'You have a new notification.', url: n.listing_id ? `/product/${n.listing_id}` : '/notifications' } });
          }
        })
        .subscribe();
    };

    // Supabase emits INITIAL_SESSION here. Using this single auth entry point avoids
    // racing getUser() against INITIAL_SESSION and registering duplicate callbacks.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => { void loadProfile(session?.user || null); }, 0);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      loadSequence++;
      removeChannels();
    };
  }, []);

  async function signOut() {
    setMenuOpen(false);
    await createClient().auth.signOut({ scope: 'local' });
    window.location.assign('/');
  }

  const avatarUrl = profile?.avatar_url;
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'CARTOMUX student';
  const messageBadge = unreadMessages > 99 ? '99+' : unreadMessages > 0 ? String(unreadMessages) : '';
  const notificationBadge = unreadNotifications > 99 ? '99+' : unreadNotifications > 0 ? String(unreadNotifications) : '';

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/marketplace', label: 'Marketplace' },
    { href: '/sell', label: 'Sell' },
    { href: '/messages', label: 'Messages', badge: messageBadge },
  ];
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  return <ToastProvider>
    <header className="nav">
      <div className="container navin">
        <Link href="/" className="brand" aria-label="CARTOMUX home">
          <img src="/campora-app-icon.png" alt="CARTOMUX" />
          <span className="brandWord">CARTOMUX</span>
        </Link>
        <nav className="links" aria-label="Primary navigation">
          {navLinks.map(l => <Link key={l.href} href={l.href} className={`${l.badge !== undefined ? 'navBadgeLink ' : ''}${isActive(l.href) ? 'active' : ''}`} aria-current={isActive(l.href) ? 'page' : undefined}>{l.label}{l.badge && <span className="navCountBadge">{l.badge}</span>}</Link>)}
        </nav>
        <div className="actions">
          {user ? <>
            <Link className="iconBtn navIconBadge" href="/notifications" aria-label={notificationBadge ? `Notifications, ${notificationBadge} unread` : 'Notifications'}><Bell size={18} />{notificationBadge && <span className="navCountBadge">{notificationBadge}</span>}</Link>
            <div className="accountMenu">
              <button className="avatarButton" aria-label="Open account menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}>
                <Avatar url={avatarUrl} name={displayName} size="sm" />
                <ChevronDown size={14} />
              </button>
              {menuOpen && <div className="accountDropdown">
                <div className="accountSummary"><Avatar url={avatarUrl} name={displayName} size="md" /><div><VerifiedName userId={user?.id} name={displayName} verified={verified}/><span>{profile?.campus || 'Campus not set'}</span>{account.accountType && <AccountBadge type={account.accountType} className="inMenu" />}</div></div>
                <Link href="/profile" onClick={() => setMenuOpen(false)}><UserRound size={17} /> Profile</Link>
                <Link href="/my-listings" onClick={() => setMenuOpen(false)}><Package size={17} /> My listings</Link>
                <Link href="/favourites" onClick={() => setMenuOpen(false)}><Heart size={17} /> Favourites</Link>
                {account.isVendor && <Link href="/store/manage" onClick={() => setMenuOpen(false)}><Store size={17} /> My storefront</Link>}
                <Link href="/settings" onClick={() => setMenuOpen(false)}><Settings size={17} /> Settings</Link>
                <ThemeSwitch />
                <button onClick={signOut}><LogOut size={17} /> Sign out</button>
              </div>}
            </div>
          </> : <Link className="btn light" href="/auth/login">Sign in</Link>}
          <Link className="btn green desktopSell" href="/sell"><Plus size={17} /> Sell item</Link>
        </div>
      </div>
    </header>
    {children}
    <footer className="footer"><div className="container">
      <div className="footerIn">
        <div>
          <strong>CARTOMUX</strong>
          <div className="footerMuted">List It. Find It. Get It.</div>
          <div className="footerLinks"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/refunds">Refunds</Link><Link href="/cookies">Cookies</Link><Link href="/appeals">Appeals</Link><Link href="/advertise">Advertise</Link><Link href="/feedback">Feedback</Link></div>
        </div>
        <div className="muxlabCredit"><img src="/muxlab-logo.png" width="52" height="24" alt="MUXLAB" /><span>An innovation by MUXLAB</span></div>
      </div>
      <div className="footerBar">&copy; {new Date().getFullYear()} CARTOMUX. All rights reserved.</div>
    </div></footer>
    <CookieNotice />
    <PullToRefresh />
    <NetworkStatus />
    <ContactSupport />
    <ServiceWorkerRegister />
    <nav className="mobileNav" aria-label="Mobile navigation">
      <div className="mobileNavInner">
        {[
          { href: '/', label: 'Home', Icon: Home },
          { href: '/marketplace', label: 'Market', Icon: ShoppingBag },
          { href: '/sell', label: 'Sell', Icon: Plus, special: true },
          { href: '/messages', label: 'Messages', Icon: MessageCircle, badge: messageBadge },
          { href: '/profile', label: 'Profile', Icon: UserRound },
        ].map(({ href, label, Icon, badge, special }) => {
          const active = isActive(href);
          return <Link href={href} key={href} className={`mobileNavItem ${active ? 'active' : ''} ${special ? 'sellItem' : ''}`} aria-current={active ? 'page' : undefined}>
            <span className="mobileNavIcon">{special ? <span className="mobileNavFab"><Icon size={26} strokeWidth={2.4}/></span> : <Icon size={21} strokeWidth={active ? 2.4 : 2}/>}</span>
            <span className="mobileNavLabel">{label}</span>
            {badge && <span className="navCountBadge">{badge}</span>}
          </Link>;
        })}
      </div>
    </nav>
  </ToastProvider>;
}
