import Link from 'next/link';
import { BackButton } from '../../components/back-button';
import SupportContact from '../../components/support-contact';

export const metadata = { title: 'Privacy Policy', description: 'How CARTOMUX collects, uses, shares and protects personal data, and the rights you have under Nigerian law.' };

export default function Privacy() {
  return <main className="section legal"><BackButton /><div className="container">
    <div className="eyebrow">Legal</div>
    <h1>Privacy Policy</h1>
    <p className="muted">Last updated: 15 November 2026</p>
    <section className="panel">
      <h2>1. Who we are</h2>
      <p>CARTOMUX is a marketplace operated by MUXLAB (“CARTOMUX”, “we”, “us”). We decide why and how your personal data is used, which makes us the “data controller” under the Nigeria Data Protection Act 2023 (NDPA). You can contact us about your data through <SupportContact />.</p>

      <h2>2. What we collect</h2>
      <ul>
        <li><b>Account and profile:</b> your name, email address, campus or school, location you choose to show, avatar, and sign-in details. Your name, avatar, campus and verified badge can be seen by other users.</li>
        <li><b>Private contact details:</b> phone and WhatsApp numbers you add in Settings. Only you can read these; they are not shown on public profiles.</li>
        <li><b>Listings and activity:</b> listings, photos, prices, favourites, price alerts, reports you make, and your notification settings.</li>
        <li><b>Messages:</b> messages and images you send to other users inside CARTOMUX.</li>
        <li><b>Verification:</b> if you apply, student enrolment documents, or for vendors identity and business information including a National Identification Number (NIN) where requested.</li>
        <li><b>Payments:</b> payment references, amounts, dates and status for verification and advertising fees. Payments are processed by Paystack; we do not receive or store your card details.</li>
        <li><b>Advertising:</b> if you book an ad, your business name, ad content and link, the pages and dates booked, and payment records. For every ad we count views and clicks without cookies or personal identifiers.</li>
        <li><b>Support and feedback:</b> what you send us and the email address you give.</li>
        <li><b>Device and technical data:</b> a push-notification subscription if you turn notifications on, your light, dark or system appearance choice, your cookie choices, and the technical information needed to keep you signed in and the service secure.</li>
      </ul>

      <h2>3. Why we use it, and our legal basis</h2>
      <ul>
        <li>To provide accounts, listings, messaging, favourites and notifications. <i>Basis: performing our agreement with you.</i></li>
        <li>To review verification applications and confirm payments. <i>Basis: your consent and our agreement with you, and our legitimate interest in preventing fraud.</i></li>
        <li>To moderate the marketplace, handle reports and appeals, and keep users safe. <i>Basis: our legitimate interests and legal obligations.</i></li>
        <li>To process ad bookings and show ads. <i>Basis: performing our agreement with advertisers; our legitimate interest in counting views and clicks.</i></li>
        <li>To send push notifications. <i>Basis: your consent, which you can withdraw in Settings or your browser.</i></li>
        <li>To show Google ads, if switched on. <i>Basis: your consent (see the Cookies Policy).</i></li>
        <li>To keep records, resolve disputes and meet legal, tax and regulatory duties. <i>Basis: legal obligation and legitimate interests.</i></li>
      </ul>

      <h2>4. Who we share data with</h2>
      <p>We do not sell your personal data. We share it only as follows:</p>
      <ul>
        <li><b>Other users:</b> your public profile and listings. Private contact details, verification documents and payment records are never shown to other users.</li>
        <li><b>Service providers</b> that run the service for us: Supabase (sign-in, database and file storage), Paystack (payments), our hosting provider, email delivery for sign-in and reset emails, and browser push services (such as those run by Apple, Google and Mozilla) if you enable notifications. If Google AdSense is switched on and you allow it, Google receives the information described in the Cookies Policy.</li>
        <li><b>Advertisers</b> receive combined results (views and clicks), not information about individual users. An ad link takes you to the advertiser’s own website, which has its own privacy practices.</li>
        <li><b>Authorities and advisers</b> where the law requires it, to protect people from harm, or to establish or defend legal claims.</li>
      </ul>

      <h2>5. Verification documents and sensitive information</h2>
      <p>Verification documents are kept in private storage, are not shown on public profiles or listings, and may be opened only by you and authorised reviewers. NIN and identity documents get extra care. Please do not put passwords, one-time codes or unnecessary sensitive information in listings or messages.</p>

      <h2>6. Payments</h2>
      <p>Verification and advertising payments are started through Paystack. Our server asks Paystack to confirm the amount, currency, reference and booking before marking a payment complete. Card details are handled by Paystack and are not stored by CARTOMUX.</p>

      <h2>7. Moderation and appeals</h2>
      <p>To enforce the marketplace rules and protect users we may keep reports, references to evidence, confirmed violations, strike history, decisions and appeal outcomes. A report alone is not treated as proof of a violation. Access to these records is limited to authorised staff and, where appropriate, the person affected.</p>

      <h2>8. Advertising</h2>
      <p>CARTOMUX shows sponsored ads from local businesses. We count how many times each ad is shown and clicked, without cookies and without personal identifiers. If Google AdSense is switched on, Google may use cookies and similar technologies to show and measure ads, but only after you allow ad cookies, and you can change that choice on the <Link href="/cookies" className="textLink">Cookies page</Link>.</p>

      <h2>9. How long we keep data</h2>
      <ul>
        <li><b>Account and profile:</b> while your account is open. After you ask us to delete it, we delete or anonymise it within 30 days, except what we must keep below.</li>
        <li><b>Listings and messages:</b> until you remove them or your account is deleted. A message deleted for everyone has its content removed.</li>
        <li><b>Verification documents:</b> while your verification is active. If an application is rejected or withdrawn, or you delete your account, we delete the documents within 90 days.</li>
        <li><b>Payment and booking records:</b> for as long as tax, accounting and legal rules require.</li>
        <li><b>Moderation records:</b> for as long as needed to enforce the rules, handle appeals and defend legal claims.</li>
        <li><b>Ad view and click counts:</b> kept in combined form for reporting to advertisers.</li>
        <li><b>Support messages:</b> for as long as needed to help you and improve the service.</li>
      </ul>

      <h2>10. Transfers outside Nigeria</h2>
      <p>Some of our providers store or process data outside Nigeria. Where that happens we rely on providers that apply appropriate safeguards and, where the NDPA requires, other lawful transfer mechanisms.</p>

      <h2>11. Your rights</h2>
      <p>Under the NDPA you may ask to: see the personal data we hold about you; correct it; delete it; restrict or object to some uses; receive a copy in a common format; and withdraw consent you have given (this does not affect what we did before). Contact us through <SupportContact /> from the email address on your account, and we will usually reply within one month. These rights are subject to the law and to records we must keep. You also have the right to complain to the Nigeria Data Protection Commission.</p>

      <h2>12. Children</h2>
      <p>CARTOMUX is intended for people aged 18 and over, or younger users with a parent or guardian’s permission. If we learn we hold data from a child without that permission, we will delete it.</p>

      <h2>13. Security</h2>
      <p>We use access controls, row-level database policies, protected routes, private file storage and server-side payment checks. No internet service is perfectly secure. If you think your account or information has been compromised, contact us straight away.</p>

      <h2>14. Changes</h2>
      <p>We may update this policy. We will show the new “last updated” date and, for important changes, tell you in the app or by email.</p>
    </section>
  </div></main>;
}
