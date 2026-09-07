create table if not exists public.vehicle_lookup_cache (
  lookup_hash text primary key check (lookup_hash ~ '^[a-f0-9]{64}$'),
  provider text not null,
  result_status text not null check (result_status in ('found','not_found')),
  vehicle jsonb,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.vehicle_lookup_cache enable row level security;
revoke all on table public.vehicle_lookup_cache from public,anon,authenticated;
grant select,insert,update,delete on table public.vehicle_lookup_cache to service_role;

create index if not exists vehicle_lookup_cache_expiry_idx
  on public.vehicle_lookup_cache(expires_at);

create table if not exists public.vehicle_lookup_rate_limits (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.vehicle_lookup_rate_limits enable row level security;
revoke all on table public.vehicle_lookup_rate_limits from public,anon,authenticated;
grant select,insert,update,delete on table public.vehicle_lookup_rate_limits to service_role;

create or replace function public.consume_vehicle_lookup_rate_limit(
  p_key_hash text,
  p_limit integer default 30,
  p_window_seconds integer default 600
)
returns table(
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path=''
as $$
declare
  row_state public.vehicle_lookup_rate_limits%rowtype;
  safe_limit integer:=greatest(1,least(coalesce(p_limit,30),300));
  safe_window integer:=greatest(60,least(coalesce(p_window_seconds,600),86400));
  reset_needed boolean;
  elapsed_seconds integer;
begin
  if p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid rate-limit key.';
  end if;

  insert into public.vehicle_lookup_rate_limits(key_hash,window_started_at,request_count,updated_at)
  values(p_key_hash,now(),1,now())
  on conflict(key_hash) do update
  set
    window_started_at=case
      when public.vehicle_lookup_rate_limits.window_started_at <= now()-make_interval(secs=>safe_window)
        then now()
      else public.vehicle_lookup_rate_limits.window_started_at
    end,
    request_count=case
      when public.vehicle_lookup_rate_limits.window_started_at <= now()-make_interval(secs=>safe_window)
        then 1
      else public.vehicle_lookup_rate_limits.request_count+1
    end,
    updated_at=now()
  returning * into row_state;

  elapsed_seconds:=greatest(0,extract(epoch from (now()-row_state.window_started_at))::integer);

  return query select
    row_state.request_count<=safe_limit,
    greatest(0,safe_limit-row_state.request_count),
    case
      when row_state.request_count<=safe_limit then 0
      else greatest(1,safe_window-elapsed_seconds)
    end;
end;
$$;

revoke all on function public.consume_vehicle_lookup_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_vehicle_lookup_rate_limit(text,integer,integer) to service_role;

create or replace function private.cleanup_vehicle_lookup_state()
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  delete from public.vehicle_lookup_cache
  where expires_at < now()-interval '1 day';

  delete from public.vehicle_lookup_rate_limits
  where updated_at < now()-interval '2 hours';
end;
$$;

revoke all on function private.cleanup_vehicle_lookup_state() from public;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname='secondpart-cleanup-vehicle-lookup'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end
$$;

select cron.schedule(
  'secondpart-cleanup-vehicle-lookup',
  '17 * * * *',
  'select private.cleanup_vehicle_lookup_state();'
);
