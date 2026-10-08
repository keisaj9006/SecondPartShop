import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// Build artifacts only. No network, database connection, provider, or worker.
// Each returned script has one behavior and explicit BEGIN/ROLLBACK boundaries.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validateHostedInput({buyer,garageOwner,stranger,runId}){
 if(![buyer,garageOwner,stranger].every(value=>uuid.test(value))||new Set([buyer,garageOwner,stranger]).size!==3)throw Error('Three distinct disposable Auth UUIDs required.');
 if(!/^rc26-[a-z0-9-]{5,60}$/.test(runId))throw Error('Unique rc26- QA run tag required.');
}
const contextObject="jsonb_build_object('db_role',current_user,'sub_hash',md5(coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),'<unset>')),'role_hash',md5(coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'<unset>')),'claims_hash',md5(coalesce(nullif(current_setting('request.jwt.claims',true),''),'<unset>')))";
export const contextQuery=`select ${contextObject} context;`;
const cleanContext=`do $clean_context$ begin
 if current_user<>'postgres' or auth.uid() is not null or nullif(current_setting('request.jwt.claim.sub',true),'') is not null or nullif(current_setting('request.jwt.claim.role',true),'') is not null or nullif(current_setting('request.jwt.claims',true),'') is not null then raise exception 'Expected clean postgres SQL context';end if;
end $clean_context$;`;
const actorContext=(actor,role)=>`select set_config('request.jwt.claim.sub','${actor??''}',true),set_config('request.jwt.claim.role','${role}',true),set_config('request.jwt.claims','${JSON.stringify({role,...(actor?{sub:actor}:{})})}',true);
set local role ${role};
do $context$ begin
 if current_user<>'${role}' or auth.uid() is distinct from ${actor?`'${actor}'::uuid`:'null::uuid'} then raise exception 'Wrong execution role/actor';end if;
end $context$;`;
const setupContext=`RESET ROLE;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claims','{"role":"service_role"}',true);
do $setup_context$ begin if current_user<>'postgres' or auth.uid() is not null then raise exception 'Privileged fixture executor must be postgres with empty actor';end if;end $setup_context$;`;
const specs=[];
for(const status of ['processing','failed','blocked']){
 specs.push({name:'checkout-'+status,kind:'checkout-denied',status,role:'authenticated',actor:'buyer',error:'deletion.*in progress'});
 for(const participant of ['buyer','garage'])specs.push({name:`fitting-${participant}-${status}`,kind:'fitting-denied',participant,status,role:'authenticated',actor:'buyer',error:'deletion.*in progress'});
}
for(const action of ['quote','decline','complete']){
 specs.push({name:'ownerless-response-'+action,kind:'response',action,nullOwner:true,actor:'stranger',role:'authenticated',error:'fitting request not found'});
 specs.push({name:'owner-response-'+action,kind:'response',action,actor:'garageOwner',role:'authenticated'});
}
for(const [shape,nullBuyer,nullOwner] of [['buyer',true,false],['owner',false,true],['both',true,true]])specs.push({name:'detached-message-'+shape,kind:'message',nullBuyer,nullOwner,actor:'stranger',role:'authenticated',error:'fitting request not found'});
for(const [name,actor,nullBuyer,nullOwner] of [['buyer','buyer',false,false],['garage','garageOwner',false,false],['surviving-buyer','buyer',false,true],['surviving-garage','garageOwner',true,false]])specs.push({name:name+'-message',kind:'message',actor,nullBuyer,nullOwner,role:'authenticated'});
specs.push({name:'admin-ownerless-response',kind:'response',action:'quote',nullOwner:true,actor:'stranger',admin:true,role:'authenticated'});
specs.push({name:'admin-detached-message',kind:'message',nullBuyer:true,nullOwner:true,actor:'stranger',admin:true,role:'authenticated'});
specs.push({name:'ordinary-checkout',kind:'checkout',actor:'buyer',role:'authenticated',status:'requested'});
specs.push({name:'ordinary-fitting',kind:'fitting',actor:'buyer',role:'authenticated',status:'requested'});
for(const kind of ['checkout','fitting','response','message'])specs.push({name:'unbound-service-'+kind,kind:'unbound-'+kind,actor:null,role:'service_role',error:'authentication required'});
specs.push({name:'anonymous-checkout-acl',kind:'unbound-checkout',actor:null,role:'anon',error:'permission denied'});
specs.push({name:'authenticated-claim-acl',kind:'claim-acl',actor:'buyer',role:'authenticated',error:'permission denied'});

