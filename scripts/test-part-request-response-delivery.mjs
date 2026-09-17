import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const responseTypes=fs.readFileSync("src/lib/part-request-response.ts","utf8");
const data=fs.readFileSync("src/lib/data/part-requests.ts","utf8");
const page=fs.readFileSync("src/app/requests/page.tsx","utf8");

test("buyer part requests expose a bounded public response projection",()=>{
 assert.match(responseTypes,/export type PartRequestResponse=\{/);
 assert.match(responseTypes,/requestId:string/);
 assert.match(responseTypes,/slug:string/);
 assert.match(responseTypes,/title:string/);
 assert.match(responseTypes,/pricePence:number/);
 assert.match(responseTypes,/shippingPence:number/);
 assert.match(responseTypes,/totalPence:number/);
 assert.match(responseTypes,/dispatchDays:number/);
 assert.match(responseTypes,/warrantyDays:number/);
 assert.match(responseTypes,/sellerName:string/);
 assert.match(responseTypes,/sellerVerified:boolean/);
 assert.match(responseTypes,/responses:PartRequestResponse\[\]/);
});

test("request loader returns only currently active linked response listings with comparison fields",()=>{
 assert.match(data,/\.from\("parts"\)/);
 assert.match(data,/\.in\("source_request_id",requestIds\)/);
 assert.match(data,/\.eq\("status","active"\)/);
 assert.match(data,/source_request_id/);
 assert.match(data,/shipping_pence/);
 assert.match(data,/dispatch_days/);
 assert.match(data,/warranty_days/);
 assert.match(data,/sellers!inner\(/);
 assert.match(data,/totalPence:raw\.price_pence\+raw\.shipping_pence/);
 assert.match(data,/responseMap/);
});

test("buyer response projection does not add vehicle registration or private seller fields",()=>{
 const responseSelect=data.match(/const responseSelect=[^;]+;/)?.[0]??"";
 assert.ok(responseSelect,"responseSelect must be explicit and reviewable");
 assert.doesNotMatch(responseSelect,/registration|postcode|owner_id|phone|description|latitude|longitude|email/);
});

test("requests UI distinguishes one response from comparison mode and shows decision fields",()=>{
 assert.match(page,/request\.responses/);
 assert.match(page,/request\.responses\.length>1\?"Compare seller responses":"Seller response"/);
 assert.match(page,/Part price/);
 assert.match(page,/Delivery/);
 assert.match(page,/Delivered total/);
 assert.match(page,/Dispatch/);
 assert.match(page,/Warranty/);
 assert.match(page,/conditionLabel\(response\.condition\)/);
 assert.match(page,/warrantyLabel\(response\.warrantyDays\)/);
 assert.match(page,/Verified seller/);
 assert.match(page,/View part/);
 assert.match(page,/href=\{"\/parts\/"\+response\.slug\}/);
});
