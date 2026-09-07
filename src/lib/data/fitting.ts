import "server-only";

import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type GaragePartner={
 id:string;
 ownerId:string;
 businessName:string;
 slug:string;
 location:string;
 postcode:string;
 description:string;
 customerSuppliedParts:boolean;
 recycledParts:boolean;
 mobileFitting:boolean;
 status:"pending"|"active"|"suspended"|"rejected";
 verifiedAt:string|null;
 createdAt:string;
};

export type FittingRequestView={
 id:string;
 buyerId:string;
 partId:string;
 partTitle:string;
 partSlug:string;
 garagePartnerId:string;
 garageName:string;
 garageSlug:string;
 garageLocation:string;
 vehicleVariantId:string;
 vehicleMake:string;
 vehicleModel:string;
 vehicleVariant:string;
 vehicleYear:number;
 vehicleFuel:string|null;
 vehicleEngineSize:number|null;
 vehicleRegistration:string|null;
 buyerNotes:string|null;
 status:string;
 quotePence:number|null;
 quoteNote:string|null;
 quotedAt:string|null;
 createdAt:string;
};

type GarageRow={
 id:string;owner_id:string;business_name:string;slug:string;location:string;postcode:string;description:string;
 customer_supplied_parts:boolean;recycled_parts:boolean;mobile_fitting:boolean;status:string;verified_at:string|null;created_at:string;
};

const garage=(row:GarageRow):GaragePartner=>({
 id:row.id,
 ownerId:row.owner_id,
 businessName:row.business_name,
 slug:row.slug,
 location:row.location,
 postcode:row.postcode,
 description:row.description,
 customerSuppliedParts:row.customer_supplied_parts,
 recycledParts:row.recycled_parts,
 mobileFitting:row.mobile_fitting,
 status:row.status as GaragePartner["status"],
 verifiedAt:row.verified_at,
 createdAt:row.created_at
});

export async function getGaragePartnerForOwner(ownerId:string):Promise<GaragePartner|null>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("garage_partners")
  .select("id,owner_id,business_name,slug,location,postcode,description,customer_supplied_parts,recycled_parts,mobile_fitting,status,verified_at,created_at")
  .eq("owner_id",ownerId)
  .maybeSingle();
 if(error)throw new Error("Garage partner profile is temporarily unavailable.");
 return data?garage(data as GarageRow):null;
}

export async function getGaragePartnersPage(offset=0,limit=24){
 const pageSize=Math.max(1,Math.min(limit,60));
 const safeOffset=Math.max(0,offset);
 const supabase=createSupabasePublicServerClient();
 const {data,error}=await supabase
  .from("garage_partners")
  .select("id,owner_id,business_name,slug,location,postcode,description,customer_supplied_parts,recycled_parts,mobile_fitting,status,verified_at,created_at")
  .eq("status","active")
  .eq("customer_supplied_parts",true)
  .eq("recycled_parts",true)
  .order("verified_at",{ascending:false,nullsFirst:false})
  .order("business_name")
  .order("id")
  .range(safeOffset,safeOffset+pageSize);
 if(error)throw new Error("Garage directory is temporarily unavailable.");
 const rows=(data??[]) as GarageRow[];
 return {items:rows.slice(0,pageSize).map(garage),hasMore:rows.length>pageSize,offset:safeOffset,limit:pageSize};
}

export async function getGaragePartnerBySlug(slug:string):Promise<GaragePartner|null>{
 const supabase=createSupabasePublicServerClient();
 const {data,error}=await supabase
  .from("garage_partners")
  .select("id,owner_id,business_name,slug,location,postcode,description,customer_supplied_parts,recycled_parts,mobile_fitting,status,verified_at,created_at")
  .eq("slug",slug)
  .eq("status","active")
  .maybeSingle();
 if(error)throw new Error("Garage partner is temporarily unavailable.");
 return data?garage(data as GarageRow):null;
}

