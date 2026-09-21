import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root=path.resolve(import.meta.dirname,"..");

function moduleFrom(relativePath,dependencies={}){
 const source=fs.readFileSync(path.join(root,relativePath),"utf8");
 const compiled=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const exports={};
 vm.runInNewContext(compiled,{
  exports,
  require(name){
   if(name in dependencies)return dependencies[name];
   throw new Error(`Unexpected dependency ${name} in ${relativePath}`);
  },
  URL,URLSearchParams,Request,Response,FormData,process,console
 });
 return exports;
}

function formData(values){
 const data=new FormData();
 for(const [key,value] of Object.entries(values))data.set(key,value);
 return data;
}

function loadAuthActions(){
 const calls={signUp:[],resend:[],passwordReset:[]};
 const auth={
  async signUp(payload){calls.signUp.push(payload);return {data:{session:null},error:null};},
  async resend(payload){calls.resend.push(payload);return {error:null};},
  async resetPasswordForEmail(email,options){calls.passwordReset.push({email,options});return {error:null};}
 };
 const actions=moduleFrom("src/app/auth/actions.ts",{
  "next/cache":{revalidatePath(){}},
  "next/navigation":{redirect(destination){throw new Error(`Unexpected redirect ${destination}`);}},
  "@/lib/supabase/server":{createSupabaseServerClient:async()=>({auth})},
  "@/lib/supabase/env":{isSupabaseConfigured:()=>true},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts"),
  "@/lib/policy-versions":{CURRENT_MARKETPLACE_TERMS_VERSION:"2026-09-01"},
  "@/lib/auth-email-origin":moduleFrom("src/lib/auth-email-origin.ts")
 });
 return {actions,calls};
}

const signupValues={
 email:"buyer@example.test",
 password:"password123",
 displayName:"Test Buyer",
 role:"buyer",
 termsAccepted:"1"
};

test("signup, resend and recovery emails target the server-side token-hash confirmation endpoint",async()=>{
 const {actions,calls}=loadAuthActions();
 const target="/parts/used-alternator?cv=variant#fitment";

 const signup=await actions.signUp({status:"idle"},formData({...signupValues,returnTo:target}));
 assert.equal(signup.status,"success");
 assert.equal(
  calls.signUp[0].options.emailRedirectTo,
  `http://localhost:3000/auth/confirm?next=${encodeURIComponent(target)}`
 );

 const resend=await actions.resendConfirmation({status:"idle"},formData({email:signupValues.email,returnTo:target}));
 assert.equal(resend.status,"success");
 assert.equal(
  calls.resend[0].options.emailRedirectTo,
  `http://localhost:3000/auth/confirm?next=${encodeURIComponent(target)}`
 );

 const recovery=await actions.requestPasswordReset({status:"idle"},formData({email:signupValues.email}));
 assert.equal(recovery.status,"success");
 assert.equal(
  calls.passwordReset[0].options.redirectTo,
  `http://localhost:3000/auth/confirm?next=${encodeURIComponent("/auth/reset-password")}`
 );
});

test("token-hash confirmation verifies OTP and redirects only to a safe internal destination",async()=>{
 const routePath="src/app/auth/confirm/route.ts";
 assert.equal(fs.existsSync(path.join(root,routePath)),true,"Expected SSR token-hash confirmation route to exist");

 const calls=[];
 const {GET}=moduleFrom(routePath,{
  "next/server":{NextResponse:{redirect:url=>({url})}},
  "@/lib/supabase/server":{createSupabaseServerClient:async()=>({auth:{verifyOtp:async payload=>{calls.push(payload);return {error:null};}}})},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts")
 });

 const target="/saved?view=parts#latest";
 const response=await GET(new Request(`https://secondpart.test/auth/confirm?token_hash=abc123&type=email&next=${encodeURIComponent(target)}`));
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),{token_hash:"abc123",type:"email"});
 assert.equal(String(response.url),`https://secondpart.test${target}`);

 const unsafe=await GET(new Request("https://secondpart.test/auth/confirm?token_hash=def456&type=email&next=https%3A%2F%2Fattacker.example%2Fsteal"));
 assert.equal(String(unsafe.url),"https://secondpart.test/account");
});

