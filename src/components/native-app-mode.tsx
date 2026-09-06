"use client";

import { useEffect } from "react";

type CapacitorLike={isNativePlatform?:()=>boolean};

export function NativeAppMode(){
 useEffect(()=>{
  const capacitor=(window as Window & {Capacitor?:CapacitorLike}).Capacitor;
  const native=Boolean(capacitor?.isNativePlatform?.());
  document.documentElement.classList.toggle("native-app",native);
  return()=>document.documentElement.classList.remove("native-app");
 },[]);
 return null;
}
