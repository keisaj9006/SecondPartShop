alter table public.commerce_settings
  drop constraint if exists commerce_settings_checkout_reservation_minutes_check;

alter table public.commerce_settings
  add constraint commerce_settings_checkout_reservation_minutes_check
  check (checkout_reservation_minutes between 30 and 1440);

update public.commerce_settings
set checkout_reservation_minutes=greatest(checkout_reservation_minutes,30)
where singleton=true;
