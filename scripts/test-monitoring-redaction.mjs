import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const secrets={
 stripeSigning:"whsec_SYNTHETIC_SIGNING_SECRET_1234567890",
 jwt:"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzeW50aGV0aWMtdGVzdC11c2VyIn0.c3ludGhldGljLXNpZ25hdHVyZS10aGF0LWNhbm5vdC1hdXRoZW50aWNhdGU",
 supabase:"sb_secret_SYNTHETIC_NONFUNCTIONAL_1234567890",
 paymentIntent:"pi_SYNTHETIC123_secret_NONFUNCTIONAL456",
 setupIntent:"seti_SYNTHETIC123_secret_NONFUNCTIONAL456",
 stripeApi:"sk_test_SYNTHETIC_NONFUNCTIONAL_1234567890",
 bearer:"SYNTHETIC.BEARER.TOKEN"
};

const safeIds=[
 "pi_SYNTHETIC123",
 "ch_SYNTHETIC123",
 "tr_SYNTHETIC123",
 "evt_SYNTHETIC123",
 "acct_SYNTHETIC123"
];

const existingSensitive={
 email:"synthetic.user@example.invalid",
 uuid:"11111111-1111-4111-8111-111111111111",
 publishable:"pk_test_SYNTHETIC_NONFUNCTIONAL_1234567890",
 restricted:"rk_live_SYNTHETIC_NONFUNCTIONAL_1234567890"
};

const jwtHeader="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
const longJwt=`${jwtHeader}.${"Q".repeat(2400)}.${"S".repeat(43)}`;
const longJwtClaimFragment="Q".repeat(100);

function loadOps({fetchImpl=async()=>({ok:true,status:204}),env={}}={}){
 const exports={};
 const logs={error:[],warn:[]};
 const source=fs.readFileSync(new URL("../src/lib/ops-monitoring.ts",import.meta.url),"utf8");
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const processStub={env};
 vm.runInNewContext(code,{
  exports,
  require:name=>name==="server-only"?{}:{},
  URL,
  Headers,
  AbortController,
  Error,
  setTimeout,
  clearTimeout,
  fetch:fetchImpl,
  process:processStub,
  console:{error:(...args)=>logs.error.push(args),warn:(...args)=>logs.warn.push(args)}
 });
 return {api:exports,logs};
}

function loadSearchAnalytics({insertError=null,throwError=null}={}){
 const exports={};
 const logs=[];
 const source=fs.readFileSync(new URL("../src/lib/analytics/search.ts",import.meta.url),"utf8");
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const supabase={from:()=>({insert:async()=>({error:insertError})})};
 vm.runInNewContext(code,{
  exports,
  Error,
  require:name=>{
   if(name==="server-only")return {};
   if(name==="@/lib/supabase/admin")return {createSupabaseAdminClient:()=>{if(throwError)throw throwError;return supabase;}};
   if(name==="@/lib/identifiers")return {isUuid:()=>true};
   if(name==="@/lib/ops-monitoring")return loadOps().api;
   return {};
  },
  console:{warn:(...args)=>logs.push(args)}
 });
 return {api:exports,logs};
}

function assertSecretsAbsent(value){
 const serialized=typeof value==="string"?value:JSON.stringify(value);
 for(const secret of Object.values(secrets)){
  assert.ok(!serialized.includes(secret),`synthetic secret leaked: ${secret}`);
 }
}

test("sanitizer redacts provider credentials while preserving safe operational identifiers",()=>{
 const {api}=loadOps();
 const input=[
  `signature=(${secrets.stripeSigning}),`,
  `jwt=${secrets.jwt};`,
  `supabase=${secrets.supabase}!`,
  `payment=${secrets.paymentIntent}.`,
  `setup=${secrets.setupIntent})`,
  `api=${secrets.stripeApi}`,
  `authorization=Bearer ${secrets.bearer}`,
  ...Object.values(existingSensitive),
  ...safeIds,
  "status=requires_payment_method amount=1250"
 ].join(" ");
 const output=api.sanitizeMonitoringText(input,1400);
 assertSecretsAbsent(output);
 for(const value of Object.values(existingSensitive))assert.ok(!output.includes(value));
 for(const id of safeIds)assert.ok(output.includes(id),`safe ID was removed: ${id}`);
 assert.match(output,/status=requires_payment_method amount=1250/);
 assert.ok(output.includes("(\[redacted-token\]),"));
 assert.ok(output.includes("[redacted-token];"));
});

test("sanitizer handles adjacent credentials, URL credentials and bounded truncated input",()=>{
 const {api}=loadOps();
 const adjacent=`${secrets.stripeSigning}/${secrets.supabase}`;
 const url=`https://synthetic-user:${secrets.supabase}@alerts.invalid/hook?signature=${secrets.stripeSigning}#${secrets.jwt}`;
 const output=api.sanitizeMonitoringText(`diagnostic ${adjacent} ${url}`,700);
 assertSecretsAbsent(output);
 assert.ok(output.includes("diagnostic"));
 assert.ok(output.includes("https://alerts.invalid/hook"));
 assert.ok(!output.includes("synthetic-user"));

 const veryLong=`timeout pi_SYNTHETIC123 ${"x".repeat(160)} whsec_${"A".repeat(4000)}`;
 const bounded=api.sanitizeMonitoringText(veryLong,240);
 assert.ok(bounded.length<=240);
 assert.ok(bounded.includes("timeout pi_SYNTHETIC123"));
 assert.ok(!bounded.includes("whsec_"));
});

