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
type NativePushNotification={
 id:string;
 title:string;
 body:string;
 data:Record<string,unknown>;
};
type SecondPartNativeLike={
 push?:{
  onReceived?:(callback:(notification:NativePushNotification)=>void)=>Promise<ListenerHandle>|ListenerHandle;
  onAction?:(callback:(notification:NativePushNotification)=>void)=>Promise<ListenerHandle>|ListenerHandle;
 };
};

const safeInternalHref=(raw:unknown)=>{
 if(typeof raw!=="string")return null;
 const value=raw.trim();
 if(!value.startsWith("/")||value.startsWith("//")||value.includes("\\"))return null;
 try{
  const url=new URL(value,window.location.origin);
  if(url.origin!==window.location.origin)return null;
  return `${url.pathname}${url.search}${url.hash}`;
 }catch{
  return null;
 }
};

export function NativeAppMode(){
 const router=useRouter();

 useEffect(()=>{
  const nativeWindow=window as Window & {Capacitor?:CapacitorLike;SecondPartNative?:SecondPartNativeLike};
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
  const push=nativeWindow.SecondPartNative?.push;
  let appUrlHandle:ListenerHandle|undefined;
  let pushReceivedHandle:ListenerHandle|undefined;
  let pushActionHandle:ListenerHandle|undefined;
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

  if(push?.onReceived){
   Promise.resolve(push.onReceived(()=>{
    if(!cancelled)router.refresh();
   }))
    .then(result=>{if(cancelled)void result.remove();else pushReceivedHandle=result;})
    .catch(()=>{});
  }

  if(push?.onAction){
   Promise.resolve(push.onAction(notification=>{
    if(cancelled)return;
    const href=safeInternalHref(notification.data?.href);
    if(href)router.push(href);
   }))
    .then(result=>{if(cancelled)void result.remove();else pushActionHandle=result;})
    .catch(()=>{});
  }

  return()=>{
   cancelled=true;
   document.documentElement.classList.remove("native-app");
   if(appUrlHandle)void appUrlHandle.remove();
   if(pushReceivedHandle)void pushReceivedHandle.remove();
   if(pushActionHandle)void pushActionHandle.remove();
  };
 },[router]);

 return null;
}
