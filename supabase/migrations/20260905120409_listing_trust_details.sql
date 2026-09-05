alter table public.parts
  add column if not exists testing_status text not null default 'not_specified',
  add column if not exists warranty_days smallint not null default 0,
  add column if not exists condition_notes text,
  add column if not exists damage_notes text;

alter table public.parts
  drop constraint if exists parts_testing_status_check;
alter table public.parts
  add constraint parts_testing_status_check
  check (testing_status in ('tested_working','removed_from_running_vehicle','visually_inspected','untested','not_specified'));

alter table public.parts
  drop constraint if exists parts_warranty_days_check;
alter table public.parts
  add constraint parts_warranty_days_check
  check (warranty_days between 0 and 730);

alter table public.parts
  drop constraint if exists parts_condition_notes_length_check;
alter table public.parts
  add constraint parts_condition_notes_length_check
  check (condition_notes is null or char_length(condition_notes) <= 500);

alter table public.parts
  drop constraint if exists parts_damage_notes_length_check;
alter table public.parts
  add constraint parts_damage_notes_length_check
  check (damage_notes is null or char_length(damage_notes) <= 500);
