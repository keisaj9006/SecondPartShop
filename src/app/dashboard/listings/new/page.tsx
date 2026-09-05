import Link from "next/link";
import { Header } from "@/components/header";
import { ListingForm } from "@/components/listing-form";
import { requireSeller } from "@/lib/auth";
import { getDonorVehicles } from "@/lib/data/donor-vehicles";
import { getCategories,getSellerForOwner,getVehicles } from "@/lib/data/marketplace";
import { redirect } from "next/navigation";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function NewListingPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [{user},params]=await Promise.all([requireSeller("/dashboard/listings/new"),searchParams]);
 const seller=await getSellerForOwner(user.id);
 if(!seller)redirect("/dashboard");
 const [categories,vehicles,donors]=await Promise.all([getCategories(),getVehicles(),getDonorVehicles(seller.id)]);
 const requestedDonor=first(params.donor);
 const defaultDonorId=donors.some(donor=>donor.id===requestedDonor)?requestedDonor:undefined;
 return <><Header/><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6"><Link href="/dashboard" className="text-sm font-bold underline">Back to dashboard</Link><h1 className="mt-5 text-4xl font-black tracking-tight">Create listing</h1><p className="mt-2 text-[#63706a]">Add accurate identifiers, real product photos and only fitments you can support.</p><ListingForm categories={categories} vehicles={vehicles} donors={donors} defaultDonorId={defaultDonorId}/></main></>;
}
