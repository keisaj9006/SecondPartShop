import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const compile=path=>ts.transpileModule(fs.readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const transport={};
vm.runInNewContext(compile("src/lib/upload-transport.ts"),{exports:transport});
const exports={};
const jsx=(type,props)=>({type,props});
vm.runInNewContext(compile("src/components/case-evidence-panel.tsx"),{
 exports,
 require(name){
  if(name==="@/lib/upload-transport")return transport;
  if(name==="react/jsx-runtime")return {jsx,jsxs:jsx};
  if(name==="react")return {useActionState:()=>[{status:"idle"},()=>{},false]};
  if(name==="lucide-react")return new Proxy({},{get:()=>"icon"});
  if(name==="@/app/cases/evidence-actions")return {uploadCaseEvidence(){}};
  throw Error(name);
 }
});
const findInput=node=>{
 if(!node||typeof node!=="object")return null;
 if(node.type==="input"&&node.props.name==="evidence")return node;
 const children=node.props?.children;
 for(const child of Array.isArray(children)?children:[children]){const found=findInput(child);if(found)return found;}
 return null;
};

test("case evidence rejects an oversized total before upload and clears the error on a valid replacement",()=>{
 const tree=exports.CaseEvidencePanel({caseId:"qa-case",evidence:[],canUpload:true});
 const input=findInput(tree);
 assert.ok(input);
 let validity="";
 const target={files:[{size:3*1024*1024},{size:2*1024*1024}],setCustomValidity:message=>{validity=message;}};
 input.props.onChange({currentTarget:target});
 assert.match(validity,/4 MiB/);
 assert.equal(target.files.length,2,"no selected evidence is silently discarded");
 target.files=[{size:4*1024*1024}];
 input.props.onChange({currentTarget:target});
 assert.equal(validity,"");
});

test("participants without upload permission do not receive the evidence input",()=>{
 assert.equal(findInput(exports.CaseEvidencePanel({caseId:"qa-case",evidence:[],canUpload:false})),null);
});
