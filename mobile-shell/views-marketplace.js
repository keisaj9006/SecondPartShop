(()=>{
"use strict";

const UI=window.SecondPartUI;
const C=UI.C;
let lastLookup=null;

const activeVehicleQuery=()=>{
 const vehicle=C.state.activeVehicle;
 if(!vehicle)return "";
 const params=new URLSearchParams();
 if(vehicle.variantId)params.set("cv",vehicle.variantId);
 if(vehicle.year)params.set("cy",String(vehicle.year));
 if(vehicle.fuelType)params.set("cf",vehicle.fuelType);
 if(vehicle.engineSizeSimple!==null&&vehicle.engineSizeSimple!==undefined)params.set("ce",String(vehicle.engineSizeSimple));
 return params.toString();
};

const rememberedMarketplaceParams=()=>{
 const source=C.state.marketplaceParams&&typeof C.state.marketplaceParams==="object"?C.state.marketplaceParams:{};
 const result={};
 ["category","condition","sort","min","max","pc","collection"].forEach(key=>{
  const value=source[key];
  if(value!==undefined&&value!==null&&String(value)!=="")result[key]=String(value);
 });
 return result;
};


const marketplaceFilterCount=()=>{
 const params=rememberedMarketplaceParams();
 return Object.keys(params).filter(key=>key!=="sort"||params.sort!=="best").length;
};

const marketplaceCategoryOptions=(categories,selected)=>{
 const byId=new Map(categories.map(item=>[item.id,item]));
 const path=item=>{
  const names=[item.name];
  let parent=item.parentId?byId.get(item.parentId):null;
  let guard=0;
  while(parent&&guard<6){names.unshift(parent.name);parent=parent.parentId?byId.get(parent.parentId):null;guard+=1;}
  return names.join(" › ");
 };
 return categories.filter(item=>item.isSelectable).sort((a,b)=>path(a).localeCompare(path(b))).map(item=>
  "<option value=\""+C.escapeHtml(item.id)+"\" "+(String(item.id)===String(selected||"")?"selected":"")+">"+C.escapeHtml(path(item))+"</option>"
 ).join("");
};

const openMarketplaceFilters=async()=>{
 let categories=[];
 try{categories=(await C.apiCached("/categories",{auth:false,maxAge:10*60*1000})).items||[];}
 catch(error){UI.toast("Categories are temporarily unavailable.","error");return;}
 const current=rememberedMarketplaceParams();
 UI.modal("Filter marketplace",
  "<form id=\"market-filter-form\" class=\"form-grid\">"+
   "<label class=\"label\">Part category<select id=\"mf-category\" class=\"select\"><option value=\"\">All categories</option>"+marketplaceCategoryOptions(categories,current.category)+"</select></label>"+
   "<div class=\"spec-grid\">"+
    "<label class=\"label\">Condition<select id=\"mf-condition\" class=\"select\"><option value=\"\">Any condition</option><option value=\"used\">Used</option><option value=\"new\">New</option><option value=\"reconditioned\">Remanufactured / professionally refurbished</option></select></label>"+
    "<label class=\"label\">Sort<select id=\"mf-sort\" class=\"select\"><option value=\"best\">Best match</option><option value=\"price_asc\">Price: low to high</option><option value=\"price_desc\">Price: high to low</option><option value=\"distance\">Nearest first</option><option value=\"delivery\">Fastest delivery</option><option value=\"warranty\">Longest warranty</option></select></label>"+
   "</div>"+
   "<div class=\"spec-grid\"><label class=\"label\">Minimum price £<input id=\"mf-min\" class=\"input\" type=\"number\" min=\"0\" step=\"1\" value=\""+C.escapeHtml(current.min||"")+"\"></label><label class=\"label\">Maximum price £<input id=\"mf-max\" class=\"input\" type=\"number\" min=\"0\" step=\"1\" value=\""+C.escapeHtml(current.max||"")+"\"></label></div>"+
   "<label class=\"label\">Buyer postcode <span class=\"subtle\">(for distance)</span><input id=\"mf-postcode\" class=\"input registration\" maxlength=\"8\" value=\""+C.escapeHtml(current.pc||"")+"\" placeholder=\"EH25 9BE\"></label>"+
   "<label class=\"card flat\" style=\"display:flex;align-items:center;gap:10px;padding:12px\"><input id=\"mf-collection\" type=\"checkbox\" "+(current.collection==="1"?"checked":"")+" style=\"width:20px;height:20px;accent-color:#173c31\"><span><strong>Collection only</strong><small class=\"subtle\" style=\"display:block\">Only show listings available for local collection.</small></span></label>"+
   "<div id=\"mf-status\"></div><div class=\"button-row\"><button id=\"mf-apply\" class=\"primary\" type=\"submit\">Apply filters</button><button id=\"mf-reset\" class=\"secondary\" type=\"button\">Reset filters</button></div>"+
  "</form>"
 );
 const condition=document.getElementById("mf-condition");condition.value=current.condition||"";
 const sort=document.getElementById("mf-sort");sort.value=current.sort||"best";
 const status=document.getElementById("mf-status");
 document.getElementById("mf-reset").addEventListener("click",()=>{C.state.marketplaceParams={};UI.closeModal();UI.route("home");});
 document.getElementById("market-filter-form").addEventListener("submit",event=>{
  event.preventDefault();
  const min=String(document.getElementById("mf-min").value||"").trim();
  const max=String(document.getElementById("mf-max").value||"").trim();
  if(min&&max&&Number(min)>Number(max)){status.innerHTML="<div class=\"status warning\">Minimum price cannot be higher than maximum price.</div>";return;}
  const rawPostcode=String(document.getElementById("mf-postcode").value||"").toUpperCase().replace(/\s+/g,"").trim();
  if(rawPostcode&&!/^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/.test(rawPostcode)){status.innerHTML="<div class=\"status warning\">Enter a valid full UK postcode or leave it blank.</div>";return;}
  const next={};
  const category=String(document.getElementById("mf-category").value||"");
  const conditionValue=String(condition.value||"");
  const sortValue=String(sort.value||"best");
  if(category)next.category=category;
  if(conditionValue)next.condition=conditionValue;
  if(sortValue&&sortValue!=="best")next.sort=sortValue;
  if(min)next.min=min;
  if(max)next.max=max;
  if(rawPostcode)next.pc=rawPostcode;
  if(document.getElementById("mf-collection").checked)next.collection="1";
  C.state.marketplaceParams=next;
  UI.closeModal();UI.route("home");
 });
};

const marketplacePath=(query)=>{
 const params=new URLSearchParams();
 const remembered=rememberedMarketplaceParams();
 Object.entries(remembered).forEach(([key,value])=>params.set(key,value));
 if(query)params.set("q",query);
 const vehicle=activeVehicleQuery();
 if(vehicle){
  const extra=new URLSearchParams(vehicle);
  extra.forEach((value,key)=>params.set(key,value));
  params.set("fit",C.state.vehicleCompatibleOnly?"1":"0");
 }
 params.set("limit","60");
 return "/marketplace?"+params.toString();
};

const renderVehicleContext=()=>{
 const vehicle=C.state.activeVehicle;
 if(!vehicle)return "<div class=\"status info\">No vehicle selected. Search all parts or identify your vehicle first.</div>";
 return UI.vehicleVisual(vehicle,true)+
  "<label class=\"vehicle-fit-toggle"+(C.state.vehicleCompatibleOnly?" selected":"")+"\"><input id=\"vehicle-fit-only\" class=\"fit-checkbox\" type=\"checkbox\" "+(C.state.vehicleCompatibleOnly?"checked":"")+" aria-label=\"Show only parts that fit this vehicle\"/><span class=\"vehicle-fit-copy\"><strong>Show only parts that fit this vehicle</strong><small>"+(C.state.vehicleCompatibleOnly?"Only confirmed or same-family matches are shown.":"Showing all parts, including unverified parts that may not fit; compatibility labels stay visible.")+"</small></span></label>"+
  "<div class=\"button-row\"><button id=\"change-vehicle\" class=\"secondary small-button\" type=\"button\">Change vehicle</button><button id=\"clear-vehicle\" class=\"link-button\" type=\"button\">Remove vehicle</button></div>";
};

const home=async(payload={})=>{
 const addingVehicle=Boolean(payload&&payload.addVehicle);
 UI.loading("Loading marketplace");
 let result;
 try{
  result=await C.apiCached(marketplacePath(C.state.currentSearch),{auth:false,maxAge:20000});
 }catch(error){
  UI.empty("⌁","Marketplace unavailable",error.message,"Try again",()=>UI.route("home"));
  return;
 }

 const html=[];
 const extraFilters=rememberedMarketplaceParams();
 const hasExtraFilters=Object.keys(extraFilters).length>0;
 const canSaveSearch=Boolean(C.state.session&&(C.state.currentSearch||C.state.activeVehicle||hasExtraFilters));
 html.push("<section class=\"hero\"><p class=\"eyebrow\">UK used parts marketplace</p><h1>The right part.<br><em>First time.</em></h1><p>Identify your vehicle, then search automotive parts from garages and sellers across the UK.</p><div class=\"hero-badges\"><span>Vehicle-first search</span><span>Verified fitment evidence</span><span>Buyer protection</span></div></section>");
 html.push("<section class=\"card\"><p class=\"eyebrow\">Your vehicle</p><div id=\"vehicle-context\">"+(addingVehicle?"<div class=\"status info\"><strong>Add another vehicle</strong><br>Start with a registration or choose make and model from scratch.</div>":renderVehicleContext())+"</div><form id=\"registration-form\" class=\"vehicle-search\" style=\"margin-top:12px\"><div class=\"search-row\"><input id=\"registration-input\" class=\"input registration\" maxlength=\"10\" autocomplete=\"off\" placeholder=\"AB12 CDE\"/><button class=\"primary\" type=\"submit\">Find</button></div><button id=\"manual-vehicle\" class=\"link-button\" type=\"button\">Select vehicle manually</button><div id=\"vehicle-result\"></div></form></section>");
 const activeFilterCount=marketplaceFilterCount();
 html.push("<section class=\"card\"><p class=\"eyebrow\">Find a part</p><form id=\"market-search\" class=\"search-row\"><input id=\"part-query\" class=\"input\" value=\""+C.escapeHtml(C.state.currentSearch)+"\" placeholder=\"Part name, OE/OEM number or brand\"/><button class=\"primary\" type=\"submit\">Search</button></form><div class=\"button-row\" style=\"margin-top:10px\"><button id=\"market-filters\" class=\"secondary small-button"+(activeFilterCount?" selected":"")+"\" type=\"button\" aria-pressed=\""+(activeFilterCount?"true":"false")+"\">Filters"+(activeFilterCount?" · "+activeFilterCount:"")+"</button>"+(activeFilterCount?"<button id=\"market-reset-filters\" class=\"link-button\" type=\"button\">Reset filters</button>":"")+"</div></section>");
 if(hasExtraFilters)html.push("<section class=\"card flat\" style=\"margin-top:-2px\"><div class=\"row-between\"><div><p class=\"eyebrow\">Active marketplace filters</p><p class=\"subtle\">Category, condition, price, location, collection or sort filters are narrowing these results.</p></div><button id=\"clear-saved-filters\" class=\"link-button\" type=\"button\">Clear filters</button></div></section>");
 const marketplaceActions=[];
 if(C.state.currentSearch)marketplaceActions.push("<button id=\"clear-search\" class=\"link-button\" type=\"button\">Clear search</button>");
 if(canSaveSearch)marketplaceActions.push("<button id=\"save-search\" class=\"secondary small-button\" type=\"button\">Save search</button>");
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Marketplace</p><h2>"+(C.state.currentSearch?"Search results":"Available parts")+"</h2><p>"+result.pagination.total+" matching listing"+(result.pagination.total===1?"":"s")+"</p></div>"+(marketplaceActions.length?"<div class=\"button-row\">"+marketplaceActions.join("")+"</div>":"")+"</div>");
 if(result.items&&result.items.length){
  html.push("<section id=\"listing-grid\" class=\"list-grid\">"+result.items.map(UI.listingCard).join("")+"</section>");
 }else{
  html.push("<div class=\"empty\"><div class=\"empty-icon\">⌕</div><h3>No matching parts yet</h3><p>Try another part name, OE/OEM number or remove the vehicle filter.</p>"+(C.state.currentSearch?"<button id=\"request-missing-part\" class=\"primary small-button\" style=\"margin-top:14px\" type=\"button\">Request this part</button>":"")+"</div>");
 }

 UI.app.innerHTML=html.join("");
 UI.bindListingActions(UI.app);

 const search=document.getElementById("market-search");
 if(search)search.addEventListener("submit",event=>{
  event.preventDefault();
  C.state.currentSearch=String(document.getElementById("part-query").value||"").trim();
  UI.route("home");
 });
 const filtersButton=document.getElementById("market-filters");if(filtersButton)filtersButton.addEventListener("click",()=>void openMarketplaceFilters());
 const resetFilters=document.getElementById("market-reset-filters");if(resetFilters)resetFilters.addEventListener("click",()=>{C.state.marketplaceParams={};UI.route("home");});
 const clearSearch=document.getElementById("clear-search");
 if(clearSearch)clearSearch.addEventListener("click",()=>{C.state.currentSearch="";UI.route("home");});
 const clearSavedFilters=document.getElementById("clear-saved-filters");
 if(clearSavedFilters)clearSavedFilters.addEventListener("click",()=>{C.state.marketplaceParams={};UI.route("home");});
 const saveSearch=document.getElementById("save-search");
 if(saveSearch)saveSearch.addEventListener("click",async()=>{if(!await UI.requireAuth("savedSearches"))return;UI.route("savedSearches",{saveCurrent:true});});
 const requestMissing=document.getElementById("request-missing-part");
 if(requestMissing)requestMissing.addEventListener("click",async()=>{if(!await UI.requireAuth("requests"))return;UI.route("requests",{prefill:C.state.currentSearch});});

 const fitOnly=document.getElementById("vehicle-fit-only");
 if(fitOnly)fitOnly.addEventListener("change",event=>{
  const checked=Boolean(event.target.checked);
  C.setVehicleCompatibleOnly(checked);
  const wrapper=event.target.closest(".vehicle-fit-toggle");
  if(wrapper)wrapper.classList.toggle("selected",checked);
  void UI.route("home");
 });

 const registrationForm=document.getElementById("registration-form");
 if(registrationForm)registrationForm.addEventListener("submit",lookupRegistration);
 const manual=document.getElementById("manual-vehicle");
 if(manual)manual.addEventListener("click",()=>openManualVehicleSelector(lastLookup&&lastLookup.catalogue?lastLookup.catalogue:null,lastLookup&&lastLookup.vehicle?lastLookup.vehicle:null));

 const clearVehicle=document.getElementById("clear-vehicle");
 if(clearVehicle)clearVehicle.addEventListener("click",()=>{C.clearActiveVehicle();lastLookup=null;UI.route("home");});
 const changeVehicle=document.getElementById("change-vehicle");
 if(changeVehicle)changeVehicle.addEventListener("click",()=>openManualVehicleSelector(null,null));
 if(addingVehicle)window.setTimeout(()=>openManualVehicleSelector(null,null),0);
};

