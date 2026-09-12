import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const api = await import('./qa-part-image-recovery.mjs');
const {FIXED}=api;
const prefix=`${FIXED.owner}/${FIXED.part}/`;
const existing=prefix+'11111111-1111-4111-8111-111111111111.png';
const orphan=prefix+'22222222-2222-4222-8222-222222222222.png';
const png=fs.readFileSync(new URL('../docs/test-runs/fixtures/qa-test-part.png',import.meta.url));
const hash=value=>createHash('sha256').update(value).digest('hex');
const sourceHash=hash(fs.readFileSync(new URL('../src/lib/part-image-cleanup.ts',import.meta.url)));
const migrationHash=hash(fs.readFileSync(new URL('../supabase/migrations/20260911213522_secure_part_image_cleanup.sql',import.meta.url)));
const deployment='dpl_syntheticPreview';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const sdk=fetch=>createClient(FIXED.origin,'synthetic-service-credential-only',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch}});

// The only simulated layer is remote HTTP and the controller's read-only SQL
// connection. SDK request construction and the actual worker are executed.
function fixture({alterObservation=()=>{},http=()=>null}={}) {
  const objects=new Map([[existing,png]]), rows=new Map(), calls=[], reports=[];
  const part={id:FIXED.part,seller_id:FIXED.seller,title:FIXED.title,status:'draft',price_pence:325,warranty_days:90};
  const photos=[{id:'33333333-3333-4333-8333-333333333333',part_id:FIXED.part,storage_path:existing,position:0}];
  const definitions=Object.fromEntries(['queue_orphan_part_image_cleanup','get_part_image_cleanup_queue','complete_part_image_cleanup','fail_part_image_cleanup','guard_part_image_attachment','can_upload_part_image','prevent_last_active_listing_image_delete','queue_part_images_before_parent_delete'].map(k=>[k,'a'.repeat(32)]));
  const wire=api.transport(async(input,init)=>{
    const url=new URL(input), method=init.method??'GET';
    const body=typeof init.body==='string'?JSON.parse(init.body):null;
    calls.push({url:url.pathname,method,body});
    const override=await http({url,method,body,objects,rows,calls,init});
    if (override) return override;
    if (url.pathname==='/storage/v1/object/list/part-images') return reply([...objects.keys()].sort().map(p=>({name:p.slice(prefix.length),id:p})));
    if (method==='GET') {
      const p=url.pathname.slice('/storage/v1/object/part-images/'.length);
      return objects.has(p)?new Response(objects.get(p)):reply({message:'absent'},404);
    }
    if (method==='DELETE') {objects.delete(body.prefixes[0]);return reply([]);}
    if (url.pathname.startsWith('/storage/v1/object/part-images/')) {
      const p=url.pathname.slice('/storage/v1/object/part-images/'.length);
      if (objects.has(p)) return reply({message:'already exists'},409);
      objects.set(p,Buffer.from(init.body));return reply({Key:'part-images/'+p});
    }
    const rpc=url.pathname.split('/').at(-1), p=body.p_storage_path;
    if (rpc==='queue_orphan_part_image_cleanup') {
      rows.set(p,{storage_path:p,owner_id:FIXED.owner,seller_id:FIXED.seller,part_id:FIXED.part,created_at:new Date().toISOString(),completed_at:null,failure_count:0,last_error:null,next_attempt_at:new Date().toISOString()});
      return reply(true);
    }
    if (rpc==='get_part_image_cleanup_queue') return reply(rows.has(p) && !rows.get(p).completed_at?[{storage_path:p}]:[]);
    if (rpc==='fail_part_image_cleanup') {Object.assign(rows.get(p),{failure_count:rows.get(p).failure_count+1,last_error:'storage_cleanup_failed',next_attempt_at:new Date(Date.now()+300000).toISOString()});return new Response(null,{status:204});}
    if (rpc==='complete_part_image_cleanup') {Object.assign(rows.get(p),{completed_at:new Date().toISOString(),last_error:null});return reply(true);}
    throw new Error('Unexpected synthetic endpoint');
  });
  const observe=async challenge=>{
    const value=structuredClone({stage:challenge.stage,nonce:challenge.nonce,observedAt:new Date().toISOString(),part,seller:{id:FIXED.seller,owner_id:FIXED.owner},orderCount:0,photos,outbox:[...rows.values()].sort((a,b)=>a.storage_path.localeCompare(b.storage_path)),migration:[{version:'20260911221033',name:'secure_part_image_cleanup'}],definitions,
      review:{project:FIXED.origin,deployment,definitionsReviewed:true,policiesReviewed:true,workerSha256:sourceHash,migrationSha256:migrationHash}});
    await alterObservation(value,{objects,rows,part,photos});return value;
  };
  return {wire,objects,rows,calls,reports,run:()=>api.recover({client:sdk(wire.fetch),wire,observe,deployment,emit:r=>reports.push(r)})};
}
test('runner defaults to no execution or configuration access', async () => {
  assert.equal(typeof api.main, 'function');
  assert.deepEqual(await api.main([], {emit:()=>{}}), {mode:'dry-run'});
});

