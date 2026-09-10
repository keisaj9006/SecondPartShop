import Link from "next/link";
import { Bug,LifeBuoy,Mail } from "lucide-react";
import { Header } from "@/components/header";
import { SupportRequestForm } from "@/components/support-request-form";
import { getCurrentUser } from "@/lib/auth";
import { getPublicSupportEmail } from "@/lib/public-contact";

export const dynamic="force-dynamic";

export default async function ContactPage(){
 const [user,supportEmail]=await Promise.all([getCurrentUser(),Promise.resolve(getPublicSupportEmail())]);
 return <><Header/><main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
  <div className="rounded-3xl bg-[#173c31] p-6 text-white sm:p-8"><div className="flex items-center gap-2 text-[#d4f44d]"><LifeBuoy size={19}/><span className="text-xs font-black uppercase tracking-[.16em]">Support</span></div><h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Contact SecondPart</h1><p className="mt-3 max-w-2xl text-white/70">Use this page for account, seller, listing or compatibility support. Marketplace safety concerns about a specific part should use the listing report tool where possible.</p></div>

  {supportEmail&&<section className="mt-6 rounded-3xl border border-black/10 bg-white p-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-[#eef8f3] p-2 text-[#287154]"><Mail size={19}/></div><div><h2 className="text-xl font-black">Public support email</h2><p className="mt-2 text-sm leading-6 text-[#63706a]">You can contact SecondPart without signing in. Do not send passwords, payment card details or API keys.</p><a href={`mailto:${supportEmail}`} className="mt-3 inline-block font-black text-[#287154] underline">{supportEmail}</a></div></div></section>}

  {user&&<section className="mt-6 rounded-3xl border border-[#cfe2d9] bg-[#f3faf6] p-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-white p-2 text-[#287154]"><Bug size={19}/></div><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#287154]">Closed Beta</p><h2 className="mt-1 text-xl font-black">Testing a pre-release build?</h2><p className="mt-2 text-sm leading-6 text-[#63706a]">Use the structured beta form for bugs, performance problems and UX feedback. It automatically includes the current build identifier so we can reproduce and retest the right version.</p><Link href="/beta-feedback" className="mt-4 inline-block rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white">Send beta feedback</Link></div></div></section>}

  <section className="mt-6 rounded-3xl border border-black/10 bg-white p-6">{user?<><h2 className="text-xl font-black">Account-linked support request</h2><p className="mt-2 text-sm leading-6 text-[#63706a]">Signed-in requests are linked to your account so support can review the relevant marketplace context privately.</p><SupportRequestForm/></>:<div><h2 className="text-xl font-black">Account-linked support</h2><p className="mt-2 text-sm leading-6 text-[#63706a]">Sign in if you want to submit a private support request linked to your SecondPart account.{supportEmail?" You can also use the public support email above without signing in.":""}</p><Link href="/account?returnTo=%2Fcontact" className="mt-4 inline-block rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white">Sign in</Link></div>}</section>
 </main></>;
}
