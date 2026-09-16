revoke execute on function public.seller_checkout_ready(uuid) from public, anon;

grant execute on function public.seller_checkout_ready(uuid) to authenticated;
grant execute on function public.seller_checkout_ready(uuid) to service_role;
