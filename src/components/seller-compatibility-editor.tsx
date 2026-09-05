"use client";

import { useEffect,useMemo,useState } from "react";
import { CheckCircle2,Plus,Trash2 } from "lucide-react";
import type { CatalogueFitmentSelection } from "@/lib/types";

type VariantOption={id:string;variant:string};
type EngineOption={fuelType:string;engineSizeSimple:number|null;engineSizeDesc:string|null};

const input="mt-2 w-full rounded-xl border border-black/15 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]";

async function loadItems<T>(params:Record<string,string|number>){
 const search=new URLSearchParams();
 for(const [key,value] of Object.entries(params))search.set(key,String(value));
 const response=await fetch("/api/vehicle-catalogue?"+search.toString(),{cache:"no-store"});
 const payload=await response.json() as {items?:T[];message?:string};
 if(!response.ok)throw new Error(payload.message??"Vehicle catalogue unavailable.");
 return payload.items??[];
}

const engineKey=(fuelType:string,engineSizeSimple:number|null)=>fuelType+"\u001f"+(engineSizeSimple??"");

export function SellerCompatibilityEditor({initialFitments=[]}:{initialFitments?:CatalogueFitmentSelection[]}){
 const [fitments,setFitments]=useState<CatalogueFitmentSelection[]>(initialFitments);
 const [makes,setMakes]=useState<string[]>([]);
 const [models,setModels]=useState<string[]>([]);
 const [years,setYears]=useState<number[]>([]);
 const [variants,setVariants]=useState<VariantOption[]>([]);
 const [engines,setEngines]=useState<EngineOption[]>([]);
 const [make,setMake]=useState("");
 const [model,setModel]=useState("");
 const [year,setYear]=useState("");
 const [variantId,setVariantId]=useState("");
 const [engine,setEngine]=useState("");
 const [notes,setNotes]=useState("");
 const [confirmed,setConfirmed]=useState(false);
 const [loading,setLoading]=useState("");
 const [error,setError]=useState("");

 useEffect(()=>{void (async()=>{
  try{setLoading("makes");setMakes(await loadItems<string>({level:"makes"}));}
  catch(err){setError(err instanceof Error?err.message:"Vehicle catalogue unavailable.");}
  finally{setLoading("");}
 })();},[]);

 const chooseMake=async(value:string)=>{
  setMake(value);setModel("");setYear("");setVariantId("");setEngine("");setModels([]);setYears([]);setVariants([]);setEngines([]);setConfirmed(false);setError("");
  if(!value)return;
  try{setLoading("models");setModels(await loadItems<string>({level:"models",make:value}));}
  catch(err){setError(err instanceof Error?err.message:"Could not load models.");}
  finally{setLoading("");}
 };
 const chooseModel=async(value:string)=>{
  setModel(value);setYear("");setVariantId("");setEngine("");setYears([]);setVariants([]);setEngines([]);setConfirmed(false);setError("");
  if(!value)return;
  try{setLoading("years");setYears(await loadItems<number>({level:"years-model",make,model:value}));}
  catch(err){setError(err instanceof Error?err.message:"Could not load years.");}
  finally{setLoading("");}
 };
 const chooseYear=async(value:string)=>{
  setYear(value);setVariantId("");setEngine("");setVariants([]);setEngines([]);setConfirmed(false);setError("");
  if(!value)return;
  try{setLoading("variants");setVariants(await loadItems<VariantOption>({level:"variants-year",make,model,year:Number(value)}));}
  catch(err){setError(err instanceof Error?err.message:"Could not load versions.");}
  finally{setLoading("");}
 };
 const chooseVariant=async(value:string)=>{
  setVariantId(value);setEngine("");setEngines([]);setConfirmed(false);setError("");
  if(!value)return;
  try{setLoading("engines");setEngines(await loadItems<EngineOption>({level:"engines",variantId:value}));}
  catch(err){setError(err instanceof Error?err.message:"Could not load engines.");}
  finally{setLoading("");}
 };

 const selectedVariant=variants.find(item=>item.id===variantId)??null;
 const selectedEngine=useMemo(()=>engines.find(item=>engineKey(item.fuelType,item.engineSizeSimple)===engine)??null,[engines,engine]);
 const canAdd=Boolean(make&&model&&year&&variantId&&confirmed&&fitments.length<20);

 const addFitment=()=>{
  if(!canAdd||!selectedVariant)return;
  const next:CatalogueFitmentSelection={
   variantId,
   make,
   modelFamily:model,
   variant:selectedVariant.variant,
   year:Number(year),
   fuelType:selectedEngine?.fuelType??null,
   engineSizeSimple:selectedEngine?.engineSizeSimple??null,
   notes:notes.trim()||null
  };
  const duplicate=fitments.some(item=>item.variantId===next.variantId&&item.year===next.year&&(item.fuelType??null)===(next.fuelType??null)&&(item.engineSizeSimple??null)===(next.engineSizeSimple??null));
  if(duplicate){setError("This exact vehicle fitment is already in the list.");return;}
  setFitments(current=>[...current,next]);
  setNotes("");setConfirmed(false);setError("");
 };

 return <fieldset className="rounded-2xl border border-black/10 bg-[#f8f7f2] p-4 lg:col-span-2">
  <legend className="px-1 text-sm font-black">Vehicle compatibility</legend>
  <p className="mt-1 text-sm leading-6 text-[#63706a]">Add only exact vehicle configurations you can support with your own fitment knowledge, OE/OEM information or supplier data. These entries can power <strong>Confirmed for your vehicle</strong> on the buyer side.</p>

  <input type="hidden" name="catalogueFitments" value={JSON.stringify(fitments.map(item=>({variantId:item.variantId,year:item.year,fuelType:item.fuelType,engineSizeSimple:item.engineSizeSimple,notes:item.notes})))}/>

  {fitments.length>0&&<div className="mt-4 grid gap-2">
   {fitments.map((item,index)=><div key={item.id??item.variantId+"-"+item.year+"-"+index} className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
    <div className="flex items-start gap-2"><CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-700"/><div><p className="text-sm font-black">{item.make} {item.modelFamily} · {item.year}</p><p className="mt-1 text-xs leading-5 text-emerald-900/80">{item.variant}{item.engineSizeSimple?" · "+item.engineSizeSimple+"cc":""}{item.fuelType?" · "+item.fuelType:""}</p>{item.notes&&<p className="mt-1 text-xs text-emerald-900/70">{item.notes}</p>}</div></div>
    <button type="button" onClick={()=>setFitments(current=>current.filter((_,itemIndex)=>itemIndex!==index))} aria-label={"Remove "+item.make+" "+item.modelFamily+" fitment"} className="rounded-lg border border-emerald-300 bg-white p-2 text-emerald-900 hover:bg-emerald-100"><Trash2 size={15}/></button>
   </div>)}
  </div>}

  <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
   <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black">Add compatible vehicle</p><p className="mt-1 text-xs text-[#63706a]">{fitments.length}/20 fitments added</p></div></div>
   <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
    <label className="text-sm font-bold">Make<select value={make} onChange={event=>void chooseMake(event.target.value)} className={input} disabled={loading==="makes"}><option value="">{loading==="makes"?"Loading makes…":"Choose make"}</option>{makes.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
    <label className="text-sm font-bold">Model<select value={model} onChange={event=>void chooseModel(event.target.value)} className={input} disabled={!make||loading==="models"}><option value="">{loading==="models"?"Loading models…":"Choose model"}</option>{models.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
    <label className="text-sm font-bold">Year<select value={year} onChange={event=>void chooseYear(event.target.value)} className={input} disabled={!model||loading==="years"}><option value="">{loading==="years"?"Loading years…":"Choose year"}</option>{years.map(item=><option key={item} value={String(item)}>{item}</option>)}</select></label>
    <label className="text-sm font-bold md:col-span-2">Version / derivative<select value={variantId} onChange={event=>void chooseVariant(event.target.value)} className={input} disabled={!year||loading==="variants"}><option value="">{loading==="variants"?"Loading versions…":"Choose exact version"}</option>{variants.map(item=><option key={item.id} value={item.id}>{item.variant}</option>)}</select></label>
    <label className="text-sm font-bold">Engine / fuel<select value={engine} onChange={event=>{setEngine(event.target.value);setConfirmed(false);}} className={input} disabled={!variantId||loading==="engines"}><option value="">{loading==="engines"?"Loading engines…":"Any recorded engine"}</option>{engines.map(item=><option key={engineKey(item.fuelType,item.engineSizeSimple)} value={engineKey(item.fuelType,item.engineSizeSimple)}>{item.engineSizeSimple?item.engineSizeSimple+"cc · ":""}{item.fuelType}</option>)}</select></label>
    <label className="text-sm font-bold md:col-span-2 lg:col-span-3">Fitment notes <span className="font-normal text-[#63706a]">(optional)</span><input value={notes} onChange={event=>setNotes(event.target.value)} maxLength={300} className={input} placeholder="e.g. Confirm OE number before ordering if vehicle has optional lighting pack."/></label>
   </div>

   <label className="mt-4 flex items-start gap-3 rounded-xl bg-[#f8f7f2] p-3 text-sm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} className="mt-1"/><span><strong>I confirm this fitment applies to the exact vehicle configuration selected above.</strong><small className="mt-1 block leading-5 text-[#63706a]">Do not confirm a fitment based only on a similar model name or registration lookup.</small></span></label>
   {error&&<p role="status" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p>}
   <button type="button" onClick={addFitment} disabled={!canAdd} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#173c31] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"><Plus size={16}/>Add compatible vehicle</button>
  </div>
 </fieldset>;
}
