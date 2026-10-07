import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root=path.resolve(import.meta.dirname,"..");

function moduleFrom(relativePath,{user=null,userError=null,profile=null,profileError=null}={}){
 const source=fs.readFileSync(path.join(root,relativePath),"utf8");
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 const auth={async getUser(){return {data:{user},error:userError};}};
 const supabase={auth,from(table){
  assert.equal(table,"profiles");
  const query={select(){return query;},eq(){return query;},async maybeSingle(){return {data:profile,error:profileError};}};
  return query;
 }};
 vm.runInNewContext(compiled,{
  exports,
  require(name){
   if(name==="server-only")return {};
   if(name==="react")return {cache:fn=>fn};
   if(name==="next/navigation")return {redirect(destination){throw Object.assign(new Error(`NEXT_REDIRECT:${destination}`),{destination});}};
   if(name==="./supabase/env")return {isSupabaseConfigured:()=>true};
   if(name==="./supabase/server")return {createSupabaseServerClient:async()=>supabase};
   throw new Error(`Unexpected dependency ${name}`);
  }
 });
 return exports;
}

const user={id:"user-1"};
const profileRow={id:user.id,role:"seller",display_name:"Seller",handle:"seller",bio:null,phone:null};

test("Auth state distinguishes no session, authenticated user, and provider read failure",async()=>{
 const unauthenticated=moduleFrom("src/lib/auth.ts");
 const authenticated=moduleFrom("src/lib/auth.ts",{user});
 const failed=moduleFrom("src/lib/auth.ts",{userError:{message:"provider unavailable"}});
 assert.deepEqual(JSON.parse(JSON.stringify(await unauthenticated.getCurrentUserState())),{kind:"unauthenticated"});
 assert.deepEqual(JSON.parse(JSON.stringify(await authenticated.getCurrentUserState())),{kind:"authenticated",user});
 assert.deepEqual(JSON.parse(JSON.stringify(await failed.getCurrentUserState())),{kind:"error"});
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
