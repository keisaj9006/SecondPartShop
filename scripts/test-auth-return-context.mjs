import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root=path.resolve(import.meta.dirname,"..");
const jsxRuntime={
 Fragment:Symbol("Fragment"),
 jsx:(type,props,key)=>({type,props:props??{},key:key??null}),
 jsxs:(type,props,key)=>({type,props:props??{},key:key??null})
};

function moduleFrom(relativePath,dependencies={},globals={}){
 const source=fs.readFileSync(path.join(root,relativePath),"utf8");
 const compiled=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
 }).outputText;
 const exports={};
 vm.runInNewContext(compiled,{
  exports,
  require(name){
   if(name==="react/jsx-runtime")return jsxRuntime;
   if(name in dependencies)return dependencies[name];
   throw new Error(`Unexpected dependency ${name} in ${relativePath}`);
  },
  URL,URLSearchParams,Request,Response,FormData,process,console,...globals
 });
 return exports;
}

function nodes(tree){
 const found=[];
 const visit=value=>{
  if(value===null||value===undefined||typeof value==="boolean")return;
  if(Array.isArray(value)){value.forEach(visit);return;}
  if(typeof value!=="object")return;
  found.push(value);
  visit(value.props?.children);
 };
 visit(tree);
 return found;
}

function textContent(value){
 if(value===null||value===undefined||typeof value==="boolean")return "";
 if(Array.isArray(value))return value.map(textContent).join("");
 if(typeof value==="object")return textContent(value.props?.children);
 return String(value);
}

function findNode(tree,predicate){
 const match=nodes(tree).find(predicate);
 assert.ok(match,"Expected rendered node was not found");
 return match;
}

function formData(values){
 const data=new FormData();
 for(const [key,value] of Object.entries(values))data.set(key,value);
 return data;
}

function loadAuthActions({session=null}={}){
 const calls={signUp:[],signIn:[],resend:[],revalidate:[],redirect:[]};
 const redirect=destination=>{
  calls.redirect.push(destination);
  const error=new Error(`NEXT_REDIRECT:${destination}`);
  error.destination=destination;
  throw error;
 };
 const auth={
  async signUp(payload){calls.signUp.push(payload);return {data:{session},error:null};},
  async signInWithPassword(payload){calls.signIn.push(payload);return {error:null};},
  async resend(payload){calls.resend.push(payload);return {error:null};}
 };
 const actions=moduleFrom("src/app/auth/actions.ts",{
  "next/cache":{revalidatePath:(...args)=>calls.revalidate.push(args)},
  "next/navigation":{redirect},
  "@/lib/supabase/server":{createSupabaseServerClient:async()=>({auth})},
  "@/lib/supabase/env":{isSupabaseConfigured:()=>true},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts"),
  "@/lib/policy-versions":{CURRENT_MARKETPLACE_TERMS_VERSION:"2026-09-01"}
 });
 return {actions,calls};
}

test("safeInternalPath rejects destinations that normalize to protocol-relative paths",()=>{
 const {safeInternalPath}=moduleFrom("src/lib/navigation.ts");
 const unsafe=[
  "/a/..//outside.invalid/path",
  "/%2e%2e//outside.invalid/path",
  "/a/..\\/outside.invalid/path",
  "/a/..//secondpart.invalid/path"
 ];
 for(const destination of unsafe)assert.equal(safeInternalPath(destination,"/fallback"),"/fallback");
 assert.equal(safeInternalPath("/results/../account?view=buying#orders","/fallback"),"/account?view=buying#orders");
});

const signupValues={
 email:"buyer@example.test",
 password:"password123",
 displayName:"Test Buyer",
 role:"buyer",
 termsAccepted:"1"
};

test("signUp carries a product returnTo into the confirmation callback",async()=>{
 const {actions,calls}=loadAuthActions();
 const result=await actions.signUp({status:"idle"},formData({...signupValues,returnTo:"/parts/used-alternator?cv=variant#fitment"}));
 assert.equal(result.status,"success");
 assert.equal(calls.signUp[0].options.emailRedirectTo,"http://localhost:3000/auth/callback?next=%2Fparts%2Fused-alternator%3Fcv%3Dvariant%23fitment");
 assert.deepEqual(JSON.parse(JSON.stringify(calls.signUp[0].options.data)),{display_name:"Test Buyer",role:"buyer",terms_accepted:"true",terms_version:"2026-09-01"});
});

