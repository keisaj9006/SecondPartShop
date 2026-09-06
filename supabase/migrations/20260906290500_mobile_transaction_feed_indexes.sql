create index if not exists orders_buyer_status_created_idx
  on public.orders(buyer_id,status,created_at desc,id);

create index if not exists transaction_cases_order_item_created_idx
  on public.transaction_cases(order_item_id,created_at desc,id);

create index if not exists transaction_cases_type_created_idx
  on public.transaction_cases(case_type,created_at desc,id);
