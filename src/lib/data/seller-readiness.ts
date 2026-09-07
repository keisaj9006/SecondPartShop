import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SellerReadinessStep={
 id:string;
 label:string;
 detail:string;
 done:boolean;
 action:"payments"|"inventory"|"verification"|"account"|"profile"|null;
};

export type SellerReadiness={
 marketReady:boolean;
 checkoutReady:boolean;
 activeListingCount:number;
 required:SellerReadinessStep[];
 recommended:SellerReadinessStep[];
 payment:{
  onboardingStatus:string;
  transfersEnabled:boolean;
  payoutsEnabled:boolean;
  detailsSubmitted:boolean;
 }|null;
 verification:{
  verified:boolean;
  requestStatus:string|null;
 }|null;
};

export async function getSellerReadiness(input:{
 sellerId:string;
 sellerType:"business"|"private";
 businessKind:string|null;
 verified:boolean;
 emailConfirmed:boolean;
}):Promise<SellerReadiness>{
 const supabase=await createSupabaseServerClient();
 const [
  {data:payment,error:paymentError},
  {count:activeListings,error:listingError},
  {data:verification,error:verificationError}
 ]=await Promise.all([
  supabase.from("seller_payment_accounts")
   .select("onboarding_status,transfers_enabled,payouts_enabled,details_submitted")
   .eq("seller_id",input.sellerId)
   .maybeSingle(),
  supabase.from("parts")
   .select("id",{count:"exact",head:true})
   .eq("seller_id",input.sellerId)
   .eq("status","active"),
  supabase.from("seller_verification_requests")
   .select("status")
   .eq("seller_id",input.sellerId)
   .order("requested_at",{ascending:false})
   .limit(1)
   .maybeSingle()
 ]);

 if(paymentError||listingError||verificationError){
  throw new Error("Seller readiness is temporarily unavailable.");
 }

 const checkoutReady=Boolean(
  payment?.onboarding_status==="complete"&&
  payment?.transfers_enabled
 );
 const activeCount=activeListings??0;
 const profileReady=input.sellerType==="private"||Boolean(input.businessKind);
 const marketReady=profileReady&&checkoutReady&&activeCount>0;

 return {
  marketReady,
  checkoutReady,
  activeListingCount:activeCount,
  required:[
   {
    id:"seller_profile",
    label:"Seller profile",
    detail:profileReady?"Your public seller identity is set up.":"Choose what type of automotive business you operate.",
    done:profileReady,
    action:profileReady?null:"profile"
   },
   {
    id:"payout_account",
    label:"Payments & payouts",
    detail:checkoutReady
     ?"Stripe onboarding is complete and marketplace transfers are enabled."
     :payment
      ?"Complete the remaining Stripe identity or payout requirements."
      :"Connect Stripe so SecondPart can pay out eligible sales.",
    done:checkoutReady,
    action:"payments"
   },
   {
    id:"active_listing",
    label:"Active listing",
    detail:activeCount>0
     ?`${activeCount} active listing${activeCount===1?"":"s"} available to buyers.`
     :"Publish at least one listing with a real photo and compatibility / part-identity evidence.",
    done:activeCount>0,
    action:"inventory"
   }
  ],
  recommended:[
   {
    id:"email",
    label:"Confirmed email",
    detail:"Helps protect account recovery and transaction communication.",
    done:input.emailConfirmed,
    action:"account"
   },
   ...(input.sellerType==="business"?[{
    id:"business_verification",
    label:"Business verification",
    detail:input.verified
     ?"Your public business profile has the SecondPart verified badge."
     :verification?.status==="pending"
      ?"Your verification request is under review."
      :"Recommended trust signal for garages, breakers and businesses.",
    done:input.verified,
    action:"verification" as const
   }]:[])
  ],
  payment:payment?{
   onboardingStatus:payment.onboarding_status,
   transfersEnabled:payment.transfers_enabled,
   payoutsEnabled:payment.payouts_enabled,
   detailsSubmitted:payment.details_submitted
  }:null,
  verification:input.sellerType==="business"?{
   verified:input.verified,
   requestStatus:verification?.status??null
  }:null
 };
}
