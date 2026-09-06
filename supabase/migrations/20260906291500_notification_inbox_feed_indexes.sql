create index if not exists notifications_profile_unread_created_idx
  on public.notifications(profile_id,created_at desc,id)
  where read_at is null;

create index if not exists listing_conversations_buyer_last_id_idx
  on public.listing_conversations(buyer_id,last_message_at desc,id);

create index if not exists listing_conversations_seller_last_id_idx
  on public.listing_conversations(seller_id,last_message_at desc,id);
