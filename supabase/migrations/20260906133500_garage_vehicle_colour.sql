alter table public.garage_vehicles
  add column if not exists colour text;

alter table public.garage_vehicles
  drop constraint if exists garage_vehicles_colour_length;
alter table public.garage_vehicles
  add constraint garage_vehicles_colour_length
  check (colour is null or char_length(colour) <= 40);
