"use client";

import { useEffect,useRef,useState } from "react";

type Props={
 name:string;
 existingCount?:number;
 className?:string;
 onProcessingChange?:(processing:boolean)=>void;
};

const MAX_SOURCE_BYTES=15*1024*1024;
const MAX_EDGE=1800;
const QUALITY=0.82;
const MAX_UPLOAD_BYTES=4.5*1024*1024;

const formatBytes=(bytes:number)=>{
 if(bytes<1024)return bytes+" B";
 if(bytes<1024*1024)return (bytes/1024).toFixed(0)+" KB";
 return (bytes/(1024*1024)).toFixed(1)+" MB";
};

const optimizedName=(name:string)=>{
 const base=name.replace(/\.[^.]+$/,"").slice(0,120)||"part-photo";
 return base+".webp";
};

async function optimizeImage(file:File):Promise<File>{
 if(file.size>MAX_SOURCE_BYTES)throw new Error(file.name+" is larger than 15 MB.");
 if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error(file.name+" is not a supported JPG, PNG or WebP image.");

 if(typeof createImageBitmap!=="function"){
  if(file.size>5*1024*1024)throw new Error(file.name+" is too large and this browser cannot optimize it. Choose a file under 5 MB.");
  return file;
 }
 const bitmap=await createImageBitmap(file);
 try{
  const scale=Math.min(1,MAX_EDGE/Math.max(bitmap.width,bitmap.height));
  const width=Math.max(1,Math.round(bitmap.width*scale));
  const height=Math.max(1,Math.round(bitmap.height*scale));
  const canvas=document.createElement("canvas");
  canvas.width=width;
  canvas.height=height;
  const context=canvas.getContext("2d");
  if(!context)return file;
  context.drawImage(bitmap,0,0,width,height);

  let blob:Blob|null=null;
  for(const quality of [QUALITY,0.72,0.62]){
   blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",quality));
   if(blob&&blob.size<=MAX_UPLOAD_BYTES)break;
  }
  if(!blob){
   if(file.size>5*1024*1024)throw new Error(file.name+" could not be compressed below the upload limit.");
   return file;
  }
  if(blob.size>MAX_UPLOAD_BYTES){
   if(file.size<=5*1024*1024)return file;
   throw new Error(file.name+" is still too large after optimization. Try a lower-resolution photo.");
  }
  if(file.size<=5*1024*1024&&blob.size>=file.size)return file;
  return new File([blob],optimizedName(file.name),{type:"image/webp",lastModified:file.lastModified});
 }finally{
  bitmap.close();
 }
}

export function OptimizedImageInput({name,existingCount=0,className,onProcessingChange}:Props){
 const ref=useRef<HTMLInputElement>(null);
 const optimizationGeneration=useRef(0);
 const pendingResetCompletion=useRef<Promise<void>|null>(null);
 const [processing,setProcessing]=useState(false);
 const [message,setMessage]=useState<string|null>(null);
 const [error,setError]=useState<string|null>(null);

 useEffect(()=>{
 const form=ref.current?.form;
 if(!form)return;
  const resetFeedback=(event:Event)=>{
   let completeReset:()=>void=()=>{};
   const completion=new Promise<void>(resolve=>{completeReset=resolve;});
   pendingResetCompletion.current=completion;
   queueMicrotask(()=>{
    if(!event.defaultPrevented){
     optimizationGeneration.current+=1;
     setProcessing(false);
     onProcessingChange?.(false);
     setMessage(null);
     setError(null);
    }
    if(pendingResetCompletion.current===completion)pendingResetCompletion.current=null;
    completeReset();
   });
  };
  form.addEventListener("reset",resetFeedback);
  return ()=>form.removeEventListener("reset",resetFeedback);
 },[onProcessingChange]);

 const handleChange=async()=>{
  const input=ref.current;
  if(!input)return;
  const generation=++optimizationGeneration.current;
  const files=Array.from(input.files??[]);
  setError(null);
  setMessage(null);

  if(files.length+existingCount>6){
   input.value="";
   setError("A listing can have at most 6 product photos including existing images.");
   return;
  }
  if(!files.length)return;

  setProcessing(true);
  onProcessingChange?.(true);
  try{
   const originalBytes=files.reduce((sum,file)=>sum+file.size,0);
   const optimized:File[]=[];
   for(const file of files){
    optimized.push(await optimizeImage(file));
    const resetCompletion=pendingResetCompletion.current;
    if(resetCompletion)await resetCompletion;
    if(generation!==optimizationGeneration.current)return;
   }

   const transfer=new DataTransfer();
   for(const file of optimized)transfer.items.add(file);
   input.files=transfer.files;

   const optimizedBytes=optimized.reduce((sum,file)=>sum+file.size,0);
   const saving=Math.max(0,originalBytes-optimizedBytes);
   setMessage(
    saving>0
     ?optimized.length+" photo"+(optimized.length===1?"":"s")+" optimized: "+formatBytes(originalBytes)+" → "+formatBytes(optimizedBytes)+" ("+formatBytes(saving)+" saved before upload)."
     :optimized.length+" photo"+(optimized.length===1?"":"s")+" ready to upload."
   );
  }catch(caught){
   const resetCompletion=pendingResetCompletion.current;
   if(resetCompletion)await resetCompletion;
   if(generation!==optimizationGeneration.current)return;
   input.value="";
   setError(caught instanceof Error?caught.message:"The selected photos could not be prepared.");
  }finally{
   if(generation===optimizationGeneration.current){
    setProcessing(false);
    onProcessingChange?.(false);
   }
  }
 };

 return <div>
  <input
   ref={ref}
   name={name}
   multiple
   type="file"
   accept="image/jpeg,image/png,image/webp"
   onChange={handleChange}
   disabled={processing}
   className={className}
  />
  {processing&&<p className="mt-2 text-xs font-bold text-[#287154]">Optimizing photos on this device…</p>}
  {message&&<p className="mt-2 text-xs font-bold leading-5 text-emerald-800">{message}</p>}
  {error&&<p role="alert" className="mt-2 text-xs font-bold leading-5 text-red-700">{error}</p>}
 </div>;
}
