import Link from "next/link";
import { Header } from "@/components/header";
import { ListingForm } from "@/components/listing-form";
import { requireSeller } from "@/lib/auth";
import { getDonorVehicles } from "@/lib/data/donor-vehicles";
import { getCategories,getSellerForOwner } from "@/lib/data/marketplace";
import { getSellerPartRequestLeads } from "@/lib/data/seller-request-leads";
import { redirect } from "next/navigation";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function NewListingPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [{user},params]=await Promise.all([requireSeller("/dashboard/listings/new"),searchParams]);
 const seller=await getSellerForOwner(user.id);
 if(!seller)redirect("/dashboard");
 const [categories,donors,requestLeads]=await Promise.all([getCategories(),getDonorVehicles(seller.id),getSellerPartRequestLeads()]);
 const requestedDonor=first(params.donor);
 const defaultDonorId=donors.some(donor=>donor.id===requestedDonor)?requestedDonor:undefined;
 const requestedLead=requestLeads.find(lead=>lead.id===first(params.request));
 const leadCategory=requestedLead?.categoryId&&categories.find(category=>category.id===requestedLead.categoryId&&category.isSelectable)?requestedLead.categoryId:undefined;
 return <><Header/><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6"><Link href="/dashboard" className="text-sm font-bold underline">Back to dashboard</Link><h1 className="mt-5 text-4xl font-black tracking-tight">Create listing</h1><p className="mt-2 text-[#63706a]">Add accurate identifiers, real product photos and only fitments you can support.</p>{requestedLead&&<div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-black text-amber-900">Creating a listing for buyer demand</p><p className="mt-1 text-amber-900/80">{requestedLead.queryText}{requestedLead.oemNumber?" · OE/OEM "+requestedLead.oemNumber:""}</p></div>}<ListingForm categories={categories} donors={donors} defaultDonorId={defaultDonorId} defaultTitle={requestedLead?.queryText} defaultCategoryId={leadCategory} defaultRequestId={requestedLead?.id}/></main></>;
}
