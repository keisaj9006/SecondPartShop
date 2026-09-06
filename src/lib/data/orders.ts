import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BuyerOrder,SellerSale } from "@/lib/types";

type BuyerOrderRow={
 id:string;
 status:string;
 payment_status:string;
 total_pence:number;
 currency:string;
 created_at:string;
 order_items:Array<{
  id:string;
  quantity:number;
  unit_price_pence:number;
  fulfilment_status:string;
  payout_status:string;
  tracking_carrier:string|null;
  tracking_number:string|null;
  funds_released_at:string|null;
  parts:{title:string;slug:string}|Array<{title:string;slug:string}>|null;
  sellers:{business_name:string;slug:string}|Array<{business_name:string;slug:string}>|null;
 }> | null;
};

type SellerSaleRow={
 id:string;
 order_id:string;
 quantity:number;
 unit_price_pence:number;
 fulfilment_status:string;
 payout_status:string;
 tracking_carrier:string|null;
 tracking_number:string|null;
 funds_released_at:string|null;
 parts:{title:string;slug:string}|Array<{title:string;slug:string}>|null;
 orders:{id:string;status:string;payment_status:string;created_at:string}|Array<{id:string;status:string;payment_status:string;created_at:string}>|null;
};

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function getBuyerOrders(profileId:string):Promise<BuyerOrder[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("orders")
  .select("id,status,payment_status,total_pence,currency,created_at,order_items(id,quantity,unit_price_pence,fulfilment_status,payout_status,tracking_carrier,tracking_number,funds_released_at,parts(title,slug),sellers(business_name,slug))")
  .eq("buyer_id",profileId)
  .order("created_at",{ascending:false});
 if(error)throw new Error("Purchases are temporarily unavailable.");
 return (data??[]).map(row=>{
  const raw=row as unknown as BuyerOrderRow;
  return {
   id:raw.id,
   status:raw.status,
   paymentStatus:raw.payment_status,
   totalPence:raw.total_pence,
   currency:raw.currency,
   createdAt:raw.created_at,
   items:(raw.order_items??[]).flatMap(item=>{
    const part=one(item.parts);
    const seller=one(item.sellers);
    if(!part||!seller)return [];
    return [{
     id:item.id,
     partTitle:part.title,
     partSlug:part.slug,
     sellerName:seller.business_name,
     sellerSlug:seller.slug,
     quantity:item.quantity,
     unitPricePence:item.unit_price_pence,
     fulfilmentStatus:item.fulfilment_status,
     payoutStatus:item.payout_status,
     trackingCarrier:item.tracking_carrier,
     trackingNumber:item.tracking_number,
     fundsReleasedAt:item.funds_released_at
    }];
   })
  };
 });
}

export async function getSellerSales(sellerId:string):Promise<SellerSale[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("order_items")
  .select("id,order_id,quantity,unit_price_pence,fulfilment_status,payout_status,tracking_carrier,tracking_number,funds_released_at,parts(title,slug),orders(id,status,payment_status,created_at)")
  .eq("seller_id",sellerId)
  .order("id",{ascending:false});
 if(error)throw new Error("Seller orders are temporarily unavailable.");
 return (data??[]).flatMap(row=>{
  const raw=row as unknown as SellerSaleRow;
  const part=one(raw.parts);
  const order=one(raw.orders);
  if(!part||!order)return [];
  return [{
   orderItemId:raw.id,
   orderId:raw.order_id,
   partTitle:part.title,
   partSlug:part.slug,
   quantity:raw.quantity,
   unitPricePence:raw.unit_price_pence,
   fulfilmentStatus:raw.fulfilment_status,
   payoutStatus:raw.payout_status,
   trackingCarrier:raw.tracking_carrier,
   trackingNumber:raw.tracking_number,
   fundsReleasedAt:raw.funds_released_at,
   orderStatus:order.status,
   paymentStatus:order.payment_status,
   orderCreatedAt:order.created_at
  }];
 });
}
