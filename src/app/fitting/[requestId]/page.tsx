import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/identifiers";
import { sendFittingMessage } from "./actions";

export const dynamic="force-dynamic";
function one<T>(value:T|T[]|null){return Array.isArray(value)?value[0]??null:value;}
const money=(pence:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(pence/100);

export default async function FittingRequestDetailPage({params}:{params:Promise<{requestId:string}>}){
 const {requestId}=await params;
 if(!isUuid(requestId))notFound();
 const user=await requireUser("/fitting/"+requestId);
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("fitting_requests")
  .select("id,buyer_id,status,quote_pence,quote_note,buyer_notes,vehicle_year,vehicle_fuel,vehicle_engine_size,vehicle_registration,parts(title,slug),garage_partners(owner_id,business_name,location),vehicle_catalogue_variants(make,model_family,variant)")
  .eq("id",requestId)
  .maybeSingle();
 if(error||!data)notFound();
 const part=one(data.parts),garage=one(data.garage_partners),vehicle=one(data.vehicle_catalogue_variants);
 if(!part||!garage||!vehicle)notFound();
 const isBuyer=data.buyer_id===user.id;
 const isGarage=garage.owner_id===user.id;
 if(!isBuyer&&!isGarage)notFound();

 const {data:messageRows}=await supabase
  .from("fitting_request_messages")
  .select("id,sender_profile_id,body,created_at")
  .eq("fitting_request_id",requestId)
  .order("created_at")
  .order("id")
  .limit(300);
 const messages=messageRows??[];
 const canMessage=data.status==="accepted";

 return <><Header/><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
  <Link href={isBuyer?"/account/fitting":"/garage-partner/requests"} className="text-sm font-black underline">Back to fitting requests</Link>
  <p className="mt-6 text-xs font-black uppercase tracking-[.2em] text-[#287154]">Buy + Fit request</p>
  <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h1 className="text-3xl font-black tracking-[-.04em]">{part.title}</h1><p className="mt-2 text-sm text-[#63706a]">{garage.business_name} · {garage.location}</p><p className="mt-1 text-sm font-bold">{data.vehicle_registration?data.vehicle_registration+" · ":""}{vehicle.make} {vehicle.model_family} · {data.vehicle_year}{data.vehicle_engine_size?" · "+data.vehicle_engine_size+"cc":""}{data.vehicle_fuel?" · "+data.vehicle_fuel:""}</p></div><div className="text-right"><span className="rounded-full bg-[#eef1eb] px-3 py-1 text-xs font-black capitalize">{data.status}</span>{data.quote_pence!==null&&<p className="mt-3 text-2xl font-black">{money(data.quote_pence)}<span className="block text-xs text-[#63706a]">labour quote</span></p>}</div></div>
  {data.quote_note&&<div className="mt-5 rounded-2xl bg-[#f4f7f2] p-4 text-sm"><strong>Garage quote note</strong><p className="mt-1 leading-6 text-[#63706a]">{data.quote_note}</p></div>}
  {data.buyer_notes&&<div className="mt-3 rounded-2xl bg-[#f8f7f2] p-4 text-sm"><strong>Buyer request note</strong><p className="mt-1 leading-6 text-[#63706a]">{data.buyer_notes}</p></div>}
  <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-5 text-amber-950">This conversation is for arranging fitting. The labour quote remains separate from the SecondPart part payment, and the garage message does not create a compatibility guarantee.</div>

  <section className="mt-7 rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#287154]">Private fitting chat</p><h2 className="mt-1 text-2xl font-black">Arrange the appointment</h2></div><span className="text-xs font-bold text-[#63706a]">{messages.length} message{messages.length===1?"":"s"}</span></div>
   {messages.length?<div className="mt-5 grid gap-3">{messages.map(message=>{const mine=message.sender_profile_id===user.id;return <div key={message.id} className={"max-w-[88%] rounded-2xl px-4 py-3 text-sm "+(mine?"ml-auto bg-[#173c31] text-white":"bg-[#f4f7f2] text-[#173c31]")}><p className="whitespace-pre-wrap leading-6">{message.body}</p><p className={"mt-1 text-[10px] "+(mine?"text-white/60":"text-[#7a847f]")}>{mine?"You":isBuyer?garage.business_name:"Buyer"} · {new Date(message.created_at).toLocaleString("en-GB")}</p></div>;})}</div>:<div className="mt-5 rounded-2xl border border-dashed border-black/15 p-5 text-sm text-[#63706a]">{canMessage?"Quote accepted. Send the first message to arrange the fitting appointment.":"Messages become available after the buyer accepts the labour quote."}</div>}
   {canMessage?<form action={sendFittingMessage} className="mt-5"><input type="hidden" name="requestId" value={requestId}/><label className="text-sm font-black">Message<textarea required minLength={1} maxLength={2000} rows={3} name="body" className="mt-2 w-full rounded-xl border border-black/15 px-4 py-3" placeholder="Suggest a date/time or ask a fitting question."/></label><button className="mt-3 rounded-xl bg-[#173c31] px-5 py-3 text-sm font-black text-white">Send message</button></form>:data.status==="completed"?<p className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900">Fitting marked complete. This chat is now read-only.</p>:null}
  </section>
 </main></>;
}
