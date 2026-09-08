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
 const pageSize=40;
 let items=[];
 let hasMore=false;
 let searchText="";

 const fetchPage=async(offset,query=searchText)=>{
  const params=new URLSearchParams({limit:String(pageSize),offset:String(offset)});
  if(query.trim())params.set("q",query.trim());
  const result=await C.api("/seller/donors?"+params.toString(),{auth:true});
  return {items:result.items||[],hasMore:Boolean(result.pagination&&result.pagination.hasMore)};
 };

 const render=()=>{
  const html=[];
  html.push("<button class=\"back\" id=\"seller-donors-back\" type=\"button\">‹ Back to seller account</button>");
  html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Seller inventory</p><h2>Donor vehicles</h2><p>Add a source vehicle once, then reuse it across parts removed from the same car.</p></div></div>");
  html.push("<section class=\"card\"><p class=\"eyebrow\">Add donor vehicle</p><form id=\"donor-manager-form\" class=\"form-grid\" style=\"margin-top:10px\"><label class=\"label\">Registration <span class=\"subtle\">(optional)</span><div class=\"search-row\"><input id=\"dm-reg\" class=\"input registration\" maxlength=\"10\"><button id=\"dm-lookup\" class=\"secondary\" type=\"button\">Look up</button></div></label><div id=\"dm-lookup-status\"></div><div class=\"spec-grid\"><label class=\"label\">Make<input id=\"dm-make\" class=\"input\" maxlength=\"80\" required></label><label class=\"label\">Model<input id=\"dm-model\" class=\"input\" maxlength=\"120\" required></label><label class=\"label\">Variant <span class=\"subtle\">(optional)</span><input id=\"dm-variant\" class=\"input\" maxlength=\"160\"></label><label class=\"label\">Year<input id=\"dm-year\" class=\"input\" type=\"number\" min=\"1900\" max=\"2100\" required></label><label class=\"label\">Engine cc <span class=\"subtle\">(optional)</span><input id=\"dm-engine\" class=\"input\" type=\"number\" min=\"100\" max=\"10000\"></label><label class=\"label\">Fuel <span class=\"subtle\">(optional)</span><input id=\"dm-fuel\" class=\"input\" maxlength=\"80\"></label><label class=\"label\">Colour <span class=\"subtle\">(optional)</span><input id=\"dm-colour\" class=\"input\" maxlength=\"80\"></label></div><label class=\"label\">Private seller notes <span class=\"subtle\">(optional)</span><textarea id=\"dm-notes\" class=\"textarea\" maxlength=\"1000\" placeholder=\"Internal notes about the donor vehicle.\"></textarea></label><div id=\"dm-status\"></div><button id=\"dm-save\" class=\"primary wide\" type=\"submit\">Save donor vehicle</button></form></section>");

  html.push("<section style=\"margin-top:16px\"><p class=\"eyebrow\">Saved donor vehicles</p><form id=\"donor-search-form\" class=\"search-row\" style=\"margin-top:10px\"><input id=\"donor-search\" class=\"input\" maxlength=\"80\" value=\""+C.escapeHtml(searchText)+"\" placeholder=\"Registration, make, model or variant\"><button class=\"secondary\" type=\"submit\">Search</button></form>"+(searchText?"<button id=\"donor-clear-search\" class=\"link-button\" style=\"margin-top:8px\" type=\"button\">Clear donor search</button>":"")+"</section>");

  if(items.length){
   html.push("<section>"+items.map(item=>"<article class=\"order-card\" style=\"margin-top:10px\"><div class=\"row-between\"><div>"+(item.registration?"<p class=\"eyebrow\">"+C.escapeHtml(item.registration)+"</p>":"")+"<h3 style=\"margin:3px 0\">"+C.escapeHtml(item.make+" "+item.model)+"</h3><p class=\"subtle\">"+C.escapeHtml(donorSummary(item))+"</p>"+(item.notes?"<p class=\"subtle\" style=\"margin-top:7px\">"+C.escapeHtml(item.notes)+"</p>":"")+"</div><div class=\"button-row\"><button class=\"lime-button small-button\" data-donor-listing=\""+C.escapeHtml(item.id)+"\" type=\"button\">Add part</button><button class=\"danger-button small-button\" data-donor-delete=\""+C.escapeHtml(item.id)+"\" type=\"button\">Delete</button></div></div></article>").join("")+"</section>");
   if(hasMore)html.push("<button id=\"donors-more\" class=\"secondary wide\" style=\"margin-top:14px\" type=\"button\">Load more donor vehicles</button>");
  }else{
   html.push("<div class=\"empty\" style=\"margin-top:16px\"><div class=\"empty-icon\">▱</div><h3>"+(searchText?"No matching donor vehicles":"No donor vehicles yet")+"</h3><p>"+(searchText?"Try a different donor search.":"Add the first donor vehicle to speed up listing multiple parts from the same car.")+"</p></div>");
  }

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

  document.getElementById("donor-search-form").addEventListener("submit",async event=>{
   event.preventDefault();
   searchText=String(document.getElementById("donor-search").value||"").trim();
   UI.loading("Searching donor vehicles");
   try{
    const page=await fetchPage(0,searchText);
    items=page.items;hasMore=page.hasMore;render();
   }catch(error){UI.empty("▱","Donor vehicles unavailable",error.message,"Try again",()=>UI.route("sellerDonors"));}
  });

  const clear=document.getElementById("donor-clear-search");
  if(clear)clear.addEventListener("click",async()=>{
   searchText="";
   UI.loading("Loading donor vehicles");
   try{
    const page=await fetchPage(0,"");
    items=page.items;hasMore=page.hasMore;render();
   }catch(error){UI.empty("▱","Donor vehicles unavailable",error.message,"Try again",()=>UI.route("sellerDonors"));}
  });

  const more=document.getElementById("donors-more");
  if(more)more.addEventListener("click",async()=>{
   more.disabled=true;more.textContent="Loading…";
   try{
    const page=await fetchPage(items.length);
    const known=new Set(items.map(item=>item.id));
    items.push(...page.items.filter(item=>!known.has(item.id)));
    hasMore=page.hasMore;render();
   }catch(error){UI.toast(error.message,"error");more.disabled=false;more.textContent="Load more donor vehicles";}
  });

  UI.app.querySelectorAll("[data-donor-listing]").forEach(button=>button.addEventListener("click",()=>UI.route("listingEditor",{donorId:button.dataset.donorListing})));
  UI.app.querySelectorAll("[data-donor-delete]").forEach(button=>button.addEventListener("click",async()=>{button.disabled=true;try{await C.api("/seller/donors?id="+encodeURIComponent(button.dataset.donorDelete),{method:"DELETE",auth:true});C.invalidateCache("/seller/donors");UI.toast("Donor vehicle deleted.");UI.route("sellerDonors");}catch(error){UI.toast(error.message,"error");button.disabled=false;}}));
 };

 try{
  const page=await fetchPage(0);
  items=page.items;hasMore=page.hasMore;
 }catch(error){UI.empty("▱","Donor vehicles unavailable",error.message,"Try again",()=>UI.route("sellerDonors"));return;}

 render();
};

