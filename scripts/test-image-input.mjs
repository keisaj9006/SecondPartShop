import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const compiled=ts.transpileModule(fs.readFileSync("src/components/optimized-image-input.tsx","utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
}).outputText;

function mount(){
 const form=new EventTarget();
 const input={form,files:[{name:"qa.png",type:"image/png",size:1200}],value:"qa.png"};
 const states=[];const refs=[];const effects=[];let stateIndex=0;let refIndex=0;
 const exports={};
 const jsx=(type,props)=>({type,props});
 vm.runInNewContext(compiled,{
  exports,Event,Error,
  DataTransfer:class{files=[];items={add:file=>this.files.push(file)};},
  require(name){
   if(name==="react/jsx-runtime")return {jsx,jsxs:jsx};
   if(name==="react")return {
    useState(value){const i=stateIndex++;if(!(i in states))states[i]=value;return [states[i],v=>states[i]=v];},
    useRef(value){const i=refIndex++;return refs[i]??(refs[i]={current:i===0?input:value});},
    useEffect(effect){effects.push(effect);}
   };
   throw new Error(name);
  }
 });
 const render=()=>{stateIndex=0;refIndex=0;return exports.OptimizedImageInput({name:"images"});};
 const tree=render();
 const cleanup=effects.map(effect=>effect());
 return {form,input,render,tree,cleanup};
}

test("native form reset clears stale ready-photo feedback after a rejected submission",async()=>{
 const view=mount();
 await view.tree.props.children[0].props.onChange();
 assert.match(JSON.stringify(view.render()),/1 photo ready to upload/);
 view.input.files=[];
 view.form.dispatchEvent(new Event("reset"));
 assert.doesNotMatch(JSON.stringify(view.render()),/ready to upload/);
 for(const cleanup of view.cleanup)cleanup?.();
});
