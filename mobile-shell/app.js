(()=>{
"use strict";

const UI=window.SecondPartUI;
const C=UI.C;
let nativeListenersBound=false;

const marketplacePrefetchPath=()=>{
 const params=new URLSearchParams();
 const remembered=C.state.marketplaceParams&&typeof C.state.marketplaceParams==="object"?C.state.marketplaceParams:{};
 ["category","condition","sort","min","max","pc","collection"].forEach(key=>{
  const value=remembered[key];
  if(value!==undefined&&value!==null&&String(value)!=="")params.set(key,String(value));
 });
 if(C.state.currentSearch)params.set("q",C.state.currentSearch);
 const vehicle=C.state.activeVehicle;
 if(vehicle){
  if(vehicle.variantId)params.set("cv",vehicle.variantId);
  if(vehicle.year)params.set("cy",String(vehicle.year));
  if(vehicle.fuelType)params.set("cf",vehicle.fuelType);
  if(vehicle.engineSizeSimple!==null&&vehicle.engineSizeSimple!==undefined)params.set("ce",String(vehicle.engineSizeSimple));
  params.set("fit",C.state.vehicleCompatibleOnly?"1":"0");
 }
 params.set("limit","60");
 return "/marketplace?"+params.toString();
};

const prefetchPrimaryNavigation=()=>{
 C.prefetch(marketplacePrefetchPath(),{auth:false,maxAge:20000});
 C.prefetch("/categories",{auth:false,maxAge:10*60*1000});
 C.prefetch("/vehicle-catalogue?level=makes",{auth:false,maxAge:10*60*1000});
 if(C.state.session){
  C.prefetch("/garage",{auth:true,maxAge:60000});
  C.prefetch("/orders?limit=20&offset=0",{auth:true,maxAge:20000});
  C.prefetch("/inbox",{auth:true,maxAge:15000});
  C.prefetch("/notifications",{auth:true,maxAge:20000});
 }
};

document.querySelectorAll("[data-nav]").forEach(button=>{
 button.addEventListener("click",()=>UI.route(button.dataset.nav));
});

document.getElementById("brand-button").addEventListener("click",()=>UI.route("home"));
document.getElementById("saved-button").addEventListener("click",async()=>{
 if(!await UI.requireAuth("saved"))return;
 UI.route("saved");
});
document.getElementById("notifications-button").addEventListener("click",async()=>{
 if(!await UI.requireAuth("notifications"))return;
 UI.route("notifications");
});

const refreshActiveScreen=async()=>{
 await C.initializeSession();
 if(C.state.session){
  await C.loadMe();
  await UI.refreshUserChrome();
 }
 prefetchPrimaryNavigation();
 if(["orders","order","inbox","conversation","transactionChat","seller","sellerSales","inventory","notifications","saved","savedSearches","recentlyViewed","requests","sellerRequests","sellerDonors","garage","fittingRequests","garagePartner","garagePartnerRequests","fittingChat"].includes(C.state.currentView)){
  await UI.refreshCurrent();
 }
};

const trustedWebOrigin=()=>{
 try{return new URL(C.config.webBaseUrl).origin;}catch{return "";}
};
const isTrustedHttpsReturn=(url,path)=>url.protocol==="https:"&&url.origin===trustedWebOrigin()&&url.pathname===path;

const handleCheckoutDeepLink=async(rawUrl)=>{
 try{
  const url=new URL(rawUrl);
  const custom=url.protocol==="secondpart:"&&url.hostname==="checkout";
  const verifiedHttps=isTrustedHttpsReturn(url,"/checkout/mobile-complete");
  if(!custom&&!verifiedHttps)return false;

  const state=url.searchParams.get("state")==="cancelled"?"cancelled":"success";
  const orderId=url.searchParams.get("order");
  await C.Native.closeBrowser();
  await C.initializeSession();

  if(!C.state.session){
   C.state.afterAuth="orders";
   UI.toast("Sign in to view your checkout.");
   await UI.route("account",{mode:"signin"});
   return true;
  }

  if(state==="cancelled"&&orderId){
   try{
    await C.api("/orders/"+encodeURIComponent(orderId)+"/checkout",{method:"DELETE",auth:true});
   }catch(error){
    if(error&&error.code!=="checkout_not_cancellable")console.warn("Could not release cancelled checkout",error);
   }
  }

  await C.loadMe();
  await UI.refreshUserChrome();

  if(orderId){
   await UI.route("order",{id:orderId});
   if(state==="success"){
    UI.toast("Payment submitted. Confirming the order securely…");
    window.setTimeout(()=>{void UI.refreshCurrent();},1600);
    window.setTimeout(()=>{void UI.refreshCurrent();},4200);
   }else{
    UI.toast("Checkout cancelled. The reservation has been released.");
   }
  }else{
   await UI.route("orders");
  }
  return true;
 }catch(error){
  console.error("Deep-link handling failed",error);
  return false;
 }
};

const handleSellerPaymentDeepLink=async(rawUrl)=>{
 try{
  const url=new URL(rawUrl);
  const custom=url.protocol==="secondpart:"&&url.hostname==="seller-payments";
  const verifiedHttps=isTrustedHttpsReturn(url,"/seller/payments/mobile-complete");
  if(!custom&&!verifiedHttps)return false;

  await C.Native.closeBrowser();
  await C.initializeSession();
  if(!C.state.session){
   C.state.afterAuth="seller";
   C.state.accountMode="selling";
   UI.toast("Sign in to continue seller payment setup.");
   await UI.route("account",{mode:"signin"});
   return true;
  }

  let complete=false;
  try{
   const result=await C.api("/seller/payments/refresh",{method:"POST",auth:true});
   complete=Boolean(result.complete);
  }catch(error){
   console.warn("Could not refresh seller payment status",error);
  }

  await C.loadMe();
  C.state.accountMode="selling";
  await UI.refreshUserChrome();
  await UI.route("seller");
  UI.toast(complete?"Payments & payouts are ready.":"Stripe status refreshed. Complete any remaining payout requirements.");
  return true;
 }catch(error){
  console.error("Seller payment deep-link handling failed",error);
  return false;
 }
};

const handleDeepLink=async(rawUrl)=>{
 if(await handleCheckoutDeepLink(rawUrl))return true;
 if(await handleSellerPaymentDeepLink(rawUrl))return true;
 return false;
};

const bindNativeListeners=async()=>{
 if(nativeListenersBound)return;
 nativeListenersBound=true;

 await C.Native.onUrlOpen(url=>{void handleDeepLink(url);});
 await C.Native.onBackButton(()=>{
  void (async()=>{
   const handled=await UI.back();
   if(!handled)await C.Native.minimizeApp();
  })();
 });
 await C.Native.onAppState(active=>{
  if(active)void refreshActiveScreen();
 });
};

document.addEventListener("visibilitychange",()=>{
 if(document.visibilityState==="visible"&&!C.Native.isNative)void refreshActiveScreen();
});

window.addEventListener("online",()=>UI.toast("Back online."));
window.addEventListener("offline",()=>UI.toast("You are offline. Some marketplace features need a connection.","warning"));

const boot=async()=>{
 try{
  await C.initializeSession();

  // Health is diagnostic, not a reason to block first paint. The marketplace
  // request itself will surface a real connectivity problem if one exists.
  void C.api("/health").catch(error=>console.warn("Health check unavailable",error));

  if(C.state.session){
   const restoreGarage=async()=>{
    if(C.state.activeVehicle)return;
    try{
     const garage=(await C.apiCached("/garage",{auth:true,maxAge:60000})).items||[];
     if(garage.length===1){
      const item=garage[0];
      C.setActiveVehicle({
       variantId:item.catalogueVariantId,
       year:item.year,
       fuelType:item.fuelType,
       engineSizeSimple:item.engineSizeSimple,
       make:item.make,
       modelFamily:item.modelFamily,
       variant:item.variant,
       registration:item.registration,
       colour:item.colour
      },{compatibleOnly:true});
     }
    }catch(error){console.warn("Could not restore Garage vehicle",error);}
   };

   // These used to run serially. Running them together cuts startup wait to
   // the slowest request rather than the sum of /me, chrome and Garage.
   await Promise.all([
    C.loadMe(),
    UI.refreshUserChrome(),
    restoreGarage()
   ]);

  }else{
   await UI.refreshUserChrome();
  }

  prefetchPrimaryNavigation();
  await bindNativeListeners();

  const launchUrl=await C.Native.getLaunchUrl();
  if(launchUrl&&await handleDeepLink(launchUrl))return;

  await UI.route("home");
 }catch(error){
  UI.empty("⌁","SecondPart could not start",error.message,"Try again",boot);
 }
};

boot();
})();
