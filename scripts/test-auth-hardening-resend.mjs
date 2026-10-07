import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root=path.resolve(import.meta.dirname,"..");
const jsxRuntime={
 Fragment:Symbol("Fragment"),
 jsx:(type,props,key)=>({type,props:props??{},key:key??null}),
 jsxs:(type,props,key)=>({type,props:props??{},key:key??null})
};

function moduleFrom(relativePath,dependencies={},globals={}){
 const source=fs.readFileSync(path.join(root,relativePath),"utf8");
 const compiled=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
 }).outputText;
 const exports={};
 vm.runInNewContext(compiled,{
  exports,
  require(name){
   if(name==="react/jsx-runtime")return jsxRuntime;
   if(name in dependencies)return dependencies[name];
   throw new Error(`Unexpected dependency ${name} in ${relativePath}`);
  },
  URL,URLSearchParams,Request,Response,FormData,process,console,...globals
 });
 return exports;
}

function nodes(tree){
 const found=[];
 const visit=value=>{
  if(value===null||value===undefined||typeof value==="boolean")return;
  if(Array.isArray(value)){value.forEach(visit);return;}
  if(typeof value!=="object")return;
  found.push(value);
  visit(value.props?.children);
 };
 visit(tree);
 return found;
}

function textContent(value){
 if(value===null||value===undefined||typeof value==="boolean")return "";
 if(Array.isArray(value))return value.map(textContent).join("");
 if(typeof value==="object")return textContent(value.props?.children);
 return String(value);
}

function findNode(tree,predicate){
 const match=nodes(tree).find(predicate);
 assert.ok(match,"Expected rendered node was not found");
 return match;
}

function formData(values){
 const data=new FormData();
 for(const [key,value] of Object.entries(values))data.set(key,value);
 return data;
}

function loadResendAction({providerError=null,providerThrows=false}={}){
 const calls=[];
 const {resendConfirmation}=moduleFrom("src/app/auth/actions.ts",{
  "next/cache":{revalidatePath(){}},
  "next/headers":{headers:async()=>new Map()},
  "next/navigation":{redirect(destination){throw new Error(`Unexpected redirect ${destination}`);}},
  "@/lib/supabase/server":{createSupabaseServerClient:async()=>({auth:{resend:async payload=>{calls.push(payload);if(providerThrows)throw new Error("private resend network diagnostic");return {error:providerError};}}})},
  "@/lib/supabase/env":{isSupabaseConfigured:()=>true},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts"),
  "@/lib/policy-versions":{CURRENT_MARKETPLACE_TERMS_VERSION:"2026-09-01"},
  "@/lib/auth-email-origin":{resolveAuthEmailOrigin:()=>"https://secondpart.test"},
  "@/lib/auth-error-messages":moduleFrom("src/lib/auth-error-messages.ts")
 });
 return {resendConfirmation,calls};
}

function loadResendForm({state={status:"idle"},pending=false}={}){
 const hookState=[];
 const refs=[];
 let index=0;
 let refIndex=0;
 let actionState=state;
 let actionPending=pending;
 let latestEffects=[];
 const timers=new Map();
 let nextTimer=1;
 const window={
  setTimeout(callback,delay){const id=nextTimer++;timers.set(id,{callback,delay});return id;},
  clearTimeout(id){timers.delete(id);}
 };
 const useState=initial=>{
  const slot=index++;
  if(!(slot in hookState))hookState[slot]=initial;
  return [hookState[slot],value=>{hookState[slot]=typeof value==="function"?value(hookState[slot]):value;}];
 };
 const useRef=initial=>{
  const slot=refIndex++;
  if(!(slot in refs))refs[slot]={current:initial};
  return refs[slot];
 };
 const useActionState=()=>[actionState,()=>{},actionPending];
 const useEffect=effect=>{latestEffects.push(effect);};
 function resendConfirmation(){}
 const {ResendVerificationForm}=moduleFrom("src/components/resend-verification-form.tsx",{
  "next/link":"a",
  react:{useActionState,useState,useRef,useEffect},
  "@/app/auth/actions":{resendConfirmation},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts")
 },{window});
 let cleanup=null;
 return {
  timers,
  setState:value=>{actionState=value;},
  setPending:value=>{actionPending=value;},
  render:props=>{
   index=0;refIndex=0;latestEffects=[];
   const tree=ResendVerificationForm(props);
   cleanup?.();
   cleanup=()=>{};
   for(const effect of latestEffects){
    const nextCleanup=effect();
    if(typeof nextCleanup==="function"){
     const previous=cleanup;
     cleanup=()=>{previous();nextCleanup();};
    }
   }
   return tree;
  },
  tick:()=>{
   const timer=[...timers.entries()][0];
   assert.ok(timer,"Expected a cooldown timer to be scheduled");
   timers.delete(timer[0]);
   timer[1].callback();
  }
 };
}

