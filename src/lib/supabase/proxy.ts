import { createServerClient } from "@supabase/ssr";
import { NextResponse,type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { getSupabaseEnv,isSupabaseConfigured } from "./env";
import { hasSupabaseAuthCookieName, SUPABASE_AUTH_COOKIE_PRESENT_HEADER } from "./auth-cookie";
export async function refreshSupabaseSession(request:NextRequest){
 // Supabase can clear malformed cookies before the page reads them; only this proxy may set the downstream evidence marker.
 request.headers.delete(SUPABASE_AUTH_COOKIE_PRESENT_HEADER);
 if(!isSupabaseConfigured())return NextResponse.next({request});
 const {url,key}=getSupabaseEnv();
 if(hasSupabaseAuthCookieName(request.cookies.getAll().map(({name})=>name),url))request.headers.set(SUPABASE_AUTH_COOKIE_PRESENT_HEADER,"1");
 let response=NextResponse.next({request});
 const supabase=createServerClient<Database>(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll:(items)=>{items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 await supabase.auth.getUser();
 return response;
}
