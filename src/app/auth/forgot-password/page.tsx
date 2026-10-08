import { Header } from "@/components/header";
import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const dynamic="force-dynamic";

const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function ForgotPasswordPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=await searchParams;
 const expiredLink=first(query.error)==="expired-link";
 return <><Header/><main className="mx-auto flex min-h-[70vh] max-w-7xl flex-col items-center justify-center gap-5 px-4 py-12">
  {expiredLink&&<p role="status" className="w-full max-w-md rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">This password reset link has expired or is no longer valid. Request a new password reset email below.</p>}
  <ForgotPasswordForm/>
 </main></>;
}
