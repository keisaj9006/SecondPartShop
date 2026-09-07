"use client";

import { useRef,useState } from "react";

type Props={
 name:string;
 existingCount?:number;
 className?:string;
 onProcessingChange?:(processing:boolean)=>void;
};

const MAX_SOURCE_BYTES=15*1024*1024;
const MAX_EDGE=1800;
const QUALITY=0.82;

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

 if(typeof createImageBitmap!=="function")return file;
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
  const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/webp",QUALITY));
  if(!blob||blob.size>=file.size)return file;
  return new File([blob],optimizedName(file.name),{type:"image/webp",lastModified:file.lastModified});
 }finally{
  bitmap.close();
 }
}

export function OptimizedImageInput({name,existingCount=0,className,onProcessingChange}:Props){
 const ref=useRef<HTMLInputElement>(null);
 const [processing,setProcessing]=useState(false);
 const [message,setMessage]=useState<string|null>(null);
 const [error,setError]=useState<string|null>(null);

 const handleChange=async()=>{
  const input=ref.current;
  if(!input)return;
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
   for(const file of files)optimized.push(await optimizeImage(file));

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
   input.value="";
   setError(caught instanceof Error?caught.message:"The selected photos could not be prepared.");
  }finally{
   setProcessing(false);
   onProcessingChange?.(false);
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
