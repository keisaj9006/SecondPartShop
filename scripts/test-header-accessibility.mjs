import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root=path.resolve(import.meta.dirname,"..");
const jsxRuntime={Fragment:Symbol("Fragment"),jsx:(type,props,key)=>({type,props:props??{},key:key??null}),jsxs:(type,props,key)=>({type,props:props??{},key:key??null})};
const icon=()=>null;

function hookRunner(){
 const state=[];const refs=[];const deps=[];let hookIndex=0;let effects=[];
 const listeners=new Map();
 const document={addEventListener:(name,handler)=>listeners.set(name,handler),removeEventListener:(name,handler)=>{if(listeners.get(name)===handler)listeners.delete(name);}};
 const react={
  useState(initial){const index=hookIndex++;if(!(index in state))state[index]=typeof initial==="function"?initial():initial;return [state[index],value=>{state[index]=typeof value==="function"?value(state[index]):value;}];},
  useRef(initial){const index=hookIndex++;if(!(index in refs))refs[index]={current:initial};return refs[index];},
  useTransition(){hookIndex++;return [false,callback=>callback()];},
  useEffect(effect,nextDeps){const index=hookIndex++;const prior=deps[index];const changed=!prior||nextDeps.some((value,position)=>!Object.is(value,prior[position]));deps[index]=nextDeps;if(changed)effects.push(effect);}
 };
 const source=fs.readFileSync(path.join(root,"src/components/header-shell.tsx"),"utf8");
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};
 vm.runInNewContext(compiled,{exports,require(name){if(name==="react/jsx-runtime")return jsxRuntime;if(name==="react")return react;if(name==="next/link")return "a";if(name==="next/navigation")return {useRouter:()=>({push(){}})};if(name==="lucide-react")return new Proxy({},{get:()=>icon});if(name==="@/app/auth/actions")return {signOut(){}};if(name==="@/components/category-browser")return {CategoryBrowser:()=>null};if(name==="@/lib/marketplace-navigation")return {resetMarketplacePagination(){}};throw new Error(`Unexpected dependency ${name}`);},URLSearchParams,window:{location:{pathname:"/",search:""}},document,console});
 return {HeaderShell:exports.HeaderShell,document,listeners,render(props={categories:[],user:false,displayName:null,seller:false}){hookIndex=0;effects=[];return exports.HeaderShell(props);},flushEffects(){const queued=effects;effects=[];queued.forEach(effect=>effect());}};
}

function nodes(tree){const found=[];const visit=value=>{if(value===null||value===undefined||typeof value==="boolean")return;if(Array.isArray(value)){value.forEach(visit);return;}if(typeof value!=="object")return;found.push(value);visit(value.props?.children);};visit(tree);return found;}
function textContent(value){if(value===null||value===undefined||typeof value==="boolean")return "";if(Array.isArray(value))return value.map(textContent).join("");if(typeof value==="object")return textContent(value.props?.children);return String(value);}
const button=(tree,label)=>nodes(tree).find(node=>node.type==="button"&&textContent(node)===label);
const ariaButton=(tree,label)=>nodes(tree).find(node=>node.type==="button"&&node.props["aria-label"]===label);
const nativeKey=(key,target)=>{const event=new Event("keydown",{cancelable:true});Object.defineProperties(event,{key:{value:key},target:{value:target}});return event;};

test("desktop and mobile header navigation landmarks have distinct accessible names",()=>{
 const runner=hookRunner();
 let tree=runner.render();
 assert.equal(nodes(tree).find(node=>node.type==="nav")?.props["aria-label"],"Primary navigation");
 ariaButton(tree,"Open navigation").props.onClick();
 tree=runner.render();
 assert.deepEqual(nodes(tree).filter(node=>node.type==="nav").map(node=>node.props["aria-label"]),["Primary navigation","Mobile menu"]);
});

test("desktop categories are a truthful in-flow disclosure and Escape returns focus from its content",()=>{
 const runner=hookRunner();
 let tree=runner.render();runner.flushEffects();
 let trigger=button(tree,"Car parts");
 assert.equal(trigger.props["aria-expanded"],false);
 assert.equal(typeof trigger.props["aria-controls"],"string");
 trigger.props.onClick();
 tree=runner.render();
 trigger=button(tree,"Car parts");
 assert.equal(trigger.props["aria-expanded"],true);
 const panel=nodes(tree).find(node=>node.props?.id===trigger.props["aria-controls"]);
 assert.ok(panel);
 assert.equal(panel.props.role,undefined);
 assert.equal(panel.props["aria-modal"],undefined);
 let focused=0;
 trigger.props.ref.current={focus(){focused++;}};
 const inside={};
 panel.props.ref.current={contains:target=>target===inside};
 runner.listeners.get("keydown")(nativeKey("Escape",inside));
 tree=runner.render();
 assert.equal(button(tree,"Car parts").props["aria-expanded"],false);
 assert.equal(focused,1);
});

test("mobile navigation and nested categories expose their disclosure state",()=>{
 const runner=hookRunner();
 let tree=runner.render();
 let menu=ariaButton(tree,"Open navigation");
 assert.equal(menu.props["aria-expanded"],false);
 assert.equal(typeof menu.props["aria-controls"],"string");
 menu.props.onClick();
 tree=runner.render();
 menu=ariaButton(tree,"Close navigation");
 assert.equal(menu.props["aria-expanded"],true);
 assert.ok(nodes(tree).some(node=>node.props?.id===menu.props["aria-controls"]));
 const categories=nodes(tree).find(node=>node.type==="button"&&node.props["aria-controls"]==="header-mobile-categories");
 assert.equal(categories.props["aria-expanded"],false);
 assert.equal(typeof categories.props["aria-controls"],"string");
 categories.props.onClick();
 tree=runner.render();
 const expandedCategories=nodes(tree).find(node=>node.type==="button"&&node.props["aria-controls"]==="header-mobile-categories");
 assert.equal(expandedCategories.props["aria-expanded"],true);
 assert.ok(nodes(tree).some(node=>node.props?.id===expandedCategories.props["aria-controls"]));
});

test("Escape from mobile navigation closes it and returns focus without trapping Tab",()=>{
 const runner=hookRunner();
 let tree=runner.render();runner.flushEffects();
 ariaButton(tree,"Open navigation").props.onClick();
 tree=runner.render();
 const menu=ariaButton(tree,"Close navigation");
 let focused=0;
 menu.props.ref.current={focus(){focused++;}};
 const panel=nodes(tree).find(node=>node.props?.id===menu.props["aria-controls"]);
 const inside={};
 panel.props.ref.current={contains:target=>target===inside};
 const tab=nativeKey("Tab",inside);
 runner.listeners.get("keydown")(tab);
 assert.equal(tab.defaultPrevented,false);
 assert.equal(ariaButton(runner.render(),"Close navigation").props["aria-expanded"],true);
 runner.listeners.get("keydown")(nativeKey("Escape",inside));
 tree=runner.render();
 assert.equal(ariaButton(tree,"Open navigation").props["aria-expanded"],false);
 assert.equal(focused,1);
});
