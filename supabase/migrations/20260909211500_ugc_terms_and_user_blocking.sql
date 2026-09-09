-- Google Play UGC compliance baseline: auditable Terms acceptance and user blocking.

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists terms_version text,
  add column if not exists privacy_acknowledged_at timestamptz;

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id,blocked_profile_id),
  check (blocker_id<>blocked_profile_id)
);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks(blocked_profile_id,blocker_id);

alter table public.user_blocks enable row level security;

drop policy if exists "user blocks own read" on public.user_blocks;
create policy "user blocks own read"
  on public.user_blocks for select
  to authenticated
  using (blocker_id=(select auth.uid()));

drop policy if exists "user blocks own insert" on public.user_blocks;
create policy "user blocks own insert"
  on public.user_blocks for insert
  to authenticated
  with check (blocker_id=(select auth.uid()));

drop policy if exists "user blocks own delete" on public.user_blocks;
create policy "user blocks own delete"
  on public.user_blocks for delete
  to authenticated
  using (blocker_id=(select auth.uid()));

revoke all on public.user_blocks from anon,authenticated;
grant select,insert,delete on public.user_blocks to authenticated;

create or replace function private.has_current_marketplace_terms(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1 from public.profiles p
    where p.id=p_profile_id
      and p.terms_accepted_at is not null
      and p.privacy_acknowledged_at is not null
      and p.terms_version='2026-09-09'
  );
$$;

revoke all on function private.has_current_marketplace_terms(uuid) from public;

create or replace function private.marketplace_users_blocked(p_a uuid,p_b uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1 from public.user_blocks b
    where (b.blocker_id=p_a and b.blocked_profile_id=p_b)
       or (b.blocker_id=p_b and b.blocked_profile_id=p_a)
  );
$$;

revoke all on function private.marketplace_users_blocked(uuid,uuid) from public;

create or replace function public.accept_current_marketplace_terms()
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  update public.profiles
  set terms_accepted_at=now(),
      privacy_acknowledged_at=now(),
      terms_version='2026-09-09'
  where id=actor;
  if not found then raise exception 'Profile not found.'; end if;
  return true;
end;
$$;

revoke all on function public.accept_current_marketplace_terms() from public,anon;
grant execute on function public.accept_current_marketplace_terms() to authenticated;

