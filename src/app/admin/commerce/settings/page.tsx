import Link from "next/link";
import { Header } from "@/components/header";
import { CommerceSettingsForm } from "@/components/commerce-settings-form";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic="force-dynamic";

export default async function CommerceSettingsPage(){
 await requireAdmin("/admin/commerce/settings");
 const admin=createSupabaseAdminClient();
 const {data}=await admin
  .from("commerce_settings")
  .select("platform_fee_bps,checkout_reservation_minutes,auto_release_hours,unverified_delivery_review_days")
  .eq("singleton",true)
  .maybeSingle();

 const fee=(data?.platform_fee_bps??0)/100;
 const reservation=data?.checkout_reservation_minutes??30;
 const release=data?.auto_release_hours??48;\n const unverifiedReviewDays=data?.unverified_delivery_review_days??14;

 return <><Header/><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase tracking-[.2em] text-[#287154]">Admin · commerce</p><h1 className="mt-2 text-4xl font-black tracking-[-.045em]">Commerce settings</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#63706a]">These settings affect new checkout reservations only. Existing order money snapshots are never recalculated.</p></div><Link href="/admin/commerce" className="w-fit rounded-full border border-black/15 px-4 py-2.5 text-sm font-black">Back to commerce</Link></div>
  <CommerceSettingsForm platformFeePercent={fee} checkoutReservationMinutes={reservation} autoReleaseHours={release} unverifiedDeliveryReviewDays={unverifiedReviewDays}/>
 </main></>;
}
