import Link from "next/link";
import { ArrowLeft,FileSpreadsheet,ShieldCheck } from "lucide-react";
import { Header } from "@/components/header";
import { BulkInventoryImport } from "@/components/bulk-inventory-import";
import { requireSeller } from "@/lib/auth";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:1;};

export default async function BulkImportPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const page=pageNumber(first(params.page));
 const pageSize=12;
 const {user}=await requireSeller("/dashboard/import");
 const seller=await getSellerForOwner(user.id);
 if(!seller)return null;
 const supabase=await createSupabaseServerClient();
 const {data:recentRows}=await supabase.from("seller_inventory_imports")
  .select("id,filename,status,rows_received,rows_created,rows_rejected,created_at")
  .eq("seller_id",seller.id)
  .order("created_at",{ascending:false})
  .order("id",{ascending:false})
  .range((page-1)*pageSize,(page-1)*pageSize+pageSize);
 const rawRecent=recentRows??[];
 const hasMore=rawRecent.length>pageSize;
 const recent=rawRecent.slice(0,pageSize);

 return <><Header/><main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
  <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-black text-[#173c31]"><ArrowLeft size={16}/>Seller Dashboard</Link>
  <div className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
   <div>
    <p className="text-xs font-black uppercase tracking-[.18em] text-[#287154]">Seller inventory</p>
    <h1 className="mt-2 text-3xl font-black tracking-[-.045em] sm:text-4xl">Bulk CSV Import</h1>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">Bring existing garage or breaker inventory into SecondPart without creating every listing manually.</p>
   </div>
   <div className="flex flex-wrap gap-2"><a href="/secondpart-bulk-import-template.csv" download className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-black"><FileSpreadsheet size={17}/>Download CSV template</a><a href="/api/catalogue/categories.csv" className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-black">Category reference</a></div>
  </div>

  <section className="mt-7 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
   <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-800" size={20}/><div><p className="font-black text-emerald-950">Import safety rule</p><p className="mt-1 text-sm leading-6 text-emerald-900">CSV imports create drafts only. Photos, fitment evidence and Part Passport details can be reviewed before publication. A spreadsheet can never silently publish hundreds of listings.</p></div></div>
  </section>

  <BulkInventoryImport/>

  <section className="mt-8 rounded-3xl border border-black/10 bg-white p-5 sm:p-6">
   <h2 className="text-xl font-black">CSV columns</h2>
   <p className="mt-2 text-sm leading-6 text-[#63706a]">Required columns are marked below. For categories, use the SecondPart category slug where possible. Give every row a stable seller reference from your stock or inventory system, and reuse that reference when retrying a corrected row.</p>
   <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {[
     ["title","Required · minimum 5 characters"],
     ["description","Required · minimum 20 characters"],
     ["category","Required · category slug, UUID or unique name"],
     ["price_gbp","Required · e.g. 49.95"],
     ["seller_reference","Required · stable stock/SKU reference used for safe retries"],
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
   {recent.length?<div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
    {recent.map(item=><div key={item.id} className="grid gap-2 border-b border-black/8 p-4 last:border-0 sm:grid-cols-[1fr_110px_190px] sm:items-center">
     <div><p className="font-black">{item.filename||"CSV import"}</p><p className="mt-1 text-xs text-[#63706a]">{new Date(item.created_at).toLocaleString("en-GB")}</p></div>
     <span className={"w-fit rounded-full px-2.5 py-1 text-xs font-black capitalize "+(item.status==="completed"?"bg-emerald-50 text-emerald-800":item.status==="partial"?"bg-amber-50 text-amber-900":"bg-red-50 text-red-800")}>{item.status}</span>
     <div className="flex items-center justify-between gap-3"><p className="text-sm"><strong>{item.rows_created}</strong> created · <strong>{item.rows_rejected}</strong> rejected · {item.rows_received} rows</p><div className="flex shrink-0 gap-3"><Link href={"/dashboard/import/"+item.id} className="text-xs font-black underline">Report</Link>{item.rows_created>0&&<Link href={"/dashboard?inventoryStatus=draft&importBatch="+item.id} className="text-xs font-black underline">Drafts</Link>}</div></div>
    </div>)}
   </div>:<p className="mt-3 text-sm text-[#63706a]">No CSV imports on this page.</p>}
   {(page>1||hasMore)&&<nav aria-label="Import history pages" className="mt-5 flex items-center justify-center gap-3">{page>1&&<Link href={page===2?"/dashboard/import":"/dashboard/import?page="+(page-1)} className="rounded-full border border-black/15 bg-white px-4 py-2 text-xs font-black">Previous imports</Link>}<span className="text-xs font-bold text-[#63706a]">Import page {page}</span>{hasMore&&<Link href={"/dashboard/import?page="+(page+1)} className="rounded-full bg-[#173c31] px-4 py-2 text-xs font-black text-white">Next imports</Link>}</nav>}
  </section>
 </main></>;
}
