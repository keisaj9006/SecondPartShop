import Image from "next/image";
import { Star,Trash2 } from "lucide-react";
import { deleteListingImage,setListingCoverImage } from "@/app/dashboard/actions";
import type { Listing } from "@/lib/types";

export function ListingPhotoManager({listing}:{listing:Listing}){
 if(!listing.images.length)return null;
 return <section className="mt-8 rounded-3xl border border-black/10 bg-white p-5 sm:p-7">
  <div><p className="text-sm font-black">Product photos</p><p className="mt-1 text-sm text-[#63706a]">Choose the cover image or remove outdated photos. Active listings must keep at least one real product photo.</p></div>
  <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
   {listing.images.map((image,index)=><article key={image.id} className="overflow-hidden rounded-2xl border border-black/10">
    <div className="relative aspect-[4/3] bg-[#eef1eb]"><Image src={image.url} alt={image.alt||listing.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover"/>{index===0&&<span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#d4f44d] px-2.5 py-1 text-xs font-black text-[#173c31]"><Star size={13}/>Cover</span>}</div>
    <div className="flex gap-2 p-3">
     {index!==0&&<form action={setListingCoverImage} className="flex-1"><input type="hidden" name="partId" value={listing.id}/><input type="hidden" name="imageId" value={image.id}/><button className="w-full rounded-xl border border-black/15 px-3 py-2 text-xs font-black">Make cover</button></form>}
     <form action={deleteListingImage}><input type="hidden" name="partId" value={listing.id}/><input type="hidden" name="imageId" value={image.id}/><button disabled={listing.status==="active"&&listing.images.length===1} aria-label="Delete product photo" className="rounded-xl border border-red-200 p-2 text-red-700 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={16}/></button></form>
    </div>
   </article>)}
  </div>
 </section>;
}
