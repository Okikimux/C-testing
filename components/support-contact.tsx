import Link from 'next/link';

/** "the support button in the app, the Feedback page, email x or WhatsApp y" - uses the contact details set in the hosting environment. */
export default function SupportContact() {
  const email = process.env.NEXT_PUBLIC_CAMPORA_SUPPORT_EMAIL || '';
  const phone = (process.env.NEXT_PUBLIC_CAMPORA_SUPPORT_WHATSAPP || '').replace(/[^0-9]/g, '');
  return <>
    the support button in the app, the <Link href="/feedback" className="textLink">Feedback page</Link>
    {email && <>, or by email at <a href={`mailto:${email}`} className="textLink">{email}</a></>}
    {phone && <>{email ? ', or' : ', or by'} WhatsApp on <a href={`https://wa.me/${phone}`} className="textLink" target="_blank" rel="noopener noreferrer">+{phone}</a></>}
  </>;
}
