import { NextResponse } from "next/server";
import { isPlausibleUkPostcode,normalizePostcode } from "@/lib/postcode";

export const dynamic="force-dynamic";

export async function POST(request:Request){
 try{
  const body=await request.json() as {postcode?:string};
  const postcode=normalizePostcode(String(body.postcode??""));
  if(!isPlausibleUkPostcode(postcode)){
   return NextResponse.json({ok:false,message:"Enter a full UK postcode, for example EH1 1BB."},{status:400});
  }
  const response=await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,{cache:"no-store"});
  if(response.status===404){
   return NextResponse.json({ok:false,message:"We could not find an active UK postcode with that code. Check it and try again."},{status:404});
  }
  if(!response.ok){
   return NextResponse.json({ok:false,message:"Postcode lookup is temporarily unavailable. Try again in a moment."},{status:503});
  }
  const payload=await response.json() as {result?:{postcode?:string}|null};
  if(!payload.result){
   return NextResponse.json({ok:false,message:"We could not confirm that postcode."},{status:404});
  }
  return NextResponse.json({ok:true,postcode:payload.result.postcode??postcode});
 }catch{
  return NextResponse.json({ok:false,message:"Postcode lookup is temporarily unavailable."},{status:503});
 }
}
