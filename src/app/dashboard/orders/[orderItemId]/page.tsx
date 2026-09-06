import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft,MessageSquareText,PackageCheck,Truck } from "lucide-react";
import { Header } from "@/components/header";
import { OrderTimeline } from "@/components/order-timeline";
import { SellerFulfilmentControls } from "@/components/seller-fulfilment-controls";
import { requireSeller } from "@/lib/auth";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { getOrderTimeline,getSellerSales } from "@/lib/data/orders";

export const dynamic="force-dynamic";

const money=(pence:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(pence/100);
const label=(value:string)=>value.replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());

export default async function SellerSaleDetailPage({params}:{params:Promise<{orderItemId:string}>}){
 const {orderItemId}=await params;
 const {user}=await requireSeller("/dashboard/orders/"+orderItemId);
 const seller=await getSellerForOwner(user.id);
 if(!seller)notFound();
 const sales=await getSellerSales(seller.id).catch(()=>[]);
 const sale=sales.find(item=>item.orderItemId===orderItemId);
 if(!sale)notFound();
 const timeline=await getOrderTimeline(sale.orderId,sale.orderItemId).catch(()=>[]);

 return <><Header/><main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
  <Link href="/dashboard/orders" className="inline-flex items-center gap-2 text-sm font-black"><ArrowLeft size={16}/>Back to sales</Link>
  <div className="mt-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div><p className="text-xs font-black uppercase tracking-[.16em] text-[#287154]">Order {sale.orderId.slice(0,8).toUpperCase()}</p><h1 className="mt-2 text-3xl font-black tracking-[-.04em]">Sale details</h1><p className="mt-2 text-sm text-[#63706a]">{new Intl.DateTimeFormat("en-GB",{dateStyle:"long"}).format(new Date(sale.orderCreatedAt))}</p></div>
   <div className="flex flex-wrap gap-2"><span className="rounded-full bg-[#eef1eb] px-3 py-1 text-xs font-black">{label(sale.fulfilmentStatus)}</span><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">{label(sale.paymentStatus)}</span><span className={"rounded-full px-3 py-1 text-xs font-black "+(sale.payoutStatus==="released"?"bg-emerald-50 text-emerald-800":"bg-amber-50 text-amber-900")}>{label(sale.payoutStatus)}</span></div>
  </div>

  <div className="mt-7 grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
   <section className="grid gap-4">
    <article className="rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
     <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><Link href={"/parts/"+sale.partSlug} className="text-xl font-black hover:underline">{sale.partTitle}</Link><p className="mt-1 text-sm text-[#63706a]">Qty {sale.quantity} · {sale.deliveryMethod==="collection"?"Collection":sale.shippingPence>0?"Delivery "+money(sale.shippingPence):"Free delivery"}</p></div><div className="text-right"><p className="text-lg font-black">{money(sale.unitPricePence*sale.quantity)}</p><p className="mt-1 text-xs text-[#63706a]">Item value</p></div></div>

     <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-[#f8f7f2] p-4 text-sm"><div><dt className="text-[#63706a]">Item value</dt><dd className="font-black">{money(sale.unitPricePence*sale.quantity)}</dd></div><div><dt className="text-[#63706a]">Delivery charged</dt><dd className="font-black">{money(sale.shippingPence)}</dd></div><div><dt className="text-[#63706a]">SecondPart fee</dt><dd className="font-black">− {money(sale.platformFeePence)}</dd></div><div><dt className="text-[#63706a]">Seller net</dt><dd className="font-black">{money(sale.sellerNetPence)}</dd></div></dl>
     {sale.deliveryMethod==="shipping"&&sale.paymentStatus==="paid"&&sale.shippingAddress&&<div className="mt-4 rounded-2xl bg-[#f8f7f2] p-4 text-sm"><p className="font-black">Delivery address</p><p className="mt-1 leading-6 text-[#56625d]">{[sale.shippingName,sale.shippingAddress.line1,sale.shippingAddress.line2,sale.shippingAddress.city,sale.shippingAddress.state,sale.shippingAddress.postalCode,sale.shippingAddress.country].filter(Boolean).join(", ")}</p></div>}
     {sale.trackingNumber&&<div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-900"><p className="flex items-center gap-2 font-black"><Truck size={16}/>Shipment</p><p className="mt-1">{sale.trackingCarrier?sale.trackingCarrier+" · ":""}{sale.trackingNumber}</p></div>}

     <div className="mt-4 flex flex-wrap gap-3 text-xs font-black">
      {sale.paymentStatus==="paid"&&<Link href={"/messages/"+sale.orderItemId} className="inline-flex items-center gap-1 text-[#287154] underline"><MessageSquareText size={14}/>Message buyer</Link>}
      <Link href="/dashboard/cases" className="text-amber-800 underline">Returns & cases</Link>
     </div>
     <SellerFulfilmentControls sale={sale}/>
    </article>

    <section className="rounded-3xl bg-[#173c31] p-5 text-white"><div className="flex items-center gap-2"><PackageCheck size={18}/><p className="font-black">Payout state</p></div><p className="mt-2 text-2xl font-black">{label(sale.payoutStatus)}</p><p className="mt-1 text-sm leading-6 text-white/65">{sale.payoutStatus==="released"?"The marketplace transfer has been released to the connected seller account.":sale.payoutStatus==="scheduled"?"The transaction is eligible for delayed release when the protection window completes.":sale.payoutStatus==="blocked"?"The transfer is blocked while a case, dispute or other protection hold is active.":"The seller transfer is not yet eligible for release."}</p></section>
   </section>
   <OrderTimeline events={timeline}/>
  </div>
 </main></>;
}