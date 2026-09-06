import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const slugify=(value:string)=>value
 .toLowerCase()
 .normalize("NFKD")
 .replace(/[\u0300-\u036f]/g,"")
 .replace(/[^a-z0-9]+/g,"-")
 .replace(/^-|-$/g,"")
 .slice(0,80);

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 const {data,error}=await supabase
  .from("sellers")
  .select("id,business_name,slug,location,postcode,description,verified_at,seller_type")
  .eq("owner_id",user.id)
  .maybeSingle();
 if(error)return mobileJson(request,{ok:false,error:"seller_profile_unavailable"},503);
 return mobileJson(request,{ok:true,seller:data?{
  id:data.id,
  businessName:data.business_name,
  slug:data.slug,
  location:data.location,
  postcode:data.postcode,
  description:data.description,
  verified:Boolean(data.verified_at),
  sellerType:data.seller_type
 }:null});
}

export async function POST(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 let body:unknown;
 try{body=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const sellerType=String(input.sellerType??"private");
 const businessName=String(input.businessName??"").trim().slice(0,140);
 const location=String(input.location??"").trim().slice(0,140);
 const postcode=String(input.postcode??"").trim().slice(0,20)||null;
 const description=String(input.description??"").trim().slice(0,2000);

 if(!["private","business"].includes(sellerType))return mobileJson(request,{ok:false,error:"invalid_seller_type"},400);
 if(businessName.length<2)return mobileJson(request,{ok:false,error:"seller_name_required"},400);
 if(!location)return mobileJson(request,{ok:false,error:"seller_location_required"},400);
 if(description.length<20)return mobileJson(request,{ok:false,error:"seller_description_too_short"},400);

 const {data:existing,error:existingError}=await supabase
  .from("sellers")
  .select("id")
  .eq("owner_id",user.id)
  .maybeSingle();
 if(existingError)return mobileJson(request,{ok:false,error:"seller_profile_unavailable"},503);
 if(existing)return mobileJson(request,{ok:true,id:existing.id,existing:true});

 const {data:profile,error:profileError}=await supabase
  .from("profiles")
  .select("role")
  .eq("id",user.id)
  .maybeSingle();
 if(profileError||!profile)return mobileJson(request,{ok:false,error:"profile_unavailable"},503);

 if(profile.role==="buyer"){
  const {data:upgraded,error:upgradeError}=await supabase.rpc("upgrade_account_to_seller");
  if(upgradeError||!upgraded)return mobileJson(request,{ok:false,error:"seller_enable_failed"},409);
 }

 const slugBase=slugify(businessName)||"seller";
 const {data,error}=await supabase
  .from("sellers")
  .insert({
   owner_id:user.id,
   business_name:businessName,
   slug:`${slugBase}-${user.id.slice(0,6)}`,
   location,
   postcode,
   description,
   seller_type:sellerType
  })
  .select("id")
  .single();

 if(error||!data)return mobileJson(request,{ok:false,error:"seller_profile_create_failed"},503);
 return mobileJson(request,{ok:true,id:data.id},201);
}
