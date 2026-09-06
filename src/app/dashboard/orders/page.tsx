import Link from "next/link";
import { Banknote,PackageCheck,Truck } from "lucide-react";
import { Header } from "@/components/header";
import { SellerFulfilmentControls } from "@/components/seller-fulfilment-controls";
import { requireSeller } from "@/lib/auth";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { getSellerSales } from "@/lib/data/orders";

export const dynamic="force-dynamic";

const label=(value:string)=>value.replaceAll("_"," ").replace(/\\b\\w/g,letter=>letter.toUpperCase());
const money=(pence:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(pence/100);

export default async function SellerOrdersPage(){
 const {user}=await requireSeller("/dashboard/orders");
 const seller=await getSellerForOwner(user.id);
 const sales=seller?await getSellerSales(seller.id).catch(()=>[]):[];

 return <><Header/><main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Seller dashboard</p>
  <h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Sales & payouts</h1>
  <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Orders move from payment → preparation → dispatch → delivery → buyer acceptance → funds released.</p>

  {sales.length?<div className="mt-8 overflow-hidden rounded-3xl border border-black/10 bg-white">
   <div className="hidden grid-cols-[1.4fr_.8fr_.8fr_.8fr] gap-4 border-b border-black/10 bg-[#eef1eb] px-5 py-3 text-xs font-black uppercase tracking-wide text-[#63706a] md:grid"><span>Item</span><span>Fulfilment</span><span>Payment</span><span>Payout</span></div>
   {sales.map(sale=><div key={sale.orderItemId} className="grid gap-4 border-b border-black/8 p-5 last:border-0 md:grid-cols-[1.4fr_.8fr_.8fr_.8fr] md:items-center">
    <div><Link href={"/dashboard/orders/"+sale.orderItemId} className="font-black hover:underline">{sale.partTitle}</Link><p className="mt-1 text-xs text-[#63706a]">Order {sale.orderId.slice(0,8).toUpperCase()} · {money(sale.unitPricePence*sale.quantity)} · Qty {sale.quantity}</p><p className="mt-1 text-xs text-[#63706a]">{sale.deliveryMethod==="collection"?"Collection":sale.shippingPence>0?`Delivery £${(sale.shippingPence/100).toFixed(2)}`:"Free delivery"} · Seller net {money(sale.sellerNetPence)}</p><div className="mt-2 flex flex-wrap gap-3 text-xs font-black"><Link href={"/dashboard/orders/"+sale.orderItemId} className="text-[#287154] underline">View sale details</Link>{sale.paymentStatus==="paid"&&<Link href={"/messages/"+sale.orderItemId} className="text-[#287154] underline">Message buyer</Link>}</div>{sale.deliveryMethod==="shipping"&&sale.paymentStatus==="paid"&&sale.shippingAddress&&<div className="mt-3 rounded-xl bg-[#f8f7f2] p-3 text-xs leading-5"><p className="font-black">Delivery address</p><p className="mt-1">{[sale.shippingName,sale.shippingAddress.line1,sale.shippingAddress.line2,sale.shippingAddress.city,sale.shippingAddress.state,sale.shippingAddress.postalCode,sale.shippingAddress.country].filter(Boolean).join(", ")}</p></div>}{sale.trackingNumber&&<p className="mt-2 flex items-center gap-1 text-xs font-bold text-[#287154]"><Truck size={13}/>{sale.trackingCarrier?`${sale.trackingCarrier} · `:""}{sale.trackingNumber}</p>}<SellerFulfilmentControls sale={sale}/></div>
    <span className="w-fit rounded-full bg-[#eef1eb] px-3 py-1 text-xs font-black">{label(sale.fulfilmentStatus)}</span>
    <span className="w-fit rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-800">{label(sale.paymentStatus)}</span>
    <span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${sale.payoutStatus==="released"?"bg-emerald-50 text-emerald-800":"bg-amber-50 text-amber-900"}`}>{label(sale.payoutStatus)}</span>
   </div>)}
  </div>:<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white px-6 py-16 text-center"><PackageCheck className="mx-auto text-[#63706a]"/><h2 className="mt-4 text-xl font-black">No sales yet</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#63706a]">Paid orders will appear here once checkout is connected.</p><Link href="/dashboard/listings/new" className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white"><Banknote size={16}/>Create a listing</Link></div>}
 </main></>;
}
