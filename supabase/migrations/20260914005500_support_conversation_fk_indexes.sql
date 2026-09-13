create index if not exists support_request_messages_sender_profile_idx
  on public.support_request_messages(sender_profile_id);

create index if not exists support_request_internal_notes_admin_profile_idx
  on public.support_request_internal_notes(admin_profile_id);
