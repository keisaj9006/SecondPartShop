import Link from "next/link";
import {Header} from "@/components/header";
import {AccountDeletionForm} from "@/components/account-deletion-form";
import {getCurrentUser} from "@/lib/auth";

export const dynamic="force-dynamic";

export default async function AccountDeletionPage(){
 const user=await getCurrentUser();

 return <><Header/><main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
  <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Account & data</p>
  <h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Delete your SecondPart account</h1>
  <p className="mt-4 text-sm leading-7 text-[#4f5e57]">This web page is the external account-deletion route for SecondPart. You can use it in a browser even if the Android app is not installed.</p>

  <section className="mt-8 rounded-3xl border border-black/10 bg-white p-5 sm:p-7">
   <h2 className="text-xl font-black">What happens after a request</h2>
   <p className="mt-2 text-sm leading-7 text-[#63706a]">We will process the deletion of your account and personal profile data. Some transaction, payment, fraud-prevention, dispute or legal records may need to be retained where required by law or where necessary to establish, exercise or defend legal claims. Retained records are not kept for general marketplace use.</p>
  </section>

  {user?<section className="mt-6 rounded-3xl border border-red-200 bg-red-50/50 p-5 sm:p-7">
   <h2 className="text-xl font-black text-red-950">Request account deletion</h2>
   <p className="mt-2 text-sm leading-6 text-red-900/75">You are signed in. Submit the request below. Your account remains active until the request is processed.</p>
   <AccountDeletionForm/>
  </section>:<section className="mt-6 rounded-3xl border border-black/10 bg-[#f8f7f2] p-5 sm:p-7">
   <h2 className="text-xl font-black">Sign in to verify ownership</h2>
   <p className="mt-2 text-sm leading-7 text-[#63706a]">For security, we need you to sign in before submitting a deletion request. If you cannot access your password, use password recovery first.</p>
   <div className="mt-5 flex flex-wrap gap-3">
    <Link href="/account?returnTo=%2Faccount-deletion" className="rounded-xl bg-[#173c31] px-4 py-3 text-sm font-black text-white">Sign in to delete account</Link>
    <Link href="/auth/forgot-password" className="rounded-xl border border-black/15 bg-white px-4 py-3 text-sm font-black">Recover access</Link>
   </div>
  </section>}

  <p className="mt-8 text-sm leading-7 text-[#63706a]">For more information about how SecondPart handles personal data, read the <Link href="/privacy" className="font-black text-[#287154] underline">Privacy Policy</Link>.</p>
 </main></>;
}
