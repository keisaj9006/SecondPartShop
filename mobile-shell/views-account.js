(()=>{
"use strict";

const UI=window.SecondPartUI;
const C=UI.C;

const account=async(payload)=>{
 if(!C.state.session){renderAuth(payload&&payload.mode?payload.mode:"signin");return;}
 UI.loading("Loading account");
 if(!C.state.me)await C.loadMe();
 if(!C.state.me){C.clearSession();renderAuth("signin");return;}

 const me=C.state.me;
 const profile=me.profile;
 const seller=me.seller;
 const html=[];
 html.push("<section class=\"account-hero\"><p class=\"eyebrow\" style=\"color:#d4f44d\">Your account</p><h1>"+C.escapeHtml(profile?profile.displayName:"SecondPart member")+"</h1><p>"+C.escapeHtml(profile?"@"+profile.handle:"")+" · "+C.escapeHtml(me.user&&me.user.email?me.user.email:"")+"</p>"+(!me.user.emailConfirmed?"<div class=\"status warning\" style=\"margin-top:12px\">Email confirmation is still pending.</div>":"")+"</section>");
 html.push("<section class=\"account-grid\"><button class=\"account-tile\" id=\"account-saved\" type=\"button\"><strong>Saved parts</strong><small>Parts you want to come back to.</small></button><button class=\"account-tile\" id=\"account-notifications\" type=\"button\"><strong>Notifications</strong><small>"+C.escapeHtml(C.state.unreadNotifications)+" unread marketplace update(s).</small></button><button class=\"account-tile\" id=\"account-garage\" type=\"button\"><strong>Garage</strong><small>Your saved vehicles and compatibility filters.</small></button><button class=\"account-tile\" id=\"account-orders\" type=\"button\"><strong>Purchases</strong><small>Payment, delivery and buyer protection.</small></button><button class=\"account-tile\" id=\"account-inbox\" type=\"button\"><strong>Part questions</strong><small>Buyer and seller pre-purchase conversations.</small></button>"+(seller?"<button class=\"account-tile\" id=\"account-seller\" type=\"button\"><strong>Seller dashboard</strong><small>Sales, payouts, fulfilment and cases.</small></button>":"")+"</section>");
 if(profile)html.push("<section class=\"card\" style=\"margin-top:12px\"><p class=\"eyebrow\">Profile</p><div class=\"spec-grid\"><div class=\"spec\"><small>Role</small><strong>"+C.escapeHtml(C.human(profile.role))+"</strong></div><div class=\"spec\"><small>Member since</small><strong>"+C.dateOnly(profile.createdAt)+"</strong></div></div>"+(seller?"<div class=\"status "+(seller.verified?"success":"info")+"\" style=\"margin-top:10px\">"+C.escapeHtml(seller.businessName)+" · "+(seller.verified?"Verified seller":"Seller verification pending/not completed")+"</div>":"")+"</section>");
 html.push("<div class=\"button-row\" style=\"margin-top:14px\"><button id=\"account-web\" class=\"secondary small-button\" type=\"button\">Profile & security on web</button><button id=\"account-signout\" class=\"danger-button small-button\" type=\"button\">Sign out</button></div>");
 UI.app.innerHTML=html.join("");

 document.getElementById("account-saved").addEventListener("click",()=>UI.route("saved"));
 document.getElementById("account-notifications").addEventListener("click",()=>UI.route("notifications"));
 document.getElementById("account-garage").addEventListener("click",()=>UI.route("garage"));
 document.getElementById("account-orders").addEventListener("click",()=>UI.route("orders"));
 document.getElementById("account-inbox").addEventListener("click",()=>UI.route("inbox"));
 const sellerButton=document.getElementById("account-seller");if(sellerButton)sellerButton.addEventListener("click",()=>UI.route("seller"));
 document.getElementById("account-web").addEventListener("click",()=>{window.location.href=C.config.webBaseUrl.replace(/\/$/,"")+"/account";});
 document.getElementById("account-signout").addEventListener("click",async()=>{
  await C.signOut();
  await UI.refreshUserChrome();
  UI.toast("Signed out.");
  UI.route("home");
 });
};

const renderAuth=(mode)=>{
 const signup=mode==="signup";
 const html="<section class=\"auth-card\"><div class=\"segmented\"><button id=\"auth-signin-tab\" class=\""+(!signup?"active":"")+"\" type=\"button\">Sign in</button><button id=\"auth-signup-tab\" class=\""+(signup?"active":"")+"\" type=\"button\">Create account</button></div><p class=\"eyebrow\" style=\"margin-top:20px\">SecondPart account</p><h1 style=\"font-size:30px;margin:5px 0\">"+(signup?"Join SecondPart":"Welcome back")+"</h1><p class=\"subtle\">"+(signup?"Create a buyer account or enable selling from day one.":"Access your Garage, saved parts, purchases and messages.")+"</p><form id=\"auth-form\" class=\"form-grid\">"+(signup?"<label class=\"label\">Display name<input id=\"auth-name\" class=\"input\" minlength=\"2\" required autocomplete=\"name\"/></label><label class=\"label\">Account type<select id=\"auth-role\" class=\"select\"><option value=\"buyer\">Buyer</option><option value=\"seller\">Seller / garage</option></select></label>":"")+"<label class=\"label\">Email<input id=\"auth-email\" class=\"input\" type=\"email\" required autocomplete=\"email\"/></label><label class=\"label\">Password<input id=\"auth-password\" class=\"input\" type=\"password\" minlength=\"8\" required autocomplete=\""+(signup?"new-password":"current-password")+"\"/></label><div id=\"auth-status\"></div><button class=\"primary wide\" type=\"submit\">"+(signup?"Create account":"Sign in")+"</button></form>"+(!signup?"<button id=\"auth-forgot\" class=\"link-button\" style=\"margin-top:12px\" type=\"button\">Forgot password / resend confirmation</button>":"")+"</section>";
 UI.app.innerHTML=html;

 document.getElementById("auth-signin-tab").addEventListener("click",()=>renderAuth("signin"));
 document.getElementById("auth-signup-tab").addEventListener("click",()=>renderAuth("signup"));
 const forgot=document.getElementById("auth-forgot");
 if(forgot)forgot.addEventListener("click",()=>{window.location.href=C.config.webBaseUrl.replace(/\/$/,"")+"/auth/forgot-password";});

 document.getElementById("auth-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const status=document.getElementById("auth-status");
  const button=event.currentTarget.querySelector("button[type=submit]");
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
     await afterLogin();
    }else{
     status.innerHTML="<div class=\"status success\">Account created. Check your email to confirm the account, then return to the app and sign in.</div>";
     button.disabled=false;button.textContent="Create account";
    }
   }else{
    await C.signIn(email,password);
    await afterLogin();
   }
  }catch(error){
   status.innerHTML="<div class=\"status error\">"+C.escapeHtml(error.message)+"</div>";
   button.disabled=false;button.textContent=signup?"Create account":"Sign in";
  }
 });
};

const afterLogin=async()=>{
 await C.loadMe();
 await UI.refreshUserChrome();
 UI.toast("Signed in.");
 const target=C.state.afterAuth||"account";
 C.state.afterAuth=null;
 UI.route(target);
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

UI.register("account",account);
UI.register("saved",saved);
UI.register("notifications",notifications);
})();
