-- Consolidate commerce participant RLS without recursive cross-table policies.

create or replace function private.can_read_order(requested_order uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.orders o
    where o.id=requested_order
      and (
        o.buyer_id=(select auth.uid())
        or exists(
          select 1
          from public.order_items oi
          join public.sellers s on s.id=oi.seller_id
          where oi.order_id=o.id
            and s.owner_id=(select auth.uid())
        )
        or private.is_admin()
      )
  );
$$;

create or replace function private.can_read_order_item(requested_item uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.order_items oi
    join public.orders o on o.id=oi.order_id
    join public.sellers s on s.id=oi.seller_id
    where oi.id=requested_item
      and (
        o.buyer_id=(select auth.uid())
        or s.owner_id=(select auth.uid())
        or private.is_admin()
      )
  );
$$;

revoke all on function private.can_read_order(uuid) from public;
revoke all on function private.can_read_order_item(uuid) from public;
grant execute on function private.can_read_order(uuid) to authenticated;
grant execute on function private.can_read_order_item(uuid) to authenticated;

drop policy if exists "orders buyer read" on public.orders;
drop policy if exists "orders seller read" on public.orders;
create policy "orders participant read"
  on public.orders for select
  to authenticated
  using (private.can_read_order(id));

drop policy if exists "order items buyer read" on public.order_items;
drop policy if exists "order items seller read" on public.order_items;
create policy "order items participant read"
  on public.order_items for select
  to authenticated
  using (private.can_read_order_item(id));

drop policy if exists "order events buyer read" on public.order_events;
drop policy if exists "order events seller read" on public.order_events;
create policy "order events participant read"
  on public.order_events for select
  to authenticated
  using (private.can_read_order(order_id));
