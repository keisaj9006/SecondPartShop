-- Notify both transaction participants when a verified review becomes eligible.
-- Uses the existing 'account' notification type to avoid widening the notification enum.

create or replace function private.notify_transaction_review_ready()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  buyer_profile uuid;
  seller_profile uuid;
  part_title text;
begin
  if new.payout_status='released'
     and new.funds_released_at is not null
     and new.fulfilment_status='completed'
     and (
       old.payout_status is distinct from new.payout_status
       or old.funds_released_at is distinct from new.funds_released_at
       or old.fulfilment_status is distinct from new.fulfilment_status
     ) then

    select o.buyer_id,s.owner_id,p.title
      into buyer_profile,seller_profile,part_title
    from public.orders o
    join public.sellers s on s.id=new.seller_id
    join public.parts p on p.id=new.part_id
    where o.id=new.order_id;

    if buyer_profile is not null then
      insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
      values(
        buyer_profile,
        'account',
        'Your verified review is ready',
        left('Rate your completed purchase: '||coalesce(part_title,'SecondPart transaction'),240),
        '/account/reviews',
        'review-ready:'||new.id::text||':buyer'
      )
      on conflict do nothing;
    end if;

    if seller_profile is not null then
      insert into public.notifications(profile_id,type,title,body,href,dedupe_key)
      values(
        seller_profile,
        'account',
        'Your verified review is ready',
        left('Rate the buyer from your completed sale: '||coalesce(part_title,'SecondPart transaction'),240),
        '/account/reviews',
        'review-ready:'||new.id::text||':seller'
      )
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists transaction_review_ready_notification on public.order_items;
create trigger transaction_review_ready_notification
after update of payout_status,funds_released_at,fulfilment_status on public.order_items
for each row execute function private.notify_transaction_review_ready();

revoke all on function private.notify_transaction_review_ready() from public;
