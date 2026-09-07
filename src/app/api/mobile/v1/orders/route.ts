import { mobileJson,mobileOptions,requireMobileUser } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export async function GET(request:Request){
 const auth=await requireMobileUser(request);
 if(!auth.context)return auth.response;
 const {user,supabase}=auth.context;
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??20);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,60)):20;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;
 const status=url.searchParams.get("status")?.trim()??"";

 let query=supabase
  .from("orders")
  .select("id,status,payment_status,total_pence,currency,created_at,order_items(id,quantity,unit_price_pence,shipping_pence,delivery_method,fulfilment_status,payout_status,tracking_carrier,tracking_number,buyer_received_at,release_eligible_at,funds_released_at,parts(title,slug),sellers(business_name,slug))")
  .eq("buyer_id",user.id)
  .order("created_at",{ascending:false})
  .order("id",{ascending:false});
 if(status)query=query.eq("status",status.slice(0,60));
 const {data,error}=await query.range(offset,offset+limit);
 if(error)return mobileJson(request,{ok:false,error:"orders_unavailable"},503);
 const raw=data??[];
 const hasMore=raw.length>limit;
 const page=raw.slice(0,limit);

 const items=page.map(order=>({
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
  })
 }));

 return mobileJson(request,{ok:true,items,pagination:{offset,limit,returned:items.length,hasMore}});
}
