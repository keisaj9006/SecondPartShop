"use client";

import { useEffect } from "react";

export function MobileCheckoutReturn({state,orderId}:{state:"success"|"cancelled";orderId:string|null}){
 useEffect(()=>{
  if(!orderId)return;
  const target=`secondpart://checkout?state=${encodeURIComponent(state)}&order=${encodeURIComponent(orderId)}`;
  const timer=window.setTimeout(()=>{window.location.href=target;},250);
  return()=>window.clearTimeout(timer);
 },[state,orderId]);

 if(!orderId)return null;

 return <a
  href={`secondpart://checkout?state=${encodeURIComponent(state)}&order=${encodeURIComponent(orderId)}`}
  className="mt-4 inline-block text-sm font-black underline"
 >Return to SecondPart app</a>;
}
