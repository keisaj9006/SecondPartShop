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

function loadAuthActions(requestOrigin=null){
 const calls={signUp:[],resend:[],passwordReset:[]};
 const auth={
  async signUp(payload){calls.signUp.push(payload);return {data:{session:null},error:null};},
  async resend(payload){calls.resend.push(payload);return {error:null};},
  async resetPasswordForEmail(email,options){calls.passwordReset.push({email,options});return {error:null};}
 };
 const actions=moduleFrom("src/app/auth/actions.ts",{
  "next/cache":{revalidatePath(){}},
  "next/headers":{headers:async()=>new Map([["origin",requestOrigin]])},
  "next/navigation":{redirect(destination){throw new Error(`Unexpected redirect ${destination}`);}},
  "@/lib/supabase/server":{createSupabaseServerClient:async()=>({auth})},
  "@/lib/supabase/env":{isSupabaseConfigured:()=>true},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts"),
  "@/lib/policy-versions":{CURRENT_MARKETPLACE_TERMS_VERSION:"2026-09-01"},
  "@/lib/auth-email-origin":moduleFrom("src/lib/auth-email-origin.ts"),
  "@/lib/auth-error-messages":moduleFrom("src/lib/auth-error-messages.ts")
 });
 return {actions,calls};
}

const signupValues={
 email:"buyer@example.test",
 password:"password123",
 confirmPassword:"password123",
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
 assert.equal(String(response.url),`https://secondpart.test/auth/confirmation-status?state=confirmed&returnTo=${encodeURIComponent(target)}`);

 const unsafe=await GET(new Request("https://secondpart.test/auth/confirm?token_hash=def456&type=email&next=https%3A%2F%2Fattacker.example%2Fsteal"));
 assert.equal(String(unsafe.url),"https://secondpart.test/auth/confirmation-status?state=confirmed&returnTo=%2Faccount");

 const recovery=await GET(new Request("https://secondpart.test/auth/confirm?token_hash=reset&type=recovery&next=%2Faccount"));
 assert.equal(String(recovery.url),"https://secondpart.test/auth/reset-password");
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
 assert.equal(signupUrl.pathname,"/auth/confirmation-status");
 assert.equal(signupUrl.searchParams.get("state"),"invalid");
 assert.equal(signupUrl.searchParams.get("returnTo"),target);
 assert.equal(String(signup.url).includes("expired"),false);
});

function confirmationHarness({exchangeError=null,otpError=null,confirmedUser=null,throwCode=false,throwOtp=false}={}){
 const calls={code:[],otp:[]};
 const {GET}=moduleFrom('src/app/auth/confirm/route.ts',{
  'next/server':{NextResponse:{redirect:url=>({url})}},
  '@/lib/supabase/server':{createSupabaseServerClient:async()=>({auth:{
   exchangeCodeForSession:async code=>{calls.code.push(code);if(throwCode)throw new Error('private exchange diagnostic');return {error:exchangeError};},
   verifyOtp:async payload=>{calls.otp.push(payload);if(throwOtp)throw new Error('private otp diagnostic');return {error:otpError};},
   getUser:async()=>({data:{user:confirmedUser},error:null})
  }})},
  '@/lib/navigation':moduleFrom('src/lib/navigation.ts')
 });
 return {GET,calls};
}

test('default-template PKCE confirmation exchanges code and preserves safe return context',async()=>{
 const h=confirmationHarness();
 const response=await h.GET(new Request('https://secondpart.test/auth/confirm?code=qa-code&next=%2Fsaved'));
 assert.equal(String(response.url),'https://secondpart.test/auth/confirmation-status?state=confirmed&returnTo=%2Fsaved');
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
 assert.equal(url.pathname,'/auth/confirmation-status');
 assert.equal(url.searchParams.get('state'),'invalid');
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
 assert.equal(String(response.url),'https://secondpart.test/auth/confirmation-status?state=confirmed&returnTo=%2Faccount');
 assert.equal(h.calls.code.length,1);
});

