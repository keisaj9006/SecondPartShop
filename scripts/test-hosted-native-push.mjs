import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as crypto from "node:crypto";
const root=path.resolve(import.meta.dirname,"..");
const compile=p=>ts.transpileModule(fs.readFileSync(path.join(root,p),"utf8"),{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;

test("hosted Capacitor receives and routes push without the legacy shell bridge",async()=>{
 const listeners=new Map(),removed=[],calls=[];
 let effect;
 const plugin={addListener(event,cb){listeners.set(event,cb);return Promise.resolve({remove(){removed.push(event);}});}};
 const nativeWindow={location:{origin:"https://secondpart.example"},Capacitor:{isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{PushNotifications:plugin}}};
 const load=p=>{
  const exports={};
  vm.runInNewContext(compile(p),{exports,URL,Promise,setTimeout,clearTimeout,window:nativeWindow,document:{documentElement:{classList:{toggle(){},remove(){}}}},require(name){
   if(name==="react")return {useEffect:fn=>{effect=fn;}};
   if(name==="next/navigation")return {useRouter:()=>({push:href=>calls.push(["push",href]),refresh:()=>calls.push(["refresh"]),replace(){}})};
   if(name==="@/lib/native-push")return load("src/lib/native-push.ts");
   throw new Error(`Unexpected import ${name}`);
  }});return exports;
 };
 load("src/components/native-app-mode.tsx").NativeAppMode();
 const cleanup=effect();
 await Promise.resolve();await Promise.resolve();await Promise.resolve();
 assert.equal(typeof listeners.get("pushNotificationReceived"),"function");
 assert.equal(typeof listeners.get("pushNotificationActionPerformed"),"function");
 listeners.get("pushNotificationReceived")({data:{}});
 listeners.get("pushNotificationActionPerformed")({notification:{data:{href:"/notifications"}}});
 assert.deepEqual(calls,[["refresh"],["push","/notifications"]]);
 for(const href of ["https://attacker.example/", "//attacker.example/", "/\\attacker.example", "/%2f%2fattacker.example", "/bad\npath"]){listeners.get("pushNotificationActionPerformed")({notification:{data:{href}}});}
 assert.equal(calls.length,2);
 cleanup();await Promise.resolve();await Promise.resolve();
 assert.deepEqual(removed.sort(),["pushNotificationActionPerformed","pushNotificationReceived"]);
 listeners.get("pushNotificationReceived")({});assert.equal(calls.length,2);
});

test("sign-out detaches this installation before clearing authentication",async()=>{
 const calls=[];
 const exports={};
 vm.runInNewContext(compile("src/app/auth/actions.ts"),{exports,process,require(name){
  if(name==="next/cache")return {revalidatePath(){}};
  if(name==="next/headers")return {};
  if(name==="next/navigation")return {redirect:href=>calls.push(["redirect",href])};
  if(name==="@/lib/supabase/env")return {isSupabaseConfigured:()=>true};
  if(name==="@/lib/supabase/server")return {createSupabaseServerClient:async()=>({auth:{signOut:async()=>calls.push(["signOut"])}})};
  if(name==="@/lib/push/hosted-device")return {detachHostedPushDevice:async()=>{calls.push(["detach"]);return true;}};
  return {};
 }});
 await exports.signOut();
 assert.deepEqual(calls,[["detach"],["signOut"],["redirect","/"]]);
});

function adapterHarness({native=true,permission="granted",error=false,coordination=true}={}){
 const calls=[],listeners=new Map(),removed=[];
 const push={
  async checkPermissions(){calls.push("check");return {receive:permission};},
  async requestPermissions(){calls.push("prompt");return {receive:"granted"};},
  addListener(event,cb){listeners.set(event,cb);return Promise.resolve({remove(){removed.push(event);listeners.delete(event);}});},
  async register(){calls.push("register");listeners.get(error?"registrationError":"registration")(error?{error:"private diagnostics"}:{value:"fixture-device-token-for-hosted-android"});},
  async unregister(){calls.push("unregister");}
 };
 const exports={};
 vm.runInNewContext(compile("src/lib/native-push.ts"),{exports,URL,Promise,setTimeout,clearTimeout,navigator:coordination?{locks:{request:(_name,work)=>Promise.resolve().then(work)}}:{},window:{location:{origin:"https://secondpart.example"},Capacitor:{isNativePlatform:()=>native,getPlatform:()=>native?"android":"web",Plugins:{PushNotifications:push,App:{getInfo:async()=>({id:"com.secondpart.marketplace"})}}}}});
 return {api:exports,calls,listeners,removed};
}
test("registration listens before requesting a token and cleans both listeners",async()=>{
 const h=adapterHarness();
 assert.equal(await h.api.registerNativePush(false),"fixture-device-token-for-hosted-android");
 assert.deepEqual(h.calls,["check","register"]);
 assert.deepEqual(h.removed.sort(),["registration","registrationError"]);
});
test("explicit Enable can request permission; restoration cannot prompt",async()=>{
 const restore=adapterHarness({permission:"prompt"});
 await assert.rejects(restore.api.registerNativePush(false),/Allow notifications/);
 assert.deepEqual(restore.calls,["check"]);
 const enable=adapterHarness({permission:"prompt"});
 await enable.api.registerNativePush(true);assert.deepEqual(enable.calls,["check","prompt","register"]);
 const denied=adapterHarness({permission:"denied"});
 await assert.rejects(denied.api.registerNativePush(true),/Allow notifications/);assert.deepEqual(denied.calls,["check"]);
});
test("native provider registration errors are bounded and clean listeners",async()=>{
 const h=adapterHarness({error:true});
 await assert.rejects(h.api.registerNativePush(true),/Could not register notifications/);
 assert.deepEqual(h.removed.sort(),["registration","registrationError"]);
});
test("browser cannot prompt or register even if a push-shaped object exists",async()=>{
 const h=adapterHarness({native:false});
 await assert.rejects(h.api.registerNativePush(true),/Android app/);assert.deepEqual(h.calls,[]);
});
test("logout waits for a fresh registration and blocks subsequent registration work",async()=>{
 const h=adapterHarness(),calls=[];
 let finish;
 const registration=h.api.runNativePushWork(async()=>{await new Promise(resolve=>{finish=resolve;});calls.push("registered");});
 const logout=h.api.signOutAfterNativePushWork(async()=>calls.push("signedOut"));
 await Promise.resolve();assert.deepEqual(calls,[]);
 await assert.rejects(h.api.runNativePushWork(async()=>calls.push("late-registration")),/Signing out/);
 finish();await registration;await logout;
 assert.deepEqual(calls,["registered","signedOut"]);
});

function serverHarness({userId="qa-user",cookieId=null,dbFailure=false,clock=Date}={}){
 const rows=new Map(),jar=new Map(cookieId?[["secondpart_push_device",cookieId]]:[]),writes=[],cookieOptions=[];
 let serial=0,updateHook=null,stageHook=null;
 const cookieJar={get:key=>jar.has(key)?{value:jar.get(key)}:undefined,delete:key=>jar.delete(key),set(key,value,options){jar.set(key,value);cookieOptions.push(options);}};
 function query(){
  let action="select",payload,filters=[];
  const q={
   select(){return q;},eq(key,value){filters.push([key,value]);return q;},
   update(value){action="update";payload=value;return q;},upsert(value){action="upsert";payload=value;return q;},insert(value){action="insert";payload=value;return q;},
   single:()=>execute(),maybeSingle:()=>execute(),then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject);}
  };
  function execute(){
   if(stageHook&&(action==="upsert"||(action==="update"&&payload?.token))){const hook=stageHook;stageHook=null;return Promise.resolve(hook()).then(()=>execute());}
   if(action==="update"&&updateHook){const hook=updateHook;updateHook=null;return Promise.resolve(hook()).then(()=>execute());}
   if(dbFailure)return {data:null,error:{message:"private token provider diagnostic"}};
   if(action==="upsert"||action==="insert"){
    let row=[...rows.values()].find(item=>item.provider===payload.provider&&item.token===payload.token);
    if(row&&action==="insert")return {data:null,error:{code:"23505"}};
    if(!row){row={id:`00000000-0000-4000-8000-${String(++serial).padStart(12,"0")}`};rows.set(row.id,row);}
    Object.assign(row,payload);writes.push({action,payload:{...payload}});return {data:{...row},error:null};
   }
   const matched=[...rows.values()].filter(row=>filters.every(([key,value])=>row[key]===value));
   if(action==="update"){for(const row of matched)Object.assign(row,payload);writes.push({action,filters,payload});}
   return {data:action==="update"?matched.map(row=>({id:row.id,updated_at:row.updated_at})):matched[0]?{...matched[0]}:null,error:null};
  }
  return q;
 }
 const dependencies={
  "server-only":{},"next/headers":{cookies:async()=>cookieJar},
  "@/lib/supabase/server":{createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:userId?{id:userId}:null},error:null})}})},
  "@/lib/supabase/admin":{createSupabaseAdminClient:()=>({from(table){assert.equal(table,"mobile_push_devices");return query();}})}
 };
 const load=p=>{const exports={};vm.runInNewContext(compile(p),{exports,Buffer,process:{env:{NODE_ENV:"production",SUPABASE_SERVICE_ROLE_KEY:"local-test-signing-fixture-never-a-provider-key"}},Date:clock,require:name=>{
  if(name==="node:crypto")return crypto;
  if(name==="@/lib/push/hosted-device-binding")return load("src/lib/push/hosted-device-binding.ts");
  if(name==="@/lib/push/hosted-device")return load("src/lib/push/hosted-device.ts");
  if(name in dependencies)return dependencies[name];throw new Error(`Unexpected server import ${name}`);
 }});return exports;};
 const binding=load("src/lib/push/hosted-device-binding.ts");
 if(cookieId)jar.set("secondpart_push_device",binding.signHostedPushBinding(cookieId,Date.now()));
 const rawApi=load("src/app/account/push-actions.ts");
 const api={...rawApi,enableHostedPush:async(user,input)=>{const stage=await rawApi.prepareHostedPush(user,input);return stage.ok?rawApi.confirmHostedPush(user,stage.version):stage;}};
 return {beforeNextStage:hook=>{stageHook=hook;},beforeNextUpdate:hook=>{updateHook=hook;},binding,rawApi,setUser:value=>{userId=value;},api,detach:load("src/lib/push/hosted-device.ts").detachHostedPushDevice,rows,jar,writes,cookieOptions};
}
const registration={token:"fixture-hosted-token-at-least-twenty-characters",appId:"com.secondpart.marketplace"};
test("cookie-authenticated registration binds only the authenticated profile and hides the token",async()=>{
 const h=serverHarness();
 const stale=await h.api.enableHostedPush("other-user",registration);assert.equal(stale.ok,false);assert.equal(h.rows.size,0);
 const good=await h.api.enableHostedPush("qa-user",registration);assert.equal(good.ok,true);assert.equal(good.enabled,true);
 const row=[...h.rows.values()][0];assert.equal(row.profile_id,"qa-user");assert.equal(row.build_channel,"release");
 assert.equal(h.binding.verifyHostedPushBinding(h.jar.get("secondpart_push_device"))?.id,row.id);
 assert.equal(h.cookieOptions[0].httpOnly,true);assert.equal(h.cookieOptions[0].sameSite,"lax");assert.equal(h.cookieOptions[0].path,"/");
 assert.equal(JSON.stringify(good).includes(registration.token),false);
 await h.api.enableHostedPush("qa-user",registration);assert.equal(h.rows.size,1);
});
test("token rotation deactivates the preceding registration for this installation",async()=>{
 const h=serverHarness();await h.api.enableHostedPush("qa-user",registration);
 const previous=[...h.rows.values()][0];
 await h.api.enableHostedPush("qa-user",{...registration,token:"fixture-rotated-hosted-token-at-least-twenty"});
 assert.equal(previous.enabled,false);assert.equal([...h.rows.values()].filter(row=>row.enabled).length,1);
});
test("disable and logout scope the update to this device and authenticated user",async()=>{
 const h=serverHarness();await h.api.enableHostedPush("qa-user",registration);
 const own=[...h.rows.values()][0];
 h.rows.set("second-device",{id:"second-device",profile_id:"qa-user",provider:"fcm",enabled:true});
 h.rows.set("foreign-device",{id:"foreign-device",profile_id:"other-user",provider:"fcm",enabled:true});
 assert.equal((await h.api.disableHostedPush("qa-user")).ok,true);assert.equal(own.enabled,false);
 assert.equal(h.rows.get("second-device").enabled,true);assert.equal(h.rows.get("foreign-device").enabled,true);assert.equal(h.jar.size,0);
 h.jar.set("secondpart_push_device","foreign-device");await h.detach();assert.equal(h.rows.get("foreign-device").enabled,true);
});
test("ordinary web logout has no push association to detach",async()=>{
 const h=serverHarness({userId:null});assert.equal(await h.detach(),true);assert.equal(h.writes.length,0);
});
test("backend failures keep the binding available for retry and expose bounded copy",async()=>{
 const h=serverHarness({cookieId:"00000000-0000-4000-8000-000000000001",dbFailure:true});
 assert.equal(await h.detach(),false);assert.equal(h.binding.verifyHostedPushBinding(h.jar.get("secondpart_push_device"))?.id,"00000000-0000-4000-8000-000000000001");
 const result=await h.api.enableHostedPush("qa-user",registration);assert.equal(result.ok,false);assert.equal(JSON.stringify(result).includes("private"),false);
});