const lookupRegistration=async(event)=>{
 event.preventDefault();
 const input=document.getElementById("registration-input");
 const resultNode=document.getElementById("vehicle-result");
 const registration=String(input&&input.value||"").trim().toUpperCase();
 if(!registration){UI.toast("Enter a registration first.");return;}
 resultNode.innerHTML="<div class=\"status info\">Looking up vehicle…</div>";
 try{
  const result=await C.api("/vehicle-lookup",{method:"POST",body:{registration},auth:false});
  lastLookup=result;
  const vehicle=result.vehicle||{};
  const catalogue=result.catalogue||{};
  const variants=Array.isArray(catalogue.variants)?catalogue.variants:[];
  const exact=variants.length===1&&vehicle.year;
  let html="<div class=\"status success\"><strong>"+C.escapeHtml(result.registration)+"</strong><br>"+C.escapeHtml((vehicle.make||"")+" "+(vehicle.model||""))+(vehicle.year?" · "+C.escapeHtml(vehicle.year):"")+(vehicle.colour?" · "+C.escapeHtml(vehicle.colour):"")+"</div>";
  if(exact){
   html+="<label class=\"vehicle-fit-toggle\" style=\"margin-top:10px\"><input id=\"use-lookup-fit-only\" class=\"fit-checkbox\" type=\"checkbox\" "+(C.state.vehicleCompatibleOnly?"checked":"")+" aria-label=\"Show only parts that fit this vehicle\"/><span class=\"vehicle-fit-copy\"><strong>Show only parts that fit this vehicle</strong><small>Apply the compatibility filter as soon as this vehicle is selected.</small></span></label><div class=\"button-row\" style=\"margin-top:9px\"><button id=\"use-lookup-vehicle\" class=\"lime-button small-button\" type=\"button\">Use this vehicle</button>"+(C.state.session?"<button id=\"save-lookup-vehicle\" class=\"secondary small-button\" type=\"button\">Save to Garage</button>":"")+"</div>";
  }else{
   html+="<div class=\"status warning\" style=\"margin-top:8px\">Vehicle found, but the exact derivative still needs confirmation.</div><button id=\"choose-lookup-version\" class=\"secondary small-button\" style=\"margin-top:8px\" type=\"button\">Choose exact version</button>";
  }
  resultNode.innerHTML=html;

  const use=document.getElementById("use-lookup-vehicle");
  if(use)use.addEventListener("click",()=>{
   const variant=variants[0];
   const fitOnly=document.getElementById("use-lookup-fit-only");
   C.setActiveVehicle({
    variantId:variant.id,
    year:vehicle.year,
    fuelType:catalogue.engineMatched?vehicle.fuelType||null:null,
    engineSizeSimple:catalogue.engineMatched?vehicle.engineSizeSimple??null:null,
    make:catalogue.make||vehicle.make,
    modelFamily:catalogue.modelFamily||vehicle.model,
    variant:variant.variant,
    registration:result.registration,
    colour:vehicle.colour||null
   },{compatibleOnly:fitOnly?Boolean(fitOnly.checked):true});
   UI.route("home");
  });

  const save=document.getElementById("save-lookup-vehicle");
  if(save)save.addEventListener("click",async()=>{
   if(!await UI.requireAuth("home"))return;
   save.disabled=true;
   try{
    const variant=variants[0];
    await C.api("/garage",{method:"POST",auth:true,body:{
     variantId:variant.id,year:vehicle.year,
     fuel:catalogue.engineMatched?vehicle.fuelType||undefined:undefined,
     engine:catalogue.engineMatched?vehicle.engineSizeSimple??undefined:undefined,
     registration:result.registration,colour:vehicle.colour||undefined
    }});
    C.invalidateCache("/garage");
    C.prefetch("/garage",{auth:true,maxAge:60000});
    UI.toast("Vehicle saved to Garage.");
   }catch(error){UI.toast(error.message,"error");}
   finally{save.disabled=false;}
  });

  const choose=document.getElementById("choose-lookup-version");
  if(choose)choose.addEventListener("click",()=>openManualVehicleSelector(catalogue,vehicle));
 }catch(error){
  resultNode.innerHTML="<div class=\"status error\">"+C.escapeHtml(error.message)+"</div><button id=\"lookup-manual-fallback\" class=\"link-button\" type=\"button\">Select vehicle manually</button>";
  const fallback=document.getElementById("lookup-manual-fallback");
  if(fallback)fallback.addEventListener("click",()=>openManualVehicleSelector(null,null));
 }
};

