-- Private pre-purchase buyer/seller conversations with abuse controls.

create table if not exists public.listing_conversations (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.parts(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.sellers(id) on delete cascade,
  status text not null default 'open' check (status in ('open','closed')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(part_id,buyer_id)
);

create index if not exists listing_conversations_buyer_last_idx
  on public.listing_conversations(buyer_id,last_message_at desc);
create index if not exists listing_conversations_seller_last_idx
  on public.listing_conversations(seller_id,last_message_at desc);

create table if not exists public.listing_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.listing_conversations(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists listing_conversation_messages_thread_idx
  on public.listing_conversation_messages(conversation_id,created_at);

alter table public.listing_conversations enable row level security;
alter table public.listing_conversation_messages enable row level security;

create or replace function private.can_read_listing_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.listing_conversations c
    join public.sellers s on s.id=c.seller_id
    where c.id=p_conversation_id
      and (
        c.buyer_id=auth.uid()
        or s.owner_id=auth.uid()
        or private.is_admin()
      )
  );
$$;

revoke all on function private.can_read_listing_conversation(uuid) from public;
grant execute on function private.can_read_listing_conversation(uuid) to authenticated;

drop policy if exists "listing conversations participant read" on public.listing_conversations;
create policy "listing conversations participant read"
  on public.listing_conversations for select
  to authenticated
  using (
    buyer_id=auth.uid()
    or private.owns_seller(seller_id)
    or private.is_admin()
  );

drop policy if exists "listing conversation messages participant read" on public.listing_conversation_messages;
create policy "listing conversation messages participant read"
  on public.listing_conversation_messages for select
  to authenticated
  using (private.can_read_listing_conversation(conversation_id));

revoke all on public.listing_conversations from anon,authenticated;
revoke all on public.listing_conversation_messages from anon,authenticated;
grant select on public.listing_conversations to authenticated;
grant select on public.listing_conversation_messages to authenticated;

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in (
    'seller_part_request','buyer_part_match','saved_search_match','account',
    'order_paid','order_update','order_dispatched','order_received',
    'order_accepted','payout_released','return_update','dispute_update',
    'order_message','listing_message'
  ));

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
  if char_length(btrim(coalesce(p_body,'')))<2 then raise exception 'Message is too short.'; end if;

  select p.id,p.seller_id,p.status,p.title,s.owner_id
  into listing
  from public.parts p
  join public.sellers s on s.id=p.seller_id
  where p.id=p_part_id;

  if listing.id is null or listing.status::text<>'active' then raise exception 'Listing is unavailable.'; end if;
  if listing.owner_id=actor then raise exception 'You cannot message yourself about your own listing.'; end if;

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
      listing.owner_id,
      'listing_message',
      'New buyer question',
      left(listing.title,180),
      '/inbox/'||conversation_id::text,
      'listing-message:'||message_id::text
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

  select count(*) into message_count_hour
  from public.listing_conversation_messages m
  where m.sender_profile_id=actor
    and m.created_at>now()-interval '1 hour';
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
      recipient,
      'listing_message',
      'New listing message',
      left(conversation.title,180),
      '/inbox/'||conversation.id::text,
      'listing-message:'||message_id::text
    )
    on conflict do nothing;
  end if;

  return message_id;
end;
$$;

revoke execute on function public.send_listing_conversation_message(uuid,text) from public,anon;
grant execute on function public.send_listing_conversation_message(uuid,text) to authenticated;

create or replace function public.close_listing_conversation(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'Authentication required.'; end if;

  update public.listing_conversations c
  set status='closed',updated_at=now()
  where c.id=p_conversation_id
    and (
      c.buyer_id=actor
      or private.owns_seller(c.seller_id)
      or private.is_admin()
    );

  if not found then raise exception 'Conversation not found.'; end if;
  return true;
end;
$$;

revoke execute on function public.close_listing_conversation(uuid) from public,anon;
grant execute on function public.close_listing_conversation(uuid) to authenticated;
