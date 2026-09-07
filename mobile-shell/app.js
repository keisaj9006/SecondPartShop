(()=>{
"use strict";

const UI=window.SecondPartUI;
const C=UI.C;
let nativeListenersBound=false;

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
 if(["orders","order","inbox","conversation","transactionChat","seller","sellerSales","inventory","notifications","saved","savedSearches","recentlyViewed","requests","sellerRequests","sellerDonors","garage","fittingRequests","garagePartner","garagePartnerRequests","fittingChat"].includes(C.state.currentView)){
  await UI.refreshCurrent();
 }
};

const handleCheckoutDeepLink=async(rawUrl)=>{
 try{
  const url=new URL(rawUrl);
  if(url.protocol!=="secondpart:"||url.hostname!=="checkout")return false;

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
  if(url.protocol!=="secondpart:"||url.hostname!=="seller-payments")return false;

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
  await C.api("/health");
  if(C.state.session)await C.loadMe();
  await UI.refreshUserChrome();
  if(C.state.session){
   if(!C.state.activeVehicle){
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
   }
   C.prefetch("/garage",{auth:true,maxAge:60000});
   C.prefetch("/notifications",{auth:true,maxAge:20000});
  }
  C.prefetch("/vehicle-catalogue?level=makes",{auth:false,maxAge:10*60*1000});
  C.prefetch("/categories",{auth:false,maxAge:10*60*1000});
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