test("native Enable fails closed before prompting if the WebView cannot coordinate account changes",async()=>{
 const exports={},calls=[];
 vm.runInNewContext(compile("src/lib/native-push.ts"),{exports,Promise,setTimeout,clearTimeout,window:{Capacitor:{isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{PushNotifications:{checkPermissions:async()=>{calls.push("check");return {receive:"denied"};}}}}}});
 await assert.rejects(exports.registerNativePush(true),/update Android System WebView/i);
 assert.deepEqual(calls,[]);
});


function pushLock(){
 let tail=Promise.resolve();
 return {request(name,work){assert.equal(name,"secondpart-native-push");const result=tail.then(work);tail=result.catch(()=>{});return result;}};
}
function coordinatedTab(locks){
 const exports={};
 vm.runInNewContext(compile("src/lib/native-push.ts"),{exports,Promise,navigator:{locks},window:{Capacitor:{isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{PushNotifications:{}}}}});
 return exports;
}
test("two native tabs serialize registration, logout and stale account work",async()=>{
 const locks=pushLock(),a=coordinatedTab(locks),b=coordinatedTab(locks),events=[];
 let signedIn=true,finish;
 const registration=a.runNativePushWork(async()=>{await new Promise(resolve=>{finish=resolve;});events.push("registered");});
 await Promise.resolve();
 const logout=b.signOutAfterNativePushWork(async()=>{events.push("detached");signedIn=false;events.push("signedOut");});
 await Promise.resolve();await Promise.resolve();
 const stale=a.runNativePushWork(async()=>{if(!signedIn)throw new Error("Sign in again");events.push("wrong-account-registration");});
 const staleCheck=assert.rejects(stale,/Sign in again/);
 finish();await registration;await logout;await staleCheck;
 assert.deepEqual(events,["registered","detached","signedOut"]);
});
test("a failed mutation releases the same-origin push lock",async()=>{
 const locks=pushLock(),a=coordinatedTab(locks),b=coordinatedTab(locks),calls=[];
 await assert.rejects(a.runNativePushWork(async()=>{throw new Error("offline");}),/offline/);
 await b.signOutAfterNativePushWork(async()=>calls.push("signedOut"));
 await a.runNativePushWork(async()=>calls.push("next-attempt"));
 assert.deepEqual(calls,["signedOut","next-attempt"]);
});
test("logout leaves authentication active when device detach failed",async()=>{
 const calls=[],exports={};
 vm.runInNewContext(compile("src/app/auth/actions.ts"),{exports,process,require(name){
  if(name==="next/navigation")return {redirect(href){calls.push(href);throw new Error("redirected");}};
  if(name==="@/lib/supabase/env")return {isSupabaseConfigured:()=>true};
  if(name==="@/lib/supabase/server")return {createSupabaseServerClient:async()=>({auth:{signOut:async()=>calls.push("signedOut")}})};
  if(name==="@/lib/push/hosted-device")return {detachHostedPushDevice:async()=>false};
  return {};
 }});
 await assert.rejects(exports.signOut(),/redirected/);assert.deepEqual(calls,["/account?error=push-detach-failed"]);
});

