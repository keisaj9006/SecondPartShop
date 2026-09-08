import Link from "next/link";
import {CheckCircle2,KeyRound} from "lucide-react";
import {Header} from "@/components/header";
import {MobileAuthReturn} from "@/components/mobile-auth-return";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function MobileAuthCompletePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams;
 const passwordUpdated=first(query.state)==="password-updated";
 const state=passwordUpdated?"password-updated":"confirmed" as const;
 return <><Header/><main className="mx-auto grid min-h-[70vh] max-w-2xl place-items-center px-4 py-12">
  <section className="w-full rounded-[32px] border border-black/10 bg-white p-7 text-center shadow-sm sm:p-10">
   <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-800">{passwordUpdated?<KeyRound size={30}/>:<CheckCircle2 size={30}/>}</span>
   <h1 className="mt-5 text-3xl font-black">{passwordUpdated?"Password updated":"Email confirmed"}</h1>
   <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#63706a]">{passwordUpdated?"Your password has been changed. Return to SecondPart and sign in with the new password.":"Your email address is confirmed. Return to SecondPart and sign in to continue."}</p>
   <MobileAuthReturn state={state}/>
   <div><Link href="/account" className="mt-6 inline-block rounded-xl bg-[#173c31] px-5 py-3 font-black text-white">Open SecondPart on the web</Link></div>
  </section>
 </main></>;
}
