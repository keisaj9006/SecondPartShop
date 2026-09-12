"use server";

import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireSeller} from "@/lib/auth";
import {getSellerForOwner} from "@/lib/data/marketplace";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {isUuid} from "@/lib/identifiers";
import {processSellerInventoryCsv,type BulkImportState} from "@/lib/inventory-csv-import";
import {hasCurrentMarketplaceTerms} from "@/lib/marketplace-policy";

export type {BulkImportIssue,BulkImportPreviewRow,BulkImportState} from "@/lib/inventory-csv-import";

export async function bulkImportCsv(_previous:BulkImportState,formData:FormData):Promise<BulkImportState>{
 const {user}=await requireSeller("/dashboard/import");
 if(!await hasCurrentMarketplaceTerms(user.id))return {status:"error",message:"Accept the current Terms of Use and Privacy Policy in Account → Security before importing listing content."};
 const seller=await getSellerForOwner(user.id);
 if(!seller)return {status:"error",message:"Create your seller profile before importing inventory."};
 const file=formData.get("file");
 if(!(file instanceof File))return {status:"error",message:"Choose a CSV file."};
 const mode=String(formData.get("mode")??"preview");
 const supabase=await createSupabaseServerClient();
 const result=await processSellerInventoryCsv({file,sellerId:seller.id,supabase,mode});
 if(result.fileReset==="clear"){
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/import");
 }
 return result;
}

export async function publishReadyImportDrafts(formData:FormData){
 const {user}=await requireSeller("/dashboard/import");
 if(!await hasCurrentMarketplaceTerms(user.id))return;
 const seller=await getSellerForOwner(user.id);
 if(!seller)return;
 const batchId=String(formData.get("batchId")??"").trim();
 if(!isUuid(batchId))return;

 const supabase=await createSupabaseServerClient();
 const {data,error}=await supabase.rpc("publish_ready_import_batch",{p_batch_id:batchId});
 if(error)throw new Error("Ready drafts could not be published.");

 const published=Number(data??0);
 revalidatePath("/");
 revalidatePath("/dashboard");
 revalidatePath("/dashboard/import");
 revalidatePath("/dashboard/import/"+batchId);
 redirect("/dashboard/import/"+batchId+"?published="+published);
}
