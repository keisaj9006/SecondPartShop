insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'case-evidence',
  'case-evidence',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

create table if not exists public.transaction_case_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.transaction_cases(id) on delete cascade,
  uploader_profile_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null check (char_length(original_name) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  created_at timestamptz not null default now()
);

create index if not exists transaction_case_evidence_case_idx
  on public.transaction_case_evidence(case_id,created_at);
create index if not exists transaction_case_evidence_uploader_idx
  on public.transaction_case_evidence(uploader_profile_id,created_at desc);

alter table public.transaction_case_evidence enable row level security;

drop policy if exists "case evidence participant read" on public.transaction_case_evidence;
create policy "case evidence participant read"
  on public.transaction_case_evidence for select
  to authenticated
  using (
    exists (
      select 1 from public.transaction_cases c
      where c.id=transaction_case_evidence.case_id
        and (private.can_read_order_item(c.order_item_id) or private.is_admin())
    )
  );

revoke all on public.transaction_case_evidence from anon,authenticated;
grant select on public.transaction_case_evidence to authenticated;

create or replace function private.can_read_case_evidence_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  case_text text:=split_part(p_name,'/',1);
  case_uuid uuid;
begin
  if case_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  case_uuid:=case_text::uuid;
  return exists(
    select 1 from public.transaction_cases c
    where c.id=case_uuid
      and (private.can_read_order_item(c.order_item_id) or private.is_admin())
  );
end;
$$;

create or replace function private.can_upload_case_evidence_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  case_text text:=split_part(p_name,'/',1);
  actor_text text:=split_part(p_name,'/',2);
  case_uuid uuid;
begin
  if actor is null or actor_text<>actor::text then return false; end if;
  if case_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  case_uuid:=case_text::uuid;
  return exists(
    select 1 from public.transaction_cases c
    where c.id=case_uuid
      and c.status not in ('resolved','rejected','cancelled')
      and private.can_read_order_item(c.order_item_id)
  );
end;
$$;

revoke all on function private.can_read_case_evidence_object(text) from public;
revoke all on function private.can_upload_case_evidence_object(text) from public;
grant execute on function private.can_read_case_evidence_object(text) to authenticated;
grant execute on function private.can_upload_case_evidence_object(text) to authenticated;

drop policy if exists "case evidence object participant read" on storage.objects;
create policy "case evidence object participant read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id='case-evidence'
    and private.can_read_case_evidence_object(name)
  );

drop policy if exists "case evidence object participant upload" on storage.objects;
create policy "case evidence object participant upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id='case-evidence'
    and private.can_upload_case_evidence_object(name)
  );

create or replace function public.register_transaction_case_evidence(
  p_case_id uuid,
  p_storage_path text,
  p_original_name text,
  p_mime_type text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  actor uuid:=auth.uid();
  evidence_id uuid;
  evidence_count integer;
begin
  if actor is null then raise exception 'Authentication required.'; end if;
  if p_mime_type not in ('image/jpeg','image/png','image/webp') then raise exception 'Unsupported evidence file type.'; end if;
  if not private.can_upload_case_evidence_object(p_storage_path) then raise exception 'Evidence upload is not permitted.'; end if;
  if split_part(p_storage_path,'/',1)<>p_case_id::text then raise exception 'Evidence path does not match the case.'; end if;

  select count(*) into evidence_count
  from public.transaction_case_evidence
  where case_id=p_case_id;

  if evidence_count>=10 then raise exception 'This case already has the maximum number of evidence images.'; end if;

  insert into public.transaction_case_evidence(case_id,uploader_profile_id,storage_path,original_name,mime_type)
  values(p_case_id,actor,p_storage_path,left(p_original_name,255),p_mime_type)
  returning id into evidence_id;

  return evidence_id;
end;
$$;

revoke all on function public.register_transaction_case_evidence(uuid,text,text,text) from public;
grant execute on function public.register_transaction_case_evidence(uuid,text,text,text) to authenticated;
