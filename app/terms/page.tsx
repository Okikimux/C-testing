import Link from 'next/link';
import { BackButton } from '../../components/back-button';
import SupportContact from '../../components/support-contact';

export const metadata = { title: 'Terms & Conditions', description: 'The rules for using CARTOMUX: accounts, listings, verification, advertising, payments and enforcement.' };

export default function Terms() {
  return <main className="section legal"><BackButton /><div className="container">
    <div className="eyebrow">Legal</div>
    <h1>Terms &amp; Conditions</h1>
    <p className="muted">Last updated: 15 November 2026</p>
    <section className="panel">
      <h2>1. About these terms</h2>
      <p>CARTOMUX is a marketplace for students and non-student vendors, operated by MUXLAB (“CARTOMUX”, “we”, “us”). By creating an account or using the service you agree to these terms, our <Link href="/privacy" className="textLink">Privacy Policy</Link>, <Link href="/cookies" className="textLink">Cookies Policy</Link> and <Link href="/refunds" className="textLink">Refund Policy</Link>. If you do not agree, please do not use CARTOMUX.</p>
      <p>You must be at least 18 years old, or use CARTOMUX with the permission and supervision of a parent or guardian. You must give accurate information, keep your account secure, use the service lawfully, and promptly report any suspected unauthorised access. You are responsible for activity carried out through your account.</p>

      <h2>2. Accounts and verification</h2>
      <p>Verification is an extra trust signal. An unverified account is not, for that reason alone, fraudulent. Student applicants must provide genuine, current enrolment evidence. Non-student vendors may apply as individual traders or businesses and must provide truthful information and any supporting evidence we ask for. Do not impersonate another person, falsify documents, or misrepresent your identity, student status or business.</p>
      <p>Verification applications are reviewed. Approval of the application is the first stage; verification is complete only after the required fee is paid or a valid waiver is applied. A student who has paid for student verification is not charged a second fee just to use the vendor-selling privileges covered by that verification. Coupons and waivers are valid only under the rules shown when they are issued and cannot be transferred or exchanged for cash. If your verification is withdrawn or you stop meeting the requirements, the verified badge and privileges that depend on it may be removed, including the display of any paid advertising linked to your account.</p>

      <h2>3. Listings and seller responsibilities</h2>
      <p>Listings must be lawful, accurate, available and described honestly. Sellers must truthfully represent the price, condition, specifications, location, availability and any important limitation. Use photos you have the right to use and do not use misleading or copied images. Keep listings up to date and remove them or mark them unavailable once the item is gone. Do not manipulate visibility with deceptive duplicate listings.</p>
      <p>For accommodation listings you must be entitled to offer the property, describe it truthfully (including rent, any extra fees and the payment plan), and not ask anyone to pay for a property that does not exist or that you cannot offer. Buyers are encouraged to see a property before paying.</p>
      <p>Unverified accounts may publish up to five active listings. Verified accounts may receive additional listing privileges. These limits do not guarantee sales, search placement or promotion.</p>

      <h2>4. Buyer responsibilities</h2>
      <p>Buyers must communicate honestly, respect other users, and not submit fabricated payment evidence, knowingly false complaints, or abusive refund or dispute requests. Before paying, confirm the item, the seller, the price, the delivery or collection arrangements, and any extra charges.</p>

      <h2>5. Prohibited conduct</h2>
      <p>You must not: (a) scam, defraud, impersonate, threaten, harass or abuse another person; (b) list illegal, prohibited, dangerous or unlawfully restricted goods or services; (c) submit false verification information; (d) manipulate reviews, ratings, reports, listings or marketplace systems; (e) steal accounts, access another account without permission, or exploit payment or technical systems; or (f) use CARTOMUX to facilitate unlawful activity.</p>

      <h2>6. Reports, enforcement and the three-strike process</h2>
      <p>A report is a request for review and is not itself proof of a violation. An authorised CARTOMUX administrator reviews the available evidence before confirming a violation. For ordinary confirmed violations the process is: first strike, a formal warning; second strike, a final warning and possible temporary restrictions; third strike, a permanent account ban. Strikes do not automatically expire. Serious misconduct may lead to immediate restrictions or a ban. Enforcement decisions are recorded with the relevant evidence and reason.</p>
      <p>You may appeal a confirmed enforcement decision on the <Link href="/appeals" className="textLink">Moderation appeals</Link> page. Appeals are reviewed by an authorised reviewer, and mistaken strikes or restrictions may be corrected or reversed. An appeal does not guarantee reinstatement. We may keep relevant records to investigate abuse, protect users and comply with legal obligations.</p>

      <h2>7. Transactions, safety and consumer rights</h2>
      <p>Unless a CARTOMUX checkout service clearly says otherwise, buyers and sellers arrange payment and delivery directly with each other, and CARTOMUX is not a party to those transactions. We do not guarantee another user’s conduct, the quality of an item, delivery or payment. Meet in safe places, inspect items where you can, and never share passwords, one-time codes or unnecessary personal information. Nothing in these terms removes a consumer right that cannot lawfully be excluded.</p>

      <h2>8. Advertising and sponsored content</h2>
      <p>Verified accounts can book advertising on CARTOMUX at <Link href="/advertise" className="textLink">cartomux.com.ng/advertise</Link>. Prices, the pages chosen and the dates are shown in naira before you pay. When payment is confirmed, the ad runs automatically for the days you paid for and then stops. Ads are labelled “Sponsored”; a label does not mean CARTOMUX recommends or checks the advertiser’s products.</p>
      <p>Advertisers are responsible for the content of their ads and for following the advertising rules on the Advertise page. Because ads go live without prior review, CARTOMUX may pause or remove any ad at any time, for example if it breaks the rules, is reported, or the advertiser stops being verified. We do not promise a number of views, clicks or sales. Refunds for advertising are handled under the <Link href="/refunds" className="textLink">Refund Policy</Link>.</p>

      <h2>9. Fees and payments</h2>
      <p>Browsing and listing are free unless we say otherwise. Verification fees and advertising fees are shown before you pay. Card and bank payments for these fees are processed by Paystack; we do not store your card details. A payment is confirmed only when our server receives confirmation from Paystack for the correct amount. If you were charged but your booking or verification did not update, do not pay again; contact support with your payment reference.</p>

      <h2>10. Your content and our brand</h2>
      <p>You keep ownership of what you post (listings, photos, messages and ad content). You give CARTOMUX a non-exclusive, worldwide, royalty-free licence to host, display, copy and adapt that content as needed to run, protect and promote the service, for as long as it stays on CARTOMUX. You confirm you have the rights to post it. The CARTOMUX and MUXLAB names, logos and design belong to us and may not be used without our written permission.</p>

      <h2>11. Moderation and service availability</h2>
      <p>We may review reports, remove or restrict listings and ads, suspend features or restrict accounts to enforce these terms, investigate credible safety concerns, protect the service, or comply with law. We aim to apply the rules fairly but cannot guarantee uninterrupted access or prevent every harmful interaction.</p>

      <h2>12. Our responsibility</h2>
      <p>CARTOMUX is provided on an “as is” and “as available” basis. To the extent the law allows, we are not responsible for what users post or do, for dealings between users, or for losses that were not a foreseeable result of our own breach. Nothing in these terms limits liability that cannot lawfully be limited, including for fraud or for death or personal injury caused by negligence.</p>

      <h2>13. Ending your use of CARTOMUX</h2>
      <p>You can stop using CARTOMUX at any time and may ask for your account and data to be deleted as described in the Privacy Policy. We may suspend or end access under section 6 or if you seriously or repeatedly break these terms. Sections that by their nature should continue (for example sections 10, 12 and 14) continue after your account ends.</p>

      <h2>14. Privacy and third-party services</h2>
      <p>We use third-party services for sign-in, database and file storage, payments and hosting. Personal data and verification documents are handled under our <Link href="/privacy" className="textLink">Privacy Policy</Link>, access controls and applicable law. Please submit only the information requested for the purpose.</p>

      <h2>15. Governing law</h2>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria. We encourage you to contact us first so we can try to resolve any complaint; if that does not work, the courts of Nigeria have jurisdiction, without affecting any right you have to go to a regulator or any consumer right that applies by law.</p>

      <h2>16. Changes and contact</h2>
      <p>We may update these terms. For material changes we will give notice in the app or by email and show the new “last updated” date; continued use after the change takes effect means you accept the updated terms, to the extent the law allows. Questions, reports and complaints can be sent through <SupportContact />. To challenge an enforcement decision, use <Link href="/appeals" className="textLink">Moderation appeals</Link>.</p>
    </section>
  </div></main>;
}
