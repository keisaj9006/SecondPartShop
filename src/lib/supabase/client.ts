"use client";
import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";
export function createSupabaseBrowserClient(){const {url,key}=getSupabaseEnv();return createBrowserClient(url,key);}
