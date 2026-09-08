"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSeller } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSellerForOwner } from "@/lib/data/marketplace";
import { lookupPostcodeLocation,normalizePostcode } from "@/lib/postcode";
import type { ActionState,ListingStatus,PartCondition,PartTestingStatus } from "@/lib/types";
import { validateImageUpload } from "@/lib/image-upload";
import { isSellerBusinessKind } from "@/lib/seller-business";
import { isUuid } from "@/lib/identifiers";
import { isSellerCheckoutReady } from "@/lib/data/checkout";

const slugify=(value:string)=>value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80);
async function sellerGeoFromPostcode(value:string){const normalized=value?normalizePostcode(value):"";if(!normalized)return {postcode:null,latitude:null,longitude:null,postcode_geocode_approximate:false,postcode_geocoded_at:null};const geo=await lookupPostcodeLocation(normalized,true);return {postcode:normalized,latitude:geo?.latitude??null,longitude:geo?.longitude??null,postcode_geocode_approximate:geo?.approximate??false,postcode_geocoded_at:geo?new Date().toISOString():null};}
const readListing=(formData:FormData)=>{const price=Number(formData.get("price"));const shippingPrice=Number(formData.get("shippingPrice")??0);const stock=Number(formData.get("stock"));const dispatchDays=Number(formData.get("dispatchDays"));const warrantyDays=Number(formData.get("warrantyDays"));const condition=String(formData.get("condition")) as PartCondition;const testingStatus=String(formData.get("testingStatus")) as PartTestingStatus;const status=String(formData.get("status")) as ListingStatus;const deliveryMinRaw=String(formData.get("deliveryDaysMin")??"").trim();const deliveryMaxRaw=String(formData.get("deliveryDaysMax")??"").trim();const deliveryDaysMin=deliveryMinRaw?Number(deliveryMinRaw):null;const deliveryDaysMax=deliveryMaxRaw?Number(deliveryMaxRaw):null;return {title:String(formData.get("title")??"").trim(),description:String(formData.get("description")??"").trim(),category_id:String(formData.get("categoryId")??""),donor_vehicle_id:String(formData.get("donorVehicleId")??"").trim()||null,condition,price_pence:Math.round(price*100),shipping_pence:Math.round(shippingPrice*100),stock,manufacturer:String(formData.get("manufacturer")??"").trim()||null,part_number:String(formData.get("partNumber")??"").trim()||null,oem_number:String(formData.get("oemNumber")??"").trim()||null,gearbox_family:String(formData.get("gearboxFamily")??"").trim()||null,gearbox_code:String(formData.get("gearboxCode")??"").trim()||null,dispatch_days:dispatchDays,testing_status:testingStatus,warranty_days:warrantyDays,condition_notes:String(formData.get("conditionNotes")??"").trim()||null,damage_notes:String(formData.get("damageNotes")??"").trim()||null,collection_available:formData.get("collectionAvailable")==="on",delivery_days_min:deliveryDaysMin,delivery_days_max:deliveryDaysMax,status};};
function validateListing(value:ReturnType<typeof readListing>):string|null{if(value.title.length<5)return "Title must contain at least 5 characters.";if(value.description.length<20)return "Description must contain at least 20 characters.";if(!value.category_id)return "Choose a category.";if(!(["new","reconditioned","used"] as string[]).includes(value.condition))return "Choose a valid condition.";if(!(["tested_working","removed_from_running_vehicle","visually_inspected","untested","not_specified"] as string[]).includes(value.testing_status))return "Choose a valid testing status.";if(!(["draft","active"] as string[]).includes(value.status))return "Choose draft or active.";if(!Number.isInteger(value.price_pence)||value.price_pence<0)return "Enter a valid price.";if(!Number.isInteger(value.shipping_pence)||value.shipping_pence<0||value.shipping_pence>1000000)return "Enter a valid delivery price.";if(!Number.isInteger(value.stock)||value.stock<0)return "Enter a valid stock quantity.";if(value.status==="active"&&value.stock<1)return "Add at least one item to stock before publishing an active listing.";if(!Number.isInteger(value.warranty_days)||value.warranty_days<0||value.warranty_days>730)return "Choose a valid warranty period.";if((value.condition_notes?.length??0)>500||(value.damage_notes?.length??0)>500)return "Condition and damage notes must be 500 characters or fewer.";if((value.delivery_days_min===null)!==(value.delivery_days_max===null))return "Set both minimum and maximum delivery days, or leave both blank.";if(value.delivery_days_min!==null&&value.delivery_days_max!==null&&(!Number.isInteger(value.delivery_days_min)||!Number.isInteger(value.delivery_days_max)||value.delivery_days_min<0||value.delivery_days_max>30||value.delivery_days_min>value.delivery_days_max))return "Enter a valid delivery range between 0 and 30 days.";return null;}
async function normalizeForCategory(value:ReturnType<typeof readListing>){const supabase=await createSupabaseServerClient();const {data,error}=await supabase.from("categories").select("is_transmission_related,is_selectable").eq("id",value.category_id).maybeSingle();if(error||!data)return {value:null,error:error?.message??"Choose a valid category."};if(!data.is_selectable)return {value:null,error:"Choose a specific part type, not only a department or category group."};if(data.is_transmission_related&&(!value.gearbox_family||!value.gearbox_code))return {value:null,error:"Gearbox family and code are required for this transmission-related part type."};return {value:data.is_transmission_related?value:{...value,gearbox_family:null,gearbox_code:null},error:null};}
async function validateDonorForSeller(donorVehicleId:string|null,sellerId:string){if(!donorVehicleId)return null;const supabase=await createSupabaseServerClient();const {data,error}=await supabase.from("donor_vehicles").select("id").eq("id",donorVehicleId).eq("seller_id",sellerId).maybeSingle();if(error)throw error;if(!data)throw new Error("Choose a donor vehicle that belongs to your seller account.");return data.id;}
type CatalogueFitmentRow={variant_id:string;year_value:number;fuel_type:string|null;engine_size_simple:number|null;notes:string|null};
function readCatalogueFitments(formData:FormData):{rows:CatalogueFitmentRow[];error:string|null}{
 const raw=String(formData.get("catalogueFitments")??"[]");
 let parsed:unknown;
 try{parsed=JSON.parse(raw);}catch{return {rows:[],error:"Vehicle compatibility data could not be read."};}
 if(!Array.isArray(parsed))return {rows:[],error:"Vehicle compatibility data is invalid."};
 if(parsed.length>20)return {rows:[],error:"A listing can have at most 20 confirmed vehicle fitments."};
 const rows:CatalogueFitmentRow[]=[];
 const seen=new Set<string>();
 for(const item of parsed){
  if(typeof item!=="object"||item===null||Array.isArray(item))return {rows:[],error:"One of the vehicle fitments is invalid."};
  const row=item as {variantId?:unknown;year?:unknown;fuelType?:unknown;engineSizeSimple?:unknown;notes?:unknown};
  const variantId=typeof row.variantId==="string"?row.variantId.trim():"";
  const year=Number(row.year);
  const fuelType=typeof row.fuelType==="string"&&row.fuelType.trim()?row.fuelType.trim().slice(0,100):null;
  const engineRaw=row.engineSizeSimple;
  const engineSize=engineRaw===null||engineRaw===undefined||engineRaw===""?null:Number(engineRaw);
  const notes=typeof row.notes==="string"&&row.notes.trim()?row.notes.trim().slice(0,300):null;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(variantId))return {rows:[],error:"Choose a valid vehicle version."};
  if(!Number.isInteger(year)||year<1900||year>2100)return {rows:[],error:"Choose a valid fitment year."};
  if(engineSize!==null&&(!Number.isInteger(engineSize)||engineSize<100||engineSize>10000))return {rows:[],error:"Choose a valid engine for the fitment."};
  const key=[variantId,year,fuelType??"",engineSize??""].join("|");
  if(seen.has(key))return {rows:[],error:"The same exact vehicle fitment was added more than once."};
  seen.add(key);
  rows.push({variant_id:variantId,year_value:year,fuel_type:fuelType,engine_size_simple:engineSize,notes});
 }
 return {rows,error:null};
}
function hasCompatibilityEvidence(value:ReturnType<typeof readListing>,fitments:CatalogueFitmentRow[]){
 return Boolean(
  value.donor_vehicle_id||
  fitments.length||
  value.oem_number||
  (value.manufacturer&&value.part_number)
 );
}
async function replaceCatalogueFitments(partId:string,rows:CatalogueFitmentRow[]){
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.rpc("replace_part_catalogue_fitments",{p_part_id:partId,p_fitments:rows});
 if(error)throw error;
}
async function uploadImage(partId:string,userId:string,title:string,file:File,position:number){if(!file.size)return null;const validated=await validateImageUpload(file);const path=`${userId}/${partId}/${crypto.randomUUID()}.${validated.extension}`;const supabase=await createSupabaseServerClient();const {error:uploadError}=await supabase.storage.from("part-images").upload(path,file,{contentType:validated.mimeType,cacheControl:"31536000",upsert:false});if(uploadError)throw uploadError;const {error:recordError}=await supabase.from("part_images").insert({part_id:partId,storage_path:path,alt_text:title,position});if(recordError){await supabase.storage.from("part-images").remove([path]);throw recordError;}return path;}
const imageFiles=(formData:FormData)=>formData.getAll("images").filter((value):value is File=>value instanceof File&&value.size>0);
const imageLimitError=(files:File[],existingCount=0)=>files.length+existingCount>6?"A listing can have at most 6 product photos.":null;
async function uploadImages(partId:string,userId:string,title:string,files:File[],startPosition=0){for(let index=0;index<files.length;index+=1)await uploadImage(partId,userId,title,files[index],startPosition+index);}
export async function createSellerProfile(_previous:ActionState,formData:FormData):Promise<ActionState>{const {user}=await requireSeller("/dashboard");const businessName=String(formData.get("businessName")??"").trim();const location=String(formData.get("location")??"").trim();const postcode=String(formData.get("postcode")??"").trim();const description=String(formData.get("description")??"").trim();const sellerType=String(formData.get("sellerType")??"business");const businessKindRaw=String(formData.get("businessKind")??"").trim();if(businessName.length<2||!location||description.length<20)return {status:"error",message:"Complete the seller name, location and a description of at least 20 characters."};if(!(["business","private"] as string[]).includes(sellerType))return {status:"error",message:"Choose a valid seller type."};const businessKind=sellerType==="business"&&isSellerBusinessKind(businessKindRaw)?businessKindRaw:null;if(sellerType==="business"&&!businessKind)return {status:"error",message:"Choose the type of automotive business you operate."};const sellerGeo=await sellerGeoFromPostcode(postcode);const supabase=await createSupabaseServerClient();const {error}=await supabase.from("sellers").insert({owner_id:user.id,business_name:businessName,slug:`${slugify(businessName)}-${user.id.slice(0,6)}`,location,description,seller_type:sellerType,business_kind:businessKind,...sellerGeo});if(error)return {status:"error",message:"We could not create the seller profile right now."};revalidatePath("/dashboard");redirect("/dashboard");}
export async function createListing(_previous:ActionState,formData:FormData):Promise<ActionState>{const {user}=await requireSeller("/dashboard/listings/new");const seller=await getSellerForOwner(user.id);if(!seller)return {status:"error",message:"Create your seller profile first."};const sourceRequestId=String(formData.get("sourceRequestId")??"").trim()||null;const raw=readListing(formData);const invalid=validateListing(raw);if(invalid)return {status:"error",message:invalid};const catalogueFitments=readCatalogueFitments(formData);if(catalogueFitments.error)return {status:"error",message:catalogueFitments.error};const files=imageFiles(formData);const imageError=imageLimitError(files);if(imageError)return {status:"error",message:imageError};if(raw.status==="active"&&!files.length)return {status:"error",message:"Add at least one real product photo before publishing an active listing."};const normalized=await normalizeForCategory(raw);if(normalized.error||!normalized.value)return {status:"error",message:normalized.error??"Listing could not be validated."};const value={...normalized.value,donor_vehicle_id:await validateDonorForSeller(normalized.value.donor_vehicle_id,seller.id)};const supabase=await createSupabaseServerClient();let validatedRequestId:string|null=null;if(sourceRequestId&&isUuid(sourceRequestId)){const {data:lead,error:leadError}=await supabase.rpc("seller_part_request_lead",{p_request_id:sourceRequestId});if(leadError)return {status:"error",message:"We could not validate this buyer request right now."};validatedRequestId=lead?.[0]?.request_id??null;}const requestedStatus=value.status;if(requestedStatus==="active"&&!await isSellerCheckoutReady(seller.id).catch(()=>false))return {status:"error",message:"Complete Payments & Payouts before publishing an active listing. You can still save the listing as a draft."};if(requestedStatus==="active"&&!hasCompatibilityEvidence(value,catalogueFitments.rows))return {status:"error",message:"Before publishing, add a donor vehicle, an exact compatible vehicle, an OE/OEM number, or a manufacturer part number. You can still save the listing as a draft."};const {data,error}=await supabase.from("parts").insert({...value,status:"draft",seller_id:seller.id,source_request_id:validatedRequestId,slug:`${slugify(value.title)}-${crypto.randomUUID().slice(0,8)}`}).select("id,slug").single();if(error)return {status:"error",message:error.message};try{await replaceCatalogueFitments(data.id,catalogueFitments.rows);await uploadImages(data.id,user.id,value.title,files);if(requestedStatus==="active"){const {error:publishError}=await supabase.from("parts").update({status:"active"}).eq("id",data.id).eq("seller_id",seller.id);if(publishError)throw publishError;}}catch(error){return {status:"error",message:error instanceof Error?error.message:"The listing was saved as a draft because related data could not be completed."};}revalidatePath("/");revalidatePath("/dashboard");redirect("/dashboard?created=1");}
export async function updateListing(_previous:ActionState,formData:FormData):Promise<ActionState>{const {user}=await requireSeller("/dashboard");const seller=await getSellerForOwner(user.id);if(!seller)return {status:"error",message:"Seller profile not found."};const partId=String(formData.get("partId")??"");const raw=readListing(formData);const invalid=validateListing(raw);if(invalid)return {status:"error",message:invalid};const catalogueFitments=readCatalogueFitments(formData);if(catalogueFitments.error)return {status:"error",message:catalogueFitments.error};const normalized=await normalizeForCategory(raw);if(normalized.error||!normalized.value)return {status:"error",message:normalized.error??"Listing could not be validated."};const value={...normalized.value,donor_vehicle_id:await validateDonorForSeller(normalized.value.donor_vehicle_id,seller.id)};const supabase=await createSupabaseServerClient();const files=imageFiles(formData);const {data:existing,error:existingError}=await supabase.from("parts").select("id,status").eq("id",partId).eq("seller_id",seller.id).maybeSingle();if(existingError||!existing)return {status:"error",message:"Listing not found."};if(existing.status==="reserved")return {status:"error",message:"This listing is temporarily reserved in an active checkout and cannot be edited until the checkout completes or expires."};let existingImageCount=0;if(files.length||raw.status==="active"){const {count,error:imageCountError}=await supabase.from("part_images").select("id",{count:"exact",head:true}).eq("part_id",partId);if(imageCountError)return {status:"error",message:"We could not validate the listing photos right now."};existingImageCount=count??0;}const imageError=imageLimitError(files,existingImageCount);if(imageError)return {status:"error",message:imageError};if(raw.status==="active"&&existingImageCount+files.length===0)return {status:"error",message:"Add at least one real product photo before publishing an active listing."};if(value.status==="active"&&!hasCompatibilityEvidence(value,catalogueFitments.rows))return {status:"error",message:"Before publishing, add a donor vehicle, an exact compatible vehicle, an OE/OEM number, or a manufacturer part number. You can still save the listing as a draft."};const activating=existing.status!=="active"&&value.status==="active";if(activating&&!await isSellerCheckoutReady(seller.id).catch(()=>false))return {status:"error",message:"Complete Payments & Payouts before publishing an active listing. Your changes can still be saved as a draft."};const updateValue=activating?{...value,status:"draft" as const}:value;const {data,error}=await supabase.from("parts").update(updateValue).eq("id",partId).eq("seller_id",seller.id).select("id,slug").single();if(error||!data)return {status:"error",message:error?.message??"Listing not found."};try{await replaceCatalogueFitments(partId,catalogueFitments.rows);if(files.length){const {data:lastImages}=await supabase.from("part_images").select("position").eq("part_id",partId).order("position",{ascending:false}).limit(1);const start=(lastImages?.[0]?.position??-1)+1;await uploadImages(partId,user.id,value.title,files,start);}if(activating){const {error:publishError}=await supabase.from("parts").update({status:"active"}).eq("id",partId).eq("seller_id",seller.id);if(publishError)throw publishError;}}catch(error){return {status:"error",message:error instanceof Error?error.message:"The listing remains a draft because related data could not be completed."};}revalidatePath("/");revalidatePath(`/parts/${data.slug}`);revalidatePath("/dashboard");redirect("/dashboard?updated=1");}
export async function archiveListing(formData:FormData){const {user}=await requireSeller("/dashboard");const seller=await getSellerForOwner(user.id);if(!seller)return;const partId=String(formData.get("partId")??"");const supabase=await createSupabaseServerClient();const {data:part}=await supabase.from("parts").select("status").eq("id",partId).eq("seller_id",seller.id).maybeSingle();if(!part||part.status==="reserved")return;await supabase.from("parts").update({status:"archived"}).eq("id",partId).eq("seller_id",seller.id).neq("status","reserved");revalidatePath("/");revalidatePath("/dashboard");}
export async function updateStock(formData:FormData){const {user}=await requireSeller("/dashboard");const seller=await getSellerForOwner(user.id);if(!seller)return;const partId=String(formData.get("partId")??"");const rawStock=Number(formData.get("stock"));if(!Number.isFinite(rawStock))return;const stock=Math.max(0,Math.floor(rawStock));const supabase=await createSupabaseServerClient();const {data:part}=await supabase.from("parts").select("status").eq("id",partId).eq("seller_id",seller.id).maybeSingle();if(!part||part.status==="reserved")return;const nextStatus=part.status==="active"&&stock===0?"sold":part.status==="sold"&&stock>0?"draft":part.status;await supabase.from("parts").update({stock,status:nextStatus}).eq("id",partId).eq("seller_id",seller.id).neq("status","reserved");revalidatePath("/");revalidatePath("/dashboard");}

