import Link from "next/link";
import { CheckCircle2,MapPin,ShieldCheck } from "lucide-react";
import type { Listing } from "@/lib/types";
import { ProductImage } from "./product-image";
import { SaveButton } from "./save-button";

const label=(value:string)=>value.charAt(0).toUpperCase()+value.slice(1);

export function ProductCard({item,saved=false,fitsVehicle=false}:{item:Listing;saved?:boolean;fitsVehicle?:boolean}){
 return <article className="group overflow-hidden rounded-[22px] border border-black/10 bg-white transition hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(18,34,29,.12)]">
  <div className="relative h-52"><ProductImage url={item.images[0]?.url} alt={item.images[0]?.alt??item.title}/><div className="absolute right-3 top-3"><SaveButton partId={item.id} initialSaved={saved} compact/></div></div>
  <div className="p-5">
   <div className="mb-3 flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#eef1eb] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide">{label(item.condition)}</span>{fitsVehicle&&<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-800"><CheckCircle2 size={13}/>Fits your vehicle</span>}</div>
   <Link href={`/parts/${item.slug}`}><h3 className="text-lg font-bold tracking-tight group-hover:underline">{item.title}</h3></Link>
   <p className="mt-1.5 text-sm text-[#63706a]">{item.oemNumber?`OEM ${item.oemNumber}`:item.partNumber??"Part number on request"}</p>
   <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-[#63706a]">{item.seller.verified&&<><ShieldCheck size={15} className="text-[#287154]"/><span className="font-semibold text-[#173c31]">Verified seller</span><span>·</span></>}<MapPin size={13}/>{item.seller.location}</div>
   <div className="mt-5 flex items-end justify-between border-t border-black/8 pt-4"><div><span className="text-2xl font-black">£{(item.pricePence/100).toLocaleString("en-GB",{minimumFractionDigits:2})}</span><p className="text-xs text-[#63706a]">{item.stock} in stock</p></div><Link href={`/parts/${item.slug}`} className="rounded-full bg-[#173c31] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#245b49]">View part</Link></div>
  </div>
 </article>;
}
