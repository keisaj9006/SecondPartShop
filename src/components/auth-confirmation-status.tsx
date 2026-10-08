import Link from "next/link";
import {CheckCircle2,MailWarning} from "lucide-react";
import {safeInternalPath} from "@/lib/navigation";

export type AuthConfirmationState="confirmed"|"invalid"|"already-confirmed";

const sensitiveReturnKey=/^(access_token|refresh_token|token|token_hash|code|otp|password|error|error_description|error_code|error_uri)$/i;

export function safeConfirmationReturnTo(value:string|null|undefined,fallback="/account"){
 const safe=safeInternalPath(value,fallback);
 const target=new URL(safe,"https://secondpart.invalid");
 for(const key of [...target.searchParams.keys()])if(sensitiveReturnKey.test(key))target.searchParams.delete(key);
 const fragment=target.hash.slice(1);
 const safeHash=/(?:^|[?&])(access_token|refresh_token|token|token_hash|code|otp|password|error|error_description|error_code|error_uri)=/i.test(fragment)?"":target.hash;
 return `${target.pathname}${target.search}${safeHash}`;
}

export function AuthConfirmationStatus({state,returnTo="/account"}:{state:AuthConfirmationState;returnTo?:string}){
 const safeReturnTo=safeConfirmationReturnTo(returnTo);
 const resendHref=`/auth/verify-email?returnTo=${encodeURIComponent(safeReturnTo)}`;
 const signInHref=`/account?returnTo=${encodeURIComponent(safeReturnTo)}`;
 const confirmed=state==="confirmed";
 const alreadyConfirmed=state==="already-confirmed";
 return <section className="w-full max-w-2xl rounded-[32px] border border-black/10 bg-white p-7 text-center shadow-sm sm:p-10">
  <span className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${state==="invalid"?"bg-amber-50 text-amber-800":"bg-emerald-50 text-emerald-800"}`}>
   {state==="invalid"?<MailWarning size={30}/>:<CheckCircle2 size={30}/>}
  </span>
  <h1 className="mt-5 text-3xl font-black">{confirmed?"Email confirmed":alreadyConfirmed?"Email already confirmed":"This confirmation link is no longer valid"}</h1>
  <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#63706a]">
   {confirmed?"Your SecondPart account is ready.":alreadyConfirmed?"Your email is already confirmed. Sign in to continue.":"Request another confirmation email to continue. If you have already confirmed your email, sign in."}
  </p>
  {state==="invalid"?<div className="mt-6 flex flex-wrap justify-center gap-3">
   <Link href={signInHref} className="rounded-xl border border-black/15 px-5 py-3 font-black">Sign in</Link>
   <Link href={resendHref} className="rounded-xl bg-[#173c31] px-5 py-3 font-black text-white">Request another confirmation email</Link>
  </div>:<Link href={safeReturnTo} className="mt-6 inline-block rounded-xl bg-[#173c31] px-5 py-3 font-black text-white">Continue to SecondPart</Link>}
 </section>;
}
