import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const normalizeRating=(value:unknown,required=false)=>{
 if(value===null||value===undefined||value==="")return required?NaN:null;
 const number=Number(value);
 return Number.isInteger(number)&&number>=1&&number<=5?number:NaN;
};

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;

 const {data,error}=await supabase.rpc("get_review_opportunities");
 if(error)return mobileJson(request,{ok:false,error:"reviews_unavailable"},503);

 return mobileJson(request,{
  ok:true,
  items:(data??[]).map(row=>({
   orderItemId:row.order_item_id,
   direction:row.direction,
   counterpartProfileId:row.counterpart_profile_id,
   counterpartHandle:row.counterpart_handle,
   counterpartDisplayName:row.counterpart_display_name,
   partTitle:row.part_title,
   fundsReleasedAt:row.funds_released_at,
   existingReviewId:row.existing_review_id??null
  }))
 });
}

export async function POST(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;

 let body:unknown;
 try{body=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=body&&typeof body==="object"?body as Record<string,unknown>:{};

 const orderItemId=String(input.orderItemId??"").trim();
 const overall=normalizeRating(input.overall,true);
 const itemAsDescribed=normalizeRating(input.itemAsDescribed);
 const dispatch=normalizeRating(input.dispatch);
 const communication=normalizeRating(input.communication);
 const buyerConduct=normalizeRating(input.buyerConduct);
 const comment=String(input.comment??"").trim();

 if(!orderItemId)return mobileJson(request,{ok:false,error:"transaction_required"},400);
 if(Number.isNaN(overall)||[itemAsDescribed,dispatch,communication,buyerConduct].some(value=>typeof value==="number"&&Number.isNaN(value))){
  return mobileJson(request,{ok:false,error:"invalid_rating"},400);
 }
 if(comment.length>2000)return mobileJson(request,{ok:false,error:"review_too_long"},400);

 const {data,error}=await supabase.rpc("submit_transaction_review",{
  p_order_item_id:orderItemId,
  p_overall_rating:overall as number,
  p_item_as_described_rating:itemAsDescribed??undefined,
  p_dispatch_rating:dispatch??undefined,
  p_communication_rating:communication??undefined,
  p_buyer_conduct_rating:buyerConduct??undefined,
  p_comment:comment||undefined
 });

 if(error){
  const message=error.message.toLowerCase();
  const code=message.includes("already reviewed")
   ?"already_reviewed"
   :message.includes("paused while a transaction case")
    ?"review_paused_by_case"
    :message.includes("completed, non-refunded transaction")
     ?"review_not_ready"
     :"review_submit_failed";
  return mobileJson(request,{ok:false,error:code},409);
 }

 return mobileJson(request,{
  ok:true,
  reviewId:data,
  message:"Review submitted. It will publish according to the verified-review visibility rules."
 },201);
}
