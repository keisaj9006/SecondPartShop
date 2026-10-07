import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { RuntimeUserDatabase } from "./runtime-user.types";
import { getSupabaseEnv } from "./env";
import { hasSupabaseAuthCookieName, SUPABASE_AUTH_COOKIE_PRESENT_HEADER } from "./auth-cookie";
export async function createSupabaseServerClient(){const {url,key}=getSupabaseEnv();const cookieStore=await cookies();return createServerClient<RuntimeUserDatabase>(url,key,{cookies:{getAll:()=>cookieStore.getAll(),setAll:(items)=>{try{items.forEach(({name,value,options})=>cookieStore.set(name,value,options));}catch{/* Server Components cannot write cookies; proxy refreshes sessions. */}}}});}
export async function hasSupabaseAuthCookie(){
 const {url}=getSupabaseEnv();
 const cookieStore=await cookies();
 const requestHeaders=await headers();
 // The proxy marker preserves the incoming state when Supabase has already removed a malformed cookie.
 return requestHeaders.get(SUPABASE_AUTH_COOKIE_PRESENT_HEADER)==="1"||hasSupabaseAuthCookieName(cookieStore.getAll().map(({name})=>name),url);
}
