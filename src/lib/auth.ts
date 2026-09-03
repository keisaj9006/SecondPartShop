import "server-only";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "./supabase/env";
import { createSupabaseServerClient } from "./supabase/server";
import type { Profile } from "./types";
export async function getCurrentUser(){if(!isSupabaseConfigured())return null;const supabase=await createSupabaseServerClient();const {data}=await supabase.auth.getUser();return data.user;}
export async function getCurrentProfile():Promise<Profile|null>{const user=await getCurrentUser();if(!user)return null;const supabase=await createSupabaseServerClient();const {data}=await supabase.from("profiles").select("id,role,display_name,phone").eq("id",user.id).maybeSingle();return data?{id:data.id,role:data.role,displayName:data.display_name,phone:data.phone}:null;}
export async function requireUser(returnTo="/account"){const user=await getCurrentUser();if(!user)redirect(`/account?returnTo=${encodeURIComponent(returnTo)}`);return user;}
export async function requireSeller(returnTo="/dashboard"){const user=await requireUser(returnTo);const profile=await getCurrentProfile();if(!profile||!(["seller","admin"] as string[]).includes(profile.role))redirect("/account?error=seller-required");return {user,profile};}
