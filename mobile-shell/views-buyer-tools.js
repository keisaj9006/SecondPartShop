(()=>{
"use strict";

const UI=window.SecondPartUI;
const C=UI.C;

const filterKeys=["category","condition","sort","min","max","pc","collection"];

const currentSearchParams=()=>{
 const params={};
 const remembered=C.state.marketplaceParams&&typeof C.state.marketplaceParams==="object"?C.state.marketplaceParams:{};
 filterKeys.forEach(key=>{
  const value=remembered[key];
  if(value!==undefined&&value!==null&&String(value)!=="")params[key]=String(value);
 });
 if(C.state.currentSearch)params.q=String(C.state.currentSearch);
 const vehicle=C.state.activeVehicle;
 if(vehicle){
  if(vehicle.variantId)params.cv=String(vehicle.variantId);
  if(vehicle.year)params.cy=String(vehicle.year);
  if(vehicle.fuelType)params.cf=String(vehicle.fuelType);
  if(vehicle.engineSizeSimple!==undefined&&vehicle.engineSizeSimple!==null)params.ce=String(vehicle.engineSizeSimple);
  params.fit=C.state.vehicleCompatibleOnly?"1":"0";
 }
 return params;
};

const paramsSummary=(params)=>{
 const parts=[];
 if(params.q)parts.push("Search: "+params.q);
 if(params.category)parts.push("Category filter");
 if(params.condition)parts.push(C.human(params.condition));
 if(params.pc)parts.push("Near "+params.pc);
 if(params.collection==="1")parts.push("Collection only");
 if(params.min)parts.push("Min £"+params.min);
 if(params.max)parts.push("Max £"+params.max);
 if(params.cv&&params.cy)parts.push(params.fit==="0"?"Vehicle saved · all parts + fit labels":"Vehicle saved · fit-only");
 return parts.length?parts.join(" · "):"Marketplace filters saved";
};

const restoreVehicle=async(params)=>{
 C.clearActiveVehicle();
 if(!params.cv||!params.cy)return;
 const query=new URLSearchParams({level:"selection",variantId:String(params.cv),year:String(params.cy)});
 if(params.cf)query.set("fuel",String(params.cf));
 if(params.ce)query.set("engine",String(params.ce));
 try{
  const result=await C.api("/vehicle-catalogue?"+query.toString(),{auth:false});
  C.setActiveVehicle(result.item||null,{compatibleOnly:params.fit!=="0"});
 }catch{
  UI.toast("The saved vehicle could not be restored. Running the remaining search filters.","warning");
 }
};

const runSavedSearch=async(item,button)=>{
 if(button){button.disabled=true;button.textContent="Opening…";}
 const params=item&&item.params&&typeof item.params==="object"?item.params:{};
 C.state.currentSearch=String(params.q||"");
 C.state.marketplaceParams={};
 filterKeys.forEach(key=>{
  const value=params[key];
  if(value!==undefined&&value!==null&&String(value)!=="")C.state.marketplaceParams[key]=String(value);
 });
 await restoreVehicle(params);
 UI.route("home");
};

const savedSearches=async(payload)=>{
 if(!await UI.requireAuth("savedSearches"))return;
 UI.loading("Loading saved searches");
 let items=[];
 try{items=(await C.api("/saved-searches",{auth:true})).items||[];}
 catch(error){UI.empty("⌕","Saved searches unavailable",error.message,"Try again",()=>UI.route("savedSearches"));return;}

 const current=currentSearchParams();
 const canSave=Object.keys(current).length>0;
 const vehicle=C.state.activeVehicle;
 const defaultName=C.state.currentSearch||((vehicle&&vehicle.make&&vehicle.modelFamily)?vehicle.make+" "+vehicle.modelFamily+" parts":"My parts search");
 const html=[];
 html.push("<button class=\"back\" id=\"saved-searches-back\" type=\"button\">‹ Back to account</button>");
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Your account</p><h2>Saved searches</h2><p>Jump back into the same part, vehicle and filter combination.</p></div></div>");
 if(canSave){
  html.push("<section class=\"card\"><p class=\"eyebrow\">Current marketplace search</p><p class=\"subtle\">"+C.escapeHtml(paramsSummary(current))+"</p><form id=\"save-search-form\" class=\"form-grid\" style=\"margin-top:12px\"><label class=\"label\">Name this search<input id=\"saved-search-name\" class=\"input\" minlength=\"2\" maxlength=\"80\" required value=\""+C.escapeHtml(defaultName)+"\"></label><div id=\"saved-search-status\"></div><button id=\"saved-search-submit\" class=\"primary wide\" type=\"submit\">Save current search</button></form></section>");
 }else{
  html.push("<section class=\"card flat\"><p class=\"eyebrow\">Save a search</p><p class=\"subtle\">Search for a part or select a vehicle first, then come back here to save that marketplace context.</p><button id=\"saved-search-new\" class=\"secondary small-button\" style=\"margin-top:10px\" type=\"button\">Start a search</button></section>");
 }

 if(items.length){
  html.push("<section style=\"margin-top:16px\"><p class=\"eyebrow\">Saved</p>"+items.map(item=>"<article class=\"order-card\" style=\"margin-top:10px\"><div class=\"row-between\"><div><h3 style=\"margin:0\">"+C.escapeHtml(item.name)+"</h3><p class=\"subtle\" style=\"margin-top:5px\">"+C.escapeHtml(paramsSummary(item.params||{}))+"</p><p class=\"subtle\">Saved "+C.dateOnly(item.createdAt)+"</p></div><div class=\"button-row\"><button class=\"primary small-button\" data-run-saved-search=\""+C.escapeHtml(item.id)+"\" type=\"button\">Run search</button><button class=\"danger-button small-button\" data-delete-saved-search=\""+C.escapeHtml(item.id)+"\" type=\"button\">Delete</button></div></div></article>").join("")+"</section>");
 }else{
  html.push("<div class=\"empty\" style=\"margin-top:16px\"><div class=\"empty-icon\">⌕</div><h3>No saved searches yet</h3><p>Save a vehicle, part or filter combination so you do not have to rebuild it later.</p></div>");
 }

 UI.app.innerHTML=html.join("");
 document.getElementById("saved-searches-back").addEventListener("click",()=>UI.route("account",{view:"buying"}));
 const start=document.getElementById("saved-search-new");if(start)start.addEventListener("click",()=>UI.route("home"));

 const form=document.getElementById("save-search-form");
 if(form)form.addEventListener("submit",async event=>{
  event.preventDefault();
  const name=String(document.getElementById("saved-search-name").value||"").trim();
  const button=document.getElementById("saved-search-submit");
  const status=document.getElementById("saved-search-status");
  button.disabled=true;button.textContent="Saving…";
  try{
   await C.api("/saved-searches",{method:"POST",auth:true,body:{name,params:currentSearchParams()}});
   UI.toast("Search saved.");
   UI.route("savedSearches");
  }catch(error){
   status.innerHTML="<div class=\"status error\">"+C.escapeHtml(error.message.replaceAll("_"," "))+"</div>";
   button.disabled=false;button.textContent="Save current search";
  }
 });

 UI.app.querySelectorAll("[data-run-saved-search]").forEach(button=>button.addEventListener("click",()=>{
  const item=items.find(value=>value.id===button.dataset.runSavedSearch);
  if(item)void runSavedSearch(item,button);
 }));
 UI.app.querySelectorAll("[data-delete-saved-search]").forEach(button=>button.addEventListener("click",async()=>{
  button.disabled=true;
  try{
   await C.api("/saved-searches?id="+encodeURIComponent(button.dataset.deleteSavedSearch),{method:"DELETE",auth:true});
   UI.toast("Saved search deleted.");
   UI.route("savedSearches");
  }catch(error){UI.toast(error.message,"error");button.disabled=false;}
 }));
};

const recentlyViewed=async()=>{
 if(!await UI.requireAuth("recentlyViewed"))return;
 UI.loading("Loading recently viewed");
 let items=[];
 try{items=(await C.api("/recently-viewed",{auth:true})).items||[];}
 catch(error){UI.empty("◫","Recently viewed unavailable",error.message,"Try again",()=>UI.route("recentlyViewed"));return;}

 UI.app.innerHTML="<button class=\"back\" id=\"recently-viewed-back\" type=\"button\">‹ Back to account</button><div class=\"section-head\"><div><p class=\"eyebrow\">Your account</p><h2>Recently viewed</h2><p>"+items.length+" recent listing"+(items.length===1?"":"s")+".</p></div></div>"+(items.length?"<section class=\"list-grid\">"+items.map(UI.listingCard).join("")+"</section>":"<div class=\"empty\"><div class=\"empty-icon\">◫</div><h3>No recently viewed parts yet</h3><p>Parts you open while signed in will appear here automatically.</p><button id=\"recently-viewed-shop\" class=\"primary small-button\" style=\"margin-top:14px\" type=\"button\">Browse parts</button></div>");
 document.getElementById("recently-viewed-back").addEventListener("click",()=>UI.route("account",{view:"buying"}));
 const shop=document.getElementById("recently-viewed-shop");if(shop)shop.addEventListener("click",()=>UI.route("home"));
 UI.bindListingActions(UI.app);
};

const requests=async(payload)=>{
 if(!await UI.requireAuth("requests"))return;
 UI.loading("Loading part requests");
 let items=[];
 try{items=(await C.api("/requests",{auth:true})).items||[];}
 catch(error){UI.empty("⌕","Part requests unavailable",error.message,"Try again",()=>UI.route("requests",payload));return;}

 const vehicle=C.state.activeVehicle;
 const prefill=String(payload&&payload.prefill!==undefined?payload.prefill:C.state.currentSearch||"").trim();
 const html=[];
 html.push("<button class=\"back\" id=\"requests-back\" type=\"button\">‹ Back to account</button>");
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Your account</p><h2>Part requests</h2><p>Save a part you could not find. Open requests can become privacy-safe demand leads for sellers.</p></div></div>");
 html.push("<section class=\"card\"><p class=\"eyebrow\">Request a part</p><h3 style=\"margin:5px 0\">Tell SecondPart what you need</h3><p class=\"subtle\">Your currently selected vehicle is attached automatically when available.</p>"+(vehicle?"<div style=\"margin-top:12px\">"+UI.vehicleVisual(vehicle,false)+"</div>":"<div class=\"status info\" style=\"margin-top:12px\">No vehicle selected. You can still request a part, or return to the marketplace and choose a vehicle first.</div>")+"<form id=\"part-request-form\" class=\"form-grid\" style=\"margin-top:14px\"><label class=\"label\">Part needed<input id=\"request-query\" class=\"input\" minlength=\"3\" maxlength=\"160\" required value=\""+C.escapeHtml(prefill)+"\" placeholder=\"e.g. front right LED headlight\"></label><label class=\"label\">OE/OEM number <span class=\"subtle\">(optional)</span><input id=\"request-oem\" class=\"input\" maxlength=\"80\" placeholder=\"If you know it\"></label><label class=\"label\">Extra details <span class=\"subtle\">(optional)</span><textarea id=\"request-notes\" class=\"textarea\" maxlength=\"1000\" placeholder=\"Side, colour, connectors, markings or anything that helps identify the part.\"></textarea></label><div id=\"part-request-status\"></div><button id=\"part-request-submit\" class=\"primary wide\" type=\"submit\">Save this part request</button></form></section>");

 if(items.length){
  html.push("<section style=\"margin-top:16px\"><p class=\"eyebrow\">Your requests</p>"+items.map(item=>"<article class=\"order-card\" style=\"margin-top:10px\"><div class=\"row-between\"><div><div class=\"chips\"><span class=\"pill "+(item.status==="open"?"warning":"success")+"\">"+C.escapeHtml(C.human(item.status))+"</span>"+(item.categoryName?"<span class=\"chip\">"+C.escapeHtml(item.categoryName)+"</span>":"")+"</div><h3 style=\"margin:8px 0 0\">"+C.escapeHtml(item.queryText)+"</h3>"+(item.oemNumber?"<p class=\"subtle\">OE/OEM: <strong>"+C.escapeHtml(item.oemNumber)+"</strong></p>":"")+(item.vehicleLabel?"<p class=\"subtle\">"+(item.registration?C.escapeHtml(item.registration)+" · ":"")+C.escapeHtml(item.vehicleLabel)+"</p>":"")+(item.notes?"<p class=\"subtle\" style=\"margin-top:8px\">"+C.escapeHtml(item.notes)+"</p>":"")+"<p class=\"subtle\">Created "+C.dateOnly(item.createdAt)+"</p></div><div class=\"button-row\">"+(item.status==="open"?"<button class=\"secondary small-button\" data-close-request=\""+C.escapeHtml(item.id)+"\" type=\"button\">Mark closed</button>":"")+"<button class=\"danger-button small-button\" data-delete-request=\""+C.escapeHtml(item.id)+"\" type=\"button\">Delete</button></div></div></article>").join("")+"</section>");
 }else{
  html.push("<div class=\"empty\" style=\"margin-top:16px\"><div class=\"empty-icon\">⌕</div><h3>No part requests yet</h3><p>When a compatible part is missing, save exactly what you need instead of rebuilding the search later.</p></div>");
 }

 UI.app.innerHTML=html.join("");
 document.getElementById("requests-back").addEventListener("click",()=>UI.route("account",{view:"buying"}));

 document.getElementById("part-request-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const button=document.getElementById("part-request-submit");
  const status=document.getElementById("part-request-status");
  const body={
   queryText:String(document.getElementById("request-query").value||"").trim(),
   oemNumber:String(document.getElementById("request-oem").value||"").trim(),
   notes:String(document.getElementById("request-notes").value||"").trim()
  };
  if(vehicle){
   body.variantId=vehicle.variantId||null;
   body.registration=vehicle.registration||null;
   body.year=vehicle.year||null;
   body.fuelType=vehicle.fuelType||null;
   body.engineSizeSimple=vehicle.engineSizeSimple===undefined?null:vehicle.engineSizeSimple;
  }
  button.disabled=true;button.textContent="Saving…";
  try{
   await C.api("/requests",{method:"POST",auth:true,body});
   UI.toast("Part request saved.");
   UI.route("requests");
  }catch(error){
   status.innerHTML="<div class=\"status error\">"+C.escapeHtml(error.message.replaceAll("_"," "))+"</div>";
   button.disabled=false;button.textContent="Save this part request";
  }
 });

 UI.app.querySelectorAll("[data-close-request]").forEach(button=>button.addEventListener("click",async()=>{
  button.disabled=true;
  try{
   await C.api("/requests",{method:"PATCH",auth:true,body:{id:button.dataset.closeRequest}});
   UI.toast("Request marked closed.");
   UI.route("requests");
  }catch(error){UI.toast(error.message,"error");button.disabled=false;}
 }));

 UI.app.querySelectorAll("[data-delete-request]").forEach(button=>button.addEventListener("click",async()=>{
  button.disabled=true;
  try{
   await C.api("/requests?id="+encodeURIComponent(button.dataset.deleteRequest),{method:"DELETE",auth:true});
   UI.toast("Part request deleted.");
   UI.route("requests");
  }catch(error){UI.toast(error.message,"error");button.disabled=false;}
 }));
};

UI.register("savedSearches",savedSearches);
UI.register("recentlyViewed",recentlyViewed);
UI.register("requests",requests);
})();