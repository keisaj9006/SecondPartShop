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
const icons=new Proxy({},{get:()=>()=>null});

function moduleFrom(relativePath,dependencies={},globals={}){
 const source=fs.readFileSync(path.join(root,relativePath),"utf8");
 const compiled=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}
 }).outputText;
 const exports={};
 vm.runInNewContext(compiled,{
  exports,
  require(name){
   if(name==="react/jsx-runtime")return jsxRuntime;
   if(name==="lucide-react")return icons;
   if(name in dependencies)return dependencies[name];
   throw new Error(`Unexpected dependency ${name} in ${relativePath}`);
  },
  URLSearchParams,console,...globals
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

const vehicle={
 id:"garage-1",
 catalogueVariantId:"11111111-1111-4111-8111-111111111111",
 year:2020,
 fuelType:"petrol",
 engineSizeSimple:1984,
 registration:"AB12CDE",
 colour:"blue",
 make:"Audi",
 modelFamily:"A3",
 variant:"Sport",
 nickname:null
};

test("web Garage gives each saved vehicle both fit-only and browse-all destinations",async()=>{
 const GarageVehicleUseControl=function GarageVehicleUseControl(){return null;};
 const {default:GaragePage}=moduleFrom("src/app/garage/page.tsx",{
  "next/link":"a",
  "@/components/header":{Header:()=>null},
  "@/components/vehicle-visual":{VehicleVisual:()=>null},
  "@/components/garage-vehicle-use-control":{GarageVehicleUseControl},
  "@/lib/auth":{requireUser:async()=>({id:"buyer-1"})},
  "@/lib/data/garage":{getGarageVehiclesPage:async()=>({items:[vehicle],hasMore:false,offset:0,limit:20})},
  "./actions":{removeGarageVehicle(){} }
 });
 const tree=await GaragePage({searchParams:Promise.resolve({})});
 const control=nodes(tree).find(node=>node.type===GarageVehicleUseControl);
 assert.ok(control,"Expected Garage vehicle compatibility control");
 assert.match(control.props.fitHref,/(?:\?|&)fit=1(?:&|#)/);
 assert.match(control.props.allHref,/(?:\?|&)fit=0(?:&|#)/);
 assert.match(control.props.fitHref,/(?:\?|&)vr=AB12CDE(?:&|#)/);
 assert.match(control.props.fitHref,/(?:\?|&)vc=blue(?:&|#)/);
});

test("web Garage compatibility checkbox switches the Use vehicle destination",()=>{
 const relativePath="src/components/garage-vehicle-use-control.tsx";
 assert.ok(fs.existsSync(path.join(root,relativePath)),"Expected Garage vehicle compatibility control component");
 const state=[];
 let hookIndex=0;
 const react={
  useState(initial){
   const index=hookIndex++;
   if(!(index in state))state[index]=typeof initial==="function"?initial():initial;
   return [state[index],value=>{state[index]=typeof value==="function"?value(state[index]):value;}];
  }
 };
 const {GarageVehicleUseControl}=moduleFrom(relativePath,{react,"next/link":"a"});
 const render=()=>{hookIndex=0;return GarageVehicleUseControl({fitHref:"/?cv=one&fit=1#marketplace",allHref:"/?cv=one&fit=0#marketplace"});};
 let tree=render();
 const checkbox=()=>nodes(tree).find(node=>node.type==="input"&&node.props["aria-label"]==="Show only parts that fit this vehicle");
 const link=()=>nodes(tree).find(node=>node.type==="a"&&typeof node.props.href==="string");
 assert.equal(checkbox()?.props.checked,true);
 assert.equal(link()?.props.href,"/?cv=one&fit=1#marketplace");
 checkbox().props.onChange({target:{checked:false}});
 tree=render();
 assert.equal(checkbox()?.props.checked,false);
 assert.equal(link()?.props.href,"/?cv=one&fit=0#marketplace");
});

function mobileGarageHarness(){
 let useClick=null;
 let selected=null;
 const checkbox={checked:false};
 const article={querySelector:selector=>selector==="[data-garage-fit]"?checkbox:null};
 const useButton={
  dataset:{useGarage:"garage-1"},disabled:false,textContent:"",
  closest:()=>article,
  addEventListener(type,callback){if(type==="click")useClick=callback;}
 };
 const app={
  innerHTML:"",
  querySelectorAll(selector){
   if(selector==="[data-use-garage]")return [useButton];
   if(selector==="[data-remove-garage]")return [];
   if(selector==="[data-garage-fit]")return [];
   return [];
  }
 };
 const routes={};
 const C={
  state:{activeVehicle:null,vehicleCompatibleOnly:true},
  apiCached:async()=>({items:[vehicle]}),
  api:async()=>({}),
  invalidateCache(){},
  prefetch(){},
  escapeHtml:value=>String(value??""),
  setActiveVehicle(next,options){selected={next,options};}
 };
 const UI={
  C,app,
  register(name,handler){routes[name]=handler;},
  requireAuth:async()=>true,
  loading(){},isCurrent:()=>true,isSilentRefresh:()=>false,
  empty(){},toast(){},route(){},vehicleVisual:()=>"<div>vehicle</div>"
 };
 const document={getElementById:()=>({addEventListener(){}})};
 const context={window:{SecondPartUI:UI},document,URLSearchParams,encodeURIComponent,console};
 for(const relativePath of ["mobile-shell/views-marketplace.js","mobile-shell/views-garage.js"]){
  const source=fs.readFileSync(path.join(root,relativePath),"utf8");
  vm.runInNewContext(source,context);
 }
 return {routes,app,checkbox,getUseClick:()=>useClick,getSelected:()=>selected};
}

test("mobile shell loads the Garage override after the marketplace routes",()=>{
 const source=fs.readFileSync(path.join(root,"mobile-shell/index.html"),"utf8");
 const marketplaceIndex=source.indexOf("./views-marketplace.js");
 const garageIndex=source.indexOf("./views-garage.js");
 assert.ok(marketplaceIndex>=0&&garageIndex>marketplaceIndex);
});

test("mobile Garage renders the same compatibility choice beside saved vehicles",async()=>{
 const harness=mobileGarageHarness();
 await harness.routes.garage();
 assert.match(harness.app.innerHTML,/Show only parts that fit this vehicle/);
 assert.match(harness.app.innerHTML,/data-garage-fit/);
});

test("mobile Garage uses the checkbox value instead of forcing fit-only mode",async()=>{
 const harness=mobileGarageHarness();
 await harness.routes.garage();
 assert.equal(typeof harness.getUseClick(),"function");
 harness.checkbox.checked=false;
 harness.getUseClick()();
 assert.equal(harness.getSelected()?.options?.compatibleOnly,false);
});
