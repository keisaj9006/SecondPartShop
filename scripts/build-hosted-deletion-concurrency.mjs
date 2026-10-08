import crypto from 'node:crypto';
import {requireIsolatedDeletionTarget,isolatedDeletionSqlGuard} from './isolated-deletion-target.mjs';

// QUARANTINED: rejected for shared-host execution. Retained as review evidence.
// Committed public fixtures can trigger unrelated saved-search notifications;
// destructive cleanup cannot reverse delivered effects. Isolated PG17 ONLY.
export function makeConcurrencyManifest(input){
 validateIdentity(input);
 return {...input,part:crypto.randomUUID(),seller:crypto.randomUUID(),garage:crypto.randomUUID(),buyerGarage:crypto.randomUUID(),buyerRequest:crypto.randomUUID(),garageRequest:crypto.randomUUID()};
}
function validateIdentity(m){
 requireIsolatedDeletionTarget(m.isolatedDatabaseUrl);
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 if(![m.buyer,m.garageOwner,m.stranger].every(value=>uuid.test(value))||new Set([m.buyer,m.garageOwner,m.stranger]).size!==3)throw Error('Three distinct disposable Auth UUIDs required.');
 if(!/^rc26-[a-z0-9-]{5,60}$/.test(m.runId))throw Error('Unique rc26- QA run tag required.');
}
function validate(m){
 validateIdentity(m);
 for(const field of ['part','seller','garage','buyerGarage','buyerRequest','garageRequest'])if(!/^[a-f0-9-]{36}$/.test(m[field]))throw Error('Manifest UUID missing');
}
const service=isolatedDeletionSqlGuard+"reset role;select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claims','{\"role\":\"service_role\"}',true);";
const actor=id=>`select set_config('request.jwt.claim.sub','${id}',true),set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claims','{"sub":"${id}","role":"authenticated"}',true);set local role authenticated;`;
const safeCategory=`select c.id from public.categories c where c.is_selectable and not exists(with recursive ancestors as(select cc.id,cc.parent_id from public.categories cc where cc.id=c.id union select parent.id,parent.parent_id from public.categories parent join ancestors child on child.parent_id=parent.id)select 1 from public.part_requests r where r.status='open' and r.category_id in(select id from ancestors)) order by c.id limit 1`;
const queueSnapshot="select coalesce(jsonb_agg(jsonb_build_array(request_id,enqueued_at) order by request_id),'[]'::jsonb) from private.part_request_refresh_queue";
export function fixtureSetup(m){
 validate(m);
 return `begin;set local statement_timeout='20s';set local lock_timeout='5s';${service}
 do $qa$ declare c uuid;v uuid;y smallint;q jsonb;begin
 if(select count(*) from auth.users u join public.profiles p on p.id=u.id where u.id in('${m.buyer}','${m.garageOwner}','${m.stranger}') and u.raw_app_meta_data->>'qa_run_id'='${m.runId}' and p.role='buyer')<>3 then raise exception 'Disposable identity provenance failed';end if;
 if exists(select 1 from public.garage_partners where owner_id in('${m.buyer}','${m.garageOwner}','${m.stranger}')) or exists(select 1 from public.account_deletion_requests where coalesce(profile_id,target_profile_id) in('${m.buyer}','${m.garageOwner}','${m.stranger}')) or exists(select 1 from public.orders where buyer_id in('${m.buyer}','${m.garageOwner}','${m.stranger}')) or exists(select 1 from public.mobile_push_devices where profile_id in('${m.buyer}','${m.garageOwner}','${m.stranger}')) then raise exception 'Disposable commerce fixtures must be empty';end if;
 select id into c from (${safeCategory}) category;
 if c is null then raise exception 'No category without existing request matches';end if;
 select variant_id,year_first_used into v,y from public.vehicle_catalogue_years order by variant_id,year_first_used limit 1;
 if v is null then raise exception 'Catalogue missing';end if;
 q:=(${queueSnapshot});
 insert into public.sellers(id,owner_id,business_name,slug,location,seller_type)values('${m.seller}',null,'QA TEST NOT FOR SALE','${m.runId}-race-seller','Synthetic QA','private');
 insert into public.seller_payment_accounts(seller_id,onboarding_status,transfers_enabled)values('${m.seller}','not_started',false);
 insert into public.parts(id,seller_id,category_id,title,slug,description,condition,price_pence,stock,status,collection_available)values('${m.part}','${m.seller}',c,'QA TEST NOT FOR SALE','${m.runId}-race-part','Temporary synthetic SQL concurrency fixture. No provider account or payment readiness.','used',0,1,'active',true);
 insert into public.garage_partners(id,owner_id,business_name,slug,location,postcode,description,status)values('${m.garage}','${m.garageOwner}','Synthetic RC QA Garage','${m.runId}-race-garage','Synthetic QA','QA00','Temporary synthetic SQL concurrency fixture; no real customer service.','active'),('${m.buyerGarage}','${m.buyer}','Synthetic RC QA Buyer Garage','${m.runId}-race-buyer-garage','Synthetic QA','QA00','Temporary synthetic SQL concurrency fixture; no real customer service.','active');
 insert into public.account_deletion_requests(id,profile_id,target_profile_id,status,reason)values('${m.buyerRequest}','${m.buyer}','${m.buyer}','cancelled','${m.runId}'),('${m.garageRequest}','${m.garageOwner}','${m.garageOwner}','cancelled','${m.runId}');
 if (${queueSnapshot}) is distinct from q then raise exception 'Existing request queue changed; abort fixture setup';end if;
 if public.seller_checkout_ready('${m.seller}') then raise exception 'Synthetic fixture unexpectedly payment-ready';end if;
 end $qa$;commit;select 'fixture_setup_committed' result;`;
}
export function fixtureReset(m){
 validate(m);
 return `begin;set local statement_timeout='15s';${service}
 do $qa$ begin
 if exists(select 1 from public.orders o join public.order_items i on i.order_id=o.id where i.part_id='${m.part}' and (o.buyer_id not in('${m.buyer}','${m.garageOwner}') or o.payment_status<>'unpaid' or o.provider_checkout_session_id is not null)) then raise exception 'Unexpected non-fixture/provider order; stop';end if;
 end $qa$;
 delete from public.order_events where order_id in(select order_id from public.order_items where part_id='${m.part}');
 delete from public.orders where id in(select order_id from public.order_items where part_id='${m.part}');
 delete from public.notifications n using public.fitting_requests f where f.part_id='${m.part}' and f.garage_partner_id in('${m.garage}','${m.buyerGarage}') and n.profile_id in('${m.buyer}','${m.garageOwner}') and n.dedupe_key='fitting-request:'||f.id::text||':garage';
 delete from public.fitting_requests where part_id='${m.part}' and garage_partner_id in('${m.garage}','${m.buyerGarage}');

 update public.seller_payment_accounts set onboarding_status='not_started',transfers_enabled=false where seller_id='${m.seller}';
 update public.parts set status='active',stock=1 where id='${m.part}';
 update public.garage_partners set status='active' where id in('${m.garage}','${m.buyerGarage}');
 update public.account_deletion_requests set status='requested',attempt_count=0,blocker_code=null,processing_started_at=null where id in('${m.buyerRequest}','${m.garageRequest}');
 commit;select 'fixture_reset' result;`;
}
const fitting=(m,garage=m.garage)=>`public.request_part_fitting_quote('${m.part}','${garage}',(select variant_id from public.vehicle_catalogue_years order by variant_id,year_first_used limit 1),(select year_first_used from public.vehicle_catalogue_years order by variant_id,year_first_used limit 1),null,null,null,null)`;
export function raceQueries(m,{kind,first,participant='buyer',index}){
 validate(m);if(!['checkout','fitting','reciprocal'].includes(kind)||!['creation','claim'].includes(first)||!['buyer','garage'].includes(participant)||!Number.isInteger(index)||index<1||index>9)throw Error('Unknown bounded race');
 const aName=`rc26-hosted-${m.runId.slice(-10)}-${index}-a`,bName=aName.slice(0,-1)+'b';
 const request=participant==='garage'?m.garageRequest:m.buyerRequest;
 const claim=`public.claim_account_deletion_request('${request}')`;
 const create=kind==='checkout'?`public.prepare_checkout_order('${m.part}',1,'collection')`:fitting(m);
 const begin=name=>`begin;set local statement_timeout='30s';set local lock_timeout='25s';set local application_name='${name}';${service}`;
 let a,b;
 if(kind==='reciprocal'){
  const lower=[m.buyer,m.garageOwner].sort()[0];
  a=begin(aName)+`select pg_advisory_xact_lock(hashtextextended('secondpart-account-commerce:${lower}',0));select pg_sleep(20);${actor(m.buyer)}select ${fitting(m)};commit;select 'reciprocal_first_created' result;`;
  b=begin(bName)+actor(m.garageOwner)+`select ${fitting(m,m.buyerGarage)};commit;select 'reciprocal_second_created' result;`;
 }else if(first==='creation'){
  a=begin(aName)+(kind==='checkout'?`update public.seller_payment_accounts set onboarding_status='complete',transfers_enabled=true where seller_id='${m.seller}';`:'')+actor(m.buyer)+`select * from ${create};`+(kind==='checkout'?service+`update public.seller_payment_accounts set onboarding_status='not_started',transfers_enabled=false where seller_id='${m.seller}';`:'')+`select pg_sleep(20);commit;select 'creation_committed' result;`;
  b=begin(bName)+`do $qa$ declare r record;begin select * into r from ${claim};if r.claimed or r.blocker_code<>'${kind==='checkout'?'buyer_commerce_active':'fitting_request_active'}' then raise exception 'Creation-first claim boundary failed';end if;end $qa$;commit;select 'claim_blocked' result;`;
 }else{
  a=begin(aName)+`do $qa$ declare r record;begin select * into r from ${claim};if not r.claimed then raise exception 'Claim-first must succeed';end if;end $qa$;select pg_sleep(20);commit;select 'claim_committed' result;`;
  b=begin(bName)+actor(m.buyer)+`do $qa$ declare denied boolean:=false;begin begin perform ${create};exception when others then if sqlerrm !~* 'deletion.*in progress|garage partner.*not available' then raise;end if;denied:=true;end;if not denied then raise exception 'Claim-first creation unexpectedly accepted';end if;end $qa$;commit;select 'creation_rejected' result;`;
 }
 return {a,b,aName,bName,observer:`select application_name,wait_event_type,wait_event,pg_blocking_pids(pid) blockers from pg_stat_activity where application_name in('${aName}','${bName}') order by application_name`,readback:`select jsonb_build_object('part_stock',(select stock from public.parts where id='${m.part}'),'checkout_ready',public.seller_checkout_ready('${m.seller}'),'orders',(select count(*) from public.order_items where part_id='${m.part}'),'fitting',(select count(*) from public.fitting_requests where part_id='${m.part}'),'requests',(select jsonb_agg(jsonb_build_object('id',id,'status',status,'blocker',blocker_code)) from public.account_deletion_requests where id in('${m.buyerRequest}','${m.garageRequest}'))) result;`};
}
export function fixtureCleanup(m){
 validate(m);
 return `begin;set local statement_timeout='20s';${service}
 do $qa$ declare q jsonb;c uuid;begin
 select category_id into c from public.parts where id='${m.part}';
 if exists(with recursive ancestors as(select cc.id,cc.parent_id from public.categories cc where cc.id=c union select parent.id,parent.parent_id from public.categories parent join ancestors child on child.parent_id=parent.id)select 1 from public.part_requests r where r.status='open' and r.category_id in(select id from ancestors)) then raise exception 'Existing request matches appeared; stop destructive cleanup';end if;
 q:=(${queueSnapshot});
 delete from public.notifications n using public.fitting_requests f where f.part_id='${m.part}' and f.garage_partner_id in('${m.garage}','${m.buyerGarage}') and n.profile_id in('${m.buyer}','${m.garageOwner}') and n.dedupe_key='fitting-request:'||f.id::text||':garage';
 delete from public.fitting_requests where part_id='${m.part}' and garage_partner_id in('${m.garage}','${m.buyerGarage}');
 delete from public.order_events where order_id in(select order_id from public.order_items where part_id='${m.part}');
 delete from public.orders where id in(select order_id from public.order_items where part_id='${m.part}');

 delete from public.account_deletion_requests where id in('${m.buyerRequest}','${m.garageRequest}');
 delete from public.garage_partners where id in('${m.garage}','${m.buyerGarage}');
 delete from private.saved_search_match_queue where part_id='${m.part}';
 delete from public.parts where id='${m.part}' and seller_id='${m.seller}' and slug='${m.runId}-race-part';
 delete from public.sellers where id='${m.seller}' and slug='${m.runId}-race-seller';
 if (${queueSnapshot}) is distinct from q then raise exception 'Existing request queue changed; rollback cleanup';end if;
 end $qa$;commit;
 select jsonb_build_object('parts',(select count(*) from public.parts where id='${m.part}'),'sellers',(select count(*) from public.sellers where id='${m.seller}'),'garages',(select count(*) from public.garage_partners where id in('${m.garage}','${m.buyerGarage}')),'requests',(select count(*) from public.account_deletion_requests where id in('${m.buyerRequest}','${m.garageRequest}')),'identities',(select count(*) from auth.users where id in('${m.buyer}','${m.garageOwner}','${m.stranger}'))) result;`;
}
