(()=>{
"use strict";

const UI=window.SecondPartUI;
const C=UI.C;

const statusClass=(value)=>{
 const text=String(value||"").toLowerCase();
 if(["paid","completed","released","resolved","delivered","returned"].some(word=>text.includes(word)))return "success";
 if(["dispute","failed","rejected","refunded","cancelled","blocked"].some(word=>text.includes(word)))return "danger";
 if(["pending","processing","scheduled","preparing","return","under_review","requires_action"].some(word=>text.includes(word)))return "warning";
 return "";
};

const orders=async()=>{
 if(!await UI.requireAuth("orders"))return;
 UI.loading("Loading purchases");
 let items;
 try{items=(await C.api("/orders",{auth:true})).items||[];}
 catch(error){UI.empty("▣","Purchases unavailable",error.message,"Try again",()=>UI.route("orders"));return;}

 const html=[];
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Your account</p><h2>Purchases</h2><p>Payment, delivery and buyer-protection status.</p></div></div>");
 if(!items.length){
  html.push("<div class=\"empty\"><div class=\"empty-icon\">▣</div><h3>No purchases yet</h3><p>Your marketplace orders will appear here.</p><button id=\"orders-shop\" class=\"primary small-button\" style=\"margin-top:14px\" type=\"button\">Browse parts</button></div>");
 }else{
  html.push(items.map(order=>{
   const parts=(order.items||[]).map(item=>C.escapeHtml(item.partTitle)).join(", ");
   return "<button type=\"button\" class=\"order-card wide\" data-open-order=\""+C.escapeHtml(order.id)+"\" style=\"text-align:left\"><div class=\"row-between\"><div><p class=\"eyebrow\" style=\"margin-bottom:5px\">Order "+C.escapeHtml(order.id.slice(0,8).toUpperCase())+"</p><h3>"+parts+"</h3><p class=\"subtle\">"+C.dateOnly(order.createdAt)+"</p></div><span class=\"money\">"+C.money(order.totalPence,order.currency)+"</span></div><div class=\"chips\"><span class=\"pill "+statusClass(order.paymentStatus)+"\">"+C.escapeHtml(C.human(order.paymentStatus))+"</span><span class=\"pill "+statusClass(order.status)+"\">"+C.escapeHtml(C.human(order.status))+"</span></div></button>";
  }).join(""));
 }
 UI.app.innerHTML=html.join("");
 const shop=document.getElementById("orders-shop");if(shop)shop.addEventListener("click",()=>UI.route("home"));
 UI.app.querySelectorAll("[data-open-order]").forEach(button=>button.addEventListener("click",()=>UI.route("order",{id:button.dataset.openOrder})));
};

const timelineLabel=(event)=>{
 const map={
  checkout_reserved:"Checkout reserved",
  payment_confirmed:"Payment confirmed",
  seller_fulfilment_update:"Seller updated fulfilment",
  buyer_received:"You confirmed receipt",
  buyer_accepted:"Item accepted",
  seller_transfer_released:"Seller payout released",
  case_opened:"Transaction case opened",
  cancellation_requested:"Cancellation requested",
  case_status_changed:"Case status changed",
  provider_dispute_opened:"Card-provider dispute opened",
  provider_dispute_closed:"Card-provider dispute closed",
  checkout_reservation_expired:"Checkout reservation expired",
  buyer_cancelled_checkout:"Checkout cancelled"
 };
 return map[event.eventType]||C.human(event.eventType);
};

const order=async(payload)=>{
 if(!payload.id){UI.route("orders");return;}
 if(!await UI.requireAuth("orders"))return;
 UI.loading("Loading order");
 let data;
 try{data=(await C.api("/orders/"+encodeURIComponent(payload.id),{auth:true})).order;}
 catch(error){UI.empty("!","Order unavailable",error.message,"Back to purchases",()=>UI.route("orders"));return;}

 const html=[];
 html.push("<button class=\"back\" id=\"order-back\" type=\"button\">‹ Back to purchases</button>");
 html.push("<section class=\"card\"><div class=\"row-between\"><div><p class=\"eyebrow\">Order "+C.escapeHtml(data.id.slice(0,8).toUpperCase())+"</p><h2 style=\"margin:4px 0 0\">Purchase details</h2><p class=\"subtle\">"+C.dateTime(data.createdAt)+"</p></div><span class=\"money\">"+C.money(data.totalPence,data.currency)+"</span></div><div class=\"chips\"><span class=\"pill "+statusClass(data.paymentStatus)+"\">"+C.escapeHtml(C.human(data.paymentStatus))+"</span><span class=\"pill "+statusClass(data.status)+"\">"+C.escapeHtml(C.human(data.status))+"</span></div>"+(["unpaid","requires_action","processing"].includes(data.paymentStatus)?"<button id=\"cancel-checkout\" class=\"danger-button small-button\" style=\"margin-top:12px\" type=\"button\">Cancel checkout reservation</button>":"")+"</section>");

 (data.items||[]).forEach(item=>{
  const canReceive=["dispatched","ready_for_collection"].includes(item.fulfilmentStatus);
  const canAccept=["dispatched","ready_for_collection","delivered"].includes(item.fulfilmentStatus);
  const canCancel=data.paymentStatus==="paid"&&["paid","preparing","ready_for_collection"].includes(item.fulfilmentStatus);
  const canCase=data.paymentStatus==="paid"&&!["cancelled","refunded","returned","return_requested","dispute_open"].includes(item.fulfilmentStatus);
  html.push("<section class=\"card\"><div class=\"row-between\"><div><p class=\"eyebrow\">"+C.escapeHtml(C.human(item.fulfilmentStatus))+"</p><h3 style=\"margin:4px 0\">"+C.escapeHtml(item.partTitle)+"</h3><p class=\"subtle\">Seller: "+C.escapeHtml(item.sellerName)+" · Qty "+C.escapeHtml(item.quantity)+"</p></div><span class=\"money\">"+C.money(item.unitPricePence*item.quantity,data.currency)+"</span></div>"+(item.trackingNumber?"<div class=\"status info\" style=\"margin-top:10px\">Tracking: "+C.escapeHtml((item.trackingCarrier?item.trackingCarrier+" · ":"")+item.trackingNumber)+"</div>":"")+"<div class=\"button-row\" style=\"margin-top:12px\">"+(data.paymentStatus==="paid"?"<button class=\"secondary small-button\" data-transaction-chat=\""+C.escapeHtml(item.id)+"\" type=\"button\">Message seller</button>":"")+(canReceive?"<button class=\"secondary small-button\" data-receive=\""+C.escapeHtml(item.id)+"\" type=\"button\">I received it</button>":"")+(canAccept?"<button class=\"primary small-button\" data-accept=\""+C.escapeHtml(item.id)+"\" type=\"button\">Accept & complete</button>":"")+(canCancel?"<button class=\"danger-button small-button\" data-case=\"cancellation\" data-case-item=\""+C.escapeHtml(item.id)+"\" type=\"button\">Request cancellation</button>":"")+(canCase?"<button class=\"link-button\" data-case=\"return\" data-case-item=\""+C.escapeHtml(item.id)+"\" type=\"button\">Return / problem</button>":"")+"</div></section>");
 });

 html.push("<section class=\"card\"><p class=\"eyebrow\">Transaction timeline</p><ol class=\"timeline\">"+(data.timeline&&data.timeline.length?data.timeline.map(event=>"<li><strong>"+C.escapeHtml(timelineLabel(event))+"</strong>"+(event.fromStatus&&event.toStatus&&event.fromStatus!==event.toStatus?"<span class=\"subtle\" style=\"display:block\">"+C.escapeHtml(C.human(event.fromStatus))+" → "+C.escapeHtml(C.human(event.toStatus))+"</span>":"")+"<small>"+C.dateTime(event.createdAt)+"</small></li>").join(""):"<li>No timeline events yet.</li>")+"</ol></section>");
 UI.app.innerHTML=html.join("");

 document.getElementById("order-back").addEventListener("click",()=>UI.route("orders"));
 const cancel=document.getElementById("cancel-checkout");
 if(cancel)cancel.addEventListener("click",async()=>{
  cancel.disabled=true;
  try{await C.api("/orders/"+encodeURIComponent(data.id)+"/checkout",{method:"DELETE",auth:true});UI.toast("Checkout reservation cancelled.");UI.route("orders");}
  catch(error){UI.toast(error.message,"error");cancel.disabled=false;}
 });

 UI.app.querySelectorAll("[data-receive]").forEach(button=>button.addEventListener("click",()=>receiptAction(button.dataset.receive,false,data.id)));
 UI.app.querySelectorAll("[data-accept]").forEach(button=>button.addEventListener("click",()=>receiptAction(button.dataset.accept,true,data.id)));
 UI.app.querySelectorAll("[data-case-item]").forEach(button=>button.addEventListener("click",()=>openCase(button.dataset.caseItem,button.dataset.case,data.id)));
 UI.app.querySelectorAll("[data-transaction-chat]").forEach(button=>button.addEventListener("click",()=>UI.route("transactionChat",{id:button.dataset.transactionChat,backOrder:data.id})));
};

const receiptAction=async(itemId,acceptNow,orderId)=>{
 try{
  const result=await C.api("/order-items/"+encodeURIComponent(itemId)+"/receipt",{method:"POST",auth:true,body:{acceptNow}});
  UI.toast(acceptNow?(result.payoutReleased?"Transaction completed.":"Item accepted. Seller payout is queued."):"Delivery confirmed.");
  UI.route("order",{id:orderId});
 }catch(error){UI.toast(error.message,"error");}
};

const openCase=(itemId,type,orderId)=>{
 const labels={cancellation:"Cancellation request",return:"Return / transaction problem",dispute:"Transaction dispute"};
 const reasons=type==="cancellation"?["Changed my mind before dispatch","Ordered the wrong part before dispatch","Other cancellation reason"]:["Item not as described","Wrong part supplied","Item arrived damaged","Item does not work as stated","Delivery / collection issue","Other transaction problem"];
 UI.modal(labels[type]||"Transaction case","<form id=\"case-form\" class=\"form-grid\"><label class=\"label\">Reason<select id=\"case-reason\" class=\"select\">"+reasons.map(reason=>"<option>"+C.escapeHtml(reason)+"</option>").join("")+"</select></label><label class=\"label\">Details<textarea id=\"case-details\" class=\"textarea\" minlength=\"10\" maxlength=\"2000\" placeholder=\"Explain what happened and what outcome you need.\"></textarea></label><div class=\"status warning\">Opening a case blocks any seller payout that has not already been released.</div><button class=\"primary wide\" type=\"submit\">Open case</button></form>");
 document.getElementById("case-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const reason=document.getElementById("case-reason").value;
  const details=String(document.getElementById("case-details").value||"").trim();
  if(details.length<10){UI.toast("Add a little more detail.");return;}
  try{
   await C.api("/cases",{method:"POST",auth:true,body:{orderItemId:itemId,caseType:type,reason,details}});
   UI.closeModal();UI.toast("Case opened. Seller payout is protected.");UI.route("order",{id:orderId});
  }catch(error){UI.toast(error.message,"error");}
 });
};

const transactionChat=async(payload)=>{
 if(!payload.id){UI.route("orders");return;}
 if(!await UI.requireAuth("orders"))return;
 UI.loading("Loading transaction chat");
 let thread;
 try{thread=(await C.api("/transaction-messages/"+encodeURIComponent(payload.id),{auth:true})).thread;}
 catch(error){UI.empty("◫","Chat unavailable",error.message,"Back",()=>UI.route("orders"));return;}

 const myId=C.state.me&&C.state.me.profile?C.state.me.profile.id:null;
 const sellerSide=thread.sellerOwnerId===myId;
 const html="<button class=\"back\" id=\"transaction-back\" type=\"button\">‹ Back</button><section class=\"card\" style=\"padding:0;overflow:hidden\"><div style=\"background:#173c31;color:white;padding:17px\"><p class=\"eyebrow\" style=\"color:#d4f44d\">Private transaction chat</p><h2 style=\"margin:5px 0 0\">"+C.escapeHtml(thread.partTitle)+"</h2><p style=\"font-size:11px;color:rgba(255,255,255,.65)\">"+C.escapeHtml(sellerSide?"Buyer conversation":"Seller: "+thread.sellerName)+"</p></div><div class=\"chat\" id=\"transaction-chat\" style=\"padding:14px;max-height:55vh;overflow:auto\">"+((thread.messages||[]).length?thread.messages.map(message=>"<div class=\"bubble"+(message.senderProfileId===myId?" mine":"")+"\"><strong>"+C.escapeHtml(message.senderProfileId===myId?"You":message.senderDisplayName)+"</strong><div>"+C.escapeHtml(message.body)+"</div><small>"+C.dateTime(message.createdAt)+"</small></div>").join(""):"<div class=\"empty\"><p>No messages yet. Use this chat for delivery or collection questions.</p></div>")+"</div><form id=\"transaction-message-form\" style=\"padding:14px;border-top:1px solid rgba(18,34,29,.1)\"><div class=\"search-row\"><textarea id=\"transaction-message\" class=\"textarea\" style=\"min-height:52px\" maxlength=\"2000\" placeholder=\"Write a transaction message…\"></textarea><button class=\"primary\" type=\"submit\">Send</button></div><p class=\"subtle\">Never send payment-card details or move the transaction off-platform.</p></form></section>";
 UI.app.innerHTML=html;
 document.getElementById("transaction-back").addEventListener("click",()=>payload.backOrder?UI.route("order",{id:payload.backOrder}):sellerSide?UI.route("seller"):UI.route("orders"));
 document.getElementById("transaction-message-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const body=String(document.getElementById("transaction-message").value||"").trim();
  if(!body)return;
  try{await C.api("/transaction-messages/"+encodeURIComponent(thread.orderItemId),{method:"POST",auth:true,body:{body}});UI.route("transactionChat",payload);}
  catch(error){UI.toast(error.message,"error");}
 });
};

