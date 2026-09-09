import Link from "next/link";
import {Suspense} from "react";
import {Header} from "@/components/header";
import {AuthForm} from "@/components/auth-form";
import {AccountDashboardContent,AccountDashboardFallback,AccountTrustSummary} from "@/components/account-dashboard-content";
import {getCurrentProfile,getCurrentUser} from "@/lib/auth";
import {isSupabaseConfigured} from "@/lib/supabase/env";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function AccountPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const [user,profile]=await Promise.all([getCurrentUser(),getCurrentProfile()]);
 if(!user||!profile){
  const notice=first(params.reason)==="signin-required"
   ?"Please sign in to continue. Your previous session may have expired."
   :first(params.error)==="confirmation-failed"
    ?"We could not confirm that email link. Request a fresh confirmation email and try again."
    :undefined;
  return <><Header/><main className="mx-auto grid min-h-[70vh] max-w-7xl place-items-center px-4 py-12"><AuthForm defaultMode={first(params.mode)==="signup"?"signup":"signin"} defaultRole={first(params.role)==="seller"?"seller":"buyer"} returnTo={first(params.returnTo)??"/account"} configured={isSupabaseConfigured()} notice={notice}/></main></>;
 }

 const accessError=first(params.error);
 const sellingEnabled=(["seller","admin"] as string[]).includes(profile.role);
 const requestedView=first(params.view)==="selling"?"selling":"buying";
 const view=sellingEnabled?requestedView:"buying";

 return <><Header/><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
  {accessError==="seller-required"&&<div className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center"><div><p className="font-black text-amber-950">Seller access is not enabled on this account</p><p className="mt-1 text-sm text-amber-900/75">Your buyer account is still active. Enable selling to create a garage profile and manage listings.</p></div><Link href="/sell" className="w-fit rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Enable selling</Link></div>}
  {accessError==="admin-required"&&<div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4"><p className="font-black text-red-950">Administrator access required</p><p className="mt-1 text-sm text-red-900/75">This account does not have permission to open marketplace moderation.</p></div>}
  {!user.email_confirmed_at&&<div className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center"><div><p className="font-black text-amber-950">Confirm your email address</p><p className="mt-1 text-sm text-amber-900/75">Email verification helps protect saved vehicles, requests and future orders.</p></div><Link href="/auth/verify-email" className="w-fit rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-black text-white">Resend email</Link></div>}

  <section className="overflow-hidden rounded-[32px] bg-[#173c31] p-6 text-white sm:p-9">
   <p className="text-xs font-black uppercase tracking-[.2em] text-[#d4f44d]">Your account</p>
   <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
    <div>
     <h1 className="text-4xl font-black tracking-[-.05em] sm:text-5xl">{profile.displayName}</h1>
     <p className="mt-1 font-bold text-[#d4f44d]">@{profile.handle}</p>
     <p className="mt-2 text-white/65">{user.email}</p>
     <Suspense fallback={<div className="mt-3 h-4 w-52 animate-pulse rounded bg-white/10"/>}><AccountTrustSummary userId={user.id}/></Suspense>
    </div>
    <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm"><span className="text-white/60">Buyer</span><strong className="ml-2">Enabled</strong><span className="ml-4 text-white/60">Seller</span><strong className="ml-2">{sellingEnabled?"Enabled":"Not enabled"}</strong></div>
   </div>
  </section>

  <div className="mt-5 grid max-w-md grid-cols-2 rounded-2xl bg-[#eef1eb] p-1">
   <Link href="/account?view=buying" className={`rounded-xl px-4 py-2.5 text-center text-sm font-black ${view==="buying"?"bg-white shadow-sm":""}`}>Buyer</Link>
   <Link href={sellingEnabled?"/account?view=selling":"/sell"} className={`rounded-xl px-4 py-2.5 text-center text-sm font-black ${view==="selling"?"bg-white shadow-sm":""}`}>Seller</Link>
  </div>

  {!sellingEnabled&&<div className="mt-5 flex flex-col justify-between gap-3 rounded-2xl border border-[#173c31]/15 bg-[#f4f7f2] p-4 sm:flex-row sm:items-center"><div><p className="font-black">Want to sell parts too?</p><p className="mt-1 text-sm text-[#63706a]">Keep this login, Garage, purchases and reviews. Selling is added to your existing account.</p></div><Link href="/sell" className="w-fit rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Start selling</Link></div>}

  <Suspense fallback={<AccountDashboardFallback/>}>
   <AccountDashboardContent userId={user.id} role={profile.role} view={view}/>
  </Suspense>
 </main></>;
}