function submitEvent(){
 let prevented=false;
 return {
  event:{preventDefault(){prevented=true;}},
  wasPrevented:()=>prevented
 };
}

test("unauthenticated resend stays neutral and never claims delivery",async()=>{
 const {resendConfirmation,calls}=loadResendAction();
 const result=await resendConfirmation({status:"idle"},formData({email:"unknown@example.test"}));
 assert.equal(result.status,"success");
 assert.match(result.message,/if this address is eligible/i);
 assert.match(result.message,/request was accepted/i);
 assert.doesNotMatch(result.message,/email sent|delivered/i);
 assert.equal(calls.length,1);
});

test("resend provider rate limits receive bounded wait guidance",async()=>{
 const raw="Too many requests from private auth shard 9c2f";
 const {resendConfirmation}=loadResendAction({providerError:{status:429,code:"too_many_requests",message:raw}});
 const result=await resendConfirmation({status:"idle"},formData({email:"buyer@example.test"}));
 assert.equal(result.status,"error");
 assert.match(result.message,/please wait/i);
 assert.equal(result.message.includes(raw),false);
 assert.equal(result.message.includes("private auth shard"),false);
});

test("resend network failures return generic guidance without provider diagnostics",async()=>{
 const {resendConfirmation}=loadResendAction({providerThrows:true});
 const result=await resendConfirmation({status:"idle"},formData({email:"buyer@example.test"}));
 assert.equal(result.status,"error");
 assert.match(result.message,/could not request a confirmation email/i);
 assert.equal(result.message.includes("private resend network diagnostic"),false);
});

test("resend click starts a visible cooldown and blocks a rapid duplicate",()=>{
 const harness=loadResendForm();
 const props={returnTo:"/saved?view=parts",cooldownSeconds:3};
 const initial=harness.render(props);
 const form=findNode(initial,node=>node.type==="form");
 const first=submitEvent();
 const second=submitEvent();
 form.props.onSubmit(first.event);
 form.props.onSubmit(second.event);
 assert.equal(first.wasPrevented(),false);
 assert.equal(second.wasPrevented(),true);
 const cooled=harness.render(props);
 const button=findNode(cooled,node=>node.type==="button");
 assert.equal(button.props.disabled,true);
 assert.match(textContent(button),/wait 3 seconds/i);
 harness.tick();
 const next=harness.render(props);
 assert.match(textContent(findNode(next,node=>node.type==="button")),/wait 2 seconds/i);
});

test("cooldown remains active after provider failure and while the action is pending",()=>{
 const harness=loadResendForm();
 const props={cooldownSeconds:4};
 const initial=harness.render(props);
 const form=findNode(initial,node=>node.type==="form");
 const submit=submitEvent();
 form.props.onSubmit(submit.event);
 harness.setState({status:"error",message:"Please wait before requesting another email, then try again."});
 let tree=harness.render(props);
 assert.equal(findNode(tree,node=>node.type==="button").props.disabled,true);
 assert.match(textContent(tree),/please wait before requesting another email/i);
 assert.match(textContent(findNode(tree,node=>node.type==="button")),/wait 4 seconds/i);
 harness.setPending(true);
 tree=harness.render(props);
 assert.equal(findNode(tree,node=>node.type==="button").props.disabled,true);
 assert.match(textContent(findNode(tree,node=>node.type==="button")),/sending/i);
});