test('installed SDK download passes the safe exact-fixture read boundary', async()=>{
  const wire=api.transport(async()=>new Response(png));
  const result=await sdk(wire.fetch).storage.from('part-images').download(existing);
  assert.equal(result.error,null);
  assert.equal(hash(Buffer.from(await result.data.arrayBuffer())),hash(png));
});

test('transport rejects Request PUT to existing photo before forwarding',async()=>{
  let calls=0;
  const wire=api.transport(async()=>{calls++;return reply({});});
  const request=new Request(FIXED.origin+'/storage/v1/object/part-images/'+existing,{method:'PUT',body:png});
  await assert.rejects(wire.fetch(request));
  assert.equal(calls,0);
});

test('transport refuses repeated uploads and a third synthetic path', async()=>{
  const wire=api.transport(async()=>reply({}));
  const client=sdk(wire.fetch);
  wire.configure(orphan);
  assert.equal((await client.storage.from('part-images').upload(orphan,png,{upsert:false})).error,null);
  assert.ok((await client.storage.from('part-images').upload(orphan,png,{upsert:false})).error);
  wire.configure(prefix+'44444444-4444-4444-8444-444444444444.png');
  assert.throws(()=>wire.configure(prefix+'55555555-5555-4555-8555-555555555555.png'));
});

test('full recovery uses two synthetic injections and three forwarded removals, preserving existing bytes', async()=>{
  const f=fixture();const result=await f.run();
  assert.equal(result.stage,'complete');
  assert.equal(f.calls.filter(c=>c.method==='DELETE').length,3);
  assert.equal(f.calls.filter(c=>c.url.endsWith('/complete_part_image_cleanup')).length,2);
  assert.equal(f.wire.events.filter(e=>e.injected).length,2);
  assert.equal(f.rows.size,2);
  assert.ok([...f.rows.values()].every(r=>r.completed_at && r.failure_count===1));
  assert.deepEqual([...f.objects.keys()],[existing]);
  assert.equal(hash(f.objects.get(existing)),hash(png));
  assert.deepEqual(result.workerRuns.map(r=>({stage:r.stage,result:r.result})),[
    {stage:'failure-worker-0',result:{checked:1,completed:0,failed:1}},
    {stage:'retry-worker-0',result:{checked:1,completed:1,failed:0}},
    {stage:'failure-worker-1',result:{checked:1,completed:0,failed:1}},
    {stage:'retry-worker-1',result:{checked:1,completed:1,failed:0}},
  ]);
  assert.equal(result.fixturePngHash,hash(png));
});

test('unreviewed definitions cannot cause any provider request', async()=>{
  const f=fixture({alterObservation:v=>{v.review.definitionsReviewed=false;}});
  await assert.rejects(f.run());assert.equal(f.calls.length,0);
});

test('retained orphan bytes must match uploaded QA bytes before retry', async()=>{
  const f=fixture({alterObservation:(v,{objects})=>{if(v.stage==='failed-0') for(const p of objects.keys()) if(p!==existing) objects.set(p,Buffer.from('corrupted'));}});
  await assert.rejects(f.run());
  assert.equal(f.calls.filter(c=>c.method==='DELETE').length,0);
  assert.equal(f.rows.size,1);
});

