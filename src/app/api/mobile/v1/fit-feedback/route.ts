import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const validResult=(value:string)=>["exact_fit","fit_with_modification","did_not_fit","not_installed"].includes(value);

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {supabase}=auth.context;
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??30);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,60)):30;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;

 const {data,error}=await supabase.rpc("get_verified_fit_opportunities_page",{p_limit:limit,p_offset:offset});
 if(error)return mobileJson(request,{ok:false,error:"fit_feedback_unavailable"},503);
 const raw=data??[];
 const hasMore=raw.length>limit;
 const page=raw.slice(0,limit);

 return mobileJson(request,{
  ok:true,
  items:page.map(row=>({
   orderItemId:row.order_item_id,
   partId:row.part_id,
   partTitle:row.part_title,
   partSlug:row.part_slug,
   vehicle:{
    variantId:row.variant_id,
    make:row.vehicle_make,
    model:row.vehicle_model,
    variant:row.vehicle_variant,
    year:row.vehicle_year,
    fuel:row.vehicle_fuel,
    engine:row.vehicle_engine
   },
   existingResult:row.existing_result,
   existingNotes:row.existing_notes,
   fundsReleasedAt:row.funds_released_at
  })),
  pagination:{offset,limit,returned:page.length,hasMore}
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
 const result=String(input.result??"").trim();
 const notes=String(input.notes??"").trim();

 if(!orderItemId)return mobileJson(request,{ok:false,error:"transaction_required"},400);
 if(!validResult(result))return mobileJson(request,{ok:false,error:"invalid_fit_result"},400);
 if(notes.length>1000)return mobileJson(request,{ok:false,error:"fit_notes_too_long"},400);

 const {data,error}=await supabase.rpc("submit_verified_fit_feedback",{
  p_order_item_id:orderItemId,
  p_result:result,
  p_notes:notes||undefined
 });

 if(error){
  const message=error.message.toLowerCase();
  const code=message.includes("only the buyer")
   ?"buyer_only"
   :message.includes("completed, non-refunded")
    ?"feedback_not_ready"
    :message.includes("vehicle snapshot")
     ?"vehicle_snapshot_missing"
     :message.includes("transaction case")
      ?"feedback_paused_by_case"
      :"fit_feedback_submit_failed";
  return mobileJson(request,{ok:false,error:code},409);
 }

 return mobileJson(request,{ok:true,feedbackId:data},201);
}
