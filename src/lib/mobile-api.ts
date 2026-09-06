import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseEnv } from "@/lib/supabase/env";

const mobileOrigins=new Set([
 "capacitor://localhost",
 "http://localhost",
 "https://localhost"
]);

const canonicalOrigin=()=>{
 const value=process.env.NEXT_PUBLIC_SITE_URL?.trim()||process.env.NEXT_PUBLIC_APP_URL?.trim();
 if(!value)return null;
 try{return new URL(value).origin;}catch{return null;}
};

export const mobileCorsHeaders=(request:Request)=>{
 const headers=new Headers({
  "Cache-Control":"no-store",
  "Access-Control-Allow-Headers":"authorization,content-type",
  "Access-Control-Allow-Methods":"GET,POST,PATCH,DELETE,OPTIONS",
  "Vary":"Origin"
 });
 const origin=request.headers.get("origin");
 const site=canonicalOrigin();
 if(origin&&(mobileOrigins.has(origin)||origin===site))headers.set("Access-Control-Allow-Origin",origin);
 return headers;
};

export const mobileJson=(request:Request,body:unknown,status=200)=>
 new Response(JSON.stringify(body),{
  status,
  headers:new Headers({
   ...Object.fromEntries(mobileCorsHeaders(request)),
   "Content-Type":"application/json; charset=utf-8"
  })
 });

export const mobileOptions=(request:Request)=>new Response(null,{status:204,headers:mobileCorsHeaders(request)});

const bearerToken=(request:Request)=>{
 const authorization=request.headers.get("authorization")?.trim()??"";
 if(!authorization.toLowerCase().startsWith("bearer "))return null;
 const token=authorization.slice(7).trim();
 return token.length>=20?token:null;
};

export type MobileApiContext={
 user:User;
 supabase:ReturnType<typeof createClient<Database>>;
 accessToken:string;
};

export async function authenticateMobileRequest(request:Request):Promise<MobileApiContext|null>{
 const accessToken=bearerToken(request);
 if(!accessToken)return null;
 const {url,key}=getSupabaseEnv();

 const verifier=createClient<Database>(url,key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 });
 const {data,error}=await verifier.auth.getUser(accessToken);
 if(error||!data.user)return null;

 const supabase=createClient<Database>(url,key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
  global:{headers:{Authorization:"Bearer "+accessToken}}
 });
 return {user:data.user,supabase,accessToken};
}

export async function requireMobileUser(request:Request){
 const context=await authenticateMobileRequest(request);
 if(!context)return {context:null,response:mobileJson(request,{ok:false,error:"unauthorized"},401)};
 return {context,response:null};
}