function settingsHarness({native=true,permission="granted",preferenceUser=null,coordination=true}={}){
 const nativeAdapter=adapterHarness({native,permission,coordination}),server=serverHarness(),stored=new Map(preferenceUser?[[`secondpart.push.enabled.${preferenceUser}`,"true"]]:[]);
 let state=null,effect;
 const exports={};
 const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 const compiled=ts.transpileModule(fs.readFileSync(path.join(root,"src/components/native-push-settings.tsx"),"utf8"),{fileName:"native-push-settings.tsx",compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(compiled,{exports,Promise,localStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)},require(name){
  if(name==="react")return {useEffect:fn=>{effect=fn;},useState:()=>[state,value=>{state=value;}]};
  if(name==="react/jsx-runtime")return jsx;
  if(name==="@/lib/native-push")return nativeAdapter.api;
  if(name==="@/app/account/push-actions")return server.api;
  throw new Error(`Unexpected settings dependency ${name}`);
 }});
 const render=()=>exports.NativePushSettings({userId:"qa-user"});
 const flush=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
 const button=tree=>{if(!tree||typeof tree!=="object")return null;if(tree.type==="button")return tree;for(const child of [].concat(tree.props?.children??[])){const found=button(child);if(found)return found;}return null;};
 return {nativeAdapter,server,stored,render,state:()=>state,flush,async mount(){render();effect();await flush();},async click(){button(render()).props.onClick();await flush();}};
}
test("Account only prompts after Enable and Disable detaches before unregister",async()=>{
 const h=settingsHarness({permission:"prompt"});await h.mount();
 assert.equal(h.state().enabled,false);assert.equal(h.nativeAdapter.calls.includes("prompt"),false);assert.equal(h.server.rows.size,0);
 await h.click();assert.equal(h.state().enabled,true);assert.equal(h.nativeAdapter.calls.includes("prompt"),true);assert.equal([...h.server.rows.values()][0].enabled,true);
 await h.click();assert.equal(h.state().enabled,false);assert.equal([...h.server.rows.values()][0].enabled,false);assert.equal(h.nativeAdapter.calls.at(-1),"unregister");assert.equal(h.stored.get("secondpart.push.enabled.qa-user"),"false");
});
test("another account's saved preference cannot restore registration",async()=>{
 const h=settingsHarness({preferenceUser:"other-user"});await h.mount();
 assert.equal(h.state().enabled,false);assert.equal(h.nativeAdapter.calls.includes("register"),false);assert.equal(h.server.rows.size,0);
});
test("returning user's opt-in restores without requesting permission",async()=>{
 const h=settingsHarness({preferenceUser:"qa-user"});await h.mount();
 assert.equal(h.state().enabled,true);assert.equal(h.nativeAdapter.calls.includes("prompt"),false);assert.equal(h.server.rows.size,1);
});
test("ordinary browser Account has no native notification controls or registration",async()=>{
 const h=settingsHarness({native:false,preferenceUser:"qa-user"});await h.mount();
 assert.equal(h.render(),null);assert.deepEqual(h.nativeAdapter.calls,[]);assert.equal(h.server.rows.size,0);
});

