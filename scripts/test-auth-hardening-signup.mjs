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

function loadAuthActions({signupError=null,signInError=null,resendError=null,resetError=null,updateError=null,session=null}={}){
 const calls={signUp:[],signIn:[],resend:[],reset:[],update:[],createClient:0};
 const auth={
  async signUp(payload){calls.signUp.push(payload);return {data:{session},error:signupError};},
  async signInWithPassword(payload){calls.signIn.push(payload);return {error:signInError};},
  async resend(payload){calls.resend.push(payload);return {error:resendError};},
  async resetPasswordForEmail(email,options){calls.reset.push({email,options});return {error:resetError};},
  async getUser(){return {data:{user:{id:"user-1"}}};},
  async updateUser(payload){calls.update.push(payload);return {error:updateError};}
 };
 const actions=moduleFrom("src/app/auth/actions.ts",{
  "next/cache":{revalidatePath(){}},
  "next/headers":{headers:async()=>new Map()},
  "next/navigation":{redirect(destination){throw Object.assign(new Error(`NEXT_REDIRECT:${destination}`),{destination});}},
  "@/lib/supabase/server":{createSupabaseServerClient:async()=>{calls.createClient++;return {auth};}},
  "@/lib/supabase/env":{isSupabaseConfigured:()=>true},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts"),
  "@/lib/policy-versions":{CURRENT_MARKETPLACE_TERMS_VERSION:"2026-09-01"},
  "@/lib/auth-email-origin":{resolveAuthEmailOrigin:()=>"https://secondpart.test"},
  "@/lib/auth-error-messages":moduleFrom("src/lib/auth-error-messages.ts")
 });
 return {actions,calls};
}

const validSignup={
 email:"buyer@example.test",
 password:"correct-horse-battery",
 confirmPassword:"correct-horse-battery",
 displayName:"Test Buyer",
 role:"buyer",
 termsAccepted:"1"
};

test("signup rejects missing or mismatched confirmPassword before creating a Supabase client",async()=>{
 for(const confirmPassword of [undefined,"different-password"]){
  const {actions,calls}=loadAuthActions();
  const values={...validSignup};
  if(confirmPassword===undefined)delete values.confirmPassword;
  else values.confirmPassword=confirmPassword;
  const result=await actions.signUp({status:"idle"},formData(values));
  assert.equal(result.status,"error");
  assert.match(result.message,/passwords? do not match|confirm your password/i);
  assert.equal(calls.createClient,0);
  assert.equal(calls.signUp.length,0);
 }
});

test("signup without a session returns the confirmation-required success contract",async()=>{
 const {actions,calls}=loadAuthActions();
 const result=await actions.signUp({status:"idle"},formData(validSignup));
 assert.equal(result.status,"success");
 assert.equal(result.message,"Check your email to confirm your account. If the message does not arrive, use the resend confirmation link below.");
 assert.equal(calls.signUp.length,1);
});

test("signup provider errors return bounded copy without leaking provider diagnostics",async()=>{
 const privateDiagnostic="Authentication provider failed: private auth shard 7f31";
 const {actions}=loadAuthActions({signupError:{message:privateDiagnostic,status:500,code:"internal_error"}});
 const result=await actions.signUp({status:"idle"},formData(validSignup));
 assert.equal(result.status,"error");
 assert.ok(result.message.length<=180);
 assert.equal(result.message.includes(privateDiagnostic),false);
 assert.equal(result.message.includes("private auth shard"),false);
});

test("an existing-address signup remains indistinguishable from confirmation-required success",async()=>{
 const normal=loadAuthActions();
 const existing=loadAuthActions({signupError:{message:"User already registered",status:422,code:"user_already_exists"}});
 const [normalResult,existingResult]=await Promise.all([
  normal.actions.signUp({status:"idle"},formData(validSignup)),
  existing.actions.signUp({status:"idle"},formData(validSignup))
 ]);
 assert.deepEqual(JSON.parse(JSON.stringify(existingResult)),JSON.parse(JSON.stringify(normalResult)));
});

test("signup sends confirmed password, role, terms, and safe return context to the provider",async()=>{
 const {actions,calls}=loadAuthActions();
 const returnTo="/parts/used-alternator?cv=variant#fitment";
 const result=await actions.signUp({status:"idle"},formData({...validSignup,role:"seller",returnTo}));
 assert.equal(result.status,"success");
 assert.equal(calls.signUp.length,1);
 const [payload]=calls.signUp;
 assert.equal(payload.email,"buyer@example.test");
 assert.equal(payload.password,validSignup.password);
 assert.equal(payload.options.emailRedirectTo,`https://secondpart.test/auth/confirm?next=${encodeURIComponent(returnTo)}`);
 assert.deepEqual(JSON.parse(JSON.stringify(payload.options.data)),{
  display_name:"Test Buyer",role:"seller",terms_accepted:"true",terms_version:"2026-09-01"
 });
 assert.equal(JSON.stringify(payload).includes("returnTo"),false);
});

test("auth error mapping returns bounded actionable copy by context without provider diagnostics",()=>{
 const {authErrorMessage}=moduleFrom("src/lib/auth-error-messages.ts");
 const cases=[
  [{status:400,code:"invalid_credentials",message:"Invalid login credentials"},"signin","Your email or password is incorrect. Check them and try again."],
  [{status:429,code:"too_many_requests",message:"rate limited"},"resend-confirmation","Please wait before requesting another email, then try again."],
  [{status:500,code:"internal_error",message:"auth shard 7f31 private detail"},"update-password","We could not update your password right now. Please try again."],
  [{message:"auth shard 7f31 private detail"},"signup","We could not create your account right now. Please try again."]
 ];
 for(const [error,context,expected] of cases){
  const message=authErrorMessage(error,context);
  assert.equal(message,expected);
  assert.ok(message.length<=180);
  assert.equal(message.includes("7f31"),false);
 }
});

test("sign-in, resend, reset, and password-update actions never expose provider diagnostics",async()=>{
 const privateDiagnostic="auth shard 7f31 private detail";
 const {actions,calls}=loadAuthActions({
  signInError:{status:500,code:"internal_error",message:privateDiagnostic},
  resendError:{status:429,code:"too_many_requests",message:privateDiagnostic},
  resetError:{status:500,code:"internal_error",message:privateDiagnostic},
  updateError:{status:500,code:"internal_error",message:privateDiagnostic}
 });
 const signIn=await actions.signIn({status:"idle"},formData({email:"buyer@example.test",password:"password123"}));
 const resend=await actions.resendConfirmation({status:"idle"},formData({email:"buyer@example.test"}));
 const reset=await actions.requestPasswordReset({status:"idle"},formData({email:"buyer@example.test"}));
 const update=await actions.updatePassword({status:"idle"},formData({password:"password123",confirmPassword:"password123"}));
 for(const result of [signIn,resend,reset,update]){
  assert.equal(result.status,"error");
  assert.equal(result.message.includes("7f31"),false);
  assert.ok(result.message.length<=180);
 }
 assert.match(resend.message,/wait/i);
 assert.equal(calls.signIn.length,1);
 assert.equal(calls.resend.length,1);
 assert.equal(calls.reset.length,1);
 assert.equal(calls.update.length,1);
});
