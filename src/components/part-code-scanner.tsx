"use client";

import { useRef,useState } from "react";
import { Camera,ScanLine,Search } from "lucide-react";
import { useRouter } from "next/navigation";

type BarcodeResult={rawValue:string};
type Detector={detect:(source:ImageBitmap)=>Promise<BarcodeResult[]>};
type DetectorConstructor=new(options?:{formats?:string[]})=>Detector;

export function PartCodeScanner(){
 const router=useRouter();
 const inputRef=useRef<HTMLInputElement>(null);
 const [code,setCode]=useState("");
 const [message,setMessage]=useState("");
 const [scanning,setScanning]=useState(false);

 const search=()=>{
  const value=code.trim();
  if(!value)return;
  const params=new URLSearchParams(window.location.search);
  params.set("q",value);
  params.delete("category");
  router.push(`/?${params.toString()}#marketplace`);
 };

 const readPhoto=async(file:File)=>{
  setScanning(true);
  setMessage("Scanning label…");
  try{
   const DetectorApi=(window as typeof window&{BarcodeDetector?:DetectorConstructor}).BarcodeDetector;
   if(!DetectorApi){
    setMessage("Automatic barcode scanning is not supported in this browser. You can still type the code below.");
    return;
   }
   const bitmap=await createImageBitmap(file);
   const detector=new DetectorApi({formats:["code_128","code_39","ean_13","ean_8","qr_code","data_matrix","itf","upc_a","upc_e","codabar"]});
   const results=await detector.detect(bitmap);
   bitmap.close();
   const found=results.map(item=>item.rawValue.trim()).find(Boolean);
   if(found){
    setCode(found);
    setMessage("Code found. Check it, then search the marketplace.");
   }else{
    setMessage("No readable barcode or QR code was found. Try a sharper photo or enter the printed part number manually.");
   }
  }catch{
   setMessage("This photo could not be scanned. Try another image or enter the part number manually.");
  }finally{
   setScanning(false);
   if(inputRef.current)inputRef.current.value="";
  }
 };

 return <details className="mt-3 rounded-2xl border border-black/10 bg-[#f8f7f2] p-3">
  <summary className="cursor-pointer list-none text-sm font-black"><span className="inline-flex items-center gap-2"><ScanLine size={17}/>Scan a part label or barcode</span></summary>
  <div className="mt-3">
   <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={event=>{const file=event.target.files?.[0];if(file)void readPhoto(file);}}/>
   <div className="flex flex-col gap-2 sm:flex-row">
    <button type="button" disabled={scanning} onClick={()=>inputRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/15 bg-white px-4 py-3 text-sm font-black disabled:opacity-50"><Camera size={16}/>{scanning?"Scanning…":"Take / upload photo"}</button>
    <input value={code} onChange={event=>setCode(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();search();}}} className="min-w-0 flex-1 rounded-xl border border-black/15 bg-white px-4 py-3 font-mono text-sm font-bold outline-none focus:ring-2 focus:ring-[#173c31]" placeholder="Detected or printed part code"/>
    <button type="button" onClick={search} disabled={!code.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#173c31] px-4 py-3 text-sm font-black text-white disabled:opacity-50"><Search size={16}/>Search code</button>
   </div>
   {message&&<p role="status" className="mt-2 text-xs leading-5 text-[#63706a]">{message}</p>}
   <p className="mt-2 text-xs leading-5 text-[#7b847f]">This first version reads barcodes and QR/Data Matrix codes from a photo. It does not claim AI visual identification of an unlabelled part.</p>
  </div>
 </details>;
}
