-- Abuse-resistant ingestion for anonymous browser error telemetry.
-- Raw IPs/user agents are never stored; the server hashes a request fingerprint
-- before calling this service-only limiter.

create table if not exists public.ops_client_error_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  event_count integer not null default 0 check (event_count>=0),
  updated_at timestamptz not null default now()
);

alter table public.ops_client_error_rate_limits enable row level security;
revoke all on public.ops_client_error_rate_limits from anon,authenticated;

create or replace function public.consume_ops_client_error_rate_limit(
  p_key_hash text,
  p_limit integer default 12,
  p_window_seconds integer default 600
)
returns table(allowed boolean,remaining integer)
language plpgsql
security definer
set search_path=''
as $$
declare
  row_state record;
  safe_limit integer:=greatest(1,least(coalesce(p_limit,12),100));
  safe_window integer:=greatest(60,least(coalesce(p_window_seconds,600),86400));
begin
  if p_key_hash is null or length(p_key_hash)<16 or length(p_key_hash)>128 then
    raise exception 'Invalid monitoring rate-limit key.';
  end if;

  insert into public.ops_client_error_rate_limits(key_hash,event_count)
  values(p_key_hash,0)
  on conflict(key_hash) do nothing;

  select *
  into row_state
  from public.ops_client_error_rate_limits
  where key_hash=p_key_hash
  for update;

  if row_state.window_started_at<=now()-(safe_window||' seconds')::interval then
    update public.ops_client_error_rate_limits
    set window_started_at=now(),event_count=1,updated_at=now()
    where key_hash=p_key_hash;
    return query select true,greatest(0,safe_limit-1);
    return;
  end if;

  if row_state.event_count>=safe_limit then
    update public.ops_client_error_rate_limits
    set updated_at=now()
    where key_hash=p_key_hash;
    return query select false,0;
    return;
  end if;

  update public.ops_client_error_rate_limits
  set event_count=event_count+1,updated_at=now()
  where key_hash=p_key_hash;

  return query select true,greatest(0,safe_limit-row_state.event_count-1);
end;
$$;

revoke all on function public.consume_ops_client_error_rate_limit(text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.consume_ops_client_error_rate_limit(text,integer,integer) to service_role;

create or replace function public.prune_ops_client_error_rate_limits()
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare removed bigint;
begin
  delete from public.ops_client_error_rate_limits
  where updated_at<now()-interval '7 days';
  get diagnostics removed=row_count;
  return removed;
end;
$$;

revoke all on function public.prune_ops_client_error_rate_limits() from public,anon,authenticated,service_role;
grant execute on function public.prune_ops_client_error_rate_limits() to service_role;
