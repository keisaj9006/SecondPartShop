import Link from "next/link";
import { ArrowLeft,FileSpreadsheet,ShieldCheck } from "lucide-react";
import { Header } from "@/components/header";
import { BulkInventoryImport } from "@/components/bulk-inventory-import";
import { requireSeller } from "@/lib/auth";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic="force-dynamic";

export default async function BulkImportPage(){
 const {user}=await requireSeller("/dashboard/import");
 const seller=await getSellerForOwner(user.id);
 if(!seller)return null;
 const supabase=await createSupabaseServerClient();
 const {data:recent}=await supabase.from("seller_inventory_imports")
  .select("id,filename,status,rows_received,rows_created,rows_rejected,created_at")
  .eq("seller_id",seller.id)
  .order("created_at",{ascending:false})
  .limit(8);

 return <><Header/><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
  <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-black text-[#173c31]"><ArrowLeft size={16}/>Seller Dashboard</Link>
  <div className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
   <div>
    <p className="text-xs font-black uppercase tracking-[.18em] text-[#287154]">Seller inventory</p>
    <h1 className="mt-2 text-3xl font-black tracking-[-.045em] sm:text-4xl">Bulk CSV Import</h1>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Bring existing garage or breaker inventory into SecondPart without creating every listing manually.</p>
   </div>
   <a href="/secondpart-bulk-import-template.csv" download className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-black"><FileSpreadsheet size={17}/>Download CSV template</a>
  </div>

  <section className="mt-7 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
   <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-800" size={20}/><div><p className="font-black text-emerald-950">Import safety rule</p><p className="mt-1 text-sm leading-6 text-emerald-900">CSV imports create drafts only. Photos, fitment evidence and Part Passport details can be reviewed before publication. A spreadsheet can never silently publish hundreds of listings.</p></div></div>
  </section>

  <BulkInventoryImport/>

  <section className="mt-8 rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <h2 className="text-xl font-black">CSV columns</h2>
   <p className="mt-2 text-sm leading-6 text-[#63706a]">Required columns are marked below. For categories, use the SecondPart category slug where possible. Seller reference is optional but strongly recommended for inventory systems.</p>
   <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {[
     ["title","Required · minimum 5 characters"],
     ["description","Required · minimum 20 characters"],
     ["category","Required · category slug, UUID or unique name"],
     ["price_gbp","Required · e.g. 49.95"],
     ["seller_reference","Recommended · your stock/SKU reference"],
     ["donor_registration","Optional · must already exist in Donor Vehicles"],
     ["condition","used / new / reconditioned"],
     ["testing_status","tested_working / removed_from_running_vehicle / visually_inspected / untested / not_specified"],
     ["stock","Whole number · default 1"],
     ["manufacturer","Brand or manufacturer"],
     ["part_number","Manufacturer / supplier part number"],
     ["oem_number","OE/OEM number"],
     ["warranty_days","0–730 · default 0"],
     ["shipping_gbp","Delivery price · default 0"],
     ["collection_available","yes/no · default no"],
     ["delivery_days_min + max","Both supplied together or both blank"],
     ["dispatch_days","0–30 · default 2"],
     ["condition_notes / damage_notes","Optional evidence · max 500 characters"],
     ["gearbox_family + gearbox_code","Required only for transmission-specific categories"]
    ].map(([name,detail])=><div key={name} className="rounded-2xl bg-[#f8f7f2] p-4"><code className="text-sm font-black text-[#173c31]">{name}</code><p className="mt-1 text-xs leading-5 text-[#63706a]">{detail}</p></div>)}
   </div>
  </section>

  <section className="mt-8 rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <h2 className="text-xl font-black">Recent imports</h2>
   {recent?.length?<div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
    {recent.map(item=><div key={item.id} className="grid gap-2 border-b border-black/8 p-4 last:border-0 sm:grid-cols-[1fr_110px_190px] sm:items-center">
     <div><p className="font-black">{item.filename||"CSV import"}</p><p className="mt-1 text-xs text-[#63706a]">{new Date(item.created_at).toLocaleString("en-GB")}</p></div>
     <span className={"w-fit rounded-full px-2.5 py-1 text-xs font-black capitalize "+(item.status==="completed"?"bg-emerald-50 text-emerald-800":item.status==="partial"?"bg-amber-50 text-amber-900":"bg-red-50 text-red-800")}>{item.status}</span>
     <p className="text-sm"><strong>{item.rows_created}</strong> created · <strong>{item.rows_rejected}</strong> rejected · {item.rows_received} rows</p>
    </div>)}
   </div>:<p className="mt-3 text-sm text-[#63706a]">No CSV imports yet.</p>}
  </section>
 </main></>;
}