test("sanitizer redacts a JWT cut inside its payload without erasing dotted diagnostics",()=>{
 const {api}=loadOps();
 for(const max of [80,240,700]){
  const output=api.sanitizeMonitoringText(longJwt,max);
  assert.ok(output.length<=max);
  assert.ok(!output.includes(jwtHeader),`JWT header leaked at max ${max}`);
  assert.ok(!output.includes(longJwtClaimFragment),`JWT claims leaked at max ${max}`);
 }
 const diagnostic="checkout.providerResponse.signature_validation_failed";
 assert.equal(api.sanitizeMonitoringText(diagnostic),diagnostic);
});

test("warning reporting redacts message, route and context before returning or logging",()=>{
 const {api,logs}=loadOps();
 const record=api.reportOperationalWarning({
  component:"checkout",
  event:`retry_${secrets.stripeSigning}`,
  message:`Provider status requires_action for ${safeIds[1]} with ${secrets.paymentIntent}`,
  route:`/checkout/${secrets.supabase}?jwt=${secrets.jwt}`,
  context:{provider:`${secrets.jwt}, ${secrets.setupIntent}`,status:"requires_action",amount:1250}
 });
 assertSecretsAbsent(record);
 assertSecretsAbsent(logs.warn);
 assert.equal(logs.warn.length,1);
 assert.ok(record.message.includes(safeIds[1]));
 assert.equal(record.context.status,"requires_action");
 assert.equal(record.context.amount,1250);
});

test("warning reporting redacts long JWT fragments at field limits and sanitizes context keys",()=>{
 const {api,logs}=loadOps();
 const record=api.reportOperationalWarning({
  component:"checkout",
  event:"provider_diagnostic",
  message:`claims=${longJwt}`,
  context:{[secrets.supabase]:"secret key",claims:longJwt,[longJwt]:"long JWT key",providerCode:"PGRST116"}
 });
 assert.ok(!JSON.stringify(record).includes(jwtHeader));
 assert.ok(!JSON.stringify(record).includes(longJwtClaimFragment));
 assert.ok(!JSON.stringify(logs).includes(jwtHeader));
 assert.ok(!JSON.stringify(logs).includes(longJwtClaimFragment));
 assert.ok(!Object.keys(record.context).some(key=>key.includes("sb_secret_")||key.includes(jwtHeader)));
 assert.equal(record.context.providerCode,"PGRST116");
 assert.ok(record.message.length<=700);
 assert.ok(record.context.claims.length<=240);
 assert.ok(Object.keys(record.context).every(key=>key.length<=60));
});

test("critical error reporting redacts Error fields and mocked alert payload without network access",async()=>{
 const requests=[];
 const fetchImpl=async(url,init)=>{
  requests.push({url:String(url),body:String(init.body)});
  return {ok:true,status:202};
 };
 const {api,logs}=loadOps({fetchImpl,env:{OPS_ALERT_WEBHOOK_URL:"https://alerts.invalid/hook"}});
 const error=new Error(`declined ${safeIds[2]} ${secrets.paymentIntent} ${secrets.jwt} ${"m".repeat(900)}`);
 error.name=`Provider${secrets.supabase}`;
 error.stack=`Error: ${secrets.stripeSigning}\n at synthetic (${secrets.setupIntent}) ${"s".repeat(2000)}`;
 error.digest=secrets.supabase;
 const record=await api.reportOperationalError({
  severity:"critical",
  component:"stripe_webhook",
  event:"provider_failure",
  error,
  route:`/api/stripe/${secrets.stripeSigning}/${"r".repeat(300)}?key=${secrets.supabase}`,
  context:{detail:`${secrets.supabase} ${secrets.jwt} ${"c".repeat(300)}`,status:"declined",eventId:safeIds[3]}
 });
 assertSecretsAbsent(record);
 assertSecretsAbsent(logs.error);
 assertSecretsAbsent(requests);
 assert.equal(requests.length,1);
 assert.equal(record.context.status,"declined");
 assert.equal(record.context.eventId,safeIds[3]);
 assert.ok(record.message.includes(`declined ${safeIds[2]}`));
 assert.ok(record.message.length<=700);
 assert.ok(record.stack.length<=1800);
 assert.ok(record.route.length<=240);
 assert.ok(record.context.detail.length<=240);
});

test("search analytics sanitizes thrown provider messages at the captured console boundary",async()=>{
 const error=new Error(`provider unavailable ${secrets.supabase} claims=${longJwt}`);
 const {api,logs}=loadSearchAnalytics({throwError:error});
 await api.recordMarketplaceSearch({source:"web",query:"alternator",resultCount:0,vehicleContext:false,compatibleOnly:false});
 assert.equal(logs.length,1);
 assert.equal(logs[0][0],"[SecondPart] Search analytics unavailable");
 assert.ok(logs[0][1].includes("provider unavailable"));
 assert.ok(!JSON.stringify(logs).includes(secrets.supabase));
 assert.ok(!JSON.stringify(logs).includes(jwtHeader));
 assert.ok(!JSON.stringify(logs).includes(longJwtClaimFragment));
});

test("search analytics sanitizes provider error codes while preserving safe codes",async()=>{
 const safe=loadSearchAnalytics({insertError:{code:"PGRST116"}});
 await safe.api.recordMarketplaceSearch({source:"mobile",query:"gearbox",resultCount:3,vehicleContext:true,compatibleOnly:true});
 assert.equal(safe.logs[0][1],"PGRST116");

 const sensitive=loadSearchAnalytics({insertError:{code:`provider_${secrets.stripeSigning}`}});
 await sensitive.api.recordMarketplaceSearch({source:"web",query:"starter",resultCount:1,vehicleContext:false,compatibleOnly:false});
 assert.ok(!JSON.stringify(sensitive.logs).includes(secrets.stripeSigning));
 assert.ok(sensitive.logs[0][1].includes("[redacted-token]"));
});
