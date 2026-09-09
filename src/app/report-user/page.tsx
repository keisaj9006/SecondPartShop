import Link from "next/link";
import {Flag,ShieldAlert} from "lucide-react";
import {Header} from "@/components/header";
import {MarketplaceUserReportForm} from "@/components/marketplace-user-report-form";
import {requireUser} from "@/lib/auth";
import {isUuid} from "@/lib/identifiers";
import {safeInternalPath} from "@/lib/navigation";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const dynamic="force-dynamic";
const first=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;

export default async function ReportUserPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 const profileId=first(params.profile)??"";
 const returnTo=safeInternalPath(first(params.returnTo),"/");
 const user=await requireUser("/report-user?profile="+encodeURIComponent(profileId)+"&returnTo="+encodeURIComponent(returnTo));
 if(!isUuid(profileId)||profileId===user.id)return <><Header/><main className="mx-auto max-w-2xl px-4 py-16"><h1 className="text-3xl font-black">Account not available</h1><Link href={returnTo} className="mt-5 inline-block font-black underline">Go back</Link></main></>;

 const supabase=await createSupabaseServerClient();
 const {data:profile}=await supabase.from("profiles").select("id,display_name,handle").eq("id",profileId).maybeSingle();
 if(!profile)return <><Header/><main className="mx-auto max-w-2xl px-4 py-16"><h1 className="text-3xl font-black">Account not available</h1><Link href={returnTo} className="mt-5 inline-block font-black underline">Go back</Link></main></>;

 return <><Header/><main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
  <Link href={returnTo} className="text-sm font-black underline">Go back</Link>
  <div className="mt-6 rounded-3xl bg-[#173c31] p-6 text-white sm:p-8">
   <div className="flex items-center gap-2 text-[#d4f44d]"><Flag size={18}/><span className="text-xs font-black uppercase tracking-[.16em]">Marketplace safety</span></div>
   <h1 className="mt-3 text-4xl font-black tracking-[-.045em]">Report user</h1>
   <p className="mt-3 text-white/70">Report behaviour that may breach SecondPart rules. Reports are reviewed by the moderation queue.</p>
  </div>
  <section className="mt-6 rounded-3xl border border-black/10 bg-white p-6">
   <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 shrink-0 text-[#287154]"/><div><p className="text-xs font-black uppercase tracking-[.12em] text-[#287154]">Account</p><h2 className="mt-1 text-xl font-black">{profile.display_name}</h2><p className="mt-1 text-sm text-[#63706a]">@{profile.handle}</p></div></div>
   <MarketplaceUserReportForm targetProfileId={profile.id}/>
  </section>
 </main></>;
}
