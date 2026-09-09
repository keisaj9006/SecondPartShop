"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type ListenerHandle={remove:()=>Promise<void>|void};
type AppPluginLike={
 addListener?:(event:"appUrlOpen",callback:(event:{url:string})=>void)=>Promise<ListenerHandle>|ListenerHandle;
 getLaunchUrl?:()=>Promise<{url?:string|null}>;
};
type CapacitorLike={
 isNativePlatform?:()=>boolean;
 Plugins?:{App?:AppPluginLike};
};

export function NativeAppMode(){
 const router=useRouter();

 useEffect(()=>{
  const capacitor=(window as Window & {Capacitor?:CapacitorLike}).Capacitor;
  const native=Boolean(capacitor?.isNativePlatform?.());
  document.documentElement.classList.toggle("native-app",native);
  if(!native)return()=>document.documentElement.classList.remove("native-app");

  const routeNativeUrl=(rawUrl:string)=>{
   try{
    const url=new URL(rawUrl);
    if(url.protocol!=="secondpart:")return;
    if(url.hostname==="auth"){
     router.replace("/account");
     return;
    }
    if(url.hostname==="checkout"){
     const order=url.searchParams.get("order");
     router.replace(order?"/account/orders/"+encodeURIComponent(order):"/account/orders");
     return;
    }
    if(url.hostname==="seller-payments"){
     router.replace("/dashboard/payments");
    }
   }catch{
    // Ignore malformed external URLs instead of disrupting app startup.
   }
  };

  const app=capacitor?.Plugins?.App;
  let handle:ListenerHandle|undefined;
  let cancelled=false;

  if(app?.addListener){
   Promise.resolve(app.addListener("appUrlOpen",event=>routeNativeUrl(event.url)))
    .then(result=>{if(cancelled)void result.remove();else handle=result;})
    .catch(()=>{});
  }

  if(app?.getLaunchUrl){
   void app.getLaunchUrl().then(result=>{
    if(!cancelled&&result.url)routeNativeUrl(result.url);
   }).catch(()=>{});
  }

  return()=>{
   cancelled=true;
   document.documentElement.classList.remove("native-app");
   if(handle)void handle.remove();
  };
 },[router]);

 return null;
}