test("confirmation status page accepts only bounded states and safe internal returnTo",async()=>{
 let authState={kind:"unauthenticated"};
 const confirmationModule=moduleFrom("src/components/auth-confirmation-status.tsx",{
  "next/link":"a",
  "lucide-react":new Proxy({},{get:()=>()=>null}),
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts")
 });
 const ConfirmationStatus=confirmationModule.AuthConfirmationStatus;
 const {default:Page}=moduleFrom("src/app/auth/confirmation-status/page.tsx",{
  "@/components/header":{Header:()=>null},
  "@/components/auth-confirmation-status":confirmationModule,
  "@/lib/auth":{getCurrentUserState:async()=>authState}
 });
 const confirmed=await Page({searchParams:Promise.resolve({state:"confirmed",returnTo:"/parts/used-alternator?cv=variant#fitment"})});
 const confirmedProps=findNode(confirmed,node=>node.type===ConfirmationStatus).props;
 assert.equal(confirmedProps.state,"invalid","a public query parameter cannot assert successful confirmation");
 assert.equal(confirmedProps.returnTo,"/parts/used-alternator?cv=variant#fitment");

 authState={kind:"authenticated",user:{email_confirmed_at:"2026-10-07T12:00:00Z"}};
 const verified=await Page({searchParams:Promise.resolve({state:"confirmed",returnTo:"/parts/used-alternator?cv=variant#fitment"})});
 assert.equal(findNode(verified,node=>node.type===ConfirmationStatus).props.state,"confirmed");
 const alreadyConfirmed=await Page({searchParams:Promise.resolve({state:"already-confirmed"})});
 assert.equal(findNode(alreadyConfirmed,node=>node.type===ConfirmationStatus).props.state,"already-confirmed");

 authState={kind:"authenticated",user:{email_confirmed_at:null}};
 const unverified=await Page({searchParams:Promise.resolve({state:"confirmed"})});
 assert.equal(findNode(unverified,node=>node.type===ConfirmationStatus).props.state,"invalid");
 authState={kind:"error"};
 const authError=await Page({searchParams:Promise.resolve({state:"confirmed"})});
 assert.equal(findNode(authError,node=>node.type===ConfirmationStatus).props.state,"invalid");

 const invalid=await Page({searchParams:Promise.resolve({state:"provider-error",returnTo:"https://attacker.example"})});
 const invalidProps=findNode(invalid,node=>node.type===ConfirmationStatus).props;
 assert.equal(invalidProps.state,"invalid");
 assert.equal(invalidProps.returnTo,"/account");

 const sensitive=await Page({searchParams:Promise.resolve({state:"confirmed",returnTo:"/saved?view=parts&token_hash=secret#fitment"})});
 const sensitiveProps=findNode(sensitive,node=>node.type===ConfirmationStatus).props;
 assert.equal(sensitiveProps.returnTo,"/saved?view=parts#fitment");
});

test("confirmation status copy and actions reflect confirmed, invalid and already-confirmed states",()=>{
 const {AuthConfirmationStatus}=moduleFrom("src/components/auth-confirmation-status.tsx",{
  "next/link":"a",
  "lucide-react":new Proxy({},{get:()=>()=>null}),
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts")
 });
 const target="/saved?view=parts#latest";
 const confirmed=AuthConfirmationStatus({state:"confirmed",returnTo:target});
 assert.match(textContent(confirmed),/Email confirmed/);
 assert.match(textContent(confirmed),/Your SecondPart account is ready/);
 assert.equal(findNode(confirmed,node=>node.props?.href===target).props.href,target);

 const invalid=AuthConfirmationStatus({state:"invalid",returnTo:target});
 assert.match(textContent(invalid),/This confirmation link is no longer valid/);
 assert.equal(findNode(invalid,node=>node.props?.href===`/auth/verify-email?returnTo=${encodeURIComponent(target)}`).props.href,`/auth/verify-email?returnTo=${encodeURIComponent(target)}`);
 assert.equal(findNode(invalid,node=>node.props?.href===`/account?returnTo=${encodeURIComponent(target)}`).props.href,`/account?returnTo=${encodeURIComponent(target)}`);

 const already=AuthConfirmationStatus({state:"already-confirmed",returnTo:target});
 assert.match(textContent(already),/already confirmed/i);
 assert.equal(findNode(already,node=>node.props?.href===target).props.href,target);

 const mobile=AuthConfirmationStatus({state:"confirmed",returnTo:"/auth/mobile-complete?state=confirmed"});
 assert.equal(findNode(mobile,node=>node.props?.href==="/auth/mobile-complete?state=confirmed").props.href,"/auth/mobile-complete?state=confirmed");
});

test("forgot-password page distinguishes an expired recovery link from signup confirmation",async()=>{
 const ForgotPasswordForm=()=>null;
 const {default:Page}=moduleFrom("src/app/auth/forgot-password/page.tsx",{
  "@/components/header":{Header:()=>null},
  "@/components/forgot-password-form":{ForgotPasswordForm}
 });
 const expired=await Page({searchParams:Promise.resolve({error:"expired-link"})});
 assert.match(textContent(expired),/password reset link.*expired|expired.*password reset link/i);
 assert.equal(/confirmation link/i.test(textContent(expired)),false);
 const normal=await Page({searchParams:Promise.resolve({})});
 assert.equal(/expired/i.test(textContent(normal)),false);
});
