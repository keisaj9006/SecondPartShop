import assert from "node:assert/strict";
import {File} from "node:buffer";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const compiled=ts.transpileModule(fs.readFileSync("src/components/listing-form.tsx","utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
}).outputText;

const category={id:"category-1",name:"Headlights",parentId:null,isSelectable:true,isTransmissionRelated:false};
const fitment={variantId:"11111111-1111-4111-8111-111111111111",make:"Ford",modelFamily:"Focus",variant:"ST",year:2020,fuelType:"Petrol",engineSizeSimple:2000,notes:"catalogue evidence"};
const listing={
 id:"760fdafa-e589-449e-9296-397f76c74bd2",title:"[QA TEST] Photo integrity fixture",description:"A synthetic listing description long enough for validation.",
 categoryId:category.id,donorVehicleId:null,condition:"used",testingStatus:"not_specified",warrantyDays:0,pricePence:100,stock:1,
 conditionNotes:null,damageNotes:null,oemNumber:null,manufacturer:null,partNumber:null,dispatchDays:2,collectionAvailable:false,
 shippingPence:0,deliveryDaysMin:null,deliveryDaysMax:null,status:"draft",images:[{id:"existing-1"},{id:"existing-2"}]
};

function mount({pending=false}={}){
 const states=[];const refs=[];let stateIndex=0;let refIndex=0;
 const exports={};
 const jsx=(type,props)=>({type,props});
 vm.runInNewContext(compiled,{
  exports,
  require(name){
   if(name==="react/jsx-runtime")return {jsx,jsxs:jsx};
   if(name==="react")return {
    useActionState(handler,initial){return [initial,handler,pending];},
    useMemo(factory){return factory();},
    useRef(value){const index=refIndex++;return refs[index]??(refs[index]={current:value});},
    useState(value){const index=stateIndex++;if(!(index in states))states[index]=typeof value==="function"?value():value;return [states[index],next=>{states[index]=typeof next==="function"?next(states[index]):next;}];}
   };
   if(name==="@/app/dashboard/actions")return {createListing(){},updateListing(){}};
   if(name==="@/lib/category-tree")return {buildCategoryTree:()=>[{...category,children:[]}],getCategoryAncestors:()=>[category]};
   if(name==="@/components/seller-compatibility-editor")return {SellerCompatibilityEditor:function SellerCompatibilityEditor(){}};
   if(name==="@/components/optimized-image-input")return {OptimizedImageInput:function OptimizedImageInput(){}};
   if(name==="@/components/listing-ai-assistant")return {ListingAiAssistant:function ListingAiAssistant(){}};
   throw new Error(name);
  }
 });
 const render=()=>{stateIndex=0;refIndex=0;return exports.ListingForm({categories:[category],donors:[],listing,initialCatalogueFitments:[fitment]});};
 return {render};
}

function descendants(node,result=[]){
 if(!node||typeof node!=="object")return result;
 result.push(node);
 const children=node.props?.children;
 for(const child of Array.isArray(children)?children:[children])descendants(child,result);
 return result;
}

test("an action-triggered cancelable reset retains edited uncontrolled, controlled, and hidden listing values",()=>{
 const view=mount();
 let form=view.render();
 const nodes=descendants(form);
 const byName=name=>nodes.find(node=>node.props?.name===name);

 byName("title").props.onChange({target:{value:"Edited controlled title"}});
 form=view.render();
 const rerendered=descendants(form);
 const rerenderedByName=name=>rerendered.find(node=>node.props?.name===name);
 const fields=new Map([
  ["price",{value:"3.25",defaultValue:"1"}],
  ["warrantyDays",{value:"90",defaultValue:"0"}],
  ["conditionNotes",{value:"Synthetic QA condition note retained on validation retry.",defaultValue:""}],
  ["status",{value:"active",defaultValue:"draft"}]
 ]);

 assert.equal(typeof form.props.onSubmitCapture,"function","the real form must identify resets requested by its action submission");
 assert.equal(typeof form.props.onReset,"function","the real form must be able to cancel React's action reset");
 form.props.onSubmitCapture();
 const nativeEvent=new Event("reset",{cancelable:true});
 form.props.onReset({nativeEvent,preventDefault:()=>nativeEvent.preventDefault()});
 if(!nativeEvent.defaultPrevented)for(const field of fields.values())field.value=field.defaultValue;

 assert.equal(nativeEvent.defaultPrevented,true);
 assert.deepEqual([...fields.values()].map(field=>field.value),["3.25","90","Synthetic QA condition note retained on validation retry.","active"]);
 assert.equal(rerenderedByName("title").props.value,"Edited controlled title");
 assert.equal(rerenderedByName("categoryId").props.value,category.id);
 const compatibility=rerendered.find(node=>node.type?.name==="SellerCompatibilityEditor");
 assert.deepEqual(compatibility.props.initialFitments,[fitment]);
});

test("a genuine reset with no action submission remains unprevented",()=>{
 const form=mount().render();
 assert.equal(typeof form.props.onReset,"function");
 const nativeEvent=new Event("reset",{cancelable:true});
 form.props.onReset({nativeEvent,preventDefault:()=>nativeEvent.preventDefault()});
 assert.equal(nativeEvent.defaultPrevented,false);
});

