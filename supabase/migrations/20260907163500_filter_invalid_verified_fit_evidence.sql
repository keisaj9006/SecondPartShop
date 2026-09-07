create or replace view private.valid_verified_fit_feedback
with (security_barrier=true)
as
select vf.*
from public.verified_fit_feedback vf
join public.order_items oi on oi.id=vf.order_item_id
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

revoke all on private.valid_verified_fit_feedback from public;
revoke all on private.valid_verified_fit_feedback from anon;
revoke all on private.valid_verified_fit_feedback from authenticated;

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
        'get_part_passport_evidence',
        'get_part_verified_fit_summary',
        'marketplace_catalogue_compatibility',
        'marketplace_catalogue_page',
        'marketplace_catalogue_sorted_page',
        'marketplace_catalogue_distance_page'
      )
  loop
    definition:=pg_get_functiondef(fn.oid);
    if position('public.verified_fit_feedback' in definition)=0 then
      raise exception 'Expected verified fit source not found in function %',fn.proname;
    end if;
    execute replace(
      definition,
      'public.verified_fit_feedback',
      'private.valid_verified_fit_feedback'
    );
  end loop;
end;
$$;
