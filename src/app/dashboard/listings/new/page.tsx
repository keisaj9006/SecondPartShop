import Link from "next/link";
import { Header } from "@/components/header";
import { ListingForm } from "@/components/listing-form";
import { requireSeller } from "@/lib/auth";
import { getCategories,getSellerForOwner,getVehicles } from "@/lib/data/marketplace";
import { redirect } from "next/navigation";
export const dynamic="force-dynamic";
export default async function NewListingPage(){const {user}=await requireSeller("/dashboard/listings/new");const seller=await getSellerForOwner(user.id);if(!seller)redirect("/dashboard");const [categories,vehicles]=await Promise.all([getCategories(),getVehicles()]);return <><Header/><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6"><Link href="/dashboard" className="text-sm font-bold underline">Back to dashboard</Link><h1 className="mt-5 text-4xl font-black tracking-tight">Create listing</h1><p className="mt-2 text-[#63706a]">Add accurate identifiers and only confirmed vehicle fitments.</p><ListingForm categories={categories} vehicles={vehicles}/></main></>}