test("signUp returns an immediate session to the complete marketplace context",async()=>{
 const {actions}=loadAuthActions({session:{access_token:"synthetic"}});
 const target="/?q=alternator&category=electrics&cv=variant&cy=2017&cf=PETROL&ce=1400&fit=1&page=3&cursor=after-24#marketplace";
 await assert.rejects(
  actions.signUp({status:"idle"},formData({...signupValues,returnTo:target})),
  error=>error.destination===target
 );
});

test("signUp keeps role defaults for missing and unsafe destinations",async()=>{
 const unsafe=[
  "https://attacker.example/path","//attacker.example/path","/\\attacker.example/path","\\\\attacker.example\\path",
  "/a/..//outside.invalid/path","/%2e%2e//outside.invalid/path","/a/..\\/outside.invalid/path","/a/..//secondpart.invalid/path"
 ];
 for(const [role,want] of [["buyer","/account"],["seller","/dashboard"]]){
  for(const returnTo of [undefined,...unsafe]){
   const {actions,calls}=loadAuthActions({session:{access_token:"synthetic"}});
   const values={...signupValues,role};
   if(returnTo!==undefined)values.returnTo=returnTo;
   await assert.rejects(actions.signUp({status:"idle"},formData(values)),error=>error.destination===want);
   assert.equal(calls.signUp[0].options.emailRedirectTo,`http://localhost:3000/auth/callback?next=${encodeURIComponent(want)}`);
  }
 }
});

test("signUp distinguishes explicit account intent from an absent seller returnTo",async()=>{
 const {actions}=loadAuthActions({session:{access_token:"synthetic"}});
 await assert.rejects(
  actions.signUp({status:"idle"},formData({...signupValues,role:"seller",returnTo:"/account"})),
  error=>error.destination==="/account"
 );
});

test("signIn continues to sanitize its returnTo with the account fallback",async()=>{
 for(const [returnTo,want] of [["/saved?view=parts#latest","/saved?view=parts#latest"],["//attacker.example","/account"]]){
  const {actions}=loadAuthActions();
  await assert.rejects(
   actions.signIn({status:"idle"},formData({email:"buyer@example.test",password:"password123",returnTo})),
   error=>error.destination===want
  );
 }
});

test("resendConfirmation preserves safe context and falls back without context",async()=>{
 for(const [returnTo,want] of [["/?q=starter&category=electrics&vehicle=vehicle-id&fit=0#marketplace","/?q=starter&category=electrics&vehicle=vehicle-id&fit=0#marketplace"],[undefined,"/account"],["/\\attacker.example/path","/account"]]){
  const {actions,calls}=loadAuthActions();
  const values={email:"buyer@example.test"};
  if(returnTo!==undefined)values.returnTo=returnTo;
  const result=await actions.resendConfirmation({status:"idle"},formData(values));
  assert.equal(result.status,"success");
  assert.equal(calls.resend[0].options.emailRedirectTo,`http://localhost:3000/auth/callback?next=${encodeURIComponent(want)}`);
 }
});

function loadAuthForm(){
 return moduleFrom("src/components/auth-form.tsx",{
  "next/link":"a",
  react:{useState:value=>[value,()=>{}],useActionState:()=>[{status:"idle"},()=>{},false]},
  "lucide-react":new Proxy({},{get:()=>()=>null}),
  "@/app/auth/actions":{signIn(){},signUp(){}},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts")
 }).AuthForm;
}

test("AuthForm preserves absence for seller signup and carries safe explicit intent to both resend links",()=>{
 const AuthForm=loadAuthForm();
 const plain=AuthForm({defaultMode:"signup",defaultRole:"seller"});
 assert.equal(nodes(plain).some(node=>node.type==="input"&&node.props.name==="returnTo"),false);

 const target="/account?view=buying#orders";
 const contextual=AuthForm({defaultMode:"signin",returnTo:target});
 assert.equal(findNode(contextual,node=>node.type==="input"&&node.props.name==="returnTo").props.value,target);
 const resend=findNode(contextual,node=>textContent(node)==="Resend confirmation"&&typeof node.props?.href==="string");
 assert.equal(resend.props.href,`/auth/verify-email?returnTo=${encodeURIComponent(target)}`);

 const signupSuccessRuntime={useState:value=>[value,()=>{}],useActionState:action=>[action.name==="signUp"?{status:"success",message:"sent"}:{status:"idle"},()=>{},false]};
 const {AuthForm:SuccessfulAuthForm}=moduleFrom("src/components/auth-form.tsx",{
  "next/link":"a",react:signupSuccessRuntime,"lucide-react":new Proxy({},{get:()=>()=>null}),
  "@/app/auth/actions":{signIn(){},signUp(){}},"@/lib/navigation":moduleFrom("src/lib/navigation.ts")
 });
 const success=SuccessfulAuthForm({defaultMode:"signup",returnTo:target});
 const successResend=findNode(success,node=>textContent(node)==="Resend confirmation email"&&typeof node.props?.href==="string");
 assert.equal(successResend.props.href,`/auth/verify-email?returnTo=${encodeURIComponent(target)}`);
});

