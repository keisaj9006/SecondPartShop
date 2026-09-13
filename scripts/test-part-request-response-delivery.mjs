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
 assert.match(responseTypes,/sellerName:string/);
 assert.match(responseTypes,/sellerVerified:boolean/);
 assert.match(responseTypes,/responses:PartRequestResponse\[\]/);
});

test("request loader returns only currently active linked response listings",()=>{
 assert.match(data,/\.from\("parts"\)/);
 assert.match(data,/\.in\("source_request_id",requestIds\)/);
 assert.match(data,/\.eq\("status","active"\)/);
 assert.match(data,/source_request_id/);
 assert.match(data,/sellers!inner\(/);
 assert.match(data,/responseMap/);
});

test("buyer response projection does not add vehicle registration or private seller fields",()=>{
 const responseSelect=data.match(/const responseSelect=[^;]+;/)?.[0]??"";
 assert.ok(responseSelect,"responseSelect must be explicit and reviewable");
 assert.doesNotMatch(responseSelect,/registration|postcode|owner_id|phone|description/);
});

test("requests UI renders seller responses with a direct listing CTA",()=>{
 assert.match(page,/request\.responses/);
 assert.match(page,/Seller response/);
 assert.match(page,/View part/);
 assert.match(page,/href=\{"\/parts\/"\+response\.slug\}/);
});
