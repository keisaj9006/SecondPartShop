-- Public seller data boundary.
-- Keep general marketplace identity readable while preventing postcode/geocoding
-- fields from being fetched directly through PostgREST by anon/authenticated roles.

revoke select on table public.sellers from anon, authenticated;

grant select (
  id,
  owner_id,
  business_name,
  slug,
  location,
  description,
  verified_at,
  seller_type,
  business_kind
) on table public.sellers to anon, authenticated;

create or replace function public.get_own_seller_profile_private()
returns table(
  id uuid,
  owner_id uuid,
  business_name text,
  slug text,
  location text,
  postcode text,
  description text,
  verified_at timestamptz,
  seller_type text,
  business_kind text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    s.id,
    s.owner_id,
    s.business_name,
    s.slug,
    s.location,
    s.postcode,
    s.description,
    s.verified_at,
    s.seller_type,
    s.business_kind
  from public.sellers s
  where s.owner_id=(select auth.uid())
    and s.account_deleted_at is null
  limit 1;
$$;

revoke all on function public.get_own_seller_profile_private() from public;
revoke all on function public.get_own_seller_profile_private() from anon;
grant execute on function public.get_own_seller_profile_private() to authenticated;