test("the real submit button preserves the pending duplicate-submission guard",()=>{
 const form=mount({pending:true}).render();
 const button=descendants(form).find(node=>node.type==="button"&&node.props?.children==="Saving…");
 assert.equal(button.props.disabled,true);
});

const actionsCompiled=ts.transpileModule(fs.readFileSync("src/app/dashboard/actions.ts","utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;

function loadActions(){
 const mutations=[];const uploads=[];const redirects=[];
 const redirectError=new Error("NEXT_REDIRECT");
 const query=table=>{
  const chain={
   operation:"select",
   select(_columns,options){chain.operation="select";chain.count=options?.count;return chain;},
   insert(value){chain.operation="insert";mutations.push({table,operation:"insert",value});return chain;},
   update(value){chain.operation="update";mutations.push({table,operation:"update",value});return chain;},
   eq(){return chain;},neq(){return chain;},order(){return chain;},limit(){return chain;},
   async maybeSingle(){
    if(table==="categories")return {data:{is_transmission_related:false,is_selectable:true},error:null};
    if(table==="parts"&&chain.operation==="select")return {data:{id:listing.id,status:"draft"},error:null};
    return {data:null,error:null};
   },
   async single(){return {data:{id:listing.id,slug:"qa-test-photo-integrity-fixture"},error:null};},
   then(resolve,reject){
    const result=table==="part_images"?{count:2,error:null,data:null}:{data:[],error:null};
    return Promise.resolve(result).then(resolve,reject);
   }
  };
  return chain;
 };
 const supabase={
  from:query,
  rpc(name,args){mutations.push({operation:"rpc",name,args});return Promise.resolve({data:null,error:null});},
  storage:{from:()=>({upload:async(path)=>{uploads.push(path);return {error:null};}})}
 };
 const exports={};
 vm.runInNewContext(actionsCompiled,{
  exports,FormData,File,Error,Set,Number,String,Boolean,Array,Object,JSON,Math,crypto,
  require(name){
   const modules={
    "@/lib/part-image-cleanup":{attemptPartImageCleanup:async()=>{},cleanupFailedPartImageUpload:async()=>{},requirePartImageCleanupReady:async()=>{}},
    "next/cache":{revalidatePath(){}},
    "next/navigation":{redirect(url){redirects.push(url);throw redirectError;}},
    "@/lib/auth":{requireSeller:async()=>({user:{id:"seller-user"}})},
    "@/lib/supabase/server":{createSupabaseServerClient:async()=>supabase},
    "@/lib/data/marketplace":{getSellerForOwner:async()=>({id:"seller-1"})},
    "@/lib/image-upload":{validateImageUpload:async()=>({extension:"png",mimeType:"image/png"})},
    "@/lib/seller-business":{isSellerBusinessKind:()=>true},
    "@/lib/identifiers":{isUuid:()=>false},
    "@/lib/data/checkout":{isSellerCheckoutReady:async()=>true},
    "@/lib/seller-geo":{persistSellerGeo:async()=>{},sellerGeoFromPostcode:async()=>({})},
    "@/lib/push/schedule":{schedulePushDispatch(){}},
    "@/lib/marketplace-policy":{hasCurrentMarketplaceTerms:async()=>true}
   };
   if(name in modules)return modules[name];
   throw new Error(name);
  }
 });
 return {actions:exports,mutations,uploads,redirects,redirectError};
}

function listingFormData({status="active",withFile=true}={}){
 const data=new FormData();
 const values={
  partId:listing.id,title:"[QA TEST] Photo integrity fixture",description:"A synthetic listing description long enough for validation.",categoryId:category.id,
  donorVehicleId:"",condition:"used",testingStatus:"not_specified",warrantyDays:"90",price:"3.25",stock:"1",
  conditionNotes:"Synthetic QA condition note retained on validation retry.",damageNotes:"",oemNumber:"",manufacturer:"",partNumber:"",
  dispatchDays:"2",shippingPrice:"0",deliveryDaysMin:"",deliveryDaysMax:"",status,catalogueFitments:"[]"
 };
 for(const [name,value] of Object.entries(values))data.set(name,value);
 if(withFile)data.set("images",new File(["synthetic-image"],"qa-test-part.png",{type:"image/png"}));
 return data;
}

for(const actionName of ["createListing","updateListing"]){
 test(`${actionName} rejects unsupported active publication before uploads or database mutation`,async()=>{
  const harness=loadActions();
  const result=await harness.actions[actionName]({status:"idle"},listingFormData());
  assert.equal(result.status,"error");
  assert.match(result.message,/Before publishing, add a donor vehicle/);
  assert.deepEqual(harness.uploads,[]);
  assert.deepEqual(harness.mutations,[]);
  assert.deepEqual(harness.redirects,[]);
 });

 test(`${actionName} keeps the existing successful draft redirect`,async()=>{
  const harness=loadActions();
  await assert.rejects(
   harness.actions[actionName]({status:"idle"},listingFormData({status:"draft",withFile:false})),
   error=>error===harness.redirectError
  );
  assert.deepEqual(harness.redirects,[actionName==="createListing"?"/dashboard?created=1":"/dashboard?updated=1"]);
 });
}
