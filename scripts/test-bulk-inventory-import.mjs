import assert from "node:assert/strict";
import {File} from "node:buffer";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

function compile(relativePath,{jsx=false}={}){
 return ts.transpileModule(fs.readFileSync(relativePath,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:jsx?ts.JsxEmit.ReactJSX:undefined}
 }).outputText;
}

const csvExports={};
vm.runInNewContext(compile("src/lib/csv.ts"),{exports:csvExports,require(name){throw new Error(name);}});

const importerExports={};
vm.runInNewContext(compile("src/lib/inventory-csv-import.ts"),{
 exports:importerExports,File,crypto,
 require(name){
  if(name==="server-only")return {};
  if(name==="@/lib/csv")return csvExports;
  if(name==="@/lib/vehicle-registration")return {normalizeRegistration:value=>value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8)};
  if(name==="@/lib/inventory-import-constants")return {BULK_IMPORT_MAX_ROWS:5000,BULK_IMPORT_MAX_FILE_BYTES:20*1024*1024};
  throw new Error(name);
 }
});

const {processSellerInventoryCsv}=importerExports;
const sellerId="seller-1";
const category={id:"category-1",name:"Headlights",slug:"headlights",is_selectable:true,is_transmission_related:false};

function row(reference,{title="Ford Focus headlight"}={}){
 return [title,"A tested used headlight with mounting points intact.","headlights","49.95",reference].join(",");
}

function csvFile(rows,name="inventory.csv"){
 return new File([["title,description,category,price_gbp,seller_reference",...rows].join("\n")],name,{type:"text/csv"});
}

function fakeSupabase({parts=[],batches=[],failReferences=new Set(),finalizationError=false,zeroFinalization=false}={}){
 const state={parts,batches};
 const from=table=>{
  const query={table,operation:"select",value:null,filters:[],returning:false,
   select(){query.returning=true;return query;},
   insert(value){query.operation="insert";query.value=value;return query;},
   update(value){query.operation="update";query.value=value;return query;},
   eq(column,value){query.filters.push([column,value]);return query;},
   in(){return query;},
   async single(){
    if(table==="seller_inventory_imports"&&query.operation==="insert"){
     const batch={id:`batch-${state.batches.length+1}`,...query.value};
     state.batches.push(batch);
     return {data:{id:batch.id},error:null};
    }
    return {data:null,error:{message:"Unexpected single query"}};
   },
   async maybeSingle(){
    if(table==="seller_inventory_imports"&&query.operation==="update"){
     if(finalizationError)return {data:null,error:{message:"synthetic finalization failure"}};
     const id=query.filters.find(([column])=>column==="id")?.[1];
     const owner=query.filters.find(([column])=>column==="seller_id")?.[1];
     const batch=zeroFinalization?null:state.batches.find(item=>item.id===id&&item.seller_id===owner);
     if(!batch)return {data:null,error:null};
     Object.assign(batch,query.value);
     return {data:{id:batch.id},error:null};
    }
    return {data:null,error:{message:"Unexpected maybeSingle query"}};
   },
   then(resolve,reject){
    let result;
    if(table==="categories")result={data:[category],error:null};
    else if(table==="donor_vehicles")result={data:[],error:null};
    else if(table==="parts"&&query.operation==="insert"){
     const values=Array.isArray(query.value)?query.value:[query.value];
     const blocked=values.some(item=>failReferences.has(String(item.source_external_id??"").toLowerCase()));
     if(blocked)result={data:null,error:{code:"SYNTHETIC",message:"synthetic row failure"}};
     else {state.parts.push(...values);result={data:null,error:null};}
    }else result={data:[],error:null};
    return Promise.resolve(result).then(resolve,reject);
   }
  };
  return query;
 };
 return {
  state,
  client:{
   from,
   rpc(name,args){
    assert.equal(name,"get_existing_csv_inventory_references");
    const requested=new Set(args.p_references.map(value=>value.toLowerCase()));
    const data=state.parts
     .filter(item=>item.seller_id===sellerId&&item.source_channel==="csv"&&requested.has(item.source_external_id.toLowerCase()))
     .map(item=>({source_external_id:item.source_external_id}));
    return Promise.resolve({data,error:null});
   }
  }
 };
}

test("repeating an import whose rows lack seller references performs zero writes",async()=>{
 const harness=fakeSupabase();
 const file=csvFile([row("")]);
 for(let attempt=0;attempt<2;attempt+=1){
  const result=await processSellerInventoryCsv({file,sellerId,supabase:harness.client,mode:"import"});
  assert.equal(result.status,"error");
  assert.equal(result.validRows,0);
  assert.equal(result.fileReset,"retain");
  assert.match(result.issues[0].message,/seller_reference.*required/i);
 }
 assert.deepEqual(harness.state.parts,[]);
 assert.deepEqual(harness.state.batches,[]);
});

