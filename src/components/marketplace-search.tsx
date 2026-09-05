"use client";

import { useEffect,useMemo,useRef,useState,type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown,Search,X } from "lucide-react";
import { CategoryBrowser } from "@/components/category-browser";
import { PartCodeScanner } from "@/components/part-code-scanner";
import { getCategoryPath } from "@/lib/category-tree";
import type { Category,MarketplaceFilters,MarketplaceSuggestion,SearchSuggestionGroups } from "@/lib/types";

const emptyGroups:SearchSuggestionGroups={categories:[],listings:[],numbers:[],brands:[]};

export function MarketplaceSearch({categories,filters,activeVehicleLabel}:{categories:Category[];filters:MarketplaceFilters;activeVehicleLabel?:string}){
 const router=useRouter();
 const rootRef=useRef<HTMLDivElement>(null);
 const [query,setQuery]=useState(filters.query??"");
 const [open,setOpen]=useState(false);
 const [categoryOpen,setCategoryOpen]=useState(false);
 const [groups,setGroups]=useState<SearchSuggestionGroups>(emptyGroups);
 const [activeIndex,setActiveIndex]=useState(-1);

 const selectedCategory=categories.find(category=>category.id===filters.category);
 const items=useMemo(()=>[
  ...groups.categories,
  ...groups.listings,
  ...groups.numbers,
  ...groups.brands
 ],[groups]);

 useEffect(()=>{
  const value=query.trim();
  if(value.length<2)return;
  const controller=new AbortController();
  const timer=window.setTimeout(()=>{
   void fetch(`/api/search-suggestions?q=${encodeURIComponent(value)}`,{signal:controller.signal})
    .then(response=>response.json())
    .then((payload:SearchSuggestionGroups)=>{setGroups(payload);setOpen(true);setActiveIndex(-1);})
    .catch(error=>{if(error instanceof Error&&error.name!=="AbortError")setGroups(emptyGroups);});
  },180);
  return()=>{window.clearTimeout(timer);controller.abort();};
 },[query]);

 useEffect(()=>{
  const onPointerDown=(event:PointerEvent)=>{if(rootRef.current&&!rootRef.current.contains(event.target as Node)){setOpen(false);setCategoryOpen(false);}};
  const onKeyDown=(event:KeyboardEvent)=>{if(event.key==="Escape"){setOpen(false);setCategoryOpen(false);}};
  document.addEventListener("pointerdown",onPointerDown);
  document.addEventListener("keydown",onKeyDown);
  return()=>{document.removeEventListener("pointerdown",onPointerDown);document.removeEventListener("keydown",onKeyDown);};
 },[]);

 const pushParams=(mutate:(params:URLSearchParams)=>void)=>{
  const params=new URLSearchParams(window.location.search);
  params.delete("family");params.delete("code");
  mutate(params);
  const qs=params.toString();
  router.push(`/${qs?`?${qs}`:""}#marketplace`);
 };

 const performSearch=(value=query)=>{
  const trimmed=value.trim();
  setQuery(trimmed);setOpen(false);setActiveIndex(-1);
  pushParams(params=>{if(trimmed)params.set("q",trimmed);else params.delete("q");});
 };

 const chooseSuggestion=(item:MarketplaceSuggestion)=>{
  setOpen(false);setActiveIndex(-1);
  if(item.kind==="category"&&item.categoryId){
   setQuery("");
   pushParams(params=>{params.delete("q");params.set("category",item.categoryId!);});
   return;
  }
  setQuery(item.query);
  pushParams(params=>params.set("q",item.query));
 };

 const chooseCategory=(category:Category)=>{
  setCategoryOpen(false);
  pushParams(params=>params.set("category",category.id));
 };

 const clearCategory=()=>pushParams(params=>params.delete("category"));
 const clearSearchAndCategory=()=>{setQuery("");setOpen(false);setCategoryOpen(false);pushParams(params=>{params.delete("q");params.delete("category");});};
 const clearVehicle=()=>pushParams(params=>{for(const key of ["vehicle","cv","cy","cf","ce","vr"])params.delete(key);});
 const hasSuggestions=items.length>0&&query.trim().length>=2;

 const onKeyDown=(event:ReactKeyboardEvent<HTMLInputElement>)=>{
  if(event.key==="ArrowDown"&&hasSuggestions){event.preventDefault();setOpen(true);setActiveIndex(index=>Math.min(index+1,items.length-1));}
  else if(event.key==="ArrowUp"&&hasSuggestions){event.preventDefault();setActiveIndex(index=>Math.max(index-1,0));}
  else if(event.key==="Enter"){event.preventDefault();if(open&&activeIndex>=0&&items[activeIndex])chooseSuggestion(items[activeIndex]);else performSearch();}
  else if(event.key==="Escape"){setOpen(false);setCategoryOpen(false);}
 };

 const group=(title:string,entries:MarketplaceSuggestion[],startIndex:number)=>{
  if(!entries.length)return null;
  return <section><p className="px-3 pb-1 pt-3 text-[11px] font-black uppercase tracking-[.14em] text-[#7b847f]">{title}</p>{entries.map((item,localIndex)=>{const index=startIndex+localIndex;return <button key={`${item.kind}-${item.label}-${index}`} type="button" onMouseEnter={()=>setActiveIndex(index)} onClick={()=>chooseSuggestion(item)} className={`flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left text-sm ${activeIndex===index?"bg-[#eef1eb]":"hover:bg-[#eef1eb]"}`}><span><strong>{item.label}</strong>{item.meta&&<small className="mt-0.5 block text-[#63706a]">{item.meta}</small>}</span></button>;})}</section>;
 };
 const categoryOffset=0;
 const listingOffset=groups.categories.length;
 const numberOffset=listingOffset+groups.listings.length;
 const brandOffset=numberOffset+groups.numbers.length;

 return <div ref={rootRef} className="relative">
  <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-sm sm:p-5">
   <form onSubmit={event=>{event.preventDefault();performSearch();}} className="flex flex-col gap-2 sm:flex-row">
    <div className="relative flex-1">
     <Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#63706a]"/>
     <input value={query} onChange={event=>{setQuery(event.target.value);setOpen(event.target.value.trim().length>=2);setActiveIndex(-1);}} onFocus={()=>{if(query.trim().length>=2)setOpen(true);}} onKeyDown={onKeyDown} autoComplete="off" aria-label="Search marketplace" className="w-full rounded-2xl border border-black/15 bg-[#f8f7f2] py-3.5 pl-11 pr-10 text-base outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Search by part, OE/OEM number, category, brand or keyword"/>
     {query&&<button type="button" aria-label="Clear search" onClick={()=>{setQuery("");setOpen(false);pushParams(params=>params.delete("q"));}} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-black/5"><X size={16}/></button>}
    </div>
    <button type="submit" className="rounded-2xl bg-[#173c31] px-6 py-3.5 text-sm font-black text-white">Search</button>
   </form>
   <PartCodeScanner/>

   <div className="mt-3 flex flex-wrap items-center gap-2">
    <button type="button" onClick={()=>{setCategoryOpen(value=>!value);setOpen(false);}} className="inline-flex items-center gap-2 rounded-full border border-black/12 px-4 py-2 text-sm font-bold">Browse categories<ChevronDown size={15}/></button>
    {selectedCategory&&<span className="inline-flex items-center gap-2 rounded-full bg-[#e8eee9] px-3 py-2 text-sm font-bold">{getCategoryPath(categories,selectedCategory.id)}<button type="button" aria-label="Remove category" onClick={clearCategory}><X size={14}/></button></span>}
    {activeVehicleLabel&&<span className="inline-flex items-center gap-2 rounded-full bg-[#173c31] px-3 py-2 text-sm font-bold text-white">Vehicle: {activeVehicleLabel}<button type="button" aria-label="Remove vehicle" onClick={clearVehicle}><X size={14}/></button></span>}{(filters.query||selectedCategory)&&<button type="button" onClick={clearSearchAndCategory} className="text-xs font-bold underline">Clear search & category</button>}
   </div>
  </div>

  {open&&hasSuggestions&&<div className="absolute left-0 right-0 z-40 mt-2 max-h-[440px] overflow-y-auto rounded-2xl border border-black/10 bg-white p-2 shadow-2xl">
   {group("Categories",groups.categories,categoryOffset)}
   {group("Parts & listings",groups.listings,listingOffset)}
   {group("OE/OEM & part numbers",groups.numbers,numberOffset)}
   {group("Brands",groups.brands,brandOffset)}
   <button type="button" onClick={()=>performSearch()} className="mt-2 w-full rounded-xl bg-[#eef1eb] px-3 py-3 text-left text-sm font-black">View all results for “{query.trim()}”</button>
  </div>}

  {categoryOpen&&<div className="absolute left-0 right-0 z-30 mt-2 max-h-[65vh] overflow-y-auto rounded-3xl border border-black/10 bg-[#f8f7f2] p-4 shadow-2xl sm:p-5"><CategoryBrowser categories={categories} selectedId={filters.category} onSelect={chooseCategory}/></div>}
 </div>;
}
