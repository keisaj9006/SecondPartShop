-- Avoid evaluating multiple permissive SELECT policies for authenticated users.
-- Preserve the exact existing semantics:
--   * anonymous users can read only non-deleted seller profiles;
--   * authenticated users can read non-deleted seller profiles;
--   * admins can additionally read deleted seller records for moderation/audit.

drop policy if exists "sellers public read" on public.sellers;
drop policy if exists "sellers admin deleted read" on public.sellers;
drop policy if exists "sellers authenticated read" on public.sellers;

create policy "sellers public read"
  on public.sellers for select
  to anon
  using (account_deleted_at is null);

create policy "sellers authenticated read"
  on public.sellers for select
  to authenticated
  using (account_deleted_at is null or private.is_admin());
