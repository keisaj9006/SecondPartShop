create or replace function public.get_existing_csv_inventory_references(p_references text[])
returns table(source_external_id text)
language sql
stable
security definer
set search_path=''
as $$
  select distinct p.source_external_id
  from public.parts p
  join public.sellers s on s.id=p.seller_id
  where s.owner_id=auth.uid()
    and p.source_channel='csv'
    and p.source_external_id is not null
    and exists(
      select 1
      from unnest(coalesce(p_references,array[]::text[])) ref
      where lower(ref)=lower(p.source_external_id)
    );
$$;

revoke all on function public.get_existing_csv_inventory_references(text[]) from public;
grant execute on function public.get_existing_csv_inventory_references(text[]) to authenticated;