test("push paths that normalize to network paths are rejected",()=>{
 const h=adapterHarness();
 for(const href of ["/safe/..//attacker.example/path","/safe/%2e%2e//attacker.example/path","/safe/..%2f%2fattacker.example/path"]){assert.equal(h.api.safePushHref(href,"https://secondpart.example"),null,href);}
});
test("retained registration emitted while a listener attaches cannot leak handles or start a second register",async()=>{
 const exports={},removed=[],calls=[];
 const push={checkPermissions:async()=>({receive:"granted"}),addListener(event,cb){if(event==="registration")cb({value:"fixture-retained-device-token-at-least-twenty"});return Promise.resolve({remove(){removed.push(event);}});},register:async()=>calls.push("register")};
 vm.runInNewContext(compile("src/lib/native-push.ts"),{exports,URL,Promise,setTimeout,clearTimeout,navigator:{locks:{}},window:{Capacitor:{isNativePlatform:()=>true,getPlatform:()=>"android",Plugins:{PushNotifications:push}}}});
 assert.equal(await exports.registerNativePush(false),"fixture-retained-device-token-at-least-twenty");
 for(let i=0;i<10;i++)await Promise.resolve();
 assert.deepEqual(removed,["registration"]);assert.deepEqual(calls,[]);
});

test("existing enabled association stays disableable when outdated WebView cannot restore",async()=>{
 const h=settingsHarness({preferenceUser:"qa-user",coordination:false});
 await h.server.api.enableHostedPush("qa-user",registration);
 await h.mount();assert.equal(h.state().enabled,true);
 await h.click();assert.equal(h.state().enabled,false);assert.equal([...h.server.rows.values()][0].enabled,false);
 assert.equal(h.nativeAdapter.calls.includes("prompt"),false);
});

