-- Enforce current marketplace Terms at the database boundary for review UGC.
-- Keep commerce/system updates unaffected: only user-authored review/fit rows are gated.

create or replace function private.enforce_transaction_review_terms()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is not null
     and not private.is_admin()
     and not private.has_current_marketplace_terms(auth.uid()) then
    raise exception 'Accept current Terms before submitting a review.';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_transaction_review_terms() from public;

drop trigger if exists transaction_reviews_terms_gate on public.transaction_reviews;
create trigger transaction_reviews_terms_gate
before insert on public.transaction_reviews
for each row execute function private.enforce_transaction_review_terms();

create or replace function private.enforce_verified_fit_terms()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if auth.uid() is not null
     and not private.is_admin()
     and not private.has_current_marketplace_terms(auth.uid()) then
    raise exception 'Accept current Terms before submitting fitment feedback.';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_verified_fit_terms() from public;

drop trigger if exists verified_fit_feedback_terms_gate on public.verified_fit_feedback;
create trigger verified_fit_feedback_terms_gate
before insert or update of result,notes on public.verified_fit_feedback
for each row execute function private.enforce_verified_fit_terms();
