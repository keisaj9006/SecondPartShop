import Link from "next/link";
import { Banknote } from "lucide-react";
import { Header } from "@/components/header";
import { MobileSellerPaymentReturn } from "@/components/mobile-seller-payment-return";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function MobileSellerPaymentCompletePage({
 searchParams
}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams;
 const state=first(query.state)==="refresh"?"refresh":"returned";

 return <><Header/><main className="mx-auto grid min-h-[70vh] max-w-2xl place-items-center px-4 py-12">
  <section className="w-full rounded-[32px] border border-black/10 bg-white p-7 text-center shadow-sm sm:p-10">
   <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-800"><Banknote size={30}/></span>
   <h1 className="mt-5 text-3xl font-black">Return to SecondPart</h1>
   <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#63706a]">
    The app will securely refresh your Stripe recipient-account status. Returning from onboarding does not by itself mark payouts as ready; SecondPart verifies the current Stripe capability first.
   </p>
   <MobileSellerPaymentReturn state={state}/>
   <div><Link href="/dashboard/payments" className="mt-6 inline-block rounded-xl bg-[#173c31] px-5 py-3 font-black text-white">Open seller payments on the web</Link></div>
  </section>
 </main></>;
}
