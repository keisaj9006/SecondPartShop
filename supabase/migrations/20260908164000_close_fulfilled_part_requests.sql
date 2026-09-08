create or replace function private.close_fulfilled_part_requests()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.payment_status<>'paid' or old.payment_status is not distinct from new.payment_status then
    return new;
  end if;

  update public.part_requests r
  set status='closed',updated_at=now()
  where r.profile_id=new.buyer_id
    and r.status='open'
    and exists(
      select 1
      from public.order_items oi
      join public.parts p on p.id=oi.part_id
      where oi.order_id=new.id
        and p.source_request_id=r.id
    );

  return new;
end;
$$;

drop trigger if exists close_fulfilled_part_requests_trigger on public.orders;
create trigger close_fulfilled_part_requests_trigger
after update of payment_status on public.orders
for each row
execute function private.close_fulfilled_part_requests();
