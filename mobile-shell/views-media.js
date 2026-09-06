(()=>{
"use strict";

const UI=window.SecondPartUI;
const C=UI.C;

const photoGrid=(items,removable=false)=>items.length
 ?"<div style=\"display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px\">"+
   items.map(item=>"<article style=\"overflow:hidden;border:1px solid rgba(18,34,29,.1);border-radius:13px;background:#fff\"><img src=\""+C.escapeHtml(C.safeHttpUrl(item.signedUrl||item.url))+"\" alt=\""+C.escapeHtml(item.originalName||item.alt||"Photo")+"\" style=\"width:100%;aspect-ratio:1/1;object-fit:cover\"/>"+(removable?"<button type=\"button\" class=\"danger-button small-button wide\" style=\"border-radius:0;border-left:0;border-right:0;border-bottom:0\" data-remove-photo=\""+C.escapeHtml(item.id)+"\">Remove</button>":"<div style=\"padding:8px\"><p class=\"subtle\" style=\"margin:0\">"+C.escapeHtml(item.originalName||"Evidence photo")+"</p></div>")+"</article>").join("")+
  "</div>"
 :"<div class=\"status info\" style=\"margin-top:12px\">No photos attached yet.</div>";

const uploadNativePhotos=async({photos,path,prefix,maxCount,onProgress})=>{
 const selected=(photos||[]).slice(0,Math.max(0,maxCount));
 let uploaded=0;
 for(const photo of selected){
  if(!photo)continue;
  const file=await C.nativePhotoFile(photo,prefix);
  const formData=new FormData();
  formData.append("file",file,file.name);
  await C.apiForm(path,{formData});
  uploaded+=1;
  if(onProgress)onProgress(uploaded,selected.length);
 }
 return uploaded;
};

const chooseSource=async({remaining,path,prefix,onDone})=>{
 if(remaining<=0){UI.toast("The photo limit has already been reached.");return;}

 UI.modal("Add photos",
  "<div class=\"form-grid\">"+
   "<button id=\"media-camera\" class=\"primary wide\" type=\"button\">Take photo</button>"+
   "<button id=\"media-gallery\" class=\"secondary wide\" type=\"button\">Choose from gallery</button>"+
   "<p class=\"subtle\">JPG, PNG or WebP. Maximum 5 MB per uploaded image. Photos are resized by the device before upload when supported.</p>"+
   "<div id=\"media-upload-status\"></div>"+
  "</div>"
 );

 const status=()=>document.getElementById("media-upload-status");
 const run=async(kind)=>{
  const camera=document.getElementById("media-camera");
  const gallery=document.getElementById("media-gallery");
  camera.disabled=true;gallery.disabled=true;
  try{
   let photos=[];
   if(kind==="camera"){
    const photo=await C.Native.takePhoto();
    if(photo)photos=[photo];
   }else{
    photos=await C.Native.choosePhotos(Math.min(remaining,6));
   }
   if(!photos.length){
    UI.closeModal();
    return;
   }
   const node=status();
   if(node)node.innerHTML="<div class=\"status info\">Preparing upload…</div>";
   const count=await uploadNativePhotos({
    photos,path,prefix,maxCount:remaining,
    onProgress:(done,total)=>{
     const target=status();
     if(target)target.innerHTML="<div class=\"status info\">Uploading "+done+" of "+total+"…</div>";
    }
   });
   UI.closeModal();
   if(count)UI.toast(count===1?"Photo uploaded.":count+" photos uploaded.");
   if(onDone)await onDone();
  }catch(error){
   const message=String(error&&error.message?error.message:error||"Photo upload failed.");
   if(/cancel|canceled|cancelled|user cancelled/i.test(message)){UI.closeModal();return;}
   const node=status();
   if(node)node.innerHTML="<div class=\"status error\">"+C.escapeHtml(message)+"</div>";
   camera.disabled=false;gallery.disabled=false;
  }
 };

 document.getElementById("media-camera").addEventListener("click",()=>void run("camera"));
 document.getElementById("media-gallery").addEventListener("click",()=>void run("gallery"));
};

const openEvidence=async(caseId)=>{
 let result;
 try{result=await C.api("/cases/"+encodeURIComponent(caseId)+"/evidence",{auth:true});}
 catch(error){UI.toast(error.message,"error");return;}

 const render=()=>{
  UI.modal("Case evidence",
   "<p class=\"subtle\">Private to the buyer, seller and SecondPart administrators. Useful evidence includes labels, part numbers, packaging, connectors, visible damage and condition on arrival.</p>"+
   "<div class=\"row-between\" style=\"margin-top:12px\"><strong>"+C.escapeHtml(result.count)+" / 10 photos</strong>"+(result.canUpload&&result.count<10?"<button id=\"evidence-add\" class=\"primary small-button\" type=\"button\">Add photos</button>":"")+"</div>"+
   photoGrid(result.items||[],false)
  );
  const add=document.getElementById("evidence-add");
  if(add)add.addEventListener("click",()=>void chooseSource({
   remaining:10-Number(result.count||0),
   path:"/cases/"+encodeURIComponent(caseId)+"/evidence",
   prefix:"case-evidence",
   onDone:async()=>{
    result=await C.api("/cases/"+encodeURIComponent(caseId)+"/evidence",{auth:true});
    render();
   }
  }));
 };
 render();
};

const cases=async()=>{
 if(!await UI.requireAuth("cases"))return;
 UI.loading("Loading transaction cases");
 let items;
 try{items=(await C.api("/cases",{auth:true})).items||[];}
 catch(error){UI.empty("!","Cases unavailable",error.message,"Try again",()=>UI.route("cases"));return;}

 const html=[];
 html.push("<button class=\"back\" id=\"cases-back\" type=\"button\">‹ Back to account</button>");
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Buyer protection</p><h2>Returns & cases</h2><p>Returns, disputes and cancellation requests linked to your purchases.</p></div></div>");
 if(items.length){
  html.push(items.map(item=>
   "<section class=\"order-card\">"+
    "<div class=\"row-between\"><div><p class=\"eyebrow\">"+C.escapeHtml(C.human(item.caseType))+"</p><h3>"+C.escapeHtml(item.partTitle)+"</h3><p class=\"subtle\">Seller: "+C.escapeHtml(item.sellerName)+" · "+C.dateOnly(item.createdAt)+"</p></div><span class=\"pill\">"+C.escapeHtml(C.human(item.status))+"</span></div>"+
    "<p style=\"font-size:11px;line-height:1.55\"><strong>"+C.escapeHtml(item.reason)+"</strong><br>"+C.escapeHtml(item.details)+"</p>"+
    (item.sellerResponse?"<div class=\"status info\">Seller response: "+C.escapeHtml(item.sellerResponse)+"</div>":"")+
    "<div class=\"button-row\" style=\"margin-top:10px\"><button type=\"button\" class=\"secondary small-button\" data-case-evidence=\""+C.escapeHtml(item.id)+"\">Photos & evidence</button></div>"+
   "</section>"
  ).join(""));
 }else{
  html.push("<div class=\"empty\"><div class=\"empty-icon\">✓</div><h3>No transaction cases</h3><p>If you open a cancellation, return or dispute, it will appear here.</p></div>");
 }
 UI.app.innerHTML=html.join("");
 document.getElementById("cases-back").addEventListener("click",()=>UI.route("account"));
 UI.app.querySelectorAll("[data-case-evidence]").forEach(button=>button.addEventListener("click",()=>void openEvidence(button.dataset.caseEvidence)));
};

const openListingPhotos=async(part)=>{
 let result;
 try{result=await C.api("/seller/listings/"+encodeURIComponent(part.id)+"/photos",{auth:true});}
 catch(error){UI.toast(error.message,"error");return;}

 const render=()=>{
  const items=result.items||[];
  UI.modal("Listing photos",
   "<p class=\"subtle\">"+C.escapeHtml(part.title)+"</p>"+
   "<div class=\"row-between\" style=\"margin-top:12px\"><strong>"+items.length+" / 6 photos</strong>"+(items.length<6?"<button id=\"listing-photo-add\" class=\"primary small-button\" type=\"button\">Add photos</button>":"")+"</div>"+
   photoGrid(items,true)+
   "<p class=\"subtle\" style=\"margin-top:10px\">Active listings must always keep at least one real product photo.</p>"
  );

  const add=document.getElementById("listing-photo-add");
  if(add)add.addEventListener("click",()=>void chooseSource({
   remaining:6-items.length,
   path:"/seller/listings/"+encodeURIComponent(part.id)+"/photos",
   prefix:"part-photo",
   onDone:async()=>{
    result=await C.api("/seller/listings/"+encodeURIComponent(part.id)+"/photos",{auth:true});
    render();
   }
  }));

  document.querySelectorAll("[data-remove-photo]").forEach(button=>button.addEventListener("click",async()=>{
   button.disabled=true;
   try{
    await C.api("/seller/listings/"+encodeURIComponent(part.id)+"/photos?imageId="+encodeURIComponent(button.dataset.removePhoto),{method:"DELETE",auth:true});
    result=await C.api("/seller/listings/"+encodeURIComponent(part.id)+"/photos",{auth:true});
    UI.toast("Photo removed.");
    render();
   }catch(error){
    UI.toast(error.message,"error");
    button.disabled=false;
   }
  }));
 };
 render();
};

const inventory=async()=>{
 if(!await UI.requireAuth("inventory"))return;
 if(!C.state.me)await C.loadMe();
 if(!C.state.me||!C.state.me.seller){UI.empty("□","Seller profile required","Create or enable a seller profile before managing inventory.","Account",()=>UI.route("account"));return;}

 UI.loading("Loading inventory");
 let items;
 try{items=(await C.api("/seller/listings",{auth:true})).items||[];}
 catch(error){UI.empty("□","Inventory unavailable",error.message,"Try again",()=>UI.route("inventory"));return;}

 const html=[];
 html.push("<button class=\"back\" id=\"inventory-back\" type=\"button\">‹ Back to seller dashboard</button>");
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Seller inventory</p><h2>Your listings</h2><p>Manage real product photos directly from the phone.</p></div><button id=\"inventory-new\" class=\"primary small-button\" type=\"button\">New listing</button></div>");
 if(items.length){
  html.push(items.map(item=>{
   const cover=item.images&&item.images.length?C.safeHttpUrl(item.images[0].url):"";
   return "<section class=\"order-card\"><div style=\"display:grid;grid-template-columns:82px 1fr;gap:12px;align-items:start\">"+
    "<div style=\"width:82px;height:82px;border-radius:13px;overflow:hidden;background:#eef1eb;display:grid;place-items:center\">"+(cover?"<img src=\""+C.escapeHtml(cover)+"\" alt=\""+C.escapeHtml(item.title)+"\" style=\"width:100%;height:100%;object-fit:cover\"/>":"PART")+"</div>"+
    "<div><div class=\"row-between\"><h3 style=\"margin:0\">"+C.escapeHtml(item.title)+"</h3><span class=\"pill\">"+C.escapeHtml(C.human(item.status))+"</span></div><p class=\"subtle\">"+C.money(item.pricePence)+" · Stock "+C.escapeHtml(item.stock)+" · "+C.escapeHtml((item.images||[]).length)+" photo(s)</p><div class=\"button-row\" style=\"margin-top:9px\"><button type=\"button\" class=\"primary small-button\" data-listing-photos=\""+C.escapeHtml(item.id)+"\">Photos</button><button type=\"button\" class=\"secondary small-button\" data-listing-edit=\""+C.escapeHtml(item.id)+"\">Edit details</button></div></div>"+
   "</div></section>";
  }).join(""));
 }else{
  html.push("<div class=\"empty\"><div class=\"empty-icon\">□</div><h3>No listings yet</h3><p>Create your first listing, then use the camera to add real product photos.</p></div>");
 }
 UI.app.innerHTML=html.join("");
 document.getElementById("inventory-back").addEventListener("click",()=>UI.route("seller"));
 document.getElementById("inventory-new").addEventListener("click",()=>UI.route("listingEditor"));
 UI.app.querySelectorAll("[data-listing-photos]").forEach(button=>button.addEventListener("click",()=>{
  const item=items.find(value=>value.id===button.dataset.listingPhotos);
  if(item)void openListingPhotos(item);
 }));
 UI.app.querySelectorAll("[data-listing-edit]").forEach(button=>button.addEventListener("click",()=>UI.route("listingEditor",{id:button.dataset.listingEdit})));
};


const errorText=(code)=>{
 const map={
  title_too_short:"Use a title of at least 5 characters.",
  description_too_short:"Add a description of at least 20 characters.",
  invalid_category:"Choose a specific part category.",
  invalid_condition:"Choose a valid condition.",
  invalid_testing:"Choose a valid testing status.",
  invalid_price:"Enter a valid price.",
  invalid_shipping:"Enter a valid delivery price.",
  invalid_stock:"Enter a valid stock quantity.",
  invalid_dispatch:"Choose a valid dispatch time.",
  invalid_warranty:"Choose a valid warranty period.",
  invalid_delivery_range:"Enter a valid delivery-time range.",
  invalid_donor:"Choose a donor vehicle from your seller account.",
  transmission_codes_required:"This transmission part needs gearbox family and code.",
  invalid_fitments:"One of the confirmed vehicle fitments is invalid.",
  duplicate_fitment:"The same exact vehicle was added twice.",
  photo_required:"Add at least one real product photo before publishing.",
  compatibility_evidence_required:"Before publishing, add a donor vehicle, an exact fitment, an OE/OEM number, or a manufacturer plus part number.",
  listing_create_failed:"The listing could not be created.",
  listing_update_failed:"The listing could not be updated."
 };
 return map[code]||String(code||"Something went wrong.").replaceAll("_"," ");
};

const categoryOptions=(categories,selected)=>{
 const byId=new Map(categories.map(item=>[item.id,item]));
 const path=(item)=>{
  const names=[item.name];
  let parent=item.parentId?byId.get(item.parentId):null;
  let guard=0;
  while(parent&&guard<5){names.unshift(parent.name);parent=parent.parentId?byId.get(parent.parentId):null;guard+=1;}
  return names.join(" › ");
 };
 return categories.filter(item=>item.isSelectable).sort((a,b)=>path(a).localeCompare(path(b))).map(item=>
  "<option value=\""+C.escapeHtml(item.id)+"\" "+(item.id===selected?"selected":"")+">"+C.escapeHtml(path(item))+"</option>"
 ).join("");
};

const donorOptions=(donors,selected)=>"<option value=\"\">No donor / new stock / unknown</option>"+donors.map(item=>
 "<option value=\""+C.escapeHtml(item.id)+"\" "+(item.id===selected?"selected":"")+">"+
 C.escapeHtml((item.registration?item.registration+" · ":"")+item.make+" "+item.model+" · "+item.year+(item.engineSizeSimple?" · "+item.engineSizeSimple+"cc":"")+(item.fuelType?" · "+item.fuelType:""))+
 "</option>"
).join("");

const fitmentLabel=(item)=>[
 item.make&&item.modelFamily?(item.make+" "+item.modelFamily):"Confirmed vehicle",
 item.variant,
 item.year,
 item.engineSizeSimple?item.engineSizeSimple+"cc":null,
 item.fuelType
].filter(Boolean).join(" · ");

const addExactFitment=async(fitments,onChange)=>{
 UI.modal("Add confirmed vehicle",
  "<p class=\"subtle\">Only add a vehicle when you can support the fitment with OE/OEM data, supplier data or verified fitment knowledge.</p>"+
  "<div class=\"form-grid\">"+
   "<label class=\"label\">Make<select id=\"ef-make\" class=\"select\"><option>Loading…</option></select></label>"+
   "<label class=\"label\">Model<select id=\"ef-model\" class=\"select\" disabled><option value=\"\">Choose model</option></select></label>"+
   "<label class=\"label\">Year<select id=\"ef-year\" class=\"select\" disabled><option value=\"\">Choose year</option></select></label>"+
   "<label class=\"label\">Version<select id=\"ef-variant\" class=\"select\" disabled><option value=\"\">Choose version</option></select></label>"+
   "<label class=\"label\">Engine / fuel<select id=\"ef-engine\" class=\"select\" disabled><option value=\"\">Choose engine</option></select></label>"+
   "<label class=\"label\">Evidence note <span class=\"subtle\">(optional)</span><input id=\"ef-note\" class=\"input\" maxlength=\"300\" placeholder=\"e.g. OE catalogue / supplier fitment\"/></label>"+
   "<button id=\"ef-add\" class=\"primary wide\" type=\"button\" disabled>Add confirmed fitment</button>"+
   "<div id=\"ef-status\"></div>"+
  "</div>"
 );
 const make=document.getElementById("ef-make");
 const model=document.getElementById("ef-model");
 const year=document.getElementById("ef-year");
 const variant=document.getElementById("ef-variant");
 const engine=document.getElementById("ef-engine");
 const add=document.getElementById("ef-add");
 const status=document.getElementById("ef-status");
 let engines=[];

 const options=(items,valueKey,labelKey)=>items.map(item=>{
  const value=typeof item==="object"?item[valueKey]:item;
  const label=typeof item==="object"?item[labelKey]:item;
  return "<option value=\""+C.escapeHtml(value)+"\">"+C.escapeHtml(label)+"</option>";
 }).join("");
 const fail=message=>{status.innerHTML="<div class=\"status error\">"+C.escapeHtml(message)+"</div>";};

 make.addEventListener("change",async()=>{
  model.disabled=true;year.disabled=true;variant.disabled=true;engine.disabled=true;add.disabled=true;
  try{
   const result=await C.api("/vehicle-catalogue?level=models&make="+encodeURIComponent(make.value));
   model.innerHTML="<option value=\"\">Choose model</option>"+options(result.items||[],"","");
   model.disabled=false;
  }catch(error){fail(error.message);}
 });
 model.addEventListener("change",async()=>{
  year.disabled=true;variant.disabled=true;engine.disabled=true;add.disabled=true;
  try{
   const result=await C.api("/vehicle-catalogue?level=years-model&make="+encodeURIComponent(make.value)+"&model="+encodeURIComponent(model.value));
   year.innerHTML="<option value=\"\">Choose year</option>"+options(result.items||[],"","");
   year.disabled=false;
  }catch(error){fail(error.message);}
 });
 year.addEventListener("change",async()=>{
  variant.disabled=true;engine.disabled=true;add.disabled=true;
  try{
   const result=await C.api("/vehicle-catalogue?level=variants-year&make="+encodeURIComponent(make.value)+"&model="+encodeURIComponent(model.value)+"&year="+encodeURIComponent(year.value));
   variant.innerHTML="<option value=\"\">Choose version</option>"+options(result.items||[],"id","variant");
   variant.disabled=false;
  }catch(error){fail(error.message);}
 });
 variant.addEventListener("change",async()=>{
  engine.disabled=true;add.disabled=true;engines=[];
  try{
   const result=await C.api("/vehicle-catalogue?level=engines&variantId="+encodeURIComponent(variant.value));
   engines=result.items||[];
   engine.innerHTML="<option value=\"\">Any engine for this exact version</option>"+engines.map((item,index)=>
    "<option value=\""+index+"\">"+C.escapeHtml((item.engineSizeSimple?item.engineSizeSimple+"cc · ":"")+item.fuelType)+"</option>"
   ).join("");
   engine.disabled=false;add.disabled=false;
  }catch(error){fail(error.message);}
 });
 add.addEventListener("click",()=>{
  if(!variant.value||!year.value)return;
  const selectedEngine=engine.value!==""?engines[Number(engine.value)]||null:null;
  const candidate={
   variantId:variant.value,
   year:Number(year.value),
   fuelType:selectedEngine?selectedEngine.fuelType:null,
   engineSizeSimple:selectedEngine?selectedEngine.engineSizeSimple:null,
   notes:String(document.getElementById("ef-note").value||"").trim()||null,
   make:make.value,
   modelFamily:model.value,
   variant:variant.options[variant.selectedIndex]?.textContent||null
  };
  const key=[candidate.variantId,candidate.year,candidate.fuelType||"",candidate.engineSizeSimple??""].join("|");
  const duplicate=fitments.some(item=>[item.variantId,item.year,item.fuelType||"",item.engineSizeSimple??""].join("|")===key);
  if(duplicate){fail("That exact vehicle is already in the fitment list.");return;}
  fitments.push(candidate);
  UI.closeModal();
  onChange();
 });
 try{
  const result=await C.api("/vehicle-catalogue?level=makes");
  make.innerHTML="<option value=\"\">Choose make</option>"+options(result.items||[],"","");
 }catch(error){fail(error.message);}
};

const createDonorModal=async(onCreated)=>{
 let vehicle=null;
 UI.modal("Add donor vehicle",
  "<p class=\"subtle\">Use the vehicle the part was physically removed from. Registration lookup can prefill details when the provider is available.</p>"+
  "<div class=\"form-grid\">"+
   "<label class=\"label\">Registration <span class=\"subtle\">(optional)</span><div class=\"search-row\"><input id=\"donor-reg\" class=\"input registration\" maxlength=\"10\"/><button id=\"donor-lookup\" class=\"secondary\" type=\"button\">Look up</button></div></label>"+
   "<label class=\"label\">Make<input id=\"donor-make\" class=\"input\" maxlength=\"80\" required/></label>"+
   "<label class=\"label\">Model<input id=\"donor-model\" class=\"input\" maxlength=\"120\" required/></label>"+
   "<label class=\"label\">Variant <span class=\"subtle\">(optional)</span><input id=\"donor-variant\" class=\"input\" maxlength=\"160\"/></label>"+
   "<label class=\"label\">Year<input id=\"donor-year\" class=\"input\" type=\"number\" min=\"1900\" max=\"2100\" required/></label>"+
   "<label class=\"label\">Engine cc <span class=\"subtle\">(optional)</span><input id=\"donor-engine\" class=\"input\" type=\"number\" min=\"100\" max=\"10000\"/></label>"+
   "<label class=\"label\">Fuel <span class=\"subtle\">(optional)</span><input id=\"donor-fuel\" class=\"input\" maxlength=\"80\"/></label>"+
   "<label class=\"label\">Colour <span class=\"subtle\">(optional)</span><input id=\"donor-colour\" class=\"input\" maxlength=\"80\"/></label>"+
   "<button id=\"donor-save\" class=\"primary wide\" type=\"button\">Save donor vehicle</button>"+
   "<div id=\"donor-status\"></div>"+
  "</div>"
 );
 const status=document.getElementById("donor-status");
 document.getElementById("donor-lookup").addEventListener("click",async()=>{
  const registration=String(document.getElementById("donor-reg").value||"").trim();
  if(!registration){status.innerHTML="<div class=\"status warning\">Enter a registration first.</div>";return;}
  try{
   const result=await C.api("/vehicle-lookup",{method:"POST",body:{registration}});
   vehicle=result.vehicle;
   document.getElementById("donor-reg").value=result.registration||registration;
   document.getElementById("donor-make").value=vehicle.make||"";
   document.getElementById("donor-model").value=vehicle.model||"";
   document.getElementById("donor-year").value=vehicle.year||"";
   document.getElementById("donor-engine").value=vehicle.engineSizeSimple||"";
   document.getElementById("donor-fuel").value=vehicle.fuelType||"";
   document.getElementById("donor-colour").value=vehicle.colour||"";
   status.innerHTML="<div class=\"status success\">Vehicle found. Review the details before saving.</div>";
  }catch(error){status.innerHTML="<div class=\"status warning\">"+C.escapeHtml(error.message)+" You can still enter donor details manually.</div>";}
 });
 document.getElementById("donor-save").addEventListener("click",async()=>{
  const body={
   registration:String(document.getElementById("donor-reg").value||"").trim(),
   make:String(document.getElementById("donor-make").value||"").trim(),
   model:String(document.getElementById("donor-model").value||"").trim(),
   variant:String(document.getElementById("donor-variant").value||"").trim(),
   year:Number(document.getElementById("donor-year").value),
   engineSizeSimple:document.getElementById("donor-engine").value?Number(document.getElementById("donor-engine").value):null,
   fuelType:String(document.getElementById("donor-fuel").value||"").trim(),
   colour:String(document.getElementById("donor-colour").value||"").trim()
  };
  try{
   const result=await C.api("/seller/donors",{method:"POST",auth:true,body});
   UI.closeModal();UI.toast("Donor vehicle saved.");
   if(onCreated)await onCreated(result.id);
  }catch(error){status.innerHTML="<div class=\"status error\">"+C.escapeHtml(errorText(error.code||error.message))+"</div>";}
 });
};

const listingEditor=async(payload={})=>{
 if(!await UI.requireAuth("listingEditor"))return;
 if(!C.state.me)await C.loadMe();
 if(!C.state.me?.seller){UI.empty("□","Seller profile required","Enable selling before creating listings.","Account",()=>UI.route("account"));return;}

 UI.loading(payload.id?"Loading listing":"Preparing new listing");
 let categories=[],donors=[],item=null;
 try{
  const tasks=[C.api("/categories"),C.api("/seller/donors",{auth:true})];
  if(payload.id)tasks.push(C.api("/seller/listings/"+encodeURIComponent(payload.id),{auth:true}));
  const result=await Promise.all(tasks);
  categories=result[0].items||[];
  donors=result[1].items||[];
  item=payload.id?result[2].item:null;
 }catch(error){UI.empty("□","Listing editor unavailable",error.message,"Back to inventory",()=>UI.route("inventory"));return;}

 let fitments=(item?.catalogueFitments||[]).map(value=>({...value}));
 const selectedCategory=()=>categories.find(value=>value.id===document.getElementById("le-category")?.value);
 const readinessMissing=item?.publishReadiness?.missing||[];
 const readinessText=readinessMissing.map(value=>
  value==="real_product_photo"
   ?"add at least one real product photo"
   :"add donor / exact fitment / OE-OEM / manufacturer part number"
 ).join(" · ")||"complete the required evidence";
 const html=[];
 html.push("<button class=\"back\" id=\"listing-editor-back\" type=\"button\">‹ Back to inventory</button>");
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Seller listing</p><h2>"+(item?"Edit part":"Create part")+"</h2><p>Keep it simple: identify the part, tell us the donor if known, then add real photos.</p></div></div>");
 html.push("<form id=\"listing-editor-form\" class=\"form-grid\">"+
  "<section class=\"card\"><p class=\"eyebrow\">Part</p>"+
   "<label class=\"label\">Title<input id=\"le-title\" class=\"input\" maxlength=\"180\" value=\""+C.escapeHtml(item?.title||"")+"\" placeholder=\"e.g. Vauxhall Astra front left headlight\"/></label>"+
   "<label class=\"label\" style=\"display:block;margin-top:10px\">Category<select id=\"le-category\" class=\"select\"><option value=\"\">Choose specific category</option>"+categoryOptions(categories,item?.categoryId)+"</select></label>"+
   "<label class=\"label\" style=\"display:block;margin-top:10px\">Description<textarea id=\"le-description\" class=\"textarea\" maxlength=\"5000\" placeholder=\"Condition, what is included, important identifiers and anything the buyer should know.\">"+C.escapeHtml(item?.description||"")+"</textarea></label>"+
   "<div class=\"spec-grid\" style=\"margin-top:10px\"><label class=\"label\">Condition<select id=\"le-condition\" class=\"select\"><option value=\"used\">Used</option><option value=\"reconditioned\">Reconditioned</option><option value=\"new\">New</option></select></label><label class=\"label\">Testing<select id=\"le-testing\" class=\"select\"><option value=\"tested_working\">Tested working</option><option value=\"removed_from_running_vehicle\">Removed from running vehicle</option><option value=\"visually_inspected\">Visually inspected</option><option value=\"untested\">Untested</option><option value=\"not_specified\">Not specified</option></select></label></div>"+
  "</section>"+
  "<section class=\"card\"><p class=\"eyebrow\">1 · Donor vehicle</p><p class=\"subtle\">If this is a used part, linking the vehicle it came from gives buyers a useful family-level compatibility signal.</p><label class=\"label\">Vehicle<select id=\"le-donor\" class=\"select\">"+donorOptions(donors,item?.donorVehicleId||"")+"</select></label><button id=\"le-add-donor\" class=\"link-button\" type=\"button\" style=\"margin-top:8px\">+ Add donor vehicle</button></section>"+
  "<section class=\"card\"><p class=\"eyebrow\">2 · Identify the part</p><p class=\"subtle\">Enter numbers you can actually read. Do not guess.</p><label class=\"label\">OE/OEM number<input id=\"le-oem\" class=\"input\" maxlength=\"160\" value=\""+C.escapeHtml(item?.oemNumber||"")+"\"></label><div class=\"spec-grid\" style=\"margin-top:10px\"><label class=\"label\">Manufacturer / brand<input id=\"le-manufacturer\" class=\"input\" maxlength=\"160\" value=\""+C.escapeHtml(item?.manufacturer||"")+"\"></label><label class=\"label\">Manufacturer part number<input id=\"le-part-number\" class=\"input\" maxlength=\"160\" value=\""+C.escapeHtml(item?.partNumber||"")+"\"></label></div><div id=\"le-transmission\" style=\"margin-top:10px\"><div class=\"spec-grid\"><label class=\"label\">Gearbox family<input id=\"le-gearbox-family\" class=\"input\" maxlength=\"80\" value=\""+C.escapeHtml(item?.gearboxFamily||"")+"\"></label><label class=\"label\">Gearbox code<input id=\"le-gearbox-code\" class=\"input\" maxlength=\"80\" value=\""+C.escapeHtml(item?.gearboxCode||"")+"\"></label></div></div></section>"+
  "<section class=\"card\"><p class=\"eyebrow\">3 · Other confirmed vehicles <span class=\"subtle\">(optional)</span></p><p class=\"subtle\">Only add exact vehicles when you can support the fitment.</p><div id=\"le-fitments\"></div><button id=\"le-add-fitment\" class=\"secondary small-button\" type=\"button\">+ Add confirmed vehicle</button></section>"+
  "<section class=\"card\"><p class=\"eyebrow\">Selling details</p><div class=\"spec-grid\"><label class=\"label\">Price £<input id=\"le-price\" class=\"input\" type=\"number\" min=\"0\" step=\"0.01\" value=\""+C.escapeHtml(item?Number(item.pricePence||0)/100:"")+"\"></label><label class=\"label\">Stock<input id=\"le-stock\" class=\"input\" type=\"number\" min=\"0\" value=\""+C.escapeHtml(item?.stock??1)+"\"></label><label class=\"label\">Delivery £<input id=\"le-shipping\" class=\"input\" type=\"number\" min=\"0\" step=\"0.01\" value=\""+C.escapeHtml(item?Number(item.shippingPence||0)/100:"0")+"\"></label><label class=\"label\">Dispatch days<input id=\"le-dispatch\" class=\"input\" type=\"number\" min=\"0\" max=\"30\" value=\""+C.escapeHtml(item?.dispatchDays??2)+"\"></label><label class=\"label\">Warranty days<input id=\"le-warranty\" class=\"input\" type=\"number\" min=\"0\" max=\"730\" value=\""+C.escapeHtml(item?.warrantyDays??0)+"\"></label><label class=\"label\" style=\"align-self:end\"><span style=\"display:flex;align-items:center;gap:8px\"><input id=\"le-collection\" type=\"checkbox\" "+(item?.collectionAvailable?"checked":"")+"> Collection available</span></label></div><details style=\"margin-top:10px\"><summary class=\"link-button\">Condition & delivery details</summary><div class=\"form-grid\"><label class=\"label\">Condition notes<textarea id=\"le-condition-notes\" class=\"textarea\" maxlength=\"500\">"+C.escapeHtml(item?.conditionNotes||"")+"</textarea></label><label class=\"label\">Damage notes<textarea id=\"le-damage-notes\" class=\"textarea\" maxlength=\"500\">"+C.escapeHtml(item?.damageNotes||"")+"</textarea></label><div class=\"spec-grid\"><label class=\"label\">Delivery min days<input id=\"le-delivery-min\" class=\"input\" type=\"number\" min=\"0\" max=\"30\" value=\""+C.escapeHtml(item?.deliveryDaysMin??"")+"\"></label><label class=\"label\">Delivery max days<input id=\"le-delivery-max\" class=\"input\" type=\"number\" min=\"0\" max=\"30\" value=\""+C.escapeHtml(item?.deliveryDaysMax??"")+"\"></label></div></div></details></section>"+
  (item?"<section class=\"card\"><p class=\"eyebrow\">Photos & publishing</p>"+(item.publishReadiness?.ready?"<div class=\"status success\">Ready to publish: real photo and compatibility / part identity evidence are present.</div>":"<div class=\"status warning\">Before publishing: "+C.escapeHtml(readinessText)+"</div>")+"<p class=\"subtle\" style=\"margin-top:8px\">"+C.escapeHtml(item.imageCount||0)+" product photo(s) currently attached.</p><div class=\"button-row\" style=\"margin-top:10px\"><button id=\"le-photos\" class=\"secondary\" type=\"button\">Manage photos</button>"+(item.status==="active"?"<button id=\"le-save\" class=\"primary\" type=\"button\">Save changes</button><button id=\"le-draft\" class=\"secondary\" type=\"button\">Move to draft</button>":"<button id=\"le-save\" class=\"secondary\" type=\"button\">Save draft</button><button id=\"le-publish\" class=\"lime-button\" type=\"button\">Publish listing</button>")+"</div><div id=\"le-status\" style=\"margin-top:10px\"></div></section>":"<section class=\"card\"><p class=\"eyebrow\">Next step</p><p class=\"subtle\">Create the draft first. Then the app will let you take real product photos before publishing.</p><button id=\"le-create\" class=\"primary wide\" type=\"button\">Create draft & add photos</button><div id=\"le-status\" style=\"margin-top:10px\"></div></section>")+
 "</form>");
 UI.app.innerHTML=html.join("");
 document.getElementById("le-condition").value=item?.condition||"used";
 document.getElementById("le-testing").value=item?.testingStatus||"not_specified";

 const renderTransmission=()=>{
  const category=selectedCategory();
  document.getElementById("le-transmission").style.display=category?.isTransmissionRelated?"block":"none";
 };
 const renderFitments=()=>{
  const node=document.getElementById("le-fitments");
  node.innerHTML=fitments.length?fitments.map((fitment,index)=>"<div class=\"status info\" style=\"display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:7px\"><span>"+C.escapeHtml(fitmentLabel(fitment))+"</span><button type=\"button\" class=\"link-button\" data-remove-fitment=\""+index+"\">Remove</button></div>").join(""):"<p class=\"subtle\">No additional exact fitments. That is fine.</p>";
  node.querySelectorAll("[data-remove-fitment]").forEach(button=>button.addEventListener("click",()=>{fitments.splice(Number(button.dataset.removeFitment),1);renderFitments();}));
 };
 renderTransmission();renderFitments();
 document.getElementById("le-category").addEventListener("change",renderTransmission);
 document.getElementById("le-add-fitment").addEventListener("click",()=>void addExactFitment(fitments,renderFitments));
 document.getElementById("le-add-donor").addEventListener("click",()=>void createDonorModal(async id=>{
  const result=await C.api("/seller/donors",{auth:true});donors=result.items||[];
  const select=document.getElementById("le-donor");if(select){select.innerHTML=donorOptions(donors,id);select.value=id;}
 }));

 const formBody=()=>({
  title:String(document.getElementById("le-title").value||"").trim(),
  description:String(document.getElementById("le-description").value||"").trim(),
  categoryId:document.getElementById("le-category").value,
  donorVehicleId:document.getElementById("le-donor").value||null,
  condition:document.getElementById("le-condition").value,
  testingStatus:document.getElementById("le-testing").value,
  oemNumber:String(document.getElementById("le-oem").value||"").trim(),
  manufacturer:String(document.getElementById("le-manufacturer").value||"").trim(),
  partNumber:String(document.getElementById("le-part-number").value||"").trim(),
  gearboxFamily:String(document.getElementById("le-gearbox-family").value||"").trim(),
  gearboxCode:String(document.getElementById("le-gearbox-code").value||"").trim(),
  pricePence:Math.round(Number(document.getElementById("le-price").value||0)*100),
  shippingPence:Math.round(Number(document.getElementById("le-shipping").value||0)*100),
  stock:Number(document.getElementById("le-stock").value||0),
  dispatchDays:Number(document.getElementById("le-dispatch").value||2),
  warrantyDays:Number(document.getElementById("le-warranty").value||0),
  collectionAvailable:document.getElementById("le-collection").checked,
  conditionNotes:String(document.getElementById("le-condition-notes").value||"").trim(),
  damageNotes:String(document.getElementById("le-damage-notes").value||"").trim(),
  deliveryDaysMin:document.getElementById("le-delivery-min").value?Number(document.getElementById("le-delivery-min").value):null,
  deliveryDaysMax:document.getElementById("le-delivery-max").value?Number(document.getElementById("le-delivery-max").value):null,
  catalogueFitments:fitments.map(value=>({
   variantId:value.variantId,year:value.year,fuelType:value.fuelType||null,
   engineSizeSimple:value.engineSizeSimple??null,notes:value.notes||null
  }))
 });
 const status=document.getElementById("le-status");
 const showError=error=>{status.innerHTML="<div class=\"status error\">"+C.escapeHtml(errorText(error.code||error.message))+"</div>";};

 const patch=async(nextStatus)=>{
  try{
   const result=await C.api("/seller/listings/"+encodeURIComponent(item.id),{method:"PATCH",auth:true,body:{...formBody(),status:nextStatus}});
   UI.toast(nextStatus==="active"?"Listing published / updated.":"Draft saved.");
   await UI.route("listingEditor",{id:result.id});
  }catch(error){showError(error);}
 };

 if(item){
  document.getElementById("le-photos").addEventListener("click",()=>void openListingPhotos({id:item.id,title:String(document.getElementById("le-title").value||item.title)}));
  document.getElementById("le-save").addEventListener("click",()=>void patch(item.status==="active"?"active":"draft"));
  const publish=document.getElementById("le-publish");if(publish)publish.addEventListener("click",()=>void patch("active"));
  const draft=document.getElementById("le-draft");if(draft)draft.addEventListener("click",()=>void patch("draft"));
 }else{
  document.getElementById("le-create").addEventListener("click",async()=>{
   const button=document.getElementById("le-create");button.disabled=true;button.textContent="Creating draft…";
   try{
    const result=await C.api("/seller/listings",{method:"POST",auth:true,body:formBody()});
    UI.toast("Draft created. Add real product photos next.");
    await UI.route("listingEditor",{id:result.id});
    window.setTimeout(()=>void openListingPhotos({id:result.id,title:String(document.getElementById("le-title")?.value||"New listing")}),100);
   }catch(error){showError(error);button.disabled=false;button.textContent="Create draft & add photos";}
  });
 }
};

UI.register("cases",cases);
UI.register("inventory",inventory);
UI.register("listingEditor",listingEditor);

window.SecondPartMedia=Object.freeze({
 openEvidence,
 openListingPhotos
});
})();