const sellerRequests=async()=>{
 if(!await requireSeller("sellerRequests"))return;
 UI.loading("Loading matched buyer requests");
 const pageSize=24;
 let items=[];
 let hasMore=false;

 const fetchPage=async(offset)=>{
  const result=await C.api("/seller/requests?limit="+pageSize+"&offset="+offset,{auth:true});
  return {items:result.items||[],hasMore:Boolean(result.pagination&&result.pagination.hasMore)};
 };
 const vehicle=item=>[item.vehicleMake&&item.vehicleModel?item.vehicleMake+" "+item.vehicleModel:null,item.year,item.vehicleVariant,item.engineSizeSimple?item.engineSizeSimple+"cc":null,item.fuelType].filter(Boolean).join(" · ");
 const matchLabel=item=>Number(item.matchScore)>=100?"Strong match":Number(item.matchScore)>=60?"Good match":"Relevant match";

 const render=()=>{
  UI.app.innerHTML="<button class=\"back\" id=\"seller-requests-back\" type=\"button\">‹ Back to seller account</button><div class=\"section-head\"><div><p class=\"eyebrow\">Buyer demand</p><h2>Matched part requests</h2><p>"+items.length+" request"+(items.length===1?"":"s")+" loaded. SecondPart routes only relevant demand based on inventory, donor vehicles and fitment evidence.</p></div></div>"+(items.length?"<section>"+items.map(item=>"<article class=\"order-card\" style=\"margin-top:10px\"><div><div class=\"chips\">"+(item.categoryName?"<span class=\"chip\">"+C.escapeHtml(item.categoryName)+"</span>":"")+"<span class=\"pill warning\">Open request</span><span class=\"chip green\">"+C.escapeHtml(matchLabel(item))+"</span></div><h3 style=\"margin:8px 0 0\">"+C.escapeHtml(item.queryText)+"</h3>"+(item.oemNumber?"<p class=\"subtle\">OE/OEM: <strong>"+C.escapeHtml(item.oemNumber)+"</strong></p>":"")+(vehicle(item)?"<p class=\"subtle\">"+C.escapeHtml(vehicle(item))+"</p>":"")+(item.notes?"<p class=\"subtle\" style=\"margin-top:8px\">"+C.escapeHtml(item.notes)+"</p>":"")+(Array.isArray(item.matchReasons)&&item.matchReasons.length?"<div class=\"status info\" style=\"margin-top:10px\"><strong>Why this matched</strong><br>"+C.escapeHtml(item.matchReasons.join(" · "))+"</div>":"")+"<p class=\"subtle\">Requested "+C.dateOnly(item.createdAt)+"</p><div class=\"button-row\" style=\"margin-top:10px\"><button class=\"primary small-button\" data-request-listing=\""+C.escapeHtml(item.id)+"\" type=\"button\">Create matching listing</button><button class=\"secondary small-button\" data-request-dismiss=\""+C.escapeHtml(item.id)+"\" type=\"button\">Not relevant · Dismiss</button></div></div></article>").join("")+"</section>"+(hasMore?"<button id=\"seller-requests-more\" class=\"secondary wide\" style=\"margin-top:14px\" type=\"button\">Load more buyer requests</button>":""):"<div class=\"empty\"><div class=\"empty-icon\">⌕</div><h3>No matched buyer requests</h3><p>New demand will appear here when SecondPart finds a relevant match for your inventory or donor vehicles.</p></div>");

  document.getElementById("seller-requests-back").addEventListener("click",()=>{C.state.accountMode="selling";UI.route("account",{view:"selling"});});
  UI.app.querySelectorAll("[data-request-listing]").forEach(button=>button.addEventListener("click",()=>{const item=items.find(value=>value.id===button.dataset.requestListing);if(item)UI.route("listingEditor",{requestLead:item});}));
  UI.app.querySelectorAll("[data-request-dismiss]").forEach(button=>button.addEventListener("click",async()=>{
   button.disabled=true;
   try{
    await C.api("/seller/requests",{method:"PATCH",auth:true,body:{requestId:button.dataset.requestDismiss,action:"dismiss"}});
    items=items.filter(item=>item.id!==button.dataset.requestDismiss);
    UI.toast("Request dismissed.");
    render();
   }catch(error){UI.toast(error.message,"error");button.disabled=false;}
  }));

  const more=document.getElementById("seller-requests-more");
  if(more)more.addEventListener("click",async()=>{
   more.disabled=true;more.textContent="Loading…";
   try{
    const page=await fetchPage(items.length);
    const known=new Set(items.map(item=>item.id));
    items.push(...page.items.filter(item=>!known.has(item.id)));
    hasMore=page.hasMore;
    render();
   }catch(error){UI.toast(error.message,"error");more.disabled=false;more.textContent="Load more buyer requests";}
  });
 };

 try{
  const page=await fetchPage(0);
  items=page.items;hasMore=page.hasMore;
 }catch(error){UI.empty("⌕","Buyer requests unavailable",error.message,"Try again",()=>UI.route("sellerRequests"));return;}

 render();
};


