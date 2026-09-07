import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const allowed=new Set(["q","category","condition","sort","min","max","pc","collection","vehicle","vr","vc","cv","cy","cf","ce"]);
const safeParams=(value:unknown)=>{
 if(typeof value!=="object"||value===null||Array.isArray(value))return null;
 const result:Record<string,string>={};
 for(const [key,item] of Object.entries(value as Record<string,unknown>)){
  if(allowed.has(key)&&typeof item==="string"&&item.length<=200)result[key]=item;
 }
 return result;
};

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??20);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,60)):20;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;
 const {data,error}=await supabase
  .from("saved_searches")
  .select("id,name,search_params,created_at")
  .eq("profile_id",user.id)
  .order("created_at",{ascending:false})
  .order("id")
  .range(offset,offset+limit);
 if(error)return mobileJson(request,{ok:false,error:"saved_searches_unavailable"},503);
 const raw=data??[];
 const hasMore=raw.length>limit;
 const page=raw.slice(0,limit);

 return mobileJson(request,{ok:true,items:page.map(row=>({
  id:row.id,
  name:row.name,
  params:safeParams(row.search_params)??{},
  createdAt:row.created_at
 })),pagination:{offset,limit,returned:page.length,hasMore}});
}

export async function POST(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 let body:unknown;
 try{body=await request.json();}catch{return mobileJson(request,{ok:false,error:"invalid_json"},400);}
 const input=body&&typeof body==="object"?body as Record<string,unknown>:{};
 const name=String(input.name??"").trim().slice(0,80);
 const params=safeParams(input.params);
 if(name.length<2)return mobileJson(request,{ok:false,error:"saved_search_name_required"},400);
 if(!params||!Object.keys(params).length)return mobileJson(request,{ok:false,error:"saved_search_filters_required"},400);

 const {data,error}=await supabase.from("saved_searches")
  .insert({profile_id:user.id,name,search_params:params})
  .select("id")
  .single();
 if(error||!data)return mobileJson(request,{ok:false,error:"saved_search_create_failed"},503);
 return mobileJson(request,{ok:true,id:data.id},201);
}

export async function DELETE(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 const id=new URL(request.url).searchParams.get("id")??"";
 if(!isUuid(id))return mobileJson(request,{ok:false,error:"invalid_saved_search"},400);
 const {error}=await supabase.from("saved_searches").delete().eq("id",id).eq("profile_id",user.id);
 if(error)return mobileJson(request,{ok:false,error:"saved_search_delete_failed"},503);
 return mobileJson(request,{ok:true,deleted:true});
}
