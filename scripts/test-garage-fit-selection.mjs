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

function renderComponents(tree){
 if(Array.isArray(tree))return tree.map(renderComponents);
 if(!tree||typeof tree!=="object")return tree;
 if(typeof tree.type==="function")return renderComponents(tree.type(tree.props??{}));
 if(tree.props&&"children" in tree.props)return {...tree,props:{...tree.props,children:renderComponents(tree.props.children)}};
 return tree;
}

const vehicle={
 id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
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

test("web Garage resolves an explicit gv against the signed-in owner and sends it to the shared list",async()=>{
 const GarageVehicleList=function GarageVehicleList(){return null;};
 const {default:GaragePage}=moduleFrom("src/app/garage/page.tsx",{
  "next/link":"a",
  "@/components/header":{Header:()=>null},
  "@/components/garage-vehicle-list":{GarageVehicleList},
  "@/lib/auth":{requireUser:async()=>({id:"buyer-1"})},
  "@/lib/data/garage":{getGarageVehiclesPage:async()=>({items:[vehicle],hasMore:false,offset:0,limit:20}),getGarageVehicleById:async(owner,id)=>owner==="buyer-1"&&id===vehicle.id?vehicle:null},
  "@/lib/vehicle-context":moduleFrom("src/lib/vehicle-context.ts"),
  "@/lib/identifiers":{isUuid:value=>value===vehicle.id}
 });
 const tree=await GaragePage({searchParams:Promise.resolve({gv:vehicle.id,fit:"0"})});
 const list=nodes(tree).find(node=>node.type===GarageVehicleList);
 assert.ok(list,"Expected a shared Garage vehicle list to own selection state");
 assert.deepEqual(list.props.vehicles.map(item=>item.id),[vehicle.id]);
 assert.equal(list.props.viewerId,"buyer-1");
 assert.equal(JSON.stringify(list.props.initialSelection),JSON.stringify({kind:"garage",garageVehicleId:vehicle.id,fitOnly:false}));
});

test("web Garage compatibility control is a controlled current-vehicle filter",()=>{
 const relativePath="src/components/garage-vehicle-use-control.tsx";
 const {GarageVehicleUseControl}=moduleFrom(relativePath,{"next/link":"a"});
 let fitOnly=true;
 const render=()=>GarageVehicleUseControl({isCurrent:true,fitOnly,fitHref:"/?gv=current&fit=1#marketplace",onFitChange:value=>{fitOnly=value;},onUse(){}});
 let tree=render();
 const checkbox=()=>nodes(tree).find(node=>node.type==="input"&&node.props["aria-label"]==="Show only parts that fit this vehicle");
 assert.equal(checkbox()?.props.checked,true);
 checkbox().props.onChange({target:{checked:false}});
 tree=render();
 assert.equal(checkbox()?.props.checked,false);
 assert.equal(nodes(tree).some(node=>node.type==="a"&&node.props.children==="Use this vehicle"),false);
});

test("only the current saved Garage vehicle shows the compatibility checkbox",()=>{
 const state=[];
 let hookIndex=0;
 const react={useState(initial){const index=hookIndex++;if(!(index in state))state[index]=typeof initial==="function"?initial():initial;return [state[index],value=>{state[index]=typeof value==="function"?value(state[index]):value;}];}};
 const {GarageVehicleUseControl}=moduleFrom("src/components/garage-vehicle-use-control.tsx",{react,"next/link":"a"});
 const render=props=>{hookIndex=0;return GarageVehicleUseControl(props);};
 const current=nodes(render({isCurrent:true,fitOnly:true,fitHref:"/?gv=current&fit=1#marketplace",allHref:"/?gv=current&fit=0#marketplace",onFitChange(){},onUse(){}}));
 const saved=nodes(render({isCurrent:false,fitOnly:true,fitHref:"/?gv=saved&fit=1#marketplace",allHref:"/?gv=saved&fit=0#marketplace",onFitChange(){},onUse(){}}));
 const checkbox=tree=>tree.find(node=>node.type==="input"&&node.props["aria-label"]==="Show only parts that fit this vehicle");
 assert.equal(checkbox(current)?.props.checked,true);
 assert.equal(checkbox(saved),undefined,"a non-current saved vehicle must not look fit-filtered or selected");
 assert.ok(saved.some(node=>node.type==="a"&&node.props.children==="Use this vehicle"));
});

test("Garage compatibility state comes from the current vehicle context, including fit OFF",()=>{
 const {GarageVehicleUseControl}=moduleFrom("src/components/garage-vehicle-use-control.tsx",{"next/link":"a"});
 const tree=nodes(GarageVehicleUseControl({isCurrent:true,fitOnly:false,fitHref:"/?gv=current&fit=1#marketplace",onFitChange(){},onUse(){}}));
 const checkbox=tree.find(node=>node.type==="input"&&node.props["aria-label"]==="Show only parts that fit this vehicle");
 assert.equal(checkbox?.props.checked,false);
});

test("Garage renders one canonical current vehicle and switching preserves both saved records",()=>{
 const storage=new Map();
 const localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
 const context=moduleFrom("src/lib/vehicle-context.ts",{}, {window:{localStorage,addEventListener(){},removeEventListener(){}}});
 context.writeStoredVehicleContext("buyer-1",{kind:"garage",garageVehicleId:vehicle.id,fitOnly:true});
 const second={...vehicle,id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",registration:"CD34EFG",make:"Vauxhall",modelFamily:"Astra"};
 const savedVehicles=[vehicle,second];
 const makeList=()=>{
  const state=[];let hookIndex=0;const effects=[];const subscribers=[];
  const react={useEffect(effect){effects.push(effect);},useSyncExternalStore(subscribe,getSnapshot,getServerSnapshot){const index=hookIndex++;if(!(index in state)){state[index]=getServerSnapshot();subscribers[index]=subscribe(()=>{state[index]=getSnapshot();});}return state[index];}};
  const control=moduleFrom("src/components/garage-vehicle-use-control.tsx",{"next/link":"a"});
  const {GarageVehicleList}=moduleFrom("src/components/garage-vehicle-list.tsx",{
   react,"next/link":"a",
   "@/components/garage-vehicle-remove-form":{GarageVehicleRemoveForm:()=>null},
   "@/components/garage-vehicle-use-control":control,
   "@/components/vehicle-visual":{VehicleVisual:()=>null},
   "@/lib/vehicle-context":context
  },{window:{localStorage,addEventListener(){},removeEventListener(){}}});
  const render=()=>{hookIndex=0;return renderComponents(GarageVehicleList({vehicles:savedVehicles,viewerId:"buyer-1",initialSelection:undefined}));};
  const hydrate=()=>{for(let i=0;i<subscribers.length;i++)state[i]=context.getStoredVehicleContextSnapshot();};
  return {render,effects,hydrate};
 };
 const list=makeList();
 let tree=list.render();
 list.hydrate();
 tree=list.render();
 const currentBadges=()=>nodes(tree).filter(node=>node.type==="p"&&node.props.children==="Current vehicle");
 const checkboxes=()=>nodes(tree).filter(node=>node.type==="input"&&node.props["aria-label"]==="Show only parts that fit this vehicle");
 const links=label=>nodes(tree).filter(node=>node.type==="a"&&node.props.children===label);
 assert.equal(currentBadges().length,1);
 assert.equal(checkboxes().length,1);
 assert.equal(checkboxes()[0].props.checked,true);
 assert.equal(links("Use this vehicle").length,1);
 assert.equal(links("Use this vehicle")[0].props.href,"/?gv=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb&fit=1#marketplace");

 links("Use this vehicle")[0].props.onClick();
 tree=list.render();
 assert.equal(currentBadges().length,1);
 assert.equal(checkboxes().length,1);
 assert.equal(links("Use this vehicle").length,1);
 assert.equal(JSON.parse(localStorage.getItem(context.VEHICLE_CONTEXT_STORAGE_KEY)).selection.garageVehicleId,second.id);
 assert.deepEqual(nodes(tree).filter(node=>node.type==="h2").map(node=>node.props.children.flat(Infinity).join("")),["Audi A3","Vauxhall Astra"]);

 checkboxes()[0].props.onChange({target:{checked:false}});
 tree=list.render();
 assert.equal(checkboxes()[0].props.checked,false);
 assert.equal(JSON.parse(localStorage.getItem(context.VEHICLE_CONTEXT_STORAGE_KEY)).selection.fitOnly,false);
 const refreshed=makeList();
 let refreshedTree=refreshed.render();refreshed.hydrate();refreshedTree=refreshed.render();
 assert.equal(nodes(refreshedTree).filter(node=>node.type==="input"&&node.props["aria-label"]==="Show only parts that fit this vehicle")[0].props.checked,false);

 links("Use this vehicle")[0].props.onClick();tree=list.render();
 assert.equal(JSON.parse(localStorage.getItem(context.VEHICLE_CONTEXT_STORAGE_KEY)).selection.garageVehicleId,vehicle.id);
 assert.equal(checkboxes().length,1);
 assert.equal(checkboxes()[0].props.checked,true,"switching back activates one Garage vehicle and defaults fit back on");
 assert.equal(links("Use this vehicle").length,1);

 const clear=links("Browse without a vehicle")[0];
 clear.props.onClick();tree=list.render();
 assert.equal(localStorage.getItem(context.VEHICLE_CONTEXT_STORAGE_KEY),null);
 assert.equal(currentBadges().length,0);
 assert.equal(checkboxes().length,0);
 assert.equal(links("Use this vehicle").length,2);
 assert.equal(nodes(tree).filter(node=>node.type==="article").length,2,"clearing selection keeps both saved vehicles in Garage");
});

function mobileGarageHarness(){
 let useClick=null;
 let selected=null;
 const checkbox={checked:false};
 const article={querySelector:selector=>selector==="[data-garage-fit]"?checkbox:null};
 const useButton={
  dataset:{useGarage:vehicle.id},disabled:false,textContent:"",
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
