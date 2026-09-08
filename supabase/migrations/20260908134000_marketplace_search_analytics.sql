create table if not exists public.marketplace_search_events (
  id bigint generated always as identity primary key,
  source text not null check (source in ('web','mobile')),
  query_text text not null check (char_length(query_text) between 2 and 160),
  result_count integer not null check (result_count>=0),
  has_results boolean not null,
  vehicle_context boolean not null default false,
  compatible_only boolean not null default false,
  category_id uuid references public.categories(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists marketplace_search_events_created_idx
  on public.marketplace_search_events(created_at desc);

create index if not exists marketplace_search_events_zero_results_idx
  on public.marketplace_search_events(created_at desc,query_text)
  where not has_results;

create index if not exists marketplace_search_events_query_idx
  on public.marketplace_search_events(lower(query_text),created_at desc);

alter table public.marketplace_search_events enable row level security;
revoke all on table public.marketplace_search_events from anon,authenticated;
grant all on table public.marketplace_search_events to service_role;
