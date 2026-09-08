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
let routePending=false;
let loadingTimer=null;
let routeLoader=null;
let routeSequence=0;
let silentRouteRefresh=false;
const screenCache=new Map();
const CACHED_ROOTS=new Set(["home","garage","orders","inbox","account"]);
const cacheContext=()=>String(C.state.me?.profile?.id||"guest");
const isRootCacheable=(route)=>Boolean(route&&CACHED_ROOTS.has(route.name)&&Object.keys(route.payload||{}).length===0);
const cacheKeyForRoute=(route)=>cacheContext()+"::"+routeKey(route);

const stashCurrentScreen=()=>{
 if(!isRootCacheable(currentRoute)||!app.childNodes.length)return;
 const holder=document.createElement("div");
 holder.append(...Array.from(app.childNodes));
 screenCache.set(cacheKeyForRoute(currentRoute),{
  holder,
  scrollY:Math.max(0,window.scrollY||0),
  at:Date.now()
 });
};

const restoreScreen=(route)=>{
 if(!isRootCacheable(route))return false;
 const entry=screenCache.get(cacheKeyForRoute(route));
 if(!entry?.holder?.childNodes.length)return false;
 app.replaceChildren(...Array.from(entry.holder.childNodes));
 requestAnimationFrame(()=>window.scrollTo({top:entry.scrollY||0,behavior:"instant"}));
 return true;
};

const clearScreenCache=(names)=>{
 if(!names){screenCache.clear();return;}
 const allowed=new Set(Array.isArray(names)?names:[names]);
 for(const [key,entry] of screenCache){
  const routeName=key.split("::").slice(1).join("::").split("|")[0];
  if(allowed.has(routeName))screenCache.delete(key);
 }
};

const isCurrent=(name)=>Boolean(currentRoute&&currentRoute.name===name&&C.state.currentView===name);
const isSilentRefresh=()=>Boolean(routePending&&silentRouteRefresh);

const ensureRouteLoader=()=>{
 if(routeLoader&&document.body.contains(routeLoader))return routeLoader;
 routeLoader=document.createElement("div");
 routeLoader.id="route-loader";
 routeLoader.className="route-loader hidden";
 routeLoader.setAttribute("role","status");
 routeLoader.setAttribute("aria-live","polite");
 routeLoader.innerHTML="<span class=\"route-loader-spinner\" aria-hidden=\"true\"></span><span class=\"route-loader-label\">Loading…</span>";
 document.body.appendChild(routeLoader);
 return routeLoader;
};

const showRouteLoading=(label)=>{
 const loader=ensureRouteLoader();
 const text=loader.querySelector(".route-loader-label");
 if(text)text.textContent=String(label||"Loading…");
 if(loadingTimer)clearTimeout(loadingTimer);
 loadingTimer=setTimeout(()=>loader.classList.remove("hidden"),120);
};

