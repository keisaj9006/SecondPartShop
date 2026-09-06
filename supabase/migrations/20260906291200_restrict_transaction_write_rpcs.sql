revoke execute on function public.prepare_checkout_order_v2(
  uuid,integer,text,uuid,smallint,text,integer,text
) from anon;

revoke execute on function public.submit_verified_fit_feedback(
  uuid,text,text
) from anon;

grant execute on function public.prepare_checkout_order_v2(
  uuid,integer,text,uuid,smallint,text,integer,text
) to authenticated;

grant execute on function public.submit_verified_fit_feedback(
  uuid,text,text
) to authenticated;
