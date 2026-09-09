import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft,LockKeyhole,MessageSquareText } from "lucide-react";
import { closeListingConversation } from "@/app/inbox/actions";
import { Header } from "@/components/header";
import { ListingConversationComposer } from "@/components/listing-conversation-composer";
import { MarketplaceUserBlockButton } from "@/components/marketplace-user-block-button";
import { requireUser } from "@/lib/auth";
import { getListingConversation } from "@/lib/data/listing-conversations";
import { isMarketplaceUserBlocked } from "@/lib/marketplace-policy";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:1;};

export default async function ListingConversationPage({params,searchParams}:{params:Promise<{conversationId:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [{conversationId},query]=await Promise.all([params,searchParams]);
 const user=await requireUser("/inbox/"+conversationId);
 const historyPage=pageNumber(first(query.history));
 const messageLimit=100;
 const thread=await getListingConversation(conversationId,{offset:(historyPage-1)*messageLimit,limit:messageLimit}).catch(()=>null);
 if(!thread)notFound();

 const sellerSide=thread.sellerOwnerId===user.id;
 const otherProfileId=sellerSide?thread.buyerId:thread.sellerOwnerId;
 const blockedUser=otherProfileId?await isMarketplaceUserBlocked(otherProfileId).catch(()=>false):false;
 const returnTo="/inbox/"+thread.id;

 return <><Header/><main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
  <Link href="/inbox" className="inline-flex items-center gap-2 text-sm font-black"><ArrowLeft size={16}/>Back to messages</Link>
  <div className="mt-5 overflow-hidden rounded-[30px] border border-black/10 bg-[#f8f7f2]">
   <header className="bg-[#173c31] p-5 text-white sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
     <div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.15em] text-[#d4f44d]"><LockKeyhole size={14}/>Private listing conversation</div><Link href={"/parts/"+thread.partSlug} className="mt-2 block break-words text-xl font-black hover:underline sm:text-2xl">{thread.partTitle}</Link><p className="mt-1 text-sm text-white/65">{sellerSide?"Pre-purchase buyer question":"Seller: "+thread.sellerName}</p></div>
     <div className="flex flex-wrap items-center gap-2">
      {otherProfileId&&<MarketplaceUserBlockButton targetProfileId={otherProfileId} blocked={blockedUser} returnTo={returnTo} compact/>}
      {thread.status==="open"&&<form action={closeListingConversation}><input type="hidden" name="conversationId" value={thread.id}/><button className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-black text-white/80">Close conversation</button></form>}
     </div>
    </div>
   </header>
   <div className="border-b border-black/8 bg-white/70 px-4 py-2 text-center text-xs font-bold text-[#63706a]">{thread.messagePagination.hasOlder&&<Link href={"/inbox/"+thread.id+"?history="+(historyPage+1)} className="mr-4 underline">Older messages</Link>}{thread.messagePagination.hasNewer&&<Link href={historyPage===2?"/inbox/"+thread.id:"/inbox/"+thread.id+"?history="+(historyPage-1)} className="underline">Newer messages</Link>}</div>
   <div className="max-h-[55vh] min-h-64 overflow-y-auto p-3 sm:min-h-72 sm:p-5">
    {thread.messages.length?<div className="grid gap-3">{thread.messages.map(message=>{
     const mine=message.senderProfileId===user.id;
     return <div key={message.id} className={"max-w-[86%] rounded-2xl p-3 text-sm "+(mine?"ml-auto bg-[#173c31] text-white":"bg-white")}>
      <p className={"text-xs font-black "+(mine?"text-[#d4f44d]":"text-[#287154]")}>{mine?"You":message.senderDisplayName+" · @"+message.senderHandle}</p>
      <p className="mt-1 whitespace-pre-wrap leading-6">{message.body}</p>
      <p className={"mt-2 text-[10px] "+(mine?"text-white/50":"text-[#8a918e]")}>{new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(message.createdAt))}</p>
     </div>;
    })}</div>:<div className="grid min-h-64 place-items-center text-center"><div><MessageSquareText className="mx-auto text-[#63706a]"/><p className="mt-3 font-black">No messages yet</p></div></div>}
   </div>
   {blockedUser?<div className="border-t border-black/10 bg-white p-4 text-center text-sm font-bold text-[#63706a]">You blocked this user. Unblock them to resume pre-purchase messaging.</div>:thread.status==="open"?<ListingConversationComposer conversationId={thread.id}/>:<div className="border-t border-black/10 bg-white p-4 text-center text-sm font-bold text-[#63706a]">This conversation is closed.</div>}
  </div>
 </main></>;
}
