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

function moduleFrom(relativePath,react,globals={}){
 const source=fs.readFileSync(path.join(root,relativePath),"utf8");
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};
 vm.runInNewContext(compiled,{
  exports,
  require(name){
   if(name==="react/jsx-runtime")return jsxRuntime;
   if(name==="react")return react;
   if(name==="next/navigation")return {useRouter:()=>({push(){}})};
   if(name==="lucide-react")return new Proxy({},{get:()=>()=>null});
   if(name==="@/components/vehicle-visual")return {VehicleVisual:()=>null};
   if(name==="@/lib/vehicle-context")return {clearStoredVehicleContext(){}};
   throw new Error(`Unexpected dependency ${name}`);
  },
  URL,URLSearchParams,AbortController,console,window:{setTimeout,clearTimeout},document:globals.document??{},fetch:async()=>({ok:true,json:async()=>({items:[]})})
 });
 return exports;
}

function hookRunner(){
 const state=[];
 const ids=[];
 const refs=[];
 const effectDeps=[];
 let hookIndex=0;
 let pendingEffects=[];
 let nextId=0;
 const react={
  useId(){const index=hookIndex++;if(!(index in ids))ids[index]=`test-${++nextId}`;return ids[index];},
  useState(initial){const index=hookIndex++;if(!(index in state))state[index]=typeof initial==="function"?initial():initial;return [state[index],value=>{state[index]=typeof value==="function"?value(state[index]):value;}];},
  useRef(initial){const index=hookIndex++;if(!(index in refs))refs[index]={current:initial};return refs[index];},
  useEffect(effect,deps){const index=hookIndex++;const previous=effectDeps[index];const changed=!previous||!deps||deps.length!==previous.length||deps.some((value,position)=>!Object.is(value,previous[position]));effectDeps[index]=deps;if(changed)pendingEffects.push(effect);},
  useTransition(){hookIndex++;return [false,callback=>callback()];}
 };
 return {
  react,
  render(component,props){hookIndex=0;pendingEffects=[];return component(props);},
  flushEffects(){const effects=pendingEffects;pendingEffects=[];for(const effect of effects)effect();}
 };
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

const byRole=(tree,role)=>nodes(tree).filter(node=>node.props?.role===role);
const nativeEvent=(type,properties={})=>{
 const event=new Event(type,{cancelable:true});
 for(const [key,value] of Object.entries(properties))Object.defineProperty(event,key,{configurable:true,value});
 return event;
};
const options=[
 {value:"bmw",label:"BMW"},
 {value:"mercedes-benz",label:"Mercedes-Benz"},
 {value:"volkswagen",label:"Volkswagen"}
];

test("two vehicle comboboxes have distinct relationships and explicit accessible names",()=>{
 const runner=hookRunner();
 const {SearchableVehicleSelect}=moduleFrom("src/components/vehicle-selector.tsx",runner.react);
 const render=()=>runner.render(()=>[
  SearchableVehicleSelect({value:"",options,placeholder:"Search vehicle",label:"Make",onChange(){}}),
  SearchableVehicleSelect({value:"",options,placeholder:"Search vehicle",label:"Model",onChange(){}})
 ]);
 let tree=render();
 for(const input of byRole(tree,"combobox"))input.props.onFocus(nativeEvent("focus"));
 tree=render();
 const inputs=byRole(tree,"combobox");
 const listboxes=byRole(tree,"listbox");
 assert.deepEqual(inputs.map(input=>input.props["aria-label"]),["Make","Model"]);
 assert.deepEqual(listboxes.map(listbox=>listbox.props["aria-label"]),["Make","Model"]);
 assert.equal(new Set(inputs.map(input=>input.props["aria-controls"])).size,2);
 assert.equal(new Set(listboxes.map(listbox=>listbox.props.id)).size,2);
 for(const input of inputs){
  assert.equal(input.props["aria-expanded"],true);
  assert.equal(input.props["aria-activedescendant"],undefined);
 }
});

test("option IDs remain stable while filtering and options stay outside the tab order",()=>{
 const runner=hookRunner();
 const {SearchableVehicleSelect}=moduleFrom("src/components/vehicle-selector.tsx",runner.react);
 const render=(nextOptions=options)=>runner.render(SearchableVehicleSelect,{value:"",options:nextOptions,placeholder:"Search make",label:"Make",onChange(){}});
 let tree=render();
 byRole(tree,"combobox")[0].props.onFocus(nativeEvent("focus"));
 tree=render();
 const original=byRole(tree,"option").find(option=>option.props.children==="BMW");
 assert.equal(typeof original.props.id,"string");
 assert.ok(byRole(tree,"option").every(option=>option.props.tabIndex===-1));
 byRole(tree,"combobox")[0].props.onChange(nativeEvent("input",{target:{value:"bm"}}));
 tree=render();
 const filtered=byRole(tree,"option").find(option=>option.props.children==="BMW");
 assert.equal(filtered.props.id,original.props.id);
 assert.equal(byRole(tree,"combobox")[0].props["aria-activedescendant"],undefined);
 byRole(tree,"combobox")[0].props.onKeyDown(nativeEvent("keydown",{key:"ArrowDown"}));
 tree=render();
 assert.equal(byRole(tree,"combobox")[0].props["aria-activedescendant"],filtered.props.id);
 tree=render([options[2],options[0],options[1]]);
 assert.equal(byRole(tree,"option").find(option=>option.props.children==="BMW").props.id,original.props.id);
});

test("keyboard navigation never selects until Enter targets an available active option",()=>{
 const changes=[];
 const runner=hookRunner();
 const {SearchableVehicleSelect}=moduleFrom("src/components/vehicle-selector.tsx",runner.react);
 const render=(nextOptions=options,disabled=false)=>runner.render(SearchableVehicleSelect,{value:"bmw",options:nextOptions,placeholder:"Search make",label:"Make",disabled,onChange:value=>changes.push(value)});
 let tree=render();
 let input=byRole(tree,"combobox")[0];
 input.props.onFocus(nativeEvent("focus"));
 tree=render();input=byRole(tree,"combobox")[0];
 input.props.onKeyDown(nativeEvent("keydown",{key:"ArrowDown"}));
 input.props.onKeyDown(nativeEvent("keydown",{key:"ArrowUp"}));
 assert.deepEqual(changes,[]);

 tree=render();input=byRole(tree,"combobox")[0];
 input.props.onChange(nativeEvent("input",{target:{value:"zzz"}}));
 tree=render();input=byRole(tree,"combobox")[0];
 assert.equal(input.props["aria-activedescendant"],undefined);
 const emptyEnter=nativeEvent("keydown",{key:"Enter"});
 input.props.onKeyDown(emptyEnter);
 assert.deepEqual(changes,[]);
 assert.equal(emptyEnter.defaultPrevented,true);
 assert.equal(byRole(tree,"status")[0].props.children,"No matching options");

 input.props.onChange(nativeEvent("input",{target:{value:"merc"}}));
 tree=render();input=byRole(tree,"combobox")[0];
 input.props.onKeyDown(nativeEvent("keydown",{key:"ArrowDown"}));
 tree=render();input=byRole(tree,"combobox")[0];
 input.props.onKeyDown(nativeEvent("keydown",{key:"Enter"}));
 assert.deepEqual(changes,["mercedes-benz"]);

 tree=render();input=byRole(tree,"combobox")[0];
 input.props.onFocus(nativeEvent("focus"));
 tree=render();input=byRole(tree,"combobox")[0];
 input.props.onKeyDown(nativeEvent("keydown",{key:"ArrowDown"}));
 tree=render([{value:"replacement",label:"Replacement"}]);input=byRole(tree,"combobox")[0];
 assert.equal(input.props["aria-activedescendant"],undefined);
 input.props.onKeyDown(nativeEvent("keydown",{key:"Enter"}));
 assert.deepEqual(changes,["mercedes-benz"]);

 tree=render();input=byRole(tree,"combobox")[0];
 input.props.onFocus(nativeEvent("focus"));
 tree=render();input=byRole(tree,"combobox")[0];
 input.props.onChange(nativeEvent("input",{target:{value:"volk"}}));
 tree=render();input=byRole(tree,"combobox")[0];
 input.props.onKeyDown(nativeEvent("keydown",{key:"Escape"}));
 assert.deepEqual(changes,["mercedes-benz"]);
 tree=render();input=byRole(tree,"combobox")[0];
 assert.equal(input.props["aria-expanded"],false);
 assert.equal(input.props.value,"BMW");

 input.props.onFocus(nativeEvent("focus"));
 tree=render();input=byRole(tree,"combobox")[0];
 const tab=nativeEvent("keydown",{key:"Tab"});
 input.props.onKeyDown(tab);
 assert.equal(tab.defaultPrevented,false);
 assert.deepEqual(changes,["mercedes-benz"]);
 tree=render();
 assert.equal(byRole(tree,"combobox")[0].props["aria-expanded"],false);

 byRole(tree,"combobox")[0].props.onFocus(nativeEvent("focus"));
 tree=render([],false);
 input=byRole(tree,"combobox")[0];
 assert.equal(input.props["aria-activedescendant"],undefined);
 input.props.onKeyDown(nativeEvent("keydown",{key:"Enter"}));
 assert.deepEqual(changes,["mercedes-benz"]);
 tree=render(options,true);
 assert.equal(byRole(tree,"combobox")[0].props["aria-expanded"],false);
 assert.equal(byRole(tree,"combobox")[0].props["aria-activedescendant"],undefined);
});

test("disabled or empty options discard keyboard intent even when the same options return",()=>{
 for(const interruption of ["disabled","empty"]){
  const changes=[];
  const runner=hookRunner();
  const {SearchableVehicleSelect}=moduleFrom("src/components/vehicle-selector.tsx",runner.react);
  const render=(items=options,disabled=false)=>runner.render(SearchableVehicleSelect,{value:"",options:items,placeholder:"Search make",label:"Make",disabled,onChange:value=>changes.push(value)});
  let tree=render();
  byRole(tree,"combobox")[0].props.onFocus(nativeEvent("focus"));
  tree=render();
  byRole(tree,"combobox")[0].props.onKeyDown(nativeEvent("keydown",{key:"ArrowDown"}));
  tree=render();
  assert.ok(byRole(tree,"combobox")[0].props["aria-activedescendant"]);
  render(interruption==="empty"?[]:options,interruption==="disabled");
  tree=render();
  const input=byRole(tree,"combobox")[0];
  assert.equal(input.props["aria-activedescendant"],undefined,interruption);
  input.props.onKeyDown(nativeEvent("keydown",{key:"Enter"}));
  assert.deepEqual(changes,[],interruption);
  input.props.onKeyDown(nativeEvent("keydown",{key:"ArrowDown"}));
  tree=render();
  byRole(tree,"combobox")[0].props.onKeyDown(nativeEvent("keydown",{key:"Enter"}));
  assert.deepEqual(changes,["bmw"]);
 }
});

test("click selects the option value and active scrolling occurs only outside the visible listbox",()=>{
 const changes=[];
 const elements=new Map();
 const runner=hookRunner();
 const {SearchableVehicleSelect}=moduleFrom("src/components/vehicle-selector.tsx",runner.react,{document:{getElementById:id=>elements.get(id)??null}});
 const render=()=>runner.render(SearchableVehicleSelect,{value:"",options,placeholder:"Search make",label:"Make",onChange:value=>changes.push(value)});
 let tree=render();
 byRole(tree,"combobox")[0].props.onFocus(nativeEvent("focus"));
 tree=render();
 byRole(tree,"combobox")[0].props.onKeyDown(nativeEvent("keydown",{key:"ArrowDown"}));
 tree=render();
 const listbox=byRole(tree,"listbox")[0];
 listbox.props.ref.current={getBoundingClientRect:()=>({top:10,bottom:100})};
 const activeId=byRole(tree,"combobox")[0].props["aria-activedescendant"];
 let scrollCalls=0;
 elements.set(activeId,{getBoundingClientRect:()=>({top:20,bottom:40}),scrollIntoView(){scrollCalls++;}});
 runner.flushEffects();
 assert.equal(scrollCalls,0);

 elements.set(activeId,{getBoundingClientRect:()=>({top:110,bottom:130}),scrollIntoView(options){scrollCalls++;assert.equal(options.block,"nearest");assert.equal(options.behavior,"auto");}});
 byRole(tree,"combobox")[0].props.onKeyDown(nativeEvent("keydown",{key:"ArrowDown"}));
 tree=render();
 const nextId=byRole(tree,"combobox")[0].props["aria-activedescendant"];
 elements.set(nextId,{getBoundingClientRect:()=>({top:110,bottom:130}),scrollIntoView(options){scrollCalls++;assert.equal(options.block,"nearest");assert.equal(options.behavior,"auto");}});
 runner.flushEffects();
 assert.equal(scrollCalls,1);

 byRole(tree,"option").find(option=>option.props.children==="Volkswagen").props.onClick(nativeEvent("click"));
 assert.deepEqual(changes,["volkswagen"]);
});
