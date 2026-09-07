create table if not exists public.fitting_request_messages (
  id uuid primary key default gen_random_uuid(),
  fitting_request_id uuid not null references public.fitting_requests(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists fitting_request_messages_thread_idx
  on public.fitting_request_messages(fitting_request_id,created_at,id);

alter table public.fitting_request_messages enable row level security;

drop policy if exists "fitting messages participants read" on public.fitting_request_messages;
create policy "fitting messages participants read" on public.fitting_request_messages
for select to authenticated
using (
  exists(
    select 1
    from public.fitting_requests r
    join public.garage_partners g on g.id=r.garage_partner_id
    where r.id=fitting_request_messages.fitting_request_id
      and (
        r.buyer_id=(select auth.uid())
        or g.owner_id=(select auth.uid())
        or private.is_admin()
      )
  )
);

create or replace function public.send_fitting_request_message(
  p_request_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=(select auth.uid());
  request_row record;
  new_id uuid;
  recipient uuid;
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if char_length(btrim(coalesce(p_body,'')))<1 then raise exception 'Message is required.'; end if;

  select r.id,r.status,r.buyer_id,g.owner_id
  into request_row
  from public.fitting_requests r
  join public.garage_partners g on g.id=r.garage_partner_id
  where r.id=p_request_id;

  if request_row.id is null then raise exception 'Fitting request not found.'; end if;
  if actor not in (request_row.buyer_id,request_row.owner_id) and not private.is_admin() then
    raise exception 'Fitting request not found.';
  end if;
  if request_row.status<>'accepted' then
    raise exception 'Messages are available after the fitting quote is accepted.';
  end if;

  insert into public.fitting_request_messages(fitting_request_id,sender_profile_id,body)
  values(p_request_id,actor,left(btrim(p_body),2000))
  returning id into new_id;

  recipient:=case when actor=request_row.buyer_id then request_row.owner_id else request_row.buyer_id end;
  if recipient is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      recipient,
      'fitting_message',
      'New Buy + Fit message',
      left(btrim(p_body),160),
      case when recipient=request_row.buyer_id then '/account/fitting' else '/garage-partner/requests' end,
      'fitting-message:'||new_id::text||':'||recipient::text
    )
    on conflict do nothing;
  end if;

  return new_id;
end;
$$;

revoke all on table public.fitting_request_messages from anon,authenticated;
grant select on table public.fitting_request_messages to authenticated;
grant all on table public.fitting_request_messages to service_role;

revoke all on function public.send_fitting_request_message(uuid,text) from public;
revoke execute on function public.send_fitting_request_message(uuid,text) from anon;
grant execute on function public.send_fitting_request_message(uuid,text) to authenticated;
grant execute on function public.send_fitting_request_message(uuid,text) to service_role;
