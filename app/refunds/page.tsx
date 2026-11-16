import Link from 'next/link';
import { BackButton } from '../../components/back-button';
import SupportContact from '../../components/support-contact';

export const metadata = { title: 'Refund Policy', description: 'When CARTOMUX refunds verification fees and advertising payments, and how to ask for a refund.' };

export default function Refunds() {
  return <main className="section legal"><BackButton /><div className="container">
    <div className="eyebrow">Legal</div>
    <h1>Refund Policy</h1>
    <p className="muted">Last updated: 15 November 2026</p>
    <section className="panel">
      <h2>1. What this covers</h2>
      <p>CARTOMUX takes payment for two things: <b>verification fees</b> and <b>advertising bookings</b>. Both are paid online through Paystack in naira. This policy also explains what happens with purchases between users, which are not paid through CARTOMUX.</p>

      <h2>2. Purchases between users</h2>
      <p>Buying and selling items, services or accommodation happens directly between users. CARTOMUX does not receive these payments and cannot refund them. If something goes wrong, contact the other user first. You can also report the listing or user, and we will review it under the <Link href="/terms" className="textLink">Terms</Link>, which can lead to warnings, restrictions or a ban. To stay safe, inspect items before paying, meet in public places, and be careful with advance payments.</p>

      <h2>3. Verification fees</h2>
      <p>The fee is shown in the verification flow before you pay (currently ₦1,500 for student verification and ₦2,000 for non-student vendor verification). You pay after your application is approved. We will refund the fee if:</p>
      <ul>
        <li>you were charged more than once for the same verification; or</li>
        <li>you paid, but we could not complete your verification because of a mistake or technical failure on our side.</li>
      </ul>
      <p>Once your verified badge has been issued, the fee is not refundable. Coupons and waivers cannot be exchanged for cash or transferred.</p>

      <h2>4. Advertising bookings</h2>
      <p>Your price and dates are shown before you pay, and the ad runs automatically for the days you paid for. We will refund:</p>
      <ul>
        <li><b>In full</b>, if you ask before your ad’s start time (for ads booked to start on a later date) or you were charged more than once.</li>
        <li><b>For the unused days</b>, if your ad could not run or was removed because of a mistake or technical failure on our side.</li>
      </ul>
      <p>We do not refund: an ad that ran for the days paid; an ad that we removed for breaking the advertising rules or the Terms; an ad paused or hidden because the advertiser stopped being verified; or a change of mind after the ad has started. We do not guarantee views, clicks or sales, so low results are not a reason for a refund.</p>

      <h2>5. If you were charged but nothing updated</h2>
      <p>Sometimes a payment succeeds but the page is closed before it finishes. Please do not pay again. Open <Link href="/advertise/my-ads" className="textLink">My ads</Link> (for ad bookings) or the verification page, which re-check recent payments. If it still has not updated, contact us with your payment reference.</p>

      <h2>6. How to ask for a refund</h2>
      <p>Contact us through <SupportContact /> within 7 days of the payment or of the problem, and include your account email, your payment reference and what happened. We aim to reply within 5 working days. Approved refunds go back to the original payment method through Paystack. How long they take to appear depends on your bank or card provider, usually 5 to 10 working days.</p>

      <h2>7. Your legal rights</h2>
      <p>This policy does not remove any consumer right that applies under Nigerian law and cannot lawfully be excluded.</p>
    </section>
  </div></main>;
}