for (const [name,mutate] of [
  ['owner mismatch',v=>v.seller.owner_id='someone-else'],
  ['seller mismatch',v=>v.part.seller_id='someone-else'],
  ['part mismatch',v=>v.part.id='someone-else'],
  ['non-QA title',v=>v.part.title='Real member listing'],
  ['reserved part',v=>v.part.status='reserved'],
  ['existing order',v=>v.orderCount=1],
  ['missing order count',v=>delete v.orderCount],
  ['foreign photo prefix',v=>v.photos[0].storage_path='another-owner/part/file.png'],
  ['missing photos',v=>v.photos=[]],
  ['wrong migration version',v=>v.migration[0].version='20260911213522'],
  ['missing function definition',v=>delete v.definitions.complete_part_image_cleanup],
  ['missing observation',()=>null],
  ['stale observation',v=>v.observedAt=new Date(Date.now()-180000).toISOString()],
  ['future observation',v=>v.observedAt=new Date(Date.now()+60000).toISOString()],
  ['mismatched challenge',v=>v.nonce='old-challenge'],
  ['wrong deployment review',v=>v.review.deployment='dpl_wrong'],
  ['missing review',v=>delete v.review],
  ['unreviewed policies',v=>v.review.policiesReviewed=false],
  ['wrong worker source review',v=>v.review.workerSha256='0'.repeat(64)],
  ['pre-existing pending work',v=>v.outbox=[{storage_path:orphan,owner_id:FIXED.owner,seller_id:FIXED.seller,part_id:FIXED.part,completed_at:null}]],
]) {
  test(`preflight ${name} stops before all provider requests`,async()=>{
    const f=fixture({alterObservation:v=>{if(name==='missing observation') {v.stage=null;} else mutate(v);}});
    await assert.rejects(f.run());assert.equal(f.calls.length,0);
  });
}

for (const [name,stage,mutate] of [
  ['changed listing','before-upload-0',v=>v.part.price_pence=999],
  ['changed photo metadata','before-upload-0',v=>v.photos[0].position=3],
  ['changed definitions','before-upload-0',v=>v.definitions.fail_part_image_cleanup='b'.repeat(32)],
  ['queue row missing','queued-0',v=>v.outbox=[]],
  ['missing durable failure','failed-0',v=>v.outbox[0].failure_count=0],
  ['missing deferred retry','failed-0',v=>v.outbox[0].next_attempt_at=new Date(0).toISOString()],
  ['premature completion','failed-0',v=>v.outbox[0].completed_at=new Date().toISOString()],
  ['missing completed tombstone','completed-0',v=>v.outbox=[]],
  ['changed existing metadata at end','final',v=>v.photos[0].alt_text='Changed'],
]) {
  test(`${name} stops at its evidence checkpoint without broadening cleanup`,async()=>{
    const f=fixture({alterObservation:v=>{if(v.stage===stage)mutate(v);}});
    await assert.rejects(f.run(),new RegExp(`recovery-stopped-${stage}`));
    assert.ok(f.rows.size<=2);
    assert.equal(hash(f.objects.get(existing)),hash(png));
    assert.ok(f.calls.filter(c=>c.method==='DELETE').every(c=>c.body.prefixes.length===1 && c.body.prefixes[0]!==existing));
  });
}

