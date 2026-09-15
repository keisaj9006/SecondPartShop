import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const routePath="src/app/api/qa/admin-bootstrap/route.ts";
const pagePath="src/app/qa/admin-bootstrap/page.tsx";
const expectedDigest="5226130fc56a12dd5396a47b6552c263a203fea8f7d65197adeaedbc3365194c";
const qaRefundCaseId="e924aa7f-f117-4f30-849b-de611da11bdf";

function readRequired(path){
 assert.ok(fs.existsSync(path),`${path} must exist`);
 return fs.readFileSync(path,"utf8");
}

test("QA admin bootstrap is Preview-only and accepts its secret only through POST form data",()=>{
 const route=readRequired(routePath);
 assert.match(route,/VERCEL_ENV\s*!==\s*["']preview["']/);
 assert.match(route,/await\s+request\.formData\(\)/);
 assert.match(route,/createHash\(["']sha256["']\)/);
 assert.match(route,/timingSafeEqual/);
 assert.match(route,new RegExp(expectedDigest));
 assert.doesNotMatch(route,/searchParams\.get\(["']token["']\)/);
 assert.doesNotMatch(route,/SUPABASE_SERVICE_ROLE_KEY/);
});

test("bootstrap creates only the dedicated QA admin through Supabase Auth Admin API",()=>{
 const route=readRequired(routePath);
 assert.match(route,/auth\.admin\.createUser\(/);
 assert.match(route,/SecondPart QA Admin/);
 assert.match(route,/qa-admin-20260915@example\.com/);
 assert.match(route,/email_confirm\s*:\s*true/);
 assert.match(route,/\.update\(\{\s*role\s*:\s*["']admin["']/s);
 assert.match(route,/\.eq\(["']role["'],["']admin["']\)/);
});

test("bootstrap switches QA actors with generated Supabase magic links instead of changing passwords",()=>{
 const route=readRequired(routePath);
 assert.match(route,/auth\.admin\.generateLink\(/);
 assert.match(route,/type\s*:\s*["']magiclink["']/);
 assert.match(route,/verifyOtp\(/);
 assert.match(route,/SecondPart QA Seller/);
 assert.match(route,/SecondPart QA Buyer/);
 assert.match(route,/SecondPart QA Admin/);
 assert.doesNotMatch(route,/updateUserById\([^)]*password/s);
});

test("cleanup can delete only the dedicated QA admin account",()=>{
 const route=readRequired(routePath);
 assert.match(route,/auth\.admin\.deleteUser\(/);
 assert.match(route,/qa-admin-20260915@example\.com/);
 assert.match(route,/SecondPart QA Admin/);
});

test("provider retry control is pinned to the resolved QA refund case and expects a no-op core result",()=>{
 const route=readRequired(routePath);
 const page=readRequired(pagePath);
 assert.match(route,/refundTransactionCase/);
 assert.match(route,new RegExp(qaRefundCaseId));
 assert.match(route,/retry-refund-e2e/);
 assert.match(route,/status["']?\s*[:,)]|\.eq\(["']status["'],["']resolved["']\)/s);
 assert.match(route,/resolution["']?\s*[:,)]|full_refund/s);
 assert.match(route,/provider_refund_id/);
 assert.match(route,/reason\s*!==\s*["']already_refunded["']/);
 assert.match(page,/value=["']retry-refund-e2e["']/);
});

test("temporary bootstrap page is hidden outside Preview and posts the token",()=>{
 const page=readRequired(pagePath);
 assert.match(page,/VERCEL_ENV\s*!==\s*["']preview["']/);
 assert.match(page,/method=["']post["']/i);
 assert.match(page,/name=["']token["']/i);
 assert.match(page,/\/api\/qa\/admin-bootstrap/);
});