const inbox=async()=>{
 if(!await UI.requireAuth("inbox"))return;
 UI.loading("Loading Inbox");
 let items;
 try{items=(await C.api("/inbox",{auth:true})).items||[];}
 catch(error){UI.empty("◫","Inbox unavailable",error.message,"Try again",()=>UI.route("inbox"));return;}

 UI.app.innerHTML="<div class=\"section-head\"><div><p class=\"eyebrow\">Messages</p><h2>Part questions</h2><p>Private pre-purchase conversations.</p></div></div>"+(items.length?items.map(item=>"<button type=\"button\" class=\"conversation-card wide\" data-conversation=\""+C.escapeHtml(item.id)+"\" style=\"text-align:left\"><div class=\"row-between\"><div><h3>"+C.escapeHtml(item.partTitle)+"</h3><p class=\"subtle\">"+C.escapeHtml(item.sellerOwnerId===C.state.me.profile.id?"Buyer question":"Seller: "+item.sellerName)+" · "+C.dateTime(item.lastMessageAt)+"</p></div><span class=\"pill\">"+C.escapeHtml(item.status)+"</span></div></button>").join(""):"<div class=\"empty\"><div class=\"empty-icon\">◫</div><h3>No part questions yet</h3><p>Questions you send to sellers, or buyers send about your listings, will appear here.</p></div>");
 UI.app.querySelectorAll("[data-conversation]").forEach(button=>button.addEventListener("click",()=>UI.route("conversation",{id:button.dataset.conversation})));
};

