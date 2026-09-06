import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getPartImageCounts(partIds:string[]):Promise<Map<string,number>>{
 if(!partIds.length)return new Map();
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.from("part_images").select("part_id").in("part_id",partIds);
 if(error)throw new Error("Listing photo evidence is temporarily unavailable.");
 const counts=new Map<string,number>();
 for(const row of data??[])counts.set(row.part_id,(counts.get(row.part_id)??0)+1);
 return counts;
}