test("token-hash confirmation preserves recovery and signup failure UX",async()=>{
 const routePath="src/app/auth/confirm/route.ts";
 assert.equal(fs.existsSync(path.join(root,routePath)),true,"Expected SSR token-hash confirmation route to exist");

 const {GET}=moduleFrom(routePath,{
  "next/server":{NextResponse:{redirect:url=>({url})}},
  "@/lib/supabase/server":{createSupabaseServerClient:async()=>({auth:{verifyOtp:async()=>({error:{message:"expired"}})}})},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts")
 });

 const recovery=await GET(new Request("https://secondpart.test/auth/confirm?token_hash=expired&type=recovery&next=%2Fauth%2Freset-password"));
 assert.equal(String(recovery.url),"https://secondpart.test/auth/forgot-password?error=expired-link");

 const target="/parts/used-alternator?cv=variant#fitment";
 const signup=await GET(new Request(`https://secondpart.test/auth/confirm?token_hash=expired&type=email&next=${encodeURIComponent(target)}`));
 const signupUrl=new URL(String(signup.url));
 assert.equal(signupUrl.pathname,"/account");
 assert.equal(signupUrl.searchParams.get("error"),"confirmation-failed");
 assert.equal(signupUrl.searchParams.get("returnTo"),target);
});

function confirmationHarness({exchangeError=null,otpError=null}={}){
 const calls={code:[],otp:[]};
 const {GET}=moduleFrom('src/app/auth/confirm/route.ts',{
  'next/server':{NextResponse:{redirect:url=>({url})}},
  '@/lib/supabase/server':{createSupabaseServerClient:async()=>({auth:{
   exchangeCodeForSession:async code=>{calls.code.push(code);return {error:exchangeError};},
   verifyOtp:async payload=>{calls.otp.push(payload);return {error:otpError};}
  }})},
  '@/lib/navigation':moduleFrom('src/lib/navigation.ts')
 });
 return {GET,calls};
}

test('default-template PKCE confirmation exchanges code and preserves safe return context',async()=>{
 const h=confirmationHarness();
 const response=await h.GET(new Request('https://secondpart.test/auth/confirm?code=qa-code&next=%2Fsaved'));
 assert.equal(String(response.url),'https://secondpart.test/saved');
 assert.deepEqual(h.calls.code,['qa-code']); assert.equal(h.calls.otp.length,0);
});

test('default-template PKCE recovery reaches reset form only after successful exchange',async()=>{
 const h=confirmationHarness();
 const response=await h.GET(new Request('https://secondpart.test/auth/confirm?code=qa-code&next=%2Fauth%2Freset-password'));
 assert.equal(String(response.url),'https://secondpart.test/auth/reset-password');
 assert.equal(h.calls.code.length,1);
});

test('PKCE failure keeps signup context and never exposes provider details',async()=>{
 const h=confirmationHarness({exchangeError:{message:'private provider diagnostic'}});
 const response=await h.GET(new Request('https://secondpart.test/auth/confirm?code=bad&next=%2Fsaved'));
 const url=new URL(response.url);
 assert.equal(h.calls.code.length,1);
 assert.equal(url.searchParams.get('error'),'confirmation-failed');
 assert.equal(url.searchParams.get('returnTo'),'/saved');
 assert.equal(String(url).includes('private'),false);
});

test('PKCE recovery failure uses expired-link UX',async()=>{
 const h=confirmationHarness({exchangeError:{message:'missing verifier'}});
 const response=await h.GET(new Request('https://secondpart.test/auth/confirm?code=bad&next=%2Fauth%2Freset-password'));
 assert.equal(h.calls.code.length,1);
 assert.equal(String(response.url),'https://secondpart.test/auth/forgot-password?error=expired-link');
});

test('PKCE confirmation rejects external return destinations',async()=>{
 const h=confirmationHarness();
 const response=await h.GET(new Request('https://secondpart.test/auth/confirm?code=qa-code&next=https%3A%2F%2Fevil.test'));
 assert.equal(String(response.url),'https://secondpart.test/account');
 assert.equal(h.calls.code.length,1);
});

test('provider error prevents either credential exchange',async()=>{
 const h=confirmationHarness();
 const response=await h.GET(new Request('https://secondpart.test/auth/confirm?error=access_denied&token_hash=qa&type=email&code=qa-code'));
 assert.equal(h.calls.otp.length,0); assert.equal(h.calls.code.length,0);
 assert.equal(String(response.url),'https://secondpart.test/account?error=confirmation-failed');
});

test('token-hash inputs never fall back to a supplied PKCE code',async()=>{
 for(const query of ['token_hash=qa&type=email','token_hash=qa&type=invalid','token_hash=&type=email']){
  const h=confirmationHarness({otpError:{message:'expired'}});
  await h.GET(new Request('https://secondpart.test/auth/confirm?'+query+'&code=qa-code'));
  assert.equal(h.calls.code.length,0);
 }
});
