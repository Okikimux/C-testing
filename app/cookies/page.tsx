import Link from 'next/link';
import { BackButton } from '../../components/back-button';
import AdsConsentControl from '../../components/ads-consent-control';
import SupportContact from '../../components/support-contact';

export const metadata = { title: 'Cookies Policy', description: 'The cookies and similar storage CARTOMUX uses, and how to control them.' };

export default function Cookies() {
  return <main className="section legal"><BackButton /><div className="container">
    <div className="eyebrow">Legal</div>
    <h1>Cookies Policy</h1>
    <p className="muted">Last updated: 15 November 2026</p>
    <section className="panel">
      <h2>1. What cookies and similar storage are</h2>
      <p>Cookies are small files a website saves on your device. Similar technologies, such as your browser’s local storage, do the same job. We call all of these “cookies” here. They help a site remember you and work properly.</p>

      <h2>2. Essential storage (always on)</h2>
      <p>These are needed for CARTOMUX to work, so they cannot be switched off in the app. They do not track you across other websites.</p>
      <ul>
        <li><b>Sign-in:</b> keeps you signed in and protects your account. It is removed when you sign out or when it expires.</li>
        <li><b>Your choices:</b> remembers your light, dark or system appearance, that you saw the cookie notice, and your advertising-cookie choice.</li>
        <li><b>Offline and speed:</b> pages and files saved on your device so the app opens quickly and shows an offline page if your connection drops.</li>
        <li><b>Ad counting:</b> a short note in your browser that stops the same ad being counted more than once in a visit. It holds no personal information.</li>
      </ul>

      <h2>3. Advertising</h2>
      <p>Sponsored ads from local businesses are served by CARTOMUX and do not use advertising cookies. We count how many times each ad is shown and clicked, without cookies and without identifying you.</p>
      <p>If Google AdSense is switched on for this site, Google may set cookies to show and measure ads. These load only after you choose “Allow ad cookies”. If you choose “Essential only”, nothing from Google is loaded. You can change your choice at any time below.</p>
      <AdsConsentControl />

      <h2>4. Analytics</h2>
      <p>CARTOMUX does not currently use analytics or marketing cookies. If we add them, we will ask for your permission first and update this page.</p>

      <h2>5. How to control cookies</h2>
      <p>You can delete or block cookies in your browser settings. If you block essential cookies, you may not be able to sign in or use some features. Your advertising choice can be changed above. If you turned on push notifications, you can turn them off in Settings or your browser.</p>

      <h2>6. More information</h2>
      <p>See the <Link href="/privacy" className="textLink">Privacy Policy</Link> for how we handle personal data. Questions about cookies can be sent through <SupportContact />. We may update this page, and the “last updated” date will change when we do.</p>
    </section>
  </div></main>;
}
