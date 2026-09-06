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
  shipping_pence:number;
  delivery_method:"shipping"|"collection";
  fulfilment_status:string;
  payout_status:string;
  tracking_carrier:string|null;
  tracking_number:string|null;
  buyer_received_at:string|null;
  release_eligible_at:string|null;
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
 shipping_pence:number;
 seller_net_pence:number;
 delivery_method:"shipping"|"collection";
 fulfilment_status:string;
 payout_status:string;
 tracking_carrier:string|null;
 tracking_number:string|null;
 release_eligible_at:string|null;
 funds_released_at:string|null;
 parts:{title:string;slug:string}|Array<{title:string;slug:string}>|null;
 orders:{id:string;status:string;payment_status:string;created_at:string;shipping_name:string|null;shipping_address:unknown}|Array<{id:string;status:string;payment_status:string;created_at:string;shipping_name:string|null;shipping_address:unknown}>|null;
};

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

const shippingAddress=(value:unknown)=>{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const row=value as Record<string,unknown>;
 const text=(key:string)=>typeof row[key]==="string"?row[key] as string:null;
 return {
  line1:text("line1"),
  line2:text("line2"),
  city:text("city"),
  state:text("state"),
  postalCode:text("postal_code"),
  country:text("country")
 };
};


export async function getBuyerOrders(profileId:string):Promise<BuyerOrder[]>{
 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase
  .from("orders")
  .select("id,status,payment_status,total_pence,currency,created_at,order_items(id,quantity,unit_price_pence,shipping_pence,delivery_method,fulfilment_status,payout_status,tracking_carrier,tracking_number,buyer_received_at,release_eligible_at,funds_released_at,parts(title,slug),sellers(business_name,slug))")
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
     shippingPence:item.shipping_pence,
     deliveryMethod:item.delivery_method,
     fulfilmentStatus:item.fulfilment_status,
     payoutStatus:item.payout_status,
     trackingCarrier:item.tracking_carrier,
     trackingNumber:item.tracking_number,
     buyerReceivedAt:item.buyer_received_at,
     releaseEligibleAt:item.release_eligible_at,
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
  .select("id,order_id,quantity,unit_price_pence,shipping_pence,seller_net_pence,delivery_method,fulfilment_status,payout_status,tracking_carrier,tracking_number,release_eligible_at,funds_released_at,parts(title,slug),orders(id,status,payment_status,created_at,shipping_name,shipping_address)")
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
   shippingPence:raw.shipping_pence,
   sellerNetPence:raw.seller_net_pence,
   deliveryMethod:raw.delivery_method,
   fulfilmentStatus:raw.fulfilment_status,
   payoutStatus:raw.payout_status,
   trackingCarrier:raw.tracking_carrier,
   trackingNumber:raw.tracking_number,
   releaseEligibleAt:raw.release_eligible_at,
   fundsReleasedAt:raw.funds_released_at,
   orderStatus:order.status,
   paymentStatus:order.payment_status,
   orderCreatedAt:order.created_at,
   shippingName:order.shipping_name,
   shippingAddress:shippingAddress(order.shipping_address)
  }];
 });
}
