create index if not exists fitting_request_messages_sender_profile_idx
  on public.fitting_request_messages(sender_profile_id);

create index if not exists fitting_requests_order_item_idx
  on public.fitting_requests(order_item_id)
  where order_item_id is not null;

create index if not exists fitting_requests_vehicle_variant_idx
  on public.fitting_requests(vehicle_variant_id);

create index if not exists seller_part_request_matches_responded_part_idx
  on public.seller_part_request_matches(responded_part_id)
  where responded_part_id is not null;

create index if not exists seller_prospect_invites_created_by_idx
  on public.seller_prospect_invites(created_by)
  where created_by is not null;

create index if not exists transaction_cases_resolved_by_idx
  on public.transaction_cases(resolved_by)
  where resolved_by is not null;
