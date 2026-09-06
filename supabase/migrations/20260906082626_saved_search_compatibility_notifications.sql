create or replace function private.notify_saved_search_matches()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  saved record;
  q text;
  category_filter uuid;
  condition_filter text;
  min_price integer;
  max_price integer;
  collection_filter boolean;
  legacy_vehicle_filter uuid;
  variant_filter uuid;
  year_filter smallint;
  fuel_filter text;
  engine_filter integer;
  matches boolean;
begin
  if new.status<>'active' then return new; end if;
  if tg_op='UPDATE' and old.status='active' then return new; end if;

  for saved in
    select id,profile_id,name,search_params
    from public.saved_searches
  loop
    matches:=true;
    q:=nullif(saved.search_params->>'q','');
    condition_filter:=nullif(saved.search_params->>'condition','');
    collection_filter:=coalesce(saved.search_params->>'collection','')='1';

    begin category_filter:=nullif(saved.search_params->>'category','')::uuid; exception when others then category_filter:=null; end;
    begin min_price:=round((nullif(saved.search_params->>'min',''))::numeric*100)::integer; exception when others then min_price:=null; end;
    begin max_price:=round((nullif(saved.search_params->>'max',''))::numeric*100)::integer; exception when others then max_price:=null; end;
    begin legacy_vehicle_filter:=nullif(saved.search_params->>'vehicle','')::uuid; exception when others then legacy_vehicle_filter:=null; end;
    begin variant_filter:=nullif(saved.search_params->>'cv','')::uuid; exception when others then variant_filter:=null; end;
    begin year_filter:=nullif(saved.search_params->>'cy','')::smallint; exception when others then year_filter:=null; end;
    fuel_filter:=nullif(saved.search_params->>'cf','');
    begin engine_filter:=nullif(saved.search_params->>'ce','')::integer; exception when others then engine_filter:=null; end;

    if q is not null and not exists (
      select 1 from public.marketplace_search_part_ids(q) r where r.part_id=new.id
    ) then matches:=false; end if;

    if matches and category_filter is not null and not exists (
      select 1 from public.category_descendant_ids(category_filter) c where c.id=new.category_id
    ) then matches:=false; end if;

    if matches and condition_filter is not null and new.condition::text<>condition_filter then matches:=false; end if;
    if matches and min_price is not null and new.price_pence<min_price then matches:=false; end if;
    if matches and max_price is not null and new.price_pence>max_price then matches:=false; end if;
    if matches and collection_filter and not new.collection_available then matches:=false; end if;

    if matches and legacy_vehicle_filter is not null and not exists (
      select 1
      from public.marketplace_legacy_vehicle_compatibility(legacy_vehicle_filter,new.id)
    ) then matches:=false; end if;

    if matches and variant_filter is not null then
      if year_filter is null or not exists (
        select 1
        from public.marketplace_catalogue_compatibility(
          variant_filter,
          year_filter,
          fuel_filter,
          engine_filter,
          new.id
        )
      ) then
        matches:=false;
      end if;
    end if;

    if matches then
      insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
      values(
        saved.profile_id,
        'saved_search_match',
        'New match for '||left(saved.name,80),
        left(new.title,240),
        '/parts/'||new.slug,
        'saved-search:'||saved.id::text||':part:'||new.id::text
      )
      on conflict do nothing;
    end if;
  end loop;
  return new;
end;
$$;
