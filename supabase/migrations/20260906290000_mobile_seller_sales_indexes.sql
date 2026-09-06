create index if not exists order_items_seller_id_desc_idx
  on public.order_items(seller_id,id desc);

create index if not exists order_items_seller_fulfilment_id_idx
  on public.order_items(seller_id,fulfilment_status,id desc);

create index if not exists order_items_seller_payout_id_idx
  on public.order_items(seller_id,payout_status,id desc);