const optionHtml=(items,valueKey,labelKey)=>{
 return items.map(item=>{
  const value=typeof item==="object"?item[valueKey]:item;
  const label=typeof item==="object"?item[labelKey]:item;
  return "<option value=\""+C.escapeHtml(value)+"\">"+C.escapeHtml(label)+"</option>";
 }).join("");
};

const openManualVehicleSelector=async(catalogue,vehicle)=>{
 UI.modal("Select vehicle manually","<div class=\"form-grid\"><label class=\"label\">Make<select id=\"mv-make\" class=\"select\"><option value=\"\">Loading makes…</option></select></label><label class=\"label\">Model<select id=\"mv-model\" class=\"select\" disabled><option value=\"\">Model</option></select></label><label class=\"label\">Year<select id=\"mv-year\" class=\"select\" disabled><option value=\"\">Year</option></select></label><label class=\"label\">Version<select id=\"mv-variant\" class=\"select\" disabled><option value=\"\">Version</option></select></label><label class=\"label\">Engine / fuel<select id=\"mv-engine\" class=\"select\" disabled><option value=\"\">Engine / fuel</option></select></label><label class=\"vehicle-fit-toggle\"><input id=\"mv-fit-only\" class=\"fit-checkbox\" type=\"checkbox\" "+(C.state.vehicleCompatibleOnly?"checked":"")+" aria-label=\"Show only parts that fit this vehicle\"/><span class=\"vehicle-fit-copy\"><strong>Show only parts that fit this vehicle</strong><small>Apply compatibility filtering immediately when you use this vehicle.</small></span></label><button id=\"mv-apply\" class=\"primary wide\" type=\"button\" disabled>Use this vehicle</button><div id=\"mv-status\"></div></div>");
 const make=document.getElementById("mv-make");
 const model=document.getElementById("mv-model");
 const year=document.getElementById("mv-year");
 const variant=document.getElementById("mv-variant");
 const engine=document.getElementById("mv-engine");
 const apply=document.getElementById("mv-apply");
 const status=document.getElementById("mv-status");
 let engines=[];

 const fail=(message)=>{status.innerHTML="<div class=\"status error\">"+C.escapeHtml(message)+"</div>";};
 const loadModels=async()=>{
  model.disabled=true;year.disabled=true;variant.disabled=true;engine.disabled=true;apply.disabled=true;
  model.innerHTML="<option value=\"\">Loading models…</option>";
  try{
   const result=await C.apiCached("/vehicle-catalogue?level=models&make="+encodeURIComponent(make.value),{auth:false,maxAge:5*60*1000});
   model.innerHTML="<option value=\"\">Choose model</option>"+optionHtml(result.items||[],"","");model.disabled=false;
  }catch(error){fail(error.message);}
 };
 const loadYears=async()=>{
  year.disabled=true;variant.disabled=true;engine.disabled=true;apply.disabled=true;
  year.innerHTML="<option value=\"\">Loading years…</option>";
  try{
   const result=await C.apiCached("/vehicle-catalogue?level=years-model&make="+encodeURIComponent(make.value)+"&model="+encodeURIComponent(model.value),{auth:false,maxAge:5*60*1000});
   year.innerHTML="<option value=\"\">Choose year</option>"+optionHtml(result.items||[],"","");year.disabled=false;
  }catch(error){fail(error.message);}
 };
 const loadVariants=async()=>{
  variant.disabled=true;engine.disabled=true;apply.disabled=true;
  variant.innerHTML="<option value=\"\">Loading versions…</option>";
  try{
   const result=await C.apiCached("/vehicle-catalogue?level=variants-year&make="+encodeURIComponent(make.value)+"&model="+encodeURIComponent(model.value)+"&year="+encodeURIComponent(year.value),{auth:false,maxAge:5*60*1000});
   variant.innerHTML="<option value=\"\">Choose version</option>"+optionHtml(result.items||[],"id","variant");variant.disabled=false;
  }catch(error){fail(error.message);}
 };
 const loadEngines=async()=>{
  engine.disabled=true;apply.disabled=true;engines=[];
  engine.innerHTML="<option value=\"\">Loading engines…</option>";
  try{
   const result=await C.apiCached("/vehicle-catalogue?level=engines&variantId="+encodeURIComponent(variant.value),{auth:false,maxAge:5*60*1000});
   engines=result.items||[];
   if(!engines.length){
    engine.innerHTML="<option value=\"\">Engine data unavailable</option>";
    apply.disabled=false;
    return;
   }
   engine.innerHTML="<option value=\"\">Choose engine / fuel</option>"+engines.map((item,index)=>"<option value=\""+index+"\">"+C.escapeHtml((item.engineSizeSimple?item.engineSizeSimple+"cc · ":"")+item.fuelType)+"</option>").join("");
   engine.disabled=false;
   if(engines.length===1){engine.value="0";apply.disabled=false;}
  }catch(error){fail(error.message);}
 };

 make.addEventListener("change",loadModels);
 model.addEventListener("change",loadYears);
 year.addEventListener("change",loadVariants);
 variant.addEventListener("change",loadEngines);
 engine.addEventListener("change",()=>{apply.disabled=engines.length>0&&!engine.value;});

 apply.addEventListener("click",()=>{
  if(!variant.value||!year.value)return;
  const selectedEngine=engine.value!==""?engines[Number(engine.value)]||null:null;
  const selectedVariantLabel=variant.options[variant.selectedIndex]?variant.options[variant.selectedIndex].textContent:"";
  C.setActiveVehicle({
   variantId:variant.value,
   year:Number(year.value),
   fuelType:selectedEngine?selectedEngine.fuelType:null,
   engineSizeSimple:selectedEngine?selectedEngine.engineSizeSimple:null,
   make:make.value,
   modelFamily:model.value,
   variant:selectedVariantLabel,
   registration:lastLookup&&lastLookup.registration?lastLookup.registration:null,
   colour:lastLookup&&lastLookup.vehicle?lastLookup.vehicle.colour||null:null
  },{compatibleOnly:Boolean(document.getElementById("mv-fit-only")?.checked)});
  UI.closeModal();
  UI.route("home");
 });

 try{
  const makes=await C.apiCached("/vehicle-catalogue?level=makes",{auth:false,maxAge:10*60*1000});
  make.innerHTML="<option value=\"\">Choose make</option>"+optionHtml(makes.items||[],"","");
  if(catalogue&&catalogue.make){
   make.value=catalogue.make;
   await loadModels();
   if(catalogue.modelFamily){
    model.value=catalogue.modelFamily;
    await loadYears();
    if(vehicle&&vehicle.year){
     year.value=String(vehicle.year);
     await loadVariants();
    }
   }
  }
 }catch(error){fail(error.message);}
};

