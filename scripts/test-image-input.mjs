import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const compiled=ts.transpileModule(fs.readFileSync("src/components/optimized-image-input.tsx","utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
}).outputText;

function mount({createImageBitmap}={}){
 const form=new EventTarget();
 const selectedFile={name:"qa.png",type:"image/png",size:1200};
 const input={form,files:[selectedFile],value:"qa.png"};
 const document={createElement:()=>({
  getContext:()=>({drawImage(){}}),
  toBlob:callback=>callback(new Blob([new Uint8Array(1300)],{type:"image/webp"}))
 })};
 const states=[];const refs=[];const effects=[];let stateIndex=0;let refIndex=0;
 const exports={};
 const jsx=(type,props)=>({type,props});
 vm.runInNewContext(compiled,{
  exports,Blob,document,Event,Error,queueMicrotask,
  ...(createImageBitmap?{createImageBitmap}:{}),
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
 return {form,input,selectedFile,render,tree,cleanup};
}

test("a cancelled native reset retains the selected File and ready feedback",async()=>{
 const view=mount();
 await view.tree.props.children[0].props.onChange();
 assert.match(JSON.stringify(view.render()),/1 photo ready to upload/);

 view.form.addEventListener("reset",event=>event.preventDefault());
 const resetEvent=new Event("reset",{cancelable:true});
 assert.equal(view.form.dispatchEvent(resetEvent),false);
 await Promise.resolve();

 assert.equal(view.input.files[0],view.selectedFile);
 assert.match(JSON.stringify(view.render()),/1 photo ready to upload/);
 for(const cleanup of view.cleanup)cleanup?.();
});

test("a cancelled reset does not invalidate in-flight image optimization",async()=>{
 let resolveOptimization;
 const view=mount({createImageBitmap:()=>new Promise(resolve=>{resolveOptimization=resolve;})});
 const optimization=view.tree.props.children[0].props.onChange();
 view.form.addEventListener("reset",event=>event.preventDefault());

 const resetEvent=new Event("reset",{cancelable:true});
 assert.equal(view.form.dispatchEvent(resetEvent),false);
 await Promise.resolve();
 resolveOptimization({width:100,height:100,close(){}});
 await optimization;

 assert.equal(view.input.files[0],view.selectedFile);
 assert.match(JSON.stringify(view.render()),/1 photo ready to upload/);
 for(const cleanup of view.cleanup)cleanup?.();
});

test("a genuine native form reset clears ready-photo feedback",async()=>{
 const view=mount();
 await view.tree.props.children[0].props.onChange();
 assert.match(JSON.stringify(view.render()),/1 photo ready to upload/);
 const resetEvent=new Event("reset",{cancelable:true});
 assert.equal(view.form.dispatchEvent(resetEvent),true);
 view.input.files=[];
 await Promise.resolve();
 assert.doesNotMatch(JSON.stringify(view.render()),/ready to upload/);
 for(const cleanup of view.cleanup)cleanup?.();
});

test("a genuine reset cannot restore a queued successful File selection",async()=>{
 const view=mount();
 const optimization=view.tree.props.children[0].props.onChange();

 const resetEvent=new Event("reset",{cancelable:true});
 assert.equal(view.form.dispatchEvent(resetEvent),true);
 view.input.files=[];
 await optimization;
 await Promise.resolve();

 assert.equal(view.input.files.length,0);
 assert.doesNotMatch(JSON.stringify(view.render()),/ready to upload/);
 for(const cleanup of view.cleanup)cleanup?.();
});

test("a genuine reset invalidates stale asynchronous optimization feedback",async()=>{
 let rejectOptimization;
 const view=mount({createImageBitmap:()=>new Promise((_,reject)=>{rejectOptimization=reject;})});
 const optimization=view.tree.props.children[0].props.onChange();
 assert.match(JSON.stringify(view.render()),/Optimizing photos/);

 const resetEvent=new Event("reset",{cancelable:true});
 assert.equal(view.form.dispatchEvent(resetEvent),true);
 view.input.files=[];
 await Promise.resolve();
 rejectOptimization(new Error("late image failure"));
 await optimization;

 const rendered=JSON.stringify(view.render());
 assert.doesNotMatch(rendered,/late image failure/);
 assert.doesNotMatch(rendered,/ready to upload/);
 assert.doesNotMatch(rendered,/Optimizing photos/);
 for(const cleanup of view.cleanup)cleanup?.();
});
