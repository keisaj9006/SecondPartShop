import Link from "next/link";
import { PackageCheck,Star,Truck } from "lucide-react";
import { Header } from "@/components/header";
import { BuyerReceiptControls } from "@/components/buyer-receipt-controls";
import { requireUser } from "@/lib/auth";
import { getBuyerOrders } from "@/lib/data/orders";

export const dynamic="force-dynamic";

const money=(pence:number,currency:string)=>new Intl.NumberFormat("en-GB",{style:"currency",currency}).format(pence/100);
const label=(value:string)=>value.replaceAll("_"," ").replace(/\\b\\w/g,letter=>letter.toUpperCase());

export default async function PurchasesPage(){
 const user=await requireUser("/account/orders");
 const orders=await getBuyerOrders(user.id).catch(()=>[]);

 return <><Header/><main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Your account</p>
  <h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Purchases</h1>
  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Track payment, dispatch, delivery, buyer protection and when a transaction becomes eligible for a verified review.</p>

  {orders.length?<div className="mt-8 grid gap-5">{orders.map(order=><article key={order.id} className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <div className="flex flex-col justify-between gap-3 border-b border-black/8 pb-4 sm:flex-row sm:items-center">
    <div><p className="text-xs font-black uppercase tracking-wide text-[#287154]">Order {order.id.slice(0,8).toUpperCase()}</p><p className="mt-1 text-sm text-[#63706a]">{new Intl.DateTimeFormat("en-GB",{dateStyle:"medium"}).format(new Date(order.createdAt))}</p></div>
    <div className="flex flex-wrap gap-2"><span className="rounded-full bg-[#eef1eb] px-3 py-1 text-xs font-black">{label(order.paymentStatus)}</span><span className="rounded-full bg-[#173c31] px-3 py-1 text-xs font-black text-white">{label(order.status)}</span></div>
   </div>
   <div className="mt-4 grid gap-4">{order.items.map(item=><div key={item.id} className="rounded-2xl bg-[#f8f7f2] p-4">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
     <div><Link href={`/parts/${item.partSlug}`} className="font-black hover:underline">{item.partTitle}</Link><p className="mt-1 text-sm text-[#63706a]">Seller: <Link href={`/seller/${item.sellerSlug}`} className="font-bold hover:underline">{item.sellerName}</Link> · Qty {item.quantity} · {item.deliveryMethod==="collection"?"Collection":item.shippingPence>0?`Delivery £${(item.shippingPence/100).toFixed(2)}`:"Free delivery"}</p></div>
     <p className="font-black">{money(item.unitPricePence*item.quantity,order.currency)}</p>
    </div>
    <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-[#56625d]"><span className="inline-flex items-center gap-1"><PackageCheck size={14}/>{label(item.fulfilmentStatus)}</span>{item.trackingNumber&&<span className="inline-flex items-center gap-1"><Truck size={14}/>{item.trackingCarrier?`${item.trackingCarrier} · `:""}{item.trackingNumber}</span>}{item.fundsReleasedAt&&<Link href="/account/reviews" className="inline-flex items-center gap-1 text-[#287154] underline"><Star size={14}/>Leave verified review</Link>}{order.paymentStatus==="paid"&&<Link href={"/messages/"+item.id} className="font-black text-[#287154] underline">Message seller</Link>}{order.paymentStatus==="paid"&&!["cancelled","refunded","returned","return_requested","dispute_open"].includes(item.fulfilmentStatus)&&<Link href={"/account/cases?item="+encodeURIComponent(item.id)} className="font-black text-amber-800 underline">Report problem / return</Link>}</div>
   <BuyerReceiptControls item={item}/></div>)}</div>
   <div className="mt-4 flex justify-end"><p className="text-lg font-black">Total {money(order.totalPence,order.currency)}</p></div>
  </article>)}</div>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white px-6 py-16 text-center"><PackageCheck className="mx-auto text-[#63706a]"/><h2 className="mt-4 text-xl font-black">No purchases yet</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#63706a]">Completed marketplace orders will appear here with payment and delivery status.</p><Link href="/#marketplace" className="mt-5 inline-block rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Browse parts</Link></div>}
 </main></>;
}
