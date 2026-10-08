// Capacitor injects these proxies into the hosted WebView; ordinary browsers have none.
export type NativeListenerHandle={remove:()=>Promise<void>|void};
type PushEvent={value?:string;notification?:{data?:Record<string,unknown>};data?:Record<string,unknown>};
type PushPlugin={
 checkPermissions:()=>Promise<{receive:string}>;
 requestPermissions:()=>Promise<{receive:string}>;
 register:()=>Promise<void>;
 unregister:()=>Promise<void>;
 addListener:(name:string,callback:(event:PushEvent)=>void)=>Promise<NativeListenerHandle>|NativeListenerHandle;
};
type NativeWindow=Window & {Capacitor?:{
 isNativePlatform?:()=>boolean;
 getPlatform?:()=>string;
 Plugins?:{PushNotifications?:PushPlugin;App?:{getInfo?:()=>Promise<{id:string}>}};
}};
export function getNativePush(){
 if(typeof window==="undefined")return null;
 const capacitor=(window as NativeWindow).Capacitor;
 return capacitor?.isNativePlatform?.()&&capacitor.getPlatform?.()==="android"?capacitor.Plugins?.PushNotifications??null:null;
}
export async function nativePushAppId(){
 const id=(await (window as NativeWindow).Capacitor?.Plugins?.App?.getInfo?.())?.id;
 if(id!=="com.secondpart.marketplace"&&id!=="com.secondpart.marketplace.preview")throw new Error("Notifications are unavailable in this app build.");
 return id;
}
export function safePushHref(raw:unknown,origin:string){
 if(typeof raw!=="string")return null;
 const value=raw.trim();
 // Reject disguised network paths and control characters before URL normalization.
 if(!value.startsWith("/")||value.startsWith("//")||/[\\\u0000-\u0020\u007f]/.test(value))return null;
 try{
  const decoded=decodeURIComponent(value);
  if(decoded.startsWith("//")||/[\\\u0000-\u0020\u007f]/.test(decoded))return null;
  const url=new URL(value,origin);
  if(url.origin!==origin||url.pathname.startsWith("//")||new URL(decoded,origin).pathname.startsWith("//"))return null;
  return `${url.pathname}${url.search}${url.hash}`;
 }catch{return null;}
}
export function listenForNativePush(onReceived:()=>void,onAction:(href:string)=>void){
 const push=getNativePush();
 let cancelled=false;
 const handles:NativeListenerHandle[]=[];
 const listen=(name:string,callback:(event:PushEvent)=>void)=>{
  if(!push)return;
  Promise.resolve().then(()=>push.addListener(name,event=>{if(!cancelled)callback(event);})).then(handle=>{
   if(cancelled)void Promise.resolve(handle.remove()).catch(()=>{});else handles.push(handle);
  }).catch(()=>{});
 };
 listen("pushNotificationReceived",()=>onReceived());
 listen("pushNotificationActionPerformed",event=>{
  const href=safePushHref(event.notification?.data?.href,window.location.origin);
  if(href)onAction(href);
 });
 return()=>{cancelled=true;for(const handle of handles)void Promise.resolve(handle.remove()).catch(()=>{});};
}
export async function registerNativePush(requestPermission:boolean){
 const push=getNativePush();
 if(!push)throw new Error("Notifications are available in the Android app.");
 if(typeof navigator==="undefined"||!navigator.locks)throw new Error("Please update Android System WebView to enable device notifications.");
 let {receive}=await push.checkPermissions();
 if(requestPermission&&(receive==="prompt"||receive==="prompt-with-rationale"))({receive}=await push.requestPermissions());
 if(receive!=="granted")throw new Error("Allow notifications in Android settings, then try Enable again.");
 return new Promise<string>((resolve,reject)=>{
  let settled=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const handles:NativeListenerHandle[]=[];
  const finish=(token?:string)=>{
   if(settled)return;
   settled=true;
   if(timer)clearTimeout(timer);
   for(const handle of handles)void Promise.resolve(handle.remove()).catch(()=>{});
   if(token&&token.length>=20&&token.length<=4096)resolve(token);
   else reject(new Error("Could not register notifications. Try again."));
  };
  void (async()=>{
   try{
    const add=async(name:string,callback:(event:PushEvent)=>void)=>{
     const handle=await push.addListener(name,callback);
     if(settled)void Promise.resolve(handle.remove()).catch(()=>{});else handles.push(handle);
    };
    await add("registration",event=>finish(event.value));
    if(settled)return;
    await add("registrationError",()=>finish());
    if(settled)return;
    timer=setTimeout(()=>finish(),15000);
    await push.register();
   }catch{finish();}
  })();
 });
}

const pendingPushWork=new Set<Promise<unknown>>();
let accountChanges=0;
const withPushLock=<T>(work:()=>Promise<T>)=>{
 if(typeof navigator!=="undefined"&&navigator.locks)return navigator.locks.request("secondpart-native-push",work);
 return work();
};
export async function runNativePushWork<T>(work:()=>Promise<T>):Promise<T>{
 if(accountChanges>0)throw new Error("Signing out. Sign in again to manage notifications.");
 const promise=withPushLock(work);
 pendingPushWork.add(promise);
 try{return await promise;}finally{pendingPushWork.delete(promise);}
}
export async function coordinateNativeAccountChange<T>(changeAccount:()=>Promise<T>):Promise<T>{
 if(!getNativePush())return changeAccount();
 accountChanges+=1;
 const priorWork=[...pendingPushWork];
 try{
  // Reserve logout in the cross-tab queue before any await permits another registration.
  return await withPushLock(async()=>{
   await Promise.allSettled(priorWork);
   return changeAccount();
  });
 }finally{accountChanges-=1;}
}
export async function signOutAfterNativePushWork(signOut:()=>Promise<void>){
 await coordinateNativeAccountChange(signOut);
}