const conversation=async(payload)=>{
 if(!payload.id){UI.route("inbox");return;}
 if(!await UI.requireAuth("inbox"))return;
 UI.loading("Loading conversation");
 let thread;
 try{thread=(await C.api("/inbox/"+encodeURIComponent(payload.id),{auth:true})).conversation;}
 catch(error){UI.empty("◫","Conversation unavailable",error.message,"Back to Inbox",()=>UI.route("inbox"));return;}

 const myId=C.state.me&&C.state.me.profile?C.state.me.profile.id:null;
 const sellerSide=thread.sellerOwnerId===myId;
 UI.app.innerHTML="<button class=\"back\" id=\"conversation-back\" type=\"button\">‹ Back to Inbox</button><section class=\"card\" style=\"padding:0;overflow:hidden\"><div style=\"background:#173c31;color:white;padding:17px\"><p class=\"eyebrow\" style=\"color:#d4f44d\">Private listing conversation</p><h2 style=\"margin:5px 0 0\">"+C.escapeHtml(thread.partTitle)+"</h2><p style=\"font-size:11px;color:rgba(255,255,255,.65)\">"+C.escapeHtml(sellerSide?"Buyer question":"Seller: "+thread.sellerName)+"</p></div><div class=\"chat\" style=\"padding:14px;max-height:55vh;overflow:auto\">"+((thread.messages||[]).length?thread.messages.map(message=>"<div class=\"bubble"+(message.senderProfileId===myId?" mine":"")+"\"><strong>"+C.escapeHtml(message.senderProfileId===myId?"You":message.senderDisplayName)+"</strong><div>"+C.escapeHtml(message.body)+"</div><small>"+C.dateTime(message.createdAt)+"</small></div>").join(""):"<div class=\"empty\"><p>No messages yet.</p></div>")+"</div>"+(thread.status==="open"?"<form id=\"conversation-form\" style=\"padding:14px;border-top:1px solid rgba(18,34,29,.1)\"><div class=\"search-row\"><textarea id=\"conversation-body\" class=\"textarea\" style=\"min-height:52px\" maxlength=\"2000\" placeholder=\"Write a reply…\"></textarea><button class=\"primary\" type=\"submit\">Send</button></div></form>":"<div class=\"status info\" style=\"margin:14px\">This conversation is closed.</div>")+"</section>";
 document.getElementById("conversation-back").addEventListener("click",()=>UI.route("inbox"));
 const form=document.getElementById("conversation-form");
 if(form)form.addEventListener("submit",async event=>{
  event.preventDefault();
  const body=String(document.getElementById("conversation-body").value||"").trim();
  if(!body)return;
  try{await C.api("/inbox/"+encodeURIComponent(thread.id),{method:"POST",auth:true,body:{body}});UI.route("conversation",{id:thread.id});}
  catch(error){UI.toast(error.message,"error");}
 });
};

