import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { Header } from "@/components/header";
import { SupportRequestForm } from "@/components/support-request-form";
import { getCurrentUser } from "@/lib/auth";

export const dynamic="force-dynamic";

export default async function ContactPage(){
 const user=await getCurrentUser();
 return <><Header/><main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
  <div className="rounded-3xl bg-[#173c31] p-6 text-white sm:p-8"><div className="flex items-center gap-2 text-[#d4f44d]"><LifeBuoy size={19}/><span className="text-xs font-black uppercase tracking-[.16em]">Support</span></div><h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Contact SecondPart</h1><p className="mt-3 max-w-2xl text-white/70">Use this form for account, seller, listing or compatibility support. Marketplace safety concerns about a specific part should use the listing report tool where possible.</p></div>
  <section className="mt-6 rounded-3xl border border-black/10 bg-white p-6">{user?<SupportRequestForm/>:<div><h2 className="text-xl font-black">Sign in to contact support</h2><p className="mt-2 text-sm leading-6 text-[#63706a]">Support requests are linked to your account so we can keep them private and reduce spam.</p><Link href="/account?returnTo=%2Fcontact" className="mt-4 inline-block rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white">Sign in</Link></div>}</section>
 </main></>;
}
