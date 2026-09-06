import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

export function createSupabasePublicServerClient(){
 const {url,key}=getSupabaseEnv();
 return createClient<Database>(url,key,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
 });
}
