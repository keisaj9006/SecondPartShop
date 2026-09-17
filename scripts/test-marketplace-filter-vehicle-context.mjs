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
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}
 }).outputText;
 const exports={};
 vm.runInNewContext(compiled,{
  exports,
  require(name){
   if(name==="react/jsx-runtime")return jsxRuntime;
   if(name==="next/link")return "a";
   if(name==="lucide-react")return {SlidersHorizontal:()=>null};
   if(name in dependencies)return dependencies[name];
   throw new Error(`Unexpected dependency ${name} in ${relativePath}`);
  },
  URLSearchParams
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

const {MarketplaceFiltersPanel}=moduleFrom("src/components/marketplace-filters.tsx");
const filters={
 query:"alternator",
 category:"cat-a",
 condition:"used",
 sort:"price_asc",
 minPrice:10,
 maxPrice:200,
 postcode:"EH25 9BE",
 collectionOnly:true,
 vehicleRegistration:"AB12 CDE",
 vehicleColour:"blue",
 catalogueVariant:"11111111-1111-4111-8111-111111111111",
 catalogueYear:2020,
 catalogueFuel:"petrol",
 catalogueEngineSize:1984,
 compatibleOnly:true
};

test("advanced marketplace filter submit preserves vehicle colour",()=>{
 const tree=MarketplaceFiltersPanel({filters});
 const colour=nodes(tree).find(node=>node.type==="input"&&node.props.name==="vc");
 assert.ok(colour,"Expected vehicle colour to be submitted as a hidden field");
 assert.equal(colour.props.value,"blue");
});

test("marketplace filter reset preserves vehicle colour",()=>{
 const tree=MarketplaceFiltersPanel({filters});
 const reset=nodes(tree).find(node=>node.type==="a"&&typeof node.props.href==="string"&&node.props.href.endsWith("#marketplace"));
 assert.ok(reset,"Expected Reset link");
 assert.match(reset.props.href,/(?:\?|&)vc=blue(?:&|#)/);
});
