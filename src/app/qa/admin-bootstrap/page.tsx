import type {Metadata} from "next";
import {notFound} from "next/navigation";

export const metadata:Metadata={robots:{index:false,follow:false}};

export default function QaAdminBootstrapPage(){
 if(process.env.VERCEL_ENV!=="preview")notFound();
 return <main className="mx-auto max-w-xl p-6">
  <h1 className="text-2xl font-semibold">SecondPart QA auth bootstrap</h1>
  <p className="mt-3 text-sm text-zinc-600">Temporary Preview-only control for the provider E2E run.</p>
  <form method="post" action="/api/qa/admin-bootstrap" className="mt-6 space-y-4">
   <label className="block text-sm font-medium" htmlFor="qa-bootstrap-token">Bootstrap token</label>
   <input id="qa-bootstrap-token" name="token" type="password" autoComplete="off" required className="w-full rounded-md border px-3 py-2"/>
   <label className="block text-sm font-medium" htmlFor="qa-bootstrap-operation">Operation</label>
   <select id="qa-bootstrap-operation" name="operation" defaultValue="create-admin" className="w-full rounded-md border px-3 py-2">
    <option value="create-admin">Create/login QA Admin</option>
    <option value="login-admin">Login QA Admin</option>
    <option value="login-seller">Login QA Seller</option>
    <option value="login-buyer">Login QA Buyer</option>
    <option value="cleanup-admin">Delete QA Admin</option>
   </select>
   <button type="submit" className="rounded-md border px-4 py-2 font-medium">Run QA operation</button>
  </form>
 </main>;
}
