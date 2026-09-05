"use client";

import { useEffect,useRef,useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell,CarFront,ChevronDown,Heart,Menu,Search,UserRound,Wrench,X } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { CategoryBrowser } from "@/components/category-browser";
import type { Category } from "@/lib/types";

export function HeaderShell({categories,user,displayName,seller}:{categories:Category[];user:boolean;displayName:string|null;seller:boolean}){
 const router=useRouter();
 const headerRef=useRef<HTMLElement>(null);
 const [categoriesOpen,setCategoriesOpen]=useState(false);
 const [mobileOpen,setMobileOpen]=useState(false);
 const [mobileCategories,setMobileCategories]=useState(false);

 useEffect(()=>{
  const onPointerDown=(event:PointerEvent)=>{if(headerRef.current&&!headerRef.current.contains(event.target as Node)){setCategoriesOpen(false);setMobileOpen(false);setMobileCategories(false);}};
  const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape"){setCategoriesOpen(false);setMobileOpen(false);setMobileCategories(false);}};
  document.addEventListener("pointerdown",onPointerDown);
  document.addEventListener("keydown",onKeyDown);
  return()=>{document.removeEventListener("pointerdown",onPointerDown);document.removeEventListener("keydown",onKeyDown);};
 },[]);

 const selectCategory=(category:Category)=>{
  setCategoriesOpen(false);setMobileOpen(false);setMobileCategories(false);
  const params=new URLSearchParams(window.location.pathname==="/"?window.location.search:"");
  params.set("category",category.id);
  params.delete("family");params.delete("code");
  router.push(`/?${params.toString()}#marketplace`);
 };

 return <header ref={headerRef} className="sticky top-0 z-50 border-b border-black/10 bg-[#fbfcfa]/95 backdrop-blur-xl">
  <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
   <Link href="/" className="flex items-center gap-2 text-[22px] font-black tracking-[-.04em]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#173c31] text-[#d4f44d]">S</span>SecondPart</Link>
   <nav className="hidden items-center gap-7 text-sm font-semibold md:flex">
    <button type="button" onClick={()=>{setCategoriesOpen(value=>!value);setMobileOpen(false);}} className="inline-flex items-center gap-1">Car parts<ChevronDown size={15}/></button>
    <Link href="/#marketplace" onClick={()=>setCategoriesOpen(false)}>Browse parts</Link>
    <Link href="/sellers" onClick={()=>setCategoriesOpen(false)}>Sellers</Link>
    <Link href="/sell" onClick={()=>setCategoriesOpen(false)}>Sell a part</Link>
    <Link href="/about" onClick={()=>setCategoriesOpen(false)}>How it works</Link>
   </nav>
   <div className="flex items-center gap-1">
    <Link aria-label="Search" href="/#marketplace" className="rounded-full p-2.5 hover:bg-black/5"><Search size={19}/></Link>
    <Link aria-label="Saved parts" href="/saved" className="rounded-full p-2.5 hover:bg-black/5"><Heart size={19}/></Link>{user&&<><Link aria-label="Notifications" href="/notifications" className="rounded-full p-2.5 hover:bg-black/5"><Bell size={19}/></Link><Link aria-label="SecondPart Garage" href="/garage" className="rounded-full p-2.5 hover:bg-black/5"><CarFront size={19}/></Link></>}
    {seller&&<Link aria-label="Seller dashboard" href="/dashboard" className="rounded-full p-2.5 hover:bg-black/5"><Wrench size={19}/></Link>}
    {user?<><Link href="/account" className="ml-1 hidden items-center gap-2 rounded-full border border-black/15 px-4 py-2 text-sm font-semibold sm:flex"><UserRound size={17}/>{displayName??"Account"}</Link><form action={signOut}><button className="hidden px-2 text-xs font-bold underline sm:block" type="submit">Sign out</button></form></>:<Link href="/account" className="ml-1 hidden items-center gap-2 rounded-full border border-black/15 px-4 py-2 text-sm font-semibold sm:flex"><UserRound size={17}/>Sign in</Link>}
    <button type="button" aria-label={mobileOpen?"Close navigation":"Open navigation"} onClick={()=>{setMobileOpen(value=>!value);setCategoriesOpen(false);setMobileCategories(false);}} className="rounded-full p-2.5 md:hidden">{mobileOpen?<X size={21}/>:<Menu size={21}/>}</button>
   </div>
  </div>

  {categoriesOpen&&<div className="absolute left-0 right-0 top-full hidden border-b border-black/10 bg-[#f8f7f2] shadow-2xl md:block">
   <div className="mx-auto max-w-7xl px-6 py-6"><CategoryBrowser categories={categories} onSelect={selectCategory}/></div>
  </div>}

  {mobileOpen&&<div className="border-t border-black/10 bg-white px-4 py-4 shadow-xl md:hidden">
   {!mobileCategories?<nav className="grid gap-1 text-sm font-bold">
    <button type="button" onClick={()=>setMobileCategories(true)} className="flex items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-black/5">Car parts<ChevronDown size={16}/></button>
    <Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/#marketplace" onClick={()=>setMobileOpen(false)}>Browse parts</Link>
    <Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/sellers" onClick={()=>setMobileOpen(false)}>Sellers</Link>
    <Link className="rounded-xl px-3 py-3 hover:bg-black/5" href={seller?"/dashboard":"/sell"} onClick={()=>setMobileOpen(false)}>{seller?"Seller dashboard":"Sell a part"}</Link>
    <Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/saved" onClick={()=>setMobileOpen(false)}>Saved parts</Link>{user&&<><Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/notifications" onClick={()=>setMobileOpen(false)}>Notifications</Link><Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/garage" onClick={()=>setMobileOpen(false)}>SecondPart Garage</Link><Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/saved-searches" onClick={()=>setMobileOpen(false)}>Saved searches</Link><Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/recently-viewed" onClick={()=>setMobileOpen(false)}>Recently viewed</Link><Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/requests" onClick={()=>setMobileOpen(false)}>Part requests</Link></>}
    <Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/account" onClick={()=>setMobileOpen(false)}>{user?"Account":"Sign in"}</Link>
    {user&&<form action={signOut}><button className="w-full rounded-xl px-3 py-3 text-left hover:bg-black/5">Sign out</button></form>}
   </nav>:<div><button type="button" onClick={()=>setMobileCategories(false)} className="mb-4 text-sm font-bold underline">Back to navigation</button><CategoryBrowser categories={categories} onSelect={selectCategory}/></div>}
  </div>}
 </header>;
}
