create index if not exists mobile_push_outbox_processing_lease_idx
  on public.mobile_push_outbox(updated_at,id)
  where status='processing';

create or replace function public.claim_mobile_push_outbox(p_limit integer default 20)
returns setof public.mobile_push_outbox
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.mobile_push_outbox
  set status='failed',
      next_attempt_at=now(),
      last_error='processing_lease_expired',
      updated_at=now()
  where status='processing'
    and updated_at<now()-interval '5 minutes';

  return query
  with picked as (
    select o.id
    from public.mobile_push_outbox o
    where o.status in ('pending','failed')
      and o.next_attempt_at<=now()
      and o.attempts<5
    order by o.next_attempt_at,o.id
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,20),100))
  )
  update public.mobile_push_outbox o
  set status='processing',
      attempts=o.attempts+1,
      updated_at=now()
  from picked
  where o.id=picked.id
  returning o.*;
end;
$$;

revoke all on function public.claim_mobile_push_outbox(integer) from public,anon,authenticated;
grant execute on function public.claim_mobile_push_outbox(integer) to service_role;
