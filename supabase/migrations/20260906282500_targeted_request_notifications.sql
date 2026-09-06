-- Notify only sellers who were actually routed a Find My Part request.

drop trigger if exists notify_sellers_for_part_request_trigger on public.part_requests;

create or replace function private.notify_matched_seller_for_part_request()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  seller_owner uuid;
  request_title text;
  reason_text text;
begin
  select s.owner_id into seller_owner
  from public.sellers s
  where s.id=new.seller_id;

  if seller_owner is null then
    return new;
  end if;

  select left(r.query_text,240) into request_title
  from public.part_requests r
  where r.id=new.request_id and r.status='open';

  if request_title is null then
    return new;
  end if;

  reason_text:=case
    when cardinality(new.match_reasons)>0 then
      'Matched because: '||array_to_string(new.match_reasons,' · ')
    else
      'SecondPart matched this request to your seller inventory.'
  end;

  insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
  values(
    seller_owner,
    'seller_part_request',
    'New matched buyer request',
    left(request_title||' — '||reason_text,500),
    '/dashboard/requests',
    'seller-request:'||new.request_id::text||':seller:'||new.seller_id::text
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists notify_matched_seller_for_part_request_trigger on public.seller_part_request_matches;
create trigger notify_matched_seller_for_part_request_trigger
after insert on public.seller_part_request_matches
for each row execute function private.notify_matched_seller_for_part_request();
