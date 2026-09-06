import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Header } from "@/components/header";
import { SellerProfileEditForm } from "@/components/seller-profile-edit-form";
import { requireSeller } from "@/lib/auth";
import { getSellerForOwner } from "@/lib/data/marketplace";

export const dynamic="force-dynamic";

export default async function SellerProfileSettingsPage(){
 const {user}=await requireSeller("/dashboard/profile");
 const seller=await getSellerForOwner(user.id);
 if(!seller)return <><Header/><main className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-3xl font-black">Create your seller profile first</h1><Link href="/dashboard" className="mt-4 inline-block font-black underline">Back to dashboard</Link></main></>;

 return <><Header/><main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
   <div>
    <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Seller settings</p>
    <h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Edit seller profile</h1>
    <p className="mt-2 text-sm leading-6 text-[#63706a]">Keep your public seller identity, location and description accurate.</p>
   </div>
   <Link href={`/seller/${seller.slug}`} className="inline-flex w-fit items-center gap-2 rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">View public profile <ExternalLink size={15}/></Link>
  </div>
  <SellerProfileEditForm seller={seller}/>
 </main></>;
}
