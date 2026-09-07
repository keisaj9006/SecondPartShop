drop policy if exists "listing conversations participant read" on public.listing_conversations;

create policy "listing conversations participant read"
on public.listing_conversations
for select
to authenticated
using (
  buyer_id=(select auth.uid())
  or private.owns_seller(seller_id)
  or private.is_admin()
);

create index if not exists listing_conversation_messages_sender_profile_idx
on public.listing_conversation_messages(sender_profile_id);
