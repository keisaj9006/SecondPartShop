alter table public.parts
  add column if not exists collection_available boolean not null default false,
  add column if not exists delivery_days_min smallint,
  add column if not exists delivery_days_max smallint;

alter table public.parts
  drop constraint if exists parts_delivery_days_range_check;
alter table public.parts
  add constraint parts_delivery_days_range_check
  check (
    (delivery_days_min is null and delivery_days_max is null)
    or (
      delivery_days_min between 0 and 30
      and delivery_days_max between 0 and 30
      and delivery_days_min <= delivery_days_max
    )
  );
