(()=>{
"use strict";

const UI=window.SecondPartUI;
const C=UI.C;

const account=async(payload)=>{
 await C.initializeSession();
 if(!C.state.session){renderAuth(payload&&payload.mode?payload.mode:"signin");return;}
 UI.loading("Loading account");
 if(!C.state.me)await C.loadMe();
 if(!C.state.me){await C.clearSession();renderAuth("signin");return;}

 const me=C.state.me;
 const profile=me.profile;
 const seller=me.seller;
 const sellingEnabled=Boolean(profile&&["seller","admin"].includes(profile.role));
 if(payload&&payload.view==="selling"&&sellingEnabled)C.state.accountMode="selling";
 if(payload&&payload.view==="buying")C.state.accountMode="buying";
 if(!sellingEnabled)C.state.accountMode="buying";
 const mode=C.state.accountMode;

 const html=[];
 html.push("<section class=\"account-hero\"><p class=\"eyebrow\" style=\"color:#d4f44d\">Your SecondPart account</p><h1>"+C.escapeHtml(profile?profile.displayName:"SecondPart member")+"</h1><p>"+C.escapeHtml(profile?"@"+profile.handle:"")+" · "+C.escapeHtml(me.user&&me.user.email?me.user.email:"")+"</p><p style=\"margin-top:10px;font-size:12px;color:rgba(255,255,255,.7)\">One login for buying and selling. Selling never removes your buyer features.</p>"+(!me.user.emailConfirmed?"<div class=\"status warning\" style=\"margin-top:12px\">Email confirmation is still pending.</div>":"")+"</section>");

 if(sellingEnabled){
  html.push("<div class=\"segmented\" style=\"margin-top:14px\"><button id=\"mode-buying\" class=\""+(mode==="buying"?"active":"")+"\" type=\"button\">Buying</button><button id=\"mode-selling\" class=\""+(mode==="selling"?"active":"")+"\" type=\"button\">Selling</button></div>");
 }

 if(mode==="buying"){
  html.push("<section class=\"account-grid\" style=\"margin-top:14px\"><button class=\"account-tile\" id=\"account-saved\" type=\"button\"><strong>Saved parts</strong><small>Parts you want to come back to.</small></button><button class=\"account-tile\" id=\"account-notifications\" type=\"button\"><strong>Notifications</strong><small>"+C.escapeHtml(C.state.unreadNotifications)+" unread marketplace update(s).</small></button><button class=\"account-tile\" id=\"account-garage\" type=\"button\"><strong>Garage</strong><small>Your saved vehicles and compatibility filters.</small></button><button class=\"account-tile\" id=\"account-orders\" type=\"button\"><strong>Purchases</strong><small>Payment, delivery and buyer protection.</small></button><button class=\"account-tile\" id=\"account-cases\" type=\"button\"><strong>Returns & cases</strong><small>Cancellations, returns, disputes and private photo evidence.</small></button><button class=\"account-tile\" id=\"account-inbox\" type=\"button\"><strong>Part questions</strong><small>Questions with sellers and buyers.</small></button></section>");
  if(!sellingEnabled)html.push("<section class=\"card\" style=\"margin-top:14px\"><p class=\"eyebrow\">Want to sell too?</p><h3 style=\"margin:5px 0\">Enable selling on this account</h3><p class=\"subtle\">Keep the same login, Garage, purchases and reviews. Add a private seller or business / garage profile.</p><button id=\"account-start-selling\" class=\"lime-button wide\" style=\"margin-top:12px\" type=\"button\">Start selling</button></section>");
 }else{
  if(!seller){
   html.push("<section class=\"card\" style=\"margin-top:14px\"><p class=\"eyebrow\">Selling setup</p><h3 style=\"margin:5px 0\">Finish your seller profile</h3><p class=\"subtle\">Your account can still buy parts. Complete seller details to publish listings and receive sales.</p><button id=\"account-finish-selling\" class=\"lime-button wide\" style=\"margin-top:12px\" type=\"button\">Finish seller setup</button></section>");
  }else{
   html.push("<section class=\"account-grid\" style=\"margin-top:14px\"><button class=\"account-tile\" id=\"account-seller\" type=\"button\"><strong>Seller dashboard</strong><small>Readiness, sales, payouts, fulfilment and cases.</small></button><button class=\"account-tile\" id=\"account-inventory\" type=\"button\"><strong>Inventory</strong><small>Create, edit and photograph listings.</small></button><button class=\"account-tile\" id=\"account-seller-profile\" type=\"button\"><strong>Seller profile</strong><small>Edit your public seller identity and location.</small></button>"+(seller.sellerType==="business"?"<button class=\"account-tile\" id=\"account-seller-verification\" type=\"button\"><strong>Business verification</strong><small>"+(seller.verified?"Verified business":"Verification status and request")+".</small></button>":"")+"<button class=\"account-tile\" id=\"account-reviews\" type=\"button\"><strong>Reviews</strong><small>Rate completed buyers and see review opportunities.</small></button><button class=\"account-tile\" id=\"account-inbox\" type=\"button\"><strong>Buyer questions</strong><small>Pre-purchase messages about your parts.</small></button><button class=\"account-tile\" id=\"account-notifications\" type=\"button\"><strong>Seller notifications</strong><small>"+C.escapeHtml(C.state.unreadNotifications)+" unread update(s).</small></button><button class=\"account-tile\" id=\"account-cases\" type=\"button\"><strong>Returns & cases</strong><small>Transaction problems and evidence.</small></button><button class=\"account-tile\" id=\"account-new-listing\" type=\"button\"><strong>Create listing</strong><small>Add a part directly from the app.</small></button></section>");
  }
 }

 if(profile)html.push("<section class=\"card\" style=\"margin-top:12px\"><p class=\"eyebrow\">Account capabilities</p><div class=\"spec-grid\"><div class=\"spec\"><small>Buying</small><strong>Enabled</strong></div><div class=\"spec\"><small>Selling</small><strong>"+(sellingEnabled?"Enabled":"Not enabled")+"</strong></div></div>"+(seller?"<div class=\"status "+(seller.verified?"success":"info")+"\" style=\"margin-top:10px\">"+C.escapeHtml(seller.businessName)+" · "+(seller.verified?"Verified business":seller.sellerType==="business"?"Business verification not complete":"Private seller profile")+"</div>":"")+"</section>");

 html.push("<div class=\"button-row\" style=\"margin-top:14px\"><button id=\"account-web\" class=\"secondary small-button\" type=\"button\">Profile & security on web</button><button id=\"account-signout\" class=\"danger-button small-button\" type=\"button\">Sign out</button></div>");
 UI.app.innerHTML=html.join("");

 const buying=document.getElementById("mode-buying");if(buying)buying.addEventListener("click",()=>{C.state.accountMode="buying";UI.route("account",{view:"buying"});});
 const selling=document.getElementById("mode-selling");if(selling)selling.addEventListener("click",()=>{C.state.accountMode="selling";UI.route("account",{view:"selling"});});
 const saved=document.getElementById("account-saved");if(saved)saved.addEventListener("click",()=>UI.route("saved"));
 const notifications=document.getElementById("account-notifications");if(notifications)notifications.addEventListener("click",()=>UI.route("notifications"));
 const garage=document.getElementById("account-garage");if(garage)garage.addEventListener("click",()=>UI.route("garage"));
 const orders=document.getElementById("account-orders");if(orders)orders.addEventListener("click",()=>UI.route("orders"));
 const reviewsButton=document.getElementById("account-reviews");if(reviewsButton)reviewsButton.addEventListener("click",()=>UI.route("reviews"));
 const cases=document.getElementById("account-cases");if(cases)cases.addEventListener("click",()=>UI.route("cases"));
 const inbox=document.getElementById("account-inbox");if(inbox)inbox.addEventListener("click",()=>UI.route("inbox"));
 const sellerButton=document.getElementById("account-seller");if(sellerButton)sellerButton.addEventListener("click",()=>UI.route("seller"));
 const inventory=document.getElementById("account-inventory");if(inventory)inventory.addEventListener("click",()=>UI.route("inventory"));
 const sellerProfileButton=document.getElementById("account-seller-profile");if(sellerProfileButton)sellerProfileButton.addEventListener("click",()=>UI.route("sellerProfile"));
 const sellerVerificationButton=document.getElementById("account-seller-verification");if(sellerVerificationButton)sellerVerificationButton.addEventListener("click",()=>UI.route("sellerVerification"));
 const newListing=document.getElementById("account-new-listing");if(newListing)newListing.addEventListener("click",()=>UI.route("listingEditor"));
 const startSelling=document.getElementById("account-start-selling");if(startSelling)startSelling.addEventListener("click",()=>UI.route("sellerSetup"));
 const finishSelling=document.getElementById("account-finish-selling");if(finishSelling)finishSelling.addEventListener("click",()=>UI.route("sellerSetup"));
 document.getElementById("account-web").addEventListener("click",()=>void C.Native.openBrowser(C.config.webBaseUrl.replace(/\/$/,"")+"/account"));
 document.getElementById("account-signout").addEventListener("click",async()=>{
  await C.signOut();
  C.state.accountMode="buying";
  await UI.refreshUserChrome();
  UI.toast("Signed out.");
  UI.route("home");
 });
};

let authSignupRole="buyer";

const renderAuth=(mode)=>{
 const signup=mode==="signup";
 const roleCard=(role,title,body)=>"<button type=\"button\" class=\"account-tile auth-role-choice"+(authSignupRole===role?" selected":"")+"\" data-auth-role=\""+role+"\"><strong>"+title+"</strong><small>"+body+"</small></button>";
 const html="<section class=\"auth-card\"><div class=\"segmented\"><button id=\"auth-signin-tab\" class=\""+(!signup?"active":"")+"\" type=\"button\">Sign in</button><button id=\"auth-signup-tab\" class=\""+(signup?"active":"")+"\" type=\"button\">Create account</button></div><p class=\"eyebrow\" style=\"margin-top:20px\">SecondPart account</p><h1 style=\"font-size:30px;margin:5px 0\">"+(signup?"Join SecondPart":"Welcome back")+"</h1><p class=\"subtle\">"+(signup?"Choose how you want to start. A seller account can also buy parts with the same login.":"One login for your Garage, purchases, selling and messages.")+"</p>"+(signup?"<section class=\"account-grid\" style=\"margin-top:14px\">"+roleCard("buyer","I want to buy parts","Garage, compatibility, saved parts and purchases.")+roleCard("seller","I want to sell parts","Includes all buyer features plus seller tools.")+"</section>":"")+"<form id=\"auth-form\" class=\"form-grid\" style=\"margin-top:14px\">"+(signup?"<input id=\"auth-role\" type=\"hidden\" value=\""+authSignupRole+"\"/><label class=\"label\">Your name / contact name<input id=\"auth-name\" class=\"input\" minlength=\"2\" required autocomplete=\"name\"/></label>":"")+"<label class=\"label\">Email<input id=\"auth-email\" class=\"input\" type=\"email\" required autocomplete=\"email\"/></label><label class=\"label\">Password<input id=\"auth-password\" class=\"input\" type=\"password\" minlength=\"8\" required autocomplete=\""+(signup?"new-password":"current-password")+"\"/></label><div id=\"auth-status\"></div><button id=\"auth-submit\" class=\"primary wide\" type=\"submit\">"+(signup?(authSignupRole==="seller"?"Create seller account":"Create buyer account"):"Sign in")+"</button></form>"+(!signup?"<button id=\"auth-forgot\" class=\"link-button\" style=\"margin-top:12px\" type=\"button\">Forgot password / resend confirmation</button>":"")+"</section>";
 UI.app.innerHTML=html;

 document.getElementById("auth-signin-tab").addEventListener("click",()=>renderAuth("signin"));
 document.getElementById("auth-signup-tab").addEventListener("click",()=>renderAuth("signup"));
 UI.app.querySelectorAll("[data-auth-role]").forEach(button=>button.addEventListener("click",()=>{
  authSignupRole=button.dataset.authRole==="seller"?"seller":"buyer";
  UI.app.querySelectorAll("[data-auth-role]").forEach(node=>node.classList.toggle("selected",node.dataset.authRole===authSignupRole));
  document.getElementById("auth-role").value=authSignupRole;
  document.getElementById("auth-submit").textContent=authSignupRole==="seller"?"Create seller account":"Create buyer account";
 }));
 const forgot=document.getElementById("auth-forgot");
 if(forgot)forgot.addEventListener("click",()=>void C.Native.openBrowser(C.config.webBaseUrl.replace(/\/$/,"")+"/auth/forgot-password"));

 document.getElementById("auth-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const status=document.getElementById("auth-status");
  const button=document.getElementById("auth-submit");
  button.disabled=true;button.textContent=signup?"Creating account…":"Signing in…";
  const email=String(document.getElementById("auth-email").value||"").trim();
  const password=String(document.getElementById("auth-password").value||"");
  try{
   if(signup){
    const displayName=String(document.getElementById("auth-name").value||"").trim();
    const role=document.getElementById("auth-role").value;
    if(displayName.length<2)throw new Error("Enter your name or business contact name.");
    const result=await C.signUp({email,password,displayName,role});
    if(result&&result.access_token){
     await afterLogin(role);
    }else{
     status.innerHTML="<div class=\"status success\">Account created. Check your email to confirm it, then sign in"+(role==="seller"?" and finish your seller profile.":".")+"</div>";
     button.disabled=false;button.textContent=role==="seller"?"Create seller account":"Create buyer account";
    }
   }else{
    await C.signIn(email,password);
    await afterLogin();
   }
  }catch(error){
   status.innerHTML="<div class=\"status error\">"+C.escapeHtml(error.message)+"</div>";
   button.disabled=false;button.textContent=signup?(authSignupRole==="seller"?"Create seller account":"Create buyer account"):"Sign in";
  }
 });
};

const afterLogin=async(intent=null)=>{
 await C.loadMe();
 await UI.refreshUserChrome();
 UI.toast("Signed in.");
 if(intent==="seller"&&C.state.me&&!C.state.me.seller){
  C.state.afterAuth=null;
  C.state.accountMode="selling";
  UI.route("sellerSetup");
  return;
 }
 const target=C.state.afterAuth||"account";
 C.state.afterAuth=null;
 UI.route(target);
};

const sellerSetup=async()=>{
 if(!await UI.requireAuth("sellerSetup"))return;
 if(!C.state.me)await C.loadMe();
 if(C.state.me?.seller){C.state.accountMode="selling";UI.route("account",{view:"selling"});return;}

 const profile=C.state.me?.profile;
 UI.app.innerHTML="<button class=\"back\" id=\"seller-setup-back\" type=\"button\">‹ Back to account</button><section class=\"auth-card\"><p class=\"eyebrow\">Selling on SecondPart</p><h1 style=\"font-size:28px;margin:5px 0\">Create your seller profile</h1><p class=\"subtle\">This adds selling to your existing account. You will still be able to buy parts normally.</p><form id=\"seller-setup-form\" class=\"form-grid\" style=\"margin-top:16px\"><label class=\"label\">Seller type<select id=\"seller-type\" class=\"select\"><option value=\"private\">Private seller</option><option value=\"business\">Business / garage / breaker</option></select></label><label class=\"label\">Seller / business name<input id=\"seller-name\" class=\"input\" minlength=\"2\" maxlength=\"140\" value=\""+C.escapeHtml(profile?.displayName||"")+"\" required/></label><label class=\"label\">Town or city<input id=\"seller-location\" class=\"input\" maxlength=\"140\" required/></label><label class=\"label\">Postcode <span class=\"subtle\">(optional)</span><input id=\"seller-postcode\" class=\"input\" maxlength=\"20\"/></label><label class=\"label\">About you / the business<textarea id=\"seller-description\" class=\"textarea\" minlength=\"20\" maxlength=\"2000\" placeholder=\"What kind of parts do you sell, how are they sourced, tested or dispatched?\" required></textarea></label><div id=\"seller-setup-status\"></div><button id=\"seller-setup-submit\" class=\"lime-button wide\" type=\"submit\">Enable selling</button></form></section>";
 document.getElementById("seller-setup-back").addEventListener("click",()=>UI.route("account",{view:"buying"}));
 document.getElementById("seller-setup-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const button=document.getElementById("seller-setup-submit");
  const status=document.getElementById("seller-setup-status");
  button.disabled=true;button.textContent="Setting up…";
  try{
   await C.api("/seller/profile",{method:"POST",auth:true,body:{
    sellerType:document.getElementById("seller-type").value,
    businessName:String(document.getElementById("seller-name").value||"").trim(),
    location:String(document.getElementById("seller-location").value||"").trim(),
    postcode:String(document.getElementById("seller-postcode").value||"").trim(),
    description:String(document.getElementById("seller-description").value||"").trim()
   }});
   C.invalidateCache("auth:");
   await C.loadMe();
   C.state.accountMode="selling";
   UI.toast("Selling enabled. You can still buy parts with this account.");
   UI.route("account",{view:"selling"});
  }catch(error){
   status.innerHTML="<div class=\"status error\">"+C.escapeHtml(error.message.replaceAll("_"," "))+"</div>";
   button.disabled=false;button.textContent="Enable selling";
  }
 });
};

