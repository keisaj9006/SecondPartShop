(()=>{
"use strict";

const UI=window.SecondPartUI;
const C=UI.C;

const garageCard=garage=>"<article class=\"order-card\"><div class=\"row-between\"><div><p class=\"eyebrow\">Buy + Fit garage</p><h3>"+C.escapeHtml(garage.businessName)+"</h3><p class=\"subtle\">"+C.escapeHtml(garage.location)+" · "+C.escapeHtml(garage.postcode)+"</p></div>"+(garage.verified?"<span class=\"pill\">Verified</span>":"")+"</div><p style=\"font-size:11px;line-height:1.6\">"+C.escapeHtml(garage.description)+"</p><div class=\"chips\"><span class=\"chip green\">Customer-supplied parts</span><span class=\"chip green\">Recycled parts</span>"+(garage.mobileFitting?"<span class=\"chip\">Mobile fitting</span>":"")+"</div></article>";

const garages=async(payload={})=>{
 UI.loading("Loading Buy + Fit garages");
 const query=String(payload.query||"").trim();
 const path="/garages?limit=60"+(query?"&q="+encodeURIComponent(query):"");
 let result;
 try{result=await C.apiCached(path,{auth:false,maxAge:60000});}
 catch(error){UI.empty("⌁","Garages unavailable",error.message,"Try again",()=>UI.route("garages",payload));return;}
 const items=result.items||[];
 const html=[];
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Buy + Fit network</p><h2>Garages</h2><p>Approved workshops that accept customer-supplied recycled parts.</p></div></div>");
 html.push("<form id=\"garage-search-form\" class=\"search-row\" style=\"margin-bottom:12px\"><input id=\"garage-search\" class=\"input\" value=\""+C.escapeHtml(query)+"\" placeholder=\"Town, postcode or garage name\"/><button class=\"primary\" type=\"submit\">Search</button></form>");
 html.push("<div class=\"status info\"><strong>Important:</strong> A labour quote does not confirm that a part fits your vehicle. Part purchase and fitting remain separate.</div>");
 if(items.length)html.push(items.map(garageCard).join(""));
 else html.push("<div class=\"empty\"><div class=\"empty-icon\">⌁</div><h3>Garage recruitment is open</h3><p>Approved Buy + Fit partners will appear here.</p></div>");
 html.push("<section class=\"card\" style=\"margin-top:14px\"><p class=\"eyebrow\">Run a workshop?</p><h3 style=\"margin:5px 0\">Join Buy + Fit</h3><p class=\"subtle\">You do not need to become a parts seller.</p><button id=\"garages-join\" class=\"lime-button wide\" type=\"button\">Garage partner profile</button></section>");
 UI.app.innerHTML=html.join("");
 const searchForm=document.getElementById("garage-search-form");
 if(searchForm)searchForm.addEventListener("submit",event=>{
  event.preventDefault();
  const next=String(document.getElementById("garage-search")?.value||"").trim();
  UI.route("garages",next?{query:next}:{});
 });
 document.getElementById("garages-join").addEventListener("click",async()=>{if(!await UI.requireAuth("garagePartner"))return;UI.route("garagePartner");});
};

const fitPart=async(payload={})=>{
 const item=payload.item;
 const query=String(payload.query||"").trim();
 if(!item?.id){UI.route("home");return;}
 const vehicle=C.state.activeVehicle;
 if(!vehicle?.variantId||!vehicle?.year){
  UI.empty("▱","Select a vehicle first","Buy + Fit needs your exact vehicle so the workshop knows what the labour quote is for.","Choose vehicle",()=>UI.route("home",{addVehicle:true}));
  return;
 }
 UI.loading("Loading fitting partners");
 let garagesResult;
 try{garagesResult=await C.apiCached("/garages?limit=60"+(query?"&q="+encodeURIComponent(query):""),{auth:false,maxAge:60000});}
 catch(error){UI.empty("⌁","Garages unavailable",error.message,"Back",()=>UI.back());return;}
 const items=garagesResult.items||[];
 const vehicleLabel=(vehicle.registration?vehicle.registration+" · ":"")+(vehicle.make||"")+" "+(vehicle.modelFamily||"")+" · "+vehicle.year+(vehicle.engineSizeSimple?" · "+vehicle.engineSizeSimple+"cc":"")+(vehicle.fuelType?" · "+vehicle.fuelType:"");
 const html=[];
 html.push("<button class=\"back\" id=\"fit-back\" type=\"button\">‹ Back to part</button>");
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Buy + Fit</p><h2>Request fitting quote</h2><p>"+C.escapeHtml(item.title)+"</p></div></div>");
 html.push("<div class=\"status info\"><strong>"+C.escapeHtml(vehicleLabel)+"</strong><div style=\"margin-top:4px\">Labour quote only. The workshop quote is not a compatibility guarantee and does not buy the part.</div></div>");
 html.push("<form id=\"fit-garage-search-form\" class=\"search-row\" style=\"margin:12px 0\"><input id=\"fit-garage-search\" class=\"input\" value=\""+C.escapeHtml(query)+"\" placeholder=\"Town, postcode or garage name\"/><button class=\"primary\" type=\"submit\">Search</button></form>");
 if(items.length)html.push(items.map(garage=>
  "<article class=\"order-card\"><div class=\"row-between\"><div><h3>"+C.escapeHtml(garage.businessName)+"</h3><p class=\"subtle\">"+C.escapeHtml(garage.location)+" · "+C.escapeHtml(garage.postcode)+"</p></div>"+(garage.verified?"<span class=\"pill\">Verified</span>":"")+"</div><p style=\"font-size:11px;line-height:1.6\">"+C.escapeHtml(garage.description)+"</p><button class=\"primary wide\" style=\"margin-top:10px\" data-fit-garage=\""+C.escapeHtml(garage.id)+"\" type=\"button\">Request labour quote</button></article>"
 ).join(""));
 else html.push("<div class=\"empty\"><div class=\"empty-icon\">⌁</div><h3>No fitting partners yet</h3><p>You can still buy the part without fitting.</p></div>");
 UI.app.innerHTML=html.join("");
 document.getElementById("fit-back").addEventListener("click",()=>UI.back());
 const fitSearch=document.getElementById("fit-garage-search-form");
 if(fitSearch)fitSearch.addEventListener("submit",event=>{
  event.preventDefault();
  const next=String(document.getElementById("fit-garage-search")?.value||"").trim();
  UI.route("fitPart",{item,query:next});
 });
 UI.app.querySelectorAll("[data-fit-garage]").forEach(button=>button.addEventListener("click",async()=>{
  if(!await UI.requireAuth("fitPart"))return;
  const garage=items.find(value=>value.id===button.dataset.fitGarage);
  if(!garage)return;
  UI.modal("Request fitting quote",
   "<p class=\"subtle\">"+C.escapeHtml(garage.businessName)+" · "+C.escapeHtml(vehicleLabel)+"</p>"+
   "<div class=\"status warning\" style=\"margin-top:10px\">The quote is for labour only. Verify part compatibility separately.</div>"+
   "<form id=\"fit-request-form\" class=\"form-grid\" style=\"margin-top:10px\"><label class=\"label\">Note for garage <span class=\"subtle\">(optional)</span><textarea id=\"fit-request-note\" class=\"textarea\" maxlength=\"1000\" placeholder=\"Timing, access or useful fitting context\"></textarea></label><div id=\"fit-request-status\"></div><button id=\"fit-request-submit\" class=\"primary wide\" type=\"submit\">Send quote request</button></form>"
  );
  document.getElementById("fit-request-form").addEventListener("submit",async event=>{
   event.preventDefault();
   const submit=document.getElementById("fit-request-submit"),status=document.getElementById("fit-request-status");
   submit.disabled=true;submit.textContent="Sending…";
   try{
    await C.api("/fitting-requests",{method:"POST",auth:true,body:{
     partId:item.id,garagePartnerId:garage.id,
     vehicle:{
      variantId:vehicle.variantId,year:vehicle.year,fuelType:vehicle.fuelType||null,
      engineSizeSimple:vehicle.engineSizeSimple??null,registration:vehicle.registration||null
     },
     notes:String(document.getElementById("fit-request-note").value||"").trim()
    }});
    UI.closeModal();UI.toast("Fitting quote requested.");UI.route("fittingRequests");
   }catch(error){
    const message=error.code==="duplicate_fitting_request"?"You already have an open request with this garage for this part and vehicle.":error.message;
    status.innerHTML="<div class=\"status error\">"+C.escapeHtml(message)+"</div>";submit.disabled=false;submit.textContent="Send quote request";
   }
  });
 }));
};

const fittingRequests=async()=>{
 if(!await UI.requireAuth("fittingRequests"))return;
 UI.loading("Loading fitting requests");
 let items;
 try{items=(await C.api("/fitting-requests",{auth:true})).items||[];}
 catch(error){UI.empty("⌁","Fitting requests unavailable",error.message,"Try again",()=>UI.route("fittingRequests"));return;}
 const html=[];
 html.push("<button class=\"back\" id=\"fitting-back\" type=\"button\">‹ Back to account</button>");
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Buy + Fit</p><h2>Fitting requests</h2><p>Labour quotes are separate from marketplace part payments.</p></div></div>");
 if(items.length)html.push(items.map(item=>
  "<article class=\"order-card\"><div class=\"row-between\"><div><span class=\"pill\">"+C.escapeHtml(C.human(item.status))+"</span><h3 style=\"margin-top:8px\">"+C.escapeHtml(item.partTitle)+"</h3><p class=\"subtle\">"+C.escapeHtml(item.garageName)+" · "+C.escapeHtml(item.garageLocation)+"</p><p class=\"subtle\">"+C.escapeHtml((item.vehicleRegistration?item.vehicleRegistration+" · ":"")+item.vehicleMake+" "+item.vehicleModel+" · "+item.vehicleYear+(item.vehicleEngineSize?" · "+item.vehicleEngineSize+"cc":"")+(item.vehicleFuel?" · "+item.vehicleFuel:""))+"</p></div>"+(item.quotePence!==null?"<strong style=\"font-size:20px\">"+C.money(item.quotePence)+"<small style=\"display:block;font-size:10px\">labour</small></strong>":"")+"</div>"+(item.quoteNote?"<div class=\"status info\" style=\"margin-top:10px\"><strong>Garage note:</strong> "+C.escapeHtml(item.quoteNote)+"</div>":"")+
  (item.status==="quoted"?"<div class=\"button-row\" style=\"margin-top:10px\"><button class=\"primary small-button\" data-fit-action=\"accept\" data-fit-id=\""+C.escapeHtml(item.id)+"\" type=\"button\">Accept quote</button><button class=\"secondary small-button\" data-fit-action=\"cancel\" data-fit-id=\""+C.escapeHtml(item.id)+"\" type=\"button\">Cancel</button></div>":["requested","accepted"].includes(item.status)?"<button class=\"link-button\" style=\"margin-top:10px\" data-fit-action=\"cancel\" data-fit-id=\""+C.escapeHtml(item.id)+"\" type=\"button\">Cancel request</button>":"")+
  (["accepted","completed"].includes(item.status)?"<div class=\"button-row\" style=\"margin-top:10px\"><button class=\"primary small-button\" data-fit-chat=\""+C.escapeHtml(item.id)+"\" type=\"button\">"+(item.status==="accepted"?"Arrange fitting":"View fitting chat")+"</button></div>":"")+(item.status==="accepted"?"<div class=\"status warning\" style=\"margin-top:10px\">Quote accepted. SecondPart has not taken a labour payment.</div>":"")+"</article>"
 ).join(""));
 else html.push("<div class=\"empty\"><div class=\"empty-icon\">⌁</div><h3>No fitting requests</h3><p>Open a part with an active vehicle and choose Buy + Fit.</p></div>");
 UI.app.innerHTML=html.join("");
 document.getElementById("fitting-back").addEventListener("click",()=>UI.route("account",{view:"buying"}));
 UI.app.querySelectorAll("[data-fit-chat]").forEach(button=>button.addEventListener("click",()=>UI.route("fittingChat",{id:button.dataset.fitChat})));
 UI.app.querySelectorAll("[data-fit-action]").forEach(button=>button.addEventListener("click",async()=>{
  button.disabled=true;
  try{await C.api("/fitting-requests/"+encodeURIComponent(button.dataset.fitId),{method:"PATCH",auth:true,body:{action:button.dataset.fitAction}});UI.toast(button.dataset.fitAction==="accept"?"Fitting quote accepted.":"Fitting request cancelled.");UI.route("fittingRequests");}
  catch(error){UI.toast(error.message,"error");button.disabled=false;}
 }));
};

const garagePartner=async()=>{
 if(!await UI.requireAuth("garagePartner"))return;
 UI.loading("Loading garage partner profile");
 let partner=null;
 try{partner=(await C.api("/garage-partner",{auth:true})).partner||null;}
 catch(error){UI.empty("⌁","Garage profile unavailable",error.message,"Back",()=>UI.back());return;}
 const html=[];
 html.push("<button class=\"back\" id=\"garage-partner-back\" type=\"button\">‹ Back to account</button>");
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Buy + Fit</p><h2>"+(partner?"Garage partner profile":"Join as a garage partner")+"</h2><p>You can offer fitting without becoming a parts seller.</p></div></div>");
 if(partner)html.push("<div class=\"status "+(partner.status==="active"?"success":partner.status==="rejected"?"error":"warning")+"\">Status: <strong>"+C.escapeHtml(C.human(partner.status))+"</strong>"+(partner.verified?" · Verified garage":"")+"</div>");
 html.push("<form id=\"garage-partner-form\" class=\"form-grid\" style=\"margin-top:12px\"><label class=\"label\">Business name<input id=\"gp-name\" class=\"input\" maxlength=\"140\" required value=\""+C.escapeHtml(partner?.businessName||"")+"\"></label><div class=\"spec-grid\"><label class=\"label\">Town / city<input id=\"gp-location\" class=\"input\" maxlength=\"120\" required value=\""+C.escapeHtml(partner?.location||"")+"\"></label><label class=\"label\">Postcode<input id=\"gp-postcode\" class=\"input registration\" maxlength=\"20\" required value=\""+C.escapeHtml(partner?.postcode||"")+"\"></label></div><label class=\"label\">About workshop<textarea id=\"gp-description\" class=\"textarea\" minlength=\"20\" maxlength=\"2000\" required>"+C.escapeHtml(partner?.description||"")+"</textarea></label><label class=\"vehicle-fit-toggle\"><input id=\"gp-customer-parts\" type=\"checkbox\" "+(partner?.customerSuppliedParts!==false?"checked":"")+"><span><strong>Accept customer-supplied parts</strong></span></label><label class=\"vehicle-fit-toggle\"><input id=\"gp-recycled\" type=\"checkbox\" "+(partner?.recycledParts!==false?"checked":"")+"><span><strong>Fit used / recycled parts</strong></span></label><label class=\"vehicle-fit-toggle\"><input id=\"gp-mobile\" type=\"checkbox\" "+(partner?.mobileFitting?"checked":"")+"><span><strong>Mobile fitting may be available</strong></span></label><div class=\"status warning\">Changing garage identity details after approval can trigger a fresh review.</div><div id=\"garage-partner-status\"></div><button id=\"garage-partner-save\" class=\"primary wide\" type=\"submit\">"+(partner?"Save garage profile":"Submit garage application")+"</button></form>");
 if(partner?.status==="active")html.push("<button id=\"garage-partner-requests\" class=\"lime-button wide\" style=\"margin-top:12px\" type=\"button\">Open fitting quote requests</button>");
 UI.app.innerHTML=html.join("");
 document.getElementById("garage-partner-back").addEventListener("click",()=>UI.route("account",{view:"buying"}));
 const requests=document.getElementById("garage-partner-requests");if(requests)requests.addEventListener("click",()=>UI.route("garagePartnerRequests"));
 document.getElementById("garage-partner-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const button=document.getElementById("garage-partner-save"),status=document.getElementById("garage-partner-status");
  button.disabled=true;button.textContent="Saving…";
  try{
   const result=await C.api("/garage-partner",{method:"PUT",auth:true,body:{
    businessName:String(document.getElementById("gp-name").value||"").trim(),
    location:String(document.getElementById("gp-location").value||"").trim(),
    postcode:String(document.getElementById("gp-postcode").value||"").trim(),
    description:String(document.getElementById("gp-description").value||"").trim(),
    customerSuppliedParts:Boolean(document.getElementById("gp-customer-parts").checked),
    recycledParts:Boolean(document.getElementById("gp-recycled").checked),
    mobileFitting:Boolean(document.getElementById("gp-mobile").checked)
   }});
   partner=result.partner;UI.toast("Garage profile saved.");UI.route("garagePartner");
  }catch(error){status.innerHTML="<div class=\"status error\">"+C.escapeHtml(error.message)+"</div>";button.disabled=false;button.textContent=partner?"Save garage profile":"Submit garage application";}
 });
};

const garagePartnerRequests=async()=>{
 if(!await UI.requireAuth("garagePartnerRequests"))return;
 UI.loading("Loading garage fitting requests");
 let result;
 try{result=await C.api("/garage-partner/requests",{auth:true});}
 catch(error){UI.empty("⌁","Garage requests unavailable",error.message,"Back",()=>UI.route("garagePartner"));return;}
 const items=result.items||[];
 const html=[];
 html.push("<button class=\"back\" id=\"garage-requests-back\" type=\"button\">‹ Garage profile</button>");
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Garage partner</p><h2>Fitting quote requests</h2></div></div>");
 if(result.partnerStatus!=="active")html.push("<div class=\"status warning\">Your garage must be active before receiving Buy + Fit requests.</div>");
 else if(items.length)html.push(items.map(item=>
  "<article class=\"order-card\"><div class=\"row-between\"><div><span class=\"pill\">"+C.escapeHtml(C.human(item.status))+"</span><h3 style=\"margin-top:8px\">"+C.escapeHtml(item.partTitle)+"</h3><p class=\"subtle\">"+C.escapeHtml((item.vehicleRegistration?item.vehicleRegistration+" · ":"")+item.vehicleMake+" "+item.vehicleModel+" · "+item.vehicleYear+(item.vehicleEngineSize?" · "+item.vehicleEngineSize+"cc":"")+(item.vehicleFuel?" · "+item.vehicleFuel:""))+"</p></div>"+(item.quotePence!==null?"<strong>"+C.money(item.quotePence)+"</strong>":"")+"</div>"+(item.buyerNotes?"<div class=\"status info\" style=\"margin-top:10px\"><strong>Buyer note:</strong> "+C.escapeHtml(item.buyerNotes)+"</div>":"")+
  (["requested","quoted"].includes(item.status)?"<button class=\"primary wide\" style=\"margin-top:10px\" data-garage-quote=\""+C.escapeHtml(item.id)+"\" type=\"button\">"+(item.status==="quoted"?"Update quote":"Send quote")+"</button><button class=\"link-button\" style=\"margin-top:8px\" data-garage-decline=\""+C.escapeHtml(item.id)+"\" type=\"button\">Decline</button>":item.status==="accepted"?"<div class=\"button-row\" style=\"margin-top:10px\"><button class=\"primary small-button\" data-garage-chat=\""+C.escapeHtml(item.id)+"\" type=\"button\">Arrange fitting</button><button class=\"lime-button small-button\" data-garage-complete=\""+C.escapeHtml(item.id)+"\" type=\"button\">Mark complete</button></div>":item.status==="completed"?"<button class=\"secondary wide\" style=\"margin-top:10px\" data-garage-chat=\""+C.escapeHtml(item.id)+"\" type=\"button\">View fitting chat</button>":"")+"</article>"
 ).join(""));
 else html.push("<div class=\"empty\"><div class=\"empty-icon\">⌁</div><h3>No fitting requests</h3><p>Buyer quote requests will appear here.</p></div>");
 UI.app.innerHTML=html.join("");
 document.getElementById("garage-requests-back").addEventListener("click",()=>UI.route("garagePartner"));
 UI.app.querySelectorAll("[data-garage-chat]").forEach(button=>button.addEventListener("click",()=>UI.route("fittingChat",{id:button.dataset.garageChat})));
 UI.app.querySelectorAll("[data-garage-quote]").forEach(button=>button.addEventListener("click",()=>{
  const item=items.find(value=>value.id===button.dataset.garageQuote);if(!item)return;
  UI.modal("Send labour quote","<form id=\"garage-quote-form\" class=\"form-grid\"><label class=\"label\">Labour quote £<input id=\"garage-quote-price\" class=\"input\" type=\"number\" min=\"0\" max=\"20000\" step=\"0.01\" required value=\""+C.escapeHtml(item.quotePence!==null?item.quotePence/100:"")+"\"></label><label class=\"label\">Quote / booking note<input id=\"garage-quote-note\" class=\"input\" maxlength=\"1000\" value=\""+C.escapeHtml(item.quoteNote||"")+"\" placeholder=\"What is included, estimated time, booking instructions\"></label><div id=\"garage-quote-status\"></div><button id=\"garage-quote-submit\" class=\"primary wide\" type=\"submit\">Send quote</button></form>");
  document.getElementById("garage-quote-form").addEventListener("submit",async event=>{
   event.preventDefault();
   const price=Number(document.getElementById("garage-quote-price").value);
   const status=document.getElementById("garage-quote-status"),submit=document.getElementById("garage-quote-submit");
   if(!Number.isFinite(price)||price<0){status.innerHTML="<div class=\"status warning\">Enter a valid labour price.</div>";return;}
   submit.disabled=true;
   try{await C.api("/garage-partner/requests",{method:"PATCH",auth:true,body:{requestId:item.id,action:"quote",quotePence:Math.round(price*100),note:String(document.getElementById("garage-quote-note").value||"").trim()}});UI.closeModal();UI.toast("Fitting quote sent.");UI.route("garagePartnerRequests");}
   catch(error){status.innerHTML="<div class=\"status error\">"+C.escapeHtml(error.message)+"</div>";submit.disabled=false;}
  });
 }));
 UI.app.querySelectorAll("[data-garage-decline]").forEach(button=>button.addEventListener("click",async()=>{button.disabled=true;try{await C.api("/garage-partner/requests",{method:"PATCH",auth:true,body:{requestId:button.dataset.garageDecline,action:"decline"}});UI.toast("Fitting request declined.");UI.route("garagePartnerRequests");}catch(error){UI.toast(error.message,"error");button.disabled=false;}}));
 UI.app.querySelectorAll("[data-garage-complete]").forEach(button=>button.addEventListener("click",async()=>{button.disabled=true;try{await C.api("/garage-partner/requests",{method:"PATCH",auth:true,body:{requestId:button.dataset.garageComplete,action:"complete"}});UI.toast("Fitting marked complete.");UI.route("garagePartnerRequests");}catch(error){UI.toast(error.message,"error");button.disabled=false;}}));
};


const fittingChat=async(payload={})=>{
 if(!payload.id){UI.route("fittingRequests");return;}
 if(!await UI.requireAuth("fittingChat"))return;
 UI.loading("Loading fitting chat");
 let result;
 try{result=await C.api("/fitting-requests/"+encodeURIComponent(payload.id)+"/messages",{auth:true});}
 catch(error){UI.empty("◫","Fitting chat unavailable",error.message,"Back",()=>UI.back());return;}
 const request=result.request;
 const messages=result.messages||[];
 const html=[];
 html.push("<button class=\"back\" id=\"fitting-chat-back\" type=\"button\">‹ Back to fitting requests</button>");
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Private Buy + Fit chat</p><h2>"+C.escapeHtml(request.partTitle)+"</h2><p>"+C.escapeHtml(request.garageName)+" · "+C.escapeHtml(request.garageLocation)+"</p></div></div>");
 html.push("<div class=\"status info\"><strong>"+C.escapeHtml((request.vehicleRegistration?request.vehicleRegistration+" · ":"")+request.vehicleMake+" "+request.vehicleModel+" · "+request.vehicleYear+(request.vehicleEngineSize?" · "+request.vehicleEngineSize+"cc":"")+(request.vehicleFuel?" · "+request.vehicleFuel:""))+"</strong><div style=\"margin-top:4px\">Use this chat to arrange the appointment. Labour remains separate from the part payment.</div></div>");
 if(request.quoteNote)html.push("<div class=\"status info\" style=\"margin-top:10px\"><strong>Garage quote note:</strong> "+C.escapeHtml(request.quoteNote)+"</div>");
 html.push("<section class=\"card\" style=\"margin-top:12px\"><p class=\"eyebrow\">Messages</p><div id=\"fitting-chat-thread\" style=\"display:grid;gap:8px;margin-top:10px\">"+(messages.length?messages.map(message=>"<div style=\"max-width:88%;padding:10px 12px;border-radius:14px;"+(message.mine?"margin-left:auto;background:#173c31;color:white":"background:#f4f7f2;color:#173c31")+"\"><div style=\"white-space:pre-wrap;font-size:12px;line-height:1.55\">"+C.escapeHtml(message.body)+"</div><small style=\"display:block;margin-top:4px;opacity:.65\">"+C.escapeHtml(message.mine?"You":request.viewerRole==="buyer"?request.garageName:"Buyer")+" · "+C.dateTime(message.createdAt)+"</small></div>").join(""):"<p class=\"subtle\">"+(result.canMessage?"No messages yet. Send the first message to arrange fitting.":"No fitting messages.")+"</p>")+"</div></section>");
 if(result.canMessage)html.push("<form id=\"fitting-chat-form\" class=\"form-grid\" style=\"margin-top:12px\"><label class=\"label\">Message<textarea id=\"fitting-chat-body\" class=\"textarea\" maxlength=\"2000\" required placeholder=\"Suggest a date/time or ask a fitting question\"></textarea></label><div id=\"fitting-chat-status\"></div><button id=\"fitting-chat-send\" class=\"primary wide\" type=\"submit\">Send message</button></form>");
 else if(request.status==="completed")html.push("<div class=\"status success\" style=\"margin-top:12px\">Fitting completed. This chat is now read-only.</div>");
 else html.push("<div class=\"status warning\" style=\"margin-top:12px\">Messages are available after the buyer accepts the labour quote.</div>");
 UI.app.innerHTML=html.join("");
 document.getElementById("fitting-chat-back").addEventListener("click",()=>UI.route(request.viewerRole==="garage"?"garagePartnerRequests":"fittingRequests"));
 const form=document.getElementById("fitting-chat-form");
 if(form)form.addEventListener("submit",async event=>{
  event.preventDefault();
  const body=String(document.getElementById("fitting-chat-body").value||"").trim();
  const status=document.getElementById("fitting-chat-status"),button=document.getElementById("fitting-chat-send");
  if(!body){status.innerHTML="<div class=\"status warning\">Write a message first.</div>";return;}
  button.disabled=true;button.textContent="Sending…";
  try{await C.api("/fitting-requests/"+encodeURIComponent(payload.id)+"/messages",{method:"POST",auth:true,body:{body}});UI.route("fittingChat",{id:payload.id});}
  catch(error){status.innerHTML="<div class=\"status error\">"+C.escapeHtml(error.message)+"</div>";button.disabled=false;button.textContent="Send message";}
 });
};

UI.register("garages",garages);
UI.register("fitPart",fitPart);
UI.register("fittingRequests",fittingRequests);
UI.register("garagePartner",garagePartner);
UI.register("garagePartnerRequests",garagePartnerRequests);
UI.register("fittingChat",fittingChat);
})();
