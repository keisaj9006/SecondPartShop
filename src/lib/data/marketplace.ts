import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Category,Fitment,Listing,ListingImage,MarketplaceFilters,Seller,Vehicle } from "@/lib/types";

export type DataResult<T>={data:T;error:string|null;configured:boolean};
type RawCategory={id:string;name:string;slug:string};
type RawSeller={id:string;owner_id:string|null;business_name:string;slug:string;location:string;postcode:string|null;description:string;verified_at:string|null};
type RawVehicle={id:string;make:string;model:string;generation:string;year:number;engine:string;engine_code:string|null;gearbox_family:string;gearbox_code:string};
type RawImage={id:string;storage_path:string;alt_text:string;position:number};
type RawFitment={notes:string|null;vehicles:RawVehicle|RawVehicle[]|null};
type RawListing={id:string;seller_id:string;category_id:string;slug:string;title:string;description:string;manufacturer:string|null;part_number:string|null;oem_number:string|null;gearbox_family:string;gearbox_code:string;condition:Listing["condition"];price_pence:number;stock:number;status:Listing["status"];dispatch_days:number;categories:RawCategory|RawCategory[];sellers:RawSeller|RawSeller[];part_images:RawImage[]|null;part_fitments:RawFitment[]|null};

const selectListing=(fitmentInner=false)=>`id,seller_id,category_id,slug,title,description,manufacturer,part_number,oem_number,gearbox_family,gearbox_code,condition,price_pence,stock,status,dispatch_days,categories!inner(id,name,slug),sellers!inner(id,owner_id,business_name,slug,location,postcode,description,verified_at),part_images(id,storage_path,alt_text,position),part_fitments${fitmentInner?"!inner":""}(notes,vehicles(id,make,model,generation,year,engine,engine_code,gearbox_family,gearbox_code))`;
const one=<T>(value:T|T[])=>Array.isArray(value)?value[0]:value;
const vehicleFrom=(v:RawVehicle):Vehicle=>({id:v.id,make:v.make,model:v.model,generation:v.generation,year:v.year,engine:v.engine,engineCode:v.engine_code,gearboxFamily:v.gearbox_family,gearboxCode:v.gearbox_code});
const sellerFrom=(s:RawSeller):Seller=>({id:s.id,ownerId:s.owner_id,businessName:s.business_name,slug:s.slug,location:s.location,postcode:s.postcode,description:s.description,verified:Boolean(s.verified_at)});
const publicImageUrl=(path:string)=>`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/part-images/${path.split("/").map(encodeURIComponent).join("/")}`;
function listingFrom(row:RawListing):Listing{const category=one(row.categories);const seller=one(row.sellers);const images:ListingImage[]=(row.part_images??[]).sort((a,b)=>a.position-b.position).map(i=>({id:i.id,url:publicImageUrl(i.storage_path),alt:i.alt_text,position:i.position}));const fitments:Fitment[]=(row.part_fitments??[]).flatMap(f=>{const v=f.vehicles?one(f.vehicles):null;return v?[{vehicle:vehicleFrom(v),notes:f.notes}]:[];});return {id:row.id,sellerId:row.seller_id,categoryId:row.category_id,slug:row.slug,title:row.title,description:row.description,manufacturer:row.manufacturer,partNumber:row.part_number,oemNumber:row.oem_number,gearboxFamily:row.gearbox_family,gearboxCode:row.gearbox_code,condition:row.condition,pricePence:row.price_pence,stock:row.stock,status:row.status,dispatchDays:row.dispatch_days,category:{id:category.id,name:category.name,slug:category.slug},seller:sellerFrom(seller),images,fitments};}
const failure=<T>(data:T,message:string,configured=true):DataResult<T>=>({data,error:message,configured});

export async function getListings(filters:MarketplaceFilters={}):Promise<DataResult<Listing[]>>{
 if(!isSupabaseConfigured())return failure([],"Connect Supabase to load marketplace data.",false);
 const supabase=await createSupabaseServerClient();
 let query=supabase.from("parts").select(selectListing(Boolean(filters.vehicle))).eq("status","active").order("created_at",{ascending:false});
 if(filters.query){const q=filters.query.trim().replace(/[,%()]/g," ");query=query.or(`title.ilike.%${q}%,oem_number.ilike.%${q}%,part_number.ilike.%${q}%,gearbox_code.ilike.%${q}%,gearbox_family.ilike.%${q}%`);}
 if(filters.category)query=query.eq("category_id",filters.category);
 if(filters.condition)query=query.eq("condition",filters.condition);
 if(filters.gearboxFamily)query=query.ilike("gearbox_family",filters.gearboxFamily);
 if(filters.gearboxCode)query=query.ilike("gearbox_code",`%${filters.gearboxCode}%`);
 if(Number.isFinite(filters.minPrice))query=query.gte("price_pence",Math.round((filters.minPrice??0)*100));
 if(Number.isFinite(filters.maxPrice))query=query.lte("price_pence",Math.round((filters.maxPrice??0)*100));
 if(filters.vehicle)query=query.eq("part_fitments.vehicle_id",filters.vehicle);
 if(filters.ids?.length)query=query.in("id",filters.ids);
 const {data,error}=await query;
 if(error)return failure([],error.message);
 return {data:(data??[]).map(row=>listingFrom(row as unknown as RawListing)),error:null,configured:true};
}

