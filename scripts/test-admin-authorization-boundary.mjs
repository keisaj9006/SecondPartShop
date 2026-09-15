import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root="src/app/admin";

function walk(dir){
 const out=[];
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  const full=path.join(dir,entry.name);
  if(entry.isDirectory())out.push(...walk(full));
  else out.push(full.replaceAll("\\","/"));
 }
 return out;
}

function functionBody(source,start){
 const open=source.indexOf("{",start);
 assert.notEqual(open,-1,"exported async function must have a body");
 let depth=0;
 for(let i=open;i<source.length;i+=1){
  if(source[i]==="{")depth+=1;
  else if(source[i]==="}"){
   depth-=1;
   if(depth===0)return source.slice(open+1,i);
  }
 }
 assert.fail("exported async function body is not balanced");
}

const files=walk(root);
const pages=files.filter(file=>file.endsWith("/page.tsx"));
const actionFiles=files.filter(file=>file.endsWith("/actions.ts"));
const routeFiles=files.filter(file=>file.endsWith("/route.ts"));

test("every current admin page is guarded before privileged data access",()=>{
 assert.ok(pages.length>=1,"expected admin pages");
 for(const file of pages){
  const source=fs.readFileSync(file,"utf8");
  const pageStart=source.search(/export\s+default\s+async\s+function\b/);
  assert.notEqual(pageStart,-1,`${file} must remain a server page with an explicit admin boundary`);
  const guard=source.indexOf("await requireAdmin(",pageStart);
  assert.notEqual(guard,-1,`${file} must call requireAdmin`);
  const privileged=["createSupabaseAdminClient()","createSupabaseServerClient()"]
   .map(marker=>source.indexOf(marker,pageStart))
   .filter(index=>index>=0);
  if(privileged.length)assert.ok(guard<Math.min(...privileged),`${file} must authorize before creating a Supabase client`);
 }
});

test("every exported admin server action authorizes inside its own function",()=>{
 for(const file of actionFiles){
  const source=fs.readFileSync(file,"utf8");
  assert.ok(source.includes('"use server"')||source.includes("'use server'"),`${file} must remain a server-action module`);
  const exports=[...source.matchAll(/export\s+async\s+function\s+([A-Za-z0-9_]+)\s*\(/g)];
  assert.ok(exports.length>=1,`${file} must expose at least one server action`);
  for(const match of exports){
   const body=functionBody(source,match.index??0);
   assert.match(body,/\b(?:await\s+)?requireAdmin\s*\(/,`${file}#${match[1]} must call requireAdmin inside the action`);
  }
 }
});

test("any admin route handler must carry the same explicit boundary",()=>{
 for(const file of routeFiles){
  const source=fs.readFileSync(file,"utf8");
  assert.match(source,/\brequireAdmin\s*\(/,`${file} must call requireAdmin`);
 }
});
