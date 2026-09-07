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
  {count:allListings,error:allListingsError},
  {count:donorVehicles,error:donorError},
  {data:verification,error:verificationError}
 ]=await Promise.all([
  supabase.from("sellers").select("id,business_name,seller_type,business_kind,verified_at").eq("id",seller.id).maybeSingle(),
  supabase.from("seller_payment_accounts").select("onboarding_status,transfers_enabled,payouts_enabled,details_submitted").eq("seller_id",seller.id).maybeSingle(),
  supabase.from("parts").select("id",{count:"exact",head:true}).eq("seller_id",seller.id).eq("status","active"),
  supabase.from("parts").select("id",{count:"exact",head:true}).eq("seller_id",seller.id),
  supabase.from("donor_vehicles").select("id",{count:"exact",head:true}).eq("seller_id",seller.id),
  supabase.from("seller_verification_requests").select("status,requested_at,reviewed_at").eq("seller_id",seller.id).order("requested_at",{ascending:false}).limit(1).maybeSingle()
 ]);

 if(sellerError||paymentError||listingError||allListingsError||donorError||verificationError){
  return mobileJson(request,{ok:false,error:"seller_readiness_unavailable"},503);
 }
 if(!fullSeller)return mobileJson(request,{ok:false,error:"seller_profile_required"},403);

 const checkoutReady=Boolean(
  payment?.onboarding_status==="complete"&&
  payment?.transfers_enabled
 );
 const activeCount=activeListings??0;
 const totalCount=allListings??0;
 const donorCount=donorVehicles??0;
 const businessSeller=fullSeller.seller_type==="business";
 const profileReady=!businessSeller||Boolean(fullSeller.business_kind);
 const marketReady=profileReady&&checkoutReady&&activeCount>0;
 const verificationDone=Boolean(fullSeller.verified_at);
 const verificationStarted=!businessSeller||verificationDone||verification?.status==="pending";
 const donorRelevant=businessSeller&&["breaker","atf","garage"].includes(fullSeller.business_kind??"");
 const onboarding=[
  {
   id:"onboarding_profile",
   label:"Complete seller profile",
   detail:profileReady?"Seller type and public business identity are set.":"Choose the correct automotive business type before building inventory.",
   done:profileReady,
   action:profileReady?null:"profile"
  },
  ...(businessSeller?[{
   id:"onboarding_verification",
   label:"Submit business verification",
   detail:verificationDone
    ?"Business verification is approved."
    :verification?.status==="pending"
     ?"Verification is under review. Continue with payouts and inventory while it is checked."
     :"Submit business evidence to build trust before launch.",
   done:verificationStarted,
   action:verificationStarted?null:"verification"
  }]:[]),
  {
   id:"onboarding_payouts",
   label:"Set up payouts",
   detail:checkoutReady?"Stripe transfers are enabled.":"Complete Stripe onboarding before buyers can pay for live listings.",
   done:checkoutReady,
   action:checkoutReady?null:"payments"
  },
  ...(donorRelevant?[{
   id:"onboarding_donor",
   label:"Add your first donor vehicle",
   detail:donorCount>0
    ?`${donorCount} donor vehicle${donorCount===1?"":"s"} saved.`
    :"Reuse one donor vehicle across many removed parts.",
   done:donorCount>0,
   action:donorCount>0?null:"donors"
  }]:[]),
  {
   id:"onboarding_inventory",
   label:"Start inventory",
   detail:totalCount>0
    ?`${totalCount} listing${totalCount===1?"":"s"} created across draft and live inventory.`
    :"Create with AI/manual entry in the app, or open CSV import for larger stock.",
   done:totalCount>0,
   action:totalCount>0?null:"inventory"
  },
  {
   id:"onboarding_live",
   label:"Publish first live part",
   detail:activeCount>0
    ?`${activeCount} live listing${activeCount===1?"":"s"} available to buyers.`
    :"Add real photos and compatibility / part-identity evidence, then publish.",
   done:activeCount>0,
   action:activeCount>0?null:"inventory"
  }
 ];
 const nextStep=onboarding.find(step=>!step.done)??null;

 return mobileJson(request,{
  ok:true,
  readiness:{
   marketReady,
   checkoutReady,
   activeListingCount:activeCount,
   totalListingCount:totalCount,
   donorVehicleCount:donorCount,
   sellerType:fullSeller.seller_type,
   businessKind:fullSeller.business_kind,
   onboarding:{
    steps:onboarding,
    nextAction:nextStep?.action??null,
    nextLabel:nextStep?.label??null,
    complete:onboarding.every(step=>step.done)
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