test("a referenced partial retry creates only the rows that were not previously created",async()=>{
 const shared={parts:[],batches:[]};
 const first=fakeSupabase({...shared,failReferences:new Set(["stock-b","stock-c"])});
 const file=csvFile([row("Stock-A"),row("Stock-B"),row("Stock-C")]);
 const partial=await processSellerInventoryCsv({file,sellerId,supabase:first.client,mode:"import"});
 assert.equal(partial.status,"success");
 assert.equal(partial.createdRows,1);
 assert.equal(partial.rejectedRows,2);
 assert.equal(partial.fileReset,"clear");
 assert.deepEqual(first.state.parts.map(item=>item.source_external_id),["Stock-A"]);

 const retry=fakeSupabase({parts:first.state.parts,batches:first.state.batches});
 const retryFile=csvFile([row("sToCk-A"),row("Stock-B"),row("Stock-C")]);
 const completed=await processSellerInventoryCsv({file:retryFile,sellerId,supabase:retry.client,mode:"import"});
 assert.equal(completed.status,"success");
 assert.equal(completed.createdRows,2);
 assert.equal(completed.rejectedRows,1);
 assert.deepEqual(retry.state.parts.map(item=>item.source_external_id),["Stock-A","Stock-B","Stock-C"]);
 assert.equal(retry.state.parts.filter(item=>item.source_external_id.toLowerCase()==="stock-a").length,1);
});

for(const failure of ["error","zero rows"]){
 test(`failed finalization (${failure}) returns explicit recovery instead of success`,async()=>{
  const harness=fakeSupabase(failure==="error"?{finalizationError:true}:{zeroFinalization:true});
  const result=await processSellerInventoryCsv({file:csvFile([row("Stock-A")]),sellerId,supabase:harness.client,mode:"import"});
  assert.equal(result.status,"recovery");
  assert.equal(result.batchId,"batch-1");
  assert.equal(result.fileReset,"clear");
  assert.equal(result.validRows,undefined);
  assert.equal(result.createdRows,undefined);
  assert.equal(result.rejectedRows,undefined);
  assert.match(result.message,/do not upload this file again/i);
  assert.equal(harness.state.parts.length,1);
 });
}

test("the exact 5,000-row boundary previews and 5,001 rows are rejected",async()=>{
 const harness=fakeSupabase();
 const atLimit=csvFile(Array.from({length:5000},(_,index)=>row(`stock-${index}`)));
 const accepted=await processSellerInventoryCsv({file:atLimit,sellerId,supabase:harness.client,mode:"preview"});
 assert.equal(accepted.status,"preview");
 assert.equal(accepted.validRows,5000);
 assert.equal(accepted.fileReset,"retain");

 const overLimit=csvFile(Array.from({length:5001},(_,index)=>row(`stock-${index}`)));
 const rejected=await processSellerInventoryCsv({file:overLimit,sellerId,supabase:harness.client,mode:"preview"});
 assert.equal(rejected.status,"error");
 assert.match(rejected.message,/5,001 rows.*5,000 rows/i);
 assert.equal(rejected.fileReset,"retain");
});

test("the exact 20 MiB boundary is accepted and one byte more is rejected",async()=>{
 const harness=fakeSupabase();
 const prefix="title,description,category,price_gbp,seller_reference\nFord Focus headlight,\"";
 const suffix="\",headlights,49.95,stock-a";
 const exactContents=prefix+"x".repeat(20*1024*1024-prefix.length-suffix.length)+suffix;
 const accepted=await processSellerInventoryCsv({file:new File([exactContents],"inventory.csv"),sellerId,supabase:harness.client,mode:"preview"});
 assert.equal(accepted.status,"preview");
 assert.equal(accepted.validRows,1);
 assert.equal(accepted.fileReset,"retain");

 const rejected=await processSellerInventoryCsv({file:new File([exactContents,"x"],"inventory.csv"),sellerId,supabase:harness.client,mode:"preview"});
 assert.equal(rejected.status,"error");
 assert.match(rejected.message,/20 MiB/i);
 assert.equal(rejected.fileReset,"retain");
});

const componentCompiled=compile("src/components/bulk-inventory-import.tsx",{jsx:true});
const jsx=(type,props)=>({type,props:props??{}});

