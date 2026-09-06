-- Least-privilege table grants for user-facing and catalogue tables.

-- Private account/user workflow tables.
revoke all on table public.account_deletion_requests from anon,authenticated;
grant select,insert,update on table public.account_deletion_requests to authenticated;

revoke all on table public.donor_vehicles from anon,authenticated;
grant select,insert,update,delete on table public.donor_vehicles to authenticated;

revoke all on table public.garage_vehicles from anon,authenticated;
grant select,insert,update,delete on table public.garage_vehicles to authenticated;

revoke all on table public.marketplace_reports from anon,authenticated;
grant select,insert on table public.marketplace_reports to authenticated;

revoke all on table public.notifications from anon,authenticated;
grant select,update on table public.notifications to authenticated;

revoke all on table public.part_requests from anon,authenticated;
grant select,insert,update,delete on table public.part_requests to authenticated;

revoke all on table public.recently_viewed_parts from anon,authenticated;
grant select,insert,update,delete on table public.recently_viewed_parts to authenticated;

revoke all on table public.saved_searches from anon,authenticated;
grant select,insert,delete on table public.saved_searches to authenticated;

revoke all on table public.seller_verification_requests from anon,authenticated;
grant select,insert on table public.seller_verification_requests to authenticated;

revoke all on table public.support_requests from anon,authenticated;
grant select,insert,update on table public.support_requests to authenticated;

-- Public reputation is read-only; all writes go through guarded RPCs.
revoke all on table public.transaction_reviews from anon,authenticated;
grant select on table public.transaction_reviews to anon,authenticated;

-- Public marketplace reference/catalogue data is read-only to clients.
revoke all on table public.marketplace_search_synonyms from anon,authenticated;
grant select on table public.marketplace_search_synonyms to anon,authenticated;

revoke all on table public.categories from anon,authenticated;
grant select on table public.categories to anon,authenticated;

revoke all on table public.vehicle_catalogue_engines from anon,authenticated;
grant select on table public.vehicle_catalogue_engines to anon,authenticated;

revoke all on table public.vehicle_catalogue_make_aliases from anon,authenticated;
grant select on table public.vehicle_catalogue_make_aliases to anon,authenticated;

revoke all on table public.vehicle_catalogue_variants from anon,authenticated;
grant select on table public.vehicle_catalogue_variants to anon,authenticated;

revoke all on table public.vehicle_catalogue_years from anon,authenticated;
grant select on table public.vehicle_catalogue_years to anon,authenticated;

revoke all on table public.vehicle_transmissions from anon,authenticated;
grant select on table public.vehicle_transmissions to anon,authenticated;

revoke all on table public.vehicles from anon,authenticated;
grant select on table public.vehicles to anon,authenticated;

revoke all on table public.vehicle_catalogue_imports from anon,authenticated;

-- Seller-managed marketplace entities keep only their CRUD surface.
revoke all on table public.part_catalogue_fitments from anon,authenticated;
grant select on table public.part_catalogue_fitments to anon;
grant select,insert,update,delete on table public.part_catalogue_fitments to authenticated;

revoke all on table public.part_fitments from anon,authenticated;
grant select on table public.part_fitments to anon;
grant select,insert,update,delete on table public.part_fitments to authenticated;

revoke all on table public.part_images from anon,authenticated;
grant select on table public.part_images to anon;
grant select,insert,update,delete on table public.part_images to authenticated;

revoke all on table public.parts from anon,authenticated;
grant select on table public.parts to anon;
grant select,insert,update,delete on table public.parts to authenticated;

revoke all on table public.sellers from anon,authenticated;
grant select on table public.sellers to anon;
grant select,insert,update on table public.sellers to authenticated;
