import Link from "next/link";
import {Header} from "@/components/header";
import {getPublicSupportEmail} from "@/lib/public-contact";

export default function PrivacyPage(){
 const supportEmail=getPublicSupportEmail();
 return <><Header/><main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Launch-candidate policy</p>
  <h1 className="mt-3 text-4xl font-black tracking-[-.045em]">SecondPart Privacy Policy</h1>
  <p className="mt-3 text-sm text-[#63706a]">Last updated 10 September 2026</p>
  <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">This policy reflects the current SecondPart product architecture. Final developer/contracting identity, legal wording and retention periods must be verified before public production launch.</p>

  <div className="mt-8 space-y-8 text-sm leading-7 text-[#4f5e57]">
   <section><h2 className="text-xl font-black text-[#12221d]">What data SecondPart handles</h2><p className="mt-2">Depending on the features you use, SecondPart may process account and profile information; seller/business profile data; saved parts and searches; Garage vehicles and vehicle registrations; listings, product photos and compatibility evidence; recently viewed items; part requests; buyer/seller messages; order, delivery, return and dispute records; support requests; payment and payout status; notification preferences and Android push-device tokens; and technical/security records needed to operate and protect the service.</p></section>

   <section><h2 className="text-xl font-black text-[#12221d]">Why we use it</h2><p className="mt-2">We use this information to provide accounts and marketplace features, identify vehicles, assess and display compatibility evidence, show and manage listings, process marketplace transactions, support buyer protection and seller payouts, provide messaging and notifications, prevent fraud and abuse, respond to support requests, improve reliability, and meet legal or regulatory obligations.</p></section>

   <section><h2 className="text-xl font-black text-[#12221d]">Vehicle data</h2><p className="mt-2">A vehicle registration may be used to identify a vehicle when an approved lookup provider is configured. Manual vehicle selection remains available. Vehicle details are also used to apply compatibility filters and evidence. SecondPart does not need device GPS access for the current postcode-based marketplace distance feature.</p></section>

   <section><h2 className="text-xl font-black text-[#12221d]">Payments and service providers</h2><p className="mt-2">SecondPart uses specialist service providers to operate the marketplace. The current architecture uses Supabase for authentication, database and storage services; Stripe for marketplace payment and seller payout flows; Firebase Cloud Messaging for Android push notifications; and Vercel for web application hosting and delivery. Approved vehicle-data providers may also be used when registration lookup is enabled. These providers process information only as needed to provide their services and under their own applicable terms and privacy obligations.</p></section>

   <section><h2 className="text-xl font-black text-[#12221d]">What other marketplace users can see</h2><p className="mt-2">Public seller profiles, public listings, listing photos, seller verification state, transaction-review summaries and appropriate compatibility evidence may be visible to marketplace users. Private account details, buyer request identity, private messages, payment details and private case evidence are not intended to be public.</p></section>

   <section><h2 className="text-xl font-black text-[#12221d]">Security</h2><p className="mt-2">SecondPart uses authenticated access controls, database row-level security, HTTPS transport, restricted server-side payment operations and controlled storage access. No internet service can guarantee absolute security, so access is limited to what is needed for the relevant feature.</p></section>

   <section><h2 className="text-xl font-black text-[#12221d]">Retention and deletion</h2><p className="mt-2">Personal data is kept only for as long as needed for the purposes described above and for applicable legal, tax, fraud-prevention, transaction, dispute or claims requirements. When an account deletion request is processed, account and personal profile data will be deleted or anonymised unless a specific record must be retained for a lawful reason. Retained records are not kept for general marketplace use.</p><p className="mt-3">You can start an account-deletion request from the app under Security &amp; account or from the public <Link href="/account-deletion" className="font-black text-[#287154] underline">SecondPart account deletion page</Link>.</p></section>

   <section><h2 className="text-xl font-black text-[#12221d]">Questions and privacy requests</h2><p className="mt-2">You can use the public <Link href="/contact" className="font-black text-[#287154] underline">SecondPart contact page</Link>. Signed-in users can also submit a private account-linked support request there.</p>{supportEmail?<p className="mt-3">Public privacy/support email: <a href={`mailto:${supportEmail}`} className="font-black text-[#287154] underline">{supportEmail}</a>.</p>:<p className="mt-3 font-bold text-amber-800">The public privacy/support email must be configured in the Production environment before publication.</p>}</section>
  </div>
 </main></>;
}
