import { randomUUID } from "node:crypto";
import { attemptPartImageCleanup,cleanupFailedPartImageUpload,requirePartImageCleanupReady } from "@/lib/part-image-cleanup";
import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileMarketplaceTermsAccepted,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";
import { mobileThumbnailUrl } from "@/lib/mobile-image";
import { validateImageUpload } from "@/lib/image-upload";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request,{params}:{params:Promise<{partId:string}>}){
 const {partId}=await params;
 if(!isUuid(partId))return mobileJson(request,{ok:false,error:"invalid_part"},400);

 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;

 const {data:part}=await supabase
  .from("parts")
  .select("id,title,status")
  .eq("id",partId)
  .eq("seller_id",auth.seller.id)
  .maybeSingle();
 if(!part)return mobileJson(request,{ok:false,error:"not_found"},404);

 const {data,error}=await supabase
  .from("part_images")
  .select("id,storage_path,alt_text,position")
  .eq("part_id",partId)
  .order("position");
 if(error)return mobileJson(request,{ok:false,error:"photos_unavailable"},503);

 const urlBase=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,"")??"";
 const publicUrl=(path:string)=>urlBase+"/storage/v1/object/public/part-images/"+path.split("/").map(encodeURIComponent).join("/");

 return mobileJson(request,{
  ok:true,
  part:{id:part.id,title:part.title,status:part.status},
  items:(data??[]).map(image=>{const url=publicUrl(image.storage_path);return {id:image.id,url,thumbnailUrl:mobileThumbnailUrl(request,url),alt:image.alt_text,position:image.position};})
 });
}

export async function POST(request:Request,{params}:{params:Promise<{partId:string}>}){
 const {partId}=await params;
 if(!isUuid(partId))return mobileJson(request,{ok:false,error:"invalid_part"},400);

 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {user,supabase}=auth.context;
 if(!await mobileMarketplaceTermsAccepted(auth.context))return mobileJson(request,{ok:false,error:"terms_required"},428);

 const {data:part}=await supabase
  .from("parts")
  .select("id,title,status")
  .eq("id",partId)
  .eq("seller_id",auth.seller.id)
  .maybeSingle();
 if(!part)return mobileJson(request,{ok:false,error:"not_found"},404);

 if(part.status==="reserved")return mobileJson(request,{ok:false,error:"listing_reserved",message:"This listing is temporarily reserved in an active checkout."},409);
 let form:FormData;
 try{form=await request.formData();}catch{return mobileJson(request,{ok:false,error:"invalid_form"},400);}
 const file=form.get("file");
 if(!(file instanceof File)||file.size<=0)return mobileJson(request,{ok:false,error:"file_required"},400);

 let validated;
 try{validated=await validateImageUpload(file);}catch(error){const message=error instanceof Error?error.message:"Invalid image.";return mobileJson(request,{ok:false,error:"invalid_image",message},400);}

 const {count,error:countError}=await supabase
  .from("part_images")
  .select("id",{count:"exact",head:true})
  .eq("part_id",partId);
 if(countError)return mobileJson(request,{ok:false,error:"photos_unavailable"},503);
 if((count??0)>=6)return mobileJson(request,{ok:false,error:"photo_limit"},409);

 const {data:last}=await supabase
  .from("part_images")
  .select("position")
  .eq("part_id",partId)
  .order("position",{ascending:false})
  .limit(1);
 const position=(last?.[0]?.position??-1)+1;
 const storagePath=`${user.id}/${partId}/${randomUUID()}.${validated.extension}`;
 const bytes=new Uint8Array(await file.arrayBuffer());
 try{await requirePartImageCleanupReady();}catch{return mobileJson(request,{ok:false,error:"photo_editing_unavailable"},503);}

 const {error:uploadError}=await supabase.storage.from("part-images").upload(storagePath,bytes,{
  contentType:validated.mimeType,
  cacheControl:"31536000",
  upsert:false
 });
 if(uploadError)return mobileJson(request,{ok:false,error:"photo_upload_failed"},503);

 const {data:image,error:recordError}=await supabase
  .from("part_images")
  .insert({part_id:partId,storage_path:storagePath,alt_text:part.title,position})
  .select("id")
  .single();
 if(recordError||!image){
  await cleanupFailedPartImageUpload(user.id,partId,storagePath);
  return mobileJson(request,{ok:false,error:"photo_attach_failed"},503);
 }

 return mobileJson(request,{ok:true,imageId:image.id,position},201);
}

export async function DELETE(request:Request,{params}:{params:Promise<{partId:string}>}){
 const {partId}=await params;
 if(!isUuid(partId))return mobileJson(request,{ok:false,error:"invalid_part"},400);

 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 const imageId=new URL(request.url).searchParams.get("imageId")??"";
 if(!isUuid(imageId))return mobileJson(request,{ok:false,error:"invalid_image"},400);

 const {data:part}=await supabase
  .from("parts")
  .select("id,status")
  .eq("id",partId)
  .eq("seller_id",auth.seller.id)
  .maybeSingle();
 if(!part)return mobileJson(request,{ok:false,error:"not_found"},404);

 if(part.status==="reserved")return mobileJson(request,{ok:false,error:"listing_reserved",message:"This listing is temporarily reserved in an active checkout."},409);

 const {data:image}=await supabase
  .from("part_images")
  .select("id,storage_path")
  .eq("id",imageId)
  .eq("part_id",partId)
  .maybeSingle();
 if(!image)return mobileJson(request,{ok:false,error:"image_not_found"},404);

 if(part.status==="active"){
  const {count}=await supabase.from("part_images").select("id",{count:"exact",head:true}).eq("part_id",partId);
  if((count??0)<=1)return mobileJson(request,{ok:false,error:"active_listing_requires_photo"},409);
 }

 try{await requirePartImageCleanupReady();}catch{return mobileJson(request,{ok:false,error:"photo_editing_unavailable"},503);}
 const {data:deleted,error}=await supabase.from("part_images").delete().eq("id",imageId).eq("part_id",partId).select("id,storage_path").maybeSingle();
 if(error)return mobileJson(request,{ok:false,error:"photo_delete_failed"},503);
 if(!deleted)return mobileJson(request,{ok:false,error:"image_not_found"},404);
 const cleaned=await attemptPartImageCleanup(deleted.storage_path);

 return mobileJson(request,{ok:true,deleted:true,cleanupPending:!cleaned});
}
