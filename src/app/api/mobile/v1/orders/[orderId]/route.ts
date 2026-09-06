import { isUuid } from "@/lib/identifiers";
import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function GET(request:Request,{params}:{params:Promise<{orderId:string}>}){
 const {orderId}=await params;
 if(!isUuid(orderId))return mobileJson(request,{ok:false,error:"invalid_order"},400);

 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;

 const {data:order,error}=await supabase
  .from("orders")
  .select("id,status,payment_status,total_pence,currency,created_at,order_items(id,quantity,unit_price_pence,shipping_pence,delivery_method,fulfilment_status,payout_status,tracking_carrier,tracking_number,buyer_received_at,release_eligible_at,funds_released_at,parts(title,slug),sellers(business_name,slug))")
  .eq("id",orderId)
  .eq("buyer_id",user.id)
  .maybeSingle();
 if(error)return mobileJson(request,{ok:false,error:"order_unavailable"},503);
 if(!order)return mobileJson(request,{ok:false,error:"not_found"},404);

 const {data:events,error:eventError}=await supabase
  .from("order_events")
  .select("id,order_item_id,event_type,from_status,to_status,created_at")
  .eq("order_id",orderId)
  .order("created_at",{ascending:true});
 if(eventError)return mobileJson(request,{ok:false,error:"timeline_unavailable"},503);

 return mobileJson(request,{
  ok:true,
  order:{
   id:order.id,
   status:order.status,
   paymentStatus:order.payment_status,
   totalPence:order.total_pence,
   currency:order.currency,
   createdAt:order.created_at,
   items:(order.order_items??[]).flatMap(item=>{
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
   }),
   timeline:(events??[]).map(event=>({
    id:event.id,
    orderItemId:event.order_item_id,
    eventType:event.event_type,
    fromStatus:event.from_status,
    toStatus:event.to_status,
    createdAt:event.created_at
   }))
  }
 });
}
