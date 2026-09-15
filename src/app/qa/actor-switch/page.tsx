import type {Metadata} from "next";
import {notFound} from "next/navigation";

export const metadata:Metadata={robots:{index:false,follow:false}};

export default function QaActorSwitchPage(){
 if(process.env.VERCEL_ENV!=="preview")notFound();
 return <main className="mx-auto max-w-xl p-6">
  <h1 className="text-2xl font-semibold">SecondPart QA actor switch</h1>
  <p className="mt-3 text-sm text-zinc-600">Temporary Preview-only login switch for the checkout lifecycle E2E run.</p>
  <form method="post" action="/api/qa/actor-switch" className="mt-6 space-y-4">
   <label className="block text-sm font-medium" htmlFor="qa-actor-token">Bootstrap token</label>
   <input id="qa-actor-token" name="token" type="password" autoComplete="off" required className="w-full rounded-md border px-3 py-2"/>
   <label className="block text-sm font-medium" htmlFor="qa-actor-operation">Operation</label>
   <select id="qa-actor-operation" name="operation" defaultValue="login-seller" className="w-full rounded-md border px-3 py-2">
    <option value="login-seller">Login QA Seller</option>
    <option value="login-buyer">Login QA Buyer</option>
   </select>
   <button type="submit" className="rounded-md border px-4 py-2 font-medium">Switch QA actor</button>
  </form>
 </main>;
}
