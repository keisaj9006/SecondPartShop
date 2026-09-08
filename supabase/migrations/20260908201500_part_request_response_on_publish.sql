create or replace function private.mark_part_request_match_responded()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.source_request_id is null or new.status::text<>'active' then
    return new;
  end if;

  if tg_op='UPDATE'
     and old.status::text='active'
     and old.source_request_id is not distinct from new.source_request_id then
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
after insert or update of status,source_request_id
on public.parts
for each row execute function private.mark_part_request_match_responded();

revoke all on function private.mark_part_request_match_responded() from public;
