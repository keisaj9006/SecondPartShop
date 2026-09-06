import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft,MessageSquareText,PackageCheck,Star,Truck } from "lucide-react";
import { BuyerReceiptControls } from "@/components/buyer-receipt-controls";
import { Header } from "@/components/header";
import { OrderTimeline } from "@/components/order-timeline";
import { requireUser } from "@/lib/auth";
import { getBuyerOrders,getOrderTimeline } from "@/lib/data/orders";

export const dynamic="force-dynamic";

const money=(pence:number,currency:string)=>new Intl.NumberFormat("en-GB",{style:"currency",currency}).format(pence/100);
const label=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());

export default async function BuyerOrderDetailPage({params}:{params:Promise<{orderId:string}>}){
 const {orderId}=await params;
 const user=await requireUser("/account/orders/"+orderId);
 const orders=await getBuyerOrders(user.id).catch(()=>[]);
 const order=orders.find(item=>item.id===orderId);
 if(!order)notFound();
 const timeline=await getOrderTimeline(order.id).catch(()=>[]);

 return <><Header/><main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
  <Link href="/account/orders" className="inline-flex items-center gap-2 text-sm font-black"><ArrowLeft size={16}/>Back to purchases</Link>
  <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div><p className="text-xs font-black uppercase tracking-[.16em] text-[#287154]">Order {order.id.slice(0,8).toUpperCase()}</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Purchase details</h1><p className="mt-2 text-sm text-[#63706a]">{new Intl.DateTimeFormat("en-GB",{dateStyle:"long"}).format(new Date(order.createdAt))}</p></div>
   <div className="flex flex-wrap gap-2"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">{label(order.paymentStatus)}</span><span className="rounded-full bg-[#173c31] px-3 py-1 text-xs font-black text-white">{label(order.status)}</span></div>
  </div>

  <div className="mt-7 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
   <section className="grid gap-4">
    {order.items.map(item=><article key={item.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
     <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><Link href={"/parts/"+item.partSlug} className="text-lg font-black hover:underline">{item.partTitle}</Link><p className="mt-1 text-sm text-[#63706a]">Seller: <Link href={"/seller/"+item.sellerSlug} className="font-bold hover:underline">{item.sellerName}</Link> · Qty {item.quantity}</p></div><p className="text-lg font-black">{money(item.unitPricePence*item.quantity,order.currency)}</p></div>
     <div className="mt-4 grid gap-2 rounded-2xl bg-[#f8f7f2] p-4 text-sm">
      <p className="flex items-center gap-2 font-bold"><PackageCheck size={16}/>{label(item.fulfilmentStatus)}</p>
      <p className="flex items-center gap-2 text-[#56625d]">{item.deliveryMethod==="collection"?"Collection":item.shippingPence>0?"Delivery "+money(item.shippingPence,order.currency):"Free delivery"}</p>
      {item.trackingNumber&&<p className="flex items-center gap-2 text-[#287154]"><Truck size={16}/>{item.trackingCarrier?item.trackingCarrier+" · ":""}{item.trackingNumber}</p>}
     </div>
     <div className="mt-4 flex flex-wrap gap-3 text-xs font-black">
      {order.paymentStatus==="paid"&&<Link href={"/messages/"+item.id} className="inline-flex items-center gap-1 text-[#287154] underline"><MessageSquareText size={14}/>Message seller</Link>}
      {order.paymentStatus==="paid"&&!["cancelled","refunded","returned","return_requested","dispute_open"].includes(item.fulfilmentStatus)&&<Link href={"/account/cases?item="+encodeURIComponent(item.id)} className="text-amber-800 underline">Report problem / return</Link>}
      {item.fundsReleasedAt&&<Link href="/account/reviews" className="inline-flex items-center gap-1 text-[#287154] underline"><Star size={14}/>Leave verified review</Link>}
     </div>
     <BuyerReceiptControls item={item}/>
    </article>)}
    <div className="rounded-3xl bg-[#173c31] p-5 text-white"><p className="text-sm text-white/65">Order total</p><p className="mt-1 text-3xl font-black">{money(order.totalPence,order.currency)}</p></div>
   </section>
   <OrderTimeline events={timeline}/>
  </div>
 </main></>;
}