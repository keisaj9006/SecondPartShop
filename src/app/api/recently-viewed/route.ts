import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request:Request){
 const user=await getCurrentUser();
 if(!user)return NextResponse.json({ok:false},{status:401});
 try{
  const body=await request.json() as {partId?:string};
  const partId=String(body.partId??"");
  if(!/^[0-9a-f-]{36}$/i.test(partId))return NextResponse.json({ok:false},{status:400});
  const supabase=await createSupabaseServerClient();
  const {error}=await supabase.from("recently_viewed_parts").upsert({profile_id:user.id,part_id:partId,viewed_at:new Date().toISOString()},{onConflict:"profile_id,part_id"});
  if(error)return NextResponse.json({ok:false},{status:500});
  return NextResponse.json({ok:true});
 }catch{
  return NextResponse.json({ok:false},{status:400});
 }
}
