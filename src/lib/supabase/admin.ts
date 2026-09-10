import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import type { PayoutRecoveryDatabase } from "./payout-recovery.types";

export function createSupabaseAdminClient<TDatabase extends Database=PayoutRecoveryDatabase>(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!serviceRoleKey)throw new Error("Supabase admin environment is not configured.");
 return createClient<TDatabase>(url,serviceRoleKey,{
  auth:{persistSession:false,autoRefreshToken:false}
 });
}
