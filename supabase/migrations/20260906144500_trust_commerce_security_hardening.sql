-- Harden the trust/commerce API surface after Supabase advisor review.

revoke execute on function public.get_review_opportunities() from anon;
revoke execute on function public.submit_transaction_review(uuid,smallint,smallint,smallint,smallint,smallint,text) from anon;

-- Reviews must be created only through submit_transaction_review(), which
-- resolves the counterpart from the transaction and enforces funds release.
revoke insert on table public.transaction_reviews from authenticated;
revoke insert on table public.transaction_reviews from anon;

grant execute on function public.get_review_opportunities() to authenticated;
grant execute on function public.submit_transaction_review(uuid,smallint,smallint,smallint,smallint,smallint,text) to authenticated;

create index if not exists transaction_reviews_reviewer_idx
  on public.transaction_reviews(reviewer_id,created_at desc);

create index if not exists order_events_actor_profile_idx
  on public.order_events(actor_profile_id,created_at desc)
  where actor_profile_id is not null;
