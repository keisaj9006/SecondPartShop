import type { Database } from "./database.types";

type SupportRequestMessageTable={
 Row:{
  created_at:string;
  id:string;
  message:string;
  sender_profile_id:string|null;
  sender_role:string;
  support_request_id:string;
 };
 Insert:{
  created_at?:string;
  id?:string;
  message:string;
  sender_profile_id?:string|null;
  sender_role:string;
  support_request_id:string;
 };
 Update:{
  created_at?:string;
  id?:string;
  message?:string;
  sender_profile_id?:string|null;
  sender_role?:string;
  support_request_id?:string;
 };
 Relationships:[];
};

type SupportRequestInternalNoteTable={
 Row:{
  admin_profile_id:string|null;
  created_at:string;
  id:string;
  note:string;
  support_request_id:string;
 };
 Insert:{
  admin_profile_id?:string|null;
  created_at?:string;
  id?:string;
  note:string;
  support_request_id:string;
 };
 Update:{
  admin_profile_id?:string|null;
  created_at?:string;
  id?:string;
  note?:string;
  support_request_id?:string;
 };
 Relationships:[];
};

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
 reply_to_support_request:{
  Args:{p_support_request_id:string;p_message:string};
  Returns:{message_id:string;request_status:string;created_at:string}[];
 };
 admin_reply_to_support_request:{
  Args:{p_support_request_id:string;p_message:string;p_next_status?:string|null};
  Returns:{message_id:string;request_status:string;created_at:string}[];
 };
 admin_update_support_request_status:{
  Args:{p_support_request_id:string;p_status:string};
  Returns:{request_status:string;updated_at:string}[];
 };
 admin_add_support_request_note:{
  Args:{p_support_request_id:string;p_note:string};
  Returns:{note_id:string;created_at:string}[];
 };
};

type RuntimeUserTables=Database["public"]["Tables"]&{
 support_request_messages:SupportRequestMessageTable;
 support_request_internal_notes:SupportRequestInternalNoteTable;
};

/**
 * Narrow generated-schema extension for fresh authenticated tables and RPCs
 * that are already represented by migrations but may not yet be present in
 * the generated database.types.ts snapshot.
 *
 * Keep these signatures aligned with `supabase gen types` output so regular
 * user-scoped clients stay type-safe without casts or widening to `any`.
 */
export type RuntimeUserDatabase=Omit<Database,"public">&{
 public:Omit<Database["public"],"Functions"|"Tables">&{
  Tables:RuntimeUserTables;
  Functions:Database["public"]["Functions"]&RuntimeUserFunctions;
 };
};