test("AccountPage preserves missing returnTo and explicit account intent at the AuthForm boundary",async()=>{
 const AuthForm=()=>null;
 const {default:AccountPage}=moduleFrom("src/app/account/page.tsx",{
  "next/link":"a",react:{Suspense:"Suspense"},"@/components/header":{Header:()=>null},"@/components/auth-form":{AuthForm},
  "@/components/account-dashboard-content":{AccountDashboardContent:()=>null,AccountDashboardFallback:()=>null,AccountTrustSummary:()=>null},
  "@/lib/auth":{getCurrentUser:async()=>null,getCurrentProfile:async()=>null},"@/lib/supabase/env":{isSupabaseConfigured:()=>true},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts")
 });
 const plain=await AccountPage({searchParams:Promise.resolve({mode:"signup",role:"seller"})});
 assert.equal(findNode(plain,node=>node.type===AuthForm).props.returnTo,undefined);
 const explicit=await AccountPage({searchParams:Promise.resolve({mode:"signup",role:"seller",returnTo:"/account"})});
 assert.equal(findNode(explicit,node=>node.type===AuthForm).props.returnTo,"/account");
});

test("verification page and resend form round-trip safe returnTo with a no-context fallback",async()=>{
 const ResendVerificationForm=()=>null;
 const {default:VerifyEmailPage}=moduleFrom("src/app/auth/verify-email/page.tsx",{
  "@/components/header":{Header:()=>null},"@/components/resend-verification-form":{ResendVerificationForm},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts")
 });
 const target="/?q=alternator&cv=variant&cy=2017&cf=PETROL&ce=1400&fit=1#marketplace";
 const page=await VerifyEmailPage({searchParams:Promise.resolve({returnTo:target})});
 assert.equal(findNode(page,node=>node.type===ResendVerificationForm).props.returnTo,target);
 const plainPage=await VerifyEmailPage({searchParams:Promise.resolve({})});
 assert.equal(findNode(plainPage,node=>node.type===ResendVerificationForm).props.returnTo,undefined);

 const {ResendVerificationForm:Form}=moduleFrom("src/components/resend-verification-form.tsx",{
  "next/link":"a",react:{useActionState:()=>[{status:"idle"},()=>{},false]},"@/app/auth/actions":{resendConfirmation(){}},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts")
 });
 const contextual=Form({returnTo:target});
 assert.equal(findNode(contextual,node=>node.type==="input"&&node.props.name==="returnTo").props.value,target);
 assert.equal(findNode(contextual,node=>textContent(node)==="Back to sign in"&&typeof node.props?.href==="string").props.href,`/account?returnTo=${encodeURIComponent(target)}`);
 const plain=Form({});
 assert.equal(nodes(plain).some(node=>node.type==="input"&&node.props.name==="returnTo"),false);
 assert.equal(findNode(plain,node=>textContent(node)==="Back to sign in"&&typeof node.props?.href==="string").props.href,"/account");
});

test("confirmation callback failure retains safe retry context without changing reset failures",async()=>{
 const redirects=[];
 const {GET}=moduleFrom("src/app/auth/callback/route.ts",{
  "next/server":{NextResponse:{redirect:url=>{redirects.push(String(url));return {url:String(url)};}}},
  "@/lib/supabase/server":{createSupabaseServerClient:async()=>({auth:{exchangeCodeForSession:async()=>({error:new Error("expired")})}})},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts")
 });
 await GET(new Request("https://secondpart.test/auth/callback?error=expired&next=%2F%3Fq%3Dalternator%26fit%3D1%23marketplace"));
 assert.equal(redirects.pop(),"https://secondpart.test/account?error=confirmation-failed&returnTo=%2F%3Fq%3Dalternator%26fit%3D1%23marketplace");
 await GET(new Request("https://secondpart.test/auth/callback?error=expired&next=%2Fauth%2Freset-password"));
 assert.equal(redirects.pop(),"https://secondpart.test/auth/forgot-password?error=expired-link");
 await GET(new Request("https://secondpart.test/auth/callback?error=expired&next=%2F%5Cattacker.example"));
 assert.equal(redirects.pop(),"https://secondpart.test/account?error=confirmation-failed");
});

