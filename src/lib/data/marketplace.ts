import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCategoryPath } from "@/lib/category-tree";
import type { Category,Fitment,Listing,ListingImage,MarketplaceFilters,SearchSuggestionGroups,Seller,Vehicle,VehicleDataStatus } from "@/lib/types";

export type DataResult<T>={data:T;error:string|null;configured:boolean};
type RawCategory={id:string;parent_id:string|null;name:string;slug:string;is_transmission_related:boolean;is_selectable:boolean;sort_order:number;search_terms:string[]};
type RawSeller={id:string;owner_id:string|null;business_name:string;slug:string;location:string;postcode:string|null;description:string;verified_at:string|null};
type RawVehicle={id:string;make:string;model:string;generation:string;year:number;engine:string;engine_code:string|null;fuel_type:string|null;gearbox_family:string|null;gearbox_code:string|null;data_status:VehicleDataStatus;source_reference:string|null};
type RawImage={id:string;storage_path:string;alt_text:string;position:number};
type RawFitment={notes:string|null;vehicles:RawVehicle|RawVehicle[]|null};
type RawListing={id:string;seller_id:string;category_id:string;slug:string;title:string;description:string;manufacturer:string|null;part_number:string|null;oem_number:string|null;gearbox_family:string|null;gearbox_code:string|null;condition:Listing["condition"];price_pence:number;stock:number;status:Listing["status"];dispatch_days:number;categories:RawCategory|RawCategory[];sellers:RawSeller|RawSeller[];part_images:RawImage[]|null;part_fitments:RawFitment[]|null};

const categorySelect="id,parent_id,name,slug,is_transmission_related,is_selectable,sort_order,search_terms";
const selectListing=()=>`id,seller_id,category_id,slug,title,description,manufacturer,part_number,oem_number,gearbox_family,gearbox_code,condition,price_pence,stock,status,dispatch_days,categories!inner(${categorySelect}),sellers!inner(id,owner_id,business_name,slug,location,postcode,description,verified_at),part_images(id,storage_path,alt_text,position),part_fitments(notes,vehicles(id,make,model,generation,year,engine,engine_code,fuel_type,gearbox_family,gearbox_code,data_status,source_reference))`;
const one=<T>(value:T|T[])=>Array.isArray(value)?value[0]:value;
const categoryFrom=(c:RawCategory):Category=>({id:c.id,parentId:c.parent_id,name:c.name,slug:c.slug,isTransmissionRelated:c.is_transmission_related,isSelectable:c.is_selectable,sortOrder:c.sort_order,searchTerms:c.search_terms??[]});
const vehicleFrom=(v:RawVehicle):Vehicle=>({id:v.id,make:v.make,model:v.model,generation:v.generation,year:v.year,engine:v.engine,engineCode:v.engine_code,fuelType:v.fuel_type,gearboxFamily:v.gearbox_family,gearboxCode:v.gearbox_code,dataStatus:v.data_status,sourceReference:v.source_reference});
const sellerFrom=(s:RawSeller):Seller=>({id:s.id,ownerId:s.owner_id,businessName:s.business_name,slug:s.slug,location:s.location,postcode:s.postcode,description:s.description,verified:Boolean(s.verified_at)});
const publicImageUrl=(path:string)=>`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/part-images/${path.split("/").map(encodeURIComponent).join("/")}`;
function listingFrom(row:RawListing):Listing{const category=one(row.categories);const seller=one(row.sellers);const images:ListingImage[]=(row.part_images??[]).sort((a,b)=>a.position-b.position).map(i=>({id:i.id,url:publicImageUrl(i.storage_path),alt:i.alt_text,position:i.position}));const fitments:Fitment[]=(row.part_fitments??[]).flatMap(f=>{const v=f.vehicles?one(f.vehicles):null;return v?[{vehicle:vehicleFrom(v),notes:f.notes}]:[];});return {id:row.id,sellerId:row.seller_id,categoryId:row.category_id,slug:row.slug,title:row.title,description:row.description,manufacturer:row.manufacturer,partNumber:row.part_number,oemNumber:row.oem_number,gearboxFamily:row.gearbox_family,gearboxCode:row.gearbox_code,condition:row.condition,pricePence:row.price_pence,stock:row.stock,status:row.status,dispatchDays:row.dispatch_days,category:categoryFrom(category),seller:sellerFrom(seller),images,fitments};}
const failure=<T>(data:T,message:string,configured=true):DataResult<T>=>({data,error:message,configured});
const compact=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,"");

