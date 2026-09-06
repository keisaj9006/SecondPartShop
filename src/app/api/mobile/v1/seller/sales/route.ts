import { mobileJson,mobileOptions,requireMobileSeller } from "@/lib/mobile-api";

export const dynamic="force-dynamic";
export const runtime="nodejs";

export function OPTIONS(request:Request){return mobileOptions(request);}

const one=<T>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;
const address=(value:unknown)=>{
 if(!value||typeof value!=="object"||Array.isArray(value))return null;
 const row=value as Record<string,unknown>;
 const text=(key:string)=>typeof row[key]==="string"?row[key]:null;
 return {line1:text("line1"),line2:text("line2"),city:text("city"),state:text("state"),postalCode:text("postal_code"),country:text("country")};
};

export async function GET(request:Request){
 const auth=await requireMobileSeller(request);
 if(!auth.context||!auth.seller)return auth.response;
 const {supabase}=auth.context;
 const seller=auth.seller;
 const url=new URL(request.url);
 const rawLimit=Number(url.searchParams.get("limit")??30);
 const rawOffset=Number(url.searchParams.get("offset")??0);
 const limit=Number.isInteger(rawLimit)?Math.max(1,Math.min(rawLimit,100)):30;
 const offset=Number.isInteger(rawOffset)?Math.max(0,rawOffset):0;
 const fulfilment=url.searchParams.get("fulfilment")?.trim()??"";
 const payout=url.searchParams.get("payout")?.trim()??"";
 const validFulfilment=["pending","paid","preparing","ready_for_collection","dispatched","delivered","accepted","completed","cancelled","return_requested","return_approved","returned","refunded","dispute_open","dispute_resolved"];
 const validPayout=["not_ready","scheduled","released","reversed","blocked"];

 let query=supabase
  .from("order_items")
  .select("id,order_id,quantity,unit_price_pence,shipping_pence,platform_fee_pence,seller_net_pence,delivery_method,fulfilment_status,payout_status,tracking_carrier,tracking_number,release_eligible_at,funds_released_at,parts(title,slug),orders(id,status,payment_status,created_at,shipping_name,shipping_address)")
  .eq("seller_id",seller.id)
  .order("id",{ascending:false});
 if(validFulfilment.includes(fulfilment))query=query.eq("fulfilment_status",fulfilment);
 if(validPayout.includes(payout))query=query.eq("payout_status",payout);
 const {data,error}=await query.range(offset,offset+limit);
 if(error)return mobileJson(request,{ok:false,error:"sales_unavailable"},503);
 const raw=data??[];
 const hasMore=raw.length>limit;
 const page=raw.slice(0,limit);

 const items=page.flatMap(row=>{
  const part=one(row.parts);
  const order=one(row.orders);
  if(!part||!order)return [];
  return [{
   orderItemId:row.id,
   orderId:row.order_id,
   partTitle:part.title,
   partSlug:part.slug,
   quantity:row.quantity,
   unitPricePence:row.unit_price_pence,
   shippingPence:row.shipping_pence,
   platformFeePence:row.platform_fee_pence,
   sellerNetPence:row.seller_net_pence,
   deliveryMethod:row.delivery_method,
   fulfilmentStatus:row.fulfilment_status,
   payoutStatus:row.payout_status,
   trackingCarrier:row.tracking_carrier,
   trackingNumber:row.tracking_number,
   releaseEligibleAt:row.release_eligible_at,
   fundsReleasedAt:row.funds_released_at,
   orderStatus:order.status,
   paymentStatus:order.payment_status,
   orderCreatedAt:order.created_at,
   shippingName:order.shipping_name,
   shippingAddress:address(order.shipping_address)
  }];
 });

 return mobileJson(request,{ok:true,seller:{id:seller.id,businessName:seller.business_name,slug:seller.slug},items,pagination:{offset,limit,returned:items.length,hasMore}});
}
