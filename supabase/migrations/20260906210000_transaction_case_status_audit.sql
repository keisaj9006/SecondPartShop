create or replace function private.audit_transaction_case_status_change()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  order_value uuid;
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  select oi.order_id into order_value
  from public.order_items oi
  where oi.id=new.order_item_id;

  if order_value is not null then
    insert into public.order_events(
      order_id,order_item_id,actor_profile_id,event_type,from_status,to_status,metadata
    )
    values(
      order_value,
      new.order_item_id,
      auth.uid(),
      'case_status_changed',
      old.status,
      new.status,
      jsonb_build_object(
        'case_id',new.id,
        'case_type',new.case_type,
        'resolution',new.resolution
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists transaction_case_status_audit on public.transaction_cases;
create trigger transaction_case_status_audit
after update of status on public.transaction_cases
for each row
when (old.status is distinct from new.status)
execute function private.audit_transaction_case_status_change();