create or replace function public.block_marketplace_user(p_blocked_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if p_blocked_profile_id is null or p_blocked_profile_id=actor then raise exception 'Invalid account.'; end if;
  if not exists(select 1 from public.profiles where id=p_blocked_profile_id) then raise exception 'Account not found.'; end if;

  insert into public.user_blocks(blocker_id,blocked_profile_id)
  values(actor,p_blocked_profile_id)
  on conflict do nothing;

  update public.listing_conversations c
  set status='closed',updated_at=now()
  from public.sellers s
  where s.id=c.seller_id
    and (
      (c.buyer_id=actor and s.owner_id=p_blocked_profile_id)
      or (c.buyer_id=p_blocked_profile_id and s.owner_id=actor)
    );

  return true;
end;
$$;

revoke all on function public.block_marketplace_user(uuid) from public,anon;
grant execute on function public.block_marketplace_user(uuid) to authenticated;

create or replace function public.unblock_marketplace_user(p_blocked_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  delete from public.user_blocks
  where blocker_id=actor and blocked_profile_id=p_blocked_profile_id;
  return true;
end;
$$;

revoke all on function public.unblock_marketplace_user(uuid) from public,anon;
grant execute on function public.unblock_marketplace_user(uuid) to authenticated;

create or replace function public.is_marketplace_user_blocked(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select case
    when auth.uid() is null then false
    else exists(
      select 1 from public.user_blocks
      where blocker_id=auth.uid() and blocked_profile_id=p_profile_id
    )
  end;
$$;

revoke all on function public.is_marketplace_user_blocked(uuid) from public,anon;
grant execute on function public.is_marketplace_user_blocked(uuid) to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  requested_role public.user_role;
  requested_name text;
  accepted boolean;
begin
  requested_role := case
    when new.raw_user_meta_data ->> 'role' = 'seller' then 'seller'::public.user_role
    else 'buyer'::public.user_role
  end;

  requested_name := coalesce(
    nullif(pg_catalog.btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(pg_catalog.split_part(new.email, '@', 1), ''),
    'SecondPart member'
  );

  if pg_catalog.char_length(requested_name) not between 2 and 100 then
    requested_name := 'SecondPart member';
  end if;

  accepted :=
    coalesce(new.raw_user_meta_data ->> 'terms_accepted','')='true'
    and coalesce(new.raw_user_meta_data ->> 'terms_version','')='2026-09-09';

  insert into public.profiles(
    id,role,display_name,terms_accepted_at,terms_version,privacy_acknowledged_at
  )
  values(
    new.id,
    requested_role,
    requested_name,
    case when accepted then now() else null end,
    case when accepted then '2026-09-09' else null end,
    case when accepted then now() else null end
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public;

create or replace function public.start_listing_conversation(
  p_part_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  listing record;
  conversation_id uuid;
  message_count_hour integer;
  conversations_day integer;
  message_id uuid;
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if not private.has_current_marketplace_terms(actor) then raise exception 'Accept current Terms before messaging.'; end if;
  if char_length(btrim(coalesce(p_body,'')))<2 then raise exception 'Message is too short.'; end if;

  select p.id,p.seller_id,p.status,p.title,s.owner_id
  into listing
  from public.parts p
  join public.sellers s on s.id=p.seller_id
  where p.id=p_part_id;

  if listing.id is null or listing.status::text<>'active' then raise exception 'Listing is unavailable.'; end if;
  if listing.owner_id=actor then raise exception 'You cannot message yourself about your own listing.'; end if;
  if listing.owner_id is not null and private.marketplace_users_blocked(actor,listing.owner_id) then
    raise exception 'Messaging is unavailable for this account.';
  end if;

  select count(*) into message_count_hour
  from public.listing_conversation_messages m
  where m.sender_profile_id=actor
    and m.created_at>now()-interval '1 hour';
  if message_count_hour>=30 then raise exception 'Message rate limit reached. Try again later.'; end if;

  select count(*) into conversations_day
  from public.listing_conversations c
  where c.buyer_id=actor
    and c.created_at>now()-interval '24 hours';
  if conversations_day>=10 and not exists(
    select 1 from public.listing_conversations c
    where c.part_id=p_part_id and c.buyer_id=actor
  ) then
    raise exception 'Conversation limit reached. Try again later.';
  end if;

  insert into public.listing_conversations(part_id,buyer_id,seller_id,status,last_message_at)
  values(listing.id,actor,listing.seller_id,'open',now())
  on conflict(part_id,buyer_id)
  do update set status='open',last_message_at=now(),updated_at=now()
  returning id into conversation_id;

  insert into public.listing_conversation_messages(conversation_id,sender_profile_id,body)
  values(conversation_id,actor,left(btrim(p_body),2000))
  returning id into message_id;

  if listing.owner_id is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      listing.owner_id,'listing_message','New buyer question',left(listing.title,180),
      '/inbox/'||conversation_id::text,'listing-message:'||message_id::text
    )
    on conflict do nothing;
  end if;
  return conversation_id;
end;
$$;

revoke execute on function public.start_listing_conversation(uuid,text) from public,anon;
grant execute on function public.start_listing_conversation(uuid,text) to authenticated;

create or replace function public.send_listing_conversation_message(
  p_conversation_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  conversation record;
  recipient uuid;
  message_count_hour integer;
  message_id uuid;
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if not private.has_current_marketplace_terms(actor) then raise exception 'Accept current Terms before messaging.'; end if;
  if char_length(btrim(coalesce(p_body,'')))<1 then raise exception 'Message cannot be empty.'; end if;

  select c.id,c.status,c.buyer_id,c.seller_id,p.title,s.owner_id
  into conversation
  from public.listing_conversations c
  join public.parts p on p.id=c.part_id
  join public.sellers s on s.id=c.seller_id
  where c.id=p_conversation_id
  for update of c;

  if conversation.id is null then raise exception 'Conversation not found.'; end if;
  if actor=conversation.buyer_id then recipient:=conversation.owner_id;
  elsif actor=conversation.owner_id then recipient:=conversation.buyer_id;
  elsif private.is_admin() then recipient:=null;
  else raise exception 'You are not a participant in this conversation.';
  end if;

  if recipient is not null and private.marketplace_users_blocked(actor,recipient) then
    raise exception 'Messaging is unavailable for this account.';
  end if;

  select count(*) into message_count_hour
  from public.listing_conversation_messages m
  where m.sender_profile_id=actor and m.created_at>now()-interval '1 hour';
  if message_count_hour>=30 then raise exception 'Message rate limit reached. Try again later.'; end if;

  insert into public.listing_conversation_messages(conversation_id,sender_profile_id,body)
  values(conversation.id,actor,left(btrim(p_body),2000))
  returning id into message_id;

  update public.listing_conversations
  set status='open',last_message_at=now(),updated_at=now()
  where id=conversation.id;

  if recipient is not null then
    insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
    values(
      recipient,'listing_message','New listing message',left(conversation.title,180),
      '/inbox/'||conversation.id::text,'listing-message:'||message_id::text
    )
    on conflict do nothing;
  end if;
  return message_id;
end;
$$;

revoke execute on function public.send_listing_conversation_message(uuid,text) from public,anon;
grant execute on function public.send_listing_conversation_message(uuid,text) to authenticated;
