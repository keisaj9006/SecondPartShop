import type { PayoutRecoveryDatabase } from "./payout-recovery.types";

type RuntimeAdminFunctions={
 cancel_checkout_order_from_provider_event:{
  Args:{
   p_event_id:string;
   p_event_type:string;
   p_order_id:string;
   p_session_id:string;
  };
  Returns:boolean;
 };
};

/**
 * Narrow generated-schema extension for fresh service-only RPCs that have
 * already been deployed to the SecondPart QA Supabase project but are not yet
 * present in the main generated database.types.ts snapshot.
 *
 * Keep these signatures identical to `supabase gen types` output. This keeps
 * service-role RPC calls type-safe without weakening the client with casts.
 */
export type RuntimeAdminDatabase=Omit<PayoutRecoveryDatabase,"public">&{
 public:Omit<PayoutRecoveryDatabase["public"],"Functions">&{
  Functions:PayoutRecoveryDatabase["public"]["Functions"]&RuntimeAdminFunctions;
 };
};
