import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SellerPartRequestLead } from "@/lib/types";

type SellerPartRequestLeadRow={
 request_id:string;
 query_text:string;
 oem_number:string|null;
 notes:string|null;
 created_at:string;
 category_id:string|null;
 category_name:string|null;
 catalogue_variant_id:string|null;
 vehicle_make:string|null;
 vehicle_model:string|null;
 vehicle_variant:string|null;
 year:number|null;
 fuel_type:string|null;
 engine_size_simple:number|null;
 match_score:number|null;
 match_reasons:string[]|null;
};

const mapLead=(row:SellerPartRequestLeadRow):SellerPartRequestLead=>({
 id:row.request_id,
 queryText:row.query_text,
 oemNumber:row.oem_number,
 notes:row.notes,
 createdAt:row.created_at,
 categoryId:row.category_id,
 categoryName:row.category_name,
 variantId:row.catalogue_variant_id,
 vehicleMake:row.vehicle_make,
 vehicleModel:row.vehicle_model,
 vehicleVariant:row.vehicle_variant,
 year:row.year,
 fuelType:row.fuel_type,
 engineSizeSimple:row.engine_size_simple,
 matchScore:Number(row.match_score??0),
 matchReasons:row.match_reasons??[]
});

export async function getSellerPartRequestLeads(options:{offset?:number;limit?:number}={}):Promise<{items:SellerPartRequestLead[];pagination:{hasMore:boolean;offset:number;limit:number}}>{
 const offset=Math.max(0,Math.floor(options.offset??0));
 const limit=Math.max(1,Math.min(Math.floor(options.limit??30),60));
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("seller_ranked_part_request_leads",{p_limit:limit,p_offset:offset});
 if(error)throw new Error("Buyer request matching is temporarily unavailable.");
 const raw=data??[];
 const hasMore=raw.length>limit;
 const items=raw.slice(0,limit).map(row=>mapLead(row as SellerPartRequestLeadRow));
 return {items,pagination:{hasMore,offset,limit}};
}

export async function getSellerPartRequestLead(requestId:string):Promise<SellerPartRequestLead|null>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("seller_part_request_lead",{p_request_id:requestId});
 if(error)throw new Error("Buyer request matching is temporarily unavailable.");
 const row=data?.[0];
 return row?mapLead(row as SellerPartRequestLeadRow):null;
}
