-- Public, privacy-safe Part Passport evidence.
-- Donor registration and seller-private donor notes are intentionally excluded.
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
set search_path=''
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
      from public.verified_fit_feedback vf
      where vf.part_id=p.id
        and vf.result in ('exact_fit','fit_with_modification','did_not_fit')
    )
  from public.parts p
  left join public.donor_vehicles d on d.id=p.donor_vehicle_id
  where p.id=p_part_id
    and p.status='active'::public.listing_status
  limit 1;
$$;

revoke all on function public.get_part_passport_evidence(uuid) from public;
grant execute on function public.get_part_passport_evidence(uuid) to anon,authenticated;
