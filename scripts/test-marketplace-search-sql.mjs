import test from 'node:test';
import assert from 'node:assert/strict';
import {database,seed,id,migration} from './lib/marketplace-search-sql-harness.mjs';

test('real SQL search integration on reduced schema',async(t)=>{
 const db=await database();
 try{
  const runtime=(await db.query("select version(),(select extversion from pg_extension where extname='pg_trgm') trgm")).rows[0];
  assert.match(runtime.version,/PostgreSQL 18\.3/);assert.equal(runtime.trgm,'1.6');t.diagnostic(`Reduced-schema runtime: ${runtime.version}; pg_trgm ${runtime.trgm}; Preview uses PostgreSQL 17.6.`);
  const indexes=await db.query("select count(*)::integer count from pg_indexes where tablename='parts' and indexdef like '%USING gin%'");assert.ok(indexes.rows[0].count>=5);
  const patched=await db.query("select pg_get_functiondef(oid) definition from pg_proc where proname in ('marketplace_catalogue_cursor_page_v1','marketplace_catalogue_distance_page_v2')");
  assert.equal(patched.rows.length,2);for(const row of patched.rows)assert.match(row.definition,/private.valid_verified_fit_feedback/);
  await seed(db);
  const old=await db.query("select * from marketplace_search_part_ids('Fixture alternator')");
  assert.equal(old.rows.length,500);
  assert.ok(!old.rows.some(row=>row.part_id===id(501)));
  assert.ok(!old.rows.some(row=>row.part_id===id(1601)));
  const eligible=await db.query('select id from parts where id=$1',[id(1601)]);
  assert.equal(eligible.rows[0].id,id(1601));
  await db.exec(migration('20260912110440_complete_marketplace_search_page.sql'));
  const page=await db.query("select * from marketplace_search_page_v1('Fixture alternator',p_offset=>1584)");
  assert.equal(page.rows.length,17);
  assert.ok(page.rows.some(row=>row.part_id===eligible.rows[0].id),'complete search includes the eligible oldest part');
  const types={query:'text',sort:'text',category_ids:'uuid[]',condition:'text',min_price_pence:'integer',max_price_pence:'integer',collection_only:'boolean',variant_id:'uuid',year:'smallint',fuel:'text',engine:'integer',vehicle_id:'uuid',compatible_only:'boolean',buyer_lat:'double precision',buyer_lon:'double precision',part_ids:'uuid[]',limit:'integer',offset:'integer'};
  const search=async(args={})=>{
   const entries=Object.entries({query:'Fixture alternator',...args});
   return (await db.query(`select * from marketplace_search_page_v1(${entries.map(([key],i)=>`p_${key}=>$${i+1}::${types[key]}`).join(',')})`,entries.map(([,value])=>value))).rows;
  };
  const scenario=async(name,run)=>t.test(name,async()=>{await db.exec('begin');try{await run();}finally{await db.exec('rollback');}});
  await scenario('501 matches: category, condition, price and collection independently recover oldest',async()=>{
   await db.exec(`delete from parts where id>'${id(501)}';update parts set category_id='${id(7002)}',condition='reconditioned',price_pence=10,collection_available=true where id='${id(501)}'`);
   for(const filter of [{category_ids:[id(7002)]},{condition:'reconditioned'},{max_price_pence:10},{collection_only:true},{category_ids:[id(7002)],condition:'reconditioned',max_price_pence:10,collection_only:true}])assert.deepEqual((await search(filter)).map(r=>r.part_id),[id(501)]);
  });
  await scenario('1601 source-equivalent matches retain exact catalogue and legacy fit beyond source caps',async()=>{
   await db.exec(`insert into part_catalogue_fitments(part_id,variant_id) values ('${id(1601)}','${id(6001)}');insert into part_fitments(part_id,vehicle_id) values ('${id(1601)}','${id(5001)}');`);
   for(const filter of [{variant_id:id(6001),year:2020},{vehicle_id:id(5001)}]){
    const rows=await search(filter);assert.equal(rows.length,1);assert.equal(rows[0].part_id,id(1601));assert.equal(rows[0].confidence,'confirmed');
   }
  });
  await scenario('all special sorts order globally before the page with/without catalogue context',async()=>{
   await db.exec(`update parts set price_pence=1,delivery_days_min=0,warranty_days=730,seller_id='${id(8002)}' where id='${id(1601)}';update parts set price_pence=999999 where id='${id(1600)}'`);
   for(const context of [{},{variant_id:id(6001),year:2020,compatible_only:false}])for(const sort of ['price_asc','price_desc','delivery','warranty','distance']){
    const rows=await search({...context,sort,buyer_lat:51,buyer_lon:0});assert.equal(rows[0].part_id,id(sort==='price_desc'?1600:1601),`${sort} global extremum`);
   }
  });
  await scenario('525 matches: tail and sentinel are complete, deterministic ties have no gaps',async()=>{
   await db.exec(`delete from parts where id>'${id(525)}';update parts set created_at='2026-01-01'`);
   assert.equal((await search({offset:504})).length,21);assert.equal((await search({offset:480})).length,25);
   const all=[];for(let offset=0;offset<525;offset+=60)all.push(...(await search({limit:60,offset})).slice(0,60).map(r=>r.part_id));
   assert.deepEqual(all,Array.from({length:525},(_,i)=>id(i+1)));
   for(const limit of [1,24,60,1000])assert.equal((await search({limit})).length,Math.min(limit,60)+1);
   assert.equal((await search({offset:9999})).length,0);assert.equal((await search({query:'  '})).length,0);
  });
  await scenario('literal alias outside filters or beyond page never invokes canonical fallback',async()=>{
   await db.exec("insert into marketplace_search_synonyms(alias,canonical_query) values ('special alias','Fixture alternator')");
   assert.equal((await search({query:'special alias'})).length,25);
   await db.exec(`update parts set title='special alias' where id='${id(1)}'`);
   assert.equal((await search({query:'special alias',offset:1})).length,0);
   assert.equal((await search({query:'special alias',category_ids:[id(7002)]})).length,0);
   assert.equal((await search({query:'special alias'}))[0].part_id,id(1));
  });
  await scenario('compact identifiers preserve exact OEM then part then title score priority',async()=>{
   await db.exec(`update parts set oem_number='A-B.123' where id='${id(1601)}';update parts set part_number='AB 123' where id='${id(1600)}';update parts set title='AB123' where id='${id(1599)}'`);
   assert.deepEqual((await search({query:'AB123'})).slice(0,3).map(r=>r.part_id),[id(1601),id(1600),id(1599)]);
   await db.exec(`update categories set parent_id='${id(7002)}' where id='${id(7001)}';update categories set name='Ancestor keyword' where id='${id(7002)}'`);
   assert.equal((await search({query:'Ancestor keyword'})).length,25);
  });
  await scenario('all original matching sources retain score hierarchy, including leaf and FTS',async()=>{
   await db.exec(`insert into categories(id,name,slug) values ('${id(7101)}','Needle','needle-leaf'),('${id(7102)}','Needle family','family-leaf');
    update parts set title='Generic component',description='A neutral component description',manufacturer=null,oem_number=null,part_number=null where id<='${id(12)}';
    update parts set oem_number='Needle' where id='${id(12)}';
    update parts set part_number='Needle' where id='${id(11)}';
    update parts set title='Needle' where id='${id(10)}';
    update parts set title='Needle prefix' where id='${id(9)}';
    update parts set category_id='${id(7101)}' where id='${id(8)}';
    update parts set manufacturer='Needle' where id='${id(7)}';
    update parts set oem_number='prefix-Needle-suffix' where id='${id(6)}';
    update parts set title='Contains Needle text' where id='${id(5)}';
    update parts set category_id='${id(7102)}' where id='${id(4)}';
    update parts set manufacturer='Contains Needle text' where id='${id(3)}';
    update parts set gearbox_code='Needle' where id='${id(2)}';
    update parts set gearbox_family='Needling' where id='${id(1)}';`);
   // IDs/timestamps favor reverse order; only the documented greatest-score weights win.
   assert.deepEqual((await search({query:'Needle'})).map(r=>r.part_id),Array.from({length:12},(_,i)=>id(12-i)));
  });
  await scenario('exact, buyer, sibling and donor ranks are distinct; canonical transaction invalidation agrees across paths',async()=>{
   await db.exec(`insert into part_catalogue_fitments(part_id,variant_id) values ('${id(1601)}','${id(6001)}'),('${id(1599)}','${id(6002)}');
    insert into donor_vehicles(id,seller_id,make,model,year) values ('${id(4001)}','${id(8001)}','Test','Model',2020);
    update parts set donor_vehicle_id='${id(4001)}' where id='${id(1598)}';
    insert into orders(id,buyer_id,total_pence,payment_status) values ('${id(3001)}','${id(9002)}',1000,'paid'),('${id(3002)}','${id(9003)}',1000,'paid');
    insert into order_items(id,order_id,part_id,seller_id,quantity,unit_price_pence,fulfilment_status,payout_status,funds_released_at) values ('${id(2001)}','${id(3001)}','${id(1600)}','${id(8001)}',1,1000,'completed','released',now()),('${id(2002)}','${id(3002)}','${id(1600)}','${id(8001)}',1,1000,'completed','released',now());
    insert into verified_fit_feedback(order_item_id,buyer_id,part_id,variant_id,year,result) values ('${id(2001)}','${id(9002)}','${id(1600)}','${id(6001)}',2020,'exact_fit'),('${id(2002)}','${id(9003)}','${id(1600)}','${id(6001)}',2020,'exact_fit');`);
   const context={variant_id:id(6001),year:2020};
   const parity=async(expected)=>{
    const rows=await search({...context,compatible_only:false});assert.equal(rows.find(r=>r.part_id===id(1600))?.confidence??'unverified',expected);
    for(const fn of ['marketplace_catalogue_compatibility','marketplace_catalogue_sorted_page','marketplace_catalogue_cursor_page_v1']){
     const rows=(await db.query(`select * from ${fn}($1::uuid,2020::smallint)`,[id(6001)])).rows;
     assert.equal(rows.find(r=>r.part_id===id(1600))?.confidence??'unverified',expected,fn);
    }
   };
   assert.deepEqual((await search(context)).map(r=>[r.part_id,r.confidence]),[[id(1601),'confirmed'],[id(1600),'buyer_verified'],[id(1599),'family_match'],[id(1598),'family_match']]);
   await parity('buyer_verified');
   for(const state of ['open','seller_response','under_review','return_authorized','return_shipped','returned']){
    await db.query("insert into transaction_cases(order_item_id,status,opened_by,case_type,reason,details,previous_fulfilment_status) values ($1,$2,$3,'return','Fixture return','Fixture return details','completed')",[id(2001),state,id(9002)]);await parity('unverified');await db.exec('delete from transaction_cases');
   }
   for(const assignment of ["refunded_at=now()","funds_released_at=null","payout_status='reversed'","fulfilment_status='dispatched'"]){
    await db.exec('savepoint invalidation');await db.exec(`update order_items set ${assignment} where id='${id(2001)}'`);await parity('unverified');await db.exec('rollback to invalidation');
   }
   await db.exec(`update orders set payment_status='unpaid' where id='${id(3001)}'`);await parity('unverified');
   await db.exec(`update orders set payment_status='paid';update verified_fit_feedback set result='did_not_fit' where order_item_id='${id(2001)}'`);await parity('unverified');
   await db.exec(`update orders set buyer_id='${id(9002)}';update verified_fit_feedback set result='exact_fit',buyer_id='${id(9002)}'`);await parity('unverified');
  });
  await scenario('public projection excludes deleted sellers and inactive listings even for authenticated admins',async()=>{
   await db.exec(`update sellers set account_deleted_at=now() where id='${id(8002)}';update parts set seller_id='${id(8002)}' where id='${id(1)}';update parts set status='draft' where id='${id(2)}'`);
   for(const role of ['anon','authenticated']){
    await db.exec(`set local role ${role}`);
    if(role==='authenticated')await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id(9001)]);
    const rows=await search();assert.ok(!rows.some(r=>[id(1),id(2)].includes(r.part_id)));
    const visible=await db.query('select id from sellers');assert.equal(visible.rows.length,role==='anon'?1:2);
    await db.exec('reset role');
   }
   const signature=await db.query("select prosecdef,provolatile,proconfig,proargtypes::regtype[]::text signature,proacl::text from pg_proc where proname='marketplace_search_page_v1'");
   assert.equal(signature.rows[0].prosecdef,true);assert.equal(signature.rows[0].provolatile,'s');assert.ok(signature.rows[0].proconfig.includes('search_path=""'));
   const identity=await db.query("select oidvectortypes(proargtypes) types from pg_proc where proname='marketplace_search_page_v1'");
   assert.equal(identity.rows[0].types,'text, text, uuid[], text, integer, integer, boolean, uuid, smallint, text, integer, uuid, boolean, double precision, double precision, uuid[], integer, integer');
   assert.ok(!/[{,]=X\//.test(signature.rows[0].proacl));
   assert.equal((await db.query("select has_table_privilege('anon','private.valid_verified_fit_feedback','select') allowed")).rows[0].allowed,false);
  });
  await scenario('invalid contexts reject and absent delivery/distance sort last',async()=>{
   for(const args of [{variant_id:id(6001)},{year:2020},{variant_id:id(6999),year:2020},{vehicle_id:id(5999)},{sort:'distance'},{buyer_lat:51},{buyer_lat:91,buyer_lon:0}]){
    await db.exec('savepoint bad_context');await assert.rejects(search(args),/Invalid/);await db.exec('rollback to bad_context');
   }
   await db.exec(`update parts set delivery_days_min=null where id='${id(1)}';update sellers set latitude=null where id='${id(8001)}';update parts set seller_id='${id(8002)}' where id='${id(1601)}'`);
   assert.notEqual((await search({sort:'delivery'}))[0].part_id,id(1));assert.equal((await search({sort:'distance',buyer_lat:51,buyer_lon:0}))[0].part_id,id(1601));
  });
 }finally{await db.close();}
});
