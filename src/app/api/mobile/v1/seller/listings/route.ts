import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 const seller=auth.seller;

 const {data,error}=await supabase
  .from("parts")
  .select("id,slug,title,status,stock,price_pence,condition,testing_status,warranty_days,donor_vehicle_id,created_at,updated_at,part_images(id,storage_path,alt_text,position)")
  .eq("seller_id",seller.id)
  .order("updated_at",{ascending:false});
 if(error)return mobileJson(request,{ok:false,error:"inventory_unavailable"},503);

 const urlBase=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,"")??"";
 const publicUrl=(path:string)=>urlBase+"/storage/v1/object/public/part-images/"+path.split("/").map(encodeURIComponent).join("/");

 return mobileJson(request,{
  ok:true,
  items:(data??[]).map(item=>({
   id:item.id,
   slug:item.slug,
   title:item.title,
   status:item.status,
   stock:item.stock,
   pricePence:item.price_pence,
   condition:item.condition,
   testingStatus:item.testing_status,
   warrantyDays:item.warranty_days,
   donorVehicleId:item.donor_vehicle_id,
   createdAt:item.created_at,
   updatedAt:item.updated_at,
   images:(item.part_images??[]).sort((a,b)=>a.position-b.position).map(image=>({
    id:image.id,
    url:publicUrl(image.storage_path),
    alt:image.alt_text,
    position:image.position
   }))
  }))
 });
}
