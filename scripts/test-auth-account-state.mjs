import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const runtime=await import('react/jsx-runtime');
const link={__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
function load(path,modules){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require(name){if(name in modules)return modules[name];throw Error(name);}});
 return exports;
}
const user={id:'viewer',email:'buyer@example.test',email_confirmed_at:'confirmed'};
const profile={id:'viewer',role:'seller',displayName:'Test Member',handle:'member'};
async function page(authState,profileState,params={},native=false){
 let profileReads=0;
 const Unavailable=({reason})=>React.createElement('div',null,'Recovery '+reason);
 const api=load('src/app/account/page.tsx',{
  'react/jsx-runtime':runtime,'react':React,'next/link':link,
  '@/components/account-sign-out':load('src/components/account-sign-out.tsx',{'react/jsx-runtime':runtime,'@/app/auth/actions':{signOut:async()=>{}}}),
  '@/components/native-push-settings':{NativePushSettings:()=>null},
  '@/components/header':{Header:()=>native?null:React.createElement('header',null,'Header')},
  '@/components/auth-form':{AuthForm:({defaultMode})=>React.createElement('div',null,defaultMode==='signup'?'Create account form':'Sign-in form')},
  '@/components/account-profile-unavailable':{AccountProfileUnavailable:Unavailable},
  '@/components/account-dashboard-content':{AccountDashboardContent:()=>React.createElement('div',null,'Dashboard'),AccountDashboardFallback:()=>null,AccountTrustSummary:()=>null},
  '@/lib/auth':{
   getCurrentUserState:async()=>authState,getCurrentProfileState:async actual=>{assert.equal(actual,user);profileReads++;return profileState;}
  },
  '@/lib/supabase/env':{isSupabaseConfigured:()=>true},'@/lib/navigation':{safeInternalPath:value=>value?.startsWith('/')?value:''}
 });
 const html=renderToStaticMarkup(await api.default({searchParams:Promise.resolve(params)}));
 return {html,profileReads};
}
test('only a verified unauthenticated state renders the sign-in form without reading a profile',async()=>{
 const result=await page({kind:'unauthenticated'},null);assert.match(result.html,/Sign-in form/);assert.equal(result.profileReads,0);
});
test('anonymous signup URL renders the signup form without reading a profile',async()=>{
 const result=await page({kind:'unauthenticated'},null,{mode:'signup'});assert.match(result.html,/Create account form/);assert.doesNotMatch(result.html,/Sign-in form/);assert.equal(result.profileReads,0);
});
test('Auth-read failure shows recoverable status without signed-out form or protected dashboard',async()=>{
 const result=await page({kind:'error'},null);assert.match(result.html,/Recovery auth-error/);assert.doesNotMatch(result.html,/Sign-in form|Dashboard|Test Member/);assert.equal(result.profileReads,0);
});
for(const kind of ['missing','error'])test(`authenticated ${kind} profile keeps recovery shell and blocks protected role content`,async()=>{
 const result=await page({kind:'authenticated',user},{kind},{view:'selling',role:'admin'});
 assert.match(result.html,new RegExp('Recovery '+(kind==='missing'?'missing-profile':'profile-error')));assert.match(result.html,/Header/);
 assert.doesNotMatch(result.html,/Sign-in form|Dashboard|Test Member|Enable selling|Moderation/);assert.equal(result.profileReads,1);
});
test('a verified profile preserves the existing signed-in dashboard',async()=>{
 const result=await page({kind:'authenticated',user},{kind:'profile',profile},{view:'selling'});
 assert.match(result.html,/Test Member/);assert.match(result.html,/Dashboard/);assert.doesNotMatch(result.html,/Recovery|Sign-in form/);
});
test('profile recovery copy distinguishes Auth errors, missing profiles and transient profile errors',()=>{
 const api=load('src/components/account-profile-unavailable.tsx',{'react/jsx-runtime':runtime,'next/link':link,'@/components/account-dashboard-retry':{AccountDashboardRetry:()=>React.createElement('button',null,'Retry')}});
 const render=reason=>renderToStaticMarkup(React.createElement(api.AccountProfileUnavailable,{reason,email:user.email}));
 const missing=render('missing-profile'),error=render('profile-error'),auth=render('auth-error');
 assert.match(missing,/couldn’t find your SecondPart profile/);assert.match(missing,/signed in/);assert.match(missing,/Contact support/);
 assert.match(error,/temporarily unavailable/);assert.match(error,/signed in/);assert.notEqual(error,missing);
 assert.match(auth,/check your sign-in status/);assert.doesNotMatch(auth,/You’re signed in|buyer@example/);
 for(const html of [missing,error,auth]){assert.match(html,/Retry/);assert.doesNotMatch(html,/Finish setup|Sign-in form/);}
});

test('native authenticated Account exposes sign-out when the native layout hides Header',async()=>{
 const result=await page({kind:'authenticated',user},{kind:'profile',profile},{},true);
 assert.doesNotMatch(result.html,/>Header</);
 assert.match(result.html,/<form[^>]*aria-label="Sign out of SecondPart"/);
 assert.match(result.html,/<button[^>]*type="submit"[^>]*>Sign out<\/button>/);
});

for(const kind of ['missing','error'])test(`native authenticated ${kind} profile recovery still exposes coordinated sign-out`,async()=>{
 const result=await page({kind:'authenticated',user},{kind},{error:'push-detach-failed'},true);
 assert.match(result.html,/<form[^>]*aria-label="Sign out of SecondPart"/);
 assert.match(result.html,/could not disable notifications/i);
});