for (const [name,http,stopStage] of [
  ['Storage list error',({url})=>url.pathname.includes('/object/list/')?reply({message:'secret-provider-body'},403):null,'preflight'],
  ['list overflow',({url})=>url.pathname.includes('/object/list/')?reply(Array.from({length:100},(_,i)=>({id:String(i),name:'11111111-1111-4111-8111-111111111111.png'}))):null,'preflight'],
  ['unexpected folder',({url})=>url.pathname.includes('/object/list/')?reply([{name:'nested',id:null}]):null,'preflight'],
  ['upload rejected',({url,method})=>method==='POST' && url.pathname.includes('/object/part-images/')?reply({message:'secret-provider-body'},403):null,'upload-0'],
  ['queue false',({url})=>url.pathname.endsWith('/queue_orphan_part_image_cleanup')?reply(false):null,'upload-0'],
  ['queue network uncertainty',({url})=>{if(url.pathname.endsWith('/queue_orphan_part_image_cleanup'))throw new Error('secret-provider-body');},'upload-0'],
  ['unauthorized queue path',({url})=>url.pathname.endsWith('/get_part_image_cleanup_queue')?reply([{storage_path:existing}]):null,'failure-worker-0'],
  ['zero-row worker',({url})=>url.pathname.endsWith('/get_part_image_cleanup_queue')?reply([]):null,'failure-worker-0'],
  ['retry provider failure',({method})=>method==='DELETE'?reply({message:'secret-provider-body'},503):null,'retry-worker-0'],
  ['negative acknowledgment',({url})=>url.pathname.endsWith('/complete_part_image_cleanup')?reply(false):null,'retry-worker-0'],
]) {
  test(`${name} never becomes a PASS or modifies existing bytes`,async()=>{
    const f=fixture({http});await assert.rejects(f.run(),new RegExp(`recovery-stopped-${stopStage}`));
    assert.equal(hash(f.objects.get(existing)),hash(png));
    assert.ok(!JSON.stringify(f.reports).includes('secret-provider-body'));
    assert.ok(!f.reports.some(r=>r.stage==='complete'));
  });
}

test('definition and review JSON property order does not change their meaning',async()=>{
  const f=fixture({alterObservation:v=>{
    v.review=Object.fromEntries(Object.entries(v.review).reverse());
    if(v.stage!=='preflight') v.definitions=Object.fromEntries(Object.entries(v.definitions).reverse());
  }});
  assert.equal((await f.run()).stage,'complete');
});

test('new unrelated outbox intent aborts before any upload',async()=>{
  const f=fixture({alterObservation:v=>{
    if(v.stage==='before-upload-0')v.outbox.push({storage_path:orphan,owner_id:FIXED.owner,seller_id:FIXED.seller,part_id:FIXED.part,completed_at:null});
  }});
  await assert.rejects(f.run(),/recovery-stopped-before-upload-0/);
  assert.equal(f.calls.filter(c=>c.method==='POST' && c.url.includes('/object/part-images/')).length,0);
});

for (const [name,url,init] of [
  ['Auth',FIXED.origin+'/auth/v1/user',{method:'GET'}],
  ['other host','https://unexpected.test/storage/v1/object/list/part-images',{method:'POST',body:'{}'}],
  ['metadata write',FIXED.origin+'/rest/v1/part_images',{method:'POST',body:'{}'}],
  ['broad queue',FIXED.origin+'/rest/v1/rpc/get_part_image_cleanup_queue',{method:'POST',body:'{"p_limit":50}'}],
  ['foreign removal',FIXED.origin+'/storage/v1/object/part-images',{method:'DELETE',body:JSON.stringify({prefixes:[existing]})}],
  ['multi-removal',FIXED.origin+'/storage/v1/object/part-images',{method:'DELETE',body:JSON.stringify({prefixes:[orphan,existing]})}],
  ['upsert',FIXED.origin+'/storage/v1/object/part-images/'+orphan,{method:'POST',headers:{'x-upsert':'true'},body:png}],
  ['malformed JSON',FIXED.origin+'/rest/v1/rpc/get_part_image_cleanup_queue',{method:'POST',body:'not-json'}],
]) {
  test(`transport blocks ${name} before forwarding`,async()=>{
    let calls=0;const wire=api.transport(async()=>{calls++;return reply({});});wire.configure(orphan);
    await assert.rejects(wire.fetch(url,init));assert.equal(calls,0);
  });
}

test('unknown CLI flags never open a config file',async()=>{
  await assert.rejects(api.main(['--execute','--env-file','not-a-file']));
});

