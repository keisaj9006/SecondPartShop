import Link from "next/link";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { requireUser } from "@/lib/auth";
import { getSavedListingsPage } from "@/lib/data/marketplace";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const pageNumber=(value:string|undefined)=>{const parsed=Number(value);return Number.isInteger(parsed)&&parsed>0?parsed:1;};

export default async function SavedPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const [user,params]=await Promise.all([requireUser("/saved"),searchParams]);
 const page=pageNumber(first(params.page));
 const pageSize=24;
 const result=await getSavedListingsPage(user.id,{offset:(page-1)*pageSize,limit:pageSize});

 return <><Header/><main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Your account</p>
  <h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Saved parts</h1>
  <p className="mt-2 text-[#63706a]">These listings are stored in your account and remain saved between sessions.</p>
  {result.error&&<p className="mt-6 rounded-xl bg-red-50 p-4 text-red-800">{result.error}</p>}

  {result.data.length?<><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{result.data.map(item=><ProductCard key={item.id} item={item} viewerId={user.id} saved/>)}</div>
   {(page>1||result.pagination.hasMore)&&<nav aria-label="Saved part pages" className="mt-10 flex items-center justify-center gap-3">
    {page>1&&<Link href={page===2?"/saved":"/saved?page="+(page-1)} className="rounded-full border border-black/15 bg-white px-5 py-3 text-sm font-black">Previous</Link>}
    <span className="text-sm font-bold text-[#63706a]">Page {page}</span>
    {result.pagination.hasMore&&<Link href={"/saved?page="+(page+1)} className="rounded-full bg-[#173c31] px-5 py-3 text-sm font-black text-white">Next</Link>}
   </nav>}
  </>:!result.error&&<div className="mt-8 rounded-3xl border border-dashed border-black/20 bg-white py-20 text-center">
   <h2 className="text-xl font-bold">{page>1?"No saved parts on this page":"No saved parts yet"}</h2>
   {page>1?<Link href="/saved" className="mt-3 inline-block font-bold underline">Back to first page</Link>:<Link href="/#marketplace" className="mt-3 inline-block font-bold underline">Browse marketplace</Link>}
  </div>}
 </main></>;
}
