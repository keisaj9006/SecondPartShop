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

function loadResetForm({mobileReturn=false,state={status:"idle"}}={}){
 const hooks=[];
 let cursor=0;
 const actionCalls=[];
 const action=async(...args)=>actionCalls.push(args);
 const react={
  useState(initial){
   const index=cursor++;
   if(!(index in hooks))hooks[index]=initial;
   return [hooks[index],value=>{hooks[index]=typeof value==="function"?value(hooks[index]):value;}];
  },
  useActionState:()=>[state,action,false]
 };
 const {ResetPasswordForm}=moduleFrom("src/components/reset-password-form.tsx",{
  "next/link":"a",react,
  "@/app/auth/actions":{updatePassword:action}
 });
 return {render:()=>{cursor=0;return ResetPasswordForm({mobileReturn});},actionCalls};
}

function loadAuthActions({user=null,updateError=null}={}){
 const calls={createClient:0,updateUser:[],resetPassword:[]};
 const auth={
  async getUser(){return {data:{user},error:null};},
  async updateUser(payload){calls.updateUser.push(payload);return {error:updateError};},
  async resetPasswordForEmail(email,options){calls.resetPassword.push({email,options});return {error:null};}
 };
 const actions=moduleFrom("src/app/auth/actions.ts",{
  "next/cache":{revalidatePath(){}},
  "next/headers":{headers:async()=>new Map()},
  "next/navigation":{redirect(destination){throw Object.assign(new Error(`NEXT_REDIRECT:${destination}`),{destination});}},
  "@/lib/supabase/server":{createSupabaseServerClient:async()=>{calls.createClient++;return {auth};}},
  "@/lib/supabase/env":{isSupabaseConfigured:()=>true},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts"),
  "@/lib/policy-versions":{CURRENT_MARKETPLACE_TERMS_VERSION:"2026-09-01"},
  "@/lib/auth-email-origin":{resolveAuthEmailOrigin:()=>"https://secondpart.test"},
  "@/lib/auth-error-messages":moduleFrom("src/lib/auth-error-messages.ts")
 });
 return {actions,calls};
}

test("reset form reports mismatched confirmation immediately and blocks submission without exposing either value",()=>{
 const password="private-new-password-1";
 const confirmation="private-different-password-2";
 const harness=loadResetForm();
 let tree=harness.render();
 const passwordInput=findNode(tree,node=>node.type==="input"&&node.props.name==="password");
 assert.equal(typeof passwordInput.props.onChange,"function","new password input must update client mismatch state");
 passwordInput.props.onChange({target:{value:password}});
 tree=harness.render();
 const confirmInput=findNode(tree,node=>node.type==="input"&&node.props.name==="confirmPassword");
 assert.equal(typeof confirmInput.props.onChange,"function","confirmation input must update client mismatch state");
 confirmInput.props.onChange({target:{value:confirmation}});
 tree=harness.render();

 const visible=textContent(tree);
 assert.match(visible,/passwords? do not match/i);
 assert.equal(visible.includes(password),false);
 assert.equal(visible.includes(confirmation),false);
 let prevented=false;
 findNode(tree,node=>node.type==="form").props.onSubmit({preventDefault(){prevented=true;}});
 assert.equal(prevented,true,"the browser action must not run while the fields disagree");
 assert.equal(harness.actionCalls.length,0);
});

test("server password update continues to reject mismatched confirmation before contacting Auth",async()=>{
 const {actions,calls}=loadAuthActions({user:{id:"user-1"}});
 const result=await actions.updatePassword({status:"idle"},formData({password:"private-password-1",confirmPassword:"private-password-2"}));
 assert.equal(result.status,"error");
 assert.match(result.message,/passwords? do not match/i);
 assert.equal(calls.createClient,0);
 assert.equal(calls.updateUser.length,0);
 assert.equal(result.message.includes("private-password"),false);
});

test("an expired reset session gives recovery guidance without exposing submitted passwords",async()=>{
 const {actions,calls}=loadAuthActions();
 const result=await actions.updatePassword({status:"idle"},formData({password:"private-password-1",confirmPassword:"private-password-1"}));
 assert.equal(result.status,"error");
 assert.match(result.message,/reset session has expired|reset link has expired/i);
 assert.match(result.message,/request a new password reset link/i);
 assert.equal(result.message.includes("private-password-1"),false);
 assert.equal(calls.updateUser.length,0);
});

test("password update provider failures use bounded copy",async()=>{
 const diagnostic="internal auth shard 4bd2: private provider trace";
 const {actions}=loadAuthActions({user:{id:"user-1"},updateError:{message:diagnostic,status:503,code:"provider_failure"}});
 const result=await actions.updatePassword({status:"idle"},formData({password:"private-password-1",confirmPassword:"private-password-1"}));
 assert.equal(result.status,"error");
 assert.ok(result.message.length<=180);
 assert.equal(result.message.includes(diagnostic),false);
 assert.equal(result.message.includes("private provider trace"),false);
 assert.equal(result.message.includes("private-password-1"),false);
});

test("reset email callback remains fixed to the reset page and ignores an unsafe returnTo",async()=>{
 const {actions,calls}=loadAuthActions();
 const result=await actions.requestPasswordReset({status:"idle"},formData({email:"buyer@example.test",returnTo:"https://attacker.example/steal"}));
 assert.equal(result.status,"success");
 assert.equal(calls.resetPassword.length,1);
 assert.equal(calls.resetPassword[0].options.redirectTo,"https://secondpart.test/auth/confirm?next=%2Fauth%2Freset-password");
 assert.equal(calls.resetPassword[0].options.redirectTo.includes("attacker.example"),false);
});

test("mobile reset form preserves the mobile return flag for the server completion redirect",()=>{
 const tree=loadResetForm({mobileReturn:true}).render();
 assert.equal(findNode(tree,node=>node.type==="input"&&node.props.name==="mobileReturn").props.value,"1");
});

test("password-updated mobile completion returns to the Android auth deep link",async()=>{
 const MobileAuthReturn=props=>({type:"mobile-auth-return",props});
 const {default:MobileAuthCompletePage}=moduleFrom("src/app/auth/mobile-complete/page.tsx",{
  "next/link":"a",
  "lucide-react":{CheckCircle2:()=>null,KeyRound:()=>null},
  "@/components/header":{Header:()=>null},
  "@/components/mobile-auth-return":{MobileAuthReturn}
 });
 const tree=await MobileAuthCompletePage({searchParams:Promise.resolve({state:"password-updated"})});
 const visible=textContent(tree);
 assert.match(visible,/Password updated/);
 assert.match(visible,/sign in with the new password/);
 assert.deepEqual(JSON.parse(JSON.stringify(findNode(tree,node=>node.type===MobileAuthReturn).props)),{state:"password-updated"});

 let returnTarget="";
 const {MobileAuthReturn:ReturnLink}=moduleFrom("src/components/mobile-auth-return.tsx",{
  react:{useEffect:effect=>effect()},
  "next/link":"a"
 },{window:{setTimeout(callback,delay){assert.equal(delay,250);callback();return 1;},clearTimeout(){},location:{set href(value){returnTarget=value;}}}});
 const returnLink=ReturnLink({state:"password-updated"});
 assert.equal(returnLink.props.href,"secondpart://auth?state=password-updated");
 assert.equal(returnTarget,"secondpart://auth?state=password-updated");
});
