import { createServerClient } from "@supabase/ssr";
import { NextResponse,type NextRequest } from "next/server";
import { getSupabaseEnv,isSupabaseConfigured } from "./env";
export async function refreshSupabaseSession(request:NextRequest){let response=NextResponse.next({request});if(!isSupabaseConfigured())return response;const {url,key}=getSupabaseEnv();const supabase=createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll:(items)=>{items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});await supabase.auth.getUser();return response;}