test("expired A session and replacement B status detach the signed installation without disabling other devices",async()=>{
 const h=serverHarness();await h.api.enableHostedPush("qa-user",registration);
 const own=[...h.rows.values()][0];
 h.rows.set("other-installation",{id:"other-installation",profile_id:"qa-user",provider:"fcm",enabled:true});
 h.setUser("replacement-user");
 const status=await h.api.hostedPushStatus("replacement-user");
 assert.equal(status.ok,true);assert.equal(status.enabled,false);assert.equal(own.enabled,false);assert.equal(h.rows.get("other-installation").enabled,true);
});

function authModule(p,dependencies={},globals={}){
 const exports={};
 vm.runInNewContext(compile(p),{exports,URL,URLSearchParams,Request,Response,Promise,require(name){
  if(name==="@/lib/auth-return")return authModule("src/lib/auth-return.ts",dependencies,globals);
  if(name in dependencies)return dependencies[name];
  throw new Error(`Unexpected auth import ${name}`);
 },...globals});return exports;
}
for(const flow of ["callback","confirm"]){
 test(`native ${flow} waits for the client account lock before provider exchange`,async()=>{
  const calls=[];
  const deps={"next/server":{NextResponse:{redirect:url=>({url})}},"@/lib/supabase/server":{createSupabaseServerClient:async()=>({auth:{exchangeCodeForSession:async()=>{calls.push("exchange");return {error:null};},verifyOtp:async()=>{calls.push("verify");return {error:null};}}})},"@/lib/navigation":{safeInternalPath:(value,fallback)=>value?.startsWith("/")?value:fallback}};
  const {GET}=authModule(`src/app/auth/${flow}/route.ts`,deps);
  const query=flow==="confirm"?"token_hash=private-fixture&type=recovery&next=%2Fauth%2Freset-password":"code=private-fixture&next=%2Faccount";
  const response=await GET(new Request(`https://secondpart.test/auth/${flow}?${query}`,{headers:{cookie:"secondpart_native=1"}}));
  assert.deepEqual(calls,[]);assert.equal(new URL(String(response.url)).pathname,`/auth/native-return/${flow}`);assert.equal(new URL(String(response.url)).search,`?${query}`);
 });
}