const sellerProfile=async()=>{
 if(!await UI.requireAuth("sellerProfile"))return;
 if(!C.state.me)await C.loadMe();
 if(!C.state.me?.seller){UI.route("sellerSetup");return;}

 UI.loading("Loading seller profile");
 let seller;
 try{seller=(await C.api("/seller/profile",{auth:true})).seller;}
 catch(error){UI.empty("○","Seller profile unavailable",error.message,"Back",()=>UI.route("account",{view:"selling"}));return;}
 if(!seller){UI.route("sellerSetup");return;}

 UI.app.innerHTML="<button class=\"back\" id=\"seller-profile-back\" type=\"button\">‹ Back to Selling</button><section class=\"auth-card\"><p class=\"eyebrow\">Seller settings</p><h1 style=\"font-size:28px;margin:5px 0\">Edit seller profile</h1><p class=\"subtle\">These details are public and help buyers understand who they are buying from.</p>"+(seller.verified?"<div class=\"status warning\" style=\"margin-top:12px\"><strong>Verified business</strong><div style=\"margin-top:3px\">Changing seller type, seller name, town/city or postcode removes the verified badge until the updated identity is reviewed again.</div></div>":"")+"<form id=\"seller-profile-form\" class=\"form-grid\" style=\"margin-top:16px\"><label class=\"label\">Seller type<select id=\"sp-type\" class=\"select\"><option value=\"private\">Private seller</option><option value=\"business\">Business / garage / breaker</option></select></label><label class=\"label\">Seller / business name<input id=\"sp-name\" class=\"input\" minlength=\"2\" maxlength=\"140\" required value=\""+C.escapeHtml(seller.businessName||"")+"\"></label><label class=\"label\">Town or city<input id=\"sp-location\" class=\"input\" maxlength=\"140\" required value=\""+C.escapeHtml(seller.location||"")+"\"></label><label class=\"label\">Postcode <span class=\"subtle\">(optional)</span><input id=\"sp-postcode\" class=\"input\" maxlength=\"20\" value=\""+C.escapeHtml(seller.postcode||"")+"\"></label><label class=\"label\">About the seller<textarea id=\"sp-description\" class=\"textarea\" minlength=\"20\" maxlength=\"2000\" required>"+C.escapeHtml(seller.description||"")+"</textarea></label><div id=\"seller-profile-status\"></div><button id=\"seller-profile-save\" class=\"primary wide\" type=\"submit\">Save seller profile</button></form></section>";
 document.getElementById("sp-type").value=seller.sellerType||"private";
 document.getElementById("seller-profile-back").addEventListener("click",()=>UI.route("account",{view:"selling"}));
 document.getElementById("seller-profile-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const button=document.getElementById("seller-profile-save");
  const status=document.getElementById("seller-profile-status");
  button.disabled=true;button.textContent="Saving…";
  try{
   const result=await C.api("/seller/profile",{method:"PATCH",auth:true,body:{
    sellerType:document.getElementById("sp-type").value,
    businessName:String(document.getElementById("sp-name").value||"").trim(),
    location:String(document.getElementById("sp-location").value||"").trim(),
    postcode:String(document.getElementById("sp-postcode").value||"").trim(),
    description:String(document.getElementById("sp-description").value||"").trim()
   }});
   await C.loadMe();
   const stillVerified=Boolean(result.seller?.verified);
   UI.toast(stillVerified?"Seller profile saved.":"Seller profile saved.");
   if(seller.verified&&!stillVerified)UI.toast("Identity details changed. Business verification needs to be reviewed again.","warning");
   UI.route("sellerProfile");
  }catch(error){
   status.innerHTML="<div class=\"status error\">"+C.escapeHtml(error.message.replaceAll("_"," "))+"</div>";
   button.disabled=false;button.textContent="Save seller profile";
  }
 });
};

