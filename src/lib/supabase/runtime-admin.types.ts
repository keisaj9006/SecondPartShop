import type { PayoutRecoveryDatabase } from "./payout-recovery.types";

type RuntimeAdminFunctions={
 claim_provider_dispute_reversal:{
  Args:{p_dispute_id:string};
  Returns:{claimed:boolean;transfer_id:string;amount_pence:number;reversal_id:string|null}[];
 };
 record_provider_dispute_reversal:{
  Args:{p_dispute_id:string;p_transfer_id:string;p_reversal_id:string;p_amount_pence:number};
  Returns:boolean;
 };
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
 * versioned migrations (deploy before their callers) but are not yet
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
