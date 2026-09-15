import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";

const helperPath="src/lib/checkout-return-origin.ts";
const actionPath="src/app/checkout/actions.ts";

async function loadHelper(){
 assert.ok(fs.existsSync(helperPath),`${helperPath} must exist`);
 return import(pathToFileURL(path.resolve(helperPath)).href);
}

test("Preview checkout returns to the exact trusted deployment origin that started the payment",async()=>{
 const {resolveCheckoutReturnOrigin}=await loadHelper();
 const canonical="https://second-part-shop-preview.vercel.app";
 const exact="https://second-part-shop-c9dkowd0w-joannakwapis11-5369.vercel.app";
 assert.equal(resolveCheckoutReturnOrigin({
  requestOrigin:exact,
  canonicalOrigin:canonical,
  vercelEnv:"preview",
  vercelUrl:"second-part-shop-c9dkowd0w-joannakwapis11-5369.vercel.app",
  vercelBranchUrl:"second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app"
 }),exact);
});

test("Preview checkout accepts the configured branch alias but rejects arbitrary hosts and insecure origins",async()=>{
 const {resolveCheckoutReturnOrigin}=await loadHelper();
 const canonical="https://second-part-shop-preview.vercel.app";
 const base={
  canonicalOrigin:canonical,
  vercelEnv:"preview",
  vercelUrl:"second-part-shop-c9dkowd0w-joannakwapis11-5369.vercel.app",
  vercelBranchUrl:"second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app"
 };
 assert.equal(resolveCheckoutReturnOrigin({...base,requestOrigin:"https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app"}),"https://second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app");
 assert.equal(resolveCheckoutReturnOrigin({...base,requestOrigin:"https://evil-example.vercel.app"}),canonical);
 assert.equal(resolveCheckoutReturnOrigin({...base,requestOrigin:"http://second-part-shop-c9dkowd0w-joannakwapis11-5369.vercel.app"}),canonical);
});

test("Production checkout always returns to the canonical application origin",async()=>{
 const {resolveCheckoutReturnOrigin}=await loadHelper();
 assert.equal(resolveCheckoutReturnOrigin({
  requestOrigin:"https://second-part-shop-c9dkowd0w-joannakwapis11-5369.vercel.app",
  canonicalOrigin:"https://secondpart.co.uk",
  vercelEnv:"production",
  vercelUrl:"second-part-shop-c9dkowd0w-joannakwapis11-5369.vercel.app",
  vercelBranchUrl:"second-part-shop-git-rebuild-nextjs-joannakwapis11-5369.vercel.app"
 }),"https://secondpart.co.uk");
});

test("checkout action derives Stripe success and cancel URLs from the trusted request origin",()=>{
 const source=fs.readFileSync(actionPath,"utf8");
 assert.match(source,/from\s+["']next\/headers["']/);
 assert.match(source,/resolveCheckoutReturnOrigin/);
 assert.match(source,/successUrl\s*:/);
 assert.match(source,/cancelUrl\s*:/);
 assert.doesNotMatch(source,/cancelUrl:getAppUrl\(\)/);
});
