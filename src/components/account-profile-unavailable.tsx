import Link from "next/link";
import {AccountDashboardRetry} from "@/components/account-dashboard-retry";

type RecoveryReason="auth-error"|"missing-profile"|"profile-error";

export function AccountProfileUnavailable({reason,email}:{reason:RecoveryReason;email?:string}){
 const authUnavailable=reason==="auth-error";
 const title=authUnavailable?"Authentication temporarily unavailable":reason==="missing-profile"?"Your account profile is unavailable":"Your account profile is temporarily unavailable";
 const description=authUnavailable
  ?"We couldn’t check your sign-in status. Please retry in a moment."
  :reason==="missing-profile"
   ?"You’re signed in, but we couldn’t find your SecondPart profile. Retry, or contact support if this continues."
   :"You’re signed in, but we couldn’t load your account profile. Please retry in a moment, or contact support if this continues.";
 return <section className="rounded-3xl border border-amber-200 bg-white p-6 sm:p-9">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Your account</p>
  <h1 className="mt-3 text-3xl font-black tracking-[-.04em]">{title}</h1>
  {!authUnavailable&&email&&<p className="mt-2 text-sm text-[#63706a]">{email}</p>}
  <p className="mt-4 leading-7 text-[#63706a]">{description}</p>
  <AccountDashboardRetry/>
  <Link href="/contact" className="mt-4 inline-block text-sm font-bold text-[#287154] underline">Contact support</Link>
 </section>;
}
