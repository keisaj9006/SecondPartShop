import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function isSellerCheckoutReady(sellerId:string){
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("seller_checkout_ready",{p_seller_id:sellerId});
 if(error)return false;
 return Boolean(data);
}
