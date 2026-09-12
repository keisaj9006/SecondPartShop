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

function moduleFrom(react,{fetchImpl,router={push(){}}}={}){
 const source=fs.readFileSync(path.join(root,"src/components/vehicle-selector.tsx"),"utf8");
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};
 vm.runInNewContext(compiled,{
  exports,
  require(name){
   if(name==="react/jsx-runtime")return jsxRuntime;
   if(name==="react")return react;
   if(name==="next/navigation")return {useRouter:()=>router};
   if(name==="lucide-react")return new Proxy({},{get:()=>()=>null});
   if(name==="@/components/vehicle-visual")return {VehicleVisual:()=>null};
   if(name==="@/lib/vehicle-context")return {clearStoredVehicleContext(){}};
   throw new Error(`Unexpected dependency ${name}`);
  },
  URL,URLSearchParams,AbortController,console,
  window:{setTimeout,clearTimeout},document:{},
  fetch:fetchImpl??(async()=>response({items:[]}))
 });
 return exports;
}

function hookRunner(){
 const state=[];
 const refs=[];
 const effectDeps=[];
 const effectCleanups=[];
 let hookIndex=0;
 let pendingEffects=[];
 const react={
  useId(){return `test-${hookIndex++}`;},
  useState(initial){const index=hookIndex++;if(!(index in state))state[index]=typeof initial==="function"?initial():initial;return [state[index],value=>{state[index]=typeof value==="function"?value(state[index]):value;}];},
  useRef(initial){const index=hookIndex++;if(!(index in refs))refs[index]={current:initial};return refs[index];},
  useEffect(effect,deps){
   const index=hookIndex++;
   const previous=effectDeps[index];
   const changed=!previous||!deps||deps.length!==previous.length||deps.some((value,position)=>!Object.is(value,previous[position]));
   effectDeps[index]=deps;
   if(changed)pendingEffects.push({index,effect});
  },
  useTransition(){hookIndex++;return [false,callback=>callback()];}
 };
 return {
  react,
  render(component,props){hookIndex=0;pendingEffects=[];return component(props);},
  flushEffects(){
   const effects=pendingEffects;pendingEffects=[];
   for(const {index,effect} of effects){
    effectCleanups[index]?.();
    const cleanup=effect();
    effectCleanups[index]=typeof cleanup==="function"?cleanup:undefined;
   }
  }
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

function textContent(value){
 if(value===null||value===undefined||typeof value==="boolean")return "";
 if(Array.isArray(value))return value.map(textContent).join("");
 if(typeof value==="object")return textContent(value.props?.children);
 return String(value);
}

const response=(payload,{ok=true,status=200}={})=>({ok,status,json:async()=>payload});
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const baseProps={vehicles:[],selectedCatalogue:null,baseParams:{},compatibleOnly:true};

function control(tree,{type,label,text}){
 const matches=nodes(tree).filter(node=>(type===undefined||node.type===type)&&(label===undefined||node.props?.["aria-label"]===label)&&(text===undefined||textContent(node)===text));
 assert.ok(matches.length,`Expected ${type??"node"}${label?` labelled ${label}`:""}${text?` with text ${text}`:""}`);
 return matches[0];
}

async function renderResolvedLookup({registration,vehicle,catalogue,engines,baseParams={}}){
 const pushes=[];
 const fetchImpl=async(url,options={})=>{
  if(url==="/api/vehicle-lookup"&&options.method==="POST")return response({registration,vehicle,catalogue});
  if(url===`/api/vehicle-catalogue?level=engines&variantId=${catalogue.variants[0].id}`)return response({items:engines});
  if(url.includes("level=years-model"))return response({items:[vehicle.year]});
  if(url.includes("level=variants-year"))return response({items:catalogue.variants});
  assert.fail(`Unexpected fetch ${url}`);
 };
 const runner=hookRunner();
 const {VehicleSelector}=moduleFrom(runner.react,{fetchImpl,router:{push:value=>pushes.push(value)}});
 const props={...baseProps,baseParams};
 const render=()=>runner.render(VehicleSelector,props);
 let tree=render();
 runner.flushEffects();
 control(tree,{type:"input"}).props.onChange({target:{value:registration}});
 tree=render();
 control(tree,{type:"button",text:"Find my vehicle"}).props.onClick();
 await settle();
 tree=render();
 runner.flushEffects();
 await settle();
 tree=render();
 return {tree,pushes};
}

test("a resolved variant with several unmatched engines reveals a required chooser without losing lookup context",async()=>{
 const requests=new Map([
  ["/api/vehicle-catalogue?level=years-model&make=FORD&model=FOCUS",deferred()],
  ["/api/vehicle-catalogue?level=variants-year&make=FORD&model=FOCUS&year=2020",deferred()],
  ["/api/vehicle-catalogue?level=engines&variantId=variant-focus",deferred()],
  ["/api/vehicle-catalogue?level=makes",deferred()],
  ["/api/vehicle-catalogue?level=models&make=FORD",deferred()]
 ]);
 const lookupPayload={
  registration:"AB12CDE",
  vehicle:{make:"FORD",model:"FOCUS",year:2020,engineSizeSimple:1998,fuelType:"PETROL",colour:"BLUE"},
  catalogue:{make:"FORD",modelFamily:"FOCUS",variants:[{id:"variant-focus",variant:"Titanium"}],engineMatched:false}
 };
 const fetchImpl=async(url,options={})=>{
  if(url==="/api/vehicle-lookup"&&options.method==="POST")return response(lookupPayload);
  const request=requests.get(url);
  assert.ok(request,`Unexpected fetch ${url}`);
  return request.promise;
 };
 const runner=hookRunner();
 const {VehicleSelector}=moduleFrom(runner.react,{fetchImpl});
 const render=()=>runner.render(VehicleSelector,baseProps);

 let tree=render();
 runner.flushEffects();
 control(tree,{type:"input"}).props.onChange({target:{value:"ab12 cde"}});
 tree=render();
 control(tree,{type:"button",text:"Find my vehicle"}).props.onClick();
 await settle();

 tree=render();
 runner.flushEffects();
 requests.get("/api/vehicle-catalogue?level=engines&variantId=variant-focus").resolve(response({items:[
  {fuelType:"DIESEL",engineSizeSimple:1499,engineSizeDesc:"1.5"},
  {fuelType:"PETROL",engineSizeSimple:999,engineSizeDesc:"1.0"}
 ]}));
 await settle();

 tree=render();
 assert.equal(control(tree,{type:"select",label:"Engine and fuel"}).props.value,"");
 assert.equal(control(tree,{type:"select",label:"Year"}).props.value,"2020");
 assert.equal(control(tree,{type:"select",label:"Version"}).props.value,"variant-focus");
 assert.match(textContent(tree),/choose the engine and fuel/i);
 assert.ok(nodes(tree).filter(node=>node.type==="button"&&textContent(node)==="Use this vehicle").every(button=>button.props.disabled));

 runner.flushEffects();
 requests.get("/api/vehicle-catalogue?level=variants-year&make=FORD&model=FOCUS&year=2020").resolve(response({items:[{id:"variant-focus",variant:"Titanium"}]}));
 requests.get("/api/vehicle-catalogue?level=years-model&make=FORD&model=FOCUS").resolve(response({items:[2019,2020,2021]}));
 requests.get("/api/vehicle-catalogue?level=models&make=FORD").resolve(response({items:["FOCUS"]}));
 requests.get("/api/vehicle-catalogue?level=makes").resolve(response({items:["FORD"]}));
 await settle();

 tree=render();
 assert.equal(control(tree,{type:"select",label:"Year"}).props.value,"2020");
 assert.equal(control(tree,{type:"select",label:"Version"}).props.value,"variant-focus");
 assert.equal(control(tree,{type:"select",label:"Engine and fuel"}).props.value,"");
});

test("multiple same-fuel engines do not infer capacity when registration capacity is missing",async()=>{
 const {tree}=await renderResolvedLookup({
  registration:"NO12CAP",
  vehicle:{make:"FORD",model:"FIESTA",year:2019,engineSizeSimple:null,fuelType:"PETROL",colour:"RED"},
  catalogue:{make:"FORD",modelFamily:"FIESTA",variants:[{id:"variant-fiesta",variant:"Zetec"}],engineMatched:true},
  engines:[
   {fuelType:"PETROL",engineSizeSimple:999,engineSizeDesc:"1.0"},
   {fuelType:"PETROL",engineSizeSimple:1199,engineSizeDesc:"1.2"}
  ]
 });

 assert.equal(control(tree,{type:"select",label:"Engine and fuel"}).props.value,"");
 assert.equal(control(tree,{type:"select",label:"Year"}).props.value,"2019");
 assert.equal(control(tree,{type:"select",label:"Version"}).props.value,"variant-fiesta");
 assert.ok(nodes(tree).filter(node=>node.type==="button"&&textContent(node)==="Use this vehicle").every(button=>button.props.disabled));
});

test("multiple engines select automatically only with exact fuel and capacity evidence",async()=>{
 const {tree,pushes}=await renderResolvedLookup({
  registration:"YES12CAP",
  vehicle:{make:"FORD",model:"FIESTA",year:2019,engineSizeSimple:1199,fuelType:"PETROL",colour:"RED"},
  catalogue:{make:"FORD",modelFamily:"FIESTA",variants:[{id:"variant-fiesta-exact",variant:"Titanium"}],engineMatched:true},
  engines:[
   {fuelType:"PETROL",engineSizeSimple:999,engineSizeDesc:"1.0"},
   {fuelType:"PETROL",engineSizeSimple:1199,engineSizeDesc:"1.2"}
  ],
  baseParams:{fit:"1"}
 });

 assert.doesNotMatch(textContent(tree),/hide manual selection/i);
 const apply=control(tree,{type:"button",text:"Use this vehicle"});
 assert.equal(apply.props.disabled,false);
 apply.props.onClick();
 const applied=new URL(pushes[0],"https://secondpart.test");
 assert.equal(applied.searchParams.get("cf"),"PETROL");
 assert.equal(applied.searchParams.get("ce"),"1199");
});

test("a single engine remains automatic and applies the exact fuel and engine context",async()=>{
 const pushes=[];
 const fetchImpl=async(url,options={})=>{
  if(url==="/api/vehicle-lookup"&&options.method==="POST")return response({
   registration:"XY34ZED",
   vehicle:{make:"VAUXHALL",model:"ASTRA",year:2018,engineSizeSimple:1598,fuelType:"DIESEL",colour:"SILVER"},
   catalogue:{make:"VAUXHALL",modelFamily:"ASTRA",variants:[{id:"variant-astra",variant:"SRi"}],engineMatched:false}
  });
  if(url==="/api/vehicle-catalogue?level=engines&variantId=variant-astra")return response({items:[{fuelType:"DIESEL",engineSizeSimple:1598,engineSizeDesc:"1.6"}]});
  if(url.includes("level=years-model"))return response({items:[2018]});
  if(url.includes("level=variants-year"))return response({items:[{id:"variant-astra",variant:"SRi"}]});
  assert.fail(`Unexpected fetch ${url}`);
 };
 const runner=hookRunner();
 const {VehicleSelector}=moduleFrom(runner.react,{fetchImpl,router:{push:value=>pushes.push(value)}});
 const props={...baseProps,baseParams:{q:"mirror",vehicle:"legacy",cf:"old"}};
 const render=()=>runner.render(VehicleSelector,props);

 let tree=render();
 runner.flushEffects();
 control(tree,{type:"input"}).props.onChange({target:{value:"xy34 zed"}});
 tree=render();
 control(tree,{type:"button",text:"Find my vehicle"}).props.onClick();
 await settle();
 tree=render();
 runner.flushEffects();
 await settle();
 tree=render();

 assert.doesNotMatch(textContent(tree),/hide manual selection/i);
 const apply=control(tree,{type:"button",text:"Use this vehicle"});
 assert.equal(apply.props.disabled,false);
 apply.props.onClick();
 assert.equal(pushes.length,1);
 const applied=new URL(pushes[0],"https://secondpart.test");
 assert.equal(applied.searchParams.get("q"),"mirror");
 assert.equal(applied.searchParams.get("vehicle"),null);
 assert.equal(applied.searchParams.get("cv"),"variant-astra");
 assert.equal(applied.searchParams.get("cy"),"2018");
 assert.equal(applied.searchParams.get("cf"),"DIESEL");
 assert.equal(applied.searchParams.get("ce"),"1598");
 assert.equal(applied.searchParams.get("vr"),"XY34ZED");
 assert.equal(applied.searchParams.get("vc"),"SILVER");
 assert.equal(applied.searchParams.get("fit"),"1");
 assert.equal(applied.hash,"#marketplace");
});

test("an unresolved engine choice entered manually gets guidance that does not assume registration lookup",async()=>{
 const fetchImpl=async url=>{
  if(url==="/api/vehicle-catalogue?level=engines&variantId=variant-manual")return response({items:[
   {fuelType:"PETROL",engineSizeSimple:1199,engineSizeDesc:"1.2"},
   {fuelType:"DIESEL",engineSizeSimple:1499,engineSizeDesc:"1.5"}
  ]});
  if(url.includes("level=years-model"))return response({items:[2017]});
  if(url.includes("level=variants-year"))return response({items:[{id:"variant-manual",variant:"SE"}]});
  if(url.includes("level=models"))return response({items:["CORSA"]});
  if(url.includes("level=makes"))return response({items:["VAUXHALL"]});
  assert.fail(`Unexpected fetch ${url}`);
 };
 const runner=hookRunner();
 const {VehicleSelector}=moduleFrom(runner.react,{fetchImpl});
 const props={...baseProps,selectedCatalogue:{
  variantId:"variant-manual",variant:"SE",make:"VAUXHALL",modelFamily:"CORSA",year:2017,fuelType:null,engineSizeSimple:null
 }};
 const render=()=>runner.render(VehicleSelector,props);

 let tree=render();
 runner.flushEffects();
 await settle();
 tree=render();

 assert.equal(control(tree,{type:"select",label:"Engine and fuel"}).props.value,"");
 assert.match(textContent(tree),/choose the engine and fuel/i);
 assert.doesNotMatch(textContent(tree),/because the registration lookup/i);
});

test("registration and legacy selections render actionable guidance without setup or QA terminology",async()=>{
 const runner=hookRunner();
 const {VehicleSelector}=moduleFrom(runner.react,{fetchImpl:async(url)=>{
  if(url==="/api/vehicle-lookup")return response({}, {ok:false,status:503});
  return response({items:[]});
 }});
 const render=props=>runner.render(VehicleSelector,props);

 let tree=render({...baseProps,vehicles:[{id:"legacy",make:"Ford",model:"Focus",year:2014}],selectedId:"legacy"});
 assert.match(textContent(tree),/select your vehicle manually/i);
 assert.match(textContent(tree),/selected vehicle: Ford Focus 2014/i);
 assert.doesNotMatch(textContent(tree),/credentials|legacy QA|test vehicle/i);

 const freshRunner=hookRunner();
 const {VehicleSelector:FreshSelector}=moduleFrom(freshRunner.react,{fetchImpl:async(url)=>{
  if(url==="/api/vehicle-lookup")return response({}, {ok:false,status:503});
  return response({items:[]});
 }});
 const renderFresh=()=>freshRunner.render(FreshSelector,baseProps);
 tree=renderFresh();
 freshRunner.flushEffects();
 control(tree,{type:"input"}).props.onChange({target:{value:"ab12 cde"}});
 tree=renderFresh();
 control(tree,{type:"button",text:"Find my vehicle"}).props.onClick();
 await settle();
 tree=renderFresh();
 assert.match(textContent(tree),/registration lookup is unavailable right now\. select your vehicle manually below\./i);
 assert.match(textContent(tree),/hide manual selection/i);
});
