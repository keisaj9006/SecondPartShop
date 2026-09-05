import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { Header } from "@/components/header";
import { ListingForm } from "@/components/listing-form";
import { ListingPhotoManager } from "@/components/listing-photo-manager";
import { requireSeller } from "@/lib/auth";
import { getDonorVehicles } from "@/lib/data/donor-vehicles";
import { getCategories,getSellerForOwner,getSellerListingById } from "@/lib/data/marketplace";
import { getCatalogueFitmentsForPart } from "@/lib/data/catalogue-fitments";
import { getListingQuality } from "@/lib/listing-quality";

export const dynamic="force-dynamic";

export default async function EditListingPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const {user}=await requireSeller("/dashboard/listings/"+id+"/edit");
 const seller=await getSellerForOwner(user.id);
 if(!seller)redirect("/dashboard");
 const [listing,categories,donors,catalogueFitments]=await Promise.all([getSellerListingById(id,seller.id),getCategories(),getDonorVehicles(seller.id),getCatalogueFitmentsForPart(id)]);
 if(!listing)notFound();
 const quality=getListingQuality(listing,catalogueFitments.length);
 return <><Header/><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6"><Link href="/dashboard" className="text-sm font-bold underline">Back to dashboard</Link><h1 className="mt-5 text-4xl font-black tracking-tight">Edit listing</h1><p className="mt-2 text-[#63706a]">Changes to an active listing are visible immediately.</p><section className="mt-6 rounded-3xl border border-black/10 bg-[#f8f7f2] p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-black uppercase tracking-[.15em] text-[#287154]">Listing quality</p><h2 className="mt-1 text-2xl font-black">{quality.score}% · {quality.label}</h2><p className="mt-2 text-sm text-[#63706a]">Complete evidence and fitment data helps buyers trust the listing and reduces compatibility questions.</p></div><div className="h-3 w-full overflow-hidden rounded-full bg-black/10 sm:w-52"><div className="h-full rounded-full bg-[#173c31]" style={{width:quality.score+"%"}}/></div></div>{quality.missing.length>0&&<div className="mt-4 flex flex-wrap gap-2">{quality.missing.map(item=><span key={item} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold">{item}</span>)}</div>}</section><ListingPhotoManager listing={listing}/><ListingForm categories={categories} donors={donors} initialCatalogueFitments={catalogueFitments} listing={listing}/></main></>;
}
