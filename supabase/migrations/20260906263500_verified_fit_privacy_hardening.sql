-- Keep raw verified-fit feedback private while allowing the public
-- compatibility RPC to expose only aggregate confidence.

alter function public.marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid)
  security definer;

revoke all on function public.marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid) from public;
grant execute on function public.marketplace_catalogue_compatibility(uuid,smallint,text,integer,uuid) to anon,authenticated;