const sellerSales=async()=>{
 if(!await UI.requireAuth("sellerSales"))return;
 if(!C.state.me||!C.state.me.seller){UI.empty("□","Seller profile required","Enable selling before opening sales.","Account",()=>UI.route("account",{view:"selling"}));return;}
 UI.loading("Loading sales");
 let sales=[];
 try{sales=(await C.api("/seller/sales",{auth:true})).items||[];}
 catch(error){UI.empty("□","Sales unavailable",error.message,"Try again",()=>UI.route("sellerSales"));return;}

 const html=[];
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Selling</p><h2>Sales & payouts</h2><p>"+sales.length+" sale"+(sales.length===1?"":"s")+" in your transaction history.</p></div></div>");
 if(sales.length){
  html.push(sales.map(sale=>"<section class=\"order-card\"><div class=\"row-between\"><div><h3>"+C.escapeHtml(sale.partTitle)+"</h3><p class=\"subtle\">"+C.dateOnly(sale.orderCreatedAt)+" · "+C.escapeHtml(C.human(sale.fulfilmentStatus))+"</p></div><span class=\"money\">"+C.money(sale.sellerNetPence)+" net</span></div><div class=\"chips\"><span class=\"pill "+statusClass(sale.paymentStatus)+"\">"+C.escapeHtml(C.human(sale.paymentStatus))+"</span><span class=\"pill "+statusClass(sale.payoutStatus)+"\">"+C.escapeHtml(C.human(sale.payoutStatus))+"</span></div><p class=\"subtle\" style=\"margin-top:8px\">Item "+C.money(sale.unitPricePence*sale.quantity)+" · Delivery "+C.money(sale.shippingPence)+" · SecondPart fee −"+C.money(sale.platformFeePence)+"</p><div class=\"button-row\" style=\"margin-top:10px\">"+(sale.paymentStatus==="paid"?"<button class=\"secondary small-button\" data-sale-chat=\""+C.escapeHtml(sale.orderItemId)+"\" type=\"button\">Buyer chat</button>":"")+(sale.fulfilmentStatus==="paid"?"<button class=\"secondary small-button\" data-sales-fulfil=\"preparing\" data-sale-id=\""+C.escapeHtml(sale.orderItemId)+"\" type=\"button\">Preparing</button>":"")+(sale.deliveryMethod==="collection"&&["paid","preparing"].includes(sale.fulfilmentStatus)?"<button class=\"lime-button small-button\" data-sales-fulfil=\"ready_for_collection\" data-sale-id=\""+C.escapeHtml(sale.orderItemId)+"\" type=\"button\">Ready for collection</button>":"")+(sale.deliveryMethod==="shipping"&&["paid","preparing"].includes(sale.fulfilmentStatus)?"<button class=\"primary small-button\" data-sales-dispatch=\""+C.escapeHtml(sale.orderItemId)+"\" type=\"button\">Dispatch</button>":"")+"</div></section>").join(""));
 }else{
  html.push("<div class=\"empty\"><div class=\"empty-icon\">▣</div><h3>No paid sales yet</h3><p>Your paid transactions will appear here.</p></div>");
 }
 UI.app.innerHTML=html.join("");
 UI.app.querySelectorAll("[data-sale-chat]").forEach(button=>button.addEventListener("click",()=>UI.route("transactionChat",{id:button.dataset.saleChat})));
 UI.app.querySelectorAll("[data-sales-fulfil]").forEach(button=>button.addEventListener("click",()=>updateFulfilment(button.dataset.saleId,button.dataset.salesFulfil,null,null,"sellerSales")));
 UI.app.querySelectorAll("[data-sales-dispatch]").forEach(button=>button.addEventListener("click",()=>dispatchModal(button.dataset.salesDispatch,"sellerSales")));
};

