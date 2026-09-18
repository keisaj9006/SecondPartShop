import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";
import { isStripeConnectConfigured } from "@/lib/stripe-connect";
import { syncSellerPaymentAccount } from "@/lib/seller-payment-sync";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const restrictedStatuses=new Set(["restricted","inactive","disabled","rejected"]);

export async function POST(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const seller=auth.seller;

 if(!isStripeConnectConfigured()){
  return mobileJson(request,{ok:false,error:"stripe_not_configured"},503);
 }

 try{
  const result=await syncSellerPaymentAccount(seller.id);
  if(result.status==="not_connected"){
   return mobileJson(request,{ok:true,complete:false,status:"not_started"});
  }

  const status=result.active
   ?"complete"
   :restrictedStatuses.has(result.status)
    ?"restricted"
    :"pending";

  return mobileJson(request,{
   ok:true,
   complete:result.active,
   status,
   transferStatus:result.status
  });
 }catch{
  return mobileJson(request,{ok:false,error:"stripe_status_refresh_failed"},503);
 }
}
