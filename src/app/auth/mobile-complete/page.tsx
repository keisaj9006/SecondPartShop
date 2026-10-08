import Link from "next/link";
import {CheckCircle2,KeyRound} from "lucide-react";
import {Header} from "@/components/header";
import {MobileAuthReturn} from "@/components/mobile-auth-return";
import {getCurrentUserState} from "@/lib/auth";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function MobileAuthCompletePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams;
 const passwordUpdated=first(query.state)==="password-updated";
 const state=passwordUpdated?"password-updated":"confirmed" as const;
 const authState=await getCurrentUserState();
 const emailConfirmed=!passwordUpdated&&authState.kind==="authenticated"&&Boolean(authState.user.email_confirmed_at);
 // A return hint cannot prove a password change; only Auth can confirm the current email status.
 const description=authState.kind==="error"
  ?"We could not check your account status right now. Return to SecondPart and try again."
  :emailConfirmed
   ?"Your email address is confirmed. Return to SecondPart to continue."
   :passwordUpdated
    ?"Return to SecondPart to continue. If you changed your password, sign in with the new password."
    :authState.kind==="authenticated"
     ?"Your email is awaiting confirmation. Return to SecondPart to check your account status."
     :"Return to SecondPart to sign in and check your account status.";
 return <><Header/><main className="mx-auto grid min-h-[70vh] max-w-2xl place-items-center px-4 py-12">
  <section className="w-full rounded-[32px] border border-black/10 bg-white p-7 text-center shadow-sm sm:p-10">
   <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-800">{emailConfirmed?<CheckCircle2 size={30}/>:<KeyRound size={30}/>}</span>
   <h1 className="mt-5 text-3xl font-black">{emailConfirmed?"Email confirmed":"Continue in SecondPart"}</h1>
   <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#63706a]">{description}</p>
   <MobileAuthReturn state={state}/>
   <div><Link href="/account" className="mt-6 inline-block rounded-xl bg-[#173c31] px-5 py-3 font-black text-white">Open SecondPart on the web</Link></div>
  </section>
 </main></>;
}
