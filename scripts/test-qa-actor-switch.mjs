import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const routePath="src/app/api/qa/actor-switch/route.ts";
const pagePath="src/app/qa/actor-switch/page.tsx";
const expectedDigest="5226130fc56a12dd5396a47b6552c263a203fea8f7d65197adeaedbc3365194c";

function readRequired(path){
 assert.ok(fs.existsSync(path),`${path} must exist`);
 return fs.readFileSync(path,"utf8");
}

test("QA actor switch is Preview-only and token-gated through POST body",()=>{
 const route=readRequired(routePath);
 assert.match(route,/VERCEL_ENV\s*!==\s*["']preview["']/);
 assert.match(route,/await\s+request\.formData\(\)/);
 assert.match(route,/createHash\(["']sha256["']\)/);
 assert.match(route,/timingSafeEqual/);
 assert.match(route,new RegExp(expectedDigest));
 assert.doesNotMatch(route,/searchParams\.get\(["']token["']\)/);
});

test("switch can authenticate only the existing QA Seller or QA Buyer",()=>{
 const route=readRequired(routePath);
 const page=readRequired(pagePath);
 assert.match(route,/SecondPart QA Seller/);
 assert.match(route,/SecondPart QA Buyer/);
 assert.match(route,/login-seller/);
 assert.match(route,/login-buyer/);
 assert.match(route,/auth\.admin\.generateLink\(/);
 assert.match(route,/verifyOtp\(/);
 assert.match(page,/value=["']login-seller["']/);
 assert.match(page,/value=["']login-buyer["']/);
 assert.doesNotMatch(route,/createUser\(/);
 assert.doesNotMatch(route,/deleteUser\(/);
 assert.doesNotMatch(route,/role\s*:\s*["']admin["']/);
 assert.doesNotMatch(route,/refundTransactionCase/);
 assert.doesNotMatch(page,/admin/i);
});

test("temporary actor switch page is hidden outside Preview",()=>{
 const page=readRequired(pagePath);
 assert.match(page,/VERCEL_ENV\s*!==\s*["']preview["']/);
 assert.match(page,/method=["']post["']/i);
 assert.match(page,/name=["']token["']/i);
 assert.match(page,/\/api\/qa\/actor-switch/);
});
