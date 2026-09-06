import Link from "next/link";
import { Bell,CheckCheck } from "lucide-react";
import { Header } from "@/components/header";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { markAllNotificationsRead,markNotificationRead } from "./actions";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:1;};

export default async function NotificationsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [user,params]=await Promise.all([requireUser("/notifications"),searchParams]);
 const page=pageNumber(first(params.page));
 const unreadOnly=first(params.unread)==="1";
 const pageSize=30;
 const supabase=await createSupabaseServerClient();
 let pageQuery=supabase
  .from("notifications")
  .select("id,type,title,body,href,read_at,created_at")
  .eq("profile_id",user.id)
  .order("created_at",{ascending:false})
  .order("id");
 if(unreadOnly)pageQuery=pageQuery.is("read_at",null);
 const [{data},{count:unread}]=await Promise.all([
  pageQuery.range((page-1)*pageSize,(page-1)*pageSize+pageSize),
  supabase.from("notifications").select("id",{count:"exact",head:true}).eq("profile_id",user.id).is("read_at",null)
 ]);
 const raw=data??[];
 const hasMore=raw.length>pageSize;
 const notifications=raw.slice(0,pageSize);
 const unreadCount=unread??0;
 const href=(targetPage:number,nextUnread=unreadOnly)=>{
  const search=new URLSearchParams();
  if(nextUnread)search.set("unread","1");
  if(targetPage>1)search.set("page",String(targetPage));
  const qs=search.toString();
  return qs?"/notifications?"+qs:"/notifications";
 };

 return <><Header/><main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Your account</p><h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Notifications</h1><p className="mt-2 text-[#63706a]">Buyer requests, saved-search matches and marketplace activity that needs your attention.</p></div>
   <div className="flex flex-wrap gap-2"><Link href={href(1,false)} className={"rounded-full px-4 py-2.5 text-sm font-black "+(!unreadOnly?"bg-[#173c31] text-white":"border border-black/15 bg-white")}>All</Link><Link href={href(1,true)} className={"rounded-full px-4 py-2.5 text-sm font-black "+(unreadOnly?"bg-[#173c31] text-white":"border border-black/15 bg-white")}>Unread {unreadCount>0?"("+unreadCount+")":""}</Link>{unreadCount>0&&<form action={markAllNotificationsRead}><button className="inline-flex items-center gap-2 rounded-xl border border-black/15 px-4 py-2.5 text-sm font-black"><CheckCheck size={16}/>Mark all read</button></form>}</div>
  </div>
  {notifications.length?<><div className="mt-8 grid gap-3">{notifications.map(item=><article key={item.id} className={"rounded-2xl border p-5 "+(item.read_at?"border-black/10 bg-white":"border-[#173c31]/20 bg-[#f4f7f2]")}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex gap-3"><span className={"mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl "+(item.read_at?"bg-[#eef1eb]":"bg-[#173c31] text-[#d4f44d]")}><Bell size={18}/></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-black">{item.title}</h2>{!item.read_at&&<span className="rounded-full bg-[#d4f44d] px-2 py-0.5 text-[10px] font-black uppercase text-[#173c31]">New</span>}</div>{item.body&&<p className="mt-1 text-sm leading-6 text-[#63706a]">{item.body}</p>}<p className="mt-2 text-xs text-[#8a918e]">{new Date(item.created_at).toLocaleString("en-GB")}</p></div></div><div className="flex gap-2">{item.href&&<Link href={item.href} className="rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Open</Link>}{!item.read_at&&<form action={markNotificationRead}><input type="hidden" name="id" value={item.id}/><button className="rounded-xl border border-black/15 px-3 py-2.5 text-sm font-black">Mark read</button></form>}</div></div></article>)}</div>{(page>1||hasMore)&&<nav aria-label="Notification pages" className="mt-8 flex items-center justify-center gap-3">{page>1&&<Link href={href(page-1)} className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-black">Previous</Link>}<span className="text-sm font-bold text-[#63706a]">Page {page}</span>{hasMore&&<Link href={href(page+1)} className="rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Next</Link>}</nav>}</>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white px-6 py-16 text-center"><Bell className="mx-auto text-[#63706a]"/><h2 className="mt-4 text-xl font-black">{unreadOnly?"No unread notifications":"No notifications yet"}</h2><p className="mx-auto mt-2 max-w-lg text-[#63706a]">{unreadOnly?"You are all caught up.":"New buyer requests, saved-search matches and request responses will appear here."}</p></div>}
 </main></>;
}
