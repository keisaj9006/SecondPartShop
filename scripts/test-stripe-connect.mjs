import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

// Exercise the real adapter with only its HTTP boundary replaced. No provider
// credentials, database connection or hosted-onboarding request is used.
const source=fs.readFileSync(new URL("../src/lib/stripe-connect.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;

function adapter(fetch){
 const exports={};
 vm.runInNewContext(compiled,{
  exports,Headers,URL,URLSearchParams,fetch,
  process:{env:{STRIPE_SECRET_KEY:"sk_test_unit_fixture",STRIPE_CONNECT_API_VERSION:"2026-08-26.preview"}},
  require(name){
   if(name==="server-only")return {};
   throw new Error(`Unexpected dependency: ${name}`);
  }
 });
 return exports;
}

function recipient(status){
 return {id:"acct_unit_fixture",configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status}}}}}};
}

test("account retrieval uses indexed includes and preserves an active recipient capability",async()=>{
 let requests=0;
 const api=adapter(async(input,init)=>{
  requests++;
  const url=new URL(input);
  assert.equal(url.origin,"https://api.stripe.com");
  assert.equal(url.pathname,"/v2/core/accounts/acct_unit_fixture");
  assert.deepEqual([...url.searchParams.entries()],[
   ["include[0]","configuration.recipient"],["include[1]","requirements"]
  ]);
  assert.equal(init.method??"GET","GET");
  assert.equal(init.cache,"no-store");
  assert.equal(init.headers.get("Stripe-Version"),"2026-08-26.preview");
  return {ok:true,json:async()=>recipient("active")};
 });
 const account=await api.getStripeRecipientAccount("acct_unit_fixture");
 assert.equal(api.recipientTransferStatus(account),"active");
 assert.equal(requests,1);
});

for(const status of ["restricted","pending","unsupported"]){
 test(`recipient ${status} is never promoted to active`,async()=>{
  const api=adapter(async()=>({ok:true,json:async()=>recipient(status)}));
  const account=await api.getStripeRecipientAccount("acct_unit_fixture");
  assert.equal(api.recipientTransferStatus(account),status);
 });
}

for(const [name,configuration] of [["omitted",undefined],["null",null],["empty",{}]]){
 test(`${name} recipient configuration fails closed`,async()=>{
  const api=adapter(async()=>({ok:true,json:async()=>({id:"acct_unit_fixture",configuration})}));
  const account=await api.getStripeRecipientAccount("acct_unit_fixture");
  assert.equal(api.recipientTransferStatus(account),"unknown");
 });
}

test("provider rejection remains an error instead of an invented readiness status",async()=>{
 const api=adapter(async()=>({ok:false,json:async()=>({error:{message:"Account not found in this sandbox"}})}));
 await assert.rejects(api.getStripeRecipientAccount("acct_unit_fixture"),/Account not found in this sandbox/);
});
