create or replace function private.guard_garage_partner_system_fields()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if current_user='service_role' or private.is_admin() then
    return new;
  end if;

  if tg_op='INSERT' then
    new.status:='pending';
    new.verified_at:=null;
    new.latitude:=null;
    new.longitude:=null;
  else
    new.status:=old.status;
    new.verified_at:=old.verified_at;
    new.latitude:=old.latitude;
    new.longitude:=old.longitude;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_garage_partner_system_fields_trigger on public.garage_partners;
create trigger guard_garage_partner_system_fields_trigger
before insert or update on public.garage_partners
for each row
execute function private.guard_garage_partner_system_fields();

create or replace function public.find_garage_partners_nearby(
  p_lat double precision,
  p_lon double precision,
  p_query text default null,
  p_limit integer default 40,
  p_offset integer default 0
)
returns table(
  id uuid,
  business_name text,
  slug text,
  location text,
  postcode text,
  description text,
  mobile_fitting boolean,
  verified_at timestamptz,
  distance_miles numeric
)
language sql
stable
security invoker
set search_path=''
as $$
  with candidates as (
    select
      g.id,
      g.business_name,
      g.slug,
      g.location,
      g.postcode,
      g.description,
      g.mobile_fitting,
      g.verified_at,
      3958.7613*2*asin(
        sqrt(
          power(sin(radians(g.latitude-p_lat)/2),2)
          +cos(radians(p_lat))*cos(radians(g.latitude))
          *power(sin(radians(g.longitude-p_lon)/2),2)
        )
      ) as distance_value
    from public.garage_partners g
    where g.status='active'
      and g.customer_supplied_parts=true
      and g.recycled_parts=true
      and g.latitude is not null
      and g.longitude is not null
      and (
        nullif(btrim(coalesce(p_query,'')),'') is null
        or g.business_name ilike '%'||btrim(p_query)||'%'
        or g.location ilike '%'||btrim(p_query)||'%'
        or g.postcode ilike '%'||replace(upper(btrim(p_query)),' ','')||'%'
      )
  )
  select
    c.id,c.business_name,c.slug,c.location,c.postcode,c.description,c.mobile_fitting,c.verified_at,
    round(c.distance_value::numeric,1) as distance_miles
  from candidates c
  order by c.distance_value asc,c.verified_at desc nulls last,c.business_name,c.id
  limit greatest(1,least(coalesce(p_limit,40),60))+1
  offset greatest(0,coalesce(p_offset,0));
$$;

revoke all on function public.find_garage_partners_nearby(double precision,double precision,text,integer,integer) from public;
grant execute on function public.find_garage_partners_nearby(double precision,double precision,text,integer,integer) to anon,authenticated;