test("initial token submission never enables delivery before its binding reaches the browser",async()=>{
 const h=serverHarness();
 const staged=await h.rawApi.prepareHostedPush("qa-user",registration);
 assert.equal(staged.ok,true);assert.equal([...h.rows.values()][0].enabled,false);
});

test("expired authentication still allows verified installation cleanup",async()=>{
 const h=serverHarness();await h.api.enableHostedPush("qa-user",registration);h.setUser(null);
 assert.equal(await h.detach(),true);assert.equal([...h.rows.values()][0].enabled,false);assert.equal(h.jar.size,0);
});
test("forged, malformed and version-tampered bindings cannot disable or enable a device",async()=>{
 const h=serverHarness();await h.api.enableHostedPush("qa-user",registration);
 const valid=h.jar.get("secondpart_push_device"),row=[...h.rows.values()][0],writes=h.writes.length;
 const invalid=[row.id,valid.replace("v1.","v2."),valid.replace(row.id,"00000000-0000-4000-8000-000000000099"),valid.slice(0,-1)+(valid.endsWith("A")?"B":"A"),valid.replace(/\.\d{13}\./,".1234567890123."),valid+"\n"];
 for(const value of invalid){h.jar.set("secondpart_push_device",value);assert.equal(await h.detach(),false);assert.equal((await h.rawApi.confirmHostedPush("qa-user",row.updated_at)).ok,false);assert.equal(row.enabled,true);assert.equal(h.writes.length,writes);}
});
test("replaying an earlier signed stage cannot reactivate after detach",async()=>{
 const h=serverHarness();const staged=await h.rawApi.prepareHostedPush("qa-user",registration);
 const cookie=h.jar.get("secondpart_push_device");assert.equal(await h.detach(),true);
 h.jar.set("secondpart_push_device",cookie);
 const result=await h.rawApi.confirmHostedPush("qa-user",staged.version);assert.equal(result.ok,false);assert.equal([...h.rows.values()][0].enabled,false);
});
test("callback detach fences a final-enable request that already authenticated A before account replacement",async()=>{
 const h=serverHarness();const staged=await h.rawApi.prepareHostedPush("qa-user",registration);
 let finish,entered;
 const paused=new Promise(resolve=>{entered=resolve;});
 h.beforeNextUpdate(()=>{entered();return new Promise(resolve=>{finish=resolve;});});
 const final=h.rawApi.confirmHostedPush("qa-user",staged.version);
 await paused;
 assert.equal(await h.detach(),true);h.setUser("replacement-user");
 finish();const result=await final;
 assert.equal(result.ok,false);assert.equal([...h.rows.values()][0].enabled,false);
});
test("if final enable wins before callback cleanup, cleanup still disables that installation",async()=>{
 const h=serverHarness();const staged=await h.rawApi.prepareHostedPush("qa-user",registration);
 assert.equal((await h.rawApi.confirmHostedPush("qa-user",staged.version)).ok,true);
 h.setUser("replacement-user");assert.equal(await h.detach(),true);assert.equal([...h.rows.values()][0].enabled,false);
});
test("aborted preparation leaves only a disabled row and no eligible activation without its returned binding",async()=>{
 const h=serverHarness();const staged=await h.rawApi.prepareHostedPush("qa-user",registration);
 h.jar.clear();h.setUser("replacement-user");
 assert.equal((await h.rawApi.confirmHostedPush("qa-user",staged.version)).ok,false);assert.equal([...h.rows.values()][0].enabled,false);
});
test("native continuation StrictMode effect replay dispatches one exchange and delivers the surviving completion",async()=>{
 const calls=[],ref={current:null},effects=[],lock=pushLock(),native=coordinatedTab(lock);
 let finish;
 const router={replace:href=>calls.push(["replace",href]),refresh:()=>calls.push(["refresh"])};
 const deps={react:{useEffect:fn=>effects.push(fn),useRef:()=>ref,useState:initial=>[initial,()=>{}]},"react/jsx-runtime":{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},"next/navigation":{useRouter:()=>router},"@/lib/native-push":native,"@/app/auth/native-return/actions":{completeNativeAuthReturn:async()=>{calls.push(["exchange"]);return new Promise(resolve=>{finish=resolve;});}}};
 const {NativeAuthContinuation}=authModule("src/components/native-auth-continuation.tsx",deps);
 NativeAuthContinuation({flow:"callback",query:"code=private-fixture&next=%2Faccount"});
 const cleanup=effects[0]();cleanup();effects[0]();
 for(let i=0;i<20;i++)await Promise.resolve();assert.deepEqual(calls,[["exchange"]]);
 finish({ok:true,href:"/account"});for(let i=0;i<20;i++)await Promise.resolve();
 assert.deepEqual(calls,[["exchange"],["replace","/account"],["refresh"]]);
});
test("native callback action uses fresh binding after an earlier GET snapshot and strips sensitive return fields",async()=>{
 const h=serverHarness(),events=[];
 const earlierGet=new Request("https://secondpart.test/auth/callback?code=fixture",{headers:{cookie:"secondpart_native=1"}});
 assert.equal(earlierGet.headers.get("cookie").includes("push_device"),false);
 const staged=await h.rawApi.prepareHostedPush("qa-user",registration);
 const deps={"@/lib/push/hosted-device":{detachHostedPushDevice:async()=>{events.push("detach");return h.detach();}},"next/server":{NextResponse:{redirect:url=>new Response(null,{status:307,headers:{location:String(url)}})}},"@/lib/supabase/server":{createSupabaseServerClient:async()=>({auth:{exchangeCodeForSession:async()=>{events.push("exchange");h.setUser("replacement-user");return {error:null};}}})},"@/lib/navigation":authModule("src/lib/navigation.ts")};
 const action=authModule("src/app/auth/native-return/actions.ts",deps);
 const result=await action.completeNativeAuthReturn("callback","code=private-fixture&next="+encodeURIComponent("/account?access_token=private&view=buying#code=private"));
 assert.equal(result.ok,true);assert.equal(result.href,"/auth/confirmation-status?state=confirmed&returnTo=%2Faccount%3Fview%3Dbuying");assert.deepEqual(events,["detach","exchange"]);
 assert.equal((await h.rawApi.confirmHostedPush("qa-user",staged.version)).ok,false);assert.equal([...h.rows.values()][0].enabled,false);
});

