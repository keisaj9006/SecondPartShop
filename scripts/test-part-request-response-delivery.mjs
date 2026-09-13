import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const types=fs.readFileSync("src/lib/types.ts","utf8");
const data=fs.readFileSync("src/lib/data/part-requests.ts","utf8");
const page=fs.readFileSync("src/app/requests/page.tsx","utf8");

test("buyer part requests expose a bounded public response projection",()=>{
 assert.match(types,/export type PartRequestResponse=\{/);
 assert.match(types,/requestId:string/);
 assert.match(types,/slug:string/);
 assert.match(types,/title:string/);
 assert.match(types,/pricePence:number/);
 assert.match(types,/sellerName:string/);
 assert.match(types,/sellerVerified:boolean/);
 assert.match(types,/responses:PartRequestResponse\[\]/);
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