function mountComponent(actionState){
 const refs=[];let refIndex=0;let effects=[];
 const exports={};
 vm.runInNewContext(componentCompiled,{
  exports,
  require(name){
   if(name==="react/jsx-runtime")return {jsx,jsxs:jsx};
   if(name==="react")return {
    useActionState(handler,initial){return [actionState??initial,handler,false];},
    useEffect(effect){effects.push(effect);},
    useRef(value){const index=refIndex++;return refs[index]??(refs[index]={current:value});}
   };
   if(name==="next/link")return {__esModule:true,default:"a"};
   if(name==="lucide-react")return new Proxy({},{get:()=>()=>null});
   if(name==="@/app/dashboard/import/actions")return {bulkImportCsv(){}};
   if(name==="@/lib/inventory-import-constants")return {BULK_IMPORT_MAX_ROWS:5000,BULK_IMPORT_MAX_FILE_BYTES:20*1024*1024};
   throw new Error(name);
  }
 });
 refIndex=0;effects=[];
 const tree=exports.BulkInventoryImport();
 return {tree,refs,flushEffects(){effects.forEach(effect=>effect());}};
}

function descendants(node,result=[]){
 if(!node||typeof node!=="object")return result;
 result.push(node);
 const children=node.props?.children;
 for(const child of Array.isArray(children)?children:[children])descendants(child,result);
 return result;
}

function renderedText(node){
 if(node===null||node===undefined||typeof node==="boolean")return "";
 if(Array.isArray(node))return node.map(renderedText).join("");
 if(typeof node==="object")return renderedText(node.props?.children);
 return String(node);
}

test("action reset retains the CSV after preview while a genuine reset stays native",()=>{
 const view=mountComponent({status:"preview",fileReset:"retain",rowsReceived:1,validRows:1,rejectedRows:0});
 const form=descendants(view.tree).find(node=>node.type==="form");
 assert.equal(typeof form.props.onSubmitCapture,"function");
 assert.equal(typeof form.props.onReset,"function");
 form.props.onSubmitCapture();
 const actionReset=new Event("reset",{cancelable:true});
 form.props.onReset({nativeEvent:actionReset,preventDefault:()=>actionReset.preventDefault()});
 assert.equal(actionReset.defaultPrevented,true);

 const genuineReset=new Event("reset",{cancelable:true});
 form.props.onReset({nativeEvent:genuineReset,preventDefault:()=>genuineReset.preventDefault()});
 assert.equal(genuineReset.defaultPrevented,false);
});

test("a recovery after writes clears the selected file and renders report and draft links",()=>{
 const state={status:"recovery",fileReset:"clear",batchId:"batch-1",message:"Reporting incomplete. Do not upload this file again."};
 const view=mountComponent(state);
 const input=descendants(view.tree).find(node=>node.type==="input"&&node.props.name==="file");
 input.props.ref.current={value:"C:\\fakepath\\inventory.csv"};
 view.flushEffects();
 assert.equal(input.props.ref.current.value,"");
 const links=descendants(view.tree).filter(node=>node.type==="a").map(node=>node.props.href);
 assert.ok(links.includes("/dashboard/import/batch-1"));
 assert.ok(links.includes("/dashboard?inventoryStatus=draft&importBatch=batch-1"));
 assert.match(renderedText(view.tree),/do not upload/i);
});

test("the component presents the shared 5,000-row and 20 MiB limits",()=>{
 const text=renderedText(mountComponent({status:"idle"}).tree);
 assert.match(text,/5,000 rows/);
 assert.match(text,/20 MiB/);
});

test("the server action revalidates imported drafts when report finalization needs recovery",async()=>{
 const exports={};
 const revalidated=[];
 const recovery={status:"recovery",message:"Report incomplete",batchId:"batch-1",fileReset:"clear"};
 vm.runInNewContext(compile("src/app/dashboard/import/actions.ts"),{
  exports,FormData,File,
  require(name){
   const dependencies={
    "next/cache":{revalidatePath:path=>revalidated.push(path)},
    "next/navigation":{redirect(){}},
    "@/lib/auth":{requireSeller:async()=>({user:{id:"owner-1"}})},
    "@/lib/data/marketplace":{getSellerForOwner:async()=>({id:sellerId})},
    "@/lib/supabase/server":{createSupabaseServerClient:async()=>({})},
    "@/lib/identifiers":{isUuid:()=>true},
    "@/lib/inventory-csv-import":{processSellerInventoryCsv:async()=>recovery},
    "@/lib/marketplace-policy":{hasCurrentMarketplaceTerms:async()=>true}
   };
   if(name in dependencies)return dependencies[name];
   throw new Error(name);
  }
 });
 const formData=new FormData();
 formData.set("file",csvFile([row("Stock-A")]));
 formData.set("mode","import");
 const result=await exports.bulkImportCsv({status:"idle"},formData);
 assert.deepEqual(result,recovery);
 assert.deepEqual(revalidated,["/dashboard","/dashboard/import"]);
});
