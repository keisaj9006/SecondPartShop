import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';

const compiled=ts.transpileModule(fs.readFileSync(new URL('../src/app/account/orders/[orderId]/page.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
async function render(paymentStatus,checkout){
 const order={id:'00000000-0000-4000-8000-000000000001',paymentStatus,status:paymentStatus,createdAt:'2026-09-12T12:00:00Z',items:[],totalPence:100,currency:'GBP'};
 const exports={};
 vm.runInNewContext(compiled,{exports,Intl,Date,require(name){
  if(name==='react/jsx-runtime')return jsxRuntime;
  if(name==='next/link')return {default:({children})=>jsxRuntime.jsx('a',{children})};
  if(name==='next/navigation')return {notFound:()=>{throw Error('not found');}};
  if(name==='lucide-react')return Object.fromEntries(['ArrowLeft','MessageSquareText','PackageCheck','Star','Truck'].map(name=>[name,()=>null]));
  if(name==='@/lib/auth')return {requireUser:async()=>({id:'buyer'})};
  if(name==='@/lib/data/orders')return {getBuyerOrderById:async()=>order,getOrderTimeline:async()=>[]};
  if(name==='@/app/account/orders/checkout-actions')return {resumeCheckout:()=>{}};
  if(name==='@/components/buyer-receipt-controls')return {BuyerReceiptControls:()=>null};
  if(name==='@/components/header')return {Header:()=>null};
  if(name==='@/components/order-timeline')return {OrderTimeline:()=>null};
  throw Error('Unexpected dependency '+name);
 }});
 return renderToStaticMarkup(await exports.default({params:Promise.resolve({orderId:order.id}),searchParams:Promise.resolve({checkout})}));
}

test('unconfirmed cancellation shows actionable guidance instead of disappearing',async()=>{
 const html=await render('unpaid','cancel_pending');assert.match(html,/could not confirm cancellation/i);assert.match(html,/before trying again/i);assert.doesNotMatch(html,/stock reservation was released/i);
});
test('refused cancellation explains that cancellation was not confirmed',async()=>{
 const html=await render('unpaid','not_cancellable');assert.match(html,/could not cancel this checkout/i);assert.doesNotMatch(html,/Payment confirmed\.|stock reservation was released/i);
});
for(const status of ['unpaid','requires_action','processing','cancelled','disputed','refunded'])test('success query cannot invent paid state over '+status,async()=>{assert.doesNotMatch(await render(status,'success'),/Payment confirmed\./);});
for(const status of ['unpaid','requires_action','processing','paid','disputed','refunded'])test('expired query cannot invent released stock over '+status,async()=>{assert.doesNotMatch(await render(status,'expired'),/stock reservation was released/);});
for(const query of ['pending','cancel_pending','not_cancellable'])test(query+' query must not contradict recorded paid state',async()=>{const html=await render('paid',query);assert.doesNotMatch(html,/still confirming|could not confirm cancellation|could not cancel this checkout/i);assert.match(html,/payment is already confirmed/i);});
test('genuine paid return retains payment confirmation',async()=>{assert.match(await render('paid','success'),/Payment confirmed\./);});
test('recorded cancellation can confirm released reservation',async()=>{assert.match(await render('cancelled','expired'),/stock reservation was released/);});