const listing=async(payload)=>{
 if(!payload.slug){UI.route("home");return;}
 UI.loading("Loading part");
 let item,reputation=null;
 try{
  const response=await C.api("/listings/"+encodeURIComponent(payload.slug));
  item=response.item;
  reputation=response.sellerReputation||null;
 }
 catch(error){UI.empty("!","Listing unavailable",error.message,"Back to marketplace",()=>UI.route("home"));return;}

 if(C.state.session)void C.api("/recently-viewed",{method:"POST",auth:true,body:{partId:item.id}}).catch(()=>{});
 const image=UI.firstImage(item);
 const own=Boolean(C.state.me&&C.state.me.profile&&item.seller&&item.seller.ownerId===C.state.me.profile.id);
 const saved=C.state.savedIds.has(item.id);
 const html=[];
 html.push("<button class=\"back\" id=\"listing-back\" type=\"button\">‹ Back to marketplace</button>");
 html.push("<section class=\"detail-hero\"><div class=\"detail-image\">"+(image?"<img src=\""+C.escapeHtml(image)+"\" alt=\""+C.escapeHtml(item.title)+"\"/>":"PART")+"</div><div class=\"detail-content\"><p class=\"eyebrow\">"+C.escapeHtml(item.condition)+" · "+C.escapeHtml(item.category&&item.category.name?item.category.name:"Part")+"</p><h1>"+C.escapeHtml(item.title)+"</h1><p class=\"listing-meta\">Sold by "+C.escapeHtml(item.seller.businessName)+(item.seller.verified?" · Verified seller":"")+"</p>"+(reputation?"<button id=\"listing-member\" type=\"button\" class=\"secondary small-button\" style=\"margin-top:9px;text-align:left\">@"+C.escapeHtml(reputation.handle)+" · ★ "+C.escapeHtml(reputation.sellerRating===null||!reputation.sellerReviewCount?"New":Number(reputation.sellerRating).toFixed(1))+" ("+C.escapeHtml(reputation.sellerReviewCount)+") · "+C.escapeHtml(reputation.soldCount)+" sold · "+C.escapeHtml(reputation.boughtCount)+" bought</button>":"")+"<div class=\"detail-price\">"+C.money(item.pricePence)+"</div><div class=\"chips\"><span class=\"chip\">Stock "+C.escapeHtml(item.stock)+"</span><span class=\"chip\">"+(item.shippingPence?C.money(item.shippingPence)+" delivery":"Free delivery")+"</span>"+(item.collectionAvailable?"<span class=\"chip green\">Collection</span>":"")+(item.compatibility&&item.compatibility.label?"<span class=\"chip green\">"+C.escapeHtml(item.compatibility.label)+"</span>":"")+"</div><div class=\"spec-grid\"><div class=\"spec\"><small>OE/OEM</small><strong>"+C.escapeHtml(item.oemNumber||"Not listed")+"</strong></div><div class=\"spec\"><small>Part number</small><strong>"+C.escapeHtml(item.partNumber||"Not listed")+"</strong></div><div class=\"spec\"><small>Testing</small><strong>"+C.escapeHtml(C.human(item.testingStatus))+"</strong></div><div class=\"spec\"><small>Warranty</small><strong>"+C.escapeHtml(item.warrantyDays?item.warrantyDays+" days":"None stated")+"</strong></div></div><p style=\"font-size:12px;line-height:1.65;color:#4f5e57;margin-top:14px\">"+C.escapeHtml(item.description)+"</p></div></section>");
 html.push("<section class=\"card\"><div class=\"button-row\"><button id=\"listing-save\" class=\"secondary"+(saved?" selected":"")+"\" aria-pressed=\""+(saved?"true":"false")+"\" type=\"button\">"+(saved?"♥ Saved":"♡ Save part")+"</button>"+(!own?"<button id=\"listing-ask\" class=\"secondary\" type=\"button\">Ask seller</button><button id=\"listing-report\" class=\"link-button\" type=\"button\">Report listing</button>":"")+"</div>"+(!own?"<form id=\"checkout-form\" class=\"form-grid\"><div class=\"spec-grid\"><label class=\"label\">Quantity<input id=\"checkout-qty\" class=\"input\" type=\"number\" min=\"1\" max=\""+C.escapeHtml(Math.min(10,item.stock))+"\" value=\"1\"/></label><label class=\"label\">Delivery<select id=\"checkout-delivery\" class=\"select\"><option value=\"shipping\">Shipping</option>"+(item.collectionAvailable?"<option value=\"collection\">Collection</option>":"")+"</select></label></div><button class=\"lime-button wide\" type=\"submit\">Buy securely</button><p class=\"subtle\">Checkout opens Stripe securely. SecondPart never receives your card number.</p></form>":"<div class=\"status info\" style=\"margin-top:12px\">This is your own listing.</div>")+"</section>");
 UI.app.innerHTML=html.join("");

 document.getElementById("listing-back").addEventListener("click",()=>UI.route("home"));
 const member=document.getElementById("listing-member");
 if(member&&reputation)member.addEventListener("click",()=>UI.route("member",{handle:reputation.handle}));
 document.getElementById("listing-save").addEventListener("click",async()=>{
  if(!await UI.requireAuth("listing"))return;
  try{
   const result=await C.api("/saved",{method:"POST",auth:true,body:{partId:item.id}});
   C.invalidateCache("/saved");
   if(result.saved)C.state.savedIds.add(item.id);else C.state.savedIds.delete(item.id);
   const saveButton=document.getElementById("listing-save");
   saveButton.textContent=result.saved?"♥ Saved":"♡ Save part";
   saveButton.classList.toggle("selected",result.saved);
   saveButton.setAttribute("aria-pressed",result.saved?"true":"false");
   UI.toast(result.saved?"Saved to your account":"Removed from saved");
  }catch(error){UI.toast(error.message,"error");}
 });

 const fit=document.getElementById("listing-fit");
 if(fit)fit.addEventListener("click",()=>UI.route("fitPart",{item}));

 const report=document.getElementById("listing-report");
 if(report)report.addEventListener("click",async()=>{
  if(!await UI.requireAuth("listing"))return;
  UI.modal("Report listing","<form id=\"report-listing-form\" class=\"form-grid\"><p class=\"subtle\">Reports go to marketplace moderation and are separate from order disputes. Do not include passwords or payment credentials.</p><label class=\"label\">Reason<select id=\"report-reason\" class=\"select\" required><option value=\"\">Choose a reason</option><option value=\"incorrect_fitment\">Incorrect compatibility / fitment</option><option value=\"misleading_description\">Misleading description</option><option value=\"suspected_counterfeit\">Suspected counterfeit</option><option value=\"unsafe_item\">Potentially unsafe item</option><option value=\"seller_conduct\">Seller conduct</option><option value=\"other\">Other</option></select></label><label class=\"label\">Details <span class=\"subtle\">(optional)</span><textarea id=\"report-details\" class=\"textarea\" maxlength=\"1000\" placeholder=\"Explain what looks wrong.\"></textarea></label><div id=\"report-status\"></div><button id=\"report-submit\" class=\"danger-button wide\" type=\"submit\">Submit report</button></form>");
  document.getElementById("report-listing-form").addEventListener("submit",async event=>{
   event.preventDefault();
   const reason=String(document.getElementById("report-reason").value||"");
   const details=String(document.getElementById("report-details").value||"").trim();
   const button=document.getElementById("report-submit"),status=document.getElementById("report-status");
   if(!reason){status.innerHTML="<div class=\"status warning\">Choose a report reason.</div>";return;}
   button.disabled=true;button.textContent="Submitting…";
   try{await C.api("/reports",{method:"POST",auth:true,body:{partId:item.id,reason,details}});UI.closeModal();UI.toast("Report submitted for moderation.");}
   catch(error){status.innerHTML="<div class=\"status error\">"+C.escapeHtml(error.message.replaceAll("_"," "))+"</div>";button.disabled=false;button.textContent="Submit report";}
  });
 });

 const ask=document.getElementById("listing-ask");
 if(ask)ask.addEventListener("click",async()=>{
  if(!await UI.requireAuth("listing"))return;
  UI.modal("Ask seller","<form id=\"ask-seller-form\" class=\"form-grid\"><label class=\"label\">Question<textarea id=\"ask-body\" class=\"textarea\" minlength=\"2\" maxlength=\"2000\" placeholder=\"Ask about OE/OEM number, connectors, condition, donor vehicle or fitment evidence…\"></textarea></label><p class=\"subtle\">Keep payment inside SecondPart. Never send card details or security codes.</p><button class=\"primary wide\" type=\"submit\">Send question</button></form>");
  document.getElementById("ask-seller-form").addEventListener("submit",async event=>{
   event.preventDefault();
   const body=String(document.getElementById("ask-body").value||"").trim();
   if(body.length<2){UI.toast("Write your question first.");return;}
   try{
    const result=await C.api("/listings/"+encodeURIComponent(item.id)+"/question",{method:"POST",auth:true,body:{body}});
    UI.closeModal();
    UI.route("conversation",{id:result.conversationId});
   }catch(error){UI.toast(error.message,"error");}
  });
 });

 const checkout=document.getElementById("checkout-form");
 if(checkout)checkout.addEventListener("submit",async event=>{
  event.preventDefault();
  if(!await UI.requireAuth("listing"))return;
  const quantity=Number(document.getElementById("checkout-qty").value||1);
  const deliveryMethod=document.getElementById("checkout-delivery").value;
  const submit=checkout.querySelector("button[type=submit]");
  submit.disabled=true;submit.textContent="Starting checkout…";
  try{
   const result=await C.api("/checkout",{method:"POST",auth:true,body:{partId:item.id,quantity,deliveryMethod}});
   UI.toast("Opening secure Stripe checkout…");
   await C.Native.openBrowser(result.checkoutUrl);
  }catch(error){
   UI.toast(error.message,"error");
   submit.disabled=false;submit.textContent="Buy securely";
  }
 });
};

