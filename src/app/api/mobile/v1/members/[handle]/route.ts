import { getSellerListings } from "@/lib/data/marketplace";
import { getPublicMemberProfile,getPublicMemberReviews } from "@/lib/data/reputation";
import { mobileJson,mobileOptions } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

export async function GET(request:Request,{params}:{params:Promise<{handle:string}>}){
 const {handle}=await params;
 const safe=decodeURIComponent(handle).trim().replace(/^@/,"").slice(0,80);
 if(!safe)return mobileJson(request,{ok:false,error:"invalid_member"},400);

 try{
  const profile=await getPublicMemberProfile(safe);
  if(!profile)return mobileJson(request,{ok:false,error:"not_found"},404);

  const [reviews,listings]=await Promise.all([
   getPublicMemberReviews(profile.id,30).catch(()=>[]),
   profile.sellerId?getSellerListings(profile.sellerId).catch(()=>[]):Promise.resolve([])
  ]);

  return mobileJson(request,{ok:true,profile,reviews,listings});
 }catch{
  return mobileJson(request,{ok:false,error:"member_unavailable"},503);
 }
}
