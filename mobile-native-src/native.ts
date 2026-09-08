import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Camera,MediaTypeSelection } from "@capacitor/camera";
import { PushNotifications } from "@capacitor/push-notifications";
import { SecureStorage } from "@aparajita/capacitor-secure-storage";

const prefixReady=SecureStorage.setKeyPrefix("secondpart_").catch(()=>undefined);
const isNative=Capacitor.isNativePlatform();

const storage={
 async get(key:string){
  if(!isNative)return localStorage.getItem("secondpart.secure."+key);
  await prefixReady;
  const value=await SecureStorage.get(key);
  return value===null?null:typeof value==="string"?value:JSON.stringify(value);
 },
 async set(key:string,value:string){
  if(!isNative){localStorage.setItem("secondpart.secure."+key,value);return;}
  await prefixReady;
  await SecureStorage.set(key,value);
 },
 async remove(key:string){
  if(!isNative){localStorage.removeItem("secondpart.secure."+key);return;}
  await prefixReady;
  await SecureStorage.remove(key);
 }
};

const pushSupported=isNative&&Capacitor.getPlatform()==="android";

const push={
 supported:pushSupported,
 async permission(){
  if(!pushSupported)return "unsupported";
  try{return (await PushNotifications.checkPermissions()).receive;}catch{return "unsupported";}
 },
 async register(){
  if(!pushSupported)return {supported:false,granted:false,token:null};
  let permission=await PushNotifications.checkPermissions();
  if(permission.receive==="prompt")permission=await PushNotifications.requestPermissions();
  if(permission.receive!=="granted")return {supported:true,granted:false,token:null};
  return new Promise<{supported:boolean;granted:boolean;token:string|null}>((resolve,reject)=>{
   let settled=false;
   const finish=async(value:{supported:boolean;granted:boolean;token:string|null},error?:Error)=>{
    if(settled)return;
    settled=true;
    clearTimeout(timer);
    try{(await registration).remove();}catch{}
    try{(await registrationError).remove();}catch{}
    if(error)reject(error);else resolve(value);
   };
   const registration=PushNotifications.addListener("registration",token=>void finish({supported:true,granted:true,token:token.value}));
   const registrationError=PushNotifications.addListener("registrationError",error=>void finish({supported:true,granted:true,token:null},new Error(error.error||"Push registration failed.")));
   const timer=setTimeout(()=>void finish({supported:true,granted:true,token:null},new Error("Push registration timed out.")),15000);
   void PushNotifications.register().catch(error=>void finish({supported:true,granted:true,token:null},error instanceof Error?error:new Error("Push registration failed.")));
  });
 },
 async unregister(){
  if(!pushSupported)return;
  try{await PushNotifications.unregister();}catch{}
 },
 onReceived(callback:(notification:{id:string;title:string;body:string;data:Record<string,unknown>})=>void){
  if(!pushSupported)return Promise.resolve({remove:async()=>{}});
  return PushNotifications.addListener("pushNotificationReceived",notification=>callback({
   id:String(notification.id||""),
   title:String(notification.title||""),
   body:String(notification.body||""),
   data:(notification.data&&typeof notification.data==="object"?notification.data:{}) as Record<string,unknown>
  }));
 },
 onAction(callback:(notification:{id:string;title:string;body:string;data:Record<string,unknown>})=>void){
  if(!pushSupported)return Promise.resolve({remove:async()=>{}});
  return PushNotifications.addListener("pushNotificationActionPerformed",event=>{
   const notification=event.notification;
   callback({
    id:String(notification.id||""),
    title:String(notification.title||""),
    body:String(notification.body||""),
    data:(notification.data&&typeof notification.data==="object"?notification.data:{}) as Record<string,unknown>
   });
  });
 }
};

const nativeApi={
 isNative,
 platform:Capacitor.getPlatform(),
 storage,
 push,
 async openBrowser(url:string){
  if(!isNative){window.location.href=url;return;}
  await Browser.open({url,presentationStyle:"popover"});
 },
 async closeBrowser(){
  if(!isNative)return;
  try{await Browser.close();}catch{}
 },
 async minimizeApp(){
  if(!isNative)return;
  try{await App.minimizeApp();}catch{}
 },
 async getLaunchUrl(){
  if(!isNative)return null;
  try{return (await App.getLaunchUrl()).url??null;}catch{return null;}
 },
 async takePhoto(){
  if(!isNative)return null;
  const photo=await Camera.takePhoto({
   quality:82,
   includeMetadata:true,
   correctOrientation:true,
   targetWidth:2200,
   targetHeight:2200
  });
  return {
   webPath:photo.webPath,
   format:photo.metadata?.format??"jpeg",
   saved:photo.saved
  };
 },
 async choosePhotos(limit=6){
  if(!isNative)return [];
  const result=await Camera.chooseFromGallery({
   mediaType:MediaTypeSelection.Photo,
   allowMultipleSelection:true,
   limit:Math.max(1,Math.min(limit,6)),
   includeMetadata:true,
   quality:82,
   correctOrientation:true,
   targetWidth:2200,
   targetHeight:2200
  });
  return result.results.map(photo=>({
   webPath:photo.webPath,
   format:photo.metadata?.format??"jpeg",
   saved:photo.saved
  }));
 },
 onUrlOpen(callback:(url:string)=>void){
  if(!isNative)return Promise.resolve({remove:async()=>{}});
  return App.addListener("appUrlOpen",event=>callback(event.url));
 },
 onBackButton(callback:()=>void){
  if(!isNative)return Promise.resolve({remove:async()=>{}});
  return App.addListener("backButton",()=>callback());
 },
 onAppState(callback:(active:boolean)=>void){
  if(!isNative)return Promise.resolve({remove:async()=>{}});
  return App.addListener("appStateChange",state=>callback(state.isActive));
 }
};

declare global{
 interface Window{SecondPartNative:typeof nativeApi}
}
window.SecondPartNative=nativeApi;
