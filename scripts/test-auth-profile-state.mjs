import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { createServerClient } from "@supabase/ssr";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server.js";
import { hasSupabaseAuthCookieName, SUPABASE_AUTH_COOKIE_PRESENT_HEADER } from "../src/lib/supabase/auth-cookie.ts";

const root=path.resolve(import.meta.dirname,"..");

function moduleFrom(relativePath,{user=null,userError=null,authResult=null,authThrow=null,hasAuthCookie=false,profile=null,profileError=null}={}){
 const source=fs.readFileSync(path.join(root,relativePath),"utf8");
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 const auth={async getUser(){if(authThrow)throw authThrow;return authResult??{data:{user},error:userError};}};
 const supabase={auth,from(table){
  assert.equal(table,"profiles");
  const query={select(){return query;},eq(){return query;},async maybeSingle(){return {data:profile,error:profileError};}};
  return query;
 }};
 vm.runInNewContext(compiled,{
  exports,
  URL,
  require(name){
   if(name==="server-only")return {};
   if(name==="@supabase/supabase-js")return {isAuthSessionMissingError};
   if(name==="react")return {cache:fn=>fn};
   if(name==="next/navigation")return {redirect(destination){throw Object.assign(new Error(`NEXT_REDIRECT:${destination}`),{destination});}};
   if(name==="./supabase/env")return {isSupabaseConfigured:()=>true};
   if(name==="./supabase/server")return {createSupabaseServerClient:async()=>supabase,hasSupabaseAuthCookie:async()=>hasAuthCookie};
   throw new Error(`Unexpected dependency ${name}`);
  }
 });
 return exports;
}

function serverModuleFrom(cookieNames,url="https://etkupijfdznljimrfyct.supabase.co",cookieEvidenceHeader=null){
 const source=fs.readFileSync(path.join(root,"src/lib/supabase/server.ts"),"utf8");
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(compiled,{
  exports,
  URL,
  require(name){
   if(name==="server-only")return {};
   if(name==="@supabase/ssr")return {createServerClient(){throw new Error("not used");}};
   if(name==="next/headers")return {cookies:async()=>({getAll:()=>cookieNames.map(name=>({name,value:"redacted"}))}),headers:async()=>({get:key=>key===SUPABASE_AUTH_COOKIE_PRESENT_HEADER?cookieEvidenceHeader:null})};
   if(name==="./env")return {getSupabaseEnv:()=>({url,key:"test-anon-key"})};
   if(name==="./auth-cookie")return {hasSupabaseAuthCookieName,SUPABASE_AUTH_COOKIE_PRESENT_HEADER};
   throw new Error(`Unexpected dependency ${name}`);
  }
 });
 return exports;
}

function proxyModuleFrom(){
 const source=fs.readFileSync(path.join(root,"src/lib/supabase/proxy.ts"),"utf8");
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 vm.runInNewContext(compiled,{
  exports,
  require(name){
   if(name==="@supabase/ssr")return {createServerClient};
   if(name==="next/server")return {NextRequest,NextResponse};
   if(name==="./env")return {getSupabaseEnv:()=>({url:"https://preview-project.supabase.co",key:"test-anon-key"}),isSupabaseConfigured:()=>true};
   if(name==="./auth-cookie")return {hasSupabaseAuthCookieName,SUPABASE_AUTH_COOKIE_PRESENT_HEADER};
   throw new Error(`Unexpected dependency ${name}`);
  }
 });
 return exports;
}

const user={id:"user-1"};
const profileRow={id:user.id,role:"seller",display_name:"Seller",handle:"seller",bio:null,phone:null};

test("auth-cookie presence follows Supabase storage key and chunk naming",async()=>{
 const noCookie=serverModuleFrom(["other-cookie"]);
 const baseCookie=serverModuleFrom(["sb-etkupijfdznljimrfyct-auth-token"]);
 const chunkedCookie=serverModuleFrom(["sb-etkupijfdznljimrfyct-auth-token.0"]);
 assert.equal(await noCookie.hasSupabaseAuthCookie(),false);
 assert.equal(await baseCookie.hasSupabaseAuthCookie(),true);
 assert.equal(await chunkedCookie.hasSupabaseAuthCookie(),true);
});

