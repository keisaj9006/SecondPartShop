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

function moduleFrom(relativePath,dependencies={}){
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
  URL,URLSearchParams,Request,Response,FormData,process,console
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

function loadAuthForm({signupState={status:"idle"},signinState={status:"idle"},pending=false}={}){
 const state=[];
 const refs=[];
 let currentSignupState=signupState;
 let currentPending=pending;
 let stateIndex=0;
 let refIndex=0;
 const useState=initial=>{
  const index=stateIndex++;
  if(!(index in state))state[index]=initial;
  return [state[index],value=>{state[index]=typeof value==="function"?value(state[index]):value;}];
 };
 const useRef=initial=>{
  const index=refIndex++;
  if(!(index in refs))refs[index]={current:initial};
  return refs[index];
 };
 const useActionState=(action)=>[
  action.name==="signUp"?currentSignupState:signinState,
  ()=>{},
  currentPending
 ];
 function signIn(){}
 function signUp(){}
 const {AuthForm}=moduleFrom("src/components/auth-form.tsx",{
  "next/link":"a",
  react:{useState,useRef,useEffect:()=>{},useActionState},
  "lucide-react":new Proxy({},{get:()=>()=>null}),
  "@/app/auth/actions":{signIn,signUp},
  "@/lib/navigation":moduleFrom("src/lib/navigation.ts")
 });
 return {
  AuthForm,
  setSignupState:value=>{currentSignupState=value;},
  setPending:value=>{currentPending=value;},
  render:props=>{stateIndex=0;refIndex=0;return AuthForm(props);}
 };
}

function submitEvent(password,confirmPassword){
 let prevented=false;
 return {
  event:{
   preventDefault(){prevented=true;},
   currentTarget:{elements:{namedItem(name){
    return {value:{email:"buyer@example.test",password,confirmPassword,"role":"buyer"}[name]};
   }}}
  },
  wasPrevented:()=>prevented
 };
}

test("signup renders a confirmation password field",()=>{
 const {render}=loadAuthForm();
 const tree=render({defaultMode:"signup"});
 const input=findNode(tree,node=>node.type==="input"&&node.props.name==="confirmPassword");
 assert.equal(input.props.type,"password");
 assert.equal(input.props.autoComplete,"new-password");
});

test("signup shows client-side mismatch feedback and blocks the action",()=>{
 const {render}=loadAuthForm();
 const tree=render({defaultMode:"signup"});
 const form=findNode(tree,node=>node.type==="form");
 const submission=submitEvent("correct-horse-battery","different-password");
 form.props.onSubmit(submission.event);
 assert.equal(submission.wasPrevented(),true);
 const updated=render({defaultMode:"signup"});
 assert.match(textContent(updated),/passwords do not match/i);
});

test("signup blocks a synchronous duplicate submit and disables while pending",()=>{
 const {render}=loadAuthForm();
 const tree=render({defaultMode:"signup"});
 const form=findNode(tree,node=>node.type==="form");
 const first=submitEvent("correct-horse-battery","correct-horse-battery");
 const second=submitEvent("correct-horse-battery","correct-horse-battery");
 form.props.onSubmit(first.event);
 form.props.onSubmit(second.event);
 assert.equal(first.wasPrevented(),false);
 assert.equal(second.wasPrevented(),true);

 const pendingTree=loadAuthForm({pending:true}).render({defaultMode:"signup"});
 assert.equal(findNode(pendingTree,node=>node.type==="button"&&textContent(node).includes("Please wait")).props.disabled,true);
});

test("confirmation-required signup shows a masked address without putting it in a URL",()=>{
 const email="buyer@example.test";
 const {render,setSignupState}=loadAuthForm();
 const tree=render({defaultMode:"signup",returnTo:"/saved?view=parts"});
 const emailInput=findNode(tree,node=>node.type==="input"&&node.props.name==="email");
 emailInput.props.onChange({target:{value:email}});
 setSignupState({status:"success",message:"Check your email to confirm your account."});
 const success=render({defaultMode:"signup",returnTo:"/saved?view=parts"});
 assert.match(textContent(success),/Check your email/i);
 assert.match(textContent(success),/b\*+@example\.test/);
 assert.equal(nodes(success).some(node=>node.type==="form"),false);
 for(const node of nodes(success)){
  const href=node.props?.href;
  if(typeof href==="string")assert.equal(href.includes(email),false);
 }
});

test("confirmation state preserves safe sign-in and resend context",()=>{
 const target="/parts/used-alternator?cv=variant#fitment";
 const {render}=loadAuthForm({signupState:{status:"success",message:"Check your email to confirm your account."}});
 const tree=render({defaultMode:"signup",defaultRole:"seller",returnTo:target});
 const signin=findNode(tree,node=>node.props?.href===`/account?mode=signin&role=seller&returnTo=${encodeURIComponent(target)}`);
 const resend=findNode(tree,node=>node.props?.href===`/auth/verify-email?returnTo=${encodeURIComponent(target)}`);
 assert.equal(textContent(signin),"Sign in to your account");
 assert.equal(textContent(resend),"Resend confirmation email");
 assert.equal(signin.props.href,`/account?mode=signin&role=seller&returnTo=${encodeURIComponent(target)}`);
 assert.equal(resend.props.href,`/auth/verify-email?returnTo=${encodeURIComponent(target)}`);
});

test("confirmation state uses the submitted email and role when fields change while pending",()=>{
 const harness=loadAuthForm();
 const props={defaultMode:"signup",defaultRole:"buyer",returnTo:"/saved"};
 const initial=harness.render(props);
 const form=findNode(initial,node=>node.type==="form");
 const submission=submitEvent("correct-horse-battery","correct-horse-battery");
 form.props.onSubmit(submission.event);
 assert.equal(submission.wasPrevented(),false);

 harness.setPending(true);
 const pending=harness.render(props);
 const sellerChoice=findNode(pending,node=>node.type==="button"&&textContent(node).includes("I want to sell parts"));
 sellerChoice.props.onClick();
 const email=findNode(pending,node=>node.type==="input"&&node.props.name==="email");
 email.props.onChange({target:{value:"edited@example.test"}});

 harness.setPending(false);
 harness.setSignupState({status:"success",message:"Check your email."});
 const success=harness.render(props);
 assert.match(textContent(success),/b\*+@example\.test/);
 assert.equal(textContent(success).includes("edited@example.test"),false);
 const signin=findNode(success,node=>node.props?.href==="/account?mode=signin&role=buyer&returnTo=%2Fsaved");
 assert.equal(textContent(signin),"Sign in to your account");
});
