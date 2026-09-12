import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root=path.resolve(import.meta.dirname,"..");
const Fragment=Symbol("Fragment");
const jsxRuntime={
 Fragment,
 jsx:(type,props,key)=>({type,props:props??{},key:key??null}),
 jsxs:(type,props,key)=>({type,props:props??{},key:key??null})
};

function compile(relativePath,dependencies={}){
 const source=fs.readFileSync(path.join(root,relativePath),"utf8");
 const output=ts.transpileModule(source,{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};
 vm.runInNewContext(output,{
  exports,
  require(name){
   if(name==="react/jsx-runtime")return jsxRuntime;
   if(name in dependencies)return dependencies[name];
   throw new Error(`Unexpected dependency ${name}`);
  },
  console,
  performance:dependencies.performance??globalThis.performance,
  window:dependencies.window??{}
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

function hasBusyAncestor(tree,target,busy=false){
 if(tree===null||tree===undefined||typeof tree==="boolean")return false;
 if(Array.isArray(tree))return tree.some(value=>hasBusyAncestor(value,target,busy));
 if(typeof tree!=="object")return false;
 if(tree===target)return busy;
 return hasBusyAncestor(tree.props?.children,target,busy||tree.props?.["aria-busy"]==="true");
}

function mobileNavHarness(){
 const state=[];
 const refs=[];
 const memoValues=[];
 const memoDeps=[];
 const effectDeps=[];
 let hookIndex=0;
 let queuedEffects=[];
 let pathname="/";
 let pendingHref=null;
 let currentLinkHref=null;
 let now=100;
 const prefetchCalls=[];
 const infoLogs=[];
 const warningLogs=[];

 const changed=(prior,next)=>!prior||!next||prior.length!==next.length||next.some((value,index)=>!Object.is(value,prior[index]));
 const react={
  useState(initial){const index=hookIndex++;if(!(index in state))state[index]=typeof initial==="function"?initial():initial;return [state[index],value=>{state[index]=typeof value==="function"?value(state[index]):value;}];},
  useRef(initial){const index=hookIndex++;if(!(index in refs))refs[index]={current:initial};return refs[index];},
  useMemo(factory,deps){const index=hookIndex++;if(changed(memoDeps[index],deps)){memoValues[index]=factory();memoDeps[index]=deps;}return memoValues[index];},
  useCallback(callback,deps){const index=hookIndex++;if(changed(memoDeps[index],deps)){memoValues[index]=callback;memoDeps[index]=deps;}return memoValues[index];},
  useEffect(effect,deps){const index=hookIndex++;if(changed(effectDeps[index],deps)){effectDeps[index]=deps;queuedEffects.push(effect);}}
 };
 const Link=function Link(){};
 const nextLink={__esModule:true,default:Link,useLinkStatus:()=>({pending:currentLinkHref===pendingHref})};
 const router={prefetch(href){prefetchCalls.push(href);}};
 const navigation={usePathname:()=>pathname,useRouter:()=>router};
 const icons=new Proxy({},{get:()=>function Icon(props){return {type:"svg",props};}});
 const fakeConsole={...console,info:value=>infoLogs.push(value),warn:value=>warningLogs.push(value)};
 const fakeWindow={
  requestIdleCallback(callback){callback();return 1;},
  cancelIdleCallback(){},
  setTimeout(callback){callback();return 1;},
  clearTimeout(){}
 };
 const source=fs.readFileSync(path.join(root,"src/components/mobile-bottom-nav.tsx"),"utf8");
 const output=ts.transpileModule(source,{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};
 vm.runInNewContext(output,{
  exports,
  require(name){if(name==="react/jsx-runtime")return jsxRuntime;if(name==="react")return react;if(name==="next/link")return nextLink;if(name==="next/navigation")return navigation;if(name==="lucide-react")return icons;throw new Error(`Unexpected dependency ${name}`);},
  console:fakeConsole,
  performance:{now:()=>now},
  window:fakeWindow
 });

 const resolve=value=>{
  if(value===null||value===undefined||typeof value==="boolean")return value;
  if(Array.isArray(value))return value.map(resolve);
  if(typeof value!=="object")return value;
  if(value.type===Fragment)return resolve(value.props.children);
  if(value.type===Link){
   const previous=currentLinkHref;
   currentLinkHref=String(value.props.href);
   const child=resolve(value.props.children);
   currentLinkHref=previous;
   return {type:"a",key:value.key,props:{...value.props,children:child}};
  }
  if(typeof value.type==="function")return resolve(value.type(value.props));
  return {...value,props:{...value.props,children:resolve(value.props?.children)}};
 };
 const render=()=>{hookIndex=0;queuedEffects=[];return resolve(exports.MobileBottomNav());};
 const flushEffects=()=>{const effects=queuedEffects;queuedEffects=[];for(const effect of effects)effect();};
 const link=(tree,href)=>nodes(tree).find(node=>node.type==="a"&&node.props.href===href);
 const highlighted=anchor=>nodes(anchor).some(node=>String(node.props?.className??"").includes("bg-[#d4f44d]"));
 const dispatchClick=(anchor,{modified=false}={})=>{
  const click=new Event("click",{cancelable:true});
  Object.defineProperties(click,{button:{value:0},ctrlKey:{value:modified},metaKey:{value:false},shiftKey:{value:false},altKey:{value:false}});
  anchor.props.onClick?.(click);
  if(!modified&&!click.defaultPrevented){
   anchor.props.onNavigate?.({preventDefault(){}});
   pendingHref=anchor.props.href;
  }
 };
 return {
  render,flushEffects,link,highlighted,dispatchClick,prefetchCalls,infoLogs,warningLogs,
  setPathname(value){pathname=value;},
  setPending(value){pendingHref=value;},
  setNow(value){now=value;}
 };
}

test("root tabs rely on Link prefetch without ten imperative prefetch calls per pathname",()=>{
 const harness=mobileNavHarness();
 const tree=harness.render();
 harness.flushEffects();
 assert.equal(harness.prefetchCalls.length,0);
 const links=nodes(tree).filter(node=>node.type==="a");
 assert.equal(links.length,5);
 assert.ok(links.every(link=>link.props.prefetch===true));
 assert.deepEqual(links.map(link=>link.props.href),["/","/garage","/account/orders","/inbox","/account"]);
 assert.ok(links.every(link=>link.props.replace===undefined&&link.props.scroll===undefined));
});

test("modified clicks preserve the committed tab without showing false pending feedback",()=>{
 const harness=mobileNavHarness();
 let tree=harness.render();
 const garage=harness.link(tree,"/garage");
 harness.dispatchClick(garage,{modified:true});
 tree=harness.render();
 assert.equal(harness.link(tree,"/").props["aria-current"],"page");
 assert.equal(harness.link(tree,"/garage").props["aria-current"],undefined);
 assert.equal(harness.highlighted(harness.link(tree,"/garage")),false);
});

test("Link pending feedback clears on cancellation while aria-current follows only committed paths",()=>{
 const harness=mobileNavHarness();
 let tree=harness.render();
 harness.dispatchClick(harness.link(tree,"/garage"));
 tree=harness.render();
 assert.equal(harness.link(tree,"/").props["aria-current"],"page");
 assert.equal(harness.link(tree,"/garage").props["aria-current"],undefined);
 assert.equal(harness.highlighted(harness.link(tree,"/garage")),true);

 harness.setPending(null);
 tree=harness.render();
 assert.equal(harness.link(tree,"/").props["aria-current"],"page");
 assert.equal(harness.highlighted(harness.link(tree,"/garage")),false);
});

test("cancelled navigation cannot create a false timing log on a later matching history change",()=>{
 const harness=mobileNavHarness();
 let tree=harness.render();
 harness.flushEffects();
 harness.dispatchClick(harness.link(tree,"/garage"));
 tree=harness.render();
 harness.flushEffects();
 harness.setPending(null);
 tree=harness.render();
 harness.flushEffects();

 harness.setNow(900);
 harness.setPathname("/garage");
 harness.render();
 harness.flushEffects();
 assert.deepEqual(harness.infoLogs,[]);
 assert.deepEqual(harness.warningLogs,[]);
});

test("committed Link navigation records timing and selects the destination",()=>{
 const harness=mobileNavHarness();
 let tree=harness.render();
 harness.flushEffects();
 harness.dispatchClick(harness.link(tree,"/garage"));
 harness.setNow(143);
 harness.setPathname("/garage");
 harness.setPending(null);
 tree=harness.render();
 harness.flushEffects();
 assert.equal(harness.link(tree,"/").props["aria-current"],undefined);
 assert.equal(harness.link(tree,"/garage").props["aria-current"],"page");
 assert.deepEqual(harness.infoLogs,["[SecondPart][nav] / -> /garage 43ms"]);
 assert.deepEqual(harness.warningLogs,[]);
});

test("all five loading boundaries announce real status text and hide skeleton shapes",()=>{
 const react={};
 const {RootTabLoading}=compile("src/components/root-tab-loading.tsx",{"react":react});
 const variants=[
  ["garage","Loading your garage"],
  ["purchases","Loading purchases"],
  ["inbox","Loading messages"],
  ["account","Loading your account"]
 ];
 for(const [variant,message] of variants){
  const tree=RootTabLoading({variant});
  const status=nodes(tree).find(node=>node.props?.role==="status");
  assert.ok(nodes(tree).some(node=>node.props?.["aria-busy"]==="true"));
  assert.equal(textContent(status),message);
  assert.equal(hasBusyAncestor(tree,status),false);
  assert.equal(nodes(tree).find(node=>String(node.props?.className??"").includes("animate-pulse"))?.props["aria-hidden"],"true");
 }
 const home=compile("src/app/loading.tsx").default();
 const homeStatus=nodes(home).find(node=>node.props?.role==="status");
 assert.ok(nodes(home).some(node=>node.props?.["aria-busy"]==="true"));
 assert.equal(textContent(homeStatus),"Loading marketplace");
 assert.equal(hasBusyAncestor(home,homeStatus),false);
 assert.equal(nodes(home).find(node=>String(node.props?.className??"").includes("animate-pulse"))?.props["aria-hidden"],"true");
});