test("proxy preserves auth-cookie evidence when Supabase clears a malformed session cookie",async()=>{
 const url="https://preview-project.supabase.co";
 const cookieName="sb-preview-project-auth-token";
 const malformedSessionCookie=`base64-${Buffer.from(JSON.stringify({not:"a-session"})).toString("base64url")}`;
 const request=new NextRequest("https://preview.example/account",{headers:{cookie:`${cookieName}=${malformedSessionCookie}`}});
 const proxy=proxyModuleFrom();
 const response=await proxy.refreshSupabaseSession(request);
 const preservedHeader=response.headers.get(`x-middleware-request-${SUPABASE_AUTH_COOKIE_PRESENT_HEADER}`);
 assert.equal(preservedHeader,"1");
 assert.ok(!request.cookies.get(cookieName)?.value,"the SSR proxy clears the malformed cookie before the page reads cookies");
 const remainingCookieNames=request.cookies.getAll().map(({name})=>name);
 const presence=serverModuleFrom(remainingCookieNames,url,preservedHeader);
 assert.equal(await presence.hasSupabaseAuthCookie(),true);
 const staleClient=createServerClient(url,"test-anon-key",{cookies:{getAll:()=>[{name:cookieName,value:malformedSessionCookie}],setAll:()=>{}}});
 const staleResult=await staleClient.auth.getUser();
 assert.equal(staleResult.error?.name,"AuthSessionMissingError");
 const auth=moduleFrom("src/lib/auth.ts",{authResult:staleResult,hasAuthCookie:await presence.hasSupabaseAuthCookie()});
 assert.deepEqual(JSON.parse(JSON.stringify(await auth.getCurrentUserState())),{kind:"error"});
});

test("proxy strips a forged auth-cookie marker from an anonymous request",async()=>{
 const request=new NextRequest("https://preview.example/account",{headers:{[SUPABASE_AUTH_COOKIE_PRESENT_HEADER]:"1"}});
 const proxy=proxyModuleFrom();
 const response=await proxy.refreshSupabaseSession(request);
 const preservedHeader=response.headers.get(`x-middleware-request-${SUPABASE_AUTH_COOKIE_PRESENT_HEADER}`);
 assert.notEqual(preservedHeader,"1");
 const presence=serverModuleFrom([],"https://preview-project.supabase.co",preservedHeader);
 assert.equal(await presence.hasSupabaseAuthCookie(),false);
 const client=createServerClient("https://preview-project.supabase.co","test-anon-key",{cookies:{getAll:()=>[],setAll:()=>{}}});
 const result=await client.auth.getUser();
 const auth=moduleFrom("src/lib/auth.ts",{authResult:result,hasAuthCookie:await presence.hasSupabaseAuthCookie()});
 assert.deepEqual(JSON.parse(JSON.stringify(await auth.getCurrentUserState())),{kind:"unauthenticated"});
});

test("Auth state distinguishes the real SSR no-session response, authenticated user, and provider read failure",async()=>{
 const noSessionClient=createServerClient("https://preview-project.supabase.co","test-anon-key",{cookies:{getAll:()=>[],setAll:()=>{}}});
 const noSession=await noSessionClient.auth.getUser();
 assert.equal(noSession.data.user,null);
 assert.equal(noSession.error?.name,"AuthSessionMissingError");
 const unauthenticated=moduleFrom("src/lib/auth.ts",{authResult:noSession});
 const authenticated=moduleFrom("src/lib/auth.ts",{user});
 const failed=moduleFrom("src/lib/auth.ts",{userError:{message:"provider unavailable"}});
 const networkFailure=moduleFrom("src/lib/auth.ts",{authThrow:new Error("network unavailable")});
 assert.deepEqual(JSON.parse(JSON.stringify(await unauthenticated.getCurrentUserState())),{kind:"unauthenticated"});
 assert.deepEqual(JSON.parse(JSON.stringify(await authenticated.getCurrentUserState())),{kind:"authenticated",user});
 assert.deepEqual(JSON.parse(JSON.stringify(await failed.getCurrentUserState())),{kind:"error"});
 assert.deepEqual(JSON.parse(JSON.stringify(await networkFailure.getCurrentUserState())),{kind:"error"});
});

