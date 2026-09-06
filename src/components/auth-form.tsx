"use client";

import Link from "next/link";
import { useActionState,useState } from "react";
import { ShoppingBag,Store } from "lucide-react";
import { signIn,signUp } from "@/app/auth/actions";
import type { ActionState } from "@/lib/types";

const initial:ActionState={status:"idle"};

export function AuthForm({
 defaultMode="signin",
 defaultRole="buyer",
 returnTo="/account",
 configured=true,
 notice
}:{
 defaultMode?:"signin"|"signup";
 defaultRole?:"buyer"|"seller";
 returnTo?:string;
 configured?:boolean;
 notice?:string;
}){
 const [mode,setMode]=useState(defaultMode);
 const [signupRole,setSignupRole]=useState<"buyer"|"seller">(defaultRole);
 const [signInState,signInAction,signInPending]=useActionState(signIn,initial);
 const [signUpState,signUpAction,signUpPending]=useActionState(signUp,initial);
 const state=mode==="signin"?signInState:signUpState;
 const action=mode==="signin"?signInAction:signUpAction;
 const pending=mode==="signin"?signInPending:signUpPending;
 const input="mt-2 w-full rounded-xl border border-black/15 px-4 py-3 outline-none focus:ring-2 focus:ring-[#173c31]";

 return <div className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-6 shadow-xl sm:p-8">
  <div className="grid grid-cols-2 rounded-xl bg-[#eef1eb] p-1">
   <button type="button" onClick={()=>setMode("signin")} className={`rounded-lg py-2 text-sm font-bold ${mode==="signin"?"bg-white shadow-sm":""}`}>Sign in</button>
   <button type="button" onClick={()=>setMode("signup")} className={`rounded-lg py-2 text-sm font-bold ${mode==="signup"?"bg-white shadow-sm":""}`}>Create account</button>
  </div>

  <h1 className="mt-7 text-3xl font-black tracking-tight">{mode==="signin"?"Welcome back":"Join SecondPart"}</h1>
  <p className="mt-2 text-sm leading-6 text-[#63706a]">
   {mode==="signin"
    ?"One SecondPart login gives you access to buying, and selling too if you enable it."
    :"Choose how you want to start. Seller accounts can also buy parts with the same login."}
  </p>

  {notice&&<p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">{notice}</p>}

  {mode==="signup"&&<div className="mt-6 grid gap-3 sm:grid-cols-2">
   <button
    type="button"
    onClick={()=>setSignupRole("buyer")}
    className={`rounded-2xl border p-4 text-left transition ${signupRole==="buyer"?"border-[#173c31] bg-[#f4f7f2] ring-2 ring-[#173c31]/10":"border-black/10 hover:border-black/20"}`}
   >
    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#173c31] text-[#d4f44d]"><ShoppingBag size={20}/></span>
    <strong className="mt-4 block">I want to buy parts</strong>
    <span className="mt-1 block text-xs leading-5 text-[#63706a]">Garage, compatibility, saved parts, purchases, returns and reviews.</span>
   </button>
   <button
    type="button"
    onClick={()=>setSignupRole("seller")}
    className={`rounded-2xl border p-4 text-left transition ${signupRole==="seller"?"border-[#173c31] bg-[#f4f7f2] ring-2 ring-[#173c31]/10":"border-black/10 hover:border-black/20"}`}
   >
    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#173c31] text-[#d4f44d]"><Store size={20}/></span>
    <strong className="mt-4 block">I want to sell parts</strong>
    <span className="mt-1 block text-xs leading-5 text-[#63706a]">Includes all buyer features. After signup you will set up a private seller or business / garage profile.</span>
   </button>
  </div>}

  <form action={action} className="mt-6">
   <input type="hidden" name="returnTo" value={returnTo}/>
   {mode==="signup"&&<>
    <input type="hidden" name="role" value={signupRole}/>
    <label className="block text-sm font-bold">Your name / contact name<input name="displayName" required minLength={2} className={input}/></label>
   </>}
   <label className={`${mode==="signup"?"mt-4":""} block text-sm font-bold`}>Email address<input name="email" type="email" required autoComplete="email" className={input} placeholder="you@example.co.uk"/></label>
   <label className="mt-4 block text-sm font-bold">Password<input name="password" type="password" required minLength={8} autoComplete={mode==="signin"?"current-password":"new-password"} className={input} placeholder="At least 8 characters"/></label>

   {mode==="signin"&&<div className="mt-2 flex justify-between gap-3 text-xs font-bold">
    <Link href="/auth/forgot-password" className="underline">Forgot password?</Link>
    <Link href="/auth/verify-email" className="underline">Resend confirmation</Link>
   </div>}

   {state.message&&<p role="status" className={`mt-4 rounded-xl p-3 text-sm ${state.status==="error"?"bg-red-50 text-red-800":"bg-emerald-50 text-emerald-800"}`}>{state.message}</p>}
   {mode==="signup"&&state.status==="success"&&<Link href="/auth/verify-email" className="mt-3 inline-block text-sm font-black underline">Resend confirmation email</Link>}

   <button disabled={pending||!configured} className="mt-6 w-full rounded-xl bg-[#173c31] py-3.5 font-black text-white disabled:opacity-50">
    {pending?"Please wait…":mode==="signin"?"Sign in":signupRole==="seller"?"Create seller account":"Create buyer account"}
   </button>
   {!configured&&<p className="mt-3 text-sm text-amber-800">Configure Supabase environment variables to activate authentication.</p>}
  </form>

  {mode==="signin"&&<p className="mt-5 text-center text-xs text-[#63706a]">Already have a buyer account? You can enable selling later without creating another login.</p>}
 </div>;
}
