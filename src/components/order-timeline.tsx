import { CheckCircle2,CircleDot,Clock3 } from "lucide-react";
import type { OrderTimelineEvent } from "@/lib/types";

const eventLabel=(event:OrderTimelineEvent)=>{
 switch(event.eventType){
  case "checkout_reserved":return "Checkout reserved";
  case "payment_confirmed":return "Payment confirmed";
  case "seller_fulfilment_update":
   return event.toStatus==="dispatched"?"Seller marked the item dispatched":
    event.toStatus==="ready_for_collection"?"Item ready for collection":"Seller updated fulfilment";
  case "buyer_received":return "Buyer confirmed receipt";
  case "buyer_accepted":return "Buyer accepted the item";
  case "seller_transfer_released":return "Seller transfer released";
  case "case_opened":return "Transaction case opened";
  case "case_status_changed":return event.toStatus?"Case moved to "+event.toStatus.replaceAll("_"," "):"Case status changed";
  case "provider_dispute_opened":return "Card-provider dispute opened";
  case "provider_dispute_closed":return "Card-provider dispute closed";
  case "checkout_reservation_expired":return "Checkout reservation expired";
  case "checkout_setup_failed":return "Checkout setup failed safely";
  case "transaction_message_sent":return "Transaction message sent";
  default:return event.eventType.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());
 }
};

const visible=(event:OrderTimelineEvent)=>event.eventType!=="transaction_message_sent";

export function OrderTimeline({events}:{events:OrderTimelineEvent[]}){
 const items=events.filter(visible);
 return <section className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
  <div className="flex items-center gap-2"><Clock3 size={19}/><h2 className="text-xl font-black">Transaction timeline</h2></div>
  {items.length?<ol className="mt-5 grid gap-0">{items.map((event,index)=><li key={event.id} className="relative grid grid-cols-[28px_1fr] gap-3 pb-5 last:pb-0">
   {index<items.length-1&&<span className="absolute left-[13px] top-6 h-[calc(100%-10px)] w-px bg-black/10"/>}
   <span className="relative z-10 mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-[#eef1eb] text-[#173c31]">{index===items.length-1?<CheckCircle2 size={15}/>:<CircleDot size={14}/>}</span>
   <div><p className="text-sm font-black">{eventLabel(event)}</p>{event.fromStatus&&event.toStatus&&event.fromStatus!==event.toStatus&&<p className="mt-0.5 text-xs text-[#63706a]">{event.fromStatus.replaceAll("_"," ")} → {event.toStatus.replaceAll("_"," ")}</p>}<p className="mt-1 text-[11px] text-[#8a918e]">{new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short"}).format(new Date(event.createdAt))}</p></div>
  </li>)}</ol>:<p className="mt-4 text-sm text-[#63706a]">No timeline events are available yet.</p>}
 </section>;
}