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
 vm.runInNewContext(compiled,{exports,require(name){if(name==="react/jsx-runtime")return jsxRuntime;if(name==="react")return react;if(name==="next/link")return {default:"a"};if(name==="next/navigation")return {useRouter:()=>({push(){}})};if(name==="lucide-react")return new Proxy({},{get:()=>icon});if(name==="@/app/auth/actions")return {signOut(){}};if(name==="@/components/category-browser")return {CategoryBrowser:()=>null};if(name==="@/lib/marketplace-navigation")return {resetMarketplacePagination(){}};throw new Error(`Unexpected dependency ${name}`);},URLSearchParams,window:{location:{pathname:"/",search:""}},document,console});
 return {HeaderShell:exports.HeaderShell,document,listeners,render(props={categories:[],user:false,displayName:null,seller:false}){hookIndex=0;effects=[];return exports.HeaderShell(props);},flushEffects(){const queued=effects;effects=[];queued.forEach(effect=>effect());}};
}

function nodes(tree){const found=[];const visit=value=>{if(value===null||value===undefined||typeof value==="boolean")return;if(Array.isArray(value)){value.forEach(visit);return;}if(typeof value!=="object")return;found.push(value);visit(value.props?.children);};visit(tree);return found;}
function textContent(value){if(value===null||value===undefined||typeof value==="boolean")return "";if(Array.isArray(value))return value.map(textContent).join("");if(typeof value==="object")return textContent(value.props?.children);return String(value);}
const button=(tree,label)=>nodes(tree).find(node=>node.type==="button"&&textContent(node)===label);
const ariaButton=(tree,label)=>nodes(tree).find(node=>node.type==="button"&&node.props["aria-label"]===label);
const nativeKey=(key,target)=>{const event=new Event("keydown",{cancelable:true});Object.defineProperties(event,{key:{value:key},target:{value:target}});return event;};
const classTokens=node=>String(node.props?.className??"").split(/\s+/).filter(Boolean);
function visibleAt(node,width){
 let display=classTokens(node).includes("hidden")?"none":"visible";
 for(const [minimum,prefix] of [[768,"md"],[1024,"lg"],[1280,"xl"]]){
  if(width<minimum)continue;
  for(const token of classTokens(node)){
   if(token===`${prefix}:hidden`)display="none";
   if([`${prefix}:block`,`${prefix}:flex`,`${prefix}:grid`,`${prefix}:inline-flex`].includes(token))display="visible";
  }
 }
 return display!=="none";
}

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

test("tablet widths keep the complete mobile menu until the proven desktop boundary",()=>{
 const runner=hookRunner();
 let tree=runner.render();
 const primary=nodes(tree).find(node=>node.type==="nav"&&node.props["aria-label"]==="Primary navigation");
 const menu=ariaButton(tree,"Open navigation");
 for(const width of [768,1024,1279]){
  assert.equal(visibleAt(primary,width),false,`primary navigation must stay hidden at ${width}px`);
  assert.equal(visibleAt(menu,width),true,`mobile menu trigger must stay visible at ${width}px`);
 }
 assert.equal(visibleAt(primary,1280),true);
 assert.equal(visibleAt(menu,1280),false);

 menu.props.onClick();
 tree=runner.render();
 const mobilePanel=nodes(tree).find(node=>node.props?.id===menu.props["aria-controls"]);
 assert.equal(visibleAt(mobilePanel,1279),true);
 assert.equal(visibleAt(mobilePanel,1280),false);

 const desktopRunner=hookRunner();
 let desktopTree=desktopRunner.render();
 const categories=button(desktopTree,"Car parts");
 categories.props.onClick();
 desktopTree=desktopRunner.render();
 const desktopPanel=nodes(desktopTree).find(node=>node.props?.id===categories.props["aria-controls"]);
 assert.equal(visibleAt(desktopPanel,1279),false);
 assert.equal(visibleAt(desktopPanel,1280),true);
});

test("authenticated narrow headers remove redundant Garage and Seller actions but keep both destinations in the menu",()=>{
 const runner=hookRunner();
 let tree=runner.render({categories:[],user:true,displayName:"QA Buyer",seller:true});
 const garageAction=nodes(tree).find(node=>node.type==="a"&&node.props["aria-label"]==="SecondPart Garage");
 const sellerAction=nodes(tree).find(node=>node.type==="a"&&node.props["aria-label"]==="Seller dashboard");
 for(const action of [garageAction,sellerAction]){
  assert.equal(visibleAt(action,390),false);
  assert.equal(visibleAt(action,1279),false);
  assert.equal(visibleAt(action,1280),true);
 }

 ariaButton(tree,"Open navigation").props.onClick();
 tree=runner.render({categories:[],user:true,displayName:"QA Buyer",seller:true});
 const mobileMenu=nodes(tree).find(node=>node.type==="nav"&&node.props["aria-label"]==="Mobile menu");
 const destinations=nodes(mobileMenu).filter(node=>node.type==="a").map(node=>node.props.href);
 assert.ok(destinations.includes("/garage"));
 assert.ok(destinations.includes("/dashboard"));
});

test("brand badge keeps its square while the wordmark yields when enlarged text reduces available space",()=>{
 const tree=hookRunner().render();
 const brand=nodes(tree).find(node=>node.type==="a"&&node.props.href==="/");
 const badge=nodes(brand).find(node=>node.type==="span"&&textContent(node)==="S");
 const wordmark=nodes(brand).find(node=>node.type==="span"&&textContent(node)==="SecondPart");
 assert.ok(classTokens(badge).includes("shrink-0"));
 assert.ok(classTokens(wordmark).includes("truncate"));
 assert.equal(brand.props["aria-label"],"SecondPart home");
});
