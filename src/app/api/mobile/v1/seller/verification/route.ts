import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 const seller=auth.seller;

 const [{data:fullSeller,error:sellerError},{data:verification,error:verificationError}]=await Promise.all([
  supabase.from("sellers")
   .select("seller_type,business_kind,verified_at")
   .eq("id",seller.id)
   .maybeSingle(),
  supabase.from("seller_verification_requests")
   .select("id,status,message,requested_at,reviewed_at,review_note,legal_business_name,business_reference,reference_url,business_name_snapshot,business_kind_snapshot,location_snapshot,postcode_snapshot")
   .eq("seller_id",seller.id)
   .order("requested_at",{ascending:false})
   .limit(1)
   .maybeSingle()
 ]);

 if(sellerError||verificationError)return mobileJson(request,{ok:false,error:"seller_verification_unavailable"},503);
 if(!fullSeller)return mobileJson(request,{ok:false,error:"seller_profile_required"},404);

 return mobileJson(request,{
  ok:true,
  sellerType:fullSeller.seller_type,
  businessKind:fullSeller.business_kind,
  verified:Boolean(fullSeller.verified_at),
  request:verification?{
   id:verification.id,
   status:verification.status,
   message:verification.message,
   requestedAt:verification.requested_at,
   reviewedAt:verification.reviewed_at,
   reviewNote:verification.review_note,
   legalBusinessName:verification.legal_business_name,
   businessReference:verification.business_reference,
   referenceUrl:verification.reference_url,
   businessNameSnapshot:verification.business_name_snapshot,
   businessKindSnapshot:verification.business_kind_snapshot,
   locationSnapshot:verification.location_snapshot,
   postcodeSnapshot:verification.postcode_snapshot
  }:null
 });
}

export async function POST(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {user,supabase}=auth.context;
 const seller=auth.seller;

 let body:unknown;
 try{body=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const legalBusinessName=String(input.legalBusinessName??"").trim().slice(0,180);
 const businessReference=String(input.businessReference??"").trim().slice(0,180)||null;
 const referenceUrl=String(input.referenceUrl??"").trim().slice(0,500)||null;
 const message=String(input.message??"").trim().slice(0,500)||null;
 if(legalBusinessName.length<2)return mobileJson(request,{ok:false,error:"legal_business_name_required"},400);
 if(!businessReference&&!referenceUrl)return mobileJson(request,{ok:false,error:"business_reference_required"},400);
 if(referenceUrl&&!/^https:\/\//i.test(referenceUrl))return mobileJson(request,{ok:false,error:"invalid_business_reference_url"},400);

 const {data:fullSeller,error:sellerError}=await supabase
  .from("sellers")
  .select("seller_type,business_kind,verified_at")
  .eq("id",seller.id)
  .maybeSingle();

 if(sellerError||!fullSeller)return mobileJson(request,{ok:false,error:"seller_profile_unavailable"},503);
 if(fullSeller.seller_type!=="business"){
  return mobileJson(request,{ok:false,error:"business_verification_not_applicable"},400);
 }
 if(fullSeller.verified_at){
  return mobileJson(request,{ok:true,status:"approved",alreadyVerified:true});
 }

 const {data:pending,error:pendingError}=await supabase
  .from("seller_verification_requests")
  .select("id,status")
  .eq("seller_id",seller.id)
  .eq("status","pending")
  .maybeSingle();

 if(pendingError)return mobileJson(request,{ok:false,error:"seller_verification_unavailable"},503);
 if(pending)return mobileJson(request,{ok:true,status:"pending",alreadyPending:true});

 const {data,error}=await supabase
  .from("seller_verification_requests")
  .insert({
   seller_id:seller.id,
   requester_id:user.id,
   legal_business_name:legalBusinessName,
   business_reference:businessReference,
   reference_url:referenceUrl,
   message
  })
  .select("id,status,requested_at")
  .single();

 if(error||!data)return mobileJson(request,{ok:false,error:"verification_request_failed"},503);

 return mobileJson(request,{
  ok:true,
  status:data.status,
  request:{id:data.id,requestedAt:data.requested_at}
 },201);
}