export function buildHostedAcceptance(input){
 validateHostedInput(input);
 const {buyer,garageOwner,stranger,runId}=input;
 return specs.map(spec=>{
  const fixtureIds=Object.fromEntries(['seller','part','garage','deletion','fitting'].map(name=>[name,crypto.randomUUID()]));
  const {seller,part,garage,deletion,fitting}=fixtureIds;
  const profiles=`'${buyer}','${garageOwner}','${stranger}'`;
  const needsPart=['fitting-denied','response','message','checkout','fitting'].includes(spec.kind);
  const needsGarage=['fitting-denied','response','message','fitting'].includes(spec.kind);
  const retained=['response','message'].includes(spec.kind);
  const actor=spec.actor?input[spec.actor]:null;
  const prefix=runId+'-'+spec.name;
  const start=`BEGIN;
${cleanContext}
SET LOCAL statement_timeout='15s';
SET LOCAL lock_timeout='5s';
${setupContext}
do $provenance$ begin
 if (select count(*) from auth.users u join public.profiles p on p.id=u.id where u.id in(${profiles}) and u.raw_app_meta_data->>'qa_run_id'='${runId}' and u.raw_app_meta_data->>'qa_evidence_class'='synthetic-not-mailbox' and p.role='buyer')<>3 then raise exception 'Disposable identity provenance failed';end if;
 if exists(select 1 from public.account_deletion_requests where coalesce(profile_id,target_profile_id) in(${profiles})) or exists(select 1 from public.orders where buyer_id in(${profiles})) or exists(select 1 from public.fitting_requests where buyer_id in(${profiles})) or exists(select 1 from public.garage_partners where owner_id in(${profiles})) or exists(select 1 from public.mobile_push_devices where profile_id in(${profiles})) or exists(select 1 from public.notifications where profile_id in(${profiles})) then raise exception 'Disposable commerce/notification parents must be empty';end if;
end $provenance$;`;
  let seed='';
  if(needsPart)seed+=`
do $seed$ declare c uuid;v uuid;y smallint;queue_before jsonb;begin
 select coalesce(jsonb_agg(jsonb_build_array(request_id,enqueued_at) order by request_id),'[]'::jsonb) into queue_before from private.part_request_refresh_queue;
 select cat.id into c from public.categories cat where cat.is_selectable and not exists(with recursive ancestors as(select x.id,x.parent_id from public.categories x where x.id=cat.id union select parent.id,parent.parent_id from public.categories parent join ancestors child on child.parent_id=parent.id)select 1 from public.part_requests r where r.status='open' and r.category_id in(select id from ancestors)) order by cat.id limit 1;
 select variant_id,year_first_used into v,y from public.vehicle_catalogue_years order by variant_id,year_first_used limit 1;
 if c is null or v is null then raise exception 'Safe category/catalogue precondition unavailable';end if;
 insert into public.sellers(id,owner_id,business_name,slug,location,seller_type)values('${seller}',null,'Synthetic rollback QA','${prefix}-seller','Synthetic QA','private');
 ${spec.kind==='checkout'?`insert into public.seller_payment_accounts(seller_id,onboarding_status,transfers_enabled)values('${seller}','complete',true);`:''}
 insert into public.parts(id,seller_id,category_id,title,slug,description,condition,price_pence,stock,status,collection_available)values('${part}','${seller}',c,'Synthetic rollback QA','${prefix}-part','Synthetic SQL fixture; no publication or provider operation.','used',500,1,'${retained?'draft':'active'}',true);
 ${needsGarage?`insert into public.garage_partners(id,owner_id,business_name,slug,location,postcode,description,status)values('${garage}',${spec.nullOwner?'null':`'${garageOwner}'::uuid`},'Synthetic rollback garage','${prefix}-garage','Synthetic QA','QA00','Synthetic SQL fixture for transaction-only authorization acceptance.','${retained?'pending':'active'}');`:''}
 ${retained?`insert into public.fitting_requests(id,buyer_id,part_id,garage_partner_id,vehicle_variant_id,vehicle_year,status)values('${fitting}',${spec.nullBuyer?'null':`'${buyer}'::uuid`},'${part}','${garage}',v,y,'${spec.kind==='message'||spec.action==='complete'?'accepted':'requested'}');`:''}
 if (select coalesce(jsonb_agg(jsonb_build_array(request_id,enqueued_at) order by request_id),'[]'::jsonb) from private.part_request_refresh_queue) is distinct from queue_before then raise exception 'Outside request queue changed; abort';end if;
end $seed$;`;
  if(['checkout-denied','fitting-denied','checkout','fitting'].includes(spec.kind))seed+=`
insert into public.account_deletion_requests(id,profile_id,target_profile_id,status,attempt_count,reason)values('${deletion}','${spec.participant==='garage'?garageOwner:buyer}','${spec.participant==='garage'?garageOwner:buyer}','${spec.status}',${spec.status==='requested'?0:1},'${prefix}');`;
  if(spec.admin)seed+=`
update public.profiles set role='admin' where id='${stranger}';`;
  let call;
  if(spec.kind.includes('checkout'))call=`select order_id into result_id from public.prepare_checkout_order('${part}',1,'collection')`;
  else if(spec.kind.includes('fitting')&&!retained)call=`result_id:=public.request_part_fitting_quote('${part}','${garage}',(select variant_id from public.vehicle_catalogue_years order by variant_id,year_first_used limit 1),(select year_first_used from public.vehicle_catalogue_years order by variant_id,year_first_used limit 1),null,null,null,null)`;
  else if(spec.kind.includes('response'))call=`result_bool:=public.garage_respond_fitting_request('${fitting}','${spec.action??'quote'}',500,null)`;
  else if(spec.kind.includes('message'))call=`result_id:=public.send_fitting_request_message('${fitting}','Synthetic rollback acceptance message')`;
  else call=`perform public.claim_account_deletion_request('${deletion}')`;
  const adminAssertion=`if private.is_admin() is distinct from ${Boolean(spec.admin)} then raise exception 'Wrong admin context';end if;`;
  const behavior=`${actorContext(actor,spec.role)}
do $behavior$ declare denied boolean:=false;result_id uuid;result_bool boolean;begin
 ${spec.role==='authenticated'?adminAssertion:''}
 ${spec.error?`begin
 ${call};
 exception when others then if sqlerrm !~* '${spec.error}' then raise;end if;denied:=true;end;
 if not denied then raise exception 'Expected denial was absent';end if;`:`${call};
 if ${spec.kind==='response'?'result_bool is distinct from true':'result_id is null'} then raise exception 'Successful behavior result missing';end if;`}
 -- Context setup is outside the expected-error subtransaction; verify it survived.
 if current_user<>'${spec.role}' or auth.uid() is distinct from ${actor?`'${actor}'::uuid`:'null::uuid'} then raise exception 'Expected error changed role/actor';end if;
end $behavior$;`;
  const afterBehavior=`RESET ROLE;
do $outcome$ begin
 ${spec.error?`if exists(select 1 from public.order_items where part_id='${part}') or exists(select 1 from public.fitting_request_messages where fitting_request_id='${fitting}') or exists(select 1 from public.notifications where profile_id in(${profiles})) then raise exception 'Denied behavior wrote an obligation/message/notification';end if;
 ${spec.kind==='fitting-denied'?`if exists(select 1 from public.fitting_requests where part_id='${part}') then raise exception 'Denied fitting inserted a request';end if;`:''}
 ${spec.kind==='response'?`if (select status from public.fitting_requests where id='${fitting}')<>'${spec.action==='complete'?'accepted':'requested'}' then raise exception 'Denied response changed state';end if;`:''}`:spec.kind==='response'?`if (select status from public.fitting_requests where id='${fitting}')<>'${{quote:'quoted',decline:'declined',complete:'completed'}[spec.action]}' then raise exception 'Response transition failed';end if;`:spec.kind==='message'?`if (select count(*) from public.fitting_request_messages where fitting_request_id='${fitting}' and sender_profile_id='${actor}')<>1 then raise exception 'Message sender/row mismatch';end if;`:spec.kind==='checkout'?`if (select count(*) from public.order_items where part_id='${part}')<>1 or (select stock from public.parts where id='${part}')<>0 then raise exception 'Checkout reservation not atomic';end if;`:spec.kind==='fitting'?`if (select count(*) from public.fitting_requests where part_id='${part}' and buyer_id='${buyer}')<>1 then raise exception 'Fitting request missing';end if;`:''}
end $outcome$;
ROLLBACK;`;
  const absentChecks=[['sellers',`id='${seller}'`],['seller_payment_accounts',`seller_id='${seller}'`],['parts',`id='${part}'`],['garage_partners',`id='${garage}'`],['account_deletion_requests',`id='${deletion}'`],['fitting_requests',`id='${fitting}' or part_id='${part}'`],['fitting_request_messages',`fitting_request_id='${fitting}'`],['order_items',`part_id='${part}'`],['orders',`buyer_id in(${profiles})`],['order_events',`actor_profile_id in(${profiles})`],['notifications',`profile_id in(${profiles})`],['mobile_push_outbox',`profile_id in(${profiles})`]];
  const absence=absentChecks.map(([table,predicate])=>`'${table}',(select count(*) from public.${table} where ${predicate})`).join(',\n');
  const postRollbackQuery=`${cleanContext}
select jsonb_build_object('scenario','${spec.name}','fixture_counts',jsonb_build_object(${absence},'saved_search_queue',(select count(*) from private.saved_search_match_queue where part_id='${part}'),'part_image_cleanup',(select count(*) from private.part_image_cleanup where part_id='${part}')),'refresh_queue_hash',(select md5(coalesce(jsonb_agg(jsonb_build_array(request_id,enqueued_at) order by request_id),'[]'::jsonb)::text) from private.part_request_refresh_queue),'profile_roles',(select jsonb_agg(role::text order by id) from public.profiles where id in(${profiles})),'profile_state_hash',(select md5(jsonb_agg(jsonb_build_array(id,role,updated_at) order by id)::text) from public.profiles where id in(${profiles})),'context',${contextObject}) result;`;
  const query=`-- Rollback-only synthetic acceptance: ${spec.name}.
-- Project etkupijfdznljimrfyct. Does not prove mailbox/Auth deletion/provider E2E.
-- On any SQL error, executor must ROLLBACK or close the SAME connection.
${start}${seed}
${behavior}
${afterBehavior}`;
  return {name:spec.name,behavior:spec.kind,fixtureIds,query,postRollbackQuery,contextQuery:`select jsonb_build_object('context',${contextObject},'refresh_queue_hash',(select md5(coalesce(jsonb_agg(jsonb_build_array(request_id,enqueued_at) order by request_id),'[]'::jsonb)::text) from private.part_request_refresh_queue),'profile_state_hash',(select md5(jsonb_agg(jsonb_build_array(id,role,updated_at) order by id)::text) from public.profiles where id in(${profiles}))) result;`};
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const output=process.env.QA_SQL_DIRECTORY;
 if(!output)throw Error('QA_SQL_DIRECTORY required; builder never executes SQL.');
 const scenarios=buildHostedAcceptance({buyer:process.env.QA_BUYER_ID,garageOwner:process.env.QA_GARAGE_ID,stranger:process.env.QA_STRANGER_ID,runId:process.env.QA_RUN_ID});
 fs.mkdirSync(output,{recursive:true});
 fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({project_id:'etkupijfdznljimrfyct',evidence:'synthetic-not-mailbox',contextQuery,scenarios},null,2));
 for(const scenario of scenarios)fs.writeFileSync(path.join(output,scenario.name+'.sql'),scenario.query+'\n'+scenario.postRollbackQuery+'\n');
 console.log('Built '+scenarios.length+' independent rollback-only SQL artifacts; no execution.');
}
