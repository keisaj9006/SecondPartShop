"use client";

import { useEffect } from "react";

export function MobileSellerPaymentReturn({state}:{state:"returned"|"refresh"}){
 const target=`secondpart://seller-payments?state=${encodeURIComponent(state)}`;

 useEffect(()=>{
  const timer=window.setTimeout(()=>{window.location.href=target;},250);
  return()=>window.clearTimeout(timer);
 },[target]);

 return <a href={target} className="mt-4 inline-block text-sm font-black underline">
  Return to SecondPart app
 </a>;
}
