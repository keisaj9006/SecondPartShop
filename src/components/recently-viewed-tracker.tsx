"use client";

import { useEffect } from "react";

export function RecentlyViewedTracker({partId}:{partId:string}){
 useEffect(()=>{
  const controller=new AbortController();
  void fetch("/api/recently-viewed",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({partId}),signal:controller.signal,keepalive:true}).catch(()=>{});
  return()=>controller.abort();
 },[partId]);
 return null;
}
