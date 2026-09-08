"use client";

import {useEffect} from "react";

export function MobileAuthReturn({state}:{state:"confirmed"|"password-updated"}){
 const target="secondpart://auth?state="+encodeURIComponent(state);
 useEffect(()=>{
  const timer=window.setTimeout(()=>{window.location.href=target;},250);
  return()=>window.clearTimeout(timer);
 },[target]);
 return <a href={target} className="mt-5 inline-block text-sm font-black underline">Return to SecondPart app</a>;
}
