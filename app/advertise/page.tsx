import Link from 'next/link';
import { BadgeCheck, Mail, MessageCircle, TrendingUp } from 'lucide-react';
import { BackButton } from '../../components/back-button';
import AdPricing from '../../components/ad-pricing';

export const metadata = { title: 'Advertise with CARTOMUX', description: 'Put your shop, service or event in front of students and vendors on campus. Verified accounts can book and pay online.' };

const steps = [
  'Get verified. Only verified accounts can advertise, which keeps ads trustworthy.',
  'Build your ad, choose the pages and the number of days. You see the price before you pay.',
  'Pay online with Paystack. Your ad goes live automatically and runs for exactly the days you paid for.',
  'Follow views and clicks on your My ads page, and renew when you are ready.',
];

const rules = [
  'Your ad must be honest and legal in Nigeria.',
  'Not allowed: illegal goods or services, weapons, drugs, adult content, gambling, scams or "get rich quick" offers, fake or misleading claims, hate or harassment, and pretending to be another business or person.',
  'Links must go to a safe website. No links that download files or ask for passwords.',
  'Ads go live automatically, so you are responsible for what you publish. CARTOMUX may pause or remove any ad at any time, for example if it breaks these rules or is reported.',
  'If we remove an ad for breaking these rules, the unused days are not refunded. If we remove an ad by mistake, we refund the unused days.',
  'Ads stop showing automatically if your account stops being verified.',
  'Prices are in naira and shown before you pay. Payments are processed by Paystack.',
];

export default function Advertise() {
  const email = process.env.NEXT_PUBLIC_CAMPORA_SUPPORT_EMAIL || '';
  const phone = (process.env.NEXT_PUBLIC_CAMPORA_SUPPORT_WHATSAPP || '').replace(/[^0-9]/g, '');
  const message = encodeURIComponent('Hello CARTOMUX, I would like to talk about a custom advertising deal.');
  return <main className="section advertisePage">
    <BackButton />
    <div className="container">
      <div className="advertiseHero">
        <h1>Advertise with CARTOMUX</h1>
        <p className="advertiseLead">Put your shop, service or event in front of students and vendors around campus. Book online, pay, and your ad runs automatically.</p>
        <div className="actionsRow">
          <Link className="btn green" href="/advertise/book">Book an ad</Link>
          <Link className="btn light" href="/advertise/my-ads">My ads</Link>
        </div>
        <p className="muted advertiseVerified"><BadgeCheck size={16} aria-hidden="true" /> Only verified accounts can advertise.</p>
      </div>

      <h2>Where your ad can appear</h2>
      <AdPricing />

      <div className="advertiseCols">
        <section className="panel">
          <h2>What you get</h2>
          <ul className="advertiseList">
            <li><BadgeCheck size={18} aria-hidden="true" /> Your own image, headline, link and button text.</li>
            <li><BadgeCheck size={18} aria-hidden="true" /> The pages and the days you choose, with the price shown up front.</li>
            <li><BadgeCheck size={18} aria-hidden="true" /> A clear &ldquo;Sponsored&rdquo; label, so people trust what they see.</li>
            <li><TrendingUp size={18} aria-hidden="true" /> Views and clicks for every ad, in My ads.</li>
          </ul>
        </section>
        <section className="panel">
          <h2>How it works</h2>
          <ol className="advertiseSteps">{steps.map(step => <li key={step}>{step}</li>)}</ol>
        </section>
      </div>

      <section className="panel advertiseRules" id="rules">
        <h2>Advertising rules</h2>
        <ul className="advertiseRuleList">{rules.map(rule => <li key={rule}>{rule}</li>)}</ul>
      </section>

      <section className="panel advertiseCustom">
        <div><h2>Want something custom?</h2><p className="muted">For longer partnerships, bigger placements or special offers, talk to us directly.</p></div>
        <div className="actionsRow">
          {phone && <a className="btn light" href={`https://wa.me/${phone}?text=${message}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> WhatsApp</a>}
          {email && <a className="btn light" href={`mailto:${email}?subject=${encodeURIComponent('Advertising on CARTOMUX')}`}><Mail size={18} /> Email</a>}
          {!phone && !email && <Link className="btn light" href="/feedback">Contact the team</Link>}
        </div>
      </section>
    </div>
  </main>;
}
