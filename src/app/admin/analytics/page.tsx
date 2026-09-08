import Link from "next/link";
import {BarChart3,Search,XCircle} from "lucide-react";
import {Header} from "@/components/header";
import {requireAdmin} from "@/lib/auth";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const allowedDays=new Set([7,30,90]);
const percent=(value:number,total:number)=>total?Math.round(value/total*1000)/10:0;
const normalized=(value:string)=>value.trim().toLowerCase().replace(/\s+/g," ");

export default async function AnalyticsPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireAdmin("/admin/analytics");
 const params=await searchParams;
 const rawDays=Number(first(params.days)??30);
 const days=allowedDays.has(rawDays)?rawDays:30;
 const since=new Date(Date.now()-days*24*60*60*1000).toISOString();
 const supabase=createSupabaseAdminClient();
 const {data,error}=await supabase
  .from("marketplace_search_events")
  .select("source,query_text,result_count,has_results,vehicle_context,compatible_only,created_at")
  .gte("created_at",since)
  .order("created_at",{ascending:false})
  .limit(5000);
 if(error)throw new Error("Search analytics are temporarily unavailable.");

 const events=data??[];
 const filled=events.filter(item=>item.has_results).length;
 const zero=events.length-filled;
 const mobile=events.filter(item=>item.source==="mobile");
 const web=events.filter(item=>item.source==="web");
 const vehicle=events.filter(item=>item.vehicle_context);

 const aggregate=(items:typeof events)=>{
  const map=new Map<string,{query:string;searches:number;filled:number;last:string}>();
  for(const item of items){
   const key=normalized(item.query_text);
   const current=map.get(key)??{query:item.query_text,searches:0,filled:0,last:item.created_at};
   current.searches+=1;
   if(item.has_results)current.filled+=1;
   if(item.created_at>current.last)current.last=item.created_at;
   map.set(key,current);
  }
  return [...map.values()];
 };
 const demand=aggregate(events).sort((a,b)=>b.searches-a.searches||b.last.localeCompare(a.last)).slice(0,15);
 const missing=aggregate(events.filter(item=>!item.has_results)).sort((a,b)=>b.searches-a.searches||b.last.localeCompare(a.last)).slice(0,20);

 const card=(label:string,value:string,detail:string)=><div className="rounded-2xl border border-black/10 bg-white p-5"><p className="text-xs font-black uppercase tracking-[.14em] text-[#63706a]">{label}</p><p className="mt-2 text-3xl font-black tracking-[-.04em]">{value}</p><p className="mt-1 text-xs leading-5 text-[#63706a]">{detail}</p></div>;

 return <><Header/><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-[#287154]"><BarChart3 size={15}/>Admin · marketplace intelligence</p><h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Search Fill Rate</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Privacy-minimal demand telemetry. No user ID, IP address or vehicle registration is stored in these search events.</p></div>
   <div className="flex flex-wrap gap-2"><Link href="/admin/system" className="rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">System readiness</Link>{[7,30,90].map(value=><Link key={value} href={"/admin/analytics?days="+value} className={"rounded-full px-4 py-2.5 text-sm font-black "+(days===value?"bg-[#173c31] text-white":"border border-black/15")}>{value} days</Link>)}</div>
  </div>

  <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   {card("Searches",events.length.toLocaleString("en-GB"),"Latest "+days+" days · capped to 5,000 most recent events in this operational view.")}
   {card("Fill rate",percent(filled,events.length)+"%",filled.toLocaleString("en-GB")+" searches returned at least one result.")}
   {card("Zero-result",percent(zero,events.length)+"%",zero.toLocaleString("en-GB")+" searches found nothing and represent inventory opportunity.")}
   {card("Vehicle-context",percent(vehicle.length,events.length)+"%",vehicle.length.toLocaleString("en-GB")+" searches used a selected vehicle.")}
  </section>

  <section className="mt-5 grid gap-3 sm:grid-cols-2">
   {card("Mobile fill rate",percent(mobile.filter(item=>item.has_results).length,mobile.length)+"%",mobile.length.toLocaleString("en-GB")+" mobile searches.")}
   {card("Web fill rate",percent(web.filter(item=>item.has_results).length,web.length)+"%",web.length.toLocaleString("en-GB")+" web searches.")}
  </section>

  <div className="mt-8 grid gap-6 lg:grid-cols-2">
   <section className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
    <div className="flex items-center gap-2"><XCircle size={18} className="text-red-700"/><h2 className="text-xl font-black">Inventory gaps</h2></div>
    <p className="mt-1 text-sm leading-6 text-[#63706a]">Most repeated searches that returned zero marketplace results.</p>
    {missing.length?<div className="mt-4 divide-y divide-black/8">{missing.map(item=><div key={item.query} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate font-black">{item.query}</p><p className="text-xs text-[#63706a]">Last searched {new Date(item.last).toLocaleString("en-GB")}</p></div><span className="shrink-0 rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-800">{item.searches} miss{item.searches===1?"":"es"}</span></div>)}</div>:<div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">No zero-result searches in this window yet.</div>}
   </section>

   <section className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
    <div className="flex items-center gap-2"><Search size={18} className="text-[#287154]"/><h2 className="text-xl font-black">Highest observed demand</h2></div>
    <p className="mt-1 text-sm leading-6 text-[#63706a]">Most frequently repeated part queries, regardless of whether inventory was available.</p>
    {demand.length?<div className="mt-4 divide-y divide-black/8">{demand.map(item=><div key={item.query} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate font-black">{item.query}</p><p className="text-xs text-[#63706a]">{percent(item.filled,item.searches)}% fill rate</p></div><span className="shrink-0 rounded-full bg-[#eef1eb] px-3 py-1 text-xs font-black">{item.searches} search{item.searches===1?"":"es"}</span></div>)}</div>:<div className="mt-5 rounded-2xl bg-[#f8f7f2] p-4 text-sm text-[#63706a]">Search analytics will populate as buyers use marketplace search.</div>}
   </section>
  </div>

  <section className="mt-8 rounded-2xl bg-[#f8f7f2] p-5 text-sm leading-6 text-[#56625d]"><strong className="text-[#173c31]">How to use this:</strong> repeated zero-result queries should feed seller outreach, Find My Part priorities and inventory import decisions. Fill rate should improve before a broad public launch rather than being treated as a vanity metric.</section>
 </main></>;
}
