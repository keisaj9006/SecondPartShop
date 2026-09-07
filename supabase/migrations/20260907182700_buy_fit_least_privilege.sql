revoke all on table public.fitting_requests from anon,authenticated;
grant select on table public.fitting_requests to authenticated;

revoke all on table public.garage_partners from anon,authenticated;
grant select on table public.garage_partners to anon,authenticated;
grant insert,update on table public.garage_partners to authenticated;

grant all on table public.fitting_requests to service_role;
grant all on table public.garage_partners to service_role;