export async function getFittingPart(partId:string){
 const supabase=createSupabasePublicServerClient();
 const {data,error}=await supabase
  .from("parts")
  .select("id,title,slug,price_pence,seller_id,sellers(business_name,slug)")
  .eq("id",partId)
  .eq("status","active")
  .maybeSingle();
 if(error||!data)return null;
 const seller=Array.isArray(data.sellers)?data.sellers[0]:data.sellers;
 return {
  id:data.id,
  title:data.title,
  slug:data.slug,
  pricePence:data.price_pence,
  sellerName:seller?.business_name??"Seller",
  sellerSlug:seller?.slug??""
 };
}

type RequestRow={
 id:string;buyer_id:string;part_id:string;garage_partner_id:string;vehicle_variant_id:string;vehicle_year:number;
 vehicle_fuel:string|null;vehicle_engine_size:number|null;vehicle_registration:string|null;buyer_notes:string|null;
 status:string;quote_pence:number|null;quote_note:string|null;quoted_at:string|null;created_at:string;
 parts:{title:string;slug:string}|Array<{title:string;slug:string}>|null;
 garage_partners:{business_name:string;slug:string;location:string}|Array<{business_name:string;slug:string;location:string}>|null;
 vehicle_catalogue_variants:{make:string;model_family:string;variant:string}|Array<{make:string;model_family:string;variant:string}>|null;
};

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;
const requestView=(row:RequestRow):FittingRequestView|null=>{
 const part=one(row.parts);
 const garageRow=one(row.garage_partners);
 const vehicle=one(row.vehicle_catalogue_variants);
 if(!part||!garageRow||!vehicle)return null;
 return {
  id:row.id,buyerId:row.buyer_id,partId:row.part_id,partTitle:part.title,partSlug:part.slug,
  garagePartnerId:row.garage_partner_id,garageName:garageRow.business_name,garageSlug:garageRow.slug,garageLocation:garageRow.location,
  vehicleVariantId:row.vehicle_variant_id,vehicleMake:vehicle.make,vehicleModel:vehicle.model_family,vehicleVariant:vehicle.variant,
  vehicleYear:row.vehicle_year,vehicleFuel:row.vehicle_fuel,vehicleEngineSize:row.vehicle_engine_size,
  vehicleRegistration:row.vehicle_registration,buyerNotes:row.buyer_notes,status:row.status,
  quotePence:row.quote_pence,quoteNote:row.quote_note,quotedAt:row.quoted_at,createdAt:row.created_at
 };
};

const requestSelect="id,buyer_id,part_id,garage_partner_id,vehicle_variant_id,vehicle_year,vehicle_fuel,vehicle_engine_size,vehicle_registration,buyer_notes,status,quote_pence,quote_note,quoted_at,created_at,parts(title,slug),garage_partners(business_name,slug,location),vehicle_catalogue_variants(make,model_family,variant)";

export async function getBuyerFittingRequests(buyerId:string,limit=40):Promise<FittingRequestView[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("fitting_requests")
  .select(requestSelect)
  .eq("buyer_id",buyerId)
  .order("created_at",{ascending:false})
  .limit(Math.max(1,Math.min(limit,60)));
 if(error)throw new Error("Fitting requests are temporarily unavailable.");
 return ((data??[]) as unknown as RequestRow[]).flatMap(row=>{const mapped=requestView(row);return mapped?[mapped]:[];});
}

export async function getGarageFittingRequests(garagePartnerId:string,limit=60):Promise<FittingRequestView[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("fitting_requests")
  .select(requestSelect)
  .eq("garage_partner_id",garagePartnerId)
  .order("created_at",{ascending:false})
  .limit(Math.max(1,Math.min(limit,60)));
 if(error)throw new Error("Garage fitting requests are temporarily unavailable.");
 return ((data??[]) as unknown as RequestRow[]).flatMap(row=>{const mapped=requestView(row);return mapped?[mapped]:[];});
}
