"use client";

import { useActionState,useMemo,useState } from "react";
import { createListing,updateListing } from "@/app/dashboard/actions";
import { buildCategoryTree,getCategoryAncestors,type CategoryNode } from "@/lib/category-tree";
import type { ActionState,Category,DonorVehicle,Listing,Vehicle } from "@/lib/types";

const initial:ActionState={status:"idle"};
const selectableDescendants=(node:CategoryNode|null)=>{
 if(!node)return [];
 const result:Category[]=[];
 const visit=(item:CategoryNode)=>{if(item.isSelectable)result.push(item);for(const child of item.children)visit(child);};
 visit(node);
 return result;
};

export function ListingForm({categories,vehicles,donors,defaultDonorId,listing}:{categories:Category[];vehicles:Vehicle[];donors:DonorVehicle[];defaultDonorId?:string;listing?:Listing}){
 const handler=listing?updateListing:createListing;
 const [state,action,pending]=useActionState(handler,initial);
 const tree=useMemo(()=>buildCategoryTree(categories),[categories]);
 const initialPath=useMemo(()=>listing?getCategoryAncestors(categories,listing.categoryId):[],[categories,listing]);
 const [departmentId,setDepartmentId]=useState(initialPath[0]?.id??"");
 const [groupId,setGroupId]=useState(initialPath[1]?.id??"");
 const [categoryId,setCategoryId]=useState(listing?.categoryId??"");
 const department=tree.find(item=>item.id===departmentId)??null;
 const groups=department?.children??[];
 const group=groups.find(item=>item.id===groupId)??null;
 const partTypes=selectableDescendants(group);
 const selected=new Set(listing?.fitments.map(f=>f.vehicle.id)??[]);
 const selectedCategory=categories.find(category=>category.id===categoryId);
 const transmissionRelated=Boolean(selectedCategory?.isTransmissionRelated);
 const input="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]";

 const selectDepartment=(value:string)=>{setDepartmentId(value);setGroupId("");setCategoryId("");};
 const selectGroup=(value:string)=>{
  setGroupId(value);
  const next=groups.find(item=>item.id===value)??null;
  const options=selectableDescendants(next);
  setCategoryId(options.length===1&&options[0].id===value?value:"");
 };

 return <form action={action} className="mt-8 grid gap-5 rounded-3xl border border-black/10 bg-white p-5 sm:p-7 lg:grid-cols-2">
  {listing&&<input type="hidden" name="partId" value={listing.id}/>}
  <input type="hidden" name="categoryId" value={categoryId}/>

  <label className="text-sm font-bold lg:col-span-2">Listing title<input required minLength={5} name="title" defaultValue={listing?.title} className={input} placeholder="e.g. Golf Mk7 LED headlight"/></label>
  <label className="text-sm font-bold lg:col-span-2">Description<textarea required minLength={20} rows={5} name="description" defaultValue={listing?.description} className={input} placeholder="Describe condition, testing and what is included."/></label>
  <label className="text-sm font-bold lg:col-span-2">Donor vehicle <span className="font-normal text-[#63706a]">(optional)</span><select name="donorVehicleId" defaultValue={listing?.donorVehicleId??defaultDonorId??""} className={input}><option value="">Not linked to a donor vehicle</option>{donors.map(donor=><option key={donor.id} value={donor.id}>{donor.registration?donor.registration+" · ":""}{donor.make} {donor.model} · {donor.year}{donor.engineSizeSimple?" · "+donor.engineSizeSimple+"cc":""}</option>)}</select><small className="mt-2 block font-normal text-[#63706a]">Reuse one donor across many listings instead of re-entering the same vehicle details. <a href="/dashboard/donors" className="font-bold underline">Manage donor vehicles</a>.</small></label>

  <fieldset className="rounded-2xl border border-black/10 bg-[#f8f7f2] p-4 lg:col-span-2">
   <legend className="px-1 text-sm font-black">Part category</legend>
   <p className="mt-1 text-sm text-[#63706a]">Choose the department, category group and then the specific part type.</p>
   <div className="mt-3 grid gap-3 md:grid-cols-3">
    <label className="text-sm font-bold">Department<select value={departmentId} onChange={event=>selectDepartment(event.target.value)} className={input} required><option value="">Choose department</option>{tree.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="text-sm font-bold">Category<select value={groupId} onChange={event=>selectGroup(event.target.value)} className={input} disabled={!departmentId} required><option value="">Choose category</option>{groups.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="text-sm font-bold">Part type<select value={categoryId} onChange={event=>setCategoryId(event.target.value)} className={input} disabled={!groupId} required><option value="">Choose part type</option>{partTypes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
   </div>
   {selectedCategory&&<p className="mt-3 rounded-xl bg-[#e8eee9] px-3 py-2 text-sm"><strong>Selected:</strong> {initialPath.length&&listing?.categoryId===categoryId?getCategoryAncestors(categories,categoryId).map(item=>item.name).join(" › "):[department?.name,group?.name,selectedCategory.name].filter(Boolean).join(" › ")}</p>}
  </fieldset>

  <fieldset className="grid gap-4 rounded-2xl border border-black/10 bg-[#f8f7f2] p-4 lg:col-span-2 sm:grid-cols-2">
   <div className="sm:col-span-2"><p className="text-sm font-black">Condition, testing & warranty</p><p className="mt-1 text-xs text-[#63706a]">These details are visible to buyers and help them understand exactly what they are purchasing.</p></div>
   <label className="text-sm font-bold">Condition<select required name="condition" defaultValue={listing?.condition??"used"} className={input}><option value="new">New</option><option value="reconditioned">Reconditioned</option><option value="used">Used</option></select></label>
   <label className="text-sm font-bold">Testing status<select required name="testingStatus" defaultValue={listing?.testingStatus??"not_specified"} className={input}><option value="tested_working">Tested working</option><option value="removed_from_running_vehicle">Removed from running vehicle</option><option value="visually_inspected">Visually inspected only</option><option value="untested">Untested</option><option value="not_specified">Not specified</option></select></label>
   <label className="text-sm font-bold">Warranty<select required name="warrantyDays" defaultValue={listing?.warrantyDays??0} className={input}><option value="0">No seller warranty stated</option><option value="30">30 days</option><option value="90">90 days</option><option value="180">6 months</option><option value="365">12 months</option></select></label>
   <label className="text-sm font-bold">Price (£)<input required min="0" step="0.01" type="number" name="price" defaultValue={listing?listing.pricePence/100:undefined} className={input}/></label>
   <label className="text-sm font-bold">Stock quantity<input required min="0" step="1" type="number" name="stock" defaultValue={listing?.stock??1} className={input}/></label>
   <label className="text-sm font-bold sm:col-span-2">Condition notes<textarea name="conditionNotes" maxLength={500} rows={3} defaultValue={listing?.conditionNotes??""} className={input} placeholder="e.g. Clean used condition, mounting points intact, connector pins checked."/></label>
   <label className="text-sm font-bold sm:col-span-2">Damage / visible wear<textarea name="damageNotes" maxLength={500} rows={3} defaultValue={listing?.damageNotes??""} className={input} placeholder="Describe scratches, cracks, corrosion, broken clips or other visible damage. Leave blank only if there is nothing material to disclose."/></label>
  </fieldset>

  {transmissionRelated&&<div className="grid gap-4 rounded-2xl border border-black/10 bg-[#f8f7f2] p-4 lg:col-span-2 sm:grid-cols-2">
   <div className="sm:col-span-2"><p className="text-sm font-black">Transmission technical details</p><p className="mt-1 text-xs text-[#63706a]">Required only because this selected part type is transmission-specific. Buyers do not need these codes in the normal search flow.</p></div>
   <label className="text-sm font-bold">Gearbox family<input required name="gearboxFamily" defaultValue={listing?.gearboxFamily??""} className={input} placeholder="DQ250"/></label>
   <label className="text-sm font-bold">Gearbox code<input required name="gearboxCode" defaultValue={listing?.gearboxCode??""} className={input} placeholder="02E"/></label>
  </div>}

  <label className="text-sm font-bold">OE/OEM number<input name="oemNumber" defaultValue={listing?.oemNumber??""} className={input} placeholder="e.g. 02E 300 062"/></label>
  <label className="text-sm font-bold">Your part number<input name="partNumber" defaultValue={listing?.partNumber??""} className={input}/></label>
  <label className="text-sm font-bold">Manufacturer / brand<input name="manufacturer" defaultValue={listing?.manufacturer??""} className={input}/></label>
  <label className="text-sm font-bold">Dispatch time<select name="dispatchDays" defaultValue={listing?.dispatchDays??2} className={input}><option value="0">Same working day</option><option value="1">1 working day</option><option value="2">2 working days</option><option value="3">3 working days</option><option value="5">5 working days</option></select></label>
  <label className="text-sm font-bold">Listing status<select name="status" defaultValue={listing?.status==="active"?"active":"draft"} className={input}><option value="draft">Draft</option><option value="active">Active</option></select></label>
  <label className="text-sm font-bold lg:col-span-2">Real product photos<input name="images" multiple type="file" accept="image/jpeg,image/png,image/webp" className={`${input} file:mr-3 file:rounded-lg file:border-0 file:bg-[#eef1eb] file:px-3 file:py-2 file:font-bold`}/><small className="mt-2 block font-normal leading-5 text-[#63706a]">Real photos of the actual part only. Up to 6 JPG, PNG or WebP files, maximum 5 MB each. At least one photo is required to publish an active listing; we recommend a whole-part photo, the label/OE number and connectors or any visible damage. Existing images remain when editing.</small></label>

  <fieldset className="lg:col-span-2">
   <legend className="text-sm font-bold">Compatible vehicles</legend>
   <p className="mt-1 text-sm text-[#63706a]">Select only fitments you can confidently support. This preserves the existing QA fitment workflow while the full catalogue fitment editor is developed.</p>
   <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-black/10 p-3 sm:grid-cols-2">{vehicles.map(vehicle=><label key={vehicle.id} className="flex items-start gap-3 rounded-lg p-2 text-sm hover:bg-[#eef1eb]"><input type="checkbox" name="vehicleIds" value={vehicle.id} defaultChecked={selected.has(vehicle.id)} className="mt-1"/><span><strong>{vehicle.make} {vehicle.model} {vehicle.generation}</strong><small className="block text-[#63706a]">{vehicle.year} · {vehicle.engine}{vehicle.fuelType?` · ${vehicle.fuelType}`:""}{transmissionRelated&&(vehicle.gearboxFamily||vehicle.gearboxCode)?` · ${vehicle.gearboxFamily??""} ${vehicle.gearboxCode??""}`:""}</small></span></label>)}</div>
  </fieldset>

  {state.message&&<p role="status" className={`rounded-xl p-3 text-sm lg:col-span-2 ${state.status==="error"?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-800"}`}>{state.message}</p>}
  <button disabled={pending||!categoryId} className="rounded-xl bg-[#173c31] px-5 py-3.5 font-black text-white disabled:cursor-not-allowed disabled:opacity-50 lg:col-span-2">{pending?"Saving…":listing?"Save listing":"Create listing"}</button>
 </form>;
}
