(()=>{
"use strict";

const UI=window.SecondPartUI;
const C=UI.C;

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

document.addEventListener("visibilitychange",async()=>{
 if(document.visibilityState!=="visible")return;
 if(C.state.session){
  await C.loadMe();
  await UI.refreshUserChrome();
  if(["orders","order"].includes(C.state.currentView)){
   UI.route(C.state.currentView);
  }
 }
});

window.addEventListener("online",()=>UI.toast("Back online."));
window.addEventListener("offline",()=>UI.toast("You are offline. Some marketplace features need a connection.","warning"));

const boot=async()=>{
 try{
  await C.api("/health");
  if(C.state.session)await C.loadMe();
  await UI.refreshUserChrome();
  await UI.route("home");
 }catch(error){
  UI.empty("⌁","SecondPart could not start",error.message,"Try again",boot);
 }
};

boot();
})();
