import { mobileJson,mobileMarketplaceTermsAccepted,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";
import { processSellerInventoryCsv } from "@/lib/inventory-csv-import";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??20);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,60)):20;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;
 const source=url.searchParams.get("source")?.trim()??"";
 const validSources=["csv","ebay","api"];

 let query=supabase
  .from("seller_inventory_imports")
  .select("id,source_channel,filename,status,rows_received,rows_created,rows_rejected,created_at")
  .eq("seller_id",auth.seller.id)
  .order("created_at",{ascending:false})
  .order("id");
 if(validSources.includes(source))query=query.eq("source_channel",source);

 const {data,error}=await query.range(offset,offset+limit);
 if(error)return mobileJson(request,{ok:false,error:"inventory_imports_unavailable"},503);
 const raw=data??[];
 const hasMore=raw.length>limit;
 const page=raw.slice(0,limit);
 return mobileJson(request,{
  ok:true,
  items:page.map(item=>({
   id:item.id,
   sourceChannel:item.source_channel,
   filename:item.filename,
   status:item.status,
   rowsReceived:item.rows_received,
   rowsCreated:item.rows_created,
   rowsRejected:item.rows_rejected,
   createdAt:item.created_at
  })),
  pagination:{offset,limit,returned:page.length,hasMore}
 });
}


export async function POST(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 if(!await mobileMarketplaceTermsAccepted(auth.context))return mobileJson(request,{ok:false,error:"terms_required"},428);
 let formData:FormData;
 try{formData=await request.formData();}catch{return mobileJson(request,{ok:false,error:"invalid_form_data"},400);}
 const file=formData.get("file");
 if(!(file instanceof File))return mobileJson(request,{ok:false,error:"csv_file_required"},400);
 const mode=String(formData.get("mode")??"preview");
 const result=await processSellerInventoryCsv({
  file,
  sellerId:auth.seller.id,
  supabase:auth.context.supabase,
  mode
 });
 return mobileJson(request,{ok:true,result});
}
