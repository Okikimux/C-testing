import Link from 'next/link';
import AdSlot from '../components/ad-slot';
import { ArrowRight, BadgeCheck, BookOpen, BriefcaseBusiness, Gamepad2, Laptop, MessageCircle, Search, Shirt, Smartphone, Tag } from 'lucide-react';

const cats = [
  ['Phones & Gadgets', Smartphone],
  ['Laptops', Laptop],
  ['Fashion', Shirt],
  ['Books', BookOpen],
  ['Gaming', Gamepad2],
  ['Services', BriefcaseBusiness],
] as const;

const trust = [
  [BadgeCheck, 'Verified campus profiles', 'Know who you are buying from.'],
  [MessageCircle, 'Secure messaging', 'Chat inside CARTOMUX before you meet.'],
  [Tag, 'Easy selling', 'List an item in minutes.'],
] as const;

export const metadata = { alternates: { canonical: '/' } };

export default function Home() {
  return <main>
    <section className="hero">
      <div className="container heroGrid">
        <div>
          <h1><span>List it.</span><span>Find it.</span><span>Get it.</span></h1>
          <p className="heroLead">A marketplace built for campus life. Buy, sell, discover, and connect with your campus community, all in one place.</p>
          <form className="search" action="/marketplace" method="get" role="search">
            <Search size={20} aria-hidden="true" />
            <input name="q" maxLength={100} placeholder="Search items, services and more..." aria-label="Search listings" />
            <button className="btn green">Explore</button>
          </form>
        </div>
        <div className="heroTags">
          {trust.map(([Icon, title, sub]) => <div className="heroTag" key={title}><span className="tagIcon"><Icon size={22} aria-hidden="true" /></span><div><b>{title}</b><span className="sub">{sub}</span></div></div>)}
        </div>
      </div>
    </section>

    <section className="section">
      <div className="container">
        <div className="sectionHead"><h2>Shop by category</h2><Link href="/marketplace" className="textLink">See all listings</Link></div>
        <div className="categories">
          {cats.map(([name, Icon]) => <Link className="cat" href={'/marketplace?category=' + encodeURIComponent(name)} key={name}><Icon aria-hidden="true" />{name}</Link>)}
        </div>
      </div>
    </section>

    <section className="adHomeSection">
      <div className="container"><AdSlot placement="home" variant="banner" /></div>
    </section>

    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="ctaBand">
          <div><h2>Ready to make your first listing?</h2><p>List an item in minutes and reach your campus community.</p></div>
          <Link className="btn green" href="/sell">Start selling <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  </main>;
}