const sellerVerification=async()=>{
 if(!await UI.requireAuth("sellerVerification"))return;
 if(!C.state.me)await C.loadMe();
 if(!C.state.me?.seller){UI.route("sellerSetup");return;}

 UI.loading("Loading verification");
 let result;
 try{result=await C.api("/seller/verification",{auth:true});}
 catch(error){UI.empty("✓","Verification unavailable",error.message,"Back",()=>UI.route("account",{view:"selling"}));return;}

 const request=result.request;
 const html=[];
 html.push("<button class=\"back\" id=\"seller-verification-back\" type=\"button\">‹ Back to Selling</button>");
 html.push("<section class=\"account-hero\"><p class=\"eyebrow\" style=\"color:#d4f44d\">Seller trust</p><h1>Business verification</h1><p>Manual SecondPart review for businesses, garages and breakers.</p></section>");

 if(result.sellerType!=="business"){
  html.push("<section class=\"card\" style=\"margin-top:12px\"><div class=\"status info\"><strong>Not applicable to a private seller</strong><div style=\"margin-top:3px\">Private sellers can sell without a business badge. Change seller type only if you operate as a business, garage or breaker.</div></div><button id=\"verification-profile\" class=\"secondary wide\" style=\"margin-top:12px\" type=\"button\">Edit seller profile</button></section>");
 }else if(result.verified){
  html.push("<section class=\"card\" style=\"margin-top:12px\"><div class=\"status success\"><strong>✓ Verified business</strong><div style=\"margin-top:3px\">Your public seller profile can display the SecondPart verified badge.</div></div></section>");
 }else if(request?.status==="pending"){
  html.push("<section class=\"card\" style=\"margin-top:12px\"><div class=\"status warning\"><strong>Review pending</strong><div style=\"margin-top:3px\">Requested "+C.escapeHtml(C.dateOnly(request.requestedAt))+". No verified badge is shown until the request is approved.</div></div>"+(request.message?"<p class=\"subtle\" style=\"margin-top:10px\">Your note: "+C.escapeHtml(request.message)+"</p>":"")+"</section>");
 }else{
  html.push("<section class=\"auth-card\" style=\"margin-top:12px\">"+(request?.status==="rejected"?"<div class=\"status error\"><strong>Previous request was not approved</strong>"+(request.reviewNote?"<div style=\"margin-top:3px\">"+C.escapeHtml(request.reviewNote)+"</div>":"")+"</div>":"")+"<h3 style=\"margin:12px 0 4px\">Request manual verification</h3><p class=\"subtle\">Verification is a trust badge, not a requirement for Stripe payouts. SecondPart reviews the business identity separately.</p><form id=\"seller-verification-form\" class=\"form-grid\" style=\"margin-top:14px\"><label class=\"label\">Anything we should know? <span class=\"subtle\">(optional)</span><textarea id=\"verification-message\" class=\"textarea\" maxlength=\"500\" placeholder=\"Registered business name, specialist area or information that helps us review the profile.\"></textarea></label><div id=\"verification-status\"></div><button id=\"verification-submit\" class=\"primary wide\" type=\"submit\">Request verification</button></form></section>");
 }
 UI.app.innerHTML=html.join("");
 document.getElementById("seller-verification-back").addEventListener("click",()=>UI.route("account",{view:"selling"}));
 const profileButton=document.getElementById("verification-profile");if(profileButton)profileButton.addEventListener("click",()=>UI.route("sellerProfile"));
 const form=document.getElementById("seller-verification-form");
 if(form)form.addEventListener("submit",async event=>{
  event.preventDefault();
  const button=document.getElementById("verification-submit");
  const status=document.getElementById("verification-status");
  button.disabled=true;button.textContent="Submitting…";
  try{
   await C.api("/seller/verification",{method:"POST",auth:true,body:{message:String(document.getElementById("verification-message").value||"").trim()}});
   UI.toast("Verification request submitted for manual review.");
   UI.route("sellerVerification");
  }catch(error){
   status.innerHTML="<div class=\"status error\">"+C.escapeHtml(error.message.replaceAll("_"," "))+"</div>";
   button.disabled=false;button.textContent="Request verification";
  }
 });
};

