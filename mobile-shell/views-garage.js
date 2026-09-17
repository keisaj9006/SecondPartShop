(()=>{
"use strict";

const UI=window.SecondPartUI;
const C=UI.C;

const garage=async()=>{
 if(!await UI.requireAuth("garage"))return;
 UI.loading("Loading Garage");
 let items;
 try{items=(await C.apiCached("/garage",{auth:true,maxAge:60000,staleWhileRevalidate:true})).items||[];}
 catch(error){if(!UI.isCurrent("garage"))return;if(UI.isSilentRefresh()){UI.toast("Could not refresh Garage. Showing the last loaded view.","warning");return;}UI.empty("▱","Garage unavailable",error.message,"Try again",()=>UI.route("garage"));return;}
 if(!UI.isCurrent("garage"))return;

 const html=[];
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Your account</p><h2>SecondPart Garage</h2><p>Saved vehicles for one-tap compatibility searches.</p></div><button id=\"garage-add\" class=\"primary small-button\" type=\"button\">Add vehicle</button></div>");
 if(items.length){
  html.push("<section>"+items.map(item=>{
   const active=Boolean(C.state.activeVehicle&&C.state.activeVehicle.variantId===item.catalogueVariantId&&Number(C.state.activeVehicle.year)===Number(item.year)&&(C.state.activeVehicle.registration||null)===(item.registration||null));
   const fitOnly=active?C.state.vehicleCompatibleOnly!==false:true;
   return "<article data-garage-id=\""+C.escapeHtml(item.id)+"\" class=\""+(active?"selected-vehicle":"")+"\">"+
    UI.vehicleVisual(item,false)+
    "<label class=\"vehicle-fit-toggle"+(fitOnly?" selected":"")+"\" style=\"margin:-2px 0 12px\"><input data-garage-fit class=\"fit-checkbox\" type=\"checkbox\" "+(fitOnly?"checked":"")+" aria-label=\"Show only parts that fit this vehicle\"/><span class=\"vehicle-fit-copy\"><strong>Show only parts that fit this vehicle</strong><small>"+(fitOnly?"Only confirmed or same-family matches will be shown.":"Show the full marketplace and keep compatibility labels visible.")+"</small></span></label>"+
    "<div class=\"button-row\" style=\"margin:-2px 0 14px\"><button class=\"lime-button small-button\" data-use-garage=\""+C.escapeHtml(item.id)+"\" type=\"button\" "+(active?"aria-pressed=\"true\"":"")+">"+(active?"✓ Using this vehicle":"Use this vehicle")+"</button><button class=\"danger-button small-button\" data-remove-garage=\""+C.escapeHtml(item.id)+"\" type=\"button\">Remove</button></div></article>";
  }).join("")+"</section>");
 }else{
  html.push("<div class=\"empty\"><div class=\"empty-icon\">▱</div><h3>Your Garage is empty</h3><p>Add a vehicle by registration or choose it manually from the marketplace.</p></div>");
 }
 UI.app.innerHTML=html.join("");
 const add=document.getElementById("garage-add");
 if(add)add.addEventListener("click",()=>UI.route("home",{addVehicle:true}));
 UI.app.querySelectorAll("[data-garage-fit]").forEach(checkbox=>checkbox.addEventListener("change",event=>{
  const wrapper=event.target.closest(".vehicle-fit-toggle");
  if(wrapper)wrapper.classList.toggle("selected",Boolean(event.target.checked));
 }));
 UI.app.querySelectorAll("[data-use-garage]").forEach(button=>button.addEventListener("click",()=>{
  const item=items.find(vehicle=>vehicle.id===button.dataset.useGarage);
  if(!item)return;
  const fitControl=button.closest("[data-garage-id]")?.querySelector("[data-garage-fit]");
  const compatibleOnly=fitControl?Boolean(fitControl.checked):true;
  button.disabled=true;
  button.textContent="✓ Selected";
  C.setActiveVehicle({
   variantId:item.catalogueVariantId,year:item.year,fuelType:item.fuelType,engineSizeSimple:item.engineSizeSimple,
   make:item.make,modelFamily:item.modelFamily,variant:item.variant,registration:item.registration,colour:item.colour
  },{compatibleOnly});
  UI.route("home");
 }));
 UI.app.querySelectorAll("[data-remove-garage]").forEach(button=>button.addEventListener("click",async()=>{
  button.disabled=true;
  try{
   await C.api("/garage?id="+encodeURIComponent(button.dataset.removeGarage),{method:"DELETE",auth:true});
   C.invalidateCache("/garage");
   UI.toast("Vehicle removed.");
   UI.route("garage");
  }catch(error){UI.toast(error.message,"error");button.disabled=false;}
 }));
};

UI.register("garage",garage);
})();