const sellerImports=async()=>{
 if(!await requireSeller("sellerImports"))return;
 UI.loading("Loading inventory imports");
 let history=[];
 try{history=(await C.api("/seller/imports?limit=20&offset=0",{auth:true})).items||[];}
 catch(error){UI.empty("⇧","Inventory imports unavailable",error.message,"Try again",()=>UI.route("sellerImports"));return;}

 const html=[];
 html.push("<button class=\"back\" id=\"seller-imports-back\" type=\"button\">‹ Back to seller dashboard</button>");
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Seller inventory</p><h2>Bulk CSV import</h2><p>Preview up to 2,000 rows, then import valid rows as drafts. CSV never publishes directly.</p></div></div>");
 html.push("<section class=\"card\"><p class=\"eyebrow\">Upload inventory CSV</p><label class=\"label\" style=\"display:block;margin-top:10px\">CSV file<input id=\"seller-import-file\" class=\"input\" type=\"file\" accept=\".csv,text/csv\" style=\"padding:12px\"></label><p class=\"subtle\">Maximum 8 MB. Required columns: title, description, category, price_gbp.</p><div class=\"button-row\" style=\"margin-top:12px\"><button id=\"seller-import-preview\" class=\"secondary small-button\" type=\"button\">Preview CSV</button><button id=\"seller-import-run\" class=\"primary small-button\" type=\"button\">Import valid rows as drafts</button><button id=\"seller-import-template\" class=\"link-button\" type=\"button\">CSV template</button></div><div id=\"seller-import-result\" style=\"margin-top:12px\"></div></section>");
 html.push("<div class=\"section-head\" style=\"margin-top:18px\"><div><p class=\"eyebrow\">Import history</p><h2>Recent batches</h2></div></div>");
 if(history.length){
  html.push(history.map(item=>"<article class=\"order-card\"><div class=\"row-between\"><div><p class=\"eyebrow\">"+C.escapeHtml(C.human(item.sourceChannel||"csv"))+"</p><h3 style=\"margin:4px 0\">"+C.escapeHtml(item.filename||"Inventory import")+"</h3><p class=\"subtle\">"+C.dateTime(item.createdAt)+"</p></div><span class=\"pill\">"+C.escapeHtml(C.human(item.status))+"</span></div><div class=\"spec-grid\" style=\"margin-top:10px\"><div class=\"spec\"><small>Rows</small><strong>"+C.escapeHtml(item.rowsReceived)+"</strong></div><div class=\"spec\"><small>Created</small><strong>"+C.escapeHtml(item.rowsCreated)+"</strong></div><div class=\"spec\"><small>Rejected</small><strong>"+C.escapeHtml(item.rowsRejected)+"</strong></div></div><button class=\"secondary wide\" style=\"margin-top:10px\" data-open-import=\""+C.escapeHtml(item.id)+"\" type=\"button\">Open import report</button></article>").join(""));
 }else html.push("<div class=\"empty\"><div class=\"empty-icon\">⇧</div><h3>No imports yet</h3><p>Your CSV, eBay or API import batches will appear here.</p></div>");

 UI.app.innerHTML=html.join("");
 document.getElementById("seller-imports-back").addEventListener("click",()=>UI.route("seller"));
 const resultNode=document.getElementById("seller-import-result");
 const preview=document.getElementById("seller-import-preview");
 const run=document.getElementById("seller-import-run");
 const renderResult=result=>{
  const status=result.status==="error"?"error":result.status==="success"?"success":"info";
  const sample=Array.isArray(result.sample)?result.sample:[];
  const issues=Array.isArray(result.issues)?result.issues:[];
  resultNode.innerHTML="<div class=\"status "+status+"\">"+C.escapeHtml(result.message||"Import check complete.")+"</div>"+
   (result.rowsReceived!==undefined?"<div class=\"spec-grid\" style=\"margin-top:10px\"><div class=\"spec\"><small>Rows</small><strong>"+C.escapeHtml(result.rowsReceived)+"</strong></div><div class=\"spec\"><small>Valid / created</small><strong>"+C.escapeHtml(result.validRows||0)+"</strong></div><div class=\"spec\"><small>Rejected</small><strong>"+C.escapeHtml(result.rejectedRows||0)+"</strong></div></div>":"")+
   (sample.length?"<div style=\"margin-top:10px\"><p class=\"eyebrow\">First rows</p>"+sample.map(item=>"<div class=\"status info\" style=\"margin-top:6px\"><strong>Row "+C.escapeHtml(item.row)+" · "+C.escapeHtml(item.title)+"</strong><div>"+C.escapeHtml(item.category)+" · £"+C.escapeHtml(item.priceGbp||"?")+(item.sellerReference?" · ref "+C.escapeHtml(item.sellerReference):"")+"</div></div>").join("")+"</div>":"")+
   (issues.length?"<details style=\"margin-top:10px\" open><summary class=\"link-button\">Issues to fix ("+C.escapeHtml(issues.length)+")</summary><div>"+issues.slice(0,40).map(issue=>"<div class=\"status error\" style=\"margin-top:6px\"><strong>Row "+C.escapeHtml(issue.row)+":</strong> "+C.escapeHtml(issue.message)+"</div>").join("")+"</div></details>":"");
 };
 const submitFile=async mode=>{
  const input=document.getElementById("seller-import-file");
  const file=input&&input.files?input.files[0]:null;
  if(!file){resultNode.innerHTML="<div class=\"status warning\">Choose a CSV file first.</div>";return;}
  preview.disabled=true;run.disabled=true;
  const originalPreview=preview.textContent,originalRun=run.textContent;
  if(mode==="preview")preview.textContent="Checking…";else run.textContent="Importing…";
  const formData=new FormData();
  formData.append("file",file,file.name);
  formData.append("mode",mode);
  try{
   const response=await C.apiForm("/seller/imports",{method:"POST",formData});
   const result=response.result||{};
   renderResult(result);
   if(mode==="import"&&result.batchId){
    C.invalidateCache("/seller/imports");
    C.invalidateCache("/seller/listings");
    UI.toast("CSV imported as drafts.");
    UI.route("sellerImport",{id:result.batchId});
    return;
   }
  }catch(error){
   resultNode.innerHTML="<div class=\"status error\">"+C.escapeHtml(error.message.replaceAll("_"," "))+"</div>";
  }finally{
   preview.disabled=false;run.disabled=false;preview.textContent=originalPreview;run.textContent=originalRun;
  }
 };
 preview.addEventListener("click",()=>void submitFile("preview"));
 run.addEventListener("click",()=>void submitFile("import"));
 document.getElementById("seller-import-template").addEventListener("click",()=>void C.Native.openBrowser(C.config.webBaseUrl.replace(/\/$/,"")+"/secondpart-bulk-import-template.csv"));
 UI.app.querySelectorAll("[data-open-import]").forEach(button=>button.addEventListener("click",()=>UI.route("sellerImport",{id:button.dataset.openImport})));
};