test('provider error prevents either credential exchange',async()=>{
 const h=confirmationHarness();
 const response=await h.GET(new Request('https://secondpart.test/auth/confirm?error=access_denied&token_hash=qa&type=email&code=qa-code'));
 assert.equal(h.calls.otp.length,0); assert.equal(h.calls.code.length,0);
 assert.equal(String(response.url),'https://secondpart.test/auth/confirmation-status?state=invalid&returnTo=%2Faccount');
});

test('a failed signup confirmation is already-confirmed only when Auth confirms the current session',async()=>{
 const confirmed=confirmationHarness({otpError:{message:'token already used'},confirmedUser:{email_confirmed_at:'2026-10-07T10:00:00Z'}});
 const confirmedResponse=await confirmed.GET(new Request('https://secondpart.test/auth/confirm?token_hash=used&type=email&next=%2Fparts'));
 assert.equal(String(confirmedResponse.url),'https://secondpart.test/auth/confirmation-status?state=already-confirmed&returnTo=%2Fparts');

 const unconfirmed=confirmationHarness({otpError:{message:'token already used'}});
 const invalidResponse=await unconfirmed.GET(new Request('https://secondpart.test/auth/confirm?token_hash=used&type=email&next=%2Fparts'));
 assert.equal(String(invalidResponse.url),'https://secondpart.test/auth/confirmation-status?state=invalid&returnTo=%2Fparts');
 assert.equal(String(invalidResponse.url).includes('used'),false);
});

test('confirmation status return paths cannot smuggle token or provider fields',async()=>{
 const h=confirmationHarness();
 const nested="/parts?view=front&token_hash=secret&error_description=private#fitment";
 const response=await h.GET(new Request(`https://secondpart.test/auth/confirm?code=qa-code&next=${encodeURIComponent(nested)}`));
 assert.equal(String(response.url),'https://secondpart.test/auth/confirmation-status?state=confirmed&returnTo=%2Fparts%3Fview%3Dfront%23fitment');
});

test('provider network exceptions become bounded invalid state without exposing diagnostics',async()=>{
 const otp=confirmationHarness({throwOtp:true});
 const otpResponse=await otp.GET(new Request('https://secondpart.test/auth/confirm?token_hash=secret&type=email&next=%2Fsaved'));
 assert.equal(String(otpResponse.url),'https://secondpart.test/auth/confirmation-status?state=invalid&returnTo=%2Fsaved');
 assert.equal(String(otpResponse.url).includes('secret'),false);

 const pkce=confirmationHarness({throwCode:true});
 const codeResponse=await pkce.GET(new Request('https://secondpart.test/auth/confirm?code=secret&next=%2Fsaved'));
 assert.equal(String(codeResponse.url),'https://secondpart.test/auth/confirmation-status?state=invalid&returnTo=%2Fsaved');
 assert.equal(String(codeResponse.url).includes('secret'),false);
});

function callbackHarness({exchangeError=null,confirmedUser=null,authError=null,throwCode=false}={}){
 const calls={code:[]};
 const {GET}=moduleFrom('src/app/auth/callback/route.ts',{
  'next/server':{NextResponse:{redirect:url=>({url})}},
  '@/lib/supabase/server':{createSupabaseServerClient:async()=>({auth:{
   exchangeCodeForSession:async code=>{calls.code.push(code);if(throwCode)throw new Error('private callback network error');return {error:exchangeError};},
   getUser:async()=>({data:{user:confirmedUser},error:authError})
  }})},
  '@/lib/navigation':moduleFrom('src/lib/navigation.ts')
 });
 return {GET,calls};
}

