import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { getCurrentProfile } from "@/lib/auth";
import { Boxes,ShieldCheck,Upload } from "lucide-react";
import { enableSelling } from "./actions";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function SellPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [profile,params]=await Promise.all([getCurrentProfile(),searchParams]);
 if(profile&&(["seller","admin"] as string[]).includes(profile.role))redirect("/dashboard");
 const buyer=profile?.role==="buyer";
 return <><Header/><main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Sell parts on SecondPart</p>
  <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-[-.045em] sm:text-5xl">Sell automotive parts without giving up your buyer account.</h1>
  <p className="mt-4 max-w-2xl text-lg text-[#63706a]">Private sellers, garages, breakers and automotive businesses can publish parts, manage stock and add compatibility evidence. The same account can still buy parts normally.</p>
  <div className="mt-10 grid gap-5 md:grid-cols-3">
   {[[Boxes,"Inventory CRUD","Create, edit, archive and update stock."],[ShieldCheck,"Owned data only","RLS prevents sellers editing another garage's inventory."],[Upload,"Supabase Storage","Upload JPG, PNG or WebP product images up to 5 MB."]].map(([Icon,title,text])=><article key={String(title)} className="rounded-3xl border border-black/10 bg-white p-6"><Icon className="text-[#287154]"/><h2 className="mt-7 text-xl font-black">{String(title)}</h2><p className="mt-2 text-sm text-[#63706a]">{String(text)}</p></article>)}
  </div>
  {first(params.error)==="upgrade"&&<p className="mt-6 max-w-xl rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-800">We could not enable selling on this account. Please try again.</p>}
  {buyer
   ?<div className="mt-8 max-w-2xl rounded-3xl border border-[#173c31]/15 bg-[#f4f7f2] p-6"><p className="font-black">Use your existing SecondPart account</p><p className="mt-2 text-sm leading-6 text-[#63706a]">You do not need a second login. Enabling selling keeps your buyer features and adds the seller dashboard, inventory and garage profile tools.</p><form action={enableSelling}><button className="mt-5 rounded-full bg-[#d4f44d] px-6 py-3.5 font-black text-[#173c31]">Enable selling on my account</button></form></div>
   :<Link href="/account?mode=signup&role=seller&returnTo=/dashboard" className="mt-8 inline-flex rounded-full bg-[#d4f44d] px-6 py-3.5 font-black">Create a seller account — buying included</Link>}
 </main></>;
}
