create table if not exists private.ai_listing_usage (
  profile_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count>=0),
  updated_at timestamptz not null default now(),
  primary key(profile_id,window_start)
);

create or replace function public.consume_ai_listing_quota()
returns table(allowed boolean,remaining integer,reset_at timestamptz)
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=(select auth.uid());
  current_window timestamptz:=date_trunc('hour',now());
  next_count integer;
  hourly_limit constant integer:=30;
begin
  if actor is null then
    raise exception 'Authentication required.';
  end if;

  if not exists(
    select 1
    from public.sellers s
    where s.owner_id=actor
  ) then
    raise exception 'Seller profile required.';
  end if;

  insert into private.ai_listing_usage(profile_id,window_start,request_count,updated_at)
  values(actor,current_window,1,now())
  on conflict(profile_id,window_start) do update
    set request_count=private.ai_listing_usage.request_count+1,
        updated_at=now()
    where private.ai_listing_usage.request_count<hourly_limit
  returning request_count into next_count;

  if next_count is null then
    select u.request_count into next_count
    from private.ai_listing_usage u
    where u.profile_id=actor and u.window_start=current_window;

    return query
    select false,greatest(0,hourly_limit-coalesce(next_count,hourly_limit)),current_window+interval '1 hour';
    return;
  end if;

  return query
  select true,greatest(0,hourly_limit-next_count),current_window+interval '1 hour';
end;
$$;

revoke all on function public.consume_ai_listing_quota() from public;
revoke execute on function public.consume_ai_listing_quota() from anon;
grant execute on function public.consume_ai_listing_quota() to authenticated;
grant execute on function public.consume_ai_listing_quota() to service_role;
