import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";
import { normalizePostcode } from "@/lib/postcode";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const clean=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);
const slugify=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70)||"garage";
const shape=(row:{id:string;business_name:string;slug:string;location:string;postcode:string;description:string;customer_supplied_parts:boolean;recycled_parts:boolean;mobile_fitting:boolean;status:string;verified_at:string|null})=>({
 id:row.id,businessName:row.business_name,slug:row.slug,location:row.location,postcode:row.postcode,description:row.description,
 customerSuppliedParts:row.customer_supplied_parts,recycledParts:row.recycled_parts,mobileFitting:row.mobile_fitting,
 status:row.status,verified:Boolean(row.verified_at)
});

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 const {data,error}=await supabase
  .from("garage_partners")
  .select("id,business_name,slug,location,postcode,description,customer_supplied_parts,recycled_parts,mobile_fitting,status,verified_at")
  .eq("owner_id",user.id)
  .maybeSingle();
 if(error)return mobileJson(request,{ok:false,error:"garage_partner_unavailable"},503);
 return mobileJson(request,{ok:true,partner:data?shape(data):null});
}

export async function PUT(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 let payload:unknown;
 try{payload=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=payload&&typeof payload==="object"&&!Array.isArray(payload)?payload as Record<string,unknown>:{};
 const businessName=clean(input.businessName,140);
 const location=clean(input.location,120);
 const postcode=normalizePostcode(clean(input.postcode,20));
 const description=clean(input.description,2000);
 if(businessName.length<2||location.length<2||!postcode||description.length<20){
  return mobileJson(request,{ok:false,error:"invalid_garage_profile"},400);
 }
 const {data:existing,error:existingError}=await supabase
  .from("garage_partners")
  .select("id")
  .eq("owner_id",user.id)
  .maybeSingle();
 if(existingError)return mobileJson(request,{ok:false,error:"garage_partner_unavailable"},503);

 const values={
  business_name:businessName,
  location,
  postcode,
  description,
  customer_supplied_parts:input.customerSuppliedParts!==false,
  recycled_parts:input.recycledParts!==false,
  mobile_fitting:input.mobileFitting===true
 };
 const result=existing
  ?await supabase.from("garage_partners").update(values).eq("id",existing.id).eq("owner_id",user.id).select("id,business_name,slug,location,postcode,description,customer_supplied_parts,recycled_parts,mobile_fitting,status,verified_at").single()
  :await supabase.from("garage_partners").insert({...values,owner_id:user.id,slug:slugify(businessName)+"-"+user.id.slice(0,8)}).select("id,business_name,slug,location,postcode,description,customer_supplied_parts,recycled_parts,mobile_fitting,status,verified_at").single();
 if(result.error||!result.data)return mobileJson(request,{ok:false,error:"garage_partner_save_failed"},409);
 return mobileJson(request,{ok:true,partner:shape(result.data)});
}
