-- Prevent checkout reservation abuse / accidental duplicate reservations.

create or replace function private.limit_active_checkout_orders()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  active_count integer;
begin
  if new.status<>'pending_payment' or new.payment_status<>'unpaid' then
    return new;
  end if;

  -- Serialize checkout creation per buyer to make the limit race-safe.
  perform pg_advisory_xact_lock(hashtextextended(new.buyer_id::text,0));

  select count(*) into active_count
  from public.orders o
  where o.buyer_id=new.buyer_id
    and o.payment_status in ('unpaid','requires_action','processing')
    and o.status='pending_payment'
    and (o.checkout_expires_at is null or o.checkout_expires_at>now());

  if active_count>=5 then
    raise exception 'You already have too many active checkout reservations.';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_limit_active_checkout_reservations on public.orders;
create trigger orders_limit_active_checkout_reservations
before insert on public.orders
for each row execute function private.limit_active_checkout_orders();

create or replace function private.prevent_duplicate_active_part_reservation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  buyer uuid;
begin
  select o.buyer_id into buyer
  from public.orders o
  where o.id=new.order_id;

  if buyer is null then
    return new;
  end if;

  if exists(
    select 1
    from public.order_items oi
    join public.orders o on o.id=oi.order_id
    where oi.part_id=new.part_id
      and o.buyer_id=buyer
      and o.id<>new.order_id
      and o.status='pending_payment'
      and o.payment_status in ('unpaid','requires_action','processing')
      and (o.checkout_expires_at is null or o.checkout_expires_at>now())
  ) then
    raise exception 'You already have an active checkout reservation for this part.';
  end if;

  return new;
end;
$$;

drop trigger if exists order_items_prevent_duplicate_active_reservation on public.order_items;
create trigger order_items_prevent_duplicate_active_reservation
before insert on public.order_items
for each row execute function private.prevent_duplicate_active_part_reservation();
