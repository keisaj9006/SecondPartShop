import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 const [{data:profile,error:profileError},{data:seller,error:sellerError}]=await Promise.all([
  supabase.from("profiles").select("id,role,display_name,handle,bio,phone,created_at").eq("id",user.id).maybeSingle(),
  supabase.from("sellers").select("id,business_name,slug,location,postcode,description,verified_at,seller_type").eq("owner_id",user.id).maybeSingle()
 ]);

 if(profileError)return mobileJson(request,{ok:false,error:"profile_unavailable"},503);

 return mobileJson(request,{
  ok:true,
  user:{
   id:user.id,
   email:user.email??null,
   emailConfirmed:Boolean(user.email_confirmed_at)
  },
  profile:profile?{
   id:profile.id,
   role:profile.role,
   displayName:profile.display_name,
   handle:profile.handle,
   bio:profile.bio,
   phone:profile.phone,
   createdAt:profile.created_at
  }:null,
  seller:sellerError||!seller?null:{
   id:seller.id,
   businessName:seller.business_name,
   slug:seller.slug,
   location:seller.location,
   postcode:seller.postcode,
   description:seller.description,
   verified:Boolean(seller.verified_at),
   sellerType:seller.seller_type
  }
 });
}
