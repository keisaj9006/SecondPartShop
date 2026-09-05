import Link from "next/link";
import { notFound,redirect } from "next/navigation";
import { Header } from "@/components/header";
import { ListingForm } from "@/components/listing-form";
import { ListingPhotoManager } from "@/components/listing-photo-manager";
import { requireSeller } from "@/lib/auth";
import { getDonorVehicles } from "@/lib/data/donor-vehicles";
import { getCategories,getSellerForOwner,getSellerListingById } from "@/lib/data/marketplace";
import { getCatalogueFitmentsForPart } from "@/lib/data/catalogue-fitments";

export const dynamic="force-dynamic";

export default async function EditListingPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const {user}=await requireSeller("/dashboard/listings/"+id+"/edit");
 const seller=await getSellerForOwner(user.id);
 if(!seller)redirect("/dashboard");
 const [listing,categories,donors,catalogueFitments]=await Promise.all([getSellerListingById(id,seller.id),getCategories(),getDonorVehicles(seller.id),getCatalogueFitmentsForPart(id)]);
 if(!listing)notFound();
 return <><Header/><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6"><Link href="/dashboard" className="text-sm font-bold underline">Back to dashboard</Link><h1 className="mt-5 text-4xl font-black tracking-tight">Edit listing</h1><p className="mt-2 text-[#63706a]">Changes to an active listing are visible immediately.</p><ListingPhotoManager listing={listing}/><ListingForm categories={categories} donors={donors} initialCatalogueFitments={catalogueFitments} listing={listing}/></main></>;
}
