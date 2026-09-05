"use client";

import Image from "next/image";
import { useState } from "react";
import type { ListingImage } from "@/lib/types";
import { ProductImage } from "@/components/product-image";

export function ProductGallery({images,alt}:{images:ListingImage[];alt:string}){
 const [active,setActive]=useState(0);
 if(!images.length)return <ProductImage alt={alt}/>;
 const selected=images[Math.min(active,images.length-1)];
 return <div>
  <div className="relative min-h-[520px] overflow-hidden rounded-[28px] border border-black/10 bg-[#e8ebe5]"><Image src={selected.url} alt={selected.alt||alt} fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover"/></div>
  {images.length>1&&<div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">{images.slice(0,6).map((image,index)=><button key={image.id} type="button" onClick={()=>setActive(index)} aria-label={`Show product photo ${index+1}`} className={`relative aspect-square overflow-hidden rounded-xl border ${active===index?"border-[#173c31] ring-2 ring-[#173c31]/20":"border-black/10"}`}><Image src={image.url} alt={image.alt||`${alt} photo ${index+1}`} fill sizes="120px" className="object-cover"/></button>)}</div>}
 </div>;
}