export async function deleteListingImage(formData:FormData){
 const {user}=await requireSeller("/dashboard");
 const seller=await getSellerForOwner(user.id);
 if(!seller)return;
 const imageId=String(formData.get("imageId")??"");
 const partId=String(formData.get("partId")??"");
 if(!imageId||!partId)return;
 const supabase=await createSupabaseServerClient();
 const {data:part}=await supabase.from("parts").select("id,slug,status").eq("id",partId).eq("seller_id",seller.id).maybeSingle();
 if(!part)return;
 const {data:image}=await supabase.from("part_images").select("id,storage_path").eq("id",imageId).eq("part_id",partId).maybeSingle();
 if(!image)return;
 if(part.status==="active"){
  const {count}=await supabase.from("part_images").select("id",{count:"exact",head:true}).eq("part_id",partId);
  if((count??0)<=1)return;
 }
 const {error:storageError}=await supabase.storage.from("part-images").remove([image.storage_path]);
 if(storageError)throw storageError;
 const {error}=await supabase.from("part_images").delete().eq("id",imageId).eq("part_id",partId);
 if(error)throw error;
 revalidatePath("/dashboard");
 revalidatePath("/dashboard/listings/"+partId+"/edit");
 revalidatePath("/parts/"+part.slug);
}

export async function setListingCoverImage(formData:FormData){
 const {user}=await requireSeller("/dashboard");
 const seller=await getSellerForOwner(user.id);
 if(!seller)return;
 const imageId=String(formData.get("imageId")??"");
 const partId=String(formData.get("partId")??"");
 if(!imageId||!partId)return;
 const supabase=await createSupabaseServerClient();
 const {data:part}=await supabase.from("parts").select("id,slug").eq("id",partId).eq("seller_id",seller.id).maybeSingle();
 if(!part)return;
 const {data:images,error}=await supabase.from("part_images").select("id,position").eq("part_id",partId).order("position");
 if(error)throw error;
 const chosen=(images??[]).find(image=>image.id===imageId);
 if(!chosen)return;
 const ordered=[chosen,...(images??[]).filter(image=>image.id!==imageId)];
 for(let index=0;index<ordered.length;index+=1){
  const {error:updateError}=await supabase.from("part_images").update({position:index}).eq("id",ordered[index].id).eq("part_id",partId);
  if(updateError)throw updateError;
 }
 revalidatePath("/dashboard");
 revalidatePath("/dashboard/listings/"+partId+"/edit");
 revalidatePath("/parts/"+part.slug);
}