test("native handoff preserves recovery errors and never falls back from invalid OTP to PKCE",async()=>{
 const events=[];
 const deps={"@/lib/push/hosted-device":{detachHostedPushDevice:async()=>true},"next/server":{NextResponse:{redirect:url=>new Response(null,{status:307,headers:{location:String(url)}})}},"@/lib/supabase/server":{createSupabaseServerClient:async()=>({auth:{exchangeCodeForSession:async()=>{events.push("exchange");return {error:null};},verifyOtp:async()=>{events.push("verify");return {error:null};},getUser:async()=>({data:{user:null},error:null})}})},"@/lib/navigation":authModule("src/lib/navigation.ts")};
 const action=authModule("src/app/auth/native-return/actions.ts",deps);
 const error=await action.completeNativeAuthReturn("callback","code=private&error_description=private-provider-diagnostic&next=%2Fauth%2Freset-password");
 assert.equal(error.href,"/auth/forgot-password?error=expired-link");
 const invalid=await action.completeNativeAuthReturn("confirm","token_hash=private&type=unsupported&code=private-fallback");
 assert.equal(invalid.href,"/auth/confirmation-status?state=invalid&returnTo=%2Faccount");assert.deepEqual(events,[]);
});
test("auth continuation remains available without Web Locks while enrollment is refused",async()=>{
 const native=coordinatedTab(undefined),h=serverHarness(),events=[];
 await h.api.enableHostedPush("qa-user",registration);
 const result=await native.coordinateNativeAccountChange(async()=>{assert.equal(await h.detach(),true);events.push("exchange");return "completed";});
 assert.equal(result,"completed");assert.deepEqual(events,["exchange"]);assert.equal([...h.rows.values()][0].enabled,false);
});
test("hosted sign-in action waits for registration and clears its binding before replacing the account",async()=>{
 const native=coordinatedTab(pushLock()),h=serverHarness(),events=[],actions=[];
 let finish;
 const registrationWork=native.runNativePushWork(async()=>{await new Promise(resolve=>{finish=resolve;});await h.api.enableHostedPush("qa-user",registration);events.push("registered");});
 const auth=authModule("src/app/auth/actions.ts",{
  "next/cache":{revalidatePath(){}},"next/headers":{headers:async()=>new Map([["cookie",`secondpart_push_device=${h.jar.get("secondpart_push_device")??""}`]])},
  "next/navigation":{redirect:href=>{events.push("redirect");throw new Error(`redirect:${href}`);}},
  "@/lib/supabase/env":{isSupabaseConfigured:()=>true},"@/lib/supabase/server":{createSupabaseServerClient:async()=>({auth:{signInWithPassword:async()=>{events.push("signedIn");h.setUser("replacement-user");return {error:null};}}})},
  "@/lib/push/hosted-device":{detachHostedPushDevice:async()=>{events.push("detached");return h.detach();}},
  "@/lib/navigation":authModule("src/lib/navigation.ts"),"@/lib/policy-versions":{},"@/lib/auth-email-origin":{},"@/lib/auth-error-messages":{}
 });
 const form=authModule("src/components/auth-form.tsx",{
  "react/jsx-runtime":{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},react:{useState:value=>[value,()=>{}],useRef:()=>({current:false}),useEffect(){},useActionState(action){actions.push(action);return [{status:"idle"},()=>{},false];}},
  "next/link":{default:"a"},"lucide-react":{},"@/app/auth/actions":auth,"@/lib/native-push":native,"@/lib/navigation":authModule("src/lib/navigation.ts")
 });
 form.AuthForm({});
 const data=new FormData();data.set("email","replacement@example.test");data.set("password","fixture-password");
 const login=actions.find(action=>action.name==="signIn")({status:"idle"},data);
 const rejected=assert.rejects(login,/redirect:/);
 for(let i=0;i<20;i++)await Promise.resolve();assert.deepEqual(events,[]);
 finish();await registrationWork;await rejected;
 assert.deepEqual(events,["registered","detached","signedIn","redirect"]);assert.equal([...h.rows.values()][0].enabled,false);
});

