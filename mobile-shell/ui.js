(()=>{
"use strict";

const C=window.SecondPartCore;
const app=document.getElementById("app");
const toastNode=document.getElementById("toast");
const modalRoot=document.getElementById("modal-root");
const notificationBadge=document.getElementById("notification-badge");
const registry=new Map();
let toastTimer=null;
let currentRoute=null;
const routeStack=[];

const routeKey=(route)=>route?route.name+"|"+JSON.stringify(route.payload||{}):"";

const syncNavigationMode=()=>{
 const buttons=[...document.querySelectorAll("#bottom-nav [data-nav]")];
 if(buttons.length<5)return;
 const selling=C.state.accountMode==="selling"&&Boolean(C.state.me?.seller);
 const config=selling
  ?[
    ["seller","⌂","Dashboard"],
    ["inventory","□","Inventory"],
    ["sellerSales","▣","Sales"],
    ["inbox","◫","Inbox"],
    ["account","○","Account"]
   ]
  :[
    ["home","⌂","Home"],
    ["garage","▱","Garage"],
    ["orders","▣","Purchases"],
    ["inbox","◫","Inbox"],
    ["account","○","Account"]
   ];
 buttons.forEach((button,index)=>{
  const item=config[index];
  if(!item)return;
  button.dataset.nav=item[0];
  const icon=button.querySelector(".nav-icon");
  const label=button.querySelector(".nav-icon+span");
  if(icon)icon.textContent=item[1];
  if(label)label.textContent=item[2];
 });
};

const route=async(name,payload,options={})=>{
 const next={name,payload:payload||{}};
 if(currentRoute&&!options.fromBack&&routeKey(currentRoute)!==routeKey(next))routeStack.push(currentRoute);
 currentRoute=next;
 C.state.currentView=name;
 syncNavigationMode();
 document.querySelectorAll("[data-nav]").forEach(button=>{
  const active=button.dataset.nav===name
   ||((name==="listing"||name==="member")&&button.dataset.nav==="home")
   ||(name==="order"&&button.dataset.nav==="orders")
   ||(["conversation","transactionChat"].includes(name)&&button.dataset.nav==="inbox")
   ||(name==="listingEditor"&&button.dataset.nav==="inventory")
   ||(["saved","notifications","cases","sellerSetup","sellerProfile","sellerVerification"].includes(name)&&button.dataset.nav==="account");
  button.classList.toggle("active",active);
 });
 if(!registry.has(name)){
  app.innerHTML="<div class=\"empty\"><div class=\"empty-icon\">!</div><h3>Screen unavailable</h3><p>This mobile screen has not been registered.</p></div>";
  return;
 }
 window.scrollTo({top:0,behavior:"instant"});
 try{await registry.get(name)(payload||{});}
 catch(error){
  console.error(error);
  const message=C.escapeHtml(error&&error.message?error.message:"Something went wrong.");
  app.innerHTML="<div class=\"empty\"><div class=\"empty-icon\">!</div><h3>Could not load this screen</h3><p>"+message+"</p><button id=\"retry-screen\" class=\"primary small-button\" type=\"button\">Try again</button></div>";
  const retry=document.getElementById("retry-screen");
  if(retry)retry.addEventListener("click",()=>route(name,payload));
 }
};

const register=(name,handler)=>registry.set(name,handler);

const back=async()=>{
 if(modalRoot.innerHTML){closeModal();return true;}
 const previous=routeStack.pop();
 if(!previous)return false;
 await route(previous.name,previous.payload,{fromBack:true});
 return true;
};

const refreshCurrent=async()=>{
 if(!currentRoute)return route("home",{}, {fromBack:true});
 return route(currentRoute.name,currentRoute.payload,{fromBack:true});
};

const loading=(label)=>{
 app.innerHTML="<section class=\"boot-screen\"><span class=\"spinner\"></span><h1>"+C.escapeHtml(label||"Loading")+"</h1><p>Please wait a moment…</p></section>";
};

const toast=(message,type)=>{
 if(toastTimer)clearTimeout(toastTimer);
 toastNode.textContent=String(message||"");
 toastNode.className="toast"+(type?" "+type:"");
 toastTimer=setTimeout(()=>toastNode.classList.add("hidden"),3200);
};

const closeModal=()=>{modalRoot.innerHTML="";};

const modal=(title,bodyHtml)=>{
 modalRoot.innerHTML="<div class=\"modal-backdrop\" id=\"modal-backdrop\"><section class=\"modal\"><button class=\"modal-close\" id=\"modal-close\" type=\"button\" aria-label=\"Close\">×</button><h2>"+C.escapeHtml(title)+"</h2>"+bodyHtml+"</section></div>";
 const close=document.getElementById("modal-close");
 const backdrop=document.getElementById("modal-backdrop");
 if(close)close.addEventListener("click",closeModal);
 if(backdrop)backdrop.addEventListener("click",event=>{if(event.target===backdrop)closeModal();});
};

const empty=(icon,title,body,actionLabel,action)=>{
 const id=actionLabel?"empty-action":null;
 app.innerHTML="<div class=\"empty\"><div class=\"empty-icon\">"+C.escapeHtml(icon||"·")+"</div><h3>"+C.escapeHtml(title)+"</h3><p>"+C.escapeHtml(body)+"</p>"+(actionLabel?"<button id=\""+id+"\" class=\"primary small-button\" style=\"margin-top:14px\" type=\"button\">"+C.escapeHtml(actionLabel)+"</button>":"")+"</div>";
 if(id&&action){
  const button=document.getElementById(id);
  if(button)button.addEventListener("click",action);
 }
};

const requireAuth=async(returnView)=>{
 await C.initializeSession();
 if(C.state.session)return true;
 C.state.afterAuth=returnView||C.state.currentView||"home";
 await route("account",{mode:"signin"});
 return false;
};

const updateBadge=()=>{
 const count=Math.max(0,Number(C.state.unreadNotifications||0));
 notificationBadge.textContent=count>99?"99+":String(count);
 notificationBadge.classList.toggle("hidden",count===0);
};

const refreshUserChrome=async()=>{
 await C.initializeSession();
 if(C.state.session){
  await Promise.all([C.refreshSaved(),C.refreshNotifications()]);
 }else{
  C.state.savedIds=new Set();
  C.state.unreadNotifications=0;
 }
 updateBadge();
};

const firstImage=(item)=>{
 const images=Array.isArray(item&&item.images)?item.images:[];
 const url=images.length?C.safeHttpUrl(images[0].url):"";
 return url;
};

const listingCard=(item)=>{
 const image=firstImage(item);
 const saved=C.state.savedIds.has(item.id);
 const compatibility=item.compatibility&&item.compatibility.label?item.compatibility.label:"";
 return "<article class=\"listing-card\">"+
  "<button class=\"listing-image\" type=\"button\" data-open-listing=\""+C.escapeHtml(item.slug)+"\">"+(image?"<img src=\""+C.escapeHtml(image)+"\" alt=\""+C.escapeHtml(item.title)+"\" loading=\"lazy\"/>":"PART")+"</button>"+
  "<div class=\"listing-body\"><span class=\"listing-kicker\">"+C.escapeHtml(item.condition||"Part")+"</span>"+
  "<button type=\"button\" data-open-listing=\""+C.escapeHtml(item.slug)+"\" style=\"border:0;background:transparent;padding:0;text-align:left\"><h3 class=\"listing-title\">"+C.escapeHtml(item.title)+"</h3></button>"+
  "<p class=\"listing-meta\">"+C.escapeHtml(item.seller&&item.seller.businessName?item.seller.businessName:"SecondPart seller")+(compatibility?" · "+C.escapeHtml(compatibility):"")+"</p>"+
  "<div class=\"listing-bottom\"><span class=\"price\">"+C.money(item.pricePence)+"</span><button type=\"button\" class=\"heart"+(saved?" saved":"")+"\" data-save-part=\""+C.escapeHtml(item.id)+"\" aria-label=\"Save part\">"+(saved?"♥":"♡")+"</button></div></div></article>";
};

const carColour=(value)=>{
 const key=String(value||"").toLowerCase();
 const colours={black:"#202325",blue:"#2563eb",brown:"#795548",beige:"#d6c7a1",cream:"#f3ead3",gold:"#c8a64b",green:"#2f7d4a",grey:"#6b7280",gray:"#6b7280",maroon:"#7f1d1d",orange:"#ea580c",pink:"#db6b9a",purple:"#7c3aed",red:"#dc2626",silver:"#a8b0b8",white:"#f8fafc",yellow:"#eab308"};
 return colours[key]||"#7c8a8d";
};

const vehicleVisual=(vehicle,compact)=>{
 const registration=vehicle.registration?String(vehicle.registration).toUpperCase():"";
 const engine=vehicle.engineSizeSimple?vehicle.engineSizeSimple+"cc":"";
 const meta=[vehicle.year,vehicle.variant,engine,vehicle.fuelType,vehicle.colour].filter(Boolean).join(" · ");
 return "<div class=\"vehicle-card"+(compact?" flat":"")+"\"><div class=\"vehicle-visual\"><div class=\"vehicle-car\" style=\"--car:"+carColour(vehicle.colour)+"\"><span class=\"wheel left\"></span><span class=\"wheel right\"></span>"+(registration?"<span class=\"plate\">"+C.escapeHtml(registration.slice(0,8))+"</span>":"")+"</div></div><div class=\"vehicle-info\">"+(registration?"<p class=\"eyebrow\" style=\"margin-bottom:5px\">"+C.escapeHtml(registration)+"</p>":"")+"<h3>"+C.escapeHtml((vehicle.make||"")+" "+(vehicle.modelFamily||vehicle.model||""))+"</h3><p>"+C.escapeHtml(meta)+"</p></div></div>";
};

const bindListingActions=(container)=>{
 (container||app).querySelectorAll("[data-open-listing]").forEach(button=>button.addEventListener("click",()=>route("listing",{slug:button.dataset.openListing})));
 (container||app).querySelectorAll("[data-save-part]").forEach(button=>button.addEventListener("click",async()=>{
  if(!await requireAuth("home"))return;
  button.disabled=true;
  try{
   const result=await C.api("/saved",{method:"POST",body:{partId:button.dataset.savePart},auth:true});
   if(result.saved)C.state.savedIds.add(button.dataset.savePart);else C.state.savedIds.delete(button.dataset.savePart);
   button.classList.toggle("saved",result.saved);
   button.textContent=result.saved?"♥":"♡";
   toast(result.saved?"Saved to your account":"Removed from saved");
  }catch(error){toast(error.message,"error");}
  finally{button.disabled=false;}
 }));
};

window.SecondPartUI=Object.freeze({
 C,app,register,route,back,refreshCurrent,loading,toast,modal,closeModal,empty,requireAuth,updateBadge,refreshUserChrome,
 listingCard,vehicleVisual,bindListingActions,firstImage
});
})();
