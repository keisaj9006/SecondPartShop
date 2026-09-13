alter table public.support_requests
  drop constraint if exists support_requests_status_check;

alter table public.support_requests
  add constraint support_requests_status_check
  check (status in ('open','in_progress','resolved','closed'));

create table if not exists public.support_request_messages (
  id uuid primary key default gen_random_uuid(),
  support_request_id uuid not null references public.support_requests(id) on delete cascade,
  sender_profile_id uuid references public.profiles(id) on delete set null,
  sender_role text not null check (sender_role in ('user','admin')),
  message text not null check (char_length(btrim(message)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists support_request_messages_thread_idx
  on public.support_request_messages(support_request_id,created_at,id);

alter table public.support_request_messages enable row level security;

drop policy if exists "support request messages participant read" on public.support_request_messages;
create policy "support request messages participant read"
  on public.support_request_messages for select
  to authenticated
  using (
    exists (
      select 1
      from public.support_requests request
      where request.id=support_request_id
        and (request.profile_id=(select auth.uid()) or private.is_admin())
    )
  );

revoke all on public.support_request_messages from anon;
revoke all on public.support_request_messages from authenticated;
grant select on public.support_request_messages to authenticated;

create table if not exists public.support_request_internal_notes (
  id uuid primary key default gen_random_uuid(),
  support_request_id uuid not null references public.support_requests(id) on delete cascade,
  admin_profile_id uuid references public.profiles(id) on delete set null,
  note text not null check (char_length(btrim(note)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists support_request_internal_notes_thread_idx
  on public.support_request_internal_notes(support_request_id,created_at,id);

alter table public.support_request_internal_notes enable row level security;

drop policy if exists "support request internal notes admin read" on public.support_request_internal_notes;
create policy "support request internal notes admin read"
  on public.support_request_internal_notes for select
  to authenticated
  using (private.is_admin());

revoke all on public.support_request_internal_notes from anon;
revoke all on public.support_request_internal_notes from authenticated;
grant select on public.support_request_internal_notes to authenticated;

create or replace function public.reply_to_support_request(
  p_support_request_id uuid,
  p_message text
)
returns table(message_id uuid,request_status text,created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.support_requests%rowtype;
  v_message text:=btrim(coalesce(p_message,''));
  v_message_id uuid;
  v_created_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if char_length(v_message) < 1 or char_length(v_message) > 2000 then
    raise exception 'Support reply must be between 1 and 2000 characters';
  end if;

  select * into v_request
  from public.support_requests
  where id=p_support_request_id
    and profile_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Support request not found';
  end if;
  if v_request.status = 'closed' then
    raise exception 'Support request is closed and cannot reply';
  end if;

  insert into public.support_request_messages(support_request_id,sender_profile_id,sender_role,message)
  values(v_request.id,(select auth.uid()),'user',v_message)
  returning id,public.support_request_messages.created_at into v_message_id,v_created_at;

  if v_request.status = 'resolved' then
    update public.support_requests
    set status = 'open',updated_at=now()
    where id=v_request.id;
    v_request.status:='open';
  else
    update public.support_requests
    set updated_at=now()
    where id=v_request.id;
  end if;

  return query select v_message_id,v_request.status,v_created_at;
end;
$$;

revoke all on function public.reply_to_support_request(uuid,text) from public;
revoke all on function public.reply_to_support_request(uuid,text) from anon;
revoke all on function public.reply_to_support_request(uuid,text) from authenticated;
grant execute on function public.reply_to_support_request(uuid,text) to authenticated;

create or replace function public.admin_reply_to_support_request(
  p_support_request_id uuid,
  p_message text,
  p_next_status text default null
)
returns table(message_id uuid,request_status text,created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.support_requests%rowtype;
  v_message text:=btrim(coalesce(p_message,''));
  v_status text;
  v_message_id uuid;
  v_created_at timestamptz;
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;
  if char_length(v_message) < 1 or char_length(v_message) > 2000 then
    raise exception 'Support reply must be between 1 and 2000 characters';
  end if;

  select * into v_request
  from public.support_requests
  where id=p_support_request_id
  for update;

  if not found then
    raise exception 'Support request not found';
  end if;
  if v_request.status = 'closed' then
    raise exception 'Closed support request cannot receive replies';
  end if;
  if p_next_status is not null and p_next_status not in ('in_progress','resolved') then
    raise exception 'Invalid support reply status';
  end if;

  v_status:=coalesce(p_next_status,v_request.status);
  insert into public.support_request_messages(support_request_id,sender_profile_id,sender_role,message)
  values(v_request.id,(select auth.uid()),'admin',v_message)
  returning id,public.support_request_messages.created_at into v_message_id,v_created_at;

  update public.support_requests
  set status=v_status,updated_at=now()
  where id=v_request.id;

  return query select v_message_id,v_status,v_created_at;
end;
$$;

revoke all on function public.admin_reply_to_support_request(uuid,text,text) from public;
revoke all on function public.admin_reply_to_support_request(uuid,text,text) from anon;
revoke all on function public.admin_reply_to_support_request(uuid,text,text) from authenticated;
grant execute on function public.admin_reply_to_support_request(uuid,text,text) to authenticated;

create or replace function public.admin_update_support_request_status(
  p_support_request_id uuid,
  p_status text
)
returns table(request_status text,updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.support_requests%rowtype;
  v_updated_at timestamptz;
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_status not in ('in_progress','resolved','closed') then
    raise exception 'Invalid support request status';
  end if;

  select * into v_request
  from public.support_requests
  where id=p_support_request_id
  for update;

  if not found then
    raise exception 'Support request not found';
  end if;
  if v_request.status='closed' and p_status<>'closed' then
    raise exception 'Closed support request is final';
  end if;

  update public.support_requests
  set status=p_status,updated_at=now()
  where id=v_request.id
  returning public.support_requests.updated_at into v_updated_at;

  return query select p_status,v_updated_at;
end;
$$;

revoke all on function public.admin_update_support_request_status(uuid,text) from public;
revoke all on function public.admin_update_support_request_status(uuid,text) from anon;
revoke all on function public.admin_update_support_request_status(uuid,text) from authenticated;
grant execute on function public.admin_update_support_request_status(uuid,text) to authenticated;

create or replace function public.admin_add_support_request_note(
  p_support_request_id uuid,
  p_note text
)
returns table(note_id uuid,created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text:=btrim(coalesce(p_note,''));
  v_note_id uuid;
  v_created_at timestamptz;
begin
  if not private.is_admin() then
    raise exception 'Admin access required';
  end if;
  if char_length(v_note) < 1 or char_length(v_note) > 2000 then
    raise exception 'Admin note must be between 1 and 2000 characters';
  end if;
  if not exists(select 1 from public.support_requests where id=p_support_request_id) then
    raise exception 'Support request not found';
  end if;

  insert into public.support_request_internal_notes(support_request_id,admin_profile_id,note)
  values(p_support_request_id,(select auth.uid()),v_note)
  returning id,public.support_request_internal_notes.created_at into v_note_id,v_created_at;

  return query select v_note_id,v_created_at;
end;
$$;

revoke all on function public.admin_add_support_request_note(uuid,text) from public;
revoke all on function public.admin_add_support_request_note(uuid,text) from anon;
revoke all on function public.admin_add_support_request_note(uuid,text) from authenticated;
grant execute on function public.admin_add_support_request_note(uuid,text) to authenticated;