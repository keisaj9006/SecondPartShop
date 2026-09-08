alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'seller_part_request',
      'buyer_part_match',
      'saved_search_match',
      'account',
      'order_paid',
      'order_update',
      'order_dispatched',
      'order_received',
      'order_accepted',
      'payout_released',
      'return_update',
      'dispute_update',
      'order_message',
      'listing_message',
      'fitting_request',
      'fitting_quote',
      'fitting_update',
      'fitting_message'
    )
  );
