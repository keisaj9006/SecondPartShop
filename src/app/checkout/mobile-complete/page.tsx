import Link from "next/link";
import { CheckCircle2,XCircle } from "lucide-react";
import { Header } from "@/components/header";
import { MobileCheckoutReturn } from "@/components/mobile-checkout-return";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function MobileCheckoutCompletePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams;
 const cancelled=first(query.state)==="cancelled";
 const orderId=first(query.order)??null;

 return <><Header/><main className="mx-auto grid min-h-[70vh] max-w-2xl place-items-center px-4 py-12">
  <section className="w-full rounded-[32px] border border-black/10 bg-white p-7 text-center shadow-sm sm:p-10">
   <span className={"mx-auto grid h-16 w-16 place-items-center rounded-full "+(cancelled?"bg-amber-50 text-amber-800":"bg-emerald-50 text-emerald-800")}>{cancelled?<XCircle size={30}/>:<CheckCircle2 size={30}/>}</span>
   <h1 className="mt-5 text-3xl font-black">{cancelled?"Checkout cancelled":"Payment submitted"}</h1>
   <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#63706a]">{cancelled?"No payment confirmation was recorded from this checkout page. Return to the SecondPart app to continue shopping or resume an active reservation if it is still available.":"Return to the SecondPart app. Payment status is confirmed server-side by Stripe webhook/reconciliation; the app will refresh your order automatically."}</p>
   <MobileCheckoutReturn state={cancelled?"cancelled":"success"} orderId={orderId}/>
   <div><Link href="/account/orders" className="mt-6 inline-block rounded-xl bg-[#173c31] px-5 py-3 font-black text-white">Open purchases on the web</Link></div>
  </section>
 </main></>;
}