const garage=async()=>{
 if(!await UI.requireAuth("garage"))return;
 UI.loading("Loading Garage");
 let items;
 try{items=(await C.apiCached("/garage",{auth:true,maxAge:60000})).items||[];}
 catch(error){UI.empty("▱","Garage unavailable",error.message,"Try again",()=>UI.route("garage"));return;}

 const html=[];
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Your account</p><h2>SecondPart Garage</h2><p>Saved vehicles for one-tap compatibility searches.</p></div><button id=\"garage-add\" class=\"primary small-button\" type=\"button\">Add vehicle</button></div>");
 if(items.length){
  html.push("<section>"+items.map(item=>{
   const active=Boolean(C.state.activeVehicle&&C.state.activeVehicle.variantId===item.catalogueVariantId&&Number(C.state.activeVehicle.year)===Number(item.year)&&(C.state.activeVehicle.registration||null)===(item.registration||null));
   return "<article data-garage-id=\""+C.escapeHtml(item.id)+"\" class=\""+(active?"selected-vehicle":"")+"\">"+UI.vehicleVisual(item,false)+"<div class=\"button-row\" style=\"margin:-2px 0 14px\"><button class=\"lime-button small-button\" data-use-garage=\""+C.escapeHtml(item.id)+"\" type=\"button\" "+(active?"aria-pressed=\"true\"":"")+">"+(active?"✓ Using this vehicle":"Use this vehicle")+"</button><button class=\"danger-button small-button\" data-remove-garage=\""+C.escapeHtml(item.id)+"\" type=\"button\">Remove</button></div></article>";
  }).join("")+"</section>");
 }else{
  html.push("<div class=\"empty\"><div class=\"empty-icon\">▱</div><h3>Your Garage is empty</h3><p>Add a vehicle by registration or choose it manually from the marketplace.</p></div>");
 }
 UI.app.innerHTML=html.join("");
  document.getElementById("garage-add").addEventListener("click",()=>UI.route("home",{addVehicle:true}));
 UI.app.querySelectorAll("[data-use-garage]").forEach(button=>button.addEventListener("click",()=>{
  const item=items.find(vehicle=>vehicle.id===button.dataset.useGarage);
  if(!item)return;
  button.disabled=true;
  button.textContent="✓ Selected";
  C.setActiveVehicle({
   variantId:item.catalogueVariantId,year:item.year,fuelType:item.fuelType,engineSizeSimple:item.engineSizeSimple,
   make:item.make,modelFamily:item.modelFamily,variant:item.variant,registration:item.registration,colour:item.colour
  },{compatibleOnly:true});
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

UI.register("home",home);
UI.register("listing",listing);
UI.register("garage",garage);
})();
