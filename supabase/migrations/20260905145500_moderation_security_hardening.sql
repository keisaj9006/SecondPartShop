alter function public.admin_review_seller_verification(uuid,boolean,text) security invoker;
alter function public.admin_update_marketplace_report(uuid,text) security invoker;

revoke execute on function public.admin_review_seller_verification(uuid,boolean,text) from anon;
revoke execute on function public.admin_update_marketplace_report(uuid,text) from anon;

create index if not exists marketplace_reports_reporter_idx on public.marketplace_reports(reporter_id);
create index if not exists marketplace_reports_reviewed_by_idx on public.marketplace_reports(reviewed_by);
create index if not exists seller_verification_requests_requester_idx on public.seller_verification_requests(requester_id);
create index if not exists seller_verification_requests_reviewed_by_idx on public.seller_verification_requests(reviewed_by);