export async function getListings(filters:MarketplaceFilters={}):Promise<DataResult<Listing[]>>{
 if(!isSupabaseConfigured())return failure([],"Connect Supabase to load marketplace data.",false);
 const supabase=await createSupabaseServerClient();
 let allowedPartIds:string[]|undefined;

 if(filters.vehicle){
  const {data,error}=await supabase.from("part_fitments").select("part_id").eq("vehicle_id",filters.vehicle);
  if(error)return failure([],error.message);
  allowedPartIds=[...new Set((data??[]).map(row=>row.part_id))];
  if(!allowedPartIds.length)return {data:[],error:null,configured:true};
 }
 if(filters.catalogueVariant){
  const {data,error}=await supabase.from("part_catalogue_fitments").select("part_id,year_from,year_to,fuel_type,engine_size_simple").eq("variant_id",filters.catalogueVariant);
  if(error)return failure([],error.message);
  const ids=[...new Set((data??[]).filter(row=>{
   if(filters.catalogueYear!==undefined&&((row.year_from!==null&&filters.catalogueYear<row.year_from)||(row.year_to!==null&&filters.catalogueYear>row.year_to)))return false;
   if(filters.catalogueFuel&&row.fuel_type&&row.fuel_type.toUpperCase()!==filters.catalogueFuel.toUpperCase())return false;
   if(filters.catalogueEngineSize!==undefined&&row.engine_size_simple!==null&&row.engine_size_simple!==filters.catalogueEngineSize)return false;
   return true;
  }).map(row=>row.part_id))];
  if(!ids.length)return {data:[],error:null,configured:true};
  allowedPartIds=allowedPartIds?allowedPartIds.filter(id=>ids.includes(id)):ids;
  if(!allowedPartIds.length)return {data:[],error:null,configured:true};
 }

 let rankedIds:string[]|undefined;
 if(filters.query?.trim()){
  const {data,error}=await supabase.rpc("marketplace_search_part_ids",{p_query:filters.query.trim()});
  if(error)return failure([],error.message);
  rankedIds=(data??[]).map(row=>row.part_id);
  if(!rankedIds.length)return {data:[],error:null,configured:true};
 }
 let categoryIds:string[]|undefined;
 if(filters.category){
  const {data,error}=await supabase.rpc("category_descendant_ids",{p_category_id:filters.category});
  if(error)return failure([],error.message);
  categoryIds=(data??[]).map(row=>row.id);
  if(!categoryIds.length)return {data:[],error:null,configured:true};
 }

 let query=supabase.from("parts").select(selectListing()).eq("status","active").order("created_at",{ascending:false});
 if(categoryIds)query=query.in("category_id",categoryIds);
 if(filters.condition)query=query.eq("condition",filters.condition);
 if(Number.isFinite(filters.minPrice))query=query.gte("price_pence",Math.round((filters.minPrice??0)*100));
 if(Number.isFinite(filters.maxPrice))query=query.lte("price_pence",Math.round((filters.maxPrice??0)*100));
 if(allowedPartIds)query=query.in("id",allowedPartIds);
 if(rankedIds)query=query.in("id",rankedIds);
 if(filters.ids?.length)query=query.in("id",filters.ids);
 const {data,error}=await query;
 if(error)return failure([],error.message);
 const listings=(data??[]).map(row=>listingFrom(row as unknown as RawListing));
 if(rankedIds){const rank=new Map(rankedIds.map((id,index)=>[id,index]));listings.sort((a,b)=>(rank.get(a.id)??9999)-(rank.get(b.id)??9999));}
 return {data:listings,error:null,configured:true};
}

export async function getSearchSuggestions(queryText:string):Promise<SearchSuggestionGroups>{
 const empty:SearchSuggestionGroups={categories:[],listings:[],numbers:[],brands:[]};
 const q=queryText.trim();
 if(!isSupabaseConfigured()||q.length<2)return empty;
 const supabase=await createSupabaseServerClient();
 const categories=await getCategories();
 const lower=q.toLowerCase();
 const categoryMatches=categories.filter(category=>[category.name,category.slug,...category.searchTerms].some(value=>value.toLowerCase().includes(lower))).sort((a,b)=>{
  const ae=a.name.toLowerCase()===lower?0:a.name.toLowerCase().startsWith(lower)?1:2;
  const be=b.name.toLowerCase()===lower?0:b.name.toLowerCase().startsWith(lower)?1:2;
  return ae-be||a.sortOrder-b.sortOrder||a.name.localeCompare(b.name);
 }).slice(0,5).map(category=>({kind:"category" as const,label:category.name,query:category.name,categoryId:category.id,meta:getCategoryPath(categories,category.id)}));
 const {data:ranked}=await supabase.rpc("marketplace_search_part_ids",{p_query:q});
 const ids=(ranked??[]).slice(0,8).map(row=>row.part_id);
 if(!ids.length)return {...empty,categories:categoryMatches};
 const {data:parts}=await supabase.from("parts").select("id,title,manufacturer,part_number,oem_number").eq("status","active").in("id",ids);
 const byId=new Map((parts??[]).map(part=>[part.id,part]));
 const ordered=ids.map(id=>byId.get(id)).filter((value):value is NonNullable<typeof value>=>Boolean(value));
 const listings=ordered.slice(0,5).map(part=>({kind:"listing" as const,label:part.title,query:part.title,meta:part.manufacturer??undefined}));
 const qCompact=compact(q);
 const numberMap=new Map<string,{kind:"number";label:string;query:string;meta:string}>();
 for(const part of ordered){for(const [label,meta] of [[part.oem_number,"OE/OEM"],[part.part_number,"Part number"]] as const){if(label&&compact(label).includes(qCompact)&&!numberMap.has(label))numberMap.set(label,{kind:"number",label,query:label,meta});}}
 const brands=[...new Set(ordered.map(part=>part.manufacturer).filter((value):value is string=>Boolean(value&&value.toLowerCase().includes(lower))))].slice(0,4).map(label=>({kind:"brand" as const,label,query:label,meta:"Brand / manufacturer"}));
 return {categories:categoryMatches,listings,numbers:[...numberMap.values()].slice(0,4),brands};
}

