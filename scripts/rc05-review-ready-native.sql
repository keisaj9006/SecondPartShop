\set ON_ERROR_STOP on

begin;

do $$
begin
  if to_regprocedure('private.notify_transaction_review_ready()') is not null then
    raise exception 'RC-05 preflight failed: review_ready function already exists';
  end if;
  if exists(select 1 from pg_trigger where tgname='transaction_review_ready_notification' and not tgisinternal) then
    raise exception 'RC-05 preflight failed: review_ready trigger already exists';
  end if;
end;
$$;

\ir ../supabase/migrations/20261014202700_review_ready_notifications_forward.sql

do $$
declare
  fn oid:=to_regprocedure('private.notify_transaction_review_ready()');
  trigger_definition text;
begin
  if fn is null then raise exception 'RC-05 postflight failed: function missing'; end if;
  select pg_get_triggerdef(t.oid) into trigger_definition
  from pg_trigger t where t.tgname='transaction_review_ready_notification' and not t.tgisinternal;
  if trigger_definition is null then raise exception 'RC-05 postflight failed: trigger missing'; end if;
  if trigger_definition not like '%AFTER UPDATE OF payout_status, funds_released_at, fulfilment_status ON public.order_items%'
    then raise exception 'RC-05 postflight failed: trigger columns changed'; end if;
  if not (select prosecdef from pg_proc where oid=fn) then raise exception 'RC-05 postflight failed: function is not SECURITY DEFINER'; end if;
  if (select proconfig from pg_proc where oid=fn) is distinct from array['search_path=""']
    then raise exception 'RC-05 postflight failed: search_path is not empty'; end if;
  if has_function_privilege('anon',fn,'EXECUTE') or has_function_privilege('authenticated',fn,'EXECUTE')
    then raise exception 'RC-05 postflight failed: client role can execute private trigger function'; end if;
end;
$$;

set local session_replication_role=replica;
insert into public.profiles(id,role,display_name,handle) values
  ('00000000-0000-4000-8000-000000000001','buyer','RC05 Buyer','rc05-buyer'),
  ('00000000-0000-4000-8000-000000000002','seller','RC05 Seller','rc05-seller');
insert into public.sellers(id,owner_id,business_name,slug,location)
values ('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000002','RC05 Seller','rc05-seller','Synthetic local RC-05');
insert into public.parts(id,seller_id,category_id,title,slug,description,condition,price_pence,status)
select '00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000005',id,
  'RC05 synthetic alternator','rc05-synthetic-alternator','Local-only RC-05 fixture','used',1000,'draft'
from public.categories order by sort_order,id limit 1;
insert into public.orders(id,buyer_id,total_pence)
values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001',1000);
insert into public.order_items(id,order_id,part_id,seller_id,quantity,unit_price_pence,fulfilment_status,payout_status)
values ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000006','00000000-0000-4000-8000-000000000005',1,1000,'completed','scheduled');
set local session_replication_role=origin;

update public.order_items
set payout_status='released',funds_released_at=clock_timestamp()
where id='00000000-0000-4000-8000-000000000010';

do $$
declare
  notification_count integer;
  recipient_count integer;
begin
  select count(*),count(distinct profile_id) into notification_count,recipient_count
  from public.notifications where dedupe_key like 'review-ready:00000000-0000-4000-8000-000000000010:%';
  if notification_count<>2 or recipient_count<>2 then
    raise exception 'RC-05 behaviour failed: expected two isolated participant notifications, got %/%',notification_count,recipient_count;
  end if;
  if exists(
    select 1 from public.notifications
    where dedupe_key like 'review-ready:00000000-0000-4000-8000-000000000010:%'
      and (type<>'account' or href<>'/account/reviews' or body not like '%RC05 synthetic alternator%')
  ) then raise exception 'RC-05 behaviour failed: notification payload changed'; end if;
end;
$$;

update public.order_items set payout_status='scheduled' where id='00000000-0000-4000-8000-000000000010';
update public.order_items set payout_status='released' where id='00000000-0000-4000-8000-000000000010';

do $$
begin
  if (select count(*) from public.notifications where dedupe_key like 'review-ready:00000000-0000-4000-8000-000000000010:%')<>2
    then raise exception 'RC-05 dedupe failed'; end if;
end;
$$;

select json_build_object(
  'function_count',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='notify_transaction_review_ready'),
  'trigger_count',(select count(*) from pg_trigger where tgname='transaction_review_ready_notification' and not tgisinternal),
  'notification_count',(select count(*) from public.notifications where dedupe_key like 'review-ready:00000000-0000-4000-8000-000000000010:%'),
  'anon_execute',has_function_privilege('anon','private.notify_transaction_review_ready()','EXECUTE'),
  'authenticated_execute',has_function_privilege('authenticated','private.notify_transaction_review_ready()','EXECUTE')
) as rc05_review_ready_native_result;

rollback;

select json_build_object(
  'function_count',(select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='notify_transaction_review_ready'),
  'trigger_count',(select count(*) from pg_trigger where tgname='transaction_review_ready_notification' and not tgisinternal),
  'fixture_notifications',(select count(*) from public.notifications where dedupe_key like 'review-ready:00000000-0000-4000-8000-000000000010:%')
) as rc05_review_ready_rollback_result;
