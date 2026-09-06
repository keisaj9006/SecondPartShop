import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Header } from "@/components/header";
import { MemberProfileForm } from "@/components/member-profile-form";
import { getCurrentProfile,requireUser } from "@/lib/auth";

export const dynamic="force-dynamic";

export default async function AccountProfilePage(){
  await requireUser("/account/profile");
  const profile=await getCurrentProfile();
  if(!profile)return null;

  return <><Header/><main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Public identity</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Profile & username</h1>
        <p className="mt-2 text-sm leading-6 text-[#63706a]">Control the name other SecondPart members see. Your email and phone number are not exposed publicly.</p>
      </div>
      <Link href={`/member/${profile.handle}`} className="inline-flex w-fit items-center gap-2 rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">View public profile <ExternalLink size={15}/></Link>
    </div>
    <MemberProfileForm profile={profile}/>
  </main></>;
}
