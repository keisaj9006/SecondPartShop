create or replace function public.admin_review_seller_verification(
  p_request_id uuid,
  p_approve boolean,
  p_review_note text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  target_seller uuid;
begin
  if not private.is_admin() then
    raise exception 'Administrator access required.';
  end if;

  select seller_id into target_seller
  from public.seller_verification_requests
  where id=p_request_id and status='pending'
  for update;

  if target_seller is null then
    raise exception 'Pending verification request not found.';
  end if;

  update public.seller_verification_requests
  set status=case when p_approve then 'approved' else 'rejected' end,
      reviewed_at=now(),
      reviewed_by=(select auth.uid()),
      review_note=nullif(left(coalesce(p_review_note,''),500),'')
  where id=p_request_id;

  if p_approve then
    update public.sellers set verified_at=coalesce(verified_at,now()),updated_at=now() where id=target_seller;
  end if;
end;
$$;

revoke all on function public.admin_review_seller_verification(uuid,boolean,text) from public;
grant execute on function public.admin_review_seller_verification(uuid,boolean,text) to authenticated;

create or replace function public.admin_update_marketplace_report(
  p_report_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access required.';
  end if;
  if p_status not in ('reviewed','dismissed','actioned') then
    raise exception 'Invalid report status.';
  end if;

  update public.marketplace_reports
  set status=p_status,
      reviewed_at=now(),
      reviewed_by=(select auth.uid())
  where id=p_report_id;

  if not found then
    raise exception 'Report not found.';
  end if;
end;
$$;

revoke all on function public.admin_update_marketplace_report(uuid,text) from public;
grant execute on function public.admin_update_marketplace_report(uuid,text) to authenticated;
