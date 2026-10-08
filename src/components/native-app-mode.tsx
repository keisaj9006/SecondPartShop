"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {listenForNativePush} from "@/lib/native-push";

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
  const nativeWindow=window as Window & {Capacitor?:CapacitorLike};
  const capacitor=nativeWindow.Capacitor;
  const native=Boolean(capacitor?.isNativePlatform?.());
  document.documentElement.classList.toggle("native-app",native);
  if(native){
   document.cookie="secondpart_native=1; Path=/; Max-Age=31536000; SameSite=Lax";
  }else{
   document.cookie="secondpart_native=; Path=/; Max-Age=0; SameSite=Lax";
   return()=>document.documentElement.classList.remove("native-app");
  }

  const routeNativeUrl=(rawUrl:string)=>{
   try{
    const url=new URL(rawUrl);
    const custom=url.protocol==="secondpart:";
    const trustedHttps=url.protocol==="https:"&&url.origin===window.location.origin&&!url.username&&!url.password;
    let href:string;
    if((custom&&url.hostname==="auth")||(trustedHttps&&url.pathname==="/auth/mobile-complete")){
     href="/account";
    }else if((custom&&url.hostname==="checkout")||(trustedHttps&&url.pathname==="/checkout/mobile-complete")){
     const order=url.searchParams.get("order");
     href=order?"/account/orders/"+encodeURIComponent(order):"/account/orders";
    }else if((custom&&url.hostname==="seller-payments")||(trustedHttps&&url.pathname==="/seller/payments/mobile-complete")){
     href="/dashboard/payments";
    }else return;
    // Completion links only select a protected route; Auth and payment state stay server-authoritative.
    router.replace(href);
    router.refresh();
   }catch{
    // Ignore malformed external URLs instead of disrupting app startup.
   }
  };

  const app=capacitor?.Plugins?.App;
  const stopPush=listenForNativePush(()=>router.refresh(),href=>router.push(href));
  let appUrlHandle:ListenerHandle|undefined;


  let cancelled=false;

  if(app?.addListener){
   Promise.resolve(app.addListener("appUrlOpen",event=>routeNativeUrl(event.url)))
    .then(result=>{if(cancelled)void result.remove();else appUrlHandle=result;})
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
   if(appUrlHandle)void appUrlHandle.remove();
   stopPush();

  };
 },[router]);

 return null;
}
