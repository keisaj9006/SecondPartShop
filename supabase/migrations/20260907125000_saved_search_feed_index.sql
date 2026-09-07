create index if not exists saved_searches_profile_created_id_idx
  on public.saved_searches(profile_id,created_at desc,id);
