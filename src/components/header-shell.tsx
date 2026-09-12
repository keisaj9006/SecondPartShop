"use client";

import { useEffect,useRef,useState,useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell,CarFront,ChevronDown,Heart,Menu,Search,UserRound,Wrench,X } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { CategoryBrowser } from "@/components/category-browser";
import { resetMarketplacePagination } from "@/lib/marketplace-navigation";
import type { Category } from "@/lib/types";

export function HeaderShell({categories,user,displayName,seller}:{categories:Category[];user:boolean;displayName:string|null;seller:boolean}){
 const router=useRouter();
 const headerRef=useRef<HTMLElement>(null);
 const desktopCategoriesTriggerRef=useRef<HTMLButtonElement>(null);
 const desktopCategoriesPanelRef=useRef<HTMLDivElement>(null);
 const mobileTriggerRef=useRef<HTMLButtonElement>(null);
 const mobilePanelRef=useRef<HTMLDivElement>(null);
 const [categoriesOpen,setCategoriesOpen]=useState(false);
 const [mobileOpen,setMobileOpen]=useState(false);
 const [mobileCategories,setMobileCategories]=useState(false);
 const [,startNavigation]=useTransition();

 useEffect(()=>{
  const onPointerDown=(event:PointerEvent)=>{if(headerRef.current&&!headerRef.current.contains(event.target as Node)){setCategoriesOpen(false);setMobileOpen(false);setMobileCategories(false);}};
  const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape"){
   const target=event.target as Node;
   const desktopFocusWasInside=Boolean(desktopCategoriesPanelRef.current?.contains(target));
   const mobileFocusWasInside=Boolean(mobilePanelRef.current?.contains(target));
   setCategoriesOpen(false);setMobileOpen(false);setMobileCategories(false);
   if(desktopFocusWasInside)desktopCategoriesTriggerRef.current?.focus();
   else if(mobileFocusWasInside)mobileTriggerRef.current?.focus();
  }};
  document.addEventListener("pointerdown",onPointerDown);
  document.addEventListener("keydown",onKeyDown);
  return()=>{document.removeEventListener("pointerdown",onPointerDown);document.removeEventListener("keydown",onKeyDown);};
 },[]);

 const selectCategory=(category:Category)=>{
  setCategoriesOpen(false);setMobileOpen(false);setMobileCategories(false);
  const params=new URLSearchParams(window.location.pathname==="/"?window.location.search:"");
  params.set("category",category.id);
  params.delete("family");params.delete("code");
  resetMarketplacePagination(params);
  startNavigation(()=>router.push(`/?${params.toString()}#marketplace`,{scroll:false}));
 };

 return <header ref={headerRef} className="app-topbar sticky top-0 z-50 border-b border-black/10 bg-[#fbfcfa]/95 backdrop-blur-xl">
  <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-3 py-2.5 sm:min-h-18 sm:px-6 sm:py-3">
   <Link href="/" aria-label="SecondPart home" className="flex min-w-0 items-center gap-2 text-[20px] font-black tracking-[-.04em] sm:text-[22px]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#173c31] text-[#d4f44d]">S</span><span className="min-w-0 truncate">SecondPart</span></Link>
   <nav aria-label="Primary navigation" className="hidden items-center gap-5 whitespace-nowrap text-sm font-semibold xl:flex">
    <button ref={desktopCategoriesTriggerRef} type="button" aria-expanded={categoriesOpen} aria-controls="header-desktop-categories" onClick={()=>{setCategoriesOpen(value=>!value);setMobileOpen(false);}} className="inline-flex items-center gap-1">Car parts<ChevronDown size={15}/></button>
    <Link href="/#marketplace" onClick={()=>setCategoriesOpen(false)}>Browse parts</Link>
    <Link href="/sellers" onClick={()=>setCategoriesOpen(false)}>Sellers</Link>
    <Link href="/garages" onClick={()=>setCategoriesOpen(false)}>Garages</Link>
    <Link href="/sell" onClick={()=>setCategoriesOpen(false)}>Sell a part</Link>
    <Link href="/about" onClick={()=>setCategoriesOpen(false)}>How it works</Link>
   </nav>
   <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
    <Link aria-label="Search" href="/#marketplace" className="native-redundant-action rounded-full p-2.5 hover:bg-black/5"><Search size={19}/></Link>
    <Link aria-label="Saved parts" href="/saved" className="rounded-full p-2.5 hover:bg-black/5"><Heart size={19}/></Link>{user&&<><Link aria-label="Notifications" href="/notifications" className="rounded-full p-2.5 hover:bg-black/5"><Bell size={19}/></Link><Link aria-label="SecondPart Garage" href="/garage" className="native-redundant-action hidden items-center justify-center rounded-full p-2.5 hover:bg-black/5 xl:inline-flex"><CarFront size={19}/></Link></>}
    {seller&&<Link aria-label="Seller dashboard" href="/dashboard" className="hidden items-center justify-center rounded-full p-2.5 hover:bg-black/5 xl:inline-flex"><Wrench size={19}/></Link>}
    {user?<><Link href="/account" title={displayName??undefined} className="ml-1 hidden items-center gap-2 whitespace-nowrap rounded-full border border-black/15 px-4 py-2 text-sm font-semibold sm:flex"><UserRound size={17}/>Account</Link><form action={signOut}><button className="hidden whitespace-nowrap px-2 text-xs font-bold underline sm:block" type="submit">Sign out</button></form></>:<Link href="/account" className="ml-1 hidden items-center gap-2 whitespace-nowrap rounded-full border border-black/15 px-4 py-2 text-sm font-semibold sm:flex"><UserRound size={17}/>Sign in</Link>}
    <button ref={mobileTriggerRef} type="button" aria-label={mobileOpen?"Close navigation":"Open navigation"} aria-expanded={mobileOpen} aria-controls="header-mobile-navigation" onClick={()=>{setMobileOpen(value=>!value);setCategoriesOpen(false);setMobileCategories(false);}} className="rounded-full p-2.5 xl:hidden">{mobileOpen?<X size={21}/>:<Menu size={21}/>}</button>
   </div>
  </div>

  {categoriesOpen&&<div ref={desktopCategoriesPanelRef} id="header-desktop-categories" className="absolute left-0 right-0 top-full hidden border-b border-black/10 bg-[#f8f7f2] shadow-2xl xl:block">
   <div className="mx-auto max-w-7xl px-6 py-6"><CategoryBrowser categories={categories} onSelect={selectCategory}/></div>
  </div>}

  {mobileOpen&&<div ref={mobilePanelRef} id="header-mobile-navigation" className="border-t border-black/10 bg-white px-4 py-4 shadow-xl xl:hidden">
   <nav aria-label="Mobile menu" className="grid gap-1 text-sm font-bold">
    <button type="button" aria-expanded={mobileCategories} aria-controls="header-mobile-categories" onClick={()=>setMobileCategories(value=>!value)} className="flex items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-black/5">Car parts<ChevronDown size={16} className={mobileCategories?"rotate-180 transition":"transition"}/></button>
    {mobileCategories?<div id="header-mobile-categories" className="pt-3"><CategoryBrowser categories={categories} onSelect={selectCategory}/></div>:<>
     <Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/#marketplace" onClick={()=>setMobileOpen(false)}>Browse parts</Link>
     <Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/sellers" onClick={()=>setMobileOpen(false)}>Sellers</Link>
     <Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/garages" onClick={()=>setMobileOpen(false)}>Garages / Buy + Fit</Link>
     <Link className="rounded-xl px-3 py-3 hover:bg-black/5" href={seller?"/dashboard":"/sell"} onClick={()=>setMobileOpen(false)}>{seller?"Seller dashboard":"Sell a part"}</Link>
     <Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/saved" onClick={()=>setMobileOpen(false)}>Saved parts</Link>{user&&<><Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/notifications" onClick={()=>setMobileOpen(false)}>Notifications</Link><Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/garage" onClick={()=>setMobileOpen(false)}>SecondPart Garage</Link><Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/saved-searches" onClick={()=>setMobileOpen(false)}>Saved searches</Link><Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/recently-viewed" onClick={()=>setMobileOpen(false)}>Recently viewed</Link><Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/requests" onClick={()=>setMobileOpen(false)}>Part requests</Link><Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/account/fitting" onClick={()=>setMobileOpen(false)}>Fitting requests</Link></>}
     <Link className="rounded-xl px-3 py-3 hover:bg-black/5" href="/account" onClick={()=>setMobileOpen(false)}>{user?"Account":"Sign in"}</Link>
     {user&&<form action={signOut}><button className="w-full rounded-xl px-3 py-3 text-left hover:bg-black/5">Sign out</button></form>}
    </>}
   </nav>
  </div>}
 </header>;
}
