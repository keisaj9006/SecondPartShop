"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-monitoring";

export default function GlobalError({
 error,
 reset
}:{
 error:Error&{digest?:string};
 reset:()=>void;
}){
 useEffect(()=>{
  reportClientError(error,"react_error_boundary");
 },[error]);

 return <main className="mx-auto max-w-2xl px-4 py-20 text-center">
  <h1 className="text-3xl font-black">Something went wrong</h1>
  <p className="mt-3 text-[#63706a]">The marketplace could not complete this request.</p>
  <button onClick={reset} className="mt-6 rounded-xl bg-[#173c31] px-5 py-3 font-bold text-white">Try again</button>
 </main>;
}