test('PKCE callback gives explicit confirmed, invalid and already-confirmed states',async()=>{
 const confirmed=callbackHarness();
 const success=await confirmed.GET(new Request('https://secondpart.test/auth/callback?code=valid&next=%2Fsaved'));
 assert.equal(String(success.url),'https://secondpart.test/auth/confirmation-status?state=confirmed&returnTo=%2Fsaved');
 assert.deepEqual(confirmed.calls.code,['valid']);

 const invalid=callbackHarness({exchangeError:{message:'private callback diagnostic'}});
 const failed=await invalid.GET(new Request('https://secondpart.test/auth/callback?code=expired&next=%2Fsaved'));
 assert.equal(String(failed.url),'https://secondpart.test/auth/confirmation-status?state=invalid&returnTo=%2Fsaved');
 assert.equal(String(failed.url).includes('private'),false);

 const already=callbackHarness({exchangeError:{message:'used'},confirmedUser:{email_confirmed_at:'2026-10-07T10:00:00Z'}});
 const consumed=await already.GET(new Request('https://secondpart.test/auth/callback?code=used&next=%2Fsaved'));
 assert.equal(String(consumed.url),'https://secondpart.test/auth/confirmation-status?state=already-confirmed&returnTo=%2Fsaved');

 const authFailure=callbackHarness({exchangeError:{message:'used'},confirmedUser:{email_confirmed_at:'2026-10-07T10:00:00Z'},authError:{message:'session unavailable'}});
 const unverified=await authFailure.GET(new Request('https://secondpart.test/auth/callback?code=used&next=%2Fsaved'));
 assert.equal(String(unverified.url),'https://secondpart.test/auth/confirmation-status?state=invalid&returnTo=%2Fsaved');
});

test('PKCE callback preserves recovery failure guidance and recovery success',async()=>{
 const failed=callbackHarness({exchangeError:{message:'expired recovery'}});
 const failure=await failed.GET(new Request('https://secondpart.test/auth/callback?code=expired&next=%2Fauth%2Freset-password'));
 assert.equal(String(failure.url),'https://secondpart.test/auth/forgot-password?error=expired-link');
 const success=callbackHarness();
 const reset=await success.GET(new Request('https://secondpart.test/auth/callback?code=valid&next=%2Fauth%2Freset-password'));
 assert.equal(String(reset.url),'https://secondpart.test/auth/reset-password');
});

test('PKCE network exception is a bounded invalid state without credentials in the redirect',async()=>{
 const failed=callbackHarness({throwCode:true});
 const response=await failed.GET(new Request('https://secondpart.test/auth/callback?code=secret&next=%2Fauth%2Fmobile-complete%3Fstate%3Dconfirmed'));
 assert.equal(String(response.url),'https://secondpart.test/auth/confirmation-status?state=invalid&returnTo=%2Fauth%2Fmobile-complete%3Fstate%3Dconfirmed');
 assert.equal(String(response.url).includes('secret'),false);
});

test('token-hash inputs never fall back to a supplied PKCE code',async()=>{
 for(const query of ['token_hash=qa&type=email','token_hash=qa&type=invalid','token_hash=&type=email']){
  const h=confirmationHarness({otpError:{message:'expired'}});
  await h.GET(new Request('https://secondpart.test/auth/confirm?'+query+'&code=qa-code'));
  assert.equal(h.calls.code.length,0);
 }
});

test('signup, resend and recovery retain the configured requesting origin',async()=>{
 const keys=["NEXT_PUBLIC_SITE_URL","VERCEL_ENV","VERCEL_BRANCH_URL","VERCEL_URL"];
 const previous=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 process.env.NEXT_PUBLIC_SITE_URL='https://secondpart.test';
 process.env.VERCEL_ENV='preview';
 process.env.VERCEL_BRANCH_URL='branch.secondpart.test';
 process.env.VERCEL_URL='deployment.secondpart.test';
 try{
  const {actions,calls}=loadAuthActions('https://secondpart.test');
  await actions.signUp({status:'idle'},formData(signupValues));
  await actions.resendConfirmation({status:'idle'},formData({email:signupValues.email}));
  await actions.requestPasswordReset({status:'idle'},formData({email:signupValues.email}));
  for(const value of [calls.signUp[0].options.emailRedirectTo,calls.resend[0].options.emailRedirectTo,calls.passwordReset[0].options.redirectTo]){
   assert.equal(new URL(value).origin,'https://secondpart.test');
  }
 }finally{for(const key of keys){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}}
});
