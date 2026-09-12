import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,URLSearchParams,require:name=>deps[name]});return exports;}
const {groupListingsForOffers}=load('src/lib/offer-groups.ts');
const listing=(id,pricePence,oemNumber=null)=>({id,title:id,pricePence,oemNumber,images:[],sellerId:id,compatibility:{level:'buyer_verified'}});
test('offer groups preserve first encounter and ranked representative, including singles',()=>{
 const rows=[listing('single',100),listing('high',900,'OEM'),listing('middle',500,'other'),listing('low',200,'OEM')];
 const groups=groupListingsForOffers(rows,{preserveOrder:true});
 assert.deepEqual(Array.from(groups,g=>g.listings[0].id),['single','high','middle']);
 assert.deepEqual(Array.from(groups[1].listings,l=>l.id),['high','low']);
});
test('offer card derives price extrema independently and keeps buyer verified badge',()=>{
 const jsx=(type,props)=>({type,props});const badge=()=>null;
 const {OfferGroupCard}=load('src/components/offer-group-card.tsx',{'react/jsx-runtime':{jsx,jsxs:jsx},'next/image':()=>null,'next/link':()=>null,'lucide-react':{},'@/components/compatibility-badge':{CompatibilityBadge:badge}});
 const tree=OfferGroupCard({group:{kind:'oem',number:'OEM',listings:[listing('high',900),listing('low',200),listing('middle',500)]}});
 const text=[];const badges=[];
 const visit=node=>{if(Array.isArray(node))return node.forEach(visit);if(node?.props){if(node.type===badge)badges.push(node.props.info.level);visit(node.props.children);}else if(node!==null&&node!==undefined)text.push(String(node));};visit(tree);
 assert.ok(text.join('').includes('2.00'));assert.ok(text.join('').includes('9.00'));assert.deepEqual(badges,['buyer_verified']);
});
