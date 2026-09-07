import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDonorVehiclesPage } from "@/lib/data/donor-vehicles";
import { getSellerForOwner } from "@/lib/data/marketplace";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export async function GET(request:Request){
 const user=await getCurrentUser();
 if(!user)return NextResponse.json({message:"Sign in required."},{status:401,headers:{"cache-control":"no-store"}});
 const seller=await getSellerForOwner(user.id);
 if(!seller)return NextResponse.json({message:"Seller access required."},{status:403,headers:{"cache-control":"no-store"}});

 const url=new URL(request.url);
 const query=url.searchParams.get("q")?.trim().slice(0,80)??"";
 const rawLimit=Number(url.searchParams.get("limit")??30);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,50)):30;

 try{
  const result=await getDonorVehiclesPage(seller.id,{query,limit});
  return NextResponse.json({items:result.items,hasMore:result.hasMore},{headers:{"cache-control":"private, no-store"}});
 }catch{
  return NextResponse.json({message:"Donor vehicles are temporarily unavailable."},{status:503,headers:{"cache-control":"no-store"}});
 }
}
