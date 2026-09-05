import Link from "next/link";
import { KeyRound,MailCheck,ShieldCheck,Trash2 } from "lucide-react";
import { Header } from "@/components/header";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cancelAccountDeletion } from "./actions";
import { AccountDeletionForm } from "@/components/account-deletion-form";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function AccountSecurityPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const user=await requireUser("/account/security");
 const params=await searchParams;
 const supabase=await createSupabaseServerClient();
 const {data:pending}=await supabase
  .from("account_deletion_requests")
  .select("id,requested_at")
  .eq("profile_id",user.id)
  .eq("status","requested")
  .maybeSingle();
 return <><Header/><main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Your account</p>
  <h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Security & account</h1>
  <p className="mt-2 max-w-2xl text-[#63706a]">Recovery, verification and account-control tools for your SecondPart profile.</p>
  {first(params.password)==="updated"&&<p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-900">Your password was updated successfully.</p>}

  <section className="mt-8 grid gap-4 sm:grid-cols-2">
   <Link href="/auth/forgot-password" className="rounded-3xl border border-black/10 bg-white p-5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef1eb]"><KeyRound size={21}/></span><h2 className="mt-4 text-lg font-black">Reset password</h2><p className="mt-1 text-sm leading-6 text-[#63706a]">Send a secure recovery link to the email address on your account.</p></Link>
   <Link href="/auth/verify-email" className="rounded-3xl border border-black/10 bg-white p-5"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eef1eb]"><MailCheck size={21}/></span><h2 className="mt-4 text-lg font-black">Email verification</h2><p className="mt-1 text-sm leading-6 text-[#63706a]">Resend a confirmation message if the original link expired or never arrived.</p></Link>
  </section>

  <section className="mt-8 rounded-3xl border border-black/10 bg-white p-5 sm:p-7">
   <div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#173c31] text-[#d4f44d]"><ShieldCheck size={21}/></span><div><h2 className="text-xl font-black">Account protection</h2><p className="mt-1 text-sm leading-6 text-[#63706a]">SecondPart never asks you to send your password or recovery links to another user. Recovery emails should only be used by you.</p></div></div>
  </section>

  <section className="mt-8 rounded-3xl border border-red-200 bg-red-50/50 p-5 sm:p-7">
   <div className="flex items-start gap-3"><Trash2 size={21} className="mt-0.5 shrink-0 text-red-700"/><div><h2 className="text-xl font-black text-red-950">Delete account</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-red-900/75">Submitting a request does not immediately erase your account. This gives us a controlled path for marketplace records, active disputes and future legal retention requirements before launch.</p></div></div>
   {pending?<div className="mt-5 rounded-2xl border border-red-200 bg-white p-4"><p className="font-black text-red-950">Deletion request pending</p><p className="mt-1 text-sm text-red-900/70">Requested {new Date(pending.requested_at).toLocaleDateString("en-GB")}.</p><form action={cancelAccountDeletion}><button className="mt-4 rounded-xl border border-red-300 px-4 py-2.5 text-sm font-black text-red-800">Cancel deletion request</button></form></div>:<AccountDeletionForm/>}
  </section>
 </main></>;
}