test("a paused stage cannot overwrite a later callback fence with a colliding millisecond version",async()=>{
 const fixed=1791417600000;
 class FixedDate extends Date{constructor(value=fixed){super(value);}static now(){return fixed;}}
 const h=serverHarness({clock:FixedDate});await h.api.enableHostedPush("qa-user",registration);
 const priorBinding=h.jar.get("secondpart_push_device");
 let finish,entered;
 const paused=new Promise(resolve=>{entered=resolve;});
 h.beforeNextStage(()=>{entered();return new Promise(resolve=>{finish=resolve;});});
 const staged=h.rawApi.prepareHostedPush("qa-user",registration);await paused;
 // Until the stage response arrives, the callback browser still carries its prior binding.
 h.jar.set("secondpart_push_device",priorBinding);assert.equal(await h.detach(),true);
 const fence=[...h.rows.values()][0].updated_at;
 finish();const result=await staged;
 if(result.ok)assert.ok(Date.parse([...h.rows.values()][0].updated_at)>Date.parse(fence));
 else assert.equal([...h.rows.values()][0].updated_at,fence);
 assert.equal([...h.rows.values()][0].enabled,false);
});

test("overlapping account changes keep new enrollment blocked until both finish",async()=>{
 const native=coordinatedTab(pushLock()),events=[];
 let finishFirst,finishSecond,secondEntered;
 const entered=new Promise(resolve=>{secondEntered=resolve;});
 const first=native.coordinateNativeAccountChange(async()=>{await new Promise(resolve=>{finishFirst=resolve;});events.push("first");});
 for(let i=0;i<10;i++)await Promise.resolve();
 const second=native.coordinateNativeAccountChange(async()=>{secondEntered();await new Promise(resolve=>{finishSecond=resolve;});events.push("second");});
 finishFirst();await first;await entered;
 let rejected=false;
 const late=native.runNativePushWork(async()=>events.push("late-registration")).catch(error=>{assert.match(error.message,/Signing out/);rejected=true;});
 try{
  for(let i=0;i<10;i++)await Promise.resolve();
  assert.equal(rejected,true,"enrollment remains blocked while another account change holds the queue");
 }finally{finishSecond();await second;await late;}
 assert.deepEqual(events,["first","second"]);
 await native.runNativePushWork(async()=>events.push("next-attempt"));
 assert.equal(events.at(-1),"next-attempt");
});