const seller=async()=>{
 if(!await UI.requireAuth("seller"))return;
 if(!C.state.me||!C.state.me.seller){UI.empty("□","Seller profile required","Enable selling on your SecondPart account before opening the seller dashboard.","Account",()=>UI.route("account"));return;}
 UI.loading("Loading seller dashboard");
 let sales=[],cases=[],readiness=null;
 try{
  const results=await Promise.all([
   C.api("/seller/sales",{auth:true}),
   C.api("/seller/cases",{auth:true}),
   C.api("/seller/readiness",{auth:true})
  ]);
  sales=results[0].items||[];
  cases=results[1].items||[];
  readiness=results[2].readiness||null;
 }catch(error){UI.empty("□","Seller dashboard unavailable",error.message,"Try again",()=>UI.route("seller"));return;}

 const html=[];
 html.push("<section class=\"account-hero\"><p class=\"eyebrow\" style=\"color:#d4f44d\">Seller dashboard</p><h1>"+C.escapeHtml(C.state.me.seller.businessName)+"</h1><p>"+sales.length+" sale"+(sales.length===1?"":"s")+" · "+cases.filter(item=>!["resolved","rejected","cancelled"].includes(item.status)).length+" active case(s)</p><div class=\"button-row\" style=\"margin-top:14px\"><button id=\"seller-inventory\" class=\"lime-button small-button\" type=\"button\">Inventory & photos</button></div></section>");
 if(readiness){
  const required=readiness.required||[];
  const done=required.filter(item=>item.done).length;
  html.push("<section class=\"card\" style=\"margin-top:12px\"><div class=\"row-between\"><div><p class=\"eyebrow\">Seller readiness</p><h3 style=\"margin:4px 0\">"+(readiness.marketReady?"Ready to sell":"Complete your seller setup")+"</h3></div><span class=\"pill "+(readiness.marketReady?"success":"warning")+"\">"+done+"/"+required.length+" required</span></div><div style=\"margin-top:10px\">"+required.map(item=>"<div class=\"status "+(item.done?"success":"info")+"\" style=\"margin-top:7px\"><strong>"+(item.done?"✓ ":"○ ")+C.escapeHtml(item.label)+"</strong><div style=\"margin-top:2px\">"+C.escapeHtml(item.detail)+"</div></div>").join("")+"</div>"+((readiness.recommended||[]).length?"<details style=\"margin-top:10px\"><summary class=\"link-button\">Recommended trust steps</summary><div>"+readiness.recommended.map(item=>"<div class=\"status "+(item.done?"success":"info")+"\" style=\"margin-top:7px\"><strong>"+(item.done?"✓ ":"○ ")+C.escapeHtml(item.label)+"</strong><div style=\"margin-top:2px\">"+C.escapeHtml(item.detail)+"</div></div>").join("")+"</div></details>":"")+"<div class=\"button-row\" style=\"margin-top:12px\">"+(!readiness.checkoutReady?"<button id=\"seller-payment-setup\" class=\"lime-button small-button\" type=\"button\">Set up payouts</button>":"<span class=\"pill success\">Payments ready</span>")+"<button id=\"seller-payment-refresh\" class=\"secondary small-button\" type=\"button\">Refresh payment status</button>"+(readiness.activeListingCount<1?"<button id=\"seller-readiness-listing\" class=\"secondary small-button\" type=\"button\">Create listing</button>":"")+"</div></section>");
 }
 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Commerce</p><h2>Sales & payouts</h2></div></div>");
 if(sales.length)html.push(sales.map(sale=>"<section class=\"order-card\"><div class=\"row-between\"><div><h3>"+C.escapeHtml(sale.partTitle)+"</h3><p class=\"subtle\">"+C.dateOnly(sale.orderCreatedAt)+" · "+C.escapeHtml(C.human(sale.fulfilmentStatus))+"</p></div><span class=\"money\">"+C.money(sale.sellerNetPence)+" net</span></div><div class=\"chips\"><span class=\"pill "+statusClass(sale.paymentStatus)+"\">"+C.escapeHtml(C.human(sale.paymentStatus))+"</span><span class=\"pill "+statusClass(sale.payoutStatus)+"\">"+C.escapeHtml(C.human(sale.payoutStatus))+"</span></div><p class=\"subtle\" style=\"margin-top:8px\">Item "+C.money(sale.unitPricePence*sale.quantity)+" · Delivery "+C.money(sale.shippingPence)+" · SecondPart fee −"+C.money(sale.platformFeePence)+"</p><div class=\"button-row\" style=\"margin-top:10px\">"+(sale.paymentStatus==="paid"?"<button class=\"secondary small-button\" data-sale-chat=\""+C.escapeHtml(sale.orderItemId)+"\" type=\"button\">Buyer chat</button>":"")+(sale.fulfilmentStatus==="paid"?"<button class=\"secondary small-button\" data-fulfil=\"preparing\" data-sale-id=\""+C.escapeHtml(sale.orderItemId)+"\" type=\"button\">Preparing</button>":"")+(sale.deliveryMethod==="collection"&&["paid","preparing"].includes(sale.fulfilmentStatus)?"<button class=\"lime-button small-button\" data-fulfil=\"ready_for_collection\" data-sale-id=\""+C.escapeHtml(sale.orderItemId)+"\" type=\"button\">Ready for collection</button>":"")+(sale.deliveryMethod==="shipping"&&["paid","preparing"].includes(sale.fulfilmentStatus)?"<button class=\"primary small-button\" data-dispatch=\""+C.escapeHtml(sale.orderItemId)+"\" type=\"button\">Dispatch</button>":"")+"</div></section>").join(""));
 else html.push("<div class=\"empty\"><p>No paid sales yet.</p></div>");

 html.push("<div class=\"section-head\"><div><p class=\"eyebrow\">Buyer protection</p><h2>Cases</h2></div></div>");
 if(cases.length)html.push(cases.map(item=>"<section class=\"order-card\"><div class=\"row-between\"><div><p class=\"eyebrow\">"+C.escapeHtml(C.human(item.caseType))+"</p><h3>"+C.escapeHtml(item.partTitle)+"</h3><p class=\"subtle\">"+C.escapeHtml(item.reason)+"</p></div><span class=\"pill "+statusClass(item.status)+"\">"+C.escapeHtml(C.human(item.status))+"</span></div><p style=\"font-size:11px;line-height:1.55\">"+C.escapeHtml(item.details)+"</p>"+(item.sellerResponse?"<div class=\"status info\">Your response: "+C.escapeHtml(item.sellerResponse)+"</div>":"")+"<div class=\"button-row\" style=\"margin-top:9px\">"+(["open","under_review"].includes(item.status)&&!item.sellerResponse?"<button class=\"secondary small-button\" data-case-response=\""+C.escapeHtml(item.id)+"\" type=\"button\">Respond</button>":"")+(item.status==="return_shipped"?"<button class=\"primary small-button\" data-return-received=\""+C.escapeHtml(item.id)+"\" type=\"button\">Confirm return received</button>":"")+"<button class=\"secondary small-button\" data-seller-evidence=\""+C.escapeHtml(item.id)+"\" type=\"button\">Photos & evidence</button></div></section>").join(""));
 else html.push("<div class=\"empty\"><p>No transaction cases.</p></div>");

 UI.app.innerHTML=html.join("");
 const inventory=document.getElementById("seller-inventory");if(inventory)inventory.addEventListener("click",()=>UI.route("inventory"));
 const readinessListing=document.getElementById("seller-readiness-listing");if(readinessListing)readinessListing.addEventListener("click",()=>UI.route("listingEditor"));
 const paymentSetup=document.getElementById("seller-payment-setup");
 if(paymentSetup)paymentSetup.addEventListener("click",async()=>{
  paymentSetup.disabled=true;paymentSetup.textContent="Opening Stripe…";
  try{
   const result=await C.api("/seller/payments/onboarding",{method:"POST",auth:true});
   const url=C.safeHttpUrl(result.url);
   if(!url)throw new Error("Stripe onboarding URL was invalid.");
   await C.Native.openBrowser(url);
  }catch(error){
   UI.toast(error.message.replaceAll("_"," "),"error");
   paymentSetup.disabled=false;paymentSetup.textContent="Set up payouts";
  }
 });
 const paymentRefresh=document.getElementById("seller-payment-refresh");
 if(paymentRefresh)paymentRefresh.addEventListener("click",async()=>{
  paymentRefresh.disabled=true;paymentRefresh.textContent="Refreshing…";
  try{
   const result=await C.api("/seller/payments/refresh",{method:"POST",auth:true});
   UI.toast(result.complete?"Payments & payouts are ready.":"Payment status refreshed.");
   UI.route("seller");
  }catch(error){
   UI.toast(error.message.replaceAll("_"," "),"error");
   paymentRefresh.disabled=false;paymentRefresh.textContent="Refresh payment status";
  }
 });
 UI.app.querySelectorAll("[data-sale-chat]").forEach(button=>button.addEventListener("click",()=>UI.route("transactionChat",{id:button.dataset.saleChat})));
 UI.app.querySelectorAll("[data-fulfil]").forEach(button=>button.addEventListener("click",()=>updateFulfilment(button.dataset.saleId,button.dataset.fulfil)));
 UI.app.querySelectorAll("[data-dispatch]").forEach(button=>button.addEventListener("click",()=>dispatchModal(button.dataset.dispatch)));
 UI.app.querySelectorAll("[data-case-response]").forEach(button=>button.addEventListener("click",()=>sellerCaseResponse(button.dataset.caseResponse)));
 UI.app.querySelectorAll("[data-return-received]").forEach(button=>button.addEventListener("click",()=>sellerCaseAction(button.dataset.returnReceived,"confirm_return_received")));
 UI.app.querySelectorAll("[data-seller-evidence]").forEach(button=>button.addEventListener("click",()=>void window.SecondPartMedia.openEvidence(button.dataset.sellerEvidence)));
};

