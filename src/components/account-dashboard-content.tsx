import Link from "next/link";
import type {ReactNode} from "react";
import {ArrowRight,Bell,Bookmark,CarFront,Clock3,Heart,MessageSquareText,PackageCheck,RotateCcw,Search,ShieldCheck,Star,UserRound,Wrench} from "lucide-react";
import {ProductCard} from "@/components/product-card";
import {getBuyerAccountCounts,getRecentlyViewedListings} from "@/lib/data/buyer-account";
import {getPublicMemberProfileById} from "@/lib/data/reputation";
import {getListingConversationCount} from "@/lib/data/listing-conversations";
import {getSellerForOwner} from "@/lib/data/marketplace";
import {getGaragePartnerForOwner} from "@/lib/data/fitting";

const card=(href:string,label:string,count:number,description:string,icon:ReactNode)=>({href,label,count,description,icon});

export async function AccountTrustSummary({userId}:{userId:string}){
 const trust=await getPublicMemberProfileById(userId).catch(()=>null);
 if(!trust)return null;
 return <p className="mt-3 text-sm font-bold text-white/75">★ {trust.sellerRating?.toFixed(1)??"New"} seller · {trust.soldCount} sold · {trust.boughtCount} bought</p>;
}

export async function AccountDashboardContent({
 userId,
 role,
 view
}:{userId:string;role:string;view:"buying"|"selling"}){
 const [counts,recent,trust,conversationCount,seller,garagePartner]=await Promise.all([
  getBuyerAccountCounts(userId),
  getRecentlyViewedListings(userId,3),
  getPublicMemberProfileById(userId).catch(()=>null),
  getListingConversationCount().catch(()=>0),
  getSellerForOwner(userId).catch(()=>null),
  getGaragePartnerForOwner(userId).catch(()=>null)
 ]);

 const buyingItems=[
  card("/account/profile","Profile & username",0,"Edit your public name, username, bio and private phone number.",<UserRound size={22}/>),
  card("/account/orders","Purchases",counts.orders,"Payment, delivery and buyer-protection status for your orders.",<PackageCheck size={22}/>),
  card("/inbox","Part questions",conversationCount,"Private pre-purchase questions with buyers and sellers.",<MessageSquareText size={22}/>),
  card("/account/cases","Returns & cases",0,"Return requests, transaction problems and case resolutions.",<RotateCcw size={22}/>),
  card("/account/fitting","Fitting requests",0,"Labour quotes from Buy + Fit garage partners for your selected parts and vehicles.",<Wrench size={22}/>),
  card("/account/reviews","Reviews",(trust?.sellerReviewCount??0)+(trust?.buyerReviewCount??0),"Verified transaction reviews and reviews waiting for you.",<Star size={22}/>),
  card("/garage","SecondPart Garage",counts.garage,"Saved vehicles and one-click compatibility searches.",<CarFront size={22}/>),
  card("/saved","Saved parts",counts.savedParts,"Parts you want to come back to.",<Heart size={22}/>),
  card("/saved-searches","Saved searches",counts.savedSearches,"Vehicle, part and filter combinations ready to run again.",<Bookmark size={22}/>),
  card("/recently-viewed","Recently viewed",counts.recentlyViewed,"Your latest signed-in product views.",<Clock3 size={22}/>),
  card("/requests","Part requests",counts.openRequests,"Open requests for parts you could not find.",<Search size={22}/>),
  card("/notifications","Notifications",counts.unreadNotifications,"Unread buyer, seller and saved-search activity.",<Bell size={22}/>),
  card("/account/security","Security & account",0,"Password recovery, verification help and account deletion requests.",<ShieldCheck size={22}/>)
 ];

 const sellingItems=seller?[
  card("/dashboard","Seller dashboard",0,"Overview of your inventory, sales and seller activity.",<Wrench size={22}/>),
  card("/dashboard/listings/new","Create listing",0,"Add a part, donor vehicle, fitment evidence and real photos.",<PackageCheck size={22}/>),
  card("/dashboard/orders","Sales & payouts",0,"Fulfilment, buyer receipt and payout status.",<PackageCheck size={22}/>),
  card("/inbox","Buyer questions",conversationCount,"Pre-purchase conversations about your listings.",<MessageSquareText size={22}/>),
  card("/dashboard/cases","Seller cases",0,"Returns, cancellations, disputes and private evidence.",<RotateCcw size={22}/>),
  card("/dashboard/donors","Donor vehicles",0,"Reuse source-vehicle details across many listings.",<CarFront size={22}/>),
  card("/dashboard/verification","Seller verification",0,"Business verification and marketplace trust status.",<ShieldCheck size={22}/>)
 ]:[];

 const items=view==="selling"?sellingItems:buyingItems;

 return <>
  {view==="selling"&&!seller&&<div className="mt-5 flex flex-col justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center"><div><p className="font-black text-amber-950">Finish your seller profile</p><p className="mt-1 text-sm text-amber-900/75">Buying remains enabled. Add seller details before you publish listings.</p></div><Link href="/dashboard" className="w-fit rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Finish setup</Link></div>}

  <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
   {items.map(item=><Link key={item.href} href={item.href} className="group rounded-3xl border border-black/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_38px_rgba(18,34,29,.09)]"><div className="flex items-start justify-between gap-4"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef1eb] text-[#173c31]">{item.icon}</span><span className="text-3xl font-black tracking-[-.04em]">{item.count}</span></div><h2 className="mt-5 text-lg font-black">{item.label}</h2><p className="mt-1 text-sm leading-6 text-[#63706a]">{item.description}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-black text-[#287154]">Open <ArrowRight size={15} className="transition group-hover:translate-x-1"/></span></Link>)}

   <Link href="/garage-partner" className="group rounded-3xl border border-[#173c31]/15 bg-[#f4f7f2] p-5 transition hover:-translate-y-0.5"><div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#173c31] text-[#d4f44d]"><Wrench size={22}/></span><span className="rounded-full bg-white px-2.5 py-1 text-xs font-black capitalize">{garagePartner?.status??"Join"}</span></div><h2 className="mt-5 text-lg font-black">Garage partner</h2><p className="mt-1 text-sm leading-6 text-[#63706a]">{garagePartner?"Manage your Buy + Fit workshop profile and quote requests.":"Run a workshop? Apply to quote fitting labour without becoming a parts seller."}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-black text-[#287154]">Open <ArrowRight size={15}/></span></Link>

   {role==="admin"&&<Link href="/admin/moderation" className="group rounded-3xl border border-[#173c31]/20 bg-[#f5f2ea] p-5 transition hover:-translate-y-0.5"><div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#173c31] text-[#d4f44d]"><ShieldCheck size={22}/></span></div><h2 className="mt-5 text-lg font-black">Moderation</h2><p className="mt-1 text-sm leading-6 text-[#63706a]">Review seller verification requests and marketplace reports.</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-black text-[#287154]">Open <ArrowRight size={15}/></span></Link>}
  </section>

  {recent.length>0&&<section className="mt-12"><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Continue browsing</p><h2 className="mt-2 text-3xl font-black tracking-[-.04em]">Recently viewed</h2></div><Link href="/recently-viewed" className="text-sm font-black underline">View all</Link></div><div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{recent.map(item=><ProductCard key={item.id} item={item}/>)}</div></section>}
 </>;
}

export function AccountDashboardFallback(){
 return <section aria-busy="true" className="mt-8 grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {Array.from({length:6},(_,i)=><div key={i} className="h-40 rounded-3xl border border-black/5 bg-white"><div className="m-5 h-11 w-11 rounded-2xl bg-black/5"/><div className="mx-5 mt-8 h-5 w-1/2 rounded bg-black/10"/><div className="mx-5 mt-3 h-4 w-3/4 rounded bg-black/5"/></div>)}
 </section>;
}
