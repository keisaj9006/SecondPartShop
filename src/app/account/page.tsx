import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight,Bookmark,CarFront,Clock3,Heart,Search,Wrench } from "lucide-react";
import { Header } from "@/components/header";
import { AuthForm } from "@/components/auth-form";
import { ProductCard } from "@/components/product-card";
import { getCurrentProfile,getCurrentUser } from "@/lib/auth";
import { getBuyerAccountCounts,getRecentlyViewedListings } from "@/lib/data/buyer-account";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

const card=(href:string,label:string,count:number,description:string,icon:ReactNode)=>({href,label,count,description,icon});

export default async function AccountPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const [user,profile]=await Promise.all([getCurrentUser(),getCurrentProfile()]);
 if(!user||!profile)return <><Header/><main className="mx-auto grid min-h-[70vh] max-w-7xl place-items-center px-4 py-12"><AuthForm defaultMode={first(params.mode)==="signup"?"signup":"signin"} defaultRole={first(params.role)==="seller"?"seller":"buyer"} returnTo={first(params.returnTo)??"/account"} configured={isSupabaseConfigured()}/></main></>;
 const [counts,recent]=await Promise.all([getBuyerAccountCounts(user.id),getRecentlyViewedListings(user.id,3)]);
 const items=[
  card("/garage","SecondPart Garage",counts.garage,"Saved vehicles and one-click compatibility searches.",<CarFront size={22}/>),
  card("/saved","Saved parts",counts.savedParts,"Parts you want to come back to.",<Heart size={22}/>),
  card("/saved-searches","Saved searches",counts.savedSearches,"Vehicle, part and filter combinations ready to run again.",<Bookmark size={22}/>),
  card("/recently-viewed","Recently viewed",counts.recentlyViewed,"Your latest signed-in product views.",<Clock3 size={22}/>),
  card("/requests","Part requests",counts.openRequests,"Open requests for parts you could not find.",<Search size={22}/>)
 ];
 return <><Header/><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
  <section className="overflow-hidden rounded-[32px] bg-[#173c31] p-6 text-white sm:p-9">
   <p className="text-xs font-black uppercase tracking-[.2em] text-[#d4f44d]">Your account</p>
   <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><h1 className="text-4xl font-black tracking-[-.05em] sm:text-5xl">{profile.displayName}</h1><p className="mt-2 text-white/65">{user.email}</p></div><div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm"><span className="text-white/60">Account type</span><strong className="ml-2 capitalize">{profile.role}</strong></div></div>
  </section>

  <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
   {items.map(item=><Link key={item.href} href={item.href} className="group rounded-3xl border border-black/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_38px_rgba(18,34,29,.09)]"><div className="flex items-start justify-between gap-4"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef1eb] text-[#173c31]">{item.icon}</span><span className="text-3xl font-black tracking-[-.04em]">{item.count}</span></div><h2 className="mt-5 text-lg font-black">{item.label}</h2><p className="mt-1 text-sm leading-6 text-[#63706a]">{item.description}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-black text-[#287154]">Open <ArrowRight size={15} className="transition group-hover:translate-x-1"/></span></Link>)}
   {(["seller","admin"] as string[]).includes(profile.role)&&<Link href="/dashboard" className="group rounded-3xl border border-[#173c31]/20 bg-[#f5f2ea] p-5 transition hover:-translate-y-0.5"><div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#173c31] text-[#d4f44d]"><Wrench size={22}/></span></div><h2 className="mt-5 text-lg font-black">Seller dashboard</h2><p className="mt-1 text-sm leading-6 text-[#63706a]">Manage listings, buyer requests, donor vehicles and inventory quality.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-black text-[#287154]">Open <ArrowRight size={15}/></span></Link>}
  </section>

  {recent.length>0&&<section className="mt-12"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Continue browsing</p><h2 className="mt-2 text-3xl font-black tracking-[-.04em]">Recently viewed</h2></div><Link href="/recently-viewed" className="text-sm font-black underline">View all</Link></div><div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recent.map(item=><ProductCard key={item.id} item={item}/>)}</div></section>}
 </main></>;
}