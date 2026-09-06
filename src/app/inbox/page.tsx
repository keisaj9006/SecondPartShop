import Link from "next/link";
import { MessageSquareText,Store } from "lucide-react";
import { Header } from "@/components/header";
import { requireUser } from "@/lib/auth";
import { getListingConversations } from "@/lib/data/listing-conversations";

export const dynamic="force-dynamic";

export default async function InboxPage(){
 const user=await requireUser("/inbox");
 const conversations=await getListingConversations().catch(()=>[]);

 return <><Header/><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Messages</p>
  <h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Part questions</h1>
  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Private pre-purchase questions about listings. Paid-order delivery and collection conversations stay inside the transaction chat for that order.</p>

  {conversations.length?<div className="mt-8 overflow-hidden rounded-3xl border border-black/10 bg-white">
   {conversations.map(item=>{
    const sellerSide=item.sellerOwnerId===user.id;
    return <Link key={item.id} href={"/inbox/"+item.id} className="flex items-center gap-4 border-b border-black/8 p-5 last:border-0 hover:bg-[#f8f7f2]">
     <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#173c31] text-[#d4f44d]">{sellerSide?<Store size={19}/>:<MessageSquareText size={19}/>}</span>
     <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-black">{item.partTitle}</p>{item.status==="closed"&&<span className="rounded-full bg-[#eef1eb] px-2 py-0.5 text-[10px] font-black uppercase">Closed</span>}</div><p className="mt-1 text-xs text-[#63706a]">{sellerSide?"Buyer question":"Seller: "+item.sellerName} · updated {new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(item.lastMessageAt))}</p></div>
    </Link>;
   })}
  </div>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white px-6 py-16 text-center"><MessageSquareText className="mx-auto text-[#63706a]"/><h2 className="mt-4 text-xl font-black">No part questions yet</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#63706a]">Questions you send to sellers, or questions buyers send about your listings, will appear here.</p><Link href="/#marketplace" className="mt-5 inline-block rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Browse parts</Link></div>}
 </main></>;
}
