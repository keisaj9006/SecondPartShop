import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";
export async function createSupabaseServerClient(){const {url,key}=getSupabaseEnv();const cookieStore=await cookies();return createServerClient(url,key,{cookies:{getAll:()=>cookieStore.getAll(),setAll:(items)=>{try{items.forEach(({name,value,options})=>cookieStore.set(name,value,options));}catch{/* Server Components cannot write cookies; proxy refreshes sessions. */}}}});}