export async function getListingBySlug(slug:string):Promise<DataResult<Listing|null>>{if(!isSupabaseConfigured())return failure(null,"Connect Supabase to load this listing.",false);const supabase=await createSupabaseServerClient();const {data,error}=await supabase.from("parts").select(selectListing()).eq("slug",slug).eq("status","active").maybeSingle();if(error)return failure(null,error.message);return {data:data?listingFrom(data as unknown as RawListing):null,error:null,configured:true};}
export async function getCategories():Promise<Category[]>{if(!isSupabaseConfigured())return [];const supabase=await createSupabaseServerClient();const {data}=await supabase.from("categories").select(categorySelect).order("sort_order").order("name");return (data??[]).map(c=>categoryFrom(c as RawCategory));}
export async function getVehicles():Promise<Vehicle[]>{if(!isSupabaseConfigured())return [];const supabase=await createSupabaseServerClient();const {data}=await supabase.from("vehicles").select("id,make,model,generation,year,engine,engine_code,fuel_type,gearbox_family,gearbox_code,data_status,source_reference").order("make").order("model").order("year");return (data??[]).map(v=>vehicleFrom(v as RawVehicle));}
export async function getSavedPartIds(userId:string):Promise<string[]>{if(!isSupabaseConfigured())return [];const supabase=await createSupabaseServerClient();const {data}=await supabase.from("saved_parts").select("part_id").eq("profile_id",userId);return (data??[]).map(item=>item.part_id);}
export async function getSavedListings(userId:string):Promise<DataResult<Listing[]>>{const ids=await getSavedPartIds(userId);if(!ids.length)return {data:[],error:null,configured:isSupabaseConfigured()};return getListings({ids});}
export async function getSellers():Promise<Seller[]>{if(!isSupabaseConfigured())return [];const supabase=await createSupabaseServerClient();const {data}=await supabase.from("sellers").select("id,owner_id,business_name,slug,location,postcode,description,verified_at").order("business_name");return (data??[]).map(s=>sellerFrom(s as RawSeller));}
export async function getSellerBySlug(slug:string):Promise<Seller|null>{if(!isSupabaseConfigured())return null;const supabase=await createSupabaseServerClient();const {data}=await supabase.from("sellers").select("id,owner_id,business_name,slug,location,postcode,description,verified_at").eq("slug",slug).maybeSingle();return data?sellerFrom(data as RawSeller):null;}
export async function getSellerListings(sellerId:string,includeInactive=false):Promise<Listing[]>{if(!isSupabaseConfigured())return [];const supabase=await createSupabaseServerClient();let query=supabase.from("parts").select(selectListing()).eq("seller_id",sellerId).order("updated_at",{ascending:false});if(!includeInactive)query=query.eq("status","active");const {data}=await query;return (data??[]).map(row=>listingFrom(row as unknown as RawListing));}
export async function getSellerForOwner(ownerId:string):Promise<Seller|null>{if(!isSupabaseConfigured())return null;const supabase=await createSupabaseServerClient();const {data}=await supabase.from("sellers").select("id,owner_id,business_name,slug,location,postcode,description,verified_at").eq("owner_id",ownerId).maybeSingle();return data?sellerFrom(data as RawSeller):null;}
export async function getSellerListingById(id:string,sellerId:string):Promise<Listing|null>{if(!isSupabaseConfigured())return null;const supabase=await createSupabaseServerClient();const {data}=await supabase.from("parts").select(selectListing()).eq("id",id).eq("seller_id",sellerId).maybeSingle();return data?listingFrom(data as unknown as RawListing):null;}
