// Local controller-operated recovery QA. Never import this from application code.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash, randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createInterface} from 'node:readline';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';

export const FIXED = Object.freeze({
  origin:'https://etkupijfdznljimrfyct.supabase.co',
  owner:'cf2ef681-9ced-4fb8-9a50-efd5668138b0',
  seller:'58ecccc3-5162-4826-9c3f-81dbd92a6007',
  part:'760fdafa-e589-449e-9296-397f76c74bd2',
  title:'[QA TEST] Photo integrity fixture',
});
const prefix = `${FIXED.owner}/${FIXED.part}/`;
const root = path.resolve(import.meta.dirname, '..');
const sourcePath = path.join(root,'src/lib/part-image-cleanup.ts');
const migrationPath = path.join(root,'supabase/migrations/20260911213522_secure_part_image_cleanup.sql');
const pngPath = path.join(root,'docs/test-runs/fixtures/qa-test-part.png');
const digest = value => createHash('sha256').update(value).digest('hex');
const check = (ok, stage) => {if (!ok) throw new Error(stage);};
const ordered = value => Array.isArray(value)?value.map(ordered):value && typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])])):value;
const same = (a,b) => JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
const owned = value => typeof value==='string' && value.startsWith(prefix) && /^[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$/.test(value.slice(prefix.length));

export function parseConfig(source) {
  const config = {};
  const allow = new Set(['NEXT_PUBLIC_SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','QA_PREVIEW_DEPLOYMENT_ID']);
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    check(match, 'config-format');
    if (!allow.has(match[1])) continue; // Never evaluate or load unrelated provider config.
    check(!(match[1] in config), 'config-duplicate');
    let value=match[2];
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) value=value.slice(1,-1);
    check(value && !/[\s$`\\"']/.test(value),'config-value');
    config[match[1]]=value;
  }
  check(config.NEXT_PUBLIC_SUPABASE_URL===FIXED.origin,'config-project');
  check(/^[A-Za-z0-9._-]{20,}$/.test(config.SUPABASE_SERVICE_ROLE_KEY??''),'config-service-key');
  check(/^dpl_[A-Za-z0-9]+$/.test(config.QA_PREVIEW_DEPLOYMENT_ID??''),'config-deployment');
  return config;
}

export function loadWorker(client) {
  const exports={};
  const deps={'server-only':{},'@/lib/supabase/admin':{createSupabaseAdminClient:()=>client},'@/lib/ops-monitoring':{reportOperationalWarning(){}}};
  const code=ts.transpileModule(fs.readFileSync(sourcePath,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,require(name){check(name in deps,'worker-import');return deps[name];}});
  return exports.processPartImageCleanup;
}

// The SDK fetch boundary is also a deny-by-default firewall. No Auth/metadata
// writes/maintenance are admitted even if a future SDK or worker changes.
export function transport(forward) {
  let current=null, mode=null, injected=false;
  const registered=new Set(), uploads=new Set();
  const events=[];
  const configure=(p,m=null)=>{
    check(owned(p) && [null,'storage503','preack503'].includes(m),'transport-path');
    check(registered.has(p) || registered.size<2,'transport-path-budget');
    registered.add(p);current=p;mode=m;injected=false;
  };
  const fetch=async(input,init={})=>{
    // Installed SDK calls use string URLs. A Request can carry a hidden method,
    // body or headers that differ from init; reject it rather than misclassify it.
    check(typeof input==='string','transport-input');
    const url=new URL(input);
    const method=(init.method??'GET').toUpperCase();
    check(url.origin===FIXED.origin && !url.search,'transport-origin');
    let body;
    if (typeof init.body==='string') {try {body=JSON.parse(init.body);} catch {throw new Error('transport-json');}}
    let operation;
    if (method==='DELETE' && url.pathname==='/storage/v1/object/part-images' && same(body,{prefixes:[current]})) operation='remove';
    if (method==='POST' && url.pathname===`/storage/v1/object/part-images/${current}` && new Headers(init.headers).get('x-upsert')==='false') operation='upload';
    if (method==='POST' && url.pathname==='/storage/v1/object/list/part-images' && body?.prefix===prefix.slice(0,-1) && body.limit===100 && body.offset===0 && same(body.sortBy,{column:'name',order:'asc'}) && Object.keys(body).sort().join(',')==='limit,offset,prefix,sortBy') operation='list';
    if (method==='GET' && url.pathname.startsWith('/storage/v1/object/part-images/') && owned(decodeURIComponent(url.pathname.slice('/storage/v1/object/part-images/'.length)))) operation='download';
    const rpc=url.pathname.replace('/rest/v1/rpc/','');
    if (method==='POST' && current) {
      if (rpc==='get_part_image_cleanup_queue' && same(body,{p_limit:1,p_storage_path:current})) operation='queue-read';
      if (rpc==='queue_orphan_part_image_cleanup' && same(body,{p_owner_id:FIXED.owner,p_part_id:FIXED.part,p_storage_path:current})) operation='queue';
      if (['complete_part_image_cleanup','fail_part_image_cleanup'].includes(rpc) && same(body,{p_storage_path:current})) operation=rpc.startsWith('complete')?'ack':'fail';
    }
    check(operation,'transport-operation');
    if (operation==='upload') {check(!uploads.has(current),'transport-upload-single-use');uploads.add(current);}
    if (!injected && (mode==='storage503' && operation==='remove' || mode==='preack503' && operation==='ack')) {
      injected=true;events.push({operation,injected:true,status:503});
      return new Response(JSON.stringify({statusCode:'503',error:'QA controlled failure',message:'QA controlled failure'}),{status:503,headers:{'content-type':'application/json'}});
    }
    try {
      const response=await forward(input,{...init,redirect:'error'});
      events.push({operation,injected:false,status:response.status});
      return response;
    } catch {events.push({operation,injected:false,status:0});throw new Error('provider-network');}
  };
  return {fetch,configure,events};
}

export function checkpointSql(stage,nonce,paths) {
  check(/^[a-z0-9-]+$/.test(stage) && /^[0-9a-f-]{36}$/.test(nonce),'checkpoint-token');
  check(paths.length<=2 && paths.every(owned),'checkpoint-path');
  // All SQL identifiers and predicates are fixed; only generated, validated UUID paths vary.
  return `select json_build_object(
 'stage','${stage}','nonce','${nonce}','observedAt',clock_timestamp(),
 'part',(select row_to_json(p) from public.parts p where p.id='${FIXED.part}'),
 'seller',(select json_build_object('id',s.id,'owner_id',s.owner_id) from public.sellers s where s.id='${FIXED.seller}'),
 'orderCount',(select count(*) from public.order_items where part_id='${FIXED.part}'),
 'photos',(select coalesce(json_agg(i order by i.id),'[]'::json) from public.part_images i where part_id='${FIXED.part}'),
 'outbox',(select coalesce(json_agg(q order by q.storage_path),'[]'::json) from private.part_image_cleanup q where part_id='${FIXED.part}'),
 'migration',(select coalesce(json_agg(json_build_object('version',version,'name',name)),'[]'::json) from supabase_migrations.schema_migrations where name='secure_part_image_cleanup'),
 'definitions',(select json_object_agg(p.proname,md5(pg_get_functiondef(p.oid))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in ('queue_orphan_part_image_cleanup','get_part_image_cleanup_queue','complete_part_image_cleanup','fail_part_image_cleanup')) or (n.nspname='private' and p.proname in ('guard_part_image_attachment','can_upload_part_image','prevent_last_active_listing_image_delete','queue_part_images_before_parent_delete')))
 ) as observation;`;
}

export function validateObservation(value,{stage,nonce,since},baseline=null) {
  check(value?.stage===stage && value.nonce===nonce,'checkpoint-identity');
  const observed=Date.parse(value.observedAt);
  check(Number.isFinite(observed) && observed>=since-5000 && observed<=Date.now()+5000 && Date.now()-observed<120000,'checkpoint-freshness');
  check(value.part?.id===FIXED.part && value.part.seller_id===FIXED.seller && value.part.title===FIXED.title && value.part.status==='draft','fixture-part');
  check(value.seller?.id===FIXED.seller && value.seller.owner_id===FIXED.owner && value.orderCount===0,'fixture-owner-orders');
  check(Array.isArray(value.photos) && value.photos.length>0 && value.photos.every(p=>p.part_id===FIXED.part && owned(p.storage_path)),'fixture-photos');
  check(Array.isArray(value.outbox) && value.outbox.every(q=>q.part_id===FIXED.part && q.owner_id===FIXED.owner && q.seller_id===FIXED.seller && owned(q.storage_path)),'fixture-outbox');
  check(same(value.migration,[{version:'20260911221033',name:'secure_part_image_cleanup'}]),'fixture-migration');
  const functions=['queue_orphan_part_image_cleanup','get_part_image_cleanup_queue','complete_part_image_cleanup','fail_part_image_cleanup','guard_part_image_attachment','can_upload_part_image','prevent_last_active_listing_image_delete','queue_part_images_before_parent_delete'];
  check(value.definitions && Object.keys(value.definitions).length===8 && functions.every(k=>/^[0-9a-f]{32}$/.test(value.definitions[k])),'fixture-definitions');
  if (baseline) for (const key of ['part','seller','photos','migration','definitions']) check(same(value[key],baseline[key]),`unchanged-${key}`);
  return value;
}

export async function recover({client,wire,observe,deployment,emit=()=>{}}) {
  const png=fs.readFileSync(pngPath);
  let stage='preflight';
  let baseline;
  const paths=[];
  const workerRuns=[];
  const snapshot=async(name)=>{
    stage=name;
    const challenge={stage,nonce:randomUUID(),since:Date.now()};
    const value=await observe({...challenge,generatedPaths:[...paths],sql:checkpointSql(stage,challenge.nonce,paths)});
    validateObservation(value,challenge,baseline);
    if (baseline) check(same(value.outbox.filter(q=>!paths.includes(q.storage_path)),baseline.outbox),'unchanged-existing-outbox');
    return value;
  };
  const storage=client.storage.from('part-images');
  const list=async()=>{
    const result=await storage.list(prefix.slice(0,-1),{limit:100,offset:0,sortBy:{column:'name',order:'asc'}});
    check(!result.error && Array.isArray(result.data) && result.data.length<100 && result.data.every(o=>o.id && owned(prefix+o.name)),'storage-authoritative-list');
    return result.data.map(o=>o.name).sort();
  };
  const hashes=async(names)=>{
    const result=[];
    for (const name of names) {
      const response=await storage.download(prefix+name);
      check(!response.error && response.data,'storage-existing-bytes');
      result.push([name,digest(Buffer.from(await response.data.arrayBuffer()))]);
    }
    return result;
  };
  const intent=(value,p,completed,failures)=>{
    const rows=value.outbox.filter(q=>q.storage_path===p);
    check(rows.length===1,'intent-exact');
    const row=rows[0];
    check(Boolean(row.completed_at)===completed && row.failure_count===failures,'intent-state');
    if (failures && !completed) check(row.last_error==='storage_cleanup_failed' && Date.parse(row.next_attempt_at)>Date.parse(value.observedAt),'intent-deferred');
    if (completed) check(row.last_error===null,'intent-acknowledged');
  };
  try {
    baseline=await snapshot('preflight');
    check(same(baseline.review,{project:FIXED.origin,deployment,definitionsReviewed:true,policiesReviewed:true,workerSha256:digest(fs.readFileSync(sourcePath)),migrationSha256:digest(fs.readFileSync(migrationPath))}) && /^dpl_[A-Za-z0-9]+$/.test(deployment??''),'controller-definition-review');
    check(baseline.outbox.every(q=>q.completed_at),'baseline-pending-work');
    const before=await list(), beforeHashes=await hashes(before);
    check(baseline.photos.every(p=>before.includes(p.storage_path.slice(prefix.length))),'baseline-attached-bytes');
    const worker=loadWorker(client);
    const runWorker=async(p)=>{
      const start=wire.events.length;
      const result={...await worker(1,p)};
      workerRuns.push({stage,result,http:wire.events.slice(start)});
      return result;
    };
    for (const [index,mode] of ['storage503','preack503'].entries()) {
      const p=prefix+randomUUID()+'.png';
      check(!before.includes(p.slice(prefix.length)) && !baseline.outbox.some(q=>q.storage_path===p),'unique-path');
      paths.push(p);wire.configure(p);
      await snapshot(`before-upload-${index}`);
      stage=`upload-${index}`;
      const uploaded=await storage.upload(p,png,{contentType:'image/png',upsert:false});
      check(!uploaded.error,'upload-result');
      const queued=await client.rpc('queue_orphan_part_image_cleanup',{p_owner_id:FIXED.owner,p_part_id:FIXED.part,p_storage_path:p});
      check(!queued.error && queued.data===true,'queue-affirmative');
      intent(await snapshot(`queued-${index}`),p,false,0);
      wire.configure(p,mode);
      const start=wire.events.length;
      stage=`failure-worker-${index}`;
      check(same(await runWorker(p),{checked:1,completed:0,failed:1}),'worker-failure-counts');
      const failedEvents=wire.events.slice(start);
      check(failedEvents.filter(e=>e.injected).length===1,'injection-exactly-once');
      check(failedEvents.filter(e=>e.operation==='remove' && !e.injected && e.status>=200 && e.status<300).length===index,'failure-forwarded-removals');
      check(!failedEvents.some(e=>e.operation==='ack' && !e.injected),'ack-not-forwarded');
      intent(await snapshot(`failed-${index}`),p,false,1);
      check((await list()).includes(p.slice(prefix.length))===(index===0),'failure-authoritative-presence');
      if (index===0) check((await hashes([p.slice(prefix.length)]))[0][1]===digest(png),'failure-retained-bytes');
      wire.configure(p);
      const retryStart=wire.events.length;
      stage=`retry-worker-${index}`;
      check(same(await runWorker(p),{checked:1,completed:1,failed:0}),'worker-retry-counts');
      const retry=wire.events.slice(retryStart);
      for (const operation of ['remove','ack']) check(retry.filter(e=>e.operation===operation && !e.injected && e.status>=200 && e.status<300).length===1,'retry-provider-counts');
      intent(await snapshot(`completed-${index}`),p,true,1);
      check(!(await list()).includes(p.slice(prefix.length)),'completed-authoritative-absence');
    }
    const final=await snapshot('final');
    check(same(final.outbox.filter(q=>!paths.includes(q.storage_path)),baseline.outbox) && final.outbox.length===baseline.outbox.length+2,'unchanged-existing-outbox');
    paths.forEach(p=>intent(final,p,true,1));
    check(same(await list(),before) && same(await hashes(before),beforeHashes),'unchanged-storage');
    const report={stage:'complete',syntheticOrphans:2,attachedPhotos:baseline.photos.length,existingHashes:beforeHashes.map(([,hash])=>hash),fixturePngHash:digest(png),workerHash:digest(fs.readFileSync(sourcePath)),workerRuns,http:wire.events};
    emit(report);return report;
  } catch {
    emit({stage,status:'failed',generatedPaths:paths,workerRuns,http:wire.events,action:'STOP; retain pending evidence; controller exact-path review required'});
    throw new Error(`recovery-stopped-${stage}`);
  }
}

export async function main(args,{emit=value=>console.log(JSON.stringify(value))}={}) {
  if (!args.length || same(args,['--dry-run'])) {emit({mode:'dry-run',providerCalls:0,configRead:false});return {mode:'dry-run'};}
  check(args.length===3 && args[0]==='--execute-recovery' && args[1]==='--env-file','execution-opt-in');
  check(execFileSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'}).trim()==='rebuild-nextjs','execution-branch');
  const envPath=fs.realpathSync(path.resolve(args[2]));
  const relative=path.relative(root,envPath);
  check(relative && !relative.startsWith('..') && !path.isAbsolute(relative),'config-workspace');
  execFileSync('git',['check-ignore','--quiet','--',relative],{cwd:root,stdio:'ignore'});
  const config=parseConfig(fs.readFileSync(envPath,'utf8'));
  const wire=transport(globalThis.fetch);
  const client=createClient(FIXED.origin,config.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:wire.fetch}});
  // JSON lines only. A fresh challenge binds each independently performed SQL read.
  const input=createInterface({input:process.stdin,crlfDelay:Infinity});
  const iterator=input[Symbol.asyncIterator]();
  try {
    await recover({client,wire,emit,deployment:config.QA_PREVIEW_DEPLOYMENT_ID,observe:async challenge=>{
      emit({checkpoint:challenge.stage,nonce:challenge.nonce,generatedPaths:challenge.generatedPaths,sql:challenge.sql,requires:'Controller verified exact Preview deployment/project and current definitions; paste fresh observation JSON',deployment:config.QA_PREVIEW_DEPLOYMENT_ID,...(challenge.stage==='preflight'?{requiredReview:{project:FIXED.origin,deployment:config.QA_PREVIEW_DEPLOYMENT_ID,definitionsReviewed:true,policiesReviewed:true,workerSha256:digest(fs.readFileSync(sourcePath)),migrationSha256:digest(fs.readFileSync(migrationPath))}}:{})});
      const next=await iterator.next();
      check(!next.done && next.value.length<200000,'checkpoint-input');
      return JSON.parse(next.value);
    }});
  } finally {input.close();config.SUPABASE_SERVICE_ROLE_KEY='';}
}

if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(()=>{console.error(JSON.stringify({status:'failed',action:'Stop and inspect last safe stage; no automatic cleanup or provider retry.'}));process.exitCode=1;});
}
