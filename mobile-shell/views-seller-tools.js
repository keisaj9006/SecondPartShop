(()=>{
"use strict";
const UI=window.SecondPartUI;
const C=UI.C;

const requireSeller=async(route)=>{
 if(!await UI.requireAuth(route))return false;
 if(!C.state.me)await C.loadMe();
 if(!C.state.me?.seller){UI.empty("□","Seller profile required","Enable selling before using seller tools.","Account",()=>UI.route("account"));return false;}
 return true;
};

const donorSummary=item=>[item.make&&item.model?item.make+" "+item.model:null,item.year,item.variant,item.engineSizeSimple?item.engineSizeSimple+"cc":null,item.fuelType,item.colour].filter(Boolean).join(" · ");

const sellerDonors=async()=>{
 if(!await requireSeller("sellerDonors"))return;
 UI.loading("Loading donor vehicles");
 let items=[];
 try{items=(await C.api("/seller/donors",{auth:true})).items||[];}
 catch(error){UI.empty("▱","Donor vehicles unavailable",error.message,"Try again",()=>UI.route("sellerDonors"));return;}

 const html=[];
 html.push("<button class=\"back\" id=\"seller-donors-back\" type=\"button\">‹ Back to seller account</button>");
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Seller inventory</p><h2>Donor vehicles</h2><p>Add a source vehicle once, then reuse it across parts removed from the same car.</p></div></div>");
 html.push("<section class=\"card\"><p class=\"eyebrow\">Add donor vehicle</p><form id=\"donor-manager-form\" class=\"form-grid\" style=\"margin-top:10px\"><label class=\"label\">Registration <span class=\"subtle\">(optional)</span><div class=\"search-row\"><input id=\"dm-reg\" class=\"input registration\" maxlength=\"10\"><button id=\"dm-lookup\" class=\"secondary\" type=\"button\">Look up</button></div></label><div id=\"dm-lookup-status\"></div><div class=\"spec-grid\"><label class=\"label\">Make<input id=\"dm-make\" class=\"input\" maxlength=\"80\" required></label><label class=\"label\">Model<input id=\"dm-model\" class=\"input\" maxlength=\"120\" required></label><label class=\"label\">Variant <span class=\"subtle\">(optional)</span><input id=\"dm-variant\" class=\"input\" maxlength=\"160\"></label><label class=\"label\">Year<input id=\"dm-year\" class=\"input\" type=\"number\" min=\"1900\" max=\"2100\" required></label><label class=\"label\">Engine cc <span class=\"subtle\">(optional)</span><input id=\"dm-engine\" class=\"input\" type=\"number\" min=\"100\" max=\"10000\"></label><label class=\"label\">Fuel <span class=\"subtle\">(optional)</span><input id=\"dm-fuel\" class=\"input\" maxlength=\"80\"></label><label class=\"label\">Colour <span class=\"subtle\">(optional)</span><input id=\"dm-colour\" class=\"input\" maxlength=\"80\"></label></div><label class=\"label\">Private seller notes <span class=\"subtle\">(optional)</span><textarea id=\"dm-notes\" class=\"textarea\" maxlength=\"1000\" placeholder=\"Internal notes about the donor vehicle.\"></textarea></label><div id=\"dm-status\"></div><button id=\"dm-save\" class=\"primary wide\" type=\"submit\">Save donor vehicle</button></form></section>");
 if(items.length)html.push("<section style=\"margin-top:16px\"><p class=\"eyebrow\">Saved donor vehicles</p>"+items.map(item=>"<article class=\"order-card\" style=\"margin-top:10px\"><div class=\"row-between\"><div>"+(item.registration?"<p class=\"eyebrow\">"+C.escapeHtml(item.registration)+"</p>":"")+"<h3 style=\"margin:3px 0\">"+C.escapeHtml(item.make+" "+item.model)+"</h3><p class=\"subtle\">"+C.escapeHtml(donorSummary(item))+"</p>"+(item.notes?"<p class=\"subtle\" style=\"margin-top:7px\">"+C.escapeHtml(item.notes)+"</p>":"")+"</div><div class=\"button-row\"><button class=\"lime-button small-button\" data-donor-listing=\""+C.escapeHtml(item.id)+"\" type=\"button\">Add part</button><button class=\"danger-button small-button\" data-donor-delete=\""+C.escapeHtml(item.id)+"\" type=\"button\">Delete</button></div></div></article>").join("")+"</section>");
 else html.push("<div class=\"empty\" style=\"margin-top:16px\"><div class=\"empty-icon\">▱</div><h3>No donor vehicles yet</h3><p>Add the first donor vehicle to speed up listing multiple parts from the same car.</p></div>");
 UI.app.innerHTML=html.join("");
 document.getElementById("seller-donors-back").addEventListener("click",()=>{C.state.accountMode="selling";UI.route("account",{view:"selling"});});

 const lookupStatus=document.getElementById("dm-lookup-status");
 document.getElementById("dm-lookup").addEventListener("click",async()=>{
  const registration=String(document.getElementById("dm-reg").value||"").trim();
  if(!registration){lookupStatus.innerHTML="<div class=\"status warning\">Enter a registration first.</div>";return;}
  lookupStatus.innerHTML="<div class=\"status info\">Looking up vehicle…</div>";
  try{
   const result=await C.api("/vehicle-lookup",{method:"POST",body:{registration},auth:false});
   const vehicle=result.vehicle||{};
   document.getElementById("dm-reg").value=result.registration||registration;
   document.getElementById("dm-make").value=vehicle.make||"";
   document.getElementById("dm-model").value=vehicle.model||"";
   document.getElementById("dm-year").value=vehicle.year||"";
   document.getElementById("dm-engine").value=vehicle.engineSizeSimple||"";
   document.getElementById("dm-fuel").value=vehicle.fuelType||"";
   document.getElementById("dm-colour").value=vehicle.colour||"";
   lookupStatus.innerHTML="<div class=\"status success\">Vehicle found. Review the details before saving.</div>";
  }catch(error){lookupStatus.innerHTML="<div class=\"status warning\">"+C.escapeHtml(error.message)+" You can enter the donor manually.</div>";}
 });

 document.getElementById("donor-manager-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const button=document.getElementById("dm-save"),status=document.getElementById("dm-status");
  const body={registration:String(document.getElementById("dm-reg").value||"").trim(),make:String(document.getElementById("dm-make").value||"").trim(),model:String(document.getElementById("dm-model").value||"").trim(),variant:String(document.getElementById("dm-variant").value||"").trim(),year:Number(document.getElementById("dm-year").value),engineSizeSimple:document.getElementById("dm-engine").value?Number(document.getElementById("dm-engine").value):null,fuelType:String(document.getElementById("dm-fuel").value||"").trim(),colour:String(document.getElementById("dm-colour").value||"").trim(),notes:String(document.getElementById("dm-notes").value||"").trim()};
  button.disabled=true;button.textContent="Saving…";
  try{await C.api("/seller/donors",{method:"POST",auth:true,body});C.invalidateCache("/seller/donors");UI.toast("Donor vehicle saved.");UI.route("sellerDonors");}
  catch(error){status.innerHTML="<div class=\"status error\">"+C.escapeHtml(error.message.replaceAll("_"," "))+"</div>";button.disabled=false;button.textContent="Save donor vehicle";}
 });
 UI.app.querySelectorAll("[data-donor-listing]").forEach(button=>button.addEventListener("click",()=>UI.route("listingEditor",{donorId:button.dataset.donorListing})));
 UI.app.querySelectorAll("[data-donor-delete]").forEach(button=>button.addEventListener("click",async()=>{button.disabled=true;try{await C.api("/seller/donors?id="+encodeURIComponent(button.dataset.donorDelete),{method:"DELETE",auth:true});C.invalidateCache("/seller/donors");UI.toast("Donor vehicle deleted.");UI.route("sellerDonors");}catch(error){UI.toast(error.message,"error");button.disabled=false;}}));
};

const sellerRequests=async()=>{
 if(!await requireSeller("sellerRequests"))return;
 UI.loading("Loading matched buyer requests");
 let items=[];
 try{items=(await C.api("/seller/requests?limit=24",{auth:true})).items||[];}
 catch(error){UI.empty("⌕","Buyer requests unavailable",error.message,"Try again",()=>UI.route("sellerRequests"));return;}
 const vehicle=item=>[item.vehicleMake&&item.vehicleModel?item.vehicleMake+" "+item.vehicleModel:null,item.year,item.vehicleVariant,item.engineSizeSimple?item.engineSizeSimple+"cc":null,item.fuelType].filter(Boolean).join(" · ");
 const matchLabel=item=>Number(item.matchScore)>=100?"Strong match":Number(item.matchScore)>=60?"Good match":"Relevant match";
 UI.app.innerHTML="<button class=\"back\" id=\"seller-requests-back\" type=\"button\">‹ Back to seller account</button><div class=\"section-head\"><div><p class=\"eyebrow\">Buyer demand</p><h2>Matched part requests</h2><p>SecondPart routes only relevant demand based on inventory, donor vehicles and fitment evidence.</p></div></div>"+(items.length?"<section>"+items.map(item=>"<article class=\"order-card\" style=\"margin-top:10px\"><div><div class=\"chips\">"+(item.categoryName?"<span class=\"chip\">"+C.escapeHtml(item.categoryName)+"</span>":"")+"<span class=\"pill warning\">Open request</span><span class=\"chip green\">"+C.escapeHtml(matchLabel(item))+"</span></div><h3 style=\"margin:8px 0 0\">"+C.escapeHtml(item.queryText)+"</h3>"+(item.oemNumber?"<p class=\"subtle\">OE/OEM: <strong>"+C.escapeHtml(item.oemNumber)+"</strong></p>":"")+(vehicle(item)?"<p class=\"subtle\">"+C.escapeHtml(vehicle(item))+"</p>":"")+(item.notes?"<p class=\"subtle\" style=\"margin-top:8px\">"+C.escapeHtml(item.notes)+"</p>":"")+(Array.isArray(item.matchReasons)&&item.matchReasons.length?"<div class=\"status info\" style=\"margin-top:10px\"><strong>Why this matched</strong><br>"+C.escapeHtml(item.matchReasons.join(" · "))+"</div>":"")+"<p class=\"subtle\">Requested "+C.dateOnly(item.createdAt)+"</p><div class=\"button-row\" style=\"margin-top:10px\"><button class=\"primary small-button\" data-request-listing=\""+C.escapeHtml(item.id)+"\" type=\"button\">Create matching listing</button><button class=\"secondary small-button\" data-request-dismiss=\""+C.escapeHtml(item.id)+"\" type=\"button\">Not relevant · Dismiss</button></div></div></article>").join("")+"</section>":"<div class=\"empty\"><div class=\"empty-icon\">⌕</div><h3>No matched buyer requests</h3><p>New demand will appear here when SecondPart finds a relevant match for your inventory or donor vehicles.</p></div>");
 document.getElementById("seller-requests-back").addEventListener("click",()=>{C.state.accountMode="selling";UI.route("account",{view:"selling"});});
 UI.app.querySelectorAll("[data-request-listing]").forEach(button=>button.addEventListener("click",()=>{const item=items.find(value=>value.id===button.dataset.requestListing);if(item)UI.route("listingEditor",{requestLead:item});}));
 UI.app.querySelectorAll("[data-request-dismiss]").forEach(button=>button.addEventListener("click",async()=>{
  button.disabled=true;
  try{
   await C.api("/seller/requests",{method:"PATCH",auth:true,body:{requestId:button.dataset.requestDismiss,action:"dismiss"}});
   UI.toast("Request dismissed.");
   UI.route("sellerRequests");
  }catch(error){UI.toast(error.message,"error");button.disabled=false;}
 }));
};

UI.register("sellerDonors",sellerDonors);
UI.register("sellerRequests",sellerRequests);
})();