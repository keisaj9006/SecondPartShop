import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "./supabase/env";
import { createSupabaseServerClient, hasSupabaseAuthCookie } from "./supabase/server";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "./types";

export type CurrentUserState=
 |{kind:"unauthenticated"}
 |{kind:"authenticated";user:User}
 |{kind:"error"};

export type CurrentProfileState=
 |{kind:"profile";profile:Profile}
 |{kind:"missing"}
 |{kind:"error"};

export const getCurrentUserState=cache(async():Promise<CurrentUserState>=>{
 if(!isSupabaseConfigured())return {kind:"error"};
 try{
  const hasAuthCookie=await hasSupabaseAuthCookie();
  const supabase=await createSupabaseServerClient();
  const {data,error}=await supabase.auth.getUser();
  if(error){
   if(isAuthSessionMissingError(error)&&!hasAuthCookie)return {kind:"unauthenticated"};
   return {kind:"error"};
  }
  if(data.user)return {kind:"authenticated",user:data.user};
  return hasAuthCookie?{kind:"error"}:{kind:"unauthenticated"};
 }catch{
  return {kind:"error"};
 }
});

export const getCurrentUser=cache(async()=>{
 const state=await getCurrentUserState();
 return state.kind==="authenticated"?state.user:null;
});

export const getCurrentProfileState=cache(async(user:User):Promise<CurrentProfileState>=>{
 if(!isSupabaseConfigured())return {kind:"error"};
 try{
  const supabase=await createSupabaseServerClient();
  const {data,error}=await supabase
   .from("profiles")
   .select("id,role,display_name,handle,bio,phone")
   .eq("id",user.id)
   .maybeSingle();
  if(error)return {kind:"error"};
  if(!data)return {kind:"missing"};
  return {kind:"profile",profile:{
   id:data.id,
   role:data.role,
   displayName:data.display_name,
   handle:data.handle,
   bio:data.bio,
   phone:data.phone
  }};
 }catch{
  return {kind:"error"};
 }
});

export const getCurrentProfile=cache(async():Promise<Profile|null>=>{
 const user=await getCurrentUser();
 if(!user)return null;
 const state=await getCurrentProfileState(user);
 return state.kind==="profile"?state.profile:null;
});

export async function requireUser(returnTo="/account"){
 const user=await getCurrentUser();
 if(!user)redirect(`/account?reason=signin-required&returnTo=${encodeURIComponent(returnTo)}`);
 return user;
}

export async function requireSeller(returnTo="/dashboard"){
 const user=await requireUser(returnTo);
 const state=await getCurrentProfileState(user);
 const profile=state.kind==="profile"?state.profile:null;
 if(!profile||!(["seller","admin"] as string[]).includes(profile.role))redirect("/account?error=seller-required");
 return {user,profile};
}

export async function requireAdmin(returnTo="/admin/moderation"){
 const user=await requireUser(returnTo);
 const state=await getCurrentProfileState(user);
 const profile=state.kind==="profile"?state.profile:null;
 if(!profile||profile.role!=="admin")redirect("/account?error=admin-required");
 return {user,profile};
}
