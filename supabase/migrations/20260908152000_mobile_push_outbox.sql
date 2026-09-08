create table if not exists public.mobile_push_outbox (
  id bigint generated always as identity primary key,
  notification_id uuid not null references public.notifications(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.mobile_push_devices(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts smallint not null default 0 check (attempts between 0 and 10),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(notification_id,device_id)
);

create index if not exists mobile_push_outbox_ready_idx
  on public.mobile_push_outbox(next_attempt_at,id)
  where status in ('pending','failed');

alter table public.mobile_push_outbox enable row level security;
revoke all on table public.mobile_push_outbox from anon,authenticated;
grant all on table public.mobile_push_outbox to service_role;

create or replace function private.enqueue_mobile_push()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.mobile_push_outbox(notification_id,profile_id,device_id)
  select new.id,new.profile_id,d.id
  from public.mobile_push_devices d
  where d.profile_id=new.profile_id
    and d.enabled
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists enqueue_mobile_push_trigger on public.notifications;
create trigger enqueue_mobile_push_trigger
after insert on public.notifications
for each row execute function private.enqueue_mobile_push();

create or replace function public.claim_mobile_push_outbox(p_limit integer default 20)
returns setof public.mobile_push_outbox
language plpgsql
security definer
set search_path=''
as $$
begin
  return query
  with picked as (
    select o.id
    from public.mobile_push_outbox o
    where o.status in ('pending','failed')
      and o.next_attempt_at<=now()
      and o.attempts<5
    order by o.next_attempt_at,o.id
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,20),100))
  )
  update public.mobile_push_outbox o
  set status='processing',
      attempts=o.attempts+1,
      updated_at=now()
  from picked
  where o.id=picked.id
  returning o.*;
end;
$$;

revoke all on function public.claim_mobile_push_outbox(integer) from public,anon,authenticated;
grant execute on function public.claim_mobile_push_outbox(integer) to service_role;
