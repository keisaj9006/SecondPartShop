-- Extend the existing marketplace moderation queue to support direct user reports.

alter table public.marketplace_reports
  add column if not exists reported_profile_id uuid references public.profiles(id) on delete cascade;

alter table public.marketplace_reports
  drop constraint if exists marketplace_reports_check;

alter table public.marketplace_reports
  drop constraint if exists marketplace_reports_target_check;

alter table public.marketplace_reports
  add constraint marketplace_reports_target_check
  check (part_id is not null or seller_id is not null or reported_profile_id is not null);

alter table public.marketplace_reports
  drop constraint if exists marketplace_reports_reason_check;

alter table public.marketplace_reports
  add constraint marketplace_reports_reason_check
  check (reason in (
    'suspected_counterfeit','incorrect_fitment','misleading_description','unsafe_item',
    'seller_conduct','harassment','spam','fraud_scam','other'
  ));

alter table public.marketplace_reports
  drop constraint if exists marketplace_reports_no_self_report;

alter table public.marketplace_reports
  add constraint marketplace_reports_no_self_report
  check (reported_profile_id is null or reporter_id<>reported_profile_id);

create index if not exists marketplace_reports_reported_profile_idx
  on public.marketplace_reports(reported_profile_id,created_at desc);
