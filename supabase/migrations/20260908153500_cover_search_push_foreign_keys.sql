create index if not exists marketplace_search_events_category_id_idx
  on public.marketplace_search_events(category_id)
  where category_id is not null;

create index if not exists mobile_push_outbox_device_id_idx
  on public.mobile_push_outbox(device_id);

create index if not exists mobile_push_outbox_profile_id_idx
  on public.mobile_push_outbox(profile_id);
