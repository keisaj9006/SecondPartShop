import {Header} from "@/components/header";

export default function TermsPage(){
 return <><Header/><main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Launch-candidate terms</p>
  <h1 className="mt-3 text-4xl font-black tracking-[-.045em]">SecondPart Terms of Use</h1>
  <p className="mt-3 text-sm text-[#63706a]">Last updated 9 September 2026</p>
  <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">These terms now reflect the current product architecture, but final UK marketplace, consumer-rights, seller and payment wording must be legally reviewed before public production commerce is launched.</p>

  <div className="mt-8 space-y-8 text-sm leading-7 text-[#4f5e57]">
   <section><h2 className="text-xl font-black text-[#12221d]">Marketplace role</h2><p className="mt-2">SecondPart provides a marketplace for automotive parts, vehicle compatibility tools, buyer/seller communication and related marketplace services. Sellers remain responsible for the lawful ownership, accuracy, condition, testing information, pricing and fulfilment details of the parts they list.</p></section>

   <section><h2 className="text-xl font-black text-[#12221d]">Vehicle compatibility</h2><p className="mt-2">Compatibility Confidence describes the evidence currently available for a listing and selected vehicle. A confirmed or buyer-verified result has stronger evidence than a family match or unverified result, but vehicle identification and fitment information should still be checked where appropriate before installation. SecondPart must not be treated as guaranteeing fitment where the interface states that evidence is incomplete or unverified.</p></section>

   <section><h2 className="text-xl font-black text-[#12221d]">Listings and seller conduct</h2><p className="mt-2">Sellers must not list stolen, counterfeit, unsafe or deliberately misdescribed items. Listing photos and descriptions must represent the actual item being offered. Seller verification may be removed if business identity or account details change and require re-verification.</p></section>

   <section><h2 className="text-xl font-black text-[#12221d]">User-generated content and conduct</h2><p className="mt-2">SecondPart does not allow harassment, threats, hate or abusive behaviour; sexually explicit or exploitative content; illegal content; spam; scams or fraudulent offers; impersonation; attempts to move users into unsafe payment arrangements; malicious links; publication of another person’s private information without a lawful reason; or other content or conduct that creates a material safety risk. These rules apply to listings, photos, seller profiles, reviews, compatibility notes, requests and messages.</p><p className="mt-2">Users can report listings and users from within SecondPart and can block another user from pre-purchase messaging. SecondPart may review, restrict or remove content or accounts when reports or other evidence indicate a breach of these rules. Blocking does not remove communication required to complete or resolve an existing marketplace transaction.</p></section>

   <section><h2 className="text-xl font-black text-[#12221d]">Payments, buyer protection and payouts</h2><p className="mt-2">The current marketplace architecture uses Stripe for card payment processing and seller payout onboarding. SecondPart controls marketplace order state, stock reservation, transaction evidence, buyer receipt/acceptance, cases, refunds and payout eligibility around the provider payment flow. A seller is not entitled to receive funds before the transaction reaches the applicable release conditions.</p></section>

   <section><h2 className="text-xl font-black text-[#12221d]">Returns, cancellations and disputes</h2><p className="mt-2">Buyers and sellers must use the transaction and case tools for cancellations, returns, item problems and disputes. SecondPart may hold or reverse marketplace payouts, preserve relevant evidence and restrict an account while a transaction problem, payment dispute, fraud review or legal obligation is unresolved.</p></section>

   <section><h2 className="text-xl font-black text-[#12221d]">Moderation and platform safety</h2><p className="mt-2">SecondPart may review reports, remove or restrict listings, suspend seller functionality, revoke verification and preserve relevant records where reasonably necessary for marketplace safety, fraud prevention, legal compliance or the protection of buyers and sellers.</p></section>

   <section><h2 className="text-xl font-black text-[#12221d]">Final launch review</h2><p className="mt-2">Before public launch, these terms will be completed with the final contracting entity, contact details, governing-law wording, consumer-rights treatment, seller obligations, fee schedule, payout timing, return rules and any legally required cancellation or dispute wording.</p></section>
  </div>
 </main></>;
}
