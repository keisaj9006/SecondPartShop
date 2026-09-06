create index if not exists listing_conversation_messages_thread_page_idx
  on public.listing_conversation_messages(conversation_id,created_at desc,id desc);

create index if not exists transaction_messages_item_page_idx
  on public.transaction_messages(order_item_id,created_at desc,id desc);
