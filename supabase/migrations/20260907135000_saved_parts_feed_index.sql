create index if not exists saved_parts_profile_created_id_idx
  on public.saved_parts(profile_id,created_at desc,part_id);