const updateFulfilment=async(id,action,carrier,trackingNumber,returnRoute="seller")=>{
 try{
  await C.api("/seller/order-items/"+encodeURIComponent(id)+"/fulfilment",{method:"POST",auth:true,body:{action,carrier,trackingNumber}});
  UI.toast("Sale updated.");UI.route(returnRoute);
 }catch(error){UI.toast(error.message,"error");}
};

const dispatchModal=(id,returnRoute="seller")=>{
 UI.modal("Record dispatch","<form id=\"dispatch-form\" class=\"form-grid\"><label class=\"label\">Carrier<input id=\"dispatch-carrier\" class=\"input\" maxlength=\"80\" placeholder=\"Royal Mail, DPD, Evri…\"/></label><label class=\"label\">Tracking / shipment reference<input id=\"dispatch-tracking\" class=\"input\" minlength=\"3\" maxlength=\"160\" required/></label><button class=\"primary wide\" type=\"submit\">Mark dispatched</button></form>");
 document.getElementById("dispatch-form").addEventListener("submit",event=>{
  event.preventDefault();
  const carrier=String(document.getElementById("dispatch-carrier").value||"").trim();
  const tracking=String(document.getElementById("dispatch-tracking").value||"").trim();
  if(tracking.length<3){UI.toast("Add a tracking or shipment reference.");return;}
  UI.closeModal();updateFulfilment(id,"dispatch",carrier,tracking,returnRoute);
 });
};

