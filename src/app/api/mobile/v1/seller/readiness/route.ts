import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {user,supabase}=auth.context;
 const seller=auth.seller;

 const [
  {data:fullSeller,error:sellerError},
  {data:payment,error:paymentError},
  {count:activeListings,error:listingError},
  {data:verification,error:verificationError}
 ]=await Promise.all([
  supabase.from("sellers").select("id,business_name,seller_type,verified_at").eq("id",seller.id).maybeSingle(),
  supabase.from("seller_payment_accounts").select("onboarding_status,transfers_enabled,payouts_enabled,details_submitted").eq("seller_id",seller.id).maybeSingle(),
  supabase.from("parts").select("id",{count:"exact",head:true}).eq("seller_id",seller.id).eq("status","active"),
  supabase.from("seller_verification_requests").select("status,requested_at,reviewed_at").eq("seller_id",seller.id).order("requested_at",{ascending:false}).limit(1).maybeSingle()
 ]);

 if(sellerError||paymentError||listingError||verificationError){
  return mobileJson(request,{ok:false,error:"seller_readiness_unavailable"},503);
 }
 if(!fullSeller)return mobileJson(request,{ok:false,error:"seller_profile_required"},403);

 const checkoutReady=Boolean(
  payment?.onboarding_status==="complete"&&
  payment?.transfers_enabled
 );
 const activeCount=activeListings??0;
 const marketReady=checkoutReady&&activeCount>0;
 const businessSeller=fullSeller.seller_type==="business";
 const verificationDone=Boolean(fullSeller.verified_at);

 return mobileJson(request,{
  ok:true,
  readiness:{
   marketReady,
   checkoutReady,
   activeListingCount:activeCount,
   sellerType:fullSeller.seller_type,
   required:[
    {
     id:"seller_profile",
     label:"Seller profile",
     detail:"Your public seller identity is set up.",
     done:true,
     action:null
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
     done:Boolean(user.email_confirmed_at),
     action:"account"
    },
    ...(businessSeller?[{
     id:"business_verification",
     label:"Business verification",
     detail:verificationDone
      ?"Your public business profile has the SecondPart verified badge."
      :verification?.status==="pending"
       ?"Your verification request is under review."
       :"Recommended trust signal for garages, breakers and businesses.",
     done:verificationDone,
     action:"verification"
    }]:[])
   ],
   payment:payment?{
    onboardingStatus:payment.onboarding_status,
    transfersEnabled:payment.transfers_enabled,
    payoutsEnabled:payment.payouts_enabled,
    detailsSubmitted:payment.details_submitted
   }:null,
   verification:businessSeller?{
    verified:verificationDone,
    requestStatus:verification?.status??null
   }:null
  }
 });
}
