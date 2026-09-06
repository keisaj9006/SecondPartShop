create or replace function public.admin_prepare_transaction_case_refund(
  p_case_id uuid,
  p_notes text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
begin
  if actor is null or not private.is_admin() then raise exception 'Administrator access required.'; end if;

  update public.transaction_cases
  set
    status='under_review',
    resolution_notes=nullif(left(btrim(coalesce(p_notes,'')),2000),''),
    resolved_by=actor
  where id=p_case_id
    and status in ('open','seller_response','under_review');

  if not found then raise exception 'Case is not available for refund review.'; end if;
  return true;
end;
$$;

revoke all on function public.admin_prepare_transaction_case_refund(uuid,text) from public;
grant execute on function public.admin_prepare_transaction_case_refund(uuid,text) to authenticated;