const saved=async()=>{
 if(!await UI.requireAuth("saved"))return;
 UI.loading("Loading saved parts");
 let result;
 try{result=await C.api("/saved",{auth:true});C.state.savedIds=new Set(result.ids||[]);}
 catch(error){UI.empty("♡","Saved parts unavailable",error.message,"Try again",()=>UI.route("saved"));return;}

 UI.app.innerHTML="<div class=\"section-head\"><div><p class=\"eyebrow\">Your account</p><h2>Saved parts</h2><p>"+(result.items||[]).length+" saved listing(s).</p></div></div>"+((result.items||[]).length?"<section class=\"list-grid\">"+result.items.map(UI.listingCard).join("")+"</section>":"<div class=\"empty\"><div class=\"empty-icon\">♡</div><h3>No saved parts yet</h3><p>Tap the heart on a listing to save it here.</p><button id=\"saved-shop\" class=\"primary small-button\" style=\"margin-top:14px\" type=\"button\">Browse parts</button></div>");
 UI.bindListingActions(UI.app);
 const shop=document.getElementById("saved-shop");if(shop)shop.addEventListener("click",()=>UI.route("home"));
};

const notifications=async()=>{
 if(!await UI.requireAuth("notifications"))return;
 UI.loading("Loading notifications");
 let result;
 try{result=await C.api("/notifications",{auth:true});C.state.unreadNotifications=Number(result.unreadCount||0);UI.updateBadge();}
 catch(error){UI.empty("♢","Notifications unavailable",error.message,"Try again",()=>UI.route("notifications"));return;}

 const items=result.items||[];
 const html=[];
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Your account</p><h2>Notifications</h2><p>"+C.escapeHtml(result.unreadCount||0)+" unread.</p></div>"+(result.unreadCount?"<button id=\"mark-all-read\" class=\"secondary small-button\" type=\"button\">Mark all read</button>":"")+"</div>");
 if(items.length){
  html.push(items.map(item=>"<section class=\"notification-card\" data-notification=\""+C.escapeHtml(item.id)+"\"><div class=\"row-between\"><div><h3 style=\"margin:0;font-size:13px\">"+C.escapeHtml(item.title)+"</h3>"+(item.body?"<p class=\"subtle\">"+C.escapeHtml(item.body)+"</p>":"")+"<p class=\"subtle\">"+C.dateTime(item.createdAt)+"</p></div>"+(!item.readAt?"<span class=\"pill success\">New</span>":"")+"</div><div class=\"button-row\" style=\"margin-top:9px\">"+(item.href?"<button class=\"primary small-button\" data-notification-open=\""+C.escapeHtml(item.id)+"\" type=\"button\">Open</button>":"")+(!item.readAt?"<button class=\"secondary small-button\" data-notification-read=\""+C.escapeHtml(item.id)+"\" type=\"button\">Mark read</button>":"")+"</div></section>").join(""));
 }else html.push("<div class=\"empty\"><div class=\"empty-icon\">♢</div><h3>No notifications yet</h3><p>Marketplace updates that need your attention will appear here.</p></div>");
 UI.app.innerHTML=html.join("");

 const markAll=document.getElementById("mark-all-read");
 if(markAll)markAll.addEventListener("click",async()=>{
  try{await C.api("/notifications",{method:"PATCH",auth:true,body:{all:true}});C.state.unreadNotifications=0;UI.updateBadge();UI.route("notifications");}
  catch(error){UI.toast(error.message,"error");}
 });
 UI.app.querySelectorAll("[data-notification-read]").forEach(button=>button.addEventListener("click",async()=>{
  try{await C.api("/notifications",{method:"PATCH",auth:true,body:{id:button.dataset.notificationRead}});UI.route("notifications");}
  catch(error){UI.toast(error.message,"error");}
 }));
 UI.app.querySelectorAll("[data-notification-open]").forEach(button=>button.addEventListener("click",()=>{
  const item=items.find(value=>value.id===button.dataset.notificationOpen);
  if(item)openNotification(item);
 }));
};