test("successful confirmation callback rejects destinations normalized to protocol-relative paths",async()=>{
 const redirects=[];
 const {GET}=moduleFrom("src/app/auth/callback/route.ts",{
  "next/server":{NextResponse:{redirect:url=>{redirects.push(String(url));return {url:String(url)};}}},
  "@/lib/supabase/server":{createSupabaseServerClient:async()=>({auth:{exchangeCodeForSession:async()=>({error:null})}})},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts")
 });
 for(const next of ["/a/..//outside.invalid/path","/%2e%2e//outside.invalid/path","/a/..\\/outside.invalid/path","/a/..//secondpart.invalid/path"]){
  await GET(new Request(`https://secondpart.test/auth/callback?code=synthetic&next=${encodeURIComponent(next)}`));
  assert.equal(redirects.pop(),"https://secondpart.test/account");
 }
 await GET(new Request("https://secondpart.test/auth/callback?code=synthetic&next=%2Fresults%2F..%2Faccount%3Fview%3Dbuying%23orders"));
 assert.equal(redirects.pop(),"https://secondpart.test/account?view=buying#orders");
});

test("Find My Part signed-out CTA receives and emits the complete current marketplace context",()=>{
 const PartRequestCard=()=>null;
 const marketplaceDependencies={
  "next/link":"a","lucide-react":new Proxy({},{get:()=>()=>null}),"@/app/garage/actions":{saveGarageVehicle(){}},
  "@/components/product-card":{ProductCard:()=>null},"./product-card":{ProductCard:()=>null},"./vehicle-selector":{VehicleSelector:()=>null},
  "./vehicle-visual":{VehicleVisual:()=>null},"./marketplace-filters":{MarketplaceFiltersPanel:()=>null},"./marketplace-search":{MarketplaceSearch:()=>null},
  "./part-request-card":{PartRequestCard},"./postcode-distance-filter":{PostcodeDistanceFilter:()=>null},"./offer-group-card":{OfferGroupCard:()=>null},
  "@/lib/offer-groups":{groupListingsForOffers:()=>[]},"./save-search-control":{SaveSearchControl:()=>null},
  "./vehicle-compatibility-toggle":{VehicleCompatibilityToggle:()=>null},"./vehicle-context-persistence":{VehicleContextPersistence:()=>null}
 };
 const {MarketplaceHome}=moduleFrom("src/components/marketplace-home.tsx",marketplaceDependencies);
 const filters={query:"starter motor",category:"electrics",vehicle:"vehicle-id",catalogueVariant:"variant-id",catalogueYear:2017,catalogueFuel:"PETROL",catalogueEngineSize:1400,compatibleOnly:true};
 const tree=MarketplaceHome({listings:[],categories:[],vehicles:[],garageVehicles:[],recentlyViewed:[],signedIn:false,filters,selectedCatalogue:null,savedIds:[],error:null,configured:true,pagination:{offset:48,limit:24,returned:0,total:0,hasMore:false,mode:"offset",nextCursor:null},currentPage:3,currentCursor:"cursor-token"});
 const target="/?q=starter+motor&category=electrics&vehicle=vehicle-id&cv=variant-id&cy=2017&cf=PETROL&ce=1400&fit=1&page=3&cursor=cursor-token#marketplace";
 assert.equal(findNode(tree,node=>node.type===PartRequestCard).props.returnTo,target);

 const {PartRequestCard:Card}=moduleFrom("src/components/part-request-card.tsx",{
  "next/link":"a","lucide-react":new Proxy({},{get:()=>()=>null}),"@/app/requests/actions":{createPartRequest(){}},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts")
 });
 const card=Card({signedIn:false,filters,returnTo:target});
 assert.equal(findNode(card,node=>textContent(node)==="Sign in to find this part"&&typeof node.props?.href==="string").props.href,`/account?returnTo=${encodeURIComponent(target)}`);
 const unsafe=Card({signedIn:false,filters,returnTo:"//attacker.example/path"});
 assert.equal(findNode(unsafe,node=>typeof node.props?.href==="string").props.href,"/account?returnTo=%2F%23marketplace");
});
