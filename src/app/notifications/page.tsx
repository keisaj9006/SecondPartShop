import Link from "next/link";
import { Bell,CheckCheck } from "lucide-react";
import { Header } from "@/components/header";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { markAllNotificationsRead,markNotificationRead } from "./actions";

export const dynamic="force-dynamic";

export default async function NotificationsPage(){
 const user=await requireUser("/notifications");
 const supabase=await createSupabaseServerClient();
 const {data}=await supabase
  .from("notifications")
  .select("id,type,title,body,href,read_at,created_at")
  .eq("profile_id",user.id)
  .order("created_at",{ascending:false})
  .limit(100);
 const notifications=data??[];
 const unread=notifications.filter(item=>!item.read_at).length;
 return <><Header/><main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Your account</p><h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Notifications</h1><p className="mt-2 text-[#63706a]">Buyer requests, saved-search matches and marketplace activity that needs your attention.</p></div>{unread>0&&<form action={markAllNotificationsRead}><button className="inline-flex items-center gap-2 rounded-xl border border-black/15 px-4 py-2.5 text-sm font-black"><CheckCheck size={16}/>Mark all read</button></form>}</div>
  {notifications.length?<div className="mt-8 grid gap-3">{notifications.map(item=><article key={item.id} className={`rounded-2xl border p-5 ${item.read_at?"border-black/10 bg-white":"border-[#173c31]/20 bg-[#f4f7f2]"}`}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex gap-3"><span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.read_at?"bg-[#eef1eb]":"bg-[#173c31] text-[#d4f44d]"}`}><Bell size={18}/></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-black">{item.title}</h2>{!item.read_at&&<span className="rounded-full bg-[#d4f44d] px-2 py-0.5 text-[10px] font-black uppercase text-[#173c31]">New</span>}</div>{item.body&&<p className="mt-1 text-sm leading-6 text-[#63706a]">{item.body}</p>}<p className="mt-2 text-xs text-[#8a918e]">{new Date(item.created_at).toLocaleString("en-GB")}</p></div></div><div className="flex gap-2">{item.href&&<Link href={item.href} className="rounded-xl bg-[#173c31] px-4 py-2.5 text-sm font-black text-white">Open</Link>}{!item.read_at&&<form action={markNotificationRead}><input type="hidden" name="id" value={item.id}/><button className="rounded-xl border border-black/15 px-3 py-2.5 text-sm font-black">Mark read</button></form>}</div></div></article>)}</div>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white px-6 py-16 text-center"><Bell className="mx-auto text-[#63706a]"/><h2 className="mt-4 text-xl font-black">No notifications yet</h2><p className="mx-auto mt-2 max-w-lg text-[#63706a]">New buyer requests, saved-search matches and request responses will appear here.</p></div>}
 </main></>;
}
