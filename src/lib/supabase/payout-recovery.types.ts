import type { Database } from "./database.types";

type PayoutRecoveryFunctions={
 abandon_empty_order_item_payout_release_claim:{
  Args:{p_order_item_id:string};
  Returns:boolean;
 };
 finalize_order_item_payout_transfer_rollback:{
  Args:{p_order_item_id:string;p_reversal_id:string;p_transfer_id:string};
  Returns:boolean;
 };
 get_releasing_payout_order_items:{
  Args:{p_limit?:number};
  Returns:{order_item_id:string}[];
 };
 mark_order_item_payout_rollback_required:{
  Args:{p_order_item_id:string;p_transfer_id:string};
  Returns:boolean;
 };
 recover_order_item_payout_transfer:{
  Args:{p_order_item_id:string;p_transfer_id:string};
  Returns:boolean;
 };
};

/**
 * Narrow generated-schema extension for the payout recovery migration deployed
 * to the live SecondPart Supabase project on 2026-09-10.
 *
 * Keep these signatures identical to `supabase gen types` output. This avoids
 * weakening RPC calls while the main generated file is refreshed as a whole.
 */
export type PayoutRecoveryDatabase=Omit<Database,"public">&{
 public:Omit<Database["public"],"Functions">&{
  Functions:Database["public"]["Functions"]&PayoutRecoveryFunctions;
 };
};
