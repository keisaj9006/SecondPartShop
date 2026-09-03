"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";
export function createSupabaseBrowserClient(){const {url,key}=getSupabaseEnv();return createBrowserClient<Database>(url,key);}
