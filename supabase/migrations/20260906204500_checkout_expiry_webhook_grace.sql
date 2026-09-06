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
      and (
        (o.provider_checkout_session_id is null and o.checkout_expires_at<=now())
        or
        (o.provider_checkout_session_id is not null and o.checkout_expires_at + interval '30 minutes'<=now())
      )
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
