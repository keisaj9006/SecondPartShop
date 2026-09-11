do $$
declare
  fn record;
  definition text;
  function_count integer;
  target_count integer;
begin
  select count(*),count(distinct p.proname)
  into function_count,target_count
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in (
      'marketplace_catalogue_cursor_page_v1',
      'marketplace_catalogue_distance_page_v2'
    );

  if function_count<>2 or target_count<>2 then
    raise exception 'Expected exactly two distinct catalogue functions, found % functions across % targets',function_count,target_count;
  end if;

  for fn in
    select p.oid,p.proname
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'marketplace_catalogue_cursor_page_v1',
        'marketplace_catalogue_distance_page_v2'
      )
  loop
    definition:=pg_get_functiondef(fn.oid);
    if position('public.verified_fit_feedback' in definition)=0 then
      raise exception 'Expected verified fit source not found in function %',fn.proname;
    end if;
    execute replace(
      definition,
      'public.verified_fit_feedback',
      'private.valid_verified_fit_feedback'
    );
  end loop;
end;
$$;
