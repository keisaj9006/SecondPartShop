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
 document.getElementById("inventory-new").addEventListener("click",()=>void C.Native.openBrowser(C.config.webBaseUrl.replace(/\/$/,"")+"/dashboard/listings/new"));
 UI.app.querySelectorAll("[data-listing-photos]").forEach(button=>button.addEventListener("click",()=>{
  const item=items.find(value=>value.id===button.dataset.listingPhotos);
  if(item)void openListingPhotos(item);
 }));
 UI.app.querySelectorAll("[data-listing-edit]").forEach(button=>button.addEventListener("click",()=>void C.Native.openBrowser(C.config.webBaseUrl.replace(/\/$/,"")+"/dashboard/listings/"+encodeURIComponent(button.dataset.listingEdit)+"/edit")));
};

UI.register("cases",cases);
UI.register("inventory",inventory);

window.SecondPartMedia=Object.freeze({
 openEvidence,
 openListingPhotos
});
})();