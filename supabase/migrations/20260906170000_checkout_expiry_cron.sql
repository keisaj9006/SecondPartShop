create extension if not exists pg_cron;

create or replace function private.expire_stale_checkout_orders()
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  stale record;
  processed integer := 0;
begin
  for stale in
    select o.id
    from public.orders o
    where o.payment_status in ('unpaid','requires_action','processing')
      and o.checkout_expires_at is not null
      and o.checkout_expires_at<=now()
    order by o.checkout_expires_at
    limit 500
  loop
    if public.cancel_checkout_order(stale.id,null,'checkout_reservation_expired') then
      processed := processed+1;
    end if;
  end loop;
  return processed;
end;
$$;

revoke all on function private.expire_stale_checkout_orders() from public;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname='secondpart-expire-checkouts'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'secondpart-expire-checkouts',
    '*/5 * * * *',
    'select private.expire_stale_checkout_orders();'
  );
end;
$$;
