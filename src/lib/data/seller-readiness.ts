import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SellerReadinessAction="payments"|"inventory"|"verification"|"account"|"profile"|"donors"|"import"|null;

export type SellerReadinessStep={
 id:string;
 label:string;
 detail:string;
 done:boolean;
 action:SellerReadinessAction;
};

export type SellerReadiness={
 marketReady:boolean;
 checkoutReady:boolean;
 activeListingCount:number;
 totalListingCount:number;
 donorVehicleCount:number;
 required:SellerReadinessStep[];
 recommended:SellerReadinessStep[];
 onboarding:{
  steps:SellerReadinessStep[];
  nextAction:SellerReadinessAction;
  nextLabel:string|null;
  complete:boolean;
 };
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
  {count:allListings,error:allListingsError},
  {count:donorVehicles,error:donorError},
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
  supabase.from("parts")
   .select("id",{count:"exact",head:true})
   .eq("seller_id",input.sellerId),
  supabase.from("donor_vehicles")
   .select("id",{count:"exact",head:true})
   .eq("seller_id",input.sellerId),
  supabase.from("seller_verification_requests")
   .select("status")
   .eq("seller_id",input.sellerId)
   .order("requested_at",{ascending:false})
   .limit(1)
   .maybeSingle()
 ]);

 if(paymentError||listingError||allListingsError||donorError||verificationError){
  throw new Error("Seller readiness is temporarily unavailable.");
 }

 const checkoutReady=Boolean(
  payment?.onboarding_status==="complete"&&
  payment?.transfers_enabled
 );
 const activeCount=activeListings??0;
 const totalCount=allListings??0;
 const donorCount=donorVehicles??0;
 const profileReady=input.sellerType==="private"||Boolean(input.businessKind);
 const businessVerificationStarted=input.sellerType!=="business"||input.verified||verification?.status==="pending";
 const donorRelevant=input.sellerType==="business"&&["breaker","atf","garage"].includes(input.businessKind??"");
 const marketReady=profileReady&&checkoutReady&&activeCount>0;

 const onboardingSteps:SellerReadinessStep[]=[
  {
   id:"onboarding_profile",
   label:"Complete seller profile",
   detail:profileReady?"Seller type and public business identity are set.":"Choose the correct automotive business type before building inventory.",
   done:profileReady,
   action:profileReady?null:"profile"
  },
  ...(input.sellerType==="business"?[{
   id:"onboarding_verification",
   label:"Submit business verification",
   detail:input.verified
    ?"Business verification is approved."
    :verification?.status==="pending"
     ?"Verification is under review. You can continue with payouts and inventory while it is checked."
     :"Submit business evidence to build trust before launch.",
   done:businessVerificationStarted,
   action:businessVerificationStarted?null:"verification" as SellerReadinessAction
  }]:[]),
  {
   id:"onboarding_payouts",
   label:"Set up payouts",
   detail:checkoutReady?"Stripe transfers are enabled.":"Complete Stripe onboarding before buyers can pay for your live listings.",
   done:checkoutReady,
   action:checkoutReady?null:"payments"
  },
  ...(donorRelevant?[{
   id:"onboarding_donor",
   label:"Add your first donor vehicle",
   detail:donorCount>0
    ?`${donorCount} donor vehicle${donorCount===1?"":"s"} saved.`
    :"Breakers, ATFs and garages can reuse one donor across many removed parts.",
   done:donorCount>0,
   action:donorCount>0?null:"donors" as SellerReadinessAction
  }]:[]),
  {
   id:"onboarding_inventory",
   label:"Start inventory",
   detail:totalCount>0
    ?`${totalCount} listing${totalCount===1?"":"s"} created across draft and live inventory.`
    :"Create a listing with AI/manual entry, or use CSV import for larger stock.",
   done:totalCount>0,
   action:totalCount>0?null:"inventory"
  },
  {
   id:"onboarding_live",
   label:"Publish first live part",
   detail:activeCount>0
    ?`${activeCount} live listing${activeCount===1?"":"s"} available to buyers.`
    :"Finish real photos and compatibility / part-identity evidence, then publish.",
   done:activeCount>0,
   action:activeCount>0?null:"inventory"
  }
 ];
 const nextStep=onboardingSteps.find(step=>!step.done)??null;

 return {
  marketReady,
  checkoutReady,
  activeListingCount:activeCount,
  totalListingCount:totalCount,
  donorVehicleCount:donorCount,
  onboarding:{
   steps:onboardingSteps,
   nextAction:nextStep?.action??null,
   nextLabel:nextStep?.label??null,
   complete:onboardingSteps.every(step=>step.done)
  },
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
