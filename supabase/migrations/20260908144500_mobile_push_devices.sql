create table if not exists public.mobile_push_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'fcm' check (provider in ('fcm')),
  platform text not null check (platform in ('android','ios')),
  token text not null check (char_length(token) between 20 and 4096),
  app_id text not null check (char_length(app_id) between 3 and 160),
  build_channel text not null default 'preview' check (build_channel in ('preview','release')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider,token)
);

create index if not exists mobile_push_devices_profile_enabled_idx
  on public.mobile_push_devices(profile_id,enabled,last_seen_at desc);

alter table public.mobile_push_devices enable row level security;
revoke all on table public.mobile_push_devices from anon,authenticated;
grant all on table public.mobile_push_devices to service_role;
