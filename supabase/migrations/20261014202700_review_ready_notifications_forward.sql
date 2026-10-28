-- RC-05 forward-only repair of the absent hosted review-ready notification path.
-- The historical source at 20260906225000 exists but is not in the hosted ledger.
-- This definition follows the current eligibility contract in
-- get_review_opportunities() and submit_transaction_review().

create or replace function private.notify_transaction_review_ready()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  review_item_id uuid;
  buyer_profile uuid;
  seller_profile uuid;
  part_title text;
begin
  if tg_table_schema='public' and tg_table_name='order_items' then
    if not (
      old.payout_status is distinct from new.payout_status
      or old.funds_released_at is distinct from new.funds_released_at
      or old.fulfilment_status is distinct from new.fulfilment_status
      or old.refunded_at is distinct from new.refunded_at
    ) then
      return new;
    end if;
    review_item_id:=new.id;
  elsif tg_table_schema='public' and tg_table_name='transaction_cases' then
    if old.status not in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
       or new.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned') then
      return new;
    end if;
    review_item_id:=new.order_item_id;
  else
    return new;
  end if;

  select o.buyer_id,s.owner_id,p.title
    into buyer_profile,seller_profile,part_title
  from public.order_items oi
  join public.orders o on o.id=oi.order_id
  join public.sellers s on s.id=oi.seller_id
  join public.parts p on p.id=oi.part_id
  where oi.id=review_item_id
    and o.payment_status='paid'
    and oi.payout_status='released'
    and oi.funds_released_at is not null
    and oi.fulfilment_status='completed'
    and oi.refunded_at is null
    and not exists(
      select 1
      from public.transaction_cases c
      where c.order_item_id=oi.id
        and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
    );

  if buyer_profile is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      buyer_profile,
      'account',
      'Your verified review is ready',
      left('Rate your completed purchase: '||coalesce(part_title,'SecondPart transaction'),240),
      '/account/reviews',
      'review-ready:'||review_item_id::text||':buyer'
    )
    on conflict do nothing;
  end if;

  if seller_profile is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      seller_profile,
      'account',
      'Your verified review is ready',
      left('Rate the buyer from your completed sale: '||coalesce(part_title,'SecondPart transaction'),240),
      '/account/reviews',
      'review-ready:'||review_item_id::text||':seller'
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists transaction_review_ready_notification on public.order_items;
create trigger transaction_review_ready_notification
after update of payout_status,funds_released_at,fulfilment_status,refunded_at on public.order_items
for each row execute function private.notify_transaction_review_ready();

drop trigger if exists transaction_case_review_ready_notification on public.transaction_cases;
create trigger transaction_case_review_ready_notification
after update of status on public.transaction_cases
for each row execute function private.notify_transaction_review_ready();

revoke all on function private.notify_transaction_review_ready() from public;