export async function updateSellerProfile(_previous:ActionState,formData:FormData):Promise<ActionState>{
 const {user}=await requireSeller("/dashboard/profile");
 const seller=await getSellerForOwner(user.id);
 if(!seller)return {status:"error",message:"Create your seller profile first."};

 const businessName=String(formData.get("businessName")??"").trim();
 const sellerType=String(formData.get("sellerType")??"business");
 const businessKindRaw=String(formData.get("businessKind")??"").trim();
 const location=String(formData.get("location")??"").trim();
 const postcode=String(formData.get("postcode")??"").trim();
 const description=String(formData.get("description")??"").trim();

 if(businessName.length<2||businessName.length>140)return {status:"error",message:"Seller name must be between 2 and 140 characters."};
 if(!(["business","private"] as string[]).includes(sellerType))return {status:"error",message:"Choose Business seller or Private seller."};
 const businessKind=sellerType==="business"&&isSellerBusinessKind(businessKindRaw)?businessKindRaw:null;
 if(sellerType==="business"&&!businessKind)return {status:"error",message:"Choose the type of automotive business you operate."};
 if(!location||location.length>120)return {status:"error",message:"Enter a valid town or city."};
 if(postcode.length>20)return {status:"error",message:"Postcode is too long."};
 if(description.length<20||description.length>2000)return {status:"error",message:"Description must be between 20 and 2,000 characters."};

 const sellerGeo=await sellerGeoFromPostcode(postcode);
 const supabase=await createSupabaseServerClient();
 const {error}=await supabase.from("sellers").update({
  business_name:businessName,
  seller_type:sellerType,
  business_kind:businessKind,
  location,
  description,
  ...sellerGeo
 }).eq("id",seller.id).eq("owner_id",user.id);

 if(error)return {status:"error",message:"We could not save the seller profile right now."};

 revalidatePath("/dashboard");
 revalidatePath("/dashboard/profile");
 revalidatePath(`/seller/${seller.slug}`);
 revalidatePath("/sellers");
 return {status:"success",message:"Seller profile saved."};
}