test('env parser reads only required literal data and rejects missing/duplicate configuration',()=>{
  const valid=`NEXT_PUBLIC_SUPABASE_URL="${FIXED.origin}"\nSUPABASE_SERVICE_ROLE_KEY=synthetic-service-key-value\nQA_PREVIEW_DEPLOYMENT_ID=${deployment}`;
  const result=api.parseConfig(valid+'\nSTRIPE_SECRET_KEY=$(do-not-evaluate)');
  assert.deepEqual(Object.keys(result),['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','QA_PREVIEW_DEPLOYMENT_ID']);
  assert.throws(()=>api.parseConfig(valid+'\nNEXT_PUBLIC_SUPABASE_URL='+FIXED.origin));
  assert.throws(()=>api.parseConfig(valid.replace('QA_PREVIEW_DEPLOYMENT_ID='+deployment,'')));
});

test('Storage success without byte deletion fails authoritative completion readback',async()=>{
  const f=fixture({http:({method})=>method==='DELETE'?reply([]):null});
  await assert.rejects(f.run(),/recovery-stopped-completed-0/);
  assert.equal(f.rows.size,1);
});

test('absent-object provider rejection leaves B pending instead of claiming retry success',async()=>{
  const f=fixture({http:({method,body,objects})=>method==='DELETE' && !objects.has(body.prefixes[0])?reply({message:'absent not accepted'},404):null});
  await assert.rejects(f.run(),/recovery-stopped-retry-worker-1/);
  const pending=[...f.rows.values()].filter(q=>!q.completed_at);
  assert.equal(pending.length,1);
  assert.equal(pending[0].failure_count,2);
  assert.equal(f.objects.has(pending[0].storage_path),false);
});

test('failure recording error cannot stand in for a durable deferred row',async()=>{
  const f=fixture({http:({url})=>url.pathname.endsWith('/fail_part_image_cleanup')?reply({message:'unavailable'},503):null});
  await assert.rejects(f.run(),/recovery-stopped-failed-0/);
  assert.equal(f.calls.filter(c=>c.method==='DELETE').length,0);
});

test('queue uncertainty leaves the uploaded orphan intact and does not delete without authority',async()=>{
  const f=fixture({http:({url})=>url.pathname.endsWith('/queue_orphan_part_image_cleanup')?reply({message:'unavailable'},503):null});
  await assert.rejects(f.run(),/recovery-stopped-upload-0/);
  assert.equal(f.objects.size,2);assert.equal(f.rows.size,0);
  assert.equal(f.calls.filter(c=>c.method==='DELETE').length,0);
  assert.equal(f.reports.at(-1).generatedPaths.length,1);
});

for(const problem of ['list failure','extra object','modified bytes']) {
  test(`final ${problem} cannot produce a PASS`,async()=>{
    let final=false;
    const f=fixture({alterObservation:(v,{objects})=>{
      if(v.stage==='final'){
        final=true;
        if(problem==='extra object')objects.set(orphan,png);
        if(problem==='modified bytes')objects.set(existing,Buffer.from('modified'));
      }
    },http:({url})=>final && problem==='list failure' && url.pathname.includes('/object/list/')?reply({message:'not an absence'},401):null});
    await assert.rejects(f.run(),/recovery-stopped-final/);
    assert.ok(!f.reports.some(r=>r.stage==='complete'));
  });
}

test('SQL checkpoint challenge rejects injection text and unsafe generated paths',()=>{
  assert.throws(()=>api.checkpointSql("preflight';delete",'22222222-2222-4222-8222-222222222222',[]));
  assert.throws(()=>api.checkpointSql('preflight','not-a-nonce',[]));
  assert.throws(()=>api.checkpointSql('preflight','22222222-2222-4222-8222-222222222222',["bad';delete"]));
});
test('configuration rejects project substitution and executable env syntax', () => {
  assert.equal(typeof api.parseConfig, 'function');
  for (const source of ['NEXT_PUBLIC_SUPABASE_URL=https://wrong.supabase.co', 'SUPABASE_SERVICE_ROLE_KEY=$(whoami)', 'export SUPABASE_SERVICE_ROLE_KEY=x']) {
    assert.throws(()=>api.parseConfig(source));
  }
});
