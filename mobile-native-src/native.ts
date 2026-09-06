import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Camera,CameraResultType,CameraSource } from "@capacitor/camera";
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

const nativeApi={
 isNative,
 platform:Capacitor.getPlatform(),
 storage,
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
 async pickPhoto(){
  if(!isNative)return null;
  const photo=await Camera.getPhoto({
   quality:82,
   allowEditing:false,
   resultType:CameraResultType.DataUrl,
   source:CameraSource.Prompt,
   saveToGallery:false,
   correctOrientation:true,
   width:2200
  });
  return {
   dataUrl:photo.dataUrl??null,
   format:photo.format,
   saved:false
  };
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
