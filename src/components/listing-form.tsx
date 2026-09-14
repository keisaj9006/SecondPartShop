"use client";

import { useActionState,useMemo,useRef,useState } from "react";
import { createListing,updateListing } from "@/app/dashboard/actions";
import { buildCategoryTree,getCategoryAncestors,type CategoryNode } from "@/lib/category-tree";
import { SellerCompatibilityEditor } from "@/components/seller-compatibility-editor";
import { OptimizedImageInput } from "@/components/optimized-image-input";
import { ListingAiAssistant } from "@/components/listing-ai-assistant";
import type { ListingActionState,CatalogueFitmentSelection,Category,DonorVehicle,Listing } from "@/lib/types";

const initial:ListingActionState={status:"idle"};
const selectableDescendants=(node:CategoryNode|null)=>{
 if(!node)return [];
 const result:Category[]=[];
 const visit=(item:CategoryNode)=>{if(item.isSelectable)result.push(item);for(const child of item.children)visit(child);};
 visit(node);
 return result;
};
const RequiredMark=()=> <><span aria-hidden="true" className="ml-1 text-red-700">*</span><span className="sr-only"> required</span></>;

export function ListingForm({categories,donors,defaultDonorId,defaultTitle,defaultCategoryId,defaultRequestId,initialCatalogueFitments=[],listing,sellerCheckoutReady=true}:{categories:Category[];donors:DonorVehicle[];defaultDonorId?:string;defaultTitle?:string;defaultCategoryId?:string;defaultRequestId?:string;initialCatalogueFitments?:CatalogueFitmentSelection[];listing?:Listing;sellerCheckoutReady?:boolean}){
 const handler=listing?updateListing:createListing;
 const [state,action,pending]=useActionState(handler,initial);
 const recovery=state.recovery;
 const recoveryHref=recovery?.partId&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recovery.partId)?`/dashboard/listings/${recovery.partId}/edit`:"/dashboard";
 const [optimizingImages,setOptimizingImages]=useState(false);
 const formRef=useRef<HTMLFormElement>(null);
 const actionResetPending=useRef(false);
 const [title,setTitle]=useState(listing?.title??defaultTitle??"");
 const [description,setDescription]=useState(listing?.description??"");
 const initialDonorId=listing?.donorVehicleId??defaultDonorId??"";
 const [donorId,setDonorId]=useState(initialDonorId);
 const [donorOptions,setDonorOptions]=useState(donors);
 const [donorSearch,setDonorSearch]=useState("");
 const [donorLoading,setDonorLoading]=useState(false);
 const [donorError,setDonorError]=useState("");
 const tree=useMemo(()=>buildCategoryTree(categories),[categories]);
 const initialCategoryId=listing?.categoryId??defaultCategoryId??"";
 const initialPath=useMemo(()=>initialCategoryId?getCategoryAncestors(categories,initialCategoryId):[],[categories,initialCategoryId]);
 const [departmentId,setDepartmentId]=useState(initialPath[0]?.id??"");
 const [groupId,setGroupId]=useState(initialPath[1]?.id??"");
 const [categoryId,setCategoryId]=useState(initialCategoryId);
 const department=tree.find(item=>item.id===departmentId)??null;
 const groups=department?.children??[];
 const group=groups.find(item=>item.id===groupId)??null;
 const partTypes=selectableDescendants(group);
 const selectedCategory=categories.find(category=>category.id===categoryId);
 const selectedDonor=donorOptions.find(donor=>donor.id===donorId)??donors.find(donor=>donor.id===donorId);
 const donorSummary=selectedDonor?[selectedDonor.registration,selectedDonor.make+" "+selectedDonor.model,selectedDonor.year,selectedDonor.variant,selectedDonor.engineSizeSimple?selectedDonor.engineSizeSimple+"cc":null,selectedDonor.fuelType].filter(Boolean).join(" · "):"";
 const input="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]";
 const activeAllowed=sellerCheckoutReady||listing?.status==="active";

 const selectDepartment=(value:string)=>{setDepartmentId(value);setGroupId("");setCategoryId("");};
 const selectGroup=(value:string)=>{
  setGroupId(value);
  const next=groups.find(item=>item.id===value)??null;
  const options=selectableDescendants(next);
  setCategoryId(options.length===1&&options[0].id===value?value:"");
 };

 const searchDonors=async()=>{
  const query=donorSearch.trim();
  if(query.length<2){
   setDonorOptions(donors);
   setDonorError(query?"Enter at least 2 characters to search donor vehicles.":"");
   return;
  }
  setDonorLoading(true);
  setDonorError("");
  try{
   const response=await fetch("/api/seller/donors?q="+encodeURIComponent(query)+"&limit=30",{cache:"no-store"});
   const payload=await response.json() as {items?:DonorVehicle[];message?:string};
   if(!response.ok)throw new Error(payload.message??"Donor vehicles are temporarily unavailable.");
   const selected=donors.find(donor=>donor.id===donorId);
   const next=payload.items??[];
   setDonorOptions(selected&&!next.some(donor=>donor.id===selected.id)?[selected,...next]:next);
  }catch(error){
   setDonorError(error instanceof Error?error.message:"Donor vehicles are temporarily unavailable.");
  }finally{
   setDonorLoading(false);
  }
 };

 return <form
  ref={formRef}
  action={action}
  onSubmitCapture={event=>{if(recovery){event.preventDefault();return;}actionResetPending.current=true;}}
  onReset={event=>{
   if(!actionResetPending.current)return;
   actionResetPending.current=false;
   event.preventDefault();
  }}
  className="mt-8 grid gap-5 rounded-3xl border border-black/10 bg-white p-5 sm:p-7 lg:grid-cols-2"
 >
  {listing&&<input type="hidden" name="partId" value={listing.id}/>} {!listing&&defaultRequestId&&<input type="hidden" name="sourceRequestId" value={defaultRequestId}/>}
  <input type="hidden" name="categoryId" value={categoryId}/>
  <p className="text-xs text-[#63706a] lg:col-span-2"><RequiredMark/> Required fields are marked with an asterisk.</p>

  <label className="text-sm font-bold lg:col-span-2">Listing title<RequiredMark/><input required minLength={5} name="title" value={title} onChange={event=>setTitle(event.target.value)} className={input} placeholder="e.g. Golf Mk7 LED headlight"/></label>
  <label className="text-sm font-bold lg:col-span-2">Description<RequiredMark/><textarea required minLength={20} rows={5} name="description" value={description} onChange={event=>setDescription(event.target.value)} className={input} placeholder="Describe the actual condition, what is included, testing if known, and any material damage or wear."/><small className="mt-2 block font-normal leading-5 text-[#63706a]">Give the buyer the important facts once here. Extra identifiers, warranty and delivery settings can be added below.</small></label>
  <ListingAiAssistant formRef={formRef} categoryName={selectedCategory?.name??""} donorSummary={donorSummary} onApplyTitle={setTitle} onApplyDescription={setDescription}/>

  <fieldset className="rounded-2xl border border-black/10 bg-[#f8f7f2] p-4 lg:col-span-2">
   <legend className="px-1 text-sm font-black">Part category</legend>
   <p className="mt-1 text-sm text-[#63706a]">Choose the department, category group and then the specific part type.</p>
   <div className="mt-3 grid gap-3 md:grid-cols-3">
    <label className="text-sm font-bold">Department<RequiredMark/><select value={departmentId} onChange={event=>selectDepartment(event.target.value)} className={input} required><option value="">Choose department</option>{tree.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="text-sm font-bold">Category<RequiredMark/><select value={groupId} onChange={event=>selectGroup(event.target.value)} className={input} disabled={!departmentId} required><option value="">Choose category</option>{groups.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="text-sm font-bold">Part type<RequiredMark/><select value={categoryId} onChange={event=>setCategoryId(event.target.value)} className={input} disabled={!groupId} required><option value="">Choose part type</option>{partTypes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
   </div>
   {selectedCategory&&<p className="mt-3 rounded-xl bg-[#e8eee9] px-3 py-2 text-sm"><strong>Selected:</strong> {initialPath.length&&listing?.categoryId===categoryId?getCategoryAncestors(categories,categoryId).map(item=>item.name).join(" › "):[department?.name,group?.name,selectedCategory.name].filter(Boolean).join(" › ")}</p>}
  </fieldset>

  <fieldset className="grid gap-4 rounded-2xl border border-black/10 bg-[#f8f7f2] p-4 lg:col-span-2 sm:grid-cols-3">
   <div className="sm:col-span-3"><p className="text-sm font-black">Condition & price</p><p className="mt-1 text-xs text-[#63706a]">Only the essentials needed to price and publish the part.</p></div>
   <label className="text-sm font-bold">Condition<RequiredMark/><select required name="condition" defaultValue={listing?.condition??"used"} className={input}><option value="used">Used</option><option value="new">New</option><option value="reconditioned">Remanufactured / professionally refurbished</option></select></label>
   <label className="text-sm font-bold">Price (£)<RequiredMark/><input required min="0" step="0.01" type="number" name="price" defaultValue={listing?listing.pricePence/100:undefined} className={input}/></label>
   <label className="text-sm font-bold">Stock quantity<RequiredMark/><input required min="0" step="1" type="number" name="stock" defaultValue={listing?.stock??1} className={input}/></label>
  </fieldset>

  <fieldset className="rounded-2xl border border-[#173c31]/15 bg-[#f4f7f2] p-4 lg:col-span-2">
   <legend className="px-1 text-sm font-black">Compatibility</legend>
   <p className="mt-1 text-sm leading-6 text-[#63706a]">Add genuine fitment evidence you already have. Do not guess. A donor vehicle is a useful conservative signal; exact fitments and part numbers can make matching stronger.</p>
   <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
    <label className="text-sm font-bold">Search donor vehicles<input value={donorSearch} onChange={event=>setDonorSearch(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();void searchDonors();}}} className={input} placeholder="Registration, make, model or version"/></label>
    <button type="button" onClick={()=>void searchDonors()} disabled={donorLoading} className="min-h-12 rounded-xl border border-[#173c31]/20 bg-white px-4 py-3 text-sm font-black disabled:opacity-50">{donorLoading?"Searching…":donorSearch.trim()?"Search donors":"Show recent"}</button>
   </div>
   {donorError&&<p role="status" className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-800">{donorError}</p>}
   <label className="mt-3 block text-sm font-bold">Donor vehicle<select name="donorVehicleId" value={donorId} onChange={event=>setDonorId(event.target.value)} className={input}><option value="">No donor / new stock / unknown</option>{donorOptions.map(donor=><option key={donor.id} value={donor.id}>{donor.registration?donor.registration+" · ":""}{donor.make} {donor.model} · {donor.year}{donor.engineSizeSimple?" · "+donor.engineSizeSimple+"cc":""}{donor.fuelType?" · "+donor.fuelType:""}</option>)}</select></label>
   <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#63706a]"><span>{donorSearch.trim()?"Search results shown above.":"Showing your most recent donor vehicles."} Use one donor across many listings.</span><a href="/dashboard/donors" className="font-black text-[#173c31] underline">{donors.length?"Manage donor vehicles":"+ Add donor vehicle"}</a></div>
  </fieldset>

  <div className="rounded-2xl border border-[#173c31]/15 bg-[#f4f7f2] p-4 text-sm leading-6 text-[#52605a] lg:col-span-2"><strong className="text-[#173c31]">To publish, add at least one compatibility source:</strong> a donor vehicle, an exact compatible vehicle, an OE/OEM number, or both manufacturer / brand and manufacturer / part number.</div>
  <SellerCompatibilityEditor initialFitments={initialCatalogueFitments}/>

  <label className="text-sm font-bold lg:col-span-2">Real product photos <span className="font-normal text-[#63706a]">(required to publish)</span><OptimizedImageInput name="images" existingCount={listing?.images.length??0} onProcessingChange={setOptimizingImages} className={`${input} file:mr-3 file:rounded-lg file:border-0 file:bg-[#eef1eb] file:px-3 file:py-2 file:font-bold`}/><small className="mt-2 block font-normal leading-5 text-[#63706a]">Real photos of the actual part only. Up to 6 JPG, PNG or WebP files. At least one photo is required to publish an active listing. Show the whole part, labels or OE numbers, connectors and any visible damage.</small></label>

  <details className="rounded-2xl border border-black/10 bg-[#f8f7f2] lg:col-span-2">
   <summary className="cursor-pointer list-none px-4 py-4 font-black marker:hidden">More details (optional)<span className="mt-1 block text-xs font-normal text-[#63706a]">Part numbers, testing, warranty and delivery settings</span></summary>
   <div className="grid gap-4 border-t border-black/10 p-4 sm:grid-cols-2">
    <label className="text-sm font-bold">Testing status<select name="testingStatus" defaultValue={listing?.testingStatus??"not_specified"} className={input}><option value="not_specified">Not specified</option><option value="tested_working">Tested working</option><option value="removed_from_running_vehicle">Removed from running vehicle</option><option value="visually_inspected">Visually inspected only</option><option value="untested">Untested</option></select></label>
    <label className="text-sm font-bold">Warranty<select name="warrantyDays" defaultValue={listing?.warrantyDays??0} className={input}><option value="0">No seller warranty stated</option><option value="30">30 days</option><option value="90">90 days</option><option value="180">6 months</option><option value="365">12 months</option></select></label>
    <label className="text-sm font-bold sm:col-span-2">Damage / visible wear<textarea name="damageNotes" maxLength={500} rows={3} defaultValue={listing?.damageNotes??""} className={input} placeholder="Optional: scratches, cracks, corrosion, broken clips or other visible wear."/></label>
    <label className="text-sm font-bold">OE/OEM number<input name="oemNumber" defaultValue={listing?.oemNumber??""} className={input} placeholder="e.g. 02E 300 062"/></label>
    <label className="text-sm font-bold">Manufacturer / brand<input name="manufacturer" defaultValue={listing?.manufacturer??""} className={input} placeholder="e.g. Bosch, Valeo, Vauxhall"/></label>
    <label className="text-sm font-bold">Manufacturer / part number<input name="partNumber" defaultValue={listing?.partNumber??""} className={input} placeholder="Number printed on the part or packaging"/></label>
    <label className="text-sm font-bold">Dispatch time<select name="dispatchDays" defaultValue={listing?.dispatchDays??2} className={input}><option value="0">Same working day</option><option value="1">1 working day</option><option value="2">2 working days</option><option value="3">3 working days</option><option value="5">5 working days</option></select></label>
    <label className="flex items-center gap-3 rounded-xl bg-white p-3 text-sm font-bold"><input type="checkbox" name="collectionAvailable" defaultChecked={listing?.collectionAvailable??false}/>Local collection available</label>
    <label className="text-sm font-bold">Delivery price (£)<input type="number" min="0" max="10000" step="0.01" name="shippingPrice" defaultValue={listing?listing.shippingPence/100:0} className={input} placeholder="0.00"/></label>
   </div>
  </details>

  <div className="lg:col-span-2">
   {!sellerCheckoutReady&&<div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-black">Payments & payouts setup required before publishing</p><p className="mt-1 leading-6 text-amber-900/80">You can keep building and saving draft inventory now. Complete Stripe Connect before making a new listing active.</p><a href="/dashboard/payments" className="mt-3 inline-block rounded-xl bg-[#173c31] px-4 py-2.5 font-black text-white">Complete payments & payouts</a></div>}
   <label className="text-sm font-bold">Listing status<select name="status" defaultValue={listing?.status==="active"?"active":"draft"} className={input}><option value="draft">Draft</option><option value="active" disabled={!activeAllowed}>Active{!activeAllowed?" · complete payouts first":""}</option></select></label>
  </div>

  {state.message&&<p role="status" className={`rounded-xl p-3 text-sm lg:col-span-2 ${state.status==="error"?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-800"}`}>{state.message}</p>}
  {recovery&&<p className="rounded-xl bg-amber-50 p-3 text-sm lg:col-span-2">Open the saved listing to inspect its current details and add only missing photos. This form cannot be submitted again. <a href={recoveryHref} className="font-bold underline">Open saved listing</a></p>}
  <button disabled={Boolean(recovery)||pending||optimizingImages||!categoryId} className="rounded-xl bg-[#173c31] px-5 py-3.5 font-black text-white disabled:cursor-not-allowed disabled:opacity-50 lg:col-span-2">{optimizingImages?"Optimizing photos…":pending?"Saving…":listing?"Save listing":"Create listing"}</button>
 </form>;
}
