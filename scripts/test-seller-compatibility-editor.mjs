import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import vm from "node:vm";

const compiled=ts.transpileModule(fs.readFileSync("src/components/seller-compatibility-editor.tsx","utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
}).outputText;

const responses={
 models:["Focus"],
 "years-model":[2020],
 "variants-year":[{id:"variant-1",variant:"ST"}],
 engines:[]
};

function mount(){
 const states=[];
 let stateIndex=0;
 const exports={};
 const jsx=(type,props)=>({type,props});
 const react={
  useEffect(){},
  useMemo(factory){return factory();},
  useState(value){
   const index=stateIndex++;
   if(!(index in states))states[index]=typeof value==="function"?value():value;
   return [states[index],next=>{states[index]=typeof next==="function"?next(states[index]):next;}];
  }
 };
 vm.runInNewContext(compiled,{
  exports,URLSearchParams,
  fetch:async url=>{
   const level=new URL(url,"https://secondpart.test").searchParams.get("level");
   return {ok:true,json:async()=>({items:responses[level]??[]})};
  },
  require(name){
   if(name==="react/jsx-runtime")return {jsx,jsxs:jsx};
   if(name==="react")return react;
   if(name==="lucide-react")return {CheckCircle2(){},Plus(){},Trash2(){}};
   throw new Error(name);
  }
 });
 const render=()=>{stateIndex=0;return exports.SellerCompatibilityEditor({});};
 return {render};
}

function descendants(node,result=[]){
 if(!node||typeof node!=="object")return result;
 result.push(node);
 const children=node.props?.children;
 for(const child of Array.isArray(children)?children:[children])descendants(child,result);
 return result;
}

const flush=()=>new Promise(resolve=>setImmediate(resolve));

test("the fitment confirmation keeps a nonshrinking visible checkbox and native semantics",()=>{
 const nodes=descendants(mount().render());
 const checkbox=nodes.find(node=>node.type==="input"&&node.props?.type==="checkbox");

 assert.ok(checkbox);
 assert.equal(checkbox.props.checked,false);
 assert.equal(checkbox.props.role,undefined);
 assert.equal(checkbox.props.onKeyDown,undefined);
 const label=nodes.find(node=>node.type==="label"&&(Array.isArray(node.props?.children)?node.props.children:[node.props?.children]).includes(checkbox));
 assert.ok(label,"the visible warning label must remain the checkbox's native click target");
 for(const token of ["h-5","w-5","shrink-0","accent-[#173c31]"]){
  assert.match(checkbox.props.className,new RegExp(`(?:^|\\s)${token.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}(?:\\s|$)`));
 }
});

test("a complete fitment still needs deliberate seller confirmation before it can be added",async()=>{
 const view=mount();
 let nodes=descendants(view.render());
 const choose=async(index,value)=>{
  nodes.filter(node=>node.type==="select")[index].props.onChange({target:{value}});
  await flush();
  nodes=descendants(view.render());
 };

 await choose(0,"Ford");
 await choose(1,"Focus");
 await choose(2,"2020");
 await choose(3,"variant-1");

 let addButton=nodes.find(node=>node.type==="button"&&node.props?.type==="button"&&JSON.stringify(node.props.children).includes("Add confirmed vehicle"));
 assert.equal(addButton.props.disabled,true);

 const checkbox=nodes.find(node=>node.type==="input"&&node.props?.type==="checkbox");
 checkbox.props.onChange({target:{checked:true}});
 nodes=descendants(view.render());
 addButton=nodes.find(node=>node.type==="button"&&node.props?.type==="button"&&JSON.stringify(node.props.children).includes("Add confirmed vehicle"));

 assert.equal(nodes.find(node=>node.type==="input"&&node.props?.type==="checkbox").props.checked,true);
 assert.equal(addButton.props.disabled,false);
});