const openNotification=(item)=>{
 const href=String(item.href||"");
 if(href.startsWith("/inbox/")){UI.route("conversation",{id:href.split("/").pop()});return;}
 if(href.startsWith("/account/orders")){UI.route("orders");return;}
 if(href.startsWith("/account/cases")){UI.route("orders");return;}
 if(href.startsWith("/dashboard/orders")){UI.route("seller");return;}
 if(href.startsWith("/dashboard/cases")){UI.route("seller");return;}
 if(href.startsWith("/garage")){UI.route("garage");return;}
 window.location.href=C.config.webBaseUrl.replace(/\/$/,"")+href;
};


const reviews=async()=>{
 if(!await UI.requireAuth("reviews"))return;
 UI.loading("Loading reviews");

 let items=[];
 try{items=(await C.api("/reviews",{auth:true})).items||[];}
 catch(error){UI.empty("☆","Reviews unavailable",error.message,"Try again",()=>UI.route("reviews"));return;}

 const pending=items.filter(item=>!item.existingReviewId);
 const submitted=items.filter(item=>Boolean(item.existingReviewId));
 const ratings={};

 const starField=(itemId,field,label,required=false)=>
  "<fieldset class=\"review-rating\" data-rating-group=\""+C.escapeHtml(itemId)+"|"+C.escapeHtml(field)+"\"><legend style=\"font-size:12px;font-weight:800\">"+C.escapeHtml(label)+(required?" · required":"")+"</legend><div style=\"display:flex;gap:3px;margin-top:5px\">"+[1,2,3,4,5].map(value=>"<button type=\"button\" data-review-id=\""+C.escapeHtml(itemId)+"\" data-review-field=\""+C.escapeHtml(field)+"\" data-review-value=\""+value+"\" aria-label=\""+value+" star"+(value===1?"":"s")+"\" style=\"border:0;background:transparent;padding:2px;font-size:25px;line-height:1;color:#b8b8b0\">☆</button>").join("")+"</div></fieldset>";

 const html=[];
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Trust & reputation</p><h2>Transaction reviews</h2><p>Reviews unlock only after a successfully completed, non-refunded transaction and released seller funds.</p></div></div>");

 if(pending.length){
  html.push("<section><p class=\"eyebrow\">Waiting for your review</p>"+pending.map(item=>{
   const buyer=item.direction==="buyer_to_seller";
   return "<article class=\"order-card\" style=\"margin-top:10px\"><p class=\"eyebrow\">"+(buyer?"You bought this item":"You sold this item")+"</p><h3>"+C.escapeHtml(item.partTitle)+"</h3><p class=\"subtle\">Reviewing "+C.escapeHtml(item.counterpartDisplayName)+" · @"+C.escapeHtml(item.counterpartHandle)+"</p><div class=\"form-grid\" style=\"margin-top:14px\">"+
    starField(item.orderItemId,"overall","Overall rating",true)+
    (buyer?starField(item.orderItemId,"itemAsDescribed","Item as described")+starField(item.orderItemId,"dispatch","Dispatch"):starField(item.orderItemId,"buyerConduct","Buyer conduct"))+
    starField(item.orderItemId,"communication","Communication")+
    "<label class=\"label\">Written review <span class=\"subtle\">(optional)</span><textarea class=\"textarea\" data-review-comment=\""+C.escapeHtml(item.orderItemId)+"\" maxlength=\"2000\" placeholder=\"Share useful, factual feedback about this transaction.\"></textarea></label><div data-review-status=\""+C.escapeHtml(item.orderItemId)+"\"></div><button type=\"button\" class=\"primary wide\" data-review-submit=\""+C.escapeHtml(item.orderItemId)+"\">Submit verified review</button></div></article>";
  }).join("")+"</section>");
 }else{
  html.push("<div class=\"empty\"><div class=\"empty-icon\">☆</div><h3>No reviews waiting</h3><p>Completed transactions that become eligible for review will appear here.</p></div>");
 }

 if(submitted.length){
  html.push("<div class=\"section-head\" style=\"margin-top:18px\"><div><p class=\"eyebrow\">Submitted</p><h2>Your completed reviews</h2></div></div>"+submitted.map(item=>"<article class=\"order-card\"><h3>"+C.escapeHtml(item.partTitle)+"</h3><p class=\"subtle\">Your review of @"+C.escapeHtml(item.counterpartHandle)+" has been submitted.</p></article>").join(""));
 }

 UI.app.innerHTML=html.join("");

 UI.app.querySelectorAll("[data-review-value]").forEach(button=>button.addEventListener("click",()=>{
  const id=button.dataset.reviewId;
  const field=button.dataset.reviewField;
  const value=Number(button.dataset.reviewValue);
  if(!id||!field||!value)return;
  if(!ratings[id])ratings[id]={};
  ratings[id][field]=value;
  UI.app.querySelectorAll("[data-review-id=\""+CSS.escape(id)+"\"][data-review-field=\""+CSS.escape(field)+"\"]").forEach(star=>{
   const active=Number(star.dataset.reviewValue)<=value;
   star.textContent=active?"★":"☆";
   star.style.color=active?"#d97706":"#b8b8b0";
  });
 }));

 UI.app.querySelectorAll("[data-review-submit]").forEach(button=>button.addEventListener("click",async()=>{
  const id=button.dataset.reviewSubmit;
  const item=items.find(value=>value.orderItemId===id);
  if(!id||!item)return;
  const values=ratings[id]||{};
  const status=UI.app.querySelector("[data-review-status=\""+CSS.escape(id)+"\"]");
  if(!values.overall){
   if(status)status.innerHTML="<div class=\"status warning\">Choose an overall star rating first.</div>";
   return;
  }
  button.disabled=true;button.textContent="Submitting…";
  try{
   await C.api("/reviews",{method:"POST",auth:true,body:{
    orderItemId:id,
    overall:values.overall,
    itemAsDescribed:values.itemAsDescribed||null,
    dispatch:values.dispatch||null,
    communication:values.communication||null,
    buyerConduct:values.buyerConduct||null,
    comment:String(UI.app.querySelector("[data-review-comment=\""+CSS.escape(id)+"\"]")?.value||"").trim()
   }});
   UI.toast("Verified review submitted.");
   UI.route("reviews");
  }catch(error){
   if(status)status.innerHTML="<div class=\"status error\">"+C.escapeHtml(error.message.replaceAll("_"," "))+"</div>";
   button.disabled=false;button.textContent="Submit verified review";
  }
 }));
};

