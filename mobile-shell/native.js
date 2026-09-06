(()=>{
"use strict";
const nativeApi={
 isNative:false,
 platform:"web",
 storage:{
  async get(key){return localStorage.getItem("secondpart.secure."+key);},
  async set(key,value){localStorage.setItem("secondpart.secure."+key,String(value));},
  async remove(key){localStorage.removeItem("secondpart.secure."+key);}
 },
 async openBrowser(url){window.location.href=url;},
 async closeBrowser(){},
 async minimizeApp(){},
 async getLaunchUrl(){return null;},
 async pickPhoto(){return null;},
 async onUrlOpen(){return {remove:async()=>{}};},
 async onBackButton(){return {remove:async()=>{}};},
 async onAppState(){return {remove:async()=>{}};}
};
window.SecondPartNative=nativeApi;
})();
