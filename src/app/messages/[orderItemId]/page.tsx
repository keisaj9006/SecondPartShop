import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft,LockKeyhole,MessageSquareText } from "lucide-react";
import { Header } from "@/components/header";
import { TransactionMessageForm } from "@/components/transaction-message-form";
import { requireUser } from "@/lib/auth";
import { getTransactionThread } from "@/lib/data/transaction-messages";

export const dynamic="force-dynamic";

export default async function TransactionMessagesPage({params}:{params:Promise<{orderItemId:string}>}){
 const {orderItemId}=await params;
 const user=await requireUser("/messages/"+orderItemId);
 const thread=await getTransactionThread(orderItemId).catch(()=>null);
 if(!thread)notFound();

 const sellerSide=thread.sellerOwnerId===user.id;
 const backHref=sellerSide?"/dashboard/orders":"/account/orders";

 return <><Header/><main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
  <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-black"><ArrowLeft size={16}/>Back to {sellerSide?"sales":"purchases"}</Link>
  <div className="mt-5 overflow-hidden rounded-[30px] border border-black/10 bg-[#f8f7f2]">
   <header className="bg-[#173c31] p-5 text-white sm:p-6">
    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.15em] text-[#d4f44d]"><LockKeyhole size={14}/>Private transaction chat</div>
    <Link href={"/parts/"+thread.partSlug} className="mt-2 block text-2xl font-black hover:underline">{thread.partTitle}</Link>
    <p className="mt-1 text-sm text-white/65">{sellerSide?"Buyer conversation":"Seller: "+thread.sellerName}</p>
   </header>
   <div className="max-h-[58vh] min-h-72 overflow-y-auto p-4 sm:p-5">
    {thread.messages.length?<div className="grid gap-3">{thread.messages.map(message=>{
     const mine=message.senderProfileId===user.id;
     return <div key={message.id} className={"max-w-[86%] rounded-2xl p-3 text-sm "+(mine?"ml-auto bg-[#173c31] text-white":"bg-white")}>
      <p className={"text-xs font-black "+(mine?"text-[#d4f44d]":"text-[#287154]")}>{mine?"You":message.senderDisplayName+" · @"+message.senderHandle}</p>
      <p className="mt-1 whitespace-pre-wrap leading-6">{message.body}</p>
      <p className={"mt-2 text-[10px] "+(mine?"text-white/50":"text-[#8a918e]")}>{new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(message.createdAt))}</p>
     </div>;
    })}</div>:<div className="grid min-h-64 place-items-center text-center"><div><MessageSquareText className="mx-auto text-[#63706a]"/><p className="mt-3 font-black">No messages yet</p><p className="mt-1 text-sm text-[#63706a]">Use this thread for delivery, collection and transaction-specific questions.</p></div></div>}
   </div>
   <TransactionMessageForm orderItemId={thread.orderItemId}/>
  </div>
 </main></>;
}