export async function getListingBySlug(slug:string):Promise<DataResult<Listing|null>>{if(!isSupabaseConfigured())return failure(null,"Connect Supabase to load this listing.",false);const supabase=await createSupabaseServerClient();const {data,error}=await supabase.from("parts").select(selectListing()).eq("slug",slug).eq("status","active").maybeSingle();if(error)return failure(null,error.message);return {data:data?listingFrom(data as unknown as RawListing):null,error:null,configured:true};}
export async function getCategories():Promise<Category[]>{if(!isSupabaseConfigured())return [];const supabase=await createSupabaseServerClient();const {data}=await supabase.from("categories").select("id,name,slug").order("name");return (data??[]).map(c=>({id:c.id,name:c.name,slug:c.slug}));}
export async function getVehicles():Promise<Vehicle[]>{if(!isSupabaseConfigured())return [];const supabase=await createSupabaseServerClient();const {data}=await supabase.from("vehicles").select("id,make,model,generation,year,engine,engine_code,gearbox_family,gearbox_code").order("make").order("model").order("year");return (data??[]).map(v=>vehicleFrom(v as RawVehicle));}
export async function getFilterOptions(){if(!isSupabaseConfigured())return {families:[] as string[],codes:[] as string[]};const supabase=await createSupabaseServerClient();const {data}=await supabase.from("parts").select("gearbox_family,gearbox_code").eq("status","active");return {families:[...new Set((data??[]).map(p=>p.gearbox_family))].sort(),codes:[...new Set((data??[]).map(p=>p.gearbox_code))].sort()};}
export async function getSavedPartIds(userId:string):Promise<string[]>{if(!isSupabaseConfigured())return [];const supabase=await createSupabaseServerClient();const {data}=await supabase.from("saved_parts").select("part_id").eq("profile_id",userId);return (data??[]).map(item=>item.part_id);}
export async function getSavedListings(userId:string):Promise<DataResult<Listing[]>>{const ids=await getSavedPartIds(userId);if(!ids.length)return {data:[],error:null,configured:isSupabaseConfigured()};return getListings({ids});}
export async function getSellers():Promise<Seller[]>{if(!isSupabaseConfigured())return [];const supabase=await createSupabaseServerClient();const {data}=await supabase.from("sellers").select("id,owner_id,business_name,slug,location,postcode,description,verified_at").order("business_name");return (data??[]).map(s=>sellerFrom(s as RawSeller));}
export async function getSellerBySlug(slug:string):Promise<Seller|null>{if(!isSupabaseConfigured())return null;const supabase=await createSupabaseServerClient();const {data}=await supabase.from("sellers").select("id,owner_id,business_name,slug,location,postcode,description,verified_at").eq("slug",slug).maybeSingle();return data?sellerFrom(data as RawSeller):null;}
export async function getSellerListings(sellerId:string,includeInactive=false):Promise<Listing[]>{if(!isSupabaseConfigured())return [];const supabase=await createSupabaseServerClient();let query=supabase.from("parts").select(selectListing()).eq("seller_id",sellerId).order("updated_at",{ascending:false});if(!includeInactive)query=query.eq("status","active");const {data}=await query;return (data??[]).map(row=>listingFrom(row as unknown as RawListing));}
export async function getSellerForOwner(ownerId:string):Promise<Seller|null>{if(!isSupabaseConfigured())return null;const supabase=await createSupabaseServerClient();const {data}=await supabase.from("sellers").select("id,owner_id,business_name,slug,location,postcode,description,verified_at").eq("owner_id",ownerId).maybeSingle();return data?sellerFrom(data as RawSeller):null;}
export async function getSellerListingById(id:string,sellerId:string):Promise<Listing|null>{if(!isSupabaseConfigured())return null;const supabase=await createSupabaseServerClient();const {data}=await supabase.from("parts").select(selectListing()).eq("id",id).eq("seller_id",sellerId).maybeSingle();return data?listingFrom(data as unknown as RawListing):null;}