const hideRouteLoading=()=>{
 if(loadingTimer){clearTimeout(loadingTimer);loadingTimer=null;}
 if(routeLoader)routeLoader.classList.add("hidden");
};

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
 const previous=currentRoute;
 const sameRoute=Boolean(previous&&routeKey(previous)===routeKey(next));
 if(previous&&!options.fromBack&&!sameRoute)routeStack.push(previous);
 if(previous&&!sameRoute)stashCurrentScreen();
 currentRoute=next;
 const mySequence=++routeSequence;
 C.state.currentView=name;
 syncNavigationMode();
 document.querySelectorAll("[data-nav]").forEach(button=>{
  const active=button.dataset.nav===name
   ||((name==="listing"||name==="member")&&button.dataset.nav==="home")
   ||(name==="order"&&button.dataset.nav==="orders")
   ||(["conversation","transactionChat"].includes(name)&&button.dataset.nav==="inbox")
   ||(name==="listingEditor"&&button.dataset.nav==="inventory")
   ||(["saved","notifications","reviews","cases","profile","security","sellerSetup","sellerProfile","sellerVerification"].includes(name)&&button.dataset.nav==="account");
  button.classList.toggle("active",active);
  if(active)button.setAttribute("aria-current","page");else button.removeAttribute("aria-current");
 });
 if(!registry.has(name)){
  app.innerHTML="<div class=\"empty\"><div class=\"empty-icon\">!</div><h3>Screen unavailable</h3><p>This mobile screen has not been registered.</p></div>";
  return;
 }
 const restored=sameRoute?Boolean(app.childNodes.length):restoreScreen(next);
 if(!restored){
  app.replaceChildren();
  window.scrollTo({top:0,behavior:"instant"});
 }
 routePending=true;
 silentRouteRefresh=restored;
 if(!restored)showRouteLoading("Loading "+String(name||"screen").replaceAll("_"," ")+"…");
 try{
  await registry.get(name)(payload||{});
 }catch(error){
  if(mySequence!==routeSequence)return;
  console.error(error);
  const message=C.escapeHtml(error&&error.message?error.message:"Something went wrong.");
  app.innerHTML="<div class=\"empty\"><div class=\"empty-icon\">!</div><h3>Could not load this screen</h3><p>"+message+"</p><button id=\"retry-screen\" class=\"primary small-button\" type=\"button\">Try again</button></div>";
  const retry=document.getElementById("retry-screen");
  if(retry)retry.addEventListener("click",()=>route(name,payload));
 }finally{
  if(mySequence===routeSequence){
   routePending=false;
   silentRouteRefresh=false;
   hideRouteLoading();
  }
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
 if(routePending&&app.childElementCount){
  if(!silentRouteRefresh)showRouteLoading(label||"Loading…");
  return;
 }
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

const vehiclePaint=(value)=>{
 const key=String(value||"").trim().toLowerCase();
 const colours={
  black:{body:"#202325",shade:"#0f1112",highlight:"#4a4f52"},
  blue:{body:"#2563eb",shade:"#1748aa",highlight:"#60a5fa"},
  brown:{body:"#795548",shade:"#53382f",highlight:"#a57a69"},
  beige:{body:"#d6c7a1",shade:"#aa9b78",highlight:"#eee5cf"},
  cream:{body:"#f3ead3",shade:"#c9bea4",highlight:"#fffaf0"},
  gold:{body:"#c8a64b",shade:"#96782c",highlight:"#ead47f"},
  green:{body:"#2f7d4a",shade:"#1f5a34",highlight:"#66a879"},
  grey:{body:"#6b7280",shade:"#4b515c",highlight:"#9ca3af"},
  gray:{body:"#6b7280",shade:"#4b515c",highlight:"#9ca3af"},
  maroon:{body:"#7f1d1d",shade:"#561313",highlight:"#a94a4a"},
  orange:{body:"#ea580c",shade:"#a83d07",highlight:"#fb923c"},
  pink:{body:"#db6b9a",shade:"#a54970",highlight:"#efa2c0"},
  purple:{body:"#7c3aed",shade:"#5824b4",highlight:"#a78bfa"},
  red:{body:"#dc2626",shade:"#991b1b",highlight:"#f87171"},
  silver:{body:"#a8b0b8",shade:"#747e87",highlight:"#d8dde1"},
  white:{body:"#f8fafc",shade:"#cbd5e1",highlight:"#ffffff"},
  yellow:{body:"#eab308",shade:"#a87e05",highlight:"#fde047"}
 };
 return colours[key]||{body:"#94a3b8",shade:"#64748b",highlight:"#cbd5e1"};
};

const vehicleVisual=(vehicle,compact)=>{
 const registration=vehicle.registration?String(vehicle.registration).toUpperCase():"";
 const paint=vehiclePaint(vehicle.colour);
 const engine=vehicle.engineSizeSimple?vehicle.engineSizeSimple+"cc":"";
 const meta=[vehicle.year,vehicle.variant,engine,vehicle.fuelType,vehicle.colour].filter(Boolean).join(" · ");
 const title=((vehicle.make||"")+" "+(vehicle.modelFamily||vehicle.model||"")).trim();
 const aria=["Representative preview of",vehicle.colour||"",title,vehicle.year||""].filter(Boolean).join(" ");
 const svg=[
  "<svg class=\"vehicle-svg\" viewBox=\"0 0 520 230\" role=\"img\" aria-label=\""+C.escapeHtml(aria)+"\">",
  "<ellipse cx=\"258\" cy=\"190\" rx=\"191\" ry=\"18\" fill=\"rgba(15,23,42,.10)\"/>",
  "<path d=\"M67 148c8-24 22-43 45-55l74-38c15-8 31-12 48-12h75c22 0 42 7 59 21l52 43 42 11c19 5 31 18 34 38l2 17H42l4-10c4-9 11-14 21-15Z\" fill=\""+paint.body+"\" stroke=\"#16211e\" stroke-width=\"4\" stroke-linejoin=\"round\"/>",
  "<path d=\"M202 61 142 99h235l-40-34c-10-8-22-12-36-12h-65c-12 0-24 3-34 8Z\" fill=\"#bfd1d4\" stroke=\"#16211e\" stroke-width=\"3\"/>",
  "<path d=\"M268 53v46M139 101h243\" stroke=\"#16211e\" stroke-width=\"3\" opacity=\".75\"/>",
  "<path d=\"M104 111c-11 7-20 18-26 34M420 115c22 3 38 11 48 24\" stroke=\""+paint.highlight+"\" stroke-width=\"4\" stroke-linecap=\"round\" opacity=\".65\"/>",
  "<path d=\"M57 143h48\" stroke=\"#f8fafc\" stroke-width=\"9\" stroke-linecap=\"round\"/>",
  "<path d=\"M432 143h48\" stroke=\"#f4d44d\" stroke-width=\"9\" stroke-linecap=\"round\"/>",
  "<path d=\"M171 113h38M293 113h38\" stroke=\"#16211e\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\".5\"/>",
  "<path d=\"M109 172c4-30 24-49 53-49s50 19 54 49M350 172c4-30 24-49 53-49s50 19 54 49\" fill=\"none\" stroke=\"#16211e\" stroke-width=\"5\"/>",
  "<circle cx=\"162\" cy=\"171\" r=\"31\" fill=\"#171c1b\"/><circle cx=\"162\" cy=\"171\" r=\"17\" fill=\"#9aa4aa\"/><circle cx=\"162\" cy=\"171\" r=\"6\" fill=\"#dce2e5\"/>",
  "<circle cx=\"403\" cy=\"171\" r=\"31\" fill=\"#171c1b\"/><circle cx=\"403\" cy=\"171\" r=\"17\" fill=\"#9aa4aa\"/><circle cx=\"403\" cy=\"171\" r=\"6\" fill=\"#dce2e5\"/>",
  registration?"<g><rect x=\"238\" y=\"148\" width=\"72\" height=\"19\" rx=\"3\" fill=\"#f6df3e\" stroke=\"#17221f\" stroke-width=\"1.5\"/><text x=\"274\" y=\"161.5\" text-anchor=\"middle\" font-size=\"9\" font-family=\"monospace\" font-weight=\"800\" fill=\"#111\">"+C.escapeHtml(registration.slice(0,8))+"</text></g>":"",
  "</svg>"
 ].join("");
 return "<div class=\"vehicle-card"+(compact?" flat":"")+"\"><div class=\"vehicle-preview-head\"><span class=\"eyebrow\">Vehicle preview</span><div class=\"vehicle-preview-tags\">"+(vehicle.colour?"<span class=\"vehicle-colour-chip\"><i style=\"background:"+paint.body+"\"></i>"+C.escapeHtml(vehicle.colour)+"</span>":"")+(registration?"<span class=\"vehicle-reg-chip\">"+C.escapeHtml(registration)+"</span>":"")+"</div></div><div class=\"vehicle-visual\">"+svg+"</div><div class=\"vehicle-info\"><h3>"+C.escapeHtml(title)+"</h3><p>"+C.escapeHtml(meta)+"</p>"+(!compact?"<small class=\"vehicle-disclaimer\">Representative visual for confirmation only. Body shape, trim and wheels may differ from the exact vehicle.</small>":"")+"</div></div>";
};

const bindListingActions=(container)=>{
 (container||app).querySelectorAll("[data-open-listing]").forEach(button=>button.addEventListener("click",()=>route("listing",{slug:button.dataset.openListing})));
 (container||app).querySelectorAll("[data-save-part]").forEach(button=>button.addEventListener("click",async()=>{
  if(!await requireAuth("home"))return;
  button.disabled=true;
  try{
   const result=await C.api("/saved",{method:"POST",body:{partId:button.dataset.savePart},auth:true});
   C.invalidateCache("/saved");
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
 clearScreenCache,isCurrent,isSilentRefresh,listingCard,vehicleVisual,bindListingActions,firstImage
});
})();