const sellerImport=async(payload={})=>{
 const id=String(payload.id||"");
 if(!id){UI.route("sellerImports");return;}
 if(!await requireSeller("sellerImport"))return;
 UI.loading("Loading import report");
 let data;
 try{data=(await C.api("/seller/imports/"+encodeURIComponent(id),{auth:true})).import;}
 catch(error){UI.empty("⇧","Import report unavailable",error.message,"Back to imports",()=>UI.route("sellerImports"));return;}
 if(!data){UI.route("sellerImports");return;}
 const ready=data.readiness||{};
 const issues=Array.isArray(data.issues)?data.issues:[];
 const html=[];
 html.push("<button class=\"back\" id=\"seller-import-back\" type=\"button\">‹ Import history</button>");
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">CSV import report</p><h2>"+C.escapeHtml(data.filename||"Inventory import")+"</h2><p>"+C.dateTime(data.createdAt)+"</p></div><span class=\"pill\">"+C.escapeHtml(C.human(data.status))+"</span></div>");
 html.push("<section class=\"card\"><div class=\"spec-grid\"><div class=\"spec\"><small>Rows received</small><strong>"+C.escapeHtml(data.rowsReceived)+"</strong></div><div class=\"spec\"><small>Drafts created</small><strong>"+C.escapeHtml(data.rowsCreated)+"</strong></div><div class=\"spec\"><small>Rejected</small><strong>"+C.escapeHtml(data.rowsRejected)+"</strong></div></div><div class=\"status info\" style=\"margin-top:10px\">Imported rows remain drafts until listing readiness is satisfied.</div></section>");
 html.push("<section class=\"card\" style=\"margin-top:12px\"><p class=\"eyebrow\">Draft readiness</p><div class=\"spec-grid\" style=\"margin-top:8px\"><div class=\"spec\"><small>Total drafts</small><strong>"+C.escapeHtml(ready.totalDrafts||0)+"</strong></div><div class=\"spec\"><small>Ready now</small><strong>"+C.escapeHtml(ready.readyDrafts||0)+"</strong></div><div class=\"spec\"><small>Need photos</small><strong>"+C.escapeHtml(ready.needsPhotos||0)+"</strong></div><div class=\"spec\"><small>Need compatibility</small><strong>"+C.escapeHtml(ready.needsCompatibility||0)+"</strong></div><div class=\"spec\"><small>Need technical</small><strong>"+C.escapeHtml(ready.needsTechnical||0)+"</strong></div><div class=\"spec\"><small>Need stock</small><strong>"+C.escapeHtml(ready.needsStock||0)+"</strong></div></div><div class=\"button-row\" style=\"margin-top:12px\"><button id=\"seller-import-review\" class=\"secondary small-button\" type=\"button\">Review imported drafts</button>"+(Number(ready.readyDrafts||0)>0?"<button id=\"seller-import-publish\" class=\"lime-button small-button\" type=\"button\">Publish ready drafts</button>":"")+"</div></section>");
 if(issues.length)html.push("<section class=\"card\" style=\"margin-top:12px\"><p class=\"eyebrow\">Rejected / warning rows</p>"+issues.slice(0,60).map(issue=>"<div class=\"status error\" style=\"margin-top:6px\"><strong>Row "+C.escapeHtml(issue.row)+":</strong> "+C.escapeHtml(issue.message)+"</div>").join("")+"</section>");
 UI.app.innerHTML=html.join("");
 document.getElementById("seller-import-back").addEventListener("click",()=>UI.route("sellerImports"));
 document.getElementById("seller-import-review").addEventListener("click",()=>UI.route("inventory",{importBatch:id}));
 const publish=document.getElementById("seller-import-publish");
 if(publish)publish.addEventListener("click",async()=>{
  publish.disabled=true;publish.textContent="Publishing…";
  try{
   const result=await C.api("/seller/imports/"+encodeURIComponent(id),{method:"POST",auth:true,body:{action:"publish_ready"}});
   C.invalidateCache("/seller/imports");C.invalidateCache("/seller/listings");C.invalidateCache("/marketplace");
   UI.toast(Number(result.published||0)+" ready listing(s) published.");
   UI.route("sellerImport",{id});
  }catch(error){UI.toast(error.message.replaceAll("_"," "),"error");publish.disabled=false;publish.textContent="Publish ready drafts";}
 });
};

UI.register("sellerDonors",sellerDonors);
UI.register("sellerRequests",sellerRequests);
UI.register("sellerImports",sellerImports);
UI.register("sellerImport",sellerImport);
})();