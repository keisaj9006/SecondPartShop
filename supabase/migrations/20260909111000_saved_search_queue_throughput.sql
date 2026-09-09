-- Increase asynchronous saved-search matching throughput for large seller imports.
-- Publication remains decoupled: active listings enqueue work and return immediately.

create index if not exists saved_search_match_queue_enqueued_idx
  on private.saved_search_match_queue(enqueued_at,part_id);

create or replace function private.process_saved_search_match_queue(p_limit integer default 250)
returns table(processed integer,notifications_created integer)
language plpgsql
security definer
set search_path=''
as $$
declare
  item record;
  processed_count integer:=0;
  notification_count integer:=0;
  created integer;
begin
  for item in
    select q.part_id
    from private.saved_search_match_queue q
    order by q.enqueued_at,q.part_id
    for update skip locked
    limit greatest(1,least(coalesce(p_limit,250),500))
  loop
    delete from private.saved_search_match_queue
    where part_id=item.part_id;

    created:=private.notify_saved_search_matches_for_part(item.part_id);
    processed_count:=processed_count+1;
    notification_count:=notification_count+coalesce(created,0);
  end loop;

  return query select processed_count,notification_count;
end;
$$;

revoke all on function private.process_saved_search_match_queue(integer) from public,anon,authenticated;

create or replace function private.saved_search_match_queue_stats()
returns table(
  queued bigint,
  oldest_enqueued_at timestamptz,
  oldest_wait_seconds bigint
)
language sql
stable
security definer
set search_path=''
as $$
 select
  count(*)::bigint,
  min(q.enqueued_at),
  case
   when min(q.enqueued_at) is null then 0
   else floor(extract(epoch from (now()-min(q.enqueued_at))))::bigint
  end
 from private.saved_search_match_queue q;
$$;

revoke all on function private.saved_search_match_queue_stats() from public,anon,authenticated;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname='secondpart-match-saved-searches'
  limit 1;

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end
$$;

select cron.schedule(
  'secondpart-match-saved-searches',
  '* * * * *',
  'select * from private.process_saved_search_match_queue(250);'
);
