import type { Database } from "./database.types";

type RuntimeUserFunctions={
 get_own_seller_profile_private:{
  Args:never;
  Returns:{
   business_kind:string;
   business_name:string;
   description:string;
   id:string;
   location:string;
   owner_id:string;
   postcode:string;
   seller_type:string;
   slug:string;
   verified_at:string;
  }[];
 };
};

/**
 * Narrow generated-schema extension for fresh authenticated RPCs that are
 * already deployed to the SecondPart QA Supabase project but are not yet
 * present in the main generated database.types.ts snapshot.
 *
 * Keep these signatures identical to `supabase gen types` output so regular
 * user-scoped clients stay type-safe without casts or widening to `any`.
 */
export type RuntimeUserDatabase=Omit<Database,"public">&{
 public:Omit<Database["public"],"Functions">&{
  Functions:Database["public"]["Functions"]&RuntimeUserFunctions;
 };
};
