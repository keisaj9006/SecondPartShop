-- Keep the later migration idempotent with the canonical publish semantics already
-- established by 20260908181500_mark_find_my_part_responded_on_publish.sql.
-- A draft must never consume a seller lead. Active/reserved/sold listings are
-- buyer-visible or transaction-visible responses and may close the open match.

create or replace function private.mark_part_request_match_responded()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.source_request_id is null then
    return new;
  end if;

  if new.status::text not in ('active','reserved','sold') then
    return new;
  end if;

  update public.seller_part_request_matches m
  set
    status='responded',
    responded_part_id=new.id,
    updated_at=now()
  where m.request_id=new.source_request_id
    and m.seller_id=new.seller_id
    and m.status='open';

  return new;
end;
$$;

drop trigger if exists mark_part_request_match_responded_trigger on public.parts;
create trigger mark_part_request_match_responded_trigger
after insert or update of source_request_id,status
on public.parts
for each row execute function private.mark_part_request_match_responded();

revoke all on function private.mark_part_request_match_responded() from public;