const member=async(payload)=>{
 if(!payload.handle){UI.route("home");return;}
 UI.loading("Loading member profile");
 let result;
 try{result=await C.api("/members/"+encodeURIComponent(payload.handle));}
 catch(error){UI.empty("○","Member unavailable",error.message,"Back",()=>UI.back());return;}

 const profile=result.profile;
 const reviews=result.reviews||[];
 const listings=result.listings||[];
 const rating=(value,count)=>value===null||!count?"New":Number(value).toFixed(1);
 const stars=value=>{
  const score=Math.max(0,Math.min(5,Math.round(Number(value||0))));
  return "★".repeat(score)+"☆".repeat(5-score);
 };

 const html=[];
 html.push("<button class=\"back\" id=\"member-back\" type=\"button\">‹ Back</button>");
 html.push("<section class=\"account-hero\"><p class=\"eyebrow\" style=\"color:#d4f44d\">SecondPart member</p><h1>"+C.escapeHtml(profile.displayName)+"</h1><p>@"+C.escapeHtml(profile.handle)+" · Member since "+C.dateOnly(profile.memberSince)+"</p>"+(profile.bio?"<p style=\"margin-top:12px;line-height:1.6\">"+C.escapeHtml(profile.bio)+"</p>":"")+(profile.sellerVerified?"<div class=\"status success\" style=\"margin-top:12px\">Verified business seller</div>":"")+"</section>");
 html.push("<section class=\"account-grid\">"+
  "<div class=\"account-tile\"><strong>★ "+C.escapeHtml(rating(profile.sellerRating,profile.sellerReviewCount))+"</strong><small>Seller rating · "+C.escapeHtml(profile.sellerReviewCount)+" verified review(s)</small></div>"+
  "<div class=\"account-tile\"><strong>"+C.escapeHtml(profile.soldCount)+" sold</strong><small>Completed, funds-released sales.</small></div>"+
  "<div class=\"account-tile\"><strong>★ "+C.escapeHtml(rating(profile.buyerRating,profile.buyerReviewCount))+"</strong><small>Buyer rating · "+C.escapeHtml(profile.buyerReviewCount)+" verified review(s)</small></div>"+
  "<div class=\"account-tile\"><strong>"+C.escapeHtml(profile.boughtCount)+" bought</strong><small>Completed purchases.</small></div>"+
 "</section>");

 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Reputation</p><h2>Verified transaction reviews</h2><p>Reviews are tied to completed SecondPart transactions.</p></div></div>");
 if(reviews.length){
  html.push(reviews.map(review=>
   "<article class=\"order-card\"><div class=\"row-between\"><div><h3>"+C.escapeHtml(review.reviewerDisplayName)+"</h3><p class=\"subtle\">@"+C.escapeHtml(review.reviewerHandle)+" · "+C.escapeHtml(review.reviewerSoldCount)+" sold · "+C.escapeHtml(review.reviewerBoughtCount)+" bought</p></div><span style=\"color:#d97706;font-size:15px;letter-spacing:1px\">"+stars(review.overallRating)+"</span></div><p class=\"eyebrow\" style=\"margin-top:9px\">"+C.escapeHtml(review.direction==="buyer_to_seller"?"Buyer review of seller":"Seller review of buyer")+"</p><strong style=\"font-size:12px\">"+C.escapeHtml(review.partTitle)+"</strong>"+(review.comment?"<p style=\"font-size:11px;line-height:1.6\">"+C.escapeHtml(review.comment)+"</p>":"")+"<p class=\"subtle\">"+C.dateOnly(review.createdAt)+" · Verified transaction</p></article>"
  ).join(""));
 }else{
  html.push("<div class=\"empty\"><div class=\"empty-icon\">☆</div><h3>No verified reviews yet</h3><p>This member is new or has not yet completed a reviewed transaction.</p></div>");
 }

 if(listings.length){
  html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Seller inventory</p><h2>Available parts</h2></div></div><section class=\"list-grid\">"+listings.map(UI.listingCard).join("")+"</section>");
 }
 UI.app.innerHTML=html.join("");
 document.getElementById("member-back").addEventListener("click",()=>void UI.back());
 UI.bindListingActions(UI.app);
};

UI.register("account",account);
UI.register("saved",saved);
UI.register("notifications",notifications);
UI.register("reviews",reviews);
UI.register("member",member);
UI.register("sellerSetup",sellerSetup);
UI.register("sellerProfile",sellerProfile);
UI.register("sellerVerification",sellerVerification);
})();
