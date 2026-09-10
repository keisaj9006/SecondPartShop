import Link from "next/link";
import { Banknote,CheckCircle2,ExternalLink,ShieldCheck } from "lucide-react";
import { Header } from "@/components/header";
import { requireSeller } from "@/lib/auth";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { getSellerPaymentAccount } from "@/lib/data/seller-payments";
import { syncSellerPaymentAccount } from "@/lib/seller-payment-sync";
import { isStripeConnectConfigured } from "@/lib/stripe-connect";
import { refreshStripePaymentStatus,startStripeOnboarding } from "./actions";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function SellerPaymentsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const {user}=await requireSeller("/dashboard/payments");
 const seller=await getSellerForOwner(user.id);
 if(!seller)return <><Header/><main className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-3xl font-black">Create your seller profile first</h1><Link href="/dashboard" className="mt-4 inline-block font-black underline">Back to dashboard</Link></main></>;

 const configured=isStripeConnectConfigured();
 const returned=first(params.returned)==="1";
 const returnSync=returned&&configured?await syncSellerPaymentAccount(seller.id).catch(()=>null):null;
 const payment=await getSellerPaymentAccount(seller.id).catch(()=>null);
 const active=Boolean(payment?.transfersEnabled&&payment.onboardingStatus==="complete");
 const error=first(params.error);

 return <><Header/><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div>
    <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Seller payments</p>
    <h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Payments & payouts</h1>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">SecondPart uses a regulated marketplace payment provider. Seller payout details are kept separate from your public seller profile.</p>
   </div>
   <Link href="/dashboard/orders" className="w-fit rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">Sales & payouts</Link>
  </div>

  {error&&<div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
   <p className="font-black">{error==="not-configured"?"Stripe test configuration is not connected yet.":error==="email-required"?"Your account needs an email address before payout onboarding.":error==="sync"?"We could not refresh the Stripe status right now.":"Stripe onboarding could not be started right now."}</p>
  </div>}
  {first(params.refreshed)==="1"&&<div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">Payment account status refreshed.</div>}
  {returned&&<div className={`mt-6 rounded-2xl border p-4 text-sm ${returnSync?.active?"border-emerald-200 bg-emerald-50 text-emerald-900":"border-blue-200 bg-blue-50 text-blue-900"}`}><p className="font-black">{returnSync?.active?"Stripe onboarding is complete.":"You returned from Stripe onboarding."}</p><p className="mt-1">{returnSync?.active?"SecondPart re-checked the account automatically and marketplace transfers are enabled.":"SecondPart re-checked the account automatically. If Stripe still has requirements outstanding, continue onboarding below."}</p></div>}

  <section className="mt-8 rounded-[30px] bg-[#173c31] p-6 text-white sm:p-8">
   <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
    <div>
     <div className="flex items-center gap-2"><ShieldCheck className="text-[#d4f44d]" size={22}/><p className="text-sm font-black">Stripe Connect recipient account</p></div>
     <h2 className="mt-4 text-3xl font-black">{!configured?"Platform setup required":active?"Ready to receive marketplace transfers":payment?"Verification in progress":"Connect your payout account"}</h2>
     <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">{!configured?"SecondPart is ready for the integration, but the Stripe test secret, Supabase service-role secret and HTTPS app URL still need to be connected in the deployment environment.":active?"Your connected account can receive transfers from SecondPart after eligible transactions reach the funds-release stage.":payment?"Complete any remaining Stripe identity or payout requirements before marketplace transfers can be enabled.":"Stripe-hosted onboarding collects the identity and payout information required for marketplace sellers."}</p>
    </div>
    <div className={`rounded-2xl px-4 py-3 text-sm font-black ${active?"bg-[#d4f44d] text-[#173c31]":"bg-white/10"}`}>{!configured?"Not configured":active?"Transfer-ready":payment?.onboardingStatus==="restricted"?"Restricted":payment?"Pending":"Not started"}</div>
   </div>

   <div className="mt-7 flex flex-wrap gap-3">
    {configured&&!active&&<form action={startStripeOnboarding}><button className="inline-flex items-center gap-2 rounded-xl bg-[#d4f44d] px-5 py-3 text-sm font-black text-[#173c31]"><ExternalLink size={16}/>{payment?"Continue Stripe onboarding":"Connect Stripe"}</button></form>}
    {configured&&payment&&<form action={refreshStripePaymentStatus}><button className="rounded-xl border border-white/20 px-5 py-3 text-sm font-black">Refresh status</button></form>}
    {!configured&&<span className="rounded-xl bg-white/10 px-5 py-3 text-sm font-black">Waiting for Stripe test credentials</span>}
   </div>
  </section>

  <section className="mt-6 grid gap-4 sm:grid-cols-3">
   <div className="rounded-3xl border border-black/10 bg-white p-5"><Banknote className="text-[#287154]" size={22}/><p className="mt-4 font-black">Buyer payment</p><p className="mt-1 text-sm leading-6 text-[#63706a]">The buyer pays SecondPart through marketplace checkout. We do not create a fake in-app wallet.</p></div>
   <div className="rounded-3xl border border-black/10 bg-white p-5"><ShieldCheck className="text-[#287154]" size={22}/><p className="mt-4 font-black">Buyer protection</p><p className="mt-1 text-sm leading-6 text-[#63706a]">Seller transfer is gated by delivery, acceptance/release rules and any approved dispute or return flow.</p></div>
   <div className="rounded-3xl border border-black/10 bg-white p-5"><CheckCircle2 className="text-[#287154]" size={22}/><p className="mt-4 font-black">Verified review</p><p className="mt-1 text-sm leading-6 text-[#63706a]">Reviews unlock only after transaction funds have been released in the SecondPart order state.</p></div>
  </section>
 </main></>;
}