const sellerCaseResponse=(caseId)=>{
 UI.modal("Respond to buyer","<form id=\"seller-case-form\" class=\"form-grid\"><label class=\"label\">Response<textarea id=\"seller-case-body\" class=\"textarea\" minlength=\"10\" maxlength=\"2000\" placeholder=\"Explain your position and any evidence or proposed resolution.\"></textarea></label><button class=\"primary wide\" type=\"submit\">Send response</button></form>");
 document.getElementById("seller-case-form").addEventListener("submit",async event=>{
  event.preventDefault();
  const response=String(document.getElementById("seller-case-body").value||"").trim();
  if(response.length<10){UI.toast("Add a little more detail.");return;}
  try{await C.api("/seller/cases",{method:"POST",auth:true,body:{caseId,action:"respond",response}});UI.closeModal();UI.route("seller");}
  catch(error){UI.toast(error.message,"error");}
 });
};

const sellerCaseAction=async(caseId,action)=>{
 try{await C.api("/seller/cases",{method:"POST",auth:true,body:{caseId,action}});UI.toast("Case updated.");UI.route("seller");}
 catch(error){UI.toast(error.message,"error");}
};

UI.register("orders",orders);
UI.register("order",order);
UI.register("transactionChat",transactionChat);
UI.register("inbox",inbox);
UI.register("conversation",conversation);
UI.register("seller",seller);
UI.register("sellerSales",sellerSales);
})();