test("a malformed or stale auth cookie cannot turn a missing-session error into anonymous state",async()=>{
 const malformedSessionCookie=`base64-${Buffer.from(JSON.stringify({not:"a-session"})).toString("base64url")}`;
 const staleClient=createServerClient("https://preview-project.supabase.co","test-anon-key",{cookies:{getAll:()=>[{name:"sb-preview-project-auth-token",value:malformedSessionCookie}],setAll:()=>{}}});
 const staleResult=await staleClient.auth.getUser();
 assert.equal(staleResult.data.user,null);
 assert.equal(staleResult.error?.name,"AuthSessionMissingError");
 const stale=moduleFrom("src/lib/auth.ts",{authResult:staleResult,hasAuthCookie:true});
 assert.deepEqual(JSON.parse(JSON.stringify(await stale.getCurrentUserState())),{kind:"error"});
});

test("only AuthSessionMissingError with no auth cookie is classified as unauthenticated",async()=>{
 const noSessionClient=createServerClient("https://preview-project.supabase.co","test-anon-key",{cookies:{getAll:()=>[],setAll:()=>{}}});
 const sessionMissingError=(await noSessionClient.auth.getUser()).error;
 const sessionMissing=moduleFrom("src/lib/auth.ts",{userError:sessionMissingError,hasAuthCookie:false});
 const arbitraryError=moduleFrom("src/lib/auth.ts",{userError:{name:"AuthApiError"},hasAuthCookie:false});
 const missingWithCookie=moduleFrom("src/lib/auth.ts",{userError:sessionMissingError,hasAuthCookie:true});
 assert.deepEqual(JSON.parse(JSON.stringify(await sessionMissing.getCurrentUserState())),{kind:"unauthenticated"});
 assert.deepEqual(JSON.parse(JSON.stringify(await arbitraryError.getCurrentUserState())),{kind:"error"});
 assert.deepEqual(JSON.parse(JSON.stringify(await missingWithCookie.getCurrentUserState())),{kind:"error"});
});

test("profile state distinguishes present, genuinely missing, and failed reads",async()=>{
 const present=moduleFrom("src/lib/auth.ts",{user,profile:profileRow});
 const missing=moduleFrom("src/lib/auth.ts",{user,profile:null});
 const failed=moduleFrom("src/lib/auth.ts",{user,profileError:{message:"query unavailable"}});
 assert.equal((await present.getCurrentProfileState(user)).kind,"profile");
 assert.deepEqual(JSON.parse(JSON.stringify(await missing.getCurrentProfileState(user))),{kind:"missing"});
 assert.deepEqual(JSON.parse(JSON.stringify(await failed.getCurrentProfileState(user))),{kind:"error"});
});

test("legacy getCurrentUser retains null-on-provider-error behavior",async()=>{
 const failed=moduleFrom("src/lib/auth.ts",{userError:{message:"provider unavailable"}});
 assert.equal(await failed.getCurrentUser(),null);
});

test("seller and admin guards fail closed when the profile is missing or unreadable",async()=>{
 for(const {profile,profileError} of [{profile:null},{profile:null,profileError:{message:"profile query failed"}}]){
  const helpers=moduleFrom("src/lib/auth.ts",{user,profile,profileError});
  await assert.rejects(helpers.requireSeller(),error=>error.destination==="/account?error=seller-required");
  await assert.rejects(helpers.requireAdmin(),error=>error.destination==="/account?error=admin-required");
 }
});
