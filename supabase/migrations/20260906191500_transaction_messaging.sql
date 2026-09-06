create table if not exists public.transaction_messages (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists transaction_messages_item_created_idx
  on public.transaction_messages(order_item_id,created_at);
create index if not exists transaction_messages_sender_idx
  on public.transaction_messages(sender_profile_id,created_at desc);

alter table public.transaction_messages enable row level security;

drop policy if exists "transaction messages participant read" on public.transaction_messages;
create policy "transaction messages participant read"
  on public.transaction_messages for select
  to authenticated
  using (private.can_read_order_item(order_item_id));

revoke all on public.transaction_messages from anon,authenticated;
grant select on public.transaction_messages to authenticated;

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'seller_part_request','buyer_part_match','saved_search_match','account',
    'order_paid','order_update','order_dispatched','order_received',
    'order_accepted','payout_released','return_update','dispute_update',
    'order_message'
  ));

create or replace function public.send_transaction_message(
  p_order_item_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  item record;
  message_id uuid;
  recipient uuid;
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if char_length(btrim(coalesce(p_body,'')))<1 then raise exception 'Message cannot be empty.'; end if;

  select oi.id,oi.order_id,o.buyer_id,o.payment_status,s.owner_id,p.title
  into item
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  join public.sellers s on s.id=oi.seller_id
  join public.parts p on p.id=oi.part_id
  where oi.id=p_order_item_id;

  if item.id is null then raise exception 'Transaction not found.'; end if;
  if item.payment_status not in ('paid','partially_refunded','disputed') then
    raise exception 'Messaging unlocks after payment.';
  end if;

  if actor=item.buyer_id then
    recipient:=item.owner_id;
  elsif actor=item.owner_id then
    recipient:=item.buyer_id;
  elsif private.is_admin() then
    recipient:=null;
  else
    raise exception 'You are not a participant in this transaction.';
  end if;

  insert into public.transaction_messages(order_item_id,sender_profile_id,body)
  values(item.id,actor,left(btrim(p_body),2000))
  returning id into message_id;

  if recipient is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      recipient,'order_message','New transaction message',left(item.title,180),
      '/messages/'||item.id::text,'order-message:'||message_id::text
    )
    on conflict do nothing;
  end if;

  insert into public.order_events(order_id,order_item_id,actor_profile_id,event_type,metadata)
  values(item.order_id,item.id,actor,'transaction_message_sent',
    jsonb_build_object('message_id',message_id));

  return message_id;
end;
$$;

revoke all on function public.send_transaction_message(uuid,text) from public;
grant execute on function public.send_transaction_message(uuid,text) to authenticated;
