create or replace view private.valid_completed_order_items
with (security_barrier=true)
as
select oi.*
from public.order_items oi
join public.orders o on o.id=oi.order_id
where o.payment_status='paid'
  and oi.fulfilment_status='completed'
  and oi.payout_status='released'
  and oi.funds_released_at is not null
  and oi.refunded_at is null
  and not exists(
    select 1
    from public.transaction_cases c
    where c.order_item_id=oi.id
      and c.status in ('open','seller_response','under_review','return_authorized','return_shipped','returned')
  );

create or replace view private.valid_verified_fit_feedback
with (security_barrier=true)
as
select vf.*
from public.verified_fit_feedback vf
join private.valid_completed_order_items oi on oi.id=vf.order_item_id;

create or replace view private.valid_transaction_reviews
with (security_barrier=true)
as
select r.*
from public.transaction_reviews r
join private.valid_completed_order_items oi on oi.id=r.order_item_id
where r.status='active'
  and r.visible_at<=now();

revoke all on private.valid_completed_order_items from public;
revoke all on private.valid_completed_order_items from anon;
revoke all on private.valid_completed_order_items from authenticated;

revoke all on private.valid_verified_fit_feedback from public;
revoke all on private.valid_verified_fit_feedback from anon;
revoke all on private.valid_verified_fit_feedback from authenticated;

revoke all on private.valid_transaction_reviews from public;
revoke all on private.valid_transaction_reviews from anon;
revoke all on private.valid_transaction_reviews from authenticated;

do $$
declare
  fn record;
  definition text;
begin
  for fn in
    select p.oid,p.proname
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'get_public_member_profile',
        'get_public_member_reviews',
        'get_seller_directory_page'
      )
  loop
    definition:=pg_get_functiondef(fn.oid);
    definition:=replace(
      definition,
      'public.transaction_reviews',
      'private.valid_transaction_reviews'
    );
    definition:=replace(
      definition,
      'public.order_items',
      'private.valid_completed_order_items'
    );
    execute definition;
  end loop;
end;
$$;
