import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient,User } from "@supabase/supabase-js";
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
  "X-Content-Type-Options":"nosniff",
  "X-SecondPart-API-Version":"v1",
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

export const mobilePublicJson=(request:Request,body:unknown,status=200,sMaxAge=30,staleWhileRevalidate=120)=>{
 const response=mobileJson(request,body,status);
 if(status>=200&&status<300){
  const safeMaxAge=Math.max(0,Math.floor(sMaxAge));
  const safeStale=Math.max(0,Math.floor(staleWhileRevalidate));
  response.headers.set("Cache-Control",`public, max-age=0, s-maxage=${safeMaxAge}, stale-while-revalidate=${safeStale}`);
 }
 return response;
};

export const mobileOptions=(request:Request)=>new Response(null,{status:204,headers:mobileCorsHeaders(request)});

const bearerToken=(request:Request)=>{
 const authorization=request.headers.get("authorization")?.trim()??"";
 if(!authorization.toLowerCase().startsWith("bearer "))return null;
 const token=authorization.slice(7).trim();
 return token.length>=20?token:null;
};

export type MobileApiContext={
 user:User;
 supabase:SupabaseClient<Database>;
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


export async function requireMobileSeller(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return {...auth,seller:null};
 const {user,supabase}=auth.context;
 const [{data:profile,error:profileError},{data:seller,error:sellerError}]=await Promise.all([
  supabase.from("profiles").select("role").eq("id",user.id).maybeSingle(),
  supabase.from("sellers").select("id,owner_id,business_name,slug").eq("owner_id",user.id).maybeSingle()
 ]);
 if(profileError||sellerError||!profile||!seller||!["seller","admin"].includes(profile.role)){
  return {context:null,seller:null,response:mobileJson(request,{ok:false,error:"seller_required"},403)};
 }
 return {context:auth.context,seller,response:null};
}

export async function mobileMarketplaceTermsAccepted(context:MobileApiContext){
 const {data,error}=await context.supabase
  .from("profiles")
  .select("terms_accepted_at,terms_version,privacy_acknowledged_at")
  .eq("id",context.user.id)
  .maybeSingle();
 if(error||!data)return false;
 return Boolean(data.terms_accepted_at&&data.privacy_acknowledged_at&&data.terms_version==="2026-09-09");
}
