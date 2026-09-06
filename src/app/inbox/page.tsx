import Link from "next/link";
import { MessageSquareText,Store } from "lucide-react";
import { Header } from "@/components/header";
import { requireUser } from "@/lib/auth";
import { getListingConversationsPage } from "@/lib/data/listing-conversations";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:1;};
type InboxStatus="all"|"open"|"closed";
const statuses:InboxStatus[]=["all","open","closed"];

export default async function InboxPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [user,params]=await Promise.all([requireUser("/inbox"),searchParams]);
 const page=pageNumber(first(params.page));
 const requestedStatus=first(params.status)??"all";
 const status=(statuses.includes(requestedStatus as InboxStatus)?requestedStatus:"all") as InboxStatus;
 const pageSize=30;
 const result=await getListingConversationsPage({offset:(page-1)*pageSize,limit:pageSize,status}).catch(()=>({items:[],hasMore:false,offset:0,limit:pageSize}));
 const conversations=result.items;
 const href=(targetPage:number,nextStatus=status)=>{
  const search=new URLSearchParams();
  if(nextStatus!=="all")search.set("status",nextStatus);
  if(targetPage>1)search.set("page",String(targetPage));
  const qs=search.toString();
  return qs?"/inbox?"+qs:"/inbox";
 };

 return <><Header/><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Messages</p>
  <div className="mt-2 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div><h1 className="text-3xl font-black tracking-[-.045em] sm:text-4xl">Part questions</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Private pre-purchase questions about listings. Paid-order delivery and collection conversations stay inside the transaction chat for that order.</p></div>
   <div className="flex flex-wrap gap-2">{statuses.map(item=><Link key={item} href={href(1,item)} className={"rounded-full px-4 py-2 text-xs font-black capitalize "+(status===item?"bg-[#173c31] text-white":"border border-black/15 bg-white")}>{item}</Link>)}</div>
  </div>

  {conversations.length?<><div className="mt-8 overflow-hidden rounded-3xl border border-black/10 bg-white">
   {conversations.map(item=>{
    const sellerSide=item.sellerOwnerId===user.id;
    return <Link key={item.id} href={"/inbox/"+item.id} className="flex min-w-0 items-center gap-3 border-b border-black/8 p-4 last:border-0 hover:bg-[#f8f7f2] sm:gap-4 sm:p-5">
     <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#173c31] text-[#d4f44d]">{sellerSide?<Store size={19}/>:<MessageSquareText size={19}/>}</span>
     <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-black">{item.partTitle}</p>{item.status==="closed"&&<span className="rounded-full bg-[#eef1eb] px-2 py-0.5 text-[10px] font-black uppercase">Closed</span>}</div><p className="mt-1 text-xs text-[#63706a]">{sellerSide?"Buyer question":"Seller: "+item.sellerName} · updated {new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(item.lastMessageAt))}</p></div>
    </Link>;
   })}
  </div>
  {(page>1||result.hasMore)&&<nav aria-label="Inbox pages" className="mt-8 flex items-center justify-center gap-3">{page>1&&<Link href={href(page-1)} className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-black">Previous</Link>}<span className="text-sm font-bold text-[#63706a]">Page {page}</span>{result.hasMore&&<Link href={href(page+1)} className="rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Next</Link>}</nav>}</>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white px-6 py-16 text-center"><MessageSquareText className="mx-auto text-[#63706a]"/><h2 className="mt-4 text-xl font-black">{status==="all"?"No part questions yet":"No "+status+" conversations"}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#63706a]">{status==="all"?"Questions you send to sellers, or questions buyers send about your listings, will appear here.":"Try another conversation filter."}</p>{status==="all"&&<Link href="/#marketplace" className="mt-5 inline-block rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Browse parts</Link>}</div>}
 </main></>;
}
