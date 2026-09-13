-- Keep public part evidence aligned with the marketplace visibility boundary.
-- SECURITY DEFINER RPCs must not expose retained part evidence after the owning
-- seller is privacy-deleted, even if the retained part row is still active.

create or replace function public.get_part_passport_evidence(p_part_id uuid)
returns table(
  donor_make text,
  donor_model text,
  donor_variant text,
  donor_year smallint,
  donor_fuel_type text,
  donor_engine_size_simple integer,
  donor_colour text,
  explicit_fitment_count bigint,
  verified_fit_report_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.make,
    d.model,
    d.variant,
    d.year,
    d.fuel_type,
    d.engine_size_simple,
    d.colour,
    (
      select count(*)
      from public.part_catalogue_fitments f
      where f.part_id=p.id
    ),
    (
      select count(distinct vf.buyer_id)
      from private.valid_verified_fit_feedback vf
      where vf.part_id=p.id
        and vf.result in ('exact_fit','fit_with_modification','did_not_fit')
    )
  from public.parts p
  join public.sellers s on s.id=p.seller_id
  left join public.donor_vehicles d on d.id=p.donor_vehicle_id
  where p.id=p_part_id
    and p.status='active'::public.listing_status
    and s.account_deleted_at is null
  limit 1;
$$;

revoke all on function public.get_part_passport_evidence(uuid) from public;
grant execute on function public.get_part_passport_evidence(uuid) to anon,authenticated;
grant execute on function public.get_part_passport_evidence(uuid) to service_role;

create or replace function public.get_part_verified_fit_summary(
  p_part_id uuid,
  p_variant_id uuid,
  p_year smallint,
  p_fuel text default null,
  p_engine integer default null
)
returns table(
  exact_fit_count integer,
  modified_fit_count integer,
  did_not_fit_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(distinct f.buyer_id) filter(where f.result='exact_fit')::integer,
    count(distinct f.buyer_id) filter(where f.result='fit_with_modification')::integer,
    count(distinct f.buyer_id) filter(where f.result='did_not_fit')::integer
  from private.valid_verified_fit_feedback f
  where f.part_id=p_part_id
    and f.variant_id=p_variant_id
    and f.year=p_year
    and (p_fuel is null or (f.fuel_type is not null and upper(f.fuel_type)=upper(p_fuel)))
    and (p_engine is null or f.engine_size_simple=p_engine)
    and exists(
      select 1
      from public.parts p
      join public.sellers s on s.id=p.seller_id
      where p.id=p_part_id
        and p.status='active'::public.listing_status
        and s.account_deleted_at is null
    );
$$;

revoke all on function public.get_part_verified_fit_summary(uuid,uuid,smallint,text,integer) from public;
grant execute on function public.get_part_verified_fit_summary(uuid,uuid,smallint,text,integer) to anon,authenticated;
grant execute on function public.get_part_verified_fit_summary(uuid,uuid,smallint,text,integer) to service_role;
