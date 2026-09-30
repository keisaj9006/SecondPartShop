import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import ts from 'typescript';

// Ephemeral synthetic key: no real provider credentials or network calls.
const {privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const account=Buffer.from(JSON.stringify({project_id:'qa-project',client_email:'qa@example.invalid',private_key:privateKey.export({type:'pkcs8',format:'pem'})})).toString('base64');
const source=fs.readFileSync(new URL('../src/lib/push/fcm.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const detail={'@type':'type.googleapis.com/google.firebase.fcm.v1.FcmError',errorCode:'UNREGISTERED'};

async function send(status,payload,malformed=false){
 const exports={};
 vm.runInNewContext(code,{
  exports,Buffer,URLSearchParams,AbortController,setTimeout,clearTimeout,
  process:{env:{FIREBASE_SERVICE_ACCOUNT_JSON_BASE64:account}},
  require:name=>{if(name==='server-only')return {};if(name==='node:crypto')return crypto;throw new Error(name);},
  fetch:async url=>{
   if(url==='https://oauth2.googleapis.com/token')return new Response(JSON.stringify({access_token:'synthetic',expires_in:3600}));
   assert.equal(url,'https://fcm.googleapis.com/v1/projects/qa-project/messages:send');
   return new Response(malformed?'not-json':JSON.stringify(payload),{status});
  }
 });
 return JSON.parse(JSON.stringify(await exports.sendFcmPush({token:'synthetic-device',notificationId:'qa-notification',title:'QA',body:null,href:null})));
}

for(const [name,status,payload,malformed] of [
 ['generic 404',404,{error:{code:404,status:'NOT_FOUND',message:'Project unavailable'}}],
 ['non-JSON 404',404,null,true],
 ['untrusted message substring',500,{error:{message:'UNREGISTERED registration-token-not-registered'}}],
 ['wrong detail type',404,{error:{details:[{'@type':'type.googleapis.com/google.rpc.BadRequest',errorCode:'UNREGISTERED'}]}}],
 ['sender mismatch',403,{error:{details:[{...detail,errorCode:'SENDER_ID_MISMATCH'}]}}],
 ['invalid payload',400,{error:{details:[{...detail,errorCode:'INVALID_ARGUMENT'}]}}],
 ['null response',404,null],
 ['non-array details',404,{error:{details:detail}}],
 ['temporary failure',503,{error:{status:'UNAVAILABLE'}}]
]){
 test(`FCM preserves registration on ${name}`,async()=>{
  assert.deepEqual(await send(status,payload,malformed),{ok:false,invalidToken:false,error:`fcm_http_${status}`});
 });
}
test('FCM only retires a device with typed UNREGISTERED evidence',async()=>{
 assert.deepEqual(await send(404,{error:{code:404,status:'NOT_FOUND',details:[null,detail]}}),{ok:false,invalidToken:true,error:'device_unregistered'});
});
test('FCM successful delivery remains successful',async()=>{
 assert.deepEqual(await send(200,{name:'projects/qa-project/messages/qa'}),{ok:true,invalidToken:false,error:null});
});
