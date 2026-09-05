"use client";

import { useMemo,useState } from "react";
import { ArrowLeft,ChevronRight } from "lucide-react";
import { buildCategoryTree } from "@/lib/category-tree";
import type { Category } from "@/lib/types";

export function CategoryBrowser({categories,selectedId,onSelect,className=""}:{categories:Category[];selectedId?:string;onSelect:(category:Category)=>void;className?:string}){
 const roots=useMemo(()=>buildCategoryTree(categories),[categories]);
 const [departmentId,setDepartmentId]=useState<string|null>(null);
 const department=roots.find(item=>item.id===departmentId)??null;
 if(!department){
  return <div className={className}>
   <p className="mb-3 text-xs font-black uppercase tracking-[.16em] text-[#287154]">Departments</p>
   <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    {roots.map(item=><button key={item.id} type="button" onClick={()=>setDepartmentId(item.id)} className="flex min-h-12 items-center justify-between rounded-xl border border-black/10 bg-white px-4 py-3 text-left text-sm font-bold hover:bg-[#eef1eb]"><span>{item.name}</span><ChevronRight size={16}/></button>)}
   </div>
  </div>;
 }
 return <div className={className}>
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
   <button type="button" onClick={()=>setDepartmentId(null)} className="inline-flex items-center gap-2 text-sm font-bold"><ArrowLeft size={16}/>Departments</button>
   <button type="button" onClick={()=>onSelect(department)} className="rounded-full bg-[#173c31] px-4 py-2 text-xs font-black text-white">Shop all {department.name}</button>
  </div>
  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
   {department.children.map(group=><section key={group.id} className="rounded-2xl border border-black/10 bg-white p-4">
    <div className="flex items-center justify-between gap-2">
     <button type="button" onClick={()=>onSelect(group)} className="text-left font-black hover:underline">{group.name}</button>
     <button type="button" onClick={()=>onSelect(group)} className="text-xs font-bold text-[#287154]">Shop all</button>
    </div>
    <div className="mt-3 grid gap-1">
     {group.children.map(item=><button key={item.id} type="button" onClick={()=>onSelect(item)} className={`rounded-lg px-2 py-2 text-left text-sm hover:bg-[#eef1eb] ${selectedId===item.id?"bg-[#eef1eb] font-bold":""}`}>{item.name}</button>)}
    </div>
   </section>)}
  </div>
 </div>;
}
